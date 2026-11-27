// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * The single source for every number the thumbnail preview tool asserts.
 *
 * WHY THIS MODULE EXISTS AT ALL. Two earlier size sets in this feature were
 * estimates and both were wrong, one of them by a factor of four (the approved
 * design said search results render at 120px; the real box is 500px). The
 * tool's entire premise is that its sizes are real, so an estimated number here
 * is not a rounding error, it is the exact defect the tool is built to prevent.
 * Values come from the measurement files, which record the method, the sample
 * and the limits. NOTHING HERE IS RETYPED FROM MEMORY, and nothing here may be
 * "corrected" without re-measuring.
 *
 * THERE ARE TWO SOURCES, NOT ONE, and conflating them is how a stale number
 * survives. Box geometry comes from `docs/research/youtube-measured-sizes.md`
 * (2026-08-10), EXCEPT the suggested row, which that file's own header marks as
 * superseded. That row's 220 x 124 comes from
 * `docs/research/youtube-title-typography.md` (2026-08-11), which is also the
 * source for every title value. Those values HAVE landed: all nine tiles carry
 * a populated `TitleSpec`, and `title-typography-tracing.test.ts` parses that
 * file and fails if any `measured` field stops matching its row.
 *
 * The 2026-08-11 re-measurement is the reason a per-source note exists at all:
 * it proved these numbers DRIFT. The 2026-08-10 harness was never committed and
 * cannot be re-run, so the newer one lives at nlvogel-site's
 * `scripts/measure/youtube-title-typography.mjs` precisely so the next
 * disagreement is settled by re-running rather than by argument.
 *
 * The dimensions label is DERIVED from `width` and `height` rather than being a
 * third hand-written string. A label and a box that disagree is the one failure
 * this module cannot be allowed to have, and deriving it makes that
 * unrepresentable instead of merely tested.
 */

/**
 * `width / height`, matching CSS `aspect-ratio` order.
 *
 * Shorts carry TWO ratios and that is the feature's headline finding: a Shorts
 * cover is authored at 9:16, and YouTube crops it to 2:3 in every desktop grid.
 * It survives at 9:16 only in mobile suggested. A tool rendering Shorts at 9:16
 * alone shows a frame YouTube never displays on desktop.
 */
export type TileRatio = '16/9' | '2/3' | '9/16'

export const RATIO_VALUE: Record<TileRatio, number> = {
  '16/9': 16 / 9,
  '2/3': 2 / 3,
  '9/16': 9 / 16,
}

/**
 * Where YouTube puts the title relative to the thumbnail. THREE values, not two,
 * and the third is the one no derivation would have reached: on mobile, a Shorts
 * title is drawn ON the cover in white, so it COVERS part of the thumbnail.
 */
export type TitlePlacement = 'below' | 'beside' | 'overlay'

/**
 * `measured` means a row in `youtube-title-typography.md` carries this value.
 * `extrapolated` means it does not, because the tile simulates no YouTube
 * surface at all. The two 72px stress tiles are the only extrapolated ones.
 *
 * A FIELD MAY NOT PRESENT ITSELF AS MEASURED WHEN IT IS NOT. That is the whole
 * job of this marker: the tool's one claim is that its numbers are real.
 */
export type TitleProvenance = 'measured' | 'extrapolated'

/**
 * How YouTube sets the title on ONE surface. Measured 2026-08-11; see
 * `docs/research/youtube-title-typography.md` for method, samples and limits.
 *
 * Written as named fields rather than positional arguments on purpose. Seven
 * numbers in a row is exactly the shape that transposes silently, and this
 * module already exists to make that class of disagreement unrepresentable.
 */
