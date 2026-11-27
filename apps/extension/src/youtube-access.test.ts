// Limits: these tests fake `permissions` and `scripting`, so they cannot see Chrome's or Firefox's
// real grant, the browser's own permission prompt, that the request stays inside the user gesture
// beyond being the call's first step, or that a registered script runs on www.youtube.com.
// creator-analytics#143 walks those in real Chrome and Firefox.
import type { ExtensionEvent } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { BackgroundRequest } from './messages.ts'
import { failureModes, nextTask } from './testing.ts'
import {
  keepYouTubeAccessInStep,
  stopOnRestoreWithoutYouTubeAccess,
  stopOnYouTubeAccessRemoved,
  tellEveryTab,
  youtubeAccessOf,
  youtubeAccessRemovedMessage,
} from './youtube-access.ts'

const youtube = { origins: ['https://www.youtube.com/*'] }

function permissionsAnswering(answer: boolean) {
  return {
    contains: vi.fn(async () => answer),
    request: vi.fn(async () => answer),
    remove: vi.fn(async () => true),
  }
}

describe('youtubeAccessOf', () => {
  test.each([true, false])(
    'granted answers %s when the browser does for www.youtube.com only',
    async (answer) => {
      const permissions = permissionsAnswering(answer)

      await expect(youtubeAccessOf({ permissions }).granted()).resolves.toBe(answer)
      expect(permissions.contains.mock.calls).toEqual([[youtube]])
    },
  )

  test('request asks for www.youtube.com only, never the required hosts', async () => {
    const permissions = permissionsAnswering(true)

    await expect(youtubeAccessOf({ permissions }).request()).resolves.toBe(true)

    expect(permissions.request.mock.calls).toEqual([[youtube]])
  })

  test('request reaches the browser on the call itself, so a click keeps it inside its gesture', () => {
    const permissions = permissionsAnswering(true)

    void youtubeAccessOf({ permissions }).request()

    expect(permissions.request).toHaveBeenCalledOnce()
  })

  test('remove removes www.youtube.com only', async () => {
    const permissions = permissionsAnswering(true)

    await youtubeAccessOf({ permissions }).remove()

    expect(permissions.remove.mock.calls).toEqual([[youtube]])
  })
})

/** A browser's `scripting`, keeping what is registered and recording where each file is injected. */
function fakeScripting({ registered = false }: { registered?: boolean } = {}) {
  const scripts = new Map<
    string,
    { id: string; matches?: string[]; js?: string[]; runAt?: string }
  >()
  if (registered) {
    scripts.set('youtube', {
      id: 'youtube',
      matches: ['https://www.youtube.com/*'],
      js: ['content-scripts/youtube.js'],
      runAt: 'document_idle',
    })
  }
  const injected: { tabId: number; files: string[] }[] = []
  const registerCalls: unknown[] = []
  const scripting = {
    registerContentScripts: vi.fn(
      async (list: { id: string; matches?: string[]; js?: string[]; runAt?: string }[]) => {
        registerCalls.push(list)
        for (const script of list) {
          if (scripts.has(script.id)) throw new Error(`Duplicate script ID '${script.id}'`)
          scripts.set(script.id, script)
        }
      },
    ),
    unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => {
      for (const id of ids) {
        if (!scripts.delete(id)) throw new Error(`Nonexistent script ID '${id}'`)
      }
    }),
    getRegisteredContentScripts: vi.fn(async ({ ids }: { ids: string[] }) =>
      [...scripts.values()].filter((script) => ids.includes(script.id)),
    ),
    executeScript: vi.fn(
      async ({ target, files }: { target: { tabId: number }; files: string[] }) => {
        injected.push({ tabId: target.tabId, files })
        return []
      },
    ),
  }
  return { scripting, scripts, injected, registerCalls }
}

type PermissionsChange = { origins?: string[]; permissions?: string[] }

