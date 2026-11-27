import {
  type ChartCard,
  type ChartMode,
  chartCards,
  chartModes,
  customRangeOfDays,
  defaultVideoWindow,
  type FeedbackScreen,
  feedbackScreens,
  maxComparedCurves,
  type PageSize,
  type Preferences,
  pageSizes,
  type ReachTrafficSourceType,
  reachTrafficSourceTypes,
  type VideoFormatFilter,
  type VideoSort,
  type VideoSortKey,
  type VideoWindow,
  type Visibility,
  videoFormatFilters,
  videoSortKeys,
  videoWindows,
  visibilities,
  type WindowChoice,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefusedRangeView } from './refusals.ts'
import { changeStarted } from './screen-timing.ts'

/**
 * Where the creator is in the web app: the video list, a video's detail screen, Settings, the
 * Audience screen, the "What's new" screen or the feedback form, with the list's page, window, sort and format, and the charts' mode, the chart
 * card, the list's page size and its visibility when the address names them.
 * The path carries the screen and the query string the rest, so each screen has a URL. The detail
 * screen, Settings, the Audience screen and "What's new" keep the list's page and controls, so a link back
 * returns to the same view of the list. A custom range's days go under the query keys `from` and `to` after `window`. Only
 * the address carries them: they are never a preference.
 */
export type Route = WindowChoice & RouteControls

interface RouteControls {
  /** A whole number from 1. */
  page: number
  sort: VideoSort
  format: VideoFormatFilter
  /**
   * The charts' mode, on the channel summary and the detail screen alike. Absent: the saved
   * preference, then the default (`chartModeOf`). Present, it wins over both.
   */
  chart?: ChartMode
  /**
   * The card whose chart shows on a screen too small to stack the charts, under the query key
   * `card`. Absent: the saved preference, then the default (`chartCardOf`). Present, it wins over
   * both.
   */
  chartCard?: ChartCard
  /**
   * How many videos a page of the list shows. Absent: the saved preference, then the default
   * (`pageSizeOf`). Present, it wins over both.
   */
  pageSize?: PageSize
  /**
   * Which videos the list shows. Absent: the saved preference, then the default (`visibilityOf`).
   * Present, it wins over both.
   */
  visibility?: Visibility
  /**
   * The one traffic source the list's impressions and CTR count. Absent: every source. Only the
   * address carries it: it is never a preference.
   */
  trafficSource?: ReachTrafficSourceType
  /**
   * A whole number from 1: the list hides videos with fewer impressions. Absent: no minimum. Only
   * the address carries it: it is never a preference.
   */
  minImpressions?: number
  /**
   * The id of the channel the list is for. Absent: the creator's first channel. No product event
   * carries it: the page sends only its origin as a referrer, and the web app's OpenPanel client
   * tracks no screen view, so it sends no path.
   */
  channel?: string
  /** The YouTube id of the video whose detail screen is open, in the path. Absent: the list. */
  video?: string
  /** The video's sponsor report is open in its detail screen's place, in the path. Only with a video. */
  sponsorReport?: true
  /** The Settings screen is open, in the path. Never with a video. */
  settings?: true
  /** The Audience screen is open, in the path. Never with a video. */
  audience?: true
  /** The retention comparison is open, in the path. Never with a video. */
  retention?: true
  /**
   * On the Audience screen and the retention comparison only, the list's window when the screen's
   * is another, so the link back returns the list to it (creator-analytics#1049): under the query
   * key `listWindow`, a custom range's days under `listFrom` and `listTo`. Absent: the screen's own,
   * so an address written before it returns the list to the screen's window.
   */
  listWindow?: WindowChoice
  /**
   * On the retention comparison only, the videos picked to compare, in pick order, under the query
   * key `curves`, comma-separated: at most `maxComparedCurves`, each once. A malformed id, a repeat
   * and any past the limit are dropped. Absent: none picked.
   */
  curves?: string[]
  /** The "What's new" screen is open, in the path. Never with a video. */
  whatsNew?: true
  /** The upgrade screen is open, in the path. Never with a video. */
  upgrade?: true
  /**
   * The feedback form is open, in the path, and names the screen it was opened from, under the
   * query key `screen`: a name from the fixed set, never a path. Never with a video. `extension`
   * arrives only in the address the extension popup's "Send feedback" link opens, and is never a
   * screen the web app shows.
   */
  feedback?: FeedbackScreen
  /**
   * Nick's admin screen of the feedback messages is open, in the path. Nothing links to it, and
   * its page and filter live in the screen, not the address. Never with a video.
   */
  adminFeedback?: true
}

