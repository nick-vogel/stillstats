import type { EntitlementsAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { canUpgradeOf, channelPaidOf } from './can-upgrade.ts'

const free: EntitlementsAnswer = {
  paidTierOffered: true,
  channels: [{ channelId: 'c-1', tier: 'free', canSubscribe: true, canManage: false }],
}

describe('whether the user may subscribe the channel on view', () => {
  test('not before the entitlements answer lands', () => {
    expect(canUpgradeOf(null, 'c-1')).toBe(false)
  })

  test('not with Pro not offered, so nobody sees a tier they cannot buy', () => {
    expect(canUpgradeOf({ ...free, paidTierOffered: false }, 'c-1')).toBe(false)
  })

  test('not for a paid channel', () => {
    const paid: EntitlementsAnswer = {
      paidTierOffered: true,
      channels: [{ channelId: 'c-1', tier: 'paid', canSubscribe: false, canManage: true }],
    }

    expect(canUpgradeOf(paid, 'c-1')).toBe(false)
  })

  test('not for a channel the answer does not name, or with no channel on view', () => {
    expect(canUpgradeOf(free, 'c-2')).toBe(false)
    expect(canUpgradeOf(free, null)).toBe(false)
  })

  test('the owner of a free channel may, and another member may not', () => {
    const member: EntitlementsAnswer = {
      paidTierOffered: true,
      channels: [{ channelId: 'c-1', tier: 'free', canSubscribe: false, canManage: false }],
    }

    expect(canUpgradeOf(free, 'c-1')).toBe(true)
    expect(canUpgradeOf(member, 'c-1')).toBe(false)
  })
})

describe('whether the channel on view is paid', () => {
  const paid: EntitlementsAnswer = {
    paidTierOffered: true,
    channels: [{ channelId: 'c-1', tier: 'paid', canSubscribe: false, canManage: true }],
  }

  test('only for a channel the answer names as paid', () => {
    expect(channelPaidOf(paid, 'c-1')).toBe(true)
    expect(channelPaidOf(free, 'c-1')).toBe(false)
  })

  test('not before the entitlements answer lands, for a channel it does not name, or with no channel on view', () => {
    expect(channelPaidOf(null, 'c-1')).toBe(false)
    expect(channelPaidOf(paid, 'c-2')).toBe(false)
    expect(channelPaidOf(paid, null)).toBe(false)
  })
})
