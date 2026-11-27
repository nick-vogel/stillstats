// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'vitest'

import { LANDSCAPE_TILES, NEW_BADGE, SHORTS_TILES } from '../src/thumbnail-sizes.ts'

/**
 * The New badge traces to its measurement file, exactly as the duration badge
 * traces to `youtube-duration-badge.md` in `duration-badge-tracing.test.ts`.
 *
 * WHY A PARSER AND NOT A SECOND TABLE OF LITERALS. The numbers exist in two
 * places, the measurement file and the module, and this test is what holds the
 * two together. A test that restated them would be a third copy, and a third
 * copy passes while the other two disagree.
 *
 * THE FIRST ASSERTION IS THAT THE PARSER SAW SOMETHING. A parser whose regex
 * silently stops matching returns an empty map, and every "for each row" loop
 * below would then pass over nothing. The row count is asserted before any
 * comparison is made, which is what stops that.
 */
const DOC = readFileSync(
  new URL('../../../docs/research/youtube-new-badge.md', import.meta.url),
  'utf8',
)

type Row = { leftPx: number; topPx: number; fill: string; text: string }

/**
 * `| Watch suggested, landscape @1280x1080 | 220x124 | 4px | 4px | \`rgb(255, 255, 255)\` | \`rgb(15, 15, 15)\` | 4 of 34 |`
 *
 * KEYED ON THE WHOLE MEASURED BOX, never on the width alone. The Shorts lockup
 * at 375 desktop UA is 160 wide, and so is the landscape home feed tile on a
 * phone, which carries no badge. Keyed on width, the negative below would have
 * matched the wrong surface's row and failed a tile the measurement cleared.
 */
const parseOffsets = (): Map<string, Row> => {
  const rows = new Map<string, Row>()
  for (const line of DOC.split('\n')) {
    const m = line.match(
      /^\|\s*[^|]+?\s*\|\s*(\d+x\d+)\s*\|\s*(\d+)px\s*\|\s*(\d+)px\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/,
    )
    if (m)
      rows.set(m[1] as string, {
        leftPx: Number(m[2]),
        topPx: Number(m[3]),
        fill: m[4] as string,
        text: m[5] as string,
      })
  }
  return rows
}

/** `| Font size | 12px |` */
const constantOf = (label: string): string | null => {
  const m = DOC.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm'))
  return m ? (m[1] as string) : null
}

const boxOf = (tile: { width: number; height: number }) => `${tile.width}x${tile.height}`

const ALL_TILES = [...LANDSCAPE_TILES, ...SHORTS_TILES]

