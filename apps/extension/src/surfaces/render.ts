import type { ExtensionSurface } from '@creator-analytics/api-types'
import { element, newTabLink, whenOpened } from '../dom.ts'
import type { ComparisonView } from './comparison.ts'
import { markOf } from './mark.ts'
import {
  type LineClick,
  type LineView,
  type PageView,
  type PillView,
  type SurfaceLink,
  type SurfaceView,
  showsAnswer,
} from './states.ts'
import { surfaceText } from './text.ts'

// The engaged views pill: the extension icon, the figure, then the label. Its tint is the inherited
// text colour, faint, so it reads in Studio's light and dark themes with no colour of its own.
// The icon is centred out of baseline alignment: a flex container with no baseline item takes its
// baseline from the icon's bottom edge, which would sit the pill's words about 2px above the text
// beside it at 13px.
const pillStyle = `
.pill { display: inline-flex; align-items: baseline; gap: 0.35em; padding: 0.15em 0.6em; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); font: inherit; color: inherit; }
.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
`

// Words a screen reader hears and nobody sees, such as "engaged views" beside a figure whose
// surface shows no label.
const visuallyHidden =
  'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;'

// Font and colour inherit through the shadow boundary, so the row takes the type and colours of
// the Studio element it sits in, in light and dark theme alike, and Studio's own stylesheets
// cannot reach inside. Sizes are relative for the same reason.
const rowStyle = `
:host { display: block; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5em; padding: 0.5em 0; font: inherit; color: inherit; }
.name { display: flex; align-items: baseline; gap: 0.5em; }
.answer { text-align: end; }
.through { font-size: 0.8em; opacity: 0.7; }
.comparison { padding: 0 0 0.5em; text-align: end; }
a { color: inherit; text-decoration: underline; }
${pillStyle}`

// A figure in a cell of Studio's table, on a line of its own under Studio's number and aligned to
// the cell's end like it. Studio's Views cell lays the number and the host out as one row that does
// not wrap, packed to the end, so anything wide beside the number pushes it left over the Date
// column, and a figure squeezed in beside it breaks onto two lines (creator-analytics#219). So the
// host adds no width to that row: it is an anchor of zero width, held to a line by its zero-width
// character, and the figure draws out of flow from it, under the number, on one line. The host's
// height follows Studio's align-items, which the fixture does not show, and under stretch it is the
// whole row's, so the figure drops one line (1lh, the number's line height, inherited) from the
// host's top rather than from its bottom. Only the extension's own element is styled; Studio's cell
// keeps its styles.
const cellStyle = `
:host { display: inline-block; position: relative; inline-size: 0; flex: none; vertical-align: top; }
.anchor::before { content: "\\200B"; }
.cell { position: absolute; top: 1lh; inset-inline-end: 0; margin-block-start: 0.2em; display: flex; align-items: baseline; gap: 0.4em; white-space: nowrap; font: inherit; color: inherit; }
.cell .label { ${visuallyHidden} }
${pillStyle}`

// The Content list's pill in Studio's Views column heading: the engaged views pill with no figure,
// small, under Studio's word "Views" and ending where the word ends (creator-analytics#230). The day
// the figures run through is not here but in the page's line under Studio's page title. Studio's
// layout of that heading, from Nick's console in real Studio on 2026-10-15 at 7dc845d, in viewport
// px (the saved fixtures carry no styles): the heading cell, div[role=columnheader].tablecell-views,
// is a flex row with align-items normal, so its items stretch, no wrap and justify-content
// flex-end, position relative, overflow visible, 243 to 290 top to bottom and 606 to 690 across,
// 12px padding each side. In it the h3, 646 to 678, is a block with overflow hidden holding the sort
// control, a flex button, and the word's span, 32px wide. Studio sets the cell's line height to its
// own 47px, so the word's 14px text box, 260 to 274, is centred on the cell's middle, 266.5. The h3
// clips anything drawn outside its 32px, and an inline anchor inside it pushed the word out of its
// box (#230's first anchor blanked the heading), so the pill draws from an anchor of no width placed
// as a flex item of the cell directly after the h3: at 678, where the word ends, stretched to the
// cell's 243 to 290, so it widens no column however narrow. Shadow text inherits Studio's 47px line
// height, and at 7dc845d every line of ours was 47px tall (the old pill drew 241 to 292, the old day
// 290 to 337, over the first row), so the host declares its own line height, 1, and the pill
// declares it again over pillStyle's `font: inherit`. The pill starts half the heading's 12px type
// plus 2px below the anchor's middle: 266.5 + 6 + 2 = 274.5, just under the word's text box. It is
// 0.8em, 9.6px, with 0.1em padding above and below, so 9.6 + 1.9 = 11.5px tall, and ends at 286, 4px
// above the cell's bottom at 290. Under a cell that centres its items instead, the anchor is one
// 12px line centred on the same middle, and the pill lands the same. At 9.6px the pill is about 86px
// wide, so from 678 it reaches about 14px past the cell's start into the end of the Date heading's
// cell (unmeasured), as the old pill beside the word reached further. Neither the cell's type nor its layout
// is read from the page, which test/page-boundary.test.ts forbids. The heading sorts the table
// when clicked, and the pill sits over it: neither the host nor anything it draws takes pointer
// events, so a click falls through to Studio's heading. creator-analytics#230's hand check in Chrome
// confirms the arithmetic.
const headingStyle = `
:host { display: block; position: relative; inline-size: 0; flex: none; pointer-events: none; line-height: 1; }
.anchor::before { content: "\\200B"; }
.under { position: absolute; top: calc(50% + 0.5em); margin-block-start: 2px; inset-inline-end: 0; display: flex; white-space: nowrap; pointer-events: none; }
${pillStyle}
.under .pill { font-size: 0.8em; padding: 0.1em 0.45em; line-height: 1; }
`

