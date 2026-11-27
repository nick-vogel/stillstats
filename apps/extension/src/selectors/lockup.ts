// YouTube's video tile, `yt-lockup-view-model`, as the youtube.com fixtures of 2026-11-06 and
// 2026-11-08 show it (test/fixtures/youtube/channel-videos.html, channel-home.html and
// channel-streams.html). The home feed and the watch page's sidebar draw their tiles with the same
// markup, so the public page surfaces share these.

/**
 * The video tiles under `root`. A playlist tile is a lockup too, holding a stack of thumbnails, and
 * its links play the playlist's first video, so it is left out: a pill there would claim that
 * video's figure for the whole playlist.
 */
export function videoTilesIn(root: ParentNode): Element[] {
  return [
    ...root.querySelectorAll(
      'yt-lockup-view-model:not(:has(yt-collection-thumbnail-view-model, yt-collections-stack))',
    ),
  ]
}

/** The href of the tile's link to its video, `/watch?v=<id>`, which may carry `&pp=` or `&t=`. */
export function videoHrefIn(tile: Element): string | null {
  return tile.querySelector('a[href^="/watch?v="]')?.getAttribute('href') ?? null
}

/**
 * YouTube's view count in the tile: the metadata text directly after a metadata row's leading
 * icon. Found by structure, never by its words, which YouTube translates; not the first metadata
 * text, which on a channel's Home tab is often the channel's name.
 */
export function viewCountIn(tile: Element): Element | null {
  return tile.querySelector(
    '.ytContentMetadataViewModelMetadataRow > .ytContentMetadataViewModelLeadingIcon + .ytContentMetadataViewModelMetadataText',
  )
}

/** The metadata row that holds the view count `viewCountIn` found, YouTube's line of it. */
export function metadataRowOf(viewCount: Element): Element | null {
  return viewCount.closest('.ytContentMetadataViewModelMetadataRow')
}
