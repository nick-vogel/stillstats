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

/** The control under an owned channel that picks it for a Pro slot, or takes it out of its one. */
export type PickControl = 'pick' | 'unpick'

/** What the Settings screen shows under a channel the user owns. */
export interface ProChannel {
  /** Whether it is Pro, which the line under the channel says. */
  tier: Tier
  /** Whether the user picked it for one of their slots. */
  picked: boolean
  /** The day its stored history is deleted on, ISO 8601, while it is ahead; else null. */
  purgeDate: string | null
  /** Its pick or unpick control, or null for a user without a block, who has no slot to fill. */
  control: PickControl | null
  /** Whether it stays free because every slot is in use, which the screen says under it. */
  slotsFull: boolean
}

/** What the Settings screen shows of the user's Pro, from the entitlements answer. */
export interface ProSection {
  /** Whether the user may start a Checkout, so the section shows a subscribe action for each plan. */
  canSubscribe: boolean
  /** Whether the user may open their Customer Portal, so the section shows "Manage subscription". */
  canManage: boolean
  /** The blocks the user holds, 4 slots each: the section says the slots in use once there is one. */
  blocks: number
  slotsInUse: number
  /** Each channel the user owns, by ID. */
  channels: ReadonlyMap<string, ProChannel>
}

/** The slots each block of Pro holds, as `slotsPerBlock` in `@creator-analytics/entitlements`. */
const slotsPerBlock = 4

/**
 * The Settings screen's Pro section: null before the answer lands, with Pro not offered, so Settings
 * draws as it did before Pro, and for a user with nothing in it, who may neither subscribe nor
 * manage and holds no block, such as a member who owns none of their channels. While the user
 * holds a block, each owned channel gets its control: unpick for a picked one, pick for any other,
 * which the API refuses while every slot is in use.
 */
export function proSectionOf(answer: EntitlementsAnswer | null): ProSection | null {
  if (!answer?.paidTierOffered) return null
  const { canSubscribe, canManage, blocks, slotsInUse } = answer
  if (!canSubscribe && !canManage && blocks === 0) return null
  const slotsFull = blocks > 0 && slotsInUse >= blocks * slotsPerBlock
  const channels = new Map(
    answer.channels
      .filter(({ owner }) => owner)
      .map(({ channelId, tier, picked, purgeDate }) => {
        const control: PickControl | null = blocks === 0 ? null : picked ? 'unpick' : 'pick'
        const channel = {
          tier,
          picked,
          purgeDate,
          control,
          slotsFull: slotsFull && tier === 'free' && !picked,
        }
        return [channelId, channel]
      }),
  )
  return { canSubscribe, canManage, blocks, slotsInUse, channels }
}
