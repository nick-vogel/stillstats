import { maxVideoIds } from '@creator-analytics/api-types'
import { signedInReadKeptMs } from '../kept.ts'
import type { VideosRead } from '../product-api.ts'
import {
  pageTitleIn,
  tableHeaderIn,
  videoHrefIn,
  videoListIn,
  videoRowsIn,
  viewsCellIn,
  viewsHeadingIn,
  viewsWordLineIn,
} from '../selectors/content-list.ts'
import {
  cutFrom,
  isKept,
  type PlaceAnswer,
  type Placement,
  readVideosAndSendHeldClicks,
  redrawnFrom,
  type Surface,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import {
  removeSurface,
  removeSurfaceBeside,
  renderCellFigure,
  renderPageLine,
  renderViewsHeading,
} from './render.ts'
import { type PageView, pageViewOf, surfaceViewOf } from './states.ts'
import { channelIdOf, isContentList, videoIdOf } from './studio-url.ts'

/** The ids of a page asked for in requests of at most `maxVideoIds`, which the API refuses past. */
function chunksOf(ids: string[]): string[][] {
  const chunks: string[][] = []
  for (let start = 0; start < ids.length; start += maxVideoIds) {
    chunks.push(ids.slice(start, start + maxVideoIds))
  }
  return chunks
}

/**
 * One read of a page's requests: every answer's videos, so a row whose request was refused shows
 * nothing like any row the API does not answer, or the first read when none was answered. It is
 * from the cache only when every answer was.
 */
function readOfAll(reads: VideosRead[]): VideosRead {
  const answered = reads.flatMap((read) => (read.state === 'read' ? [read] : []))
  const [first] = answered
  if (!first) return reads[0] ?? { state: 'failed' }
  const videos = answered.flatMap(({ answer }) => answer.videos)
  const fromCache = answered.every(({ answer }) => answer.fromCache)
  return { ...first, answer: { ...first.answer, videos, fromCache } }
}

/** What a pass answers for a page placed from `read`: shown with the read's cache result. */
const answerOf = (placement: Placement, read: VideosRead): PlaceAnswer =>
  placement === 'shown' ? shownFrom(read.state === 'read' && read.answer.fromCache) : placement

const rowIdOf = (row: Element): string | undefined => {
  const href = videoHrefIn(row)
  return href ? videoIdOf(href) : undefined
}

/**
 * What of the Content list Studio shows at `url`: the list, its column headings, the Views heading
 * and its line that holds the word "Views", the page title, the URL's channel, and the rows with
 * the ids they link, sorted, so the same rows in another order reuse the background's read of them.
 */
function listPageIn(document: Document, url: string) {
  const list = videoListIn(document)
  const header = list && tableHeaderIn(list)
  const heading = header && viewsHeadingIn(header)
  const wordLine = heading && viewsWordLineIn(heading)
  const title = pageTitleIn(document)
  const youtubeChannelId = channelIdOf(url)
  const rows = list ? videoRowsIn(list) : []
  const ids = [...new Set(rows.flatMap((row) => rowIdOf(row) ?? []))].sort()
  return { list, header, heading, wordLine, title, youtubeChannelId, rows, ids }
}

/**
 * Whether the page holds what a pass reads for: a list with ids, its column headings with the Views
 * heading, the page title and the URL's channel. `place` judges it the same way.
 */
function holdsList(document: Document, url: string): boolean {
  const { list, header, heading, title, youtubeChannelId, ids } = listPageIn(document, url)
  return !!(list && header && heading && title && youtubeChannelId) && ids.length > 0
}

/**
 * Studio's Content list: each row's lifetime engaged views in the row's Views cell, under Studio's
 * figure; once for the page, a line under Studio's page title with the day the figures run through,
 * and the engaged views pill in Studio's Views column heading, under the word "Views", drawn from
 * an anchor after the line that holds the word. A line state shows its line in the line under the
 * title instead, with no pill and no figure. A page without Studio's title shows nothing of the
 * extension's; one whose Views heading has no line holding the word shows nothing of an answer with
 * figures, no line, pill or figure, and a line state still shows its line. A tab with no video
 * list, such as Playlists, shows nothing of the extension's. Studio's columns stay as they are.
 */
export function contentList(options: SurfaceOptions): Surface {
  const { origin, locale, lineClicks } = options
  /**
   * Per Studio row: the video its figure was placed for. Studio reuses a row element for another
   * video when the creator pages, sorts, filters or changes tab.
   */
  const placed = new WeakMap<Element, { videoId: string; host: Element }>()
  /**
   * The page last answered: its channel and ids, its navigation, whether it was read ahead of
   * WXT's report of that navigation, its rows and the video each row showed when the read landed,
   * the read, its elements (the line under Studio's page title, and the pill's anchor after the
   * Views heading's line for a page with figures), which come down together, what that placed, and
   * when. A shown page is kept for its navigation and carried into the next one until that one
   * settles; a line is kept only `signedInReadKeptMs` (see `isKept`), and so is an answer read
   * ahead, until a pass of its reported navigation reuses it.
   */
  let answered:
    | {
        key: string
        navigation: number
        ahead: boolean
        rows: Element[]
        rowIds: (string | undefined)[]
        read: VideosRead
        pageHosts: Element[]
        placement: Placement
        at: number
      }
    | undefined
  /**
   * Passes in a row that found the list with its column headings and no row ids. Studio may take its
   * rows away, or strip their links, for longer than one pass while it redraws them, so one such pass
   * is not yet a tab Studio draws empty.
   */
  let emptyPasses = 0
  /**
   * The key of the rows a pass is awaiting the background's read of, as Studio showed them when the
   * pass sent it.
   */
  let readingKey: string | undefined
  /**
   * Sweeps in a row that found the list with its column headings and no row ids while a re-read of
   * the answered rows was out. Its own count, not `emptyPasses`: with no read out, a tick sweeps and
   * passes, and one count would take each such tick twice.
   */
  let emptySweeps = 0

  /**
   * Shows `read` in each row, by the video the row shows now, and drops the figure of a row that
   * shows another video. `fresh` replaces every figure; otherwise a row keeps the one it has.
   */
  function showInRows(
    document: Document,
    rows: Element[],
    { read, fresh }: { read: VideosRead; fresh: boolean },
  ): boolean {
    let shows = false
    for (const row of rows) {
      const videoId = rowIdOf(row)
      const held = placed.get(row)
      if (!fresh && held && held.videoId === videoId && held.host.isConnected) {
        shows = true
        continue
      }
      held?.host.remove()
      placed.delete(row)
      const cell = viewsCellIn(row)
      if (!cell) continue
      // A row Studio redrew carries a copy of the extension's element, with nothing in it.
      removeSurface(cell, 'content_list')
      if (!videoId) continue
      const view = surfaceViewOf({ read, videoId, origin, locale })
      // A cell holds an element only for a view that shows an answer.
      const host = renderCellFigure({ document, surface: 'content_list', view })
      if (!host) continue
      cell.append(host)
      placed.set(row, { videoId, host })
      shows = true
    }
    return shows
  }

  /**
   * Places the extension's elements for the page, showing `view`: the line directly after Studio's
   * page `title`, with the day the figures run through or a line state's line, and for a page with
   * figures the pill's anchor directly after `wordLine`, the line of Studio's Views column `heading`
   * that holds the word "Views", in `heading` and never inside the line.
   */
  function placePageElements(
    document: Document,
    { title, heading, wordLine }: { title: Element; heading: Element; wordLine: Element | null },
    view: PageView,
  ): Element[] {
    // A title or heading Studio redrew may leave copies of the extension's elements, with nothing
    // in them, which stay on a line state too unless they are taken out.
    removeSurfaceBeside(title, 'content_list')
    removeSurface(heading, 'content_list')
    const line = renderPageLine({
      document,
      surface: 'content_list',
      view,
      lineOpened: (click) => lineClicks.opened('content_list', click),
    })
    title.after(line)
    // `!wordLine` only narrows the type: each caller takes a page with figures down, and never
    // places it, when Studio's Views heading has no line that holds the word.
    if (view.kind === 'line' || !wordLine) return [line]
    const pill = renderViewsHeading({ document, surface: 'content_list' })
    wordLine.after(pill)
    return [line, pill]
  }

  function takeDownPage(): void {
    for (const host of answered?.pageHosts ?? []) host.remove()
  }

  /**
   * Whether `read` shows figures, and so needs the line of Studio's Views heading that holds the
   * word "Views" for the pill that says what they count. A line state does not.
   */
  function showsFigures(read: VideosRead): boolean {
    return pageViewOf({ read, origin, locale }).kind !== 'line'
  }

  /**
   * Takes the page's elements and every row's figure down together, for a page that cannot show
   * them: one with no Views heading, no page title, or, for an answer with figures, no line of the
   * Views heading holding the word "Views". Without the heading or that line the pill has nowhere to
   * go, and a figure with no pill near it says nothing of what it counts; without the title the
   * line that dates the figures has nowhere to go.
   */
  function takeDownPageAndRows(list: Element): 'not-found' {
    removeSurface(list, 'content_list')
    takeDownPage()
    if (answered) answered.pageHosts = []
    return 'not-found'
  }

  /** Another video's figure never stays up in a row while the background answers for this one. */
  function dropChangedRows(rows: Element[]): void {
    for (const row of rows) {
      const held = placed.get(row)
      if (held && held.videoId !== rowIdOf(row)) {
        held.host.remove()
        placed.delete(row)
      }
    }
  }

  /** Whether Studio still shows the answered page: the same row elements, each on the same video. */
  function rowsStandAsAnswered(rows: Element[]): boolean {
    return (
      answered !== undefined &&
      rows.length === answered.rows.length &&
      rows.every(
        (row, index) => row === answered?.rows[index] && rowIdOf(row) === answered.rowIds[index],
      )
    )
  }

  return {
    name: 'content_list',
    isOn: isContentList,
    // A pass awaiting a read cannot sweep the rows Studio repoints meanwhile, or take down the page
    // elements of a list Studio no longer shows; the sweep does both, outside the pass lock.
    sweep(document, passAgain) {
      const list = videoListIn(document)
      if (!list) {
        const reReading = readingKey !== undefined && readingKey === answered?.key
        emptySweeps = reReading ? emptySweeps + 1 : 0
        if (reReading && emptySweeps === 1) passAgain()
        else takeDownPage()
        return
      }
      const rows = videoRowsIn(list)
      dropChangedRows(rows)
      const empty = tableHeaderIn(list) !== null && !rows.some((row) => rowIdOf(row))
      const reReading = readingKey !== undefined && readingKey === answered?.key
      emptySweeps = reReading && empty ? emptySweeps + 1 : 0
      if (!empty || readingKey === undefined) return
      // Rows a read is out for, other than the answered ones, are a page the page's elements (the
      // line under the title, and the pill in the Views heading) do not stand on yet, so a list with
      // none is no redraw of its rows: they come down at once. While the answered rows themselves
      // are read again, Studio may take them away for longer than a pass as it redraws them, so they
      // come down only on the second sweep in a row that finds none, as the passes judge it when no
      // read is out. The first asks for the second: the held pass can ask for nothing, and Studio may
      // change nothing more.
      if (reReading && emptySweeps === 1) passAgain()
      else takeDownPage()
    },
    found: holdsList,
    async place({ document, url, navigation, ahead, settled, current, passAgain }) {
      const { list, header, heading, wordLine, title, youtubeChannelId, rows, ids } = listPageIn(
        document,
        url,
      )
      // The page's elements belong to rows: over a list Studio draws with none, it states nothing.
      // A list is judged drawn with none once two passes in a row find none. The first asks for the
      // second, within `passEveryMs`: Studio may change nothing more once it has taken its rows
      // away, and a navigation that has settled has no give-up's pass left.
      emptyPasses = list && header && ids.length === 0 ? emptyPasses + 1 : 0
      if (emptyPasses === 1) passAgain()
      if (emptyPasses >= 2) takeDownPage()
      // With no Views heading, a figure would show with no pill near it to say what it counts;
      // with no page title, the line that dates the figures, or a line state's line, has nowhere to
      // go. The page's elements come down together, so a list whose header stands without either
      // takes the line, the pill and the rows' figures down. The Views heading's line that holds the
      // word "Views", which the pill's anchor follows, is needed only by an answer with figures: an
      // answer with figures held from before comes down too when that line is gone, while a line
      // state's line goes under the title and stands on no label, so the page is read to know.
      if (
        list &&
        header &&
        (!heading || !title || (!wordLine && answered !== undefined && showsFigures(answered.read)))
      )
        takeDownPageAndRows(list)
      if (!list || !header || !youtubeChannelId || ids.length === 0) return 'not-found'

      const key = JSON.stringify([youtubeChannelId, ids])
      // A navigation reads again: a re-sort, or a creator back on the list, sees today's figures.
      // Rows still as answered may be the outgoing page Studio has not redrawn yet. A read of them
      // would stall every pass until it landed, leaving their figures up on rows Studio redraws
      // meanwhile, so they are read again only once the navigation settles. Until then the outgoing
      // figures stay up but are not this navigation's surface: the list is unsettled, and the
      // settle-time pass decides whether the navigation is shown or missing. An answer read ahead
      // of WXT's report stands for that navigation only within a line's time: WXT may never report
      // the URL it was read on, and a later navigation would then take its count.
      const answeredHere =
        answered?.navigation === navigation &&
        (!answered.ahead || Date.now() - answered.at < signedInReadKeptMs)
      // A kept answer that waits on Studio's Views heading or page title is a redraw of this
      // navigation's read, so its figure is timed from the pass that found the list.
      if (!heading || !title) {
        if (answered?.key !== key || !isKept(answered) || !answeredHere) return 'not-found'
        // Once WXT has reported its navigation, an answer read ahead is kept as any other.
        if (!ahead) answered.ahead = false
        return answered.read.state === 'read'
          ? redrawnFrom(answered.read.answer.fromCache, 'not-found')
          : 'not-found'
      }
      if (
        answered?.key === key &&
        isKept(answered) &&
        (answeredHere || (!settled && rowsStandAsAnswered(rows)))
      ) {
        // Once WXT has reported its navigation, an answer read ahead is kept as any other.
        if (answeredHere && !ahead) answered.ahead = false
        const view = pageViewOf({ read: answered.read, origin, locale })
        // Still waiting on the line that holds the word "Views", the answer is a redraw of this
        // navigation's read, so its figure is timed from the pass that found the list.
        if (view.kind !== 'line' && !wordLine) {
          takeDownPageAndRows(list)
          return answeredHere && answered.read.state === 'read'
            ? redrawnFrom(answered.read.answer.fromCache, 'not-found')
            : 'not-found'
        }
        // None placed is an answer whose figures waited on the Views heading's line.
        if (
          answered.pageHosts.length === 0 ||
          !answered.pageHosts.every((host) => host.isConnected)
        ) {
          takeDownPage()
          answered.pageHosts = placePageElements(document, { title, heading, wordLine }, view)
        }
        // The rows may show the answer's videos only now: its read landed while they showed others.
        const shows = showInRows(document, rows, { ...answered, fresh: false })
        answered.placement = shows ? 'shown' : 'placed'
        return answeredHere ? answerOf(answered.placement, answered.read) : 'unsettled'
      }

      dropChangedRows(rows)
      readingKey = key
      const reads = await Promise.all(
        chunksOf(ids).map((chunk) =>
          readVideosAndSendHeldClicks(options, {
            youtubeChannelId,
            ids: chunk,
            window: 'lifetime',
          }),
        ),
      ).finally(() => {
        readingKey = undefined
      })
      const read = readOfAll(reads)
      // Studio may redraw the list, its headings or its title while the background answers; the
      // next pass places it then.
      const headingNow = viewsHeadingIn(header)
      const wordLineNow = headingNow && viewsWordLineIn(headingNow)
      const titleNow = pageTitleIn(document)
      if (!current()) return cutFrom(read.state === 'read' && read.answer.fromCache)
      if (!header.isConnected || ((!headingNow || !titleNow) && read.state !== 'read'))
        return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'

      takeDownPage()
      // The rows as they are now: Studio may have shown other videos in them during the request.
      const rowsNow = videoRowsIn(list)
      const page = {
        key,
        navigation,
        ahead,
        rows: rowsNow,
        rowIds: rowsNow.map(rowIdOf),
        read,
        at: Date.now(),
      }
      const view = pageViewOf({ read, origin, locale })
      // A read that landed with no Views heading or page title is kept, as one that waits on the
      // heading's "Views" line is, so a pass does not read it again, and its page comes back from
      // it once Studio draws both.
      if (!headingNow || !titleNow) {
        answered = { ...page, pageHosts: [], placement: view.kind !== 'line' ? 'shown' : 'placed' }
        takeDownPageAndRows(list)
        return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')
      }
      // An answer with figures and no line for its pill is kept, as a shown page is, so a pass does
      // not read it again, and its line, pill and figures come back from it once Studio draws the
      // line that holds the word "Views".
      if (view.kind !== 'line' && !wordLineNow) {
        answered = { ...page, pageHosts: [], placement: 'shown' }
        takeDownPageAndRows(list)
        return redrawnFrom(read.state === 'read' && read.answer.fromCache, 'not-found')
      }
      const pageHosts = placePageElements(
        document,
        { title: titleNow, heading: headingNow, wordLine: wordLineNow },
        view,
      )
      const shows = showInRows(document, rowsNow, { read, fresh: true })
      const placement: Placement = shows ? 'shown' : 'placed'
      answered = { ...page, pageHosts, placement }
      return answerOf(placement, read)
    },
  }
}
