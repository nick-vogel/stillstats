// @vitest-environment jsdom
// Limits: jsdom dispatches the click but opens no tab and closes no popup, so these tests cannot show
// that the message leaves before the browser closes the popup; creator-analytics#101 clicks "Open
// Stillstats" in Chrome and Firefox and watches the relay.
import { describe, expect, test } from 'vitest'
import type { AskBackground, BackgroundRequest } from './messages.ts'
import { type PopupRead, popupViewOf } from './popup.ts'
import { linkElement } from './popup-link.ts'

const origin = 'https://stillstats.example'

function recordingAsk() {
  const asked: BackgroundRequest[] = []
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    return true
  }) as AskBackground
  return { asked, ask }
}

function linkOf(read: PopupRead) {
  const view = popupViewOf({ read, origin, youtubeAccess: false })
  if (!('link' in view)) throw new Error(`the ${view.kind} view shows no link`)
  return view.link
}

test('a click on the "Open Stillstats" link asks the background to send its usage event', () => {
  const { asked, ask } = recordingAsk()
  const link = linkOf({ state: 'signed-in', channels: [] })

  linkElement({ document, link, ask }).click()

  expect(asked).toEqual([
    { type: 'usage-event', event: { name: 'extension_popup_web_app_opened' } },
  ])
})

function auxClick(element: HTMLElement, button: number): void {
  element.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button }))
}

test('a middle-click, which opens the link in a new tab, asks for the event', () => {
  const { asked, ask } = recordingAsk()
  const link = linkOf({ state: 'signed-in', channels: [] })

  auxClick(linkElement({ document, link, ask }), 1)

  expect(asked).toHaveLength(1)
})

test('a middle-click on the sign-in link runs its click handler, as a click does', () => {
  const { ask } = recordingAsk()
  const link = linkOf({ state: 'signed-out' })
  let clicks = 0

  auxClick(linkElement({ document, link, ask, onClick: () => clicks++ }), 1)

  expect(clicks).toBe(1)
})

test('a right-click, which opens the context menu and no tab, asks for no event and runs no click handler', () => {
  const { asked, ask } = recordingAsk()
  let clicks = 0

  auxClick(linkElement({ document, link: linkOf({ state: 'signed-in', channels: [] }), ask }), 2)
  auxClick(
    linkElement({ document, link: linkOf({ state: 'signed-out' }), ask, onClick: () => clicks++ }),
    2,
  )

  expect(asked).toEqual([])
  expect(clicks).toBe(0)
})

// The background never answers when it restarted, and Chrome's sendMessage throws before it returns
// a promise once the extension is updated under an open popup.
const failingAsks: [string, AskBackground][] = [
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

const opens: [string, (element: HTMLElement) => void][] = [
  ['a click', (element) => element.click()],
  ['a middle-click', (element) => auxClick(element, 1)],
]

describe.each(opens)('%s on the "Open Stillstats" link', (_, open) => {
  test.each(failingAsks)(
    'when %s, throws nothing in the listener and leaves no unhandled rejection',
    async (_, failingAsk) => {
      const unhandled: unknown[] = []
      const record = (reason: unknown) => unhandled.push(reason)
      // jsdom reports an exception thrown inside a listener as a window `error` event, not a throw
      // out of `dispatchEvent`.
      const thrown: unknown[] = []
      const recordThrown = (event: ErrorEvent) => {
        event.preventDefault()
        thrown.push(event.error)
      }
      process.on('unhandledRejection', record)
      window.addEventListener('error', recordThrown)
      try {
        const link = linkOf({ state: 'signed-in', channels: [] })
        open(linkElement({ document, link, ask: failingAsk }))
        await new Promise((resolve) => setTimeout(resolve))
      } finally {
        process.off('unhandledRejection', record)
        window.removeEventListener('error', recordThrown)
      }

      expect(thrown).toEqual([])
      expect(unhandled).toEqual([])
    },
  )
})
