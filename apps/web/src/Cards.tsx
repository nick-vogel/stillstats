import type { CSSProperties } from 'react'
import type { Card, NoConsentCard } from './cards.ts'
import type { ChartCardChoice } from './metric-charts.ts'
import { QuietButton } from './QuietButton.tsx'

/**
 * Headline numbers, each in its box: the label, the number, and its smaller lines under it. A number
 * too long for its card at full size, such as "UZS 62,193,167.99", shrinks to fit it. A card
 * with a message shows its sentence in place of the number, and its button that opens the revenue
 * consent screen at once. With a `choice`, on a screen too small to stack the charts, a card whose
 * chart the days draw chooses it: its label is a button stretched over the whole card, pressed when
 * its chart is the one that shows. A smaller line with a chart of its own, the revenue card's RPM
 * line, is a second button raised above the label's, pressed when its chart shows. The card is
 * marked when either of its charts shows.
 */
export function Cards({
  cards,
  choice,
  onGiveRevenueConsent,
}: { choice?: ChartCardChoice | undefined } & (
  | { cards: Card[]; onGiveRevenueConsent: () => void }
  | { cards: NoConsentCard[]; onGiveRevenueConsent?: undefined }
)) {
  return (
    <dl className="cards">
      {cards.map(({ label, text, detail, ratio, message, consentButton, chart, detailChart }) => {
        const chooses = chart && choice?.charts.includes(chart) ? chart : undefined
        const chosen = chooses !== undefined && choice?.chosen === chooses
        const detailChooses =
          detailChart && choice?.charts.includes(detailChart) ? detailChart : undefined
        const detailChosen = detailChooses !== undefined && choice?.chosen === detailChooses
        return (
          <div
            key={label}
            className={
              chooses === undefined
                ? 'card'
                : `card card-chooser${chosen || detailChosen ? ' card-chosen' : ''}`
            }
          >
            <dt>
              {chooses === undefined ? (
                label
              ) : (
                <button
                  type="button"
                  className="card-choose"
                  aria-pressed={chosen}
                  onClick={() => choice?.choose(chooses)}
                >
                  {label}
                </button>
              )}
            </dt>
            {message ? (
              <dd className="card-message">{text}</dd>
            ) : (
              // Its length in characters, so the stylesheet shrinks a long amount to the card.
              <dd className="card-number" style={{ '--chars': text.length } as CSSProperties}>
                {text}
              </dd>
            )}
            {detail && (
              <dd className="card-detail">
                {detailChooses === undefined ? (
                  detail
                ) : (
                  <button
                    type="button"
                    className="card-choose-detail"
                    aria-pressed={detailChosen}
                    onClick={() => choice?.choose(detailChooses)}
                  >
                    {detail}
                  </button>
                )}
              </dd>
            )}
            {ratio === null && <dd className="card-detail" aria-hidden="true" />}
            {ratio && (
              // A screen reader reads the words, with "times" for the "×" sign it may not read so.
              <dd className="card-detail">
                <span aria-hidden="true">{ratio.text}</span>
                <span className="visually-hidden">{ratio.spoken}</span>
              </dd>
            )}
            {consentButton && onGiveRevenueConsent && (
              <dd className="card-message">
                <QuietButton onClick={onGiveRevenueConsent}>{consentButton}</QuietButton>
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}
