import type { ThumbnailSize } from '@creator-analytics/api-types'
import { timeLabelOf } from './retention.ts'

// Google's medium thumbnail is 320 pixels wide. A narrower size, its 120 pixel default, would win
// the list's 6rem (96 pixel) place on a desktop at 1x and show softer than the medium one did.
const mediumWidth = 320

/**
 * The list thumbnail's width, as app.css sets `.video-list-thumbnail`: on a narrow screen the video
 * column's 10rem `min-width` less its two 0.5rem paddings, else 6rem. Keep it in step with app.css.
 */
export const listThumbnailSizes = '(max-width: 40rem) 9rem, 6rem'

/**
 * The video page thumbnail's width, as app.css sets `.video-detail-thumbnail`: on a narrow screen
 * the content's whole width, the screen less a 1.25rem gutter each side, else 10rem. Between about
 * 500 and 640 pixels the gutter grows to 4vw, so the value overstates by under 10 pixels, which can
 * only pick a sharper image. Keep it in step with app.css.
 */
export const detailThumbnailSizes = '(max-width: 40rem) calc(100vw - 2.5rem), 10rem'

/**
 * The video player placeholder's thumbnail width, as app.css sets `.video-player`: the content's
 * whole width, the screen less a 1.25rem gutter each side, on a narrow screen, else at most 40rem.
 * Keep it in step with app.css.
 */
export const playerThumbnailSizes = '(max-width: 40rem) calc(100vw - 2.5rem), 40rem'

/**
 * The image a browser without `srcset` loads, and the one a failed load is known by: the medium
 * thumbnail, else the narrowest size Google gives, else none.
 */
export function thumbnailUrlOf(
  thumbnailUrl: string | null,
  thumbnails: readonly ThumbnailSize[],
): string | null {
  return thumbnailUrl ?? thumbnails[0]?.url ?? null
}

/**
 * The `srcset` a thumbnail offers: each size from the medium one up, by its width, narrowest first.
 * None when Google gives no such size.
 */
export function thumbnailSrcSetOf(thumbnails: readonly ThumbnailSize[]): string | null {
  const candidates = thumbnails
    .filter(({ width }) => width >= mediumWidth)
    .map(({ url, width }) => `${url} ${width}w`)
  return candidates.length > 0 ? candidates.join(', ') : null
}

/**
 * The thumbnail a box loads: the video's, or none, for an empty box, when YouTube gives the video
 * none or `failedUrl`, the last one that failed to load, is the same thumbnail.
 */
export function thumbnailSourceOf(url: string | null, failedUrl: string | null): string | null {
  return url === failedUrl ? null : url
}

/**
 * A video's length as YouTube writes it on a thumbnail, "12:34" or "1:02:03", or none, in the
 * locale's own digits. With no locale, Intl takes the browser's language.
 */
export function lengthTextOf(durationSeconds: number | null, locale?: string): string | null {
  return durationSeconds ? timeLabelOf(durationSeconds, locale) : null
}
