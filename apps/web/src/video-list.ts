import {
  currencyOf,
  type ErrorAnswer,
  historySortKeys,
  type ListedChannel,
  otherSourcesOf,
  type PageSize,
  type Preferences,
  pageSizes,
  publishDayTopSize,
  type RefusalAnswer,
  type RevenueCurrency,
  revenueSourceSortKeys,
  rpmRevenueOf,
  type VideoFormat,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoPrivacy,
  type VideoRow,
  type VideoRowNumbers,
  type VideoSort,
  type VideoSortKey,
  type VideoWindow,
  type Visibility,
  type WindowChoice,
} from '@creator-analytics/api-types'
import { rangeDaysOf } from './custom-range.ts'
import type { Figure } from './Figures.tsx'
import { ctrTextOf, historyText } from './history.ts'
import type { Option } from './ListSelect.tsx'
import type { HistorySort, ProductEvent } from './landing.ts'
import {
  type ColumnSwitches,
  listColumnsOf,
  type OptionalColumn,
  pageSizeOf,
  revenueSourcesOf,
  rpmAdsAndPremiumOnlyOf,
  visibilityOf,
} from './preferences.ts'
import { notProcessedText, partialLabelOf } from './processing.ts'
import { isRangeRefusal, type RefusedRangeView, refusalMessageOf } from './refusals.ts'
import { moneyTextOf, revenueText, rpmOf } from './revenue.ts'
import {
  canSortBy,
  isWindowAfterPublish,
  type ListControl,
  type Navigate,
  type Route,
  routeWithColumnOff,
  routeWithin,
  sortPartsOf,
} from './route.ts'
import { type HeadingSort, headingSortOf, sortAnnouncementOf } from './tables.ts'
import { watchHoursTextOf } from './watch-hours.ts'

export type VideoListView =
  | { kind: 'list'; answer: VideoListAnswer }
  | { kind: 'refused'; message: string; historySort?: true; historyFilter?: true }
  | RefusedRangeView

/**
 * What the video list shows for the API's answer: the list, or a refusal's text and no number, or
 * for a custom range refused for its bounds, the fall back to the last 28 days. A CTR or impressions
 * sort refused for a channel whose history is not readable is marked, so the list can leave it, and
 * so is a filter, so the retention comparison's picker can leave its refusal to the chart's.
 */
export function videoListViewOf(
  body: VideoListAnswer | RefusalAnswer | ErrorAnswer,
): VideoListView {
  if ('videos' in body) return { kind: 'list', answer: body }
  if (isRangeRefusal(body)) return { kind: 'invalid-range' }
  return {
    kind: 'refused',
    // Proposed in creator-analytics#943, for Nick's word for word approval on the epic's PR.
    message: refusalMessageOf(body, 'the videos', {
      sort_without_history: 'Sorting by impressions or CTR needs Stillstats Pro.',
      // Proposed in creator-analytics#944, for Nick's word for word approval on the epic's PR.
      filter_without_history: 'Filtering by traffic source or impressions needs Stillstats Pro.',
    }),
    ...('error' in body && body.error === 'sort_without_history' ? { historySort: true } : {}),
    ...('error' in body && body.error === 'filter_without_history' ? { historyFilter: true } : {}),
  }
}

/**
 * What a list read asks for: the route's page, window and its custom range, sort, format, traffic
 * source and minimum impressions, and the page size and visibility in force.
 */
export type VideoListRequest = WindowChoice &
  Pick<Route, 'page' | 'sort' | 'format' | 'trafficSource' | 'minImpressions'> & {
    pageSize: PageSize
    visibility: Visibility
    /** Lists only the videos with a stored retention curve that has points. */
    withRetentionCurve?: boolean
  }

/**
 * The query string a list read sends. It is the key of the read, so a change elsewhere in the
 * route, such as the chart's mode, keeps the rows and sends no reread.
 */
export function videoListQueryOf({
  page,
  window,
  range,
  sort,
  format,
  trafficSource,
  minImpressions,
  pageSize,
  visibility,
  withRetentionCurve,
}: VideoListRequest): string {
  return new URLSearchParams({
    page: String(page),
    window,
    ...range,
    sort,
    format,
    ...(trafficSource ? { trafficSource } : {}),
    ...(minImpressions ? { minImpressions: String(minImpressions) } : {}),
    pageSize: String(pageSize),
    visibility,
    ...(withRetentionCurve ? { withRetentionCurve: 'true' } : {}),
  }).toString()
}

// How many rows each list read answered, by its channel and query, for as long as the page lives:
// the list keeps only its last read, and Back from a video remounts it with none.
const answeredRows = new Map<string, number>()

/** The memo's key of the read `query` of `channelId`. */
function answeredRowsKeyOf(channelId: string, query: string): string {
  return JSON.stringify([channelId, query])
}

/** Remembers that the read `query` of `channelId` answered `rows` rows, replacing an earlier count. */
export function rememberListRowsOf(channelId: string, query: string, rows: number): void {
  answeredRows.set(answeredRowsKeyOf(channelId, query), rows)
}

/** How many rows the read `query` of `channelId` last answered on this page load, if it has. */
function answeredRowsOf(channelId: string, query: string): number | undefined {
  return answeredRows.get(answeredRowsKeyOf(channelId, query))
}

/**
 * How many rows the list expects for its read of the address `route` on `channel`: as many as the
 * same read last answered on this page load, else the page size, as with no channel yet. The read is
 * the one the list sends (`listReadOf`), so a sort the list rewrites finds the answer it remembered.
 */
