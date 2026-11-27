import {
  type ChartCard,
  type ChartMode,
  currencyOf,
  defaultCurrency,
  type PageSize,
  type Preferences,
  type Theme,
  type Visibility,
} from '@creator-analytics/api-types'
import { createContext, type DependencyList, use, useEffect } from 'react'
import { latestOnly } from './api.ts'
import type { ProductEvent } from './landing.ts'
import type { Route } from './route.ts'

/** A setting's value: the address's value when it has one, then the saved preference, then the default. */
export function settingOf<T>(address: T | undefined, saved: T | undefined, fallback: T): T {
  return address ?? saved ?? fallback
}

/** The value of each preference wired so far, when neither the address nor a saved one names it. */
export const preferenceDefaults: Required<
  Pick<
    Preferences,
    | 'chartMode'
    | 'chartCard'
    | 'pageSize'
    | 'visibility'
    | 'viewsColumn'
    | 'watchTimeColumn'
    | 'revenueColumn'
    | 'revenueSources'
    | 'rpmAdsAndPremiumOnly'
    | 'currency'
    | 'sidebarOpen'
    | 'theme'
  >
> = {
  chartMode: 'daily',
  chartCard: 'engagedViews',
  pageSize: 10,
  visibility: 'public',
  viewsColumn: false,
  watchTimeColumn: false,
  // On, but only on a channel with revenue consent (`listColumnsOf`).
  revenueColumn: true,
  revenueSources: false,
  rpmAdsAndPremiumOnly: false,
  currency: defaultCurrency,
  sidebarOpen: true,
  theme: 'system',
}

export function chartModeOf(route: Route, saved: Preferences): ChartMode {
  return settingOf(route.chart, saved.chartMode, preferenceDefaults.chartMode)
}

/** The card whose chart shows on a screen too small to stack the charts. */
export function chartCardOf(route: Route, saved: Preferences): ChartCard {
  return settingOf(route.chartCard, saved.chartCard, preferenceDefaults.chartCard)
}

export function pageSizeOf(route: Route, saved: Preferences): PageSize {
  return settingOf(route.pageSize, saved.pageSize, preferenceDefaults.pageSize)
}

export function visibilityOf(route: Route, saved: Preferences): Visibility {
  return settingOf(route.visibility, saved.visibility, preferenceDefaults.visibility)
}

/** The video list's optional columns, each named as `list_column_toggled` names it. */
export type OptionalColumn = 'views' | 'watchTime' | 'revenue'

/** Whether each optional column of the video list is switched on. */
export type ColumnSwitches = Record<OptionalColumn, boolean>

/**
 * The video list's column switches: the saved preference, else off, but revenue on. The address
 * carries no column, so no address value takes part. Revenue is off on a channel without revenue
 * consent, whatever is saved, and the saved value stays for a channel with it.
 */
export function listColumnsOf(saved: Preferences, revenueConsented: boolean): ColumnSwitches {
  return {
    views: switchOf(saved, 'views'),
    watchTime: switchOf(saved, 'watchTime'),
    revenue: revenueConsented && switchOf(saved, 'revenue'),
  }
}

const columnPreferences: Record<
  OptionalColumn,
  'viewsColumn' | 'watchTimeColumn' | 'revenueColumn'
> = {
  views: 'viewsColumn',
  watchTime: 'watchTimeColumn',
  revenue: 'revenueColumn',
}

function switchOf(saved: Preferences, column: OptionalColumn): boolean {
  const preference = columnPreferences[column]
  return saved[preference] ?? preferenceDefaults[preference]
}

/**
 * Whether the numbers table and the video list show the revenue source columns: the saved choice,
 * one for both, else hidden.
 */
export function revenueSourcesOf(saved: Preferences): boolean {
  return saved.revenueSources ?? preferenceDefaults.revenueSources
}

/**
 * Whether every RPM counts only ads and YouTube Premium: the saved choice on Settings, else off,
 * when RPM counts the whole estimated revenue.
 */
