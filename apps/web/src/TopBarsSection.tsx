import { noNumbersText } from './audience.ts'
import { Bar } from './Bar.tsx'
import { numberWithShareOf } from './share.ts'
import type { TopBar } from './top-bars.ts'

/**
 * A section of engaged views bars under its heading, each with its number and share, then each
 * note. With no bar, the heading and the empty state alone.
 */
export function TopBarsSection({
  heading,
  bars,
  notes,
}: {
  heading: string
  bars: TopBar[]
  notes: string[]
}) {
  return (
    <section className="video-detail-section">
      <h2>{heading}</h2>
      {bars.length === 0 ? (
        <p>{noNumbersText}</p>
      ) : (
        <>
          <ul className="bars">
            {bars.map(({ key, name, engagedViews, share, width }) => (
              <li key={key}>
                <span className="bars-name">{name}</span>
                <span className="bars-number">{numberWithShareOf(engagedViews, share)}</span>
                <Bar width={width} />
              </li>
            ))}
          </ul>
          {notes.map((note) => (
            <p key={note} className="note">
              {note}
            </p>
          ))}
        </>
      )}
    </section>
  )
}
