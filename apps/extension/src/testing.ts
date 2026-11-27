import type { InstallHold } from './held-install.ts'
import type { ChannelsRead } from './product-api.ts'

/**
 * A hold in memory, standing in for the browser's IndexedDB: every background built on one sees
 * what the others kept, as a background after an idle stop or a browser restart does.
 */
export function memoryHold(): InstallHold {
  let held = false
  return {
    held: async () => held,
    hold: async () => {
      held = true
    },
    release: async () => {
      held = false
    },
  }
}

export const signedIn: ChannelsRead = { state: 'signed-in', channels: [] }

/** Resolves on the next task, once every promise already settling has settled. */
export const nextTask = () => new Promise((resolve) => setTimeout(resolve))

/**
 * The two ways a failed browser call, read, send or IndexedDB request reaches the code under test.
 * 'throws before it returns a promise' pins the synchronous throw creator-analytics#205 guards in
 * the popup, without claiming either browser throws that way.
 */
export const failureModes: [string, () => Promise<never>][] = [
  [
    'rejects',
    async () => {
      throw new Error('Extension context invalidated.')
    },
  ],
  [
    'throws before it returns a promise',
    () => {
      throw new Error('Extension context invalidated.')
    },
  ],
]
