import type { PopoverRootChangeEventDetails } from '@base-ui/react/popover'
import type { SummaryUpload } from '@creator-analytics/api-types'
import {
  type KeyboardEvent,
  type MouseEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { followInPlace, RouteLink } from './RouteLink.tsx'
import { hrefOf, type Navigate, type Route, routeToVideo } from './route.ts'
import {
  holdTrackWidthOn,
  type MarkerShape,
  markerKeyStepOf,
  markerSpanOf,
  type UploadMarker,
  uploadDayPlacesOf,
  uploadMarkersLabel,
  uploadMarkersOf,
} from './upload-markers.ts'

// Every shape draws in the one token class, the axis's own ink, through `currentColor`, so no
// marker carries a colour of its own: shape is the cue, and the policy holds in both themes.
const tokenClass = 'text-muted-foreground'

/**
 * A marker's shape: a play triangle for a video, a tall rectangle for a Short, a dot inside a
 * circle for a live stream, and a small square for an upload with no format.
 */
function Shape({ shape }: { shape: MarkerShape }) {
  return (
    <svg
      className={`upload-marker-shape ${tokenClass}`}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      {shape === 'video' && <path className="fill-current" d="M3 1.5 10.5 6 3 10.5Z" />}
      {shape === 'short' && (
        <rect className="fill-current" x="3.5" y="0.5" width="5" height="11" rx="1" />
      )}
      {shape === 'live' && (
        <>
          <circle className="fill-none stroke-current" cx="6" cy="6" r="4.75" strokeWidth="1.5" />
          <circle className="fill-current" cx="6" cy="6" r="2" />
        </>
      )}
      {shape === 'none' && <rect className="fill-current" x="3" y="3" width="6" height="6" />}
    </svg>
  )
}

/**
 * What each marker takes: its place in the row's Tab order and the row's key handling, none in the
 * pointer-only row under the first plot, whose markers take `onMouseDown` instead and whose card
 * returns no focus to its tile (`mirror`).
 */
interface MarkerProps {
  marker: UploadMarker
  tabIndex: 0 | -1
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  onFocus?: () => void
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void
  ref?: (element: HTMLElement | null) => void
  mirror: boolean
  route: Route
  navigate: Navigate
}

/**
 * A single upload: a link to its video's page, followed in place as a route link is, a modified
 * click left to the browser, with its text alternative as its tooltip on hover and focus.
 */
function SingleMarker({
  marker,
  tabIndex,
  onKeyDown,
  onFocus,
  onMouseDown,
  ref,
  route,
  navigate,
}: MarkerProps & { marker: Extract<UploadMarker, { kind: 'single' }> }) {
  const target = routeToVideo(route, marker.videoId)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            ref={ref}
            className={`upload-marker ${tokenClass}`}
            style={{ left: `${marker.place * 100}%` }}
            href={hrefOf(target)}
            aria-label={marker.text}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onMouseDown={onMouseDown}
            onClick={(event) => followInPlace(event, target, navigate)}
          />
        }
      >
        <Shape shape={marker.shape} />
      </TooltipTrigger>
      <TooltipContent>{marker.text}</TooltipContent>
    </Tooltip>
  )
}

/**
 * A day of more uploads, or markers on nearby days that would overlap: a tile with their count,
 * named "2 uploads", whose card opens on hover with one row per upload, its shape, text
 * alternative and own publish date, each a link to its video's page. A click, a tap or Enter opens
 * the card and keeps it open until Escape or a press outside it.
 *
 * Base UI keeps a hover-opened card open on a click only within 500ms of its opening, and a later
 * click closes it. So a click on a card the mouse opened pins it instead: that close is cancelled,
 * and so is every hover close after it, until Escape, a press outside or another click closes it.
 */