/**
 * The route with nothing chosen: the first page of the API's default window, the last 28 days,
 * newest first, every format.
 */
export const defaultRoute: RouteControls & { window: Exclude<VideoWindow, 'custom'> } = {
  page: 1,
  window: defaultVideoWindow,
  sort: '-publishedAt',
  format: 'all',
}

function isOneOf<T extends string>(list: readonly T[], text: string | null): text is T {
  return (list as readonly (string | null)[]).includes(text)
}

function oneOf<T extends string>(list: readonly T[], text: string | null, fallback: T): T {
  return isOneOf(list, text) ? text : fallback
}

export function isWindowAfterPublish(window: VideoWindow): boolean {
  return isOneOf(windowsAfterPublish, window)
}

/** Whether a window is a calendar window: the last 7, 28, 90 or 365 days, or a custom range. */
export function isCalendarWindow(window: VideoWindow): boolean {
  return window !== 'lifetime' && !isWindowAfterPublish(window)
}

/** Whether the list sorts by a key in a window. A window after publish has no average viewed. */
export function canSortBy(window: VideoWindow, key: VideoSortKey): boolean {
  return !(key === 'averageViewPercentage' && isWindowAfterPublish(window))
}

export function sortPartsOf(sort: string): { key: string; descending: boolean } {
  const descending = sort.startsWith('-')
  return { key: descending ? sort.slice(1) : sort, descending }
}

/** A sort the window cannot sort by, or one that is no sort at all, is newest first. */
function sortAllowedIn(window: VideoWindow, sort: string | null): VideoSort {
  const key = sort === null ? null : sortPartsOf(sort).key
  return isOneOf(videoSortKeys, key) && canSortBy(window, key)
    ? (sort as VideoSort)
    : defaultRoute.sort
}

/**
 * The window of a query string and its custom range. A custom range with a day missing or one
 * that does not parse, or that ends before it starts, falls back to the default window, as an
 * unknown window does. A start and an end with no custom window are dropped.
 */
function windowChoiceOf(query: URLSearchParams, keys = windowKeys): WindowChoice {
  const window = oneOf(videoWindows, query.get(keys.window), defaultRoute.window)
  if (window !== 'custom') return { window }
  const custom = customRangeOfDays(
    query.get(keys.from) ?? undefined,
    query.get(keys.to) ?? undefined,
  )
  return custom.ok ? { window, range: custom.range } : { window: defaultVideoWindow }
}

const windowKeys = { window: 'window', from: 'from', to: 'to' }
const listWindowKeys = { window: 'listWindow', from: 'listFrom', to: 'listTo' }

function windowChoiceOfRoute({ window, range }: Route): WindowChoice {
  return range ? { window, range } : { window }
}

function isSameWindow(a: WindowChoice, b: WindowChoice): boolean {
  return a.window === b.window && a.range?.from === b.range?.from && a.range?.to === b.range?.to
}

/** The route with the list's window kept beside its own, or none kept when the two are the same. */
function withListWindow(route: Route, list: WindowChoice): Route {
  const { listWindow: _listWindow, ...rest } = route
  return isSameWindow(windowChoiceOfRoute(rest), list) ? rest : { ...rest, listWindow: list }
}

/** A minimum of impressions as the address writes it: a whole number from 1, else none. */
function minImpressionsOfText(text: string | null): number | undefined {
  return text !== null && /^[1-9]\d*$/.test(text) ? Number(text) : undefined
}

