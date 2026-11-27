import type { SincePublish } from '@creator-analytics/api-types'
import { useId, useState } from 'react'
import { SortableHeading } from './SortableHeading.tsx'
import {
  defaultSincePublishSort,
  type SincePublishSort,
  sincePublishSortLabelOf,
  sincePublishTableOf,
  sincePublishText,
} from './since-publish.ts'
import { headingSortOf } from './tables.ts'

/**
 * The video's stages since publish that it has finished, and its lifetime, the same in every window,
 * sorted by any heading, the sort announced to a screen reader. Lifetime carries the video's age as
 * a note under its name. On a narrow screen the table scrolls sideways. The sort lives only here: it
 * is not in the address and sends no event.
 */
export function SincePublishTable({ sincePublish }: { sincePublish: SincePublish }) {
  const headingId = useId()
  const [sort, setSort] = useState<SincePublishSort>(defaultSincePublishSort)
  const { columns, rows } = sincePublishTableOf(sincePublish, sort)
  return (
    <div className="video-detail-section">
      <h2 id={headingId}>{sincePublishText.heading}</h2>
      {/* A screen reader reads a heading's aria-sort only on entering it, so a new sort is announced here. */}
      <p className="visually-hidden" aria-live="polite">
        {sincePublishSortLabelOf(sort)}
      </p>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard scrolls the box only once it has focus. */}
      <section className="since-publish" aria-labelledby={headingId} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <td />
              {columns.map(({ column, heading }) => (
                <SortableHeading
                  key={column}
                  label={heading}
                  sort={headingSortOf(column, sort)}
                  onSort={setSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stage}>
                <th scope="row">
                  {row.stage}
                  {row.note && <span className="since-publish-note">{row.note}</span>}
                </th>
                {columns.map(({ column }) => (
                  <td key={column}>{row.cells[column]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
