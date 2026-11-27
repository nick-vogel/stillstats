import type { ExtensionEvent, ExtensionSurface } from '@creator-analytics/api-types'
import type { AskBackground } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { showsSignedIn } from '../signed-in-read.ts'
import type { LineClick } from './states.ts'

/** The Studio tab's one holder of the clicks on the surfaces' lines. */
export interface LineClicks {
  /** The creator opened a surface's line link, with a click or a middle-click. */
  opened(surface: ExtensionSurface, click: LineClick): void
  /** A surface's read from the background, which tells whether the creator is signed in. */
  read(read: VideosRead): void
}

/**
 * Asks the background for `event`. An ask that throws before it returns a promise, as Chrome's
 * sendMessage does once the extension is updated under an open Studio tab, rejects instead.
 */
function askEvent(ask: AskBackground, event: ExtensionEvent): Promise<boolean> {
  try {
    return ask({ type: 'usage-event', event })
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * Asks for `event` once. An ask the background never answers rejects, and an ask that throws before
 * it returns a promise throws; both are swallowed, so the caller (a click's listener, or the watch's
 * pass and give-up) goes on. The event is then lost, since only a held sign-in click has a later
 * read to send it again.
 */
export function sendOnce(ask: AskBackground, event: ExtensionEvent): void {
  askEvent(ask, event).catch(() => {})
}

/**
 * Asks for `extension_web_app_opened` from `surface`: a refusal line's link, or the analytics page's
 * "View this video in Stillstats".
 */
export function sendWebAppOpened(ask: AskBackground, surface: ExtensionSurface): void {
  sendOnce(ask, { name: 'extension_web_app_opened', surface })
}

/**
 * The connect and web app clicks ask for their event at once. A sign-in click is held, as the
 * popup holds its own, because the relay answers a signed-out request 401: the next read of any
 * surface that shows the creator signed in sends it. Clicks on one surface before then send one
 * event. The hold lives in the content script's memory for the tab's life, since the extension asks
 * for no `storage` permission. Every event goes through the background's `usage-event`, which
 * settles it under Firefox's usage data consent like every other usage event.
 */
export function lineClicks(ask: AskBackground): LineClicks {
  const held = new Set<ExtensionSurface>()

  return {
    opened(surface, click) {
      switch (click) {
        case 'sign-in':
          held.add(surface)
          return
        case 'connect':
          sendOnce(ask, { name: 'extension_connect_channel_clicked', surface })
          return
        case 'web-app':
          sendWebAppOpened(ask, surface)
          return
      }
    },
    read(read) {
      if (!showsSignedIn(read)) return
      for (const surface of held) {
        // Out of the hold before the ask, so two reads that land together send it once.
        held.delete(surface)
        askEvent(ask, { name: 'extension_sign_in_clicked', surface }).then(
          (settled) => {
            if (!settled) held.add(surface)
          },
          () => held.add(surface),
        )
      }
    },
  }
}
