import type { ExtensionEvent } from '@creator-analytics/api-types'
import type { Browser } from 'wxt/browser'
import type { AskBackground } from './messages.ts'

/**
 * YouTube access (ADR 0016): the optional host permission for www.youtube.com, asked for from the
 * popup's toggle and never at install. The manifest names it only in `optional_host_permissions`.
 */
export const youtubeOrigins = ['https://www.youtube.com/*']

/** The id the background registers the youtube.com content script under. */
export const youtubeContentScriptId = 'youtube'

/** The file WXT writes `src/entrypoints/youtube.content.ts` to, which the background registers. */
export const youtubeContentScriptFile = 'content-scripts/youtube.js'

export interface YouTubeAccess {
  granted: () => Promise<boolean>
  request: () => Promise<boolean>
  remove: () => Promise<boolean>
}

/**
 * The one answer to whether the creator grants YouTube access, and the way to ask for it or give
 * it up. The popup's toggle and the background both read it here.
 */
export function youtubeAccessOf({
  permissions,
}: {
  permissions: Pick<typeof Browser.permissions, 'contains' | 'request' | 'remove'>
}): YouTubeAccess {
  return {
    granted: () => permissions.contains({ origins: youtubeOrigins }),
    // Asks on the call itself, with no await before it, so a click that calls it keeps the
    // request inside the user gesture both browsers require.
    request: () => permissions.request({ origins: youtubeOrigins }),
    remove: () => permissions.remove({ origins: youtubeOrigins }),
  }
}

/** The part of a browser's `scripting` the background keeps the youtube.com script with. */
export interface YouTubeScripting {
  registerContentScripts(
    scripts: { id: string; matches: string[]; js: string[]; runAt: 'document_idle' }[],
  ): Promise<void>
  unregisterContentScripts(filter: { ids: string[] }): Promise<void>
  getRegisteredContentScripts(filter: { ids: string[] }): Promise<{ id: string }[]>
  executeScript(injection: { target: { tabId: number }; files: string[] }): Promise<unknown>
}

/** What `permissions.onAdded` and `onRemoved` hand their listeners, in both browsers. */
export interface PermissionsChange {
  origins?: string[] | undefined
}

/**
 * Keeps the youtube.com content script registered exactly while the creator grants YouTube
 * access, however the grant changed: the popup's toggle or the browser's own settings. A grant
 * registers the script and injects it into the www.youtube.com tabs already open, a removal
 * unregisters it and tells the open tabs, so a www.youtube.com tab's script stops without a reload,
 * and each sends its usage event through `settle`, which applies Firefox's consent. Settles once
 * the start repair has. Never rejects: `background.ts` runs it under `void`.
 */
export async function keepYouTubeAccessInStep({
  access,
  scripting,
  openYouTubeTabIds,
  tellOpenTabs,
  onAccessAdded,
  onAccessRemoved,
  settle,
}: {
  access: Pick<YouTubeAccess, 'granted'>
  scripting: YouTubeScripting
  /** Finds open www.youtube.com tabs, which the grant itself lets the background query. */
  openYouTubeTabIds: () => Promise<number[]>
  /**
   * Sends `message` to the open tabs. Without the grant the background cannot tell which tabs are
   * on www.youtube.com, so `tellEveryTab` sends it to every tab and ignores each refusal.
   */
  tellOpenTabs: (message: typeof youtubeAccessRemovedMessage) => Promise<void>
  onAccessAdded: (listener: (change: PermissionsChange) => void) => void
  onAccessRemoved: (listener: (change: PermissionsChange) => void) => void
  settle: (event: ExtensionEvent) => Promise<unknown>
}): Promise<void> {
  const registered = async (): Promise<boolean> =>
    (await scripting.getRegisteredContentScripts({ ids: [youtubeContentScriptId] })).length > 0

  // A tab loaded while the script was not registered has none, so a grant injects it. Every tab is
  // asked at once, so one that closed or navigated away refuses without stopping the others.
  const injectIntoOpenTabs = async (): Promise<void> => {
    const tabIds = await openYouTubeTabIds()
    await Promise.all(
      tabIds.map((tabId) =>
        scripting.executeScript({ target: { tabId }, files: [youtubeContentScriptFile] }),
      ),
    )
  }

  const register = async (): Promise<void> => {
    if (await registered()) return
    await scripting.registerContentScripts([
      {
        id: youtubeContentScriptId,
        matches: youtubeOrigins,
        js: [youtubeContentScriptFile],
        runAt: 'document_idle',
      },
    ])
  }

  const unregister = async (): Promise<void> => {
    if (!(await registered())) return
    await scripting.unregisterContentScripts({ ids: [youtubeContentScriptId] })
  }

  // Each check-then-change runs after the last has settled, so a grant during the start repair
  // finds the script the repair registered rather than registering it twice. A step that fails
  // leaves the registration to the next start's repair.
  let steps = Promise.resolve()
  const inTurn = (step: () => Promise<void>): Promise<void> => {
    steps = steps.then(step).catch(() => {})
    return steps
  }

  const quietly = async (send: () => Promise<unknown>): Promise<void> => {
    try {
      await send()
    } catch {}
  }

  // Told after the unregister, whether or not it succeeded, and in turn, so a grant just after a
  // removal injects its new script only once the old one has heard the removal: the new one would
  // otherwise hear it and stop too.
  const unregisterAndTell = async (): Promise<void> => {
    try {
      await unregister()
    } finally {
      await quietly(() => tellOpenTabs(youtubeAccessRemovedMessage))
    }
  }

  // Studio, stillstats.com and Firefox's `data_collection` changes reach the same listeners.
  const namesYouTube = (change: PermissionsChange): boolean =>
    youtubeOrigins.every((origin) => change.origins?.includes(origin))

  // Registered before the first await, or Chrome's service worker misses the event that woke it.
  onAccessAdded((change) => {
    if (!namesYouTube(change)) return
    void inTurn(async () => {
      await register()
      await injectIntoOpenTabs()
    })
    void quietly(() => settle({ name: 'extension_youtube_access_granted' }))
  })
  onAccessRemoved((change) => {
    if (!namesYouTube(change)) return
    void inTurn(unregisterAndTell)
    void quietly(() => settle({ name: 'extension_youtube_access_removed' }))
  })

  // The browser may drop a registration, or keep one across a removal the background missed while
  // it was not running. A repair cannot tell when the grant changed, so it sends no event: the
  // events record the browser's own `onAdded` and `onRemoved`.
  return inTurn(async () => {
    const granted = await access.granted()
    const isRegistered = await registered()
    if (granted && !isRegistered) {
      await register()
      await injectIntoOpenTabs()
    } else if (!granted && isRegistered) {
      // A removal the background missed while it was not running.
      await unregisterAndTell()
    }
  })
}

