import type { PlanPrice } from './upgrade.ts'

/** Pro's two plans: $7 a month and $70 a year (ADR 0022). */
export const billingPlans = ['monthly', 'annual'] as const
export type BillingPlan = (typeof billingPlans)[number]

/** What a channel may use under its current plan. */
export type Tier = 'free' | 'paid'

/** POST /api/me/checkout, and its alias POST /api/channels/:channelId/checkout. */
export interface CheckoutRequest {
  plan: BillingPlan
}

/** The Stripe Checkout page the web app goes to. */
export interface CheckoutStartAnswer {
  url: string
}

/**
 * POST /api/me/portal, and its alias POST /api/channels/:channelId/portal: the Stripe Customer
 * Portal page the web app goes to.
 */
export interface PortalStartAnswer {
  url: string
}

export interface ChannelEntitlement {
  channelId: string
  tier: Tier
  /** Whether the user owns it, so it can take one of their Pro slots. */
  owner: boolean
  /** Whether the user picked it for one of their Pro slots; false for a channel they don't own. */
  picked: boolean
  /** The purge date of an ended channel, ISO 8601, while it is ahead; null for any other. */
  purgeDate: string | null
  /**
   * Whether the user may start a Checkout from it: they own it, it is free, and they may
   * subscribe (`EntitlementsAnswer.canSubscribe`).
   */
  canSubscribe: boolean
  /** Whether the user may open the Customer Portal from it: they own it, it is paid, and they may manage. */
  canManage: boolean
}

/**
 * GET /api/me/entitlements: the user's Pro, and one entry for each channel the user holds. PUT and
 * DELETE /api/channels/:channelId/pro-pick, the owner's pick and unpick of a channel for one of
 * their Pro slots, answer it too, after the change.
 */
export interface EntitlementsAnswer {
  /** Whether Pro's settings are set, so any channel could buy it. */
  paidTierOffered: boolean
  /**
   * Whether the user may start a Checkout: Pro is offered, they own a channel, and they hold no
   * live subscription, an ended one's subscribe-again included.
   */
  canSubscribe: boolean
  /** Whether the user may open the Customer Portal: Pro is offered and they hold a live subscription. */
  canManage: boolean
  /**
   * Whether the user may add a block from Settings: Pro is offered and they hold a live paid
   * subscription of their own, `active` or `past_due`. A user without one subscribes through
   * Checkout instead (`canSubscribe`).
   */
  canAddBlock: boolean
  /** The blocks of the user's live paid subscription, each 4 channel slots; 0 without one. */
  blocks: number
  /** The slots their picked channels take, at most 4 for each block. */
  slotsInUse: number
  channels: ChannelEntitlement[]
}

/**
 * GET /api/me/block-preview: what one more block costs, read from Stripe before the confirm. The
 * price is the subscription's own (ADR 0022 keeps it on a rise), and the prorated charge for the
 * rest of the paid period goes on the next invoice, with no charge now.
 */
export interface BlockPreviewAnswer {
  /** The number of blocks after the add, the count the confirm sends back. */
  blocks: number
  /** The plan the price bills at, which says its period. */
  plan: BillingPlan
  /** The price of one block for each period. */
  price: PlanPrice
  /** The prorated charge for the new block's rest of the current period, on the next invoice. */
  prorated: PlanPrice
  /** The end of the current paid period, ISO 8601, when the next invoice comes. */
  periodEnd: string
}

/** POST /api/me/blocks: the block count the preview answered, which the add raises the quantity to. */
export interface BlockAddRequest {
  blocks: number
}

/** POST /api/me/blocks: the user's blocks after the add, usable at once. */
export interface BlockAddAnswer {
  blocks: number
}
