// Limits: these tests fake `permissions.contains` as `hostAccess`, so they cannot see Chrome's or
// Firefox's site access settings or the browser's own permission prompt. creator-analytics#101
// checks those by hand.
import { listedChannel } from '@creator-analytics/api-types/testing'
import { describe, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from './messages.ts'
import {
  heldSignInClick,
  type PopupRead,
  type PopupView,
  popupViewOf,
  readForPopup,
  signInClickToSend,
} from './popup.ts'
import type { ChannelsRead } from './product-api.ts'

const origin = 'https://stillstats.example'

/** The "Open Stillstats" link every view but the signed-out one and the access prompt shows. */
const openStillstats = {
  text: 'Open Stillstats',
  href: 'https://stillstats.example/app',
  clickEvent: { name: 'extension_popup_web_app_opened' },
}

/**
 * The "Send feedback" link a signed-in creator sees, to the feedback form on the popup's origin,
 * named as the extension's screen (creator-analytics#751).
 */
const sendFeedback = {
  text: 'Send feedback',
  href: 'https://stillstats.example/app/feedback?screen=extension',
  clickEvent: { name: 'extension_popup_feedback_opened' },
}

/** The toggle as #120 and #539 approve its copy, with YouTube access withheld. */
const youtubeToggleOff = {
  label: 'Show engaged views on youtube.com',
  explanation:
    'Your browser asks for access to www.youtube.com. Stillstats reads the links to videos and channels on the page, and matches them against your own videos in your browser, so it sends no video id from the page.',
  on: false,
}

const nickVogel = listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' })

describe("the popup's read", () => {
  test('withheld host access shows the access prompt and reads no channels', async () => {
    const readChannels = vi.fn(async () => ({ state: 'signed-in' as const, channels: [] }))

    const read = await readForPopup({ hostAccess: async () => false, readChannels })

    expect(popupViewOf({ read, origin, youtubeAccess: false })).toEqual({
      kind: 'host-access-missing',
      message:
        'Stillstats needs access to studio.youtube.com and stillstats.com to show your numbers.',
      button: 'Allow access',
    })
    expect(readChannels).not.toHaveBeenCalled()
  })

  test('with host access the popup reads the channels', async () => {
    const read = await readForPopup({
      hostAccess: async () => true,
      readChannels: async () => ({ state: 'signed-in', channels: [nickVogel] }),
    })

    expect(popupViewOf({ read, origin, youtubeAccess: false })).toMatchObject({
      kind: 'signed-in',
      channelNames: ['Nick Vogel (@nick_vogel)'],
    })
  })

  test('a read that throws is shown as failed', async () => {
    const read = await readForPopup({
      hostAccess: async () => true,
      readChannels: async () => {
        throw new Error('the background script did not answer')
      },
    })

    expect(popupViewOf({ read, origin, youtubeAccess: false })).toEqual({
      kind: 'failed',
      link: openStillstats,
      youtubeToggle: youtubeToggleOff,
    })
  })

  // Chrome's sendMessage throws before it returns a promise once the extension is updated under an
  // open popup, and a permissions call can do the same.
  const signedInRead = async () => ({ state: 'signed-in' as const, channels: [] })
  const failingReads: [string, () => Promise<boolean>, () => Promise<ChannelsRead>][] = [
    [
      'the host access check rejects',
      async () => {
        throw new Error('Invalid host permission')
      },
      signedInRead,
    ],
    [
      'the host access check throws before it returns a promise',
      () => {
        throw new Error('Extension context invalidated.')
      },
      signedInRead,
    ],
    [
      'the channels read throws before it returns a promise',
      async () => true,
      () => {
        throw new Error('Extension context invalidated.')
      },
    ],
  ]

  test.each(failingReads)(
    'when %s, the popup shows the failed view',
    async (_, hostAccess, readChannels) => {
      const read = await readForPopup({ hostAccess, readChannels })

      expect(popupViewOf({ read, origin, youtubeAccess: false })).toEqual({
        kind: 'failed',
        link: openStillstats,
        youtubeToggle: youtubeToggleOff,
      })
    },
  )
})

describe("the popup's states", () => {
  test('signed in with channels shows the sign-in line, the channels, the web app link and the feedback link', () => {
    const view = popupViewOf({
      read: {
        state: 'signed-in',
        channels: [nickVogel, listedChannel({ id: 'c-2', title: 'Second' })],
      },
      origin,
      youtubeAccess: false,
    })

    expect(view).toEqual({
      kind: 'signed-in',
      status: 'Signed in to Stillstats',
      heading: 'Your channels',
      channelNames: ['Nick Vogel (@nick_vogel)', 'Second'],
      link: openStillstats,
      feedbackLink: sendFeedback,
      youtubeToggle: youtubeToggleOff,
    })
  })

  test('signed in with no channel says to connect one in Stillstats, and links to the feedback form', () => {
    const view = popupViewOf({
      read: { state: 'signed-in', channels: [] },
      origin,
      youtubeAccess: false,
    })

    expect(view).toEqual({
      kind: 'no-channels',
      status: 'Signed in to Stillstats',
      message: 'No channel connected yet. Connect one in Stillstats.',
      link: openStillstats,
      feedbackLink: sendFeedback,
      youtubeToggle: youtubeToggleOff,
    })
  })

  test('signed out links to sign in at the web app, and to no feedback form', () => {
    const view = popupViewOf({ read: { state: 'signed-out' }, origin, youtubeAccess: false })

    expect(view).toEqual({
      kind: 'signed-out',
      link: { text: 'Sign in at stillstats.com', href: 'https://stillstats.example/app' },
      youtubeToggle: youtubeToggleOff,
    })
  })
})

test('a failed read shows only the web app link, and no feedback link, since it says nothing about the sign-in', () => {
  const view = popupViewOf({ read: { state: 'failed' }, origin, youtubeAccess: false })

  expect(view).toEqual({
    kind: 'failed',
    link: openStillstats,
    youtubeToggle: youtubeToggleOff,
  })
})

describe('the YouTube access toggle', () => {
  const toggleIn = (view: PopupView) => ('youtubeToggle' in view ? view.youtubeToggle : undefined)

  const reads: [string, PopupRead][] = [
    ['signed in with channels', { state: 'signed-in', channels: [nickVogel] }],
    ['signed in with no channel', { state: 'signed-in', channels: [] }],
    ['signed out', { state: 'signed-out' }],
    ['after a failed read', { state: 'failed' }],
  ]

  test.each(reads)('shows %s, on when YouTube access is granted and off when not', (_, read) => {
    expect(toggleIn(popupViewOf({ read, origin, youtubeAccess: true }))).toEqual({
      ...youtubeToggleOff,
      on: true,
    })
    expect(toggleIn(popupViewOf({ read, origin, youtubeAccess: false }))).toEqual(youtubeToggleOff)
  })

  test('withheld host access shows only the access prompt, whatever the YouTube access', () => {
    const accessPrompt = {
      kind: 'host-access-missing',
      message:
        'Stillstats needs access to studio.youtube.com and stillstats.com to show your numbers.',
      button: 'Allow access',
    }

    for (const youtubeAccess of [true, false]) {
      expect(
        popupViewOf({ read: { state: 'host-access-missing' }, origin, youtubeAccess }),
      ).toEqual(accessPrompt)
    }
  })
})

describe('a sign-in click is sent once the creator is signed in', () => {
  test('a pending click is sent on a signed-in read', () => {
    expect(signInClickToSend({ pending: true, read: { state: 'signed-in', channels: [] } })).toBe(
      true,
    )
  })

  test('a pending click waits while the creator is still signed out', () => {
    expect(signInClickToSend({ pending: true, read: { state: 'signed-out' } })).toBe(false)
  })

  test('a pending click waits while host access is withheld', () => {
    expect(signInClickToSend({ pending: true, read: { state: 'host-access-missing' } })).toBe(false)
  })

  test('a signed-in read with no pending click sends nothing', () => {
    expect(signInClickToSend({ pending: false, read: { state: 'signed-in', channels: [] } })).toBe(
      false,
    )
  })
})

/** The popup's localStorage, which outlives a popup open. */
function popupStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

/** An ask that records each request and answers every usage event settled. */
function recordingAsk() {
  const asked: BackgroundRequest[] = []
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    return true
  }) as AskBackground
  return { asked, ask }
}

