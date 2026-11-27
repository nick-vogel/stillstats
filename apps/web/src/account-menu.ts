import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import type { ProductEvent } from './landing.ts'
import { settingsName } from './settings-name.ts'

// "Settings" is the account row's top line and the name of the collapsed row and of the header's
// avatar, and "Settings, " and the email is the open row's name, approved by Nick on 2026-11-09 in
// creator-analytics#571; they replace "Account menu" from creator-analytics#66 and #531. Sign out is
// approved word for word in creator-analytics#66. Change them only with Nick.
export const settingsItem = settingsName
export const signOutItem = 'Sign out'

/**
 * The name of the sidebar's open account row, which shows "Settings" over the email: the approved
 * word, then the email, so the name holds the text on view (WCAG 2.5.3).
 */
export function accountRowLabelOf(email: string): string {
  return `${settingsName}, ${email}`
}

// Approved word for word in creator-analytics#160. Change it only with Nick.
export const freeToolsLabel = 'Free tools from the maker of Stillstats'
const newTabSuffix = '(opens in a new tab)'

export type FreeTool = 'mid-roll-manager' | 'thumbnail-preview'

/**
 * Nick's own free tools, linked from the avatar menu for every signed-in user. Thumbnail Preview
 * moved to the sidebar's "Thumbnail preview" item (creator-analytics#799); the type still names it,
 * since that item's event does.
 */
export const freeTools: readonly { tool: FreeTool; name: string; href: string }[] = [
  {
    tool: 'mid-roll-manager',
    name: 'Mid-Roll Manager',
    href: 'https://nlvogel.com/tools/mid-roll-manager',
  },
]

/** A new-tab link's accessible name: its visible text first, so the label is in the name. */
export function newTabLabelOf(name: string): string {
  return `${name} ${newTabSuffix}`
}

/**
 * Where a click on a free tool's link came from: the sidebar's item, the avatar menu, or the item
 * in the header's Menu panel below the sidebar's column (creator-analytics#891).
 */
export type ToolLinkSource = 'sidebar' | 'account-menu' | 'menu'

export function toolLinkClickedEvent(tool: FreeTool, source: ToolLinkSource): ProductEvent {
  return { name: 'tool_link_clicked', tool, source }
}

/**
 * The menu's last line: the version, linked to its release page, the same on staging and
 * production. None with no version in the build. Nick dropped the staging commit from it in
 * creator-analytics#628. Change it only with Nick.
 */
export function versionLineOf(
  settings: ClientSettingsAnswer | null,
): { text: string; href: string } | null {
  if (!settings?.version || !settings.releasePath) return null
  return { text: `Version ${settings.version}`, href: settings.releasePath }
}
