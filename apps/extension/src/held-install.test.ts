// Limits: the hold here is a fake store in memory, shared between two `heldInstallEvent`s to stand
// in for a background that went idle or a browser that restarted. These tests cannot show that
// IndexedDB keeps the hold through either in Chrome's service worker or Firefox's event page;
// creator-analytics#99 checks that by hand in both browsers.
import type { ExtensionEvent, VideoListAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { type HeldInstallEvent, heldInstallEvent, type InstallHold } from './held-install.ts'
import type { ChannelsRead, VideosRead } from './product-api.ts'
import { failureModes, memoryHold, nextTask, signedIn } from './testing.ts'

const installed: ExtensionEvent = { name: 'extension_installed' }

/**
 * A background's install event over `hold`, recording every event handed to the product API. Each
 * call is one background: a second call on the same hold is the background after an idle stop or a
 * browser restart.
 */
function background({
  hold,
  allowed = async () => true,
  accepted = async () => true,
}: {
  hold: InstallHold
  allowed?: () => Promise<boolean>
  accepted?: (event: ExtensionEvent) => Promise<boolean>
}): { event: HeldInstallEvent; sent: ExtensionEvent[] } {
  const sent: ExtensionEvent[] = []
  const event = heldInstallEvent({
    hold,
    usageEventsAllowed: allowed,
    sendEvent: (event) => {
      sent.push(event)
      return accepted(event)
    },
  })
  return { event, sent }
}

describe('a held install', () => {
  test('a signed-out install read holds the event, and a later signed-in read sends extension_installed once', async () => {
    const { event, sent } = background({ hold: memoryHold() })

    await event.installRead({ state: 'signed-out' })
    expect(sent).toEqual([])

    await event.sendOn(signedIn)
    expect(sent).toEqual([installed])
  })

  test('a failed install read holds the event the same way', async () => {
    const { event, sent } = background({ hold: memoryHold() })

    await event.installRead({ state: 'failed' })
    expect(sent).toEqual([])

    await event.sendOn(signedIn)
    expect(sent).toEqual([installed])
  })

  test('a signed-in install read sends at once and holds nothing', async () => {
    const { event, sent } = background({ hold: memoryHold() })

    await event.installRead(signedIn)
    await event.sendOn(signedIn)

    expect(sent).toEqual([installed])
  })

  // The product API's client answers false when the relay refuses the event or does not answer it
  // within `apiAnswerWithinMs`.
  test('a signed-in install read whose send is not accepted holds the event for the next signed-in read', async () => {
    const hold = memoryHold()
    await background({ hold, accepted: async () => false }).event.installRead(signedIn)

    const { event, sent } = background({ hold })
    await event.sendOn(signedIn)

    expect(sent).toEqual([installed])
  })
})

/** A hold left by a signed-out install, as the next read through the background finds it. */
async function heldBySignedOutInstall(): Promise<InstallHold> {
  const hold = memoryHold()
  await background({ hold }).event.installRead({ state: 'signed-out' })
  return hold
}

describe('sending a held install', () => {
  test('with usage events not allowed at send time, nothing is sent and the hold stays', async () => {
    const hold = await heldBySignedOutInstall()

    const declined = background({ hold, allowed: async () => false })
    await declined.event.sendOn(signedIn)
    expect(declined.sent).toEqual([])

    const allowed = background({ hold })
    await allowed.event.sendOn(signedIn)
    expect(allowed.sent).toEqual([installed])
  })

  test('a send that is not accepted keeps the hold, and the next signed-in read retries it', async () => {
    const hold = await heldBySignedOutInstall()
    const answers = [false, true]
    const { event, sent } = background({ hold, accepted: async () => answers.shift() ?? true })

    await event.sendOn(signedIn)
    await event.sendOn(signedIn)
    await event.sendOn(signedIn)

    expect(sent).toEqual([installed, installed])
  })

  // `sendEvent` is the product API client's, which answers within `apiAnswerWithinMs`, so a send
  // that is never answered is one whose background stopped first.
  test('a send that is never answered keeps the hold for the next background', async () => {
    const hold = await heldBySignedOutInstall()
    void background({ hold, accepted: () => new Promise<boolean>(() => {}) }).event.sendOn(signedIn)
    await nextTask()

    const { event, sent } = background({ hold })
    await event.sendOn(signedIn)

    expect(sent).toEqual([installed])
  })

  test.each(failureModes)(
    'a send or consent check that %s keeps the hold, and the read goes on',
    async (_mode, failure) => {
      const hold = await heldBySignedOutInstall()

      await expect(background({ hold, accepted: failure }).event.sendOn(signedIn)).resolves.toBe(
        undefined,
      )
      await expect(background({ hold, allowed: failure }).event.sendOn(signedIn)).resolves.toBe(
        undefined,
      )

      const { event, sent } = background({ hold })
      await event.sendOn(signedIn)
      expect(sent).toEqual([installed])
    },
  )
})

describe('one event per install', () => {
  test('two signed-in reads after one held install send exactly one event', async () => {
    const { event, sent } = background({ hold: await heldBySignedOutInstall() })

    await event.sendOn(signedIn)
    await event.sendOn(signedIn)

    expect(sent).toEqual([installed])
  })

  // The card and the Content list ask the background together, and the popup can open meanwhile.
  test('two signed-in reads that land together send exactly one event', async () => {
    const { event, sent } = background({ hold: await heldBySignedOutInstall() })

    await Promise.all([event.sendOn(signedIn), event.sendOn(signedIn)])

    expect(sent).toEqual([installed])
  })
})

describe.each(failureModes)('a hold whose store %s', (_mode, failure) => {
  test('a signed-in install still sends extension_installed at once', async () => {
    const { event, sent } = background({ hold: { held: failure, hold: failure, release: failure } })

    await event.installRead(signedIn)

    expect(sent).toEqual([installed])
  })

  test('a signed-out install the store cannot hold is never sent', async () => {
    const { event, sent } = background({ hold: { held: failure, hold: failure, release: failure } })

    await event.installRead({ state: 'signed-out' })
    await event.sendOn(signedIn)

    expect(sent).toEqual([])
  })

  test('a held install the store cannot read is not sent, and the read after it reads again sends it once', async () => {
    const kept = await heldBySignedOutInstall()
    let readable = false
    const { event, sent } = background({
      hold: { ...kept, held: () => (readable ? kept.held() : failure()) },
    })

    await event.sendOn(signedIn)
    expect(sent).toEqual([])

    readable = true
    await event.sendOn(signedIn)
    await event.sendOn(signedIn)
    expect(sent).toEqual([installed])
  })
})

describe('which reads send a held install', () => {
  const answer: VideoListAnswer = {
    videos: [],
    window: 'lifetime',
    page: 1,
    pageSize: 1,
    pageCount: 0,
    revenue: { refusal: 'consent_missing' },
    fetchedAt: '2026-10-16T12:00:00Z',
    fromCache: false,
    lastProcessedDay: '2026-10-12',
    creationDay: '2020-01-01',
  }

  // Each needed the creator's session: the API answers a signed-out read 401.
  const signedInReads: [string, VideosRead][] = [
    ["a surface's videos read", { state: 'read', channelId: 'c1', answer }],
    ['a read of a channel not in Stillstats', { state: 'channel-not-in-stillstats' }],
    ['a refused read', { state: 'refused', refusal: 'not_connected' }],
  ]

  test.each(signedInReads)('%s sends it', async (_, read) => {
    const { event, sent } = background({ hold: await heldBySignedOutInstall() })

    await event.sendOn(read)

    expect(sent).toEqual([installed])
  })

  // A failed read says nothing about the session, and the background answers withheld host access
  // to stillstats.com without asking the API.
  const readsThatSayNothing: [string, ChannelsRead | VideosRead][] = [
    ['a signed-out channels read', { state: 'signed-out' }],
    ['a failed channels read', { state: 'failed' }],
    ['a signed-out videos read', { state: 'signed-out' }],
    ['a failed videos read', { state: 'failed' }],
    ['a videos read with host access withheld', { state: 'host-access-withheld' }],
  ]

  test.each(readsThatSayNothing)('%s sends nothing and keeps the hold', async (_, read) => {
    const hold = await heldBySignedOutInstall()
    const first = background({ hold })
    await first.event.sendOn(read)
    expect(first.sent).toEqual([])

    const { event, sent } = background({ hold })
    await event.sendOn(signedIn)
    expect(sent).toEqual([installed])
  })
})
