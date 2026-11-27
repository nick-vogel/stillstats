import type { ClientSettingsAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  accountRowLabelOf,
  freeTools,
  newTabLabelOf,
  toolLinkClickedEvent,
  versionLineOf,
} from './account-menu.ts'
import { settingsName } from './settings-name.ts'

describe("the avatar menu's free tools", () => {
  test('are Mid-Roll Manager alone, at its nlvogel.com page, since Thumbnail Preview moved to the sidebar (creator-analytics#799)', () => {
    expect(freeTools).toStrictEqual([
      {
        tool: 'mid-roll-manager',
        name: 'Mid-Roll Manager',
        href: 'https://nlvogel.com/tools/mid-roll-manager',
      },
    ])
  })

  test("each have an accessible name that starts with the link's text and says it opens a new tab", () => {
    expect(newTabLabelOf('Mid-Roll Manager')).toBe('Mid-Roll Manager (opens in a new tab)')
  })
})

describe('the event a click on a free tool sends', () => {
  test('is tool_link_clicked with the tool and where the click came from, and no other value', () => {
    expect(toolLinkClickedEvent('mid-roll-manager', 'account-menu')).toStrictEqual({
      name: 'tool_link_clicked',
      tool: 'mid-roll-manager',
      source: 'account-menu',
    })
    expect(toolLinkClickedEvent('thumbnail-preview', 'sidebar')).toStrictEqual({
      name: 'tool_link_clicked',
      tool: 'thumbnail-preview',
      source: 'sidebar',
    })
    expect(toolLinkClickedEvent('thumbnail-preview', 'menu')).toStrictEqual({
      name: 'tool_link_clicked',
      tool: 'thumbnail-preview',
      source: 'menu',
    })
  })
})

describe("the sidebar's account row's name (creator-analytics#590)", () => {
  test('is Settings, then the email it shows', () => {
    expect(accountRowLabelOf('nick@example.com')).toBe(`${settingsName}, nick@example.com`)
  })
})

describe("the account menu's version line", () => {
  const production: ClientSettingsAnswer = {
    environment: 'production',
    version: '2026.11.9',
    commit: 'abc1234',
    releasePath: '/releases/2026.11.9',
    openPanelClientId: null,
  }

  test('on production, shows the version alone, linked to its release page', () => {
    expect(versionLineOf(production)).toEqual({
      text: 'Version 2026.11.9',
      href: '/releases/2026.11.9',
    })
  })

  test('on staging, shows the version alone too, with no commit', () => {
    expect(versionLineOf({ ...production, environment: 'staging' })?.text).toBe('Version 2026.11.9')
  })

  test('is not shown with no version, or with no client settings', () => {
    expect(versionLineOf({ ...production, version: null, releasePath: null })).toBeNull()
    expect(versionLineOf(null)).toBeNull()
  })
})
