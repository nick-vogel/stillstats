import { sql } from 'drizzle-orm'
import { boolean, check, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import { isScopeUser, webPolicy } from './access.ts'
import { users } from './auth.ts'

// The sets are written out here because this package does not depend on the API types. The API's
// test of every value those types allow keeps the two in step.
const pageSizes = [10, 25, 50] as const
const chartModes = ['daily', 'aggregate'] as const
const chartCards = ['engagedViews', 'watchTime', 'revenue', 'rpm', 'impressions', 'ctr'] as const
const visibilities = ['public', 'all'] as const
const themes = ['light', 'dark', 'system'] as const

function oneOf(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '))
}

/**
 * A user's preferences, one row per user, outside any channel: the display choices, the times the
 * user dismissed the sidebar's support prompt and its "Upgrade" item, and the "What's new" marker,
 * the choices that are not about display. It holds no channel data and no YouTube data. A missing row or a null
 * column means the default. The row cascades from its user, so "Delete me" removes it, and "Reset
 * preferences" deletes it, the dismissals and the marker included.
 */
export const preferences = pgTable(
  'preferences',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    pageSize: smallint('page_size').$type<(typeof pageSizes)[number]>(),
    viewsColumn: boolean('views_column'),
    watchTimeColumn: boolean('watch_time_column'),
    revenueColumn: boolean('revenue_column'),
    revenueSources: boolean('revenue_sources'),
    rpmAdsAndPremiumOnly: boolean('rpm_ads_and_premium_only'),
    chartMode: text('chart_mode', { enum: chartModes }),
    chartCard: text('chart_card', { enum: chartCards }),
    currency: text('currency'),
    visibility: text('visibility', { enum: visibilities }),
    sidebarOpen: boolean('sidebar_open'),
    theme: text('theme', { enum: themes }),
    /** When the user hid the sidebar's support item. The server stamps it. */
    supportPromptDismissedAt: timestamp('support_prompt_dismissed_at', { withTimezone: true }),
    /** When the user hid the sidebar's "Upgrade" item. The server stamps it. */
    upgradePromptDismissedAt: timestamp('upgrade_prompt_dismissed_at', { withTimezone: true }),
    /** The newest app version whose highlights the user has seen, one the build holds. */
    whatsNewMarker: text('whats_new_marker'),
  },
  (t) => [
    check('preferences_page_size', sql`${t.pageSize} in (${sql.raw(pageSizes.join(', '))})`),
    check('preferences_chart_mode', sql`${t.chartMode} in (${oneOf(chartModes)})`),
    check('preferences_chart_card', sql`${t.chartCard} in (${oneOf(chartCards)})`),
    check('preferences_visibility', sql`${t.visibility} in (${oneOf(visibilities)})`),
    check('preferences_theme', sql`${t.theme} in (${oneOf(themes)})`),
    check('preferences_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      'preferences_whats_new_marker',
      sql`${t.whatsNewMarker} ~ '^[1-9][0-9]{3}\\.[1-9][0-9]?\\.[1-9][0-9]?(\\.[1-9][0-9]*)?$'`,
    ),
    webPolicy('preferences', 'all', isScopeUser(t.userId)),
  ],
)
