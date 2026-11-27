import { channelNameOf, type ListedChannel } from '@creator-analytics/api-types'
import {
  ChartSpline,
  ImageIcon,
  ListVideo,
  type LucideIcon,
  MessageSquare,
  Newspaper,
  Users,
} from 'lucide-react'
import { newTabLabelOf, type ToolLinkSource, toolLinkClickedEvent } from './account-menu.ts'
import { pickerLabel } from './channel-picker.ts'
import { sendFeedbackText } from './feedback.ts'
import type { ProductEvent } from './landing.ts'
import {
  type Route,
  routeToAudience,
  routeToFeedback,
  routeToList,
  routeToRetention,
  routeToWhatsNew,
} from './route.ts'

// The link labels are approved word for word in creator-analytics#274 on 2026-10-19, and the nav's
// label in creator-analytics#328 on 2026-10-22. Change them only with Nick.
export const sidebarLabel = 'Channel screens'
export const videosLinkText = 'Videos'
export const audienceLinkText = 'Audience'

// Approved word for word in creator-analytics#936 (#951). Change it only with Nick.
export const retentionLinkText = 'Retention'

// The ticket and its epic write it so, creator-analytics#577; Nick approves it word for word at
// that ticket's review. Change it only with Nick.
export const whatsNewLinkText = "What's new"

// Approved word for word in creator-analytics#732. Change it only with Nick.
export const thumbnailPreviewLinkText = 'Thumbnail preview'

/**
 * The thumbnail preview tool's page on the site. Relative, since the web app is served under
 * `/app/` on the site's origin, so staging's item opens staging's page.
 */
export const thumbnailPreviewPath = '/tools/thumbnail-preview'

// Approved word for word in creator-analytics#476 on 2026-11-06. Change them only with Nick.
export const collapseSidebarLabel = 'Collapse sidebar'
export const expandSidebarLabel = 'Expand sidebar'

// Approved word for word in creator-analytics#891, the 2026-11-18 mockup session. The button never
// shows the current screen's name. Change it only with Nick.
export const menuButtonText = 'Menu'

export interface SidebarLink {
  text: string
  /** The icon that stands for the link when the sidebar is collapsed to a column of icons. */
  icon: LucideIcon
  route: Route
  current: boolean
}

/**
 * The sidebar's links, each keeping the address's query: "Videos" to the channel screen, current
 * there and on a video's page, "Audience" to the Audience screen, "Retention" to the retention
 * comparison and "What's new" to its screen, each current there. None is current on Settings, which the account menu opens, on the upgrade
 * screen, which the footer's "Upgrade" item opens, on the feedback form, which the footer's item
 * opens (`feedbackLinkOf`), or on the admin feedback screen, which nothing links to
 * (creator-analytics#583). The "Thumbnail preview" item (`toolLinkOf`) follows them in the same
 * list.
 */
export function sidebarLinksOf(route: Route): SidebarLink[] {
  return [
    {
      text: videosLinkText,
      icon: ListVideo,
      route: routeToList(route),
      current:
        !route.settings &&
        !route.audience &&
        !route.retention &&
        !route.whatsNew &&
        !route.upgrade &&
        !route.feedback &&
        !route.adminFeedback,
    },
    {
      text: audienceLinkText,
      icon: Users,
      route: routeToAudience(route),
      current: route.audience === true,
    },
    {
      text: retentionLinkText,
      icon: ChartSpline,
      route: routeToRetention(route),
      current: route.retention === true,
    },
    {
      text: whatsNewLinkText,
      icon: Newspaper,
      route: routeToWhatsNew(route),
      current: route.whatsNew === true,
    },
  ]
}

/**
 * The "Send feedback" item, beside the support item in the column's footer and in the header's
 * Menu panel below the column (creator-analytics#891): the form, naming the screen on view, current there. No badge, count or prompt
 * (ADR 0011).
 */
export function feedbackLinkOf(route: Route): SidebarLink {
  return {
    text: sendFeedbackText,
    icon: MessageSquare,
    route: routeToFeedback(route),
    current: route.feedback !== undefined,
  }
}

export interface ToolLink {
  text: string
  /** The icon that stands for the link when the sidebar is collapsed to a column of icons. */
  icon: LucideIcon
  href: string
  /** The accessible name, from the same new-tab helper the avatar menu's free tools use. */
  label: string
  /** The event a click sends. */
  event: ProductEvent
}

/**
 * The "Thumbnail preview" item, last in the sidebar's main list, after "What's new", in the column
 * and in the header's Menu panel below it: the free tool's page on the site, in a new tab
 * (creator-analytics#799, creator-analytics#890, creator-analytics#891). It is never the current
 * page, as its page is outside the app. Its event names where it was clicked.
 */
export function toolLinkOf(source: ToolLinkSource): ToolLink {
  return {
    text: thumbnailPreviewLinkText,
    icon: ImageIcon,
    href: thumbnailPreviewPath,
    label: newTabLabelOf(thumbnailPreviewLinkText),
    event: toolLinkClickedEvent('thumbnail-preview', source),
  }
}

/** The sidebar toggle's name, which says what a press does. */
export function sidebarToggleLabelOf(open: boolean): string {
  return open ? collapseSidebarLabel : expandSidebarLabel
}

/**
 * The name and the tooltip of the collapsed sidebar's channel icon: the picker's approved label and
 * the channel on view, named as the picker's option names it.
 */
export function channelIconLabelOf(channel: ListedChannel): string {
  return `${pickerLabel}: ${channelNameOf(channel)}`
}