const signedIn = { state: 'signed-in' as const, channels: [] }

describe("the popup's held sign-in click", () => {
  test('a held click asks for extension_popup_sign_in_clicked on a signed-in open, once', async () => {
    const storage = popupStorage()
    const { asked, ask } = recordingAsk()
    heldSignInClick({ storage, ask }).hold()

    await heldSignInClick({ storage, ask }).sendOn(signedIn)
    await heldSignInClick({ storage, ask }).sendOn(signedIn)

    expect(asked).toEqual([
      { type: 'usage-event', event: { name: 'extension_popup_sign_in_clicked' } },
    ])
  })

  // The background answers not sent when the relay refuses the event or answers 401, it never
  // answers when it restarted, and Chrome's sendMessage throws before it returns a promise once the
  // extension is updated under an open popup.
  const failingAsks: [string, AskBackground][] = [
    ['the background answers it not sent', (async () => false) as AskBackground],
    [
      'the background never answers',
      (async () => {
        throw new Error('Could not establish connection. Receiving end does not exist.')
      }) as AskBackground,
    ],
    [
      'the ask throws before it returns a promise',
      (() => {
        throw new Error('Extension context invalidated.')
      }) as AskBackground,
    ],
  ]

  test.each(failingAsks)(
    'when %s, the open goes on and the click stays held for the next open',
    async (_, failingAsk) => {
      const storage = popupStorage()
      heldSignInClick({ storage, ask: failingAsk }).hold()

      await expect(heldSignInClick({ storage, ask: failingAsk }).sendOn(signedIn)).resolves.toBe(
        undefined,
      )

      const { asked, ask } = recordingAsk()
      await heldSignInClick({ storage, ask }).sendOn(signedIn)
      expect(asked).toEqual([
        { type: 'usage-event', event: { name: 'extension_popup_sign_in_clicked' } },
      ])
    },
  )
})
