import type { ExtensionEvent } from '@creator-analytics/api-types'
import { newTabLink, whenOpened } from './dom.ts'
import type { AskBackground } from './messages.ts'
import type { PopupLink } from './popup.ts'

/**
 * Asks for a click's event once. An ask the background never answers rejects, and Chrome's
 * sendMessage throws before it returns a promise once the extension is updated under an open
 * popup; both are swallowed, so the click goes on and the event is lost.
 */
function sendOnce(ask: AskBackground, event: ExtensionEvent): void {
  try {
    ask({ type: 'usage-event', event }).catch(() => {})
  } catch {}
}

/** A popup link that opens in a new tab, and asks the background to send its usage event. */
export function linkElement({
  document,
  link: { text, href, clickEvent },
  ask,
  onClick,
}: {
  document: Document
  link: PopupLink
  ask: AskBackground
  onClick?: (() => void) | undefined
}): HTMLAnchorElement {
  function opened(): void {
    onClick?.()
    // Not awaited: the message leaves inside the click, before the browser opens the tab and
    // closes the popup.
    if (clickEvent) sendOnce(ask, clickEvent)
  }
  return whenOpened(newTabLink(document, { text, href }), opened)
}
