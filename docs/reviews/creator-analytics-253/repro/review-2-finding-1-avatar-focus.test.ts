// @vitest-environment happy-dom
// Pre-PR review 2 of creator-analytics#253, finding 1. The harness is apps/site/src/main.test.ts's,
// copied with its paths pointed at apps/site. The test states the correct behaviour, so it is red
// while a sign-out restore removes a focused header avatar and focus falls to <body>.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const user = { email: 'nick@example.com', name: 'Nick' }

/** The homepage's body as the build writes it, with its header, and with no script to load. */
async function homepageBody(): Promise<string> {
  const page = await readFile(
    fileURLToPath(import.meta.resolve('../../../../apps/site/index.html')),
    'utf8',
  )
  const header = await readFile(
    fileURLToPath(import.meta.resolve('../../../../apps/site/partials/header.html')),
    'utf8',
  )
  const body = /<body>([\s\S]*)<\/body>/.exec(page)?.[1] ?? ''
  return body
    .replace('<!-- include partials/header.html -->', header)
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
}

/** Lets every settled promise run its callbacks. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

type Deferred = { promise: Promise<void>; resolve: () => void }

function deferred(): Deferred {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

type MeAnswer = 'signed in' | 'signed out'

type Me = MeAnswer | (() => Promise<Response>)

type Homepage = {
  fonts: Deferred
  /** Sets what every later GET /api/me answers. */
  answerMe: (answer: Me) => void
  meReads: () => number
  signInsStarted: () => number
}

const pageListeners: [string, EventListenerOrEventListenerObject][] = []

/**
 * The homepage with main.ts running on it: GET /api/me answers as `me` says, the sign-in POST
 * fails once `signInFails` settles, and document.fonts.ready settles when the test resolves the
 * fonts this returns.
 */
async function homepage({
  me = 'signed in',
  signInFails = new Promise(() => {}),
}: {
  me?: Me
  signInFails?: Promise<void>
} = {}): Promise<Homepage> {
  const fonts = deferred()
  document.body.innerHTML = await homepageBody()
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } })
  let answer: () => Promise<Response> = answerOf(me)
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/me') return answer()
    await signInFails
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
  await import('../../../../apps/site/src/main.ts')
  await settle()
  return {
    fonts,
    answerMe: (next) => {
      answer = answerOf(next)
    },
    meReads: () => fetchMock.mock.calls.filter(([url]) => url === '/api/me').length,
    signInsStarted: () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/sign-in/google').length,
  }
}

function answerOf(me: Me): () => Promise<Response> {
  if (typeof me === 'function') return me
  return async () =>
    me === 'signed in' ? Response.json(user) : new Response(null, { status: 401 })
}

/** The browser shows the page again: from the back-forward cache when `persisted`. */
async function showPage(persisted: boolean): Promise<void> {
  // happy-dom's PageTransitionEvent is a plain Event with no `persisted`, so it is set here.
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))
  await settle()
}

beforeEach(() => {
  // Every test imports main.ts afresh onto the one shared window, so each import's pageshow
  // listener is taken off again after its test, or it would read /api/me into the next one.
  const add = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (listener) pageListeners.push([type, listener])
    add(type, listener, options)
  })
})

afterEach(() => {
  for (const [type, listener] of pageListeners.splice(0)) {
    window.removeEventListener(type, listener)
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('review 2 finding 1: a sign-out restore keeps focus that sat on the header avatar', () => {
  test('focus on the header avatar moves to the wordmark when a sign-out restore takes the avatar away', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    const avatar = document.querySelector<HTMLAnchorElement>('[data-avatar-place] a.avatar')
    avatar?.focus()
    page.answerMe('signed out')
    await showPage(true)
    const wordmark = document.querySelector<HTMLElement>('a.wordmark')

    expect({
      avatarWasFocusable: avatar !== null,
      avatarInDocument: avatar?.isConnected,
      focused:
        document.activeElement === wordmark ? 'the wordmark' : document.activeElement?.tagName,
    }).toEqual({ avatarWasFocusable: true, avatarInDocument: false, focused: 'the wordmark' })
  })
})
