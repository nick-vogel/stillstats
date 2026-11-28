import type {
  BillingPlan,
  ChartCard,
  ChartMode,
  FeedbackType,
  PageSize,
  ReachTrafficSourceType,
  RevenueCurrency,
  VideoFormatFilter,
  VideoSort,
  VideoWindow,
  Visibility,
} from '@creator-analytics/api-types'
import type { FreeTool, ToolLinkSource } from './account-menu.ts'
import type { ConsentRequest } from './consent.ts'
import type { OptionalColumn } from './preferences.ts'
import type { AnswerCache, AnswerTrigger, BudgetScreen, ListFilter } from './screen-timing.ts'
import type { SupportSurface } from './support.ts'
import type { SourcesTable } from './tables.ts'
import type { UpgradeLinkSource } from './upgrade-prompt.ts'
import type { PlayerSeekInput, PlayerSeekPlot } from './video-player.ts'

/** A sort by impressions or CTR, in either direction, as `video_sort_changed` sends it. */
export type HistorySort = Extract<VideoSort, `${'' | '-'}${'impressions' | 'ctr'}`>

export type ProductEvent =
  | { name: 'connect_channel_clicked' }
  | { name: 'disconnect_channel_clicked' }
  | { name: 'delete_user_clicked' }
  | { name: 'channel_connected' }
  | { name: 'channel_connect_refused'; refusal: string }
  | { name: 'give_revenue_consent_clicked' }
  | { name: 'revenue_consent_given' }
  | { name: 'revenue_consent_refused'; refusal: string }
  | { name: 'video_list_viewed' }
  | { name: 'consent_screen_continued'; consent: ConsentRequest['consent'] }
  | { name: 'video_window_changed'; window: Exclude<VideoWindow, 'custom'> }
  /** A custom range sends its length in days, both ends counted, and never a date. */
  | { name: 'video_window_changed'; window: 'custom'; days: number }
  | { name: 'video_sort_changed'; sort: VideoSort }
  /** Once a session, the first time a Pro creator sorts the list by impressions or CTR. */
  | { name: 'repackaging_view_opened'; sort: HistorySort }
  /**
   * The same once-a-session event, when the creator's first step into the repackaging view filters
   * the list to one traffic source, sent with the source's type code.
   */
  | { name: 'repackaging_view_opened'; source: ReachTrafficSourceType }
  | { name: 'video_format_changed'; format: VideoFormatFilter }
  | { name: 'video_detail_opened' }
  | { name: 'video_stepped'; direction: 'previous' | 'next' }
  | { name: 'video_player_loaded' }
  | { name: 'video_player_seeked'; plot: PlayerSeekPlot; input: PlayerSeekInput }
  | { name: 'settings_opened' }
  | { name: 'views_chart_mode_changed'; mode: ChartMode }
  | { name: 'chart_metric_changed'; metric: ChartCard }
  | { name: 'currency_changed'; currency: RevenueCurrency }
  | { name: 'rpm_sources_toggled'; state: 'on' | 'off' }
  | { name: 'page_size_changed'; size: PageSize }
  | { name: 'visibility_changed'; visibility: Visibility }
  | { name: 'list_column_toggled'; column: OptionalColumn; state: 'on' | 'off' }
  | { name: 'revenue_sources_toggled'; table: SourcesTable; state: 'shown' | 'hidden' }
  | { name: 'tool_link_clicked'; tool: FreeTool; source: ToolLinkSource }
  | { name: 'preferences_reset' }
  | { name: 'support_opened'; surface: SupportSurface }
  | { name: 'support_prompt_dismissed' }
  | { name: 'whats_new_opened'; from: 'sidebar' | 'banner' }
  | { name: 'whats_new_banner_closed' }
  | { name: 'feedback_opened' }
  | { name: 'feedback_sent'; type: FeedbackType }
  | { name: 'checkout_started'; plan: BillingPlan }
  | { name: 'customer_portal_opened' }
  /** A pick of a Pro channel the API accepted: the user's blocks, and no channel or figure. */
  | { name: 'pro_channel_selected'; blocks: number }
  | { name: 'upgrade_screen_viewed' }
  | { name: 'upgrade_link_clicked'; source: Exclude<UpgradeLinkSource, 'homepage'> }
  | { name: 'upgrade_prompt_dismissed' }
  /** A pick change on the retention page drew 2 or more stored curves: how many it drew. */
  | { name: 'retention_curves_compared'; count: number }
  /** The sponsor report's "Save as PDF" button: the count of figures it shows, and no video id. */
  | { name: 'sponsor_export_downloaded'; figures: number }
  /** A budget screen's LCP or INP, in whole ms, the screen named by its route template. */
  | {
      name: 'web_vital'
      metric: 'LCP' | 'INP'
      value: number
      screen: BudgetScreen
      beforeScreen?: true
    }
  /**
   * The wait for a budget screen's answer, in whole ms, from navigation start for the page's first
   * answer, else from the input. The filter only with the `filter` trigger; a custom range sends
   * `window: 'custom'` and no dates.
   */
  | {
      name: 'answer_shown'
      screen: BudgetScreen
      trigger: AnswerTrigger
      filter?: ListFilter
      window: VideoWindow
      cache: AnswerCache
      ms: number
    }

