import type { CustomRange, RangeBounds } from '@creator-analytics/api-types'
import { type Ref, useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { DateRange, Matcher } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { track } from './analytics.ts'
import {
  appliedOf,
  type BarMove,
  type BarStep,
  barChangeOf,
  barShowsFormat,
  barWindowOptionsOf,
  dateRangeLabel,
  dayPickedOf,
  dismissedOf,
  draftOnViewOf,
  formatFilterOptions,
  formatLabel,
  rangeFieldsOf,
  untouchedRangeDraft,
  windowPickedOf,
} from './controls-bar.ts'
import {
  calendarMonthOf,
  calendarText,
  compactRangeNameOf,
  compactRangeTextOf,
  customRangeText,
  dateOfDay,
  dayOfDate,
  disabledDaysOf,
  monthSpanOf,
  twoMonthsQuery,
} from './custom-range.ts'
import { ListSelect } from './ListSelect.tsx'
import { longDateOf } from './processing.ts'
import type { Navigate, Route } from './route.ts'
import { SegmentedControl } from './SegmentedControl.tsx'

/**
 * The bounds the bar takes on a channel's screen: those of the channel's last answer, kept while
 * the next one is read, and none once another channel is on view. The setter takes the bounds of
 * an answer for `channelId`.
 */
export function useChannelBounds(
  channelId: string | null,
): [RangeBounds | null, (bounds: RangeBounds) => void] {
  const [kept, setKept] = useState<{ channelId: string | null; bounds: RangeBounds } | null>(null)
  const take = useCallback((bounds: RangeBounds) => setKept({ channelId, bounds }), [channelId])
  return [kept?.channelId === channelId ? kept.bounds : null, take]
}

/** The Calendar's day that takes focus in it, the one its arrow keys start from, or null. */
function focusTargetDayIn(popup: HTMLElement | null): HTMLButtonElement | null {
  return popup?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]') ?? null
}

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia(twoMonthsQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** How many months the Calendar shows: two on a screen at least `twoMonthsQuery` wide, else one. */
function useCalendarMonths(): 1 | 2 {
  return useSyncExternalStore(
    subscribeToViewport,
    () => (window.matchMedia(twoMonthsQuery).matches ? 2 : 1),
    // Only the tests' server renderer reads this, as no server renders the app: two months.
    () => 2,
  )
}

/** The `YYYY-MM` month a Calendar `Date` falls in. */
function monthOfDate(date: Date): string {
  return dayOfDate(date).slice(0, 7)
}

/** The shown range as the Calendar's `selected`: its start, and its end once one is picked. */
function rangeOfFields({ from, to }: CustomRange): DateRange {
  return { from: dateOfDay(from), to: to ? dateOfDay(to) : undefined }
}

/** The disabled days (`disabledDaysOf`) as the Calendar's matchers. */
function disabledMatchersOf({
  before,
  after,
}: {
  before: string | null
  after: string
}): Matcher[] {
  return [...(before ? [{ before: dateOfDay(before) }] : []), { after: dateOfDay(after) }]
}

/**
 * The custom range's form, which its Popover holds: the Calendar in range mode, then the error
 * Apply answered and Apply, in a column with room under the Calendar for more. The Calendar shows
 * `fields`, the range on screen, and `months` months, and a tap names its day to `onPick`, which
 * decides the range (`rangePickedOf`). Once the `bounds` of the screen's answer have landed, the
 * days outside them are disabled and the caption's dropdowns span their months. It opens with the
 * range's end in its last month, moves there once when the range first fills as the bounds land,
 * and after that only the creator's own paging moves it. The browser's own checks are off, so
 * Apply's approved texts show.
 */
export function CustomRangeCalendar({
  fields,
  bounds,
  error,
  months,
  onPick,
  onApply,
}: {
  fields: CustomRange
  bounds: RangeBounds | null
  error: string | null
  months: 1 | 2
  onPick: (day: string) => void
  onApply: () => void
}) {
  const shownMonth = calendarMonthOf(fields, months)
  const [paged, setPaged] = useState<string | null>(null)
  const month = paged ?? shownMonth
  const disabled = disabledDaysOf(bounds)
  const span = monthSpanOf(bounds)
  return (
    <form
      className="grid justify-items-start gap-[0.75rem]"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onApply()
      }}
    >
      <Calendar
        mode="range"
        numberOfMonths={months}
        {...(month ? { month: dateOfDay(`${month}-01`) } : {})}
        onMonthChange={(date) => setPaged(monthOfDate(date))}
        {...(span?.start ? { startMonth: dateOfDay(`${span.start}-01`) } : {})}
        {...(span ? { endMonth: dateOfDay(`${span.end}-01`) } : {})}
        {...(fields.from ? { selected: rangeOfFields(fields) } : {})}
        onSelect={(_range, picked) => {
          if (!paged) setPaged(month ?? monthOfDate(new Date()))
          onPick(dayOfDate(picked))
        }}
        {...(disabled ? { disabled: disabledMatchersOf(disabled) } : {})}
        labels={{
          labelDayButton: (date) => longDateOf(dayOfDate(date)),
          labelPrevious: () => calendarText.previousMonth,
          labelNext: () => calendarText.nextMonth,
          labelMonthDropdown: () => calendarText.month,
          labelYearDropdown: () => calendarText.year,
        }}
      />
      {error && <p role="alert">{error}</p>}
      <Button variant="quiet" type="submit" className="py-[0.6rem]!">
        {customRangeText.apply}
      </Button>
    </form>
  )
}

