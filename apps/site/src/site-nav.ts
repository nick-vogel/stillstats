/**
 * The header's navigation on every site page (creator-analytics#888): the Extensions menu and the
 * small screen's Menu panel open and close, and a click on a link reports which. Plain DOM, no
 * framework, inside ADR 0012 and ADR 0021. Each disclosure shows and hides its element through
 * `hidden` and never through a style attribute, which the policy's `style-src 'self'` would block.
 */

/** The value `site_nav_clicked` carries for each link, from the link's `data-nav-link`. */
export const siteNavLinks = [
  'thumbnail-preview',
  'mid-roll-manager',
  'chrome-extension',
  'firefox-extension',
] as const

export type SiteNavLink = (typeof siteNavLinks)[number]

export type SiteNavClickedEvent = {
  name: 'site_nav_clicked'
  properties: { link: SiteNavLink }
}

/** The event a click on a navigation link sends. Opening or closing a menu sends nothing. */
export function siteNavClickedEvent(link: SiteNavLink): SiteNavClickedEvent {
  return { name: 'site_nav_clicked', properties: { link } }
}

function isSiteNavLink(value: string | undefined): value is SiteNavLink {
  return siteNavLinks.some((link) => link === value)
}

type Disclosure = { button: HTMLButtonElement; menu: HTMLElement }

/**
 * Wires the header navigation's disclosure buttons and links in `root`. A press on a button opens
 * its menu and closes any other; a second press closes it. Escape closes the open menu, and when
 * focus was in the menu or on its button, focus goes to the button. A click outside the button and
 * its menu closes it and leaves focus where the click put it. A click on a link calls `track` with
 * its link. Answers a function that takes every listener off again.
 */
export function startSiteNav(root: Document, track: (link: SiteNavLink) => void): () => void {
  const listening = new AbortController()
  const { signal } = listening
  const nav = root.querySelector('.site-header nav')
  if (!nav) return () => listening.abort()

  const disclosures: Disclosure[] = []
  for (const button of nav.querySelectorAll<HTMLButtonElement>('button[aria-controls]')) {
    const menu = root.getElementById(button.getAttribute('aria-controls') ?? '')
    if (menu) disclosures.push({ button, menu })
  }

  const isOpen = ({ button }: Disclosure) => button.getAttribute('aria-expanded') === 'true'
  const setOpen = ({ button, menu }: Disclosure, open: boolean) => {
    button.setAttribute('aria-expanded', String(open))
    menu.hidden = !open
  }
  const holds = ({ button, menu }: Disclosure, node: Node | null) =>
    node !== null && (button.contains(node) || menu.contains(node))

  for (const disclosure of disclosures) {
    disclosure.button.addEventListener(
      'click',
      () => {
        const open = !isOpen(disclosure)
        for (const other of disclosures) if (other !== disclosure) setOpen(other, false)
        setOpen(disclosure, open)
      },
      { signal },
    )
  }

  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return
      for (const disclosure of disclosures.filter(isOpen)) {
        const focusInside = holds(disclosure, root.activeElement)
        setOpen(disclosure, false)
        if (focusInside) disclosure.button.focus()
      }
    },
    { signal },
  )

  root.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Node ? event.target : null
      for (const disclosure of disclosures.filter(isOpen)) {
        if (!holds(disclosure, target)) setOpen(disclosure, false)
      }
    },
    { signal },
  )

  for (const link of nav.querySelectorAll<HTMLAnchorElement>('a[data-nav-link]')) {
    const value = link.dataset.navLink
    if (!isSiteNavLink(value)) continue
    link.addEventListener('click', () => track(value), { signal })
  }

  return () => listening.abort()
}
