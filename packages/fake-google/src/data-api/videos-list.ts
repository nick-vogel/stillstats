import { type Answer, type Asked, channelOf, googleError, listParameter } from '../channel-data.ts'

const parts = new Set(['id', 'status', 'contentDetails'])

/**
 * `videos.list` by id with any of the parts `id`, `status` and `contentDetails`, for the signed-in
 * channel's own videos, private and unlisted ones included; an id the channel does not upload is
 * left out. Each video carries its `kind` and `id` and answers only the parts asked, `status`
 * carries the upload's `embeddable` and `madeForKids` when it sets them, and `contentDetails`
 * carries the upload's `duration` when it has one.
 */
export function videosList(asked: Asked): Answer {
  const { query } = asked
  const requested = listParameter(query, 'part')
  if (requested.length === 0 || !requested.every((part) => parts.has(part)))
    return googleError(400, 'The fake answers the id, status and contentDetails parts only')
  const ids = new Set(listParameter(query, 'id'))
  const uploads = channelOf(asked)?.uploads ?? []
  const items = uploads
    .filter((upload) => ids.has(upload.videoId))
    .map((upload) => ({
      kind: 'youtube#video',
      id: upload.videoId,
      ...(requested.includes('status')
        ? {
            status: {
              privacyStatus: upload.privacyStatus ?? (upload.scheduledFor ? 'private' : 'public'),
              ...(upload.scheduledFor ? { publishAt: upload.scheduledFor } : {}),
              ...(upload.embeddable === undefined ? {} : { embeddable: upload.embeddable }),
              ...(upload.madeForKids === undefined ? {} : { madeForKids: upload.madeForKids }),
            },
          }
        : {}),
      ...(requested.includes('contentDetails')
        ? {
            contentDetails: upload.duration === undefined ? {} : { duration: upload.duration },
          }
        : {}),
    }))
  return { status: 200, body: { kind: 'youtube#videoListResponse', items } }
}