export type TitleSpec = {
  fontSizePx: number
  fontWeight: 400 | 500
  lineHeightPx: number
  /** Lines before YouTube clips. Per surface: 2 on most, 3 on four of them. */
  lineClamp: number
  placement: TitlePlacement
  /**
   * Means a different distance per placement, and the module is the only place
   * that says so:
   * - `below`: image bottom edge to title top edge.
   * - `beside`: image right edge to title left edge.
   * - `overlay`: image bottom edge UP to the title block's BOTTOM edge.
   *
   * The overlay case is bottom-anchored deliberately. Measuring to the title's
   * TOP makes the value depend on how many lines the title happens to render,
   * which is how the first measurement published 48 and 88 for two surfaces that
   * both sit 32px off the bottom.
   */
  gapPx: number
  /**
   * The title column's width, which is what decides WHICH WORD the clamp cuts.
   * Never the tile width: YouTube indents the grid card's title by an avatar and
   * truncates the Shorts card's before a menu button, so the real column runs
   * 0.55x to 0.96x of the thumbnail. This tool draws neither piece of chrome but
   * reserves the width they consume, because the cut point is the thing being
   * previewed.
   */
  columnPx: number
  /** Overlay only: px from the cover's LEFT edge. */
  insetLeftPx?: number
  /**
   * The custom property the colour resolves to, never a literal. Overlay titles
   * are white on YouTube's own cover whatever sits behind the page, which is why
   * they do not follow the site's ink.
   */
  colorVar: '--text-primary' | '--yt-overlay-fg'
  provenance: TitleProvenance
}

export type TileSize = {
  /** The true CSS pixel width. A true-pixel tile never scales to fit. */
  width: number
  /**
   * YouTube's own rounded height. Asserted against the box's computed
   * `aspect-ratio` result at plus or minus 1px, never against this label, since
   * 186 x 1.5 is 279 against a measured 278.
   */
  height: number
  ratio: TileRatio
  /** The rail header's first element. */
  context: string
  /** The rail header's second element. Derived, never hand-written. */
  dimensions: string
  /**
   * The stress tile sits on a sunken plate and does not scroll. At 72px three
   * candidates fit any viewport, so a scrolling rail around four tiny tiles
   * reads as an error state. It also carries no `tabindex`, which is why it is
   * excluded from the focus-ring leg.
   */
  plate?: true
  /**
   * How YouTube sets the title on THIS surface. Every tile has one; the scaled
   * references deliberately do not, because YouTube shows no 1280 x 720 or
   * 1080 x 1920 thumbnail beside a title and any type they carried would be
   * invented.
   */
  title: TitleSpec
  /**
   * How many placeholder lines stand in for the description snippet under the
   * title. Absent on every surface that shows no description.
   *
   * **NOT A MEASUREMENT, AND THE FIELD IS SEPARATE FROM `title` FOR THAT
   * REASON.** Every number in `TitleSpec` traces to a row in
   * `docs/research/youtube-title-typography.md`, and this one does not: that file
   * measured titles and never measured a description, so this value is kept out
   * of the record whose whole claim is that its numbers are real.
   *
   * **FOUR LINES IS A DELIBERATE OVERSHOOT, chosen by Nick on 2026-08-13**, and
   * it was chosen against a rendered alternative rather than in the abstract:
   * two heavier bars matching the real snippet's block height were built and
   * looked at side by side, and four won. The real snippet runs to two lines, so
   * four shows more text than YouTube shows and overstates how much of the
   * column is occupied.
   *
   * **THAT IS NOT THE RULE THE 220 AND 160 SURFACES ARE HELD TO, and the
   * difference is what is drawn rather than how much.** Those surfaces get
   * nothing because YouTube puts a channel name and a view count there, so a
   * description block would be the WRONG ELEMENT. Here the element is right and
   * its extent is generous. A creator reading this column sees the shape of a
   * description under their title, which is what it is for; nobody counts the
   * bars against a real result page.
   *
   * It is one constant here and one transcribed constant in the gate, so moving
   * it is a two-line change.
   *
   * It exists because the search results title occupies about a fifth of the
   * column beside a 281px-tall thumbnail, and an empty column tells a creator
   * nothing about how much room their title actually takes up next to the text
   * YouTube puts there.
   */
  descriptionLines?: number
  /**
   * Where YouTube's duration badge sits on THIS surface, measured from the
   * thumbnail's bottom-right corner. Absent on every surface that has none.
   *
   * ONLY THE OFFSET IS PER SURFACE. Everything else about the badge is the same
   * everywhere and lives in `DURATION_BADGE` below, which is the measurement's
   * headline finding rather than a convenience.
   *
   * Source: `docs/research/youtube-duration-badge.md`, measured 2026-08-13.
   */
  durationBadge?: { rightPx: number; bottomPx: number }
  /**
   * Where YouTube's New badge sits on THIS surface, measured from the
   * thumbnail's top-left corner to the chip's top-left corner. Absent on every
   * surface the measurement found no badge on, AND ON NO OTHER BASIS: a tile
   * gets this field only when `youtube-new-badge.md` names its exact box, and
   * `new-badge-tracing.test.ts` fails a tile that carries one without a row.
   *
   * THE FILL IS PER SURFACE, unlike the duration badge's. The file publishes
   * two skins on one chip: white with near-black text on a landscape watch
   * tile, and the duration badge's own black at 60% on a Shorts lockup. Each
   * is a token NAME here and a value in `youtube.css`, held to the file by the
   * tracing test. Today only the landscape skin has a tile to sit on; the
   * Shorts lockups the file measured belong to a search shelf this tool does
   * not draw, and the channel Shorts tab it does draw showed no badge at all.
   *
   * Source: `docs/research/youtube-new-badge.md`, measured 2026-09-19.
   */
  newBadge?: {
    leftPx: number
    topPx: number
    /**
     * The white skin is its own pair of names; the Shorts skin is the duration
     * badge's own black on white, so it reuses those two names rather than
     * minting a second copy of a value. The type admits both so a Shorts
     * lockup tile can carry the badge without touching this record.
     */
    backgroundVar: '--yt-new-badge-bg' | '--yt-badge-bg'
    colorVar: '--yt-new-badge-fg' | '--yt-overlay-fg'
  }
}

