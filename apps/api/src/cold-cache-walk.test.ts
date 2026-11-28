// Limits: the walk here reads from the fake Google server on this machine, so it shows which reads
// each request made and whether the cache answered them, never how long Google or main-box's
// Postgres takes. No test bounds a duration's size (the epic's rule: a timing bound in CI fails on a
// slow runner). The cache clear runs the walk's statement inside the test's own transaction, in the
// channel's worker scope: Nick runs it as the superuser on staging, but a superuser connection here
// would not see the rows the test's uncommitted transaction holds.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { test as databaseTest, subscribeOwner } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { sql } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  cacheClearSqlOf,
  promptClear,
  timingOfServerTiming,
  type WalkFile,
  walk,
  walkSettingsOf,
  walkStepsOf,
  writeWalkFile,
} from './cold-cache-walk.ts'
import { serverTimingOf } from './request-timing.ts'

describe("the walk's parser reads the API's own Server-Timing", () => {
  test('a header the API formats gives back its total and each read, in order, to one decimal', () => {
    const header = serverTimingOf(41.27, [
      { name: 'uploads', cache: 'miss', googleMs: 30.04, databaseMs: 2.56 },
      { name: 'videoMetrics', cache: 'hit', googleMs: 0, databaseMs: 1.2 },
    ])

    expect(timingOfServerTiming(header)).toEqual({
      totalMs: 41.3,
      reads: [
        { name: 'uploads', cache: 'miss', googleMs: 30, databaseMs: 2.6 },
        { name: 'videoMetrics', cache: 'hit', googleMs: 0, databaseMs: 1.2 },
      ],
    })
  })

  test('a header with no reads gives its total and no reads', () => {
    expect(timingOfServerTiming(serverTimingOf(3, []))).toEqual({ totalMs: 3, reads: [] })
  })

  test('a missing header gives no total and no reads', () => {
    expect(timingOfServerTiming(null)).toEqual({ totalMs: null, reads: [] })
  })
})

const calendarWindows = ['last7', 'last28', 'last90', 'last365']
const afterPublish = ['first1', 'first7', 'first28', 'first90', 'first365']

describe("the walk's plan covers every budget screen's reads in every window", () => {
  const steps = walkStepsOf()
  const windowsOf = (read: string) =>
    steps.filter((step) => step.read === read).map(({ window }) => window)

  test('each read is walked in every window its route accepts, once, and in no window it refuses', () => {
    expect(windowsOf('summary')).toEqual(['lifetime', ...calendarWindows])
    expect(windowsOf('videoList')).toEqual(['lifetime', ...calendarWindows, ...afterPublish])
    expect(windowsOf('videoDetail')).toEqual(['lifetime', ...calendarWindows, ...afterPublish])
    expect(windowsOf('audience')).toEqual(calendarWindows)
  })

  test('the retention comparison is walked once, with no window: its curves with no picks and its picker at lifetime', () => {
    expect(steps.filter(({ screen }) => screen === '/app/retention')).toEqual([
      {
        screen: '/app/retention',
        read: 'retentionCurves',
        route: '/api/channels/:channelId/retention-curves',
        window: null,
        query: '',
      },
      {
        screen: '/app/retention',
        read: 'retentionPicker',
        route: '/api/channels/:channelId/videos',
        window: null,
        query: 'window=lifetime&withRetentionCurve=true&sort=-publishedAt',
      },
    ])
  })

  test('the steps run window by window, each screen naming its route and sending the window alone', () => {
    expect(steps.slice(0, 4)).toEqual([
      {
        screen: '/app/',
        read: 'summary',
        route: '/api/channels/:channelId/summary',
        window: 'lifetime',
        query: 'window=lifetime',
      },
      {
        screen: '/app/',
        read: 'videoList',
        route: '/api/channels/:channelId/videos',
        window: 'lifetime',
        query: 'window=lifetime',
      },
      {
        screen: '/app/videos/:id',
        read: 'videoDetail',
        route: '/api/channels/:channelId/videos/:videoId',
        window: 'lifetime',
        query: 'window=lifetime',
      },
      {
        screen: '/app/',
        read: 'summary',
        route: '/api/channels/:channelId/summary',
        window: 'last7',
        query: 'window=last7',
      },
    ])
    expect(steps.find(({ read }) => read === 'audience')).toEqual({
      screen: '/app/audience',
      read: 'audience',
      route: '/api/channels/:channelId/audience',
      window: 'last7',
      query: 'window=last7',
    })
    expect(steps).toHaveLength(31)
  })
})

