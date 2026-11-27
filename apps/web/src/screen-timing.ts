import type { VideoWindow } from '@creator-analytics/api-types'
import { track } from './analytics.ts'
import type { ProductEvent } from './landing.ts'
import type { Route } from './route.ts'

/**
 * A screen with a speed budget (creator-analytics#1037), named by its route template, never its
 * address: the channel screen, a video's detail, Audience and the retention comparison.
 */
export type BudgetScreen = '/app/' | '/app/videos/:id' | '/app/audience' | '/app/retention'

/** The list's filters, by their route key, as an `answer_shown` event names the one that changed. */
export type ListFilter = 'format' | 'visibility' | 'trafficSource' | 'minImpressions'

/** What started the wait for an answer: an open of the screen, or a change of one of its controls. */
export type AnswerTrigger = 'load' | 'filter' | 'sort' | 'page' | 'window'

/**
 * Where an answer came from: the API's cache (`hit`) or Google (`miss`), the words #1051's
 * `Server-Timing` uses, or the stored curves the retention comparison reads (`stored`).
 */
export type AnswerCache = 'hit' | 'miss' | 'stored'

export type ScreenChange =
  | { trigger: Exclude<AnswerTrigger, 'filter'> }
  | {
      trigger: 'filter'
      filter: ListFilter
    }

/** The budget screen a route shows, or null for a screen with no budget, the sponsor report included. */
export function budgetScreenOf(route: Route): BudgetScreen | null {
  if (route.settings || route.whatsNew || route.upgrade || route.feedback || route.adminFeedback) {
    return null
  }
  if (route.audience) return '/app/audience'
  if (route.retention) return '/app/retention'
  if (route.video) return route.sponsorReport ? null : '/app/videos/:id'
  return '/app/'
}

const listFilters: readonly ListFilter[] = [
  'format',
  'visibility',
  'trafficSource',
  'minImpressions',
]

/**
 * The change a move from `previous` to `next` makes, or null when it starts no wait to measure. A
 * move to another screen, video or channel is a load. On one screen, a window, a sort, a filter, or
 * a page or a page size, in that order when one move changes several, since every control change
 * also takes the list to its first page. A move to a screen with no budget, and any other change,
 * such as the chart mode, the chart card or the picks, is none.
 */
export function changeOf(previous: Route, next: Route): ScreenChange | null {
  const screen = budgetScreenOf(next)
  if (screen === null) return null
  if (
    budgetScreenOf(previous) !== screen ||
    previous.video !== next.video ||
    previous.channel !== next.channel
  ) {
    return { trigger: 'load' }
  }
  if (
    previous.window !== next.window ||
    previous.range?.from !== next.range?.from ||
    previous.range?.to !== next.range?.to
  ) {
    return { trigger: 'window' }
  }
  if (previous.sort !== next.sort) return { trigger: 'sort' }
  const filter = listFilters.find((name) => previous[name] !== next[name])
  if (filter) return { trigger: 'filter', filter }
  if (previous.page !== next.page || previous.pageSize !== next.pageSize) return { trigger: 'page' }
  return null
}

export function cacheOf(fromCache: boolean): 'hit' | 'miss' {
  return fromCache ? 'hit' : 'miss'
}

/**
 * The INP of a screen view's interactions, each its longest event's duration: the worst, skipping
 * one per 50 interactions, as web.dev's INP definition does. Null with no interaction.
 */
export function inpOf(durations: readonly number[]): number | null {
  const worstFirst = [...durations].sort((a, b) => b - a)
  const skipped = Math.min(Math.floor(durations.length / 50), worstFirst.length - 1)
  return worstFirst[skipped] ?? null
}

export type WebVitalEvent = Extract<ProductEvent, { name: 'web_vital' }>

export type AnswerShownEvent = Extract<ProductEvent, { name: 'answer_shown' }>

/** A web vital event of its fixed keys alone, so no other property can ride along. */
export function webVitalEvent({
  metric,
  value,
  screen,
  beforeScreen,
}: Omit<WebVitalEvent, 'name'>): WebVitalEvent {
  return {
    name: 'web_vital',
    metric,
    value: Math.round(value),
    screen,
    ...(beforeScreen === true ? { beforeScreen } : {}),
  }
}

/** An answer shown event of its fixed keys alone, so no other property can ride along. */
export function answerShownEvent({
  screen,
  trigger,
  filter,
  window,
  cache,
  ms,
}: Omit<AnswerShownEvent, 'name'>): AnswerShownEvent {
  return {
    name: 'answer_shown',
    screen,
    trigger,
    ...(trigger === 'filter' && filter ? { filter } : {}),
    window,
    cache,
    ms: Math.round(ms),
  }
}

