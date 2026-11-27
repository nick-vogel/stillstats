import {
  customRangeOfDays,
  defaultVideoWindow,
  type ErrorCode,
  type VideoFormatFilter,
  type VideoWindow,
  videoFormatFilters,
  type WindowChoice,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { isOneOf } from './one-of.ts'

/**
 * The window of a query and its custom range, as `window`, `from` and `to` carry them. A window not
 * among the route's `windows` is `invalid_window`. `from` or `to` without `window=custom`, `custom` without both, a day
 * that does not parse, and an end before the start are `invalid_range`. The range's bounds, the
 * channel's creation day and the last processed day, need the channel's reads, so the domain
 * modules check those.
 */
export function windowChoiceOf<W extends Exclude<VideoWindow, 'custom'>>(
  windows: readonly (W | 'custom')[],
  { window = defaultVideoWindow, from, to }: Partial<Record<'window' | 'from' | 'to', string>>,
):
  | { ok: true; choice: WindowChoice<W> }
  | { ok: false; error: 'invalid_window' | 'invalid_range' } {
  if (!isOneOf(windows, window)) return { ok: false, error: 'invalid_window' }
  if (window !== 'custom') {
    return from === undefined && to === undefined
      ? { ok: true, choice: { window } }
      : { ok: false, error: 'invalid_range' }
  }
  const custom = customRangeOfDays(from, to)
  if (!custom.ok) return { ok: false, error: 'invalid_range' }
  return { ok: true, choice: { window, range: custom.range } }
}

/** The query parameters a channel-wide answer, the channel summary or the Audience answer, takes. */
type ChannelQueryParameter = 'window' | 'from' | 'to' | 'format'

/**
 * The window, its custom range and the format of a channel-wide query. A window after publish is
 * refused with `window_after_publish` for itself, before any range sent with it, as a channel has no
 * publish day. Then `windowChoiceOf` over the route's `windows`, then a format not among
 * `videoFormatFilters` is `invalid_format`. Without a format, every format: `all`.
 */
export function channelQueryOf<W extends Exclude<VideoWindow, 'custom'>>(
  windows: readonly (W | 'custom')[],
  query: Partial<Record<ChannelQueryParameter, string>>,
):
  | { ok: true; query: WindowChoice<W> & { format: VideoFormatFilter } }
  | { ok: false; error: ErrorCode } {
  const { format = 'all' } = query
  if (isOneOf(windowsAfterPublish, query.window)) {
    return { ok: false, error: 'window_after_publish' }
  }
  const windowQuery = windowChoiceOf(windows, query)
  if (!windowQuery.ok) return windowQuery
  if (!isOneOf(videoFormatFilters, format)) return { ok: false, error: 'invalid_format' }
  return { ok: true, query: { ...windowQuery.choice, format } }
}

/** The code a repeat of each parameter of a channel-wide query gets, in the order its checks run. */
export const repeatedChannelQueryRefusals = {
  window: 'invalid_window',
  from: 'invalid_range',
  to: 'invalid_range',
  format: 'invalid_format',
} satisfies Record<ChannelQueryParameter, ErrorCode>
