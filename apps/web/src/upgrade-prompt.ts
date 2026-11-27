import type { Preferences } from '@creator-analytics/api-types'
import { hideSupportText } from './support.ts'

// Approved word for word in creator-analytics#907. Change it only with Nick.
export const upgradeLinkText = 'Upgrade'

/**
 * The accessible name of the button that hides the sidebar's "Upgrade" item: the x in the
 * sidebar's column, and "Hide" in the header's Menu panel below it, as the support item's is. It
 * joins the approved "Hide" to the item's text, so the name holds the visible text (WCAG 2.5.3).
 */
export const hideUpgradeLabel = `${hideSupportText} ${upgradeLinkText}`

/**
 * Where a click on a link to the upgrade screen came from: the sidebar's column, the header's
 * Menu panel below it, or the homepage's Pro card, whose site page sends the same event.
 */
export const upgradeLinkSources = ['sidebar', 'menu', 'homepage'] as const
export type UpgradeLinkSource = (typeof upgradeLinkSources)[number]

/**
 * The event a click on a link to the upgrade screen sends: where it came from, and no channel,
 * plan, price or account. Typed by its literal, not `ProductEvent`, so the site can share it.
 */
export function upgradeLinkClickedEvent<Source extends UpgradeLinkSource>(source: Source) {
  return { name: 'upgrade_link_clicked', source } as const
}

/** The event the "Upgrade" item's hide button sends: no channel, plan or account. */
export const upgradePromptDismissedEvent = { name: 'upgrade_prompt_dismissed' } as const

/**
 * Whether the sidebar shows its "Upgrade" item for the channel on view: only for its owner while
 * it is free and Pro is offered (`canUpgrade`), and never once the saved preferences hold the
 * dismissal, which a hide made since the read sets at once and a failed save takes back.
 */
export function upgradeItemShownOf(canUpgrade: boolean, saved: Preferences): boolean {
  return canUpgrade && saved.upgradePromptDismissed !== true
}
