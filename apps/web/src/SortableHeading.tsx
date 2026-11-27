import { directionMarks, type HeadingSort } from './tables.ts'

/**
 * A column heading of a sorted table, the video list's, the numbers table's or the since publish
 * table's: a button with the heading and its direction mark that moves to the next sort, under the
 * heading's `aria-sort`. A heading its table cannot sort by is its text alone.
 */
export function SortableHeading<Sort>({
  label,
  sort,
  onSort,
  className,
  rowSpan,
}: {
  label: string
  sort: HeadingSort<Sort> | null
  onSort: (next: Sort) => void
  className?: string | undefined
  rowSpan?: number | undefined
}) {
  return (
    <th scope="col" rowSpan={rowSpan} className={className} aria-sort={sort?.direction}>
      {sort ? (
        <button type="button" className="sortable-heading" onClick={() => onSort(sort.next)}>
          {label}
          <span aria-hidden="true">{directionMarks[sort.direction]}</span>
        </button>
      ) : (
        label
      )}
    </th>
  )
}
