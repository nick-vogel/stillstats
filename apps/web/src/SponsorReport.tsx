import {
  channelNameOf,
  type ErrorAnswer,
  type ListedChannel,
  type RefusalAnswer,
  type SponsorReportAnswer,
  type SponsorReportFigure,
} from '@creator-analytics/api-types'
import { useEffect, useRef, useState } from 'react'
import { track } from './analytics.ts'
import { latestOnly, readAnswer } from './api.ts'
import { loadingText } from './loading.ts'
import { LoadingStatus } from './Placeholder.tsx'
import { notProcessedText } from './processing.ts'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToVideo } from './route.ts'
import {
  backToVideoText,
  nextChoiceOf,
  type SponsorReportView,
  savePdfText,
  sponsorChecklistOf,
  sponsorChoiceFailureOf,
  sponsorChoiceLegend,
  sponsorChoicePathOf,
  sponsorDataThroughOf,
  sponsorExportEventOf,
  sponsorPublishedOf,
  sponsorReportPathOf,
  sponsorReportText,
  sponsorReportViewOf,
  sponsorSourceLine,
  sponsorTableOf,
} from './sponsor-report.ts'
import { Thumbnail } from './Thumbnail.tsx'
import { detailThumbnailSizes } from './thumbnail.ts'

async function readSponsorReport(channelId: string, video: string): Promise<SponsorReportView> {
  return sponsorReportViewOf(
    await readAnswer<SponsorReportAnswer>(sponsorReportPathOf(channelId, video)),
  )
}

/** Stores the channel's figure choice: null once stored, else the refusal's text. */
async function saveSponsorChoice(
  channelId: string,
  figures: SponsorReportFigure[],
): Promise<string | null> {
  try {
    const response = await fetch(sponsorChoicePathOf(channelId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ figures }),
    })
    if (response.ok) return null
    return sponsorChoiceFailureOf((await response.json()) as RefusalAnswer | ErrorAnswer)
  } catch {
    return sponsorChoiceFailureOf({ error: 'internal' })
  }
}

/**
 * The checklist of the figures the report shows, never printed. `chosen` is the choice on screen,
 * which runs ahead of the answer while a save and the next read are on their way.
 */
function SponsorChoice({
  answer,
  chosen,
  onChoose,
}: {
  answer: SponsorReportAnswer
  chosen: readonly SponsorReportFigure[]
  onChoose: (figures: SponsorReportFigure[]) => void
}) {
  return (
    <fieldset className="sponsor-report-choice">
      <legend>{sponsorChoiceLegend}</legend>
      <div className="sponsor-report-choice-options">
        {sponsorChecklistOf(answer, chosen).map(({ figure, label, checked, disabled }) => (
          <label key={figure}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={({ target }) => onChoose(nextChoiceOf(chosen, figure, target.checked))}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** The figures by window, or for a video Google has not processed, its text in their place. */
function SponsorReportTable({ answer }: { answer: SponsorReportAnswer }) {
  if (answer.awaitingProcessing) return <p>{notProcessedText}</p>
  const { headings, rows, historyNote } = sponsorTableOf(answer)
  return (
    <>
      <table className="sponsor-report-table">
        <thead>
          <tr>
            <th scope="col" className="sponsor-report-cell sponsor-report-label">
              <span className="visually-hidden">Figure</span>
            </th>
            {headings.map(({ heading, note }) => (
              <th scope="col" className="sponsor-report-cell" key={heading}>
                {heading}
                {note && <span className="note sponsor-report-days">{note}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, cells }) => (
            <tr key={label}>
              <th scope="row" className="sponsor-report-cell sponsor-report-label">
                {label}
              </th>
              {cells.map((cell, i) => (
                // A row's cells are one per window, in a fixed order.
                // biome-ignore lint/suspicious/noArrayIndexKey: the window's place is its identity
                <td className="sponsor-report-cell" key={i}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {historyNote && <p className="note">{historyNote}</p>}
    </>
  )
}

/**
 * A video's sponsor report, a page made to print: the channel's name, the video's thumbnail,
 * title and publish date, its figures over its first 7, 14 and 30 days, the day the data runs
 * through, and where the figures come from. "Save as PDF" opens the browser's print dialog, and
 * the print stylesheet hides the shell, the link back, the button and the figure checklist
 * (app.css). A tick in the checklist stores the channel's choice, then reads the report again,
 * which keeps showing until the new one answers.
 */
export function SponsorReport({
  channel,
  video,
  route,
  navigate,
}: {
  /** The channel on view, or null while it is read. */
  channel: ListedChannel | null
  video: string
  route: Route
  navigate: Navigate
}) {
  const channelId = channel?.id ?? null
  const [view, setView] = useState<SponsorReportView | null>(null)
  // The choice on screen while its save and the next read are on their way, and a refused save's
  // text. Each read or save takes the next turn, so only the latest one lands.
  const [pending, setPending] = useState<SponsorReportFigure[] | null>(null)
  const [choiceFailure, setChoiceFailure] = useState<string | null>(null)
  const turn = useRef(0)
  useEffect(() => {
    if (channelId === null) return
    turn.current += 1
    setView(null)
    setPending(null)
    setChoiceFailure(null)
    return latestOnly(readSponsorReport(channelId, video), setView, (message) =>
      setView({ kind: 'refused', message }),
    )
  }, [channelId, video])
  const answer = view?.kind === 'report' && view.answer.video.id === video ? view.answer : null

  async function choose(figures: SponsorReportFigure[]): Promise<void> {
    if (channelId === null) return
    turn.current += 1
    const mine = turn.current
    setPending(figures)
    setChoiceFailure(null)
    const failure = await saveSponsorChoice(channelId, figures)
    if (turn.current !== mine) return
    if (failure !== null) {
      setPending(null)
      setChoiceFailure(failure)
      return
    }
    const next = await readSponsorReport(channelId, video)
    if (turn.current !== mine) return
    setPending(null)
    if (next.kind === 'report') setView(next)
    else setChoiceFailure(next.message)
  }

  return (
    <section className="sponsor-report" aria-label={sponsorReportText}>
      <div className="sponsor-report-actions">
        <RouteLink route={routeToVideo(route, video)} navigate={navigate}>
          {backToVideoText}
        </RouteLink>
        {answer && (
          <button
            className="button"
            type="button"
            onClick={() => {
              track(sponsorExportEventOf(answer))
              window.print()
            }}
          >
            {savePdfText}
          </button>
        )}
      </div>
      <LoadingStatus text={view === null ? loadingText.video : null} />
      {view?.kind === 'refused' && <p role="alert">{view.message}</p>}
      {answer && (
        <>
          <SponsorChoice
            answer={answer}
            chosen={pending ?? answer.figures}
            onChoose={(figures) => void choose(figures)}
          />
          {choiceFailure && (
            <p role="alert" className="sponsor-report-choice-failure">
              {choiceFailure}
            </p>
          )}
          {channel && <p className="sponsor-report-channel">{channelNameOf(channel)}</p>}
          <div className="sponsor-report-head">
            <Thumbnail
              url={answer.video.thumbnailUrl}
              thumbnails={answer.video.thumbnails}
              sizes={detailThumbnailSizes}
              durationSeconds={null}
              className="sponsor-report-thumbnail"
            />
            <div>
              <h1>{answer.video.title}</h1>
              <p>{sponsorPublishedOf(answer.video)}</p>
            </div>
          </div>
          <SponsorReportTable answer={answer} />
          <p className="note">{sponsorDataThroughOf(answer)}</p>
          <p className="note">{sponsorSourceLine}</p>
        </>
      )}
    </section>
  )
}
