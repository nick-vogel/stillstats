import { type CSSProperties, useId, useState } from 'react'
import {
  defaultViewsSort,
  numbersTableBoxRowsOf,
  tableSortLabelOf,
  type ViewsColumn,
  type ViewsSort,
  type ViewsTotal,
  viewsTableOf,
} from './numbers-table.ts'
import { revenueSourcesOf, rpmAdsAndPremiumOnlyOf, usePreferences } from './preferences.ts'
import { RevenueSourcesButton } from './RevenueSourcesButton.tsx'
import { SortableHeading } from './SortableHeading.tsx'
import { headingSortOf, isSourceColumn, revenueSourcesText } from './tables.ts'
import type { ChartDay } from './views-chart.ts'

export interface NumbersTableText {
  caption: string
  headings: Record<ViewsColumn, string>
  total: string
}

/**
 * The charts' numbers, always in view: a box ten body rows high that scrolls under its heading rows,
 * sorted by any heading, the sort announced to a screen reader. Its rows are always each day's own
 * numbers and its foot always YouTube's own total, which stays last whatever the sort and in view
 * at the box's bottom: the charts' mode never changes the table. With revenue, a button above it
 * shows or hides the revenue source columns, which then sit under their own heading. The sort lives
 * only here: it is not in the address and sends no event.
 */
export function NumbersTable({
  days,
  total,
  text,
}: {
  days: ChartDay[]
  total: ViewsTotal
  text: NumbersTableText
}) {
  const [asked, setSort] = useState<ViewsSort>(defaultViewsSort)
  const { saved } = usePreferences()
  const captionId = useId()
  const {
    columns,
    sort,
    rows,
    total: totalRow,
  } = viewsTableOf(days, total, asked, undefined, {
    sources: revenueSourcesOf(saved),
    adsAndPremiumOnly: rpmAdsAndPremiumOnlyOf(saved),
  })
  const [, ...valueColumns] = columns
  const sourceColumns = columns.filter(isSourceColumn)
  const grouped = sourceColumns.length > 0

  function headingOf(column: ViewsColumn, rowSpan?: number) {
    return (
      <SortableHeading
        key={column}
        label={text.headings[column]}
        sort={headingSortOf(column, sort)}
        onSort={setSort}
        rowSpan={rowSpan}
      />
    )
  }

  return (
    <>
      {columns.includes('estimatedRevenue') && <RevenueSourcesButton table="numbers" />}
      {/* A screen reader reads a heading's aria-sort only on entering it, so a new sort is announced here. */}
      <p className="visually-hidden" aria-live="polite">
        {tableSortLabelOf(sort, text.headings)}
      </p>
      <section
        className="numbers-table"
        style={{ '--rows': numbersTableBoxRowsOf(grouped) } as CSSProperties}
        aria-labelledby={captionId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard scrolls the box only once it has focus.
        tabIndex={0}
      >
        <table>
          <caption id={captionId} className="visually-hidden">
            {text.caption}
          </caption>
          <thead>
            <tr>
              {columns
                .filter((column) => !isSourceColumn(column))
                .map((column) => headingOf(column, grouped ? 2 : undefined))}
              {grouped && (
                <th scope="colgroup" colSpan={sourceColumns.length} className="numbers-table-group">
                  {revenueSourcesText.heading}
                </th>
              )}
            </tr>
            {grouped && <tr>{sourceColumns.map((column) => headingOf(column))}</tr>}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.day}>
                <th scope="row">{row.day}</th>
                {valueColumns.map((column) => (
                  <td key={column}>{row[column]}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{text.total}</th>
              {valueColumns.map((column) => (
                <td key={column}>{totalRow[column]}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </section>
    </>
  )
}
