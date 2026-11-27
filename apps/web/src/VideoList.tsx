import type {
  ListedChannel,
  RangeBounds,
  RevenueCurrency,
  VideoListAnswer,
  VideoRow,
} from '@creator-analytics/api-types'
import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { track } from './analytics.ts'
import { latestOnly, readAnswer } from './api.ts'
import { boundsOf } from './custom-range.ts'
import { browserOf, holdHeadingUnderBar, landOnList } from './heading-hold.ts'
import { historyNewestNoteOf } from './history.ts'
import { LaunchSwatch } from './LaunchChart.tsx'
import { ListSelect } from './ListSelect.tsx'
import { launchSwatchPositionsOf } from './launch-chart.ts'
import { loadingText } from './loading.ts'
import { newestAverageTextOf, newestHistoryAverageTextOf } from './newest-average.ts'
import { LoadingStatus, Placeholder } from './Placeholder.tsx'
import {
  type ColumnSwitches,
  columnPreferenceOf,
  type OptionalColumn,
  rpmAdsAndPremiumOnlyOf,
  usePreferences,
} from './preferences.ts'
import { partialLabelOf, rememberAwaitingProcessingOf } from './processing.ts'
import { RevenueSourcesButton } from './RevenueSourcesButton.tsx'
import { RouteLink } from './RouteLink.tsx'
import {
  fallBackFromRefusedRange,
  type ListControl,
  type Navigate,
  pageSizeOfText,
  type Route,
  routeToVideo,
  routeWithColumnOff,
  routeWithControl,
} from './route.ts'
import { SortableHeading } from './SortableHeading.tsx'
import { Switch } from './Switch.tsx'
import { answerShown, cacheOf, screenShown } from './screen-timing.ts'
import { rememberSincePublishOf } from './since-publish.ts'
import { Thumbnail } from './Thumbnail.tsx'
import { revenueSourcesText } from './tables.ts'
import { listThumbnailSizes } from './thumbnail.ts'
import { allTrafficSources, trafficSourceLabel, trafficSourceOptions } from './traffic-sources.ts'
import {
  averageViewedNoteOf,
  type ColumnConditions,
  columnSwitchLabels,
  columnsGroupLabel,
  columnToggledEvent,
  controlChangedEvent,
  detailColumns,
  hideSourcesOn,
  historyFiltersShownOf,
  listCaptionOf,
  listColumnsShownOf,
  listCurrencyNoteOf,
  listHeadingSortOf,
  listLabel,
  listReadOf,
  listRevenueCurrencyOf,
  listRowClassOf,
  listRowClicks,
  metricCellsOf,
  minImpressionsChangeOf,
  minImpressionsLabel,
  optionalColumnsOf,
  pageSizeLabel,
  pageSizeOptions,
  privacyMarkerOf,
  readsAnotherPageOf,
  rememberListHistoryOf,
  rememberListRowsOf,
  rememberPublishDayTopRowsOf,
  repackagingViewTracker,
  revenueNoteOf,
  routeAfterListAnswerOf,
  routeWithHistorySortOff,
  routeWithSourcesOff,
  type SummaryPlaceList,
  sortKeysOfColumn,
  sortLabelOf,
  sourceColumnsShownOf,
  sourcesButtonShownOf,
  summaryPlaceListOf,
  type VideoListRead,
  type VideoListShown,
  type VideoListView,
  videoListShownOf,
  videoListStateOf,
  videoListViewOf,
  visibilitySwitchLabel,
} from './video-list.ts'

function noHover() {}

// Rendered at every width, and hidden by CSS above the narrow breakpoint.
const narrowOnlyClass = 'video-list-narrow-only'

// One for the page load, the nearest the app has to a session, so the event goes once whatever
// the list's remounts.
const trackRepackagingView = repackagingViewTracker()

/**
 * The minimum impressions field. It commits on Enter or on leaving it, not on each keystroke, as
 * each commit is a navigation and a list read; a value that is not a whole number from 1 is not
 * committed, and the field shows the minimum in force again. It takes the minimum in force
 * whenever that changes, so a change of the address resets the text.
 */
