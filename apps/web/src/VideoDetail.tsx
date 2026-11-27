import {
  currencyOf,
  type ListedChannel,
  type ThumbnailSize,
  type VideoDetailAnswer,
  type VideoFormat,
  type VideoRow,
  type WindowChoice,
} from '@creator-analytics/api-types'
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AudienceRetention } from './AudienceRetention.tsx'
import { track } from './analytics.ts'
import { readAnswer } from './api.ts'
import { holdBarHeightOn } from './bar-height.ts'
import { Cards } from './Cards.tsx'
import { ControlsBar, useChannelBounds } from './ControlsBar.tsx'
import { boundsOf } from './custom-range.ts'
import { Figures } from './Figures.tsx'
import { loadingText } from './loading.ts'
import { MetricCharts, useChartChoice } from './MetricCharts.tsx'
import {
  CardsPlaceholder,
  FiguresPlaceholder,
  LoadingStatus,
  MetricChartsPlaceholder,
  Placeholder,
  PlaceholderBarRows,
} from './Placeholder.tsx'
import { createPlayheadStore } from './playhead.ts'
import { rpmAdsAndPremiumOnlyOf, usePreferences, useViewInSavedCurrency } from './preferences.ts'
import {
  awaitingProcessingFor,
  delayNoteOf,
  notProcessedText,
  partialLabelOf,
  rememberAwaitingProcessingOf,
} from './processing.ts'
import { RouteLink } from './RouteLink.tsx'
import {
  type Navigate,
  type Route,
  routeToList,
  routeToSponsorReport,
  useRangeFallback,
} from './route.ts'
import { SincePublishTable } from './SincePublishTable.tsx'
import { SubscriberSplitFigures } from './SubscriberSplitFigures.tsx'
import { answerShown, cacheOf, screenShown } from './screen-timing.ts'
import {
  rememberSincePublishOf,
  sincePublishKnownFor,
  sincePublishPlaceholderRowsFor,
} from './since-publish.ts'
import { sponsorReportText } from './sponsor-report.ts'
import { Thumbnail } from './Thumbnail.tsx'
import { TrafficSourceReach, TrafficSources } from './TrafficSources.tsx'
import { detailThumbnailSizes } from './thumbnail.ts'
import { readVideoList } from './VideoList.tsx'
import { type PlayerVideo, useVideoPlayerMoves, VideoPlayer } from './VideoPlayer.tsx'
import { VideoStepper } from './VideoStepper.tsx'
import {
  detailCardCountOf,
  detailCurrencyNoteOf,
  detailDaysOf,
  detailTotalOf,
  headlineOf,
  type VideoDetailView,
  videoDetailQueryOf,
  videoDetailViewOf,
  viewOfVideo,
  watchOnYouTubeText,
  youtubeWatchUrlOf,
} from './video-detail.ts'
import { type LandedListView, listReadOf, videoListQueryOf } from './video-list.ts'
import { cannotPlayLineOf, holdsVideoPlayer } from './video-player.ts'
import {
  adjacentPagesOf,
  headRowOf,
  type ListPages,
  type StepperPosition,
  stepperOf,
} from './video-step.ts'

async function readVideoDetail(
  channelId: string,
  video: string,
  route: WindowChoice,
): Promise<VideoDetailView> {
  const query = videoDetailQueryOf(route)
  return videoDetailViewOf(
    await readAnswer<VideoDetailAnswer>(
      `/api/channels/${channelId}/videos/${encodeURIComponent(video)}?${query}`,
    ),
  )
}

/** What heads the screen: the video's thumbnail, its title as the h1, and the link to YouTube. */
interface HeadVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  thumbnails: ThumbnailSize[]
  durationSeconds: number | null
  /** The video's format, which shapes the video player's box during a step too. */
  format: VideoFormat | null
  /** The partial label of a video in a window after publish Google has not processed whole. */
  partial: string | null
}

function headVideoOf(
  {
    id,
    title,
    thumbnailUrl,
    thumbnails,
    durationSeconds,
    format,
  }: VideoRow | VideoDetailAnswer['video'],
  partial: string | null,
): HeadVideo {
  return { id, title, thumbnailUrl, thumbnails, durationSeconds, format, partial }
}

