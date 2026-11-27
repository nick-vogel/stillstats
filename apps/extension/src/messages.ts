import type {
  ExtensionEvent,
  ExtensionSurface,
  ShownExtensionEvent,
} from '@creator-analytics/api-types'
import { browser } from 'wxt/browser'
import type { ChannelsRead, UploadsRead, VideosQuery, VideosRead } from './product-api.ts'

/** The names of the usage events the watch reports, as against a surface's link clicks. */
export const surfaceEventNames = ['extension_surface_shown', 'extension_surface_missing'] as const

/**
 * The usage event the watch reports for a surface, on Studio or a public page: it showed its
 * numbers, with the time they took and whether every answer they were drawn from was from the
 * cache, or its selector found nothing. It goes to the background as a `usage-event`, as a
 * surface's link clicks do.
 */
export type SurfaceEvent =
  | ShownExtensionEvent
  | {
      name: Exclude<(typeof surfaceEventNames)[number], ShownExtensionEvent['name']>
      surface: ExtensionSurface
    }

/** What the popup and the content scripts ask the background script, which alone calls the API. */
export type BackgroundRequest =
  | { type: 'read-channels' }
  | ({ type: 'read-videos' } & VideosQuery)
  /** A public page's read of a held channel's uploads, which it matches its tiles against. */
  | { type: 'read-uploads'; youtubeChannelId: string }
  | { type: 'usage-event'; event: ExtensionEvent }
  | { type: 'youtube-access' }

/** True once a usage event is settled: sent, or not allowed to be sent. */
export type Settled = boolean

export interface BackgroundAnswer {
  'read-channels': ChannelsRead
  'read-videos': VideosRead
  'read-uploads': UploadsRead
  'usage-event': Settled
  /**
   * True while the creator grants YouTube access. A www.youtube.com page restored from the
   * back/forward cache asks it, since it was away when the background told the open tabs of a
   * removal.
   */
  'youtube-access': boolean
}

export type AskBackground = <R extends BackgroundRequest>(
  request: R,
) => Promise<BackgroundAnswer[R['type']]>

export const askBackground: AskBackground = (request) => browser.runtime.sendMessage(request)
