import type { Device, OperatingSystem } from '@creator-analytics/api-types'
import { type TopBar, topBarsOf } from './top-bars.ts'

// The names and "Other operating systems" are approved in creator-analytics#268 on 2026-10-19.
// "Nintendo 3DS", "KaiOS", "PlayStation Vita" and the fold of Google's `OTHER` into "Other
// operating systems" are approved in creator-analytics#328 on 2026-10-22.
// Google's `AUTOMOTIVE` and `WEARABLE` device types have no approved name, so they show in title
// case.

const deviceNames: Record<string, string> = {
  DESKTOP: 'Desktop',
  MOBILE: 'Mobile',
  TABLET: 'Tablet',
  TV: 'TV',
  GAME_CONSOLE: 'Game console',
  UNKNOWN_PLATFORM: 'Unknown device',
}

const operatingSystemNames: Record<string, string> = {
  WINDOWS: 'Windows',
  MACINTOSH: 'macOS',
  ANDROID: 'Android',
  IOS: 'iOS',
  LINUX: 'Linux',
  PLAYSTATION: 'PlayStation',
  XBOX: 'Xbox',
  SMART_TV: 'Smart TV',
  CHROMECAST: 'Chromecast',
  WEBOS: 'webOS',
  NINTENDO_3DS: 'Nintendo 3DS',
  KAIOS: 'KaiOS',
  PLAYSTATION_VITA: 'PlayStation Vita',
  // Google's Dimensions page lists no value for these five (checked 2026-10-20), though a live
  // check on 2026-10-19 found it answering systems the page leaves out. The values are guesses: a
  // wrong one falls back to title case, never to a wrong name.
  CHROME_OS: 'ChromeOS',
  NINTENDO_SWITCH: 'Nintendo Switch',
  ROKU: 'Roku OS',
  FIRE_OS: 'Fire OS',
  TVOS: 'tvOS',
}

/** Google's upper snake case value in title case, such as `WINDOWS_MOBILE` to "Windows Mobile". */
function titleCaseOf(value: string): string {
  return value
    .split('_')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** One bar for every device type in the API's order, each keyed by Google's value. */
export function deviceBarsOf(devices: Device[], locale?: string): TopBar[] {
  return topBarsOf(
    devices.map(({ deviceType, engagedViews }) => ({
      key: deviceType,
      name: deviceNames[deviceType] ?? titleCaseOf(deviceType),
      engagedViews,
    })),
    undefined,
    locale,
  )
}

/**
 * One bar for each of the first 10 operating systems in the API's order, each keyed by Google's
 * value, then one "Other operating systems" bar adding up the rest. Google's `OTHER` never takes
 * one of the 10 bars: a bar named "Other" would sit beside "Other operating systems" and a creator
 * could not tell them apart. Its engaged views always add into the rest bar, which shows whenever
 * Google answers `OTHER` or more than 10 other systems, and every share still counts them.
 */
export function operatingSystemBarsOf(
  operatingSystems: OperatingSystem[],
  locale?: string,
): TopBar[] {
  return topBarsOf(
    operatingSystems.map(({ operatingSystem, engagedViews }) => ({
      key: operatingSystem,
      name: operatingSystemNames[operatingSystem] ?? titleCaseOf(operatingSystem),
      engagedViews,
    })),
    'Other operating systems',
    locale,
    'OTHER',
  )
}