function TileMarker({
  marker,
  tabIndex,
  onKeyDown,
  onFocus,
  onMouseDown,
  ref,
  mirror,
  route,
  navigate,
}: MarkerProps & { marker: Extract<UploadMarker, { kind: 'tile' }> }) {
  // How the open card was opened: by the mouse, pinned by a click after that, or otherwise.
  const opened = useRef<'hover' | 'pinned' | 'other' | null>(null)

  function onOpenChange(open: boolean, details: PopoverRootChangeEventDetails) {
    if (open) {
      if (opened.current !== 'pinned') {
        opened.current = details.reason === 'trigger-hover' ? 'hover' : 'other'
      }
      return
    }
    if (details.reason === 'trigger-press' && opened.current === 'hover') {
      details.cancel()
      opened.current = 'pinned'
      return
    }
    if (details.reason === 'trigger-hover' && opened.current === 'pinned') {
      details.cancel()
      return
    }
    opened.current = null
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        openOnHover
        delay={0}
        render={
          <button
            ref={ref}
            type="button"
            className={`upload-marker upload-marker-tile ${tokenClass}`}
            style={{ left: `${marker.place * 100}%` }}
            aria-label={marker.text}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onMouseDown={onMouseDown}
          />
        }
      >
        {marker.count}
      </PopoverTrigger>
      <PopoverContent className="upload-marker-card" {...(mirror ? { finalFocus: false } : {})}>
        <ul>
          {marker.rows.map((row) => (
            <li key={row.videoId}>
              <RouteLink
                className="upload-marker-row"
                route={routeToVideo(route, row.videoId)}
                navigate={navigate}
              >
                <Shape shape={row.shape} />
                <span>{row.text}</span>
                <span className="upload-marker-date">{row.date}</span>
              </RouteLink>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/**
 * A faint dashed line at the x of each upload day (`uploadDayPlacesOf`), drawn in a plot's box under
 * its chart, so the series and the cursor paint over it. It takes no pointer and stays off the
 * accessibility tree: the marker row says the uploads.
 */
export function UploadDayLines({ places }: { places: number[] }) {
  return places.map((place) => (
    <span
      key={place}
      className={`upload-day-line ${tokenClass}`}
      aria-hidden="true"
      style={{ left: `${place * 100}%` }}
    />
  ))
}

/**
 * The history start on the impressions and CTR plots: a line at the x of the first day the stored
 * history holds, with its short label at the top, drawn as the upload days' lines are, under the
 * chart and taking no pointer. It stays off the accessibility tree: the note under the cards gives
 * the history start's date.
 */
export function HistoryStartLine({ place, label }: { place: number; label: string }) {
  return (
    <span
      className={`history-start-line ${tokenClass}`}
      aria-hidden="true"
      style={{ left: `${place * 100}%` }}
    >
      <span className="history-start-label">{label}</span>
    </span>
  )
}

/** The places of the upload days' lines, kept with the uploads and the days. */
export function useUploadDayPlaces(
  uploads: SummaryUpload[] | undefined,
  days: { day: string }[],
): number[] | null {
  return useMemo(() => (uploads ? uploadDayPlacesOf(uploads, days) : null), [uploads, days])
}

/** A press on a marker in the aria-hidden row keeps focus out of it: the click still follows. */
function keepFocusOut(event: MouseEvent<HTMLElement>) {
  event.preventDefault()
}

/**
 * The upload markers under the charts' axis: one on each publish day of the window's uploads, at
 * the day's x on every plot, and markers that would overlap at the track's drawn width joined into
 * one tile, which a resize joins or splits again. The row is one Tab stop: the arrows move focus
 * between markers, Home and End to the first and the last, and the focused marker shows its
 * tooltip. With `mirror`, it is the second row, under the first of the stacked plots: the same
 * markers for the pointer only, aria-hidden and out of the Tab order, so a screen reader hears each
 * upload once, from the row under the axis. With no upload in the window, there is no row, so no
 * empty Tab stop.
 */
export function UploadMarkers({
  uploads,
  days,
  route,
  navigate,
  mirror = false,
}: {
  uploads: SummaryUpload[]
  days: { day: string }[]
  route: Route
  navigate: Navigate
  /** The pointer-only row under the first plot, rather than the fieldset under the axis. */
  mirror?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  // How many marker widths fit across the track as drawn: null until measured, as in SSR markup and
  // a layout-free test, where only uploads on one day share a tile.
  const [span, setSpan] = useState<number | null>(null)
  const markers = useMemo(() => uploadMarkersOf(uploads, days, { span }), [uploads, days, span])
  const [focused, setFocused] = useState(0)
  const elements = useRef<(HTMLElement | null)[]>([])
  const shown = markers.length > 0

  // The track mounts only with a marker to show, so the hold starts when the row appears.
  useLayoutEffect(() => {
    const element = track.current
    if (!shown || !element) return
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    return holdTrackWidthOn(element, window.ResizeObserver, (width) =>
      setSpan(markerSpanOf(width, rem)),
    )
  }, [shown])

  if (!shown) return null
  // The markers change with the window, so the remembered one may no longer exist.
  const current = Math.min(focused, markers.length - 1)

  function onKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    const next = markerKeyStepOf(event.key, index, markers.length)
    if (next === null) return
    event.preventDefault()
    setFocused(next)
    elements.current[next]?.focus()
  }

  function propsOf(index: number) {
    if (mirror) {
      return { tabIndex: -1, onMouseDown: keepFocusOut, mirror, route, navigate } as const
    }
    return {
      tabIndex: index === current ? 0 : -1,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, index),
      onFocus: () => setFocused(index),
      ref: (element: HTMLElement | null) => {
        elements.current[index] = element
      },
      mirror,
      route,
      navigate,
    } as const
  }

  const trackElement = (
    <div ref={track} className="upload-markers-track">
      {markers.map((marker, index) =>
        marker.kind === 'single' ? (
          <SingleMarker key={marker.day} marker={marker} {...propsOf(index)} />
        ) : (
          <TileMarker key={marker.day} marker={marker} {...propsOf(index)} />
        ),
      )}
    </div>
  )

  return (
    <TooltipProvider>
      {mirror ? (
        <div className="upload-markers upload-markers-mirror" aria-hidden="true">
          {trackElement}
        </div>
      ) : (
        <fieldset className="upload-markers" aria-label={uploadMarkersLabel}>
          {trackElement}
        </fieldset>
      )}
    </TooltipProvider>
  )
}