/**
 * Reads the list's route from a query string. It names no video: only the path does (`routeOf`).
 * A value it does not know is its default: a page that is not a whole number from 1 is the first,
 * a bad custom range is the default window, a sort the window cannot sort by is newest first, and
 * an unknown traffic source or a minimum that is not a whole number from 1 is none.
 */
export function listRouteOf(search: string): Route {
  const query = new URLSearchParams(search)
  const page = query.get('page') ?? ''
  const windowChoice = windowChoiceOf(query)
  const { window } = windowChoice
  const channel = query.get('channel')
  const chart = query.get('chart')
  const chartCard = query.get('card')
  const pageSize = pageSizeOfText(query.get('pageSize'))
  const visibility = query.get('visibility')
  const trafficSource = query.get('trafficSource')
  const minImpressions = minImpressionsOfText(query.get('minImpressions'))
  return {
    page: /^[1-9]\d*$/.test(page) ? Number(page) : 1,
    ...windowChoice,
    sort: sortAllowedIn(window, query.get('sort')),
    format: oneOf(videoFormatFilters, query.get('format'), defaultRoute.format),
    ...(isOneOf(chartModes, chart) ? { chart } : {}),
    ...(isOneOf(chartCards, chartCard) ? { chartCard } : {}),
    ...(pageSize ? { pageSize } : {}),
    ...(isOneOf(visibilities, visibility) ? { visibility } : {}),
    ...(isOneOf(reachTrafficSourceTypes, trafficSource) ? { trafficSource } : {}),
    ...(minImpressions ? { minImpressions } : {}),
    ...(channel ? { channel } : {}),
  }
}

export function pageSizeOfText(text: string | null): PageSize | undefined {
  return pageSizes.find((size) => String(size) === text)
}

const videoPathPattern = /^videos\/([^/]+)(\/sponsor-report)?$/

/** The video a path names, and whether it names the video's sponsor report. */
function videoOf(path: string): Pick<Route, 'video' | 'sponsorReport'> | null {
  const [, segment, sponsorReport] = videoPathPattern.exec(path) ?? []
  if (!segment) return null
  try {
    return { video: decodeURIComponent(segment), ...(sponsorReport ? { sponsorReport: true } : {}) }
  } catch {
    return null
  }
}

/**
 * Reads the route from a path under the web app's base and a query string. A path that names
 * neither Settings, the Audience screen, the retention comparison, "What's new", the feedback
 * form, the admin feedback screen nor a video, or names a video in a malformed escape, is the list. The old profile path opens Settings too (creator-analytics#589),
 * since Stripe's Payment Link still returns to /app/profile: `readAddress` then writes back the
 * settings path with the route's query, replacing the entry, as it does for any address that
 * differs from the route's.
 */
export function routeOf(path: string, search: string): Route {
  const route = listRouteOf(search)
  if (path === 'settings' || path === 'profile') return { ...route, settings: true }
  if (path === 'whats-new') return { ...route, whatsNew: true }
  if (path === 'upgrade') return { ...route, upgrade: true }
  if (path === 'admin/feedback') return { ...route, adminFeedback: true }
  const query = new URLSearchParams(search)
  const list = query.has(listWindowKeys.window) ? windowChoiceOf(query, listWindowKeys) : null
  if (path === 'audience') return audienceRouteOf(route, list)
  if (path === 'retention') return retentionRouteOf(route, curvesOfText(query.get('curves')), list)
  if (path === 'feedback') {
    const screen = new URLSearchParams(search).get('screen')
    return { ...route, feedback: oneOf(feedbackScreens, screen, 'video_list') }
  }
  const video = videoOf(path)
  return video ? { ...route, ...video } : route
}

/**
 * The query string of a route, with each default of the list left out: empty for the default route
 * of the first channel, so /app/ stays the list's address. A chart mode, a chart card, a page
 * size and a visibility are written whenever the route has one, the default included, because a
 * value in the address wins over a saved one.
 */
