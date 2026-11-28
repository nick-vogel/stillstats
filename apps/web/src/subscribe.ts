import type { BillingPlan, EntitlementsAnswer, Tier } from '@creator-analytics/api-types'
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

// Drafted for creator-analytics#787.
/** The action that opens the user's Customer Portal on Stripe. */
export const manageSubscriptionText = 'Manage subscription' // approved by Nick word for word on 2026-11-19

/**
 * The event an opened Customer Portal sends, once the API has answered its URL: no property, so no
 * channel, user or plan.
 */
export const portalOpenedEvent: ProductEvent = { name: 'customer_portal_opened' }

/** What the Settings screen shows of the user's Pro, from the entitlements answer. */
export interface ProSection {
  /** Whether the user may start a Checkout, so the section shows a subscribe action for each plan. */
  canSubscribe: boolean
  /** Whether the user may open their Customer Portal, so the section shows "Manage subscription". */
  canManage: boolean
  /** The blocks the user holds, 4 slots each: the section says the slots in use once there is one. */
  blocks: number
  slotsInUse: number
  /** The tier of each channel the user owns, by ID, which the line under the channel says. */
  tiers: ReadonlyMap<string, Tier>
}

/**
 * The Settings screen's Pro section: null before the answer lands, with Pro not offered, so Settings
 * draws as it did before Pro, and for a user with nothing in it, who may neither subscribe nor
 * manage and holds no block, such as a member who owns none of their channels.
 */
export function proSectionOf(answer: EntitlementsAnswer | null): ProSection | null {
  if (!answer?.paidTierOffered) return null
  const { canSubscribe, canManage, blocks, slotsInUse } = answer
  if (!canSubscribe && !canManage && blocks === 0) return null
  const tiers = new Map(
    answer.channels.filter(({ owner }) => owner).map(({ channelId, tier }) => [channelId, tier]),
  )
  return { canSubscribe, canManage, blocks, slotsInUse, tiers }
}
