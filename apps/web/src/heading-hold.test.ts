// Limits: these tests run the hold against fakes of the table, the controls bar and the browser's
// frame, scroll, resize and ResizeObserver, with no layout. They show the offset the hold writes
// from the sizes it reads, not where a browser then draws the heading rows. Nick's browser pass in
// Safari and Chrome, wide and narrow, is the check of that (creator-analytics#155).
import { describe, expect, test } from 'vitest'
import {
  type HeadingSizes,
  type HoldBrowser,
  headingOffsetOf,
  holdHeadingUnderBar,
  listLandingTopOf,
} from './heading-hold.ts'

describe("the video list's heading offset", () => {
  // A bar 80px tall stuck at the top, over a table 1000px tall whose heading rows are 60px.
  const sizes = { barBottom: 80, tableHeight: 1000, headingHeight: 60 }

  test("is 0 while the list's top is still below the controls bar, so the heading rows sit in place", () => {
    expect(headingOffsetOf({ ...sizes, tableTop: 300 })).toBe(0)
    expect(headingOffsetOf({ ...sizes, tableTop: 80 })).toBe(0)
  })

  test("once the page scrolls past the list's top, puts the heading rows' top at the bar's bottom", () => {
    // The table's top is 220px above the bar's bottom: the heading rows move down by as much.
    expect(headingOffsetOf({ ...sizes, tableTop: -140 })).toBe(220)
  })

  test("past the list's last row, stops at the table's end, so the heading rows leave with the list", () => {
    // 940px is the most the 60px heading rows can move inside the 1000px table.
    expect(headingOffsetOf({ ...sizes, tableTop: -900 })).toBe(940)
    expect(headingOffsetOf({ ...sizes, tableTop: -5000 })).toBe(940)
  })

  test('follows a taller bar, one wrapped by a resize, by its new bottom', () => {
    expect(headingOffsetOf({ ...sizes, barBottom: 130, tableTop: -140 })).toBe(270)
  })
})

describe("the page scroll a pager link lands the video list's table at", () => {
  test("puts the table's top right under the controls bar", () => {
    // Scrolled 200px, the table's top 900px down the screen, under an 80px bar: 200 + 900 - 80.
    expect(listLandingTopOf({ scrollY: 200, tableTop: 900, barHeight: 80 })).toBe(1020)
  })

  test('lands the table lower under a taller bar, one wrapped onto a second line', () => {
    expect(listLandingTopOf({ scrollY: 200, tableTop: 900, barHeight: 130 })).toBe(970)
  })

  test('scrolls up to a table already past the bar, back under it', () => {
    // The table's top is 300px above the screen's top: 1500 - 300 - 80.
    expect(listLandingTopOf({ scrollY: 1500, tableTop: -300, barHeight: 80 })).toBe(1120)
  })

  test('with no controls bar, puts the table at the top of the screen', () => {
    expect(listLandingTopOf({ scrollY: 200, tableTop: 900, barHeight: 0 })).toBe(1100)
  })

  test("never asks for a scroll above the page's top", () => {
    expect(listLandingTopOf({ scrollY: 0, tableTop: 40, barHeight: 80 })).toBe(0)
  })
})

/** A browser's frames, window events and resize observers, run by hand. */
function fakeBrowser() {
  const frames = new Map<number, () => void>()
  let lastFrame = 0
  const listeners: { type: string; listener: () => void; options: unknown }[] = []
  const observers: { onResize: () => void; targets: unknown[]; connected: boolean }[] = []
  const browser: HoldBrowser = {
    requestAnimationFrame(callback) {
      lastFrame += 1
      frames.set(lastFrame, callback)
      return lastFrame
    },
    cancelAnimationFrame(handle) {
      frames.delete(handle)
    },
    addEventListener(type, listener, options) {
      listeners.push({ type, listener, options })
    },
    removeEventListener(type, listener) {
      const at = listeners.findIndex((added) => added.type === type && added.listener === listener)
      if (at > -1) listeners.splice(at, 1)
    },
    ResizeObserver: class {
      private readonly observer: (typeof observers)[number]
      constructor(onResize: () => void) {
        this.observer = { onResize, targets: [], connected: true }
        observers.push(this.observer)
      }
      observe(target: Element) {
        this.observer.targets.push(target)
      }
      disconnect() {
        this.observer.connected = false
      }
    },
  }
  return {
    browser,
    frames,
    listeners,
    observers,
    /** Runs the frames asked for so far. */
    runFrames() {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback()
    },
    fire(type: string) {
      for (const added of listeners.filter((listener) => listener.type === type)) added.listener()
    },
    resize() {
      for (const observer of observers.filter(({ connected }) => connected)) observer.onResize()
    },
  }
}

