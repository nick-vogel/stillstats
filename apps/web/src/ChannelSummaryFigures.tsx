import type {
  ChannelSummaryAnswer,
  ListedChannel,
  SummaryRequest,
} from '@creator-analytics/api-types'
import { useState } from 'react'
import { readAnswer } from './api.ts'
import { Cards } from './Cards.tsx'
import { useCanUpgrade } from './can-upgrade.ts'
import {
  type SummaryView,
  summaryQueryOf,
  summaryRequestOf,
  summaryShownFor,
  summaryViewOf,
} from './channel-summary.ts'
import { endedText } from './history.ts'
import { LaunchChart } from './LaunchChart.tsx'
import { loadingText } from './loading.ts'
import { MetricCharts, useChartChoice } from './MetricCharts.tsx'
import {
  AfterPublishPlaceholder,
  CardsPlaceholder,
  LoadingStatus,
  MetricChartsPlaceholder,
} from './Placeholder.tsx'
import { PublishDayTop } from './PublishDayTop.tsx'
import {
  rpmAdsAndPremiumOnlyOf,
  usePreferences,
  useViewInSavedCurrency,
  visibilityOf,
} from './preferences.ts'
import { delayNoteOf } from './processing.ts'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToSettings, useRangeFallback } from './route.ts'
import type { ListMark, SummaryPlaceList } from './video-list.ts'

/** The summary's view, its revenue card's RPM following the RPM switch (`adsAndPremiumOnly`). */
async function readSummary(
  channelId: string,
  query: SummaryRequest,
  adsAndPremiumOnly: boolean,
): Promise<SummaryView> {
  return summaryViewOf(
    await readAnswer<ChannelSummaryAnswer>(
      `/api/channels/${channelId}/summary?${summaryQueryOf(query)}`,
    ),
    undefined,
    { adsAndPremiumOnly },
  )
}

/**
 * The summary's cards, the note on the currency under them when revenue shows, the note on the
 * revenue tied to no format when there is any, the note on a paid channel's stored history, an
 * ended channel's note on its purge date, with the subscribe-again link to Settings for its owner,
 * and the charts, with the processed note under them.
 * On a screen too small to stack the charts, the cards choose the one that shows.
 */
function SummaryFiguresView({
  view,
  route,
  navigate,
  onGiveRevenueConsent,
}: {
  view: Extract<SummaryView, { kind: 'figures' }>
  route: Route
  navigate: Navigate
  onGiveRevenueConsent: () => void
}) {
  const { choice, shown } = useChartChoice(route, navigate, view.daily)
  const canUpgrade = useCanUpgrade()
  return (
    <>
      <Cards cards={view.cards} choice={choice} onGiveRevenueConsent={onGiveRevenueConsent} />
      {view.currencyNote && <p className="note">{view.currencyNote}</p>}
      {view.noFormatNote && <p className="note">{view.noFormatNote}</p>}
      {view.historyNote && <p className="note">{view.historyNote}</p>}
      {view.purgeNote && (
        <p className="note">
          {view.purgeNote}
          {/* The owner of an ended channel, which is free, alone may subscribe it again, on
              Settings' plan buttons. */}
          {canUpgrade && (
            <>
              {' '}
              <RouteLink route={routeToSettings(route)} navigate={navigate}>
                {endedText.subscribeAgain}
              </RouteLink>
            </>
          )}
        </p>
      )}
      <MetricCharts
        days={view.daily}
        total={view.total}
        route={route}
        navigate={navigate}
        note={delayNoteOf(view.lastProcessedDay)}
        shown={shown}
        uploads={view.uploads}
      />
    </>
  )
}

/** The summary's place while its read is in flight: its cards and its charts. */
function ChannelSummaryPlaceholder({ route }: { route: Route }) {
  return (
    <div className="placeholders" aria-busy="true">
      <CardsPlaceholder count={3} />
      <MetricChartsPlaceholder route={route} />
    </div>
  )
}

/**
 * The summary's place in a window after publish, drawn from the video list's answer, never a
 * summary: under "Publish day" the top by publish day engaged views, and under the other windows
 * the launch chart of the list's page, either with the processed note of the list's answer under
 * it. While the list is read, their placeholder; for a refused or
 * empty list, nothing, as the list says so itself. An answer of another channel or window than the
 * one on view is one the list is about to replace, so it holds the placeholder too. It hands the
 * launch chart the list's marked row (`markedVideoId`), which made the mark (`markedBy`), and
 * `onMark`, so the chart and its legend, the list, name one video.
 */
