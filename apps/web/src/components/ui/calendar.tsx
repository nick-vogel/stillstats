import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import * as React from 'react'
import { type CustomComponents, type DayButton, DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

// shadcn's Calendar (react-day-picker), restyled to the visual system (ADR 0014 rule 2) for the
// custom range (creator-analytics#690). Its classes are the Calendar's whole look, on the theme's
// token colours: the picked ends in the accent, the days between them on the soft accent fill the
// toast's close button hovers with (--bg-glow), a day under the pointer outlined in the accent,
// disabled days muted, and the focused day on the visual system's `:focus-visible`. Gone are
// shadcn's popover, primary and muted colours, its focus ring, its --radius-md and --spacing(7)
// cell, its `cn-calendar-*` and `group/*` markers (which emit no rule), its rtl rules, the `ghost`
// and `icon` Button variants our Button lacks, and its merges of react-day-picker's `rdp-*`
// classes: the app never imports their stylesheet, so the few react-day-picker still sets on its
// own emit nothing. The buttons are plain buttons, not our Button, because the visual system's
// `.button` sits outside Tailwind's layers and would outrank every utility here. The radius is
// important because the visual system's `:focus-visible` rule would otherwise round a focused day
// to 0.25rem. The background is the shorthand: the minifier writes `background-color: transparent`
// as the colour literal #0000, which the rule 3 test refuses. The cell is 2.25rem, so one month
// fits the Popover at 375px and two at 40rem. The caption's month and year are react-day-picker's
// native selects, laid transparent over their label as shadcn lays them, so a phone opens its own
// picker; the label shows the select's focus. Only the dropdown caption is styled, the one the
// custom range uses, and outside days are hidden, so two months never show a day twice. The
// caption, the month dropdown, the weekday names and each grid's name follow the browser's locale
// through Intl, as the app's other dates do, not date-fns's en-US. No transition or animation. The
// Calendar was copied by hand from `shadcn view calendar`: the CLI's `cn` import named an npm
// package, not the app's utility, and no `cn` or `date-fns` package was added. Tailwind reads this
// comment too, so it names no utility that would emit a colour.
function Calendar({
  classNames,
  showOutsideDays = false,
  captionLayout = 'dropdown',
  formatters,
  labels,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      formatters={{
        formatCaption: (date) => date.toLocaleDateString(undefined, captionFormat),
        formatMonthDropdown: (date) => date.toLocaleDateString(undefined, { month: 'short' }),
        formatWeekdayName: (date) => date.toLocaleDateString(undefined, { weekday: 'short' }),
        ...formatters,
      }}
      labels={{
        labelGrid: (date) => date.toLocaleDateString(undefined, captionFormat),
        labelWeekday: (date) => date.toLocaleDateString(undefined, { weekday: 'long' }),
        ...labels,
      }}
      classNames={{
        root: cn('w-fit [--cell-size:2.25rem]'),
        months: cn('relative flex gap-6'),
        month: cn('flex w-full flex-col gap-2'),
        nav: cn(
          'pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between',
        ),
        button_previous: cn(
          'pointer-events-auto inline-flex size-(--cell-size) cursor-pointer items-center justify-center rounded-full! border-0 [background:transparent] p-0 text-foreground select-none aria-disabled:cursor-default aria-disabled:opacity-50 [&:hover:not([aria-disabled])]:[background:var(--bg-glow)]',
        ),
        button_next: cn(
          'pointer-events-auto inline-flex size-(--cell-size) cursor-pointer items-center justify-center rounded-full! border-0 [background:transparent] p-0 text-foreground select-none aria-disabled:cursor-default aria-disabled:opacity-50 [&:hover:not([aria-disabled])]:[background:var(--bg-glow)]',
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1 text-[0.9375rem] [font-weight:600]',
        ),
        dropdown_root: cn(
          'relative rounded-[0.5rem] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
        ),
        dropdown: cn('absolute inset-0 w-full cursor-pointer opacity-0'),
        caption_label: cn(
          'flex h-8 items-center gap-1 rounded-[0.5rem] ps-2 pe-1 whitespace-nowrap text-foreground select-none [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
        ),
        month_grid: cn('w-full border-collapse'),
        weekdays: cn('flex'),
        weekday: cn('flex-1 p-0 text-[0.8rem] font-normal text-muted-foreground select-none'),
        week: cn('mt-1 flex w-full'),
        day: cn('relative size-(--cell-size) p-0 text-center select-none'),
        range_start: cn('rounded-s-full [background:var(--bg-glow)]'),
        range_middle: cn('[background:var(--bg-glow)]'),
        range_end: cn('rounded-e-full [background:var(--bg-glow)]'),
        hidden: cn('invisible'),
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

const captionFormat: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

function CalendarRoot({
  className,
  rootRef,
  ...props
}: React.ComponentProps<CustomComponents['Root']>) {
  return <div data-slot="calendar" ref={rootRef} className={className} {...props} />
}

function CalendarChevron({
  className,
  orientation,
}: React.ComponentProps<CustomComponents['Chevron']>) {
  const Icon =
    orientation === 'left'
      ? ChevronLeftIcon
      : orientation === 'right'
        ? ChevronRightIcon
        : ChevronDownIcon
  return <Icon className={cn('size-4', className)} aria-hidden="true" />
}

/**
 * A day's button. It takes focus when react-day-picker moves the focused day, so the arrow keys
 * walk the days; Enter and Space are the button's own press.
 */
function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      data-day={day.isoDate}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'relative flex size-(--cell-size) cursor-pointer items-center justify-center rounded-full! border-0 [background:transparent] p-0 font-sans text-[0.9375rem] leading-none font-normal text-foreground disabled:cursor-default disabled:text-muted-foreground disabled:opacity-50 data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground [&:hover:not(:disabled)]:[box-shadow:inset_0_0_0_1px_var(--accent)]',
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
