// Limits: these tests cover which thumbnail the box loads and its length mark, as pure functions,
// and the mark's markup through React's server renderer. No browser runs here, so none shows the
// image, the empty box in its place, the mark at the box's bottom right, a real image failing to
// load, or what a screen reader says. Nick checks those at /app in a real browser. The srcset and
// sizes tests check the attributes the box writes, not the image a browser picks from them: Nick's
// browser walk at 375px and 3 device pixels per CSS pixel checks the list's and the video page's
// stacked thumbnail is sharp, and DevTools on a desktop at 1x that it still downloads the 320 pixel
// image (creator-analytics#156).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Thumbnail } from './Thumbnail.tsx'
import {
  lengthTextOf,
  listThumbnailSizes,
  thumbnailSourceOf,
  thumbnailSrcSetOf,
  thumbnailUrlOf,
} from './thumbnail.ts'

const url = 'https://i.ytimg.com/vi/video-1/mqdefault.jpg'

/** Google's five sizes of video-1's thumbnail, narrowest first, as the API answers them. */
const everySize = [
  { url: 'https://i.ytimg.com/vi/video-1/default.jpg', width: 120 },
  { url, width: 320 },
  { url: 'https://i.ytimg.com/vi/video-1/hqdefault.jpg', width: 480 },
  { url: 'https://i.ytimg.com/vi/video-1/sddefault.jpg', width: 640 },
  { url: 'https://i.ytimg.com/vi/video-1/maxresdefault.jpg', width: 1280 },
]

describe('the thumbnail a box loads', () => {
  test("is the video's thumbnail", () => {
    expect(thumbnailSourceOf(url, null)).toBe(url)
  })

  test('is none when YouTube gives the video no thumbnail', () => {
    expect(thumbnailSourceOf(null, null)).toBeNull()
  })

  test('is none once the thumbnail has failed to load', () => {
    expect(thumbnailSourceOf(url, url)).toBeNull()
  })

  test('is a new thumbnail, even after an earlier one failed to load', () => {
    const next = 'https://i9.ytimg.com/vi/video-2/mqdefault.jpg'
    expect(thumbnailSourceOf(next, url)).toBe(next)
  })
})

describe("a video's length on its thumbnail", () => {
  test('is written as YouTube writes it, minutes and seconds', () => {
    expect(lengthTextOf(754, 'en-US')).toBe('12:34')
  })

  test('takes hours past an hour', () => {
    expect(lengthTextOf(3723, 'en-US')).toBe('1:02:03')
  })

  test("is written in the locale's own digits", () => {
    expect(lengthTextOf(754, 'ar-EG')).toBe('١٢:٣٤')
    expect(lengthTextOf(3723, 'ar-EG')).toBe('١:٠٢:٠٣')
  })

  /** The thumbnail's markup, with `url` as its image. */
  function markupOf(url: string | null, durationSeconds: number | null): string {
    return renderToStaticMarkup(
      createElement(Thumbnail, {
        url,
        thumbnails: url ? [{ url, width: 320 }] : [],
        sizes: listThumbnailSizes,
        durationSeconds,
        className: 'video-list-thumbnail',
      }),
    )
  }

  test('is read by a screen reader as "Length 12:34", on the image and on an empty box', () => {
    for (const markup of [markupOf(url, 754), markupOf(null, 754)]) {
      expect(markup).toContain('<span class="visually-hidden">Length </span>12:34')
    }
  })

  test('shows nothing when Google gives no length', () => {
    expect(markupOf(url, null)).not.toContain('Length')
  })
})

describe('the sizes a thumbnail offers the browser to choose from', () => {
  test('are each size from the medium one up, by its width, leaving out the 120 pixel one so a desktop at 1x keeps the 320 pixel image', () => {
    expect(thumbnailSrcSetOf(everySize)).toBe(
      'https://i.ytimg.com/vi/video-1/mqdefault.jpg 320w, ' +
        'https://i.ytimg.com/vi/video-1/hqdefault.jpg 480w, ' +
        'https://i.ytimg.com/vi/video-1/sddefault.jpg 640w, ' +
        'https://i.ytimg.com/vi/video-1/maxresdefault.jpg 1280w',
    )
  })

  test('are none when Google gives no size at least 320 pixels wide', () => {
    expect(thumbnailSrcSetOf([everySize[0] as (typeof everySize)[number]])).toBeNull()
    expect(thumbnailSrcSetOf([])).toBeNull()
  })
})

describe('the image a browser without srcset loads', () => {
  test('is the medium thumbnail', () => {
    expect(thumbnailUrlOf(url, everySize)).toBe(url)
  })

  test('is the narrowest size Google gives when it gives no medium one', () => {
    const high = 'https://i.ytimg.com/vi/video-1/hqdefault.jpg'
    expect(
      thumbnailUrlOf(null, [
        { url: high, width: 480 },
        { url: 'https://i.ytimg.com/vi/video-1/maxresdefault.jpg', width: 1280 },
      ]),
    ).toBe(high)
  })

  test('is none when Google gives no size', () => {
    expect(thumbnailUrlOf(null, [])).toBeNull()
  })
})

describe("the thumbnail's markup", () => {
  function markupOf(
    thumbnailUrl: string | null,
    thumbnails: { url: string; width: number }[],
    sizes: string,
  ): string {
    return renderToStaticMarkup(
      createElement(Thumbnail, {
        url: thumbnailUrl,
        thumbnails,
        sizes,
        durationSeconds: null,
        className: 'video-list-thumbnail',
      }),
    )
  }

  test('offers every size from the medium one up with its width, the sizes it is given, and the medium thumbnail as its src', () => {
    const markup = markupOf(url, everySize, listThumbnailSizes)

    expect(markup).toMatch(
      /srcset="https:\/\/i\.ytimg\.com\/vi\/video-1\/mqdefault\.jpg 320w, https:\/\/i\.ytimg\.com\/vi\/video-1\/hqdefault\.jpg 480w, https:\/\/i\.ytimg\.com\/vi\/video-1\/sddefault\.jpg 640w, https:\/\/i\.ytimg\.com\/vi\/video-1\/maxresdefault\.jpg 1280w"/i,
    )
    expect(markup).not.toContain('default.jpg 120w')
    expect(markup).toContain(`sizes="${listThumbnailSizes}"`)
    expect(markup).toContain(`src="${url}"`)
  })

  test('is an image for a video with only some sizes', () => {
    const high = 'https://i.ytimg.com/vi/video-1/hqdefault.jpg'
    const markup = markupOf(null, [{ url: high, width: 480 }], listThumbnailSizes)

    expect(markup).toContain(`src="${high}"`)
    expect(markup).not.toContain('thumbnail-empty')
  })

  test('is an image with no srcset for a video with only the 120 pixel size', () => {
    const small = 'https://i.ytimg.com/vi/video-1/default.jpg'
    const markup = markupOf(null, [{ url: small, width: 120 }], listThumbnailSizes)

    expect(markup).toContain(`src="${small}"`)
    expect(markup).not.toMatch(/srcset/i)
  })

  test('is the empty box for a video with no size', () => {
    const markup = markupOf(null, [], listThumbnailSizes)

    expect(markup).toContain('thumbnail-empty')
    expect(markup).not.toContain('<img')
  })
})
