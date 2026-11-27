// @vitest-environment happy-dom
// Limits: these tests run site-nav.ts in happy-dom on the header partial as written, which lays
// nothing out, so none shows where a menu draws, that the Menu button shows only below 48rem, or
// that a real press reaches the button. The browser walk opens and closes both menus by mouse and
// by keyboard in Chrome, at 1280px and at 375px (creator-analytics#888).
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { freeTools, newTabLabelOf } from '../../web/src/account-menu.ts'
import { type SiteNavLink, siteNavClickedEvent, startSiteNav } from './site-nav.ts'

const header = await readFile(fileURLToPath(import.meta.resolve('../partials/header.html')), 'utf8')

let stop = () => {}
let tracked: SiteNavLink[] = []

beforeEach(() => {
  document.body.innerHTML = `${header}<main><p>Page text</p><a href="/privacy">Elsewhere</a></main>`
  tracked = []
  stop = startSiteNav(document, (link) => tracked.push(link))
})

afterEach(() => {
  stop()
  vi.restoreAllMocks()
})

function button(name: 'Extensions' | 'Menu'): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('.site-header nav button')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (!found) throw new Error(`No ${name} button in the header`)
  return found
}

function controlledBy(control: HTMLButtonElement): HTMLElement {
  const id = control.getAttribute('aria-controls') ?? ''
  const element = document.getElementById(id)
  if (!element) throw new Error(`Nothing named ${id} for the button to open`)
  return element
}

/** Whether the button reads open and its menu shows, as one line, so a mismatch reads plainly. */
function stateOf(name: 'Extensions' | 'Menu'): string {
  const control = button(name)
  return `${control.getAttribute('aria-expanded')} ${controlledBy(control).hidden ? 'hidden' : 'shown'}`
}

