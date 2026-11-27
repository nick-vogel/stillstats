import { videoAnalyticsPage } from './analytics.ts'
import { latestVideoCard } from './card.ts'
import { contentList } from './content-list.ts'
import { lineClicks } from './line-clicks.ts'
import type { Surface, SurfaceOptions } from './page-watcher.ts'

/** The surfaces the content script places on a Studio tab. */
export function studioSurfaces({
  ask,
  origin,
  locale,
}: Omit<SurfaceOptions, 'lineClicks'>): Surface[] {
  const options: SurfaceOptions = {
    ask,
    origin,
    locale,
    // One holder for the tab, so a sign-in click held on one surface is sent by any surface's read.
    lineClicks: lineClicks(ask),
  }
  return [latestVideoCard(options), contentList(options), videoAnalyticsPage(options)]
}