export function listRowsExpectedFor(
  channel: ListedChannel | null,
  route: Route,
  saved: Preferences,
): number {
  const { query, pageSize } = listReadOf(route, channel, saved)
  if (channel === null) return pageSize
  return answeredRowsOf(channel.id, query) ?? pageSize
}

// How many publish day top bars each list read answered, for as long as the page lives, keyed on
// the read without its page, sort and page size: the top ranks every upload of the list's format
// and visibility. Only a read of a window after publish carries the top.
const answeredPublishDayTopRows = new Map<string, number>()

/**
 * Remembers that the read `query` of `channelId` answered a publish day top of `rows` videos,
 * replacing an earlier count.
 */
export function rememberPublishDayTopRowsOf(channelId: string, query: string, rows: number): void {
  answeredPublishDayTopRows.set(publishDayTopKeyOf(channelId, query), rows)
}

function publishDayTopKeyOf(channelId: string, query: string): string {
  const top = new URLSearchParams(query)
  for (const key of ['page', 'sort', 'pageSize']) top.delete(key)
  return answeredRowsKeyOf(channelId, top.toString())
}

/**
 * How many bars the publish day top expects for the list's read of the address `route` on
 * `channel`: as many as a read with the same top last answered on this page load, else the most the
 * top holds (`publishDayTopSize`), as with no channel yet (creator-analytics#510). The read is the
 * one the list sends (`listReadOf`), as for the list's own rows.
 */
export function publishDayTopRowsExpectedFor(
  channel: ListedChannel | null,
  route: Route,
  saved: Preferences,
): number {
  if (channel === null) return publishDayTopSize
  const { query } = listReadOf(route, channel, saved)
  return answeredPublishDayTopRows.get(publishDayTopKeyOf(channel.id, query)) ?? publishDayTopSize
}

/** What a landed read shows: never a refused custom range, which falls back instead. */
export type LandedListView = Exclude<VideoListView, RefusedRangeView>

/**
 * A landed list read: the channel it answers, the key of the read and of the list it is a page of,
 * and what it showed.
 */
export interface VideoListRead {
  channelId: string
  key: string
  listKey: string
  view: LandedListView
}

export type VideoListState =
  | LandedListView
  | {
      kind: 'loading'
      /**
       * The placeholder rows: as many as the last answer had, so the page keeps its height, else as
       * many as the same read last answered on this page load, else the page size.
       */
      rows: number
      /** The last answer, whose notes and pager stay while the next page loads. */
      last: VideoListAnswer | null
    }

/**
 * What the list shows for the read that landed last, while the screen asks for the list read of
 * `channelId`, or of no channel yet, with its key, its query and its page size. With no answer of
 * this channel to keep, the placeholder holds as many rows as the same read last answered on this
 * page load, as after Back from a video, which remounts the list with no last read
 * (creator-analytics#344), else the page size.
 */
export function videoListStateOf(
  read: VideoListRead | null,
  channelId: string | null,
  { key, query, pageSize }: Pick<ListRead, 'key' | 'query' | 'pageSize'>,
): VideoListState {
  // A read of another channel holds no place for this one.
  const ours = read?.channelId === channelId ? read : null
  if (ours?.key === key) return ours.view
  // A list with no videos holds no row: the empty text's line holds its place instead.
  if (ours?.view.kind === 'list')
    return { kind: 'loading', rows: ours.view.answer.videos.length, last: ours.view.answer }
  const answered = channelId === null ? undefined : answeredRowsOf(channelId, query)
  return { kind: 'loading', rows: answered ?? pageSize, last: null }
}

/** What the list region shows, read once from its state. */
export interface VideoListShown {
  /** Whether the region waits on a read: it is busy, and the loading text is said. */
  busy: boolean
  /** The answer the notes and the pager come from: the landed one, or the last one meanwhile. */
  answer: VideoListAnswer | null
  body:
    | { kind: 'refused'; message: string }
    | { kind: 'empty'; text: string }
    | { kind: 'placeholder-empty' }
    | { kind: 'placeholder-rows'; rows: number }
    | { kind: 'videos'; answer: VideoListAnswer }
}

/**
 * What the list region shows for its state, with the route's format, its minimum impressions and
 * the visibility in force for an empty list's text. The minimum hides nothing of a list without the
 * history, so only a list with it says no video reaches the minimum.
 */
export function videoListShownOf(
  state: VideoListState,
  {
    format,
    visibility,
    minImpressions,
  }: {
    format: VideoFormatFilter
    visibility: Visibility
    minImpressions?: number | undefined
  },
): VideoListShown {
  switch (state.kind) {
    case 'refused':
      return { busy: false, answer: null, body: state }
    case 'loading':
      return {
        busy: true,
        answer: state.last,
        body:
          state.rows === 0
            ? { kind: 'placeholder-empty' }
            : { kind: 'placeholder-rows', rows: state.rows },
      }
    case 'list':
      return {
        busy: false,
        answer: state.answer,
        body:
          state.answer.pageCount === 0
            ? {
                kind: 'empty',
                text: emptyListTextOf(
                  format,
                  visibility,
                  state.answer.history ? minImpressions : undefined,
                ),
              }
            : { kind: 'videos', answer: state.answer },
      }
  }
}

/**
 * What the list gives the summary's place in a window after publish, where the launch chart and the
 * publish day top draw from its answer: `reading` while a page is read (but for another page under
 * "Publish day", which keeps the last answer), the answer once one with videos lands, with the
 * channel it is of, and `none` for a refused list or one with no videos, which the list says itself.
 */
export type SummaryPlaceList =
  | { kind: 'reading' }
  | { kind: 'list'; channelId: string; answer: VideoListAnswer }
  | { kind: 'none' }

