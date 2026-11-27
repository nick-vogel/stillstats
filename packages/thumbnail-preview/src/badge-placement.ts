// The badge offsets of nick-vogel/nlvogel-site's `src/components/tools/Rails.tsx` at `6d5d921`,
// held apart from the component so the arithmetic nlvogel.com once got wrong has a test.
import type { NewBadgeVisibility } from './slot-state.ts'
import { DURATION_BADGE, RATIO_VALUE, type TileSize } from './thumbnail-sizes.ts'

/**
 * The duration badge's offsets inside its card, or `null` on a surface with no badge. Measured
 * from the card's top right, since the image starts at the card's top left on both placements
 * that carry a badge, and a `below` card is taller than its image by the title under it.
 */
export function durationBadgeBox(
  size: TileSize,
  hasTitle: boolean,
): { topPx: number; rightPx: number } | null {
  if (!size.durationBadge) return null
  const { placement, gapPx, columnPx } = size.title

  // The image's height from its ratio, never the rounded `size.height`: 186 x 1.5 is 279 against a
  // measured 278, and the box the badge sits on comes from `aspect-ratio`.
  const imageHeight = size.width / RATIO_VALUE[size.ratio]

  // `cardStyle` widens a beside card by the gap and the column only when there is a title.
  // Adding them unconditionally put nlvogel.com's badge 509px inside a 500px card.
  const rightPx =
    placement === 'beside' && hasTitle
      ? gapPx + columnPx + size.durationBadge.rightPx
      : size.durationBadge.rightPx

  return {
    topPx: imageHeight - size.durationBadge.bottomPx - DURATION_BADGE.heightPx,
    rightPx,
  }
}

/**
 * The "New" badge's offsets inside its card, or `null` when hidden or on a surface the
 * measurement found none on. Its inset from the image is its inset from the card.
 */
export function newBadgeBox(
  size: TileSize,
  visibility: NewBadgeVisibility,
): { topPx: number; leftPx: number } | null {
  if (visibility === 'hide' || !size.newBadge) return null
  return { topPx: size.newBadge.topPx, leftPx: size.newBadge.leftPx }
}
