import type { Refusal, VideoRow } from '@creator-analytics/api-types'
import type { VideosRead } from '../product-api.ts'
import type { SurfaceOptions } from './page-watcher.ts'
import { surfaceText } from './text.ts'

export interface SurfaceLink {
  text: string
  href: string
}

/**
 * What a line's link is, for the event its click sends: the sign-in line, the connect prompt, or a
 * refusal line's link to the web app. The access line has no link.
 */
export type LineClick = 'sign-in' | 'connect' | 'web-app'

/**
 * What a surface shows for one video, from the background's read. `day` is the last day the
 * answer's figures run through, as the locale writes it ("7 Oct"), if the answer has one.
 */
export type SurfaceView =
  | { kind: 'figure'; figure: string; day: string | null }
  | { kind: 'not-processed'; day: string | null }
  | { kind: 'line'; text: string | null; link: SurfaceLink; click: LineClick }
  | { kind: 'line'; text: string; link: null }
  | { kind: 'nothing' }

/** A view that adds the extension's numbers to a surface: its figure, or "Not processed yet". */
export type AnswerView = Extract<SurfaceView, { kind: 'figure' | 'not-processed' }>

/** The views that add the extension's numbers to a surface, which `extension_surface_shown` counts. */
export function showsAnswer(view: SurfaceView): view is AnswerView {
  return view.kind === 'figure' || view.kind === 'not-processed'
}

/**
 * What a surface shows once for a page of videos, such as the Content list: the day its figures run
 * through, as the locale writes it, if the answer has one, or the state's line in place of every
 * figure.
 */
export type PageView = { kind: 'through'; day: string | null } | LineView

/** The line a surface shows in place of its numbers, such as the sign-in line. */
export type LineView = Extract<SurfaceView, { kind: 'line' }>

const reconnectRefusals: readonly Refusal[] = ['connection_revoked', 'not_connected']

/**
 * The line a read that holds no answer shows, linking the Stillstats web app at `origin`, or, for
 * the access line, nothing.
 */
function lineOf(read: Exclude<VideosRead, { state: 'read' }>, origin: string): LineView {
  // The web app shows "Sign in with Google" to a signed-out creator and the connect button to a
  // signed-in one, so every line whose fix is at stillstats.com links it.
  const webApp = `${origin}/app`
  const line = (text: string | null, linkText: string, click: LineClick): LineView => ({
    kind: 'line',
    text,
    link: { text: linkText, href: webApp },
    click,
  })
  switch (read.state) {
    case 'signed-out':
      return line(null, surfaceText.signIn, 'sign-in')
    case 'channel-not-in-stillstats':
      return line(surfaceText.channelNotInStillstats, surfaceText.connect, 'connect')
    case 'refused':
      return reconnectRefusals.includes(read.refusal)
        ? line(null, surfaceText.reconnect, 'web-app')
        : line(null, surfaceText.tryAgain, 'web-app')
    case 'failed':
      return line(null, surfaceText.tryAgain, 'web-app')
    case 'host-access-withheld':
      // No surface can make the grant itself: a content script has no permissions API, and a click
      // in Studio is not a user action a request sent to the background could be made in, in Chrome
      // or Firefox. The popup's "Allow access" makes it.
      return { kind: 'line', text: surfaceText.allowAccess, link: null }
  }
}

function dayIn(day: string | null, locale: string | undefined): string | null {
  return day ? dayOf(day, locale) : null
}

/** A read from the background, and how a surface shows it. */
interface ReadShown extends Pick<SurfaceOptions, 'origin' | 'locale'> {
  read: VideosRead
}

export function surfaceViewOf({
  read,
  videoId,
  origin,
  locale,
}: ReadShown & { videoId: string }): SurfaceView {
  if (read.state !== 'read') return lineOf(read, origin)
  const video = read.answer.videos.find(({ id }) => id === videoId)
  if (!video) return { kind: 'nothing' }
  const day = dayIn(read.answer.lastProcessedDay, locale)
  if (video.awaitingProcessing) return { kind: 'not-processed', day }
  return { kind: 'figure', figure: new Intl.NumberFormat(locale).format(video.engagedViews), day }
}

/**
 * What a public page surface shows for one of the creator's uploads: the engaged views pill's
 * compact figure, and its hover and accessible name. Undefined for an upload YouTube has not
 * processed; a video not among the uploads, and every read that holds no answer, has no pill either:
 * a public page shows no line.
 */
export interface PillView {
  figure: string
  name: string
}

export function pillViewOf({
  video,
  lastProcessedDay,
  locale,
}: Pick<ReadShown, 'locale'> & {
  /** One of the creator's uploads, from a held channel's uploads read. */
  video: VideoRow
  /** The uploads read's last processed day, which the pill's name gives as its day. */
  lastProcessedDay: string
}): PillView | undefined {
  if (video.awaitingProcessing) return undefined
  return {
    figure: new Intl.NumberFormat(locale, { notation: 'compact' }).format(video.engagedViews),
    name: surfaceText.pillName(
      new Intl.NumberFormat(locale).format(video.engagedViews),
      dayIn(lastProcessedDay, locale),
    ),
  }
}

export function pageViewOf({ read, origin, locale }: ReadShown): PageView {
  if (read.state !== 'read') return lineOf(read, origin)
  return { kind: 'through', day: dayIn(read.answer.lastProcessedDay, locale) }
}

/** A YYYY-MM-DD day as the locale writes a short day and month, "7 Oct" in en-GB. */
function dayOf(day: string, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}