describe('the cache-clear statement', () => {
  test("deletes the chosen channel's read cache rows, and nothing else", () => {
    expect(cacheClearSqlOf('6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(
      "DELETE FROM read_cache WHERE channel_id = '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b';",
    )
  })

  test('refuses anything but an internal channel id, so the statement carries nothing else', () => {
    for (const channelId of ["x'; DROP TABLE channels; --", 'UC-timed-reader', '']) {
      expect(() => cacheClearSqlOf(channelId)).toThrow(/internal channel id/)
    }
  })
})

// An email no other test file signs in with, as video-list.test.ts explains.
const creator = { sub: '1055001', email: 'cold-walker@example.com', name: 'A Cold Walker' }
const youtubeChannelId = 'UC-cold-walker'

// Noon on 2026-10-07 in Pacific Time.
const noonToday = new Date('2026-10-07T19:00:00Z')

const metrics = {
  engagedViews: 10,
  views: 20,
  averageViewPercentage: 41,
  subscribersGained: 1,
  estimatedMinutesWatched: 30,
}
const uploads: FakeUpload[] = [
  {
    videoId: 'coldwalk001',
    title: 'The older upload',
    publishedAt: '2026-06-01T15:00:00Z',
    duration: 'PT4M30S',
    metrics,
  },
  {
    videoId: 'coldwalk002',
    title: 'The newer upload',
    publishedAt: '2026-09-01T15:00:00Z',
    duration: 'PT6M',
    metrics,
  },
]

const access = { clientId: 'walk-test-client-id.access', clientSecret: 'walk-test-client-secret' }

async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel(youtubeChannelId)
  api.google.setChannel(youtubeChannelId, { createdAt: '2019-03-01T06:00:00Z', uploads })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

const isDuration = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** A fetch that records each request's headers, in order, and passes it on. */
function recordingFetch(events: string[]) {
  const headers: Headers[] = []
  const recording: typeof fetch = (input, init) => {
    events.push('request')
    headers.push(new Headers(init?.headers))
    return fetch(input, init)
  }
  return { recording, headers }
}

describe('the walk against the API', () => {
  databaseTest(
    'times every step cold then warm, clears the cache once first, and writes no credential',
    { timeout: 120_000 },
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      // Fills the cache, so only the clear can make the cold pass cold.
      expect(
        (await browser.fetch(`/api/channels/${channelId}/videos?window=lifetime`)).status,
      ).toBe(200)

      const events: string[] = []
      const statements: string[] = []
      const lines: string[] = []
      const { recording, headers } = recordingFetch(events)
      const cookie = browser.cookieHeader
      const file = await walk({
        target: api.origin,
        channelId,
        credentials: { cookie, access },
        clearCache: async (statement) => {
          events.push('clear')
          statements.push(statement)
          await worker.forChannel(channelId, (tx) => tx.sql.execute(sql.raw(statement)))
        },
        log: (line) => lines.push(line),
        fetch: recording,
      })

      const steps = walkStepsOf().map(({ screen, read, route, window }) => ({
        screen,
        read,
        route,
        window,
      }))
      expect(
        file.timings.map(({ pass, screen, read, route, window }) => ({
          pass,
          screen,
          read,
          route,
          window,
        })),
      ).toEqual([
        ...steps.map((step) => ({ pass: 'cold', ...step })),
        ...steps.map((step) => ({ pass: 'warm', ...step })),
      ])
      for (const timing of file.timings) {
        expect({ read: timing.read, window: timing.window, status: timing.status }).toEqual({
          read: timing.read,
          window: timing.window,
          status: 200,
        })
        expect(isDuration(timing.elapsedMs) && isDuration(timing.totalMs)).toBe(true)
        expect(timing.reads.length).toBeGreaterThan(0)
        for (const read of timing.reads) {
          expect(['hit', 'miss']).toContain(read.cache)
          expect(isDuration(read.googleMs) && isDuration(read.databaseMs)).toBe(true)
        }
      }
      expect(lines).toHaveLength(file.timings.length)

      // The clear ran once, before any request of the walk, and the cold pass found it cleared.
      expect(statements).toEqual([cacheClearSqlOf(channelId)])
      expect(events.indexOf('clear')).toBe(0)
      const cold = file.timings.filter(({ pass }) => pass === 'cold')
      const warm = file.timings.filter(({ pass }) => pass === 'warm')
      const firstUploads = cold.flatMap(({ reads }) => reads).find(({ name }) => name === 'uploads')
      expect(firstUploads?.cache).toBe('miss')
      // Warm, every read is a hit but the revenue reads, refused before the cache with no revenue
      // consent, which miss on every request (#1051).
      const warmReads = warm.flatMap(({ reads }) => reads)
      expect(warmReads.some(({ name }) => /Revenue/.test(name))).toBe(true)
      expect(
        warmReads.filter(({ name }) => !/Revenue/.test(name)).every(({ cache }) => cache === 'hit'),
      ).toBe(true)
      expect(
        warmReads.filter(({ name }) => /Revenue/.test(name)).every(({ cache }) => cache === 'miss'),
      ).toBe(true)

      // Every request carried the cookie and both Access headers, and none of them is in a line or
      // the file, nor any id.
      expect(headers).toHaveLength(file.timings.length)
      for (const sent of headers) {
        expect(sent.get('cookie')).toBe(cookie)
        expect(sent.get('cf-access-client-id')).toBe(access.clientId)
        expect(sent.get('cf-access-client-secret')).toBe(access.clientSecret)
      }
      const out = join(await mkdtemp(join(tmpdir(), 'cold-walk-')), 'walk.json')
      await writeWalkFile(out, file)
      const written = await readFile(out, 'utf8')
      const cookieValues = cookie.split('; ').map((pair) => pair.slice(pair.indexOf('=') + 1))
      for (const secret of [cookie, ...cookieValues, access.clientId, access.clientSecret]) {
        expect(written).not.toContain(secret)
        for (const line of lines) expect(line).not.toContain(secret)
      }
      for (const id of [channelId, youtubeChannelId, ...uploads.map(({ videoId }) => videoId)]) {
        expect(written).not.toContain(id)
        for (const line of lines) expect(line).not.toContain(id)
      }
      expect(JSON.parse(written) as WalkFile).toEqual(file)
      expect(file.target).toBe(api.origin)
    },
  )

  databaseTest(
    'stops at the first request when the target refuses the session cookie, naming it but not its value',
    async ({ web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { channelId } = await connectedCreator(api)
      const cookie = 'better-auth.session_token=a-signed-out-session'
      const lines: string[] = []
      const events: string[] = []
      const { recording } = recordingFetch(events)

      const walked = walk({
        target: api.origin,
        channelId,
        credentials: { cookie },
        clearCache: async () => {},
        log: (line) => lines.push(line),
        fetch: recording,
      })

      await expect(walked).rejects.toThrow(/401.*STILLSTATS_SESSION_COOKIE/)
      await walked.catch((error: Error) =>
        expect(error.message).not.toContain('a-signed-out-session'),
      )
      expect(events.filter((event) => event === 'request')).toHaveLength(1)
      expect(lines.join('\n')).not.toContain('a-signed-out-session')
    },
  )

  /** Walks against a target that answers every request with `status`, and counts the requests. */
  async function refusedWalk(
    status: number,
    credentials: { cookie: string; access?: typeof access },
  ) {
    let requests = 0
    const lines: string[] = []
    const walked = walk({
      target: 'https://staging.example.com',
      channelId: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b',
      credentials,
      clearCache: async () => {},
      log: (line) => lines.push(line),
      fetch: async () => {
        requests += 1
        return new Response(null, { status })
      },
    })
    const error = await walked.then(
      () => undefined,
      (thrown: Error) => thrown,
    )
    return { error, requests, lines }
  }

  test.each([
    ['403 with the Access token', 403, access, /it refused the Access service token/],
    ['403 with no Access token', 403, undefined, /it needs the Access service token/],
    ['redirect to sign in', 302, undefined, /a redirect to sign in/],
  ])(
    'stops at the first request on a %s, naming the Access token but not its values',
    async (_, status, withAccess, says) => {
      const cookie = 'better-auth.session_token=a-live-session'
      const { error, requests, lines } = await refusedWalk(status, {
        cookie,
        ...(withAccess && { access: withAccess }),
      })

      expect(error?.message).toMatch(
        new RegExp(`${status}.*CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET`),
      )
      expect(error?.message).toMatch(says)
      expect(error?.message).not.toMatch(/STILLSTATS_SESSION_COOKIE/)
      for (const secret of ['a-live-session', access.clientId, access.clientSecret]) {
        expect(error?.message).not.toContain(secret)
      }
      expect(requests).toBe(1)
      expect(lines).toEqual([])
    },
  )
})

describe('the walk file', () => {
  test('is never written over, so a rerun keeps the baseline it would replace', async () => {
    const out = join(await mkdtemp(join(tmpdir(), 'cold-walk-')), 'walk.json')
    await writeFile(out, 'the baseline')
    const file: WalkFile = {
      target: 'http://localhost:3000',
      startedAt: '',
      finishedAt: '',
      timings: [],
    }

    await expect(writeWalkFile(out, file)).rejects.toThrow(/EEXIST/)
    expect(await readFile(out, 'utf8')).toBe('the baseline')
  })
})

describe("the CLI's settings", () => {
  const channel = '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b'
  const argv = [
    '--channel',
    channel,
    '--target',
    'https://staging.stillstats.com',
    '--out',
    'walk.json',
  ]
  const env = {
    STILLSTATS_SESSION_COOKIE: 'better-auth.session_token=the-session-value',
    CF_ACCESS_CLIENT_ID: 'the-client-id.access',
    CF_ACCESS_CLIENT_SECRET: 'the-client-secret',
    INIT_CWD: '/Users/someone/baseline',
  }

  test('take the channel, the target and the file from the arguments, and the credentials from the environment', () => {
    expect(walkSettingsOf(argv, env)).toEqual({
      ok: true,
      settings: {
        channelId: channel,
        target: 'https://staging.stillstats.com',
        out: '/Users/someone/baseline/walk.json',
        credentials: {
          cookie: 'better-auth.session_token=the-session-value',
          access: { clientId: 'the-client-id.access', clientSecret: 'the-client-secret' },
        },
      },
    })
  })

  test('a leading -- from pnpm is passed over, an absolute file is kept, and a local API needs no Access token', () => {
    const local = walkSettingsOf(
      ['--', '--channel', channel, '--target', 'http://localhost:3000', '--out', '/tmp/walk.json'],
      { STILLSTATS_SESSION_COOKIE: 'a=b' },
    )
    expect(local).toEqual({
      ok: true,
      settings: {
        channelId: channel,
        target: 'http://localhost:3000',
        out: '/tmp/walk.json',
        credentials: { cookie: 'a=b' },
      },
    })
    for (const target of ['http://127.0.0.1:3000', 'http://[::1]:3000']) {
      const settings = walkSettingsOf(
        ['--channel', channel, '--target', target, '--out', '/tmp/w.json'],
        env,
      )
      expect(settings.ok).toBe(true)
    }
  })

  const refusals: [string, string[], Record<string, string | undefined>, RegExp][] = [
    ['no channel', argv.slice(2), env, /--channel/],
    [
      'a channel that is not an internal id',
      ['--channel', 'UC-a-youtube-id', ...argv.slice(2)],
      env,
      /--channel/,
    ],
    ['no target', [...argv.slice(0, 2), ...argv.slice(4)], env, /--target/],
    [
      'a target that is not a URL',
      ['--channel', channel, '--target', 'staging', '--out', 'w.json'],
      env,
      /--target/,
    ],
    [
      'plain http beyond this machine',
      ['--channel', channel, '--target', 'http://staging.stillstats.com', '--out', 'w.json'],
      env,
      /--target.*https/,
    ],
    ['no file', argv.slice(0, 4), env, /--out/],
    ['an option it does not know', [...argv, '--cookie', 'x'], env, /cookie/],
    [
      'no session cookie',
      argv,
      { ...env, STILLSTATS_SESSION_COOKIE: undefined },
      /STILLSTATS_SESSION_COOKIE/,
    ],
    [
      'an Access id with no secret',
      argv,
      { ...env, CF_ACCESS_CLIENT_SECRET: undefined },
      /CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/,
    ],
    [
      'an Access secret with no id',
      argv,
      { ...env, CF_ACCESS_CLIENT_ID: '' },
      /CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/,
    ],
  ]
  test.each(refusals)(
    'refuse %s with a usage line naming the setting, never a value',
    (_, args, environment, named) => {
      const settings = walkSettingsOf(args, environment)
      if (settings.ok) throw new Error('The settings were taken')
      expect(settings.usage).toMatch(named)
      expect(settings.usage).toMatch(/^Usage: /m)
      for (const value of [
        'the-session-value',
        'the-client-id',
        'the-client-secret',
        'UC-a-youtube-id',
        'staging.stillstats.com',
      ]) {
        expect(settings.usage).not.toContain(value)
      }
    },
  )

  // A header value with CR, LF or NUL makes `Headers` throw an error that quotes the whole value,
  // which the CLI prints, so the settings refuse it before the walk sends anything.
  const brokenCredentials: [string, Record<string, string | undefined>, string][] = [
    [
      'a session cookie with a line feed',
      { ...env, STILLSTATS_SESSION_COOKIE: 'better-auth.session_token=the-session-value\nother=x' },
      'STILLSTATS_SESSION_COOKIE',
    ],
    [
      'a session cookie with a carriage return',
      { ...env, STILLSTATS_SESSION_COOKIE: 'better-auth.session_token=the-session-value\r' },
      'STILLSTATS_SESSION_COOKIE',
    ],
    [
      'a session cookie with a NUL',
      { ...env, STILLSTATS_SESSION_COOKIE: 'better-auth.session_token=the-session-value\0' },
      'STILLSTATS_SESSION_COOKIE',
    ],
    [
      'an Access id with a line break',
      { ...env, CF_ACCESS_CLIENT_ID: 'the-client-id.access\r\nx' },
      'CF_ACCESS_CLIENT_ID',
    ],
    [
      'an Access secret with a line break',
      { ...env, CF_ACCESS_CLIENT_SECRET: 'the-client-secret\nx' },
      'CF_ACCESS_CLIENT_SECRET',
    ],
  ]
  test.each(brokenCredentials)(
    'refuse %s, naming the variable on the first line, never its value',
    (_, environment, variable) => {
      const settings = walkSettingsOf(argv, environment)
      if (settings.ok) throw new Error('The settings were taken')
      expect(settings.usage.split('\n')[0]).toContain(variable)
      for (const value of ['the-session-value', 'the-client-id', 'the-client-secret']) {
        expect(settings.usage).not.toContain(value)
      }
    },
  )
})

describe('the clear prompt', () => {
  test('prints the statement and how to run it, runs nothing, and goes on at Enter', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    let printed = ''
    output.on('data', (chunk: Buffer) => {
      printed += chunk.toString()
    })
    const statement = cacheClearSqlOf('6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b')
    let answered = false

    const prompted = promptClear(statement, { input, output }).then(() => {
      answered = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(answered).toBe(false)
    input.write('\n')
    await prompted

    expect(printed).toContain(statement)
    expect(printed).toMatch(/superuser/)
    expect(printed).toMatch(/staging database terminal/)
    expect(printed).toMatch(/Enter/)
  })
})