/** The performance entry types the timing reads. */
export type ScreenTimingEntryType = 'largest-contentful-paint' | 'event' | 'first-input'

/** The part of a performance entry the timing reads. */
export interface ScreenTimingEntry {
  startTime: number
  duration: number
  /** An event's interaction, or 0 for an event that is none, such as a hover. */
  interactionId?: number
}

/**
 * Observes the entries of one type, the ones the browser buffered before it included, and answers
 * how to stop. `main.tsx` builds it from `PerformanceObserver`.
 */
export type ObserveEntries = (
  type: ScreenTimingEntryType,
  onEntries: (entries: ScreenTimingEntry[]) => void,
) => () => void

export interface ScreenTimingBrowser {
  /** The time since navigation start, as `performance.now` answers it. */
  now: () => number
  observe: ObserveEntries
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
}

interface PendingChange {
  screen: BudgetScreen
  trigger: AnswerTrigger
  filter?: ListFilter
  start: number
}

/**
 * A stretch on one screen, from `start`, and its interactions' longest durations by ID. `sent`
 * once its INP has gone: a view sends one INP, at the first hide that has one, as the page may
 * never show again, and a return to the page keeps the view.
 */
interface ScreenView {
  screen: BudgetScreen | null | undefined
  start: number
  interactions: Map<number, number>
  sent: boolean
}

interface Timing {
  now: () => number
  /** The change waiting on its answer, if any. */
  pending: PendingChange | null
  /** The page's first answer is still to be shown, with no change started before it. */
  loadOpen: boolean
  /** The screen view the interactions count for, undefined before the first screen shows. */
  view: ScreenView
  /**
   * The view before it, its INP held back: the browser reports the input that left it only once
   * the next screen has painted, so that entry comes after the move and counts by its start time.
   */
  left: ScreenView | null
  lcp: {
    /**
     * The screen the LCP is sent for: null for a page loaded on a route with no budget, undefined
     * until a screen shows or a move names it.
     */
    screen: BudgetScreen | null | undefined
    /** The budget screen the page loaded on, set by the first move before any screen shows. */
    loadedOn: BudgetScreen | undefined
    candidate: number | null
    /**
     * When the first input, hide or move came before any screen showed: the browser stopped finding
     * candidates then, and the screen had not painted, so its LCP is at least this.
     */
    endedAt: number | null
    sent: boolean
  }
}

let timing: Timing | null = null

function sendInp(view: ScreenView): void {
  const { screen, interactions, sent } = view
  const inp = inpOf([...interactions.values()])
  if (sent || !screen || inp === null) return
  view.sent = true
  track(webVitalEvent({ metric: 'INP', value: inp, screen }))
}

/** Starts a view of `screen` from now, and sends the INP of the view left before the one it ends. */
function switchView(current: Timing, screen: BudgetScreen | null): void {
  if (current.left) sendInp(current.left)
  current.left = current.view
  current.view = { screen, start: current.now(), interactions: new Map(), sent: false }
}

/** The page is hidden: the views' INP go now, since the page may never show again. */
function endViews(current: Timing): void {
  if (current.left) sendInp(current.left)
  current.left = null
  sendInp(current.view)
}

/**
 * Sends the page's LCP, once: the browser stops finding candidates at the first input. An input,
 * hide or move that comes before any screen shows is held, and sent as a floor when a budget
 * screen shows.
 */
function endLcp(current: Timing): void {
  const { lcp } = current
  if (lcp.sent) return
  if (lcp.screen === undefined) {
    lcp.endedAt ??= current.now()
    return
  }
  lcp.sent = true
  if (!lcp.screen) return
  if (lcp.endedAt !== null) {
    track(
      webVitalEvent({ metric: 'LCP', value: lcp.endedAt, screen: lcp.screen, beforeScreen: true }),
    )
  } else if (lcp.candidate !== null) {
    track(webVitalEvent({ metric: 'LCP', value: lcp.candidate, screen: lcp.screen }))
  }
}

/**
 * Starts timing the budget screens, with the clock, the performance observers and the document
 * `main.tsx` hands it, and answers how to stop, for tests. LCP is read for the page load, of the
 * screen the page loaded on, and sent at the first input, when the page is hidden or when the
 * screen changes; one of these before the screen shows is sent as a floor once a budget screen
 * shows, and a page loaded on a screen with no budget, or in the background, sends none
 * (web.dev/articles/lcp). INP is read per screen view, from the event entries of 40ms or more and
 * the first input, each counted in the view it started in, and sent once a view, when the screen
 * changes again or the page is hidden (web.dev/articles/inp). Until it starts, `changeStarted`,
 * `answerShown` and `screenShown` do nothing, and every event goes through `track`, so nothing
 * leaves before OpenPanel starts.
 */
