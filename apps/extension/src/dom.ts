export function element(
  document: Document,
  tag: string,
  { text, className }: { text?: string | undefined; className?: string | undefined } = {},
): HTMLElement {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// `noopener` keeps the opened stillstats.com tab from reaching Studio's window or the popup through
// `window.opener`. `noreferrer` keeps the Referer header from carrying the Studio page's URL, whose
// path holds channel and video ids, to stillstats.com. `noreferrer` implies `noopener`, but both
// are written so each reason stays stated.
const newTabRel = 'noopener noreferrer'

/** Opens in a new tab, so Studio and the extension's own pages stay open. */
export function newTabLink(
  document: Document,
  { text, href }: { text: string; href: string },
): HTMLAnchorElement {
  const link = document.createElement('a')
  link.href = href
  link.target = '_blank'
  link.rel = newTabRel
  link.textContent = text
  return link
}

/** Calls `opened` when the creator opens `anchor`, with a click or a middle-click, without stopping the browser opening the tab. */
export function whenOpened(anchor: HTMLAnchorElement, opened: () => void): HTMLAnchorElement {
  anchor.addEventListener('click', opened)
  // A middle-click opens the link in a new tab but fires `auxclick`, not `click`.
  anchor.addEventListener('auxclick', (event) => {
    if (event.button === 1) opened()
  })
  return anchor
}
