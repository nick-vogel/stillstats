import type { VideoRow, VideoSort } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'
import { type Route, routeToVideo, sortPartsOf } from './route.ts'
import type { LandedListView } from './video-list.ts'

/**
 * The pages of one list read so far, by page number, all of one read key but the page. A page
 * missing from the map is still read.
 */
export type ListPages = ReadonlyMap<number, LandedListView>

export type StepDirection = 'previous' | 'next'

/** The video a step opens, with the list page it is on. */
export interface Neighbour {
  id: string
  title: string
  page: number
}

/**
 * A list page whose read was refused: the page "Try again" reads again. An adjacent page's refusal
 * fails one place; the address's own page's refusal fails the whole stepper.
 */
export interface RefusedPlace {
  refused: number
}

/**
 * One of the stepper's two places: the video it opens, `reading` while the page it needs is read,
 * a refused place when that page's read failed, or null at an end of the whole list. `reading` and
 * null hold the place with no link.
 */
export type StepPlace = Neighbour | RefusedPlace | 'reading' | null

export interface Stepper {
  previous: StepPlace
  next: StepPlace
}

// Approved word for word in creator-analytics#262, 2026-10-18, in place of #154's "Previous video"
// and "Next video". Change them only with Nick.
const newerText = 'Newer video'
const olderText = 'Older video'
const inListText: Record<StepDirection, string> = {
  previous: 'Previous in list',
  next: 'Next in list',
}

/**
 * The steps' text in the list's `sort`. A step keeps the list's order, so in a date sort the words
 * say which way in publish date each place goes: newest first puts "Newer video" in the previous
 * place, and oldest first turns the two around. Any other sort claims no direction in time.
 */
export function stepTextOf(sort: VideoSort): Record<StepDirection, string> {
  const { key, descending } = sortPartsOf(sort)
  if (key !== 'publishedAt') return inListText
  return descending
    ? { previous: newerText, next: olderText }
    : { previous: olderText, next: newerText }
}

// Approved word for word in creator-analytics#187, 2026-10-18. Change them only with Nick. They do
// not say "next", which creator-analytics#262 gives another meaning in a date sort.
export const refusedPageText = 'The rest of the list did not load.'
export const retryText = 'Try again'

/** Where a stepper stands on the video's screen: in the head, or after the last section. */
export type StepperPosition = 'top' | 'bottom'

// The two steppers' accessible names, the words creator-analytics#452 names. Two navs named alike
// read to a screen reader as two landmarks it cannot tell apart, so each is named for where it is.
export const stepperNames: Record<StepperPosition, string> = {
  top: 'Videos, top of page',
  bottom: 'Videos, bottom of page',
}

/** A step's accessible name: its text in the list's `sort`, then the neighbouring video's title. */
export function stepLabelOf(direction: StepDirection, sort: VideoSort, title: string): string {
  return `${stepTextOf(sort)[direction]}: ${title}`
}

/** The product event a step sends: its direction, and no video id or channel id. */
export function videoSteppedEvent(direction: StepDirection): ProductEvent {
  return { name: 'video_stepped', direction }
}

/**
 * The address's page, with the video's place on it, once it is read and holds the video: `reading`
 * while it is read, a refused place when its read failed, and null when it does not hold the video.
 */
function placeOf(
  video: string,
  page: number,
  pages: ListPages,
): { videos: VideoRow[]; pageCount: number; index: number } | RefusedPlace | 'reading' | null {
  const own = pages.get(page)
  if (own === undefined) return 'reading'
  if (own.kind !== 'list') return { refused: page }
  const { videos, pageCount } = own.answer
  const index = videos.findIndex(({ id }) => id === video)
  return index === -1 ? null : { videos, pageCount, index }
}

function neighbourOf({ id, title }: VideoRow, page: number): Neighbour {
  return { id, title, page }
}

/** The video at the end of an adjacent page, once read: its last for the page before, else its first. */
function acrossEdge(pages: ListPages, page: number, direction: StepDirection): StepPlace {
  const adjacent = pages.get(page)
  if (adjacent === undefined) return 'reading'
  if (adjacent.kind !== 'list') return { refused: page }
  const { videos } = adjacent.answer
  const video = direction === 'previous' ? videos.at(-1) : videos[0]
  return video ? neighbourOf(video, page) : null
}

/**
 * The previous and next video of `video` in the list it was opened from, on the address's `page`:
 * the videos either side of it on that page, or across a page's edge the end video of the adjacent
 * page. Null, so neither shows, when the page does not hold the video; the app does not search
 * other pages for it. While the address's page is read, both hold their place; when its read is
 * refused, the whole stepper is that one refused place, since both places hang off that page.
 */
export function stepperOf(
  video: string,
  page: number,
  pages: ListPages,
): Stepper | RefusedPlace | null {
  const place = placeOf(video, page, pages)
  if (place === 'reading') return { previous: 'reading', next: 'reading' }
  if (place === null || 'refused' in place) return place
  const { videos, pageCount, index } = place
  const before = videos[index - 1]
  const after = videos[index + 1]
  return {
    previous: before
      ? neighbourOf(before, page)
      : page > 1
        ? acrossEdge(pages, page - 1, 'previous')
        : null,
    next: after
      ? neighbourOf(after, page)
      : page < pageCount
        ? acrossEdge(pages, page + 1, 'next')
        : null,
  }
}

/**
 * The pages next to the address's `page` a step needs read: the page before when the video is
 * first or second on its page, and the page after when it is last or second last, inside the list's
 * pages. Read one video early, so a step to a page's edge video finds the page it links across
 * already read, and its link stays in place.
 */
export function adjacentPagesOf(video: string, page: number, pages: ListPages): number[] {
  const place = placeOf(video, page, pages)
  if (place === 'reading' || place === null || 'refused' in place) return []
  const { videos, pageCount, index } = place
  const adjacent: number[] = []
  if (index <= 1 && page > 1) adjacent.push(page - 1)
  if (index >= videos.length - 2 && page < pageCount) adjacent.push(page + 1)
  return adjacent
}

/**
 * The route a step opens: the neighbour on the list's route, with the list's page moved to the
 * neighbour's, so Back to videos returns to the page the video is on. Every other control stays.
 */
export function stepRouteOf(listRoute: Route, { id, page }: Neighbour): Route {
  return routeToVideo({ ...listRoute, page }, id)
}

/** The video's row on any page read, which heads the screen while its own detail is read. */
export function headRowOf(pages: ListPages, video: string): VideoRow | null {
  for (const view of pages.values()) {
    if (view.kind !== 'list') continue
    const found = view.answer.videos.find(({ id }) => id === video)
    if (found) return found
  }
  return null
}