export function searchOf(route: Route): string {
  const query = new URLSearchParams(route.channel ? { channel: route.channel } : {})
  for (const name of ['window', 'sort', 'format', 'page'] as const) {
    if (route[name] !== defaultRoute[name]) query.set(name, String(route[name]))
    if (name === 'window' && route.range) {
      query.set('from', route.range.from)
      query.set('to', route.range.to)
    }
  }
  if (route.trafficSource) query.set('trafficSource', route.trafficSource)
  if (route.minImpressions) query.set('minImpressions', String(route.minImpressions))
  if (route.chart) query.set('chart', route.chart)
  if (route.chartCard) query.set('card', route.chartCard)
  if (route.pageSize) query.set('pageSize', String(route.pageSize))
  if (route.visibility) query.set('visibility', route.visibility)
  if (route.listWindow) {
    query.set(listWindowKeys.window, route.listWindow.window)
    if (route.listWindow.range) {
      query.set(listWindowKeys.from, route.listWindow.range.from)
      query.set(listWindowKeys.to, route.listWindow.range.to)
    }
  }
  if (route.feedback && route.feedback !== 'video_list') query.set('screen', route.feedback)
  // Written by hand, so the ids' commas stay commas: an id holds only letters, digits, - and _.
  const curves = route.retention && route.curves?.length ? `curves=${route.curves.join(',')}` : ''
  const search = [query.toString(), curves].filter(Boolean).join('&')
  return search ? `?${search}` : ''
}

/**
 * The picks of the `curves` query value: each well formed id once, in order, up to
 * `maxComparedCurves`.
 */
function curvesOfText(text: string | null): string[] {
  const ids = (text ?? '').split(',').filter((id) => /^[A-Za-z0-9_-]+$/.test(id))
  return [...new Set(ids)].slice(0, maxComparedCurves)
}

export type ListControl =
  | WindowChoice
  | Pick<Route, 'sort'>
  | Pick<Route, 'format'>
  | Required<Pick<Route, 'pageSize'>>
  | Required<Pick<Route, 'visibility'>>
  | { trafficSource: ReachTrafficSourceType | undefined }
  | { minImpressions: number | undefined }

/**
 * The route after the creator switches off the column of this sort key: when the list is sorted by
 * it, in either direction, newest first from the first page, the rest as it was. Otherwise the
 * route itself.
 */
export function routeWithColumnOff(route: Route, key: VideoSortKey): Route {
  if (sortPartsOf(route.sort).key !== key) return route
  return { ...route, sort: defaultRoute.sort, page: 1 }
}

function controlsOf({ window: _window, range: _range, ...controls }: Route): RouteControls {
  return controls
}

/**
 * The route after the creator changes a control of the list: the first page, the other controls
 * as they were. A move to a window that cannot sort by the current key sorts newest first, and a
 * move to a window other than a custom range drops the range. A traffic source or a minimum of
 * undefined (All sources, or an empty field) drops its key. On the Audience screen or the retention
 * comparison, any change keeps the list's window as it was (`listWindow`).
 */
export function routeWithControl(route: Route, change: ListControl): Route {
  const { trafficSource, minImpressions, ...next } =
    'window' in change
      ? { ...controlsOf(route), ...change, page: 1 }
      : { ...route, ...change, page: 1 }
  const changed = {
    ...next,
    sort: sortAllowedIn(next.window, next.sort),
    ...(trafficSource ? { trafficSource } : {}),
    ...(minImpressions ? { minImpressions } : {}),
  }
  return route.audience || route.retention
    ? withListWindow(changed, route.listWindow ?? windowChoiceOfRoute(route))
    : changed
}

/**
 * The route after the creator changes the window on a video's detail screen. Unlike a change on
 * the list, the page stays, so the link back returns to the page the video was opened from; the
 * list moves a page past the last to the last. A sort the new window cannot sort by is newest first,
 * and a move to a window other than a custom range drops the range.
 */
export function routeWithDetailWindow(route: Route, choice: WindowChoice): Route {
  return { ...controlsOf(route), ...choice, sort: sortAllowedIn(choice.window, route.sort) }
}

/**
 * The route after the API refused the custom range in the address: the last 28 days with no range,
 * as a bad custom range the address itself shows falls back to. The list goes to its first page;
 * the detail screen keeps its page, as a window change there does. On the Audience screen, a list
 * that shares the refused range falls back with it.
 */