/**
 * EVERYTHING ABOUT THE DURATION BADGE THAT DOES NOT VARY, and the fact that
 * this object exists at all is the finding.
 *
 * **The badge does not scale with the thumbnail.** It is 12px type in an 18px
 * box on a 160px thumbnail and on a 500px one, on every profile measured. The
 * approved design derives title size from tile width by formula, and any
 * formula applied here would have scaled the badge, understating how much of a
 * small thumbnail it covers and overstating it on a large one. Measuring is
 * what turned that from a guess into a constant.
 *
 * The WIDTH is not here because it is not a constant: the padding is fixed and
 * the box follows the digits, 30.45px for `m:ss` and 40.44px for `h:mm:ss`. The
 * render sets padding and lets the text size the box, which is what YouTube
 * does.
 *
 * Source: `docs/research/youtube-duration-badge.md`, measured 2026-08-13 with
 * nlvogel-site's `scripts/measure/youtube-title-typography.mjs`.
 */
export const DURATION_BADGE = {
  fontSizePx: 12,
  fontWeight: 500,
  heightPx: 20,
  radiusPx: 4,
  paddingYPx: 1,
  paddingXPx: 4,
  /**
   * THE CUSTOM PROPERTY THE FILL RESOLVES TO, never a literal, exactly as
   * `TitleSpec.colorVar` does and for the same reason. The measured value is
   * `rgba(0, 0, 0, 0.6)`, and it is YouTube's rather than the site's, so it
   * lives under the `--yt-` prefix (`youtube.css`) that `check:copy` allowlists.
   * A literal here would be a second copy of a colour the design contract
   * otherwise forbids.
   */
  backgroundVar: '--yt-badge-bg',
  /** White on a coloured cover, which is what this existing name already means. */
  colorVar: '--yt-overlay-fg',
  provenance: 'measured',
} as const

/**
 * The placeholder duration. It is not measured and does not pretend to be: the
 * badge exists so a creator can see WHAT IT COVERS, and the digits do not
 * change that. `h:mm:ss` is the wider of the two real shapes, so the preview
 * shows the larger footprint rather than the friendlier one.
 */
