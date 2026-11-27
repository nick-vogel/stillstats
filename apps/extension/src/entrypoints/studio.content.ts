import { defineContentScript } from 'wxt/utils/define-content-script'
import { askBackground } from '../messages.ts'
import { reportThrough, watchPage } from '../surfaces/page-watcher.ts'
import { studioSurfaces } from '../surfaces/studio-surfaces.ts'

export default defineContentScript({
  matches: ['https://studio.youtube.com/*'],
  main(ctx) {
    const watcher = watchPage({
      document,
      url: () => location.href,
      surfaces: studioSurfaces({
        ask: askBackground,
        origin: import.meta.env.API_ORIGIN,
        locale: navigator.language,
      }),
      report: reportThrough(askBackground),
    })
    // Studio is a single-page app: WXT fires this on its history navigations.
    ctx.addEventListener(window, 'wxt:locationchange', (event) =>
      watcher.navigated(event.newUrl.href),
    )
    ctx.onInvalidated(watcher.stop)
  },
})
