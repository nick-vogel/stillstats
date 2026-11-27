import { type Asked, channelOf, type FakeUpload } from '../channel-data.ts'

/**
 * The one video id of a `video==<id>` filter. A report the Analytics API serves one video per call
 * takes no list: audience retention "can only be retrieved for one video" (channel reports page,
 * checked 2026-10-07), and the fake holds the other detail reports to the same rule.
 */
export function oneVideoIdOf(query: URLSearchParams): string | undefined {
  return query.get('filters')?.match(/^video==([^,;]+)$/)?.[1]
}

/** The channel's upload the query's filter names, when the channel holds it. */
export function oneVideoOf(asked: Asked): FakeUpload | undefined {
  const videoId = oneVideoIdOf(asked.query)
  return channelOf(asked)?.uploads.find((upload) => upload.videoId === videoId)
}