/** A background built on fakes: the grant, the registration, the open tabs and the events. */
function fakeBackground({
  granted = false,
  registered = false,
  openTabs = [11, 12],
}: {
  granted?: boolean
  registered?: boolean
  openTabs?: number[]
} = {}) {
  let grant = granted
  const { scripting, scripts, injected, registerCalls } = fakeScripting({ registered })
  const settled: ExtensionEvent[] = []
  const told: unknown[] = []
  const added: ((change: PermissionsChange) => void)[] = []
  const removed: ((change: PermissionsChange) => void)[] = []
  const options = {
    access: { granted: vi.fn(async () => grant) },
    scripting,
    openYouTubeTabIds: vi.fn(async () => openTabs),
    tellOpenTabs: vi.fn(async (message: unknown) => void told.push(message)),
    onAccessAdded: (listener: (change: PermissionsChange) => void) => void added.push(listener),
    onAccessRemoved: (listener: (change: PermissionsChange) => void) => void removed.push(listener),
    settle: vi.fn(async (event: ExtensionEvent) => {
      settled.push(event)
      return true
    }),
  }
  return {
    options,
    scripts,
    injected,
    registerCalls,
    settled,
    told,
    /** The browser grants or removes permissions, as the toggle or the browser's settings do. */
    add(change: PermissionsChange) {
      if (change.origins?.includes('https://www.youtube.com/*')) grant = true
      for (const listener of added) listener(change)
    },
    remove(change: PermissionsChange) {
      if (change.origins?.includes('https://www.youtube.com/*')) grant = false
      for (const listener of removed) listener(change)
    },
  }
}

const registeredScript = {
  id: 'youtube',
  matches: ['https://www.youtube.com/*'],
  js: ['content-scripts/youtube.js'],
  runAt: 'document_idle',
}

const injectedInto = (...tabIds: number[]) =>
  tabIds.map((tabId) => ({ tabId, files: ['content-scripts/youtube.js'] }))

describe('the background keeps the youtube.com content script in step with YouTube access', () => {
  test('a grant registers the script, injects it into each open youtube.com tab, and sends the granted event', async () => {
    const background = fakeBackground()
    await keepYouTubeAccessInStep(background.options)

    background.add(youtube)
    await nextTask()

    expect([...background.scripts.values()]).toEqual([registeredScript])
    expect(background.injected).toEqual(injectedInto(11, 12))
    expect(background.settled).toEqual([{ name: 'extension_youtube_access_granted' }])
  })

  test('a removal unregisters the script and sends the removed event', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    await keepYouTubeAccessInStep(background.options)

    background.remove(youtube)
    await nextTask()

    expect([...background.scripts.values()]).toEqual([])
    expect(background.injected).toEqual([])
    expect(background.settled).toEqual([{ name: 'extension_youtube_access_removed' }])
  })

  // Firefox's `data_collection` grant reaches the same listeners with no origin.
  test.each([
    ['Studio', { origins: ['https://studio.youtube.com/*'] }],
    ['stillstats.com', { origins: ['https://stillstats.com/*'] }],
    ["Firefox's data collection", { origins: [], permissions: [] }],
  ])('a change naming only %s registers, injects and sends nothing', async (_, change) => {
    const grantedBackground = fakeBackground({ granted: true, registered: true })
    const withheldBackground = fakeBackground()
    await keepYouTubeAccessInStep(grantedBackground.options)
    await keepYouTubeAccessInStep(withheldBackground.options)

    grantedBackground.remove(change)
    withheldBackground.add(change)
    await nextTask()

    expect([...grantedBackground.scripts.values()]).toEqual([registeredScript])
    expect([...withheldBackground.scripts.values()]).toEqual([])
    expect(withheldBackground.injected).toEqual([])
    expect([...grantedBackground.settled, ...withheldBackground.settled]).toEqual([])
  })

  test('a start with YouTube access granted and no script registers it and injects it into open youtube.com tabs, sending no event', async () => {
    const background = fakeBackground({ granted: true })

    await keepYouTubeAccessInStep(background.options)

    expect([...background.scripts.values()]).toEqual([registeredScript])
    expect(background.injected).toEqual(injectedInto(11, 12))
    expect(background.settled).toEqual([])
  })

  test('a start with a script registered and no YouTube access unregisters it, sending no event', async () => {
    const background = fakeBackground({ registered: true })

    await keepYouTubeAccessInStep(background.options)

    expect([...background.scripts.values()]).toEqual([])
    expect(background.settled).toEqual([])
  })

  test.each([
    ['granted and registered', { granted: true, registered: true }],
    ['withheld and not registered', { granted: false, registered: false }],
  ])('a start with YouTube access %s changes nothing', async (_, state) => {
    const background = fakeBackground(state)

    await keepYouTubeAccessInStep(background.options)

    expect(background.options.scripting.registerContentScripts).not.toHaveBeenCalled()
    expect(background.options.scripting.unregisterContentScripts).not.toHaveBeenCalled()
    expect(background.injected).toEqual([])
    expect(background.settled).toEqual([])
  })

  test('a grant during the start repair registers the script once', async () => {
    const background = fakeBackground({ granted: true })
    // A browser takes a while to register, so the grant lands while the repair's registration is
    // still in flight.
    const registerNow = background.options.scripting.registerContentScripts.getMockImplementation()
    background.options.scripting.registerContentScripts.mockImplementation(async (list) => {
      await nextTask()
      return registerNow?.(list)
    })

    const started = keepYouTubeAccessInStep(background.options)
    background.add(youtube)
    await started
    await nextTask()

    expect(background.registerCalls).toHaveLength(1)
    expect([...background.scripts.values()]).toEqual([registeredScript])
    expect(background.settled).toEqual([{ name: 'extension_youtube_access_granted' }])
  })

  test('a grant that lands on a script already registered keeps it and still injects and sends', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    await keepYouTubeAccessInStep(background.options)

    background.add(youtube)
    await nextTask()

    expect(background.registerCalls).toEqual([])
    expect(background.injected).toEqual(injectedInto(11, 12))
    expect(background.settled).toEqual([{ name: 'extension_youtube_access_granted' }])
  })

  test('a removal that finds no script registered still sends the removed event', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    await keepYouTubeAccessInStep(background.options)
    background.scripts.clear()

    background.remove(youtube)
    await nextTask()

    expect(background.settled).toEqual([{ name: 'extension_youtube_access_removed' }])
  })
})

