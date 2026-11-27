// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * AC 28's tracing leg. Every `measured` title value in `thumbnail-sizes.ts` has
 * to equal the row it claims to come from in
 * `docs/research/youtube-title-typography.md`.
 *
 * WHY A PARSER AND NOT A SECOND COPY OF THE NUMBERS. A test that restated the
 * expected values would be the same defect this module already guards against:
 * comparing a value to itself. The measurement file is the source, so the test
 * reads the source. If the file and the module ever disagree, one of them moved
 * without the other, and that is exactly the event worth failing on.
 *
 * The 2026-08-11 amendment is the reason this exists at all: a value in this
 * module (194) turned out to be measured-but-stale, and nothing in the repo
 * noticed. A re-measurement now has to update BOTH sides or this goes red.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'vitest'

import { LANDSCAPE_TILES, SHORTS_TILES, type TileSize } from '../src/thumbnail-sizes.ts'

const FILE = new URL('../../../docs/research/youtube-title-typography.md', import.meta.url)
const doc = readFileSync(FILE, 'utf8')

/**
 * Normalization, per AC 28. The tables carry markdown emphasis and explanatory
 * parentheses, and neither is data:
 *   `**16px / 500**`          -> `16px / 500`
 *   `306px (0.88x)`           -> `306px`
 *   `**OVERLAY, white**`      -> `OVERLAY, white`
 */
