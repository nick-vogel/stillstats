import type { SummaryUpload, VideoFormat } from '@creator-analytics/api-types'
import { uploadMarkerRem } from './upload-marker-width.ts'
import { formatLabels } from './video-list.ts'

/** A marker's shape: its format's, or a small square for an upload with no format. */
export type MarkerShape = VideoFormat | 'none'

/** One upload in a tile's card. */
export interface TileRow {
  videoId: string
  shape: MarkerShape
  /** Its text alternative (`uploadTextOf`). */
  text: string
  /** Its publish day in the locale's date, as the axis under the charts writes a day. */
  date: string
}

/**
 * Where a marker sits: its publish day (a tile's first), that day's index in the days, and its
 * place across the plot.
 */
interface MarkerPlace {
  /** YYYY-MM-DD, the publish day. */
  day: string
  /** The day's index in the days, the x every plot draws the day at. */
  index: number
  /** From 0 at the plot's left edge to 1 at its right edge. */
  place: number
}

/**
 * One marker under the charts: a single upload, drawn as its format's shape and opening its video,
 * or a tile for a day of more uploads, or for markers on nearby days that would overlap, with their
 * count, which opens a card of their rows. A tile's `day` and `index` are its first day's, and its
 * place the middle of the days it covers.
 */
export type UploadMarker =
  | (MarkerPlace & { kind: 'single'; shape: MarkerShape; text: string; videoId: string })
  | (MarkerPlace & {
      kind: 'tile'
      /** YYYY-MM-DD, the last day it covers: its `day` for a tile of one day. */
      lastDay: string
      count: number
      text: string
      rows: TileRow[]
    })

// The words are the Format column's, and "Upload" for an upload with no format, approved with the
// "Short: My title" form in creator-analytics#281 on 2026-10-19. Change them only with Nick.
const noFormatWord = 'Upload'

/**
 * The marker row's accessible name, which VoiceOver reads as the group's before its first marker.
 * Not yet approved by Nick: creator-analytics#281's assumptions name it.
 */
export const uploadMarkersLabel = 'Uploads'

/** An upload's text alternative: its format's word, or "Upload" with none, then its title. */
export function uploadTextOf({ format, title }: SummaryUpload): string {
  return `${format === null ? noFormatWord : formatLabels[format]}: ${title}`
}

/** A tile's text alternative, approved in creator-analytics#281 on 2026-10-19: "2 uploads". */
function tileTextOf(count: number): string {
  return `${count} uploads`
}

/**
 * A publish day in the locale's date, as the axis under the charts writes a day (`axisLabelOf`): a
 * Pacific reporting day, written as it is, whatever the screen's time zone.
 */
function dateOf(day: string, locale?: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}

function shapeOf(format: VideoFormat | null): MarkerShape {
  return format ?? 'none'
}

/**
 * The plots' x for the day at `index` of `count` days, from 0 to 1: the index over the last index,
 * and a single day at the middle, where the plots' domain of -1 to 1 draws it.
 */
export function placeOf(index: number, count: number): number {
  return count === 1 ? 0.5 : index / (count - 1)
}

/** A run of neighbouring publish days whose uploads share one marker, from `first` to `last`. */
interface MarkerGroup {
  first: MarkerPlace
  last: MarkerPlace
  /** The middle of the first and the last day's places, where the marker sits. */
  place: number
}

/**
 * The day groups joined until no two neighbours overlap: the closest neighbouring pair whose
 * centres sit less than one marker width apart, the leftmost on a tie, joins into one group, and
 * again, so a joined group that still overlaps a further neighbour joins it too. `span` is how
 * many marker widths fit across the track (`uploadMarkerRem`).
 */
function joinedOf(groups: MarkerGroup[], span: number): MarkerGroup[] {
  const joined = [...groups]
  for (;;) {
    let closest = -1
    let gap = 1
    for (let left = 0; left + 1 < joined.length; left++) {
      const a = joined[left]
      const b = joined[left + 1]
      if (!a || !b) continue
      const apart = (b.place - a.place) * span
      if (apart < gap) {
        gap = apart
        closest = left
      }
    }
    const a = joined[closest]
    const b = joined[closest + 1]
    if (!a || !b) return joined
    joined.splice(closest, 2, {
      first: a.first,
      last: b.last,
      place: (a.first.place + b.last.place) / 2,
    })
  }
}

/** Where to draw the markers: the room the track has, and the locale a tile's card dates its rows in. */
export interface MarkerRoom {
  /**
   * How many marker widths fit across the track as drawn, its width over `uploadMarkerRem` in px.
   * Null (or 0) when the track is not laid out, as SSR markup and a layout-free test are, and then
   * only uploads on one day share a tile.
   */
  span?: number | null
  locale?: string
}

