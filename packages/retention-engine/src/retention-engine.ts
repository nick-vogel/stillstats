import { createHmac } from 'node:crypto'
import {
  accountCancellations,
  channels,
  type DeletionReason,
  deletionLog,
  deletionRequests,
  feedbackMessages,
  type JobData,
  type JobName,
  jobDataOf,
  memberships,
  type Scoped,
  subscriptionCancellations,
} from '@creator-analytics/database'
import type { Reporter } from '@creator-analytics/reporter'
import { and, count, eq, isNull, sql } from 'drizzle-orm'
import type { SubscriptionCanceller } from './subscription-cancellation.ts'

const hourMs = 60 * 60 * 1000

// Both well inside the 24-hour deletion window ADR 0006 publishes, so a stuck deletion is retried
// and then reported while there is still time to finish it.
const checkAfterMs = hourMs
const alarmAfterMs = 12 * hourMs

/** The data of every deletion job: internal ids only. */
export interface DeletionJobData {
  requestId: string
  channelId: string
}

export type DeletionJobName = Extract<
  JobName,
  'deleteChannel' | 'cancelSubscription' | 'deletionCheck' | 'deletionAlarm'
>

/** Reads the data of a deletion job as pg-boss stored it. */
export function deletionJobData(name: DeletionJobName, data: JobData): DeletionJobData {
  return jobDataOf(name, data, 'requestId', 'channelId')
}

/** The data of an account deletion's cancellation jobs: the pending cancellation's uuid only. */
export interface AccountCancellationJobData {
  cancellationId: string
}

export type AccountCancellationJobName = Extract<
  JobName,
  'cancelAccountSubscription' | 'accountCancellationAlarm'
>

/** Reads the data of an account cancellation job as pg-boss stored it. */
export function accountCancellationJobData(
  name: AccountCancellationJobName,
  data: JobData,
): AccountCancellationJobData {
  return jobDataOf(name, data, 'cancellationId')
}

export interface DeletionLogEntry {
  reason: DeletionReason
  requestedAt: Date
  completedAt: Date
  rowCounts: Record<string, number>
}

/**
 * Writes a deletion request for the channel and enqueues its deletion now, its check at 1 hour
 * and its alarm at 12 hours, all in the caller's transaction. It also ends the memberships of the
 * channel that the caller's scope admits, so the channel leaves every list at once, and records
 * how many it ended. A channel allows one open request, so a second call returns the first.
 */
export async function requestDeletion(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
  reason: DeletionReason,
): Promise<{ requestId: string; alreadyRequested: boolean }> {
  const openRequestOf = async () => {
    const [open] = await tx.sql
      .select({ id: deletionRequests.id })
      .from(deletionRequests)
      .where(and(eq(deletionRequests.channelId, channelId), isNull(deletionRequests.completedAt)))
    return open
  }
  const existing = await openRequestOf()
  if (existing) return { requestId: existing.id, alreadyRequested: true }

  const [ending] = await tx.sql
    .select({ memberships: count() })
    .from(memberships)
    .where(eq(memberships.channelId, channelId))
  const endedMemberships = ending?.memberships ?? 0
  const [created] = await tx.sql
    .insert(deletionRequests)
    .values({ channelId, reason, endedMemberships, requestedAt: tx.now })
    .onConflictDoNothing()
    .returning({ id: deletionRequests.id })
  if (!created) {
    // A concurrent request for the channel committed between the read and the insert.
    const first = await openRequestOf()
    if (!first) throw new Error('A deletion request conflicted with no open request')
    return { requestId: first.id, alreadyRequested: true }
  }
  // Only after the request is written: a user scope inserts a request only for a channel it
  // still holds a membership to.
  await tx.sql.delete(memberships).where(eq(memberships.channelId, channelId))
  const data = { requestId: created.id, channelId }
  const at = (offsetMs: number) => new Date(tx.now.getTime() + offsetMs)
  await tx.enqueue('deleteChannel', data, { startAfter: tx.now })
  await tx.enqueue('deletionCheck', data, { startAfter: at(checkAfterMs) })
  await tx.enqueue('deletionAlarm', data, { startAfter: at(alarmAfterMs) })
  return { requestId: created.id, alreadyRequested: false }
}

