import { sql } from 'drizzle-orm'
import { check, text, timestamp } from 'drizzle-orm/pg-core'
import { channelOwned } from './channel-owned.ts'

// The set is written out here because this package does not depend on the API types. The API's
// test of a choice of every figure those types allow keeps the two in step.
const sponsorReportFigures = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'comments',
  'shares',
  'subscribersGained',
  'impressions',
  'ctr',
] as const

/**
 * The figures a channel's sponsor reports show, one row per channel, written by any member of the
 * channel. A missing row means the nine Analytics figures. It holds figure names only, never a
 * revenue figure, and it cascades from its channel.
 */
export const sponsorReportFigureChoices = channelOwned(
  'sponsor_report_figures',
  {
    figures: text('figures').array().notNull().$type<(typeof sponsorReportFigures)[number][]>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  {
    onePerChannel: true,
    extraConfig: (t) => [
      check(
        'sponsor_report_figures_figures',
        sql`cardinality(${t.figures}) > 0 and ${t.figures} <@ array[${sql.raw(
          sponsorReportFigures.map((figure) => `'${figure}'`).join(', '),
        )}]::text[]`,
      ),
    ],
  },
)
