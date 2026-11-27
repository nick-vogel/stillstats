import type { ClientSettingsAnswer, ListedChannel, Theme } from '@creator-analytics/api-types'
import { CircleArrowUp, ExternalLink, HandHeart, MonitorPlay, X } from 'lucide-react'
import { type MouseEvent, useRef } from 'react'
import { flushSync } from 'react-dom'
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarRoot,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { AccountMenu } from './AccountMenu.tsx'
import { track } from './analytics.ts'
import { pickerShownFor, routeToChannel } from './channel-picker.ts'
import { Placeholder } from './Placeholder.tsx'
import { followInPlace, RouteLink } from './RouteLink.tsx'
import { hrefOf, type Navigate, type Route, routeToList } from './route.ts'
import { SidebarChannelPicker } from './SidebarChannelPicker.tsx'
import { StillstatsMark } from './StillstatsMark.tsx'
import {
  channelIconLabelOf,
  feedbackLinkOf,
  sidebarLabel,
  sidebarLinksOf,
  sidebarToggleLabelOf,
  toolLinkOf,
} from './sidebar.ts'
import { hideSupportLabel, supportHeading } from './support.ts'
import { hideUpgradeLabel, upgradeLinkText } from './upgrade-prompt.ts'

/**
 * The sidebar beside every signed-in screen with a channel. Its nav holds the links
 * (`sidebarLinksOf`), each an icon and its text; a followed link keeps focus, as the sidebar stays
 * on screen and the link, now the current one, is still there to hold it. After "What's new", the
 * nav's last item, "Thumbnail preview", opens the free tool's page in a new tab (`toolLinkOf`,
 * creator-analytics#799, creator-analytics#890), with an external link icon after its text, and is
 * never the current page, as its page is outside the app. While `supportLink` is set, a quiet
 * support item links to Stripe's page in a new tab, with a button that hides it and leaves focus on
 * the nav, as the item goes. Beside it, whether or not it shows, the "Send feedback" item opens the
 * feedback form (`feedbackLinkOf`). While `upgradeRoute` is set, an "Upgrade" item built the way
 * the support item is opens the upgrade screen in place for the channel on view, current there,
 * with a button that hides it and leaves focus on the nav (creator-analytics#907). No badge, count
 * or animation (ADR 0011).
 *
 * From 48rem, on a window tall enough for its rows (`sidebarColumnQuery`), it is a column at the
 * window's left edge, its full height, in place of the header: the wordmark, the nav, and in its
 * footer the "Send feedback" item, the support item, the channel picker (a two-line button), the
 * account row (the avatar and the email, one button that opens the account menu) and the toggle
 * that folds it to a column of icons. Folded, each text leaves the view but stays its control's
 * name, and a hover or a focus shows it in a tooltip. Elsewhere the sidebar renders nothing: the
 * header stays, and its Menu holds the sidebar's items (`HeaderMenu`, creator-analytics#891).
 *
 * With no email yet, while the session is read, the column shows from the first paint
 * (creator-analytics#507), open and busy: the real wordmark, a still place for each of the nav's
 * items, and in its footer the account row's place, the avatar's where the avatar lands, and the
 * toggle's. It holds no nav, account menu or toggle until the session lands, and no place for the
 * support item or the picker, which land above the account row and move neither the wordmark nor
 * the avatar.
 */