function VideoDetailHead({
  video,
  title,
  stepper,
  route,
  navigate,
}: {
  video: HeadVideo
  title: RefObject<HTMLHeadingElement | null>
  stepper: ReactNode
  route: Route
  navigate: Navigate
}) {
  return (
    <div className="video-detail-head">
      <Thumbnail
        url={video.thumbnailUrl}
        thumbnails={video.thumbnails}
        sizes={detailThumbnailSizes}
        durationSeconds={video.durationSeconds}
        className="video-detail-thumbnail"
      />
      <div>
        <h1 ref={title} tabIndex={-1}>
          {video.title}
        </h1>
        {video.partial && <p className="note">{video.partial}</p>}
        <p className="video-detail-links">
          <a href={youtubeWatchUrlOf(video.id)}>{watchOnYouTubeText}</a>
          <RouteLink route={routeToSponsorReport(route, video.id)} navigate={navigate}>
            {sponsorReportText}
          </RouteLink>
        </p>
      </div>
      {stepper}
    </div>
  )
}

/** The sections above audience retention, or for a video Google has not processed its text. */
function VideoDetailSections({
  answer,
  route,
  navigate,
  onGiveRevenueConsent,
}: {
  answer: VideoDetailAnswer
  route: Route
  navigate: Navigate
  onGiveRevenueConsent: () => void
}) {
  const delayNote = delayNoteOf(answer.lastProcessedDay)
  const adsAndPremiumOnly = rpmAdsAndPremiumOnlyOf(usePreferences().saved)
  const headline = headlineOf(answer, undefined, { adsAndPremiumOnly })
  const currencyNote = detailCurrencyNoteOf(answer)
  const days = detailDaysOf(answer)
  // On a screen too small to stack the charts, the cards choose the one that shows.
  const { choice, shown } = useChartChoice(route, navigate, days)
  if (answer.awaitingProcessing)
    return (
      <>
        <p>{notProcessedText}</p>
        <p className="note">{delayNote}</p>
      </>
    )
  return (
    <>
      <Cards cards={headline.cards} choice={choice} onGiveRevenueConsent={onGiveRevenueConsent} />
      {currencyNote && <p className="note">{currencyNote}</p>}
      <Figures figures={headline.figures} smaller />
      <MetricCharts
        days={days}
        total={detailTotalOf(answer)}
        route={route}
        navigate={navigate}
        note={delayNote}
        shown={shown}
      />
      {/* From the answer alone, never the window: the same in every date range. */}
      <SincePublishTable sincePublish={answer.sincePublish} />
    </>
  )
}

/**
 * Traffic sources and the subscriber split, which share rows on a wide screen, then with a paid
 * channel's history the traffic sources' impressions and CTR in a row of their own under both.
 */
function VideoDetailBreakdowns({ answer }: { answer: VideoDetailAnswer }) {
  return (
    <>
      <div className="video-detail-breakdowns">
        <TrafficSources sources={answer.trafficSources} />
        <SubscriberSplitFigures split={answer.subscriberSplit} />
      </div>
      <TrafficSourceReach answer={answer} />
    </>
  )
}

/**
 * The video's screen below the controls: the head, the sections, and the previous and next video
 * links in the head and again after the last section. While the video's detail is read, the head
 * comes from its list row when one is read, so a step keeps the head and the links in place and
 * only the sections show their placeholders; with no row, the head's place is held too, with no
 * links. For a video the page knows Google has not processed, the placeholders are those of the
 * awaiting answer alone. The sections sit in one element in both states, and audience retention is
 * one element in it, so the video player there stays in the page across a step: a moved or
 * detached frame reloads. The player shows once an answer holds it, beside a retention curve
 * (`holdsVideoPlayer`), and nothing loads from YouTube before that. When the last answer held it,
 * it stays while a step or a window change is read, until the next answer lands.
 */
