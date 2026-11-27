import type { ErrorEvent } from '@sentry/node'
import { describe, expect, test } from 'vitest'
import { scrubBreadcrumb, scrubEvent, scrubTransaction, type TransactionEvent } from './scrub.ts'
import { accessToken, channelId, refreshToken, views, youtubeChannelId } from './test-support.ts'

function leaked(event: unknown): string[] {
  const text = JSON.stringify(event)
  return [refreshToken, accessToken, youtubeChannelId, views].filter((value) =>
    text.includes(value),
  )
}

describe('the scrubbing hook', () => {
  test('an event leaves with no token in its message, its exception or its breadcrumbs', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: `refresh failed for ${refreshToken}`,
      exception: {
        values: [{ type: 'Error', value: `Google answered 401 to Bearer ${accessToken}` }],
      },
      breadcrumbs: [
        { category: 'http', message: `POST /token?refresh_token=${refreshToken}` },
        { category: 'console', message: 'reading', data: { token: accessToken } },
      ],
    }

    expect(leaked(scrubEvent(event))).toEqual([])
  })

  test('an event keeps an internal id and drops every other context value', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'A channel deletion is still incomplete',
      extra: { channelId, views, youtubeChannelId },
      contexts: { report: { channelId, views, accessToken } },
      tags: { channelId, youtubeChannelId },
      user: { id: channelId, email: 'creator@example.com' },
    }

    const scrubbed = scrubEvent(event)

    expect(leaked(scrubbed)).toEqual([])
    expect(JSON.stringify(scrubbed)).not.toContain('creator@example.com')
    expect(scrubbed.extra).toEqual({ channelId })
    expect(scrubbed.contexts?.report).toEqual({ channelId })
    expect(scrubbed.tags).toEqual({ channelId })
  })

  test('an event keeps the allowed keys, which hold no id and no value of a creator', () => {
    const route = '/api/channels/:channelId/summary'
    const scrubbed = scrubEvent({
      type: undefined,
      extra: {
        channelId,
        status: '503',
        status_code: 503,
        method: 'GET',
        port: '3000',
        route,
        quotaDay: '2026-10-04',
        unitsSpent: 9050,
        unitsUsable: 9000,
        countedDay: '2026-11-10',
        requeues: 10,
      },
    })

    expect(scrubbed.extra).toEqual({
      channelId,
      status: '503',
      status_code: '503',
      method: 'GET',
      port: '3000',
      route,
      quotaDay: '2026-10-04',
      unitsSpent: '9050',
      unitsUsable: '9000',
      countedDay: '2026-11-10',
      requeues: '10',
    })
  })

  test('an event leaves with no analytics number in its message or its exception', () => {
    const scrubbed = scrubEvent({
      type: undefined,
      message: `expected ${views} views`,
      exception: { values: [{ type: 'Error', value: 'views fell to 1,204.5' }] },
    })

    expect(scrubbed.message).toBe('expected [number] views')
    expect(scrubbed.exception?.values?.[0]?.value).toBe('views fell to [number]')
  })

  test('an event keeps an HTTP status in its message, which is no analytics value', () => {
    const scrubbed = scrubEvent({ type: undefined, message: 'Google answered 401' })

    expect(scrubbed.message).toBe('Google answered 401')
  })

  test('an event keeps a uuid in its message whole, digits included', () => {
    const message = `the deletion of ${channelId} is incomplete`

    expect(scrubEvent({ type: undefined, message }).message).toBe(message)
  })

  test('an event leaves with no request body, header, cookie or query string', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        method: 'GET',
        url: `https://app.example.com/api/channels?access_token=${accessToken}`,
        query_string: `access_token=${accessToken}`,
        headers: { authorization: `Bearer ${accessToken}` },
        cookies: { session: refreshToken },
        data: { views },
      },
    }

    const scrubbed = scrubEvent(event)

    expect(leaked(scrubbed)).toEqual([])
    expect(scrubbed.request).toEqual({ method: 'GET', url: 'https://app.example.com/api/channels' })
  })

  test('an event leaves with no YouTube video id in a video path', () => {
    const videoId = 'dQw4w9WgXcQ'
    const event: ErrorEvent = {
      type: undefined,
      message: `GET /api/channels/${channelId}/videos/${videoId} failed`,
      request: { url: `https://app.example.com/app/videos/${videoId}?window=last28` },
    }

    const scrubbed = scrubEvent(event)

    expect(JSON.stringify(scrubbed)).not.toContain(videoId)
    expect(scrubbed.request?.url).toBe('https://app.example.com/app/videos/[youtube id]')
  })

  test("an event's transaction name, the request's path the SDK names it by, leaves with no YouTube video id and keeps the internal id", () => {
    const videoId = 'dQw4w9WgXcQ'
    const event: ErrorEvent = {
      type: undefined,
      transaction: `GET /api/channels/${channelId}/videos/${videoId}`,
    }

    const scrubbed = scrubEvent(event)

    expect(scrubbed.transaction).toBe(`GET /api/channels/${channelId}/videos/[youtube id]`)
  })

  test('an event leaves with no local variable from a stack frame', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            value: 'refresh failed',
            stacktrace: { frames: [{ function: 'refresh', vars: { refreshToken, views } }] },
          },
        ],
      },
    }

    expect(leaked(scrubEvent(event))).toEqual([])
  })

  test('a breadcrumb leaves with no token and no analytics value', () => {
    const breadcrumb = scrubBreadcrumb({
      category: 'fetch',
      message: `GET /youtube/v3/channels?id=${youtubeChannelId}`,
      data: {
        url: `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
        views,
        channelId,
      },
    })

    expect(leaked(breadcrumb)).toEqual([])
    expect(breadcrumb.data).toEqual({ channelId })
  })
})

describe('the trace scrubbing hook', () => {
  const userId = '0b6f3c2e-1a4d-4c8e-9f21-7d3e5a9b1c44'
  const email = 'timed-reader@example.com'
  const videoId = 'timedvideo1'
  const query = `window=last28&ids=${videoId}&channel=${channelId}`

  /** A transaction whose name, URL, spans, tags and data hold every ID a request can carry. */
  const transaction: TransactionEvent = {
    type: 'transaction',
    transaction: `GET /api/channels/${channelId}/videos/${videoId}`,
    transaction_info: { source: 'url' },
    start_timestamp: 1795478800.1,
    timestamp: 1795478800.2,
    request: {
      method: 'GET',
      url: `https://stillstats.com/api/channels/${channelId}/videos/${videoId}?${query}`,
      query_string: query,
      headers: { cookie: `session=${accessToken}` },
      data: { email },
    },
    user: { id: userId, email },
    extra: { channelId, email },
    tags: { channelId, window: 'last28', youtubeChannelId },
    breadcrumbs: [{ category: 'http', message: `GET /youtube/v3/channels?id=${youtubeChannelId}` }],
    contexts: {
      trace: {
        span_id: 'b699a0442ef94a19',
        trace_id: 'dbfe119901b14f399c9fb1a65490cafd',
        op: 'http.server',
        data: {
          'sentry.op': 'http.server',
          'sentry.origin': 'manual',
          'sentry.source': 'route',
          'sentry.sample_rate': 1,
          'http.request.method': 'GET',
          'http.response.status_code': 200,
          window: 'last28',
          filters: 'format,sort',
          cache: 'hit',
          channelId,
          'user.id': userId,
          'user.email': email,
          'url.full': `https://stillstats.com/api/channels/${channelId}?${query}`,
        },
      },
      runtime: { name: 'node', version: 'v24.22.1' },
      os: { name: 'Linux' },
      report: { channelId, email },
    },
    spans: [
      {
        span_id: '98505ad2d4e62c23',
        trace_id: 'dbfe119901b14f399c9fb1a65490cafd',
        parent_span_id: 'b699a0442ef94a19',
        start_timestamp: 1795478800.11,
        timestamp: 1795478800.19,
        op: 'http.client',
        status: 'ok',
        description: `GET https://google.example.com/youtube/v3/channels/${youtubeChannelId}/videos/${videoId}?access_token=${accessToken}`,
        data: {
          'sentry.op': 'http.client',
          'http.request.method': 'GET',
          'http.response.status_code': 200,
          'server.address': 'google.example.com',
          'url.full': `https://google.example.com/youtube/v3/videos?id=${videoId}`,
          'url.query': `id=${videoId}`,
        },
      },
      {
        span_id: '98505ad2d4e62c24',
        trace_id: 'dbfe119901b14f399c9fb1a65490cafd',
        start_timestamp: 1795478800.12,
        op: 'db',
        status: 'ok',
        description: `select * from channel where id = '${channelId}' and owner = '${email}' and user_id = '${userId}'`,
        data: { 'db.system.name': 'postgresql', 'db.query.text': `select ${channelId}` },
      },
    ],
  }

  function leakedIds(event: unknown): string[] {
    const text = JSON.stringify(event)
    return [channelId, userId, email, youtubeChannelId, videoId, accessToken, query].filter(
      (value) => text.includes(value),
    )
  }

  test('a transaction leaves with no channel, video or user ID, no email and no query, in its name, URL, spans, tags or data', () => {
    const scrubbed = scrubTransaction(transaction)

    expect(leakedIds(scrubbed)).toEqual([])
    expect(scrubbed.transaction).toBe('GET /api/channels/[id]/videos/[youtube id]')
    expect(scrubbed.request).toEqual({
      method: 'GET',
      url: 'https://stillstats.com/api/channels/[id]/videos/[youtube id]',
    })
    expect(scrubbed.spans?.[1]?.description).toBe(
      "select * from channel where id = '[id]' and owner = '[email]' and user_id = '[id]'",
    )
  })

  test('a transaction keeps the window, the filter names and the cache result, and the structural keys', () => {
    const scrubbed = scrubTransaction(transaction)

    expect(scrubbed.contexts?.trace?.data).toEqual({
      'sentry.op': 'http.server',
      'sentry.origin': 'manual',
      'sentry.source': 'route',
      'sentry.sample_rate': 1,
      'http.request.method': 'GET',
      'http.response.status_code': 200,
      window: 'last28',
      filters: 'format,sort',
      cache: 'hit',
    })
    expect(scrubbed.contexts?.trace).toMatchObject({
      span_id: 'b699a0442ef94a19',
      trace_id: 'dbfe119901b14f399c9fb1a65490cafd',
      op: 'http.server',
    })
    expect(scrubbed.tags).toEqual({ window: 'last28' })
    expect(scrubbed.spans?.map(({ data }) => data)).toEqual([
      {
        'sentry.op': 'http.client',
        'http.request.method': 'GET',
        'http.response.status_code': 200,
        'server.address': 'google.example.com',
      },
      { 'db.system.name': 'postgresql' },
    ])
    expect(scrubbed.spans?.map(({ span_id, op }) => ({ span_id, op }))).toEqual([
      { span_id: '98505ad2d4e62c23', op: 'http.client' },
      { span_id: '98505ad2d4e62c24', op: 'db' },
    ])
    expect(scrubbed).toMatchObject({
      type: 'transaction',
      transaction_info: { source: 'url' },
      start_timestamp: 1795478800.1,
      timestamp: 1795478800.2,
    })
  })

  test("a transaction keeps its runtime contexts' named keys and drops its user, extra, breadcrumbs and any other context data", () => {
    const scrubbed = scrubTransaction(transaction)

    expect(scrubbed.contexts?.runtime).toEqual({ name: 'node', version: 'v24.22.1' })
    expect(scrubbed.contexts?.os).toEqual({ name: 'Linux' })
    expect(scrubbed.contexts?.report).toEqual({})
    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.extra).toBeUndefined()
    expect(scrubbed.breadcrumbs).toBeUndefined()
  })

  test("a transaction's runtime contexts keep only the keys the scrub names, and its cloud resource goes", () => {
    const scrubbed = scrubTransaction({
      ...transaction,
      contexts: {
        ...transaction.contexts,
        os: { name: 'Linux', laterKey: videoId },
        cloud_resource: { 'host.id': 'i-0abc', 'cloud.account.id': '123456789012' },
      },
    })

    expect(scrubbed.contexts?.os).toEqual({ name: 'Linux' })
    expect(scrubbed.contexts).not.toHaveProperty('cloud_resource')
  })

  test("a transaction's runtime contexts keep every key @sentry/node 11.4.0 fills on a traced request but the boot and start times that mark one server", () => {
    const scrubbed = scrubTransaction({
      ...transaction,
      contexts: {
        ...transaction.contexts,
        app: {
          app_start_time: '2026-11-24T17:16:57.631Z',
          app_memory: 111738880,
          free_memory: 2048,
        },
        culture: { locale: 'en-US', timezone: 'Europe/Berlin' },
        device: {
          boot_time: '2026-11-14T21:11:17.867Z',
          arch: 'x64',
          memory_size: 17179869184,
          free_memory: 4096,
          processor_count: 8,
          cpu_description: 'Intel(R) Xeon(R)',
          processor_frequency: 2400,
        },
        os: { kernel_version: '6.8.0', name: 'Linux', version: '24.04', build: '1' },
        runtime: { name: 'node', version: 'v24.22.1' },
      },
    })

    expect(scrubbed.contexts?.app).toEqual({ app_memory: 111738880, free_memory: 2048 })
    expect(scrubbed.contexts?.culture).toEqual({ locale: 'en-US', timezone: 'Europe/Berlin' })
    expect(scrubbed.contexts?.device).toEqual({
      arch: 'x64',
      memory_size: 17179869184,
      free_memory: 4096,
      processor_count: 8,
      cpu_description: 'Intel(R) Xeon(R)',
      processor_frequency: 2400,
    })
    expect(scrubbed.contexts?.os).toEqual({
      kernel_version: '6.8.0',
      name: 'Linux',
      version: '24.04',
      build: '1',
    })
    expect(scrubbed.contexts?.runtime).toEqual({ name: 'node', version: 'v24.22.1' })
  })

  test('a transaction keeps only the keys the scrub names, at the top level, on each span and in its trace context, so a key the SDK adds later stays in the process', () => {
    const later = { laterSdkKey: videoId, server_name: 'main-box', modules: { hono: '4.0.0' } }
    const kept = {
      release: '2026.11.24',
      environment: 'production',
      sdkProcessingMetadata: {
        dynamicSamplingContext: { trace_id: 'dbfe119901b14f399c9fb1a65490cafd' },
      },
    }
    const event = {
      ...transaction,
      ...later,
      ...kept,
      spans: transaction.spans?.map((span) => ({ ...span, laterSpanKey: videoId })),
      contexts: {
        ...transaction.contexts,
        trace: { ...transaction.contexts?.trace, laterTraceKey: videoId },
      },
    } as TransactionEvent

    const scrubbed = scrubTransaction(event)

    for (const key of Object.keys(later)) expect(scrubbed).not.toHaveProperty(key)
    for (const span of scrubbed.spans ?? []) expect(span).not.toHaveProperty('laterSpanKey')
    expect(scrubbed.contexts?.trace).not.toHaveProperty('laterTraceKey')
    expect(scrubbed).toMatchObject({
      ...kept,
      type: 'transaction',
      start_timestamp: transaction.start_timestamp,
      timestamp: transaction.timestamp,
      transaction_info: { source: 'url' },
      contexts: { trace: { span_id: 'b699a0442ef94a19', op: 'http.server' } },
    })
    expect(scrubbed.spans?.[0]).toMatchObject({
      parent_span_id: 'b699a0442ef94a19',
      op: 'http.client',
    })
  })
})

