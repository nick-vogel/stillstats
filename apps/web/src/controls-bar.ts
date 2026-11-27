import type {
  CustomRange,
  RangeBounds,
  VideoFormatFilter,
  VideoWindow,
  WindowChoice,
} from '@creator-analytics/api-types'
import { customRangeErrorOf, prefillOf, rangePickedOf } from './custom-range.ts'
import type { Option } from './ListSelect.tsx'
import type { ProductEvent } from './landing.ts'
import { isCalendarWindow, type Route, routeWithControl, routeWithDetailWindow } from './route.ts'
import { controlChangedEvent } from './video-list.ts'
import { windowOptions } from './windows.ts'

// The labels are approved word for word in creator-analytics#73. Change them only with Nick.
export const dateRangeLabel = 'Date range'
export const formatLabel = 'Format'

// The format text is approved word for word in creator-analytics#53. Change it only with Nick.
export const formatFilterOptions: Option<VideoFormatFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'short', label: 'Shorts' },
  { value: 'live', label: 'Live' },
]

export type BarControl = WindowChoice | Pick<Route, 'format'>

/**
 * The windows the date range offers: every one, but on the Audience screen the calendar windows
 * only, a custom range included, so neither lifetime nor a window after publish.
 */
export function barWindowOptionsOf(route: Route): Option<VideoWindow>[] {
  if (!route.audience) return windowOptions
  return windowOptions.filter(({ value }) => isCalendarWindow(value))
}

/**
 * Whether the bar holds the format beside the date range: on the channel screen and the Audience
 * screen, and not on a video's detail screen, since a video has one format.
 */
export function barShowsFormat(route: Route): boolean {
  return !route.video
}

/**
 * The route a change in the bar moves to, and the product event it sends. On the channel screen
 * and the Audience screen a change goes to the first page of the list. On a video's detail screen
 * the page stays, so the link back returns to the page the video was opened from. A change on the
 * Audience screen sends no event: the bar's events name the video list.
 */
export function barChangeOf(route: Route, control: BarControl): BarMove {
  return {
    route:
      route.video && 'window' in control
        ? routeWithDetailWindow(route, control)
        : routeWithControl(route, control),
    event: route.audience ? null : controlChangedEvent(control),
  }
}

/**
 * What Apply does with the custom range's fields: the error the fields show, with no route and so
 * no read, or the move to the range and its event, as any change in the bar. Null when the range
 * is the one already on view, so Apply reads nothing again. The range goes into the address only,
 * never into a saved preference.
 */
export function customApplyOf(
  route: Route,
  from: string,
  to: string,
  bounds: RangeBounds | null,
  locale?: string,
): { error: string } | BarMove | null {
  const error = customRangeErrorOf(from, to, bounds, locale)
  if (error) return { error }
  if (route.range?.from === from && route.range.to === to) return null
  return barChangeOf(route, { window: 'custom', range: { from, to } })
}

/**
 * What the creator left in the custom range: the days set, picked on the Calendar
 * (`dayPickedOf`), and the error Apply answered, each for the channel, window and range on view
 * when it was left (`viewOf`). `typed` holds only the days the creator set, so an end left alone
 * follows the days on screen (`prefillOf`) whenever the bounds land; an open draft with nothing set
 * is `{ onView }`.
 */
export interface RangeDraft {
  typed: (Partial<CustomRange> & { onView: string }) | null
  error: { text: string; onView: string } | null
}

export const untouchedRangeDraft: RangeDraft = { typed: null, error: null }

/** A move the bar makes: the route it navigates to and the event it sends, if any. */
export interface BarMove {
  route: Route
  event: ProductEvent | null
}

/** The bar after the creator acts in it: the draft it keeps, and the move it makes, if any. */
export interface BarStep {
  draft: RangeDraft
  move: BarMove | null
}

/** What is on view for the draft: the channel, the window and the range. */
function viewOf({ channel, window, range }: Route): string {
  const windowOnView = range ? `${window}:${range.from}:${range.to}` : window
  return `${channel ?? ''}|${windowOnView}`
}

/** The days typed on `route`, without the view they were typed for. None typed elsewhere. */
function typedDaysOf({ typed }: RangeDraft, route: Route): Partial<CustomRange> {
  if (typed?.onView !== viewOf(route)) return {}
  const { onView: _onView, ...days } = typed
  return days
}

/**
 * The days in the fields on `route`: the days on screen (`prefillOf`) under those typed on it, so
 * a field the creator has not typed in fills once the bounds land.
 */
function fieldDaysOf(draft: RangeDraft, route: Route, bounds: RangeBounds | null): CustomRange {
  return { ...prefillOf(route, bounds), ...typedDaysOf(draft, route) }
}