function MinImpressionsField({
  minImpressions,
  onCommit,
  ref,
}: {
  minImpressions: number | undefined
  onCommit: (change: { minImpressions: number | undefined }) => void
  ref: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  const committed = minImpressions === undefined ? '' : String(minImpressions)
  useLayoutEffect(() => {
    if (ref.current) ref.current.value = committed
  }, [ref, committed])
  function commit(field: HTMLInputElement) {
    const change = minImpressionsChangeOf(field.value)
    if (change === null) field.value = committed
    else if (change.minImpressions !== minImpressions) onCommit(change)
  }
  return (
    <label htmlFor={id} className="grid gap-[0.35rem] text-[0.875rem] text-muted-foreground">
      {minImpressionsLabel}
      <input
        id={id}
        ref={ref}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        defaultValue={committed}
        className="w-[8rem] min-w-0 rounded-field! border border-input [background:transparent] py-[0.6rem] px-[0.8rem] font-sans text-base/[1.2] font-normal text-foreground [&:hover]:border-primary"
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget)
        }}
      />
    </label>
  )
}

/**
 * The traffic source select and the minimum impressions field. They leave the controls row when the
 * list stops offering them, a cleared filter on a channel whose history is not readable or an answer
 * without the history, and `leftFocused` is set when one of them held focus as they left, so the
 * list can give focus a place.
 */
function HistoryFilters({
  route,
  changeControl,
  leftFocused,
}: {
  route: Route
  changeControl: (control: ListControl) => void
  leftFocused: RefObject<boolean>
}) {
  const source = useRef<HTMLSelectElement>(null)
  const minimum = useRef<HTMLInputElement>(null)
  // A layout effect's cleanup runs before React takes the controls out of the page, while the one
  // focused still holds focus.
  useLayoutEffect(
    () => () => {
      const focused = document.activeElement
      if (focused !== null && (focused === source.current || focused === minimum.current)) {
        leftFocused.current = true
      }
    },
    [leftFocused],
  )
  return (
    <>
      <ListSelect
        label={trafficSourceLabel}
        value={route.trafficSource ?? allTrafficSources}
        options={trafficSourceOptions}
        ref={source}
        onChange={(value) =>
          changeControl({
            trafficSource: value === allTrafficSources ? undefined : value,
          })
        }
      />
      <MinImpressionsField
        minImpressions={route.minImpressions}
        ref={minimum}
        onCommit={changeControl}
      />
    </>
  )
}

export async function readVideoList(channelId: string, query: string): Promise<VideoListView> {
  return videoListViewOf(
    await readAnswer<VideoListAnswer>(`/api/channels/${channelId}/videos?${query}`),
  )
}

function selectedText(): string {
  return window.getSelection()?.toString() ?? ''
}

/** A row of the list, exported so its markup can be tested on its own. */
export function VideoListRow({
  video,
  route,
  switches,
  columnConditions,
  currency,
  adsAndPremiumOnly = false,
  navigate,
  marked,
  onHover,
  launchPosition,
}: {
  video: VideoRow
  route: Route
  switches: ColumnSwitches
  columnConditions: ColumnConditions
  /** The currency the row's revenue is in, when the list shows revenue (`listRevenueCurrencyOf`). */
  currency: RevenueCurrency | undefined
  /** The saved RPM switch: the row's RPM counts only ads and YouTube Premium. Off by default. */
  adsAndPremiumOnly?: boolean
  navigate: Navigate
  /** The video whose line the launch chart selected, or null. */
  marked: string | null
  /** Called with the row's video when a pointer enters the row, and null when it leaves. */
  onHover: (videoId: string | null) => void
  /** The row's launch chart color position when the list shows its swatch, or undefined. */
  launchPosition: number | undefined
}) {
  const metrics = metricCellsOf(video, switches, {
    currency,
    adsAndPremiumOnly,
    ...columnConditions,
  })
  const partial = partialLabelOf(video)
  const marker = privacyMarkerOf(video.privacy)
  const videoRoute = routeToVideo(route, video.id)

  // The row takes a click without becoming a link or a tab stop: the title stays its one link, for
  // the keyboard and screen readers.
  function openOnClick(event: MouseEvent<HTMLTableRowElement>) {
    listRowClicks.click(
      {
        button: event.button,
        modifierKey: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey,
        insideLink: event.target instanceof Element && event.target.closest('a') !== null,
        selectedText: selectedText(),
      },
      () => navigate(videoRoute),
    )
  }

  return (
    <tr
      className={listRowClassOf(video.id, marked)}
      onClick={openOnClick}
      onPointerEnter={() => onHover(video.id)}
      onPointerLeave={() => onHover(null)}
    >
      <th scope="row" className="video-list-video">
        <span className="video-list-video-cell">
          <Thumbnail
            url={video.thumbnailUrl}
            thumbnails={video.thumbnails}
            sizes={listThumbnailSizes}
            durationSeconds={video.durationSeconds}
            className="video-list-thumbnail"
            lazy
          />
          <span>
            {launchPosition !== undefined && <LaunchSwatch position={launchPosition} />}
            <RouteLink route={videoRoute} navigate={navigate}>
              {video.title}
            </RouteLink>
            {marker && <span className="video-list-privacy">{marker}</span>}
            {partial && <span className="video-list-partial">{partial}</span>}
          </span>
        </span>
      </th>
      {detailColumns.map(({ label, textOf, hasNoData }) => (
        <td key={label} className={hasNoData?.(video) ? 'video-list-no-data' : undefined}>
          {textOf(video)}
        </td>
      ))}
      {metrics.kind === 'numbers' ? (
        metrics.cells.map(({ label, text, narrowOnly, partial: cellPartial }) => (
          <td key={label} className={cellClassOf(narrowOnly)}>
            {text}
            {cellPartial && <span className="video-list-partial">{cellPartial}</span>}
          </td>
        ))
      ) : (
        <>
          <td className="video-list-not-processed" colSpan={metrics.colSpan}>
            {metrics.text}
          </td>
          {metrics.narrowOnlyCell && <td className={narrowOnlyClass} />}
        </>
      )}
    </tr>
  )
}

