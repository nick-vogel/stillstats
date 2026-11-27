import type { AudienceAnswer, RangeBounds, VideoFormatFilter } from '@creator-analytics/api-types'
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { latestOnly, readAnswer } from './api.ts'
import {
  type AudienceView,
  audienceHeading,
  audienceQueryOf,
  audienceRequestOf,
  audienceViewOf,
} from './audience.ts'
import { holdAudienceColumnsOn } from './audience-columns.ts'
import {
  type AudienceRows,
  audienceRowsExpectedFor,
  audienceRowsOf,
  rememberAudienceRowsOf,
} from './audience-rows.ts'
import { Cities } from './Cities.tsx'
import { ControlsBar } from './ControlsBar.tsx'
import { Countries } from './Countries.tsx'
import { Card } from './components/ui/card.tsx'
import { Devices, OperatingSystems } from './Devices.tsx'
import { loadingText } from './loading.ts'
import {
  FiguresPlaceholder,
  LoadingStatus,
  Placeholder,
  PlaceholderBarRows,
  type PlaceholderShape,
} from './Placeholder.tsx'
import { type Navigate, type Route, useRangeFallback } from './route.ts'
import { SubscriberSplitFigures } from './SubscriberSplitFigures.tsx'
import { answerShown, cacheOf, screenShown } from './screen-timing.ts'
import { UsStates } from './UsStates.tsx'
import { AgeGroups, Genders } from './ViewerShares.tsx'

/** The Audience screen's view, its sections with the answer's window and freshness for the timing. */
type TimedAudienceView =
  | Exclude<AudienceView, { kind: 'sections' }>
  | (Extract<AudienceView, { kind: 'sections' }> & Pick<AudienceAnswer, 'window' | 'fromCache'>)

async function readAudience(channelId: string, query: string): Promise<TimedAudienceView> {
  const body = await readAnswer<AudienceAnswer>(`/api/channels/${channelId}/audience?${query}`)
  const view = audienceViewOf(body)
  if (view.kind !== 'sections') return view
  // A view of sections comes only from an answer, which carries its window and freshness.
  const { window, fromCache } = body as AudienceAnswer
  return { ...view, window, fromCache }
}

/**
 * The Audience screen's cards, in DOM order, packed by height into one container per column
 * (audience-columns.ts, creator-analytics#711), so the reading and focus order runs down the first
 * column, then the next. It renders one column in DOM order until it has measured, as SSR markup and
 * a layout-free test do, and packs in layout effects, so the cards land in their columns before
 * paint. A card that changes column is a new element, so `recheck` watches the new ones and reads
 * their heights again at the column's width.
 */
