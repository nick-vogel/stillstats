// Moved from nick-vogel/nlvogel-site at `6d5d921`. The AC and issue numbers, the gate, the check
// scripts and any path outside `docs/research/` and this package that these comments cite are
// nlvogel-site's.

/**
 * What the tool says about a candidate whose shape does not match the mode.
 *
 * A PURE FUNCTION, SEPARATE FROM THE COMPONENT, because the branch is the part
 * that can be wrong and a rendered notice is expensive to enumerate. Every case
 * is a unit test; the browser gate proves the wiring once.
 *
 * THE BRANCH IS `modeForImage` AGAINST THE ACTIVE MODE, and that test is what
 * makes each sentence true rather than merely plausible (Nick, 2026-08-12). The
 * spec writes only the landscape sentence and says the Shorts wording must say
 * the image is already cropped rather than that it is the wrong format, naming
 * one case. FOUR cases exist, as a two-by-two of the active mode against whether
 * the image belongs to it:
 *
 *   1. The image belongs to the OTHER mode, so the copy names that: a vertical
 *      image in landscape, or a landscape image in Shorts. Two cases, one per
 *      mode.
 *   2. The image belongs to THIS mode and is still mismatched, which means the
 *      orientation is right and the ratio is not. Two cases again: the 2:3 cover
 *      exported for the Shorts grid, where "already cropped" is true, and a 4:3
 *      photo in landscape, which is 25% off 16:9 and is plainly not vertical.
 *
 * The second half of case 2 is why this is four rather than three. It was found
 * while writing the branch, and a three-case version called that 4:3 photo a
 * vertical image.
 *
 * NONE OF THE FOUR SAYS THE FILE IS BROKEN. Every one of these inputs is a file
 * a working creator plausibly has, and the notice exists to explain what the
 * preview is doing to it, not to refuse it.
 */
import { type Mode, modeForImage, type SlotId, type SlotImage } from './slot-state.ts'

export type MismatchNotice = {
  /** The bold opening sentence. */
  headline: string
  /** The explanation. One sentence. */
  body: string
  /** The one-click action's label. */
  actionLabel: string
  /** The mode the action switches to. */
  targetMode: Mode
  /**
   * The word on the CANDIDATE CHIP, which names what the image IS.
   *
   * The tile's own marker is always "Cropped", because that names what the tile
   * DOES to the image. Two markers saying the same word would be one marker
   * printed twice.
   */
  chipMarker: string
}

/** The tile marker never varies: it names what the tile does, not what it holds. */
export const TILE_MARKER = 'Cropped'

export const mismatchNotice = (
  slot: SlotId,
  image: Pick<SlotImage, 'width' | 'height'>,
  mode: Mode,
): MismatchNotice => {
  /**
   * FOUR CASES, NOT THREE, and the fourth is why this is a two-by-two rather
   * than a list. Both modes have a same-orientation mismatch, not only Shorts: a
   * 4:3 photo in landscape mode is 25% off 16:9, is plainly not vertical, and
   * is a file a working creator plausibly has. A branch written as three cases
   * would have told them their 4:3 photo "is a vertical image".
   */
  const belongsElsewhere = modeForImage(image) !== mode

  if (mode === 'landscape') {
    return belongsElsewhere
      ? {
          // The design's own copy, adopted verbatim by the spec. It is the only
          // one of the four the spec writes out.
          headline: `${slot} is a vertical image.`,
          body: `Landscape mode crops it to 16:9, so the edges you designed are gone. Switch to Shorts to judge it fairly.`,
          actionLabel: 'Switch to Shorts',
          targetMode: 'shorts',
          chipMarker: 'Vertical',
        }
      : {
          headline: `${slot} is not 16:9.`,
          body: `Landscape mode crops ${slot} to 16:9, so the edges you designed are gone.`,
          actionLabel: 'Switch to Shorts',
          targetMode: 'shorts',
          chipMarker: 'Cropped',
        }
  }

  return belongsElsewhere
    ? {
        headline: `${slot} is a landscape image.`,
        body: `Shorts mode shows a 9:16 frame, so most of ${slot} is cropped away.`,
        actionLabel: 'Switch to Landscape',
        targetMode: 'landscape',
        chipMarker: 'Landscape',
      }
    : {
        headline: `${slot} is already cropped.`,
        body: `Shorts mode shows the full 9:16 frame, so ${slot} is judged against more height than it was exported with.`,
        actionLabel: 'Switch to Landscape',
        targetMode: 'landscape',
        chipMarker: 'Cropped',
      }
}
