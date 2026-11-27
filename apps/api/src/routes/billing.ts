import {
  billingPlans,
  type CheckoutStartAnswer,
  type EntitlementsAnswer,
  type ErrorAnswer,
  type PortalStartAnswer,
} from '@creator-analytics/api-types'
import {
  entitlementOf,
  heldChannelsOf,
  portalCustomerOf,
  stripeCustomerOf,
} from '@creator-analytics/entitlements'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { channelIdOf, refuse, type SignedIn } from '../signed-in.ts'

/** The plan a Checkout request names, or undefined for a body that names none. */
async function requestedPlan(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const plan = typeof body === 'object' && body !== null && 'plan' in body ? body.plan : undefined
  return billingPlans.find((each) => each === plan)
}

/**
 * GET /api/me/entitlements: whether Pro is offered, each channel the user holds, its
 * tier, and whether the user may start a Checkout for it or open its Customer Portal.
 * POST /api/channels/:channelId/checkout: opens Stripe's Checkout for the channel's Pro subscription and
 * answers its URL, which the web app goes to, as it goes to Google's consent. Only the channel's
 * owner may, and only for a free channel, an ended one included (ADR 0022).
 * POST /api/channels/:channelId/portal: opens Stripe's Customer Portal for the channel's customer
 * and answers its URL. Only the channel's owner may, and only for a paid channel: an ended one
 * subscribes again through Checkout. Without Pro's settings, both routes answer 404 as an
 * unknown route does, and no channel may subscribe or manage.
 */
export function billingRoute(
  signedIn: Hono<SignedIn>,
  { billing, database }: Pick<ApiDependencies, 'billing' | 'database'>,
): void {
  signedIn.get('/me/entitlements', async (c) => {
    const answer = await database.asUser(c.get('user').id, async (tx) => {
      const channels: EntitlementsAnswer['channels'] = []
      for (const { channelId, owner } of await heldChannelsOf(tx)) {
        const { tier } = await entitlementOf(tx, channelId)
        channels.push({
          channelId,
          tier,
          canSubscribe: billing !== undefined && owner && tier === 'free',
          canManage: billing !== undefined && owner && tier === 'paid',
        })
      }
      return { paidTierOffered: billing !== undefined, channels }
    })
    return c.json(answer satisfies EntitlementsAnswer)
  })

  signedIn.post('/channels/:channelId/checkout', async (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const plan = await requestedPlan(c.req.raw)
    if (!plan) return c.json({ error: 'invalid_plan' } satisfies ErrorAnswer, 400)
    const checked = await database.asUser(c.get('user').id, async (tx) => {
      const held = (await heldChannelsOf(tx)).find((each) => each.channelId === channelId)
      if (!held) return { refusal: 'not_connected' } as const
      if (!held.owner) return { refusal: 'not_owner' } as const
      if ((await entitlementOf(tx, channelId)).tier === 'paid') {
        return { refusal: 'already_subscribed' } as const
      }
      return { customerId: await stripeCustomerOf(tx, channelId) }
    })
    if ('refusal' in checked) return refuse(c, checked.refusal)
    // Outside the transaction, so a slow Stripe never holds one open.
    const url = await billing.startCheckout({ channelId, plan, customerId: checked.customerId })
    return c.json({ url } satisfies CheckoutStartAnswer)
  })

  signedIn.post('/channels/:channelId/portal', async (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const checked = await database.asUser(c.get('user').id, async (tx) => {
      const held = (await heldChannelsOf(tx)).find((each) => each.channelId === channelId)
      if (!held) return { refusal: 'not_connected' } as const
      if (!held.owner) return { refusal: 'not_owner' } as const
      const customerId = await portalCustomerOf(tx, channelId)
      if (customerId === null) return { refusal: 'not_subscribed' } as const
      return { customerId }
    })
    if ('refusal' in checked) return refuse(c, checked.refusal)
    // Outside the transaction, as the Checkout's.
    const url = await billing.openPortal({ customerId: checked.customerId })
    return c.json({ url } satisfies PortalStartAnswer)
  })
}
