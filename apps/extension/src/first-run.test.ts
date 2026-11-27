// @vitest-environment jsdom
// Limits: the fakes stand in for the browser, so these tests cannot show Chrome or Firefox firing
// `runtime.onInstalled`, the first-run tab opening, the privacy link opening a new tab, or Firefox
// reporting the install-time data consent through `permissions.getAll()` inside `onInstalled`.
// jsdom applies no stylesheet, so the page's layout is not seen here either.
// creator-analytics#99 and #101 check those in both browsers by hand. The tests that a failed
// browser call or read leaves no unhandled rejection fire the install handler and the "Got it"
// click unawaited, as `background.ts` does under `void` and the browser does with a click, and
// check Node's `unhandledRejection` before they await, so they see a rejection the way the
// background or the page would, not as a throw into the test.
import { type ExtensionEvent, retentionAndSharingLines } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { Browser } from 'wxt/browser'
import { firstRunOnInstalled, renderFirstRun } from './first-run.ts'
import { heldInstallEvent } from './held-install.ts'
import type { ChannelsRead } from './product-api.ts'
import { failureModes, memoryHold, nextTask, signedIn } from './testing.ts'

type InstallSteps = Pick<
  Parameters<typeof firstRunOnInstalled>[0],
  'openFirstRun' | 'readChannels'
> &
  Pick<Parameters<typeof heldInstallEvent>[0], 'usageEventsAllowed' | 'sendEvent'>

/**
 * Runs the install handler against fakes that record what it did. A step named in `fail` replaces
 * that fake, so the step fails; a failing `readChannels` or `sendEvent` is still counted. `later`
 * is the same background's install event, for the reads after the install.
 */
function startInstall({
  reason,
  read = () => Promise.resolve(signedIn),
  allowed = async () => true,
  fail = {},
}: {
  reason: Browser.runtime.InstalledDetails['reason']
  read?: () => Promise<ChannelsRead>
  /** Whether usage events are allowed each time it is asked, as Firefox's consent can change. */
  allowed?: () => Promise<boolean>
  fail?: Partial<InstallSteps>
}) {
  const seen = { pagesOpened: 0, channelReads: 0, events: [] as ExtensionEvent[] }
  const usageEventsAllowed = fail.usageEventsAllowed ?? allowed
  const later = heldInstallEvent({
    hold: memoryHold(),
    usageEventsAllowed,
    sendEvent: (event) => {
      seen.events.push(event)
      return fail.sendEvent ? fail.sendEvent(event) : Promise.resolve(true)
    },
  })
  const done = firstRunOnInstalled({
    reason,
    openFirstRun:
      fail.openFirstRun ??
      (async () => {
        seen.pagesOpened += 1
      }),
    readChannels: () => {
      seen.channelReads += 1
      return (fail.readChannels ?? read)()
    },
    installEvent: later,
  })
  return { seen, done, later }
}

async function installed(options: Parameters<typeof startInstall>[0]) {
  const { seen, done } = startInstall(options)
  await done
  return seen
}

/** Installs, then makes one signed-in read through the same background, and answers what it saw. */
async function installedThenSignedIn(options: Parameters<typeof startInstall>[0]) {
  const { seen, done, later } = startInstall(options)
  await done
  await later.sendOn(signedIn)
  return seen
}

/**
 * Fires the install handler under `void`, as `background.ts` does, and settles before anything
 * awaits it, so a rejection shows in `unhandled` rather than as a throw into the test.
 */
async function firedInstall(options: Parameters<typeof startInstall>[0]) {
  const { seen, done } = startInstall(options)
  void done
  await nextTask()
  return { seen, unhandled: [...unhandled], done }
}

let unhandled: unknown[]
const recordUnhandled = (reason: unknown) => unhandled.push(reason)

beforeEach(() => {
  unhandled = []
  process.on('unhandledRejection', recordUnhandled)
})

afterEach(() => {
  process.off('unhandledRejection', recordUnhandled)
})

const installSteps = ['openFirstRun', 'usageEventsAllowed', 'readChannels', 'sendEvent'] as const

describe('the first-run page opens on install only', () => {
  test('installing opens the first-run page once', async () => {
    expect((await installed({ reason: 'install' })).pagesOpened).toBe(1)
  })

  test.each(['update', 'chrome_update', 'shared_module_update'] as const)(
    'an onInstalled for %s opens nothing, reads nothing, and holds nothing for a later signed-in read',
    async (reason) => {
      expect(
        await installedThenSignedIn({ reason, read: async () => ({ state: 'signed-out' }) }),
      ).toEqual({
        pagesOpened: 0,
        channelReads: 0,
        events: [],
      })
    },
  )
})

describe('an install sends extension_installed once it reads the creator signed in', () => {
  test('a signed-in install sends extension_installed at once and holds nothing', async () => {
    expect((await installedThenSignedIn({ reason: 'install' })).events).toEqual([
      { name: 'extension_installed' },
    ])
  })

  test('a signed-out install sends nothing, then extension_installed on the next signed-in read', async () => {
    const { seen, done, later } = startInstall({
      reason: 'install',
      read: () => Promise.resolve<ChannelsRead>({ state: 'signed-out' }),
    })
    await done
    expect(seen.events).toEqual([])

    await later.sendOn(signedIn)
    expect(seen.events).toEqual([{ name: 'extension_installed' }])
  })

  test('an install whose channel read fails holds the event the same way', async () => {
    // Withheld host access and a dropped request both read as failed.
    const read = () => Promise.resolve<ChannelsRead>({ state: 'failed' })

    expect((await installedThenSignedIn({ reason: 'install', read })).events).toEqual([
      { name: 'extension_installed' },
    ])
  })

  test.each(failureModes)(
    'an install whose channel read %s holds the event the same way',
    async (_mode, failure) => {
      expect(
        (await installedThenSignedIn({ reason: 'install', fail: { readChannels: failure } }))
          .events,
      ).toEqual([{ name: 'extension_installed' }])
    },
  )

  test('a Firefox install with usage events declined holds the event, sends nothing while they stay declined, and sends it once on the next signed-in read once they are allowed', async () => {
    let allowedNow = false
    const { seen, done, later } = startInstall({
      reason: 'install',
      allowed: async () => allowedNow,
    })
    await done
    expect({ pagesOpened: seen.pagesOpened, events: seen.events }).toEqual({
      pagesOpened: 1,
      events: [],
    })

    await later.sendOn(signedIn)
    expect(seen.events).toEqual([])

    allowedNow = true
    await later.sendOn(signedIn)
    await later.sendOn(signedIn)
    expect(seen.events).toEqual([{ name: 'extension_installed' }])
  })
})