function cellClassOf(narrowOnly: boolean): string | undefined {
  return narrowOnly ? narrowOnlyClass : undefined
}

/**
 * A row's place while its page is read, shaped like a row so it takes a row's height: the
 * thumbnail and the title beside it, and a cell for each column the list shows. Its cells are
 * hidden from a screen reader.
 */
function PlaceholderRow({
  switches,
  columnConditions,
}: {
  switches: ColumnSwitches
  columnConditions: ColumnConditions
}) {
  return (
    <tr>
      <td className="video-list-video" aria-hidden="true">
        <span className="video-list-video-cell">
          <Placeholder shape="thumbnail" />
          <Placeholder shape="line" />
        </span>
      </td>
      {listColumnsShownOf(switches, columnConditions).map(({ column, narrowOnly }) => (
        <td key={column.label} className={cellClassOf(narrowOnly)} aria-hidden="true">
          <Placeholder shape="text" />
        </td>
      ))}
    </tr>
  )
}

/**
 * The route's page among `pageCount` pages: the answer's, or while a page is read, the last one's.
 * Its links `land` where the list's table is, not at the top of the screen. First page and Last
 * page show only where they skip a page, so neither opens the page Previous page or Next page does.
 */
export function Pager({
  pageCount,
  route,
  navigate,
  land,
}: {
  pageCount: number
  route: Route
  navigate: Navigate
  land: () => void
}) {
  const { page } = route
  if (pageCount <= 1) return null
  const showsFirst = page > 2
  const showsLast = page < pageCount - 1
  return (
    <nav className="video-list-pager" aria-label="Pages">
      {showsFirst && (
        <RouteLink route={{ ...route, page: 1 }} navigate={navigate} land={land}>
          First page
        </RouteLink>
      )}
      {page > 1 && (
        <RouteLink route={{ ...route, page: page - 1 }} navigate={navigate} land={land}>
          Previous page
        </RouteLink>
      )}
      <span className="video-list-pager-place">{`Page ${page} of ${pageCount}`}</span>
      {page < pageCount && (
        <RouteLink route={{ ...route, page: page + 1 }} navigate={navigate} land={land}>
          Next page
        </RouteLink>
      )}
      {showsLast && (
        <RouteLink route={{ ...route, page: pageCount }} navigate={navigate} land={land}>
          Last page
        </RouteLink>
      )}
    </nav>
  )
}

