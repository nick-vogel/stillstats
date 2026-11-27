import { type RevenueCurrency, revenueCurrencies, type Theme } from '@creator-analytics/api-types'
import type { Option } from './ListSelect.tsx'
import type { ProductEvent } from './landing.ts'
import { loadingText } from './loading.ts'
import { settingsName } from './settings-name.ts'

// The heading is approved word for word by Nick on 2026-11-09 in creator-analytics#571, the rest
// in creator-analytics#66. Change them only with Nick.
export const settingsHeading = settingsName
export const channelsHeading = 'Your channels'
export const accountHeading = 'Account'
export const noChannelText = 'No channel is connected.'

export const settingsOpenedEvent: ProductEvent = { name: 'settings_opened' }

// The strings are approved word for word in creator-analytics#72, the warning again in #456, which
// names the RPM switch, and again by Nick on 2026-11-12 in creator-analytics#642, which names the
// theme (creator-analytics#691). Change them only with Nick.
export const resetPreferencesButton = 'Reset preferences'
export const resetPreferencesWarning =
  'Reset your preferences? Page size, columns, charts, currency, the theme, the unlisted switch and the RPM switch go back to their defaults.'
export const preferencesResetNotice = 'Your preferences are reset.'

// Approved word for word in the #64 browser walk on 2026-10-11. Change it only with Nick. The toast
// says it when a change of the currency saves.
export const currencySavedNotice = 'Your currency is saved.'

// Approved word for word in creator-analytics#79. Change it only with Nick.
export const currencyLabel = 'Currency'

/**
 * The currencies Settings offers: exactly the ones Google's Analytics API documents, each named
 * in the locale's language with its code, such as "US Dollar (USD)", sorted by that name as the
 * locale sorts. The names are the browser's own, as `Intl.DisplayNames` gives them, but for an
 * em-dash, written as an en dash: the en-US name of SLL alone has one, between its years (Node
 * 26), where VEF's years take an en dash (creator-analytics#119, W16).
 */
export function currencyOptionsOf(locale?: string): Option<RevenueCurrency>[] {
  const names = new Intl.DisplayNames(locale, { type: 'currency' })
  const { compare } = new Intl.Collator(locale)
  return revenueCurrencies
    .map((code) => {
      const name = (names.of(code) ?? code).replaceAll('\u2014', '\u2013')
      return { value: code, label: `${name} (${code})` }
    })
    .sort((a, b) => compare(a.label, b.label))
}

/** The line under a channel with revenue consent: the date it was given on, in the locale. */
export function consentGivenTextOf(revenueConsentedAt: string, locale?: string): string {
  const date = new Date(revenueConsentedAt).toLocaleDateString(locale, { dateStyle: 'long' })
  return `Revenue consent given on ${date}.`
}

// Approved word for word by Nick on 2026-11-12 in creator-analytics#642. Change them only with
// Nick. The account menu's theme items (creator-analytics#692) take the same words.
export const themeLabel = 'Theme'
export const themeOptions: Option<Theme>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

// Approved word for word in creator-analytics#357 (2026-11-04). Change it only with Nick.
export const rpmSourcesLabel = 'Count only ads and YouTube Premium in RPM'
export const rpmSourcesHint = 'RPM then leaves out memberships and Supers.'

/** The event a change of the RPM switch sends: its new state, on or off, and nothing else. */
export function rpmSourcesToggledEvent(on: boolean): ProductEvent {
  return { name: 'rpm_sources_toggled', state: on ? 'on' : 'off' }
}

/** The event a change of currency sends: the code, and nothing else. */
export function currencyChangedEvent(currency: RevenueCurrency): ProductEvent {
  return { name: 'currency_changed', currency }
}

/** What the Settings screen's status says while its channels are read, and nothing once they are. */
export function channelsLoadingTextOf(channelsWaiting: boolean): string | null {
  return channelsWaiting ? loadingText.channels : null
}
