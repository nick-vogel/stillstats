// Repro, pre-PR review 1 finding 1: the activeUserCount queue keeps pg-boss's defaults (2 retries,
// 0 seconds apart), so every retry of a failed send runs within seconds of the first attempt and an
// OpenPanel outage of a minute leaves the day with no point. Red until the queue spaces its retries.
import { describe, expect } from 'vitest'
import { test } from '../../../../packages/database/test/harness.ts'

// A lower bound on how long after the first attempt the last retry starts: pg-boss's backoff only
// lengthens each delay past retryDelay.
const tenMinutes = 600

describe('the active user count retries a failed send', () => {
  test('the retries of a failed active user count span at least ten minutes', async ({ boss }) => {
    const queue = await boss.getQueue('activeUserCount')

    expect(queue).toBeDefined()
    expect((queue?.retryLimit ?? 0) * (queue?.retryDelay ?? 0)).toBeGreaterThanOrEqual(tenMinutes)
  })
})