function AfterPublishPlace({
  channel,
  route,
  navigate,
  list,
  markedVideoId,
  markedBy,
  onMark,
}: {
  channel: ListedChannel | null
  route: Route
  navigate: Navigate
  list: SummaryPlaceList
  markedVideoId: string | null
  markedBy: ListMark['by'] | null
  onMark: (videoId: string | null) => void
}) {
  const { window } = route
  const channelId = channel === null ? null : channel.id
  if (list.kind === 'none' || summaryShownFor(window)) return null
  if (list.kind === 'reading' || list.channelId !== channelId || list.answer.window !== window) {
    return <AfterPublishPlaceholder route={route} channel={channel} />
  }
  if (window === 'first1') {
    return (
      <PublishDayTop
        videos={list.answer.publishDayTop ?? []}
        route={route}
        navigate={navigate}
        note={delayNoteOf(list.answer.lastProcessedDay)}
      />
    )
  }
  return (
    <LaunchChart
      videos={list.answer.videos}
      window={window}
      route={route}
      navigate={navigate}
      markedVideoId={markedVideoId}
      markedBy={markedBy}
      onMark={onMark}
      note={delayNoteOf(list.answer.lastProcessedDay)}
    />
  )
}

/**
 * YouTube's own totals for the channel over the route's window and format as cards, the note on the
 * currency under them when revenue shows, the note on the revenue tied to no format when there is
 * any, and its charts, with the processed note under them. In a window after publish it asks the API
 * for nothing, and in its place shows the launch chart or, under "Publish day", the top by publish
 * day engaged views, both from the video list's answer (`list`). The list's row marked
 * (`markedVideoId`) accents its line, and a line selected on the chart marks its row (`onMark`); the
 * chart shows its own selection only while the mark is the chart's (`markedBy`). It
 * reads again when the saved currency changes, and only once every save made so far has settled, so
 * revenue never comes back in the currency before the change. With no channel yet, while the
 * channels are read, it holds the summary's place and reads nothing.
 */
export function ChannelSummaryFigures({
  channel,
  route,
  navigate,
  onGiveRevenueConsent,
  list,
  markedVideoId,
  markedBy,
  onMark,
}: {
  channel: ListedChannel | null
  route: Route
  navigate: Navigate
  /** Opens the revenue consent screen for the channel on view. */
  onGiveRevenueConsent: () => void
  /** What the video list shows, which the summary's place draws in a window after publish. */
  list: SummaryPlaceList
  /** The video whose list row is hovered or whose line is selected, or null. */
  markedVideoId: string | null
  /** Which made the mark, a row hover or a line selected on the chart, or null with no mark. */
  markedBy: ListMark['by'] | null
  onMark: (videoId: string | null) => void
}) {
  const [view, setView] = useState<SummaryView | null>(null)
  const channelId = channel === null ? null : channel.id
  const { window, range, format } = route
  const { saved } = usePreferences()
  // The uploads follow the video list's visibility switch, so a change of it reads again.
  const visibility = visibilityOf(route, saved)
  const summary = summaryRequestOf(route, visibility)
  // The revenue card is built when the read lands, so a change of the RPM switch reads again.
  const adsAndPremiumOnly = rpmAdsAndPremiumOnlyOf(saved)
  useViewInSavedCurrency(
    summary && channelId !== null ? () => readSummary(channelId, summary, adsAndPremiumOnly) : null,
    setView,
    [channelId, window, range?.from, range?.to, format, visibility, adsAndPremiumOnly],
  )

  const landed = useRangeFallback(view, route, navigate)
  const shown = summary !== null
  return (
    <>
      <LoadingStatus text={shown && !landed ? loadingText.channel : null} />
      {!shown ? (
        <AfterPublishPlace
          channel={channel}
          route={route}
          navigate={navigate}
          list={list}
          markedVideoId={markedVideoId}
          markedBy={markedBy}
          onMark={onMark}
        />
      ) : !landed ? (
        <ChannelSummaryPlaceholder route={route} />
      ) : landed.kind === 'refused' ? (
        <p role="alert">{landed.message}</p>
      ) : (
        <SummaryFiguresView
          view={landed}
          route={route}
          navigate={navigate}
          onGiveRevenueConsent={onGiveRevenueConsent}
        />
      )}
    </>
  )
}
