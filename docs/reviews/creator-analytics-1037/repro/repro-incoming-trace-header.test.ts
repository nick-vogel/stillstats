// Repro for creator-analytics#1037 pre-PR review 1, finding 2. Copy into apps/api/src/ and run
// from the repo root (Docker running, TEST_DATABASE_ADMIN_URL unset):
//   pnpm exec vitest run apps/api/src/repro-incoming-trace-header.test.ts
// Red on 7aea7d5f; green once the API's own rate decides whether a request is traced, whatever
// sentry-trace header the caller sends.
// Limits: the recording transport stands where the SDK's HTTP transport would.
import { test } from '@creator-analytics/database/testing'
import { initErrorTracking } from '@creator-analytics/reporter'
import {
  closeErrorTracking,
  flushErrorTracking,
  recordingTransport,
  sentTransactions,
} from '@creator-analytics/reporter/testing'
import { afterAll, beforeAll, expect } from 'vitest'
import { signIn } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'

const { envelopes, transport } = recordingTransport()

beforeAll(() => {
  initErrorTracking({
    dsn: 'https://publickey@glitchtip.example.com/1',
    transport,
    tracesSampleRate: 1,
  })
})

afterAll(async () => {
  await closeErrorTracking()
})

test('at a rate of 1.0, a request whose caller sends an unsampled sentry-trace header is still traced', async ({
  web,
}) => {
  const api = await startApi(web)
  const browser = await signIn(api, {
    sub: '1037901',
    email: 'trace-header-reader@example.com',
    name: 'A Trace Header Reader',
  })
  await flushErrorTracking()
  const before = envelopes.length

  await browser.fetch('/api/me')
  await browser.fetch('/api/me', {
    headers: { 'sentry-trace': '0123456789abcdef0123456789abcdef-0123456789abcdef-0' },
  })
  await flushErrorTracking()

  expect(sentTransactions(envelopes.slice(before)).map(({ transaction }) => transaction)).toEqual([
    'GET /api/me',
    'GET /api/me',
  ])
})