/**
 * The uploads of a channel, a page at a time, over a window, in a sort, of a format and a
 * visibility. The window and the format are the controls bar's; the page size and the visibility
 * are the list's own, each the address's, then the saved preference, then the default. The column
 * headings sort. The Revenue column, its switch and its sort are there only on a channel with
 * revenue consent. A sort from the address by a watch hours or revenue column that is switched off,
 * revenue without consent included, is replaced by newest first. The list
 * reads again when the saved currency changes, and only once every save made so far has settled, so
 * revenue never comes back in the currency before the change. Its controls show from the first
 * render and stay usable while a page is read, and its rows hold their place meanwhile. With no
 * channel yet, while the channels or the preferences are read, it holds the rows' place and reads
 * nothing. Its heading rows stay under the `controlsBar` as the page scrolls past the list. A pager
 * link brings the table's top under the `controlsBar` and gives the table focus, whose caption,
 * which only a screen reader reads, names the page. When the read a pager link or a sort heading
 * started is refused, focus moves to the refusal message that replaces the table, unless the creator
 * has since moved it elsewhere.
 */
export function VideoList({
  channel,
  route: addressRoute,
  navigate,
  onShown,
  markedVideoId = null,
  onRowHover = noHover,
  onBounds,
  controlsBar,
  paid,
}: {
  /**
   * Null while the channels or the preferences are read, so a sort in the address stays until the
   * revenue consent and the column switches are known.
   */
  channel: ListedChannel | null
  route: Route
  navigate: Navigate
  /** Told what the list shows, which the summary's place draws in a window after publish. */
  onShown?: (list: SummaryPlaceList) => void
  /** The video whose line the launch chart selected, whose row is marked, or null. */
  markedVideoId?: string | null
  /** Called with a row's video when a pointer enters it, and null when it leaves. */
  onRowHover?: (videoId: string | null) => void
  /**
   * Told the days a custom range can cover each time a list answer lands, which the controls bar's
   * fields take as their earliest and latest days.
   */
  onBounds?: (bounds: RangeBounds) => void
  /** The controls bar the heading rows sit under as the page scrolls; with none, they scroll away. */
  controlsBar?: RefObject<HTMLElement | null>
  /**
   * Whether the entitlements answer says the channel is paid (`channelPaidOf`), which holds the
   * place of the history's filters before the channel's first answer lands.
   */
  paid: boolean
}) {
  const channelId = channel === null ? null : channel.id
  const consented = channel !== null && channel.revenueConsentedAt !== null
  const { saved, save, settled } = usePreferences()
  const { route, switches, sources, pageSize, visibility, query, key, listKey } = listReadOf(
    addressRoute,
    channel,
    saved,
  )
  const viewed = useRef(false)
  const currentRoute = useRef(route)
  const { window, format } = route
  const [read, setRead] = useState<VideoListRead | null>(null)
  // A pager link or a sort heading in the table started the read, until it answers or is refused.
  const tableRead = useRef(false)
  const refusal = useRef<HTMLParagraphElement>(null)
  const pageSizeSelect = useRef<HTMLSelectElement>(null)
  // The history filters left the controls row with focus in one, until the list gives it a place.
  const filtersLeftFocused = useRef(false)
  useEffect(() => listRowClicks.cancel, [])

  // Once each time the list opens, not on each page. The ref outlives StrictMode's second effect.
  useEffect(() => {
    if (viewed.current || channelId === null) return
    viewed.current = true
    track({ name: 'video_list_viewed' })
  }, [channelId])

  useEffect(() => {
    currentRoute.current = route
  })

  // Replaced, not pushed, as the page past the last is, so the address never names a sort the API
  // refuses.
  useEffect(() => {
    if (route !== addressRoute) navigate(route, { replace: true })
  }, [route, addressRoute, navigate])

  useEffect(() => {
    if (channelId === null) return
    return latestOnly(
      settled().then(() => readVideoList(channelId, query)),
      (next) => {
        if (next.kind === 'invalid-range') {
          fallBackFromRefusedRange(currentRoute.current, navigate)
          return
        }
        const withoutHistorySort =
          next.kind === 'refused' && next.historySort
            ? routeWithHistorySortOff(currentRoute.current)
            : currentRoute.current
        if (withoutHistorySort !== currentRoute.current) {
          navigate(withoutHistorySort, { replace: true })
          return
        }
        if (next.kind === 'list') {
          onBounds?.(boundsOf(next.answer))
          // The video screen's placeholder holds the since publish rows of a video opened from
          // here: a row on the page, or a video in the publish day top that may not be on it. The
          // page's rows go last, so a row wins, though both come from this one answer. A row
          // Google has not processed holds only the awaiting answer's places. The launch chart's
          // placeholder holds the first-10 note's place from the rows this read answered, the next
          // time the page reads it, Back from a video included (creator-analytics#325).
          rememberSincePublishOf(
            [...(next.answer.publishDayTop ?? []), ...next.answer.videos],
            next.answer.lastProcessedDay,
          )
          rememberAwaitingProcessingOf(next.answer.videos)
          rememberListRowsOf(channelId, query, next.answer.videos.length)
          rememberListHistoryOf(channelId, next.answer)
          // Only a read of the first day after publish carries the top, whose placeholder holds
          // the bars it answered the next time the page reads it (creator-analytics#510).
          if (next.answer.publishDayTop)
            rememberPublishDayTopRowsOf(channelId, query, next.answer.publishDayTop.length)
        }
        const after =
          next.kind === 'list' ? routeAfterListAnswerOf(currentRoute.current, next.answer) : null
        // Replaced, not pushed, so the back button does not return to the page past the last, or
        // to a source, CTR or impressions sort the list cannot show.
        if (after && after !== currentRoute.current) navigate(after, { replace: true })
        else {
          if (next.kind === 'list') tableRead.current = false
          setRead({ channelId, key, listKey, view: next })
        }
      },
      (message) => setRead({ channelId, key, listKey, view: { kind: 'refused', message } }),
    )
  }, [channelId, key, listKey, query, navigate, settled, onBounds])

  function changeControl(control: ListControl) {
    if ('pageSize' in control) save({ pageSize: control.pageSize })
    if ('visibility' in control) save({ visibility: control.visibility })
    navigate(routeWithControl(route, control))
    const changed = controlChangedEvent(control)
    if (changed) track(changed)
    const repackagingView = trackRepackagingView(control)
    if (repackagingView) track(repackagingView)
  }

  // Only the column event: the sort a switch resets is not a heading's change.
  function toggleColumn(column: OptionalColumn, on: boolean) {
    save(columnPreferenceOf(column, on))
    track(columnToggledEvent(column, on))
    if (on) return
    // RPM and the source columns go with the Revenue column.
    const off = sortKeysOfColumn(column).reduce(routeWithColumnOff, route)
    const next = column === 'revenue' ? routeWithSourcesOff(off) : off
    if (next !== route) navigate(next)
  }

  const shown = videoListShownOf(videoListStateOf(read, channelId, { key, query, pageSize }), {
    format,
    visibility,
    minImpressions: route.minImpressions,
  })
  const columnConditions: ColumnConditions = {
    window,
    sources: sourceColumnsShownOf(shown.answer, switches, sources),
    history: shown.answer?.history !== undefined,
  }
  const place = summaryPlaceListOf(
    shown,
    channelId,
    readsAnotherPageOf(read, channelId, { key, listKey }),
  )
  const refused = shown.body.kind === 'refused'
  const placeReading = place.kind === 'reading'
  const placeChannelId = place.kind === 'list' ? place.channelId : null
  const placeAnswer = place.kind === 'list' ? place.answer : null

  // The channel screen's answer is the list's, read in every window and on every sort, page and
  // filter, which the summary is not. Timed once its render commits, once for each answer.
  const answered = shown.busy ? null : shown.answer
  useEffect(() => screenShown('/app/'), [])
  useEffect(() => {
    if (answered) answerShown('/app/', answered.window, cacheOf(answered.fromCache))
  }, [answered])

  // After each change of what the list shows, never on a render that changes nothing of it.
  useEffect(() => {
    onShown?.(
      placeAnswer && placeChannelId !== null
        ? { kind: 'list', channelId: placeChannelId, answer: placeAnswer }
        : { kind: placeReading ? 'reading' : 'none' },
    )
  }, [onShown, placeReading, placeChannelId, placeAnswer])

  // The refusal unmounts the table a pager link focused, or the sort heading that held focus, so
  // focus fell to the page; it moves to the refusal message, and focus the creator has since moved
  // elsewhere stays where it is.
  useEffect(() => {
    if (!tableRead.current) return
    if (refused) {
      tableRead.current = false
      if (document.activeElement === document.body || document.activeElement === null) {
        refusal.current?.focus({ preventScroll: true })
      }
    }
  }, [refused])

  // The history filters that held focus left the page, so focus fell to it; it moves to the page
  // size select before them, the control nearest the creator's place in the row.
  useLayoutEffect(() => {
    if (!filtersLeftFocused.current) return
    filtersLeftFocused.current = false
    if (document.activeElement === document.body || document.activeElement === null) {
      pageSizeSelect.current?.focus({ preventScroll: true })
    }
  })

  return (
    <section className="video-list" aria-label={listLabel}>
      <div className="controls">
        <ListSelect
          label={pageSizeLabel}
          value={`${pageSize}`}
          ref={pageSizeSelect}
          options={pageSizeOptions}
          onChange={(value) => {
            const size = pageSizeOfText(value)
            if (size) changeControl({ pageSize: size })
          }}
        />
        {/* For a channel whose history is readable, and wherever the address sets one to clear. */}
        {historyFiltersShownOf(shown.answer, channelId, paid, route) && (
          <HistoryFilters
            route={route}
            changeControl={changeControl}
            leftFocused={filtersLeftFocused}
          />
        )}
        <Switch
          label={visibilitySwitchLabel}
          checked={visibility === 'all'}
          onChange={(on) => changeControl({ visibility: on ? 'all' : 'public' })}
        />
        <fieldset className="column-switches">
          <legend>{columnsGroupLabel}</legend>
          <div className="column-switches-options">
            {optionalColumnsOf(consented).map((column) => (
              <Switch
                key={column}
                label={columnSwitchLabels[column]}
                checked={switches[column]}
                onChange={(on) => toggleColumn(column, on)}
              />
            ))}
          </div>
        </fieldset>
        {sourcesButtonShownOf(shown.answer, switches) && (
          <RevenueSourcesButton table="list" onHide={() => hideSourcesOn(route, navigate)} />
        )}
      </div>
      {/* A screen reader reads a heading's aria-sort only on entering it, so a new sort is announced here. */}
      <p className="visually-hidden" aria-live="polite">
        {sortLabelOf(route.window, route.sort)}
      </p>
      <LoadingStatus text={shown.busy ? loadingText.videos : null} />
      {shown.body.kind === 'refused' ? (
        // Focused only when it replaces a read a pager link or a sort heading started, so outside
        // the Tab order.
        <p role="alert" ref={refusal} tabIndex={-1}>
          {shown.body.message}
        </p>
      ) : (
        <VideoListRows
          shown={shown}
          body={shown.body}
          route={route}
          switches={switches}
          columnConditions={columnConditions}
          adsAndPremiumOnly={rpmAdsAndPremiumOnlyOf(saved)}
          navigate={navigate}
          changeControl={changeControl}
          markedVideoId={markedVideoId}
          onRowHover={onRowHover}
          controlsBar={controlsBar}
          onTableRead={() => {
            tableRead.current = true
          }}
        />
      )}
    </section>
  )
}

