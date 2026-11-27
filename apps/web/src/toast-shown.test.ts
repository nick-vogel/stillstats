// @vitest-environment happy-dom
// Limits: this test renders `ToastShown` inside the real `Toaster`, under StrictMode, with a small
// harness that holds the notice and clears it on the notice's `onClose`, as App does; it does not
// render App. The window it opens is the gap between a commit and React's passive effect flush,
// which in a browser is a Scheduler task boundary after a slow render. `act` flushes passive
// effects with the commit, so the test opens the window with a probe whose layout effect runs the
// fake clock on by 1 ms: layout effects run in the commit, after the render, and before the passive
// cleanup closes the old toast. No test shows how wide that gap is in a real browser, or that a
// real timer lands in it. happy-dom draws nothing, so the toast is found by its landmark and role,
// its text the status in the "Notifications" region Base UI portals to the document's body.
// The exit test stubs `getAnimations` with one fake animation, whose end the test sets, for a CSS
// exit animation the toast does not have, so the old toast's exit is held open while a new notice
// arrives. It cannot show Chrome's real scheduling between a network response and a frame, which
// the source read in creator-analytics#389 covers.
import { act, createElement, Fragment, StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Toaster } from '@/components/ui/toast'
import { failedSaveNotice, toastCloseLabel } from './preferences.ts'
import { currencySavedNotice } from './settings.ts'
import { type ToastNotice, ToastShown } from './Toast.tsx'
import { toastSeconds } from './toast.ts'

let root: Root | null = null
let container: HTMLElement | null = null

/** Sets the harness's notice, as App's state does. */
let showNotice: (notice: ToastNotice | null) => void = () => {}

/** When set, the probe's next layout effect runs the fake clock on by 1 ms, inside the commit. */
let tickInTheCommit = false

function Probe() {
  useLayoutEffect(() => {
    if (!tickInTheCommit) return
    tickInTheCommit = false
    vi.advanceTimersByTime(1)
  })
  return null
}

function Harness({ first }: { first: ToastNotice }) {
  const [notice, setNotice] = useState<ToastNotice | null>(first)
  showNotice = setNotice
  return createElement(
    Toaster,
    { closeLabel: toastCloseLabel },
    createElement(Fragment, null, createElement(ToastShown, { notice }), createElement(Probe)),
  )
}

/** The text the toast shows, or null with no toast on view. */
function toastText(): string | null {
  return (
    document
      .querySelector('[role="region"][aria-label="Notifications"]')
      ?.querySelector('[role="status"]')?.textContent ?? null
  )
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  vi.restoreAllMocks()
  container?.remove()
  root = null
  container = null
  tickInTheCommit = false
  vi.useRealTimers()
})

describe("an old toast's close", () => {
  test('from a wait that ends as a new notice arrives leaves the new notice on view, and its onClose uncalled', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const saved: ToastNotice = {
      key: 'success-1',
      text: currencySavedNotice,
      success: true,
      timed: true,
      onClose: vi.fn(() => showNotice(null)),
    }
    const failed: ToastNotice = {
      key: 'failed-1',
      text: failedSaveNotice,
      success: false,
      timed: true,
      onClose: vi.fn(() => showNotice(null)),
    }
    container = document.createElement('div')
    document.body.append(container)
    const created = createRoot(container)
    root = created
    await act(async () => {
      created.render(createElement(StrictMode, null, createElement(Harness, { first: saved })))
    })
    expect(toastText()).toBe(currencySavedNotice)

    await act(async () => vi.advanceTimersByTime(toastSeconds * 1000 - 1))
    act(() => {
      tickInTheCommit = true
      showNotice(failed)
    })
    await act(async () => {})

    expect(toastText()).toBe(failedSaveNotice)
    expect(failed.onClose).not.toHaveBeenCalled()
  })
})

/** A held exit animation: one finite fake animation, which ends when the test calls `end`. */
function holdTheExit() {
  let end: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    end = resolve
  })
  const exit = {
    finished,
    pending: false,
    playState: 'running',
    effect: { getTiming: () => ({ duration: 200, iterations: 1 }) },
  } as unknown as Animation
  let asked = false
  vi.spyOn(Element.prototype, 'getAnimations').mockImplementation(function (this: Element) {
    if (this.getAttribute('data-slot') !== 'toast' || !this.hasAttribute('data-ending-style')) {
      return []
    }
    asked = true
    return [exit]
  })
  return { end: () => end(), asked: () => asked }
}

describe("an old toast's exit", () => {
  test('that ends after a new notice arrives leaves the new notice on view, and its onClose uncalled', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    const exit = holdTheExit()
    const saved: ToastNotice = {
      key: 'success-1',
      text: currencySavedNotice,
      success: true,
      timed: true,
      onClose: vi.fn(() => showNotice(null)),
    }
    const failed: ToastNotice = {
      key: 'failed-1',
      text: failedSaveNotice,
      success: false,
      timed: true,
      onClose: vi.fn(() => showNotice(null)),
    }
    container = document.createElement('div')
    document.body.append(container)
    const created = createRoot(container)
    root = created
    await act(async () => {
      created.render(createElement(StrictMode, null, createElement(Harness, { first: saved })))
    })
    await act(async () => vi.advanceTimersToNextFrame())
    expect(toastText()).toBe(currencySavedNotice)

    // The success's wait ends: its close clears the notice, and the toast's exit starts and holds.
    await act(async () => vi.advanceTimersByTime(toastSeconds * 1000))
    await act(async () => vi.advanceTimersToNextFrame())
    expect(saved.onClose).toHaveBeenCalledOnce()
    expect(exit.asked()).toBe(true)
    expect(toastText()).toBe(currencySavedNotice)

    // The failed save arrives inside the exit, which then ends.
    await act(async () => showNotice(failed))
    await act(async () => exit.end())
    await act(async () => vi.advanceTimersToNextFrame())

    expect(toastText()).toBe(failedSaveNotice)
    expect(failed.onClose).not.toHaveBeenCalled()
  })
})
