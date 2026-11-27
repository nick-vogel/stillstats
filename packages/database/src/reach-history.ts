import { sql } from 'drizzle-orm'
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { channelOwned } from './channel-owned.ts'

/**
 * A paid channel's impressions and click-through rate history, from YouTube's daily reach reports:
 * one row per video, day and traffic source type. The Reporting API deletes its files after 60
 * days, so the history has to be stored here. Traffic source detail, device type and operating
 * system are reduced away before a row is written, so no column holds them.
 */
export const reachHistory = channelOwned(
  'reach_history',
  {
    videoId: text('video_id').notNull(),
    /** YouTube's reporting day, in Pacific Time. */
    day: date('day').notNull(),
    /** The report's numeric traffic source code, such as 5 for YouTube search. */
    trafficSourceType: integer('traffic_source_type').notNull(),
    impressions: integer('impressions').notNull(),
    /**
     * Clicks over impressions, from 0 to 1: the mean of the report's rows weighted by impressions,
     * capped at 1, since a row's own CTR can be above it (`reachRowsOf`).
     */
    ctr: doublePrecision('ctr').notNull(),
  },
  {
    extraConfig: (t) => [
      uniqueIndex('reach_history_row_idx').on(t.channelId, t.videoId, t.day, t.trafficSourceType),
      index('reach_history_channel_id_day_idx').on(t.channelId, t.day),
      check('reach_history_impressions', sql`${t.impressions} >= 0`),
      check('reach_history_ctr', sql`${t.ctr} between 0 and 1`),
    ],
  },
)

/**
 * Each day a paid channel's history holds, a day with no impressions included, and the creation
 * time of the report that delivered it. Its earliest day is where the history starts, and its
 * newest creation time is where the next download resumes.
 */
export const reachHistoryDays = channelOwned(
  'reach_history_days',
  {
    day: date('day').notNull(),
    reportCreatedAt: timestamp('report_created_at', { withTimezone: true }).notNull(),
  },
  {
    extraConfig: (t) => [
      primaryKey({ name: 'reach_history_days_pkey', columns: [t.channelId, t.day] }),
    ],
  },
)
