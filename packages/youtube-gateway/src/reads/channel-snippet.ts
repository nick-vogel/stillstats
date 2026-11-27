import { hourMs, type ReadDefinition } from '../read-definition.ts'

export interface ChannelSnippet {
  /** ISO 8601, when the channel was created. */
  createdAt: string | null
  /** The channel's name on YouTube. */
  title: string | null
  /** The channel's handle, such as `@nick_vogel`. Null for a channel without one. */
  handle: string | null
}

/**
 * The channel's creation date, title and handle. One channels.list call, 1 unit, from the Data
 * API's channels.list page, checked 2026-10-07. The channels resource page calls the handle's
 * field, `customUrl`, "The channel's custom URL".
 */
export const channelSnippet: ReadDefinition<Record<string, never>, ChannelSnippet> = {
  needs: ['youtube.readonly'],
  cacheKey: () => 'channelSnippet',
  cacheWindowMs: 6 * hourMs,
  async fetch(google) {
    return google.data(1, async (api) => {
      const response = await api.channels.list({ part: ['snippet'], mine: true })
      const snippet = response.data.items?.[0]?.snippet
      return {
        createdAt: snippet?.publishedAt ?? null,
        title: snippet?.title ?? null,
        handle: snippet?.customUrl ?? null,
      }
    })
  },
}