/**
 * Whether the screen, asking for the read `key` of `channelId`, asks for another page of the list
 * the landed `read` shows.
 */
export function readsAnotherPageOf(
  read: VideoListRead | null,
  channelId: string | null,
  { key, listKey }: Pick<ListRead, 'key' | 'listKey'>,
): boolean {
  return (
    read?.channelId === channelId &&
    read.view.kind === 'list' &&
    read.key !== key &&
    read.listKey === listKey
  )
}

/**
 * What the list region shows for the channel `channelId`, as the summary's place in a window after
 * publish draws it. With no channel yet, the list has no answer to give. While another page of the
 * list is read (`anotherPage`), under "Publish day" it keeps the last answer: its publish day top
 * ranks the whole list, not the page, so it stays right and the place keeps its height.
 */
export function summaryPlaceListOf(
  { body, answer }: VideoListShown,
  channelId: string | null,
  anotherPage: boolean,
): SummaryPlaceList {
  switch (body.kind) {
    case 'placeholder-rows':
      return anotherPage && channelId !== null && answer?.window === 'first1'
        ? { kind: 'list', channelId, answer }
        : { kind: 'reading' }
    case 'placeholder-empty':
      return { kind: 'reading' }
    case 'videos':
      return channelId === null
        ? { kind: 'reading' }
        : { kind: 'list', channelId, answer: body.answer }
    default:
      return { kind: 'none' }
  }
}

/**
 * A video marked on the list the summary's place draws, its row hovered or its launch chart line
 * selected, with the list it was marked on and which of the two made it (`by`): the chart shows
 * its own selection only while the mark is the chart's, so a row hover replaces that selection.
 */
export interface ListMark {
  videoId: string
  list: SummaryPlaceList
  by: 'row' | 'chart'
}

/**
 * The video a mark marks while `list` shows: only on the list it was marked on. Only a pointer
 * leaving the row ends a row's mark, and a row that unmounts never fires that, as on a row click
 * that opens the video and Back, or a channel or window switch. So any other list ends it.
 */
export function markedVideoOf(mark: ListMark | null, list: SummaryPlaceList): string | null {
  return mark !== null && mark.list === list ? mark.videoId : null
}

/**
 * A list row's classes: marked when its video's line is selected on the launch chart, so the list,
 * the chart's legend, names the line.
 */
export function listRowClassOf(videoId: string, markedVideoId: string | null): string {
  return videoId === markedVideoId ? 'video-list-row video-list-row-marked' : 'video-list-row'
}

/** The Format column's word for each format, which an upload marker's text alternative opens with. */
export const formatLabels: Record<VideoFormat, string> = {
  video: 'Video',
  short: 'Short',
  live: 'Live',
}

// The no-data text is approved word for word in creator-analytics#84. Change it only with Nick.
/** The label for a missing value, which the launch chart's day card shares. */
export const noDataLabel = 'No data'

function hasNoFormat(format: VideoFormat | null): format is null {
  return format === null
}

/**
 * A video with no format, such as a new upload Analytics has no rows for yet, shows the no-format
 * label.
 */
export function formatLabelOf(format: VideoFormat | null): string {
  return hasNoFormat(format) ? noDataLabel : formatLabels[format]
}

export interface Column<Row = VideoRow> {
  label: string
  textOf: (row: Row, locale?: string) => string
  /** The key the column's heading sorts the list by. A column without one does not sort. */
  sortKey?: VideoSortKey
  /** The switch that shows and hides the column. A column without one always shows. */
  optional?: OptionalColumn
  /** A part of the revenue: it shows only with its switch on and the revenue sources shown. */
  source?: true
  /** From a paid channel's history: it shows only when the list carries the history. */
  history?: true
  /** The row's "N of M days" label for the cell, when its numbers cover only some of its days. */
  partialOf?: (row: Row) => string | null
}

/**
 * What else decides which columns the list shows, beside its switches: the window, as a window after
 * publish has no average viewed, and whether the revenue sources are shown.
 */
export interface ColumnConditions {
  window?: VideoWindow
  sources?: boolean
  /** Whether the list carries a paid channel's history, which the history columns show. */
  history?: boolean
}

interface DetailColumn extends Column {
  /** Whether the row has no value for the column, so its cell shows muted text. */
  hasNoData?: (row: VideoRow) => boolean
}

function percentOf(value: number | undefined, locale?: string): string {
  return value === undefined
    ? ''
    : (value / 100).toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
}

/** The columns between the video and its metrics. */
export const detailColumns: DetailColumn[] = [
  {
    label: 'Format',
    textOf: ({ format }) => formatLabelOf(format),
    hasNoData: ({ format }) => hasNoFormat(format),
  },
  {
    label: 'Published',
    sortKey: 'publishedAt',
    textOf: ({ publishedAt }, locale) =>
      publishedAt ? new Date(publishedAt).toLocaleDateString(locale, { dateStyle: 'medium' }) : '',
  },
]

export const averageViewedColumn: Column<VideoRowNumbers> = {
  label: 'Average viewed',
  sortKey: 'averageViewPercentage',
  textOf: ({ averageViewPercentage }, locale) => percentOf(averageViewPercentage, locale),
}

export const subscribersGainedColumn: Column<VideoRowNumbers> = {
  label: 'Subscribers gained',
  sortKey: 'subscribersGained',
  textOf: ({ subscribersGained }, locale) => subscribersGained.toLocaleString(locale),
}

/** A row's numbers, as the metric columns read them. */
type MetricRow = VideoRowNumbers &
  Pick<
    VideoRow,
    | 'estimatedRevenue'
    | 'estimatedAdRevenue'
    | 'estimatedRedPartnerRevenue'
    | 'impressions'
    | 'ctr'
    | 'historyPartial'
  >