export function VideoDetailScreen({
  video,
  answer,
  headRow,
  stepper,
  title,
  route,
  navigate,
  onGiveRevenueConsent,
}: {
  video: string
  /** The video's detail, or null while it is read. */
  answer: VideoDetailAnswer | null
  /** The video's row on the list page read, or null. */
  headRow: VideoRow | null
  /** The previous and next video links at a position on the screen, or null for none. */
  stepper: (position: StepperPosition) => ReactNode
  title: RefObject<HTMLHeadingElement | null>
  route: Route
  navigate: Navigate
  onGiveRevenueConsent: () => void
}) {
  const head = answer
    ? headVideoOf(answer.video, partialLabelOf(answer))
    : headRow && headVideoOf(headRow, partialLabelOf(headRow))
  const awaiting = answer ? answer.awaitingProcessing : awaitingProcessingFor(video)
  // The video of the last answer that held the player, so a window change, which reads the same
  // video again with no list row to head it, keeps the player in place.
  const [heldPlayerVideo, setHeldPlayerVideo] = useState<VideoDetailAnswer['video'] | null>(null)
  const landedPlayerVideo = answer && holdsVideoPlayer(answer) ? answer.video : null
  if (answer && landedPlayerVideo !== heldPlayerVideo) setHeldPlayerVideo(landedPlayerVideo)
  // A list row heading a step says nothing of whether its video embeds or is made for kids.
  const playerVideo: PlayerVideo | null = answer
    ? landedPlayerVideo
    : heldPlayerVideo &&
      (heldPlayerVideo.id === video
        ? heldPlayerVideo
        : head && { ...head, embeddable: null, madeForKids: null })
  // The time the player is at, for the playhead on the retention plots. Held here, above the read,
  // so a window change that remounts the charts finds the line where it was; in memory only.
  const [playhead] = useState(createPlayheadStore)
  const moves = useVideoPlayerMoves(video, playerVideo?.madeForKids === false)
  const cannotPlay = playerVideo
    ? cannotPlayLineOf(playerVideo.embeddable, moves.playerError)
    : null
  return (
    <>
      {head && (
        <VideoDetailHead
          video={head}
          title={title}
          stepper={stepper('top')}
          route={route}
          navigate={navigate}
        />
      )}
      <div
        className={answer ? 'video-detail-sections' : 'placeholders'}
        aria-busy={answer ? undefined : 'true'}
      >
        {answer ? (
          <VideoDetailSections
            answer={answer}
            route={route}
            navigate={navigate}
            onGiveRevenueConsent={onGiveRevenueConsent}
          />
        ) : (
          <VideoDetailPlaceholder video={video} route={route} withHead={head === null} />
        )}
        {!awaiting && (
          <AudienceRetention
            retention={
              answer && {
                points: answer.audienceRetention,
                durationSeconds: answer.video.durationSeconds,
              }
            }
            player={
              playerVideo && (
                <VideoPlayer
                  video={playerVideo}
                  playhead={playhead}
                  player={moves.player}
                  cannotPlay={cannotPlay}
                  onError={moves.fail}
                />
              )
            }
            playhead={playhead}
            onMove={playerVideo && cannotPlay === null ? moves.move : undefined}
          />
        )}
        {!awaiting &&
          (answer ? <VideoDetailBreakdowns answer={answer} /> : <BreakdownsPlaceholder />)}
      </div>
      {head && stepper('bottom')}
    </>
  )
}

/**
 * The screen's place while its read is in flight, one placeholder per section the answer fills:
 * the head unless its video's list row heads the screen, the cards, with the revenue card's place
 * only when the answer will carry revenue as far as the page knows (`detailCardCountOf`), so the
 * cards row keeps its rows when the answer lands, the smaller figures, the
 * charts with the note on how current the numbers are, the since publish table, then audience
 * retention's (AudienceRetention) and traffic sources and the subscriber split in the grid they
 * share (`BreakdownsPlaceholder`), which the screen places after these. No heading
 * text, only its place: a line of the h2 for each section's heading, and the subscriber split's,
 * which wraps in a narrow column of the grid, the lines it wraps to there (creator-analytics#512).
 * For a video the page's last answer said Google has not processed, as a
 * list row opened from the list says, the head's place and then only the awaiting answer's: its
 * paragraph and the note on how current the numbers are. A video the page knows nothing of, as on
 * a cold open of its address, holds every section.
 */
function VideoDetailPlaceholder({
  video,
  route,
  withHead,
}: {
  video: string
  route: Route
  withHead: boolean
}) {
  const head = withHead && (
    <div className="video-detail-head">
      <Placeholder shape="thumbnail" />
      <div>
        <Placeholder shape="heading" />
        <Placeholder shape="line" />
      </div>
    </div>
  )
  if (awaitingProcessingFor(video))
    return (
      <>
        {head}
        <Placeholder shape="not-processed" />
        <Placeholder shape="note" />
      </>
    )
  return (
    <>
      {head}
      <CardsPlaceholder count={detailCardCountOf(sincePublishKnownFor(video), route)} />
      <FiguresPlaceholder count={2} smaller />
      <MetricChartsPlaceholder route={route} />
      <div className="video-detail-section">
        <Placeholder shape="heading" />
        <Placeholder
          shape="since-publish-table"
          style={{ '--rows': sincePublishPlaceholderRowsFor(video) } as CSSProperties}
        />
      </div>
    </>
  )
}

