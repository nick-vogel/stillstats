import {
  type ErrorAnswer,
  type ErrorCode,
  maxVideoIds,
  reachTrafficSourceTypes,
  type VideoListAnswer,
  type VideoListQuery,
  videoFormatFilters,
  videoSortKeys,
  videoWindows,
  visibilities,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import { isOneOf } from '../one-of.ts'
import {
  answerFailedRead,
  type ChannelReading,
  channelIdOf,
  refuse,
  type SignedIn,
} from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'
import {
  listVideos,
  maxPageSize,
  type VideoListRequest,
  type VideoListSort,
} from '../video-list.ts'
import { windowChoiceOf } from '../window-query.ts'

function wholeNumberOf(text: string | undefined, fallback: number, max = Infinity) {
  if (text === undefined) return fallback
  const value = Number(text)
  return /^\d+$/.test(text) && value >= 1 && value <= max ? value : undefined
}

function sortOf(text: string): VideoListSort | undefined {
  const key = text.replace(/^-/, '')
  if (!isOneOf(videoSortKeys, key)) return undefined
  return { key, direction: text.startsWith('-') ? 'descending' : 'ascending' }
}

/**
 * The set of ids in the `ids` parameter, or undefined when it is empty, holds a malformed id, or
 * has more than `maxVideoIds` entries, duplicates counted. Duplicates then collapse.
 */
function idSetOf(text: string): ReadonlySet<string> | undefined {
  const ids = text.split(',')
  if (ids.length > maxVideoIds || !ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id))) return undefined
  return new Set(ids)
}

function videoListRequestOf(
  query: Partial<Record<keyof VideoListQuery, string>>,
): { ok: true; request: VideoListRequest } | { ok: false; error: ErrorCode } {
  const page = wholeNumberOf(query.page, 1)
  const pageSize = wholeNumberOf(query.pageSize, maxPageSize, maxPageSize)
  const {
    includeScheduled = 'false',
    sort: sortText = '-publishedAt',
    format = 'all',
    visibility = 'public',
    withRetentionCurve = 'false',
  } = query
  if (
    !page ||
    !pageSize ||
    (includeScheduled !== 'true' && includeScheduled !== 'false') ||
    (withRetentionCurve !== 'true' && withRetentionCurve !== 'false')
  ) {
    return { ok: false, error: 'invalid_query' }
  }
  const windowQuery = windowChoiceOf(videoWindows, query)
  if (!windowQuery.ok) return windowQuery
  const { window } = windowQuery.choice
  const sort = sortOf(sortText)
  if (!sort) return { ok: false, error: 'invalid_sort' }
  // A window after publish adds each video's days, and a percentage does not add.
  if (sort.key === 'averageViewPercentage' && isOneOf(windowsAfterPublish, window)) {
    return { ok: false, error: 'sort_after_publish' }
  }
  if (!isOneOf(videoFormatFilters, format)) return { ok: false, error: 'invalid_format' }
  if (!isOneOf(visibilities, visibility)) return { ok: false, error: 'invalid_visibility' }
  const ids = query.ids === undefined ? null : idSetOf(query.ids)
  if (ids === undefined) return { ok: false, error: 'invalid_ids' }
  const { trafficSource = null } = query
  if (trafficSource !== null && !isOneOf(reachTrafficSourceTypes, trafficSource)) {
    return { ok: false, error: 'invalid_traffic_source' }
  }
  const minImpressions =
    query.minImpressions === undefined ? null : wholeNumberOf(query.minImpressions, 1)
  if (minImpressions === undefined) return { ok: false, error: 'invalid_min_impressions' }
  return {
    ok: true,
    request: {
      page,
      pageSize: ids ? Math.min(pageSize, ids.size) : pageSize,
      includeScheduled: includeScheduled === 'true',
      ...windowQuery.choice,
      sort,
      format,
      visibility,
      ids,
      trafficSource,
      minImpressions,
      withRetentionCurve: withRetentionCurve === 'true',
    },
  }
}

// The code a repeat of each parameter gets, in the order the checks above run, so a query with two
// repeats is refused for the first, as one with two bad values is.
const repeatedRefusals = {
  page: 'invalid_query',
  pageSize: 'invalid_query',
  includeScheduled: 'invalid_query',
  window: 'invalid_window',
  from: 'invalid_range',
  to: 'invalid_range',
  sort: 'invalid_sort',
  format: 'invalid_format',
  visibility: 'invalid_visibility',
  ids: 'invalid_ids',
  trafficSource: 'invalid_traffic_source',
  minImpressions: 'invalid_min_impressions',
  withRetentionCurve: 'invalid_query',
} satisfies Record<keyof VideoListQuery, ErrorCode>

/** GET /api/channels/:channelId/videos. */
export function videoListRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get('/channels/:channelId/videos', recordActivityDay(database), async (c) => {
    const single = singleQueryOf(c.req.queries(), repeatedRefusals)
    if (!single.ok) {
      return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    }
    const parsed = videoListRequestOf(single.query)
    if (!parsed.ok) return c.json({ error: parsed.error } satisfies ErrorAnswer, 400)
    const { request } = parsed
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const listed = await database.asUser(c.get('user').id, (tx) =>
      listVideos(gateway, tx, channelId, request),
    )
    if (!listed.ok) {
      // The request is well formed, and turned away for the channel's Entitlement.
      if (
        'error' in listed &&
        (listed.error === 'sort_without_history' || listed.error === 'filter_without_history')
      ) {
        return c.json({ error: listed.error } satisfies ErrorAnswer, 403)
      }
      return answerFailedRead(c, listed)
    }
    return c.json(listed.answer satisfies VideoListAnswer)
  })
}
