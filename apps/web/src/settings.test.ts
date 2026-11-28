// Limits: these tests cover the events' payloads, as values. No test here renders the screen, so
// none shows that the event goes once each time the Settings screen opens (not again under
// StrictMode, nor after a consent screen's Cancel), the focus on the heading, or the layout at 375
// pixels wide. None shows the reset's confirmation, that a cancel sends nothing, or that the reset
// sends its event only after the preferences are cleared. `app.test.ts` renders App and shows the
// toast a reset and a currency change raise, but no test shows the one a disconnect raises. Nick
// checks those at /app/settings in a real browser.
import type { ChannelEntitlement, EntitlementsAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { preferencesResetEvent } from './preferences.ts'
import {
  channelsLoadingTextOf,
  consentGivenTextOf,
  currencyChangedEvent,
  currencyOptionsOf,
  proChannelSelectedEvent,
  proPurgeTextOf,
  proSlotsTextOf,
  rpmSourcesToggledEvent,
  settingsOpenedEvent,
} from './settings.ts'
import {
  addBlockQuestionOf,
  addBlockText,
  blockAddedEvent,
  blockAddedTextOf,
  blocksChangedText,
  proSectionOf,
} from './subscribe.ts'

describe('the event the Settings screen sends', () => {
  test('is settings_opened, with no other value', () => {
    expect(settingsOpenedEvent).toStrictEqual({ name: 'settings_opened' })
  })
})

describe('the event a reset of the preferences sends', () => {
  test('is preferences_reset, with no other value', () => {
    expect(preferencesResetEvent).toStrictEqual({ name: 'preferences_reset' })
  })
})

describe('the currency on the Settings screen', () => {
  test("offers each of the 90 currencies Google's Analytics API documents once", () => {
    const codes = currencyOptionsOf('en').map(({ value }) => value)

    expect(codes).toHaveLength(90)
    expect(new Set(codes).size).toBe(90)
  })

  test("names each currency in the locale's language, with its code", () => {
    const labels = new Map(currencyOptionsOf('en').map(({ value, label }) => [value, label]))

    expect(labels.get('USD')).toBe('US Dollar (USD)')
    expect(labels.get('EUR')).toBe('Euro (EUR)')
  })

  test("names each currency in another locale's language", () => {
    const labels = new Map(currencyOptionsOf('de').map(({ value, label }) => [value, label]))

    expect(labels.get('USD')).toBe('US-Dollar (USD)')
  })

  test("writes an em-dash in a browser's currency name as an en dash, as the other names write their years", () => {
    const labels = new Map(currencyOptionsOf('en-US').map(({ value, label }) => [value, label]))

    expect(labels.get('SLL')).toBe('Sierra Leonean Leone (1964\u20132022) (SLL)')
    expect(labels.get('VEF')).toBe('Venezuelan Bolívar (2008\u20132018) (VEF)')
    expect([...labels.values()].filter((label) => label.includes('\u2014'))).toEqual([])
  })

  test('lists the currencies by name, as the locale sorts them', () => {
    const labels = currencyOptionsOf('en').map(({ label }) => label)

    expect(labels.indexOf('Euro (EUR)')).toBeLessThan(labels.indexOf('Japanese Yen (JPY)'))
    expect(labels.indexOf('Japanese Yen (JPY)')).toBeLessThan(labels.indexOf('US Dollar (USD)'))
    expect(labels).toEqual(labels.toSorted(new Intl.Collator('en').compare))
  })
})

describe('the event a change of currency sends', () => {
  test('is currency_changed, with the code and no other value', () => {
    expect(currencyChangedEvent('EUR')).toStrictEqual({ name: 'currency_changed', currency: 'EUR' })
  })
})

describe('the event a change of the RPM switch sends (creator-analytics#357)', () => {
  test('is rpm_sources_toggled, with on and no other value, when the switch turns on', () => {
    expect(rpmSourcesToggledEvent(true)).toStrictEqual({ name: 'rpm_sources_toggled', state: 'on' })
  })

  test('is rpm_sources_toggled, with off and no other value, when the switch turns off', () => {
    expect(rpmSourcesToggledEvent(false)).toStrictEqual({
      name: 'rpm_sources_toggled',
      state: 'off',
    })
  })
})

describe("a channel's revenue consent on the Settings screen", () => {
  // Noon on 2026-10-10 in the test machine's own time zone, which the date is written in. No one
  // instant is the same calendar day from UTC-12 to UTC+14.
  test('says the date it was given on, without the time', () => {
    const localNoon = new Date(2026, 9, 10, 12).toISOString()
    expect(consentGivenTextOf(localNoon, 'en-US')).toBe(
      'Revenue consent given on October 10, 2026.',
    )
  })
})

describe("the Settings screen's loading status", () => {
  test('says "Loading your channels" while the channels are read', () => {
    expect(channelsLoadingTextOf(true)).toBe('Loading your channels')
  })

  test('says nothing once they are read', () => {
    expect(channelsLoadingTextOf(false)).toBeNull()
  })
})

describe("the Pro section's slots on the Settings screen (stillstats#20)", () => {
  test('says the slots in use of the 4 each block holds', () => {
    expect(proSlotsTextOf(1, 1)).toBe('1 of 4 slots in use')
    expect(proSlotsTextOf(5, 2)).toBe('5 of 8 slots in use')
  })

  test('says none are in use before a channel is picked', () => {
    expect(proSlotsTextOf(0, 1)).toBe('0 of 4 slots in use')
  })
})

describe('the event a pick of a Pro channel sends (stillstats#21)', () => {
  test('is pro_channel_selected with the block count, and no channel or figure', () => {
    expect(proChannelSelectedEvent(2)).toEqual({ name: 'pro_channel_selected', blocks: 2 })
  })
})

describe("each owned channel's pick control in the Pro section (stillstats#21)", () => {
  function answerOf(
    user: Partial<Omit<EntitlementsAnswer, 'channels'>>,
    ...channels: (Pick<ChannelEntitlement, 'channelId' | 'tier'> & Partial<ChannelEntitlement>)[]
  ): EntitlementsAnswer {
    return {
      paidTierOffered: true,
      canSubscribe: false,
      canManage: true,
      canAddBlock: true,
      blocks: 1,
      slotsInUse: 1,
      ...user,
      channels: channels.map((channel) => ({
        owner: true,
        picked: channel.tier === 'paid',
        purgeDate: null,
        canSubscribe: false,
        canManage: false,
        ...channel,
      })),
    }
  }

  test("gives a picked channel unpick and an unpicked one pick, and a member's channel none", () => {
    const section = proSectionOf(
      answerOf(
        {},
        { channelId: 'c-1', tier: 'paid' },
        { channelId: 'c-2', tier: 'free' },
        { channelId: 'c-3', tier: 'free', owner: false },
      ),
    )

    expect(section?.channels.get('c-1')).toMatchObject({ control: 'unpick', slotsFull: false })
    expect(section?.channels.get('c-2')).toMatchObject({ control: 'pick', slotsFull: false })
    expect(section?.channels.get('c-3')).toBeUndefined()
  })

  test('gives no control to a user without a block', () => {
    const section = proSectionOf(
      answerOf(
        { canSubscribe: true, canManage: false, blocks: 0, slotsInUse: 0 },
        { channelId: 'c-1', tier: 'free', canSubscribe: true },
      ),
    )

    expect(section?.channels.get('c-1')).toMatchObject({ control: null, slotsFull: false })
  })

  test('says an unpicked channel stays free only while every slot is in use', () => {
    const full = Array.from({ length: 4 }, (_, n) => ({
      channelId: `c-${n + 1}`,
      tier: 'paid' as const,
    }))
    const fullSection = proSectionOf(
      answerOf({ slotsInUse: 4 }, ...full, { channelId: 'c-5', tier: 'free' }),
    )
    const freeSlotSection = proSectionOf(
      answerOf({ slotsInUse: 3 }, ...full.slice(1), { channelId: 'c-5', tier: 'free' }),
    )

    expect(fullSection?.channels.get('c-5')).toMatchObject({ control: 'pick', slotsFull: true })
    expect(fullSection?.channels.get('c-1')).toMatchObject({ slotsFull: false })
    expect(freeSlotSection?.channels.get('c-5')).toMatchObject({ slotsFull: false })
  })

  test("carries a channel's purge date", () => {
    const purgeDate = '2026-12-26T12:00:00.000Z'
    const section = proSectionOf(answerOf({}, { channelId: 'c-1', tier: 'free', purgeDate }))

    expect(section?.channels.get('c-1')).toMatchObject({ tier: 'free', purgeDate })
  })
})

describe('the purge date line under a channel taken out of Pro (stillstats#21)', () => {
  test('names the day its history is deleted on, in the locale', () => {
    expect(proPurgeTextOf('2026-12-26T12:00:00.000Z', 'en-GB')).toBe(
      'Its stored history is deleted on 26 December 2026 unless you pick it for Pro again.',
    )
    expect(proPurgeTextOf('2026-12-26T12:00:00.000Z', 'en-US')).toBe(
      'Its stored history is deleted on December 26, 2026 unless you pick it for Pro again.',
    )
  })
})

describe('the Pro section carries whether the user may add a block (stillstats#22)', () => {
  test.for([true, false])('canAddBlock %s from the answer', (canAddBlock) => {
    const section = proSectionOf({
      paidTierOffered: true,
      canSubscribe: false,
      canManage: true,
      canAddBlock,
      blocks: 1,
      slotsInUse: 1,
      channels: [],
    })

    expect(section?.canAddBlock).toBe(canAddBlock)
  })
})

describe('the strings of an add of a block (stillstats#22)', () => {
  const preview = {
    blocks: 2,
    plan: 'monthly',
    price: { amount: 700, currency: 'usd' },
    prorated: { amount: 350, currency: 'usd' },
    periodEnd: '2026-12-17T12:00:00.000Z',
  } as const

  test("the question names the preview's price, its period, the next invoice's day and the prorated charge", () => {
    expect(addBlockQuestionOf(preview, 'en-US')).toBe(
      'Add a block of 4 more Pro slots for $7 a month? Your next invoice, on December 17, 2026, also charges $3.50 for the rest of this month.',
    )
    expect(addBlockQuestionOf({ ...preview, plan: 'annual' }, 'en-US')).toContain(' a year?')
  })

  test('the toast names the slots the blocks now hold', () => {
    expect(blockAddedTextOf(2)).toBe('Block added. You now have 8 Pro slots.')
  })

  test('the event is block_added with the block count, and no channel, user or amount', () => {
    expect(blockAddedEvent(3)).toEqual({ name: 'block_added', blocks: 3 })
  })

  test('no string of it carries an em-dash', () => {
    const strings = [
      addBlockText,
      addBlockQuestionOf(preview, 'en-US'),
      blockAddedTextOf(2),
      blocksChangedText,
    ]
    expect(strings.filter((text) => text.includes('\u2014'))).toEqual([])
  })
})