export function routeWithFallbackWindow(route: Route): Route {
  const fallback: WindowChoice = { window: defaultVideoWindow }
  if (route.video) return routeWithDetailWindow(route, fallback)
  if (!route.audience) return routeWithControl(route, fallback)
  return routeWithControl({ ...route, listWindow: route.listWindow ?? fallback }, fallback)
}

/**
 * Leaves a custom range the API refused for its bounds for the last 28 days
 * (`routeWithFallbackWindow`), in place of the address on view so Back does not return to it.
 */
export function fallBackFromRefusedRange(route: Route, navigate: Navigate): void {
  navigate(routeWithFallbackWindow(route), { replace: true })
}

function isLanded<V extends { kind: string }>(view: V): view is Exclude<V, RefusedRangeView> {
  return view.kind !== 'invalid-range'
}

/**
 * A screen's view once its read has landed: null while the read runs, and while the screen falls
 * back from a custom range the API refused for its bounds (`fallBackFromRefusedRange`).
 */
export function useRangeFallback<V extends { kind: string }>(
  view: V | null,
  route: Route,
  navigate: Navigate,
): Exclude<V, RefusedRangeView> | null {
  const refused = view?.kind === 'invalid-range'
  useEffect(() => {
    if (refused) fallBackFromRefusedRange(route, navigate)
  }, [refused, route, navigate])
  return view && isLanded(view) ? view : null
}

/**
 * The route after the creator changes the charts' mode. The page and the controls stay: the
 * mode changes only how the chart draws the same days.
 */
export function routeWithChartMode(route: Route, chart: ChartMode): Route {
  return { ...route, chart }
}

/**
 * The route after a card chooses the chart a screen too small to stack the charts shows. The page, the
 * chart mode and the controls stay.
 */
export function routeWithChartCard(route: Route, chartCard: ChartCard): Route {
  return { ...route, chartCard }
}

/** The address's name for each preference it can carry. */
const routeKeysOfPreferences = {
  chartMode: 'chart',
  chartCard: 'chartCard',
  pageSize: 'pageSize',
  visibility: 'visibility',
} as const satisfies Partial<Record<keyof Preferences, keyof Route>>

type PreferenceRouteKey = (typeof routeKeysOfPreferences)[keyof typeof routeKeysOfPreferences]

function routeWithout(route: Route, routeKey: PreferenceRouteKey): Route {
  const { [routeKey]: _dropped, ...rest } = route
  return rest
}

/**
 * The route after a reset of the preferences: every value a preference backs is dropped, so the
 * screens show the defaults the reset promises. The screen, page and list controls stay.
 */
export function routeWithoutPreferences(route: Route): Route {
  return Object.values(routeKeysOfPreferences).reduce(routeWithout, route)
}

/**
 * The route after the save of `change` failed: each value of the change the address still carries
 * is dropped, so the saved value shows again, as the address's value would win over it. A value
 * changed again since stays, as the later save carries it.
 */
export function routeAfterFailedSave(route: Route, change: Preferences): Route {
  let after = route
  for (const [preference, routeKey] of Object.entries(routeKeysOfPreferences)) {
    const value = change[preference as keyof typeof routeKeysOfPreferences]
    if (value !== undefined && after[routeKey] === value) after = routeWithout(after, routeKey)
  }
  return after
}

/**
 * Puts the address back after the save of `change` failed (`routeAfterFailedSave`), and settles it
 * on the route the screen will read with the change gone (`routeTheScreenReads`), in place of the
 * address on view so Back does not return to the value that failed. Answers the address the failed
 * save's notice shows on, which the screen then leaves as it is. `routeTheScreenReads` is passed
 * in, as the list's rule lives in a module that imports this one.
 */
export function revertAddressAfterFailedSave(
  onView: Route,
  change: Preferences,
  navigate: Navigate,
  routeTheScreenReads: (route: Route) => Route,
): string {
  const reverted = routeTheScreenReads(routeAfterFailedSave(onView, change))
  if (reverted !== onView) navigate(reverted, { replace: true })
  return addressOf(reverted)
}

