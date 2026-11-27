import { retentionAndSharingLines } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'

/**
 * The screen a sign-in or a connect begun on it lands back on, by the name the API knows: the
 * upgrade screen, where the homepage's "Subscribe" sends a visitor (creator-analytics#907).
 */
export type ConsentLanding = 'upgrade'

/**
 * What the creator is about to ask Google for, shown on a consent screen before they go: a
 * connection, landing on the web app's first screen or the one named, or revenue consent.
 */
export type ConsentRequest =
  | { consent: 'connection'; landing?: ConsentLanding }
  | { consent: 'revenue'; channelId: string }

interface ConsentScreenDescriptor {
  heading: string
  paragraphs: string[]
  openedEvent: ProductEvent
}

// The text is approved word for word in creator-analytics#56, but for the disclosure line that
// `retentionAndSharingLines` marks pending. Change it only with Nick.
export const consentScreens: Record<ConsentRequest['consent'], ConsentScreenDescriptor> = {
  connection: {
    heading: 'Connect your channel',
    paragraphs: [
      "Stillstats reads your channel's numbers from YouTube, through Google, so it can show them to you.",
      // Approved word for word in creator-analytics#275 (epic #268), replacing the #158 paragraph.
      'It reads your uploads list and the analytics of your channel and your videos: views, engaged views, audience retention, traffic sources and subscribers gained. It also reads who watches: the countries, US states and cities your viewers watch from, the age group and gender of signed-in viewers, their devices and operating systems, and whether they subscribe.',
      ...retentionAndSharingLines,
    ],
    openedEvent: { name: 'connect_channel_clicked' },
  },
  revenue: {
    heading: 'Show estimated revenue',
    paragraphs: [
      'This is a separate permission. Google asks for it on its own screen.',
      "With it, Stillstats reads your channel's estimated revenue from YouTube and shows it only to you. The number refreshes every 6 hours, the same as your other numbers.",
      'Disconnecting the channel ends this permission too.',
      // Approved in creator-analytics#70.
      'Revenue works only for channels in the YouTube Partner Program.',
    ],
    openedEvent: { name: 'give_revenue_consent_clicked' },
  },
}

// Approved word for word in creator-analytics#70. A first visit goes from Google sign-in straight
// on to Google's connect consent, so the signed-out screen explains the connection before either.
export const signedOutConsent = {
  heading: 'What Stillstats reads',
  // The connection consent screen's own array, so the two can never drift apart.
  paragraphs: consentScreens.connection.paragraphs,
  closing: 'After you sign in, Google asks you to pick the channel to connect.',
}

/**
 * Sent by every click of the signed-out screen's "Sign in with Google", the web app's last moment
 * before Google on the first-visit path. A returning creator's sign-in sends it too.
 */
export const signInEvent: ProductEvent = continuedEvent({ consent: 'connection' })

/** The event sent when the consent screen opens: the click on the button that opens it. */
export function openedEvent({ consent }: ConsentRequest): ProductEvent {
  return consentScreens[consent].openedEvent
}

/** The event sent when the creator continues to Google. It names the consent, never the channel. */
export function continuedEvent({ consent }: ConsentRequest): ProductEvent {
  return { name: 'consent_screen_continued', consent }
}

/** The query that names a landing to the API, or nothing for the web app's first screen. */
function landingQueryOf(landing: ConsentLanding | undefined, joiner: '?' | '&'): string {
  return landing ? `${joiner}${new URLSearchParams({ landing })}` : ''
}

/** The API route that answers with Google's consent URL for the request. */
export function googleConsentPathOf(request: ConsentRequest): string {
  return request.consent === 'connection'
    ? `/api/channels/connect${landingQueryOf(request.landing, '?')}`
    : `/api/channels/${request.channelId}/revenue-consent`
}

/**
 * The API route the signed-out screen's sign-in starts: one that takes a user with no channel
 * straight on to Google's connect consent, landing back on the screen named, if any.
 */
export function signInPathOf(landing: ConsentLanding | undefined): string {
  return `/api/auth/sign-in/google?then=connect${landingQueryOf(landing, '&')}`
}

/** The landing of a sign-in or a connect begun on the route: the upgrade screen's, or none. */
export function landingOfRoute(route: { upgrade?: true }): ConsentLanding | undefined {
  return route.upgrade ? 'upgrade' : undefined
}

/** The connection the empty state asks for on the route, landing back on it when it names one. */
export function connectionRequestOf(route: { upgrade?: true }): ConsentRequest {
  const landing = landingOfRoute(route)
  return landing ? { consent: 'connection', landing } : { consent: 'connection' }
}
