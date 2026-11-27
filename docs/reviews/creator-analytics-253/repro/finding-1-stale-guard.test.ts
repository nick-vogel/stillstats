// @vitest-environment happy-dom
// Pre-PR review 1 of creator-analytics#253, finding 1. The harness is apps/site/src/main.test.ts's,
// copied with its paths pointed at apps/site. The test states the correct behaviour, so it is red
// while a restore read that cannot tell still retires a load read that can.
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

function avatarShown(): boolean {
  return document.querySelector('[data-avatar-place] a.avatar[href="/app"]') !== null
}

function dashboardLinkShown(): boolean {
  return [...document.querySelectorAll('a.button[href="/app"]')].some(
    (link) => link.textContent === 'Open your dashboard',
  )
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

describe('finding 1: a restore read that cannot tell leaves a load read that can to land', () => {
  test('a load read answering signed in lands after a restore read that answers 500', async () => {
    const loadAnswers = deferred()
    const page = await homepage({
      me: async () => {
        await loadAnswers.promise
        return Response.json(user)
      },
    })
    page.fonts.resolve()
    page.answerMe(async () => new Response(null, { status: 500 }))
    await showPage(true)
    loadAnswers.resolve()
    await settle()

    expect({ reads: page.meReads(), avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      reads: 2,
      avatar: true,
      link: true,
    })
  })
})
