// Limits: these tests cover the sidebar's links, its button's name and the collapsed channel icon's
// name as pure values. No test here renders the sidebar, so none shows the icon beside the text,
// the collapsed column or the tooltip; app.test.ts renders the links and the button, and the
// browser walk collapses the sidebar in Chrome.
import type { ListedChannel } from '@creator-analytics/api-types'
import { ChartSpline, ImageIcon, ListVideo, MessageSquare, Newspaper, Users } from 'lucide-react'
import { describe, expect, test } from 'vitest'
import { pickerLabel } from './channel-picker.ts'
import { sendFeedbackText } from './feedback.ts'
import { addressOf, routeOf } from './route.ts'
import {
  audienceLinkText,
  channelIconLabelOf,
  collapseSidebarLabel,
  expandSidebarLabel,
  feedbackLinkOf,
  retentionLinkText,
  sidebarLinksOf,
  sidebarToggleLabelOf,
  toolLinkOf,
  videosLinkText,
  whatsNewLinkText,
} from './sidebar.ts'

/** Each link as its text, icon, address and whether it is the current one. */
function linksOn(path: string, search = '?window=last90&page=2') {
  return sidebarLinksOf(routeOf(path, search)).map(({ text, icon, route, current }) => ({
    text,
    icon,
    address: addressOf(route),
    current,
  }))
}

