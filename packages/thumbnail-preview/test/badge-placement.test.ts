import { describe, expect, test } from 'vitest'
import { durationBadgeBox, newBadgeBox } from '../src/badge-placement.ts'
import { LANDSCAPE_TILES, SHORTS_TILES, type TileSize } from '../src/thumbnail-sizes.ts'

const landscape = (width: number): TileSize => {
  const size = LANDSCAPE_TILES.find((tile) => tile.width === width)
  if (!size) throw new Error(`The size table has no ${width}px landscape tile`)
  return size
}

/**
 * The expected offsets are worked by hand from `docs/research/youtube-duration-badge.md`'s offsets,
 * the 20px chip and each tile's 16:9 image height (500 is 281.25px tall, 347 is 195.1875px, 220 is
 * 123.75px and 160 is 90px), never recomputed the way the module computes them.
 */
describe('where the duration badge sits', () => {
  test('every landscape surface YouTube draws a badge on answers a box, and the stress plate none', () => {
    expect(LANDSCAPE_TILES.map((size) => [size.width, durationBadgeBox(size, false)])).toEqual([
      [500, { topPx: 253.25, rightPx: 8 }],
      [347, { topPx: 167.1875, rightPx: 8 }],
      [220, { topPx: 99.75, rightPx: 4 }],
      [160, { topPx: 65, rightPx: 5 }],
      [72, null],
    ])
  })

  test('no Shorts tile carries a duration badge', () => {
    expect(SHORTS_TILES.map((size) => durationBadgeBox(size, true))).toEqual(
      SHORTS_TILES.map(() => null),
    )
  })

  test("a beside card with a title moves the badge in by the gap and the title column, so it stays on the image's corner", () => {
    expect(durationBadgeBox(landscape(500), true)).toEqual({ topPx: 253.25, rightPx: 505 })
    expect(durationBadgeBox(landscape(220), true)).toEqual({ topPx: 99.75, rightPx: 138 })
    expect(durationBadgeBox(landscape(160), true)).toEqual({ topPx: 65, rightPx: 132 })
  })

  test('a below card is as wide as its image with or without a title, so a title moves nothing', () => {
    expect(durationBadgeBox(landscape(347), true)).toEqual(durationBadgeBox(landscape(347), false))
  })
})

describe('where the "New" badge sits', () => {
  test('only the 220 suggested tile carries it, 4px in from its top left corner', () => {
    expect(
      LANDSCAPE_TILES.flatMap((size) => {
        const box = newBadgeBox(size, 'show')
        return box ? [[size.width, box]] : []
      }),
    ).toEqual([[220, { topPx: 4, leftPx: 4 }]])
  })

  test('Hide takes it off the tile', () => {
    expect(newBadgeBox(landscape(220), 'hide')).toBeNull()
  })

  test('no Shorts tile carries it', () => {
    expect(SHORTS_TILES.map((size) => newBadgeBox(size, 'show'))).toEqual(
      SHORTS_TILES.map(() => null),
    )
  })
})
