// Limits: as traces.test.ts, this file reads what would leave the process through the recording
// transport. Its own file, since the SDK is global per test worker: here it starts with no trace
// sample rate, as a deploy without GLITCHTIP_TRACES_SAMPLE_RATE does.
import { test } from '@creator-analytics/database/testing'
import { initErrorTracking, tracesSampleRateOf } from '@creator-analytics/reporter'
import {
  closeErrorTracking,
  flushErrorTracking,
  recordingTransport,
  sentTransactions,
} from '@creator-analytics/reporter/testing'
import { afterAll, beforeAll, expect } from 'vitest'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'

// Emails no other test file signs in with, as video-list.test.ts explains.
const creator = { sub: '1052002', email: 'untraced-reader@example.com', name: 'An Untraced Reader' }

const { envelopes, transport } = recordingTransport()

beforeAll(() => {
  initErrorTracking({
    dsn: 'https://publickey@glitchtip.example.com/1',
    transport,
    tracesSampleRate: tracesSampleRateOf({}),
  })
})

afterAll(async () => {
  await closeErrorTracking()
})

test('with no trace sample rate set, a signed-in read sends no trace, as before', async ({
  web,
}) => {
  const api = await startApi(web)
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-untraced-reader-chann')
  api.google.setChannel('UC-untraced-reader-chann', {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: [],
  })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id

  const response = await browser.fetch(`/api/channels/${channelId}/summary?window=last28`)
  await flushErrorTracking()

  expect(response.status).toBe(200)
  expect(sentTransactions(envelopes)).toEqual([])
  expect(envelopes.join('\n')).not.toContain('"type":"transaction"')
})
