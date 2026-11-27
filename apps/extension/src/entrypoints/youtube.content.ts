import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { askBackground } from '../messages.ts'
import { reportThrough, watchPage } from '../surfaces/page-watcher.ts'
import { youtubeSurfaces } from '../surfaces/youtube-surfaces.ts'
import { stopOnRestoreWithoutYouTubeAccess, stopOnYouTubeAccessRemoved } from '../youtube-access.ts'

// Registered at runtime by the background, only while the creator grants YouTube access, so the
// build leaves it out of the manifest. It declares no `matches` on purpose: WXT 0.21.4 adds a
// runtime script's `matches` to `host_permissions`, which would make www.youtube.com a host every
// install asks for. `youtube-access.ts` passes the match pattern when it registers the script.
// It watches the public page surfaces as the Studio script watches Studio's.
export default defineContentScript({
  registration: 'runtime',
  main(ctx) {
    const watcher = watchPage({
      document,
      url: () => location.href,
      surfaces: youtubeSurfaces({
        ask: askBackground,
        origin: import.meta.env.API_ORIGIN,
        locale: navigator.language,
      }),
      report: reportThrough(askBackground),
    })
    // youtube.com is a single-page app: WXT fires this on its history navigations.
    ctx.addEventListener(window, 'wxt:locationchange', (event) =>
      watcher.navigated(event.newUrl.href),
    )
    ctx.onInvalidated(watcher.stop)
    // Once YouTube access is removed the script stops as an invalidation does: the surfaces come
    // down and the watch and the location listener end, with no reload. A later grant injects a
    // new script, which WXT keeps the only one running.
    const removeListener = stopOnYouTubeAccessRemoved({
      onMessage: browser.runtime.onMessage,
      stop: () => ctx.abort('YouTube access removed'),
    })
    ctx.onInvalidated(removeListener)
    // A page held in the back/forward cache cannot hear the removal message, so a restored page
    // asks the background whether the grant still holds and stops the same way when it does not.
    ctx.addEventListener(
      window,
      'pageshow',
      stopOnRestoreWithoutYouTubeAccess({
        ask: askBackground,
        stop: () => ctx.abort('YouTube access removed'),
      }),
    )
  },
})