/** The history's "N of M days" for a row whose days start before the history start. */
function historyPartialLabelOf({ historyPartial }: MetricRow): string | null {
  return historyPartial ? partialLabelOf({ partial: historyPartial }) : null
}

/** The revenue a row carries less its ad and YouTube Premium parts, when it carries revenue. */
function otherSourcesOfRow({
  estimatedRevenue,
  estimatedAdRevenue = 0,
  estimatedRedPartnerRevenue = 0,
}: MetricRow): number | undefined {
  if (estimatedRevenue === undefined) return undefined
  return otherSourcesOf({ estimatedRevenue, estimatedAdRevenue, estimatedRedPartnerRevenue })
}

/**
 * A row's RPM, when it carries revenue and has engaged views: the revenue `rpmRevenueOf` counts per
 * 1,000 engaged views, ads and YouTube Premium only with the RPM switch on.
 */
function rpmOfRow(
  {
    estimatedRevenue,
    estimatedAdRevenue = 0,
    estimatedRedPartnerRevenue = 0,
    engagedViews,
  }: MetricRow,
  adsAndPremiumOnly: boolean,
): number | undefined {
  if (estimatedRevenue === undefined) return undefined
  const amounts = { estimatedRevenue, estimatedAdRevenue, estimatedRedPartnerRevenue }
  return rpmOf(rpmRevenueOf(amounts, adsAndPremiumOnly), engagedViews) ?? undefined
}

/**
 * The metrics, the optional ones included, in the order the list shows them, the revenue cells in
 * the list's currency and empty without one. RPM shows with the Revenue switch, after the sources
 * when they show, and counts only ads and YouTube Premium with the RPM switch on
 * (`adsAndPremiumOnly`).
 */
function metricColumnsOf(
  currency: RevenueCurrency | undefined,
  adsAndPremiumOnly = false,
): Column<MetricRow>[] {
  // Empty for a row that carries no revenue, as the list's revenue did not answer, and for every
  // row when the list has no currency, as YouTube reports no revenue for the channel
  // (`listRevenueCurrencyOf`).
  const moneyTextOfRow =
    (amountOf: (row: MetricRow) => number | undefined) => (row: MetricRow, locale?: string) => {
      const amount = amountOf(row)
      return amount === undefined || currency === undefined
        ? ''
        : moneyTextOf(amount, currency, locale)
    }
  return [
    {
      label: 'Engaged views',
      sortKey: 'engagedViews',
      textOf: ({ engagedViews }, locale) => engagedViews.toLocaleString(locale),
    },
    {
      label: historyText.impressions,
      sortKey: 'impressions',
      history: true,
      textOf: ({ impressions }, locale) => impressions?.toLocaleString(locale) ?? '',
      partialOf: historyPartialLabelOf,
    },
    {
      label: historyText.ctrColumn,
      sortKey: 'ctr',
      history: true,
      textOf: ({ ctr }, locale) => ctrTextOf(ctr ?? null, locale),
      partialOf: historyPartialLabelOf,
    },
    {
      label: 'Views',
      sortKey: 'views',
      optional: 'views',
      textOf: ({ views }, locale) => views.toLocaleString(locale),
    },
    {
      label: 'Watch hours',
      sortKey: 'estimatedMinutesWatched',
      optional: 'watchTime',
      textOf: ({ estimatedMinutesWatched }, locale) =>
        watchHoursTextOf(estimatedMinutesWatched, locale),
    },
    {
      // Approved word for word in creator-analytics#80. Change it only with Nick.
      label: 'Revenue',
      sortKey: 'estimatedRevenue',
      optional: 'revenue',
      textOf: moneyTextOfRow(({ estimatedRevenue }) => estimatedRevenue),
    },
    // The source labels are the numbers table's, approved word for word in creator-analytics#78.
    {
      label: 'Ads',
      sortKey: 'estimatedAdRevenue',
      optional: 'revenue',
      source: true,
      textOf: moneyTextOfRow(({ estimatedRevenue, estimatedAdRevenue }) =>
        estimatedRevenue === undefined ? undefined : (estimatedAdRevenue ?? 0),
      ),
    },
    {
      label: 'YouTube Premium',
      sortKey: 'estimatedRedPartnerRevenue',
      optional: 'revenue',
      source: true,
      textOf: moneyTextOfRow(({ estimatedRevenue, estimatedRedPartnerRevenue }) =>
        estimatedRevenue === undefined ? undefined : (estimatedRedPartnerRevenue ?? 0),
      ),
    },
    {
      label: 'Other sources',
      sortKey: 'otherSources',
      optional: 'revenue',
      source: true,
      textOf: moneyTextOfRow(otherSourcesOfRow),
    },
    {
      // The glossary's term, as the revenue card's line names it.
      label: 'RPM',
      sortKey: 'rpm',
      optional: 'revenue',
      // Empty for zero engaged views, which earn no rate.
      textOf: moneyTextOfRow((row) => rpmOfRow(row, adsAndPremiumOnly)),
    },
    averageViewedColumn,
    subscribersGainedColumn,
  ]
}

/** Every column after the video, in the order the list shows them, optional ones included. */
export const columns: Column[] = [...detailColumns, ...metricColumnsOf(undefined)]

export interface ShownColumn<Row = VideoRow> {
  column: Column<Row>
  /** Shown on a narrow screen only: views with its switch off. */
  narrowOnly: boolean
}