// The analytics page's figure, inside Studio's Views tile under Studio's number: the visible words
// "engaged views", then the mark and the number on the line under them, then "Lifetime" under that
// only when the figure's period is not Studio's. The label comes first in the markup as well as on
// screen, so a screen reader hears it before the figure, as Studio's tile reads "Views" before its
// number. The host sits after the tile's number row, so it inherits the number's bold display face,
// and in Nick's Chrome re-tests of creator-analytics#229 the label and the period read in it. So the
// label and the period declare the font of Studio's own "Views" label, Roboto in normal weight,
// muted, and 15% smaller than they were (1em and 0.8em), still in em so they scale with the tile.
// Roboto is declared, never read from the page, which test/page-boundary.test.ts forbids. The
// mark and the number keep the tile's font. Stacked lines add no width to a tile whose width Studio
// sets. The host is a block as wide as the tile, so it centres its own content under Studio's number
// and changes none of Studio's elements or styles (creator-analytics#229). It inherits the tile's
// text colour and sets no colour or background of its own, so it reads in Studio's light and dark
// themes. The look is not measured: the saved fixtures carry no styles, so creator-analytics#229's
// hand check in Chrome confirms or tunes it.
const figureStyle = `
:host { display: block; text-align: center; }
.figure { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit; }
.figure svg { height: 1em; width: 1em; flex: none; align-self: center; }
.label { font-family: Roboto, Arial, sans-serif; font-weight: normal; font-size: 0.85em; opacity: 0.7; }
.period { font-family: Roboto, Arial, sans-serif; font-weight: normal; font-size: 0.68em; opacity: 0.7; }
`

// A page's line: the analytics page's above Studio's key metric card, outside it, and the Content
// list's under Studio's page title. The mark, then "Data from Stillstats as of" the day the figures
// run through, with the analytics page's link to the video in the web app, or the state's line.
// Inline, so the sentence's full stop sits against the link.
const lineStyle = `
:host { display: block; }
.line { padding: 0.5em 0; font: inherit; color: inherit; }
.line svg { height: 1em; width: 1em; vertical-align: -0.125em; margin-inline-end: 0.35em; }
.line .answer { display: inline; }
a { color: inherit; text-decoration: underline; }
`

// The engaged views pill on a public page, inline directly after YouTube's view count in a tile's
// metadata line, as one more of YouTube's metadata items: no capsule, so no background, border or
// padding, and the S mark the text's size (creator-analytics#627). Font, colour and weight inherit
// through the shadow boundary from YouTube's metadata text, so the pill reads as the date beside it
// in the light and dark themes, and YouTube's stylesheets cannot reach inside. The pill sets no
// pointer events of its own, so a click on it does what a click on YouTube's tile there does. jsdom
// lays nothing out: where it lands in the line, and how it reads in both themes, is #627's hand
// check in Chrome and Firefox. The space before the pill is its separator's (`PillSeparator`),
// not a margin on the host, so the pill on a line of its own starts where the line does. The dot's
// 4px each side is YouTube's usual metadata dot margin, declared and never read from the page,
// which test/page-boundary.test.ts forbids; the hand check tunes it. The host's own rules, and
// any the pill adds, are its `PillLayout`'s.
const publicPillStyle = (layout: PillLayout) => `
:host { ${publicLayouts[layout].host} }
.separator { font: inherit; color: inherit; }
.separator.dot { margin-inline: 4px; }
.pill { display: inline-flex; align-items: baseline; gap: 0.35em; font: inherit; color: inherit;${publicLayouts[layout].pill} }
.pill svg { height: 1em; width: 1em; flex: none; align-self: center; }
`

