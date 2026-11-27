// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  ALLOWED_COPY_NUMBERS,
  LANDSCAPE_TILES,
  MASTER_LANDSCAPE,
  MASTER_SHORTS,
  RATIO_VALUE,
  SHORTS_CROP_BAND_FRACTION,
  SHORTS_CROP_TOTAL_FRACTION,
  SHORTS_TILES,
} from '../src/thumbnail-sizes.ts'

/**
 * These sizes are the product. A wrong number here is not a cosmetic defect: it
 * renders a thumbnail at a size YouTube never uses, on a page whose only claim
 * is that its sizes are real. Two earlier size sets were estimates and both
 * were wrong, so this file exists to make a silent regression impossible.
 */

const ALL_TILES = [...LANDSCAPE_TILES, ...SHORTS_TILES]

describe('tile geometry', () => {
  it('states a height within 1px of width divided by its ratio, for every tile', () => {
    // The label quotes YouTube's own rounded height, so the box computed from
    // `aspect-ratio` and the stated height are allowed to differ by up to a
    // pixel. 186 x 1.5 is 279 against a measured 278, which is the tightest
    // case and the reason the tolerance is 1px rather than 0.
    for (const t of ALL_TILES) {
      const computed = t.width / RATIO_VALUE[t.ratio]
      assert.ok(
        Math.abs(computed - t.height) <= 1,
        `${t.context} ${t.width}: stated height ${t.height}, computed ${computed.toFixed(3)}`,
      )
    }
  })

  it('renders the dimensions label from the width and the height', () => {
    // Derived, not hand-written. A label disagreeing with its own box is the
    // one failure this module may not have.
    for (const t of ALL_TILES) {
      assert.ok(
        t.dimensions.startsWith(`${t.width} x ${t.height}`),
        `${t.context}: label "${t.dimensions}" does not open with ${t.width} x ${t.height}`,
      )
    }
  })

  it('keeps five landscape tiles and four Shorts tiles', () => {
    assert.equal(LANDSCAPE_TILES.length, 5)
    assert.equal(SHORTS_TILES.length, 4)
  })

  it('gives Shorts TWO ratios, which is the finding that reshaped the feature', () => {
    // Rendering every Shorts tile at 9:16 is the specific defect this set
    // exists to correct, so the mix is asserted rather than assumed.
    const ratios = SHORTS_TILES.map((t) => t.ratio)
    assert.deepEqual(ratios, ['2/3', '2/3', '9/16', '2/3'])
  })

  it('marks exactly one stress plate per mode', () => {
    assert.equal(LANDSCAPE_TILES.filter((t) => t.plate).length, 1)
    assert.equal(SHORTS_TILES.filter((t) => t.plate).length, 1)
  })

  it('measures every landscape tile at 16:9 and every width descending', () => {
    assert.deepEqual(
      LANDSCAPE_TILES.map((t) => t.width),
      [500, 347, 220, 160, 72],
    )
    assert.ok(LANDSCAPE_TILES.every((t) => t.ratio === '16/9'))
  })

  it('measures the Shorts widths as the measurement recorded them', () => {
    assert.deepEqual(
      SHORTS_TILES.map((t) => t.width),
      [214, 186, 148, 72],
    )
  })
})

describe('ALLOWED_COPY_NUMBERS', () => {
  it('contains every tile width, every tile height and both master dimensions', () => {
    for (const n of [
      500, 281, 347, 195, 220, 124, 160, 90, 72, 41, 214, 321, 186, 278, 148, 263, 108, 1280, 720,
      1080, 1920,
    ]) {
      assert.ok(ALLOWED_COPY_NUMBERS.has(n), `${n} is missing from the allowed set`)
    }
  })

  it('holds exactly 21 numbers, so nothing is silently added', () => {
    // 72 appears in both modes and collapses to one member. A count that drifts
    // means a tile was added or removed without this test being reconsidered.
    assert.equal(ALLOWED_COPY_NUMBERS.size, 21)
  })

  it('EXCLUDES 120, 168 and 360, the three disproven design estimates', () => {
    // This is the whole point of AC 18. The approved design's supporting copy
    // said thumbnails render at "120 pixels wide or less", directly under a
    // tile labelled 500. 168 and 360 are the other two figures the earlier
    // estimated sets carried. If any of these ever passes, the copy check has
    // stopped protecting the page from contradicting its own tiles.
    for (const n of [120, 168, 360]) {
      assert.ok(!ALLOWED_COPY_NUMBERS.has(n), `${n} must not be an allowed copy number`)
    }
  })

  it('takes its master dimensions from the exported constants', () => {
    assert.deepEqual(MASTER_LANDSCAPE, { width: 1280, height: 720 })
    assert.deepEqual(MASTER_SHORTS, { width: 1080, height: 1920 })
  })
})

/**
 * The crop overlay's arithmetic. It is the one number in this module that is
 * INFERRED rather than measured, so it gets the tightest chain available: the
 * total is derived from the two ratios, and the split is the only assumption.
 */