/**
 * The controls that shape the numbers below them, in a bar that stays at the top of the screen
 * while the page scrolls: the date range with the windows `barWindowOptionsOf` offers, and the
 * format where `barShowsFormat` says so. Choosing "Custom range" opens a Popover against the select
 * that holds `CustomRangeCalendar`, and reads nothing until Apply (`rangeFieldsOf`), so the bar
 * keeps its height. The Calendar shows the window's days once the screen's answer gives the
 * bounds, under the days the creator picked (`dayPickedOf`), in two months on a screen at least
 * `twoMonthsQuery` wide and one below it. Escape or a press outside closes the Popover without
 * applying (`dismissedOf`). On a custom range a compact button beside the select names the applied
 * range and reopens the Popover on it, against itself. Focus moves onto the Calendar's focused day
 * as the Popover opens, and back to the control that opened it as it closes. Opening and closing
 * send no event; Apply sends the window change. The channel screen passes a `ref`, which the video
 * list's heading rows read to sit under the bar.
 */
export function ControlsBar({
  route,
  navigate,
  bounds,
  ref,
}: {
  route: Route
  navigate: Navigate
  bounds: RangeBounds | null
  ref?: Ref<HTMLDivElement>
}) {
  const [draft, setDraft] = useState(untouchedRangeDraft)
  const kept = draftOnViewOf(draft, route)
  if (kept !== draft) setDraft(kept)
  const { window, open, fields, applied, error } = rangeFieldsOf(kept, route, bounds)
  const select = useRef<HTMLSelectElement>(null)
  const compact = useRef<HTMLButtonElement>(null)
  const [openedFrom, setOpenedFrom] = useState<'select' | 'compact'>('select')
  const opener = openedFrom === 'compact' ? compact : select
  const popup = useRef<HTMLDivElement>(null)
  const months = useCalendarMonths()

  function move(next: BarMove | null) {
    if (!next) return
    navigate(next.route)
    if (next.event) track(next.event)
  }

  function step({ draft: next, move: made }: BarStep) {
    setDraft(next)
    move(made)
  }

  return (
    <div className="controls-bar" ref={ref}>
      <Popover
        open={open}
        onOpenChange={(opening, details) => {
          if (!opening) {
            // creator-analytics#729: Chrome sends a click to the select after a choice from its
            // native menu, and the Popover that choice opened reads it as a press outside. A press
            // on the select belongs to the select, so it leaves the Popover open.
            const { reason, event } = details
            if (
              reason === 'outside-press' &&
              event.target instanceof Node &&
              select.current?.contains(event.target)
            ) {
              return details.cancel()
            }
            return setDraft(dismissedOf(draft, route))
          }
          setOpenedFrom('compact')
          step(windowPickedOf(route, 'custom', bounds))
        }}
      >
        <ListSelect
          className="flex-[1_1_12rem]"
          label={dateRangeLabel}
          value={window}
          options={barWindowOptionsOf(route)}
          ref={select}
          onChange={(picked) => {
            setOpenedFrom('select')
            step(windowPickedOf(route, picked, bounds))
          }}
        />
        {applied && (
          <PopoverTrigger
            ref={compact}
            aria-label={compactRangeNameOf(applied)}
            render={<Button variant="quiet" className="py-[0.6rem]!" />}
          >
            {compactRangeTextOf(applied, new Date().getFullYear())}
          </PopoverTrigger>
        )}
        <PopoverContent
          ref={popup}
          anchor={opener}
          initialFocus={() => focusTargetDayIn(popup.current) ?? true}
          finalFocus={opener}
          aria-label={customRangeText.option}
        >
          {fields && (
            <CustomRangeCalendar
              fields={fields}
              bounds={bounds}
              error={error}
              months={months}
              onPick={(day) => setDraft(dayPickedOf(draft, route, bounds, day))}
              onApply={() => step(appliedOf(draft, route, bounds))}
            />
          )}
        </PopoverContent>
      </Popover>
      {barShowsFormat(route) && (
        <SegmentedControl
          label={formatLabel}
          value={route.format}
          options={formatFilterOptions}
          onChange={(format) => move(barChangeOf(route, { format }))}
        />
      )}
    </div>
  )
}
