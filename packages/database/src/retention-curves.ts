import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { channelOwned } from './channel-owned.ts'

/**
 * A paid channel's audience retention curves, from the Analytics API: one row per video and point
 * of the curve. Each point says how much of the video's audience is still watching at that share
 * of the video. YouTube's relative retention performance compares with other channels' videos, so
 * no column holds it (ADR 0004).
 */
export const retentionCurves = channelOwned(
  'retention_curves',
  {
    videoId: text('video_id').notNull(),
    /** How far into the video the point is, from 0 to 1. */
    elapsedVideoTimeRatio: doublePrecision('elapsed_video_time_ratio').notNull(),
    /** The share of the video's views still watching at the point. A rewatch can take it past 1. */
    audienceWatchRatio: doublePrecision('audience_watch_ratio').notNull(),
    /** When Google answered the read that delivered the curve. */
    readAt: timestamp('read_at', { withTimezone: true }).notNull(),
  },
  {
    extraConfig: (t) => [
      uniqueIndex('retention_curves_point_idx').on(t.channelId, t.videoId, t.elapsedVideoTimeRatio),
      check(
        'retention_curves_elapsed_video_time_ratio',
        sql`${t.elapsedVideoTimeRatio} between 0 and 1`,
      ),
      check('retention_curves_audience_watch_ratio', sql`${t.audienceWatchRatio} >= 0`),
    ],
  },
)

/**
 * Each video of a paid channel whose curve was read, and when: one row per video, whether the read
 * answered a curve or none. A video too small for YouTube to return a curve has this row and no
 * points. The curve refresh reads it to find the videos that are due.
 */
export const retentionCurveReads = channelOwned(
  'retention_curve_reads',
  {
    videoId: text('video_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull(),
  },
  {
    extraConfig: (t) => [
      primaryKey({ name: 'retention_curve_reads_pkey', columns: [t.channelId, t.videoId] }),
    ],
  },
)
