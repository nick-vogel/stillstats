// YouTube's markup for the home feed, search results and the watch page's sidebar, as the fixtures
// of 2026-11-06 show it (test/fixtures/youtube/home-feed.html, search.html and watch.html). Each
// surface keeps its page's selectors in its own file; the home feed's and the sidebar's video tiles
// are lockups, in lockup.ts. Every fixture keeps other pages in the document, so each container is
// the one of the page the URL shows. YouTube repeats ids such as `metadata-line` in every tile, so
// they are matched as `[id="…"]`: jsdom resolves `#id` to the first element in the document.

/** The home feed's grid of tiles, in the home page on screen; YouTube keeps others hidden. */
export function homeFeedIn(document: Document): Element | null {
  return document.querySelector(
    'ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer',
  )
}

/** The list of search results, in the search page on screen; YouTube keeps others hidden. */
export function searchResultsIn(document: Document): Element | null {
  return document.querySelector('ytd-search:not([hidden]) ytd-section-list-renderer')
}

/**
 * The watch page's sidebar of related videos. The saves put it under the app's `#secondary`, outside
 * `ytd-watch-flexy`, and keep it in the document on every page, so only the URL says it is shown.
 */
export function watchSidebarIn(document: Document): Element | null {
  return document.querySelector('ytd-watch-next-secondary-results-renderer')
}

/**
 * The video results under `root`: each `ytd-video-renderer`, and each `ytd-grid-video-renderer` of a
 * shelf such as "Watch again". Neither a Shorts shelf's tiles, nor a playlist, which search draws as
 * a lockup, is one.
 */
export function searchTilesIn(root: ParentNode): Element[] {
  return [...root.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer')]
}

/**
 * The href of a search result's link to its video, `/watch?v=<id>`, which may carry `&pp=` or
 * `&t=`: the first one, the thumbnail's. Every other link in the result plays the same video.
 */
export function searchVideoHrefIn(tile: Element): string | null {
  return tile.querySelector('a[href^="/watch?v="]')?.getAttribute('href') ?? null
}

/**
 * YouTube's view count in a search result: the first item of its metadata line, before the date.
 * Found by structure, never by its words, which YouTube translates.
 */
export function searchViewCountIn(tile: Element): Element | null {
  return tile.querySelector('[id="metadata-line"] > span')
}