test('a YouTube channel ID is masked in errors and traces whatever its last character and whatever follows it, and a longer token of word characters is kept whole', () => {
  const ytDash = 'UCabcdefghijklmnopqrstu-'
  const scrubbedError = scrubEvent({
    type: undefined,
    message: `read failed for /channels/${ytDash}/videos`,
  })
  expect(scrubbedError.message).toBe('read failed for /channels/[youtube id]/videos')

  const scrubbedTrace = scrubTransaction({
    type: 'transaction',
    transaction: `GET /channels/${ytDash}`,
    spans: [
      {
        span_id: '1',
        trace_id: '2',
        start_timestamp: 1,
        timestamp: 2,
        status: 'ok',
        description: `GET https://google.example.com/channels/${ytDash}`,
        data: {},
      },
    ],
  })
  expect(JSON.stringify(scrubbedTrace)).not.toContain(ytDash)
  expect(scrubbedTrace.spans?.[0]?.description).toBe(
    'GET https://google.example.com/channels/[youtube id]',
  )

  const realId = 'UCabcdefghijklmnopqrstuA'
  expect(
    scrubEvent({
      type: undefined,
      message: `${realId}-report.csv, ${ytDash}x, =${realId}, -${realId}, ${realId}x`,
    }).message,
  ).toBe(`[youtube id]-report.csv, [youtube id]x, =[youtube id], -[youtube id], ${realId}x`)
})
