import { type FocusEvent, type KeyboardEvent, useId, useState } from 'react'
import {
  type Announcement,
  announcementAfter,
  announcementOf,
  blurHidesCard,
  emptied,
  type HoverCard,
  silence,
  sliderTextOf,
} from './chart-slider.ts'

/**
 * What a group of plots over one selection shares: the id that marks each of them, so focus moving
 * between them keeps the card, what the live region last read, and which plot read it. The stacked
 * charts of creator-analytics#82 share one group; a chart alone takes a group of one.
 */
export function useSliderGroup() {
  const id = useId()
  const [announcement, setAnnouncement] = useState<Announcement>(silence)
  const [announcer, setAnnouncer] = useState<string | null>(null)

  /**
   * Reads a card's values in the live region of the plot `by`, after a key step on it moved the
   * card, or stayed on its point while that plot's region was empty.
   */
  function announce(card: HoverCard, by: string) {
    setAnnouncement((last) => announcementAfter(last, card))
    setAnnouncer(by)
  }

  /** Says `text` in the live region of the plot `by`, as after the plot moved the video player. */
  function say(text: string, by: string) {
    setAnnouncement((last) => announcementOf(last, text))
    setAnnouncer(by)
  }

  /**
   * Empties the live region, as a pointer, a tap or a hide moves the card, so a key step's values
   * never outlive the card that showed them (creator-analytics#343).
   */
  function quiet() {
    setAnnouncement(emptied)
  }

  return { id, announcement, announcer, announce, say, quiet }
}

export type SliderGroup = ReturnType<typeof useSliderGroup>

/**
 * A plot as a slider, the WAI-ARIA pattern for its keys: the props to spread on the plot and the
 * polite live region to render beside it. A handled key moves the card through `move` and keeps the
 * page from scrolling; a key step that moves the card reads its values in this plot's live region,
 * and so does one that stays on its point, as Home on the first, while this plot's region is empty;
 * a step that stays while the region holds the point's values reads nothing again. Escape hides the
 * card. Focus leaving the plot hides the card, unless it moves inside it or to another plot of the
 * group. Any hide empties the group's live region. With `activate`, Enter or Space on a shown
 * point acts on it and says what `activate` returns; with no point shown they go to the page. The
 * chart keeps its points, its pointer and the card's place; the slider sees them only through
 * `selection`, `stepOf` and `readingOf`.
 */
export function useChartSlider<Selection>({
  group,
  label,
  selection,
  stepOf,
  readingOf,
  sameAs = Object.is,
  move,
  activate,
  valueNow,
  valueMax,
}: {
  group: SliderGroup
  /** The plot's accessible name. */
  label: string
  /** The point the card shows, null with no card. */
  selection: Selection | null
  /** Where a key takes the card, null hiding it; undefined leaves the key to the page. */
  stepOf: (key: string, selection: Selection | null) => { selection: Selection | null } | undefined
  /** The card a screen reader reads at a selection, null where it names no point. */
  readingOf: (selection: Selection | null) => HoverCard | null
  /** Whether two selections name the same point. */
  sameAs?: (a: Selection, b: Selection) => boolean
  move: (next: Selection | null) => void
  /** What Enter and Space do at the shown point, returning the text to say, or null for none. */
  activate?: ((selection: Selection) => string | null) | undefined
  valueNow: number
  valueMax: number
}) {
  const plotId = useId()

  // What this plot's own live region reads: the group's last announcement, if this plot made it.
  const spoken = group.announcer === plotId ? group.announcement.text : ''

  function hide() {
    move(null)
    group.quiet()
  }

  function say(text: string) {
    group.say(text, plotId)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (activate && selection !== null && (event.key === 'Enter' || event.key === ' ')) {
      // Space would otherwise scroll the page.
      event.preventDefault()
      const text = activate(selection)
      if (text !== null) say(text)
      return
    }
    const step = stepOf(event.key, selection)
    if (!step) return
    // The arrows, Home and End would otherwise scroll the page.
    event.preventDefault()
    const next = step.selection
    if (next === null) {
      hide()
      return
    }
    move(next)
    const reading = readingOf(next)
    // A step that stays on its point, as Home on the first, reads its values when this plot's region
    // is empty: a pointer or a tap placed the card and emptied it, or another plot of the group
    // spoke last (creator-analytics#374). While the region already holds them, it reads nothing
    // again.
    const stays = selection !== null && sameAs(selection, next)
    if (reading && (!stays || spoken === '')) {
      group.announce(reading, plotId)
    }
  }

  // Read from the plot focus moves into, so focus moving inside a plot, as to an element a chart
  // library draws there, or to another plot of the group, keeps the card.
  function onBlur({ relatedTarget }: FocusEvent<HTMLDivElement>) {
    const nextPlot =
      relatedTarget instanceof Element
        ? relatedTarget.closest<HTMLElement>('[data-chart-hover]')
        : null
    if (blurHidesCard(group.id, nextPlot?.dataset.chartHover)) hide()
  }

  const plotProps = {
    role: 'slider',
    tabIndex: 0,
    'data-chart-hover': group.id,
    'aria-label': label,
    'aria-valuemin': 1,
    'aria-valuemax': valueMax,
    'aria-valuenow': valueNow,
    'aria-valuetext': sliderTextOf(readingOf(selection)),
    onKeyDown,
    onBlur,
  }

  const liveRegion = (
    <p className="visually-hidden" aria-live="polite">
      <span key={group.announcement.step}>{spoken}</span>
    </p>
  )

  return { plotProps, liveRegion, say }
}