const connectRefusals: Record<string, string> = {
  channel_held_elsewhere: 'Another user has already connected this channel.',
  // Approved word for word in creator-analytics#119 (W23). Change it only with Nick.
  channel_disconnecting: 'This channel is still disconnecting. Try again in a minute.',
  consent_denied: 'Google did not grant access, so no channel was connected.',
  scopes_missing: 'Both YouTube permissions are needed to connect a channel.',
  no_channel: 'The Google account you picked has no YouTube channel.',
  state_invalid: 'The connection expired. Start it again.',
  google_failed: 'YouTube did not answer. Start the connection again.',
}

const revenueRefusals: Record<string, string> = {
  channel_mismatch:
    'You picked a different channel on Google. Give revenue consent again and pick this channel.',
  consent_denied: 'Google did not grant access, so no revenue consent was recorded.',
  scopes_missing: 'The revenue permission is needed to give revenue consent.',
  no_channel: 'The Google account you picked has no YouTube channel.',
  not_connected: 'This channel is no longer connected.',
  connection_revoked: 'This channel is no longer connected.',
  google_failed: 'YouTube did not answer. Give revenue consent again.',
}

// Approved word for word in creator-analytics#119 (W28). Change it only with Nick. Better Auth puts
// Google's error code in `error`, and `access_denied` is Google's code for a cancelled sign-in.
const signInCancelled = 'You cancelled the Google sign-in, so you are not signed in.'
const signInFailed = 'Google sign-in failed. Try again.'

/** The query parameters the API redirects back to the web app with. */
export const landingParameters = [
  'error',
  'connected',
  'connect_error',
  'revenue_consented',
  'revenue_error',
]

export interface Landing {
  message: string | null
  event: ProductEvent | null
}

/**
 * Reads how the web app was reached: after sign-in, after a connect or a revenue consent, or none
 * of them.
 */
export function readLanding(search: string): Landing {
  const query = new URLSearchParams(search)
  const signInError = query.get('error')
  if (signInError) {
    return {
      message: signInError === 'access_denied' ? signInCancelled : signInFailed,
      event: null,
    }
  }
  if (query.has('connected')) return { message: null, event: { name: 'channel_connected' } }
  if (query.has('revenue_consented')) {
    return { message: null, event: { name: 'revenue_consent_given' } }
  }
  const revenueRefusal = query.get('revenue_error')
  if (revenueRefusal !== null) {
    return refusedLanding(
      revenueRefusals,
      revenueRefusal,
      'Revenue consent failed',
      'revenue_consent_refused',
    )
  }
  const connectRefusal = query.get('connect_error')
  if (connectRefusal === null) return { message: null, event: null }
  return refusedLanding(
    connectRefusals,
    connectRefusal,
    'Connecting failed',
    'channel_connect_refused',
  )
}

function refusedLanding(
  messages: Record<string, string>,
  refusal: string,
  failure: string,
  event: 'channel_connect_refused' | 'revenue_consent_refused',
): Landing {
  const known = Object.hasOwn(messages, refusal)
  return {
    message: messages[refusal] ?? `${failure}: ${refusal}`,
    // The query is whatever the address bar holds, so only a known refusal code is sent on.
    event: { name: event, refusal: known ? refusal : 'unknown' },
  }
}
