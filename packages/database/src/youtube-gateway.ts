import { sql } from 'drizzle-orm'
import {
  check,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { gatewayReadPolicies, scopeNow, workerScopePolicy } from './access.ts'
import { channelOwned } from './channel-owned.ts'

/** The YouTube gateway's short cache of read results. Only the gateway reads or writes it. */
export const readCache = channelOwned(
  'read_cache',
  {
    key: text('key').notNull(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  {
    extraConfig: (t) => [
      uniqueIndex('read_cache_channel_id_key_idx').on(t.channelId, t.key),
      // 24 hours: the free tier's retention window is a published product claim (ADR 0006), so
      // the database refuses a row that would outlive it.
      check(
        'read_cache_expiry_within_24_hours',
        sql`${t.expiresAt} <= ${t.fetchedAt} + interval '24 hours'`,
      ),
      // The hourly sweep's only right: a gateway read already ignores a row once it expires.
      workerScopePolicy('read_cache', 'system', 'delete', sql`${t.expiresAt} <= ${scopeNow()}`),
    ],
  },
)

/**
 * Each channel's YouTube Reporting API job for its daily reach report, which the gateway creates
 * once. `createdAt` is the job's own creation time at Google: YouTube produces the 30 days before
 * it and every day after. `downloadsFailingSince` is when a paid channel's report downloads first
 * failed, null while they succeed.
 */
export const reportingJobs = channelOwned(
  'reporting_jobs',
  {
    jobId: text('job_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    downloadsFailingSince: timestamp('downloads_failing_since', { withTimezone: true }),
  },
  { onePerChannel: true },
)

/**
 * The units the gateway spent on each YouTube API on each quota day. It holds no channel's data,
 * so it is not channel-owned: every gateway read, for any channel, counts against one total.
 */
export const quotaUsage = pgTable(
  'quota_usage',
  {
    api: text('api', { enum: ['data', 'analytics', 'reporting'] }).notNull(),
    quotaDay: date('quota_day').notNull(),
    units: integer('units').notNull(),
  },
  (t) => [primaryKey({ columns: [t.api, t.quotaDay] }), ...gatewayReadPolicies('quota_usage')],
)
