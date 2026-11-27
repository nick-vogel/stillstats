import { compareVersions } from '@creator-analytics/releases/version'
import type { ProductEvent } from './landing.ts'
import { type Route, routeOf } from './route.ts'
import { whatsNewLinkText } from './sidebar.ts'

/**
 * A highlight as the build hands it to the web app (`virtual:highlights`, from
 * highlights-plugin.ts): its description is HTML the release content package wrote from the
 * repository's own markdown, at build time.
 */
export interface BuiltHighlight {
  name: string
  title: string
  /** First-party HTML, from the build. */
  html: string
  /** The app version of the release note that lists it. */
  release: string
  /** That release's day, `YYYY-MM-DD`. */
  releaseDate: string
  /** That release's page on the site, the same origin as the web app. */
  releasePath: string
  /** The web app screen the highlight links to, a path under /app. */
  screen?: string
}

// The screen's copy, for Nick's approval at creator-analytics#577's review. Change it only with
// Nick.
export const whatsNewHeading = whatsNewLinkText
export const screenLinkText = 'Open the screen'
export const noHighlightsText = 'Nothing new to show yet.'

/** The release link's text: the release as its own page names it. A highlight is an app's. */
export function releaseLinkTextOf(release: string): string {
  return `Stillstats ${release}`
}

/**
 * Sent when the creator opens "What's new" from the sidebar or the header's Menu below 48rem
 * (creator-analytics#891). It carries no account ID (approved by Nick on 2026-11-09,
 * creator-analytics#577).
 */
export const whatsNewOpenedEvent = {
  name: 'whats_new_opened',
  from: 'sidebar',
} as const satisfies ProductEvent

/**
 * Sent when the creator opens "What's new" from the banner's link. It carries no account ID
 * (approved by Nick on 2026-11-09, creator-analytics#580).
 */
export const whatsNewOpenedFromBannerEvent = {
  name: 'whats_new_opened',
  from: 'banner',
} as const satisfies ProductEvent

/** Sent when the creator closes the banner. It carries no account ID, as the open does. */
export const whatsNewBannerClosedEvent = {
  name: 'whats_new_banner_closed',
} as const satisfies ProductEvent

// The banner's copy, for Nick's approval at creator-analytics#580's review. One plain line, with
// no number and no urgency (ADR 0011, ADR 0018). The link's text differs from the sidebar's "What's
// new", so the two links keep distinct names. Change it only with Nick.
export const bannerLabel = 'New in Stillstats'
export const bannerText = 'Stillstats has something new.'
export const bannerLinkText = "See what's new"
export const bannerCloseLabel = 'Close this notice'

const appBase = '/app/'

/**
 * The route a highlight's screen link opens: its path under /app read as the web app reads its
 * address, on the channel on view, so the link is followed in place.
 */
export function screenRouteOf(screen: string, onView: Route): Route {
  const { pathname, search } = new URL(screen, 'https://app.invalid')
  const path = pathname.startsWith(appBase) ? pathname.slice(appBase.length) : ''
  const route = routeOf(path, search)
  return onView.channel ? { ...route, channel: onView.channel } : route
}

/** Whether `version` is newer than the marker. No marker reads as older than every version. */
function isNewerThanMarker(version: string, marker: string | undefined): boolean {
  return marker === undefined || compareVersions(version, marker) > 0
}

/**
 * The release the "What's new" banner announces, or null for no banner: the newest release with a
 * highlight, when it is newer than the marker and its day is after the day the account was created,
 * in UTC. `highlights` are newest release first, as the build hands them over, so a release with
 * no highlight never brings one.
 */
export function bannerReleaseOf(
  highlights: readonly BuiltHighlight[],
  marker: string | undefined,
  accountCreatedAt: string,
): string | null {
  const [newest] = highlights
  if (newest === undefined || !isNewerThanMarker(newest.release, marker)) return null
  return newest.releaseDate > accountCreatedAt.slice(0, 10) ? newest.release : null
}

/**
 * The marker to save once the creator has seen "What's new": the newest highlighted release, or
 * undefined when the marker is already there or past it, so an open never moves it back.
 */
export function markerAfterOpen(
  highlights: readonly BuiltHighlight[],
  marker: string | undefined,
): string | undefined {
  const [newest] = highlights
  return newest !== undefined && isNewerThanMarker(newest.release, marker)
    ? newest.release
    : undefined
}
