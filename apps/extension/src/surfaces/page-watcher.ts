import type { ExtensionSurface } from '@creator-analytics/api-types'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, SurfaceEvent } from '../messages.ts'
import type { VideosQuery, VideosRead } from '../product-api.ts'
import { type LineClicks, sendOnce } from './line-clicks.ts'
import { removeSurface } from './render.ts'

/**
 * What placing a surface found: the page's element was not there (yet), or the surface is on the
 * page, showing the extension's numbers or only a line such as the sign-in prompt. `unsettled` is
 * a surface whose page element still shows what an earlier navigation's answer stands on: the page
 * may yet redraw it for this navigation, so only this navigation's settled pass can say whether it
 * is shown or missing.
 */
export type Placement = 'not-found' | 'unsettled' | 'placed' | 'shown'

/**
 * A shown placement as a surface's `place` answers it: with `fromCache`, true only when every answer
 * its figure was drawn from came from the API's cache or the background's 30-second keep, which
 * `extension_surface_shown` carries.
 */
export interface Shown {
  placement: 'shown'
  fromCache: boolean
}

/**
 * What a surface's `place` answers when the page navigated while its read was out, so it drew
 * nothing: with `fromCache`, that read's cache result. A pass ahead of WXT's report hands it to the
 * navigation's own pass, which may draw from the background's keep of that read: see `ReadAhead`.
 */
export interface Cut {
  placement: 'cut'
  fromCache: boolean
}

/**
 * What a surface's `place` answers when its read landed but the page redrew the element it places
 * by, so it drew nothing: with `fromCache`, that read's cache result, and with `counts`, the
 * placement the missing and give-up judgments read it as. A later pass of the same navigation that
 * shows the figure is timed from the pass that first answered this, or, when a pass ahead of WXT's
 * report showed the figure or was cut short reading it, with that pass's whole time or from its
 * start: see `watchPage`.
 */
export interface Redrawn {
  placement: 'redrawn'
  fromCache: boolean
  counts: 'placed' | 'not-found'
}

/**
 * What a surface's `place` answers: any placement but shown, shown with its cache result, a read
 * the page's navigation cut short, with its own, or a read whose element the page redrew.
 */
export type PlaceAnswer = Exclude<Placement, 'shown'> | Shown | Cut | Redrawn

export const shownFrom = (fromCache: boolean): Shown => ({ placement: 'shown', fromCache })

export const cutFrom = (fromCache: boolean): Cut => ({ placement: 'cut', fromCache })

export const redrawnFrom = (fromCache: boolean, counts: Redrawn['counts']): Redrawn => ({
  placement: 'redrawn',
  fromCache,
  counts,
})

/**
 * The placement an answer of `place` stands for. A cut read drew nothing, so it found nothing; a
 * redrawn one stands for what it counts as.
 */
export const placementOf = (answer: PlaceAnswer): Placement =>
  typeof answer === 'string'
    ? answer
    : answer.placement === 'cut'
      ? 'not-found'
      : answer.placement === 'redrawn'
        ? answer.counts
        : answer.placement

