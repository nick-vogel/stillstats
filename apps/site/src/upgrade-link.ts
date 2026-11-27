/**
 * The homepage Pro card's "Subscribe" (creator-analytics#907): a plain link to the web app's
 * upgrade screen, `/app/upgrade`, which opens for the channel the web app opens first. A
 * signed-out visitor gets the web app's sign-in screen there, whose sign-in lands back on it, and a
 * new visitor connects a channel on the way. The page never swaps it for another link, signed in or
 * not, so it needs no session check of its own.
 */
export type UpgradeLinkClickedEvent = {
  name: 'upgrade_link_clicked'
  properties: { source: 'homepage' }
}

/**
 * The event a click on the link sends: the web app's own event for its sidebar item
 * (`upgradeLinkClickedEvent` in the web app's `upgrade-prompt.ts`, which the site's test holds it
 * to), from the homepage, with no plan, price, channel or account.
 */
export function homepageUpgradeLinkClickedEvent(): UpgradeLinkClickedEvent {
  return { name: 'upgrade_link_clicked', properties: { source: 'homepage' } }
}

/**
 * Calls `track` on each click of a link marked `data-upgrade-link` in `root`, and leaves the click
 * to the browser. Answers a function that takes every listener off again.
 */
export function startUpgradeLinks(root: Document, track: () => void): () => void {
  const listening = new AbortController()
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-upgrade-link]')) {
    link.addEventListener('click', track, { signal: listening.signal })
  }
  return () => listening.abort()
}
