import { productOrigin, retentionAndSharingLines } from '@creator-analytics/api-types'
import type { Browser } from 'wxt/browser'
import { element, newTabLink } from './dom.ts'
import type { HeldInstallEvent } from './held-install.ts'
import type { ChannelsRead } from './product-api.ts'

// The page's own text is approved word for word in creator-analytics#97, #202 and #485. Change it
// only with Nick.
const firstRunText = {
  heading: 'Stillstats in YouTube Studio',
  paragraphs: [
    'The extension shows your engaged views beside the numbers YouTube Studio shows.',
    'On studio.youtube.com it reads the channel and video ids on the page you have open, and the period you select. It never reads the numbers on the page.',
    'If you turn on "Show engaged views on youtube.com" in the popup, it also reads the links to videos and channels on www.youtube.com, and the page address. It asks stillstats.com for your own videos\' numbers and matches them in your browser, so no video id from www.youtube.com leaves it. It reads nothing on any other site.',
    "It sends stillstats.com the video ids and the period, for the channel you connected, and stillstats.com answers with your numbers from YouTube's official API.",
    'It sends a few usage events to stillstats.com, with no ids, names or email in them. In Firefox, it sends them only if you allow it, and you can change that in about:addons.',
  ],
  privacyPolicy: 'Read the privacy policy',
  done: 'Got it',
} as const

// stillstats.com even in a development build, which calls the local API: the policy a creator
// reads is the published one.
const privacyPolicyUrl = `${productOrigin}/privacy`

/**
 * Called from `runtime.onInstalled`, which also fires when the extension or the browser updates.
 * The page opens before anything is read, so a slow or failed read never holds back the
 * disclosure. A failed page open does not stop the event. The install's channels read goes to
 * `installEvent`, which sends `extension_installed` on a signed-in read and holds it otherwise,
 * a read that rejects or throws included, for a later read to send. With usage events declined, as
 * Firefox lets a creator choose at install, the read still runs and the event is held: the hold
 * sends only once they are allowed (creator-analytics#126). It never rejects:
 * `background.ts` runs it under `void`, so a failed browser call is caught here.
 */
export async function firstRunOnInstalled({
  reason,
  openFirstRun,
  readChannels,
  installEvent,
}: {
  reason: Browser.runtime.InstalledDetails['reason']
  openFirstRun: () => Promise<unknown>
  readChannels: () => Promise<ChannelsRead>
  installEvent: Pick<HeldInstallEvent, 'installRead'>
}): Promise<void> {
  if (reason !== 'install') return
  try {
    await openFirstRun()
  } catch {
    // The event below does not depend on the page.
  }
  const read = await Promise.resolve()
    .then(readChannels)
    .catch((): ChannelsRead => ({ state: 'failed' }))
  await installEvent.installRead(read)
}

/**
 * "Got it" closes the page's own tab through `tabs`, which needs no `tabs` permission in Chrome or
 * Firefox. A failed `getCurrent` or `remove` leaves the page open.
 */
export function renderFirstRun({
  document,
  root,
  tabs,
}: {
  document: Document
  root: HTMLElement
  /** `browser.tabs`, or the fake a test passes. */
  tabs: {
    getCurrent: () => Promise<{ id?: number | undefined } | undefined>
    remove: (tabId: number) => Promise<void>
  }
}): void {
  async function closeOwnTab(): Promise<void> {
    try {
      const tab = await tabs.getCurrent()
      if (tab?.id !== undefined) await tabs.remove(tab.id)
    } catch {
      // The creator can still close the tab.
    }
  }

  const button = element(document, 'button', { text: firstRunText.done, className: 'button' })
  button.addEventListener('click', () => {
    void closeOwnTab()
  })

  root.replaceChildren(
    element(document, 'h1', { text: firstRunText.heading }),
    ...[...firstRunText.paragraphs, ...retentionAndSharingLines].map((line) =>
      element(document, 'p', { text: line }),
    ),
    newTabLink(document, { text: firstRunText.privacyPolicy, href: privacyPolicyUrl }),
    button,
  )
}
