import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { onTestFinished } from 'vitest'

/** One request the fake OpenPanel received. */
export interface OpenPanelRequest {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: unknown
}

/**
 * Stands in for the self-hosted OpenPanel's API: it records every request and answers 200 `{}` or
 * the status `answerWith` sets, closes the connection unanswered once `dropEveryRequest` is called,
 * or holds the request open unanswered once `answerNothing` is called; the last of the three
 * called wins. It closes when the test finishes, which ends any request it holds.
 */
export interface FakeOpenPanel {
  apiUrl: string
  clientId: string
  clientSecret: string
  /** Every request received, in order. A request counts once its whole body is read. */
  received: OpenPanelRequest[]
  /** Resolves once `received` holds `count` requests, at once if it already does. */
  untilReceived(count: number): Promise<void>
  /** Answers every later request with this status. */
  answerWith(status: number): void
  /** Closes the connection on every later request, once it is read, with no answer. */
  dropEveryRequest(): void
  /** Holds every later request open, once it is read, and never answers it. */
  answerNothing(): void
  close(): Promise<void>
}

export async function startFakeOpenPanel(): Promise<FakeOpenPanel> {
  const received: OpenPanelRequest[] = []
  let answer: number | 'drop' | 'nothing' = 200
  const waiting: { count: number; resolve: () => void }[] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString('utf8')
    let body: unknown = text
    try {
      body = JSON.parse(text)
    } catch {}
    received.push({ method: req.method ?? '', path: req.url ?? '', headers: req.headers, body })
    for (const wait of waiting.filter(({ count }) => received.length >= count)) {
      waiting.splice(waiting.indexOf(wait), 1)
      wait.resolve()
    }
    if (answer === 'drop') {
      req.socket.destroy()
      return
    }
    if (answer === 'nothing') return
    res.writeHead(answer, { 'content-type': 'application/json' }).end('{}')
  })
  server.listen(0)
  await once(server, 'listening')
  const fake: FakeOpenPanel = {
    apiUrl: `http://localhost:${(server.address() as AddressInfo).port}`,
    clientId: 'fake-openpanel-client-id',
    clientSecret: 'fake-openpanel-client-secret',
    received,
    untilReceived: (count) =>
      received.length >= count
        ? Promise.resolve()
        : new Promise((resolve) => waiting.push({ count, resolve })),
    answerWith(next) {
      answer = next
    },
    dropEveryRequest() {
      answer = 'drop'
    },
    answerNothing() {
      answer = 'nothing'
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
  onTestFinished(() => fake.close())
  return fake
}