describe("the sidebar's links", () => {
  test('on the channel screen: Videos to the channel screen, current, then Audience and "What\'s new" to their screens, each with its icon and the query kept', () => {
    expect(linksOn('')).toEqual([
      { text: videosLinkText, icon: ListVideo, address: '?window=last90&page=2', current: true },
      {
        text: audienceLinkText,
        icon: Users,
        address: 'audience?window=last90&page=2',
        current: false,
      },
      {
        text: retentionLinkText,
        icon: ChartSpline,
        address: 'retention?window=lifetime&listWindow=last90',
        current: false,
      },
      {
        text: whatsNewLinkText,
        icon: Newspaper,
        address: 'whats-new?window=last90&page=2',
        current: false,
      },
    ])
  })

  test("on a video's page, Videos is current and goes back to the list", () => {
    expect(linksOn('videos/abc')).toEqual([
      { text: videosLinkText, icon: ListVideo, address: '?window=last90&page=2', current: true },
      {
        text: audienceLinkText,
        icon: Users,
        address: 'audience?window=last90&page=2',
        current: false,
      },
      {
        text: retentionLinkText,
        icon: ChartSpline,
        address: 'retention?window=lifetime&listWindow=last90',
        current: false,
      },
      {
        text: whatsNewLinkText,
        icon: Newspaper,
        address: 'whats-new?window=last90&page=2',
        current: false,
      },
    ])
  })

  test('on the Audience screen, Audience is current', () => {
    expect(linksOn('audience', '?window=last90')).toEqual([
      { text: videosLinkText, icon: ListVideo, address: '?window=last90', current: false },
      { text: audienceLinkText, icon: Users, address: 'audience?window=last90', current: true },
      {
        text: retentionLinkText,
        icon: ChartSpline,
        address: 'retention?window=lifetime&listWindow=last90',
        current: false,
      },
      {
        text: whatsNewLinkText,
        icon: Newspaper,
        address: 'whats-new?window=last90',
        current: false,
      },
    ])
  })

  test('on the Audience screen with a window chosen there, Audience leads to the screen as it is (creator-analytics#1049)', () => {
    const audience = linksOn('audience', '?window=last7&listWindow=lifetime').find(
      ({ text }) => text === audienceLinkText,
    )

    expect(audience).toMatchObject({
      address: 'audience?window=last7&listWindow=lifetime',
      current: true,
    })
  })

  test('on "What\'s new", it is current, and Videos and Audience lead off it with the query kept (creator-analytics#577)', () => {
    expect(linksOn('whats-new', '?window=last90')).toEqual([
      { text: videosLinkText, icon: ListVideo, address: '?window=last90', current: false },
      { text: audienceLinkText, icon: Users, address: 'audience?window=last90', current: false },
      {
        text: retentionLinkText,
        icon: ChartSpline,
        address: 'retention?window=lifetime&listWindow=last90',
        current: false,
      },
      {
        text: whatsNewLinkText,
        icon: Newspaper,
        address: 'whats-new?window=last90',
        current: true,
      },
    ])
  })

  test("on the retention comparison, Retention is current and Videos is not, and every link leads off it with the list's query and no pick (creator-analytics#951)", () => {
    expect(linksOn('retention', '?window=lifetime&sort=publishedAt&curves=a,b')).toEqual([
      {
        text: videosLinkText,
        icon: ListVideo,
        address: '?window=lifetime&sort=publishedAt',
        current: false,
      },
      {
        text: audienceLinkText,
        icon: Users,
        address: 'audience?sort=publishedAt&listWindow=lifetime',
        current: false,
      },
      {
        text: retentionLinkText,
        icon: ChartSpline,
        address: 'retention?window=lifetime&sort=publishedAt',
        current: true,
      },
      {
        text: whatsNewLinkText,
        icon: Newspaper,
        address: 'whats-new?window=lifetime&sort=publishedAt',
        current: false,
      },
    ])
  })

  test('on Settings, none is current', () => {
    expect(linksOn('settings', '').map(({ current }) => current)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  test('on the upgrade screen, none is current (creator-analytics#788)', () => {
    expect(linksOn('upgrade', '').map(({ current }) => current)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  test('on the feedback form, none is current', () => {
    expect(linksOn('feedback', '?screen=audience').map(({ current }) => current)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  test('on the admin feedback screen, none is current, and none leads to it (creator-analytics#583)', () => {
    const links = linksOn('admin/feedback', '?window=last90')

    expect(links.map(({ current }) => current)).toEqual([false, false, false, false])
    expect(links.map(({ address }) => address)).not.toContainEqual(expect.stringContaining('admin'))
    expect(feedbackLinkOf(routeOf('admin/feedback', '')).current).toBe(false)
  })
})

describe('the sidebar\'s "Send feedback" item', () => {
  test('leads to the form, naming the screen on view and keeping the query, with its icon', () => {
    const { text, icon, route, current } = feedbackLinkOf(routeOf('audience', '?window=last90'))

    expect({ text, icon, address: addressOf(route), current }).toEqual({
      text: sendFeedbackText,
      icon: MessageSquare,
      address: 'feedback?window=last90&screen=audience',
      current: false,
    })
  })

  test('on the form, is current and leads to the form on view', () => {
    const form = routeOf('feedback', '?window=last90&screen=settings')
    const link = feedbackLinkOf(form)

    expect(link.current).toBe(true)
    expect(addressOf(link.route)).toBe(addressOf(form))
  })
})

describe('the sidebar\'s "Thumbnail preview" item (creator-analytics#799)', () => {
  test('opens the tool page in a new tab, with its icon, a name that starts with its text and says so, and a click event from the sidebar', () => {
    expect(toolLinkOf('sidebar')).toStrictEqual({
      text: 'Thumbnail preview',
      icon: ImageIcon,
      href: '/tools/thumbnail-preview',
      label: 'Thumbnail preview (opens in a new tab)',
      event: { name: 'tool_link_clicked', tool: 'thumbnail-preview', source: 'sidebar' },
    })
  })

  test("in the header's Menu panel, is the same item with a click event from the menu (creator-analytics#891)", () => {
    const { event, ...item } = toolLinkOf('menu')
    const { event: _sidebarEvent, ...sidebarItem } = toolLinkOf('sidebar')

    expect(item).toStrictEqual(sidebarItem)
    expect(event).toStrictEqual({
      name: 'tool_link_clicked',
      tool: 'thumbnail-preview',
      source: 'menu',
    })
  })
})

describe("the sidebar's toggle", () => {
  test('is named for the change a press makes: collapsing when open, expanding when collapsed', () => {
    expect(sidebarToggleLabelOf(true)).toBe(collapseSidebarLabel)
    expect(sidebarToggleLabelOf(false)).toBe(expandSidebarLabel)
  })
})

describe("the collapsed sidebar's channel icon", () => {
  test("is named for the picker it opens and the channel on view, as the picker's option names it", () => {
    const channel: ListedChannel = {
      id: 'c-1',
      youtubeChannelId: 'UC1234567890',
      title: 'Nick Vogel',
      handle: '@nick_vogel',
      revenueConsentedAt: null,
    }

    expect(channelIconLabelOf(channel)).toBe(`${pickerLabel}: Nick Vogel (@nick_vogel)`)
    expect(channelIconLabelOf({ ...channel, title: null })).toBe(`${pickerLabel}: UC1234567890`)
  })
})