export interface Surface {
  name: ExtensionSurface
  /**
   * True on the page that carries this surface. Off it, once the URL is the one WXT reported, the
   * watch takes the surface's elements down.
   */
  isOn(url: string): boolean
  /**
   * Takes down at once what the page no longer stands for, outside the pass lock: a pass may be
   * awaiting a read, and the page may change meanwhile. Runs on each scheduled tick, before
   * the pass that tick starts, on every page; the give-up's pass and a pass asked for during
   * another run have no sweep before them. It must be synchronous and cheap. It may count the ticks
   * that find the page one way, for a judgment that takes a second look; `passAgain` asks for one
   * more tick within `passEveryMs`, since while a pass awaits a read nothing else may. A sweep that
   * throws is skipped and the pass still runs.
   */
  sweep?(document: Document, passAgain: () => void): void
  /**
   * Whether the page at `url` holds the element `place` places the surface by, as `place` finds it:
   * synchronous, cheap, and with no effect on the page or the surface. The watch asks it at each
   * pass asked for, until it first answers true in a navigation, so a surface is timed from when its
   * element came, not from when a pass that the lock held back behind another's read was due. A
   * surface without it is timed from when its pass was due.
   */
  found?(document: Document, url: string): boolean
  /**
   * Places the surface, or keeps it placed. Called again on every pass, so it must be idempotent.
   * `navigation` counts the page's in-page navigations, a change of sort, filter or tab among them,
   * and is the next one's count on a URL WXT has not reported yet, when `ahead` is true. WXT may
   * never report that URL (the page left it between two of WXT's polls), so a later navigation that
   * gets the same count is not the one an ahead answer was read for. A navigation the page is handed
   * back to after a drop carries its own count again.
   * `settled` is true from the pass the give-up timer runs for this navigation: the page has had
   * `giveUpAfterMs` to draw it, so what is on the page then is what the navigation shows. `current`
   * is false once the page has navigated again, so a read that lands after the creator changed what
   * the page shows is not drawn. `passAgain` asks for one more pass within `passEveryMs`, for a
   * surface that can judge the page only by a second look and so cannot wait on the page changing
   * it. A shown answer says whether its figure was drawn from the cache: see `Shown`. A read that
   * lands once `current` is false answers `Cut` with that read's cache result.
   */
  place(page: {
    document: Document
    url: string
    navigation: number
    ahead: boolean
    settled: boolean
    current(): boolean
    passAgain(): void
  }): Promise<PlaceAnswer>
}

/** What every surface is made with. */
export interface SurfaceOptions {
  ask: AskBackground
  /** The Stillstats origin a line links to. The access line links nothing. */
  origin: string
  /** Undefined takes the browser's locale. */
  locale: string | undefined
  /** The Studio tab's one holder of the lines' clicks, which every surface's read releases. */
  lineClicks: LineClicks
}

/**
 * The page draws its elements after it loads (Studio's cards among them), so a surface not found
 * yet is told from one that will never come only by time. A channel with no uploads has no latest
 * video card, and is reported missing too. It is also the settle time: once it passes, the watch
 * runs one more pass with `settled` true, and a surface reports missing only if that pass finds
 * nothing either.
 */
export const giveUpAfterMs = 5_000

/**
 * Whether a surface keeps what it placed `at` rather than asking again. A line (sign in, connect,
 * reconnect, try again, allow access) is kept `signedInReadKeptMs`: the creator acts on it in
 * another tab or in the browser and comes back to Studio, which keeps its page as it was, so only
 * time tells a surface to look again. A shown answer is kept for as long as what it was read for
 * stands: on the card, its Views row; on the Content list, the page's channel and rows, carried into
 * the next navigation until that one settles (one read ahead of WXT's report only a line's time,
 * until a pass of that navigation reuses it); on the analytics page, its key metric header, video
 * and period, and, for a shown figure, the Views number row. A card figure whose comparison row
 * could not be read is kept as a line, so both are asked again.
 */
export function isKept({ placement, at }: { placement: Placement; at: number }): boolean {
  return placement === 'shown' || Date.now() - at < signedInReadKeptMs
}

/**
 * A surface's read of videos from the background. A request the background never answers (it
 * restarted, or the extension was updated) is a failed read: the surface was found, so it is not
 * reported missing. Every read goes to `lineClicks`, so a sign-in click held on any surface is sent
 * by whichever surface reads next once the creator is signed in.
 */
export async function readVideosAndSendHeldClicks(
  { ask, lineClicks }: Pick<SurfaceOptions, 'ask' | 'lineClicks'>,
  query: VideosQuery,
): Promise<VideosRead> {
  // Through `then`, so an ask that throws before it returns a promise is a failed read too.
  const read = await Promise.resolve()
    .then(() => ask({ type: 'read-videos', ...query }))
    .catch((): VideosRead => ({ state: 'failed' }))
  lineClicks.read(read)
  return read
}

/**
 * A pass runs at most this often while the page keeps mutating. A debounce that restarted on
 * every mutation would never run on a page that animates.
 */
export const passEveryMs = 250

/**
 * The watch's `report`: each surface event goes to the background as a `usage-event`. The content
 * script and the surface tests both send through this, so a test sees the request the page's
 * content script sends. An ask the background never answers, or one that throws before it returns
 * a promise, is swallowed and the event is lost, as a line click's is, so the watch's pass and
 * give-up go on.
 */
