import type { VideoFormat } from '@creator-analytics/api-types'

// The surfaces' text is approved word for word in creator-analytics#93, #94, #96, #133, #207, #220,
// #225, #229, which shows "engaged views" above the analytics page's figure, #121, which brings
// the access line, and #120, which brings the public page pill's hover. The comparison
// row's window words ("Publish day", "First N days") are proposed in #218, and the analytics page's
// line without its day ("Data from Stillstats.") in #225, for Nick's approval in their pull
// requests. The Content list's line under Studio's page title takes the analytics page's words, from
// the layout Nick approved from a mockup on 2026-10-15 for #230.
// Change it only with Nick.
export const surfaceText = {
  /**
   * Ends the engaged views pill, after the figure when there is one, and is the visible line above
   * the analytics page's figure.
   */
  label: 'engaged views',
  /** The extension icon's accessible name. */
  markName: 'Stillstats',
  through: (day: string) => `Through ${day}`,
  /**
   * The public page pill's hover and accessible name: the full figure, then the day it runs through,
   * or the figure alone when the answer has no processed day.
   */
  pillName: (figure: string, day: string | null): string =>
    day
      ? `Stillstats: ${figure} engaged views. Through ${day}`
      : `Stillstats: ${figure} engaged views`,
  notProcessed: 'Not processed yet',
  signIn: 'Sign in at stillstats.com',
  channelNotInStillstats: 'This channel is not in Stillstats.',
  connect: 'Connect it',
  reconnect: 'Reconnect in Stillstats',
  /** The access line, the whole of it: the fix is a browser grant, so it links nothing. */
  allowAccess: 'Allow access to stillstats.com',
  tryAgain: 'Try again later',
  /**
   * Under the analytics page's figure when Studio's period is one the extension does not map, so
   * the figure is lifetime and not Studio's period.
   */
  lifetime: 'Lifetime',
  /**
   * Opens the analytics page's line above Studio's key metric card, and is the whole of the Content
   * list's line under Studio's page title, with the day the figures run through, or without it when
   * the answer has no processed day.
   */
  dataFrom: (day: string | null): string =>
    day ? `Data from Stillstats as of ${day}.` : 'Data from Stillstats.',
  /** Ends the analytics page's line: the link to the video's detail screen in the web app. */
  viewInStillstats: 'View this video in Stillstats',
  /**
   * The latest video card's comparison row: its place among the newest uploads of its format, with
   * the format's word in the singular when the format has one upload.
   */
  comparison: (place: number, count: number, format: VideoFormat): string =>
    `${place} of ${count} ${(count === 1 ? surfaceText.formatOfOne : surfaceText.formats)[format]} by engaged views`,
  /** The formats in the words of the web app's format filter. */
  formats: { video: 'Videos', short: 'Shorts', live: 'Live' } satisfies Record<VideoFormat, string>,
  /** A format's word when it has one upload. */
  formatOfOne: { video: 'Video', short: 'Short', live: 'Live' } satisfies Record<
    VideoFormat,
    string
  >,
  /**
   * Under the comparison row: the days since publish it counts each upload over, the publish day
   * alone, as the web app names its first window after publish.
   */
  publishDay: 'Publish day',
  /** Under the comparison row, when it counts each upload over its first `days` days. */
  firstDays: (days: number): string => `First ${days} days`,
} as const