/**
 * What the background sends every open tab once YouTube access is removed. A www.youtube.com tab
 * keeps the script it was given until it reloads, and without the grant the background can neither
 * find that tab nor take the script out of it, so the tab's own script stops itself.
 */
export const youtubeAccessRemovedMessage = { type: 'youtube-access-removed' } as const

export function isYouTubeAccessRemoved(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === youtubeAccessRemovedMessage.type
  )
}

/** The part of `runtime.onMessage` a content script hears the background's messages through. */
export interface RuntimeMessages {
  addListener(listener: (message: unknown) => void): void
  removeListener(listener: (message: unknown) => void): void
}

/**
 * Has the youtube.com content script `stop` on the background's removal message, and on that
 * message only. Answers the listener's remover. The listener answers nothing, so it holds no
 * message channel open.
 */
export function stopOnYouTubeAccessRemoved({
  onMessage,
  stop,
}: {
  onMessage: RuntimeMessages
  stop: () => void
}): () => void {
  const listener = (message: unknown): void => {
    if (isYouTubeAccessRemoved(message)) stop()
  }
  onMessage.addListener(listener)
  return () => onMessage.removeListener(listener)
}

/**
 * Answers the youtube.com content script's `pageshow` handler. A page held in the back/forward
 * cache cannot hear the background's removal message, so on a restore (`persisted`) the handler
 * asks the background whether YouTube access is still granted and calls `stop` on any answer but
 * `true`, a failed ask included: a page that cannot confirm the grant shows nothing. A `pageshow`
 * that is not a restore asks nothing. The handler never rejects.
 */
export function stopOnRestoreWithoutYouTubeAccess({
  ask,
  stop,
}: {
  ask: AskBackground
  stop: () => void
}): (event: { persisted: boolean }) => void {
  return (event) => {
    if (!event.persisted) return
    void (async () => {
      let granted: unknown = false
      try {
        granted = await ask({ type: 'youtube-access' })
      } catch {}
      if (granted !== true) stop()
    })()
  }
}

/**
 * Sends a message to every open tab at once. The ids need no `tabs` permission. A tab with no
 * listener for it (Studio, any other site) refuses on its own, which leaves the others told, and
 * settles once every tab has answered or refused. Never rejects.
 */
export function tellEveryTab({
  tabIds,
  sendToTab,
}: {
  tabIds: () => Promise<number[]>
  sendToTab: (tabId: number, message: unknown) => Promise<unknown>
}): (message: unknown) => Promise<void> {
  return async (message) => {
    try {
      const ids = await tabIds()
      await Promise.allSettled(ids.map(async (tabId) => sendToTab(tabId, message)))
    } catch {}
  }
}