test('an install opens the first-run page even while the channel read never answers', async () => {
  let opened = false
  void firstRunOnInstalled({
    reason: 'install',
    openFirstRun: async () => {
      opened = true
    },
    readChannels: () => new Promise<ChannelsRead>(() => {}),
    installEvent: { installRead: async () => {} },
  })
  await nextTask()

  expect(opened).toBe(true)
})

describe.each(failureModes)('an install step that %s', (_mode, failure) => {
  test.each(installSteps)('a failing %s leaves no unhandled rejection', async (step) => {
    const fired = await firedInstall({ reason: 'install', fail: { [step]: failure } })

    expect(fired.unhandled).toEqual([])
    await expect(fired.done).resolves.toBeUndefined()
  })

  test('a failing openFirstRun still sends extension_installed for a signed-in install', async () => {
    const fired = await firedInstall({ reason: 'install', fail: { openFirstRun: failure } })

    expect({
      unhandled: fired.unhandled,
      channelReads: fired.seen.channelReads,
      events: fired.seen.events,
    }).toEqual({
      unhandled: [],
      channelReads: 1,
      events: [{ name: 'extension_installed' }],
    })
  })
})

type Tabs = Parameters<typeof renderFirstRun>[0]['tabs']

/** A fake `browser.tabs` whose current tab is the first-run page's, with id `pageTabId`. */
const pageTabId = 7

function fakeTabs(overrides: Partial<Tabs> = {}) {
  const removed: number[] = []
  const tabs: Tabs = {
    getCurrent: overrides.getCurrent ?? (async () => ({ id: pageTabId })),
    remove:
      overrides.remove ??
      (async (tabId) => {
        removed.push(tabId)
      }),
  }
  return { tabs, removed }
}

function firstRunPage({ tabs = fakeTabs().tabs }: { tabs?: Tabs } = {}): HTMLElement {
  const main = document.createElement('main')
  document.body.replaceChildren(main)
  renderFirstRun({ document, root: main, tabs })
  return main
}

describe('the first-run page', () => {
  // The copy Nick approved word for word on creator-analytics#97, #202 and #485.
  test('says what the extension reads on Studio, then on www.youtube.com once YouTube access is on, before the shared lines (creator-analytics#485)', () => {
    const paragraphs = [...firstRunPage().querySelectorAll('p')].map((p) => p.textContent)

    expect(paragraphs.slice(0, -retentionAndSharingLines.length)).toEqual([
      'The extension shows your engaged views beside the numbers YouTube Studio shows.',
      'On studio.youtube.com it reads the channel and video ids on the page you have open, and the period you select. It never reads the numbers on the page.',
      'If you turn on "Show engaged views on youtube.com" in the popup, it also reads the links to videos and channels on www.youtube.com, and the page address. It asks stillstats.com for your own videos\' numbers and matches them in your browser, so no video id from www.youtube.com leaves it. It reads nothing on any other site.',
      "It sends stillstats.com the video ids and the period, for the channel you connected, and stillstats.com answers with your numbers from YouTube's official API.",
      'It sends a few usage events to stillstats.com, with no ids, names or email in them. In Firefox, it sends them only if you allow it, and you can change that in about:addons.',
    ])
  })

  test("ends with the web app's shared lines on refresh, storage, deletion and sharing, in order (creator-analytics#56)", () => {
    const paragraphs = [...firstRunPage().querySelectorAll('p')].map((p) => p.textContent)

    expect(paragraphs.slice(-retentionAndSharingLines.length)).toEqual([
      ...retentionAndSharingLines,
    ])
  })

  test("links to the marketing site's privacy policy in a new tab", () => {
    const link = firstRunPage().querySelector('a')

    expect({
      href: link?.href,
      target: link?.target,
      rel: link?.rel,
    }).toEqual({
      href: 'https://stillstats.com/privacy',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  test('"Got it" closes the first-run page', async () => {
    const { tabs, removed } = fakeTabs()
    const button = firstRunPage({ tabs }).querySelector('button')

    button?.click()
    await nextTask()

    expect(removed).toEqual([pageTabId])
  })
})

describe.each(failureModes)('"Got it" when a tabs call %s', (_mode, failure) => {
  test('a failing tabs.getCurrent leaves no unhandled rejection and removes nothing', async () => {
    const { tabs, removed } = fakeTabs({ getCurrent: failure })
    firstRunPage({ tabs }).querySelector('button')?.click()
    await nextTask()

    expect({ unhandled, removed }).toEqual({ unhandled: [], removed: [] })
  })

  test('a failing tabs.remove leaves no unhandled rejection', async () => {
    const { tabs } = fakeTabs({ remove: failure })
    firstRunPage({ tabs }).querySelector('button')?.click()
    await nextTask()

    expect(unhandled).toEqual([])
  })
})