export function reportThrough(ask: AskBackground): (event: SurfaceEvent) => void {
  return (event) => sendOnce(ask, event)
}

/** What the watch records of one navigation, made afresh for each navigation the watch starts. */
function freshNavigation(url: string, reached: boolean, count: number) {
  return {
    /**
     * The count a surface's placement for this navigation carries. A navigation the page is handed
     * back to after a drop keeps its count, though the watch's own count moves past it.
     */
    count,
    /** The URL WXT reported. */
    url,
    /**
     * Whether the page's URL has been `url` since WXT reported it. Under the Navigation API WXT
     * reports a `navigate` before it commits, and one may never commit (cancelled, a download, a 204).
     */
    reached,
    /** Whether the give-up timer has fired. */
    settled: false,
    found: new Set<ExtensionSurface>(),
    shown: new Set<ExtensionSurface>(),
    /**
     * The start and cache result of each surface's first redrawn answer, which its figure, when a
     * later pass shows it, is timed from, or the time of a figure a pass ahead of WXT's report
     * showed before that answer. An answer between them that is neither redrawn nor shown ends it,
     * and so do a pass on another URL and a give-up that hands the navigation back.
     */
    redrawn: new Map<ExtensionSurface, ReadAhead>(),
    /** Surfaces reported missing, so a navigation taken back after a dropped one is not again. */
    missing: new Set<ExtensionSurface>(),
    unsettled: new Set<ExtensionSurface>(),
    /** Surfaces the settled pass tried, whatever it found. */
    triedSettled: new Set<ExtensionSurface>(),
  }
}

type Navigation = ReturnType<typeof freshNavigation>

/**
 * What passes ahead of WXT's report did for a surface of the navigation it reports next: the time
 * its figure took when one of them showed it, or the start of the one whose read the report cut
 * short before it drew, with that read's cache result. A start flagged `redrawn` is a redraw's,
 * still open: a later ahead answer folds into it, closes it or ends it, as `noteReadAhead` says. A
 * surface that reuses that read (a kept figure, an answer read ahead, a shared read, the
 * background's keep) shows at once on the navigation's own pass, so the report takes this time
 * instead, and a cut read's figure is from the cache only when that read and the own pass's answer
 * both were.
 */
type ReadAhead =
  | { ms: number; fromCache: boolean }
  | { since: number; fromCache: boolean; redrawn?: true }

/** A shown event's `ms`: whole milliseconds, never below 0 should the clock move back. */
const msFrom = (start: number, at: number): number => Math.max(0, Math.round(at - start))

/**
 * Follows the page's in-page navigations and its changes, places each surface on its page, and
 * takes a surface's elements down on a pass or a tick on any other page once WXT has reported the
 * move. The tick does it while a pass awaits a read; the pass does it too, since the give-up's pass
 * and a pass asked for during another run have no tick before them. Each surface event is reported
 * at most once per surface per navigation: the observer re-runs on every mutation, and the relay
 * allows 60 events per user per minute.
 */
