// YouTube's markup for a watch page, as the fixture of 2026-11-06 shows it
// (test/fixtures/youtube/watch.html, saved with the description collapsed). Each surface keeps its
// page's selectors in its own file; the sidebar's video tiles are in lockup.ts.

/**
 * The block under the player on the watch page on screen: the title, the owner and the view count.
 * Other pages keep a hidden watch page in the document, its block empty, so the surface places only
 * in the one shown. YouTube's older primary info block, which it keeps hidden beside this one, is
 * never selected.
 */
export function watchMetadataIn(document: Document): Element | null {
  return document.querySelector('ytd-watch-flexy:not([hidden]) ytd-watch-metadata')
}

/**
 * Whether YouTube drew `metadata` for `videoId`, which it names in its `video-id` attribute. Matched
 * in a selector against the id the page URL gives, never read. `videoId` is the 11 characters of
 * letters, digits, `-` and `_` that `watchVideoOf` answers, so it needs no escaping.
 */
export function isMetadataOf(metadata: Element, videoId: string): boolean {
  return metadata.matches(`[video-id="${videoId}"]`)
}

/**
 * YouTube's view count under the title: the first span of the info line, before the date. Found by
 * structure, never by its words, which YouTube translates.
 */
export function viewCountUnderTitleIn(metadata: Element): Element | null {
  return metadata.querySelector('ytd-watch-info-text #info > span:first-child')
}
