import { channelNameOf, type ExtensionEvent } from '@creator-analytics/api-types'
import type { AskBackground } from './messages.ts'
import type { ChannelsRead } from './product-api.ts'

// The popup's text is approved word for word in creator-analytics#92, the YouTube access toggle's
// in creator-analytics#120 and #539, and "Send feedback" (the web app's sidebar label) in
// creator-analytics#751. Change it only with Nick.
export const popupText = {
  signedIn: 'Signed in to Stillstats',
  channelsHeading: 'Your channels',
  noChannels: 'No channel connected yet. Connect one in Stillstats.',
  signIn: 'Sign in at stillstats.com',
  openStillstats: 'Open Stillstats',
  sendFeedback: 'Send feedback',
  hostAccessMissing:
    'Stillstats needs access to studio.youtube.com and stillstats.com to show your numbers.',
  allowAccess: 'Allow access',
  youtubeToggle: 'Show engaged views on youtube.com',
  youtubeToggleExplanation:
    'Your browser asks for access to www.youtube.com. Stillstats reads the links to videos and channels on the page, and matches them against your own videos in your browser, so it sends no video id from the page.',
} as const

export interface PopupLink {
  text: string
  href: string
  /** Sent on click, not held like the sign-in click. */
  clickEvent?: ExtensionEvent
}

/** The YouTube access toggle, on while the browser grants www.youtube.com. */
export interface YouTubeToggle {
  label: string
  explanation: string
  on: boolean
}

export type PopupView =
  // The access prompt stays the popup's one ask: with the required hosts withheld, no engaged
  // views show anywhere, so the toggle would turn on nothing.
  | { kind: 'host-access-missing'; message: string; button: string }
  | {
      kind: 'signed-in'
      status: string
      heading: string
      channelNames: string[]
      link: PopupLink
      feedbackLink: PopupLink
      youtubeToggle: YouTubeToggle
    }
  | {
      kind: 'no-channels'
      status: string
      message: string
      link: PopupLink
      feedbackLink: PopupLink
      youtubeToggle: YouTubeToggle
    }
  | { kind: 'signed-out'; link: PopupLink; youtubeToggle: YouTubeToggle }
  // No approved text says the read failed, and calling it signed out would be wrong.
  | { kind: 'failed'; link: PopupLink; youtubeToggle: YouTubeToggle }

export type PopupRead = ChannelsRead | { state: 'host-access-missing' }

/**
 * Every browser lets the creator withhold host access, Chrome through its site access setting, and
 * a channel read without it fails, so the popup checks first and reads only with it. A check or a
 * read that fails, whether it rejects or throws before it returns a promise, reads as failed: a
 * failed check says nothing about access. Never rejects.
 */
export async function readForPopup({
  hostAccess,
  readChannels,
}: {
  hostAccess: () => Promise<boolean>
  readChannels: () => Promise<ChannelsRead>
}): Promise<PopupRead> {
  try {
    if (!(await hostAccess())) return { state: 'host-access-missing' }
    return await readChannels()
  } catch {
    return { state: 'failed' }
  }
}

export function popupViewOf({
  read,
  origin,
  youtubeAccess,
}: {
  read: PopupRead
  origin: string
  /** Whether the browser grants YouTube access, read afresh on every popup open. */
  youtubeAccess: boolean
}): PopupView {
  // The web app shows "Sign in with Google" to a signed-out creator.
  const webApp = `${origin}/app`
  const openLink: PopupLink = {
    text: popupText.openStillstats,
    href: webApp,
    clickEvent: { name: 'extension_popup_web_app_opened' },
  }
  // Only a signed-in creator can send a message, so only the signed-in views show it. The screen
  // names the popup, so Nick's admin screen tells its messages apart from the web app's.
  const feedbackLink: PopupLink = {
    text: popupText.sendFeedback,
    href: `${webApp}/feedback?screen=extension`,
    clickEvent: { name: 'extension_popup_feedback_opened' },
  }
  const youtubeToggle: YouTubeToggle = {
    label: popupText.youtubeToggle,
    explanation: popupText.youtubeToggleExplanation,
    on: youtubeAccess,
  }
  switch (read.state) {
    case 'host-access-missing':
      return {
        kind: 'host-access-missing',
        message: popupText.hostAccessMissing,
        button: popupText.allowAccess,
      }
    case 'signed-out':
      return {
        kind: 'signed-out',
        link: { text: popupText.signIn, href: webApp },
        youtubeToggle,
      }
    case 'failed':
      return { kind: 'failed', link: openLink, youtubeToggle }
    case 'signed-in':
      if (read.channels.length === 0) {
        return {
          kind: 'no-channels',
          status: popupText.signedIn,
          message: popupText.noChannels,
          link: openLink,
          feedbackLink,
          youtubeToggle,
        }
      }
      return {
        kind: 'signed-in',
        status: popupText.signedIn,
        heading: popupText.channelsHeading,
        channelNames: read.channels.map(channelNameOf),
        link: openLink,
        feedbackLink,
        youtubeToggle,
      }
  }
}

/**
 * The relay answers a signed-out request 401 and relays nothing, so a click on the sign-in link is
 * held until a popup open finds the creator signed in.
 */
export function signInClickToSend({
  pending,
  read,
}: {
  pending: boolean
  read: PopupRead
}): boolean {
  return pending && read.state === 'signed-in'
}

/**
 * Kept in the popup's localStorage, which needs no manifest permission and outlives both the popup
 * and an idle background script.
 */
const signInPendingKey = 'sign-in-click-pending'

/** A click on the signed-out popup's sign-in link, held across popup opens until it is sent. */
export interface HeldSignInClick {
  /** The creator clicked the sign-in link. */
  hold(): void
  /** Asks for `extension_popup_sign_in_clicked` when a click is held and `read` shows the creator signed in. */
  sendOn(read: PopupRead): Promise<void>
}

export function heldSignInClick({
  storage,
  ask,
}: {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  ask: AskBackground
}): HeldSignInClick {
  return {
    hold: () => storage.setItem(signInPendingKey, 'true'),
    async sendOn(read) {
      const pending = storage.getItem(signInPendingKey) !== null
      if (!signInClickToSend({ pending, read })) return
      // Through `then`, so an ask that throws before it returns a promise is caught like one the
      // background never answers. Either way the click stays held for the next open.
      const settled = await Promise.resolve()
        .then(() =>
          ask({ type: 'usage-event', event: { name: 'extension_popup_sign_in_clicked' } }),
        )
        .catch(() => false)
      if (settled) storage.removeItem(signInPendingKey)
    },
  }
}