export const DURATION_BADGE_TEXT = '1:02:25'

/**
 * EVERYTHING ABOUT THE NEW BADGE THAT DOES NOT VARY, and the finding is that it
 * is the duration badge's chip in a different skin: same 12px Roboto 500, same
 * 20px chip, same 4px radius, same `1px 4px` padding, on the same element. Only
 * the corner and the fill change, and the corner is TOP LEFT on all 24 chips
 * the harness measured. The fill is per surface and lives on the tile record.
 *
 * THE TEXT IS MEASURED, NOT A PLACEHOLDER. `New`, capital N and lower case
 * `ew`, with `text-transform: none`, on every chip. It is not `NEW`. The
 * duration badge's digits are invented because nobody supplied a duration;
 * this word is the word YouTube draws.
 *
 * THE WIDTH IS NOT HERE, for the reason the duration badge's is not: the
 * padding is fixed and the box follows the text, 31.86px measured. The render
 * sets the padding and lets the word size the chip.
 *
 * Source: `docs/research/youtube-new-badge.md`, measured 2026-09-19 with
 * nlvogel-site's `scripts/measure/youtube-title-typography.mjs`. Nothing about
 * this badge is published by YouTube; the file records why that made measuring
 * it mandatory.
 */
export const NEW_BADGE = {
  text: 'New',
  fontSizePx: 12,
  fontWeight: 500,
  heightPx: 20,
  radiusPx: 4,
  paddingYPx: 1,
  paddingXPx: 4,
  provenance: 'measured',
} as const

const NOT_A_CONTEXT = ' · not a YouTube context'

const tile = (
  width: number,
  height: number,
  ratio: TileRatio,
  context: string,
  title: TitleSpec,
  suffix = '',
  plate?: true,
): TileSize => ({
  width,
  height,
  ratio,
  context,
  title,
  dimensions: `${width} x ${height}${suffix}`,
  ...(plate ? { plate } : {}),
})

/**
 * Five landscape surfaces. One tile per distinct measured surface at the two
 * gate widths; where a surface returned two values, the larger wins.
 *
 * "Home feed" at both sizes was measured BY PROXY off the channel Videos tab:
 * the logged-out home feed renders no videos at all, and the two use the same
 * `ytd-rich-grid-media` card. The caveat is carried here because these are the
 * two labels a viewer is most likely to challenge.
 */
