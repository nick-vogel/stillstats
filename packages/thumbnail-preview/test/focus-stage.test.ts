// @vitest-environment happy-dom
// Limits: happy-dom evaluates no stylesheet, so these tests see the attributes and classes focus
// mode sets, never that `.t-focus-hidden` hides anything or that the stage reaches the window's
// edges. The browser walk reads both on the built tool page, in light and dark mode.
import { beforeEach, describe, expect, test } from 'vitest'
import { enterFocusStage } from '../src/focus-stage.ts'

/**
 * The tool page's shape: the site's header and footer, the page copy around the mount, and two
 * scripts after the footer, as data so happy-dom does not try to load them.
 */
function toolPage(): HTMLElement {
  document.body.innerHTML = `
    <header class="site-header"><a href="/">stillstats</a></header>
    <main class="tool-page">
      <h1>Heading</h1>
      <p class="tool-privacy">Privacy</p>
      <div id="thumbnail-tool"><div class="t-toolroot"><div class="t-toolbar"></div><div class="t-rails"></div></div></div>
      <div class="tool-prose"><p>Prose</p></div>
      <section class="sign-in-band"><button type="button">Sign in</button></section>
    </main>
    <footer class="site-footer"></footer>
    <script type="application/json" data-page-script="main"></script>
    <script type="application/json" data-page-script="tool"></script>
  `
  const root = document.querySelector<HTMLElement>('.t-toolroot')
  if (!root) throw new Error('The fixture has no tool root')
  return root
}

const select = (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`The fixture has no ${selector}`)
  return element
}

const aroundTheTool = [
  'body > header',
  '.tool-page > h1',
  '.tool-privacy',
  '.tool-prose',
  '.sign-in-band',
  'body > footer',
  'script[data-page-script="main"]',
  'script[data-page-script="tool"]',
]

/** Every element's attributes and classes, so a stage left behind on any node shows. */
const snapshot = () =>
  [document.documentElement, ...document.documentElement.querySelectorAll<HTMLElement>('*')].map(
    (element) => `${element.tagName} ${element.getAttribute('class') ?? ''} ${element.inert}`,
  )

beforeEach(() => {
  document.documentElement.className = ''
})

describe('the focus stage', () => {
  test('entering hides and inerts everything on the page around the tool', () => {
    enterFocusStage(toolPage())

    expect(
      aroundTheTool.map((selector) => ({
        selector,
        inert: select(selector).inert,
        hidden: select(selector).classList.contains('t-focus-hidden'),
      })),
    ).toEqual(aroundTheTool.map((selector) => ({ selector, inert: true, hidden: true })))
  })

  test("entering makes the tool's ancestors hosts and locks the document, and leaves the tool alone", () => {
    const root = toolPage()
    enterFocusStage(root)

    expect({
      mount: select('#thumbnail-tool').classList.contains('t-focus-host'),
      main: select('main').classList.contains('t-focus-host'),
      body: document.body.classList.contains('t-focus-host'),
      locked: document.documentElement.classList.contains('t-focus-locked'),
      root: root.inert || root.classList.contains('t-focus-hidden'),
      rootChildren: [...root.querySelectorAll<HTMLElement>('*')].some(
        (element) => element.inert || element.classList.contains('t-focus-hidden'),
      ),
    }).toEqual({
      mount: true,
      main: true,
      body: false,
      locked: true,
      root: false,
      rootChildren: false,
    })
  })

  test('the undo leaves the document as it was before entry', () => {
    const root = toolPage()
    const before = snapshot()

    enterFocusStage(root)()

    expect(snapshot()).toEqual(before)
  })

  test('an element already inert before entry is still inert after the undo', () => {
    const root = toolPage()
    const band = select('.sign-in-band')
    band.inert = true

    enterFocusStage(root)()

    expect(band.inert).toBe(true)
  })

  test('a root outside the document changes nothing, so the stage is never half applied', () => {
    toolPage()
    const before = snapshot()
    const detached = document.createElement('div')

    enterFocusStage(detached)()

    expect(snapshot()).toEqual(before)
  })
})
