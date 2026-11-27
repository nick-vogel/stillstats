import type { EntitlementsAnswer } from '@creator-analytics/api-types'
import { createContext, use } from 'react'

/**
 * Whether the user may subscribe the channel on view to Pro, from the entitlements answer: only its
 * owner, while it is free and Pro is offered. False until the answer lands, with Pro not offered
 * (no billing settings), for a paid channel, for another member, and for a channel the answer does
 * not name. It decides the upgrade screen's pricing cards, the sidebar's "Upgrade" item and an
 * ended channel's subscribe-again link.
 */
export function canUpgradeOf(
  entitlements: EntitlementsAnswer | null,
  channelId: string | null,
): boolean {
  if (!entitlements?.paidTierOffered || channelId === null) return false
  const entry = entitlements.channels.find((channel) => channel.channelId === channelId)
  return entry?.tier === 'free' && entry.canSubscribe
}

/**
 * Whether the entitlements answer says the channel on view is paid: false until it lands, and for a
 * channel it does not name. It decides whether the list holds the place of its traffic source and
 * minimum impressions controls before its first answer says whether the history is readable.
 */
export function channelPaidOf(
  entitlements: EntitlementsAnswer | null,
  channelId: string | null,
): boolean {
  return (
    entitlements?.channels.some(
      (channel) => channel.channelId === channelId && channel.tier === 'paid',
    ) ?? false
  )
}

/** Whether the user may subscribe the channel on view, which `App` sets. */
export const CanUpgradeContext = createContext(false)

export function useCanUpgrade(): boolean {
  return use(CanUpgradeContext)
}
