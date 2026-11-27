import type { ExtensionEvent } from '@creator-analytics/api-types'
import { expect, test } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { lineClicks, sendWebAppOpened } from './line-clicks.ts'

/** A background that settles each usage event with what `settled()` answers at the time. */
function background(settled: () => boolean | Promise<boolean> = () => true) {
  const events: ExtensionEvent[] = []
  const ask = (async (request: BackgroundRequest) => {
    if (request.type === 'usage-event') events.push(request.event)
    return settled()
  }) as AskBackground
  return { ask, events }
}

/**
 * A background whose ask for a usage event throws before it returns a promise while `throws()`, as
 * Chrome's sendMessage does once the extension is updated under an open Studio tab, and otherwise
 * settles it.
 */
function backgroundThatThrows(throws: () => boolean = () => true) {
  const events: ExtensionEvent[] = []
  const ask = ((request: BackgroundRequest) => {
    if (request.type === 'usage-event') {
      if (throws()) throw new Error('Extension context invalidated.')
      events.push(request.event)
    }
    return Promise.resolve(true)
  }) as AskBackground
  return { ask, events }
}

const signedIn = { state: 'channel-not-in-stillstats' } as const

test('a held sign-in click is not sent while the reads show the creator signed out', async () => {
  const { ask, events } = background()
  const clicks = lineClicks(ask)

  clicks.opened('card', 'sign-in')
  clicks.read({ state: 'signed-out' })
  await Promise.resolve()

  expect(events).toEqual([])
})

test('a held sign-in click is sent once, with the surface it was clicked on, however many signed-in reads follow', async () => {
  const { ask, events } = background()
  const clicks = lineClicks(ask)

  clicks.opened('card', 'sign-in')
  clicks.read(signedIn)
  clicks.read(signedIn)
  await Promise.resolve()

  expect(events).toEqual([{ name: 'extension_sign_in_clicked', surface: 'card' }])
})

// Neither read says whether the creator is signed in: without host access to stillstats.com the
// background reads nothing, and an event sent then goes without the session cookie.
test.each([
  ['a failed read', { state: 'failed' }],
  ['a read with host access to stillstats.com withheld', { state: 'host-access-withheld' }],
] satisfies [string, VideosRead][])(
  'a held sign-in click is kept through %s, and sent by the next signed-in read',
  async (_, read) => {
    const { ask, events } = background()
    const clicks = lineClicks(ask)

    clicks.opened('content_list', 'sign-in')
    clicks.read(read)
    await Promise.resolve()
    expect(events).toEqual([])

    clicks.read(signedIn)
    await Promise.resolve()

    expect(events).toEqual([{ name: 'extension_sign_in_clicked', surface: 'content_list' }])
  },
)

test('sign-in clicks held on two surfaces send one event for each', async () => {
  const { ask, events } = background()
  const clicks = lineClicks(ask)

  clicks.opened('card', 'sign-in')
  clicks.opened('content_list', 'sign-in')
  clicks.opened('card', 'sign-in')
  clicks.read(signedIn)
  await Promise.resolve()

  expect(events).toEqual([
    { name: 'extension_sign_in_clicked', surface: 'card' },
    { name: 'extension_sign_in_clicked', surface: 'content_list' },
  ])
})

test.each([
  ['the background answers it not sent', () => false],
  [
    'the background never answers',
    () => Promise.reject(new Error('Receiving end does not exist.')),
  ],
])(
  'a held sign-in click is kept when %s, and sent by the next signed-in read',
  async (_, first) => {
    let answer: () => boolean | Promise<boolean> = first
    const { ask, events } = background(() => answer())
    const clicks = lineClicks(ask)

    clicks.opened('analytics', 'sign-in')
    clicks.read(signedIn)
    await new Promise((resolve) => setTimeout(resolve))
    answer = () => true
    clicks.read(signedIn)
    await new Promise((resolve) => setTimeout(resolve))
    clicks.read(signedIn)
    await new Promise((resolve) => setTimeout(resolve))

    expect(events).toEqual([
      { name: 'extension_sign_in_clicked', surface: 'analytics' },
      { name: 'extension_sign_in_clicked', surface: 'analytics' },
    ])
  },
)

test.each(['connect', 'web-app'] as const)(
  'a %s click the background never answers leaves no unhandled rejection in Studio',
  async (click) => {
    const unhandled: unknown[] = []
    const record = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', record)
    try {
      const { ask } = background(() => Promise.reject(new Error('Receiving end does not exist.')))
      lineClicks(ask).opened('card', click)
      await new Promise((resolve) => setTimeout(resolve))
    } finally {
      process.off('unhandledRejection', record)
    }

    expect(unhandled).toEqual([])
  },
)

test('a held sign-in click is kept when the ask throws before it returns a promise, and sent by the next signed-in read', async () => {
  let throws = true
  const { ask, events } = backgroundThatThrows(() => throws)
  const clicks = lineClicks(ask)

  clicks.opened('analytics', 'sign-in')
  expect(() => clicks.read(signedIn)).not.toThrow()
  await new Promise((resolve) => setTimeout(resolve))
  throws = false
  clicks.read(signedIn)
  await new Promise((resolve) => setTimeout(resolve))
  clicks.read(signedIn)
  await new Promise((resolve) => setTimeout(resolve))

  expect(events).toEqual([{ name: 'extension_sign_in_clicked', surface: 'analytics' }])
})

test.each([
  ['a connect click', (ask: AskBackground) => lineClicks(ask).opened('card', 'connect')],
  ['a web app click', (ask: AskBackground) => lineClicks(ask).opened('card', 'web-app')],
  [
    'the analytics page\'s "View this video in Stillstats"',
    (ask: AskBackground) => sendWebAppOpened(ask, 'analytics'),
  ],
])(
  '%s whose ask throws before it returns a promise neither throws nor leaves an unhandled rejection in Studio',
  async (_, send) => {
    const unhandled: unknown[] = []
    const record = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', record)
    try {
      const { ask } = backgroundThatThrows()
      expect(() => send(ask)).not.toThrow()
      await new Promise((resolve) => setTimeout(resolve))
    } finally {
      process.off('unhandledRejection', record)
    }

    expect(unhandled).toEqual([])
  },
)