describe('the background tells the open tabs once YouTube access is removed', () => {
  test('a removal tells the open tabs once, with the removal message', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    await keepYouTubeAccessInStep(background.options)

    background.remove(youtube)
    await nextTask()

    expect(background.told).toEqual([{ type: 'youtube-access-removed' }])
  })

  test('a start repair that unregisters the script tells the open tabs', async () => {
    const background = fakeBackground({ registered: true })

    await keepYouTubeAccessInStep(background.options)

    expect(background.told).toEqual([{ type: 'youtube-access-removed' }])
  })

  test.each([
    ['granted and registered', { granted: true, registered: true }],
    ['withheld and not registered', { granted: false, registered: false }],
    ['granted and not registered', { granted: true, registered: false }],
  ])('a start with YouTube access %s tells nothing', async (_, state) => {
    const background = fakeBackground(state)

    await keepYouTubeAccessInStep(background.options)

    expect(background.told).toEqual([])
  })

  test('a grant tells nothing', async () => {
    const background = fakeBackground()
    await keepYouTubeAccessInStep(background.options)

    background.add(youtube)
    await nextTask()

    expect(background.told).toEqual([])
  })

  test.each([
    ['Studio', { origins: ['https://studio.youtube.com/*'] }],
    ['stillstats.com', { origins: ['https://stillstats.com/*'] }],
    ["Firefox's data collection", { origins: [], permissions: [] }],
  ])('a removal naming only %s tells nothing', async (_, change) => {
    const background = fakeBackground({ granted: true, registered: true })
    await keepYouTubeAccessInStep(background.options)

    background.remove(change)
    await nextTask()

    expect(background.told).toEqual([])
  })

  test('a grant just after a removal injects the script only once the tabs are told', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    const order: string[] = []
    background.options.tellOpenTabs.mockImplementation(async () => {
      await nextTask()
      order.push('told')
    })
    background.options.scripting.executeScript.mockImplementation(async () => {
      order.push('injected')
      return []
    })
    await keepYouTubeAccessInStep(background.options)

    background.remove(youtube)
    background.add(youtube)
    await nextTask()
    await nextTask()

    expect(order).toEqual(['told', 'injected', 'injected'])
  })
})

