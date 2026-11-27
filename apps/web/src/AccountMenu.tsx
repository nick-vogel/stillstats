import type { ClientSettingsAnswer, Theme } from '@creator-analytics/api-types'
import { avatarLetterOf } from '@creator-analytics/visual-system/avatar'
import {
  ChevronsUpDownIcon,
  Clapperboard,
  ImageIcon,
  LogOutIcon,
  type LucideIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  TagIcon,
} from 'lucide-react'
import {
  accountRowLabelOf,
  type FreeTool,
  freeTools,
  freeToolsLabel,
  newTabLabelOf,
  settingsItem,
  signOutItem,
  toolLinkClickedEvent,
  versionLineOf,
} from './account-menu.ts'
import { track } from './analytics.ts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu.tsx'
import { followInPlace } from './RouteLink.tsx'
import { hrefOf, isRouteOnView, type Navigate, type Route, routeToSettings } from './route.ts'
import { themeLabel, themeOptions } from './settings.ts'
import { settingsName } from './settings-name.ts'

const toolIcons: Record<FreeTool, LucideIcon> = {
  'mid-roll-manager': Clapperboard,
  'thumbnail-preview': ImageIcon,
}

const themeIcons: Record<Theme, LucideIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}

/**
 * The avatar and the menu it opens: an ARIA menu on Base UI's Menu, its items in one roving focus
 * order. Escape and a press outside close it, and focus goes back to the avatar unless the press
 * put it on another control. Not modal, so the page still scrolls and a press outside reaches the
 * control it lands on, as it did before the menu was an ARIA menu. In the header it opens under
 * the avatar, at its end; in the sidebar's footer, at the window's bottom, it opens beside the
 * sidebar, its bottom at the avatar's, where there is room for it.
 *
 * `row` makes the button the sidebar's account row (creator-analytics#531, #590): open, the avatar,
 * then "Settings" over the email, then a chevron, one button named "Settings, " and the email, so
 * a press anywhere on the row opens the menu and the name holds the text on view; collapsed, the
 * avatar alone, named "Settings". The avatar and the chevron are then pictures inside the button,
 * hidden from the name. Without it the button is the avatar, named "Settings", wherever the header
 * holds it.
 *
 * The menu follows shadcn's `sidebar-07` account menu (creator-analytics#590): a header of the
 * avatar and the email, a label and not an item, then Settings, a separator, the Theme group
 * (creator-analytics#692), a separator, the free tools, a separator, Sign out and the version line.
 * Each item leads with an icon hidden from its name.
 *
 * The Theme group is three radio items, Light, Dark and System, with `theme` checked, the words of
 * Settings' control. A choice calls `onThemeChange`, which App sends down the same save as
 * Settings, so the two always show the same theme; a press on the checked item saves nothing, and
 * no event is sent (Nick, 2026-11-12). The menu stays open on a choice, so the page changes behind
 * it and another theme is one press away.
 */
export function AccountMenu({
  email,
  route,
  navigate,
  onSignOut,
  clientSettings,
  side = 'bottom',
  row,
  theme,
  onThemeChange,
}: {
  email: string
  route: Route
  navigate: Navigate
  onSignOut: () => void
  clientSettings: ClientSettingsAnswer | null
  side?: 'bottom' | 'right'
  row?: 'open' | 'collapsed' | undefined
  /** The theme on view, the one Settings shows. */
  theme: Theme
  onThemeChange: (theme: Theme) => void
}) {
  const settings = routeToSettings(route)
  const versionLine = versionLineOf(clientSettings)
  // A move to the screen already on view is skipped, so it neither re-renders nor replaces the
  // history entry; every other move goes through.
  const followUnlessOnView: Navigate = (next, options) => {
    if (!isRouteOnView(next, route)) navigate(next, options)
  }

  return (
    <DropdownMenu modal={false}>
      {row === undefined ? (
        <DropdownMenuTrigger className="avatar" type="button" aria-label={settingsName}>
          {avatarLetterOf(email)}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          className="sidebar-account"
          type="button"
          aria-label={row === 'open' ? accountRowLabelOf(email) : settingsName}
        >
          <span className="avatar" aria-hidden="true">
            {avatarLetterOf(email)}
          </span>
          {row === 'open' && (
            <>
              <span className="account-lines">
                <span className="account-heading">{settingsName}</span>
                <span className="sidebar-email">{email}</span>
              </span>
              <ChevronsUpDownIcon className="account-chevron" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent side={side} align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="account-menu-header">
            <span className="avatar" aria-hidden="true">
              {avatarLetterOf(email)}
            </span>
            <span className="wrap-anywhere">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuLinkItem
            href={hrefOf(settings)}
            closeOnClick
            // The menu closes on the click and gives focus back to the avatar. From another
            // screen, Settings then moves focus to its heading as it opens; already on
            // Settings, the screen neither moves nor replaces the history entry, and only scrolls
            // to the top, so focus stays on the avatar. A modified click leaves the menu open
            // while the browser opens Settings in a new tab, as the old menu did.
            onClick={(event) => {
              if (!followInPlace(event, settings, followUnlessOnView)) event.preventBaseUIHandler()
            }}
          >
            <SettingsIcon aria-hidden="true" />
            {settingsItem}
          </DropdownMenuLinkItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          className="gap-2"
          value={theme}
          // Base UI calls this on every press of a radio item, the checked one too.
          onValueChange={(chosen: Theme) => {
            if (chosen !== theme) onThemeChange(chosen)
          }}
        >
          <DropdownMenuLabel>{themeLabel}</DropdownMenuLabel>
          {themeOptions.map(({ value, label }) => {
            const Icon = themeIcons[value]
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="gap-2">
          <DropdownMenuLabel>{freeToolsLabel}</DropdownMenuLabel>
          {freeTools.map(({ tool, name, href }) => {
            const Icon = toolIcons[tool]
            return (
              <DropdownMenuLinkItem
                key={tool}
                href={href}
                target="_blank"
                rel="noopener"
                aria-label={newTabLabelOf(name)}
                closeOnClick
                // The browser opens the tab; the menu closes behind it, with focus on the avatar.
                onClick={() => track(toolLinkClickedEvent(tool, 'account-menu'))}
              >
                <Icon aria-hidden="true" />
                {name}
              </DropdownMenuLinkItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Signed out, the header goes; a request that never reaches the server leaves it, with
            focus on the avatar. */}
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon aria-hidden="true" />
          {signOutItem}
        </DropdownMenuItem>
        {/* The release page is the site's, so the browser loads it in this tab, and no event is
            sent. */}
        {versionLine && (
          <DropdownMenuLinkItem
            href={versionLine.href}
            closeOnClick
            // Small and muted: a reference line, not an action like the items above it.
            className="text-[0.75rem] text-muted-foreground"
          >
            <TagIcon aria-hidden="true" />
            {versionLine.text}
          </DropdownMenuLinkItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
