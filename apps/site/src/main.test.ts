// @vitest-environment happy-dom
// Limits: these tests run main.ts in happy-dom on the homepage's and the tool page's own markup,
// with a fake fetch and a fake document.fonts. happy-dom lays nothing out and loads no font, so none shows the link's
// width, that its label stays on one line, or that nothing moves when /api/me answers: the site
// tests read those rules from the sheets, and Nick's browser walk checks them. happy-dom has no
// back-forward cache either: the restore cases dispatch the pageshow a restore fires, so they show
// what main.ts does with one, not that a browser fires it or keeps the page. The walk covers that:
// sign in from the homepage, Back twice, and the homepage shows the avatar and the dashboard link.
// The focus cases show which element holds focus after a swap, not that a browser draws its focus
// ring there: the walk checks that with Tab to "Open your dashboard", a sign-out in another tab, and
// Back. The tool page's back link cases show its text and href, not that its swap moves nothing:
// the walk holds the h1 to the same top signed in and signed out (creator-analytics#889).
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { accountBackLinkText, homeBackLinkText } from './signed-in.ts'

// OpenPanel's SDK is mocked, so the analytics cases show which client the page builds and what it
// hands it, not that an event reaches the self-hosted project; Nick checks that in OpenPanel.
vi.mock('@openpanel/web', () => ({
  OpenPanel: vi.fn(
    class {
      track = vi.fn(async () => {})
    },
  ),
}))

const openPanelApiUrl = 'https://openpanel.invalid'

/** What GET /api/client-settings answers unless a test says otherwise. */
const clientSettings: ClientSettingsAnswer = {
  environment: 'production',
  version: '2026.11.9',
  commit: 'abc1234',
  releasePath: '/releases/2026.11.9',
  openPanelClientId: 'a-site-client-id',
}

// Each name starts with another letter than its email, so a test can tell which field the avatar
// letter comes from.
const user = { email: 'nick@example.com', name: 'Ada' }

/** A second account, signed in elsewhere while the page sat in the back-forward cache. */
const otherUser = { email: 'zoe@example.com', name: 'Bea' }

/**
 * A site page's body as the build writes it, with its header and its icons, and with no script to
 * load. Each icon is trimmed and joined between its tags, as vite.config.ts's include does.
 */
async function pageBody(file: string): Promise<string> {
  const page = await readFile(fileURLToPath(import.meta.resolve(file)), 'utf8')
  const header = await readFile(
    fileURLToPath(import.meta.resolve('../partials/header.html')),
    'utf8',
  )
  const body = (/<body>([\s\S]*)<\/body>/.exec(page)?.[1] ?? '')
    .replace('<!-- include partials/header.html -->', header)
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
  const icons = [...body.matchAll(/<!-- include (icons\/\S+) -->/g)]
  let expanded = body
  for (const [directive, path = ''] of icons) {
    const icon = await readFile(fileURLToPath(import.meta.resolve(`../${path}`)), 'utf8')
    expanded = expanded.replace(directive, icon.trim().replace(/>\s+</g, '><'))
  }
  return expanded
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

type SitePage = {
  fonts: Deferred
  /** The OpenPanel clients the page built, each with the events it was handed. */
  panels: () => { options: unknown; tracked: unknown[][] }[]
  /** Sets what every later GET /api/me answers. */
  answerMe: (answer: Me) => void
  meReads: () => number
  signInsStarted: () => number
}

const pageListeners: [string, EventListenerOrEventListenerObject][] = []

type SitePageOptions = {
  me?: Me
  signInFails?: Promise<void>
  settings?: ClientSettingsAnswer
  settingsLand?: Promise<void>
}

/**
 * The site page in `file` with main.ts running on it: GET /api/me answers as `me` says, GET
 * /api/client-settings answers `settings` once `settingsLand` settles, the sign-in POST fails once
 * `signInFails` settles, and document.fonts.ready settles when the test resolves the fonts this
 * returns.
 */
async function sitePage(
  file: string,
  {
    me = 'signed in',
    signInFails = new Promise(() => {}),
    settings = clientSettings,
    settingsLand = Promise.resolve(),
  }: SitePageOptions = {},
): Promise<SitePage> {
  const fonts = deferred()
  document.body.innerHTML = await pageBody(file)
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } })
  let answer: () => Promise<Response> = answerOf(me)
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/me') return answer()
    if (url === '/api/client-settings') {
      await settingsLand
      return Response.json(settings)
    }
    await signInFails
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
  await import('./main.ts')
  // After main.ts, not beside it: imported together, the mocked SDK can load twice.
  const { OpenPanel } = await import('@openpanel/web')
  await settle()
  const built = vi.mocked(OpenPanel)
  return {
    fonts,
    panels: () =>
      built.mock.calls.map(([options], i) => ({
        options,
        tracked: vi.mocked(built.mock.instances[i]?.track)?.mock.calls ?? [],
      })),
    answerMe: (next) => {
      answer = answerOf(next)
    },
    meReads: () => fetchMock.mock.calls.filter(([url]) => url === '/api/me').length,
    signInsStarted: () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/sign-in/google').length,
  }
}