export function watchPage({
  document,
  url,
  surfaces,
  report,
}: {
  document: Document
  url: () => string
  surfaces: Surface[]
  report: (event: SurfaceEvent) => void
}): { navigated(to: string): void; stop(): void } {
  let navigation = 0
  /**
   * The current navigation's record, set by `navigated`, or by `giveUp` when it drops one. Until
   * the watch's own first `navigated`, the page it starts on, which that call replaces.
   */
  let nav: Navigation = freshNavigation(url(), true, navigation)
  /**
   * The last navigation the page reached before it, which a dropped navigation hands the page back
   * to.
   */
  let previous: Navigation | undefined
  /**
   * The URL of a navigation dropped at its give-up, until WXT reports another. WXT already holds it
   * as its last URL, so if the page reaches it later WXT reports nothing and the watch starts it.
   */
  let dropped: string | undefined
  let passTimer: ReturnType<typeof setTimeout> | undefined
  let giveUpTimer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let again = false
  /**
   * When the pass to run next was first asked for, so a pass the lock holds back behind a slow
   * read is timed from when it was due. A navigation clears it, unless it was taken on the page the
   * navigation goes to: a pass asked for on the page it left was not due for the page it goes to.
   * So does a pass asked for or run once the URL has left `clockUrl`, as WXT may not have reported
   * the move yet.
   */
  let askedAt: number | undefined
  /**
   * When `found` first saw each surface's element in this navigation, at a pass asked for. A
   * navigation clears it, as it does `askedAt`, and so does a pass asked for or run once the URL
   * has left `clockUrl`.
   */
  let firstFound = new Map<ExtensionSurface, number>()
  /**
   * The URL `askedAt` and `firstFound` were taken on. WXT's 1 s poll, where a content script has
   * no Navigation API, reports a move up to a second after the URL made it, and a pass asked for on
   * the page the URL left, or a surface on both pages (the feed on the home page and the watch
   * page) seen there, says nothing of when the page it went to was due or drew its element.
   */
  let clockUrl = url()
  /**
   * What passes ahead of WXT's report did, per surface, for the navigation counted `count` on
   * `url`, which a navigation the watch then starts with that count and URL takes over. A pass on
   * another URL ends it, since the page it read ahead for is gone.
   */
  let readAhead: { url: string; count: number; surfaces: Map<ExtensionSurface, ReadAhead> } = {
    url: '',
    count: Number.NaN,
    surfaces: new Map(),
  }

  /**
   * One pass, due at `passStart`. A surface finds its element at the start of its place call, then
   * awaits its read, so the moment its pass is due is the first the extension would act on the
   * element: a shown event's `ms` runs from it to the moment its place answers shown, a wait behind
   * another surface's read in the same pass, or behind the pass before it, included. An element
   * that came after the pass was due is timed from when it came: from the pass asked for at which
   * `found` first saw it, or, unseen, from its place call. A surface's first placement on the
   * navigation's own pass takes over the time of a pass ahead of WXT's report for it, one the report
   * cut short before it reached the surface included: see `ReadAhead`.
   */
  async function placeAll(passStart: number): Promise<void> {
    const here = url()
    if (here === dropped) navigated(here)
    if (here === nav.url) nav.reached = true
    const navigationAtStart = navigation
    const { count } = nav
    const current = () => navigationAtStart === navigation
    // A pass on a URL WXT has not reported yet places for the navigation WXT reports next, so a
    // surface it draws stands as that navigation's answer, and that navigation reports it.
    const ahead = here !== nav.url
    // The page left the navigation's URL, so a redraw's start before the move times nothing after
    // it, should the URL come back before WXT reports a move.
    if (ahead) nav.redrawn.clear()
    if (readAhead.url !== '' && here !== readAhead.url)
      readAhead = { url: '', count: Number.NaN, surfaces: new Map() }
    const settledAtStart = nav.settled && !ahead
    // The map is replaced once the URL leaves this pass's page, by an ask on the page it went to or
    // by WXT's report, so this pass reads what was seen on its own page from here.
    const seen = firstFound
    for (const [index, surface] of surfaces.entries()) {
      if (!surface.isOn(here)) {
        if (!ahead) removeSurface(document, surface.name)
        continue
      }
      const calledAt = Date.now()
      const start = surface.found
        ? Math.max(passStart, seen.get(surface.name) ?? calledAt)
        : passStart
      const answer = await surface
        .place({
          document,
          url: here,
          navigation: ahead ? navigationAtStart + 1 : count,
          ahead,
          settled: settledAtStart,
          current,
          passAgain: schedulePass,
        })
        .catch((): PlaceAnswer => 'not-found')
      const shownAt = Date.now()
      if (ahead) noteReadAhead(surface.name, answer, navigationAtStart + 1, here, start, shownAt)
      if (!current()) {
        if (ahead)
          noteUnplacedAhead(surfaces.slice(index + 1), navigationAtStart + 1, here, passStart, seen)
        return
      }
      if (ahead) continue
      const takesOver = readAhead.count === nav.count && readAhead.url === nav.url
      const early = takesOver ? readAhead.surfaces.get(surface.name) : undefined
      if (takesOver) readAhead.surfaces.delete(surface.name)
      const placement = placementOf(answer)
      if (settledAtStart) nav.triedSettled.add(surface.name)
      if (placement === 'unsettled') nav.unsettled.add(surface.name)
      else if (placement !== 'not-found') nav.found.add(surface.name)
      if (
        typeof answer !== 'string' &&
        answer.placement === 'redrawn' &&
        !nav.shown.has(surface.name)
      ) {
        const tried = nav.redrawn.get(surface.name)
        if (tried) {
          if ('since' in tried) tried.fromCache &&= answer.fromCache
        } else
          nav.redrawn.set(
            surface.name,
            early && 'ms' in early
              ? early
              : {
                  since: early?.since ?? start,
                  fromCache: (early?.fromCache ?? true) && answer.fromCache,
                },
          )
      } else if (typeof answer === 'string') nav.redrawn.delete(surface.name)
      if (
        typeof answer !== 'string' &&
        answer.placement === 'shown' &&
        !nav.shown.has(surface.name)
      ) {
        nav.shown.add(surface.name)
        const before = nav.redrawn.get(surface.name) ?? early
        const timed =
          before && 'ms' in before
            ? before
            : {
                ms: msFrom(before?.since ?? start, shownAt),
                fromCache: (before?.fromCache ?? true) && answer.fromCache,
              }
        report({ name: 'extension_surface_shown', surface: surface.name, ...timed })
      }
    }
  }

  /**
   * Notes what an ahead pass that started at `start`, placing for navigation `count` on `url`, did
   * for `name`, while that navigation is still to come or is the one WXT has just reported: the
   * first figure one shows, or the start of the first whose read the report cut short, with that
   * read's cache result. A redrawn answer notes its start, flagged, as the own pass's record does:
   * a later redrawn answer folds its cache result in, a figure or a cut read closes it, and an
   * answer that is neither ends it. A line, or a surface not found, notes nothing otherwise, so a
   * figure after it is timed from its own pass.
   */
  function noteReadAhead(
    name: ExtensionSurface,
    answer: PlaceAnswer,
    count: number,
    url: string,
    start: number,
    shownAt: number,
  ): void {
    const cut = navigation !== count - 1
    if (cut && (nav.count !== count || nav.url !== url)) return
    if (readAhead.count !== count || readAhead.url !== url)
      readAhead = { url, count, surfaces: new Map() }
    const noted = readAhead.surfaces.get(name)
    if (noted && !('redrawn' in noted)) return
    if (typeof answer === 'string') {
      if (noted) readAhead.surfaces.delete(name)
      return
    }
    if (answer.placement === 'redrawn') {
      if (noted) noted.fromCache &&= answer.fromCache
      else
        readAhead.surfaces.set(name, { since: start, fromCache: answer.fromCache, redrawn: true })
      return
    }
    const since = noted?.since ?? start
    const fromCache = (noted?.fromCache ?? true) && answer.fromCache
    readAhead.surfaces.set(
      name,
      answer.placement === 'shown'
        ? { ms: msFrom(since, shownAt), fromCache }
        : { since, fromCache },
    )
  }

  /**
   * Notes, for each of `later` that a pass ahead of WXT's report, due at `passStart` and placing for
   * navigation `count` on `url`, did not place because the report cut it short first, the start that pass would have timed it from:
   * one whose element `found` saw at a pass asked for before the report and still sees. Its figure
   * may show at once on the navigation's own pass, from a read it shares with the surface whose read
   * was cut, so the report times it from here. It notes no cache result, so the own pass's answer
   * gives it. A surface without `found` notes nothing.
   */
  function noteUnplacedAhead(
    later: Surface[],
    count: number,
    url: string,
    passStart: number,
    seen: ReadonlyMap<ExtensionSurface, number>,
  ): void {
    for (const surface of later) {
      const seenAt = seen.get(surface.name)
      if (!surface.found || seenAt === undefined || !surface.isOn(url)) continue
      try {
        if (!surface.found(document, url)) continue
      } catch {
        continue
      }
      const start = Math.max(passStart, seenAt)
      noteReadAhead(surface.name, cutFrom(true), count, url, start, start)
    }
  }

  /** Notes each surface on the page whose element `found` sees for the first time this navigation. */
  function noteFound(): void {
    const here = url()
    for (const surface of surfaces) {
      if (!surface.found || firstFound.has(surface.name) || !surface.isOn(here)) continue
      try {
        if (surface.found(document, here)) firstFound.set(surface.name, Date.now())
      } catch {
        // Unseen, the surface is timed from its place call.
      }
    }
  }

  /** Starts the clock afresh when the URL has left the page it was taken on. */
  function clockFor(here: string): void {
    if (here === clockUrl) return
    clockUrl = here
    askedAt = undefined
    firstFound = new Map()
  }

  /** One pass at a time; a pass asked for during one runs once it ends. */
  function pass(): Promise<void> {
    clockFor(url())
    askedAt ??= Date.now()
    noteFound()
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        clockFor(url())
        const due = askedAt ?? Date.now()
        askedAt = undefined
        await placeAll(due)
      } while (again)
    })().finally(() => {
      running = undefined
    })
    return running
  }

  function schedulePass(): void {
    if (passTimer !== undefined) return
    passTimer = setTimeout(() => {
      passTimer = undefined
      const here = url()
      for (const surface of surfaces) {
        if (here === nav.url && !surface.isOn(here)) removeSurface(document, surface.name)
        try {
          surface.sweep?.(document, schedulePass)
        } catch {
          // The pass's own placing still runs; it sweeps before it reads.
        }
      }
      void pass()
    }, passEveryMs)
  }

  /**
   * The settled pass places surfaces for the URL at that moment, so it does not try a surface of a
   * page the URL has just left. Such a surface is judged missing if no pass found it, unless a pass
   * answered it `unsettled`: only the settled pass could have judged it.
   *
   * A navigation whose URL the page never reached did not happen, so it is dropped rather than
   * judged: the page on screen is judged instead, as the last navigation it reached when the URL is
   * still that one's (so nothing it reported is reported again), or else as a navigation of its own.
   */
  async function giveUp(navigationAtStart: number): Promise<void> {
    if (navigationAtStart !== navigation) return
    // A pass holding the lock past the give-up (a slow read) leaves no pass to see the URL commit.
    if (url() === nav.url) nav.reached = true
    if (!nav.reached) {
      dropped = nav.url
      const here = url()
      // Passes still running were for the dropped navigation.
      navigation += 1
      nav = previous?.url === here ? previous : freshNavigation(here, true, navigation)
      nav.reached = true
      nav.redrawn.clear()
    }
    const judged = navigation
    nav.settled = true
    await pass()
    if (judged !== navigation) return
    for (const surface of surfaces) {
      const { name } = surface
      const mayJudgeMissing = nav.triedSettled.has(name) || !nav.unsettled.has(name)
      if (
        surface.isOn(nav.url) &&
        !nav.found.has(name) &&
        mayJudgeMissing &&
        !nav.missing.has(name)
      ) {
        nav.missing.add(name)
        report({ name: 'extension_surface_missing', surface: name })
      }
    }
  }

  /**
   * `to` is the URL WXT reports, not `url()`: under the Navigation API WXT reports the move from the
   * `navigate` event, before `location.href` changes.
   */
  function navigated(to: string): void {
    navigation += 1
    // Only a navigation the page reached is one a drop hands the page back to. Under the Navigation
    // API WXT reports a `navigate` before the URL moves, so the URL still on `nav` counts as reached.
    if (nav.reached || nav.url === url()) previous = nav
    nav = freshNavigation(to, url() === to, navigation)
    dropped = undefined
    // Under WXT's poll the URL reached `to` before the report, so an ask or a sighting taken there
    // since was on the page the navigation goes to, and stands.
    if (clockUrl !== to || url() !== to) {
      askedAt = undefined
      firstFound = new Map()
      clockUrl = url()
    }
    clearTimeout(giveUpTimer)
    const navigationAtStart = navigation
    giveUpTimer = setTimeout(() => void giveUp(navigationAtStart), giveUpAfterMs)
    schedulePass()
  }

  const observer = new MutationObserver(schedulePass)
  // Studio reuses a Content list row for another video when the creator pages or sorts, and may
  // change only its links' hrefs, which adds and removes no node. The filter alone turns on
  // watching the names it lists.
  observer.observe(document, { childList: true, subtree: true, attributeFilter: ['href'] })
  navigated(url())

  return {
    navigated,
    stop() {
      navigation += 1
      again = false
      observer.disconnect()
      clearTimeout(passTimer)
      clearTimeout(giveUpTimer)
      for (const surface of surfaces) removeSurface(document, surface.name)
    },
  }
}