export const LANDSCAPE_TILES: readonly TileSize[] = [
  // Row: "Search results @1280 and @1440". Weight 400, not 500: desktop search
  // is the one desktop surface YouTube sets lighter, and at 18px it is also the
  // largest title in the set.
  /**
   * THE ONE SURFACE THAT CARRIES A DESCRIPTION. It is spread onto the record
   * rather than passed through `tile()`, because `tile()` is already six
   * positional arguments and this module's own header says that is exactly the
   * shape that transposes silently. A named field on one record cannot.
   *
   * THE OTHER TWO `beside` SURFACES ARE 220 SUGGESTED AND 160 MOBILE HOME FEED,
   * and neither gets one. This comment first called them "the two 220 suggested
   * surfaces", which names a set that does not exist: there is one 220 surface,
   * and the other is the 160 home feed on a phone. YouTube puts a channel name
   * and a view count beside a suggested video, not a description, and the
   * mobile home feed is a different surface again. Drawing the wrong element
   * would be worse than drawing none.
   */
  {
    ...tile(500, 281, '16/9', 'Search results', {
      fontSizePx: 18,
      fontWeight: 400,
      lineHeightPx: 26,
      lineClamp: 2,
      placement: 'beside',
      gapPx: 16,
      columnPx: 481,
      colorVar: '--text-primary',
      provenance: 'measured',
    }),
    descriptionLines: 4,
    durationBadge: { rightPx: 8, bottomPx: 8 },
  },
  // Row: "Grid card (channel videos, proxy for home feed) @1280 and @1440".
  // The 306px column is 0.88x the tile: YouTube indents it by an avatar.
  {
    ...tile(347, 195, '16/9', 'Home feed', {
      fontSizePx: 16,
      fontWeight: 500,
      lineHeightPx: 22,
      lineClamp: 2,
      placement: 'below',
      gapPx: 13,
      columnPx: 306,
      colorVar: '--text-primary',
      provenance: 'measured',
    }),
    durationBadge: { rightPx: 8, bottomPx: 8 },
  },
  // 220 x 124, NOT the 194 x 109 first recorded on 2026-08-10. The re-measurement
  // on 2026-08-11 did not reproduce that box, and the new one is stable across
  // window heights 720/900/1080 and across three videos. Source for THIS row is
  // `youtube-title-typography.md`, not the file the rest of this array cites.
  //
  // Row: "Watch page, suggested @1280". Its column is the ONE value in the
  // measurement file that did not reproduce exactly, reading 121px on two runs
  // and 126px on two others, so the file records it as a range and the gate
  // asserts it with tolerance. 126 is the value the final two runs produced.
  {
    ...tile(220, 124, '16/9', 'Suggested, beside a video', {
      fontSizePx: 14,
      fontWeight: 500,
      lineHeightPx: 20,
      lineClamp: 3,
      placement: 'beside',
      gapPx: 8,
      columnPx: 126,
      colorVar: '--text-primary',
      provenance: 'measured',
    }),
    durationBadge: { rightPx: 4, bottomPx: 4 },
    /**
     * THE ONE TILE IN THE TOOL THAT CARRIES THE NEW BADGE. The file's row is
     * "Watch suggested, landscape @1280x1080 | 220x124 | 4px | 4px", in the
     * white skin, and the same 4px inset as the duration badge on the same
     * tile: the file's stated rule is that the New badge takes the duration
     * badge's inset from the opposite corner. The other three landscape tiles
     * were measured and found without it: the grid rendered the word nowhere,
     * and the landscape search tile carried none on any of 50 cards.
     */
    newBadge: {
      leftPx: 4,
      topPx: 4,
      backgroundVar: '--yt-new-badge-bg',
      colorVar: '--yt-new-badge-fg',
    },
  },
  // Row: "Grid card @375, mobile UA". BESIDE, not below, and that is the row
  // that disproves transferring a placement across widths: the same surface is
  // below at 1280.
  {
    ...tile(160, 90, '16/9', 'Home feed on a phone', {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 17.5,
      lineClamp: 3,
      placement: 'beside',
      gapPx: 8,
      columnPx: 119,
      colorVar: '--text-primary',
      provenance: 'measured',
    }),
    durationBadge: { rightPx: 5, bottomPx: 5 },
  },
  // NO measurement row exists: 72px is not a YouTube context, so this whole
  // record is EXTRAPOLATED from the smallest measured type in the set. The
  // column is the full tile width, the one place this module uses the 1.0x ratio
  // it elsewhere calls a design defect, because the plate reserves no chrome and
  // a narrower column would clip a 72px title to nothing.
  tile(
    72,
    41,
    '16/9',
    'Stress test',
    {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 17.5,
      lineClamp: 2,
      placement: 'below',
      gapPx: 8,
      columnPx: 72,
      colorVar: '--text-primary',
      provenance: 'extrapolated',
    },
    NOT_A_CONTEXT,
    true,
  ),
]

/**
 * Four Shorts surfaces at TWO aspect ratios. The 2:3 tiles are the important
 * ones: they are where a Shorts design actually loses content.
 */
