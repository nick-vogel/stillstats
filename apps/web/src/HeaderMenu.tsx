import type { ListedChannel } from '@creator-analytics/api-types'
import { CircleArrowUp, ExternalLink, HandHeart, Menu } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { track } from './analytics.ts'
import { ChannelPicker } from './ChannelPicker.tsx'
import { pickerShownFor, routeToChannel } from './channel-picker.ts'
import { followInPlace } from './RouteLink.tsx'
import { hrefOf, type Navigate, type Route } from './route.ts'
import {
  feedbackLinkOf,
  menuButtonText,
  sidebarLabel,
  sidebarLinksOf,
  toolLinkOf,
} from './sidebar.ts'
import { hideSupportLabel, hideSupportText, supportHeading } from './support.ts'
import { hideUpgradeLabel, upgradeLinkText } from './upgrade-prompt.ts'

export interface HeaderMenuProps {
  route: Route
  navigate: Navigate
  supportLink: string | null
  onSupportOpened: () => void
  onHideSupport: () => void
  /** The upgrade screen for the channel on view, while the "Upgrade" item shows, else null. */
  upgradeRoute: Route | null
  /** Called on every click of the "Upgrade" item, a modified click included. */
  onUpgradeOpened: () => void
  onHideUpgrade: () => void
  /** Called on a click of the "What's new" link while another screen is on view. */
  onWhatsNewOpened: () => void
}

/**
 * The header's "Menu" below the sidebar's column (creator-analytics#891): a disclosure button whose
 * panel, under the header, holds the sidebar's items. Its nav holds the channel screens' links and
 * the "Thumbnail preview" item; after a rule, the "Send feedback" item, while `upgradeRoute` is set
 * the "Upgrade" item with its "Hide" (creator-analytics#907), and while `supportLink` is set the
 * support item with its "Hide"; then, with two or more channels, the channel picker, last
 * as it is in the column's footer. The picker sits here, not in the header's row, as a 375px row
 * has no room for it beside the button and the avatar. A disclosure, not an ARIA menu: the ticket
 * asks for a button with `aria-expanded` over a panel of links.
 *
 * A channel screen, "Upgrade" or "Send feedback", followed in place, closes the panel and leaves
 * focus on the button, as the chosen link is hidden with the panel. A channel picked keeps the
 * panel open with focus on the picker, as an arrow key on the select picks at once in some
 * browsers and a keyboard user steps through the channels that way. A modified click, and the two
 * new-tab links, leave the panel open, as the page stays where it was. Escape and a press outside
 * close it, and Escape leaves focus on the button. Either "Hide" keeps the panel open, with focus
 * on its nav, as the item goes. Shown and hidden through `hidden`, never a `style` attribute, which
 * the content security policy's `style-src 'self'` refuses. No badge, count or animation (ADR 0011).
 */
export function HeaderMenu({
  route,
  navigate,
  supportLink,
  onSupportOpened,
  onHideSupport,
  upgradeRoute,
  onUpgradeOpened,
  onHideUpgrade,
  onWhatsNewOpened,
  channels,
  selected,
}: HeaderMenuProps & { channels: ListedChannel[] | null; selected: ListedChannel | null }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const nav = useRef<HTMLElement>(null)

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (button.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  function hideSupport() {
    nav.current?.focus()
    onHideSupport()
  }

  function hideUpgrade() {
    nav.current?.focus()
    onHideUpgrade()
  }

  const tool = toolLinkOf('menu')
  const ToolIcon = tool.icon
  const feedback = feedbackLinkOf(route)
  const FeedbackIcon = feedback.icon

  return (
    <>
      <button
        type="button"
        className="button button-quiet header-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        ref={button}
        onClick={() => setOpen((was) => !was)}
      >
        <Menu aria-hidden="true" />
        {menuButtonText}
      </button>
      <div id={panelId} className="header-menu-panel" hidden={!open} ref={panel}>
        <nav aria-label={sidebarLabel} ref={nav} tabIndex={-1}>
          <ul>
            {sidebarLinksOf(route).map(({ text, icon: Icon, route: target, current }) => (
              <li key={text}>
                <a
                  href={hrefOf(target)}
                  aria-current={current ? 'page' : undefined}
                  onClick={(event) => {
                    if (target.whatsNew && !current) onWhatsNewOpened()
                    followInPlace(event, target, navigate, close)
                  }}
                >
                  <Icon aria-hidden="true" />
                  {text}
                </a>
              </li>
            ))}
            <li>
              <a
                href={tool.href}
                target="_blank"
                rel="noopener"
                aria-label={tool.label}
                onClick={() => track(tool.event)}
              >
                <ToolIcon aria-hidden="true" />
                {tool.text}
                <ExternalLink aria-hidden="true" className="sidebar-external-icon" />
              </a>
            </li>
          </ul>
        </nav>
        <hr />
        <ul>
          <li>
            <a
              href={hrefOf(feedback.route)}
              aria-current={feedback.current ? 'page' : undefined}
              onClick={(event) => followInPlace(event, feedback.route, navigate, close)}
            >
              <FeedbackIcon aria-hidden="true" />
              {feedback.text}
            </a>
          </li>
          {upgradeRoute !== null && (
            <li className="sidebar-prompt">
              <a
                href={hrefOf(upgradeRoute)}
                aria-current={route.upgrade ? 'page' : undefined}
                onClick={(event) => {
                  onUpgradeOpened()
                  followInPlace(event, upgradeRoute, navigate, close)
                }}
              >
                <CircleArrowUp aria-hidden="true" />
                {upgradeLinkText}
              </a>
              <button type="button" aria-label={hideUpgradeLabel} onClick={hideUpgrade}>
                {hideSupportText}
              </button>
            </li>
          )}
          {supportLink !== null && (
            <li className="sidebar-prompt">
              <a
                href={supportLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onSupportOpened}
              >
                <HandHeart aria-hidden="true" />
                {supportHeading}
              </a>
              <button type="button" aria-label={hideSupportLabel} onClick={hideSupport}>
                {hideSupportText}
              </button>
            </li>
          )}
        </ul>
        {channels && selected && pickerShownFor(channels) && (
          <div className="header-menu-channel">
            <ChannelPicker
              channels={channels}
              selected={selected}
              onPick={(channelId) => navigate(routeToChannel(route, channelId))}
            />
          </div>
        )}
      </div>
    </>
  )
}
