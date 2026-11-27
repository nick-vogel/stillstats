// Repro, pre-PR review 1 finding 1: the prune shares the send's transaction, so while OpenPanel
// refuses every send (a rotated client secret, an outage of days) no activity day is ever deleted,
// and the policy's "kept for 30 days, then deleted" stops holding. Red until a failed send still
// removes the rows no retry of the counted day needs, those older than D-29.
import { describe, expect } from 'vitest'
import { jobHandlers } from '../../../../apps/worker/src/jobs.ts'
import { activityDays } from '../../../../packages/database/src/index.ts'
import { seedUser, test } from '../../../../packages/database/test/harness.ts'
import { createEventRelay } from '../../../../packages/event-relay/src/index.ts'
import { startFakeOpenPanel } from '../../../../packages/event-relay/test/testing.ts'
import { recordingReporter } from '../../../../packages/reporter/src/index.ts'
import { createRetention } from '../../../../packages/retention-engine/src/index.ts'

describe('the active user count prunes while OpenPanel refuses', () => {
  test('three days of refused sends leave no activity day older than D-29', async ({
    web,
    worker,
    clock,
  }) => {
    await seedUser(web, 'old-user')
    await web.asUser('old-user', (scope) =>
      scope.sql.insert(activityDays).values({ userId: 'old-user', day: '2026-10-02' }),
    )
    const openPanel = await startFakeOpenPanel()
    openPanel.answerWith(401)
    const reporter = recordingReporter()
    const handlers = jobHandlers(
      createRetention({ deletionLogKey: 'key', reporter }),
      { probe: async () => {} },
      { relay: createEventRelay(openPanel, { reporter }), reporter },
    )

    for (const run of ['2026-11-11', '2026-11-12', '2026-11-13']) {
      clock.set(new Date(`${run}T00:15:00.000Z`))
      await handlers.activeUserCount(worker, {}).catch(() => undefined)
    }
    const left = await worker.asSystem((tx) => tx.sql.select().from(activityDays))

    expect(openPanel.received).toHaveLength(3)
    expect(left).toEqual([])
  })
})
