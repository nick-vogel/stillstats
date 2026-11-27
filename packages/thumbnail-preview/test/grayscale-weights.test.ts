// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  BLUE_FILTER_WEIGHTS,
  colorMatrixValues,
  type GrayscaleWeights,
  RED_FILTER_WEIGHTS,
} from '../src/grayscale-weights.ts'

/**
 * WHY THIS SUITE ASSERTS SHAPE AND NOT ONLY TWO STRINGS. `feColorMatrix` needs
 * EXACTLY 20 values, and a malformed `values` attribute does not throw: the
 * filter fails to parse, the browser drops it, and the image renders
 * unconverted. That failure is silent to every numeric oracle, because the
 * numbers can be perfectly right inside a string SVG refuses to read. So the
 * structural claims below are read back OUT of the emitted string rather than
 * compared to a second hand-written copy of it, which is what keeps them
 * meaningful after a later phase changes a weight.
 *
 * THERE IS DELIBERATELY NO BYTE-FOR-BYTE ASSERTION ON THE TWO SHIPPED STRINGS,
 * and this note exists so the next reader does not add one back. Such a test
 * has to spell out the weight literals, and AC 12's single-source oracle greps
 * `src/` for the red preset's first coefficient and requires exactly one file
 * to match. A second copy here would make that grep return 2, which is the
 * failure `grayscale-weights.ts` says it exists to make unrepresentable. THAT IS
 * ALSO WHY NO COEFFICIENT IS WRITTEN ANYWHERE IN THIS FILE, comments included.
 *
 * Nothing is lost by its absence. The tests below already pin all 20 tokens for
 * a given triple, since the colour row is built from `weights.map(String)` and
 * the alpha row is compared to a literal, so a reformatted emitter such as one
 * calling `toFixed(2)` still fails. The NUMBERS are held by the last suite
 * below, which re-derives both triples from their slider inputs by the method
 * of `scripts/measure/grayscale-conversions.mjs` and requires the constants to
 * agree to four decimals, so a changed coefficient fails here with no literal
 * of it in this file.
 */

/** The emitted string split into the four rows SVG will read it as. */
const rowsOf = (weights: GrayscaleWeights): string[][] => {
  const values = colorMatrixValues(weights).split(' ')
  return [0, 5, 10, 15].map((start) => values.slice(start, start + 5))
}

/**
 * A triple that is not shipped, so no structural claim here can pass by
 * accident on the two literals the module happens to export today.
 */
const ARBITRARY: GrayscaleWeights = [0.5, 0.25, 0.25]

const EVERY_TRIPLE: readonly GrayscaleWeights[] = [
  RED_FILTER_WEIGHTS,
  BLUE_FILTER_WEIGHTS,
  ARBITRARY,
]

describe('the feColorMatrix values string', () => {
  it('emits exactly 20 values, every one of them a bare number', () => {
    for (const weights of EVERY_TRIPLE) {
      const emitted = colorMatrixValues(weights)
      const values = emitted.split(' ')

      assert.equal(values.length, 20, `feColorMatrix needs 20 values, got "${emitted}"`)

      /**
       * The count alone does not catch comma separators, which keep 20 tokens
       * and poison every one of them, so each token is parsed as a number.
       */
      for (const value of values) {
        assert.ok(
          value.length > 0 && Number.isFinite(Number(value)),
          `"${value}" is not a bare number, in "${emitted}"`,
        )
      }
    }
  })

  it('repeats the triple as three identical colour rows, each ending 0 0', () => {
    for (const weights of EVERY_TRIPLE) {
      const rows = rowsOf(weights)
      const expected = [...weights.map(String), '0', '0']

      assert.deepEqual(rows[0], expected, 'the red row is not the triple followed by 0 0')
      assert.deepEqual(rows[1], rows[0], 'the green row does not match the red row')
      assert.deepEqual(rows[2], rows[0], 'the blue row does not match the red row')
    }
  })

  it('closes with the identity alpha row', () => {
    for (const weights of EVERY_TRIPLE) {
      assert.equal(
        (rowsOf(weights)[3] as string[]).join(' '),
        '0 0 0 1 0',
        'the alpha row is not the identity, so the filter would change opacity',
      )
    }
  })
})