/**
 * The list's average sentence, notes, rows and pager, which wait on a page's read while the
 * controls above stay: the answer's rows, or meanwhile a placeholder row for each, and the last
 * answer's sentence, notes and pager.
 */
export function VideoListRows({
  shown: { busy, answer },
  body,
  route,
  switches,
  columnConditions,
  adsAndPremiumOnly = false,
  navigate,
  changeControl,
  markedVideoId,
  onRowHover,
  controlsBar,
  onTableRead,
}: {
  shown: Omit<VideoListShown, 'body'>
  /** The shown body, which a refusal replaces before it gets here. */
  body: Exclude<VideoListShown['body'], { kind: 'refused' }>
  route: Route
  switches: ColumnSwitches
  columnConditions: ColumnConditions
  /** The saved RPM switch, which each row's RPM follows. Off by default. */
  adsAndPremiumOnly?: boolean
  navigate: Navigate
  changeControl: (control: ListControl) => void
  markedVideoId: string | null
  onRowHover: (videoId: string | null) => void
  controlsBar: RefObject<HTMLElement | null> | undefined
  /**
   * Told when a pager link or a sort heading in the table starts a read: a pager link before it
   * takes focus, and a sort heading before it changes the sort.
   */
  onTableRead: () => void
}) {
  const table = useRef<HTMLTableElement>(null)
  const tableShown = body.kind !== 'empty' && body.kind !== 'placeholder-empty'
  // Holds the heading rows under the bar while the table is on screen, and lets go once it leaves.
  useEffect(() => {
    const bar = controlsBar?.current
    if (!tableShown || !table.current || !bar) return
    return holdHeadingUnderBar(table.current, bar, browserOf(window))
  }, [controlsBar, tableShown])
  const newestAverageText = answer && newestAverageTextOf(answer)
  const newestHistoryAverageText = answer && newestHistoryAverageTextOf(answer)
  const historyNote =
    answer?.history &&
    historyNewestNoteOf(
      answer.history,
      answer.videos.some(({ historyPartial }) => historyPartial !== undefined),
    )
  const averageViewedNote = averageViewedNoteOf(route.window)
  const revenueNote = answer && revenueNoteOf(answer, switches)
  const currencyNote = answer && listCurrencyNoteOf(answer, switches)
  const shownColumns = listColumnsShownOf(switches, columnConditions)
  // Once per page, the same positions the launch chart draws its lines in.
  const launchPositions =
    body.kind === 'videos'
      ? launchSwatchPositionsOf(body.answer.window, body.answer.videos)
      : undefined
  const sourceColumns = shownColumns.filter(({ column }) => column.source)
  const grouped = sourceColumns.length > 0

  function headingOf({ column, narrowOnly }: (typeof shownColumns)[number], rowSpan?: number) {
    return (
      <SortableHeading
        key={column.label}
        label={column.label}
        sort={listHeadingSortOf(column, route.window, route.sort)}
        onSort={(sort) => {
          onTableRead()
          changeControl({ sort })
        }}
        className={cellClassOf(narrowOnly)}
        rowSpan={rowSpan}
      />
    )
  }

  return (
    <div className="video-list-rows" aria-busy={busy}>
      {body.kind === 'empty' ? (
        <p>{body.text}</p>
      ) : body.kind === 'placeholder-empty' ? (
        <Placeholder shape="line" />
      ) : (
        <>
          {newestAverageText && <p>{newestAverageText}</p>}
          {newestHistoryAverageText && <p>{newestHistoryAverageText}</p>}
          {historyNote && <p className="note">{historyNote}</p>}
          {averageViewedNote && <p className="note">{averageViewedNote}</p>}
          {revenueNote && <p className="note">{revenueNote}</p>}
          <div className="video-list-scroll">
            {/* Focused by a pager link only, so outside the Tab order. */}
            <table ref={table} tabIndex={-1}>
              {answer && (
                <caption className="visually-hidden">
                  {listCaptionOf(route.page, answer.pageCount)}
                </caption>
              )}
              <thead>
                <tr>
                  <th scope="col" rowSpan={grouped ? 2 : undefined}>
                    Video
                  </th>
                  {shownColumns
                    .filter(({ column }) => !column.source)
                    .flatMap((shownColumn) => {
                      const heading = headingOf(shownColumn, grouped ? 2 : undefined)
                      // The sources' heading sits right after Revenue, over the source columns.
                      return grouped && shownColumn.column.sortKey === 'estimatedRevenue'
                        ? [
                            heading,
                            <th
                              key={revenueSourcesText.heading}
                              scope="colgroup"
                              colSpan={sourceColumns.length}
                              className="video-list-group"
                            >
                              {revenueSourcesText.heading}
                            </th>,
                          ]
                        : [heading]
                    })}
                </tr>
                {grouped && <tr>{sourceColumns.map((shownColumn) => headingOf(shownColumn))}</tr>}
              </thead>
              <tbody>
                {body.kind === 'videos'
                  ? body.answer.videos.map((video) => (
                      <VideoListRow
                        key={video.id}
                        video={video}
                        route={route}
                        switches={switches}
                        columnConditions={columnConditions}
                        currency={listRevenueCurrencyOf(body.answer)}
                        adsAndPremiumOnly={adsAndPremiumOnly}
                        navigate={navigate}
                        marked={markedVideoId}
                        onHover={onRowHover}
                        launchPosition={launchPositions?.get(video.id)}
                      />
                    ))
                  : Array.from({ length: body.rows }, (_, index) => (
                      <PlaceholderRow
                        // biome-ignore lint/suspicious/noArrayIndexKey: the placeholder rows are alike and never reorder.
                        key={index}
                        switches={switches}
                        columnConditions={columnConditions}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {currencyNote && <p className="note">{currencyNote}</p>}
      {answer && (
        <Pager
          pageCount={answer.pageCount}
          route={route}
          navigate={navigate}
          land={() => {
            onTableRead()
            landOnList(table.current, controlsBar?.current, window)
          }}
        />
      )}
    </div>
  )
}
