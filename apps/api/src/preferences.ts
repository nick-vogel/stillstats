import {
  chartCards,
  chartModes,
  currencyOf,
  isRevenueCurrency,
  type Preferences,
  type PreferencesUpdate,
  pageSizes,
  type RevenueCurrency,
  themes,
  visibilities,
} from '@creator-analytics/api-types'
import { preferences, type Scoped, setting } from '@creator-analytics/database'
import { eq, sql } from 'drizzle-orm'
import { isOneOf } from './one-of.ts'

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean'
}

// The app versions of the build's release notes, which the "What's new" marker must be one of.
function isValueOf(
  appVersions: ReadonlySet<string>,
): Record<keyof Preferences, (value: unknown) => boolean> {
  return {
    pageSize: (value) => isOneOf(pageSizes, value),
    viewsColumn: isBoolean,
    watchTimeColumn: isBoolean,
    revenueColumn: isBoolean,
    revenueSources: isBoolean,
    rpmAdsAndPremiumOnly: isBoolean,
    chartMode: (value) => isOneOf(chartModes, value),
    chartCard: (value) => isOneOf(chartCards, value),
    currency: isRevenueCurrency,
    visibility: (value) => isOneOf(visibilities, value),
    sidebarOpen: isBoolean,
    theme: (value) => isOneOf(themes, value),
    supportPromptDismissed: (value) => value === true,
    upgradePromptDismissed: (value) => value === true,
    whatsNewMarker: (value) => typeof value === 'string' && appVersions.has(value),
  }
}

/**
 * The preferences a request body names, or undefined when it is not an object, names a key that
 * is no preference, or gives a value outside a preference's set. A null value is refused too: a
 * preference goes back to its default only through a reset. `appVersions` are the app versions
 * of the build's release notes: the "What's new" marker is accepted only as one of them.
 */
export function preferencesOf(
  body: unknown,
  appVersions: ReadonlySet<string>,
): PreferencesUpdate | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
  const checks = isValueOf(appVersions)
  const isPreference = (key: string): key is keyof Preferences => Object.hasOwn(checks, key)
  const entries = Object.entries(body)
  const valid = entries.every(([key, value]) => isPreference(key) && checks[key](value))
  return valid ? Object.fromEntries(entries) : undefined
}

// The dismissals' times stay in the database: the answer says only that a prompt was dismissed.
function savedValuesOf(row: typeof preferences.$inferSelect | undefined): Preferences {
  if (!row) return {}
  const { userId: _userId, supportPromptDismissedAt, upgradePromptDismissedAt, ...values } = row
  const saved: Preferences = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== null),
  )
  return {
    ...saved,
    ...(supportPromptDismissedAt === null ? {} : { supportPromptDismissed: true }),
    ...(upgradePromptDismissedAt === null ? {} : { upgradePromptDismissed: true }),
  }
}

// The row's columns for the values given. The server stamps each dismissal's time; the web app
// never sends one.
function columnsOf({ supportPromptDismissed, upgradePromptDismissed, ...values }: Preferences) {
  return {
    ...values,
    ...(supportPromptDismissed ? { supportPromptDismissedAt: sql`now()` } : {}),
    ...(upgradePromptDismissed ? { upgradePromptDismissedAt: sql`now()` } : {}),
  }
}

const isScopeUsersRow = eq(preferences.userId, setting('app.user_id'))

/** The scope's user's saved preferences, with every unsaved one left out. */
export async function readPreferences(tx: Scoped<'user'>): Promise<Preferences> {
  const [row] = await tx.sql.select().from(preferences).where(isScopeUsersRow)
  return savedValuesOf(row)
}

/** The scope's user's currency for revenue reads, from their saved preferences. */
export async function readCurrency(tx: Scoped<'user'>): Promise<RevenueCurrency> {
  return currencyOf(await readPreferences(tx))
}

/** Saves the values given and leaves every other saved preference as it was. */
export async function savePreferences(
  tx: Scoped<'user'>,
  values: Preferences,
): Promise<Preferences> {
  if (Object.keys(values).length === 0) return readPreferences(tx)
  const columns = columnsOf(values)
  const [row] = await tx.sql
    .insert(preferences)
    .values({ userId: setting('app.user_id'), ...columns })
    .onConflictDoUpdate({ target: preferences.userId, set: columns })
    .returning()
  return savedValuesOf(row)
}

export async function clearPreferences(tx: Scoped<'user'>): Promise<Preferences> {
  await tx.sql.delete(preferences).where(isScopeUsersRow)
  return {}
}