/**
 * How a public page pill's host sits among YouTube's elements: `inline`, an item of the line it
 * joins; `row`, a block of its own, one more of YouTube's metadata rows, under the row it follows
 * (the watch page's sidebar, whose narrow tiles broke the pill inline after the view count onto two
 * lines, creator-analytics#627's hand check); `under-channel-bar`, inline on a line of its own under
 * the Shorts player's channel bar, with space above it.
 */
export type PillLayout = 'inline' | 'row' | 'under-channel-bar'

/**
 * Each layout's declarations for the host, and any it adds to the pill. A row's pill does not wrap,
 * so "engaged views" stays on one line under YouTube's row however narrow the tile. Under the Shorts
 * player's channel bar the pill touched the avatar and handle row above it, so the pill keeps 8px
 * above it: a declared value, never read from the page, tuned by creator-analytics#627's hand check.
 * The margin is the pill's, not the host's. A `:host` rule loses to any normal declaration of the
 * page's that matches the host element, and YouTube's stylesheet resets that element's margin, so
 * Chrome computed the host's 8px as 0px. Inside the shadow root no page rule reaches the pill. The
 * pill is an inline-flex box in the inline-block host, and an atomic inline's top margin is part of
 * the line box it sits in, so the margin grows the host by 8px above the pill.
 */
const publicLayouts: Record<PillLayout, { host: string; pill: string }> = {
  inline: { host: 'display: inline-block;', pill: '' },
  row: { host: 'display: block;', pill: ' white-space: nowrap;' },
  'under-channel-bar': { host: 'display: inline-block;', pill: ' margin-block-start: 8px;' },
}

/** A link that tells the surface when the creator opens it, with a click or a middle-click. */
export interface OpenedLink extends SurfaceLink {
  opened(): void
}

/** Told which line link the creator opened, with a click or a middle-click. */
export type LineOpened = (click: LineClick) => void

function lineOf(document: Document, view: LineView, lineOpened?: LineOpened): HTMLElement {
  if (view.link === null) return element(document, 'div', { className: 'answer', text: view.text })
  const line = element(document, 'div', { className: 'answer' })
  if (view.text) line.append(view.text, ' ')
  line.append(
    lineOpened
      ? whenOpened(newTabLink(document, view.link), () => lineOpened(view.click))
      : newTabLink(document, view.link),
  )
  return line
}

/** A line in the small style of the day, such as "Through 7 Oct" or "First 3 days". */
function throughOf(document: Document, text: string): HTMLElement {
  return element(document, 'div', { className: 'through', text })
}

function answerOf(
  document: Document,
  view: Exclude<SurfaceView, { kind: 'nothing' }>,
  lineOpened: LineOpened | undefined,
): HTMLElement {
  if (view.kind === 'line') return lineOf(document, view, lineOpened)
  const answer = element(document, 'div', { className: 'answer' })
  if (view.kind === 'not-processed') {
    answer.textContent = surfaceText.notProcessed
    return answer
  }
  if (view.day) answer.append(throughOf(document, surfaceText.through(view.day)))
  return answer
}

const surfaceAttribute = 'data-stillstats-surface'

/** Removes the surface's elements under `root`, including one left beside a row Studio redrew. */
export function removeSurface(root: ParentNode, surface: ExtensionSurface): void {
  for (const host of root.querySelectorAll(`[${surfaceAttribute}="${surface}"]`)) host.remove()
}

/**
 * Removes the surface's elements beside `element`, its siblings, such as a copy left by a Studio
 * redraw of the page title the Content list's line follows, and none inside a sibling.
 */
export function removeSurfaceBeside(element: Element, surface: ExtensionSurface): void {
  const siblings = element.parentElement?.querySelectorAll(
    `:scope > [${surfaceAttribute}="${surface}"]`,
  )
  for (const host of siblings ?? []) host.remove()
}

/** A host carrying the surface's name, whose open shadow root holds `style` and `content`. */
function hostOf(
  document: Document,
  surface: ExtensionSurface,
  style: string,
  ...content: HTMLElement[]
): HTMLElement {
  const host = document.createElement('div')
  host.setAttribute(surfaceAttribute, surface)
  const root = host.attachShadow({ mode: 'open' })
  root.append(element(document, 'style', { text: style }), ...content)
  return host
}

