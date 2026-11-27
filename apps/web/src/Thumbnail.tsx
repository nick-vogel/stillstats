import type { ThumbnailSize } from '@creator-analytics/api-types'
import { useState } from 'react'
import { lengthTextOf, thumbnailSourceOf, thumbnailSrcSetOf, thumbnailUrlOf } from './thumbnail.ts'

/**
 * A video's thumbnail, or an empty box in its place, so no row shows a broken image, with the
 * video's length at its bottom right when Google gives one. The image says nothing to a screen
 * reader; the length reads as "Length 12:34". The browser picks the size of the image that is sharp
 * at the width `sizes` says the box shows at; a failed load of any size leaves the empty box.
 */
export function Thumbnail({
  url,
  thumbnails,
  sizes,
  durationSeconds,
  className,
  lazy = false,
}: {
  /** The medium thumbnail, the `src` a browser without `srcset` loads. */
  url: string | null
  /** Every size Google gives, narrowest first. */
  thumbnails: readonly ThumbnailSize[]
  /** The box's width at each screen width, as app.css sets it. */
  sizes: string
  durationSeconds: number | null
  className: string
  lazy?: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const source = thumbnailSourceOf(thumbnailUrlOf(url, thumbnails), failedUrl)
  const srcSet = thumbnailSrcSetOf(thumbnails)
  const length = lengthTextOf(durationSeconds)
  return (
    <span className={`thumbnail-frame ${className}`}>
      {source ? (
        <img
          className="thumbnail"
          src={source}
          srcSet={srcSet ?? undefined}
          sizes={srcSet ? sizes : undefined}
          alt=""
          width={160}
          height={90}
          loading={lazy ? 'lazy' : undefined}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(source)}
        />
      ) : (
        <span className="thumbnail thumbnail-empty" aria-hidden="true" />
      )}
      {length && (
        <span className="thumbnail-length">
          {/* Approved word for word in creator-analytics#119 (W19). Change it only with Nick. */}
          <span className="visually-hidden">Length </span>
          {length}
        </span>
      )}
    </span>
  )
}