/**
 * Each column the list shows for its switches and its column context, in order. A column switched
 * off is left out, except views, which a narrow screen shows whatever its switch; so are the source
 * columns while the sources are hidden, and average viewed in a window after publish.
 */
function shownOf<Row>(
  all: Column<Row>[],
  switches: ColumnSwitches,
  { window, sources = false, history = false }: ColumnConditions,
): ShownColumn<Row>[] {
  return all.flatMap((column): ShownColumn<Row>[] => {
    if (column.source && !sources) return []
    if (column.history && !history) return []
    if (column.sortKey && window && !canSortBy(window, column.sortKey)) return []
    if (!column.optional || switches[column.optional]) return [{ column, narrowOnly: false }]
    return column.optional === 'views' ? [{ column, narrowOnly: true }] : []
  })
}

/** The columns after the video the list shows for its switches, with the headings' order. */
export function listColumnsShownOf(
  switches: ColumnSwitches,
  columnConditions: ColumnConditions = {},
): ShownColumn[] {
  return shownOf(columns, switches, columnConditions)
}

/**
 * The keys the headings of an optional column's switch sort the list by, leaving out the sources,
 * which `routeWithSourcesOff` covers: Revenue and RPM for the Revenue switch.
 */
export function sortKeysOfColumn(column: OptionalColumn): VideoSortKey[] {
  return columns.flatMap(({ optional, source, sortKey }) =>
    optional === column && !source && sortKey ? [sortKey] : [],
  )
}

const sortableColumns = columns.filter(
  (column): column is Column & { sortKey: VideoSortKey } => column.sortKey !== undefined,
)

// The sort text is approved by Nick on 2026-10-07. Change it only with Nick.
/**
 * A sort named by its column's heading and direction, which a screen reader announces when a heading
 * sorts the list. Null for a sort the window cannot sort by.
 */
export function sortLabelOf(window: VideoWindow, sort: VideoSort): string | null {
  const { key, descending } = sortPartsOf(sort)
  const column = sortableColumns.find(({ sortKey }) => sortKey === key)
  if (!column || !canSortBy(window, column.sortKey)) return null
  return sortAnnouncementOf(column.label, descending, column.sortKey === 'publishedAt')
}

// The page size and visibility text is approved word for word in creator-analytics#75. Change it
// only with Nick.
export const pageSizeLabel = 'Videos per page'
export const pageSizeOptions: Option<`${PageSize}`>[] = pageSizes.map((size) => ({
  value: `${size}`,
  label: `${size}`,
}))
export const visibilitySwitchLabel = 'Show unlisted and private'

// Proposed in creator-analytics#944, for Nick's word for word approval on the epic's PR.
export const minImpressionsLabel = 'Minimum impressions'

/**
 * The control the minimum impressions field commits: a whole number from 1 sets the minimum, an
 * empty field clears it, and any other text commits nothing.
 */
export function minImpressionsChangeOf(
  text: string,
): { minImpressions: number | undefined } | null {
  const trimmed = text.trim()
  if (trimmed === '') return { minImpressions: undefined }
  return /^[1-9]\d*$/.test(trimmed) ? { minImpressions: Number(trimmed) } : null
}

// Approved word for word in creator-analytics#339. Change it only with Nick.
/**
 * The list's name for a screen reader, on its section whether it has rows or not, and the lead
 * word of its table's caption: one source, so the two cannot drift.
 */
export const listLabel = 'Videos'

// Approved word for word in creator-analytics#239. Change it only with Nick.
/** The caption of the list's table, which only a screen reader reads: the page among the pages. */
export function listCaptionOf(page: number, pageCount: number): string {
  return `${listLabel}, page ${page} of ${pageCount}`
}

// The column switches' text is approved word for word in creator-analytics#77. Change it only with
// Nick.
export const columnsGroupLabel = 'Columns'
export const columnSwitchLabels: Record<OptionalColumn, string> = {
  views: 'Views',
  watchTime: 'Watch hours',
  // Approved word for word in creator-analytics#80. Change it only with Nick.
  revenue: 'Revenue',
}

/** The column switches the list offers: revenue only on a channel with revenue consent. */
export function optionalColumnsOf(revenueConsented: boolean): OptionalColumn[] {
  return revenueConsented ? ['views', 'watchTime', 'revenue'] : ['views', 'watchTime']
}

/** The route after the source columns are hidden: a source sort runs newest first, page 1. */
export function routeWithSourcesOff(route: Route): Route {
  return revenueSourceSortKeys.reduce(routeWithColumnOff, route)
}

export function routeWithHistorySortOff(route: Route): Route {
  return historySortKeys.reduce(routeWithColumnOff, route)
}

/**
 * Hides the sources from the list's own button: a source sort runs newest first, in place of the
 * address on view, since `listRouteFor` would rewrite that address once the sources are hidden and
 * Back would land on it for nothing.
 */
export function hideSourcesOn(route: Route, navigate: Navigate): void {
  const next = routeWithSourcesOff(route)
  if (next !== route) navigate(next, { replace: true })
}

/**
 * The route the list reads: a sort by watch hours, revenue or RPM while its column is switched off
 * runs newest first from the first page, as when the creator switches it off; so does a sort by a
 * source while the source columns are hidden. The Revenue column, and RPM with it, is off on a
 * channel without revenue consent, whose revenue sorts the API refuses. A views sort stays, as a
 * narrow screen shows the views column whatever its switch. Otherwise the route itself.
 */
export function listRouteFor(route: Route, switches: ColumnSwitches, sourcesShown: boolean): Route {
  const sorted = (['watchTime', 'revenue'] as const).reduce(
    (each, column) =>
      switches[column] ? each : sortKeysOfColumn(column).reduce(routeWithColumnOff, each),
    route,
  )
  return switches.revenue && sourcesShown ? sorted : routeWithSourcesOff(sorted)
}