export function rpmAdsAndPremiumOnlyOf(saved: Preferences): boolean {
  return saved.rpmAdsAndPremiumOnly ?? preferenceDefaults.rpmAdsAndPremiumOnly
}

/** Whether the sidebar is open beside the screen: the saved choice, else open. */
export function sidebarOpenOf(saved: Preferences): boolean {
  return saved.sidebarOpen ?? preferenceDefaults.sidebarOpen
}

/**
 * The theme the page shows: the one on screen in the saved preferences, then System once the
 * server's value is known (its read landed, or a reset cleared it), else the browser's copy, which
 * the head script drew before the first paint and an unknown server value leaves as it is.
 */
export function themeOnViewOf(saved: Preferences | null, serverKnown: boolean, copy: Theme): Theme {
  return saved?.theme ?? (serverKnown ? preferenceDefaults.theme : copy)
}

// Approved word for word in creator-analytics#119 (W13). Change it only with Nick.
export const failedSaveNotice = 'Your change did not save. Try again.'

/**
 * The name a screen reader gives the toast's close button, which shows only "×". Every failed
 * save's notice and every success's message shows in the toast, wherever the creator scrolled
 * (Nick, browser walk, 2026-10-11).
 */
export const toastCloseLabel = 'Close'

/**
 * A failed preference save's notice: the save's number, so a later failure starts its toast's wait
 * over, the address it shows on, until the route changes, and the values the save lost, with those
 * of any failure before it still on view, until later saves of every one succeed or the toast
 * closes.
 */
export interface FailedSave {
  id: number
  address: string
  lost: Preferences
}

/**
 * A failed save's notice once `address` is on view: kept while it is the address the notice shows
 * on, the bare list address "" included, and none once the address changed from it.
 */
export function failedSaveOn(failed: FailedSave | null, address: string): FailedSave | null {
  return failed?.address === address ? failed : null
}

/**
 * A failed save's notice once a later save of `change` succeeds: the keys that save carries are no
 * longer lost, as the server now holds the creator's choice, so the notice goes once a retry, which
 * it asks for, has carried every one. Kept, the same, when the save carries none of them.
 */
export function failedSaveAfterSuccessOf(
  failed: FailedSave | null,
  change: Preferences,
): FailedSave | null {
  if (!failed) return null
  const lost = Object.entries(failed.lost).filter(([key]) => !(key in change))
  if (lost.length === Object.keys(failed.lost).length) return failed
  return lost.length === 0 ? null : { ...failed, lost: Object.fromEntries(lost) as Preferences }
}

/**
 * The notice once the save of `next` fails while `failed`'s notice is still held: `next`, with the
 * values the earlier one lost kept beside its own, as a held notice is on view and its change still
 * unsaved. `next`'s number starts the toast's wait over, on the address `next` leaves on view.
 */
export function failedSaveAfterFailureOf(failed: FailedSave | null, next: FailedSave): FailedSave {
  return failed ? { ...next, lost: { ...failed.lost, ...next.lost } } : next
}

export interface SaveTracker {
  /** Takes a save as it starts, and answers its number. */
  started(change: Preferences): number
  /**
   * The part of save `id`'s `change` that no later save carries, which its failure loses. A key a
   * later save carries is that save's, whatever its value, so on, off and back on keeps the last.
   */
  lostOf(id: number, change: Preferences): Preferences
  /** The number of saves started so far, which a reset takes as its mark before it starts. */
  count(): number
  /**
   * The values of `current` whose last save started after `mark`, so a change made while a reset
   * runs, whose save lands after the reset's, stays on screen.
   */
  changedSince(mark: number, current: Preferences): Preferences
}

