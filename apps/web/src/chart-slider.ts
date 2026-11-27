/**
 * A chart's slider, the WAI-ARIA pattern every plot implements so a keyboard and a screen reader
 * can read it: the accessible name, the value text, the keys, the blur rule and the polite live
 * region. Nothing here knows where a point is drawn; the library's tooltip places the card.
 */

/**
 * The card at a point, which the library's tooltip shows and the slider reads: its title, the
 * slider's value text, then its values, which the live region reads after a key step, no more than
 * three lines in all. A line with an empty value, as the launch chart's day, shows and reads its
 * label alone.
 */
export interface HoverCard {
  title: string
  values: { label: string; value: string }[]
}

/** The point a handled key moves to: null hides the card. */
export interface KeyStep {
  index: number | null
}

/**
 * Where a key takes the card, from the shown point (null with no card) on a chart of `count`
 * points, after the WAI-ARIA slider pattern: the arrows step one point and stop at the ends, Home
 * and End jump to them, and Escape hides the card. Undefined for any other key, for Escape with no
 * card to hide, and for every key on a chart with no point, which the page keeps.
 */
export function keyStepOf(key: string, index: number | null, count: number): KeyStep | undefined {
  if (count === 0) return undefined
  const last = count - 1
  switch (key) {
    case 'ArrowRight':
      return { index: index === null ? 0 : Math.min(last, index + 1) }
    case 'ArrowLeft':
      return { index: index === null ? last : Math.max(0, index - 1) }
    case 'Home':
      return { index: 0 }
    case 'End':
      return { index: last }
    case 'Escape':
      return index === null ? undefined : { index: null }
    default:
      return undefined
  }
}

/**
 * Whether focus leaving a plot hides its card, from the id of the hover the plot shows and the id of
 * the hover of the plot focus moves to, undefined when focus goes anywhere else. Focus moving
 * between plots that share a hover keeps the card: a tap or click on the second places the card on
 * every plot before the first loses focus, so hiding then would blank the card it just placed.
 */
export function blurHidesCard(hoverId: string, nextHoverId: string | undefined): boolean {
  return nextHoverId !== hoverId
}

// The accessible name's sentence is approved word for word in creator-analytics#74. Change it only
// with Nick.
const keysSentence = 'Use the arrow keys to read each point.'

/**
 * A chart's accessible name: its heading, followed by how to read it with the keys, then `more`,
 * a sentence on what else its keys do, when there is one.
 */
export function chartLabelOf(heading: string, more?: string): string {
  return more ? `${heading}. ${keysSentence} ${more}` : `${heading}. ${keysSentence}`
}

// Approved in epic creator-analytics#359 (2026-11-02). Change it only with Nick. A slider with no
// card shown says it, rather than reading as its first point.
const noPointText = 'No point selected'

/**
 * The slider's value text: the shown card's title. A slider always has a value, so with no card it
 * says so, rather than leaving a screen reader to read the first point's number.
 */
export function sliderTextOf(card: HoverCard | null): string {
  return card ? card.title : noPointText
}

/** The live region's text, and the count of the key steps that wrote it. */
export interface Announcement {
  text: string
  step: number
}

/** The live region before any key step. */
export const silence: Announcement = { text: '', step: 0 }

/**
 * The live region after a key step moves the card: the card's values as one sentence. The title is
 * the slider's value text, which a screen reader already reads, so it is not repeated. Each step is
 * a new announcement, which the region writes as a new node, so a screen reader reads values that
 * repeat the last step's, as two days with no views do; it reads no text that has not changed.
 */
export function announcementAfter(last: Announcement, card: HoverCard): Announcement {
  return announcementOf(
    last,
    card.values.map(({ label, value }) => (value ? `${label} ${value}` : label)).join(', '),
  )
}

/** The live region saying `text` as a new announcement, as after a plot moves the video player. */
export function announcementOf(last: Announcement, text: string): Announcement {
  return { text, step: last.step + 1 }
}

/**
 * The live region after a pointer, a tap or a hide moves the card: empty, keeping the last key
 * step's count. None of them writes an announcement, so without this the last key step's values
 * would outlive its card, and a screen reader in browse mode could read values the chart no longer
 * shows. An already empty region keeps its announcement, the same object, so a pointer move changes
 * no announcement state.
 */
export function emptied(last: Announcement): Announcement {
  return last.text === '' ? last : { ...last, text: '' }
}
