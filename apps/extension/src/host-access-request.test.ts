// Limits: these tests fake `permissions.contains` as `hostAccess` and Chrome's
// `permissions.addHostAccessRequest`, so they cannot see the request beside Chrome's extensions
// icon, the creator's grant, or Chrome's reload prompt. They fire the watch's events by hand, so
// they cannot see the wiring in `entrypoints/background.ts` either: `tabs.onUpdated` reaching
// `status: 'complete'` after a navigation commits, `permissions.onRemoved` firing when the creator
// withholds access, `tabs.query` naming every open tab, or the service worker starting after an
// install, an update or a re-enable. creator-analytics#101 and #99 check those by hand. The tests
// that a failed query asks for nothing start the watch and fire its events unawaited, as
// `background.ts` does under `void`, and check Node's `unhandledRejection` before they await the
// failed ask, so they see a rejection the way the service worker would, not as a throw into the
// test.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type AddHostAccessRequest, watchWithheldHostAccess } from './host-access-request.ts'

/**
 * Starts the watch against a fake Chrome, with the events a test can fire. `requested` records the
 * tabs the default fake was asked for access on; a caller's own `addHostAccessRequest` leaves it
 * empty.
 */
function watching({
  access = false,
  openTabs = [],
  addHostAccessRequest,
  hostAccess,
  openTabIds,
}: {
  access?: boolean
  openTabs?: number[]
  addHostAccessRequest?: AddHostAccessRequest
  /** Replaces the fake that answers `access`, so `withhold` no longer changes the answer. */
  hostAccess?: () => Promise<boolean>
  /** Replaces the fake that answers `openTabs`. */
  openTabIds?: () => Promise<number[]>
}) {
  let granted = access
  const requested: number[] = []
  const tabLoaded: ((tabId: number) => Promise<void>)[] = []
  const accessRemoved: (() => Promise<void>)[] = []
  const started = watchWithheldHostAccess({
    addHostAccessRequest:
      addHostAccessRequest ??
      (async ({ tabId }) => {
        requested.push(tabId)
      }),
    hostAccess: hostAccess ?? (async () => granted),
    openTabIds: openTabIds ?? (async () => openTabs),
    onTabLoaded: (listener) => tabLoaded.push(listener),
    onHostAccessRemoved: (listener) => accessRemoved.push(listener),
  })
  return {
    requested,
    started,
    loaded: async (tabId: number) => {
      await Promise.all(tabLoaded.map((listener) => listener(tabId)))
    },
    withhold: async () => {
      granted = false
      await Promise.all(accessRemoved.map((listener) => listener()))
    },
    /** Fires a tab load the way `background.ts` does, under `void`. */
    fireLoaded: (tabId: number) => {
      for (const listener of tabLoaded) void listener(tabId)
    },
    /** Fires a removed permission the way `background.ts` does, under `void`. */
    fireWithheld: () => {
      granted = false
      for (const listener of accessRemoved) void listener()
    },
  }
}

let unhandled: unknown[]
const recordUnhandled = (reason: unknown) => unhandled.push(reason)

beforeEach(() => {
  unhandled = []
  process.on('unhandledRejection', recordUnhandled)
})

afterEach(() => {
  process.off('unhandledRejection', recordUnhandled)
})

const settle = () => new Promise((resolve) => setTimeout(resolve))