export const SHORTS_TILES: readonly TileSize[] = [
  // Row: "Channel Shorts tab @1280 and @1440".
  tile(214, 321, '2/3', 'Shorts grid, cropped to 2:3', {
    fontSizePx: 16,
    fontWeight: 500,
    lineHeightPx: 22,
    lineClamp: 2,
    placement: 'below',
    gapPx: 9,
    columnPx: 153,
    colorVar: '--text-primary',
    provenance: 'measured',
  }),
  // Row: "Channel Shorts tab @375, mobile UA". OVERLAY: on mobile YouTube draws
  // the title ON the cover in white, over a scrim, so it COVERS part of the
  // thumbnail. `gapPx` is measured from the cover's BOTTOM edge to the title
  // block's bottom edge, which is what makes it independent of line count.
  tile(186, 278, '2/3', 'Shorts grid on a phone', {
    fontSizePx: 14,
    fontWeight: 400,
    lineHeightPx: 20,
    lineClamp: 3,
    placement: 'overlay',
    gapPx: 32,
    columnPx: 148,
    insetLeftPx: 8,
    colorVar: '--yt-overlay-fg',
    provenance: 'measured',
  }),
  // Row: "Watch suggested Shorts @375, mobile UA". Also an overlay, and the same
  // 32px bottom anchor and 8px inset, which is what makes those two numbers a
  // property of the surface rather than of the sampled title.
  tile(148, 263, '9/16', 'Suggested on a phone, full 9:16', {
    fontSizePx: 14,
    fontWeight: 400,
    lineHeightPx: 20,
    lineClamp: 3,
    placement: 'overlay',
    gapPx: 32,
    columnPx: 111,
    insetLeftPx: 8,
    colorVar: '--yt-overlay-fg',
    provenance: 'measured',
  }),
  // NO measurement row: extrapolated, exactly as the landscape stress tile is.
  tile(
    72,
    108,
    '2/3',
    'Stress test',
    {
      fontSizePx: 14,
      fontWeight: 400,
      lineHeightPx: 17.5,
      lineClamp: 2,
      placement: 'below',
      gapPx: 8,
      columnPx: 72,
      colorVar: '--text-primary',
      provenance: 'extrapolated',
    },
    NOT_A_CONTEXT,
    true,
  ),
]

/**
 * The authored master sizes. These are NOT render contexts, which is why they
 * become a scaled reference labelled "not to scale" rather than a true-pixel
 * tile. They are the only tiles that scale.
 */
export const MASTER_LANDSCAPE = { width: 1280, height: 720 } as const
export const MASTER_SHORTS = { width: 1080, height: 1920 } as const

/**
 * ONE CROP BAND, AS A FRACTION OF THE 9:16 REFERENCE'S HEIGHT. Arithmetic, not
 * taste, and written as the arithmetic so nothing can round it into a literal.
 *
 * Cropping a 9:16 frame to 2:3 at constant width removes `16/9 - 3/2 = 0.2778`
 * of the width in height, which is 15.625% of the authored frame's height. The
 * desktop Shorts grid does that to every cover, so the reference shows what goes.
 *
 * THE EVEN SPLIT IS THE ONE INFERRED NUMBER IN THIS MODULE. The measurement
 * captured box sizes and not crop position, so "centre-cropped" is an assumption.
 * If YouTube proves to anchor off-centre the TOTAL of 15.625% still holds and
 * only the split moves, which is why the total is the thing derived and the half
 * is the thing divided out of it.
 */
export const SHORTS_CROP_TOTAL_FRACTION = (16 / 9 - 3 / 2) / (16 / 9)
export const SHORTS_CROP_BAND_FRACTION = SHORTS_CROP_TOTAL_FRACTION / 2

/**
 * Every tile width, union every tile height, union the two master dimensions.
 *
 * This is what AC 18 checks the supporting copy against: no pixel figure in the
 * page copy may contradict a tile label. The union matters, because a true
 * sentence naming the 1280 master or a 281px height must not fail, while the
 * design's own draft sentence ("120 pixels wide or less") must.
 */
export const ALLOWED_COPY_NUMBERS: ReadonlySet<number> = new Set([
  ...[...LANDSCAPE_TILES, ...SHORTS_TILES].flatMap((t) => [t.width, t.height]),
  MASTER_LANDSCAPE.width,
  MASTER_LANDSCAPE.height,
  MASTER_SHORTS.width,
  MASTER_SHORTS.height,
])
