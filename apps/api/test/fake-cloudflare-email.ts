import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { onTestFinished } from 'vitest'
import type { EmailPort, NotificationEmail } from '../src/notification-email.ts'

/** One request the fake Cloudflare API received. */
export interface CloudflareEmailRequest {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: unknown
}

/**
 * Stands in for Cloudflare's API: it records every request and answers Email Sending's success
 * shape, the recipient delivered, or the answer `answerWith` sets, or holds every later request
 * open unanswered once `answerNothing` is called. It closes when the test finishes.
 */
export interface FakeCloudflareEmail {
  /** Stands in for `https://api.cloudflare.com/client/v4`. */
  apiRoot: string
  received: CloudflareEmailRequest[]
  /** Answers every later request with this status and body, a string sent as it is. */
  answerWith(status: number, body: unknown): void
  /** Holds every later request open, once it is read, and never answers it. */
  answerNothing(): void
  close(): Promise<void>
}

export async function startFakeCloudflareEmail(): Promise<FakeCloudflareEmail> {
  const received: CloudflareEmailRequest[] = []
  let answer: { status: number; body: unknown } | 'nothing' = {
    status: 200,
    body: {
      success: true,
      errors: [],
      messages: [],
      result: { delivered: ['nick@example.com'], permanent_bounces: [], queued: [] },
    },
  }
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString('utf8')
    let body: unknown = text
    try {
      body = JSON.parse(text)
    } catch {}
    received.push({ method: req.method ?? '', path: req.url ?? '', headers: req.headers, body })
    if (answer === 'nothing') return
    const { status, body: answerBody } = answer
    res
      .writeHead(status, { 'content-type': 'application/json' })
      .end(typeof answerBody === 'string' ? answerBody : JSON.stringify(answerBody))
  })
  server.listen(0)
  await once(server, 'listening')
  const fake: FakeCloudflareEmail = {
    apiRoot: `http://localhost:${(server.address() as AddressInfo).port}/client/v4`,
    received,
    answerWith(status, body) {
      answer = { status, body }
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

/** The test email port: it keeps every email it is given, or rejects each once `failWith` is set. */
export interface RecordingEmailPort extends EmailPort {
  readonly sent: NotificationEmail[]
  /** Rejects every later send with this error, and keeps none of them. */
  failWith(error: Error): void
}

export function recordingEmailPort(): RecordingEmailPort {
  const sent: NotificationEmail[] = []
  let failure: Error | undefined
  return {
    sent,
    failWith(error) {
      failure = error
    },
    async send(email) {
      if (failure) throw failure
      sent.push(email)
    },
  }
}
