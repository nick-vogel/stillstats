/**
 * The cold-cache walk (creator-analytics#1055): requests every read each budget screen makes, in
 * every preset window, once with the channel's read cache cleared and once warm, and keeps each
 * request's timing from its `Server-Timing` header. The CLI that runs it is
 * `cold-cache-walk-cli.ts`, whose header holds the run steps.
 */
import { writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import {
  type VideoListAnswer,
  type VideoWindow,
  videoWindows,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { isOneOf } from './one-of.ts'

/** One read of a request, as its `Server-Timing` header names it. */
export interface WalkRead {
  name: string
  cache: 'hit' | 'miss'
  googleMs: number
  databaseMs: number
}

/** A request's total and its reads, from its `Server-Timing` header. */
export interface HeaderTiming {
  /** Null when the answer carried no header. */
  totalMs: number | null
  reads: WalkRead[]
}

interface TimingEntry {
  name: string
  description: string | undefined
  durationMs: number
}

function entriesOf(header: string): TimingEntry[] {
  return header.split(',').map((entry) => {
    const [name = '', ...parameters] = entry.trim().split(';')
    const parameter = (key: string) =>
      parameters.find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1)
    return {
      name,
      description: parameter('desc')?.replace(/^"|"$/g, ''),
      durationMs: Number(parameter('dur')),
    }
  })
}

/**
 * Reads the header `serverTimingOf` (`request-timing.ts`) writes: `total`, then a `read<i>-google`
 * and a `read<i>-db` entry for each read, each description the read's name, its cache result and
 * where the time went.
 */
export function timingOfServerTiming(header: string | null): HeaderTiming {
  if (header === null) return { totalMs: null, reads: [] }
  const entries = entriesOf(header)
  const total = entries.find(({ name }) => name === 'total')
  const reads: WalkRead[] = []
  for (const google of entries.filter(({ name }) => /^read\d+-google$/.test(name))) {
    const [name = '', cache] = (google.description ?? '').split(' ')
    const database = entries.find(
      ({ name: other }) => other === google.name.replace(/-google$/, '-db'),
    )
    reads.push({
      name,
      cache: cache === 'hit' ? 'hit' : 'miss',
      googleMs: google.durationMs,
      databaseMs: database?.durationMs ?? Number.NaN,
    })
  }
  return { totalMs: total ? total.durationMs : null, reads }
}

/** The read a step makes, one per route the budget screens call on opening. */
export type WalkReadName =
  | 'summary'
  | 'videoList'
  | 'videoDetail'
  | 'audience'
  | 'retentionCurves'
  | 'retentionPicker'

/** A preset window: every window a route takes but a custom range, which has no fixed value. */
export type PresetWindow = Exclude<VideoWindow, 'custom'>

/** One request of a pass: the screen that makes it, its read, its route and its query. */
export interface WalkStep {
  /** The web app's route template, as #1053 names it. */
  screen: '/app/' | '/app/videos/:id' | '/app/audience' | '/app/retention'
  read: WalkReadName
  /** The API's route template. The walk fills in the ids, and never writes them. */
  route: string
  /** Null for the retention comparison, which takes no window. */
  window: PresetWindow | null
  /** The query string, with no leading `?`, the window alone, left to the API's defaults else. */
  query: string
}

const channelRoute = '/api/channels/:channelId'
const presetWindows = videoWindows.filter((window): window is PresetWindow => window !== 'custom')

/**
 * Every request of one pass, in order: for each preset window, the channel screen's summary (in a
 * window the summary takes, lifetime and the calendar windows) and video list, a video's detail,
 * and Audience (calendar windows only); then the retention comparison once, its curves with no
 * picks and its picker's list. The windows come from the api-types lists, so a new one is walked
 * with no edit here.
 */
export function walkStepsOf(): WalkStep[] {
  const steps: WalkStep[] = []
  for (const window of presetWindows) {
    const query = `window=${window}`
    const afterPublish = isOneOf(windowsAfterPublish, window)
    if (!afterPublish) {
      steps.push({
        screen: '/app/',
        read: 'summary',
        route: `${channelRoute}/summary`,
        window,
        query,
      })
    }
    steps.push({
      screen: '/app/',
      read: 'videoList',
      route: `${channelRoute}/videos`,
      window,
      query,
    })
    steps.push({
      screen: '/app/videos/:id',
      read: 'videoDetail',
      route: `${channelRoute}/videos/:videoId`,
      window,
      query,
    })
    if (!afterPublish && window !== 'lifetime') {
      steps.push({
        screen: '/app/audience',
        read: 'audience',
        route: `${channelRoute}/audience`,
        window,
        query,
      })
    }
  }
  steps.push(
    {
      screen: '/app/retention',
      read: 'retentionCurves',
      route: `${channelRoute}/retention-curves`,
      window: null,
      query: '',
    },
    {
      screen: '/app/retention',
      read: 'retentionPicker',
      route: `${channelRoute}/videos`,
      window: null,
      query: 'window=lifetime&withRetentionCurve=true&sort=-publishedAt',
    },
  )
  return steps
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether the text is an internal channel id, the uuid the API's channel routes take. */
export const isInternalChannelId = (text: string): boolean => uuidPattern.test(text)

/**
 * The one statement that clears the channel's read cache, for Nick to run as the superuser in the
 * staging database terminal: no app role sees those rows outside the channel's own scope, and the
 * walk holds no database credential. Throws on anything but a uuid, so the statement holds nothing
 * but the id.
 */
export function cacheClearSqlOf(channelId: string): string {
  if (!isInternalChannelId(channelId)) {
    throw new Error('The channel must be an internal channel id, a uuid')
  }
  return `DELETE FROM read_cache WHERE channel_id = '${channelId}';`
}

/** The credentials the walk sends on every request. It writes neither anywhere. */
export interface WalkCredentials {
  /** The whole `Cookie` header value of a signed-in browser. */
  cookie: string
  /** Staging's Cloudflare Access service token; a local API needs none. */
  access?: { clientId: string; clientSecret: string }
}

/** One request's timing. It names the route's template, never an address, an id or a credential. */
export interface WalkTiming {
  pass: 'cold' | 'warm'
  screen: WalkStep['screen']
  read: WalkReadName
  route: string
  window: PresetWindow | null
  /** The answer's status, or `skipped` for a video's detail when the channel lists no video. */
  status: number | 'skipped'
  /** The walk's own clock from the request to the answer's last byte, a trip `totalMs` leaves out. */
  elapsedMs: number | null
  /** The header's `total`, the API's own time; null with no header. */
  totalMs: number | null
  reads: WalkRead[]
}

/** The walk's output file. */
export interface WalkFile {
  /** The target's origin. */
  target: string
  startedAt: string
  finishedAt: string
  timings: WalkTiming[]
}

export interface WalkOptions {
  /** The API's origin, such as `https://staging.stillstats.com` or `http://localhost:3000`. */
  target: string
  /** The internal channel id. */
  channelId: string
  credentials: WalkCredentials
  /** Gets the clear statement, and resolves once it has run. The walk runs nothing itself. */
  clearCache: (statement: string) => Promise<void>
  /** One progress line per request. */
  log: (line: string) => void
  fetch?: typeof globalThis.fetch
}

/** Why the target refused the first request, naming the credential, never its value. */
function refusalOf(status: number, credentials: WalkCredentials): string | undefined {
  if (status === 401) {
    return 'The target answered 401 to the first request: the session cookie in STILLSTATS_SESSION_COOKIE is signed out or expired. Copy a fresh one from the browser.'
  }
  if (status === 403) {
    return credentials.access
      ? 'The target answered 403 to the first request: it refused the Access service token in CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.'
      : 'The target answered 403 to the first request: it needs the Access service token in CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.'
  }
  if (status >= 300 && status < 400) {
    return `The target answered ${status} to the first request, a redirect to sign in: Cloudflare Access did not accept a service token. Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.`
  }
  return undefined
}

const msOf = (ms: number | null) => (ms === null ? 'no total' : `total ${ms} ms`)

/**
 * Clears the channel's read cache through `clearCache`, once, then walks every step of
 * `walkStepsOf` as the cold pass and again as the warm pass, one request at a time. A video's
 * detail reads the first video of the cold pass's first video list, in both passes. A 401, a 403
 * or a redirect on the first request stops the walk, as every later timing would be a refusal's;
 * any other answer is recorded with its status, and the walk goes on.
 */
export async function walk({
  target,
  channelId,
  credentials,
  clearCache,
  log,
  fetch = globalThis.fetch,
}: WalkOptions): Promise<WalkFile> {
  const origin = new URL(target).origin
  const steps = walkStepsOf()
  const headers = new Headers({ cookie: credentials.cookie })
  if (credentials.access) {
    headers.set('cf-access-client-id', credentials.access.clientId)
    headers.set('cf-access-client-secret', credentials.access.clientSecret)
  }
  const startedAt = new Date().toISOString()
  await clearCache(cacheClearSqlOf(channelId))
  const timings: WalkTiming[] = []
  let videoId: string | undefined
  for (const pass of ['cold', 'warm'] as const) {
    for (const step of steps) {
      const { screen, read, route, window, query } = step
      if (read === 'videoDetail' && videoId === undefined) {
        timings.push({
          pass,
          screen,
          read,
          route,
          window,
          status: 'skipped',
          elapsedMs: null,
          totalMs: null,
          reads: [],
        })
        log(`${pass} ${screen} ${read} ${window} skipped: the channel lists no video`)
        continue
      }
      const path = route
        .replace(':channelId', encodeURIComponent(channelId))
        .replace(':videoId', encodeURIComponent(videoId ?? ''))
      const url = new URL(query ? `${path}?${query}` : path, origin)
      const started = performance.now()
      const response = await fetch(url, { headers, redirect: 'manual' })
      const body = await response.text()
      const elapsedMs = performance.now() - started
      if (timings.length === 0) {
        const refusal = refusalOf(response.status, credentials)
        if (refusal) throw new Error(refusal)
      }
      if (pass === 'cold' && read === 'videoList' && videoId === undefined && response.ok) {
        videoId = (JSON.parse(body) as VideoListAnswer).videos[0]?.id
      }
      const { totalMs, reads } = timingOfServerTiming(response.headers.get('server-timing'))
      timings.push({
        pass,
        screen,
        read,
        route,
        window,
        status: response.status,
        elapsedMs,
        totalMs,
        reads,
      })
      log(`${pass} ${screen} ${read} ${window ?? 'no window'} ${response.status} ${msOf(totalMs)}`)
    }
  }
  return { target: origin, startedAt, finishedAt: new Date().toISOString(), timings }
}

/** Writes the walk's file, and refuses one that exists, so a rerun never overwrites a baseline. */
export function writeWalkFile(path: string, file: WalkFile): Promise<void> {
  return writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { flag: 'wx' })
}

/** What the CLI runs the walk with. */
export interface WalkSettings {
  channelId: string
  target: string
  /** An absolute path. */
  out: string
  credentials: WalkCredentials
}

export const walkUsage =
  'Usage: pnpm --filter @creator-analytics/api cold-cache-walk --channel <internal channel id> --target <origin> --out <file>, with STILLSTATS_SESSION_COOKIE set, and CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET for staging'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The CLI's settings, from its arguments and the environment, or a usage line naming the setting
 * it refuses, never the setting's value. The credentials come from the environment only, so they
 * never show in the process list or the shell history.
 */
export function walkSettingsOf(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; settings: WalkSettings } | { ok: false; usage: string } {
  const refuse = (reason: string) => ({ ok: false as const, usage: `${reason}\n${walkUsage}` })
  let values: { channel?: string; target?: string; out?: string }
  try {
    ;({ values } = parseArgs({
      // pnpm passes on the `--` before a script's arguments.
      args: argv[0] === '--' ? argv.slice(1) : [...argv],
      options: {
        channel: { type: 'string' },
        target: { type: 'string' },
        out: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }))
  } catch (error) {
    const option = /'(-[^']*)'/.exec((error as Error).message)?.[1]
    return refuse(option ? `Unknown option ${option.split('=')[0]}.` : 'Unknown argument.')
  }
  const { channel, target, out } = values
  if (!channel || !isInternalChannelId(channel)) {
    return refuse('--channel must be the internal channel id, a uuid.')
  }
  let url: URL
  try {
    url = new URL(target ?? '')
  } catch {
    return refuse("--target must be the API's origin, a URL.")
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHosts.has(url.hostname))) {
    return refuse(
      '--target must be https, or http on this machine only, so the cookie never crosses a network in clear.',
    )
  }
  if (!out) return refuse('--out must name the file to write.')
  const cookie = env.STILLSTATS_SESSION_COOKIE
  if (!cookie)
    return refuse(
      "STILLSTATS_SESSION_COOKIE must hold the signed-in browser's whole Cookie header.",
    )
  const clientId = env.CF_ACCESS_CLIENT_ID
  const clientSecret = env.CF_ACCESS_CLIENT_SECRET
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    return refuse('CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must both be set, or neither.')
  }
  // `Headers` refuses a value with CR, LF or NUL by throwing an error that quotes the whole value.
  for (const [name, value] of [
    ['STILLSTATS_SESSION_COOKIE', cookie],
    ['CF_ACCESS_CLIENT_ID', clientId],
    ['CF_ACCESS_CLIENT_SECRET', clientSecret],
  ] as const) {
    if (value && /[\r\n\0]/.test(value)) {
      return refuse(`${name} must be one line, with no line break or NUL.`)
    }
  }
  return {
    ok: true,
    settings: {
      channelId: channel,
      target: url.origin,
      // pnpm runs the script inside apps/api, so a relative file is the directory pnpm ran from's.
      out: isAbsolute(out) ? out : resolve(env.INIT_CWD ?? process.cwd(), out),
      credentials: {
        cookie,
        ...(clientId && clientSecret && { access: { clientId, clientSecret } }),
      },
    },
  }
}

/**
 * Prints the clear statement and how to run it, and resolves when Nick presses Enter, once it has
 * run. It runs nothing itself.
 */
export async function promptClear(
  statement: string,
  { input, output }: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream },
): Promise<void> {
  const lines = createInterface({ input, output, terminal: false })
  try {
    output.write(
      `Run this as the superuser in the staging database terminal, to clear the channel's read cache:\n\n  ${statement}\n\n`,
    )
    await lines.question('Press Enter once it has run, to start the cold pass. ')
    output.write('\n')
  } finally {
    lines.close()
  }
}
