/** Why the API refused a request about a channel. */
export type Refusal =
  | 'not_connected'
  | 'connection_revoked'
  | 'consent_missing'
  | 'quota_reserved'
  | 'google_failed'
  | 'video_not_found'
  | 'not_monetized'
  | 'not_owner'
  | 'already_subscribed'
  | 'not_subscribed'
  | 'no_free_slot'
  | 'blocks_changed'

export interface RefusalAnswer {
  refusal: Refusal
}

export type ErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'internal'
  | 'invalid_query'
  | 'invalid_window'
  | 'invalid_range'
  | 'invalid_sort'
  | 'sort_after_publish'
  | 'sort_without_history'
  | 'invalid_format'
  | 'invalid_visibility'
  | 'window_after_publish'
  | 'invalid_ids'
  | 'invalid_traffic_source'
  | 'invalid_min_impressions'
  | 'filter_without_history'
  | 'invalid_event'
  | 'rate_limited'
  | 'invalid_preference'
  | 'invalid_feedback'
  | 'invalid_feedback_type'
  | 'invalid_feedback_text'
  | 'invalid_feedback_screen'
  | 'invalid_app_version'
  | 'invalid_reply_address'
  | 'invalid_plan'
  | 'invalid_blocks'
  | 'invalid_figure'
  | 'revenue_figure'
  | 'invalid_grant'
  | 'unknown_email'

export interface ErrorAnswer {
  error: ErrorCode
}

/** The query parameter the API sets on the web app's landing after a consent callback. */
export type LandingParameter = 'connected' | 'connect_error' | 'revenue_consented' | 'revenue_error'

/**
 * Why a consent failed, in the `connect_error` or `revenue_error` query parameter of the page the
 * consent callback redirects to.
 */
export type ConsentLandingRefusal =
  | 'state_invalid'
  | 'consent_denied'
  | 'scopes_missing'
  | 'no_channel'
  | 'channel_held_elsewhere'
  | 'channel_disconnecting'
  | 'channel_mismatch'
  | Exclude<
      Refusal,
      | 'quota_reserved'
      | 'video_not_found'
      | 'not_monetized'
      | 'not_owner'
      | 'already_subscribed'
      | 'not_subscribed'
      | 'no_free_slot'
      | 'blocks_changed'
    >
