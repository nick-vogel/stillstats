// Limits: a local server stands in for Google's RISC configuration endpoint, on a bound far
// shorter than production's googleCallTimeoutMs. These tests show the reader gives up on an
// endpoint that never answers and asks it again for the next event, not how Google's endpoint
// fails.
import { createServer as createHttpServer } from 'node:http'
import { type AddressInfo, createServer, type Socket } from 'node:net'
import { expect, onTestFinished, test } from 'vitest'
import { createSecurityEventReader } from './risc.ts'

// Far under googleCallTimeoutMs, so only the reader's option can end a read in time.
const callTimeoutMs = 200

/** A RISC configuration endpoint that accepts every connection and never answers. */
async function silentConfiguration(): Promise<{ url: string; connections: () => number }> {
  const sockets: Socket[] = []
  const server = createServer((socket) => sockets.push(socket)).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  onTestFinished(() => {
    for (const socket of sockets) socket.destroy()
    server.close()
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/.well-known/risc-configuration`,
    connections: () => sockets.length,
  }
}

/** A RISC configuration endpoint that answers 200 and the first bytes of its body, then stalls. */
async function stalledConfiguration(): Promise<string> {
  const server = createHttpServer((_, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.write('{"issuer":')
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  onTestFinished(() => {
    server.closeAllConnections()
    server.close()
  })
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}/.well-known/risc-configuration`
}

/**
 * A RISC configuration endpoint that holds its first request open and answers every later one
 * with a configuration. Its keys are never fetched: a token that is not a JWS fails before them.
 */
async function configurationThatHoldsItsFirstRequest(): Promise<{
  url: string
  requests: () => number
}> {
  let requests = 0
  const server = createHttpServer((_, response) => {
    requests += 1
    if (requests === 1) return
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({ issuer: 'https://accounts.google.com', jwks_uri: `${base}/keys` }),
    )
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  onTestFinished(() => {
    server.closeAllConnections()
    server.close()
  })
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`
  return { url: `${base}/.well-known/risc-configuration`, requests: () => requests }
}

const outcome = (read: Promise<unknown>) =>
  read.then(
    () => 'answered',
    () => 'rejected',
  )
const pendingAfter = (ms: number) =>
  new Promise<string>((resolve) => setTimeout(() => resolve('pending'), ms))
/** How `read` settles within the Google call bound, with some slack: answered, rejected or pending. */
const settledWithinBound = (read: Promise<unknown>) =>
  Promise.race([outcome(read), pendingAfter(callTimeoutMs + 500)])

test('a RISC configuration endpoint that never answers fails the read within the Google call bound', {
  timeout: 2_000,
}, async () => {
  const configuration = await silentConfiguration()
  const reader = createSecurityEventReader({
    configurationUrl: configuration.url,
    clientId: 'c',
    callTimeoutMs,
  })

  const settled = await settledWithinBound(reader.read('any.security.event'))

  expect(settled).toBe('rejected')
})

test('a RISC event after a configuration fetch that timed out asks for the configuration again, and is verified', {
  timeout: 2_000,
}, async () => {
  const configuration = await configurationThatHoldsItsFirstRequest()
  const reader = createSecurityEventReader({
    configurationUrl: configuration.url,
    clientId: 'c',
    callTimeoutMs,
  })
  expect(await settledWithinBound(reader.read('first.security.event'))).toBe('rejected')

  const read = await reader.read('junk.security.event')

  expect({ read, requests: configuration.requests() }).toEqual({
    read: { ok: false },
    requests: 2,
  })
})

test('a later RISC event, while the configuration fetch hangs, ends within the same bound and asks for no second configuration', {
  timeout: 2_000,
}, async () => {
  const configuration = await silentConfiguration()
  const reader = createSecurityEventReader({
    configurationUrl: configuration.url,
    clientId: 'c',
    callTimeoutMs,
  })
  void outcome(reader.read('first.security.event'))
  await pendingAfter(callTimeoutMs / 4)

  const settled = await settledWithinBound(reader.read('second.security.event'))

  expect({ settled, connections: configuration.connections() }).toEqual({
    settled: 'rejected',
    connections: 1,
  })
})

test('a RISC configuration endpoint that stalls its body after its headers fails the read within the Google call bound', {
  timeout: 2_000,
}, async () => {
  const reader = createSecurityEventReader({
    configurationUrl: await stalledConfiguration(),
    clientId: 'c',
    callTimeoutMs,
  })

  const settled = await settledWithinBound(reader.read('any.security.event'))

  expect(settled).toBe('rejected')
})
