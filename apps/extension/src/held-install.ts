import type { ExtensionEvent } from '@creator-analytics/api-types'
import type { ChannelsRead, UploadsRead, VideosRead } from './product-api.ts'
import { showsSignedIn } from './signed-in-read.ts'

const installedEvent: ExtensionEvent = { name: 'extension_installed' }

/** Where the background keeps a held `extension_installed`. */
export interface InstallHold {
  held(): Promise<boolean>
  hold(): Promise<void>
  release(): Promise<void>
}

/**
 * `extension_installed`, sent once per install on the first read that shows the creator signed in,
 * and held in the browser until then (creator-analytics#126).
 */
export interface HeldInstallEvent {
  /**
   * The install's own channels read: a signed-in read sends the event at once, and any other read,
   * or a send the relay does not accept, holds it. Never rejects.
   */
  installRead(read: ChannelsRead): Promise<void>
  /**
   * A later read through the background, the popup's or a surface's: one that shows the creator
   * signed in sends a held event, and the hold clears only once the relay accepts it. Never rejects.
   */
  sendOn(read: ChannelsRead | VideosRead | UploadsRead): Promise<void>
}

export function heldInstallEvent({
  hold,
  usageEventsAllowed,
  sendEvent,
}: {
  hold: InstallHold
  usageEventsAllowed: () => Promise<boolean>
  sendEvent: (event: ExtensionEvent) => Promise<boolean>
}): HeldInstallEvent {
  /**
   * True only once the relay accepted the event. Unlike `usageEventSettled`, declined usage events
   * do not settle it: the hold waits for a read with them allowed (creator-analytics#126).
   */
  async function sent(): Promise<boolean> {
    try {
      if (!(await usageEventsAllowed())) return false
      return await sendEvent(installedEvent)
    } catch {
      return false
    }
  }

  async function sendHeld(): Promise<void> {
    try {
      if (!(await hold.held())) return
      if (await sent()) await hold.release()
    } catch {
      // A hold the store cannot read or release stays for the next read.
    }
  }

  // Lives only as long as this background, as the send it guards does.
  let sending: Promise<void> | undefined

  return {
    async installRead(read) {
      try {
        if (read.state === 'signed-in' && (await sent())) return
        await hold.hold()
      } catch {
        // A hold the store cannot keep is lost, and the install goes uncounted in OpenPanel.
      }
    },
    sendOn(read) {
      if (!showsSignedIn(read)) return Promise.resolve()
      // Reads that land together share one send, so they ask the relay once.
      sending ??= sendHeld().finally(() => {
        sending = undefined
      })
      return sending
    },
  }
}

const holdDatabase = 'stillstats'
const holdStore = 'held-events'
const installPendingKey = 'extension-installed-pending'

function openedHoldDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(holdDatabase, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(holdStore)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Resolves with the request's result once its transaction commits, and rejects if it aborts. */
async function inHoldStore<T>(
  indexedDB: IDBFactory,
  mode: IDBTransactionMode,
  requestOf: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openedHoldDatabase(indexedDB)
  try {
    return await new Promise<T>((resolve, reject) => {
      // Strict, so a hold counts as kept only once it is on disk, not just handed to the OS.
      const transaction = database.transaction(holdStore, mode, { durability: 'strict' })
      const request = requestOf(transaction.objectStore(holdStore))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

/**
 * The hold in the extension origin's IndexedDB, which Chrome's background service worker and
 * Firefox's background page both reach, needs no manifest permission (`storage` is for
 * `browser.storage` only), and outlives the background and a browser restart. The extension asks
 * for no `storage` permission, which would change what the store listings declare (#100). Chrome
 * documents that clearing browsing data leaves extension storage alone; Firefox documents that for
 * `storage.local` only, so a Firefox creator who clears site data may lose a hold.
 */
export function indexedDbInstallHold(indexedDB: IDBFactory): InstallHold {
  return {
    held: async () =>
      (await inHoldStore(indexedDB, 'readonly', (store) => store.count(installPendingKey))) > 0,
    hold: async () => {
      await inHoldStore(indexedDB, 'readwrite', (store) => store.put(true, installPendingKey))
    },
    release: async () => {
      await inHoldStore(indexedDB, 'readwrite', (store) => store.delete(installPendingKey))
    },
  }
}
