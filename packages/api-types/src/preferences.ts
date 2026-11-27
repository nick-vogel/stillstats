import type { RevenueCurrency } from './currencies.ts'

/** How many videos a page of the video list shows. */
export const pageSizes = [10, 25, 50] as const
export type PageSize = (typeof pageSizes)[number]

/** How the views chart draws its days: each day on its own, or each day added to the days before. */
export const chartModes = ['daily', 'aggregate'] as const
export type ChartMode = (typeof chartModes)[number]

/** The card whose chart shows on a screen too small to stack the charts. */
export const chartCards = [
  'engagedViews',
  'watchTime',
  'revenue',
  'rpm',
  'impressions',
  'ctr',
] as const
export type ChartCard = (typeof chartCards)[number]

/** Which videos the video list shows: the public ones only, or the unlisted and private ones too. */
export const visibilities = ['public', 'all'] as const
export type Visibility = (typeof visibilities)[number]

/** How the web app draws: light, dark, or as the system draws. */
export const themes = ['light', 'dark', 'system'] as const
export type Theme = (typeof themes)[number]

/**
 * A user's preferences, saved on the server outside any channel: the display choices, the
 * dismissals of the sidebar's support and upgrade prompts, and the "What's new" marker. An absent
 * key means the default.
 */
export interface Preferences {
  pageSize?: PageSize
  viewsColumn?: boolean
  watchTimeColumn?: boolean
  revenueColumn?: boolean
  /**
   * Whether the numbers table and the video list show the revenue source columns: ads, YouTube
   * Premium and other sources. One choice for both. Hidden by default.
   */
  revenueSources?: boolean
  /**
   * Whether every RPM counts only ads and YouTube Premium, leaving other sources (memberships and
   * Supers) out. Off by default, and RPM then counts the whole estimated revenue.
   */
  rpmAdsAndPremiumOnly?: boolean
  chartMode?: ChartMode
  chartCard?: ChartCard
  /** The currency revenue shows in, one of the codes Google's Analytics API documents. */
  currency?: RevenueCurrency
  visibility?: Visibility
  /** The web app's theme. An absent theme means System, which follows the system's own. */
  theme?: Theme
  /** Whether the sidebar is open, at 48rem and up. Open by default. */
  sidebarOpen?: boolean
  /**
   * Set once the creator hides the sidebar's support item, with its x or "Hide". The web app sends
   * `true`, the server stamps the time, and the answer carries `true`, never the time. Only "Reset
   * preferences" clears it, so the type is `true` rather than a boolean an update could undo.
   */
  supportPromptDismissed?: true
  /**
   * Set once the creator hides the sidebar's "Upgrade" item, with its x or "Hide", as the support
   * prompt's dismissal is: the web app sends `true`, the server stamps the time, the answer carries
   * `true`, and only "Reset preferences" clears it (creator-analytics#907).
   */
  upgradePromptDismissed?: true
  /**
   * The "What's new" marker: the newest app version whose highlights the user has seen, such as
   * `2026.11.9`. The API accepts only an app version the build holds a release note for. Unset, the
   * user has seen none, and only "Reset preferences" clears it.
   */
  whatsNewMarker?: string
}

/** GET, PUT and DELETE /api/me/preferences: the values now saved. DELETE answers `{}`. */
export type PreferencesAnswer = Preferences

/** The body of PUT /api/me/preferences: the values to save. A key left out keeps its value. */
export type PreferencesUpdate = Preferences
