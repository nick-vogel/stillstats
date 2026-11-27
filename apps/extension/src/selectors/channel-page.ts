// YouTube's markup for a channel page, as the fixtures of 2026-11-06 and 2026-11-08 show it
// (test/fixtures/youtube/channel-videos.html, channel-home.html and channel-streams.html). Each
// surface keeps its page's selectors in its own file; the video tiles are in lockup.ts.

const channelPages = 'ytd-browse[page-subtype="channels"]'

/**
 * The channel page on screen. YouTube keeps the pages it showed before in the document, hidden, so
 * the surface places only in this one.
 */
export function channelPageIn(document: Document): Element | null {
  return document.querySelector(`${channelPages}:not([hidden])`)
}

/** Every channel page in the document: the one on screen, and any YouTube keeps hidden. */
export function channelPagesIn(document: Document): Element[] {
  return [...document.querySelectorAll(channelPages)]
}

/** The channel page on screen once YouTube has drawn its tab's grid, or null. */
export function channelTabIn(document: Document): Element | null {
  const page = channelPageIn(document)
  return page && tabGridIn(page) ? page : null
}

/**
 * The tab's grid of videos: the Videos and Live tabs' `ytd-rich-grid-renderer`, or the Home tab's
 * `ytd-section-list-renderer` of shelves. Not by `#contents`, which the Home tab nests many times.
 */
export function tabGridIn(page: Element): Element | null {
  return page.querySelector(
    'ytd-two-column-browse-results-renderer #primary :is(ytd-rich-grid-renderer, ytd-section-list-renderer)',
  )
}