// 'rejects' is how a failed `permissions.contains` or `tabs.query` reaches the watch. 'throws
// before it returns a promise' pins the synchronous throw creator-analytics#205 guards in the
// popup, without claiming Chrome's background throws that way.
const failureModes: [string, () => Promise<never>][] = [
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

/** Runs `first` on the first call, each of `after` on the calls after, and the last one from then on. */
function inTurn<T>(first: () => Promise<T>, ...after: (() => Promise<T>)[]): () => Promise<T> {
  let turn = first
  return () => {
    const current = turn
    turn = after.shift() ?? turn
    return current()
  }
}

describe("the toolbar's host access request", () => {
  test('withheld host access asks Chrome for access on a tab that loads', async () => {
    const chrome = watching({ access: false })

    await chrome.loaded(7)

    expect(chrome.requested).toEqual([7])
  })

  test('held host access asks for nothing', async () => {
    const chrome = watching({ access: true, openTabs: [7, 8] })

    await chrome.started
    await chrome.loaded(7)

    expect(chrome.requested).toEqual([])
  })

  test('withholding host access asks for access on every open tab', async () => {
    const chrome = watching({ access: true, openTabs: [7, 8] })
    await chrome.started

    await chrome.withhold()

    expect(chrome.requested).toEqual([7, 8])
  })

  test('a tab already open when the extension starts with host access withheld gets the request', async () => {
    const chrome = watching({ access: false, openTabs: [7, 8] })

    await chrome.started

    expect(chrome.requested).toEqual([7, 8])
  })

  test('a browser without the toolbar request, such as Firefox, watches nothing', async () => {
    const onTabLoaded = vi.fn()
    const onHostAccessRemoved = vi.fn()

    await watchWithheldHostAccess({
      addHostAccessRequest: undefined,
      hostAccess: async () => false,
      openTabIds: async () => [7],
      onTabLoaded,
      onHostAccessRemoved,
    })

    expect(onTabLoaded).not.toHaveBeenCalled()
    expect(onHostAccessRemoved).not.toHaveBeenCalled()
  })

  test('a request Chrome refuses, on a tab whose site the extension can already read, settles quietly', async () => {
    const chrome = watching({
      access: false,
      addHostAccessRequest: async () => {
        throw new Error('Refused: the extension already has access to this tab.')
      },
    })

    await expect(chrome.loaded(7)).resolves.toBeUndefined()
  })

  test('a request Chrome refuses on one tab settles the start only once every other tab has answered', async () => {
    const answered: number[] = []
    const chrome = watching({
      access: false,
      openTabs: [7, 8],
      addHostAccessRequest: async ({ tabId }) => {
        if (tabId === 7) throw new Error('Refused: the extension already has access to this tab.')
        await settle()
        answered.push(tabId)
      },
    })

    await chrome.started

    expect(answered).toEqual([8])
  })

  describe.each(failureModes)(
    'a failed query that %s asks for nothing and leaves no unhandled rejection',
    (_, fail) => {
      test('on start, when the host access query fails', async () => {
        const chrome = watching({ hostAccess: fail, openTabs: [7, 8] })
        await settle()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([])
        await expect(chrome.started).resolves.toBeUndefined()
      })

      test('on start, when the open tabs query fails', async () => {
        const chrome = watching({ openTabIds: fail })
        await settle()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([])
        await expect(chrome.started).resolves.toBeUndefined()
      })

      test('on a tab load, when the host access query fails', async () => {
        const chrome = watching({ hostAccess: fail })
        await chrome.started

        chrome.fireLoaded(7)
        await settle()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([])
      })

      test('on a removed permission, when the host access query fails', async () => {
        const chrome = watching({ hostAccess: inTurn(async () => true, fail), openTabs: [7, 8] })
        await chrome.started

        chrome.fireWithheld()
        await settle()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([])
      })

      test('on a removed permission, when the open tabs query fails', async () => {
        // Open tabs on start, with access held, so a fallback to the last tab list would ask on them.
        const chrome = watching({ access: true, openTabIds: inTurn(async () => [7, 8], fail) })
        await chrome.started

        chrome.fireWithheld()
        await settle()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([])
      })
    },
  )

  describe.each(failureModes)(
    'after a query that %s, a later tab load and a removed permission still ask',
    (_, fail) => {
      /** Loads tab 9, then withholds access with tabs 7 and 8 open, once the failure has passed. */
      const stillAsks = async (chrome: ReturnType<typeof watching>) => {
        await chrome.loaded(9)
        await chrome.withhold()

        expect(unhandled).toEqual([])
        expect(chrome.requested).toEqual([9, 7, 8])
      }

      test('when the host access query failed on start', async () => {
        const chrome = watching({ hostAccess: inTurn(fail, async () => false), openTabs: [7, 8] })
        await chrome.started

        await stillAsks(chrome)
      })

      test('when the open tabs query failed on start', async () => {
        const chrome = watching({ openTabIds: inTurn(fail, async () => [7, 8]) })
        await chrome.started

        await stillAsks(chrome)
      })

      /**
       * No tab is open on start, so the first host access query, which fails, is the one the event
       * makes.
       */
      const failingOnFirstEvent = () =>
        watching({
          hostAccess: inTurn(fail, async () => false),
          openTabIds: inTurn(
            async () => [],
            async () => [7, 8],
          ),
        })

      test('when the host access query failed on a tab load', async () => {
        const chrome = failingOnFirstEvent()
        await chrome.started
        chrome.fireLoaded(9)
        await settle()

        await stillAsks(chrome)
      })

      test('when the host access query failed on a removed permission', async () => {
        const chrome = failingOnFirstEvent()
        await chrome.started
        chrome.fireWithheld()
        await settle()

        await stillAsks(chrome)
      })

      test('when the open tabs query failed on a removed permission', async () => {
        const chrome = watching({
          access: true,
          openTabIds: inTurn(
            async () => [7, 8],
            fail,
            async () => [7, 8],
          ),
        })
        await chrome.started
        chrome.fireWithheld()
        await settle()

        await stillAsks(chrome)
      })
    },
  )
})
