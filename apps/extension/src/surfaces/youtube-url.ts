import type { ListedChannel } from '@creator-analytics/api-types'

// Read from a link's href or the page URL only, never from what the page shows (ADR 0016).

const youtubeOrigin = 'https://www.youtube.com'
/** YouTube's video ids are 11 characters of letters, digits, `-` and `_`. */
const videoId = /^[\w-]{11}$/
const shortsPath = /^\/shorts\/([\w-]{11})\/?$/
const handlePath = /^\/(@[^/]+)(?:\/|$)/
const channelPath = /^\/channel\/(UC[\w-]{22})(?:\/|$)/
/** A channel's Home tab (bare or `/featured`), its Videos tab and its Live tab, in either URL form. */
const channelTabPath = /^\/(?:@[^/]+|channel\/UC[\w-]{22})(?:\/featured|\/videos|\/streams)?\/?$/
/** A channel's Shorts tab, in either URL form. */
const shortsTabPath = /^\/(?:@[^/]+|channel\/UC[\w-]{22})\/shorts\/?$/

/** A channel a link or a URL names: by its handle, `@` first, or by its YouTube channel id. */
type LinkedChannel = { handle: string } | { youtubeChannelId: string }

/** `href` resolved on www.youtube.com, or undefined for a link to another host. */
function youtubeUrlOf(href: string): URL | undefined {
  const url = new URL(href, youtubeOrigin)
  return url.origin === youtubeOrigin ? url : undefined
}

/** The video a `/watch?v=` or `/shorts/` link plays, or undefined for any other link. */
export function videoIdOfLink(href: string): string | undefined {
  const url = youtubeUrlOf(href)
  if (!url) return undefined
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id !== null && videoId.test(id) ? id : undefined
  }
  return shortsPath.exec(url.pathname)?.[1]
}

/**
 * The video a watch page's URL plays, its `v`, whatever other parameters it carries, or undefined
 * for any page but `/watch` on www.youtube.com.
 */
export function watchVideoOf(url: string): string | undefined {
  return youtubeUrlOf(url)?.pathname === '/watch' ? videoIdOfLink(url) : undefined
}

/**
 * The Short a Shorts player's URL plays, its `/shorts/<id>`, or undefined for any other page on
 * www.youtube.com and off it.
 */
export function shortsVideoOf(url: string): string | undefined {
  const page = youtubeUrlOf(url)
  return page && shortsPath.exec(page.pathname)?.[1]
}

/**
 * The channel a `/@handle` or `/channel/UC…` link names, a handle percent-decoded, or undefined for
 * a link that names none. The legacy `/c/` and `/user/` names are not matched: the creator's
 * channels carry no such name to match them against.
 */
export function channelOfLink(href: string): LinkedChannel | undefined {
  const url = youtubeUrlOf(href)
  return url && channelOfPath(url.pathname)
}

function channelOfPath(pathname: string): LinkedChannel | undefined {
  const handle = handlePath.exec(pathname)?.[1]
  if (handle !== undefined) {
    try {
      return { handle: decodeURIComponent(handle) }
    } catch {
      return undefined
    }
  }
  const youtubeChannelId = channelPath.exec(pathname)?.[1]
  return youtubeChannelId ? { youtubeChannelId } : undefined
}

/** A handle as compared: without its `@`, lowercased, since YouTube's handles ignore case. */
const handleKey = (handle: string) => handle.replace(/^@/, '').toLowerCase()

/**
 * The creator's held channel that `channel` is: by handle, whatever its case, or by channel id. A
 * held channel with no handle matches by its id only.
 */
export function heldChannelOf(
  channel: LinkedChannel,
  channels: readonly ListedChannel[],
): ListedChannel | undefined {
  if ('youtubeChannelId' in channel)
    return channels.find(({ youtubeChannelId }) => youtubeChannelId === channel.youtubeChannelId)
  const key = handleKey(channel.handle)
  return channels.find(({ handle }) => handle !== null && handleKey(handle) === key)
}

/**
 * The channel of a channel page on its Videos, Live or Home tab, or undefined on any other tab
 * (Shorts, Playlists, Posts) and off channel pages.
 */
export function channelTabOf(url: string): LinkedChannel | undefined {
  const { pathname } = new URL(url)
  return channelTabPath.test(pathname) ? channelOfPath(pathname) : undefined
}

/** The channel of a channel page on its Shorts tab, or undefined on any other page. */
export function shortsTabOf(url: string): LinkedChannel | undefined {
  const page = youtubeUrlOf(url)
  return page && shortsTabPath.test(page.pathname) ? channelOfPath(page.pathname) : undefined
}