describe('the Shorts crop bands', () => {
  /**
   * COMPARED WITH A TOLERANCE, not with `assert.equal`. The value is derived,
   * so `(16 / 9 - 3 / 2) / (16 / 9)` lands on 0.15624999999999994 rather than on
   * 0.15625. An exact comparison here failed on its first run, which is the same
   * limit the mismatch band's boundary case ran into.
   */
  it('removes 15.625% of the authored frame, which is 16/9 cropped to 3/2', () => {
    assert.ok(
      Math.abs(SHORTS_CROP_TOTAL_FRACTION - 0.15625) < 1e-12,
      `total ${SHORTS_CROP_TOTAL_FRACTION}`,
    )
  })

  it('splits that evenly, giving the 7.8% each band renders at', () => {
    assert.ok(
      Math.abs(SHORTS_CROP_BAND_FRACTION - 0.078125) < 1e-12,
      `band ${SHORTS_CROP_BAND_FRACTION}`,
    )
    assert.equal(SHORTS_CROP_BAND_FRACTION * 2, SHORTS_CROP_TOTAL_FRACTION)
  })

  /**
   * THE SURVIVING AREA IS 2:3, which is the whole claim the bands make. Asserted
   * from the fraction rather than restated, so a band height that did not leave
   * a 2:3 live area could not pass.
   */
  it('leaves a live area at exactly the 2:3 the desktop grid crops to', () => {
    const authored = 16 / 9
    const surviving = authored * (1 - SHORTS_CROP_TOTAL_FRACTION)
    assert.ok(Math.abs(surviving - 3 / 2) < 1e-12, `surviving height ratio ${surviving}`)
  })
})

/**
 * EVERY SHORTS TITLE RECORD, AGAINST AC 27's OWN LITERALS.
 *
 * `title-typography-tracing.test.ts` ties each `measured` value to a row in the
 * measurement file, which is the right chain for a measured value and no chain
 * at all for the two `extrapolated` tiles: it pins their font size and nothing
 * else. So retyping the Shorts 72's line height from 17.5 to 30, or its clamp
 * from 2 to 4, left every unit test green.
 *
 * This suite is the unit-level half of the gate's `SHORTS_TITLE_SPEC`. Both
 * transcribe the same AC and neither reads the module, so a wrong record has to
 * survive two independent lists rather than move both sides of one comparison.
 *
 * Source: nlvogel-site's `docs/specs/nlvogel-thumbnail-preview.md`, AC 27: Shorts, as
 * `size/weight/line-height/clamp/placement/gap/column`.
 */
describe('the Shorts title records match the spec, value by value', () => {
  const SPEC = {
    214: {
      fontSizePx: 16,
      fontWeight: 500,
      lineHeightPx: 22,
      lineClamp: 2,
      placement: 'below',
      gapPx: 9,
      columnPx: 153,
    },
    186: {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 20,
      lineClamp: 3,
      placement: 'overlay',
      gapPx: 32,
      columnPx: 148,
    },
    148: {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 20,
      lineClamp: 3,
      placement: 'overlay',
      gapPx: 32,
      columnPx: 111,
    },
    72: {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 17.5,
      lineClamp: 2,
      placement: 'below',
      gapPx: 8,
      columnPx: 72,
    },
  } as const

  it('covers all four Shorts surfaces and no others', () => {
    assert.deepEqual(
      SHORTS_TILES.map((t) => t.width),
      [214, 186, 148, 72],
    )
  })

  for (const tile of SHORTS_TILES) {
    const expected = SPEC[tile.width as keyof typeof SPEC]
    it(`sets the Shorts ${tile.width} title to ${expected.fontSizePx}/${expected.fontWeight}/${expected.lineHeightPx}, clamped at ${expected.lineClamp}`, () => {
      assert.equal(tile.title.fontSizePx, expected.fontSizePx)
      assert.equal(tile.title.fontWeight, expected.fontWeight)
      assert.equal(tile.title.lineHeightPx, expected.lineHeightPx)
      assert.equal(tile.title.lineClamp, expected.lineClamp)
    })

    it(`places the Shorts ${tile.width} title ${expected.placement}, at ${expected.gapPx} and ${expected.columnPx}px`, () => {
      assert.equal(tile.title.placement, expected.placement)
      assert.equal(tile.title.gapPx, expected.gapPx)
      assert.equal(tile.title.columnPx, expected.columnPx)
    })
  }
})

/**
 * The description placeholder (NLV-33). It is the one field in this module that
 * is NOT a measurement, so the suite pins where it may appear as tightly as it
 * pins the measured numbers, for the opposite reason: a measured value must be
 * right, and this one must not spread.
 */
describe('the description placeholder', () => {
  it('is carried by exactly one surface', () => {
    const carrying = ALL_TILES.filter((tile) => tile.descriptionLines !== undefined)
    assert.equal(carrying.length, 1)
    assert.equal(carrying[0]?.context, 'Search results')
    assert.equal(carrying[0]?.width, 500)
  })

  it('is four lines', () => {
    const searchResults = LANDSCAPE_TILES.find((tile) => tile.context === 'Search results')
    assert.equal(searchResults?.descriptionLines, 4)
  })

  /**
   * THE OTHER TWO `beside` SURFACES MUST NOT HAVE ONE, and this is the case the
   * count test above cannot make on its own. YouTube puts a channel name and a
   * view count beside a suggested video, not a description, so drawing the same
   * placeholder there would preview an element that surface does not have.
   */
  it('is absent from the other surfaces that place a title BESIDE the thumbnail', () => {
    const otherBeside = ALL_TILES.filter(
      (tile) => tile.title.placement === 'beside' && tile.context !== 'Search results',
    )
    assert.ok(otherBeside.length > 0, 'no other beside surface exists, so this proves nothing')
    for (const tile of otherBeside) {
      assert.equal(tile.descriptionLines, undefined, `${tile.context} ${tile.width} carries one`)
    }
  })

  /**
   * IT IS NOT IN THE TITLE RECORD. Every field of `TitleSpec` claims to trace to
   * a row in the measurement file, and this number does not. Keeping it out is
   * what stops it being read as measured.
   */
  it('is not a field of the measured title record', () => {
    const searchResults = LANDSCAPE_TILES.find((tile) => tile.context === 'Search results')
    assert.ok(searchResults)
    assert.equal('descriptionLines' in searchResults.title, false)
    assert.equal(searchResults.title.provenance, 'measured')
  })
})