/**
 * The list read for an address: the route the list reads, its column switches and whether its
 * source columns show, the page size and visibility in force, the query it sends, and the key of
 * the read, which the saved currency and the saved RPM switch join as the API reads them from the
 * preferences: the currency for the revenue, the switch for the RPM sort.
 */
export interface ListRead {
  route: Route
  switches: ColumnSwitches
  sources: boolean
  pageSize: PageSize
  visibility: Visibility
  query: string
  key: string
  /** The key every page of the list shares: the read's, but for its page. */
  listKey: string
}

/**
 * The read the video list sends for the address on `channel` with the saved preferences, which the
 * detail screen sends too for the list it was opened from, so the API answers both from the same
 * cached read. With no channel yet, whose revenue consent is not known, the address is read as it is.
 */
export function listReadOf(
  addressRoute: Route,
  channel: ListedChannel | null,
  saved: Preferences,
): ListRead {
  const switches = listColumnsOf(saved, channel !== null && channel.revenueConsentedAt !== null)
  const sources = switches.revenue && revenueSourcesOf(saved)
  const route = channel === null ? addressRoute : listRouteFor(addressRoute, switches, sources)
  const pageSize = pageSizeOf(route, saved)
  const visibility = visibilityOf(route, saved)
  const query = videoListQueryOf({ ...route, pageSize, visibility })
  const pages = new URLSearchParams(query)
  pages.delete('page')
  return {
    route,
    switches,
    sources,
    pageSize,
    visibility,
    query,
    key: JSON.stringify([query, currencyOf(saved), rpmAdsAndPremiumOnlyOf(saved)]),
    listKey: JSON.stringify([pages.toString(), currencyOf(saved), rpmAdsAndPremiumOnlyOf(saved)]),
  }
}

/**
 * The route a failed save of `lost` leaves the list on: the route the list reads once the column
 * switches the save turned on go back off (`listRouteFor`), so the address the save's revert leaves
 * on view is the one the list settles on, and the failed save's notice, which shows on that
 * address, stays. A video, Settings, the Audience screen, "What's new" or the upgrade screen stays,
 * as no list is on view to rewrite its address.
 */
export function routeAfterLostSwitches(route: Route, lost: Preferences): Route {
  if (route.video || route.settings || route.audience || route.whatsNew || route.upgrade) {
    return route
  }
  return listRouteFor(
    route,
    { views: true, watchTime: lost.watchTimeColumn !== true, revenue: lost.revenueColumn !== true },
    lost.revenueSources !== true,
  )
}

/**
 * Whether YouTube reports no revenue for the list's channel: it is outside the YouTube Partner
 * Program (`not_monetized`), or Google answered no upload a revenue row over the window, which it
 * does for such a channel as often as it refuses (#119, W21).
 */
function reportsNoRevenue({ revenue }: VideoListAnswer): boolean {
  return 'currency' in revenue ? !revenue.reported : revenue.refusal === 'not_monetized'
}

/**
 * The route once a page's answer lands, which the list reads again in place of the address when it
 * differs: on a channel YouTube reports no revenue for, a source sort runs newest first from the
 * first page, as the source columns do not show (`sourceColumnsShownOf`) and the list could not say
 * its order; on an answer without the history, a CTR or impressions sort runs newest first from
 * the first page, as those columns do not show either; else a page past the last moves to the last.
 */
export function routeAfterListAnswerOf(route: Route, answer: VideoListAnswer): Route {
  const sourced = reportsNoRevenue(answer) ? routeWithSourcesOff(route) : route
  const sorted = answer.history ? sourced : routeWithHistorySortOff(sourced)
  return sorted === route ? routeWithin(route, answer.pageCount) : sorted
}

/**
 * The note above a list whose Revenue column shows when YouTube reports no revenue for the
 * channel: that it is outside the YouTube Partner Program, or that no revenue is reported for the
 * date range. Else null.
 */
export function revenueNoteOf(answer: VideoListAnswer, switches: ColumnSwitches): string | null {
  if (!switches.revenue) return null
  if (answer.revenue.refusal === 'not_monetized') return revenueText.notMonetized
  return reportsNoRevenue(answer) ? revenueText.noRevenue : null
}

/**
 * The currency of the list's Revenue cells: the answer's while it shows revenue, and none, so the
 * cells are empty rather than $0.00, when YouTube reports no revenue for the channel.
 */
export function listRevenueCurrencyOf({ revenue }: VideoListAnswer): RevenueCurrency | undefined {
  return 'currency' in revenue && revenue.reported ? revenue.currency : undefined
}

// Whether each channel's last list answer on this page load carried the history, keyed on the
// channel: whether its history is readable does not depend on the read.
const answeredHistory = new Map<string, boolean>()

/** Remembers whether a list answer of `channelId` carried the history, replacing an earlier one. */
export function rememberListHistoryOf(channelId: string, answer: VideoListAnswer): void {
  answeredHistory.set(channelId, answer.history !== undefined)
}

/**
 * Whether the list shows its traffic source select and minimum impressions field, which only a
 * channel whose history is readable can use: where the answer on show carries the history. With no
 * answer of `channelId` on show, on its first read, after Back from a video, which remounts the
 * list, or after a refused read, they show as its last answer on this page load said, else for a
 * `paid` channel, so the controls row holds still while the read lands and a refused filter can be
 * undone. With a traffic source or a minimum in the address they show for any channel, so a channel
 * the API refuses them for (a switch from a Pro channel to a free one, a bookmark) can clear them.
 */
