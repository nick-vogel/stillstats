// Limits: these tests run the hold against fakes of the controls bar, the screen's style and
// ResizeObserver, with no layout. They show the height the hold writes from the height it reads,
// not where a browser then sticks the video player. The browser walk's video player step and Nick's
// browser pass are the check of that (creator-analytics#685).
import { describe, expect, test } from 'vitest'
import { controlsBarHeightProperty, holdBarHeightOn } from './bar-height.ts'

/**
 * A bar whose height the test sets, a screen recording what is written on its style, and the
 * observers made. The screen has no other way to be written, so a `style` attribute would throw.
 */
function held(height: number) {
  const bar = { offsetHeight: height }
  const writes: string[] = []
  const screen = {
    style: {
      setProperty(name: string, value: string) {
        writes.push(`${name}: ${value}`)
      },
    },
  }
  const observers: { onResize: () => void; targets: unknown[]; connected: boolean }[] = []
  const release = holdBarHeightOn(
    screen,
    bar,
    class {
      private readonly observer: (typeof observers)[number]
      constructor(onResize: () => void) {
        this.observer = { onResize, targets: [], connected: true }
        observers.push(this.observer)
      }
      observe(target: unknown) {
        this.observer.targets.push(target)
      }
      disconnect() {
        this.observer.connected = false
      }
    },
  )
  const resize = () => {
    for (const observer of observers.filter(({ connected }) => connected)) observer.onResize()
  }
  return { bar, screen, writes, observers, release, resize }
}

describe("holding the controls bar's height on the video screen", () => {
  test("writes the bar's height in pixels at once", () => {
    const { writes } = held(96)
    expect(writes).toEqual([`${controlsBarHeightProperty}: 96px`])
  })

  test('writes the new height when the bar resizes, as one that wraps on a narrow screen does', () => {
    const { bar, writes, observers, resize } = held(96)
    expect(observers.flatMap(({ targets }) => targets)).toEqual([bar])

    bar.offsetHeight = 152
    resize()
    expect(writes).toEqual([
      `${controlsBarHeightProperty}: 96px`,
      `${controlsBarHeightProperty}: 152px`,
    ])
  })

  test('writes nothing when a resize leaves the height as it was', () => {
    const { writes, resize } = held(96)
    resize()
    expect(writes).toEqual([`${controlsBarHeightProperty}: 96px`])
  })

  test('stops on cleanup: no observer left to write', () => {
    const { bar, writes, observers, release, resize } = held(96)
    release()
    expect(observers.map(({ connected }) => connected)).toEqual([false])

    bar.offsetHeight = 152
    resize()
    expect(writes).toEqual([`${controlsBarHeightProperty}: 96px`])
  })
})
