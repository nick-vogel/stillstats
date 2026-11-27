import type { ExtensionEvent } from '@creator-analytics/api-types'
import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import type { ScriptPublicPath } from 'wxt/utils/inject-script'
import { backgroundAnswerer } from '../background-answer.ts'
import { firstRunOnInstalled } from '../first-run.ts'
import { heldInstallEvent, indexedDbInstallHold } from '../held-install.ts'
import { hostAccessOf } from '../host-access.ts'
import { type AddHostAccessRequest, watchWithheldHostAccess } from '../host-access-request.ts'
import type { BackgroundRequest, Settled } from '../messages.ts'
import { createProductApi } from '../product-api.ts'
import { usageEventSettled, usageEventsAllowed } from '../usage-events.ts'
import {
  keepYouTubeAccessInStep,
  tellEveryTab,
  youtubeAccessOf,
  youtubeOrigins,
} from '../youtube-access.ts'

export default defineBackground(() => {
  const productApi = createProductApi({
    origin: import.meta.env.API_ORIGIN,
    headers: import.meta.env.API_HEADERS,
    fetch: globalThis.fetch.bind(globalThis),
    now: Date.now,
  })

  async function grantedDataCollection(): Promise<string[] | undefined> {
    // Firefox answers the data the creator agreed to share as `data_collection`, which the
    // Chrome-shaped types do not name.
    const granted = (await browser.permissions.getAll()) as { data_collection?: string[] }
    return granted.data_collection
  }

  async function usageEventsAllowedInThisBrowser(): Promise<boolean> {
    return usageEventsAllowed({
      browser: import.meta.env.BROWSER,
      dataCollection: await grantedDataCollection(),
    })
  }

  async function settle(event: ExtensionEvent): Promise<Settled> {
    return usageEventSettled({
      event,
      browser: import.meta.env.BROWSER,
      dataCollection: await grantedDataCollection(),
      sendEvent: productApi.sendEvent,
    })
  }

  const installEvent = heldInstallEvent({
    hold: indexedDbInstallHold(globalThis.indexedDB),
    usageEventsAllowed: usageEventsAllowedInThisBrowser,
    sendEvent: productApi.sendEvent,
  })

  // Registered as the background starts, or Chrome's service worker misses the install event.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    void firstRunOnInstalled({
      reason,
      openFirstRun: () => browser.tabs.create({ url: browser.runtime.getURL('/first-run.html') }),
      readChannels: productApi.readChannels,
      installEvent,
    })
  })

  // The types name the toolbar request in every browser, but only Chrome 133 and later have it.
  const { addHostAccessRequest } = browser.permissions as {
    addHostAccessRequest?: AddHostAccessRequest
  }
  const hostAccess = hostAccessOf({
    manifest: browser.runtime.getManifest(),
    permissions: browser.permissions,
  })
  const youtubeAccess = youtubeAccessOf({ permissions: browser.permissions })
  const answer = backgroundAnswerer({
    productApi,
    hostAccess: hostAccess.granted,
    youtubeAccess: youtubeAccess.granted,
    settle,
    installEvent,
  })

  void watchWithheldHostAccess({
    addHostAccessRequest: addHostAccessRequest?.bind(browser.permissions),
    hostAccess: hostAccess.granted,
    openTabIds: async () => (await browser.tabs.query({})).flatMap((tab) => tab.id ?? []),
    // Complete comes after the navigation commits, so Chrome's reset of a request on a cross-origin
    // navigation cannot clear this one.
    onTabLoaded: (listener) =>
      browser.tabs.onUpdated.addListener((tabId, { status }) => {
        if (status === 'complete') void listener(tabId)
      }),
    onHostAccessRemoved: (listener) =>
      browser.permissions.onRemoved.addListener(() => {
        void listener()
      }),
  })

  // A YouTube access removal also reaches the withheld host access watch above, which finds the
  // required hosts still granted and asks for nothing.
  void keepYouTubeAccessInStep({
    access: youtubeAccess,
    scripting: {
      registerContentScripts: (scripts) => browser.scripting.registerContentScripts(scripts),
      unregisterContentScripts: (filter) => browser.scripting.unregisterContentScripts(filter),
      getRegisteredContentScripts: (filter) =>
        browser.scripting.getRegisteredContentScripts(filter),
      // WXT types `files` as its public paths, each with a leading slash. Chrome's scripting
      // reference gives the path relative to the extension's root, as the registration's `js` is.
      executeScript: ({ target, files }) =>
        browser.scripting.executeScript({ target, files: files as ScriptPublicPath[] }),
    },
    // With YouTube access granted, the background may read those tabs' URLs with no `tabs`
    // permission.
    openYouTubeTabIds: async () =>
      (await browser.tabs.query({ url: youtubeOrigins })).flatMap((tab) => tab.id ?? []),
    // Without the grant the background cannot query tabs by URL, so it tells every tab; the ids
    // need no `tabs` permission.
    tellOpenTabs: tellEveryTab({
      tabIds: async () => (await browser.tabs.query({})).flatMap((tab) => tab.id ?? []),
      sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
    }),
    onAccessAdded: (listener) => browser.permissions.onAdded.addListener(listener),
    onAccessRemoved: (listener) => browser.permissions.onRemoved.addListener(listener),
    settle,
  })

  browser.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
    // A www.youtube.com tab is answered only while YouTube access is granted.
    answer(request, { url: sender.url }).then(sendResponse)
    // Holds the message channel open for the answer, which both Chrome and Firefox accept.
    return true
  })
})
