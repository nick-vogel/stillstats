// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'vitest'

import { DURATION_BADGE, LANDSCAPE_TILES, SHORTS_TILES } from '../src/thumbnail-sizes.ts'

/**
 * The duration badge traces to its measurement file, exactly as the title
 * values trace to theirs.
 *
 * WHY A PARSER AND NOT A SECOND TABLE OF LITERALS. A test that restates the
 * numbers is a third copy of them, and a third copy drifts: it passes while the
 * module and the measurement file disagree, because neither is what it compares
 * against. This reads `docs/research/youtube-duration-badge.md` and fails if the
 * module stops matching the file the numbers came from.
 *
 * The equivalent for titles is `title-typography-tracing.test.ts`, and this file
 * exists rather than growing that one because the two have different sources.
 */
const DOC = readFileSync(
  new URL('../../../docs/research/youtube-duration-badge.md', import.meta.url),
  'utf8',
)

/** `| Search results, 500 x 281 | 500x281 | 12px | 9px |` */
const parseOffsets = (): Map<number, { rightPx: number; bottomPx: number }> => {
  const rows = new Map<number, { rightPx: number; bottomPx: number }>()
  for (const line of DOC.split('\n')) {
    const m = line.match(/^\|\s*[^|]*?(\d+)\s*x\s*\d+\s*\|[^|]*\|\s*(\d+)px\s*\|\s*(\d+)px\s*\|/)
    if (m) rows.set(Number(m[1]), { rightPx: Number(m[2]), bottomPx: Number(m[3]) })
  }
  return rows
}

/** `| Font size | 12px |` */
const constantOf = (label: string): string | null => {
  const m = DOC.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm'))
  return m ? (m[1] as string) : null
}

describe('the duration badge traces to its measurement file', () => {
  it('parses four per-surface offset rows, so the comparisons below are not vacuous', () => {
    assert.equal(parseOffsets().size, 4)
  })

  it('carries the measured offset for every surface that has a badge', () => {
    const measured = parseOffsets()
    const carrying = LANDSCAPE_TILES.filter((tile) => tile.durationBadge)
    assert.equal(carrying.length, 4)

    for (const tile of carrying) {
      const row = measured.get(tile.width)
      assert.ok(row, `no measured row for ${tile.width}`)
      assert.deepEqual(tile.durationBadge, row, `${tile.context} ${tile.width}`)
    }
  })

  it('carries the measured constants, which do not vary by surface', () => {
    assert.equal(constantOf('Font size'), `${DURATION_BADGE.fontSizePx}px`)
    assert.equal(constantOf('Font weight'), String(DURATION_BADGE.fontWeight))
    /**
     * THE CHIP'S HEIGHT, NOT ITS TEXT'S. The two are different elements and the
     * first version of this record used the text's 18px, which is the same
     * confusion that put the wrong corner offsets in the module. The row is
     * named "Chip height" so the label itself carries the distinction.
     */
    assert.equal(constantOf('Chip height'), `${DURATION_BADGE.heightPx}px`)
    assert.equal(constantOf('Corner radius'), `${DURATION_BADGE.radiusPx}px`)
    assert.equal(
      constantOf('Padding'),
      `${DURATION_BADGE.paddingYPx}px ${DURATION_BADGE.paddingXPx}px`,
    )
    assert.equal(DURATION_BADGE.provenance, 'measured')
  })

  /**
   * THE FILL IS THE ONE MEASURED VALUE THE DESIGN CONTRACT OTHERWISE FORBIDS,
   * so it is the one most worth tying to its measurement. It lives in
   * `youtube.css` under the `--yt-` prefix that `check:copy` allowlists, and
   * nothing else asserts it: the module records only the token NAME, and the
   * gate legs assert geometry. Without this, `--yt-badge-bg` could be changed
   * to any colour and every check would stay green.
   */
  it('paints the fill the measurement file publishes', () => {
    const measured = constantOf('Background')
    assert.ok(measured, 'no Background row in the measurement file')
    const value = measured.replaceAll('`', '')

    const css = readFileSync(new URL('../src/youtube.css', import.meta.url), 'utf8')
    const declared = css.match(new RegExp(`${DURATION_BADGE.backgroundVar}:\\s*([^;]+);`))?.[1]
    assert.equal(declared, value)
  })
})

describe('where the duration badge may and may not appear', () => {
  /**
   * A MEASURED NEGATIVE, not an assumption. The harness returned four Shorts
   * box groups across every profile and zero badges in any of them, so this is
   * a result rather than a design choice.
   */
  it('is absent from every Shorts surface', () => {
    for (const tile of SHORTS_TILES) {
      assert.equal(tile.durationBadge, undefined, `${tile.context} ${tile.width} carries one`)
    }
  })

  it('is absent from the stress plate, which is not a YouTube context', () => {
    for (const tile of [...LANDSCAPE_TILES, ...SHORTS_TILES].filter((t) => t.plate)) {
      assert.equal(tile.durationBadge, undefined, `the ${tile.width} plate carries one`)
    }
  })

  /**
   * THE BADGE FOLLOWS THE TITLE RECORD, because its position is computed from
   * `placement`, `gapPx` and `columnPx`. A tile with a badge and no title
   * record would have nothing to compute from.
   */
  it('never appears on a surface with no title record to position it against', () => {
    for (const tile of LANDSCAPE_TILES) {
      if (!tile.durationBadge) continue
      /**
       * `tile.title` is non-nullable, so asserting it exists can only fail if
       * the type is loosened, and typecheck moves first. What IS at risk is the
       * two numbers the render adds to the badge's offset on a `beside` card:
       * a missing or zero column would put the badge back inside the image and
       * look almost right.
       */
      assert.notEqual(tile.title.placement, 'overlay', `${tile.context} is an overlay surface`)
      if (tile.title.placement !== 'beside') continue
      assert.ok(tile.title.gapPx > 0, `${tile.context} has no gap to offset the badge by`)
      assert.ok(tile.title.columnPx > 0, `${tile.context} has no column to offset the badge by`)
    }
  })
})