function BreakdownsPlaceholder() {
  return (
    <div className="video-detail-breakdowns">
      <div className="video-detail-section">
        <Placeholder shape="heading" />
        <PlaceholderBarRows />
        <Placeholder shape="line" />
      </div>
      <div className="video-detail-section">
        <Placeholder shape="video-subscribers-heading" />
        <FiguresPlaceholder count={2} />
        <Placeholder shape="bar" />
        <Placeholder shape="line" />
      </div>
    </div>
  )
}

const noPages: ListPages = new Map()

/**
 * The pages read of the list a detail screen was opened from, all of the read `key`, which names
 * the channel and every part of the list read but its page.
 */
interface ReadPages {
  key: string
  pages: ListPages
}

/**
 * The list pages the previous and next video come from: the address's page, read as the video
 * list reads it (`listReadOf`) so the API answers from the same cached read, and the page before or
 * after it once the video turns out to be at or next to its page's edge (`adjacentPagesOf`). The
 * pages read stay while the read is the same but for its page, so a step shows its head and links
 * at once. A refused page is read again by "Try again" (`retry`), or by a move to another video that
 * needs it, and never by another render of the same video, so a page that keeps failing is not read
 * in a loop.
 */
function useListPages(
  channel: ListedChannel | null,
  route: Route,
  video: string,
): { listRoute: Route; pages: ListPages; retry: (page: number) => void } {
  const { saved, settled } = usePreferences()
  const { route: listRoute, pageSize, visibility } = listReadOf(route, channel, saved)
  const channelId = channel === null ? null : channel.id
  const queryOf = (page: number) => videoListQueryOf({ ...listRoute, page, pageSize, visibility })
  // Page 0, which no read asks for, so the key names every part of the read but its page, and the
  // saved currency and RPM switch, which the API reads from the preferences for the revenue and the
  // RPM sort.
  const key = JSON.stringify([
    channelId,
    queryOf(0),
    currencyOf(saved),
    rpmAdsAndPremiumOnlyOf(saved),
  ])
  const [read, setRead] = useState<ReadPages>({ key, pages: noPages })
  const [shown, setShown] = useState(video)
  if (shown !== video) {
    setShown(video)
    setRead((current) => ({ ...current, pages: withoutRefused(current.pages) }))
  }
  const pages = read.key === key ? read.pages : noPages
  const latestKey = useRef(key)
  useEffect(() => {
    latestKey.current = key
  })
  const requested = useRef<{ key: string; pages: Set<number> }>({ key, pages: new Set() })
  const wanted =
    channelId === null ? [] : [listRoute.page, ...adjacentPagesOf(video, listRoute.page, pages)]
  const missing = JSON.stringify(
    wanted.filter((page) => !pages.has(page)).map((page) => [page, queryOf(page)]),
  )

  useEffect(() => {
    if (channelId === null) return
    if (requested.current.key !== key) requested.current = { key, pages: new Set() }
    const asked = requested.current.pages
    function land(page: number, view: LandedListView) {
      asked.delete(page)
      // A read for a list the screen has since moved off shows nothing.
      if (latestKey.current !== key) return
      if (view.kind === 'list') {
        rememberSincePublishOf(view.answer.videos, view.answer.lastProcessedDay)
        rememberAwaitingProcessingOf(view.answer.videos)
      }
      setRead((current) => ({
        key,
        pages: new Map(current.key === key ? current.pages : noPages).set(page, view),
      }))
    }
    for (const [page, query] of JSON.parse(missing) as [number, string][]) {
      // A read in flight is not sent again. A page that landed is no longer missing, unless "Try
      // again" or another video dropped its refusal.
      if (asked.has(page)) continue
      asked.add(page)
      settled()
        .then(() => readVideoList(channelId, query))
        .then(
          // A refused custom range is the detail read's to fall back from; the page stays unread,
          // and asked, so it is not read again.
          (view) => view.kind !== 'invalid-range' && land(page, view),
          (reason: unknown) => land(page, { kind: 'refused', message: String(reason) }),
        )
    }
  }, [channelId, key, missing, settled])

  function retry(page: number) {
    setRead((current) => ({ ...current, pages: withoutRefused(current.pages, page) }))
  }

  return { listRoute, pages, retry }
}

/** The pages without their refusals, every one or only `page`'s, so each is missing again. */
function withoutRefused(pages: ListPages, page?: number): ListPages {
  return new Map(
    [...pages].filter(
      ([each, view]) => view.kind === 'list' || (page !== undefined && each !== page),
    ),
  )
}

