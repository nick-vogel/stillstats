/** The most stored retention curves one read answers, and the comparison draws on one chart. */
export const maxComparedCurves = 5

/** The query of GET /api/channels/:channelId/retention-curves, as text, the way a URL carries it. */
export interface RetentionCurvesQuery {
  /**
   * Comma-separated YouTube video ids, 1 to `maxComparedCurves`, duplicates counted, which then
   * collapse. Absent: no curve, and still the answer's `unread`. An empty or malformed list, or a
   * longer one, is refused with `invalid_ids`.
   */
  ids?: string
}

/**
 * One point of a stored audience retention curve. Google's relative retention performance compares
 * with other channels' videos, so the stored curve has none (ADR 0004).
 */
export interface StoredRetentionPoint {
  /** How far into the video, from 0 to 1. */
  elapsedVideoTimeRatio: number
  /** The viewers watching at this point, as a share of the video's views. Can exceed 1. */
  audienceWatchRatio: number
}

/** One video's stored retention curve, and when it was read (ADR 0017). */
export interface StoredRetentionCurve {
  /** The video as the channel's uploads read names it. */
  video: {
    id: string
    title: string
    /** The video's length in whole seconds. Null when Google gives none. */
    durationSeconds: number | null
    /** ISO 8601, when the video was published. Null for a video not yet published. */
    publishedAt: string | null
  }
  /** ISO 8601, when Google answered the read that stored the curve. Null: not read yet. */
  readAt: string | null
  /** Earliest first. Empty when the video is not read yet, or YouTube returned no curve for it. */
  points: StoredRetentionPoint[]
}

/** The answer of GET /api/channels/:channelId/retention-curves. */
export interface RetentionCurvesAnswer {
  /** One per id the request listed, in its order, duplicates collapsed. */
  curves: StoredRetentionCurve[]
  /**
   * How many of the channel's published uploads the daily refresh has never read: the backfill.
   * Null when the refresh no longer reads the channel, an ended one before its purge date.
   */
  unread: number | null
}