export function historyFiltersShownOf(
  answer: VideoListAnswer | null,
  channelId: string | null,
  paid: boolean,
  { trafficSource, minImpressions }: Pick<Route, 'trafficSource' | 'minImpressions'>,
): boolean {
  if (channelId === null) return false
  if (trafficSource !== undefined || minImpressions !== undefined) return true
  if (answer) return answer.history !== undefined
  return answeredHistory.get(channelId) ?? paid
}

/**
 * Whether the list shows its "Show revenue sources" button: with its Revenue column on, while its
 * page is read too, but not once its answer says YouTube reports no revenue for the channel.
 */
export function sourcesButtonShownOf(
  answer: VideoListAnswer | null,
  switches: ColumnSwitches,
): boolean {
  return switches.revenue && !(answer && reportsNoRevenue(answer))
}

/**
 * Whether the list shows its three revenue source columns: where it shows the sources' button and
 * the saved choice shows the sources. The choice is the user's across channels, so a channel
 * YouTube reports no revenue for shows none and leaves the choice as it is.
 */
export function sourceColumnsShownOf(
  answer: VideoListAnswer | null,
  switches: ColumnSwitches,
  sourcesSaved: boolean,
): boolean {
  return sourcesSaved && sourcesButtonShownOf(answer, switches)
}

/**
 * The note on the currency under a list whose Revenue column shows revenue in a window after
 * publish, which has no channel summary to carry it. Else null.
 */
export function listCurrencyNoteOf(
  answer: VideoListAnswer,
  switches: ColumnSwitches,
): string | null {
  return isWindowAfterPublish(answer.window) && switches.revenue && listRevenueCurrencyOf(answer)
    ? revenueText.currencyNote
    : null
}

/** The event a column switch sends: the column and its new state, and nothing else. */
export function columnToggledEvent(column: OptionalColumn, on: boolean): ProductEvent {
  return { name: 'list_column_toggled', column, state: on ? 'on' : 'off' }
}

const privacyMarkers: Record<Exclude<VideoPrivacy, 'public'>, string> = {
  unlisted: 'Unlisted',
  private: 'Private',
}

/** The marker an unlisted or a private row shows under its title. A public row has none. */
export function privacyMarkerOf(privacy: VideoPrivacy): string | null {
  return privacy === 'public' ? null : privacyMarkers[privacy]
}

/**
 * The event a control change sends: the control's new value, and nothing else. A custom range
 * sends its length in days in place of its days, so no date leaves the browser. A traffic source
 * and a minimum of impressions send none of their own (`repackagingViewTracker` covers the source).
 */
export function controlChangedEvent(control: ListControl): ProductEvent | null {
  if ('trafficSource' in control || 'minImpressions' in control) return null
  if ('window' in control) {
    return control.window === 'custom'
      ? { name: 'video_window_changed', window: 'custom', days: rangeDaysOf(control.range) }
      : { name: 'video_window_changed', window: control.window }
  }
  if ('sort' in control) return { name: 'video_sort_changed', sort: control.sort }
  if ('pageSize' in control) return { name: 'page_size_changed', size: control.pageSize }
  if ('visibility' in control) {
    return { name: 'visibility_changed', visibility: control.visibility }
  }
  return { name: 'video_format_changed', format: control.format }
}

/**
 * A session's tracker of the repackaging view: it answers `repackaging_view_opened` for the first
 * impressions or CTR sort control, or the first control that sets a traffic source, it sees, and
 * null for every later control and for any other: All sources and a minimum send none. The
 * headings sort by those, and the source shows, only when the list carries the history, so the
 * step is a Pro creator's.
 */
export function repackagingViewTracker(): (control: ListControl) => ProductEvent | null {
  let opened = false
  return (control) => {
    if (opened) return null
    if ('sort' in control && isHistorySort(control.sort)) {
      opened = true
      return { name: 'repackaging_view_opened', sort: control.sort }
    }
    if ('trafficSource' in control && control.trafficSource !== undefined) {
      opened = true
      return { name: 'repackaging_view_opened', source: control.trafficSource }
    }
    return null
  }
}

/** Whether the sort is by impressions or CTR, in either direction. */
function isHistorySort(sort: VideoSort): sort is HistorySort {
  const historyKeys: readonly string[] = historySortKeys
  return historyKeys.includes(sortPartsOf(sort).key)
}

export interface RowClick {
  /** The mouse button, as `MouseEvent.button` gives it: 0 is the primary one. */
  button: number
  /** Whether Ctrl, Meta, Shift or Alt was held. */
  modifierKey: boolean
  /** Whether the click landed on the title link, which opens the video on its own. */
  insideLink: boolean
  /** The text selected when the click ended. */
  selectedText: string
}

/**
 * Whether a click on a row opens its video: a plain primary click outside the title link. A click
 * that ends a text selection does not, so the row's text stays selectable, and neither does a
 * modified click, which would open a tab on a link but has no tab to open on a row.
 */
export function rowClickOpensVideo({
  button,
  modifierKey,
  insideLink,
  selectedText,
}: RowClick): boolean {
  return button === 0 && !modifierKey && !insideLink && selectedText === ''
}

export interface RowClickOpener {
  /** Takes a click on a row, and the way to open its video. */
  click(click: RowClick, open: () => void): void
  /**
   * Drops a click still waiting, for a list that leaves the screen with no change of the address,
   * as on sign-out. A change of the address drops it on its own.
   */
  cancel(): void
}

// The browser gives a page no way to read the system's double-click time, so the wait covers a
// quick double click; a slower one still opens the video on its first click.
const secondClickWait = 300

