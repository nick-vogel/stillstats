import type { ClientSettingsAnswer, ListedChannel, Theme } from '@creator-analytics/api-types'
import { AccountMenu } from './AccountMenu.tsx'
import { ChannelPicker } from './ChannelPicker.tsx'
import { pickerShownFor, routeToChannel } from './channel-picker.ts'
import { HeaderMenu, type HeaderMenuProps } from './HeaderMenu.tsx'
import { Placeholder } from './Placeholder.tsx'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToList } from './route.ts'

/**
 * With no email yet, while the session is read, the avatar's place holds a still placeholder. With
 * `menu` set, the "Menu" button follows the wordmark and holds the sidebar's items in its panel,
 * the channel picker among them, so the row keeps the wordmark, the button and the avatar alone
 * (creator-analytics#891).
 */
export function Header({
  email,
  channels,
  selected,
  route,
  navigate,
  onSignOut,
  clientSettings,
  hidden,
  theme,
  onThemeChange,
  menu,
}: {
  email: string | null
  channels: ListedChannel[] | null
  selected: ListedChannel | null
  route: Route
  navigate: Navigate
  onSignOut: () => void
  clientSettings: ClientSettingsAnswer | null
  hidden: boolean
  theme: Theme
  onThemeChange: (theme: Theme) => void
  menu: HeaderMenuProps | null
}) {
  return (
    <header className="app-header" hidden={hidden} aria-busy={email === null}>
      <RouteLink className="wordmark" route={routeToList(route)} navigate={navigate}>
        stillstats
      </RouteLink>
      {menu && <HeaderMenu {...menu} channels={channels} selected={selected} />}
      {!menu && channels && selected && pickerShownFor(channels) && (
        <ChannelPicker
          channels={channels}
          selected={selected}
          onPick={(channelId) => navigate(routeToChannel(route, channelId))}
        />
      )}
      {email === null ? (
        <Placeholder shape="avatar" />
      ) : (
        <AccountMenu
          email={email}
          route={route}
          navigate={navigate}
          onSignOut={onSignOut}
          clientSettings={clientSettings}
          theme={theme}
          onThemeChange={onThemeChange}
        />
      )}
    </header>
  )
}
