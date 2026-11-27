import { channelPage } from './channel-page.ts'
import { feed } from './feed.ts'
import { lineClicks } from './line-clicks.ts'
import type { Surface, SurfaceOptions } from './page-watcher.ts'
import { publicPageReads } from './public-pages.ts'
import { shorts } from './shorts.ts'
import { watchPageSurface } from './watch-page.ts'

/**
 * The surfaces the content script places on a www.youtube.com tab. They share one holder of the
 * page's reads, so the held channels' uploads are read once per navigation for all of them.
 */
export function youtubeSurfaces({
  ask,
  origin,
  locale,
}: Omit<SurfaceOptions, 'lineClicks'>): Surface[] {
  // A public page shows no line, so its holder never holds a click.
  const options: SurfaceOptions = { ask, origin, locale, lineClicks: lineClicks(ask) }
  const reads = publicPageReads(options)
  return [
    channelPage(options, reads),
    watchPageSurface(options, reads),
    shorts(options, reads),
    feed(options, reads),
  ]
}