/**
 * The markers of the uploads among the days, oldest first: one for each publish day, a single
 * upload's shape or a tile with the count of a day of more, and with `span`, markers that would
 * overlap at the track's width joined into one tile, which can cover nearby days. A tile's rows keep
 * the uploads' order, which the summary's answer runs newest first, each dated by its own publish
 * day. An upload on a day the days do not hold has no marker.
 */
export function uploadMarkersOf(
  uploads: SummaryUpload[],
  days: { day: string }[],
  { span = null, locale }: MarkerRoom = {},
): UploadMarker[] {
  const indexOf = new Map(days.map(({ day }, index) => [day, index]))
  const groups = [
    ...new Set(uploads.map(({ publishDay }) => publishDay).filter((day) => indexOf.has(day))),
  ]
    .map((day): MarkerGroup => {
      const index = indexOf.get(day) ?? 0
      const where = { day, index, place: placeOf(index, days.length) }
      return { first: where, last: where, place: where.place }
    })
    .toSorted((a, b) => a.first.index - b.first.index)
  return (span ? joinedOf(groups, span) : groups).map(({ first, last, place }): UploadMarker => {
    const grouped = uploads.filter(({ publishDay }) => {
      const index = indexOf.get(publishDay)
      return index !== undefined && index >= first.index && index <= last.index
    })
    const where = { day: first.day, index: first.index, place }
    const [only] = grouped
    if (only && grouped.length === 1) {
      return {
        ...where,
        kind: 'single',
        shape: shapeOf(only.format),
        text: uploadTextOf(only),
        videoId: only.id,
      }
    }
    return {
      ...where,
      kind: 'tile',
      lastDay: last.day,
      count: grouped.length,
      text: tileTextOf(grouped.length),
      rows: grouped.map((upload) => ({
        videoId: upload.id,
        shape: shapeOf(upload.format),
        text: uploadTextOf(upload),
        date: dateOf(upload.publishDay, locale),
      })),
    }
  })
}

/**
 * How many marker widths fit across a track `widthPx` wide at a root font size of `remPx`: the
 * span `uploadMarkersOf` joins markers at. Null when either is 0, as for a track not laid out.
 */
export function markerSpanOf(widthPx: number, remPx: number): number | null {
  return widthPx > 0 && remPx > 0 ? widthPx / (uploadMarkerRem * remPx) : null
}

/**
 * The place across the plot (0 to 1, as `placeOf` gives a marker's) of each distinct publish day
 * among the days, oldest first, where every plot draws an upload day's line. It ignores joining: a
 * tile covering nearby days draws one line for each. An upload on a day the days do not hold draws
 * none.
 */
export function uploadDayPlacesOf(uploads: SummaryUpload[], days: { day: string }[]): number[] {
  const indexOf = new Map(days.map(({ day }, index) => [day, index]))
  const indexes = new Set(
    uploads.flatMap(({ publishDay }) => {
      const index = indexOf.get(publishDay)
      return index === undefined ? [] : [index]
    }),
  )
  return [...indexes].toSorted((a, b) => a - b).map((index) => placeOf(index, days.length))
}

/** The marker track, read as its border box, subpixel. */
interface Track {
  getBoundingClientRect(): { readonly width: number }
}

type Resizes<T> = new (onResize: () => void) => { observe(target: T): void; disconnect(): void }

/**
 * Writes the marker track's width in px, at once and again each time the track resizes, but only
 * when it changed, so the row joins or splits its markers at the width it is drawn at. Returns the
 * release.
 */
export function holdTrackWidthOn<T extends Track>(
  track: T,
  ResizeObserver: Resizes<NoInfer<T>>,
  write: (width: number) => void,
): () => void {
  let written: number | null = null

  function read() {
    const { width } = track.getBoundingClientRect()
    if (width === written) return
    written = width
    write(width)
  }

  const resizes = new ResizeObserver(read)
  resizes.observe(track)
  read()
  return () => resizes.disconnect()
}

/**
 * The marker a key moves focus to on the marker row, from the one at `current` of `count`: the
 * arrows one step, stopping at either end, Home the first and End the last. Null for any other key.
 */
export function markerKeyStepOf(key: string, current: number, count: number): number | null {
  const last = count - 1
  if (key === 'ArrowRight') return Math.min(current + 1, last)
  if (key === 'ArrowLeft') return Math.max(current - 1, 0)
  if (key === 'Home') return 0
  if (key === 'End') return last
  return null
}