/**
 * One video over the list's window, opened from the list, with a link back to the same view of it,
 * and links to the previous and next video of that list (`useListPages`). It reads again when the
 * saved currency changes, and only once every save made so far has settled, so revenue never comes
 * back in the currency before the change. With no channel yet, while the channels are read, it
 * holds the screen's place and reads nothing.
 */
export function VideoDetail({
  channel,
  video,
  route,
  navigate,
  onGiveRevenueConsent,
}: {
  channel: ListedChannel | null
  video: string
  route: Route
  navigate: Navigate
  /** Opens the revenue consent screen for the channel on view. */
  onGiveRevenueConsent: () => void
}) {
  const channelId = channel === null ? null : channel.id
  const [held, setView] = useState<VideoDetailView | null>(null)
  const view = viewOfVideo(held, video)
  const opened = useRef<string | null>(null)
  // The video a step is opening, whose arrival sends no `video_detail_opened`: the next open clears
  // it, so a later arrival by Back or Forward counts.
  const stepped = useRef<string | null>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const titled = useRef<string | null>(null)
  const { listRoute, pages, retry } = useListPages(channel, route, video)
  const screen = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  // The bar's height, for the video player that sticks under it (app.css).
  useEffect(() => {
    if (!screen.current || !bar.current) return
    return holdBarHeightOn(screen.current, bar.current, window.ResizeObserver)
  }, [])

  // Once each time a video's screen opens, not on each window, and not on a step. The ref outlives
  // StrictMode's second effect.
  useEffect(() => {
    if (opened.current === video || channelId === null) return
    opened.current = video
    const wasStepped = stepped.current === video
    stepped.current = null
    if (!wasStepped) track({ name: 'video_detail_opened' })
  }, [video, channelId])

  useViewInSavedCurrency(
    channelId === null ? null : () => readVideoDetail(channelId, video, route),
    setView,
    [channelId, video, route.window, route.range?.from, route.range?.to],
  )

  // The bar's bounds stay those of the channel's last landed detail while the next one is read.
  const [bounds, takeBounds] = useChannelBounds(channelId)
  useEffect(() => {
    if (view?.kind === 'detail' && channelId !== null) takeBounds(boundsOf(view.answer))
  }, [view, channelId, takeBounds])
  const reading = useRangeFallback(view, route, navigate) === null

  // A window or currency change reads the video again behind the placeholder, which holds the since
  // publish rows this answer showed, or only the awaiting answer's places for a video Google has
  // not processed.
  useEffect(() => {
    if (view?.kind !== 'detail') return
    rememberSincePublishOf([view.answer.video], view.answer.lastProcessedDay)
    rememberAwaitingProcessingOf([
      { id: view.answer.video.id, awaitingProcessing: view.answer.awaitingProcessing },
    ])
  }, [view])

  // Timed once the render of each landed detail commits; a refusal has no freshness to send.
  useEffect(() => screenShown('/app/videos/:id'), [])
  useEffect(() => {
    if (view?.kind !== 'detail') return
    answerShown('/app/videos/:id', view.answer.window, cacheOf(view.answer.fromCache))
  }, [view])

  // The link that opened the screen is gone with the list, or with a step the video before, so
  // focus moves to the video's title, once for each video: a window change leaves focus on the
  // window control.
  useEffect(() => {
    if (view?.kind !== 'detail' || titled.current === video) return
    titled.current = video
    title.current?.focus()
  }, [view, video])

  const stepper = (position: StepperPosition) => (
    <VideoStepper
      stepper={channelId === null ? null : stepperOf(video, listRoute.page, pages)}
      position={position}
      listRoute={listRoute}
      navigate={navigate}
      onStep={({ id }) => {
        stepped.current = id
      }}
      onRetry={retry}
      onGone={() => title.current?.focus()}
    />
  )

  return (
    <section className="video-detail" ref={screen}>
      {/* Outside the answer, in every state, so the control keeps its focus while the next window is read. */}
      <ControlsBar route={route} navigate={navigate} bounds={bounds} ref={bar} />
      <RouteLink route={routeToList(route)} navigate={navigate}>
        Back to videos
      </RouteLink>
      <LoadingStatus text={reading ? loadingText.video : null} />
      {view?.kind === 'refused' ? (
        <p role="alert">{view.message}</p>
      ) : (
        (reading || view?.kind === 'detail') && (
          <VideoDetailScreen
            video={video}
            answer={view?.kind === 'detail' ? view.answer : null}
            headRow={headRowOf(pages, video)}
            stepper={stepper}
            title={title}
            route={route}
            navigate={navigate}
            onGiveRevenueConsent={onGiveRevenueConsent}
          />
        )
      )}
    </section>
  )
}
