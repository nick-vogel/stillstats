// Repro, pre-PR review 2 finding 1: each attempt of the active user count takes its counted day from
// its own clock, and the queue's retries now run five minutes apart for 30 minutes. A first attempt
// that starts after 23:45 UTC, as `missed: 'once'` sends one when the worker comes back late in the
// day, has retries that run after midnight and count the next day. Red until a retry counts the
// same day as its first attempt.
import { describe, expect } from 'vitest'
import { jobHandlers } from '../../../../apps/worker/src/jobs.ts'
import { activityDays } from '../../../../packages/database/src/index.ts'
import { seedUser, test } from '../../../../packages/database/test/harness.ts'
import { createEventRelay } from '../../../../packages/event-relay/src/index.ts'
import { startFakeOpenPanel } from '../../../../packages/event-relay/test/testing.ts'
import { recordingReporter } from '../../../../packages/reporter/src/index.ts'
import { createRetention } from '../../../../packages/retention-engine/src/index.ts'

describe('a retry of the active user count after midnight', () => {
  test('counts the same day as the first attempt it retries', async ({ web, worker, clock }) => {
    await seedUser(web, 'counted-user')
    await web.asUser('counted-user', (scope) =>
      scope.sql.insert(activityDays).values({ userId: 'counted-user', day: '2026-11-10' }),
    )
    const openPanel = await startFakeOpenPanel()
    const reporter = recordingReporter()
    const handlers = jobHandlers(
      createRetention({ deletionLogKey: 'key', reporter }),
      { probe: async () => {} },
      { relay: createEventRelay(openPanel, { reporter }), reporter },
    )

    openPanel.answerWith(401)
    clock.set(new Date('2026-11-11T23:50:00.000Z'))
    await handlers.activeUserCount(worker, {}).catch(() => undefined)
    openPanel.answerWith(200)
    clock.set(new Date('2026-11-12T00:05:00.000Z'))
    await handlers.activeUserCount(worker, {})

    const [first, retry] = openPanel.received.map(({ body }) => JSON.stringify(body))
    expect(first).toContain('2026-11-10T12:00:00.000Z')
    expect(retry).toContain('2026-11-10T12:00:00.000Z')
  })
})
