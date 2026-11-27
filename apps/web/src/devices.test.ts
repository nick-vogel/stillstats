// Limits: these tests cover the device and operating system bars as pure functions. No test here
// draws the bars or can prove which device types and operating systems Google answers, nor the
// values of the systems Google's Dimensions page leaves out. Nick checks those at /app in a real
// browser.
import type { Device, OperatingSystem } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { deviceBarsOf, operatingSystemBarsOf } from './devices.ts'

/** Devices with engaged views from 100 down by one, each type from the list given. */
function devicesOf(deviceTypes: string[]): Device[] {
  return deviceTypes.map((deviceType, i) => ({ deviceType, engagedViews: 100 - i, views: 101 - i }))
}

/** Operating systems with engaged views from 100 down by one, each from the list given. */
function systemsOf(operatingSystems: string[]): OperatingSystem[] {
  return operatingSystems.map((operatingSystem, i) => ({
    operatingSystem,
    engagedViews: 100 - i,
    views: 101 - i,
  }))
}

describe('the device bars', () => {
  test('name each of Google\'s device types, UNKNOWN_PLATFORM as "Unknown device"', () => {
    const bars = deviceBarsOf(
      devicesOf(['DESKTOP', 'MOBILE', 'TABLET', 'TV', 'GAME_CONSOLE', 'UNKNOWN_PLATFORM']),
    )

    expect(bars.map(({ name }) => name)).toEqual([
      'Desktop',
      'Mobile',
      'Tablet',
      'TV',
      'Game console',
      'Unknown device',
    ])
  })

  test('show a device type with no name in title case', () => {
    const bars = deviceBarsOf(devicesOf(['AUTOMOTIVE', 'SMART_WATCH']))

    expect(bars.map(({ name }) => name)).toEqual(['Automotive', 'Smart Watch'])
  })

  test('draw a bar for every device type, with no rest bar', () => {
    const bars = deviceBarsOf(devicesOf(Array.from({ length: 12 }, (_, i) => `DEVICE_${i}`)))

    expect(bars).toHaveLength(12)
    expect(bars.map(({ key }) => key)).not.toContain('other')
  })
})

describe('the operating system bars', () => {
  test('name each operating system by its usual name', () => {
    // Two calls, each of 10 or fewer, so no system adds into the rest bar.
    const first = operatingSystemBarsOf(
      systemsOf([
        'WINDOWS',
        'MACINTOSH',
        'ANDROID',
        'IOS',
        'LINUX',
        'PLAYSTATION',
        'XBOX',
        'SMART_TV',
        'CHROMECAST',
        'WEBOS',
      ]),
    )
    const second = operatingSystemBarsOf(systemsOf(['NINTENDO_3DS', 'KAIOS', 'PLAYSTATION_VITA']))

    expect([...first, ...second].map(({ name }) => name)).toEqual([
      'Windows',
      'macOS',
      'Android',
      'iOS',
      'Linux',
      'PlayStation',
      'Xbox',
      'Smart TV',
      'Chromecast',
      'webOS',
      'Nintendo 3DS',
      'KaiOS',
      'PlayStation Vita',
    ])
  })

  test("show an operating system with no name as Google's value in title case", () => {
    const bars = operatingSystemBarsOf(systemsOf(['WINDOWS_MOBILE', 'TIZEN']))

    expect(bars.map(({ name }) => name)).toEqual(['Windows Mobile', 'Tizen'])
  })

  test('draw the first 10 operating systems, then one "Other operating systems" bar adding up the rest, each with its share', () => {
    // 100 down to 89 engaged views: 1,134 in all, the last two 90 + 89.
    const bars = operatingSystemBarsOf(
      systemsOf(Array.from({ length: 12 }, (_, i) => `SYSTEM_${i}`)),
      'en-US',
    )

    expect(bars).toHaveLength(11)
    expect(bars[10]).toMatchObject({
      key: 'other',
      name: 'Other operating systems',
      engagedViews: '179',
      share: '(16%)',
    })
  })

  test('fold Google\'s OTHER into the "Other operating systems" bar, never a bar of its own', () => {
    const bars = operatingSystemBarsOf(systemsOf(['WINDOWS', 'OTHER', 'ANDROID']))

    expect(bars.map(({ key, name, engagedViews }) => ({ key, name, engagedViews }))).toEqual([
      { key: 'WINDOWS', name: 'Windows', engagedViews: '100' },
      { key: 'ANDROID', name: 'Android', engagedViews: '98' },
      { key: 'other', name: 'Other operating systems', engagedViews: '99' },
    ])
  })

  test('give an OTHER that ranks inside the top 10 no slot, so the 11th system moves up', () => {
    // SYSTEM_10 has 89 engaged views and OTHER 99: 188 in the rest bar.
    const systems = [
      'SYSTEM_0',
      'OTHER',
      ...Array.from({ length: 10 }, (_, i) => `SYSTEM_${i + 1}`),
    ]
    const bars = operatingSystemBarsOf(systemsOf(systems))

    expect(bars.map(({ key }) => key)).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `SYSTEM_${i}`),
      'other',
    ])
    expect(bars[10]?.engagedViews).toBe('188')
  })

  test("count OTHER's engaged views in every bar's share", () => {
    // 100 + 99 + 98 = 297 in all. Without OTHER's 99, Windows would be (51%) and the rest (50%).
    const bars = operatingSystemBarsOf(systemsOf(['WINDOWS', 'OTHER', 'ANDROID']), 'en-US')

    expect(bars[0]).toMatchObject({ key: 'WINDOWS', share: '(34%)' })
    expect(bars[2]).toMatchObject({ key: 'other', share: '(33%)' })
  })
})
