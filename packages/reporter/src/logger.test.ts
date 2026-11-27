import { describe, expect, test } from 'vitest'
import { createLogger, type LogLevel } from './logger.ts'
import { accessToken, channelId, refreshToken, views, youtubeChannelId } from './test-support.ts'

function recordingSink() {
  const lines: { level: LogLevel; line: string }[] = []
  return { lines, sink: (level: LogLevel, line: string) => lines.push({ level, line }) }
}

describe('the logger', () => {
  test('a log line holds no token and no analytics value', () => {
    const { lines, sink } = recordingSink()
    const logger = createLogger(sink)

    logger.error(
      `refresh failed for ${refreshToken}`,
      { channelId, accessToken, views },
      new Error(`Google answered 401 to Bearer ${accessToken}`),
    )

    const written = lines.map(({ line }) => line).join('\n')
    expect(written).not.toContain(refreshToken)
    expect(written).not.toContain(accessToken)
    expect(written).not.toContain(views)
  })

  test('a log line identifies a channel by its internal id only', () => {
    const { lines, sink } = recordingSink()
    const logger = createLogger(sink)

    logger.info(`synced ${youtubeChannelId}`, { channelId, youtubeChannelId })

    const [written] = lines
    expect(written?.line).not.toContain(youtubeChannelId)
    expect(JSON.parse(written?.line ?? '{}').context).toEqual({ channelId })
  })

  test('a request line keeps its route template, status, times and reads, with the numbers as numbers', () => {
    const { lines, sink } = recordingSink()
    const logger = createLogger(sink)

    logger.request({
      method: 'GET',
      route: '/api/channels/:channelId/videos',
      status: 200,
      totalMs: 41.5,
      channelId,
      reads: [{ name: 'channelUploads', cache: 'miss', googleMs: 12.25, databaseMs: 3 }],
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]?.level).toBe('info')
    expect(JSON.parse(lines[0]?.line ?? '{}')).toEqual({
      level: 'info',
      message: 'API request',
      request: {
        method: 'GET',
        route: '/api/channels/:channelId/videos',
        status: 200,
        totalMs: 41.5,
        channelId,
        reads: [{ name: 'channelUploads', cache: 'miss', googleMs: 12.25, databaseMs: 3 }],
      },
    })
  })

  test('a request line masks a YouTube id in its route and drops a channel id that is not internal', () => {
    const { lines, sink } = recordingSink()
    const logger = createLogger(sink)

    logger.request({
      method: 'GET',
      route: `/api/channels/${youtubeChannelId}`,
      status: 404,
      totalMs: 2,
      channelId: youtubeChannelId,
      reads: [],
    })

    const [written] = lines
    expect(written?.line).not.toContain(youtubeChannelId)
    expect(JSON.parse(written?.line ?? '{}').request).toEqual({
      method: 'GET',
      route: '/api/channels/[youtube id]',
      status: 404,
      totalMs: 2,
      reads: [],
    })
  })
})
