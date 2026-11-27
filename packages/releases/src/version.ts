export type Product = 'app' | 'extension'

const calVer = /^([1-9]\d{3})\.([1-9]\d?)\.([1-9]\d?)(?:\.([1-9]\d*))?$/
const semVer = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** Whether the year, month and day name a day the calendar has. */
export function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * An app version is CalVer `YYYY.M.D` on a real day, then `YYYY.M.D.N` for the Nth extra release
 * that day, with no leading zero in any part.
 */
export function isAppVersion(text: string): boolean {
  const parts = calVer.exec(text)
  return parts !== null && isCalendarDate(Number(parts[1]), Number(parts[2]), Number(parts[3]))
}

/** An extension version is SemVer `MAJOR.MINOR.PATCH`, with no pre-release or build part. */
export function isExtensionVersion(text: string): boolean {
  return semVer.test(text)
}

export function isVersionOf(product: Product, text: string): boolean {
  return product === 'app' ? isAppVersion(text) : isExtensionVersion(text)
}

/**
 * Orders two versions of one product, negative when `a` is older. Both CalVer and SemVer compare
 * part by part as numbers, and a CalVer version with no fourth part is that day's first release.
 */
export function compareVersions(a: string, b: string): number {
  const as = a.split('.').map(Number)
  const bs = b.split('.').map(Number)
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const difference = (as[i] ?? 0) - (bs[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}