function pathOf(route: Route): string {
  if (route.settings) return 'settings'
  if (route.audience) return 'audience'
  if (route.retention) return 'retention'
  if (route.whatsNew) return 'whats-new'
  if (route.upgrade) return 'upgrade'
  if (route.feedback) return 'feedback'
  if (route.adminFeedback) return 'admin/feedback'
  if (!route.video) return ''
  const videoPath = `videos/${encodeURIComponent(route.video)}`
  return route.sponsorReport ? `${videoPath}/sponsor-report` : videoPath
}

/** A route's address under the web app's base: the screen's path, if any, then the query string. */
export function addressOf(route: Route): string {
  return `${pathOf(route)}${searchOf(route)}`
}

/** Whether a link to `target` leads to the route already on view: the two share an address. */
export function isRouteOnView(target: Route, current: Route): boolean {
  return addressOf(target) === addressOf(current)
}

export function hrefOf(route: Route): string {
  return `${import.meta.env.BASE_URL}${addressOf(route)}`
}

export function routeToVideo(route: Route, video: string): Route {
  return { ...routeToList(route), video }
}

/** A video's sponsor report, keeping the list's route, so "Back to video" returns to the same view. */
export function routeToSponsorReport(route: Route, video: string): Route {
  return { ...routeToVideo(route, video), sponsorReport: true }
}

/**
 * The list a detail screen, Settings, the Audience screen, "What's new", the feedback form or the
 * admin feedback screen was opened from, on
 * the same channel, window, sort, format, page, chart mode, chart card, page size and visibility.
 * The list's own window, kept by the Audience screen or the retention comparison when the screen's
 * is another (`listWindow`), comes back, and a sort it cannot sort by is newest first.
 */
export function routeToList({
  video: _video,
  sponsorReport: _sponsorReport,
  settings: _settings,
  audience: _audience,
  retention: _retention,
  curves: _curves,
  whatsNew: _whatsNew,
  upgrade: _upgrade,
  feedback: _feedback,
  adminFeedback: _adminFeedback,
  listWindow,
  ...route
}: Route): Route {
  if (!listWindow) return route
  return { ...controlsOf(route), ...listWindow, sort: sortAllowedIn(listWindow.window, route.sort) }
}

/**
 * The Audience screen on a list route. It offers calendar windows only, so lifetime and a window
 * after publish move to the last 28 days, as a window change on the list does (`routeWithControl`),
 * and the list's window waits in `listWindow`.
 */
function audienceRouteOf(list: Route, listWindow: WindowChoice | null): Route {
  const route = isCalendarWindow(list.window)
    ? list
    : routeWithControl(list, { window: defaultVideoWindow })
  return withListWindow({ ...route, audience: true }, listWindow ?? windowChoiceOfRoute(route))
}

/**
 * The Audience screen, keeping the list's route and its window, so the "Videos" link returns to
 * the same view. On the Audience screen, the screen as it is, with the window chosen there.
 */
export function routeToAudience(route: Route): Route {
  if (route.audience) return route
  const list = routeToList(route)
  return audienceRouteOf(list, windowChoiceOfRoute(list))
}

/**
 * The retention comparison on a list route, with its picks, if any. The picker reads the videos'
 * lifetime numbers, the window the stored curves cover, so the route's window is lifetime, as the
 * Audience screen's is a calendar window: from another window it moves there as a window change on
 * the list does (`routeWithControl`), the list's window waiting in `listWindow`, and its sort can be
 * average viewed in either direction.
 */
function retentionRouteOf(list: Route, curves: string[], listWindow: WindowChoice | null): Route {
  const route = list.window === 'lifetime' ? list : routeWithControl(list, { window: 'lifetime' })
  return withListWindow(
    { ...route, retention: true, ...(curves.length > 0 ? { curves } : {}) },
    listWindow ?? windowChoiceOfRoute(route),
  )
}

/**
 * The retention comparison with nothing picked, keeping the list's route and its window
 * (`retentionRouteOf`), so the "Videos" link returns to the list's window, sort and format.
 */
