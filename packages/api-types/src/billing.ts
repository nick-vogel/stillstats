/** Pro's two plans: $7 a month and $70 a year (ADR 0022). */
export const billingPlans = ['monthly', 'annual'] as const
export type BillingPlan = (typeof billingPlans)[number]

/** What a channel may use under its current plan. */
export type Tier = 'free' | 'paid'

/** POST /api/channels/:channelId/checkout. */
export interface CheckoutRequest {
  plan: BillingPlan
}

/** The Stripe Checkout page the web app goes to. */
export interface CheckoutStartAnswer {
  url: string
}

/** POST /api/channels/:channelId/portal: the Stripe Customer Portal page the web app goes to. */
export interface PortalStartAnswer {
  url: string
}

export interface ChannelEntitlement {
  channelId: string
  tier: Tier
  /**
   * Whether the user may start a Checkout for it: Pro is offered, they own it, and it is
   * free, an ended channel's subscribe-again included.
   */
  canSubscribe: boolean
  /**
   * Whether the user may open its Customer Portal: Pro is offered, they own it, and it is
   * paid.
   */
  canManage: boolean
}

/** GET /api/me/entitlements: one entry for each channel the user holds. */
export interface EntitlementsAnswer {
  /** Whether Pro's settings are set, so any channel could buy it. */
  paidTierOffered: boolean
  channels: ChannelEntitlement[]
}