/** The homepage with main.ts running on it, as `sitePage` describes. */
function homepage(options?: SitePageOptions): Promise<SitePage> {
  return sitePage('../index.html', options)
}

/** The thumbnail preview tool page with main.ts running on it, as `sitePage` describes. */
function toolPage(options?: SitePageOptions): Promise<SitePage> {
  return sitePage('../tools/thumbnail-preview.html', options)
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

function signInError(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-sign-in-error]')
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
  vi.unstubAllEnvs()
  document.body.innerHTML = ''
})

describe('the signed-in homepage', () => {
  test('the avatar and the "Open your dashboard" link show at the same moment', async () => {
    const { fonts } = await homepage()

    expect({ avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      avatar: false,
      link: false,
    })

    fonts.resolve()
    await settle()

    expect({ avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      avatar: true,
      link: true,
    })
  })

  test('the sign-in error stays hidden once the visitor shows as signed in, whenever the sign-in failed', async () => {
    const failsFirst = deferred()
    const { fonts: fontsFirst } = await homepage({ signInFails: failsFirst.promise })
    document.querySelector<HTMLElement>('[data-sign-in]')?.click()
    failsFirst.resolve()
    await settle()

    expect(signInError()?.hidden).toBe(false)

    fontsFirst.resolve()
    await settle()

    expect({ link: dashboardLinkShown(), errorHidden: signInError()?.hidden }).toEqual({
      link: true,
      errorHidden: true,
    })

    const failsLater = deferred()
    const { fonts: fontsLater } = await homepage({ signInFails: failsLater.promise })
    document.querySelector<HTMLElement>('[data-sign-in]')?.click()
    fontsLater.resolve()
    await settle()
    failsLater.resolve()
    await settle()

    expect({ link: dashboardLinkShown(), errorHidden: signInError()?.hidden }).toEqual({
      link: true,
      errorHidden: true,
    })
  })
})

describe("the tool page's sign-in band", () => {
  function band(): { signIn: boolean; dashboardLink: boolean } {
    const section = document.querySelector('.sign-in-band')
    return {
      signIn: section?.querySelector('[data-sign-in]') != null,
      dashboardLink: [...(section?.querySelectorAll('a.button[href="/app"]') ?? [])].some(
        (link) => link.textContent === 'Open your dashboard',
      ),
    }
  }

  test('signed out, the band holds the sign-in button and no dashboard link', async () => {
    const page = await toolPage({ me: 'signed out' })
    page.fonts.resolve()
    await settle()

    expect(band()).toEqual({ signIn: true, dashboardLink: false })
  })

  test('signed in, the band holds the "Open your dashboard" link in place of the sign-in button', async () => {
    const page = await toolPage()
    page.fonts.resolve()
    await settle()

    expect(band()).toEqual({ signIn: false, dashboardLink: true })
  })
})