/** A page's line: a host whose open shadow root holds the mark, then `content`. */
function markedLine(
  document: Document,
  surface: ExtensionSurface,
  ...content: (Node | string)[]
): HTMLElement {
  const line = element(document, 'div', { className: 'line' })
  line.append(markOf(document), ...content)
  return hostOf(document, surface, lineStyle, line)
}

/**
 * The comparison row: the video's place, then the days since publish it counts, such as "First 3
 * days", in the small style of the day.
 */
function comparisonRow(document: Document, view: ComparisonView): HTMLElement {
  const row = element(document, 'div', { className: 'comparison' })
  row.append(
    element(document, 'div', { className: 'place', text: view.place }),
    throughOf(document, view.through),
  )
  return row
}

/** The engaged views pill: the extension icon, then `figure` when there is one, then the label. */
function pillOf(document: Document, figure?: string): HTMLElement {
  const pill = element(document, 'span', { className: 'pill' })
  pill.append(markOf(document))
  if (figure !== undefined)
    pill.append(element(document, 'span', { className: 'figure', text: figure }), ' ')
  pill.append(element(document, 'span', { className: 'label', text: surfaceText.label }))
  return pill
}

/** The pill holding `figure` if given, then `answer`. */
function labelledRow(
  document: Document,
  answer: HTMLElement | undefined,
  { figure }: { figure?: string | undefined } = {},
): HTMLElement {
  const name = element(document, 'div', { className: 'name' })
  name.append(pillOf(document, figure))
  const row = element(document, 'div', { className: 'row' })
  row.append(name)
  if (answer) row.append(answer)
  return row
}

/**
 * The extension's element for a surface: a host whose open shadow root holds the engaged views
 * pill, with the figure when the view has one, then the day the figure runs through, "Not processed
 * yet" or the state's line, and under that the `comparison` row when one is given.
 * A line with a link links the web app itself and tells `lineOpened` when the creator opens it.
 * Undefined for a view that shows nothing.
 */
export function renderSurface({
  document,
  surface,
  view,
  comparison,
  lineOpened,
}: {
  document: Document
  surface: ExtensionSurface
  view: SurfaceView
  comparison?: ComparisonView | undefined
  lineOpened?: LineOpened | undefined
}): HTMLElement | undefined {
  if (view.kind === 'nothing') return undefined
  const answer = answerOf(document, view, lineOpened)
  const figure = view.kind === 'figure' ? view.figure : undefined
  return hostOf(
    document,
    surface,
    rowStyle,
    labelledRow(document, answer, { figure }),
    ...(comparison ? [comparisonRow(document, comparison)] : []),
  )
}

/**
 * The analytics page's two elements. `figure` goes in Studio's Views tile: "engaged views", seen
 * and heard once, then the mark and the figure or "Not processed yet" under it, then the
 * `periodLabel` when one is given. `line` goes above Studio's key metric card: the mark, then
 * "Data from Stillstats as of" the day the figure runs through, and `link`; or, for a view that
 * shows a state's line in place of the figure, the mark and that line, whose link, if it has one,
 * tells `lineOpened` when the creator opens it, and no figure. Neither for a view that shows
 * nothing.
 */
export function renderVideoAnalytics({
  document,
  surface,
  view,
  periodLabel,
  link,
  lineOpened,
}: {
  document: Document
  surface: ExtensionSurface
  view: SurfaceView
  periodLabel?: string | undefined
  link?: OpenedLink | undefined
  lineOpened?: LineOpened | undefined
}): { figure: HTMLElement | undefined; line: HTMLElement | undefined } {
  if (view.kind === 'nothing') return { figure: undefined, line: undefined }
  if (view.kind === 'line')
    return {
      figure: undefined,
      line: markedLine(document, surface, lineOf(document, view, lineOpened)),
    }
  const opened = link ? [' ', whenOpened(newTabLink(document, link), () => link.opened()), '.'] : []
  const label = element(document, 'div', { className: 'label', text: surfaceText.label })
  const figure = element(document, 'div', { className: 'figure' })
  figure.append(
    markOf(document),
    view.kind === 'figure'
      ? element(document, 'span', { className: 'number', text: view.figure })
      : element(document, 'span', { className: 'not-processed', text: surfaceText.notProcessed }),
  )
  const period = periodLabel
    ? [element(document, 'div', { className: 'period', text: periodLabel })]
    : []
  return {
    figure: hostOf(document, surface, figureStyle, label, figure, ...period),
    line: markedLine(document, surface, surfaceText.dataFrom(view.day), ...opened),
  }
}