// The address is read this often in the wait, so a change undone before the wait ends still drops
// the click. A change and its undo inside 50 ms are beyond a person's clicks.
const addressCheckEvery = 50

/**
 * Opens a row's video on a plain click once the wait for a second click has passed, so a double or
 * triple click selects the row's text instead: the browser selects on the second press, after the
 * first click has already ended with nothing selected. A later click replaces a waiting one, and a
 * change of the address on view in the wait, the chart mode's included, drops it, even when the
 * address changes back before the wait ends, once the change has lasted to one of the checks every
 * `addressCheckEvery` ms; a change and its undo between two checks go unseen.
 */
export function rowClickOpener(
  selectedText: () => string,
  addressOnView: () => string,
): RowClickOpener {
  let waiting: ReturnType<typeof setInterval> | undefined
  function cancel() {
    clearInterval(waiting)
    waiting = undefined
  }
  return {
    click(click, open) {
      cancel()
      if (!rowClickOpensVideo(click)) return
      const clickedOn = addressOnView()
      let waited = 0
      waiting = setInterval(() => {
        if (addressOnView() !== clickedOn) return cancel()
        waited += addressCheckEvery
        if (waited < secondClickWait) return
        cancel()
        if (selectedText() === '') open()
      }, addressCheckEvery)
    },
    cancel,
  }
}

/**
 * The video list's one opener, for every row of every page, so a click on a second row in the wait
 * replaces the first. It reads the page's selection and the address bar, whose path and query name
 * the route on view.
 */
export const listRowClicks = rowClickOpener(
  () => window.getSelection()?.toString() ?? '',
  () => `${window.location.pathname}${window.location.search}`,
)

/** How a column heading sorts the list, or null for a column the window cannot sort by. */
export function listHeadingSortOf(
  { sortKey }: Column,
  window: VideoWindow,
  sort: VideoSort,
): HeadingSort<VideoSort> | null {
  if (!sortKey || !canSortBy(window, sortKey)) return null
  const { key, descending } = sortPartsOf(sort)
  const { direction, next } = headingSortOf<string>(sortKey, {
    column: key,
    direction: descending ? 'descending' : 'ascending',
  })
  return { direction, next: next.direction === 'descending' ? `-${sortKey}` : sortKey }
}

export interface MetricCell extends Figure {
  /** Shown on a narrow screen only, as its heading is. */
  narrowOnly: boolean
  /** The cell's "N of M days" label, when its numbers cover only some of the row's days. */
  partial?: string
}

export type MetricCells =
  | { kind: 'numbers'; cells: MetricCell[] }
  | {
      kind: 'not-processed'
      text: string
      /** The metric columns a wide screen shows, which the text spans. */
      colSpan: number
      /**
       * Whether the row also has an empty cell under views shown on a narrow screen only, so the
       * row has as many cells as the headings at either width.
       */
      narrowOnlyCell: boolean
    }

/**
 * What a row shows under the metric headings its switches and its column context show: its
 * numbers, its revenue and its sources in the list's currency, or, for a video awaiting processing,
 * the not-processed text instead of its zeros. Its RPM follows the RPM switch
 * (`adsAndPremiumOnly`), off by default.
 */
export function metricCellsOf(
  video: VideoRow,
  switches: ColumnSwitches,
  {
    locale,
    currency,
    adsAndPremiumOnly = false,
    ...columnConditions
  }: {
    locale?: string
    currency?: RevenueCurrency | undefined
    adsAndPremiumOnly?: boolean
  } & ColumnConditions = {},
): MetricCells {
  const shown = shownOf(metricColumnsOf(currency, adsAndPremiumOnly), switches, columnConditions)
  if (video.awaitingProcessing) {
    return {
      kind: 'not-processed',
      text: notProcessedText,
      colSpan: shown.filter(({ narrowOnly }) => !narrowOnly).length,
      narrowOnlyCell: shown.some(({ narrowOnly }) => narrowOnly),
    }
  }
  return {
    kind: 'numbers',
    cells: shown.map(({ column: { label, textOf, partialOf }, narrowOnly }) => {
      const partial = partialOf?.(video)
      return { label, text: textOf(video, locale), narrowOnly, ...(partial ? { partial } : {}) }
    }),
  }
}

// Approved word for word in creator-analytics#119 (W6). Change it only with Nick.
/** In a window after publish, which leaves out average viewed, the note that says why. Else null. */
export function averageViewedNoteOf(window: VideoWindow): string | null {
  return isWindowAfterPublish(window)
    ? 'YouTube doesn\'t support average viewed for "after publish" date ranges. Open a video or change the date range to see it.'
    : null
}

/**
 * What a list with no videos says. A format filter can match none of a channel's uploads, a list
 * of public videos only can match none of a channel with only unlisted or private ones, and a
 * minimum of impressions can hide every video.
 */
export function emptyListTextOf(
  format: VideoFormatFilter,
  visibility: Visibility,
  minImpressions?: number,
  locale?: string,
): string {
  // Proposed in creator-analytics#944, for Nick's word for word approval on the epic's PR.
  if (minImpressions !== undefined) {
    return `No video in this list has ${minImpressions.toLocaleString(locale)} impressions or more.`
  }
  // The public-only texts are approved word for word in creator-analytics#75, the one for every
  // format by Nick on 2026-10-10 for the creator-analytics#64 PR.
  if (visibility === 'public') {
    return format === 'all'
      ? 'This channel has no public uploads.'
      : 'This channel has no public uploads in this format.'
  }
  return format === 'all'
    ? 'This channel has no uploads yet.'
    : 'This channel has no uploads in this format.'
}