describe('tellEveryTab', () => {
  test('a tab that refuses the message leaves the other tabs told, and settles', async () => {
    const told: number[] = []
    const sendToTab = vi.fn(async (tabId: number, _message: unknown) => {
      if (tabId === 12)
        throw new Error('Could not establish connection. Receiving end does not exist.')
      told.push(tabId)
    })

    await expect(
      tellEveryTab({ tabIds: async () => [11, 12, 13], sendToTab })(youtubeAccessRemovedMessage),
    ).resolves.toBeUndefined()

    expect(told).toEqual([11, 13])
    expect(sendToTab.mock.calls).toEqual([
      [11, { type: 'youtube-access-removed' }],
      [12, { type: 'youtube-access-removed' }],
      [13, { type: 'youtube-access-removed' }],
    ])
  })

  test('a tab query that fails settles, telling nothing', async () => {
    const sendToTab = vi.fn(async () => {})

    await expect(
      tellEveryTab({
        tabIds: () => Promise.reject(new Error('No tabs')),
        sendToTab,
      })(youtubeAccessRemovedMessage),
    ).resolves.toBeUndefined()

    expect(sendToTab).not.toHaveBeenCalled()
  })
})

describe('the background survives a failed browser call', () => {
  let unhandled: unknown[]
  const recordUnhandled = (reason: unknown) => unhandled.push(reason)
  beforeEach(() => {
    unhandled = []
    process.on('unhandledRejection', recordUnhandled)
  })
  afterEach(() => {
    process.off('unhandledRejection', recordUnhandled)
  })

  test('a tab that refuses the script leaves the other open tabs injected, and the script registered', async () => {
    const background = fakeBackground({ openTabs: [11, 12, 13] })
    const inject = background.options.scripting.executeScript.getMockImplementation()
    background.options.scripting.executeScript.mockImplementation(async (injection) => {
      if (injection.target.tabId === 12) throw new Error('No tab with id: 12.')
      return (await inject?.(injection)) ?? []
    })
    await keepYouTubeAccessInStep(background.options)

    background.add(youtube)
    await nextTask()

    expect([...background.scripts.values()]).toEqual([registeredScript])
    expect(background.injected).toEqual(injectedInto(11, 13))
    expect(unhandled).toEqual([])
  })

  test.each(failureModes)(
    'a register, settle or tab query that %s leaves no unhandled rejection, and the next step still runs',
    async (_, fail) => {
      const background = fakeBackground()
      background.options.scripting.registerContentScripts.mockImplementationOnce(fail)
      background.options.openYouTubeTabIds.mockImplementationOnce(fail)
      background.options.settle.mockImplementationOnce(fail)
      await keepYouTubeAccessInStep(background.options)

      background.add(youtube)
      await nextTask()
      background.remove(youtube)
      background.add(youtube)
      await nextTask()

      expect([...background.scripts.values()]).toEqual([registeredScript])
      expect(background.settled).toEqual([
        { name: 'extension_youtube_access_removed' },
        { name: 'extension_youtube_access_granted' },
      ])
      expect(unhandled).toEqual([])
    },
  )

  test.each(failureModes)(
    'a tab message that %s still leaves the script unregistered and the removed event sent',
    async (_, fail) => {
      const background = fakeBackground({ granted: true, registered: true })
      background.options.tellOpenTabs.mockImplementation(fail)
      await keepYouTubeAccessInStep(background.options)

      background.remove(youtube)
      await nextTask()

      expect([...background.scripts.values()]).toEqual([])
      expect(background.settled).toEqual([{ name: 'extension_youtube_access_removed' }])
      expect(unhandled).toEqual([])
    },
  )

  test('an unregister that fails still tells the open tabs', async () => {
    const background = fakeBackground({ granted: true, registered: true })
    background.options.scripting.unregisterContentScripts.mockRejectedValueOnce(new Error('No'))
    await keepYouTubeAccessInStep(background.options)

    background.remove(youtube)
    await nextTask()

    expect(background.told).toEqual([{ type: 'youtube-access-removed' }])
    expect(unhandled).toEqual([])
  })

  test.each(failureModes)(
    'a start whose grant or registration check %s settles without a rejection',
    async (_, fail) => {
      const grantFails = fakeBackground({ granted: true })
      grantFails.options.access.granted.mockImplementationOnce(fail)
      const registeredFails = fakeBackground({ granted: true })
      registeredFails.options.scripting.getRegisteredContentScripts.mockImplementationOnce(fail)

      await expect(keepYouTubeAccessInStep(grantFails.options)).resolves.toBeUndefined()
      await expect(keepYouTubeAccessInStep(registeredFails.options)).resolves.toBeUndefined()
      expect(unhandled).toEqual([])
    },
  )
})

