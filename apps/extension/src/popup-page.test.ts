// @vitest-environment jsdom
// Limits: these tests fake `permissions.contains` and `permissions.request`, so they cannot show the
// browser's own permission prompt, or that the request stays inside the user gesture Chrome and
// Firefox require beyond being the click's first call. creator-analytics#101 checks those by hand.
import { listedChannel } from '@creator-analytics/api-types/testing'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { AskBackground, BackgroundRequest } from './messages.ts'
import { renderPopup } from './popup-page.ts'

const origin = 'https://stillstats.example'

/** A background that answers the channels read signed in with one channel. */
function background(): AskBackground {
  return (async (request: BackgroundRequest) =>
    request.type === 'read-channels'
      ? {
          state: 'signed-in',
          channels: [listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' })],
        }
      : true) as AskBackground
}

function popupStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

let root: HTMLElement
let unhandled: unknown[]
let thrown: unknown[]
const recordUnhandled = (reason: unknown) => unhandled.push(reason)
// jsdom reports an exception thrown inside a listener as a window `error` event, not a throw out of
// `click()`.
const recordThrown = (event: ErrorEvent) => {
  event.preventDefault()
  thrown.push(event.error)
}

beforeEach(() => {
  root = document.createElement('main')
  unhandled = []
  thrown = []
  process.on('unhandledRejection', recordUnhandled)
  window.addEventListener('error', recordThrown)
})

afterEach(() => {
  process.off('unhandledRejection', recordUnhandled)
  window.removeEventListener('error', recordThrown)
})

const settle = () => new Promise((resolve) => setTimeout(resolve))

const toggleText =
  'Show engaged views on youtube.comYour browser asks for access to www.youtube.com. Stillstats reads the links to videos and channels on the page, and matches them against your own videos in your browser, so it sends no video id from the page.'

/** The browser's YouTube access grant, which the toggle reads, asks for and gives up. */
function youtubeAccessGranted(initially: boolean) {
  let granted = initially
  const calls: string[] = []
  return {
    calls,
    get granted() {
      return granted
    },
    access: {
      granted: async () => granted,
      request: async () => {
        calls.push('request')
        granted = true
        return true
      },
      remove: async () => {
        calls.push('remove')
        granted = false
        return true
      },
    },
  }
}

const withheldYouTubeAccess = () => youtubeAccessGranted(false).access

function youtubeToggle(): HTMLInputElement {
  const toggle = root.querySelector<HTMLInputElement>('input[role="switch"]')
  if (!toggle) throw new Error(`no YouTube access toggle in ${root.textContent}`)
  return toggle
}

function allowAccessButton(): HTMLButtonElement {
  const button = root.querySelector('button')
  if (button?.textContent !== 'Allow access')
    throw new Error(`no "Allow access" button in ${root.textContent}`)
  return button
}

test('withheld access shows the access prompt, and a granted request shows the channels', async () => {
  let granted = false
  const hostAccess = {
    granted: async () => granted,
    request: async () => {
      granted = true
      return true
    },
  }

  await renderPopup({
    document,
    root,
    hostAccess,
    youtubeAccess: withheldYouTubeAccess(),
    ask: background(),
    storage: popupStorage(),
    origin,
  })
  expect(root.textContent).toBe(
    'Stillstats needs access to studio.youtube.com and stillstats.com to show your numbers.Allow access',
  )

  allowAccessButton().click()
  await settle()

  expect(root.textContent).toBe(
    `Signed in to StillstatsYour channelsNick Vogel (@nick_vogel)Open StillstatsSend feedback${toggleText}`,
  )
})

const accessPrompt =
  'Stillstats needs access to studio.youtube.com and stillstats.com to show your numbers.Allow access'

// `permissions.request` rejects when another request is still open, and a permissions call throws
// before it returns a promise once the extension is updated under an open popup.
const failingRequests: [string, () => Promise<boolean>][] = [
  [
    'rejects',
    async () => {
      throw new Error('A request is already pending.')
    },
  ],
  [
    'throws before it returns a promise',
    () => {
      throw new Error('Extension context invalidated.')
    },
  ],
]

test.each(failingRequests)(
  'an "Allow access" request that %s shows the access prompt again and leaves no unhandled rejection',
  async (_, request) => {
    let checks = 0
    const granted = async () => {
      checks += 1
      return false
    }
    await renderPopup({
      document,
      root,
      hostAccess: { granted, request },
      youtubeAccess: withheldYouTubeAccess(),
      ask: background(),
      storage: popupStorage(),
      origin,
    })
    const firstPromptButton = allowAccessButton()

    firstPromptButton.click()
    await settle()

    // A new button and a second access check: the popup read the access again and drew it anew,
    // rather than leaving the first prompt standing.
    expect(root.textContent).toBe(accessPrompt)
    expect(allowAccessButton()).not.toBe(firstPromptButton)
    expect(checks).toBe(2)
    expect(thrown).toEqual([])
    expect(unhandled).toEqual([])
  },
)

test('the "Allow access" click makes the permission request before the click returns', async () => {
  let requested = false
  await renderPopup({
    document,
    root,
    hostAccess: {
      granted: async () => false,
      request: async () => {
        requested = true
        return false
      },
    },
    youtubeAccess: withheldYouTubeAccess(),
    ask: background(),
    storage: popupStorage(),
    origin,
  })

  allowAccessButton().click()

  expect(requested).toBe(true)
})

const failingChecks: [string, () => Promise<boolean>][] = [
  [
    'rejects',
    async () => {
      throw new Error('Invalid host permission')
    },
  ],
  [
    'throws before it returns a promise',
    () => {
      throw new Error('Extension context invalidated.')
    },
  ],
]

test.each(failingChecks)(
  'a host access check that %s at open shows the "Open Stillstats" link and leaves no unhandled rejection',
  async (_, granted) => {
    await renderPopup({
      document,
      root,
      hostAccess: { granted, request: async () => true },
      youtubeAccess: withheldYouTubeAccess(),
      ask: background(),
      storage: popupStorage(),
      origin,
    })
    await settle()

    expect(root.textContent).toBe(`Open Stillstats${toggleText}`)
    expect(unhandled).toEqual([])
  },
)

/** A background that answers the channels read signed out. */
const signedOutBackground = (async (request: BackgroundRequest) =>
  request.type === 'read-channels' ? { state: 'signed-out' } : true) as AskBackground

const grantedHostAccess = { granted: async () => true, request: async () => true }

describe('the YouTube access toggle', () => {
  test.each([
    ['signed in', background()],
    ['signed out', signedOutBackground],
  ])("shows the browser's grant on open, %s", async (_, ask) => {
    for (const granted of [true, false]) {
      await renderPopup({
        document,
        root,
        hostAccess: grantedHostAccess,
        youtubeAccess: youtubeAccessGranted(granted).access,
        ask,
        storage: popupStorage(),
        origin,
      })

      expect(youtubeToggle().checked).toBe(granted)
      expect(youtubeToggle().closest('label')?.textContent).toBe(
        'Show engaged views on youtube.com',
      )
      expect(root.textContent).toContain(toggleText)
    }
  })

  test('turning it on asks the browser before the click returns, and shows it on once granted', async () => {
    const youtube = youtubeAccessGranted(false)
    await renderPopup({
      document,
      root,
      hostAccess: grantedHostAccess,
      youtubeAccess: youtube.access,
      ask: background(),
      storage: popupStorage(),
      origin,
    })

    youtubeToggle().click()
    expect(youtube.calls).toEqual(['request'])
    await settle()

    expect(youtubeToggle().checked).toBe(true)
  })

  test('turning it off gives up YouTube access and shows it off', async () => {
    const youtube = youtubeAccessGranted(true)
    await renderPopup({
      document,
      root,
      hostAccess: grantedHostAccess,
      youtubeAccess: youtube.access,
      ask: background(),
      storage: popupStorage(),
      origin,
    })

    youtubeToggle().click()
    expect(youtube.calls).toEqual(['remove'])
    await settle()

    expect(youtube.granted).toBe(false)
    expect(youtubeToggle().checked).toBe(false)
  })

  test.each(failingRequests)(
    'a request that %s shows the toggle off again and leaves no unhandled rejection',
    async (_, request) => {
      await renderPopup({
        document,
        root,
        hostAccess: grantedHostAccess,
        youtubeAccess: { granted: async () => false, request, remove: async () => true },
        ask: background(),
        storage: popupStorage(),
        origin,
      })
      const firstToggle = youtubeToggle()

      firstToggle.click()
      await settle()

      expect(youtubeToggle()).not.toBe(firstToggle)
      expect(youtubeToggle().checked).toBe(false)
      expect(thrown).toEqual([])
      expect(unhandled).toEqual([])
    },
  )

  test.each(failingChecks)(
    'a grant check that %s shows the toggle off and leaves no unhandled rejection',
    async (_, granted) => {
      await renderPopup({
        document,
        root,
        hostAccess: grantedHostAccess,
        youtubeAccess: { granted, request: async () => true, remove: async () => true },
        ask: background(),
        storage: popupStorage(),
        origin,
      })
      await settle()

      expect(youtubeToggle().checked).toBe(false)
      expect(unhandled).toEqual([])
    },
  )

  test('with the required hosts withheld, YouTube access does not hide the "Allow access" prompt', async () => {
    await renderPopup({
      document,
      root,
      hostAccess: { granted: async () => false, request: async () => false },
      youtubeAccess: youtubeAccessGranted(true).access,
      ask: background(),
      storage: popupStorage(),
      origin,
    })

    expect(root.textContent).toBe(accessPrompt)
    expect(allowAccessButton()).toBeTruthy()
  })
})

describe('the "Send feedback" link (creator-analytics#751)', () => {
  /** A background that answers the channels read as `read`, and records every request. */
  function recordingBackground(read: unknown) {
    const asked: BackgroundRequest[] = []
    const ask = (async (request: BackgroundRequest) => {
      if (request.type === 'read-channels') return read
      asked.push(request)
      return true
    }) as AskBackground
    return { asked, ask }
  }

  function sendFeedbackLink(): HTMLAnchorElement | undefined {
    return [...root.querySelectorAll('a')].find((link) => link.textContent === 'Send feedback')
  }

  async function renderReading(ask: AskBackground, hostAccess = grantedHostAccess) {
    await renderPopup({
      document,
      root,
      hostAccess,
      youtubeAccess: withheldYouTubeAccess(),
      ask,
      storage: popupStorage(),
      origin,
    })
    await settle()
  }

  test.each([
    ['with channels', [listedChannel({ title: 'Nick Vogel', handle: '@nick_vogel' })]],
    ['with no channel', []],
  ])(
    'signed in %s, opens the feedback form named as the extension in a new tab, and asks for its event once per click',
    async (_, channels) => {
      const { asked, ask } = recordingBackground({ state: 'signed-in', channels })
      await renderReading(ask)

      const link = sendFeedbackLink()
      expect(link?.target).toBe('_blank')
      expect(link?.href).toBe('https://stillstats.example/app/feedback?screen=extension')

      link?.click()

      expect(asked).toEqual([
        { type: 'usage-event', event: { name: 'extension_popup_feedback_opened' } },
      ])
    },
  )

  test('a signed-out popup shows no "Send feedback" link', async () => {
    await renderReading(recordingBackground({ state: 'signed-out' }).ask)

    expect(root.textContent).toContain('Sign in at stillstats.com')
    expect(sendFeedbackLink()).toBeUndefined()
  })

  test('a failed popup shows no "Send feedback" link', async () => {
    await renderReading(recordingBackground({ state: 'failed' }).ask)

    expect(root.textContent).toBe(`Open Stillstats${toggleText}`)
    expect(sendFeedbackLink()).toBeUndefined()
  })
})
