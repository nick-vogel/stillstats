import type { RevenueRefusal } from '@creator-analytics/api-types'
import type { ReadRefusal } from '@creator-analytics/youtube-gateway'

/**
 * The refusals that leave an answer standing with no revenue: the channel has no revenue consent,
 * or it is outside the YouTube Partner Program. Any other refuses the answer whole.
 */
export function isRevenueRefusal(refusal: ReadRefusal): refusal is RevenueRefusal['refusal'] {
  return refusal === 'consent_missing' || refusal === 'not_monetized'
}

/** A refused revenue read: why the answer carries no revenue, or the refusal of the whole answer. */
export function refusedRevenue(
  refusal: ReadRefusal,
): { ok: true; revenue: RevenueRefusal } | { ok: false; refusal: ReadRefusal } {
  return isRevenueRefusal(refusal) ? { ok: true, revenue: { refusal } } : { ok: false, refusal }
}
