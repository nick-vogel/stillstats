import type { ExtensionEvent } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { backgroundAnswerer } from './background-answer.ts'
import { heldInstallEvent } from './held-install.ts'
import type { BackgroundRequest } from './messages.ts'
import type { ChannelsRead, UploadsRead, VideosQuery } from './product-api.ts'
import { memoryHold, nextTask, signedIn } from './testing.ts'

// Limits: `hostAccess` and `youtubeAccess` stand in for `permissions.contains`, so these tests
// cannot see Chrome's or Firefox's real answer or their site access settings, and the sender stands
// in for the `MessageSender` the browser hands the background. creator-analytics#99 checks the
// access line by hand in both browsers, and creator-analytics#143 walks the YouTube access removal.

const videosRequest = {
  type: 'read-videos',
  youtubeChannelId: 'UC123',
  ids: ['NDha0z6zDA8'],
  window: 'lifetime',
} as const satisfies BackgroundRequest

/** A public page's read of a held channel's uploads. */
const uploadsRequest = {
  type: 'read-uploads',
  youtubeChannelId: 'UC123',
} as const satisfies BackgroundRequest

/** The uploads the product API answers in these tests. */
const uploadsRead = {
  state: 'read',
  channelId: 'channel-1',
  videos: [],
  lastProcessedDay: '2026-10-07',
  fromCache: false,
} as const satisfies UploadsRead

/** The popup's sender, an extension page. */
const popup = { url: 'chrome-extension://stillstats-test/popup.html' }
/** A Studio surface's sender. */
const studioTab = { url: 'https://studio.youtube.com/channel/UC123/videos' }

/** A public page surface's sender. */
const youtubeTab = { url: 'https://www.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/videos' }

/** An install event with nothing held, for the tests about other requests. */
const nothingHeld = { sendOn: async () => {} }

test('a usage-event request settles the event it carries', async () => {
  const settled: ExtensionEvent[] = []
  const answer = backgroundAnswerer({
    productApi: {
      readChannels: async () => ({ state: 'signed-out' }),
      readVideos: async () => ({ state: 'signed-out' }),
      readUploads: async () => ({ state: 'signed-out' }),
    },
    hostAccess: async () => true,
    youtubeAccess: async () => true,
    settle: async (event) => {
      settled.push(event)
      return true
    },
    installEvent: nothingHeld,
  })

  const shown = {
    name: 'extension_surface_shown',
    surface: 'content_list',
    ms: 1200,
    fromCache: false,
  } as const
  const answered = await answer(
    { type: 'usage-event', event: { name: 'extension_popup_web_app_opened' } },
    popup,
  )
  const shownAnswered = await answer({ type: 'usage-event', event: shown }, studioTab)

  expect(answered).toBe(true)
  expect(shownAnswered).toBe(true)
  expect(settled).toEqual([{ name: 'extension_popup_web_app_opened' }, shown])
})

describe('a request whose answer rejects still gets its failed answer, so no asker waits on it', () => {
  const rejected = () => Promise.reject(new Error('Cannot read properties of undefined'))
  const answer = backgroundAnswerer({
    productApi: { readChannels: rejected, readVideos: rejected, readUploads: rejected },
    hostAccess: async () => true,
    youtubeAccess: rejected,
    settle: rejected,
    installEvent: nothingHeld,
  })

  const failures: [BackgroundRequest['type'], BackgroundRequest, unknown][] = [
    ['read-channels', { type: 'read-channels' }, { state: 'failed' }],
    [
      'read-videos',
      { type: 'read-videos', youtubeChannelId: 'UC123', ids: ['NDha0z6zDA8'], window: 'lifetime' },
      { state: 'failed' },
    ],
    ['read-uploads', uploadsRequest, { state: 'failed' }],
    ['usage-event', { type: 'usage-event', event: { name: 'extension_installed' } }, false],
    ['youtube-access', { type: 'youtube-access' }, false],
  ]

  test.each(failures)('%s answers its failed value', async (_, request, failed) => {
    expect(await answer(request, popup)).toEqual(failed)
  })
})