/**
 * The slider inputs Nick supplied on 2026-08-23, as percentages, keyed by
 * Photoshop's six Black and White sliders.
 */
type Sliders = Record<'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas', number>

const RED_FILTER_SLIDERS: Sliders = {
  reds: 120,
  yellows: 120,
  greens: -10,
  cyans: -50,
  blues: -50,
  magentas: 120,
}

const BLUE_FILTER_SLIDERS: Sliders = {
  reds: -50,
  yellows: -50,
  greens: -50,
  cyans: 150,
  blues: 150,
  magentas: 150,
}

type Vec3 = readonly [number, number, number]
type Channel = 0 | 1 | 2

const vec = (at: (channel: Channel) => number): Vec3 => [at(0), at(1), at(2)]

const det3 = ([a, b, c]: readonly [Vec3, Vec3, Vec3]) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) -
  a[1] * (b[0] * c[2] - b[2] * c[0]) +
  a[2] * (b[0] * c[1] - b[1] * c[0])

/**
 * The harness's method: ordinary least squares over the six primary and
 * secondary anchors plus white, each carrying its unclipped Photoshop response,
 * then the triple divided by its own sum so white stays white. The normal
 * equations are solved by Cramer's rule; their matrix is symmetric, so
 * replacing a row stands in for replacing the column.
 */
const fitWeights = (sliders: Sliders): Vec3 => {
  const anchors: readonly { rgb: Vec3; target: number }[] = [
    { rgb: [1, 0, 0], target: sliders.reds / 100 },
    { rgb: [0, 1, 0], target: sliders.greens / 100 },
    { rgb: [0, 0, 1], target: sliders.blues / 100 },
    { rgb: [0, 1, 1], target: sliders.cyans / 100 },
    { rgb: [1, 0, 1], target: sliders.magentas / 100 },
    { rgb: [1, 1, 0], target: sliders.yellows / 100 },
    { rgb: [1, 1, 1], target: 1 },
  ]
  const total = (term: (anchor: { rgb: Vec3; target: number }) => number) =>
    anchors.reduce((sum, anchor) => sum + term(anchor), 0)

  const row = (i: Channel) => vec((j) => total(({ rgb }) => rgb[i] * rgb[j]))
  const xtx = [row(0), row(1), row(2)] as const
  const xty = vec((i) => total(({ rgb, target }) => rgb[i] * target))

  const det = det3(xtx)
  const fitted = vec(
    (k) => det3([k === 0 ? xty : xtx[0], k === 1 ? xty : xtx[1], k === 2 ? xty : xtx[2]]) / det,
  )
  const sum = fitted[0] + fitted[1] + fitted[2]
  return vec((k) => fitted[k] / sum)
}

describe('the shipped coefficients', () => {
  const PRESETS = [
    { name: 'High Contrast Red Filter', shipped: RED_FILTER_WEIGHTS, sliders: RED_FILTER_SLIDERS },
    {
      name: 'High Contrast Blue Filter',
      shipped: BLUE_FILTER_WEIGHTS,
      sliders: BLUE_FILTER_SLIDERS,
    },
  ]

  it('equal the fit of their slider inputs to four decimal places', () => {
    for (const { name, shipped, sliders } of PRESETS) {
      const derived = fitWeights(sliders)
      for (const channel of [0, 1, 2] as const) {
        assert.equal(
          shipped[channel],
          Number(derived[channel].toFixed(4)),
          `${name} channel ${channel} is not the fit of its sliders`,
        )
      }
    }
  })

  it('sum to 1, so white stays white', () => {
    for (const { name, shipped } of PRESETS) {
      const sum = shipped[0] + shipped[1] + shipped[2]
      assert.ok(Math.abs(sum - 1) < 1e-9, `${name} sums to ${sum}, not 1`)
    }
  })
})
