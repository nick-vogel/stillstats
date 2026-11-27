import { browser } from 'wxt/browser'
import { hostAccessOf } from '../../host-access.ts'
import { askBackground } from '../../messages.ts'
import { renderPopup } from '../../popup-page.ts'
import { youtubeAccessOf } from '../../youtube-access.ts'
import './style.css'

const root = document.getElementById('popup')
if (root) {
  void renderPopup({
    document,
    root,
    hostAccess: hostAccessOf({
      manifest: browser.runtime.getManifest(),
      permissions: browser.permissions,
    }),
    youtubeAccess: youtubeAccessOf({ permissions: browser.permissions }),
    ask: askBackground,
    storage: localStorage,
    origin: import.meta.env.API_ORIGIN,
  })
}