describe('the access line state', () => {
  test('with host access to stillstats.com withheld, a videos read answers that access is withheld and asks the API nothing', async () => {
    const asked: VideosQuery[] = []
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => ({ state: 'signed-out' }),
        readVideos: async (query) => {
          asked.push(query)
          return { state: 'signed-out' }
        },
        readUploads: async () => uploadsRead,
      },
      hostAccess: async () => false,
      youtubeAccess: async () => true,
      settle: async () => true,
      installEvent: nothingHeld,
    })

    expect(await answer(videosRequest, studioTab)).toEqual({ state: 'host-access-withheld' })
    expect(asked).toEqual([])
  })

  test('with host access to stillstats.com withheld, an uploads read answers that access is withheld and asks the API nothing', async () => {
    const asked: string[] = []
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => ({ state: 'signed-out' }),
        readVideos: async () => ({ state: 'signed-out' }),
        readUploads: async (youtubeChannelId) => {
          asked.push(youtubeChannelId)
          return uploadsRead
        },
      },
      hostAccess: async () => false,
      youtubeAccess: async () => true,
      settle: async () => true,
      installEvent: nothingHeld,
    })

    expect(await answer(uploadsRequest, youtubeTab)).toEqual({ state: 'host-access-withheld' })
    expect(asked).toEqual([])
  })

  test('with host access granted and no session, a videos read answers signed out', async () => {
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => ({ state: 'signed-out' }),
        readVideos: async () => ({ state: 'signed-out' }),
        readUploads: async () => ({ state: 'signed-out' }),
      },
      hostAccess: async () => true,
      youtubeAccess: async () => true,
      settle: async () => true,
      installEvent: nothingHeld,
    })

    expect(await answer(videosRequest, studioTab)).toEqual({ state: 'signed-out' })
  })

  test('a host access check that rejects answers a failed read, which says nothing about access', async () => {
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => ({ state: 'signed-out' }),
        readVideos: async () => ({ state: 'signed-out' }),
        readUploads: async () => ({ state: 'signed-out' }),
      },
      hostAccess: () => Promise.reject(new Error('No permission data')),
      youtubeAccess: async () => true,
      settle: async () => true,
      installEvent: nothingHeld,
    })

    expect(await answer(videosRequest, studioTab)).toEqual({ state: 'failed' })
  })
})

describe('a held install event', () => {
  /** A background whose signed-out install left `extension_installed` held. */
  async function backgroundWithHeldInstall({
    read,
    accepted = async () => true,
    hostAccess = async () => true,
  }: {
    read: ChannelsRead
    accepted?: () => Promise<boolean>
    hostAccess?: () => Promise<boolean>
  }) {
    const sent: ExtensionEvent[] = []
    const installEvent = heldInstallEvent({
      hold: memoryHold(),
      usageEventsAllowed: async () => true,
      sendEvent: (event) => {
        sent.push(event)
        return accepted()
      },
    })
    await installEvent.installRead({ state: 'signed-out' })
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => read,
        readVideos: async () => ({ state: 'refused', refusal: 'not_connected' }),
        readUploads: async () => uploadsRead,
      },
      hostAccess,
      youtubeAccess: async () => true,
      settle: async () => true,
      installEvent,
    })
    return { answer, sent }
  }

  test("a popup's signed-in channels read sends it", async () => {
    const { answer, sent } = await backgroundWithHeldInstall({ read: signedIn })

    await answer({ type: 'read-channels' }, popup)
    await nextTask()

    expect(sent).toEqual([{ name: 'extension_installed' }])
  })

  test("a surface's videos read that needed the session sends it", async () => {
    const { answer, sent } = await backgroundWithHeldInstall({ read: signedIn })

    await answer(videosRequest, studioTab)
    await nextTask()

    expect(sent).toEqual([{ name: 'extension_installed' }])
  })

  test("a public page's uploads read that needed the session sends it", async () => {
    const { answer, sent } = await backgroundWithHeldInstall({ read: signedIn })

    await answer(uploadsRequest, youtubeTab)
    await nextTask()

    expect(sent).toEqual([{ name: 'extension_installed' }])
  })

  test("a surface's read with host access to stillstats.com withheld sends nothing", async () => {
    const { answer, sent } = await backgroundWithHeldInstall({
      read: signedIn,
      hostAccess: async () => false,
    })

    await answer(videosRequest, studioTab)
    await nextTask()

    expect(sent).toEqual([])
  })

  test('a read answers without waiting for the held send', async () => {
    const { answer } = await backgroundWithHeldInstall({
      read: signedIn,
      accepted: () => new Promise<boolean>(() => {}),
    })

    expect(await answer({ type: 'read-channels' }, popup)).toEqual(signedIn)
  })
})

