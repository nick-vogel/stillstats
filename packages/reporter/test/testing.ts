import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gunzipSync } from 'node:zlib'
import * as Sentry from '@sentry/node'
import type { TransactionEvent } from '../src/scrub.ts'

/** The fields of a sent event the process tests read. */
export interface SentEvent {
  environment?: string
  release?: string
  exception?: { values?: { value?: string }[] }
}

export interface FakeGlitchTip {
  /** A DSN that sends to this server. */
  dsn: string
  /** Every event the server received, oldest first. */
  events(): SentEvent[]
  close(): Promise<void>
}

/**
 * A stand-in for GlitchTip on a free local port, which keeps every envelope a process sends it,
 * so a test of a spawned process sees what would leave it.
 */
export async function startFakeGlitchTip(): Promise<FakeGlitchTip> {
  const envelopes: string[] = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)
    const gzipped = request.headers['content-encoding'] === 'gzip'
    envelopes.push((gzipped ? gunzipSync(body) : body).toString('utf8'))
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return {
    dsn: `http://publickey@127.0.0.1:${port}/1`,
    events: () =>
      envelopes.flatMap((envelope) => {
        const lines = envelope.split('\n')
        const at = lines.findIndex((line) => line.startsWith('{"type":"event"'))
        return at === -1 ? [] : [JSON.parse(lines[at + 1] ?? '{}') as SentEvent]
      }),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

/** A transport that records each envelope instead of sending it, so a test sees what leaves. */
export function recordingTransport() {
  const envelopes: string[] = []
  const transport: Sentry.NodeOptions['transport'] = (options) =>
    Sentry.createTransport(options, async ({ body }) => {
      envelopes.push(typeof body === 'string' ? body : new TextDecoder().decode(body))
      return { statusCode: 200 }
    })
  return { envelopes, transport }
}

/** The transactions, the traces, in the envelopes a recording transport kept, oldest first. */
export function sentTransactions(envelopes: readonly string[]): TransactionEvent[] {
  return envelopes.flatMap((envelope) => {
    const lines = envelope.split('\n')
    const at = lines.indexOf('{"type":"transaction"}')
    return at === -1 ? [] : [JSON.parse(lines[at + 1] ?? '{}') as TransactionEvent]
  })
}

/** Waits until the SDK has handed every envelope it holds to its transport. */
export async function flushErrorTracking(): Promise<void> {
  await Sentry.flush(2000)
}

/** Stops the SDK, for a test file that started it. */
export async function closeErrorTracking(): Promise<void> {
  await Sentry.close()
}
