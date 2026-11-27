import type { ListedChannel } from '../src/channels.ts'

/**
 * A channel as GET /api/channels lists it, with no title, handle or revenue consent unless `fields`
 * gives them. The YouTube channel id follows the id, so two channels built with two ids differ.
 */
export function listedChannel(fields: Partial<ListedChannel> = {}): ListedChannel {
  const id = fields.id ?? 'c-1'
  return {
    id,
    youtubeChannelId: `UC-${id}`,
    title: null,
    handle: null,
    revenueConsentedAt: null,
    ...fields,
  }
}