/**
 * A table and a controls bar whose sizes the test sets, and the custom properties written on the
 * table's style, in order. The style has no other way to be written, and the table records any
 * attribute set on it.
 */
function fakeList(sizes: HeadingSizes) {
  const writes: string[] = []
  const attributes: string[] = []
  const style = {
    setProperty(name: string, value: string) {
      writes.push(`${name}: ${value}`)
    },
  }
  const table = {
    getBoundingClientRect: () => ({ top: sizes.tableTop, height: sizes.tableHeight }),
    tHead: {
      get offsetHeight() {
        return sizes.headingHeight
      },
    },
    style,
    setAttribute(name: string) {
      attributes.push(name)
    },
  } as unknown as HTMLTableElement
  const bar = {
    getBoundingClientRect: () => ({ bottom: sizes.barBottom }),
  } as unknown as HTMLElement
  return { table, bar, style, writes, attributes }
}

describe("holding the video list's heading rows under the controls bar", () => {
  function held() {
    const sizes = { barBottom: 80, tableTop: 300, tableHeight: 1000, headingHeight: 60 }
    const list = fakeList(sizes)
    const page = fakeBrowser()
    const release = holdHeadingUnderBar(list.table, list.bar, page.browser)
    return { sizes, ...list, ...page, release }
  }

  test('writes the offset in the frame after a scroll, once however many scroll events came', () => {
    const { sizes, writes, frames, runFrames, fire } = held()
    runFrames()
    expect(writes).toEqual(['--heading-offset: 0px'])

    sizes.tableTop = -140
    fire('scroll')
    fire('scroll')
    fire('scroll')
    expect(frames.size).toBe(1)
    runFrames()
    expect(writes).toEqual(['--heading-offset: 0px', '--heading-offset: 220px'])
  })

  test('writes nothing when a scroll leaves the offset as it was', () => {
    const { writes, runFrames, fire } = held()
    runFrames()
    fire('scroll')
    runFrames()
    expect(writes).toEqual(['--heading-offset: 0px'])
  })

  test('listens to the scroll passively, so it never holds the page back', () => {
    const { listeners } = held()
    expect(listeners.find(({ type }) => type === 'scroll')?.options).toEqual({ passive: true })
  })

  test("moves the heading rows to sit under the bar's new bottom when the bar wraps", () => {
    const { sizes, table, bar, writes, observers, runFrames, resize } = held()
    sizes.tableTop = -140
    runFrames()
    expect(observers.flatMap(({ targets }) => targets)).toEqual([bar, table])

    sizes.barBottom = 130
    resize()
    runFrames()
    expect(writes).toEqual(['--heading-offset: 220px', '--heading-offset: 270px'])
  })

  test('works the offset out again when the window resizes', () => {
    const { sizes, writes, runFrames, fire } = held()
    runFrames()
    sizes.tableTop = 40
    fire('resize')
    runFrames()
    expect(writes).toEqual(['--heading-offset: 0px', '--heading-offset: 40px'])
  })

  test('stops on cleanup: no listener, no observer and no frame left to write', () => {
    const { sizes, writes, frames, listeners, observers, release, fire, resize, runFrames } = held()
    release()
    expect(frames.size).toBe(0)
    expect(listeners).toEqual([])
    expect(observers.map(({ connected }) => connected)).toEqual([false])

    sizes.tableTop = -140
    fire('scroll')
    resize()
    runFrames()
    expect(writes).toEqual([])
  })

  test('writes the offset as a style property only, never a style attribute', () => {
    const { sizes, style, attributes, runFrames, fire } = held()
    runFrames()
    sizes.tableTop = -140
    fire('scroll')
    runFrames()
    expect(attributes).toEqual([])
    expect(Object.keys(style)).toEqual(['setProperty'])
  })
})
