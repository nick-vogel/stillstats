import type { ChannelEntitlement, EntitlementsAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { canUpgradeOf, channelPaidOf } from './can-upgrade.ts'

/** A free channel the user owns, not picked for a slot, with no purge date. */
const ownedFree: ChannelEntitlement = {
  channelId: 'c-1',
  tier: 'free',
  owner: true,
  picked: false,
  purgeDate: null,
  canSubscribe: true,
  canManage: false,
}

/** The user may subscribe: Pro offered, a channel of their own, and no live subscription. */
const free: EntitlementsAnswer = {
  paidTierOffered: true,
  canSubscribe: true,
  canManage: false,
  blocks: 0,
  slotsInUse: 0,
  channels: [ownedFree],
}

/** The user's live subscription of one block, its slot taken by the paid channel. */
const subscribed: EntitlementsAnswer = {
  paidTierOffered: true,
  canSubscribe: false,
  canManage: true,
  blocks: 1,
  slotsInUse: 1,
  channels: [{ ...ownedFree, tier: 'paid', picked: true, canSubscribe: false, canManage: true }],
}

describe('whether the user may subscribe the channel on view', () => {
  test('not before the entitlements answer lands', () => {
    expect(canUpgradeOf(null, 'c-1')).toBe(false)
  })

  test('not with Pro not offered, so nobody sees a tier they cannot buy', () => {
    expect(canUpgradeOf({ ...free, paidTierOffered: false }, 'c-1')).toBe(false)
  })

  test('not for a paid channel', () => {
    expect(canUpgradeOf(subscribed, 'c-1')).toBe(false)
  })

  test('not for a channel the answer does not name, or with no channel on view', () => {
    expect(canUpgradeOf(free, 'c-2')).toBe(false)
    expect(canUpgradeOf(free, null)).toBe(false)
  })

  test('the owner of a free channel may, and another member may not', () => {
    const member: EntitlementsAnswer = {
      ...free,
      channels: [{ ...ownedFree, owner: false, canSubscribe: false }],
    }

    expect(canUpgradeOf(free, 'c-1')).toBe(true)
    expect(canUpgradeOf(member, 'c-1')).toBe(false)
  })
})

describe('whether the channel on view is paid', () => {
  test('only for a channel the answer names as paid', () => {
    expect(channelPaidOf(subscribed, 'c-1')).toBe(true)
    expect(channelPaidOf(free, 'c-1')).toBe(false)
  })

  test('not before the entitlements answer lands, for a channel it does not name, or with no channel on view', () => {
    expect(channelPaidOf(null, 'c-1')).toBe(false)
    expect(channelPaidOf(subscribed, 'c-2')).toBe(false)
    expect(channelPaidOf(subscribed, null)).toBe(false)
  })
})
