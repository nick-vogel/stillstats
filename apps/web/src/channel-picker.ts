import type { ListedChannel } from '@creator-analytics/api-types'
import { type Route, routeToList } from './route.ts'

// The label is approved word for word in creator-analytics#54. Change it only with Nick.
export const pickerLabel = 'Channel'

/** Only a creator with more than one channel has a channel to pick. */
export function pickerShownFor(channels: ListedChannel[]): boolean {
  return channels.length > 1
}

/** The channel the route names, when the creator holds it, else the first. */
export function selectedChannelOf(channels: ListedChannel[], route: Route): ListedChannel | null {
  return channels.find(({ id }) => id === route.channel) ?? channels[0] ?? null
}

/**
 * The route to another channel's screen: its first page, with the list's controls and chart choices
 * kept. From the Audience screen it is the new channel's Audience screen, on the window chosen there
 * and keeping the list's own; from any other screen, its channel screen.
 */
export function routeToChannel(route: Route, channelId: string): Route {
  if (route.audience) return { ...route, page: 1, channel: channelId }
  return { ...routeToList(route), page: 1, channel: channelId }
}

/**
 * The channel's name on YouTube alone, or its YouTube channel id when it has no name: the name its
 * screen's heading and Settings show (creator-analytics#119 W9, W12).
 */
export function channelTitleOf({ youtubeChannelId, title }: ListedChannel): string {
  return title || youtubeChannelId
}

/**
 * The sidebar picker's two lines for a channel: its handle on top and its name under it. A channel
 * with no handle shows its name alone, and one YouTube did not name shows its YouTube channel id
 * alone, as `channelNameOf` names it (creator-analytics#531).
 */
export function channelLinesOf(channel: ListedChannel): { handle: string | null; name: string } {
  return {
    handle: channel.title && channel.handle ? channel.handle : null,
    name: channelTitleOf(channel),
  }
}
