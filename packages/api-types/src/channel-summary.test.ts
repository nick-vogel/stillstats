import { describe, expect, test } from 'vitest'
import { rpmRevenueOf } from './channel-summary.ts'

// $12.00 in all: $7.00 from ads, $2.00 from YouTube Premium, $3.00 from other sources.
const amounts = { estimatedRevenue: 12, estimatedAdRevenue: 7, estimatedRedPartnerRevenue: 2 }

describe('the revenue an RPM counts (creator-analytics#357)', () => {
  test('is the whole estimated revenue with the RPM switch off', () => {
    expect(rpmRevenueOf(amounts, false)).toBe(12)
  })

  test('is ads plus YouTube Premium, the total less other sources, with the RPM switch on', () => {
    expect(rpmRevenueOf(amounts, true)).toBe(9)
  })

  test('passes a refund through with the RPM switch on', () => {
    // A refunded ad: Google reports the ad revenue below zero on that day.
    const refunded = {
      estimatedRevenue: 1,
      estimatedAdRevenue: -2,
      estimatedRedPartnerRevenue: 0.5,
    }

    expect(rpmRevenueOf(refunded, true)).toBe(-1.5)
  })
})
