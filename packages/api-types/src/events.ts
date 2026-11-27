/**
 * The places the extension adds its numbers to: three on Studio, the latest video card (`card`),
 * the Content list (`content_list`) and a video's analytics page (`analytics`), and four on
 * www.youtube.com's public pages (ADR 0016), the channel's Videos, Live and Home tabs
 * (`channel_page`), the view count under a watch page's title (`watch_page`), the home feed, search
 * results and the watch page's sidebar (`feed`), and the channel's Shorts tab and the Shorts player
 * (`shorts`).
 */
export const extensionSurfaces = [
  'card',
  'content_list',
  'analytics',
  'channel_page',
  'watch_page',
  'feed',
  'shorts',
] as const
export type ExtensionSurface = (typeof extensionSurfaces)[number]

export const valuelessExtensionEventNames = [
  'extension_installed',
  /**
   * The creator opened the web app from the popup's "Open Stillstats" link. The popup is not a
   * surface, so the event carries none.
   */
  'extension_popup_web_app_opened',
  /**
   * The creator opened the feedback form from the popup's "Send feedback" link. The popup is not a
   * surface, so the event carries none.
   */
  'extension_popup_feedback_opened',
  /**
   * The creator who clicked the popup's sign-in link is signed in. The popup holds the click until
   * then, since the relay answers a signed-out request 401.
   */
  'extension_popup_sign_in_clicked',
  /**
   * The browser granted YouTube access. The background sends it from `permissions.onAdded`, so it
   * records the grant however the creator made it: the popup's toggle or the browser's settings.
   */
  'extension_youtube_access_granted',
  /**
   * The browser removed YouTube access. The background sends it from `permissions.onRemoved`, so it
   * records the removal however the creator made it: the popup's toggle or the browser's settings.
   */
  'extension_youtube_access_removed',
] as const

/**
 * The extension added its numbers to the surface. Beside the surface it carries `ms`, the time in
 * whole milliseconds from the moment the pass that found the surface's element was due, or the
 * moment the extension first saw the element when that came later, to its figure showing, and
 * `fromCache`, true when every answer the figure was drawn from came from the API's cache or the
 * extension's 30-second keep, or when the figure stayed up from an earlier navigation. It carries no
 * channel ID, video ID or user ID.
 */
export const shownExtensionEventName = 'extension_surface_shown'

/** The extension events that carry the surface they happened on, or came from, and nothing more. */
export const surfaceExtensionEventNames = [
  /** The extension's selector for the surface found nothing on the page. */
  'extension_surface_missing',
  'extension_web_app_opened',
  /**
   * The creator who clicked the surface's sign-in line is signed in. The surface holds the click
   * until then, since the relay answers a signed-out request 401.
   */
  'extension_sign_in_clicked',
  /** The creator clicked the surface's connect prompt. */
  'extension_connect_channel_clicked',
] as const

/** The shown event as this release of the extension sends it: the surface, its time and its cache result. */
export type ShownExtensionEvent = {
  name: typeof shownExtensionEventName
  surface: ExtensionSurface
  ms: number
  fromCache: boolean
}

/**
 * The body of POST /api/events: one usage event of the Studio extension, which the API relays to
 * OpenPanel. It carries no video id, channel id, user id or email, and the API refuses any key not
 * named here with `invalid_event`.
 */
export type ExtensionEvent =
  | { name: (typeof valuelessExtensionEventNames)[number] }
  | { name: (typeof surfaceExtensionEventNames)[number]; surface: ExtensionSurface }
  | ShownExtensionEvent

/**
 * An event the API relays: one this release sends, or the shown event with its surface alone, as an
 * extension from before the timing still sends it while store updates roll out.
 */
export type RelayedExtensionEvent =
  | ExtensionEvent
  | { name: typeof shownExtensionEventName; surface: ExtensionSurface }
