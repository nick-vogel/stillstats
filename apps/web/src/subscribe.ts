import type { BillingPlan, EntitlementsAnswer } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'

// Drafted for creator-analytics#780; the two subscribe labels are approved word for word in
// creator-analytics#913. Change them only with Nick. No price: a price shows only where it is read
// from the configured Stripe prices, as the upgrade screen's pricing cards read it, so no string
// here can disagree with Checkout.
export const subscribeTexts: Record<BillingPlan, string> = {
  monthly: 'Subscribe monthly', // approved in creator-analytics#913
  annual: 'Subscribe yearly', // approved in creator-analytics#913
}

/** The event a click on a subscribe action sends: the plan, and no price, amount, channel or user. */
export function checkoutStartedEvent(plan: BillingPlan): ProductEvent {
  return { name: 'checkout_started', plan }
}

/** The channels whose owner may start a Checkout for them, by ID: none before the answer lands. */
export function subscribableChannelsOf(answer: EntitlementsAnswer | null): ReadonlySet<string> {
  return new Set(
    answer?.channels.filter(({ canSubscribe }) => canSubscribe).map(({ channelId }) => channelId),
  )
}

// Drafted for creator-analytics#787.
/** The action that opens a paid channel's Customer Portal on Stripe. */
export const manageSubscriptionText = 'Manage subscription' // approved by Nick word for word on 2026-11-19

/**
 * The event an opened Customer Portal sends, once the API has answered its URL: no property, so no
 * channel, user or plan.
 */
export const portalOpenedEvent: ProductEvent = { name: 'customer_portal_opened' }

/** The channels whose owner may open their Customer Portal, by ID: none before the answer lands. */
export function manageableChannelsOf(answer: EntitlementsAnswer | null): ReadonlySet<string> {
  return new Set(
    answer?.channels.filter(({ canManage }) => canManage).map(({ channelId }) => channelId),
  )
}