function AudienceColumns({ cards, busy }: { cards: readonly ReactNode[]; busy?: boolean }) {
  const grid = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(() => [cards.map((_, card) => card)])
  const placed = useRef(columns)
  const hold = useRef<ReturnType<typeof holdAudienceColumnsOn> | null>(null)

  useLayoutEffect(() => {
    const element = grid.current
    if (!element) return
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    const started = holdAudienceColumnsOn<Element>(
      element,
      () => cardsInDomOrder(element, placed.current),
      window.ResizeObserver,
      rem,
      setColumns,
    )
    hold.current = started
    return () => {
      started.release()
      hold.current = null
    }
  }, [])

  useLayoutEffect(() => {
    placed.current = columns
    hold.current?.recheck()
  }, [columns])

  return (
    <div ref={grid} className="audience-grid" aria-busy={busy ? 'true' : undefined}>
      {columns.map((column, index) => (
        // A column is its place, left to right, and holds no state of its own.
        // biome-ignore lint/suspicious/noArrayIndexKey: the columns have no other identity.
        <div key={index} className="audience-column">
          {column.map((card) => (
            <Fragment key={card}>{cards[card]}</Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}

/** The cards of `grid`, rendered as `columns` places them, back in DOM order. */
function cardsInDomOrder(grid: Element, columns: readonly (readonly number[])[]): Element[] {
  const inOrder: Element[] = []
  grid.querySelectorAll(':scope > .audience-column').forEach((column, index) => {
    const placedHere = columns[index] ?? []
    column.querySelectorAll(':scope > [data-slot="card"]').forEach((card, place) => {
      const domIndex = placedHere[place]
      if (domIndex !== undefined) inOrder[domIndex] = card
    })
  })
  return inOrder
}

/**
 * The place of each section the answer fills, each in its card and the cards packed as the
 * landed cards are (`AudienceColumns`), in the screen's order and in that section's shape:
 * the countries', US states' and cities' headings, bars and notes, with the US states' and the
 * cities' every format notes when `format` chooses one, as those sections show them; the age groups'
 * heading and bars, the genders' with its note; the devices' and the operating systems' headings and
 * bars; and the subscriber split's heading, two figures and bar, with no line under it. Each bars
 * section holds as many bars as `rows` says (creator-analytics#510). Each heading's and each note's
 * place holds the lines app.css measured that heading or note wrapping to at its card's width.
 */
function AudiencePlaceholder({ format, rows }: { format: VideoFormatFilter; rows: AudienceRows }) {
  const everyFormat: PlaceholderShape[] = format === 'all' ? [] : ['every-format-note']
  return (
    <AudienceColumns
      busy
      cards={[
        <BarsSectionPlaceholder
          key="countries"
          heading="countries-heading"
          rows={rows.countries}
          notes={['countries-note']}
        />,
        <BarsSectionPlaceholder
          key="us-states"
          heading="us-states-heading"
          rows={rows.usStates}
          notes={['us-states-note', ...everyFormat]}
        />,
        <BarsSectionPlaceholder
          key="cities"
          heading="cities-heading"
          rows={rows.cities}
          notes={['cities-note', ...everyFormat]}
        />,
        <BarsSectionPlaceholder key="age" heading="age-heading" rows={rows.ageGroups} notes={[]} />,
        <BarsSectionPlaceholder
          key="gender"
          heading="gender-heading"
          rows={rows.genders}
          notes={['gender-note']}
        />,
        <BarsSectionPlaceholder
          key="devices"
          heading="devices-heading"
          rows={rows.devices}
          notes={[]}
        />,
        <BarsSectionPlaceholder
          key="operating-systems"
          heading="operating-systems-heading"
          rows={rows.operatingSystems}
          notes={[]}
        />,
        <Card key="subscribers">
          <div className="video-detail-section">
            <Placeholder shape="subscribers-heading" />
            <FiguresPlaceholder count={2} />
            <Placeholder shape="bar" />
          </div>
        </Card>,
      ]}
    />
  )
}

/**
 * A bars section's place, in its card: its `heading`'s place, which holds the lines app.css
 * measured that heading wrapping to at its card's width, `rows` bars and the place of each of
 * `notes`. With no bar, the empty text's place in place of the bars and no note, as a section with
 * no bar shows its empty text and no note.
 */
function BarsSectionPlaceholder({
  heading,
  rows,
  notes,
}: {
  heading: PlaceholderShape
  rows: number
  notes: PlaceholderShape[]
}) {
  return (
    <Card>
      <div className="video-detail-section">
        <Placeholder shape={heading} />
        {rows === 0 ? (
          <Placeholder shape="audience-empty-text" />
        ) : (
          <>
            <PlaceholderBarRows rows={rows} />
            {notes.map((note) => (
              <Placeholder key={note} shape={note} />
            ))}
          </>
        )}
      </div>
    </Card>
  )
}

/**
 * The Audience screen: its visually hidden heading, the controls bar, and who watches the channel
 * over the route's calendar window and format, one card per section, the cards packed by height
 * into columns (`AudienceColumns`), read again on each change of either. It hands the answer's bounds to
 * `onBounds`, so a custom range's fields take the channel's days. While the answer is read, and
 * while the channels are read with no channel yet, it holds the place of each of the eight sections,
 * the every format notes' places included when the route chooses a format, each bars section as
 * many bars as the same read last answered on this page load, else the most it draws. With no channel it reads
 * nothing.
 */
export function Audience({
  channelId,
  route,
  navigate,
  bounds,
  onBounds,
}: {
  channelId: string | null
  route: Route
  navigate: Navigate
  bounds: RangeBounds | null
  onBounds: (bounds: RangeBounds) => void
}) {
  const [view, setView] = useState<TimedAudienceView | null>(null)
  const query = audienceQueryOf(audienceRequestOf(route)).toString()

  useEffect(() => {
    if (channelId === null) return
    setView(null)
    return latestOnly(
      readAudience(channelId, query),
      (next) => {
        if (next.kind === 'sections') {
          onBounds(next.bounds)
          // The placeholder holds the bars this read answered the next time the page reads it.
          rememberAudienceRowsOf(channelId, query, audienceRowsOf(next))
        }
        setView(next)
      },
      (message) => setView({ kind: 'refused', message }),
    )
  }, [channelId, query, onBounds])

  // Timed once the render of each landed answer commits; a refusal has no freshness to send.
  useEffect(() => screenShown('/app/audience'), [])
  useEffect(() => {
    if (view?.kind === 'sections') {
      answerShown('/app/audience', view.window, cacheOf(view.fromCache))
    }
  }, [view])

  const landed = useRangeFallback(view, route, navigate)
  return (
    <>
      <h1 className="visually-hidden">{audienceHeading}</h1>
      <ControlsBar route={route} navigate={navigate} bounds={bounds} />
      <LoadingStatus text={landed ? null : loadingText.channel} />
      {!landed ? (
        <AudiencePlaceholder
          format={route.format}
          rows={audienceRowsExpectedFor(channelId, query)}
        />
      ) : landed.kind === 'refused' ? (
        <p role="alert">{landed.message}</p>
      ) : (
        <AudienceColumns
          cards={[
            <Card key="countries">
              <Countries countries={landed.countries} />
            </Card>,
            <Card key="us-states">
              <UsStates usStates={landed.usStates} format={landed.format} />
            </Card>,
            <Card key="cities">
              <Cities cities={landed.cities} format={landed.format} />
            </Card>,
            <Card key="age">
              <AgeGroups ageGroups={landed.ageGroups} />
            </Card>,
            <Card key="gender">
              <Genders genders={landed.genders} />
            </Card>,
            <Card key="devices">
              <Devices devices={landed.devices} />
            </Card>,
            <Card key="operating-systems">
              <OperatingSystems operatingSystems={landed.operatingSystems} />
            </Card>,
            <Card key="subscribers">
              <SubscriberSplitFigures split={landed.subscriberSplit} />
            </Card>,
          ]}
        />
      )}
    </>
  )
}
