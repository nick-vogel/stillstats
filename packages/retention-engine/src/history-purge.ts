import {
  connectionRoster,
  type JobData,
  jobDataOf,
  reachHistory,
  reachHistoryDays,
  retentionCurveReads,
  retentionCurves,
  type Scoped,
} from '@creator-analytics/database'
import { clearPurgeDate, purgeDueOf } from '@creator-analytics/entitlements'
import { eq } from 'drizzle-orm'

const daySeconds = 24 * 60 * 60

export function historyPurgeJobData(data: JobData) {
  return jobDataOf('historyPurge', data, 'channelId')
}

/**
 * The daily historyPurgeRoster job: enqueues a historyPurge job for each active connection, since
 * the system scope reads no subscription. Each channel's job is throttled to one per UTC day, so a
 * roster job that runs again that day sends none twice. A channel whose connection is revoked is
 * being deleted whole (ADR 0006), so the roster reaches every channel that can hold history.
 */
export async function enqueueHistoryPurges(tx: Scoped<'system'>): Promise<void> {
  for (const { channelId } of await connectionRoster(tx)) {
    await tx.enqueue(
      'historyPurge',
      { channelId },
      { throttle: { key: channelId, seconds: daySeconds } },
    )
  }
}

/**
 * The historyPurge job (ADR 0006): a channel whose purge date has passed and whose subscription is
 * not paid loses every reach_history, reach_history_days, retention_curves and
 * retention_curve_reads row, and its purge date is cleared, in one transaction. With its days gone
 * the history start goes too, and a later subscription's first download lists every report Google
 * still holds, as a first subscription does; with its reads gone, its curve refresh backfills
 * every video again. The channel, its connection, its reporting job and its subscription row stay.
 * Any other channel is left as it is.
 */
export async function purgeEndedHistory(
  tx: Scoped<'channel'>,
  { channelId }: { channelId: string },
): Promise<void> {
  if (!(await purgeDueOf(tx, channelId))) return
  await tx.sql.delete(reachHistory).where(eq(reachHistory.channelId, channelId))
  await tx.sql.delete(reachHistoryDays).where(eq(reachHistoryDays.channelId, channelId))
  await tx.sql.delete(retentionCurves).where(eq(retentionCurves.channelId, channelId))
  await tx.sql.delete(retentionCurveReads).where(eq(retentionCurveReads.channelId, channelId))
  await clearPurgeDate(tx, channelId)
}
