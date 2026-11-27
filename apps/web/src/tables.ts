import { revenueSourceSortKeys } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'

// Approved word for word in creator-analytics#119 (W26). Change them only with Nick.
/**
 * The heading over the source columns, in the numbers table and the video list, and the button
 * above each that shows or hides them.
 */
export const revenueSourcesText = {
  heading: 'Revenue sources',
  show: 'Show revenue sources',
  hide: 'Hide revenue sources',
}

/** The table a "Show revenue sources" button sits above: the numbers table or the video list. */
export type SourcesTable = 'numbers' | 'list'

/**
 * The event a revenue sources button sends: the table it sits above and the sources' new state,
 * `shown` after a click that shows them, and nothing else.
 */
export function revenueSourcesToggledEvent(table: SourcesTable, shown: boolean): ProductEvent {
  return { name: 'revenue_sources_toggled', table, state: shown ? 'shown' : 'hidden' }
}

/** The parts of the estimated revenue, which the "Show revenue sources" button shows and hides. */
const sourceColumns: ReadonlySet<string> = new Set(revenueSourceSortKeys)

/** Whether a column is a part of the estimated revenue: ads, YouTube Premium or other sources. */
export function isSourceColumn(column: string): boolean {
  return sourceColumns.has(column)
}

// The sort text is the video list's, approved by Nick on 2026-10-07, and for this table in
// creator-analytics#119 (W5). Change it only with Nick.
/**
 * A sort named by its column's heading and direction, which a screen reader announces when a heading
 * sorts a table: "Views, highest first", or for a column of days, "Date, newest first".
 */
export function sortAnnouncementOf(label: string, descending: boolean, ofDays: boolean): string {
  const [descendingWord, ascendingWord] = ofDays ? ['newest', 'oldest'] : ['highest', 'lowest']
  return `${label}, ${descending ? descendingWord : ascendingWord} first`
}

/** How a table is sorted: by one column, highest or latest first, or lowest or earliest. */
export interface TableSort<Column extends string> {
  column: Column
  direction: 'ascending' | 'descending'
}

/** The mark after a sortable heading for its `aria-sort`, in every sorted table. */
export const directionMarks = { ascending: '↑', descending: '↓', none: '' }

/** How a heading sorts its table, whatever shape the table's sort takes. */
export interface HeadingSort<Sort> {
  /** The heading's `aria-sort`: how the table is sorted by this column, or not by it. */
  direction: TableSort<string>['direction'] | 'none'
  /** The sort a click on the heading moves to: the other direction, or descending at first. */
  next: Sort
}

/**
 * How a column heading sorts its table, the video list included: the sorted column's heading
 * reverses it, and any other starts descending.
 */
export function headingSortOf<Column extends string>(
  column: Column,
  sort: TableSort<Column>,
): HeadingSort<TableSort<Column>> {
  if (sort.column !== column)
    return { direction: 'none', next: { column, direction: 'descending' } }
  const next = sort.direction === 'descending' ? 'ascending' : 'descending'
  return { direction: sort.direction, next: { column, direction: next } }
}