/** Which save last changed each preference, so a failed save reverts only what was its own. */
export function saveTracker(): SaveTracker {
  let count = 0
  const lastSaveOf = new Map<string, number>()
  return {
    started(change) {
      count += 1
      for (const key of Object.keys(change)) lastSaveOf.set(key, count)
      return count
    },
    lostOf(id, change) {
      return Object.fromEntries(
        Object.entries(change).filter(([key]) => lastSaveOf.get(key) === id),
      ) as Preferences
    },
    count() {
      return count
    },
    changedSince(mark, current) {
      return Object.fromEntries(
        Object.entries(current).filter(([key]) => (lastSaveOf.get(key) ?? 0) > mark),
      ) as Preferences
    },
  }
}

/**
 * The preferences on screen after the save of `change` failed: each value it changed back to the
 * one the server last confirmed, or to none, its default, when the server held none. A value changed
 * again since the failed save stays, as the later save carries it.
 */
export function preferencesAfterFailedSave(
  current: Preferences,
  change: Preferences,
  confirmed: Preferences,
): Preferences {
  const after: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(change)) {
    if (after[key] !== value) continue
    const confirmedValue = (confirmed as Record<string, unknown>)[key]
    if (confirmedValue === undefined) delete after[key]
    else after[key] = confirmedValue
  }
  return after as Preferences
}

/**
 * The preferences once the first read lands: the read, with any value changed on screen before it
 * landed kept, as that change is newer and its save is already on its way. A reset made before it
 * landed touched every preference, so the read fills none and the local values stay as they are.
 */
export function preferencesAfterRead(
  read: Preferences,
  local: Preferences | null,
  resetSinceOpened = false,
): Preferences {
  return resetSinceOpened ? { ...local } : { ...read, ...local }
}

/** The preference to save when an optional column is switched on or off. */
export function columnPreferenceOf(column: OptionalColumn, on: boolean): Preferences {
  return { [columnPreferences[column]]: on }
}

export interface SavedPreferences {
  saved: Preferences
  /** Saves the values given, and leaves every other saved preference as it was. */
  save(change: Preferences): void
  /**
   * Resolves once every save made so far has settled, so a read that depends on a preference,
   * such as revenue in the saved currency, never overtakes the save.
   */
  settled(): Promise<void>
}

export const PreferencesContext = createContext<SavedPreferences | null>(null)

/** The signed-in creator's preferences. Only a screen App renders inside the context calls it. */
export function usePreferences(): SavedPreferences {
  const preferences = use(PreferencesContext)
  if (!preferences) throw new Error('usePreferences is called outside PreferencesContext')
  return preferences
}

/**
 * Reads a screen's view on each change of `deps`, and again when the saved currency changes, as the
 * API reads the currency from the saved preferences, not the query. Each read waits until every save
 * made so far has settled, so revenue never comes back in the currency before a change. The last
 * view clears at once, so none of its numbers shows while the next one is read. A null `read`
 * reads nothing.
 */
export function useViewInSavedCurrency<V>(
  read: (() => Promise<V>) | null,
  setView: (view: NoInfer<V> | { kind: 'refused'; message: string } | null) => void,
  deps: DependencyList,
): void {
  const { saved, settled } = usePreferences()
  const currency = currencyOf(saved)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` name what `read` reads, and the currency is read by the API
  useEffect(() => {
    if (!read) return
    setView(null)
    return latestOnly(settled().then(read), setView, (message) =>
      setView({ kind: 'refused', message }),
    )
  }, [...deps, currency, settled])
}

export const preferencesResetEvent: ProductEvent = { name: 'preferences_reset' }

/**
 * A queue that starts each write to the saved preferences once the one before it has settled, so
 * the server keeps the creator's last change. Sent at once, two changes made faster than a round
 * trip could commit in either order. A failed write does not hold up the next.
 */
export function writeQueue(): <T>(write: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve()
  return (write) => {
    const written = last.then(write)
    last = written.catch(() => undefined)
    return written
  }
}

/** A wait for every write queued on the queue so far to settle, failed ones included. */
export function settledOf(queue: ReturnType<typeof writeQueue>): () => Promise<void> {
  return () => queue(async () => undefined)
}
