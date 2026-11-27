import type { EngagedViewsAndViews, SubscriberSplit } from '@creator-analytics/api-types'
import type { Figure } from './Figures.tsx'
import { numberWithShareOf, shareLabelOf, shareOf } from './share.ts'

export interface SubscriberSplitView {
  figures: Figure[]
  /** Where the bar splits: the subscribers' share of the two sides' engaged views, as a percentage. */
  subscribedWidth: number
}

/** Each side's engaged views, then its share of the two sides' engaged views, such as "1,234 (61%)". */
export function subscriberSplitOf(
  { subscribed, unsubscribed }: SubscriberSplit,
  locale?: string,
): SubscriberSplitView {
  const bothEngagedViews = subscribed.engagedViews + unsubscribed.engagedViews
  const textOf = ({ engagedViews }: EngagedViewsAndViews) =>
    numberWithShareOf(
      engagedViews.toLocaleString(locale),
      shareLabelOf(engagedViews, bothEngagedViews),
    )
  return {
    // The labels are approved word for word in creator-analytics#69. Change them only with Nick.
    figures: [
      { label: 'Subscribers', text: textOf(subscribed) },
      { label: 'Non-subscribers', text: textOf(unsubscribed) },
    ],
    subscribedWidth: shareOf(subscribed.engagedViews, bothEngagedViews),
  }
}