export function Sidebar({
  email,
  channels,
  selected,
  route,
  navigate,
  onSignOut,
  clientSettings,
  supportLink,
  onSupportOpened,
  onHideSupport,
  upgradeRoute,
  onUpgradeOpened,
  onHideUpgrade,
  onWhatsNewOpened,
  theme,
  onThemeChange,
}: {
  email: string | null
  channels: ListedChannel[] | null
  selected: ListedChannel | null
  route: Route
  navigate: Navigate
  onSignOut: () => void
  clientSettings: ClientSettingsAnswer | null
  supportLink: string | null
  onSupportOpened: () => void
  onHideSupport: () => void
  /** The upgrade screen for the channel on view, while the "Upgrade" item shows, else null. */
  upgradeRoute: Route | null
  /** Called on every click of the "Upgrade" item, a modified click included. */
  onUpgradeOpened: () => void
  onHideUpgrade: () => void
  /**
   * Called on a click of the "What's new" link while another screen is on view, folded or open, a
   * modified click included.
   */
  onWhatsNewOpened: () => void
  /** The theme on view, which the account menu checks, and its change. */
  theme: Theme
  onThemeChange: (theme: Theme) => void
}) {
  const nav = useRef<HTMLElement>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const { open, column, state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'
  if (!column) return null

  function hideSupport() {
    nav.current?.focus()
    onHideSupport()
  }

  function hideUpgrade() {
    nav.current?.focus()
    onHideUpgrade()
  }

  const tool = toolLinkOf('sidebar')
  const ToolIcon = tool.icon
  const toolLinkProps = {
    href: tool.href,
    target: '_blank',
    rel: 'noopener',
    'aria-label': tool.label,
    onClick: () => track(tool.event),
  }

  const feedback = feedbackLinkOf(route)
  const FeedbackIcon = feedback.icon
  const feedbackLinkProps = {
    href: hrefOf(feedback.route),
    'aria-current': feedback.current ? ('page' as const) : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) =>
      followInPlace(event, feedback.route, navigate),
  }

  const links = (
    <nav aria-label={sidebarLabel} ref={nav} tabIndex={-1}>
      <SidebarMenu>
        {sidebarLinksOf(route).map(({ text, icon: Icon, route: target, current }) => (
          <SidebarMenuItem key={text}>
            <SidebarMenuButton
              tooltip={text}
              render={
                <a
                  href={hrefOf(target)}
                  aria-current={current ? 'page' : undefined}
                  onClick={(event) => {
                    if (target.whatsNew && !current) onWhatsNewOpened()
                    followInPlace(event, target, navigate)
                  }}
                />
              }
            >
              <Icon aria-hidden="true" />
              <span>{text}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={tool.text}
            className="sidebar-tool"
            render={<a {...toolLinkProps} />}
          >
            <ToolIcon aria-hidden="true" />
            <span>{tool.text}</span>
            <ExternalLink aria-hidden="true" className="sidebar-external-icon" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </nav>
  )

  const picked = channels !== null && selected !== null && pickerShownFor(channels)
  return (
    <SidebarRoot className="sidebar" aria-busy={email === null ? true : undefined}>
      <SidebarHeader>
        <RouteLink className="wordmark" route={routeToList(route)} navigate={navigate}>
          {collapsed ? (
            <>
              <StillstatsMark />
              <span className="visually-hidden">stillstats</span>
            </>
          ) : (
            'stillstats'
          )}
        </RouteLink>
      </SidebarHeader>
      {email === null ? (
        <>
          <SidebarContent>
            {sidebarLinksOf(route).map(({ text }) => (
              <Placeholder key={text} shape="sidebar-row" />
            ))}
            <Placeholder shape="sidebar-row" />
          </SidebarContent>
          <SidebarFooter>
            <div className="sidebar-account-place">
              <Placeholder shape="avatar" />
              <Placeholder shape="line" />
            </div>
            <Placeholder shape="sidebar-row" />
          </SidebarFooter>
        </>
      ) : (
        <>
          <SidebarContent>{links}</SidebarContent>
          <SidebarFooter>
            <SidebarMenuButton tooltip={feedback.text} render={<a {...feedbackLinkProps} />}>
              <FeedbackIcon aria-hidden="true" />
              <span>{feedback.text}</span>
            </SidebarMenuButton>
            {upgradeRoute !== null && (
              <div className="sidebar-prompt">
                <SidebarMenuButton
                  tooltip={upgradeLinkText}
                  render={
                    <a
                      href={hrefOf(upgradeRoute)}
                      aria-current={route.upgrade ? 'page' : undefined}
                      onClick={(event) => {
                        onUpgradeOpened()
                        followInPlace(event, upgradeRoute, navigate)
                      }}
                    />
                  }
                >
                  <CircleArrowUp aria-hidden="true" />
                  <span>{upgradeLinkText}</span>
                </SidebarMenuButton>
                {!collapsed && (
                  <button type="button" aria-label={hideUpgradeLabel} onClick={hideUpgrade}>
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {supportLink !== null && (
              <div className="sidebar-prompt">
                <SidebarMenuButton
                  tooltip={supportHeading}
                  render={
                    <a
                      href={supportLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onSupportOpened}
                    />
                  }
                >
                  <HandHeart aria-hidden="true" />
                  <span>{supportHeading}</span>
                </SidebarMenuButton>
                {!collapsed && (
                  <button type="button" aria-label={hideSupportLabel} onClick={hideSupport}>
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {picked &&
              (collapsed ? (
                // The press opens the sidebar and renders its picker at once, so the picker is there
                // to take focus.
                <SidebarMenuButton
                  type="button"
                  tooltip={channelIconLabelOf(selected)}
                  className="sidebar-channel"
                  onClick={() => {
                    flushSync(toggleSidebar)
                    picker.current?.focus()
                  }}
                >
                  <MonitorPlay aria-hidden="true" />
                  <span>{channelIconLabelOf(selected)}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarChannelPicker
                  channels={channels}
                  selected={selected}
                  onPick={(channelId) => navigate(routeToChannel(route, channelId))}
                  ref={picker}
                />
              ))}
            <AccountMenu
              email={email}
              route={route}
              navigate={navigate}
              onSignOut={onSignOut}
              clientSettings={clientSettings}
              side="right"
              row={collapsed ? 'collapsed' : 'open'}
              theme={theme}
              onThemeChange={onThemeChange}
            />
            <SidebarTrigger label={sidebarToggleLabelOf(open)} />
          </SidebarFooter>
        </>
      )}
    </SidebarRoot>
  )
}
