/**
 * The Audience screen's cards packed by height into columns (creator-analytics#711). Its own module,
 * with no browser types, so the browser walk can import it and check the screen against the rule.
 */

/** A column's width and the gap between two columns and two cards, in rem. */
export const audienceColumnRem = 18
export const audienceGapRem = 1

/**
 * How many columns a container `width` px wide holds: as many 18rem columns as fit with 1rem
 * between them, at least one, the count CSS `columns: 18rem` gave before creator-analytics#711, so
 * a column is as wide as it was and every `@container audience-card` breakpoint holds. `rem` is the
 * root font size in px.
 */
export function audienceColumnCountOf(width: number, rem: number): number {
  const gap = audienceGapRem * rem
  return Math.max(1, Math.floor((width + gap) / (audienceColumnRem * rem + gap)))
}

/**
 * The cards' places in `columns` columns, as columns of card indices, each column in ascending
 * index (DOM) order. One column keeps the DOM order. Two or more take the cards tallest first,
 * equal heights in DOM order, and put each in the column that is shortest at that moment, the
 * leftmost on a tie; a column is as tall as its cards and `gap` between each two of them. More
 * columns than cards leaves the trailing ones empty.
 */
export function packAudienceCards(
  heights: readonly number[],
  columns: number,
  gap: number,
): number[][] {
  const packed: number[][] = Array.from({ length: Math.max(1, columns) }, () => [])
  if (packed.length === 1) {
    packed[0] = heights.map((_, card) => card)
    return packed
  }
  const columnHeights = packed.map(() => 0)
  const tallestFirst = heights
    .map((height, card) => ({ height, card }))
    .sort((a, b) => b.height - a.height || a.card - b.card)
  for (const { height, card } of tallestFirst) {
    let shortest = 0
    for (let column = 1; column < columnHeights.length; column++) {
      if ((columnHeights[column] ?? 0) < (columnHeights[shortest] ?? 0)) shortest = column
    }
    const column = packed[shortest] ?? []
    columnHeights[shortest] =
      (columnHeights[shortest] ?? 0) + (column.length > 0 ? gap : 0) + height
    column.push(card)
  }
  return packed.map((column) => column.sort((a, b) => a - b))
}

/** An element read as its border box, subpixel: the grid for its width, a card for its height. */
interface Box {
  getBoundingClientRect(): { readonly width: number; readonly height: number }
}

type Resizes<B> = new (onResize: () => void) => { observe(target: B): void; disconnect(): void }

/**
 * Writes the cards packed into the grid's columns, at once and again each time the grid or a card
 * resizes, but only when the column count or a card's height changed, so a resize that changes
 * neither moves no card. `cards` reads the cards in DOM order. `rem` is the root font size in px.
 * `recheck` points the observer at the cards `cards` reads now, as a card that changed column is a
 * new element, and packs again at once if a height changed, as one does at a column's new width.
 */
export function holdAudienceColumnsOn<B extends Box>(
  grid: NoInfer<B>,
  cards: () => readonly NoInfer<B>[],
  ResizeObserver: Resizes<B>,
  rem: number,
  write: (columns: number[][]) => void,
): { recheck(): void; release(): void } {
  let count: number | null = null
  let heights: readonly number[] = []

  function pack() {
    const nextCount = audienceColumnCountOf(grid.getBoundingClientRect().width, rem)
    const nextHeights = cards().map((card) => card.getBoundingClientRect().height)
    if (
      nextCount === count &&
      nextHeights.length === heights.length &&
      nextHeights.every((height, card) => height === heights[card])
    ) {
      return
    }
    count = nextCount
    heights = nextHeights
    write(packAudienceCards(heights, count, audienceGapRem * rem))
  }

  const resizes = new ResizeObserver(pack)
  function observe() {
    resizes.disconnect()
    resizes.observe(grid)
    for (const card of cards()) resizes.observe(card)
  }

  observe()
  pack()
  return {
    recheck() {
      observe()
      pack()
    },
    release: () => resizes.disconnect(),
  }
}
