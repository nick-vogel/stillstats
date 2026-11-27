// Limits: these tests run Node's fetch against a local server, not a browser's fetch. A browser
// rejects an offline or blocked request with its own TypeError, which no test here observes.
import { once } from 'node:events'
import { createServer, type RequestListener } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, onTestFinished, test } from 'vitest'
import { readAnswer } from './api.ts'

async function serving(listener: RequestListener): Promise<string> {
  const server = createServer(listener).listen(0)
  onTestFinished(() => {
    server.close()
  })
  await once(server, 'listening')
  return `http://localhost:${(server.address() as AddressInfo).port}/api/channels`
}

describe('an answer that is not a JSON answer arrives as an internal error', () => {
  test('an HTML error page, as a proxy answers a failed deploy, reads as an internal error', async () => {
    const url = await serving((_, res) => {
      res.writeHead(502, { 'content-type': 'text/html' }).end('<html>Bad gateway</html>')
    })

    expect(await readAnswer(url)).toEqual({ error: 'internal' })
  })

  test('a request the network drops reads as an internal error', async () => {
    const url = await serving((req) => req.socket.destroy())

    expect(await readAnswer(url)).toEqual({ error: 'internal' })
  })

  test("a JSON refusal arrives as the API's answer", async () => {
    const url = await serving((_, res) => {
      res.writeHead(502, { 'content-type': 'application/json' }).end('{"refusal":"google_failed"}')
    })

    expect(await readAnswer(url)).toEqual({ refusal: 'google_failed' })
  })
})
