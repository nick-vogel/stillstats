import {
  type Answer,
  type Asked,
  channelOf,
  googleError,
  listParameter,
  uploadsPlaylistOf,
} from '../channel-data.ts'

const parts = new Set(['id', 'snippet', 'contentDetails'])

/** `channels.list` with `mine=true`, for the parts the gateway reads. */
export function channelsList(asked: Asked): Answer {
  const { query, youtubeChannelId } = asked
  const requested = listParameter(query, 'part')
  if (query.get('mine') !== 'true') return googleError(400, 'The fake answers mine=true only')
  if (!requested.every((part) => parts.has(part))) {
    return googleError(400, 'The fake answers the id, snippet and contentDetails parts only')
  }
  const channel = channelOf(asked)
  const items = youtubeChannelId
    ? [
        {
          kind: 'youtube#channel',
          id: youtubeChannelId,
          ...(requested.includes('snippet') && channel
            ? {
                snippet: {
                  publishedAt: channel.createdAt,
                  ...(channel.title === undefined ? {} : { title: channel.title }),
                  ...(channel.handle === undefined ? {} : { customUrl: channel.handle }),
                },
              }
            : {}),
          ...(requested.includes('contentDetails')
            ? {
                contentDetails: {
                  relatedPlaylists: { uploads: uploadsPlaylistOf(youtubeChannelId) },
                },
              }
            : {}),
        },
      ]
    : []
  return { status: 200, body: { kind: 'youtube#channelListResponse', items } }
}
