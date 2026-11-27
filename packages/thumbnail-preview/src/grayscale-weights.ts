// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * The single source for the two grayscale conversion matrices the thumbnail
 * preview tool renders, and for the `feColorMatrix` string that carries them.
 *
 * WHERE THE NUMBERS COME FROM. Both triples are fitted, not chosen. The
 * committed harness `scripts/measure/grayscale-conversions.mjs` re-derives them
 * by ordinary least squares over seven anchor colors against Photoshop's exact
 * Black and White algorithm, then divides each triple by its own sum so white
 * stays white. That harness imports THIS module and exits nonzero when its own
 * derivation disagrees to four decimal places, so a disagreement is an exit code
 * rather than an argument. NOTHING HERE IS RETYPED FROM MEMORY, and nothing here
 * may be "corrected" without re-running the harness.
 *
 * WHY A MATRIX CAN ONLY EVER APPROXIMATE. Photoshop's Black and White
 * adjustment classifies a pixel by hue and then applies the matching slider
 * weight, and a linear color matrix has no branch on hue. These triples are the
 * closest linear stand-in, never a reproduction, and no visitor-facing claim may
 * say otherwise.
 *
 * THE MEASUREMENT CAVEAT, verbatim from the spec's Constraints section: the
 * worst observed errors 0.0473 (red, sky blue) and 0.0426 (blue, grass) come
 * from a 14-color sample in which several colors clip at 0 or 1 and agree
 * trivially, so neither figure is a proved bound.
 *
 * WHY THE INTERPOLATION SPACE MATTERS, and it is not a detail. Every
 * `feColorMatrix` fed by this module MUST carry
 * `color-interpolation-filters="sRGB"`. The SVG 1.1 default is linearRGB, which
 * silently disagrees with both CSS `grayscale()` and Photoshop: the same weights
 * then produce different pixels from the ones these numbers were fitted to, with
 * no error and nothing to read in the markup. The triples are meaningless
 * without that attribute, which is why the reference markup at
 * `docs/design/nlv-72-canvas/_filters.html` sets it on both filters.
 *
 * THE STAKES THESE REPLACE. Rec. 709 luma separates a light skin tone
 * (0.90, 0.70, 0.60) from a blue sky (0.50, 0.70, 1.00) by 0.056 on a 0 to 1
 * scale, which flattens the subject-against-background question the preview
 * exists to answer. The red filter separates the same pair by 0.703, the blue
 * filter by 0.518 in the opposite direction.
 */

/**
 * `[red, green, blue]` coefficients, on the scale where white's response is 1.0.
 * Every triple sums to 1 by construction, which is the white normalization.
 */
export type GrayscaleWeights = readonly [number, number, number]

/**
 * High Contrast Red Filter. Slider inputs 120, 120, -10, -50, -50, 120.
 * Darkens sky, brightens skin, and it is the conversion Nick judged visibly
 * better on 2026-08-23.
 */
export const RED_FILTER_WEIGHTS = [1.4865, -0.1351, -0.3514] as const

/**
 * High Contrast Blue Filter. Slider inputs -50, -50, -50, 150, 150, 150.
 * The opposite trade: it darkens skin and brightens sky, so a subject that
 * survives this one separates on its own shape rather than on its warmth.
 */
export const BLUE_FILTER_WEIGHTS = [-0.2941, -0.2941, 1.5882] as const

/**
 * The 20-value `feColorMatrix` `values` string for one triple: the triple as
 * each of the three color rows, each row ending `0 0`, then the identity alpha
 * row `0 0 0 1 0`.
 *
 * DERIVED, NEVER HAND-WRITTEN IN JSX. A matrix string and a constant that
 * disagree is the one failure this module cannot be allowed to have, and
 * building the string here makes that unrepresentable instead of merely tested.
 *
 * Single spaces throughout. The reference markup at
 * `docs/design/nlv-72-canvas/_filters.html` groups its rows with double spaces
 * for reading; SVG parses both identically, and the single-spaced form is what
 * this module's verification asserts.
 */
export const colorMatrixValues = (weights: GrayscaleWeights): string => {
  const row = `${weights[0]} ${weights[1]} ${weights[2]} 0 0`
  return `${row} ${row} ${row} 0 0 0 1 0`
}
