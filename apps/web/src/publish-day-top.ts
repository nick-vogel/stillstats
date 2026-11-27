import type { PublishDayVideo } from '@creator-analytics/api-types'
import { shareOf } from './share.ts'

// The text is approved word for word in creator-analytics#85. Change it only with Nick.
export const publishDayTopText = {
  heading: 'Most engaged views on the publish day',
  empty: 'YouTube has not processed a publish day for any video yet.',
}

export interface PublishDayTopBar {
  id: string
  title: string
  /** The video's engaged views on its publish day, as text. */
  engagedViews: string
  /** The bar's length, as a percentage of the longest. */
  width: number
}

/**
 * One bar per video of the publish day top, in the API's order, most first, each as long as its
 * publish day engaged views. No bar carries its place in the order: creator-analytics#85 decided
 * the top shows no rank number.
 */
export function publishDayTopBarsOf(
  videos: PublishDayVideo[],
  locale?: string,
): PublishDayTopBar[] {
  const most = Math.max(0, ...videos.map(({ engagedViews }) => engagedViews))
  return videos.map(({ id, title, engagedViews }) => ({
    id,
    title,
    engagedViews: engagedViews.toLocaleString(locale),
    width: shareOf(engagedViews, most),
  }))
}
