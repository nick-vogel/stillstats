import type { BillingPlan, UpgradeAnswer } from '@creator-analytics/api-types'
import { useEffect, useRef, useState } from 'react'
import { track } from './analytics.ts'
import { latestOnly, readAnswer } from './api.ts'
import { refusalMessageOf } from './refusals.ts'
import type { Route } from './route.ts'
import { subscribeTexts } from './subscribe.ts'
import {
  type Pricing,
  planTexts,
  pricingOf,
  readyLineOf,
  startLinesOf,
  type UpgradeFeature,
  upgradeFeatures,
  upgradeText,
  upgradeViewedEvent,
} from './upgrade.ts'

type UpgradeView =
  | { kind: 'comparisons'; answer: UpgradeAnswer }
  | { kind: 'refused'; message: string }

async function readUpgrade(channelId: string, format: Route['format']): Promise<UpgradeView> {
  const query = format === 'all' ? '' : `?format=${format}`
  const body = await readAnswer<UpgradeAnswer>(`/api/channels/${channelId}/upgrade${query}`)
  if ('refusal' in body || 'error' in body) {
    return { kind: 'refused', message: refusalMessageOf(body, 'the upgrade') }
  }
  return { kind: 'comparisons', answer: body }
}

/**
 * The Upload comparisons card's count: how many of the channel's uploads are ready for review
 * today, the larger comparison's, from 2, and today's start date line for each comparison under 2,
 * for the list's format. Nothing until the answer lands, or when it is refused.
 */
function ComparisonCounts({ answer }: { answer: UpgradeAnswer }) {
  const ready = readyLineOf(answer.comparisons)
  const lines = startLinesOf(answer.comparisons)
  if (ready === null && lines.length === 0) return null
  return (
    <ul className="upgrade-comparisons">
      {ready !== null && <li className="upgrade-ready">{ready}</li>}
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function FeatureCard({
  feature,
  answer,
}: {
  feature: UpgradeFeature
  answer: UpgradeAnswer | null
}) {
  const className =
    feature.key === 'next' ? 'upgrade-feature upgrade-feature-next' : 'upgrade-feature'
  return (
    <li className={className}>
      <h2>{feature.title}</h2>
      {feature.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {feature.key === 'comparisons' && answer && <ComparisonCounts answer={answer} />}
    </li>
  )
}

/**
 * The two pricing cards, Monthly and the recommended Yearly, with the amounts of the configured
 * Stripe prices. With no prices each card keeps its name, its button and any line that names no
 * amount, and shows no amount and no badge.
 */
function PricingCards({
  pricing,
  onSubscribe,
}: {
  pricing: Pricing
  onSubscribe: (plan: BillingPlan) => void
}) {
  const { monthly, annual } = planTexts
  return (
    <>
      <ul className="upgrade-plans">
        <li className="upgrade-plan">
          <h2>{monthly.name}</h2>
          {pricing.monthly !== null && (
            <p className="upgrade-price">
              <span className="upgrade-amount">{pricing.monthly}</span>{' '}
              <span className="upgrade-period">{monthly.period}</span>
            </p>
          )}
          <p className="upgrade-plan-detail">{monthly.detail}</p>
          <button
            className="button button-outline"
            type="button"
            onClick={() => onSubscribe('monthly')}
          >
            {subscribeTexts.monthly}
          </button>
        </li>
        <li className="upgrade-plan upgrade-plan-recommended">
          <h2>{annual.name}</h2>
          {pricing.saving !== null && (
            <p className="upgrade-badge">{annual.badge(pricing.saving)}</p>
          )}
          {pricing.annual !== null && (
            <p className="upgrade-price">
              <span className="upgrade-amount">{pricing.annual}</span>{' '}
              <span className="upgrade-period">{annual.period}</span>
            </p>
          )}
          {pricing.annualPerMonth !== null && (
            <p className="upgrade-plan-detail">{annual.detail(pricing.annualPerMonth)}</p>
          )}
          <button className="button" type="button" onClick={() => onSubscribe('annual')}>
            {subscribeTexts.annual}
          </button>
        </li>
      </ul>
      <p className="upgrade-prices-note">{upgradeText.pricesNote}</p>
      <p className="upgrade-prices-note">{upgradeText.pricesChangeNote}</p>
    </>
  )
}

/**
 * The upgrade screen: the eyebrow, the heading and the line under it, then the feature cards,
 * the Upload comparisons one with the channel's own count for the list's format. Its owner
 * (`canUpgrade`) gets the two pricing cards once the channel's first answer lands, whose
 * buttons open Checkout as Settings' do; another member, or a paid channel, gets none. It sends
 * `upgrade_screen_viewed` once each time it opens for a channel.
 */
export function Upgrade({
  channelId,
  route,
  canUpgrade,
  onSubscribe,
}: {
  /** Null while the channels or the preferences are read. */
  channelId: string | null
  route: Route
  /** Whether the user may subscribe the channel: its owner, while it is free and Pro is offered. */
  canUpgrade: boolean
  onSubscribe: (plan: BillingPlan) => void
}) {
  const [view, setView] = useState<UpgradeView | null>(null)
  // The prices of the channel's latest answer, which a format change keeps while the next answer
  // loads: none until the first answer for the channel lands, so no pricing card shows before it.
  // A refusal keeps the cards with no amount, so the owner can still subscribe.
  const [prices, setPrices] = useState<{
    channelId: string
    prices: UpgradeAnswer['prices']
  } | null>(null)
  const { format } = route

  // Once for each channel the screen opens on: a re-render or a late entitlements answer sends
  // nothing more. The ref outlives StrictMode's second effect.
  const viewedFor = useRef<string | null>(null)
  useEffect(() => {
    if (channelId === null || viewedFor.current === channelId) return
    viewedFor.current = channelId
    track(upgradeViewedEvent)
  }, [channelId])

  useEffect(() => {
    if (channelId === null) return
    setView(null)
    const show = (next: UpgradeView) => {
      setView(next)
      setPrices({ channelId, prices: next.kind === 'comparisons' ? next.answer.prices : null })
    }
    return latestOnly(readUpgrade(channelId, format), show, (message) =>
      show({ kind: 'refused', message }),
    )
  }, [channelId, format])

  const answer = view?.kind === 'comparisons' ? view.answer : null
  return (
    <div className="upgrade">
      <div className="upgrade-intro">
        <p className="upgrade-eyebrow">{upgradeText.eyebrow}</p>
        <h1>{upgradeText.heading}</h1>
        <p>{upgradeText.pitch}</p>
      </div>
      {view?.kind === 'refused' && <p role="alert">{view.message}</p>}
      <ul className="upgrade-features">
        {upgradeFeatures.map((feature) => (
          <FeatureCard key={feature.key} feature={feature} answer={answer} />
        ))}
      </ul>
      {canUpgrade && prices !== null && prices.channelId === channelId && (
        <PricingCards pricing={pricingOf(prices.prices)} onSubscribe={onSubscribe} />
      )}
    </div>
  )
}
