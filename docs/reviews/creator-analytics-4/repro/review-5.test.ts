// Pre-PR review 5's red repros. Run with:
// pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-5.test.ts
import { describe, expect } from 'vitest'
import { connect, signIn } from '../../../../apps/api/test/flows.ts'
import { startApi } from '../../../../apps/api/test/start-api.ts'
import { test } from '../../../../packages/database/test/harness.ts'

const creator = { sub: '104729', email: 'creator@example.com', name: 'A Creator' }

describe('finding 1: an outage at the connect callback code exchange', () => {
  test('a token endpoint answering 503 to the code exchange lands on google_failed', async ({
    web,
  }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.failTokenEndpoint(503)

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
  })

  test('a token endpoint holding the code exchange past the bound lands on google_failed', {
    timeout: 5_000,
  }, async ({ web }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.holdTokenEndpoint()

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
  })
})