describe("the tool page's back link (creator-analytics#889)", () => {
  /** The link above the tool page's title: its text, its href, and whether its arrow leads it. */
  function backLink(): { text: string; href: string | null; arrowFirst: boolean } | null {
    const links = document.querySelectorAll<HTMLAnchorElement>('main [data-back-link]')
    const [link] = links
    if (links.length !== 1 || !link) return null
    const [first] = link.children
    return {
      text: link.textContent?.trim() ?? '',
      href: link.getAttribute('href'),
      arrowFirst:
        first?.tagName.toLowerCase() === 'svg' && first.getAttribute('aria-hidden') === 'true',
    }
  }

  test('signed out, the link reads "Home" and goes to /, after its arrow', async () => {
    const page = await toolPage({ me: 'signed out' })
    page.fonts.resolve()
    await settle()

    expect(backLink()).toEqual({ text: homeBackLinkText, href: '/', arrowFirst: true })
  })

  test('before /api/me answers, the link reads "Home" and goes to /', async () => {
    await toolPage()

    expect(backLink()).toEqual({ text: homeBackLinkText, href: '/', arrowFirst: true })
  })

  test('signed in, the link reads "Back to your account" and goes to /app, after its arrow', async () => {
    const page = await toolPage()
    page.fonts.resolve()
    await settle()

    expect(backLink()).toEqual({ text: accountBackLinkText, href: '/app', arrowFirst: true })
  })

  test('a sign-out restore after a signed-in load puts "Home" and / back, on the same link', async () => {
    const page = await toolPage()
    page.fonts.resolve()
    await settle()
    const signedInLink = document.querySelector('main [data-back-link]')
    page.answerMe('signed out')
    await showPage(true)

    expect({
      link: backLink(),
      sameNode: document.querySelector('main [data-back-link]') === signedInLink,
    }).toEqual({
      link: { text: homeBackLinkText, href: '/', arrowFirst: true },
      sameNode: true,
    })
  })

  test('a click on the link hands OpenPanel no event', async () => {
    vi.stubEnv('VITE_OPENPANEL_API_URL', openPanelApiUrl)
    const page = await toolPage()
    page.fonts.resolve()
    await settle()
    const link = document.querySelector<HTMLAnchorElement>('main [data-back-link]')
    // happy-dom may follow the link; the test reads only the events.
    link?.addEventListener('click', (event) => event.preventDefault())
    const before = page.panels().at(-1)?.tracked.length
    link?.click()
    await settle()

    expect({
      found: link !== null,
      clientBuilt: page.panels().length > 0,
      tracked: page.panels().at(-1)?.tracked.length,
    }).toEqual({ found: true, clientBuilt: true, tracked: before })
  })
})