export function startScreenTiming({ now, observe, document }: ScreenTimingBrowser): () => void {
  const current: Timing = {
    now,
    pending: null,
    loadOpen: true,
    view: { screen: undefined, start: 0, interactions: new Map(), sent: false },
    left: null,
    lcp: {
      screen: undefined,
      loadedOn: undefined,
      candidate: null,
      endedAt: null,
      sent: document.visibilityState === 'hidden',
    },
  }
  timing = current
  const onInput = () => endLcp(current)
  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return
    endLcp(current)
    endViews(current)
  }
  const onInteractions = (entries: ScreenTimingEntry[]) => {
    for (const { interactionId, duration, startTime } of entries) {
      if (!interactionId) continue
      const { view, left } = current
      const counted = startTime >= view.start ? view : left && startTime >= left.start ? left : null
      if (!counted) continue
      const { interactions } = counted
      interactions.set(interactionId, Math.max(interactions.get(interactionId) ?? 0, duration))
    }
  }
  const stops = [
    observe('largest-contentful-paint', (entries) => {
      const last = entries.at(-1)
      if (last && !current.lcp.sent && current.lcp.endedAt === null)
        current.lcp.candidate = last.startTime
    }),
    observe('event', onInteractions),
    observe('first-input', onInteractions),
  ]
  const listen = { capture: true, passive: true }
  document.addEventListener('pointerdown', onInput, listen)
  document.addEventListener('keydown', onInput, listen)
  document.addEventListener('visibilitychange', onVisibility, listen)
  return () => {
    for (const stopObserving of stops) stopObserving()
    document.removeEventListener('pointerdown', onInput, listen)
    document.removeEventListener('keydown', onInput, listen)
    document.removeEventListener('visibilitychange', onVisibility, listen)
    if (timing === current) timing = null
  }
}

/**
 * The creator moved from `previous` to `next`, by a control, a link, Back or Forward: the page's
 * LCP is done, or, before any screen shows, held as a floor for the screen the page loaded on, a
 * move to another screen ends the screen view, and the change, if it starts a wait (`changeOf`),
 * waits on its answer from now. A move that starts none drops the change waiting.
 */
export function changeStarted(previous: Route, next: Route): void {
  if (!timing) return
  if (timing.lcp.screen === undefined && timing.lcp.loadedOn === undefined) {
    const loadedOn = budgetScreenOf(previous)
    if (loadedOn === null) timing.lcp.screen = null
    else timing.lcp.loadedOn = loadedOn
  }
  endLcp(timing)
  const screen = budgetScreenOf(next)
  if (timing.view.screen !== screen) switchView(timing, screen)
  const change = changeOf(previous, next)
  if (!change || !screen) {
    timing.pending = null
    return
  }
  timing.loadOpen = false
  timing.pending = { screen, ...change, start: timing.now() }
}

/** Which waits an answer ends: any, a load only, or a change only. */
export type AnswerMeasures = 'any' | 'load' | 'change'

/**
 * `screen` rendered an answer of `window` from `cache`: it ends the change waiting on this screen,
 * or, as the page's first answer with no change before it, the page load, from navigation start, so
 * the startup chain counts. Any other answer, such as a read again after a currency change, sends
 * nothing. `measures` keeps a screen that renders two answers from ending the other's wait.
 */
export function answerShown(
  screen: BudgetScreen,
  window: VideoWindow,
  cache: AnswerCache,
  measures: AnswerMeasures = 'any',
): void {
  if (!timing) return
  const { pending } = timing
  if (pending) {
    if (pending.screen !== screen) return
    if (measures === (pending.trigger === 'load' ? 'change' : 'load')) return
    timing.pending = null
    timing.loadOpen = false
    const { trigger, filter, start } = pending
    const ms = timing.now() - start
    track(answerShownEvent({ screen, trigger, ...(filter ? { filter } : {}), window, cache, ms }))
    return
  }
  if (!timing.loadOpen || measures === 'change') return
  timing.loadOpen = false
  track(answerShownEvent({ screen, trigger: 'load', window, cache, ms: timing.now() }))
}

/**
 * `screen` is on view: the first screen shown names the page's LCP, unless a move before it
 * already named the screen the page loaded on, and another screen than the view's ends the view and
 * starts its own.
 */
export function screenShown(screen: BudgetScreen): void {
  if (!timing) return
  if (timing.lcp.screen === undefined) {
    timing.lcp.screen = timing.lcp.loadedOn ?? screen
    if (timing.lcp.endedAt !== null) endLcp(timing)
  }
  if (timing.view.screen !== screen) switchView(timing, screen)
}