const clean = (cell: string) =>
  (cell.replace(/\*\*/g, '').replace(/`/g, '').split('(')[0] as string).trim()

/**
 * Labels keep their parentheses; only VALUE cells drop them. The row
 * "Grid card (channel videos, proxy for home feed) @1280 and @1440" carries its
 * proxy caveat inside brackets, and truncating there collapses it to
 * "Grid card", which matches nothing. Found by this suite failing on its first
 * run, which is the behaviour worth keeping.
 */
const cleanLabel = (cell: string) => cell.replace(/\*\*/g, '').replace(/`/g, '').trim()

const numbersIn = (cell: string) => [...clean(cell).matchAll(/[\d.]+/g)].map((m) => Number(m[0]))

/**
 * A table row's cells by column. The surface tables have eight columns and the
 * overlay table two; the suite reads only the columns its table has.
 */
type Row = string[] & Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, string>

/** Every pipe row in the file, as trimmed cells. */
const rows = doc
  .split('\n')
  .filter((l) => l.trimStart().startsWith('|'))
  .map(
    (l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()) as Row,
  )

/** A surface row is one whose first cell matches the label the module cites. */
const rowFor = (label: string) => {
  const found = rows.filter((r) => cleanLabel(r[0]) === label)
  assert.equal(
    found.length,
    1,
    `expected exactly one row labelled "${label}", found ${found.length}`,
  )
  return found[0] as Row
}

/**
 * Which measurement row each tile claims. Kept here rather than in the module
 * because it is test scaffolding, and stated as the file's EXACT labels so the
 * lookup is a match rather than a guess.
 */
const SOURCE_ROW: Record<number, string> = {
  500: 'Search results @1280 and @1440',
  347: 'Grid card (channel videos, proxy for home feed) @1280 and @1440',
  220: 'Watch page, suggested @1280',
  160: 'Grid card @375, mobile UA',
  214: 'Channel Shorts tab @1280 and @1440',
  186: 'Channel Shorts tab @375, mobile UA',
  148: 'Watch suggested Shorts @375, mobile UA',
}

/** Columns of the two surface tables, after the label and the thumb box. */
const TITLE = 2
const LINE_HEIGHT = 3
const CLAMP = 4
const PLACEMENT = 5
const GAP = 6
const COLUMN = 7

const measured = [...LANDSCAPE_TILES, ...SHORTS_TILES].filter(
  (t) => t.title.provenance === 'measured',
)
const extrapolated = [...LANDSCAPE_TILES, ...SHORTS_TILES].filter(
  (t) => t.title.provenance === 'extrapolated',
)

describe('title typography traces to the measurement file', () => {
  it('reads a file that actually contains the tables, so this suite is not vacuous', () => {
    assert.ok(doc.includes('## Landscape'), 'landscape table missing')
    assert.ok(doc.includes('## Shorts'), 'Shorts table missing')
    assert.ok(doc.includes('## The overlay geometry, measured in full'), 'overlay table missing')
    assert.ok(rows.length > 20, `expected many table rows, found ${rows.length}`)
  })

  it('covers every measured tile, and only the two stress tiles are extrapolated', () => {
    assert.equal(measured.length, 7)
    assert.deepEqual(
      extrapolated.map((t) => t.width),
      [72, 72],
    )
    for (const t of measured) {
      assert.ok(SOURCE_ROW[t.width], `tile ${t.width} claims 'measured' with no source row named`)
    }
  })

  for (const tile of measured) {
    describe(`${tile.width}px: ${tile.context}`, () => {
      const row = rowFor(SOURCE_ROW[tile.width] as string)
      const t = tile.title

      it('matches the row it cites, box included', () => {
        assert.deepEqual(numbersIn(row[1]), [tile.width, tile.height], 'thumb box')
      })

      it('matches the measured font size and weight', () => {
        assert.deepEqual(numbersIn(row[TITLE]), [t.fontSizePx, t.fontWeight])
      })

      it('matches the measured line height and clamp', () => {
        assert.deepEqual(numbersIn(row[LINE_HEIGHT]), [t.lineHeightPx])
        assert.deepEqual(numbersIn(row[CLAMP]), [t.lineClamp])
      })

      it('matches the measured placement', () => {
        // The Shorts table writes "OVERLAY, white"; the module writes 'overlay'.
        assert.equal(clean(row[PLACEMENT]).toLowerCase().split(',')[0], t.placement)
      })

      it('matches the measured gap', () => {
        assert.deepEqual(numbersIn(row[GAP]), [t.gapPx])
      })

      /**
       * A RANGE CELL IS SATISFIED BY CONTAINMENT, per AC 28. Only the
       * watch-suggested column is a range: it read 121px on two runs and 126px
       * on two others, and recording it as a single value would be false
       * precision.
       */
      it('falls inside the measured column, which may be a range', () => {
        const bounds = numbersIn(row[COLUMN])
        if (bounds.length === 1) {
          assert.equal(t.columnPx, bounds[0])
        } else {
          assert.equal(bounds.length, 2, `unexpected column cell: ${row[COLUMN]}`)
          assert.ok(
            t.columnPx >= (bounds[0] as number) && t.columnPx <= (bounds[1] as number),
            `${t.columnPx} outside ${bounds[0]}..${bounds[1]}`,
          )
        }
      })
    })
  }

  describe('the overlay geometry table', () => {
    const overlays = [...SHORTS_TILES].filter((t) => t.title.placement === 'overlay')

    it('governs both overlay tiles', () => {
      assert.equal(overlays.length, 2)
    })

    it('gives both the same bottom anchor', () => {
      const [anchor] = numbersIn(rowFor('Bottom anchor')[1])
      for (const t of overlays) assert.equal(t.title.gapPx, anchor)
    })

    it('gives both the same left inset', () => {
      const [inset] = numbersIn(rowFor('Left inset')[1])
      for (const t of overlays) assert.equal(t.title.insetLeftPx, inset)
    })

    it('renders them in white, through the palette rather than a literal', () => {
      assert.match(rowFor('Colour')[1], /255, 255, 255/)
      for (const t of overlays) assert.equal(t.title.colorVar, '--yt-overlay-fg')
    })

    /**
     * The token name alone holds nothing: `youtube.css` carries the value, and
     * the formatter writes it as hex while the file publishes `rgb()`, so the
     * two are compared as channels.
     */
    it('gives the palette token the white the file publishes', () => {
      const css = readFileSync(new URL('../src/youtube.css', import.meta.url), 'utf8')
      const declared = css.match(/--yt-overlay-fg:\s*([^;]+);/)?.[1]?.trim() ?? ''
      const hex = declared.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      const channelsOf = (value: string) => [...value.matchAll(/\d+/g)].map((m) => Number(m[0]))
      assert.deepEqual(
        hex ? hex.slice(1).map((pair) => Number.parseInt(pair, 16)) : channelsOf(declared),
        channelsOf(rowFor('Colour')[1]),
        `--yt-overlay-fg is "${declared}", not the measured colour`,
      )
    })

    it('leaves every non-overlay tile on the site ink and with no inset', () => {
      for (const t of [...LANDSCAPE_TILES, ...SHORTS_TILES]) {
        if (t.title.placement === 'overlay') continue
        assert.equal(t.title.colorVar, '--text-primary')
        assert.equal(t.title.insetLeftPx, undefined)
      }
    })
  })

  describe('provenance cannot lie', () => {
    it('names no extrapolated tile in the measurement tables', () => {
      for (const t of extrapolated) {
        assert.equal(SOURCE_ROW[t.width], undefined, `${t.width} is extrapolated but cites a row`)
      }
    })

    it('gives the extrapolated tiles the smallest measured type, not an invented one', () => {
      const smallest = Math.min(...measured.map((t) => t.title.fontSizePx))
      for (const t of extrapolated) assert.equal(t.title.fontSizePx, smallest)
    })
  })

  describe('the module and the file agree on when they were measured', () => {
    /**
     * BOTH SOURCES, NOT ONE. AC 28's whole point is that the module declares a
     * source AND a date PER VALUE GROUP, because "a single declared date is what
     * makes this AC vacuous": declaring 2026-08-10 against the 2026-08-10 file
     * passes forever while the file that actually drifted goes unwatched.
     *
     * This suite checked the title file alone, which left the box-geometry group
     * in exactly the state the AC describes. Re-measuring
     * `youtube-measured-sizes.md` and moving its date changed nothing anywhere.
     */
    const moduleSrc = () =>
      readFileSync(new URL('../src/thumbnail-sizes.ts', import.meta.url), 'utf8')

    it('declares the same date the TITLE file does', () => {
      const fileDate = /\*\*Measured (\d{4}-\d{2}-\d{2})\*\*/.exec(doc)?.[1]
      assert.ok(fileDate, 'title measurement file states no date')
      assert.ok(
        moduleSrc().includes(`youtube-title-typography.md\` (${fileDate})`),
        `module does not cite the title source at ${fileDate}`,
      )
    })

    it('declares the same date the BOX GEOMETRY file does', () => {
      const geometry = readFileSync(
        new URL('../../../docs/research/youtube-measured-sizes.md', import.meta.url),
        'utf8',
      )
      /**
       * The FIRST such line, per AC 28's normalization clause.
       *
       * **That clause is currently inert, and saying so is the point.** AC 28
       * and an earlier version of this comment both state the file "carries two
       * dates in its opening lines". It carries one `**Measured YYYY-MM-DD**`
       * line; the second date lives in a `**SUPERSEDED IN ONE ROW, 2026-08-11.**`
       * block that this pattern cannot match. Taking the first match is still
       * the right rule, and it will start doing work the day a re-measurement
       * note adds a genuine second one, which is the obvious thing to add.
       */
      const fileDate = /\*\*Measured (\d{4}-\d{2}-\d{2})\*\*/.exec(geometry)?.[1]
      assert.ok(fileDate, 'geometry measurement file states no date')
      assert.ok(
        moduleSrc().includes(`youtube-measured-sizes.md\`\n * (${fileDate})`) ||
          moduleSrc().includes(`youtube-measured-sizes.md\` (${fileDate})`),
        `module does not cite the geometry source at ${fileDate}`,
      )
    })
  })
})

/** Exported only so a future reader can see what the suite covered. */
export const TRACED: readonly TileSize[] = measured