describe('the New badge traces to its measurement file', () => {
  /**
   * NON-ZERO, NOT A COUNT. The duration badge test pins its row count, and
   * that number is a third copy of a fact the file owns: a re-measurement that
   * adds a profile would fail it for no defect. The issue asks for non-zero,
   * and non-zero is what guards against a regex that silently matches nothing.
   */
  it('parses a non-zero number of per-surface rows, so nothing below is vacuous', () => {
    assert.ok(parseOffsets().size > 0, 'the per-surface table parsed to nothing')
  })

  it('carries the measured offset on every tile whose box the file names', () => {
    const measured = parseOffsets()
    const carrying = ALL_TILES.filter((tile) => tile.newBadge)
    assert.ok(carrying.length > 0, 'no tile carries a New badge')

    for (const tile of carrying) {
      const row = measured.get(boxOf(tile))
      assert.ok(row, `no measured row for ${tile.context} ${boxOf(tile)}`)
      assert.equal(tile.newBadge?.leftPx, row.leftPx, `${tile.context} left`)
      assert.equal(tile.newBadge?.topPx, row.topPx, `${tile.context} top`)
    }
  })

  /**
   * THE NEGATIVE IS HALF THE RECORD. The issue's rule is that a surface the
   * measurement found no badge on draws none, and that no neighbouring
   * surface's offset is copied onto it. A tile with a badge and no row of its
   * own box is exactly that copy, and this is the assertion that refuses it.
   */
  it('carries no badge on any tile whose box the file does not name', () => {
    const measured = parseOffsets()
    for (const tile of ALL_TILES) {
      if (tile.newBadge) continue
      assert.equal(
        measured.get(boxOf(tile)),
        undefined,
        `${tile.context} ${boxOf(tile)} has a measured row and no badge`,
      )
    }
  })

  it('carries the measured constants, which do not vary by surface', () => {
    assert.equal(constantOf('Text'), `\`${NEW_BADGE.text}\``)
    assert.equal(constantOf('Font size'), `${NEW_BADGE.fontSizePx}px`)
    assert.equal(constantOf('Font weight'), String(NEW_BADGE.fontWeight))
    assert.equal(constantOf('Chip height'), `${NEW_BADGE.heightPx}px`)
    assert.equal(constantOf('Corner radius'), `${NEW_BADGE.radiusPx}px`)
    assert.equal(constantOf('Padding'), `${NEW_BADGE.paddingYPx}px ${NEW_BADGE.paddingXPx}px`)
    assert.equal(constantOf('Corner'), 'top left')
    assert.equal(NEW_BADGE.provenance, 'measured')
  })

  /**
   * THE FILL AND THE TEXT COLOUR ARE PER SURFACE, because the file publishes
   * two skins: white with near-black text on a landscape tile, and the duration
   * badge's black on a Shorts lockup. The module records a token NAME per tile
   * and `youtube.css` carries the value, so this is the one place the value is
   * held against the file, exactly as the duration badge's fill is.
   */
  it('paints the fill and the text colour the file publishes for each surface', () => {
    const measured = parseOffsets()
    const css = readFileSync(new URL('../src/youtube.css', import.meta.url), 'utf8')
    const declared = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]

    for (const tile of ALL_TILES) {
      if (!tile.newBadge) continue
      const row = measured.get(boxOf(tile))
      assert.ok(row, `no measured row for ${boxOf(tile)}`)
      assert.equal(declared(tile.newBadge.backgroundVar), row.fill, `${tile.context} fill`)
      assert.equal(declared(tile.newBadge.colorVar), row.text, `${tile.context} text colour`)
    }
  })
})

describe('where the New badge may and may not appear', () => {
  /**
   * MEASURED NEGATIVES, stated as the file states them. The channel Shorts tab
   * showed no chip on any of four profiles, and the tool's Shorts tiles are
   * that tab plus the mobile watch suggested Shorts, which showed none either.
   * The Shorts lockup rows in the file belong to a search shelf the tool has no
   * tile for.
   */
  it('is absent from every Shorts tile', () => {
    for (const tile of SHORTS_TILES) {
      assert.equal(tile.newBadge, undefined, `${tile.context} ${tile.width} carries one`)
    }
  })

  it('is absent from the stress plate, which is not a YouTube context', () => {
    for (const tile of ALL_TILES.filter((t) => t.plate)) {
      assert.equal(tile.newBadge, undefined, `the ${tile.width} plate carries one`)
    }
  })

  /**
   * THE TWO BADGES NEVER SHARE A CORNER, which the file measured on eleven
   * cards carrying both. The module cannot express a corner, so the check is
   * on the numbers: the New badge's inset from the top left is the duration
   * badge's inset from the bottom right on the same tile, which is the file's
   * stated rule for landscape surfaces.
   */
  it('uses the duration badge inset from the opposite corner on every tile carrying both', () => {
    const both = ALL_TILES.filter((tile) => tile.newBadge && tile.durationBadge)
    assert.ok(both.length > 0, 'no tile carries both badges')
    for (const tile of both) {
      assert.equal(tile.newBadge?.leftPx, tile.durationBadge?.rightPx, `${tile.context} left`)
      assert.equal(tile.newBadge?.topPx, tile.durationBadge?.bottomPx, `${tile.context} top`)
    }
  })
})
