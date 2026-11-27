// Limits: the hold's tests run it against fake boxes and a fake ResizeObserver, with no layout.
// They show the columns it writes from the widths and heights it reads, not where a browser then
// draws the cards, nor that the writes settle before paint. The browser walk's Audience cards
// step is the check of that (creator-analytics#711).
import { describe, expect, test } from 'vitest'
import {
  audienceColumnCountOf,
  holdAudienceColumnsOn,
  packAudienceCards,
} from './audience-columns.ts'

/** Each column's height: its cards' heights and `gap` between each two of them. */
function columnHeights(columns: number[][], heights: number[], gap: number) {
  return columns.map(
    (cards) =>
      cards.reduce((sum, card) => sum + (heights[card] ?? 0), 0) +
      gap * Math.max(0, cards.length - 1),
  )
}

describe('packing the Audience cards into columns', () => {
  // Staging at 40288fb, Last 28 days, format All, 1512px window (creator-analytics#711): Countries,
  // US states, Cities, Age, Gender, Devices, Operating systems, Subscriber split.
  const staging = [705, 119, 225, 293, 244, 245, 600, 232]

  test('packs the staging cards tallest first into the shortest column, in four columns of 705, 600, 676 and 746px, each column in DOM order', () => {
    const columns = packAudienceCards(staging, 4, 16)
    expect(columns).toEqual([[0], [6], [1, 3, 7], [2, 4, 5]])
    expect(columnHeights(columns, staging, 16)).toEqual([705, 600, 676, 746])
  })

  test('one column keeps the DOM order', () => {
    expect(packAudienceCards(staging, 1, 16)).toEqual([[0, 1, 2, 3, 4, 5, 6, 7]])
  })

  test('a card goes to the leftmost of the columns tied for shortest', () => {
    expect(packAudienceCards([100, 100, 100], 3, 16)).toEqual([[0], [1], [2]])
    expect(packAudienceCards([100, 100, 50, 50], 2, 0)).toEqual([
      [0, 2],
      [1, 3],
    ])
  })

  test('equal heights keep the DOM order among themselves', () => {
    expect(packAudienceCards([100, 100], 2, 16)).toEqual([[0], [1]])
    expect(packAudienceCards([50, 200, 50], 3, 16)).toEqual([[1], [0], [2]])
  })

  test('more columns than cards leaves the trailing columns empty', () => {
    expect(packAudienceCards([100, 200], 4, 16)).toEqual([[1], [0], [], []])
  })
})

describe("the Audience screen's column count", () => {
  test('as many 18rem columns as fit with 1rem between them', () => {
    // Two 18rem columns and a 1rem gap at 16px: 288 + 16 + 288 = 592px.
    expect(audienceColumnCountOf(591, 16)).toBe(1)
    expect(audienceColumnCountOf(592, 16)).toBe(2)
    // The staging container of creator-analytics#711, 1208px, held four columns.
    expect(audienceColumnCountOf(1208, 16)).toBe(4)
  })

  test('at least one column, however narrow the container', () => {
    expect(audienceColumnCountOf(0, 16)).toBe(1)
    expect(audienceColumnCountOf(200, 16)).toBe(1)
  })
})

/** A box whose width and height the test sets, read as a browser element's border box. */
function box(width: number, height: number) {
  const size = { width, height }
  return { size, getBoundingClientRect: () => ({ ...size }) }
}
type Box = ReturnType<typeof box>

/**
 * The hold on a `width` px grid of cards `heights` px tall at a 16px rem, the columns it writes,
 * and the observers made.
 */
function held(width: number, heights: number[]) {
  const grid = box(width, 0)
  const cards = heights.map((height) => box(0, height))
  const writes: number[][][] = []
  const observers: { onResize: () => void; targets: Box[]; connected: boolean }[] = []
  const hold = holdAudienceColumnsOn(
    grid,
    () => cards,
    class {
      private readonly observer: (typeof observers)[number]
      constructor(onResize: () => void) {
        this.observer = { onResize, targets: [], connected: true }
        observers.push(this.observer)
      }
      observe(target: Box) {
        this.observer.connected = true
        this.observer.targets.push(target)
      }
      disconnect() {
        this.observer.connected = false
        this.observer.targets = []
      }
    },
    16,
    (columns) => writes.push(columns),
  )
  const resize = () => {
    for (const observer of observers.filter(({ connected }) => connected)) observer.onResize()
  }
  return { grid, cards, writes, observers, hold, resize }
}

describe("holding the Audience cards' columns", () => {
  // The staging heights of creator-analytics#711 in its 1208px container, four columns.
  const staging = [705, 119, 225, 293, 244, 245, 600, 232]
  const stagingColumns = [[0], [6], [1, 3, 7], [2, 4, 5]]

  test("writes the cards packed from the grid's width and their heights at once", () => {
    const { writes } = held(1208, staging)
    expect(writes).toEqual([stagingColumns])
  })

  test("packs again when a card's height changes, as when the numbers land", () => {
    const { cards, writes, resize } = held(1208, staging)
    const usStates = cards[1]
    if (usStates === undefined) throw new Error('no US states card')
    usStates.size.height = 800
    resize()
    expect(writes.at(-1)).toEqual([[1], [0, 2], [6, 7], [3, 4, 5]])
  })

  test("packs again when the grid's width changes the column count", () => {
    const { grid, writes, resize } = held(1208, staging)
    grid.size.width = 592
    resize()
    expect(writes).toEqual([
      stagingColumns,
      [
        [0, 1, 5, 7],
        [2, 3, 4, 6],
      ],
    ])
  })

  test("writes nothing when a resize leaves the column count and every card's height as they were", () => {
    const { grid, writes, resize } = held(1208, staging)
    grid.size.width = 1200
    resize()
    expect(writes).toEqual([stagingColumns])
  })

  test('recheck watches the cards read now and packs again at once if a height changed', () => {
    const { grid, cards, writes, observers, hold } = held(1208, staging)
    const moved = cards.map(({ size }) => box(size.width, size.height))
    cards.splice(0, cards.length, ...moved)
    hold.recheck()
    expect(observers.flatMap(({ targets }) => targets)).toEqual([grid, ...moved])
    expect(writes).toEqual([stagingColumns])

    const usStates = cards[1]
    if (usStates === undefined) throw new Error('no US states card')
    usStates.size.height = 800
    hold.recheck()
    expect(writes.at(-1)).toEqual([[1], [0, 2], [6, 7], [3, 4, 5]])
  })

  test('stops on release: no observer left to pack again', () => {
    const { grid, writes, observers, hold, resize } = held(1208, staging)
    hold.release()
    expect(observers.map(({ connected }) => connected)).toEqual([false])
    grid.size.width = 592
    resize()
    expect(writes).toEqual([stagingColumns])
  })
})