describe('a www.youtube.com tab is answered only while YouTube access is granted', () => {
  const usageEvent = {
    type: 'usage-event',
    event: { name: 'extension_surface_shown', surface: 'channel_page', ms: 4300, fromCache: true },
  } as const satisfies BackgroundRequest

  /** A background whose product API records each read, YouTube access `granted` or not. */
  async function backgroundWith(youtubeAccess: () => Promise<boolean>) {
    const asked: string[] = []
    const settled: ExtensionEvent[] = []
    const sent: ExtensionEvent[] = []
    const installEvent = heldInstallEvent({
      hold: memoryHold(),
      usageEventsAllowed: async () => true,
      sendEvent: async (event) => {
        sent.push(event)
        return true
      },
    })
    await installEvent.installRead({ state: 'signed-out' })
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => {
          asked.push('read-channels')
          return signedIn
        },
        readVideos: async () => {
          asked.push('read-videos')
          return { state: 'signed-out' }
        },
        readUploads: async () => {
          asked.push('read-uploads')
          return uploadsRead
        },
      },
      hostAccess: async () => true,
      youtubeAccess,
      settle: async (event) => {
        settled.push(event)
        return true
      },
      installEvent,
    })
    return { answer, asked, settled, sent }
  }

  test('with YouTube access removed, an uploads, a videos and a channels read from www.youtube.com answer failed and ask the API nothing', async () => {
    const { answer, asked, sent } = await backgroundWith(async () => false)

    expect(await answer(uploadsRequest, youtubeTab)).toEqual({ state: 'failed' })
    expect(await answer(videosRequest, youtubeTab)).toEqual({ state: 'failed' })
    expect(await answer({ type: 'read-channels' }, youtubeTab)).toEqual({ state: 'failed' })
    await nextTask()

    expect(asked).toEqual([])
    expect(sent).toEqual([])
  })

  test('with YouTube access removed, a usage event from www.youtube.com is not settled', async () => {
    const { answer, settled } = await backgroundWith(async () => false)

    expect(await answer(usageEvent, youtubeTab)).toBe(false)

    expect(settled).toEqual([])
  })

  test('with YouTube access granted, the uploads and channels reads and usage events from www.youtube.com reach the API', async () => {
    const { answer, asked, settled } = await backgroundWith(async () => true)

    expect(await answer(uploadsRequest, youtubeTab)).toEqual(uploadsRead)
    expect(await answer({ type: 'read-channels' }, youtubeTab)).toEqual(signedIn)
    expect(await answer(usageEvent, youtubeTab)).toBe(true)

    expect(asked).toEqual(['read-uploads', 'read-channels'])
    expect(settled).toEqual([usageEvent.event])
  })

  test('with YouTube access granted, a videos read from www.youtube.com answers failed and never reaches the API: a public page sends no id', async () => {
    const { answer, asked, sent } = await backgroundWith(async () => true)

    expect(await answer(videosRequest, youtubeTab)).toEqual({ state: 'failed' })
    await nextTask()

    expect(asked).toEqual([])
    expect(sent).toEqual([])
  })

  test('a studio.youtube.com tab and the popup still read videos with YouTube access granted', async () => {
    const { answer, asked } = await backgroundWith(async () => true)

    expect(await answer(videosRequest, studioTab)).toEqual({ state: 'signed-out' })
    expect(await answer(videosRequest, popup)).toEqual({ state: 'signed-out' })

    expect(asked).toEqual(['read-videos', 'read-videos'])
  })

  test.each([
    ['a studio.youtube.com tab', studioTab],
    ['the popup, with no sender URL', {}],
    ['a sender URL that does not parse', { url: 'not a url' }],
  ])('with YouTube access removed, %s is answered as before', async (_, sender) => {
    const { answer, asked } = await backgroundWith(async () => false)

    expect(await answer(videosRequest, sender)).toEqual({ state: 'signed-out' })
    expect(await answer({ type: 'read-channels' }, sender)).toEqual(signedIn)

    expect(asked).toEqual(['read-videos', 'read-channels'])
  })

  test('a www.youtube.com tab that asks whether YouTube access is granted hears true while it is and false once it is removed, and nothing reaches the API', async () => {
    const granted = await backgroundWith(async () => true)
    const removed = await backgroundWith(async () => false)

    expect(await granted.answer({ type: 'youtube-access' }, youtubeTab)).toBe(true)
    expect(await removed.answer({ type: 'youtube-access' }, youtubeTab)).toBe(false)
    await nextTask()

    for (const background of [granted, removed]) {
      expect(background.asked).toEqual([])
      expect(background.settled).toEqual([])
      expect(background.sent).toEqual([])
    }
  })

  test('a YouTube access check that rejects answers the ask false', async () => {
    const { answer } = await backgroundWith(() => Promise.reject(new Error('No permission data')))

    expect(await answer({ type: 'youtube-access' }, youtubeTab)).toBe(false)
  })

  test('a YouTube access check that rejects answers a www.youtube.com read failed, asking the API nothing', async () => {
    const { answer, asked } = await backgroundWith(() =>
      Promise.reject(new Error('No permission data')),
    )

    expect(await answer(videosRequest, youtubeTab)).toEqual({ state: 'failed' })
    expect(await answer(usageEvent, youtubeTab)).toBe(false)

    expect(asked).toEqual([])
  })
})
