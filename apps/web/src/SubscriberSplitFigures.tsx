import type { SubscriberSplit } from '@creator-analytics/api-types'
import { noNumbersText } from './audience.ts'
import { Bar } from './Bar.tsx'
import { Figures } from './Figures.tsx'
import { subscriberSplitOf } from './subscriber-split.ts'

/**
 * The engaged views of a video, on its screen, or of the channel, on the Audience screen, split
 * between subscribers and the rest. With no split, as the Audience answer gives when Google answers
 * no row, the heading and the empty state alone.
 */
export function SubscriberSplitFigures({ split }: { split: SubscriberSplit | null }) {
  return (
    <section className="video-detail-section">
      {/* The heading and the rows are approved word for word in creator-analytics#69. */}
      <h2>Subscribers and non-subscribers (engaged views)</h2>
      {split === null ? <p>{noNumbersText}</p> : <SplitFigures split={split} />}
    </section>
  )
}

function SplitFigures({ split }: { split: SubscriberSplit }) {
  const { figures, subscribedWidth } = subscriberSplitOf(split)
  return (
    <>
      <Figures figures={figures} />
      <Bar width={subscribedWidth} rest />
    </>
  )
}