export function routeToRetention(route: Route): Route {
  const list = routeToList(route)
  return retentionRouteOf(list, [], windowChoiceOfRoute(list))
}

/** The retention comparison with these picks, the rest of its route kept. */
export function routeWithCurves(route: Route, curves: readonly string[]): Route {
  const { curves: _curves, ...rest } = route
  return curves.length > 0 ? { ...rest, curves: [...curves] } : rest
}

/** Settings, keeping the list's route, so the wordmark returns to the same view of the list. */
export function routeToSettings(route: Route): Route {
  return { ...routeToList(route), settings: true }
}

/** "What's new", keeping the list's route, so the "Videos" link returns to the same view. */
export function routeToWhatsNew(route: Route): Route {
  return { ...routeToList(route), whatsNew: true }
}

/** The upgrade screen, keeping the list's route, so the "Videos" link returns to the same view. */
export function routeToUpgrade(route: Route): Route {
  return { ...routeToList(route), upgrade: true }
}

/** The name of the screen a route shows, as a feedback message carries it. */
function feedbackScreenOf(route: Route): FeedbackScreen {
  if (route.feedback) return route.feedback
  if (route.video) return 'video_detail'
  if (route.audience) return 'audience'
  if (route.settings) return 'settings'
  if (route.whatsNew) return 'whats_new'
  return 'video_list'
}

/**
 * The feedback form, naming the screen on view, and keeping the list's route, so the "Videos" link
 * returns to the same view. From the form itself, the screen it was opened from.
 */
export function routeToFeedback(route: Route): Route {
  return { ...routeToList(route), feedback: feedbackScreenOf(route) }
}

/** The route on the list's pages: past the last page, the last page. A list with no pages stays. */
export function routeWithin(route: Route, pageCount: number): Route {
  return pageCount > 0 && route.page > pageCount ? { ...route, page: pageCount } : route
}

/**
 * The route in the address bar, read from its path under the web app's base and its query string.
 * A value the list reads as its default is written back as the default, a value it does not know
 * is dropped, and a path that names no screen is written back as the list, replacing the
 * entry, so the address names the screen on view.
 */
function readAddress(): Route {
  const { pathname, search } = window.location
  const base = import.meta.env.BASE_URL
  const route = routeOf(pathname.startsWith(base) ? pathname.slice(base.length) : '', search)
  if (hrefOf(route) !== `${pathname}${search}`) {
    window.history.replaceState(null, '', hrefOf(route))
  }
  return route
}

export type Navigate = (route: Route, options?: { replace?: boolean }) => void

/**
 * How a move from the route on view to the next one changes the history. A move adds an entry, so
 * the back and forward buttons move between routes; a move with `replace`, or to the route already
 * on view, takes the current entry's place instead, so Back never shows the same screen again.
 */
export function historyMoveOf(
  current: Route,
  next: Route,
  { replace = false }: { replace?: boolean } = {},
): 'push' | 'replace' {
  return replace || isRouteOnView(next, current) ? 'replace' : 'push'
}

/**
 * The route in the address bar, and a way to move to another one (`historyMoveOf`). A move, and
 * Back or Forward, starts the screen timing's wait for its answer (`changeStarted`); a move with
 * `replace` is the app correcting the address, not an input, and starts none.
 */
export function useRoute(): [Route, Navigate] {
  const [route, setRoute] = useState(readAddress)
  const shown = useRef(route)

  useEffect(() => {
    const followHistory = () => {
      const next = readAddress()
      changeStarted(shown.current, next)
      shown.current = next
      setRoute(next)
    }
    window.addEventListener('popstate', followHistory)
    return () => window.removeEventListener('popstate', followHistory)
  }, [])

  const navigate = useCallback<Navigate>((next, options) => {
    if (!options?.replace) changeStarted(shown.current, next)
    if (historyMoveOf(shown.current, next, options) === 'replace') {
      window.history.replaceState(null, '', hrefOf(next))
    } else {
      window.history.pushState(null, '', hrefOf(next))
    }
    shown.current = next
    setRoute(next)
  }, [])

  return [route, navigate]
}
