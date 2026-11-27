import {
  type ErrorAnswer,
  type UpgradeAnswer,
  type UpgradeQuery,
  videoFormatFilters,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { isOneOf } from '../one-of.ts'
import { channelIdOf, refuse, type SignedIn } from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'
import { readUpgrade } from '../upgrade-preview.ts'

const repeatedRefusals = { format: 'invalid_format' } satisfies Record<
  keyof UpgradeQuery,
  ErrorAnswer['error']
>

/**
 * GET /api/channels/:channelId/upgrade: the newest average comparisons the channel would have if
 * it subscribed today, for any member, as the upgrade screen shows them, and the price of each plan
 * from Stripe. A price Stripe cannot give in time answers no prices, reported to GlitchTip once a
 * minute at most, and the comparisons still answer. Without Pro's settings it answers 404 as an
 * unknown route does, as Checkout does.
 */
export function upgradeRoute(
  signedIn: Hono<SignedIn>,
  {
    billing,
    database,
    gateway,
    reporter,
  }: Pick<ApiDependencies, 'billing' | 'database' | 'gateway' | 'reporter'>,
): void {
  signedIn.get('/channels/:channelId/upgrade', async (c) => {
    if (!billing) return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
    const single = singleQueryOf(c.req.queries(), repeatedRefusals)
    if (!single.ok) return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    const { format = 'all' } = single.query
    if (!isOneOf(videoFormatFilters, format)) {
      return c.json({ error: 'invalid_format' } satisfies ErrorAnswer, 400)
    }
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const read = await database.asUser(c.get('user').id, (tx) =>
      readUpgrade(gateway, tx, channelId, format),
    )
    if (!read.ok) return refuse(c, read.refusal)
    // Outside the transaction, as Checkout's call to Stripe is.
    const prices = await billing.readPrices((error) =>
      reporter.report({ message: 'Stripe could not read the prices Checkout sells', error }),
    )
    return c.json({ ...read.answer, prices } satisfies UpgradeAnswer)
  })
}
