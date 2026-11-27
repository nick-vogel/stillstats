export interface ListedChannel {
  id: string
  youtubeChannelId: string
  /** The channel's name on YouTube. Null when YouTube did not answer it. */
  title: string | null
  /** The channel's handle on YouTube, such as `@nick_vogel`. Null for a channel without one. */
  handle: string | null
  /** When the creator gave revenue consent for the channel, or null before they do. */
  revenueConsentedAt: string | null
}

/**
 * The web app and the extension both name a channel by this, so a creator sees each channel under
 * one name wherever they look.
 */
export function channelNameOf({ youtubeChannelId, title, handle }: ListedChannel): string {
  if (!title) return youtubeChannelId
  return handle ? `${title} (${handle})` : title
}

/** GET /api/channels. */
export interface ChannelsAnswer {
  channels: ListedChannel[]
}

/**
 * POST /api/channels/connect and POST /api/channels/:channelId/revenue-consent. The web app sends
 * the creator to `url`, Google's consent screen.
 */
export interface ConsentStartAnswer {
  url: string
}

/** POST /api/channels/:channelId/disconnect. */
export interface DisconnectAnswer {
  /** False when Google did not confirm the revoke of the channel's grant. */
  revokedAtGoogle: boolean
}
