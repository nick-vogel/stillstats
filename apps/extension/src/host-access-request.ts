export type AddHostAccessRequest = (request: { tabId: number }) => Promise<void>

/**
 * Asks Chrome to show the extension's access request beside the extensions icon on a tab while the
 * creator withholds host access. The background script cannot read the URL of a tab whose host
 * access is withheld, having no `tabs` permission, so it passes no pattern: Chrome shows the
 * request only on a tab whose host the manifest's host access names.
 *
 * Asks on every open tab as the background starts, since a tab open across an install, an update
 * or a re-enable fires no load event, and Chrome names no event for a re-enable. Settles once
 * that first ask has, and a failed permission or tab query asks for nothing.
 */
export async function watchWithheldHostAccess({
  addHostAccessRequest,
  hostAccess,
  openTabIds,
  onTabLoaded,
  onHostAccessRemoved,
}: {
  /** Chrome 133 and later; `undefined` in Firefox and older Chrome, which watch nothing. */
  addHostAccessRequest: AddHostAccessRequest | undefined
  hostAccess: () => Promise<boolean>
  openTabIds: () => Promise<number[]>
  onTabLoaded: (listener: (tabId: number) => Promise<void>) => void
  onHostAccessRemoved: (listener: () => Promise<void>) => void
}): Promise<void> {
  if (addHostAccessRequest === undefined) return

  const requestWithheldHostAccess = async (tabIds: number[]): Promise<void> => {
    if (tabIds.length === 0 || (await hostAccess())) return
    // Chrome refuses a request on a tab whose site the extension can already read (one host
    // granted, another withheld), a repeat inside its throttle, or a tab that has closed. None has
    // anything for the creator to act on. `askQuietly` would quiet a refusal anyway; catching each
    // one here lets the ask settle once every tab has answered, not at the first refusal.
    await Promise.all(tabIds.map((tabId) => addHostAccessRequest({ tabId }).catch(() => {})))
  }

  const requestOnOpenTabs = async (): Promise<void> => requestWithheldHostAccess(await openTabIds())

  // `background.ts` runs every ask under `void`, so a permission or tab query that rejects would be
  // an unhandled rejection. A later tab load or removed permission asks again.
  const askQuietly = async (ask: () => Promise<void>): Promise<void> => {
    try {
      await ask()
    } catch {}
  }

  // Registered before the first await, or Chrome's service worker misses the event that woke it.
  onTabLoaded((tabId) => askQuietly(() => requestWithheldHostAccess([tabId])))
  // An open Studio tab gets the request when the creator withholds access, without a reload.
  onHostAccessRemoved(() => askQuietly(requestOnOpenTabs))
  return askQuietly(requestOnOpenTabs)
}