describe('a homepage shown again from the back-forward cache', () => {
  test('a page left signed out asks /api/me again and shows the visitor signed in', async () => {
    const page = await homepage({ me: 'signed out' })
    page.fonts.resolve()
    await settle()
    page.answerMe('signed in')
    await showPage(false)

    expect({ reads: page.meReads(), avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      reads: 1,
      avatar: false,
      link: false,
    })

    await showPage(true)

    expect({ reads: page.meReads(), avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      reads: 2,
      avatar: true,
      link: true,
    })
  })

  test('a page left signed in, and still signed in, keeps one avatar and its dashboard link', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    await showPage(true)

    expect({
      reads: page.meReads(),
      avatars: document.querySelectorAll('[data-avatar-place] a.avatar').length,
      link: dashboardLinkShown(),
    }).toEqual({ reads: 2, avatars: 1, link: true })
  })

  test('a page left signed in, restored after a sign-in as another account, shows the newest account on its avatar', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    page.answerMe(async () => Response.json(otherUser))
    await showPage(true)
    const avatars = document.querySelectorAll('[data-avatar-place] a.avatar')

    expect({
      reads: page.meReads(),
      avatars: avatars.length,
      letter: avatars[0]?.textContent,
      label: avatars[0]?.getAttribute('aria-label'),
    }).toEqual({
      reads: 2,
      avatars: 1,
      letter: 'Z',
      label: 'Open Stillstats, signed in as zoe@example.com',
    })
  })

  test('a page left signed in, and signed out since, gives the hero its sign-in back', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    page.answerMe('signed out')
    await showPage(true)
    const signIn = document.querySelector<HTMLElement>('#hero [data-sign-in]')
    signIn?.click()

    expect({
      avatar: avatarShown(),
      link: dashboardLinkShown(),
      noticeShown: !signIn?.nextElementSibling?.classList.contains('notice-agreed'),
      signInsStarted: page.signInsStarted(),
    }).toEqual({ avatar: false, link: false, noticeShown: true, signInsStarted: 1 })
  })

  test.each([
    ['answers 500', async () => new Response(null, { status: 500 })],
    ['answers 429', async () => new Response(null, { status: 429 })],
    [
      'cannot be reached',
      async (): Promise<Response> => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('a page left signed in keeps its avatar and dashboard link when /api/me %s', async (_, me) => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    page.answerMe(me)
    await showPage(true)

    expect({ reads: page.meReads(), avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      reads: 2,
      avatar: true,
      link: true,
    })
  })

  test('an answer that arrives after a newer one changes nothing', async () => {
    const loadAnswers = deferred()
    const page = await homepage({
      me: async () => {
        await loadAnswers.promise
        return new Response(null, { status: 401 })
      },
    })
    page.fonts.resolve()
    page.answerMe('signed in')
    await showPage(true)
    loadAnswers.resolve()
    await settle()

    expect({ avatar: avatarShown(), link: dashboardLinkShown() }).toEqual({
      avatar: true,
      link: true,
    })
  })

  test('focus on "Open your dashboard" moves to the sign-in button a sign-out restore puts back', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    const link = document.querySelector<HTMLAnchorElement>('#hero a.button[href="/app"]')
    link?.focus()
    page.answerMe('signed out')
    await showPage(true)
    const signIn = document.querySelector<HTMLElement>('#hero [data-sign-in]')

    expect({
      linkInDocument: link?.isConnected,
      focused:
        document.activeElement === signIn ? 'Sign in with Google' : document.activeElement?.tagName,
    }).toEqual({ linkInDocument: false, focused: 'Sign in with Google' })
  })

  test('focus on "Sign in with Google" moves to the dashboard link a sign-in restore puts there', async () => {
    const page = await homepage({ me: 'signed out' })
    page.fonts.resolve()
    await settle()
    const signIn = document.querySelector<HTMLElement>('#hero [data-sign-in]')
    signIn?.focus()
    page.answerMe('signed in')
    await showPage(true)
    const link = document.querySelector<HTMLAnchorElement>('#hero a.button[href="/app"]')

    expect({
      signInInDocument: signIn?.isConnected,
      focused:
        document.activeElement === link ? 'Open your dashboard' : document.activeElement?.tagName,
    }).toEqual({ signInInDocument: false, focused: 'Open your dashboard' })
  })

  test('a restore that swaps the hero leaves focus elsewhere on the page where it was', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    const wordmark = document.querySelector<HTMLAnchorElement>('a.wordmark')
    wordmark?.focus()
    page.answerMe('signed out')
    await showPage(true)

    expect({
      signIn: document.querySelector('#hero [data-sign-in]') !== null,
      focused:
        document.activeElement === wordmark ? 'the wordmark' : document.activeElement?.tagName,
    }).toEqual({ signIn: true, focused: 'the wordmark' })
  })

  test('focus on the header avatar moves to the wordmark when a sign-out restore takes the avatar away', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    const avatar = document.querySelector<HTMLAnchorElement>('[data-avatar-place] a.avatar')
    avatar?.focus()
    page.answerMe('signed out')
    await showPage(true)
    const wordmark = document.querySelector<HTMLElement>('.site-header a.wordmark')

    expect({
      avatarWasFocusable: avatar !== null,
      avatarInDocument: avatar?.isConnected,
      focused:
        document.activeElement === wordmark ? 'the wordmark' : document.activeElement?.tagName,
    }).toEqual({ avatarWasFocusable: true, avatarInDocument: false, focused: 'the wordmark' })
  })

  test('a sign-out restore leaves focus on a link elsewhere on the page where it was', async () => {
    const page = await homepage()
    page.fonts.resolve()
    await settle()
    const principles = document.querySelector<HTMLAnchorElement>('main a[href="/principles"]')
    principles?.focus()
    page.answerMe('signed out')
    await showPage(true)

    expect({
      avatar: avatarShown(),
      focused:
        document.activeElement === principles
          ? 'Read the principles'
          : document.activeElement?.tagName,
    }).toEqual({ avatar: false, focused: 'Read the principles' })
  })

  test('a restore read that cannot tell leaves the earlier answer that can to show', async () => {
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

describe("the site's OpenPanel client", () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OPENPANEL_API_URL', openPanelApiUrl)
  })

  test("is built with the client ID from the client settings and the build's API URL", async () => {
    const page = await homepage({
      settings: { ...clientSettings, openPanelClientId: 'staging-id' },
    })

    expect(page.panels().map(({ options }) => options)).toEqual([
      { clientId: 'staging-id', apiUrl: openPanelApiUrl, trackScreenViews: true },
    ])
  })

  test('is never built when the client settings carry no client ID', async () => {
    const page = await homepage({ settings: { ...clientSettings, openPanelClientId: null } })

    expect(page.panels()).toEqual([])
  })

  test('is never built when the build names no OpenPanel API, which would send to its cloud', async () => {
    vi.stubEnv('VITE_OPENPANEL_API_URL', '')
    const page = await homepage()

    expect(page.panels()).toEqual([])
  })

  test('a sign-in click before the client settings land starts the sign-in at once, and its sign_in_clicked reaches the client once they do', async () => {
    const settingsLand = deferred()
    const page = await homepage({ me: 'signed out', settingsLand: settingsLand.promise })

    document.querySelector<HTMLElement>('[data-sign-in]')?.click()
    await settle()
    const startedBeforeSettings = page.signInsStarted()
    settingsLand.resolve()
    await settle()

    expect({ startedBeforeSettings, tracked: page.panels().map(({ tracked }) => tracked) }).toEqual(
      { startedBeforeSettings: 1, tracked: [[['sign_in_clicked']]] },
    )
  })

  test("a sign-in click on the tool page carries the page's source, and one on the homepage carries none", async () => {
    const tool = await toolPage({ me: 'signed out' })
    document.querySelector<HTMLElement>('[data-sign-in]')?.click()
    await settle()
    // Both pages build their client from the one mocked SDK, so each page's is the newest built.
    const fromToolPage = tool.panels().at(-1)?.tracked

    const home = await homepage({ me: 'signed out' })
    document.querySelector<HTMLElement>('[data-sign-in]')?.click()
    await settle()
    const fromHomepage = home.panels().at(-1)?.tracked

    expect({ fromToolPage, fromHomepage }).toEqual({
      fromToolPage: [['sign_in_clicked', { source: 'thumbnail-preview' }]],
      fromHomepage: [['sign_in_clicked']],
    })
  })

  // creator-analytics#888: main.ts is the one script every page loads, so it starts the header's
  // navigation, and a click on each of its four links reaches the client as `site_nav_clicked`.
  test('a click on each navigation link reaches the client as site_nav_clicked with its link, and opening the Extensions menu sends nothing', async () => {
    const page = await homepage({ me: 'signed out' })
    const header = document.querySelector('.site-header')
    // happy-dom may follow a link, a new-tab one among them; the test reads only the events.
    header?.addEventListener('click', (event) => event.preventDefault(), { capture: true })
    const extensions = [...document.querySelectorAll('.site-header nav button')].find(
      (button) => button.textContent?.trim() === 'Extensions',
    )
    ;(extensions as HTMLElement | undefined)?.click()
    for (const name of [
      'Thumbnail preview',
      'Mid-Roll Manager',
      'Stillstats for Chrome',
      'Stillstats for Firefox',
    ]) {
      const link = [...document.querySelectorAll<HTMLAnchorElement>('.site-header nav a')].find(
        (each) => each.textContent?.trim() === name,
      )
      link?.click()
    }
    await settle()

    expect(page.panels().at(-1)?.tracked).toEqual([
      ['site_nav_clicked', { link: 'thumbnail-preview' }],
      ['site_nav_clicked', { link: 'mid-roll-manager' }],
      ['site_nav_clicked', { link: 'chrome-extension' }],
      ['site_nav_clicked', { link: 'firefox-extension' }],
    ])
  })

  // creator-analytics#907: the Pro card's "Subscribe" opens the upgrade screen, signed in or not:
  // the web app at /app/upgrade signs a visitor in first, and connects a new one's channel. Its
  // click reaches the client as `upgrade_link_clicked` from the homepage, the event the web app's
  // sidebar item sends from the sidebar, and the link is left to the browser.
  test.each(['signed in', 'signed out'] as const)(
    "%s, the Pro card's Subscribe stays a link to /app/upgrade, and a click on it reaches the client as upgrade_link_clicked from the homepage and is left to the browser",
    async (me) => {
      const page = await homepage({ me })
      await page.fonts.resolve()
      await settle()
      const subscribe = document.querySelector<HTMLAnchorElement>('#pricing a[data-upgrade-link]')
      let leftToTheBrowser = false
      const keepPage = (event: Event) => {
        leftToTheBrowser = !event.defaultPrevented
        event.preventDefault()
      }
      document.addEventListener('click', keepPage)
      try {
        subscribe?.click()
        await settle()
      } finally {
        document.removeEventListener('click', keepPage)
      }

      expect({
        href: subscribe?.getAttribute('href'),
        text: subscribe?.textContent,
        leftToTheBrowser,
        signInsStarted: page.signInsStarted(),
        tracked: page.panels().at(-1)?.tracked,
      }).toEqual({
        href: '/app/upgrade',
        text: 'Subscribe',
        leftToTheBrowser: true,
        signInsStarted: 0,
        tracked: [['upgrade_link_clicked', { source: 'homepage' }]],
      })
    },
  )
})