/**
 * The extension's line for a page of videos, such as the Content list's under Studio's page title:
 * the mark, then "Data from Stillstats as of" the day the page's figures run through, with no link;
 * or, for a line state such as signed out, the mark and the state's line, whose link, if it has
 * one, tells `lineOpened` when the creator opens it.
 */
export function renderPageLine({
  document,
  surface,
  view,
  lineOpened,
}: {
  document: Document
  surface: ExtensionSurface
  view: PageView
  lineOpened?: LineOpened | undefined
}): HTMLElement {
  return markedLine(
    document,
    surface,
    view.kind === 'line' ? lineOf(document, view, lineOpened) : surfaceText.dataFrom(view.day),
  )
}

/**
 * The extension's anchor in a table's Views column heading, for a page with figures, which goes in
 * the heading cell directly after the line that holds Studio's word "Views", never inside it: it
 * draws the engaged views pill with no figure, small, under the word and ending where it ends. It
 * holds no link and takes no click, so a click on the pill sorts the table as a click on Studio's
 * heading does.
 */
export function renderViewsHeading({
  document,
  surface,
}: {
  document: Document
  surface: ExtensionSurface
}): HTMLElement {
  const under = element(document, 'span', { className: 'under' })
  under.append(pillOf(document))
  return hostOf(
    document,
    surface,
    headingStyle,
    element(document, 'span', { className: 'anchor' }),
    under,
  )
}

/**
 * The extension's element in one video's cell of a table: the engaged views pill with the figure,
 * or the pill then "Not processed yet", on a line of its own under the cell's own figure. The pill
 * shows the icon and the figure, or the icon alone before "Not processed yet", and "engaged views"
 * is heard and not seen, since the pill in the table's Views heading says it. Undefined for a view
 * that adds no number, since a line shows once per page.
 */
export function renderCellFigure({
  document,
  surface,
  view,
}: {
  document: Document
  surface: ExtensionSurface
  view: SurfaceView
}): HTMLElement | undefined {
  if (!showsAnswer(view)) return undefined
  const cell = element(document, 'div', { className: 'cell' })
  if (view.kind === 'figure') cell.append(pillOf(document, view.figure))
  else
    cell.append(
      pillOf(document),
      element(document, 'span', { className: 'not-processed', text: surfaceText.notProcessed }),
    )
  return hostOf(
    document,
    surface,
    cellStyle,
    element(document, 'span', { className: 'anchor' }),
    cell,
  )
}

/**
 * What sits before the pill on a public page, as YouTube separates the items of the line it joins:
 * `dot`, YouTube's "•" (a search result's metadata line, which draws its dot before each later
 * item); `space`, the one space YouTube's delimiter span holds between the view count and the date
 * in a lockup's metadata line (the channel tabs, the home feed and the watch sidebar), with no dot;
 * `two-spaces`, the two spaces YouTube writes between the view count and the date in the info line
 * under the watch page's title; `none`, where the pill has a line of its own (the Shorts player and
 * the Shorts tab, and the watch sidebar's row of its own).
 */
export type PillSeparator = 'dot' | 'space' | 'two-spaces' | 'none'

/**
 * The separator's text, drawn by the extension, never read from YouTube's markup. The spaces are
 * no-break spaces, since ordinary spaces at the start of the inline-block host collapse away.
 */
const separatorText: Record<Exclude<PillSeparator, 'none'>, string> = {
  dot: '•',
  space: '\u00a0',
  'two-spaces': '\u00a0\u00a0',
}

/**
 * The engaged views pill on a public page: `separator`'s mark, hidden from a screen reader, then
 * the extension icon, the compact figure and "engaged views". The pill is one image to a screen
 * reader, named with the full figure and its day, which is its hover too, so the icon's name and
 * the compact figure are not read on their own. It holds no link and takes no click. The host sits
 * as `layout` says, inline unless given.
 */
export function renderEngagedViewsPill({
  document,
  surface,
  view,
  separator,
  layout = 'inline',
}: {
  document: Document
  surface: ExtensionSurface
  view: PillView
  separator: PillSeparator
  layout?: PillLayout | undefined
}): HTMLElement {
  const pill = pillOf(document, view.figure)
  pill.title = view.name
  pill.setAttribute('role', 'img')
  pill.setAttribute('aria-label', view.name)
  const style = publicPillStyle(layout)
  if (separator === 'none') return hostOf(document, surface, style, pill)
  const mark = element(document, 'span', {
    className: `separator ${separator}`,
    text: separatorText[separator],
  })
  mark.setAttribute('aria-hidden', 'true')
  return hostOf(document, surface, style, mark, pill)
}
