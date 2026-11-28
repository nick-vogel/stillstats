import {
  type BlockAddAnswer,
  type BlockPreviewAnswer,
  billingPlans,
  type CheckoutStartAnswer,
  type EntitlementsAnswer,
  type ErrorAnswer,
  type PortalStartAnswer,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import {
  blockSubscriptionOf,
  entitlementOf,
  heldChannelsOf,
  pickProChannel,
  portalCustomerOf,
  proAccountOf,
  recordSubscription,
  stripeCustomerOf,
  unpickProChannel,
} from '@creator-analytics/entitlements'
import type { Context, Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { channelIdOf, refuse, type SignedIn } from '../signed-in.ts'
import { subscriptionSnapshotOf } from '../stripe-events.ts'

/** The plan a Checkout request names, or undefined for a body that names none. */
async function requestedPlan(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const plan = typeof body === 'object' && body !== null && 'plan' in body ? body.plan : undefined
  return billingPlans.find((each) => each === plan)
}

/** The block count an add names, or undefined for a body with no positive integer `blocks`. */
async function requestedBlocks(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const blocks =
    typeof body === 'object' && body !== null && 'blocks' in body ? body.blocks : undefined
  return typeof blocks === 'number' && Number.isInteger(blocks) && blocks >= 1 ? blocks : undefined
}

type Checked<T> =
  | { refusal: 'not_connected' | 'not_owner' | 'already_subscribed' | 'not_subscribed' }
  | T

/**
 * Whether the user may open Checkout: they own a channel, which only an owner may buy Pro for,
 * and hold no live subscription, which a second one would bill twice. Answers their customer, kept
 * from an ended subscription, so a return buys as the same customer.
 */
async function checkoutCheck(tx: Scoped<'user'>): Promise<Checked<{ customerId: string | null }>> {
  const account = await proAccountOf(tx)
  if (account.ownedChannels.length === 0) return { refusal: 'not_owner' }
  if (account.subscribed) return { refusal: 'already_subscribed' }
  return { customerId: await stripeCustomerOf(tx) }
}

/** Whether the user may open the Customer Portal: they hold a live subscription. */
async function portalCheck(tx: Scoped<'user'>): Promise<Checked<{ customerId: string }>> {
  const customerId = await portalCustomerOf(tx)
  if (customerId === null) return { refusal: 'not_subscribed' }
  return { customerId }
}

/**
 * Whether the user holds the channel a route of the release before blocks names, and owns it, as
 * that route checked before it opened Checkout or the Portal for the channel.
 */
async function ownedChannelCheck(tx: Scoped<'user'>, channelId: string) {
  const held = (await heldChannelsOf(tx)).find((each) => each.channelId === channelId)
  if (!held) return { refusal: 'not_connected' } as const
  if (!held.owner) return { refusal: 'not_owner' } as const
  return null
}

/**
 * The user's Pro as Settings draws it: whether Pro is offered, their paid blocks, their grants and
 * slots in use,
 * whether they may start a Checkout or open the Customer Portal, and each channel they hold, its
 * tier, whether they own and picked it, and its purge date.
 */
async function entitlementsAnswerOf(
  tx: Scoped<'user'>,
  billing: ApiDependencies['billing'],
): Promise<EntitlementsAnswer> {
  const account = await proAccountOf(tx)
  const canSubscribe =
    billing !== undefined && account.ownedChannels.length > 0 && !account.subscribed
  const canManage = billing !== undefined && account.subscribed
  const canAddBlock = billing !== undefined && (await blockSubscriptionOf(tx)) !== null
  const channels: EntitlementsAnswer['channels'] = []
  for (const { channelId, owner } of await heldChannelsOf(tx)) {
    const { tier, purgeDate } = await entitlementOf(tx, channelId)
    const picked = account.ownedChannels.some((each) => each.channelId === channelId && each.picked)
    channels.push({
      channelId,
      tier,
      owner,
      picked,
      purgeDate: purgeDate?.toISOString() ?? null,
      canSubscribe: canSubscribe && owner && tier === 'free',
      canManage: canManage && owner && tier === 'paid',
    })
  }
  return {
    paidTierOffered: billing !== undefined,
    canSubscribe,
    canManage,
    canAddBlock,
    blocks: account.blocks,
    grants: account.grants.map(({ blocks, endsAt }) => ({
      blocks,
      endsAt: endsAt?.toISOString() ?? null,
    })),
    slotsInUse: account.slotsInUse,
    channels,
  }
}

/**
 * GET /api/me/entitlements: whether Pro is offered, the user's blocks and slots in use, whether
 * they may start a Checkout or open the Customer Portal, and each channel they hold, its tier,
 * whether they own and picked it, and its purge date.
 * POST /api/me/checkout: opens Stripe's Checkout for the user's Pro subscription, one block, and
 * answers its URL, which the web app goes to, as it goes to Google's consent. Only a user who owns
 * a channel may, and only without a live subscription, an ended one's subscribe-again included
 * (ADR 0022, ADR 0024).
 * POST /api/me/portal: opens Stripe's Customer Portal for the user's customer and answers its URL.
 * Only a user with a live subscription may: an ended one subscribes again through Checkout.
 * POST /api/channels/:channelId/checkout and /portal: the routes of the release before blocks,
 * kept for a tab opened before the deploy. Each checks the user holds and owns the channel, as it
 * did, then does what the user's route does.
 * GET /api/me/block-preview: what one more block costs, read from Stripe: the subscription's own
 * price, and the prorated charge for the rest of the paid period, on the next invoice.
 * POST /api/me/blocks `{ blocks }`: raises the user's subscription to the block count the preview
 * answered, with its proration on the next invoice, and records Stripe's answer at once, so the
 * new slots fill and count before it answers `{ blocks }`. 409 `blocks_changed` for a count other
 * than one more than Stripe holds. Both are only for the user's own live paid subscription: a
 * member of a paid channel holds none, and a user without one is refused 409 `not_subscribed`
 * and subscribes through Checkout instead (stillstats#22).
 * PUT /api/channels/:channelId/pro-pick: the owner picks the channel for one of their Pro slots;
 * 409 `no_free_slot` without a free slot of a live paid subscription, so a swap takes another
 * channel out first.
 * DELETE /api/channels/:channelId/pro-pick: the owner takes the channel out, which frees its slot
 * and, for a channel that was Pro, starts its 30 days to its purge date. Both answer 404
 * `not_connected` for a channel the user does not hold and 403 `not_owner` for one they do not
 * own, and otherwise the GET's answer after the change, so Settings redraws from it.
 * Without Pro's settings, every route but the answer answers 404 as an unknown route does, and no
 * one may subscribe, manage or pick.
 */
export function billingRoute(
  signedIn: Hono<SignedIn>,
  { billing, database }: Pick<ApiDependencies, 'billing' | 'database'>,
): void {
  signedIn.get('/me/entitlements', async (c) => {
    const answer = await database.asUser(c.get('user').id, (tx) =>
      entitlementsAnswerOf(tx, billing),
    )
    return c.json(answer satisfies EntitlementsAnswer)
  })

  async function startCheckout(c: Context<SignedIn>, channelId?: string) {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const plan = await requestedPlan(c.req.raw)
    if (!plan) return c.json({ error: 'invalid_plan' } satisfies ErrorAnswer, 400)
    const userId = c.get('user').id
    const checked = await database.asUser(userId, async (tx) => {
      const refused = channelId && (await ownedChannelCheck(tx, channelId))
      return refused || checkoutCheck(tx)
    })
    if ('refusal' in checked) return refuse(c, checked.refusal)
    // Outside the transaction, so a slow Stripe never holds one open.
    const url = await billing.startCheckout({ userId, plan, customerId: checked.customerId })
    return c.json({ url } satisfies CheckoutStartAnswer)
  }

  async function openPortal(c: Context<SignedIn>, channelId?: string) {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const checked = await database.asUser(c.get('user').id, async (tx) => {
      const refused = channelId && (await ownedChannelCheck(tx, channelId))
      return refused || portalCheck(tx)
    })
    if ('refusal' in checked) return refuse(c, checked.refusal)
    // Outside the transaction, as the Checkout's.
    const url = await billing.openPortal({ customerId: checked.customerId })
    return c.json({ url } satisfies PortalStartAnswer)
  }

  signedIn.post('/me/checkout', (c) => startCheckout(c))
  signedIn.post('/me/portal', (c) => openPortal(c))

  signedIn.post('/channels/:channelId/checkout', (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    return startCheckout(c, channelId)
  })
  signedIn.post('/channels/:channelId/portal', (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    return openPortal(c, channelId)
  })

  async function changePick(c: Context<SignedIn>, change: typeof pickProChannel) {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const answer = await database.asUser(c.get('user').id, async (tx) => {
      const changed = await change(tx, channelId)
      return changed.ok ? entitlementsAnswerOf(tx, billing) : changed
    })
    if ('refusal' in answer) return refuse(c, answer.refusal)
    return c.json(answer satisfies EntitlementsAnswer)
  }

  signedIn.get('/me/block-preview', async (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const block = await database.asUser(c.get('user').id, blockSubscriptionOf)
    if (!block) return refuse(c, 'not_subscribed')
    // Outside the transaction, as the Checkout's.
    const preview = await billing.previewBlock({ subscriptionId: block.subscription })
    return c.json({
      blocks: preview.blocks,
      plan: preview.plan,
      price: preview.price,
      prorated: preview.prorated,
      periodEnd: preview.periodEnd.toISOString(),
    } satisfies BlockPreviewAnswer)
  })

  signedIn.post('/me/blocks', async (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const blocks = await requestedBlocks(c.req.raw)
    if (blocks === undefined) return c.json({ error: 'invalid_blocks' } satisfies ErrorAnswer, 400)
    const block = await database.asUser(c.get('user').id, blockSubscriptionOf)
    if (!block) return refuse(c, 'not_subscribed')
    // Outside the transaction, as the Checkout's.
    const added = await billing.addBlock({ subscriptionId: block.subscription, blocks })
    if (added.kind === 'blocks_changed') return refuse(c, 'blocks_changed')
    // Stripe's answer, recorded now through the webhook's own write and its own reading of the
    // subscription, so the raise, the fill of the new slots and each newly Pro channel's history
    // download land before the answer. Stamped at the API's clock floored to the whole second,
    // as Stripe stamps its events: the raise's own event then reads as no older and changes
    // nothing, and an earlier one at the old quantity reads as older and takes nothing back.
    const recorded = await database.asAnonymous(async (tx) => {
      const at = new Date(Math.floor(tx.now.getTime() / 1000) * 1000)
      const fields = subscriptionSnapshotOf(added.subscription, at)
      if (!fields) throw new Error(`Stripe's answer to the add of a block is not a Stillstats one`)
      await recordSubscription(tx, fields)
      return fields
    })
    return c.json({ blocks: recorded.quantity ?? blocks } satisfies BlockAddAnswer)
  })

  signedIn.put('/channels/:channelId/pro-pick', (c) => changePick(c, pickProChannel))
  signedIn.delete('/channels/:channelId/pro-pick', (c) => changePick(c, unpickProChannel))
}