/** Every table with a foreign key to channels, and channels itself, read from the catalog. */
async function channelTables(tx: Scoped<'channel'>) {
  const result = await tx.sql.execute<{ table: string; column: string }>(sql`
    select c.relname as table, a.attname as column
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confrelid = 'channels'::regclass
    union all select 'channels', 'id'
    order by 1`)
  return result.rows
}

async function countRows(
  tx: Scoped<'channel'>,
  tables: { table: string; column: string }[],
  channelId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const { table, column } of tables) {
    const result = await tx.sql.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.identifier(column)} = ${channelId}`,
    )
    counts[table] = result.rows[0]?.n ?? 0
  }
  return counts
}

async function openRequest(tx: Scoped<'channel'>, requestId: string) {
  const [request] = await tx.sql
    .select()
    .from(deletionRequests)
    .where(and(eq(deletionRequests.id, requestId), isNull(deletionRequests.completedAt)))
  return request
}

async function pendingCancellation(tx: Scoped<'channel'>, requestId: string) {
  const [pending] = await tx.sql
    .select()
    .from(subscriptionCancellations)
    .where(eq(subscriptionCancellations.deletionRequestId, requestId))
  return pending
}

async function pendingAccountCancellation(tx: Scoped<'system'>, cancellationId: string) {
  const [pending] = await tx.sql
    .select()
    .from(accountCancellations)
    .where(eq(accountCancellations.id, cancellationId))
  return pending
}

export interface RetentionOptions {
  /** The HMAC key of the deletion log, from the environment, so the log keeps no YouTube id. */
  deletionLogKey: string
  reporter: Reporter
  /**
   * Cancels a deleted account's subscription. Without one, the account deletion still goes, and
   * its cancellation job fails until the alarm reports it.
   */
  canceller?: SubscriptionCanceller
}

export function createRetention({ deletionLogKey, reporter, canceller }: RetentionOptions) {
  const hmacOf = (youtubeChannelId: string) =>
    createHmac('sha256', deletionLogKey).update(youtubeChannelId).digest('hex')

  return {
    /** The operator's audit query: the deletion log entries of a YouTube channel. */
    wasDeleted(tx: Scoped<'system'>, youtubeChannelId: string): Promise<DeletionLogEntry[]> {
      return tx.sql
        .select({
          reason: deletionLog.reason,
          requestedAt: deletionLog.requestedAt,
          completedAt: deletionLog.completedAt,
          rowCounts: deletionLog.rowCounts,
        })
        .from(deletionLog)
        .where(eq(deletionLog.youtubeChannelHmac, hmacOf(youtubeChannelId)))
        .orderBy(deletionLog.completedAt)
    },

    /**
     * The daily job: deletes the deletion log entries older than 24 months by the scope's clock,
     * and returns how many. No WHERE clause, on purpose: the system scope's delete policy on the
     * log admits exactly those entries, so the 24-month rule is stated in the database only.
     */
    async deletionLogRetention(tx: Scoped<'system'>): Promise<number> {
      const result = await tx.sql.delete(deletionLog)
      return result.rowCount ?? 0
    },

    /**
     * The daily job: deletes the deletion requests completed more than 24 months ago by the
     * scope's clock, and returns how many. No WHERE clause, as for the log: the system scope's
     * delete policy on the requests admits exactly those, and never an open request.
     */
    async deletionRequestRetention(tx: Scoped<'system'>): Promise<number> {
      const result = await tx.sql.delete(deletionRequests)
      return result.rowCount ?? 0
    },

    /**
     * The daily job: deletes the feedback messages marked "Done" more than one year ago by the
     * scope's clock, and returns how many. No WHERE clause, as for the log: the system scope's
     * delete policy on the messages admits exactly those, and never an open message, so the
     * one-year rule is stated in the database only.
     */
    async feedbackRetention(tx: Scoped<'system'>): Promise<number> {
      const result = await tx.sql.delete(feedbackMessages)
      return result.rowCount ?? 0
    },

    /**
     * Deletes the channel row, which cascades to every channel-owned row, its Pro pick included,
     * and writes the deletion log entry, in the job's channel scope. A request an earlier run
     * completed is left alone. The deletion cancels nothing: the subscription is its owner's, and
     * a disconnect frees the channel's slot and refunds nothing (ADR 0024). An account deletion
     * cancels the account's subscription itself.
     */
    async deleteChannel(tx: Scoped<'channel'>, { requestId, channelId }: DeletionJobData) {
      const request = await openRequest(tx, requestId)
      if (!request) return
      const [channel] = await tx.sql
        .select({ youtubeChannelId: channels.youtubeChannelId })
        .from(channels)
        .where(eq(channels.id, channelId))
      if (!channel) throw new Error(`Deletion request ${requestId} names no channel`)

      const tables = await channelTables(tx)
      const rowCounts = await countRows(tx, tables, channelId)
      rowCounts.memberships = (rowCounts.memberships ?? 0) + request.endedMemberships
      await tx.sql.delete(channels).where(eq(channels.id, channelId))
      const left = Object.entries(await countRows(tx, tables, channelId)).filter(([, n]) => n > 0)
      if (left.length > 0) {
        throw new Error(`Deleting a channel left rows in ${left.map(([table]) => table)}`)
      }

      await tx.sql.insert(deletionLog).values({
        youtubeChannelHmac: hmacOf(channel.youtubeChannelId),
        reason: request.reason,
        requestedAt: request.requestedAt,
        completedAt: tx.now,
        rowCounts,
      })
      // No WHERE clause, on purpose. An UPDATE that reads a column must leave a row the SELECT
      // policy admits, and a cleared request matches no policy. The channel scope already
      // limits the update to the channel's requests, of which only the open one keeps its id.
      await tx.sql.update(deletionRequests).set({ completedAt: tx.now, channelId: null })
    },

    /**
     * Cancels and refunds the subscription a channel deletion of the release before blocks left
     * pending, then deletes the pending row. No deletion of this release writes one: it stays to
     * drain a row an old worker wrote during the deploy, and the remove release drops it. A Stripe
     * error throws, so pg-boss retries it, and the row stays for the alarm.
     */
    async cancelSubscription(tx: Scoped<'channel'>, { requestId, channelId }: DeletionJobData) {
      const pending = await pendingCancellation(tx, requestId)
      if (!pending) return
      if (!canceller) throw new Error('Stripe is not configured, so the cancellation cannot run')
      await canceller.cancelAndRefund(pending.stripeSubscriptionId, {
        cancellationId: pending.id,
        channelId,
      })
      await tx.sql
        .delete(subscriptionCancellations)
        .where(eq(subscriptionCancellations.id, pending.id))
    },

    /**
     * Cancels the subscription an account deletion left pending at once and refunds the unused
     * part (ADR 0022), then deletes the pending row, in the system scope, since the account and
     * its channels are gone. A Stripe error throws, so pg-boss retries it, and the row stays for
     * the alarm.
     */
    async cancelAccountSubscription(
      tx: Scoped<'system'>,
      { cancellationId }: AccountCancellationJobData,
    ) {
      const pending = await pendingAccountCancellation(tx, cancellationId)
      if (!pending) return
      if (!canceller) throw new Error('Stripe is not configured, so the cancellation cannot run')
      await canceller.cancelAndRefund(pending.stripeSubscriptionId, { cancellationId })
      await tx.sql.delete(accountCancellations).where(eq(accountCancellations.id, pending.id))
    },

    /** Reports an account deletion's cancellation still pending 12 hours after the deletion. */
    async accountCancellationAlarm(
      tx: Scoped<'system'>,
      { cancellationId }: AccountCancellationJobData,
    ) {
      if (await pendingAccountCancellation(tx, cancellationId)) {
        reporter.report({
          message:
            'A subscription cancellation is still pending 12 hours after its account deletion',
          context: { cancellationId },
        })
      }
    },

    /** Enqueues the deletion again if its request is still open an hour after it was made. */
    async deletionCheck(tx: Scoped<'channel'>, data: DeletionJobData) {
      if (await openRequest(tx, data.requestId)) await tx.enqueue('deleteChannel', { ...data })
    },

    /**
     * Reports the deletion if its request is still open 12 hours after it was made, and its
     * subscription's cancellation if that is still pending.
     */
    async deletionAlarm(tx: Scoped<'channel'>, data: DeletionJobData) {
      const context = { requestId: data.requestId, channelId: data.channelId }
      if (await openRequest(tx, data.requestId)) {
        reporter.report({
          message: 'A channel deletion is still incomplete 12 hours after its request',
          context,
        })
      }
      if (await pendingCancellation(tx, data.requestId)) {
        reporter.report({
          message:
            'A subscription cancellation is still pending 12 hours after its deletion request',
          context,
        })
      }
    },
  }
}

export type Retention = ReturnType<typeof createRetention>