/** A `runtime.onMessage` the test delivers messages through, as the background's would arrive. */
function fakeOnMessage() {
  const listeners = new Set<(message: unknown) => void>()
  return {
    onMessage: {
      addListener: (listener: (message: unknown) => void) => void listeners.add(listener),
      removeListener: (listener: (message: unknown) => void) => void listeners.delete(listener),
    },
    deliver(message: unknown) {
      for (const listener of listeners) listener(message)
    },
  }
}

describe('a youtube.com tab stops once the background says YouTube access is removed', () => {
  test('the removal message stops the tab once', () => {
    const { onMessage, deliver } = fakeOnMessage()
    const stop = vi.fn()
    stopOnYouTubeAccessRemoved({ onMessage, stop })

    deliver(youtubeAccessRemovedMessage)

    expect(stop).toHaveBeenCalledOnce()
  })

  test.each([
    ['a usage event answer', true],
    ['nothing', undefined],
    ['another type', { type: 'read-videos' }],
    ['a string', 'youtube-access-removed'],
  ])('%s stops nothing', (_, message) => {
    const { onMessage, deliver } = fakeOnMessage()
    const stop = vi.fn()
    stopOnYouTubeAccessRemoved({ onMessage, stop })

    deliver(message)

    expect(stop).not.toHaveBeenCalled()
  })

  test('once its remover runs, the removal message stops nothing', () => {
    const { onMessage, deliver } = fakeOnMessage()
    const stop = vi.fn()
    const remove = stopOnYouTubeAccessRemoved({ onMessage, stop })

    remove()
    deliver(youtubeAccessRemovedMessage)

    expect(stop).not.toHaveBeenCalled()
  })
})

/** A background `ask` that answers the YouTube access ask with `answer` and records each request. */
function askAnswering(answer: () => Promise<unknown>) {
  const asked: BackgroundRequest[] = []
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    return answer()
  }) as Parameters<typeof stopOnRestoreWithoutYouTubeAccess>[0]['ask']
  return { ask, asked }
}

describe('a youtube.com page restored from the back/forward cache stops unless YouTube access is still granted', () => {
  test('a restore with YouTube access removed asks once and stops the tab once', async () => {
    const { ask, asked } = askAnswering(async () => false)
    const stop = vi.fn()

    stopOnRestoreWithoutYouTubeAccess({ ask, stop })({ persisted: true })
    await nextTask()

    expect(asked).toEqual([{ type: 'youtube-access' }])
    expect(stop).toHaveBeenCalledOnce()
  })

  test('a restore with YouTube access granted stops nothing', async () => {
    const { ask, asked } = askAnswering(async () => true)
    const stop = vi.fn()

    stopOnRestoreWithoutYouTubeAccess({ ask, stop })({ persisted: true })
    await nextTask()

    expect(asked).toEqual([{ type: 'youtube-access' }])
    expect(stop).not.toHaveBeenCalled()
  })

  test.each(failureModes)(
    'a restore whose ask %s stops the tab, leaving no unhandled rejection',
    async (_, fail) => {
      const unhandled: unknown[] = []
      const recordUnhandled = (reason: unknown) => unhandled.push(reason)
      process.on('unhandledRejection', recordUnhandled)
      try {
        // Passed as it is, so a throw before the promise reaches the handler as it would.
        const ask = fail as Parameters<typeof stopOnRestoreWithoutYouTubeAccess>[0]['ask']
        const stop = vi.fn()

        stopOnRestoreWithoutYouTubeAccess({ ask, stop })({ persisted: true })
        await nextTask()

        expect(stop).toHaveBeenCalledOnce()
        expect(unhandled).toEqual([])
      } finally {
        process.off('unhandledRejection', recordUnhandled)
      }
    },
  )

  test.each([
    ['anything but true', { state: 'failed' }],
    ['nothing', undefined],
  ])('a restore whose ask answers %s stops the tab', async (_, answer) => {
    const { ask } = askAnswering(async () => answer)
    const stop = vi.fn()

    stopOnRestoreWithoutYouTubeAccess({ ask, stop })({ persisted: true })
    await nextTask()

    expect(stop).toHaveBeenCalledOnce()
  })

  test('a pageshow that is not a restore asks nothing and stops nothing', async () => {
    const { ask, asked } = askAnswering(async () => false)
    const stop = vi.fn()

    stopOnRestoreWithoutYouTubeAccess({ ask, stop })({ persisted: false })
    await nextTask()

    expect(asked).toEqual([])
    expect(stop).not.toHaveBeenCalled()
  })
})
