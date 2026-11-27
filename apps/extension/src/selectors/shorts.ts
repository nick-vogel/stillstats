// YouTube's markup for a channel's Shorts tab and the Shorts player, as the fixtures of 2026-11-06
// show it (test/fixtures/youtube/channel-shorts.html and shorts-player.html). The Shorts tab is a
// channel page, so its page and grid are found by channel-page.ts. Each surface keeps its page's
// selectors in its own file.

/**
 * The Shorts tiles under `root`: the inner `ytm-shorts-lockup-view-model`, not the `-v2` element
 * that wraps it, though both carry the same class.
 */
export function shortsTilesIn(root: ParentNode): Element[] {
  return [...root.querySelectorAll('ytm-shorts-lockup-view-model')]
}

/** The href of the tile's link to its Short, `/shorts/<id>`. The tile names no channel. */
export function shortsHrefIn(tile: Element): string | null {
  return tile.querySelector('a[href^="/shorts/"]')?.getAttribute('href') ?? null
}

/**
 * YouTube's view count under the tile's title. Found by its place in the tile, never by its words,
 * which YouTube translates.
 */
export function shortsViewCountIn(tile: Element): Element | null {
  return tile.querySelector('.shortsLockupViewModelHostOutsideMetadataSubhead')
}

/**
 * The Shorts player on screen. Other pages keep a hidden one in the document, so the surface places
 * only in this one.
 */
export function shortsPlayerIn(document: Document): Element | null {
  return document.querySelector('ytd-shorts:not([hidden])')
}

/** Every Shorts player in the document: the one on screen, and any YouTube keeps hidden. */
export function shortsPlayersIn(document: Document): Element[] {
  return [...document.querySelectorAll('ytd-shorts')]
}

const channelNameLink =
  '.ytReelChannelBarViewModelChannelName :is(a[href^="/@"], a[href^="/channel/"])'

/**
 * The player's channel bar: the avatar, the channel name and the subscribe button, in the overlay
 * YouTube shares across the Shorts it plays, not inside a reel. The first one that links a channel.
 */
export function shortsChannelBarIn(player: Element): Element | null {
  return player.querySelector(`yt-reel-channel-bar-view-model:has(${channelNameLink})`)
}

/** The href of the channel bar's channel name link, `/@handle` or `/channel/UC…`, or null. */
export function shortsChannelHrefIn(bar: Element): string | null {
  return bar.querySelector(channelNameLink)?.getAttribute('href') ?? null
}
