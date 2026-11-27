import {
  type ChannelDay,
  otherSourcesOf,
  type RevenueAmounts,
  type RevenueCurrency,
  revenueSourceSortKeys,
  rpmRevenueOf,
  videoWindowDays,
  type WindowChoice,
} from '@creator-analytics/api-types'
import { rangeDaysOf } from './custom-range.ts'
import { ctrTextOf, daysCarryHistory } from './history.ts'
import { moneyTextOf, rpmOf } from './revenue.ts'
import { isSourceColumn, sortAnnouncementOf, type TableSort } from './tables.ts'
import {
  axisLabelOf,
  type ChartDay,
  daysCarryRevenue,
  type NumberColumn,
  numberColumns,
} from './views-chart.ts'
import { watchHoursTextOf } from './watch-hours.ts'

/**
 * The revenue columns: the total, its RPM, its ad and YouTube Premium parts, and the rest of it.
 * Named here, not taken from the video list's revenue sorts, so a sort the list gains never becomes
 * a column of this table.
 */
export const revenueColumns = ['estimatedRevenue', 'rpm', ...revenueSourceSortKeys] as const
export type RevenueColumn = (typeof revenueColumns)[number]

/** The stored history's columns: a paid channel's impressions and their CTR. */
export const historyColumns = ['impressions', 'ctr'] as const
export type HistoryColumn = (typeof historyColumns)[number]

/** The columns that hold a number: every day's, then the history's, then the revenue's. */
export type ValueColumn = NumberColumn | HistoryColumn | RevenueColumn

type CellText = (value: number, locale?: string) => string

/** A number cell's text: watch time as watch hours, a count as the locale writes it. */
const cellTextOf: Record<NumberColumn, CellText> = {
  engagedViews: (value, locale) => value.toLocaleString(locale),
  views: (value, locale) => value.toLocaleString(locale),
  estimatedMinutesWatched: watchHoursTextOf,
}

interface ValueCell {
  column: ValueColumn
  textOf: CellText
}

const historyCells: ValueCell[] = [
  { column: 'impressions', textOf: (value, locale) => value.toLocaleString(locale) },
  { column: 'ctr', textOf: ctrTextOf },
]

/**
 * The table's value columns and each one's cell text: every day's numbers, then, with `history`,
 * the stored history's, then, given the currency the revenue is in, the revenue columns in that
 * currency.
 */
function valueCellsOf(currency: RevenueCurrency | undefined, history: boolean): ValueCell[] {
  const numberCells = numberColumns.map((column) => ({ column, textOf: cellTextOf[column] }))
  const cells = history ? [...numberCells, ...historyCells] : numberCells
  if (currency === undefined) return cells
  const moneyText: CellText = (value, locale) => moneyTextOf(value, currency, locale)
  return [...cells, ...revenueColumns.map((column) => ({ column, textOf: moneyText }))]
}

/**
 * Every column the numbers table under the charts can show: the day, then its numbers, then the
 * history's columns, which show only when the days carry the stored history, then the revenue
 * columns, which show only when the days carry revenue.
 */
export const viewsColumns = ['day', ...numberColumns, ...historyColumns, ...revenueColumns] as const
export type ViewsColumn = (typeof viewsColumns)[number]

/** How the numbers table is sorted: by one column, highest or latest first, or lowest or earliest. */
export type ViewsSort = TableSort<ViewsColumn>

export const defaultViewsSort: ViewsSort = { column: 'day', direction: 'descending' }

/** The numbers table's sort, named by its column's heading, as a screen reader announces it. */
export function tableSortLabelOf(
  { column, direction }: ViewsSort,
  headings: Partial<Record<ViewsColumn, string>>,
): string {
  return sortAnnouncementOf(headings[column] ?? '', direction === 'descending', column === 'day')
}

/**
 * YouTube's own total over the window, never a sum of its days, with its revenue and the currency
 * every revenue amount, the days' included, is in, when the days carry revenue, and the stored
 * history's impressions and channel CTR over the range, when the days carry it.
 */
export type ViewsTotal = Record<NumberColumn, number> &
  Partial<RevenueAmounts> &
  Pick<ChannelDay, 'impressions' | 'ctr'> & { currency?: RevenueCurrency }

/** One row of the table, as the screen shows it: a text for each of the table's columns. */
export type ViewsRow = { day: string } & Partial<Record<ValueColumn, string>>

export interface ViewsTable {
  /** The columns the table shows, in order: the day, then its numbers. */
  columns: ['day', ...ValueColumn[]]
  /** The sort in force: the one asked for, or newest day first when its column is hidden. */
  sort: ViewsSort
  rows: ViewsRow[]
  /**
   * YouTube's own total, always, apart from the rows so no sort moves it. The charts' mode never
   * changes it: the running total's last point can differ from it.
   */
  total: Partial<Record<ValueColumn, string>>
}

interface DayInWindow {
  day: ChartDay
  /** The day's place in the window: its first day is 0. */
  place: number
}

/** The revenue amounts of a day or the total, a missing one as 0. */
function amountsOf(numbers: ViewsTotal): RevenueAmounts {
  return {
    estimatedRevenue: numbers.estimatedRevenue ?? 0,
    estimatedAdRevenue: numbers.estimatedAdRevenue ?? 0,
    estimatedRedPartnerRevenue: numbers.estimatedRedPartnerRevenue ?? 0,
  }
}