/**
 * The draft kept once `route` is on view: the days typed and the error left on another channel,
 * window or range are dropped, so a channel switch, Back, Forward or a change elsewhere never
 * brings back stale fields or a stale error. The same draft when nothing is dropped.
 */
export function draftOnViewOf(draft: RangeDraft, route: Route): RangeDraft {
  const onView = viewOf(route)
  const typed = draft.typed?.onView === onView ? draft.typed : null
  const error = draft.error?.onView === onView ? draft.error : null
  return typed === draft.typed && error === draft.error ? draft : { typed, error }
}

/** What the bar shows of the custom range: see `rangeFieldsOf`. */
export interface RangeShown {
  window: VideoWindow
  open: boolean
  fields: CustomRange | null
  applied: CustomRange | null
  error: string | null
}

/**
 * What the bar shows of a draft on `route` (`draftOnViewOf`): the window the select shows, whether
 * the custom range's Popover is open, the fields' days while it is, the range applied when the route
 * is a custom range (which the compact button shows), and the error inside the Popover. The Popover
 * is open while a draft is, and its fields hold the days on screen (`prefillOf`) under the days typed.
 */
export function rangeFieldsOf(
  draft: RangeDraft,
  route: Route,
  bounds: RangeBounds | null,
): RangeShown {
  const onView = draftOnViewOf(draft, route)
  const error = onView.error?.text ?? null
  const applied = route.window === 'custom' ? (route.range ?? null) : null
  if (!onView.typed) {
    return { window: route.window, open: false, fields: null, applied, error }
  }
  const fields = fieldDaysOf(onView, route, bounds)
  return { window: 'custom', open: true, fields, applied, error }
}

/**
 * The draft after the Popover closes without Apply, on Escape or a press outside it: the days typed
 * and the error Apply answered both go, so the select shows the window the route holds and a reopen
 * starts on the days on screen, the applied range on a custom route.
 */
export function dismissedOf(_draft: RangeDraft, _route: Route): RangeDraft {
  return untouchedRangeDraft
}

/**
 * The bar after the creator picks a window in the select, or presses the compact button. "Custom
 * range" opens the Popover's fields with nothing typed, so they hold the days on screen
 * (`prefillOf`), filled once the bounds land, and moves nowhere, since only Apply reads. Any other
 * window closes them, and moves to it unless it is the window already on view, which the select
 * offers while the Popover is open. The bounds are not read: the fields take them when they show.
 */
export function windowPickedOf(
  route: Route,
  window: VideoWindow,
  _bounds: RangeBounds | null,
): BarStep {
  if (window === 'custom') {
    return { draft: { typed: { onView: viewOf(route) }, error: null }, move: null }
  }
  const move = window === route.window ? null : barChangeOf(route, { window })
  return { draft: untouchedRangeDraft, move }
}

/**
 * The draft after the creator sets a day of the range. Only the days set are kept, so an end left
 * alone still follows the days on screen. The error stays until the next Apply.
 */
export function dayTypedOf(
  draft: RangeDraft,
  route: Route,
  _bounds: RangeBounds | null,
  day: Partial<CustomRange>,
): RangeDraft {
  const typed = { ...typedDaysOf(draft, route), ...day, onView: viewOf(route) }
  return { ...draft, typed }
}

/**
 * The bar after Apply (`customApplyOf`): the error inside the Popover, which stays open, or the
 * Popover closed and the move to the range, none for the range already on view.
 */
export function appliedOf(
  draft: RangeDraft,
  route: Route,
  bounds: RangeBounds | null,
  locale?: string,
): BarStep {
  const { from, to } = fieldDaysOf(draft, route, bounds)
  const applied = customApplyOf(route, from, to, bounds, locale)
  if (applied && 'error' in applied) {
    const error = { text: applied.error, onView: viewOf(route) }
    return { draft: { ...draft, error }, move: null }
  }
  return { draft: untouchedRangeDraft, move: applied }
}

/**
 * The draft after the creator taps `day` on the Calendar: the range `rangePickedOf` makes of the
 * days the Calendar shows, kept as `dayTypedOf` keeps a day, so a pick is keyed to the view, drops
 * on a channel switch, and overrides the prefill whenever the bounds land.
 */
export function dayPickedOf(
  draft: RangeDraft,
  route: Route,
  bounds: RangeBounds | null,
  day: string,
): RangeDraft {
  const picked = rangePickedOf(fieldDaysOf(draft, route, bounds), day)
  return dayTypedOf(draft, route, bounds, picked)
}
