// Repro for creator-analytics#1037 pre-PR review 1, findings 3 and 4. Copy into
// packages/reporter/src/ and run from the repo root:
//   pnpm exec vitest run packages/reporter/src/repro-scrub-unlisted-keys.test.ts
// Red on 7aea7d5f; green once the trace scrub keeps only the keys it names, and the error scrub
// masks the video ID in the event's transaction name.
import type { ErrorEvent } from '@sentry/node'
import { expect, test } from 'vitest'
import { scrubEvent, scrubTransaction, type TransactionEvent } from './scrub.ts'

test('a key the trace scrub does not name stays in the process, at the top level and on a span', () => {
  const event = {
    type: 'transaction',
    transaction: 'GET /api/me',
    laterSdkKey: 'UCaaaaaaaaaaaaaaaaaaaaaa dQw4w9WgXcQ',
    spans: [
      { span_id: 'a', trace_id: 'b', start_timestamp: 0, data: {}, laterSpanKey: 'dQw4w9WgXcQ' },
    ],
  } as unknown as TransactionEvent

  const scrubbed = scrubTransaction(event) as unknown as Record<string, unknown> & {
    spans: Record<string, unknown>[]
  }

  expect({
    top: 'laterSdkKey' in scrubbed,
    span: 'laterSpanKey' in (scrubbed.spans[0] ?? {}),
  }).toEqual({
    top: false,
    span: false,
  })
})

test("an error event's transaction name leaves with no video ID", () => {
  const event = {
    transaction: 'GET /api/channels/0b9d6b8e-5f0f-4c3a-9a51-2f6a1c2b3d4e/videos/dQw4w9WgXcQ',
  } as ErrorEvent

  expect(scrubEvent(event).transaction).not.toContain('dQw4w9WgXcQ')
})
