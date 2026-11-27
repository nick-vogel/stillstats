// Limits: this test relays to a fake OpenPanel that holds the request open, and fires the relay's
// send timeout itself once the fake holds the request. It shows that the relay gives up and reports
// when its send timeout fires, not how long the real 3 s timer waits or that 3 s suits the
// self-hosted OpenPanel. A real 50 ms timer was rejected: it starts when the relay calls fetch, so
// under a loaded full run it can fire before the fake reads the request (creator-analytics#261).
import { recordingReporter } from '@creator-analytics/reporter'
import { expect, test } from 'vitest'
import { startFakeOpenPanel } from '../test/testing.ts'
import { createEventRelay, openPanelOptionsFrom } from './index.ts'

test('an event OpenPanel accepts and never answers is given up after the send timeout, and the failure is reported', async () => {
  const openPanel = await startFakeOpenPanel()
  openPanel.answerNothing()
  const reporter = recordingReporter()
  const timeout = new AbortController()
  const relay = createEventRelay(
    {
      apiUrl: openPanel.apiUrl,
      clientId: openPanel.clientId,
      clientSecret: openPanel.clientSecret,
    },
    { reporter, sendTimeout: () => timeout.signal },
  )

  const sent = relay.send({ name: 'extension_installed' }, { userAgent: undefined, ip: undefined })
  // Stands in for a loaded full run, which can stall the event loop between the send and the
  // fake's read of the request.
  const blockedUntil = Date.now() + 200
  while (Date.now() < blockedUntil) {}
  await openPanel.untilReceived(1)
  const reason = new DOMException('The send timeout fired', 'TimeoutError')
  timeout.abort(reason)
  await sent

  expect(openPanel.received).toHaveLength(1)
  // The reason by identity: only the injected signal can have ended the send.
  expect(reporter.reports).toEqual([
    { message: 'The event relay could not reach OpenPanel', error: reason },
  ])
})

test('a server event delivered to an OpenPanel that refuses it rejects with the status, and nothing is reported', async () => {
  const openPanel = await startFakeOpenPanel()
  openPanel.answerWith(503)
  const reporter = recordingReporter()
  const relay = createEventRelay(
    {
      apiUrl: openPanel.apiUrl,
      clientId: openPanel.clientId,
      clientSecret: openPanel.clientSecret,
    },
    { reporter },
  )

  const rejected = await relay
    .deliverServerEvent({ name: 'revenue', __revenue: 900, currency: 'usd' })
    .then(
      () => undefined,
      (error: unknown) => error,
    )

  expect(rejected).toBeInstanceOf(Error)
  expect(rejected).toMatchObject({ message: 'OpenPanel refused a server event with status 503' })
  expect(openPanel.received).toHaveLength(1)
  expect(reporter.reports).toEqual([])
})

test('a server event delivered to an OpenPanel that never answers rejects with the send timeout, and nothing is reported', async () => {
  const openPanel = await startFakeOpenPanel()
  openPanel.answerNothing()
  const reporter = recordingReporter()
  const timeout = new AbortController()
  const relay = createEventRelay(
    {
      apiUrl: openPanel.apiUrl,
      clientId: openPanel.clientId,
      clientSecret: openPanel.clientSecret,
    },
    { reporter, sendTimeout: () => timeout.signal },
  )

  const delivered = relay
    .deliverServerEvent({ name: 'revenue', __revenue: 900, currency: 'usd' })
    .then(
      () => undefined,
      (error: unknown) => error,
    )
  await openPanel.untilReceived(1)
  const reason = new DOMException('The send timeout fired', 'TimeoutError')
  timeout.abort(reason)

  expect(await delivered).toBe(reason)
  expect(reporter.reports).toEqual([])
})

test('a server event OpenPanel accepts is delivered and resolves', async () => {
  const openPanel = await startFakeOpenPanel()
  const reporter = recordingReporter()
  const relay = createEventRelay(
    {
      apiUrl: openPanel.apiUrl,
      clientId: openPanel.clientId,
      clientSecret: openPanel.clientSecret,
    },
    { reporter },
  )

  await relay.deliverServerEvent({ name: 'revenue', __revenue: 900, currency: 'usd' })

  expect(openPanel.received.map(({ body }) => body)).toEqual([
    {
      type: 'track',
      payload: { name: 'revenue', properties: { __revenue: 900, currency: 'usd' } },
    },
  ])
  expect(reporter.reports).toEqual([])
})

const openPanelEnv = {
  OPENPANEL_API_URL: 'https://openpanel.example',
  OPENPANEL_CLIENT_ID: 'client-id',
  OPENPANEL_CLIENT_SECRET: 'client-secret',
}

test('the OpenPanel settings are the three values when all three are set', () => {
  expect(openPanelOptionsFrom(openPanelEnv)).toEqual({
    apiUrl: 'https://openpanel.example',
    clientId: 'client-id',
    clientSecret: 'client-secret',
  })
})

test.for(
  Object.keys(openPanelEnv).flatMap((name) => [
    { name, value: undefined },
    { name, value: '' },
  ]),
)('the OpenPanel settings are none when $name is $value', ({ name, value }) => {
  expect(openPanelOptionsFrom({ ...openPanelEnv, [name]: value })).toBeUndefined()
})