function pressKey(key: string, on: Element = document.activeElement ?? document.body): void {
  on.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe.each(['Extensions', 'Menu'] as const)('the %s disclosure button', (name) => {
  test('starts closed, opens on a press and closes on a second press', () => {
    const start = stateOf(name)
    button(name).click()
    const opened = stateOf(name)
    button(name).click()

    expect({ start, opened, closed: stateOf(name) }).toEqual({
      start: 'false hidden',
      opened: 'true shown',
      closed: 'false hidden',
    })
  })

  test('closes on Escape from inside its menu, and focus returns to the button', () => {
    button(name).click()
    const inside = controlledBy(button(name)).querySelector('a')
    inside?.focus()
    pressKey('Escape')

    expect({ state: stateOf(name), focused: document.activeElement === button(name) }).toEqual({
      state: 'false hidden',
      focused: true,
    })
  })

  test('closes on Escape with focus on the button itself, which keeps focus', () => {
    button(name).focus()
    button(name).click()
    pressKey('Escape')

    expect({ state: stateOf(name), focused: document.activeElement === button(name) }).toEqual({
      state: 'false hidden',
      focused: true,
    })
  })

  test('closes on Escape with focus elsewhere on the page, which keeps focus there', () => {
    button(name).click()
    const opened = stateOf(name)
    const elsewhere = document.querySelector<HTMLAnchorElement>('main a')
    elsewhere?.focus()
    pressKey('Escape')

    expect({ opened, state: stateOf(name), focused: document.activeElement === elsewhere }).toEqual(
      {
        opened: 'true shown',
        state: 'false hidden',
        focused: true,
      },
    )
  })

  test('closes on a click outside it, and focus stays where the click put it', () => {
    button(name).click()
    const elsewhere = document.querySelector<HTMLAnchorElement>('main a')
    elsewhere?.addEventListener('click', (event) => event.preventDefault())
    elsewhere?.focus()
    elsewhere?.click()

    expect({ state: stateOf(name), focused: document.activeElement === elsewhere }).toEqual({
      state: 'false hidden',
      focused: true,
    })
  })

  test('stays open on a click inside its menu', () => {
    button(name).click()
    controlledBy(button(name)).click()

    expect(stateOf(name)).toBe('true shown')
  })

  test('a key other than Escape leaves it open', () => {
    button(name).click()
    pressKey('Enter', button(name))

    expect(stateOf(name)).toBe('true shown')
  })
})

test('opening one disclosure closes the other', () => {
  button('Extensions').click()
  button('Menu').click()
  const menuOpened = { extensions: stateOf('Extensions'), menu: stateOf('Menu') }
  button('Extensions').click()

  expect({
    menuOpened,
    extensionsOpened: { extensions: stateOf('Extensions'), menu: stateOf('Menu') },
  }).toEqual({
    menuOpened: { extensions: 'false hidden', menu: 'true shown' },
    extensionsOpened: { extensions: 'true shown', menu: 'false hidden' },
  })
})

test('opening and closing a menu tracks nothing', () => {
  for (const name of ['Extensions', 'Menu'] as const) {
    button(name).click()
    pressKey('Escape', button(name))
    button(name).click()
    document.body.click()
  }

  expect(tracked).toEqual([])
})

test('a click on each navigation link, wide and in the Menu panel, tracks its link', () => {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.site-header nav a')]
  for (const link of links) {
    // happy-dom would follow the link; the test reads only the event.
    link.addEventListener('click', (event) => event.preventDefault())
    link.click()
  }

  expect({ links: links.length, tracked }).toEqual({
    links: 8,
    tracked: [
      'thumbnail-preview',
      'mid-roll-manager',
      'chrome-extension',
      'firefox-extension',
      'thumbnail-preview',
      'mid-roll-manager',
      'chrome-extension',
      'firefox-extension',
    ],
  })
})

test('the wordmark and the avatar place track nothing', () => {
  const wordmark = document.querySelector<HTMLAnchorElement>('.site-header a.wordmark')
  wordmark?.addEventListener('click', (event) => event.preventDefault())
  wordmark?.click()

  expect(tracked).toEqual([])
})

test('the script writes no style attribute, which the policy would block', () => {
  for (const name of ['Extensions', 'Menu'] as const) {
    button(name).click()
    button(name).click()
  }

  expect(document.querySelectorAll('.site-header [style]').length).toBe(0)
})

test('once stopped, a press on the document closes nothing and Escape does nothing', () => {
  button('Extensions').click()
  stop()
  stop = () => {}
  document.body.click()
  pressKey('Escape', button('Extensions'))

  expect(stateOf('Extensions')).toBe('true shown')
})

test('site_nav_clicked carries the link as its one property', () => {
  expect(siteNavClickedEvent('chrome-extension')).toEqual({
    name: 'site_nav_clicked',
    properties: { link: 'chrome-extension' },
  })
})

// The site writes its new-tab names in static HTML, so this holds them to the web app's own helper,
// and the Mid-Roll Manager link to the web app's free tools list, so the two apps cannot drift.
// site.test.ts holds the built pages' links to the same names.
test("every new-tab link in the header carries the web app's new-tab name for its text, and Mid-Roll Manager links where the web app's free tools list does", () => {
  const newTabLinks = [...document.querySelectorAll<HTMLAnchorElement>('.site-header a')].filter(
    (link) => link.target === '_blank',
  )
  const midRollManager = freeTools.find(({ tool }) => tool === 'mid-roll-manager')
  const midRollManagerLinks = newTabLinks.filter(
    (link) => link.textContent?.trim() === midRollManager?.name,
  )

  expect({
    newTabLinks: newTabLinks.length,
    names: newTabLinks.filter(
      (link) => link.getAttribute('aria-label') !== newTabLabelOf(link.textContent?.trim() ?? ''),
    ),
    midRollManagerHrefs: midRollManagerLinks.map((link) => link.getAttribute('href')),
  }).toEqual({
    newTabLinks: 6,
    names: [],
    midRollManagerHrefs: [midRollManager?.href, midRollManager?.href],
  })
})