/**
 * A column's raw value: RPM is the revenue `rpmRevenueOf` counts per 1,000 engaged views, the whole
 * revenue or, with the RPM switch on (`adsAndPremiumOnly`), ads and YouTube Premium only, none with
 * no engaged views; other sources is the revenue less its ad and YouTube Premium parts. Impressions
 * and CTR are none on a day the history does not hold, and CTR none with no impressions.
 */
function columnValueOf(
  numbers: ViewsTotal,
  column: ValueColumn,
  adsAndPremiumOnly: boolean,
): number | null {
  if (column === 'impressions' || column === 'ctr') return numbers[column] ?? null
  if (column === 'rpm')
    return rpmOf(rpmRevenueOf(amountsOf(numbers), adsAndPremiumOnly), numbers.engagedViews)
  if (column !== 'otherSources') return numbers[column] ?? 0
  return otherSourcesOf(amountsOf(numbers))
}

/**
 * The raw value a column sorts by, never its formatted text: watch time sorts by its minutes. None
 * for a day with no RPM.
 */
function sortValueOf(
  { day, place }: DayInWindow,
  column: ViewsColumn,
  adsAndPremiumOnly: boolean,
): number | null {
  // The dates, and the days after publish, run in the window's order, so its place sorts both.
  if (column === 'day') return place
  return columnValueOf(day, column, adsAndPremiumOnly)
}

function numberTextsOf(
  numbers: ViewsTotal,
  cells: ValueCell[],
  adsAndPremiumOnly: boolean,
  locale?: string,
): Partial<Record<ValueColumn, string>> {
  return Object.fromEntries(
    cells.map(({ column, textOf }) => {
      const value = columnValueOf(numbers, column, adsAndPremiumOnly)
      // A value there is none of, such as RPM with no engaged views, is an empty cell.
      return [column, value === null ? '' : textOf(value, locale)]
    }),
  )
}

/** The order of two values: a value there is none of runs after every number, in either direction. */
function compareValues(a: number | null, b: number | null, sign: number): number {
  if (a === null || b === null) return (a === null ? 1 : 0) - (b === null ? 1 : 0)
  return sign * (a - b)
}

function sorted(
  days: DayInWindow[],
  { column, direction }: ViewsSort,
  adsAndPremiumOnly: boolean,
): DayInWindow[] {
  const sign = direction === 'ascending' ? 1 : -1
  const sortKeyOf = (day: DayInWindow) => sortValueOf(day, column, adsAndPremiumOnly)
  // A tie keeps the newest day first, so the order never depends on the sort before it.
  return days.toSorted(
    (a, b) => compareValues(sortKeyOf(a), sortKeyOf(b), sign) || b.place - a.place,
  )
}

/**
 * The numbers table under the charts: each day as YouTube reports it, sorted on their numbers, and
 * the total YouTube reports for the window, whatever mode the charts draw in. Its revenue columns
 * show only when the days carry revenue and the total names their currency, which every amount
 * shows in, and the source columns among them only with `sources`, the creator's saved choice. Its
 * RPM, in the rows, the total row and the sort, follows the RPM switch (`adsAndPremiumOnly`), off
 * by default. Its impressions and CTR columns show only when the days carry the stored history,
 * empty on a day it does not hold, the total row the history's over the range.
 */
export function viewsTableOf(
  days: ChartDay[],
  total: ViewsTotal,
  asked: ViewsSort,
  locale?: string,
  {
    sources = false,
    adsAndPremiumOnly = false,
  }: { sources?: boolean; adsAndPremiumOnly?: boolean } = {},
): ViewsTable {
  const cells = valueCellsOf(
    daysCarryRevenue(days) ? total.currency : undefined,
    daysCarryHistory(days),
  ).filter(({ column }) => sources || !isSourceColumn(column))
  const columns: ViewsTable['columns'] = ['day', ...cells.map(({ column }) => column)]
  const sort = (columns as string[]).includes(asked.column) ? asked : defaultViewsSort
  const rows = sorted(
    days.map((day, place) => ({ day, place })),
    sort,
    adsAndPremiumOnly,
  ).map(({ day }) => ({
    day: axisLabelOf(day, locale),
    ...numberTextsOf(day, cells, adsAndPremiumOnly, locale),
  }))
  return { columns, sort, rows, total: numberTextsOf(total, cells, adsAndPremiumOnly, locale) }
}

/** The body rows the numbers table's box shows before it scrolls. */
const shownBodyRows = 10

/**
 * The rows the numbers table's box holds before it scrolls: the heading row, the revenue sources'
 * heading row when `sources` shows them, ten body rows, and the total row, in either chart mode.
 */
export function numbersTableBoxRowsOf(sources: boolean): number {
  return (sources ? 2 : 1) + shownBodyRows + 1
}

/**
 * The rows the numbers table is expected to show over a window, so its placeholder takes its
 * height: its box's rows, with as many body rows as the answer is expected to hold up to ten. A
 * calendar window and a window after publish hold every day, as a video older than the window
 * answers; a video still inside its window answers fewer, and so does a channel younger than its
 * window. A custom range holds its own count of days, as a window of that length does. Lifetime,
 * whose days come only with the answer, holds the whole box.
 */
export function numbersTableRowsOf(choice: WindowChoice, sources: boolean): number {
  const box = numbersTableBoxRowsOf(sources)
  if (choice.window === 'lifetime') return box
  const days =
    choice.window === 'custom' ? rangeDaysOf(choice.range) : videoWindowDays[choice.window]
  return box - shownBodyRows + Math.min(days, shownBodyRows)
}
