import type { Preferences, SupportAnswer } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'

// The strings are approved word for word in creator-analytics#338, and `supportText` as reworded
// for Pro in creator-analytics#5. Change them only with Nick.
export const supportHeading = 'Support Stillstats'
export const supportText =
  'The free tier of Stillstats stays free. If it helps you, you can leave a one-time tip of any amount.'
export const supportLinkText = 'Leave a tip'
export const supportThanksText = 'Thank you for supporting Stillstats.'
// The sidebar's support link reads `supportHeading`, the same approved string.
export const hideSupportText = 'Hide'

/**
 * The accessible name of the button that hides the sidebar's support item: the x in the sidebar's
 * column, and "Hide" in the header's Menu panel below it. A lone "Hide" says nothing out of context, and the name holds the
 * visible text (WCAG 2.5.3).
 */
export const hideSupportLabel = `${hideSupportText} ${supportHeading}`

/** Where a creator can open Stripe's page for a Tip. */
export const supportSurfaces = ['sidebar', 'settings'] as const
export type SupportSurface = (typeof supportSurfaces)[number]

/** The event a click on a support link sends: its surface, and no amount, user or channel. */
export function supportOpenedEvent(surface: SupportSurface): ProductEvent {
  return { name: 'support_opened', surface }
}

/** The event the sidebar's support item's hide button sends: no amount, user or channel. */
export const supportPromptDismissedEvent: ProductEvent = { name: 'support_prompt_dismissed' }

/**
 * The link the sidebar's support item opens, or null when the item does not show: the answer
 * carries no link, its prompt is off, or the saved preferences hold a dismissal, which a hide made
 * since the answer was read sets at once and a failed save takes back.
 */
export function sidebarSupportLinkOf(
  support: SupportAnswer | null,
  saved: Preferences,
): string | null {
  if (!support?.link || !support.prompt || saved.supportPromptDismissed) return null
  return support.link
}

/**
 * Whether the address is Stripe's return after a Tip. Read before the route drops the parameter,
 * so a reload thanks no one twice.
 */
export function supportThanksOf(search: string): boolean {
  return new URLSearchParams(search).get('support') === 'thanks'
}
