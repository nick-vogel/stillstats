import type { AgeGroup, Gender } from '@creator-analytics/api-types'
import { noNumbersText } from './audience.ts'
import { Bar } from './Bar.tsx'
import { ageGroupBarsOf, genderBarsOf, type ViewerShareBar } from './viewer-shares.ts'

// The headings and the note are approved word for word in creator-analytics#268 on 2026-10-19.

/** A section of share bars under its heading, then its note. With no bar, the empty state alone. */
function ViewerSharesSection({
  heading,
  bars,
  note,
}: {
  heading: string
  bars: ViewerShareBar[]
  note?: string
}) {
  return (
    <section className="video-detail-section">
      <h2>{heading}</h2>
      {bars.length === 0 ? (
        <p>{noNumbersText}</p>
      ) : (
        <>
          <ul className="bars">
            {bars.map(({ key, name, share, width }) => (
              <li key={key}>
                <span className="bars-name">{name}</span>
                <span className="bars-number">{share}</span>
                <Bar width={width} />
              </li>
            ))}
          </ul>
          {note && <p className="note">{note}</p>}
        </>
      )}
    </section>
  )
}

/** The share of signed-in viewers' views by age group, in age order. */
export function AgeGroups({ ageGroups }: { ageGroups: AgeGroup[] }) {
  return (
    <ViewerSharesSection
      heading="Age (share of signed-in viewers)"
      bars={ageGroupBarsOf(ageGroups)}
    />
  )
}

/** The share of signed-in viewers' views by gender, then the note that they count signed-in viewers. */
export function Genders({ genders }: { genders: Gender[] }) {
  return (
    <ViewerSharesSection
      heading="Gender (share of signed-in viewers)"
      bars={genderBarsOf(genders)}
      note="These shares count only viewers who are signed in to YouTube."
    />
  )
}
