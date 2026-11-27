import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as Sentry from '@sentry/node'
import { afterEach, describe, expect, onTestFinished, test } from 'vitest'
import { errorTrackingReporter, initErrorTracking, traceRequest } from './index.ts'
import { createLogger } from './logger.ts'
import { channelId, recordingTransport, sentTransactions } from './test-support.ts'

// Its own file, so the SDK starts in a fresh worker, as sessions.test.ts explains. The recording
// transport stands where the SDK's HTTP transport would, so these tests observe what would leave
// the process; scrub.test.ts holds the rules the trace scrubbing hook applies. They do not observe
// GlitchTip itself: a trace reaching the live project is checked by hand when the baseline starts.

const dsn = 'https://publickey@glitchtip.example.com/1'

afterEach(async () => {
  await Sentry.close()
})

/** A local server that keeps the headers of each request it is sent. */
async function startHeaderServer() {
  const received: IncomingHttpHeaders[] = []
  const server = createServer((request, response) => {
    received.push(request.headers)
    response.end('{}')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, received }
}

/**
 * One request's trace, as the API's middleware makes it. It calls out as a read would, inside a
 * child span named by the address, as the SDK's own client spans are.
 */
async function tracedRead(url: string, path: string): Promise<void> {
  await traceRequest('GET', async (trace) => {
    await Sentry.startSpan({ name: `GET ${url}${path}`, op: 'http.client' }, () =>
      fetch(`${url}${path}`),
    )
    trace.name('/api/channels/:channelId/videos')
    trace.set({ window: 'last28', filters: 'format,sort', cache: 'miss' })
    trace.status(200)
  })
}

describe('a request trace', () => {
  test.for([
    ['unset', undefined],
    ['0', 0],
  ] as const)(
    'with the rate %s, no trace leaves the process, and an error report still does',
    async ([, rate]) => {
      const { envelopes, transport } = recordingTransport()
      initErrorTracking({ dsn, transport, tracesSampleRate: rate })
      const google = await startHeaderServer()

      await tracedRead(google.url, '/youtube/v3/videos')
      errorTrackingReporter(createLogger(() => {})).report({ message: 'a refresh failed' })
      await Sentry.flush(2000)

      expect(sentTransactions(envelopes)).toEqual([])
      expect(envelopes.join('\n')).not.toContain('"type":"transaction"')
      expect(envelopes.join('\n')).toContain('"type":"event"')
    },
  )

  test('with a rate of 1.0, a request sends one trace, named by its method and route pattern, with its window, filter names and cache result', async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport, tracesSampleRate: 1 })
    const google = await startHeaderServer()

    await tracedRead(google.url, `/youtube/v3/channels/${channelId}?id=${channelId}`)
    await Sentry.flush(2000)

    const transactions = sentTransactions(envelopes)
    expect(transactions).toHaveLength(1)
    const [trace] = transactions
    expect(trace?.transaction).toBe('GET /api/channels/:channelId/videos')
    expect(trace?.transaction_info?.source).toBe('route')
    expect(trace?.contexts?.trace).toMatchObject({
      op: 'http.server',
      status: 'ok',
      data: {
        window: 'last28',
        filters: 'format,sort',
        cache: 'miss',
        'http.request.method': 'GET',
        'http.response.status_code': 200,
      },
    })
    // The call out is a child span, scrubbed as the trace is.
    expect(trace?.spans?.map(({ op }) => op)).toContain('http.client')
    expect(envelopes.join('\n')).not.toContain(channelId)
    const envelope = envelopes.find((sent) => sent.includes('"type":"transaction"'))
    const header = JSON.parse(envelope?.split('\n')[0] ?? '{}') as { trace?: { trace_id?: string } }
    expect(header.trace?.trace_id).toBe(trace?.contexts?.trace?.trace_id)
    expect(header.trace?.trace_id).toMatch(/^[0-9a-f]{32}$/)
  })

  test("with a rate of 1.0, an error reported during a request carries that request's trace", async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport, tracesSampleRate: 1 })

    await traceRequest('GET', async (trace) => {
      errorTrackingReporter(createLogger(() => {})).report({ message: 'a refresh failed' })
      trace.name('/api/me')
      trace.status(200)
    })
    await Sentry.flush(2000)

    const [request] = sentTransactions(envelopes)
    const error = envelopes
      .flatMap((envelope) => envelope.split('\n'))
      .map((line) => JSON.parse(line) as { message?: string; contexts?: { trace?: object } })
      .find(({ message }) => message === 'a refresh failed')
    expect(request?.contexts?.trace).toBeDefined()
    expect(error?.contexts?.trace).toMatchObject({
      trace_id: request?.contexts?.trace?.trace_id,
      span_id: request?.contexts?.trace?.span_id,
    })
  })

  // The SDK's own filter drops a trace answered 401 to 404, or a redirect but 300 and 304, by
  // default (`@sentry/core` 11.4.0 `DEFAULT_IGNORE_STATUS_CODES`: `[401, 404]`, `[301, 303]`,
  // `[305, 399]`).
  test('a 5xx answer marks the trace failed, and a 400 refusal does not', async () => {
    const { envelopes, transport } = recordingTransport()
    initErrorTracking({ dsn, transport, tracesSampleRate: 1 })

    for (const status of [502, 400]) {
      await traceRequest('GET', async (trace) => {
        trace.name('/api/channels/:channelId/videos')
        trace.status(status)
      })
    }
    await Sentry.flush(2000)

    expect(
      sentTransactions(envelopes).map(({ contexts }) => ({
        status: contexts?.trace?.status,
        code: contexts?.trace?.data?.['http.response.status_code'],
      })),
    ).toEqual([
      { status: 'internal_error', code: 502 },
      { status: 'ok', code: 400 },
    ])
  })

  test('no trace header leaves for a service the process calls, whatever the rate', async () => {
    for (const tracesSampleRate of [0, 1]) {
      const { transport } = recordingTransport()
      initErrorTracking({ dsn, transport, tracesSampleRate })
      const google = await startHeaderServer()

      await tracedRead(google.url, '/youtube/v3/videos')

      expect(google.received).toHaveLength(1)
      for (const header of ['sentry-trace', 'baggage', 'traceparent']) {
        expect(google.received[0]?.[header]).toBeUndefined()
      }
      await Sentry.close()
    }
  })
})
