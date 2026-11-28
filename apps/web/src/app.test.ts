// @vitest-environment happy-dom
// Limits: these tests render App in happy-dom against a fake API (`fake-api.ts`), and drive it by
// its controls. happy-dom evaluates no stylesheet and no media query beyond its default 1024 by
// 768 viewport, and draws nothing, so none shows the toast's look, or what VoiceOver reads for it,
// and the channel h1's test sees only its class, not that the class hides it. Nick checks those at
// /app in a real browser. The toast is Base UI's, portalled to the document's body, so its tests
// find it there, by its landmark and role: its text is the status in the "Notifications" region,
// and its close button is found by its name. happy-dom lays nothing out and finds no element under
// a pointer, so a hover is a dispatched `mouseover`, and an upload tile's hover is the `pointerover`
// and the `mouseenter` Base UI's popover listens for, its leaving the `mouseleave` and a `mousemove`
// far from the card, so no test here shows a real pointer crossing from a tile to its card through
// Base UI's safe polygon; no test shows that a real pointer on the
// toast reaches Base UI's hold, or the toast's place at the bottom of the screen above the account
// menu's open popup; the browser walk checks both in Chrome, and that the close button is on Chrome's
// accessibility tree. The focus hold test focuses the close button after a dispatched Tab, without
// a browser's focus model. Swipe to dismiss, Base UI's own, shows in no test. A sign-in after
// "Sign out" or "Delete me" goes through Google and loads the app anew, so no test reaches a
// second session in one render. The signed-out screen shows no toast whatever the notice holds, so
// its tests pin only that rule; that "Sign out" clears the toasts (`clearToasts`) only once it
// succeeds is pinned from the other side, by a failed sign-out, which keeps the signed-in screen
// and its toasts. The account menu is Base UI's Menu, its popup portalled to the document's body,
// so its tests find it there, by role. happy-dom lays nothing out, so no test sees where the menu
// sits. It moves no focus on a press and finds no element under a press, so the press outside
// tests send the press's events to their target and move focus themselves, as a browser does: off
// the item on a press on nothing focusable, and onto the control a press lands on; no test sees
// that a press reaches the control under it, which a modal menu would stop. The tests open the menu
// with a click, not a real press, or from the focused avatar on ArrowDown, Enter and Space, with
// the key events and the click of detail 0 a browser sends for each, since happy-dom activates no
// button from a key. Those and the arrow key and Escape tests send keys without a browser's focus
// model. The browser walk opens the menu with a real press in Chrome, checks that it sits under
// the avatar at its end, moves focus onto an item with a real arrow key, closes it with a real
// Escape and a real press on nothing, each with focus back on the avatar, closes it with a real
// press on the wordmark, which keeps focus, and opens it with a real Enter, Space and ArrowDown on
// the focused avatar, each with focus on Settings. It walks the menu's items in order with real
// arrow keys, the Theme items among them, and chooses Dark there with a real press on a light
// system: the page changes at once and Settings then checks Dark (creator-analytics#692). The tool
// link test records at the document whether the app left the link's default alone, then prevents
// it, so no test sees the tool open in a new tab. The modified click tests record at the document whether the app left the default
// alone, of the Settings item and of each in-place link (the wordmark, the sidebar, a list title,
// the pager, "Back to videos", a step, a publish day top title), then prevent it, so no test sees a
// page open in a new tab, and each dispatches the click alone, with no press before it. A select is
// found by its role and accessible name, and that name is computed from `aria-label` and `<label>`
// only, a subset of the browser's computation; the browser walk's find of "Date range" in Chrome's
// accessibility tree reads the real one. The Format group and its radios are found the same way,
// their names computed from `aria-labelledby`, `aria-label` and a radio's own text only; the walk's
// find of the "Shorts" radio reads the real one. happy-dom moves focus and sends keys without a
// browser's focus model, so the arrow key test is the only keyboard check of the Format. The charts
// are TanStack Charts', which needs a real layout that happy-dom never gives it, so no test here
// checks how a chart draws, which point a tap on a chart selects, or where its card sits. A test
// that needs a pointer's point sends a mouse move to the library's svg in its own coordinates,
// which happy-dom's identity `getScreenCTM` resolves, as cursor-plot.test.ts does. The browser walk (apps/site/test/screenshot/browser-walk.ts, `pnpm test:browser`) drives
// every chart in Chrome: the stacked metric charts, the audience retention pair and the launch
// chart, under a pointer, the keys, Escape and a tap, with which live region speaks and the content
// security policy held. The chart tests here drive the app's own handlers, which need no layout:
// the keys, the blur rule, the value text and the live region, and the list rows that mark the
// launch chart's lines. The pager's landing tests stub the list table's place, the controls bar's
// height and the page's scroll: they show the scroll worked out from those sizes and where focus
// goes, not where a browser draws the list under the bar or what VoiceOver reads for the table's
// caption. Nick's walk of #236 (#342) covers both. happy-dom focuses an element with no tabindex,
// which a browser does not, so the refused page read and refused sort read tests read the refusal
// message's tabindex as well as where focus is; the browser walk refuses no list read.
import type {
  AdminFeedbackMessage,
  ChannelEntitlement,
  EntitlementsAnswer,
  ListedChannel,
  Preferences,
  StoredRetentionCurve,
  VideoListAnswer,
  VideoRow,
} from '@creator-analytics/api-types'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { accountRowLabelOf, settingsItem } from './account-menu.ts'
import {
  adminFeedbackHeading,
  doneFailedText,
  doneText,
  newerText,
  noMessagesText,
  notFoundHeading,
  notFoundLinkText,
  olderText,
  openOnlyText,
  sentTextOf,
} from './admin-feedback.ts'
import { track } from './analytics.ts'
import { audienceHeading, everyFormatText, noNumbersText } from './audience.ts'
import { pickerLabel } from './channel-picker.ts'
import { chartLabelOf, sliderTextOf } from './chart-slider.ts'
import { signedOutConsent } from './consent.ts'
import { formatFilterOptions, formatLabel } from './controls-bar.ts'
import { customRangeText, prefillOf } from './custom-range.ts'
import {
  type FakeApi,
  fakeBounds,
  fakeChannel,
  fakeCheckoutUrl,
  fakeDoneAt,
  fakeGoogleUrl,
  fakePortalUrl,
  fakePrices,
  fakeVideo,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from './fake-api.ts'
import {
  dailyLimitText,
  failedSendText,
  feedbackTextLabel,
  feedbackThanksText,
  feedbackTypeLabel,
  incompleteText,
  invalidAddressText,
  replyAddressLabel,
  replyCheckboxText,
  resetFormText,
  screenNames,
  sendFeedbackText,
  sendText,
} from './feedback.ts'
import { launchChartText } from './launch-chart.ts'
import { failedSaveNotice, toastCloseLabel } from './preferences.ts'
import { delayNoteOf, longDateOf, notProcessedText } from './processing.ts'
import { relativeName } from './retention.ts'
import { comparisonText, pickerText } from './retention-comparison.ts'
import { revenueText } from './revenue.ts'
import { defaultRoute } from './route.ts'
import {
  type ScreenTimingEntry,
  type ScreenTimingEntryType,
  startScreenTiming,
} from './screen-timing.ts'
import {
  channelTierTexts,
  currencySavedNotice,
  preferencesResetNotice,
  proHeading,
  themeLabel,
  themeOptions,
} from './settings.ts'
import { settingsName } from './settings-name.ts'
import {
  audienceLinkText,
  channelIconLabelOf,
  collapseSidebarLabel,
  expandSidebarLabel,
  menuButtonText,
  retentionLinkText,
  sidebarLabel,
  videosLinkText,
  whatsNewLinkText,
} from './sidebar.ts'
import { manageSubscriptionText, subscribeTexts } from './subscribe.ts'
import {
  hideSupportLabel,
  hideSupportText,
  supportHeading,
  supportLinkText,
  supportThanksText,
} from './support.ts'
import { themeCopyKey } from './theme.ts'
import { detailThumbnailSizes, listThumbnailSizes } from './thumbnail.ts'
import { toastSeconds } from './toast.ts'
import { allTrafficSources, trafficSourceLabel } from './traffic-sources.ts'
import { planTexts, upgradeFeatures, upgradeText } from './upgrade.ts'
import { hideUpgradeLabel, upgradeLinkText } from './upgrade-prompt.ts'
import {
  averageViewedColumn,
  minImpressionsLabel,
  pageSizeLabel,
  visibilitySwitchLabel,
} from './video-list.ts'
import { playerMoveText } from './video-player.ts'
import { refusedPageText, retryText, stepLabelOf } from './video-step.ts'
import {
  bannerCloseLabel,
  bannerLabel,
  bannerLinkText,
  bannerText,
  screenLinkText,
  whatsNewHeading,
} from './whats-new.ts'

let rendered: RenderedApp | null = null

async function render(address = ''): Promise<RenderedApp> {
  rendered = await renderApp(address)
  return rendered
}

vi.mock('./analytics.ts', () => ({ track: vi.fn() }))
// A video's screen with a retention curve loads the video player as it opens, so the fake player
// stands in for the one module that talks to YouTube, and no test here asks YouTube for anything.
vi.mock('./youtube-player.ts', () => import('./fake-youtube-player.ts'))

const savePreferences = 'PUT /api/me/preferences'

/**
 * An entitlements answer with Pro offered and the user's fields as given, else no blocks and
 * nothing to subscribe or manage. Each channel is the user's own, picked when it is paid, with no
 * purge date and nothing to subscribe or manage, unless given.
 */
function entitlementsOf(
  user: Partial<Omit<EntitlementsAnswer, 'channels'>>,
  ...channels: (Pick<ChannelEntitlement, 'channelId' | 'tier'> & Partial<ChannelEntitlement>)[]
): EntitlementsAnswer {
  return {
    paidTierOffered: true,
    canSubscribe: false,
    canManage: false,
    blocks: 0,
    slotsInUse: 0,
    ...user,
    channels: channels.map((channel) => ({
      owner: true,
      picked: channel.tier === 'paid',
      purgeDate: null,
      canSubscribe: false,
      canManage: false,
      ...channel,
    })),
  }
}

/** The user's live subscription of one block, its slot taken by the channel. */
const subscribedToOneBlock = { canManage: true, blocks: 1, slotsInUse: 1 }

/**
 * The toasts' landmark, which Base UI portals to the document's body, outside the app's container,
 * or null before the toaster mounts.
 */
function notifications(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="region"][aria-label="Notifications"]')
}

/**
 * The text the toast shows, or null with no toast on view. Read in the landmark, as the signed-out
 * screen and a placeholder show a status of their own.
 */
function toastText(): string | null {
  return notifications()?.querySelector('[role="status"]')?.textContent ?? null
}

/** The toast's close button, found by its name. */
function toastClose(): HTMLButtonElement {
  const region = notifications()
  if (!region) throw new Error('No notifications on view')
  return buttonLabelled(region, toastCloseLabel)
}

function switchNamed(container: HTMLElement, name: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label.list-switch')].find(
    (each) => each.textContent === name,
  )
  const input = label?.querySelector('input')
  if (!input) throw new Error(`No switch named ${name}`)
  return input
}

function headingNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.sortable-heading')].find(
    (each) => each.textContent?.startsWith(name),
  )
  if (!button) throw new Error(`No heading named ${name}`)
  return button
}

/**
 * The text a label gives the control inside it: the label's text with the control's own subtree
 * left out, so a select's option texts are no part of its name.
 */
function labelTextOf(label: HTMLLabelElement, control: Element): string {
  const walker = label.ownerDocument.createTreeWalker(label, NodeFilter.SHOW_TEXT)
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!control.contains(node)) text += node.textContent ?? ''
  }
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * A select's accessible name: its `aria-label`, else the text of the labels that name it. No
 * `aria-labelledby` and no `title` is read (see the Limits at the top). Each label counts once:
 * happy-dom lists a label that both holds the select and names it with `for` twice.
 */
function selectNameOf(select: HTMLSelectElement): string {
  const label = select.getAttribute('aria-label')?.trim()
  if (label) return label
  return [...new Set(select.labels)]
    .map((each) => labelTextOf(each, select))
    .join(' ')
    .trim()
}

/**
 * The one combobox whose accessible name is `name`: a select with no `multiple` and a `size` of at
 * most 1, as its implicit ARIA role says. It throws with none, or with more than one, on view.
 */
function selectNamed(container: HTMLElement, name: string): HTMLSelectElement {
  const found = comboboxesNamed(container, name)
  const [select] = found
  if (!select || found.length > 1) {
    throw new Error(`${found.length} comboboxes named ${name}, not 1`)
  }
  return select
}

/**
 * Every combobox on view whose accessible name is `name`. The size is read from its attribute, as
 * the role is, because happy-dom has no `size` property.
 */
function comboboxesNamed(container: HTMLElement, name: string): HTMLSelectElement[] {
  return [...container.querySelectorAll('select')].filter(
    (select) =>
      !select.multiple &&
      Number(select.getAttribute('size') ?? 0) <= 1 &&
      selectNameOf(select) === name,
  )
}

async function choose(container: HTMLElement, label: string, value: string): Promise<void> {
  const select = selectNamed(container, label)
  await act(async () => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}

/**
 * The sidebar's channel pickers on view: Base UI's Select, whose button is a combobox named "Channel:
 * " and the channel's name (`channelIconLabelOf`). Below 48rem the native select in the header's
 * Menu panel is the picker, which `selectNamed` finds.
 */
function sidebarPickersIn(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')].filter(
    (each) => each.getAttribute('aria-label')?.startsWith(`${pickerLabel}: `),
  )
}

/** The sidebar's one channel picker button. It throws with none, or with more than one. */
function sidebarPickerIn(container: HTMLElement): HTMLButtonElement {
  const found = sidebarPickersIn(container)
  const [picker] = found
  if (!picker || found.length > 1) throw new Error(`${found.length} sidebar pickers, not 1`)
  return picker
}

/**
 * The open sidebar picker's options, in order. Its list is portalled to the document's body, as
 * the account menu is, so they are found in the document.
 */
function pickerOptions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
}

/**
 * Picks a channel in the sidebar's picker: opens its list with a click, then clicks the option
 * that holds `text`, as `choose` picks in a native select.
 */
async function pickInSidebar(container: HTMLElement, text: string): Promise<void> {
  await click(sidebarPickerIn(container))
  const option = pickerOptions().find((each) => each.textContent?.includes(text))
  if (!option) throw new Error(`No picker option holding ${text}`)
  await click(option)
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (!button) throw new Error(`No button named ${name}`)
  return button
}

/** Every button with this name, in the order the screen shows them. */
function buttonsNamed(container: HTMLElement, name: string): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].filter(
    (each) => each.textContent?.trim() === name,
  )
}

/** The text the alert shows, or null with no alert on view. */
function alertOf(container: HTMLElement): string | null {
  return container.querySelector('p[role="alert"]')?.textContent ?? null
}

function buttonLabelled(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.getAttribute('aria-label') === label,
  )
  if (!button) throw new Error(`No button labelled ${label}`)
  return button
}

function linkNamed(container: HTMLElement, name: string): HTMLAnchorElement {
  const link = [...container.querySelectorAll('a')].find((each) => each.textContent === name)
  if (!link) throw new Error(`No link named ${name}`)
  return link
}

/** The first link with this accessible name: the stepper shows its links twice. */
function linkLabelled(container: HTMLElement, label: string): HTMLAnchorElement {
  const link = container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`)
  if (!link) throw new Error(`No link labelled ${label}`)
  return link
}

/**
 * Stands in for a browser whose language is `locale`: the app passes no locale to Intl, so Intl
 * falls back to the browser's own language. Every other part of Intl stays as it is.
 */
function defaultNumbersTo(locale: string): void {
  class Defaulted extends Intl.NumberFormat {
    constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
      super(locales ?? locale, options)
    }
  }
  const intl = Object.create(Intl) as typeof Intl
  Object.defineProperty(intl, 'NumberFormat', { value: Defaulted })
  vi.stubGlobal('Intl', intl)
}

/** The y axis labels of the charts under `selector`, each chart's top then its bottom. */
function chartLabels(container: HTMLElement, selector: string): (string | null)[] {
  return [...container.querySelectorAll(`${selector} .chart > .chart-label`)].map(
    (each) => each.textContent,
  )
}

function toastCount(): number {
  return notifications()?.querySelectorAll('[role="status"]').length ?? 0
}

/** Clicks `element`, and lets the requests the click starts, and their renders, land. */
async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

/**
 * Clicks `element` with `modifier` held, the click alone with no press before it, lets what it
 * starts land, and returns whether the app left the click's default to the browser. happy-dom
 * follows a link no handler prevented, where a browser would open a new tab, so a listener on the
 * document prevents the default to keep the page where it is. React listens on the render
 * container, and on a portal's container, both below the document, so the app has handled the
 * click by the time that listener sees it, and it first records whether the default is still there.
 */
async function modifiedClick(
  element: HTMLElement,
  modifier: 'metaKey' | 'ctrlKey' | 'shiftKey',
): Promise<boolean> {
  let leftToTheBrowser = false
  const keepPage = (event: Event) => {
    leftToTheBrowser = !event.defaultPrevented
    event.preventDefault()
  }
  document.addEventListener('click', keepPage)

  try {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [modifier]: true }),
      )
    })
    await settle()
  } finally {
    document.removeEventListener('click', keepPage)
  }
  return leftToTheBrowser
}

/** Renders the list and fails a switch of its Views column there, which shows the notice. */
async function failedOnTheList() {
  const api = installFakeApi()
  const shown = await render()
  api.failNext(savePreferences)
  await click(switchNamed(shown.container, 'Views'))
  expect(toastText()).toBe(failedSaveNotice)
  return { api, ...shown }
}

/** Renders Settings and fails a change of the currency there, which shows the notice. */
async function failedOnSettings() {
  const api = installFakeApi()
  const shown = await render('settings')
  api.failNext(savePreferences)
  await choose(shown.container, 'Currency', 'EUR')
  expect(toastText()).toBe(failedSaveNotice)
  return { api, ...shown }
}

beforeEach(() => {
  vi.stubGlobal('confirm', () => true)
  vi.mocked(track).mockClear()
})

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
  // The theme's copy and attribute outlive a render, so no test leaks its theme into the next.
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

/**
 * Holds the next two reads of `route`: App renders under StrictMode, which mounts each effect twice,
 * so the screen sends each of its reads twice and the second is the one it shows.
 */
function holdBoth(api: FakeApi, route: string) {
  const reads = [api.hold(route), api.hold(route)]
  return {
    release() {
      for (const read of reads) read.release()
    },
  }
}

describe('the channel screen', () => {
  test('names the channel in a visually hidden h1', async () => {
    installFakeApi()
    const { container } = await render()

    expect(container.querySelector('h1.visually-hidden')?.textContent).toBe('Nick Vogel')
  })

  test('shows the list, read with the default preferences, when the first preferences read fails', async () => {
    const api = installFakeApi({ pageSize: 50 })
    api.failNext('GET /api/me/preferences')
    const { container } = await render()

    expect(linkNamed(container, 'A video')).toBeTruthy()
    const listReads = api.requests.filter(({ path }) => path.endsWith('/videos'))
    expect(listReads.at(-1)?.query.get('pageSize')).toBe('10')
  })

  test("writes the launch chart's zero in the browser language's digits, as its top", async () => {
    defaultNumbersTo('ar-EG')
    const api = installFakeApi()
    api.videos = [{ ...fakeVideo, engagedViewsByDay: [800, 120, 40] }]
    const { container } = await render('?window=first7')

    const [top, bottom, ...rest] = chartLabels(container, '.launch-chart')
    expect(rest).toEqual([])
    expect(top).not.toMatch(/[0-9]/)
    expect(bottom).toBe('٠')
  })
})

/** The list row of the video titled `title`. */
function rowOf(container: HTMLElement, title: string): HTMLTableRowElement {
  const row = [...container.querySelectorAll<HTMLTableRowElement>('tr.video-list-row')].find(
    (each) => each.querySelector('a')?.textContent === title,
  )
  if (!row) throw new Error(`No row for ${title}`)
  return row
}

/**
 * The heading of the launch chart's card on view, or null with none: the card is the library
 * tooltip's body, and a hidden tooltip is no card.
 */
function launchCardDay(container: HTMLElement): string | null {
  return (
    container.querySelector('.launch-chart .ts-chart-tooltip:not([hidden]) .chart-hover-title')
      ?.textContent ?? null
  )
}

/** The text of the launch chart's own live region: the library's tooltip carries one too. */
function launchLiveRegion(container: HTMLElement): string {
  return (
    container.querySelector('.launch-chart p.visually-hidden[aria-live="polite"]')?.textContent ??
    ''
  )
}

/** The titles of the marked list rows. */
function markedTitles(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tr.video-list-row-marked')].map(
    (row) => row.querySelector('a')?.textContent ?? '',
  )
}

async function pointer(target: Element, type: string, relatedTarget: Element | null = null) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerType: 'mouse', relatedTarget }),
    )
  })
}

// The line colours are launch-plot.test.ts's; one test here reads the library's svg for which line
// takes the accent, and the rest read the list's marked rows and the plot's value text at each step.
// happy-dom lays nothing out, so the library resolves no point under a pointer; the browser walk
// shows a pointer selecting the nearest line and day in Chrome, and emptying a key step's live
// region (creator-analytics#343).
describe('the launch chart and its legend, the list', () => {
  const videoA = { ...fakeVideo, id: 'video-a', title: 'Video A', engagedViewsByDay: [10, 20, 30] }
  const videoB = { ...fakeVideo, id: 'video-b', title: 'Video B', engagedViewsByDay: [90, 5, 60] }

  test('name one video at every step from a key selection to a row hover and the pointer leaving the row', async () => {
    const api = installFakeApi()
    api.videos = [videoA, videoB]
    const { container } = await render('?window=first7')
    const plot = container.querySelector<HTMLElement>('.launch-chart [role="slider"]')
    if (!plot) throw new Error('No launch chart plot')
    const shown = () => ({
      marked: markedTitles(container),
      valueText: plot.getAttribute('aria-valuetext'),
      day: launchCardDay(container),
    })

    // ArrowDown with no selection selects line A, which marks row A.
    await act(async () => plot.focus())
    await act(async () => {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(shown()).toEqual({ marked: ['Video A'], valueText: 'Video A', day: 'Day 1' })

    // A hover on row B replaces the chart's selection: row B is marked, with no card.
    await pointer(rowOf(container, 'Video B'), 'pointerover')
    expect(shown()).toEqual({ marked: ['Video B'], valueText: sliderTextOf(null), day: null })

    // Leaving row B clears the mark.
    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    expect(shown()).toEqual({ marked: [], valueText: sliderTextOf(null), day: null })
  })

  /**
   * Renders videos A and B under the first 7 days and returns the launch chart's plot, with what a
   * creator sees of the mark: the marked rows, the plot's value text and the card's heading. The
   * start address defaults to the first 7 days.
   */
  async function renderLaunchChart(start = '?window=first7') {
    const api = installFakeApi()
    api.videos = [videoA, videoB]
    const { container } = await render(start)
    const plot = container.querySelector<HTMLElement>('.launch-chart [role="slider"]')
    if (!plot) throw new Error('No launch chart plot')
    const press = async (key: string) => {
      await act(async () => {
        plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
    }
    const shown = () => ({
      marked: markedTitles(container),
      valueText: plot.getAttribute('aria-valuetext'),
      day: launchCardDay(container),
    })
    return { container, plot, press, shown }
  }

  test('keep a key selection made while the pointer rests on a row when the pointer leaves that row', async () => {
    const { container, plot, press, shown } = await renderLaunchChart()

    await pointer(rowOf(container, 'Video B'), 'pointerover')
    await act(async () => plot.focus())
    await press('ArrowDown')
    await press('ArrowRight')
    const selected = { marked: ['Video A'], valueText: 'Video A', day: 'Day 2' }
    expect(shown()).toEqual(selected)

    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    expect(shown()).toEqual(selected)
  })

  test('clear the mark of a key selection a mode change by Back drops, once the pointer leaves the row it rests on', async () => {
    const { container, plot, press, shown } = await renderLaunchChart('?window=first7&chart=daily')
    await click(buttonNamed(container, 'Running total'))

    await pointer(rowOf(container, 'Video B'), 'pointerover')
    await act(async () => plot.focus())
    await press('ArrowDown')
    expect(shown()).toEqual({ marked: ['Video A'], valueText: 'Video A', day: 'Day 1' })

    await act(async () => window.history.back())
    await settle()
    expect(container.querySelector('.launch-chart button[aria-pressed="true"]')?.textContent).toBe(
      'Daily',
    )
    expect(document.activeElement).toBe(plot)
    const halfState = shown()

    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    await press('Escape')
    expect({ halfState, after: shown() }).toEqual({
      halfState,
      after: { marked: [], valueText: sliderTextOf(null), day: null },
    })
  })

  test("keep a hovered row's mark when focus leaves the plot", async () => {
    const { container, plot, shown } = await renderLaunchChart()

    await pointer(rowOf(container, 'Video B'), 'pointerover')
    await act(async () => plot.focus())
    const hovered = { marked: ['Video B'], valueText: sliderTextOf(null), day: null }
    expect(shown()).toEqual(hovered)

    await act(async () => plot.blur())
    expect(shown()).toEqual(hovered)
  })

  type LaunchChart = Awaited<ReturnType<typeof renderLaunchChart>>
  test.for([
    ['Escape', ({ press }: LaunchChart) => press('Escape')],
    [
      'the pointer leaving the plot',
      // The browser's own pointerleave, which a browser sends the plot itself.
      ({ plot }: LaunchChart) => pointer(plot, 'pointerleave'),
    ],
  ] as const)('clear a selection the chart made on %s', async ([, end]) => {
    const chart = await renderLaunchChart()
    const { plot, press, shown } = chart

    await act(async () => plot.focus())
    await press('ArrowDown')
    expect(shown()).toEqual({ marked: ['Video A'], valueText: 'Video A', day: 'Day 1' })

    await end(chart)
    expect(shown()).toEqual({ marked: [], valueText: sliderTextOf(null), day: null })
  })

  test("empty the live region when a row hover replaces the chart's key selection", async () => {
    const { container, plot, press } = await renderLaunchChart()
    const liveRegion = () => launchLiveRegion(container)

    await act(async () => plot.focus())
    await press('ArrowDown')
    expect(liveRegion()).toBe('Day 1, Engaged views 10')

    await pointer(rowOf(container, 'Video B'), 'pointerover')
    expect(liveRegion()).toBe('')

    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    expect(liveRegion()).toBe('')

    // A key step from no selection selects line A at day 1 again, and announces it.
    await press('ArrowDown')
    expect(liveRegion()).toBe('Day 1, Engaged views 10')
  })

  const unprocessed = { ...fakeVideo, id: 'video-u', title: 'Video U', engagedViewsByDay: [] }

  /** The color position of the swatch in the list row titled `title`, or null with no swatch. */
  const swatchOf = (container: HTMLElement, title: string) =>
    rowOf(container, title)
      .querySelector('svg.launch-swatch')
      ?.getAttribute('data-launch-position') ?? null

  /**
   * Each launch chart line that takes the accent, as the library draws it: its stroke and whether
   * it draws last, over the others.
   */
  const accentedLines = (container: HTMLElement) => {
    const paths = [...container.querySelectorAll('.launch-chart .ts-chart__line path')]
    return paths
      .filter((path) => path.getAttribute('stroke-width') === '2.5')
      .map((path) => ({ stroke: path.getAttribute('stroke'), last: path === paths.at(-1) }))
  }

  test("accent the line of a hovered row, then of the chart's selection, in the row's swatch colour, heavier and over the others", async () => {
    const { container, plot, press } = await renderLaunchChart()
    const accentOf = (title: string) => [
      { stroke: `var(--launch-line-${swatchOf(container, title)})`, last: true },
    ]

    await pointer(rowOf(container, 'Video B'), 'pointerover')
    expect(accentedLines(container)).toEqual(accentOf('Video B'))

    await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
    expect(accentedLines(container)).toEqual([])

    await act(async () => plot.focus())
    await press('ArrowDown')
    expect(accentedLines(container)).toEqual(accentOf('Video A'))
  })

  test("give each drawn row a swatch in its line's color, and none to a row with no processed day", async () => {
    const api = installFakeApi()
    api.videos = [videoA, unprocessed, videoB]
    const { container } = await render('?window=first28')

    expect(swatchOf(container, 'Video A')).toBe('1')
    expect(swatchOf(container, 'Video U')).toBeNull()
    expect(swatchOf(container, 'Video B')).toBe('2')
  })

  test('with 25 rows and only row 11 processed, draw its one line in color position 1, give its row the only swatch, and show no empty sentence', async () => {
    const api = installFakeApi()
    const titleOf = (index: number) => `Video ${index + 1}`
    api.videos = Array.from({ length: 25 }, (_, index) => ({
      ...fakeVideo,
      id: `video-${index + 1}`,
      title: titleOf(index),
      ...(index === 10 ? { engagedViewsByDay: [12, 30, 8] } : {}),
    }))
    const { container } = await render('?window=first28')

    const lines = [...container.querySelectorAll('.launch-chart .ts-chart__line path')]
    expect(lines.map((path) => path.getAttribute('stroke'))).toEqual(['var(--launch-line-1)'])
    expect(api.videos.map((_, index) => swatchOf(container, titleOf(index)))).toEqual(
      api.videos.map((_, index) => (index === 10 ? '1' : null)),
    )
    expect(container.querySelector('.launch-chart')?.textContent).not.toContain(
      launchChartText.empty,
    )
  })

  const videoC = {
    ...fakeVideo,
    id: 'video-c',
    title: 'Video C',
    engagedViewsByDay: [40],
    partial: { days: 1, of: 7 },
  }

  // happy-dom evaluates no stylesheet, so the selected row's bold is seen here as its class; Nick's
  // browser walk sees the weight, and the card's size at 375 pixels wide.
  test("list every drawn video in the card at the selected day, most first, each with its row's swatch and the selected row bold, while the value text and the live region read the selected video only", async () => {
    const api = installFakeApi()
    api.videos = [videoA, videoB, videoC]
    const { container } = await render('?window=first7')
    const plot = container.querySelector<HTMLElement>('.launch-chart [role="slider"]')
    if (!plot) throw new Error('No launch chart plot')
    const press = async (key: string) => {
      await act(async () => {
        plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
    }
    const cardRows = () =>
      [
        ...container.querySelectorAll(
          '.launch-chart .ts-chart-tooltip:not([hidden]) .chart-hover-card li',
        ),
      ].map((item) => ({
        title: item.querySelector('.launch-card-title')?.textContent,
        value: item.querySelector('.chart-hover-value')?.textContent,
        swatch: item.querySelector('svg.launch-swatch')?.getAttribute('data-launch-position'),
        selected: item.classList.contains('launch-card-row-selected'),
      }))
    const liveRegion = () => launchLiveRegion(container)

    await act(async () => plot.focus())
    await press('ArrowDown')
    await press('ArrowRight')

    expect(launchCardDay(container)).toBe('Day 2')
    expect(cardRows()).toEqual([
      { title: 'Video A', value: '20', swatch: swatchOf(container, 'Video A'), selected: true },
      { title: 'Video B', value: '5', swatch: swatchOf(container, 'Video B'), selected: false },
      {
        title: 'Video C',
        value: 'No data',
        swatch: swatchOf(container, 'Video C'),
        selected: false,
      },
    ])
    expect(cardRows().map(({ swatch }) => swatch)).toEqual(['1', '2', '3'])
    expect(plot.getAttribute('aria-valuetext')).toBe('Video A')
    expect(liveRegion()).toBe('Day 2, Engaged views 20')

    await press('ArrowDown')

    expect(cardRows().map(({ title, selected }) => [title, selected])).toEqual([
      ['Video A', false],
      ['Video B', true],
      ['Video C', false],
    ])
    expect(plot.getAttribute('aria-valuetext')).toBe('Video B')
    expect(liveRegion()).toBe('Day 2, Engaged views 5')
  })

  test.for(['last28', 'lifetime', 'first1'])(
    'give no row a swatch under %s, where no launch chart draws',
    async (window) => {
      const api = installFakeApi()
      api.videos = [videoA, videoB]
      const { container } = await render(`?window=${window}`)

      expect(rowOf(container, 'Video A')).toBeTruthy()
      expect(container.querySelector('.video-list svg.launch-swatch')).toBeNull()
    },
  )
})

describe('the processed note', () => {
  const note = delayNoteOf('2026-10-04')
  /** The notes on the page that say how current the numbers are. */
  const processedNotesOf = (container: HTMLElement) =>
    [...container.querySelectorAll('p.note')].filter(({ textContent }) => textContent === note)

  test.for([
    ['first7', '.launch-chart'],
    ['first1', '.publish-day-top'],
  ] as const)(
    "under %s, sits once under the chart that takes the summary's place, %s, and not in the video list",
    async ([window, chart]) => {
      installFakeApi()
      const { container } = await render(`?window=${window}`)

      const notes = processedNotesOf(container)
      expect(notes).toHaveLength(1)
      expect(notes[0]?.closest(chart)).not.toBeNull()
      expect(notes[0]?.closest('.video-list')).toBeNull()
    },
  )

  test('in a calendar window, sits once with the summary, and not in the video list', async () => {
    installFakeApi()
    const { container } = await render()

    const notes = processedNotesOf(container)
    expect(notes).toHaveLength(1)
    expect(notes[0]?.closest('.video-list')).toBeNull()
    expect(container.querySelector('.launch-chart, .publish-day-top')).toBeNull()
  })
})

describe("the list's revenue, as its answer says it, with the Revenue column on", () => {
  const notesOf = (container: HTMLElement) =>
    [...container.querySelectorAll('p.note')].map(({ textContent }) => textContent)
  const sourcesButtonOf = (container: HTMLElement) =>
    container.querySelector('.revenue-sources-button')
  /** The fake API, for a channel with revenue consent, whose list answers `revenue`. */
  function consentedApi(revenue: VideoListAnswer['revenue']) {
    const api = installFakeApi()
    api.channels = [{ ...fakeChannel, revenueConsentedAt: '2026-10-01T00:00:00.000Z' }]
    api.listRevenue = revenue
    return api
  }
  /** The text of the first row's cell under the Revenue heading. */
  function revenueCellOf(container: HTMLElement): string | null | undefined {
    const headings = [...container.querySelectorAll('thead th')]
    const column = headings.findIndex(({ textContent }) => textContent?.startsWith('Revenue'))
    if (column === -1) throw new Error('No Revenue heading')
    return container.querySelector('tbody tr')?.children[column]?.textContent
  }

  test('for a channel outside the YouTube Partner Program, says so and offers no revenue sources', async () => {
    consentedApi({ refusal: 'not_monetized' })
    const { container } = await render()

    expect(notesOf(container)).toContain(revenueText.notMonetized)
    expect(sourcesButtonOf(container)).toBeNull()
  })

  test('for a channel Google answered no revenue row for, says YouTube reports no revenue and leaves the Revenue cells empty', async () => {
    const api = consentedApi({ currency: 'USD', reported: false })
    api.videos = [{ ...fakeVideo, estimatedRevenue: 0 }]
    const { container } = await render()

    expect(notesOf(container)).toContain(revenueText.noRevenue)
    expect(revenueCellOf(container)).toBe('')
  })

  test("for a channel Google answered revenue for, shows each row's revenue in the list's currency and no revenue note", async () => {
    const api = consentedApi({ currency: 'USD', reported: true })
    api.videos = [{ ...fakeVideo, estimatedRevenue: 12.5 }]
    const { container } = await render()

    expect(revenueCellOf(container)).toBe('$12.50')
    expect(notesOf(container)).not.toContain(revenueText.notMonetized)
    expect(notesOf(container)).not.toContain(revenueText.noRevenue)
    expect(sourcesButtonOf(container)).not.toBeNull()
  })
})

describe('the RPM column of the video list', () => {
  /** The fake API for a channel with revenue consent, its Revenue column off, earning $6. */
  function earningApi() {
    const api = installFakeApi({ revenueColumn: false })
    api.channels = [{ ...fakeChannel, revenueConsentedAt: '2026-10-01T00:00:00.000Z' }]
    api.listRevenue = { currency: 'USD', reported: true }
    api.videos = [{ ...fakeVideo, engagedViews: 1200, estimatedRevenue: 6 }]
    return api
  }
  /** The list's headings, without their sort marks. */
  const headingsOf = (container: HTMLElement) =>
    [...container.querySelectorAll('.video-list thead th')].map(({ textContent }) =>
      (textContent ?? '').replace(/[↑↓]/g, ''),
    )
  /** The text of the first row's cell under the RPM heading. */
  function rpmCellOf(container: HTMLElement): string | null | undefined {
    const column = headingsOf(container).indexOf('RPM')
    if (column === -1) throw new Error('No RPM heading')
    return container.querySelector('.video-list tbody tr')?.children[column]?.textContent
  }
  const lastListSort = (api: FakeApi) =>
    api.requests
      .filter(({ path }) => path.endsWith('/videos'))
      .at(-1)
      ?.query.get('sort')

  test('turning Revenue on shows RPM after it, with each row its RPM, and turning it off hides both', async () => {
    earningApi()
    const { container } = await render()
    expect(headingsOf(container)).not.toContain('RPM')

    await click(switchNamed(container, 'Revenue'))

    const headings = headingsOf(container)
    expect(headings.indexOf('RPM')).toBe(headings.indexOf('Revenue') + 1)
    expect(rpmCellOf(container)).toBe('$5.00')

    await click(switchNamed(container, 'Revenue'))

    expect(headingsOf(container)).not.toContain('Revenue')
    expect(headingsOf(container)).not.toContain('RPM')
  })

  test('the RPM heading sorts the list by RPM, highest first and then lowest first, and says so', async () => {
    const api = earningApi()
    const { container, address } = await render()
    await click(switchNamed(container, 'Revenue'))

    await click(headingNamed(container, 'RPM'))

    expect(address()).toBe('?sort=-rpm')
    expect(lastListSort(api)).toBe('-rpm')
    expect(headingNamed(container, 'RPM').closest('th')?.getAttribute('aria-sort')).toBe(
      'descending',
    )

    await click(headingNamed(container, 'RPM'))

    expect(address()).toBe('?sort=rpm')
    expect(lastListSort(api)).toBe('rpm')
    expect(headingNamed(container, 'RPM').closest('th')?.getAttribute('aria-sort')).toBe(
      'ascending',
    )
  })

  test('turning Revenue off while the list is sorted by RPM sorts it newest first from the first page', async () => {
    const api = earningApi()
    const { container, address } = await render()
    await click(switchNamed(container, 'Revenue'))
    await click(headingNamed(container, 'RPM'))
    expect(address()).toBe('?sort=-rpm')

    await click(switchNamed(container, 'Revenue'))

    expect(address()).toBe('')
    expect(lastListSort(api)).toBe('-publishedAt')
  })
})

describe("where a failed save's notice shows", () => {
  test('on the list, after a failed save made there', async () => {
    await failedOnTheList()

    expect(toastText()).toBe(failedSaveNotice)
  })

  test('on a video, after a failed save made there, which leaves the address without the change', async () => {
    const api = installFakeApi()
    const { container, address } = await render('videos/video-1')

    api.failNext(savePreferences)
    await click(buttonNamed(container, 'Running total'))

    expect(toastText()).toBe(failedSaveNotice)
    expect(address()).toBe('videos/video-1')
    expect(buttonNamed(container, 'Daily').getAttribute('aria-pressed')).toBe('true')
  })

  test('on Settings, after a failed save made there', async () => {
    await failedOnSettings()

    expect(toastText()).toBe(failedSaveNotice)
  })

  test('not over a consent screen, and again once it closes', async () => {
    const { container } = await failedOnSettings()

    await click(buttonNamed(container, 'Connect a channel'))
    expect(toastText()).toBeNull()

    await click(buttonNamed(container, 'Cancel'))
    expect(toastText()).toBe(failedSaveNotice)
  })

  test("in place of a success's toast, which a failure clears", async () => {
    const api = installFakeApi()
    const { container } = await render('settings')
    await choose(container, 'Currency', 'EUR')
    expect(toastText()).toBe(currencySavedNotice)

    api.failNext(savePreferences)
    await choose(container, 'Currency', 'GBP')

    expect(toastText()).toBe(failedSaveNotice)
    expect(toastCount()).toBe(1)

    await click(toastClose())
    expect(toastText()).toBeNull()
  })
})

describe("what clears a failed save's notice", () => {
  test('a route change from the address it shows on, for good, so a return to that address shows none', async () => {
    const { container, address } = await failedOnTheList()

    await click(linkNamed(container, 'A video'))
    expect(toastText()).toBeNull()

    await click(linkNamed(container, 'Back to videos'))
    expect(address()).toBe('')
    expect(toastText()).toBeNull()
  })

  test('its close button', async () => {
    await failedOnTheList()

    await click(toastClose())

    expect(toastText()).toBeNull()
  })

  test('its own wait, after the toast seconds', async () => {
    const api = installFakeApi()
    const { container } = await render()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    api.failNext(savePreferences)
    await click(switchNamed(container, 'Views'))

    await act(async () => vi.advanceTimersByTime(toastSeconds * 1000 - 1))
    expect(toastText()).toBe(failedSaveNotice)
    await act(async () => vi.advanceTimersByTime(1))
    expect(toastText()).toBeNull()
  })

  test('a later save of the change it lost that succeeds, as a retry does', async () => {
    const { container } = await failedOnTheList()

    await click(switchNamed(container, 'Views'))

    expect(toastText()).toBeNull()
  })

  test('"Reset preferences", whose own toast shows', async () => {
    const { container } = await failedOnSettings()

    await click(buttonNamed(container, 'Reset preferences'))

    expect(toastText()).toBe(preferencesResetNotice)
  })
})

describe('the toast', () => {
  /** The toast itself, Base UI's toast root in the notifications landmark. */
  function toastOnView(): HTMLElement {
    const toast = notifications()?.querySelector<HTMLElement>('[role="dialog"]')
    if (!toast) throw new Error('No toast on view')
    return toast
  }

  /** Runs the clock on by `ms`, and lets the renders it starts land. */
  async function wait(ms: number): Promise<void> {
    await act(async () => vi.advanceTimersByTime(ms))
  }

  /** Renders the list with a fake clock, and fails a switch there, which shows the notice. */
  async function failedWithAFakeClock(): Promise<void> {
    const api = installFakeApi()
    const { container } = await render()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    api.failNext(savePreferences)
    await click(switchNamed(container, 'Views'))
    expect(toastText()).toBe(failedSaveNotice)
  }

  test("a success's starts with a check mark a screen reader skips, before its message", async () => {
    installFakeApi()
    const { container } = await render('settings')

    await choose(container, 'Currency', 'EUR')

    const mark = toastOnView().querySelector('svg')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    const status = toastOnView().querySelector('[role="status"]')
    expect(status?.textContent).toBe(currencySavedNotice)
    expect(
      mark && status && mark.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test("a failed save's has no check mark", async () => {
    await failedOnTheList()

    expect(toastOnView().querySelector('[role="status"]')?.previousElementSibling).toBeNull()
    expect(toastOnView().querySelectorAll('svg')).toHaveLength(1)
    expect(toastClose().contains(toastOnView().querySelector('svg'))).toBe(true)
  })

  test('its close button is a button a screen reader reaches, named Close, with no pointer on the toast', async () => {
    await failedOnTheList()

    const close = toastClose()
    expect(close.tagName).toBe('BUTTON')
    expect(close.getAttribute('aria-label')).toBe(toastCloseLabel)
    expect(toastCloseLabel).toBe('Close')
    expect(close.closest('[aria-hidden="true"]')).toBeNull()
  })

  // From and to the body, which React manages no part of: React reads a pointer that comes from one
  // of its own elements by that element's `mouseout`, not by this `mouseover`.
  test('a pointer on it holds its wait, and once the pointer leaves the rest of the wait runs', async () => {
    await failedWithAFakeClock()

    await wait(4_000)
    await act(async () => {
      toastOnView().dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }),
      )
    })
    await wait(60_000)
    expect(toastText()).toBe(failedSaveNotice)

    await act(async () => {
      toastOnView().dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
      )
    })
    await wait(toastSeconds * 1000 - 4_000 - 1)
    expect(toastText()).toBe(failedSaveNotice)
    await wait(1)
    expect(toastText()).toBeNull()
  })

  test('a keyboard focus on its close button holds its wait', async () => {
    await failedWithAFakeClock()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      toastClose().focus()
    })
    await wait(60_000)

    expect(toastText()).toBe(failedSaveNotice)
  })
})

describe('the signed-out screen', () => {
  test('shows no notice of a failed save made before "Sign out"', async () => {
    const { container } = await failedOnSettings()

    await click(buttonNamed(container, 'Sign out'))

    expect(toastText()).toBeNull()
  })

  test('shows no notice of a failed save made before "Delete me"', async () => {
    const { container } = await failedOnSettings()

    await click(buttonNamed(container, 'Delete me'))

    expect(toastText()).toBeNull()
  })

  test('shows no alert of a failed "Sign out" once a second one succeeds', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext('POST /api/auth/sign-out')
    await click(buttonNamed(container, 'Sign out'))
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )

    await click(buttonNamed(container, 'Sign out'))

    expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()
    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test('shows no alert of a failed "Delete me" once a second one succeeds', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext('DELETE /api/me')
    await click(buttonNamed(container, 'Delete me'))
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )

    await click(buttonNamed(container, 'Delete me'))

    expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()
    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test.each([
    ['Reset preferences', 'DELETE /api/me/preferences'],
    ['Disconnect', `POST /api/channels/${fakeChannel.id}/disconnect`],
  ])('shows no alert of a "%s" that fails after "Sign out" succeeds', async (name, route) => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const held = api.hold(route)
    await click(buttonNamed(container, name))
    await click(buttonNamed(container, 'Sign out'))
    expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()

    await act(async () => held.fail())
    await settle()

    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test.each([
    ['Reset preferences', 'DELETE /api/me/preferences'],
    ['Disconnect', `POST /api/channels/${fakeChannel.id}/disconnect`],
  ])('shows no alert of a "%s" that fails after "Delete me" succeeds', async (name, route) => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const held = api.hold(route)
    await click(buttonNamed(container, name))
    await click(buttonNamed(container, 'Delete me'))
    expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()

    await act(async () => held.fail())
    await settle()

    expect(alertOf(container)).toBeNull()
  })

  test.each([['GET /api/me/preferences'], ['GET /api/channels']])(
    'shows no alert of a signed-in read of %s that fails after "Sign out" succeeds',
    async (route) => {
      const api = installFakeApi()
      // StrictMode sends each read twice.
      const reads = [api.hold(route), api.hold(route)]
      const { container } = await render('settings')
      await click(buttonNamed(container, 'Sign out'))
      expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()

      await act(async () => {
        for (const read of reads) read.fail()
      })
      await settle()

      expect(alertOf(container)).toBeNull()
    },
  )
})

describe("an action's alert", () => {
  const disconnectRoute = `POST /api/channels/${fakeChannel.id}/disconnect`

  test.each([
    ['Reset preferences', 'DELETE /api/me/preferences'],
    ['Disconnect', disconnectRoute],
  ])('goes once a second "%s" succeeds', async (name, route) => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext(route)
    await click(buttonNamed(container, name))
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )

    await click(buttonNamed(container, name))

    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test('stays when another action succeeds', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext('DELETE /api/me/preferences')
    await click(buttonNamed(container, 'Reset preferences'))
    await click(buttonNamed(container, 'Disconnect'))

    expect(api.channels).toEqual([])
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )
  })

  test("keeps one channel's failed Disconnect alert when another channel disconnects", async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, { ...fakeChannel, id: 'channel-2', title: 'Second channel' }]
    const { container } = await render('settings')
    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(2)

    api.failNext(`POST /api/channels/${fakeChannel.id}/disconnect`)
    await click(buttonsNamed(container, 'Disconnect')[0] as HTMLButtonElement)
    expect(alertOf(container)).toBe('Error: The API answered 500')

    await click(buttonsNamed(container, 'Disconnect')[1] as HTMLButtonElement)

    expect(api.channels.map(({ id }) => id)).toEqual([fakeChannel.id])
    expect(alertOf(container)).toBe('Error: The API answered 500')
  })

  test('shows none of a first "Disconnect" that fails after a second one of the channel succeeds', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const first = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    const button = buttonNamed(container, 'Disconnect')
    expect(button.disabled).toBe(false)
    await click(button)
    expect(
      api.requests.filter(({ method, path }) => `${method} ${path}` === disconnectRoute),
    ).toHaveLength(2)
    expect(api.channels).toEqual([])
    expect(container.querySelector('p[role="alert"]')).toBeNull()

    await act(async () => first.fail())
    await settle()

    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test('shows none of a first "Disconnect" that fails while a second one of the channel reads the channels', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const first = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    const read = api.hold('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(api.channels).toEqual([])

    await act(async () => first.fail())
    await settle()
    expect(alertOf(container)).toBeNull()

    await act(async () => read.release())
    await settle()

    expect(alertOf(container)).toBeNull()
  })

  test('shows none of a first "Disconnect" that fails after a second one\'s channels read answers, before the list renders', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const first = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    const read = api.hold('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(api.channels).toEqual([])

    await act(async () => {
      read.release()
      first.fail()
    })
    await settle()

    expect(alertOf(container)).toBeNull()
  })

  test('shows none of a first "Disconnect" that fails as a second one of the channel answers', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const first = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    const second = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    expect(alertOf(container)).toBeNull()

    await act(async () => {
      second.release()
      first.fail()
    })
    await settle()

    expect(api.channels).toEqual([])
    expect(alertOf(container)).toBeNull()
  })

  test('of a "Disconnect" whose channels read failed goes, with the channel, on a second press', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(api.channels).toEqual([])
    expect(alertOf(container)).toBe('Error: The API answered 500')

    await click(buttonNamed(container, 'Disconnect'))

    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(0)
    expect(alertOf(container)).toBeNull()
  })

  test('shows the channels read failure of a second press of a disconnected channel', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(alertOf(container)).toBe('Error: The API answered 500')

    api.failNext('GET /api/channels', 'network')
    await click(buttonNamed(container, 'Disconnect'))

    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(1)
    expect(alertOf(container)).toBe('TypeError: Failed to fetch')
  })

  test('of a failed "Disconnect" goes with the success toast of a second one, before the channels are read', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    api.failNext(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    expect(alertOf(container)).toBe('Error: The API answered 500')

    const read = api.hold('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))

    expect(toastText()).toBe('The channel is disconnected. Its data is deleted within 24 hours.')
    expect(alertOf(container)).toBeNull()

    await act(async () => read.release())
    await settle()
  })
})

describe('a failed sign-out', () => {
  /** The header's account menu holds one "Sign out", and Settings another. */
  const signOutIn = {
    'the account menu': async (container: HTMLElement): Promise<HTMLElement | undefined> => {
      await openMenuFrom(container)
      return menuItemNamed('Sign out')
    },
    Settings: async (container: HTMLElement): Promise<HTMLElement | undefined> =>
      [...container.querySelectorAll<HTMLButtonElement>('.signed-in-view button')].find(
        (each) => each.textContent?.trim() === 'Sign out',
      ),
  }

  describe.each([
    ['an HTTP error', 'status', 'Error: The API answered 500'],
    ['a dropped connection', 'network', 'TypeError: Failed to fetch'],
  ] as const)('on %s', (_, how, alert) => {
    test.each(Object.keys(signOutIn) as (keyof typeof signOutIn)[])(
      'from %s keeps the signed-in screen and shows the alert',
      async (place) => {
        const api = installFakeApi()
        const { container } = await render('settings')
        const signOut = await signOutIn[place](container)
        if (!signOut) throw new Error(`No "Sign out" in ${place}`)

        api.failNext('POST /api/auth/sign-out', how)
        await click(signOut)

        expect(container.querySelector('.signed-in-view')).not.toBeNull()
        expect(avatarIn(container)).toBeTruthy()
        expect(() => buttonNamed(container, 'Sign in with Google')).toThrow()
        expect(container.querySelector('p[role="alert"]')?.textContent).toBe(alert)
      },
    )
  })

  test("keeps the session's toasts, as the session stays", async () => {
    const { api, container } = await failedOnSettings()

    api.failNext('POST /api/auth/sign-out')
    await click(buttonNamed(container, 'Sign out'))

    expect(container.querySelector('.signed-in-view')).not.toBeNull()
    expect(toastText()).toBe(failedSaveNotice)
  })
})

describe('a later save after a failed save', () => {
  test('one of other values that succeeds keeps the notice', async () => {
    const { container } = await failedOnTheList()

    await click(switchNamed(container, 'Watch hours'))

    expect(toastText()).toBe(failedSaveNotice)
  })

  test("a second failure starts the toast's wait over", async () => {
    const api = installFakeApi()
    const { container } = await render()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    api.failNext(savePreferences)
    await click(switchNamed(container, 'Views'))
    await act(async () => vi.advanceTimersByTime((toastSeconds * 1000) / 2))

    api.failNext(savePreferences)
    await click(switchNamed(container, 'Watch hours'))
    await act(async () => vi.advanceTimersByTime(toastSeconds * 1000 - 1))

    expect(toastText()).toBe(failedSaveNotice)
  })

  test("a second failure keeps the first one's lost change, so a retry of the second alone leaves the notice", async () => {
    const api = installFakeApi()
    const { container } = await render()

    api.failNext(savePreferences)
    await click(switchNamed(container, 'Views'))
    api.failNext(savePreferences)
    await click(switchNamed(container, 'Watch hours'))
    await click(switchNamed(container, 'Watch hours'))

    expect(toastText()).toBe(failedSaveNotice)

    await click(switchNamed(container, 'Views'))

    expect(toastText()).toBeNull()
  })
})

describe('a failed save of a column switched on', () => {
  test('keeps its notice when the list was sorted by that column meanwhile, and the list sorts newest first', async () => {
    const api = installFakeApi({ watchTimeColumn: false })
    const { container, address } = await render()

    const save = api.hold(savePreferences)
    await click(switchNamed(container, 'Watch hours'))
    await click(headingNamed(container, 'Watch hours'))
    expect(address()).toBe('?sort=-estimatedMinutesWatched')
    await act(async () => save.fail())
    await settle()

    expect(switchNamed(container, 'Watch hours').checked).toBe(false)
    expect(address()).toBe('')
    expect(toastText()).toBe(failedSaveNotice)
  })

  test('of Revenue, on a channel with revenue consent, keeps its notice when the list was sorted by revenue meanwhile, and the list sorts newest first', async () => {
    const api = installFakeApi({ revenueColumn: false })
    api.channels = [{ ...fakeChannel, revenueConsentedAt: '2026-10-01T00:00:00Z' }]
    const { container, address } = await render()

    const save = api.hold(savePreferences)
    await click(switchNamed(container, 'Revenue'))
    await click(headingNamed(container, 'Revenue'))
    expect(address()).toBe('?sort=-estimatedRevenue')
    await act(async () => save.fail())
    await settle()

    expect(switchNamed(container, 'Revenue').checked).toBe(false)
    expect(address()).toBe('')
    expect(toastText()).toBe(failedSaveNotice)
  })
})

describe('a change before the first preferences read lands', () => {
  test('keeps an address sort by a column the saved switches show, and the list reads in that sort', async () => {
    const api = installFakeApi({ watchTimeColumn: true })
    const read = api.hold('GET /api/me/preferences')
    const { container, address } = await render('?sort=-estimatedMinutesWatched')

    await choose(container, 'Videos per page', '25')
    await act(async () => read.release())
    await settle()

    expect(new URLSearchParams(address()).get('pageSize')).toBe('25')
    expect(new URLSearchParams(address()).get('sort')).toBe('-estimatedMinutesWatched')
    const listReads = api.requests.filter(({ path }) => path.endsWith('/videos'))
    expect(listReads.at(-1)?.query.get('sort')).toBe('-estimatedMinutesWatched')
  })

  test('still saves the change', async () => {
    const api = installFakeApi()
    const read = api.hold('GET /api/me/preferences')
    const { container } = await render()

    await choose(container, 'Videos per page', '25')
    await act(async () => read.release())
    await settle()

    const saves = api.requests.filter(({ method, path }) => `${method} ${path}` === savePreferences)
    expect(saves.map(({ body }) => body)).toContainEqual({ pageSize: 25 })
    expect(api.preferences.pageSize).toBe(25)
  })
})

describe('the warning a "Reset preferences" asks first', () => {
  test('names the theme and the RPM switch among what goes back to its default (creator-analytics#456, #691)', async () => {
    const asked: string[] = []
    vi.stubGlobal('confirm', (message: string) => {
      asked.push(message)
      return true
    })
    installFakeApi({ rpmAdsAndPremiumOnly: true })
    const { container } = await render('settings')

    await click(buttonNamed(container, 'Reset preferences'))

    expect(asked).toEqual([
      'Reset your preferences? Page size, columns, charts, currency, the theme, the unlisted switch and the RPM switch go back to their defaults.',
    ])
  })
})

describe('a "Reset preferences" before the first preferences read lands', () => {
  /**
   * Opens Settings with EUR saved, resets while the read is held, then lets the read land with
   * the values the server held when it started. The fake answers a held request from what it holds
   * at release, which the reset has cleared by then, so the test puts EUR back for the answer alone.
   */
  async function resetBeforeTheRead() {
    const api = installFakeApi({ currency: 'EUR' })
    const read = api.hold('GET /api/me/preferences')
    const shown = await render('settings')
    expect(api.requests.filter(({ path }) => path === '/api/me/preferences')).toHaveLength(1)

    await click(buttonNamed(shown.container, 'Reset preferences'))
    expect(api.preferences).toEqual({})
    api.preferences = { currency: 'EUR' }
    await act(async () => read.release())
    await settle()
    api.preferences = {}
    return { api, ...shown }
  }

  test('survives that read, so the defaults stay on screen', async () => {
    const { container } = await resetBeforeTheRead()

    expect(selectNamed(container, 'Currency').value).toBe('USD')
  })

  test('leaves a later failed save to go back to the default, not the value the read held', async () => {
    const { api, container } = await resetBeforeTheRead()

    api.failNext(savePreferences)
    await choose(container, 'Currency', 'JPY')

    expect(selectNamed(container, 'Currency').value).toBe('USD')
  })

  test('that fails leaves the read to show the values the server still holds', async () => {
    const api = installFakeApi({ currency: 'EUR' })
    const read = api.hold('GET /api/me/preferences')
    const { container } = await render('settings')

    api.failNext('DELETE /api/me/preferences')
    await click(buttonNamed(container, 'Reset preferences'))
    await act(async () => read.release())
    await settle()

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )
    expect(selectNamed(container, 'Currency').value).toBe('EUR')
  })
})

describe('a change made while a "Reset preferences" is in flight', () => {
  // The change's save queues behind the reset's DELETE, so it lands after the reset clears the screen.
  test('shows on screen what the server holds once both land', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')

    const reset = api.hold('DELETE /api/me/preferences')
    await click(buttonNamed(container, 'Reset preferences'))
    await choose(container, 'Currency', 'EUR')
    expect(selectNamed(container, 'Currency').value).toBe('EUR')
    await act(async () => reset.release())
    await settle()

    expect(api.preferences).toEqual({ currency: 'EUR' })
    expect(selectNamed(container, 'Currency').value).toBe('EUR')
  })

  test('whose save fails goes back to the default the reset left on the server', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')
    // A value saved before the reset, so a revert to it instead of the default would show.
    await choose(container, 'Currency', 'GBP')
    await settle()

    const reset = api.hold('DELETE /api/me/preferences')
    await click(buttonNamed(container, 'Reset preferences'))
    api.failNext(savePreferences)
    await choose(container, 'Currency', 'EUR')
    await act(async () => reset.release())
    await settle()

    expect(api.preferences).toEqual({})
    expect(selectNamed(container, 'Currency').value).toBe('USD')
  })
})

describe("a failed save's revert", () => {
  test('shows the value the server holds again on the control', async () => {
    const api = installFakeApi({ viewsColumn: true })
    const { container } = await render()

    api.failNext(savePreferences)
    await click(switchNamed(container, 'Views'))

    expect(switchNamed(container, 'Views').checked).toBe(true)
  })

  test('takes a lost value out of the address', async () => {
    const api = installFakeApi()
    const { container, address } = await render()

    api.failNext(savePreferences, 'network')
    await click(switchNamed(container, 'Show unlisted and private'))

    expect(switchNamed(container, 'Show unlisted and private').checked).toBe(false)
    expect(address()).toBe('')
  })
})

describe('a video opened from the publish day top while its detail is on its way', () => {
  test("holds only its finished stages' since publish rows, though the list's page does not carry it", async () => {
    const api = installFakeApi()
    // Published on 2 October, and the fake's last processed day is 4 October: the publish day is
    // the only finished stage, so the heading row, the publish day and lifetime.
    api.publishDayTop = [
      {
        id: 'young-video',
        title: 'A young video',
        publishedAt: '2026-10-02T16:00:00.000Z',
        engagedViews: 40,
      },
    ]
    const { container } = await render('?window=first1')
    // StrictMode reads the detail twice, so both reads are held.
    const detailRoute = `GET /api/channels/${fakeChannel.id}/videos/young-video`
    const detailReads = [api.hold(detailRoute), api.hold(detailRoute)]

    await click(linkNamed(container, 'A young video'))

    const placeholder = container.querySelector<HTMLElement>('.placeholder-since-publish-table')
    expect(placeholder?.style.getPropertyValue('--rows').trim()).toBe('3')
    for (const read of detailReads) read.release()
    await settle()
  })
})

describe("a video's detail screen", () => {
  test('counts an arrival by Back or Forward after a step as an open, and the step alone as a step', async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    const { container, address } = await render('videos/video-1')

    await click(linkLabelled(container, 'Older video: Another video'))
    expect(address()).toBe('videos/video-2')
    await act(async () => window.history.back())
    await settle()
    expect(address()).toBe('videos/video-1')
    await act(async () => window.history.forward())
    await settle()
    expect(address()).toBe('videos/video-2')

    expect(vi.mocked(track).mock.calls.map(([{ name }]) => name)).toEqual([
      'video_detail_opened',
      'video_stepped',
      'video_detail_opened',
      'video_detail_opened',
    ])
  })

  test("writes each chart's zero in the browser language's digits, as its top", async () => {
    defaultNumbersTo('ar-EG')
    installFakeApi()
    const { container } = await render('videos/video-1')

    const labels = chartLabels(container, '.metric-chart')
    expect(labels.length).toBeGreaterThan(0)
    const tops = labels.filter((_, index) => index % 2 === 0)
    const bottoms = labels.filter((_, index) => index % 2 === 1)
    for (const top of tops) expect(top).not.toMatch(/[0-9]/)
    expect(bottoms).toEqual(bottoms.map(() => '٠'))
  })

  test("writes the retention chart's 100% and 50% in the browser language's digits", async () => {
    defaultNumbersTo('ar-EG')
    const api = installFakeApi()
    api.retention = [
      { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
      { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
    ]
    const { container } = await render('videos/video-1')

    const retention = [...container.querySelectorAll('section.video-detail-section')].find(
      (section) => section.querySelector('h2')?.textContent === 'Audience retention',
    )
    if (!retention) throw new Error('No audience retention section')
    const labels = [...retention.querySelectorAll('.chart > .chart-label')].map(
      (each) => each.textContent,
    )
    // ١٠٠٪ and ٥٠٪, each followed by the Arabic letter mark ar-EG writes after its percent sign.
    expect(labels).toEqual(['\u0661\u0660\u0660\u066a\u061c', '\u0665\u0660\u066a\u061c'])
  })

  test("gives keyboard focus to the next video's title after a step", async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    const { container } = await render('videos/video-1')
    const step = linkLabelled(container, 'Older video: Another video')

    // happy-dom moves no focus on a click, so focus goes on the link first, as a keyboard user's
    // Enter has it there; without the move to the title, focus would stay on the link.
    await act(async () => step.focus())
    await click(step)

    const focused = document.activeElement
    expect(focused?.tagName).toBe('H1')
    expect(focused?.textContent).toBe('Another video')
  })

  // happy-dom moves no focus with a relatedTarget, so these tests dispatch the focusout a browser
  // would, with its relatedTarget set; React's onBlur listens for focusout.
  async function stackedPlots() {
    installFakeApi()
    const { container } = await render('videos/video-1')
    const [first, second] = container.querySelectorAll<HTMLElement>('.metric-chart')
    const firstPlot = first?.querySelector<HTMLElement>('.chart-plot')
    const secondPlot = second?.querySelector<HTMLElement>('.chart-plot')
    if (!first || !firstPlot || !secondPlot) throw new Error('No two metric chart plots')
    const press = async (key: string) => {
      await act(async () => {
        firstPlot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
    }
    const leaveFor = async (relatedTarget: Element) => {
      await act(async () => {
        firstPlot.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }))
      })
    }
    const shown = () =>
      [firstPlot, secondPlot].map((plot) => [
        plot.getAttribute('aria-valuenow'),
        plot.getAttribute('aria-valuetext'),
      ])
    // The app's own live region: the library's tooltip carries one too, off the accessibility tree.
    const liveRegion = () => first.querySelector('p.visually-hidden[aria-live="polite"] > span')
    await act(async () => firstPlot.focus())
    return { firstPlot, secondPlot, press, leaveFor, shown, liveRegion }
  }

  test('keeps the card on every stacked chart when focus moves from one stacked plot to another', async () => {
    const { secondPlot, press, leaveFor, shown } = await stackedPlots()
    await press('ArrowRight')
    const before = shown()
    expect(before[0]?.[1]).not.toBe(sliderTextOf(null))

    await leaveFor(secondPlot)
    expect(shown()).toEqual(before)
  })

  test('keeps the card when focus moves inside a stacked plot, as a click on its chart moves it', async () => {
    const { firstPlot, press, leaveFor, shown } = await stackedPlots()
    await press('ArrowRight')
    const before = shown()
    // The svg the library draws, which a click focuses: an svg element, not an HTML one.
    const inside = firstPlot.querySelector('svg')
    if (!inside) throw new Error('No chart svg inside the stacked plot')

    await leaveFor(inside)
    expect(shown()).toEqual(before)
  })

  test('hides the card on every stacked chart when focus leaves the stack', async () => {
    const { press, leaveFor, shown } = await stackedPlots()
    await press('ArrowRight')

    await leaveFor(document.body)
    expect(shown().map(([, valueText]) => valueText)).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
  })

  test('on a stacked plot, Home on the first point announces nothing new, End reads the last point, and Escape hides the card and empties the live region', async () => {
    const { press, shown, liveRegion } = await stackedPlots()
    await press('ArrowRight')
    const announced = liveRegion()
    expect(announced?.textContent).toBe('Engaged views 600, Views 700')

    await press('Home')
    expect(shown()[0]?.[0]).toBe('1')
    // A new announcement is a new node; Home on the first point keeps the one there.
    expect(liveRegion()).toBe(announced)
    expect(liveRegion()?.textContent).toBe('Engaged views 600, Views 700')

    await press('End')
    expect(shown()[0]?.[0]).toBe('2')
    expect(liveRegion()?.textContent).toBe('Engaged views 600, Views 800')

    await press('Escape')
    expect(shown()[0]?.[1]).toBe(sliderTextOf(null))
    expect(liveRegion()?.textContent).toBe('')
  })

  // creator-analytics#374: a pointer empties the live region, so a key step onto the point it
  // holds reads that point, rather than nothing again. The move goes to the library's svg in its
  // own coordinates (viewBox 0 0 640 320), which happy-dom's identity `getScreenCTM` resolves.
  test.for([
    ['Home', 0, '1', 'Engaged views 600, Views 700'],
    ['End', 640, '2', 'Engaged views 600, Views 800'],
  ] as const)(
    'announces the values when %s lands on the day the pointer already holds',
    async ([key, clientX, day, values]) => {
      const { firstPlot, press, liveRegion } = await stackedPlots()
      const svg = firstPlot.querySelector('.cursor-plot-chart svg')
      if (!svg) throw new Error('No library svg in the plot')
      await act(async () => {
        svg.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            pointerType: 'mouse',
            clientX,
            clientY: 0,
          }),
        )
      })
      expect(firstPlot.getAttribute('aria-valuenow')).toBe(day)
      expect(liveRegion()?.textContent).toBe('')

      await press(key)
      expect(firstPlot.getAttribute('aria-valuenow')).toBe(day)
      expect(liveRegion()?.textContent).toBe(values)
    },
  )

  // A new window's read clears the screen behind its placeholder, so the charts mount again on the
  // new days: this pins what a creator sees, the card gone, whichever rule hides it.
  test('hides the card on every stacked chart and empties the live region when a date range brings another day count', async () => {
    const api = installFakeApi()
    const { container } = await render('videos/video-1')
    const plots = () => [...container.querySelectorAll<HTMLElement>('.metric-chart .chart-plot')]
    const [firstPlot] = plots()
    if (!firstPlot) throw new Error('No metric chart plot')
    await act(async () => firstPlot.focus())
    await act(async () => {
      firstPlot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(plots().map((plot) => plot.getAttribute('aria-valuetext'))).toEqual([
      'Oct 3, 2026',
      'Oct 3, 2026',
    ])
    const liveRegion = () =>
      container.querySelector('.metric-chart p.visually-hidden[aria-live="polite"] > span')
    expect(liveRegion()?.textContent).toBe('Engaged views 600, Views 700')

    api.days = [
      { day: '2026-10-02', engagedViews: 100, views: 200, estimatedMinutesWatched: 60 },
      ...api.days,
    ]
    await choose(container, 'Date range', 'last90')

    expect(plots().map((plot) => plot.getAttribute('aria-valuetext'))).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
    expect(liveRegion()?.textContent ?? '').toBe('')
  })

  // The retention section has no class of its own, so each of its two plots is found by its slider
  // role and its approved accessible name, with the app's own live region beside it. fakeVideo has
  // a duration, so its screen holds the video player and the name ends with the sentence on it.
  async function retentionPlots() {
    const api = installFakeApi()
    api.retention = [
      { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.3 },
      { elapsedVideoTimeRatio: 0.02, audienceWatchRatio: 0.9, relativeRetentionPerformance: 0.5 },
      { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.6, relativeRetentionPerformance: 0.7 },
      { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.6 },
    ]
    const { container } = await render('videos/video-1')
    const plotNamed = (heading: string) => {
      const plot = container.querySelector<HTMLElement>(
        `[role="slider"][aria-label="${chartLabelOf(heading, playerMoveText.moveSentence)}"]`,
      )
      if (!plot) throw new Error(`No plot named for ${heading}`)
      return plot
    }
    const watching = plotNamed('Audience retention')
    const relative = plotNamed(relativeName)
    const press = async (plot: HTMLElement, key: string) => {
      await act(async () => {
        plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
    }
    const leaveFor = async (plot: HTMLElement, relatedTarget: Element) => {
      await act(async () => {
        plot.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }))
      })
    }
    const shown = () =>
      [watching, relative].map((plot) => [
        plot.getAttribute('aria-valuenow'),
        plot.getAttribute('aria-valuetext'),
      ])
    // The app's own live region beside each plot: the library's tooltip carries one too, off the
    // accessibility tree.
    const spoken = () =>
      [watching, relative].map(
        (plot) =>
          plot.parentElement?.querySelector('p.visually-hidden[aria-live="polite"] > span')
            ?.textContent,
      )
    return { watching, relative, press, leaveFor, shown, spoken }
  }

  test('an arrow key on either retention plot moves both to the same point, and only that plot reads it', async () => {
    const { watching, relative, press, shown, spoken } = await retentionPlots()

    await act(async () => watching.focus())
    await press(watching, 'ArrowRight')
    await press(watching, 'ArrowRight')
    expect(shown().map(([valueNow]) => valueNow)).toEqual(['2', '2'])
    expect(shown().every(([, valueText]) => valueText !== sliderTextOf(null))).toBe(true)
    const [watchingSpoke, relativeSpoke] = spoken()
    expect(watchingSpoke).not.toBe('')
    expect(relativeSpoke).toBe('')

    await act(async () => relative.focus())
    await press(relative, 'ArrowRight')
    expect(shown().map(([valueNow]) => valueNow)).toEqual(['3', '3'])
    expect(spoken()[0]).toBe('')
    expect(spoken()[1]).not.toBe('')
    expect(spoken()[1]).not.toBe(watchingSpoke)
  })

  test('keeps the card on both retention charts when focus moves from one retention plot to the other', async () => {
    const { watching, relative, press, leaveFor, shown } = await retentionPlots()
    await act(async () => watching.focus())
    await press(watching, 'ArrowRight')
    const before = shown()
    expect(before[0]?.[1]).not.toBe(sliderTextOf(null))

    await leaveFor(watching, relative)
    expect(shown()).toEqual(before)
  })

  test('hides the card on both retention charts when focus leaves the pair', async () => {
    const { watching, press, leaveFor, shown } = await retentionPlots()
    await act(async () => watching.focus())
    await press(watching, 'ArrowRight')

    await leaveFor(watching, document.body)
    expect(shown().map(([, valueText]) => valueText)).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
  })

  test('on a retention plot, Escape hides the card on both and empties the live region', async () => {
    const { relative, press, shown, spoken } = await retentionPlots()
    await act(async () => relative.focus())
    await press(relative, 'End')
    expect(shown().map(([valueNow]) => valueNow)).toEqual(['4', '4'])
    expect(spoken()[1]).not.toBe('')

    await press(relative, 'Escape')
    expect(shown().map(([, valueText]) => valueText)).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
    expect(spoken()).toEqual(['', ''])
  })
})

/** happy-dom's own window API, which sets the viewport its media queries read. */
function setViewport(viewport: { width: number; height: number }): void {
  ;(
    window as unknown as { happyDOM: { setViewport(size: typeof viewport): void } }
  ).happyDOM.setViewport(viewport)
}

/**
 * The fake API for a video that earned $5.48 over its 1,200 engaged views, an RPM of $4.57, on a
 * channel with revenue consent, with the revenue on both days, half of it from ads, and the
 * preferences `saved`.
 */
function earningDetailApi(saved: Preferences = {}) {
  const api = installFakeApi(saved)
  api.channels = [{ ...fakeChannel, revenueConsentedAt: '2026-10-01T00:00:00.000Z' }]
  const amounts = (estimatedRevenue: number) => ({
    estimatedRevenue,
    estimatedAdRevenue: estimatedRevenue / 2,
    estimatedRedPartnerRevenue: 0,
  })
  api.days = [
    {
      day: '2026-10-03',
      engagedViews: 600,
      views: 700,
      estimatedMinutesWatched: 300,
      ...amounts(3),
    },
    {
      day: '2026-10-04',
      engagedViews: 600,
      views: 800,
      estimatedMinutesWatched: 438,
      ...amounts(2.48),
    },
  ]
  api.detailRevenue = { ...amounts(5.48), currency: 'USD' }
  return api
}

describe('the RPM chart and its chooser (creator-analytics#356)', () => {
  const headingsIn = (container: HTMLElement) =>
    [...container.querySelectorAll('.metric-chart h2')].map(({ textContent }) => textContent)
  function rpmLineIn(container: HTMLElement): HTMLButtonElement {
    const line = container.querySelector<HTMLButtonElement>('button.card-choose-detail')
    if (!line) throw new Error('No RPM line button')
    return line
  }

  test('where the charts stack, the RPM chart is the fourth, after the revenue chart', async () => {
    earningDetailApi()
    const { container } = await render('videos/video-1')

    expect(headingsIn(container)).toEqual([
      'Engaged views and views',
      'Watch hours',
      'Estimated revenue',
      'RPM',
    ])
    // Stacked, no card chooses, so the RPM line is plain text.
    expect(container.querySelector('button.card-choose-detail')).toBeNull()
  })

  describe('on a screen too small to stack the charts', () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    test("the revenue card's RPM line is a button that offers the RPM chart", async () => {
      earningDetailApi()
      const { container } = await render('videos/video-1')

      const line = rpmLineIn(container)
      expect(line.textContent).toBe('RPM: $4.57')
      expect(line.getAttribute('aria-pressed')).toBe('false')
      expect(headingsIn(container)).toEqual(['Engaged views and views'])
    })

    test('a press on the RPM line shows the RPM chart alone, pressed, and saves, writes and sends the choice', async () => {
      const api = earningDetailApi()
      const { container, address } = await render('videos/video-1')

      await click(rpmLineIn(container))

      expect(headingsIn(container)).toEqual(['RPM'])
      expect(container.querySelectorAll('.metric-chart')).toHaveLength(1)
      expect(rpmLineIn(container).getAttribute('aria-pressed')).toBe('true')
      expect(rpmLineIn(container).closest('.card')?.classList.contains('card-chosen')).toBe(true)
      // The label's button chooses revenue, which is not the chart on view.
      expect(
        rpmLineIn(container)
          .closest('.card')
          ?.querySelector('.card-choose')
          ?.getAttribute('aria-pressed'),
      ).toBe('false')
      expect(
        api.requests.filter(({ method, path }) => `${method} ${path}` === savePreferences).at(-1)
          ?.body,
      ).toEqual({ chartCard: 'rpm' })
      expect(address()).toBe('videos/video-1?card=rpm')
      expect(vi.mocked(track)).toHaveBeenCalledWith({ name: 'chart_metric_changed', metric: 'rpm' })
    })

    test('?card=rpm shows the RPM chart alone', async () => {
      earningDetailApi()
      const { container } = await render('videos/video-1?card=rpm')

      expect(headingsIn(container)).toEqual(['RPM'])
      expect(rpmLineIn(container).getAttribute('aria-pressed')).toBe('true')
    })

    test('?card=rpm on a page without revenue shows engaged views alone', async () => {
      installFakeApi()
      const { container } = await render('videos/video-1?card=rpm')

      expect(headingsIn(container)).toEqual(['Engaged views and views'])
      expect(container.querySelector('button.card-choose-detail')).toBeNull()
    })
  })
})

// The theme (creator-analytics#691). happy-dom runs no head script and evaluates no stylesheet, so
// these tests read the root's `data-theme` and the browser's copy, not the tokens drawn; the browser
// walk checks the first frame and the tokens in Chrome. The copy stands in for the one the head
// script read at load.
/** The theme on the page: the root's attribute and the browser's copy. */
function pageTheme() {
  return {
    attribute: document.documentElement.getAttribute('data-theme'),
    copy: localStorage.getItem(themeCopyKey),
  }
}

/** The bodies of the preference saves the app sent, in order. */
function savesOf(api: FakeApi) {
  return api.requests
    .filter(({ method, path }) => `${method} ${path}` === savePreferences)
    .map(({ body }) => body)
}

/** Settings' Theme radio group, found by its role and name. */
function settingsThemeGroup(container: HTMLElement): HTMLElement {
  return groupNamed(container, 'radiogroup', themeLabel)
}

/** The names of the checked radios in Settings' Theme group. */
function checkedTheme(container: HTMLElement): string[] {
  return radiosIn(settingsThemeGroup(container))
    .filter((radio) => radio.getAttribute('aria-checked') === 'true')
    .map((radio) => accessibleNameOf(radio, true))
}

describe('the Theme control on Settings (creator-analytics#691)', () => {
  const themeGroup = settingsThemeGroup

  test('is a radio group named Theme, with Light, Dark and System, System checked with nothing saved', async () => {
    installFakeApi()
    const { container } = await render('settings')

    expect(radiosIn(themeGroup(container)).map((radio) => accessibleNameOf(radio, true))).toEqual([
      'Light',
      'Dark',
      'System',
    ])
    expect(checkedTheme(container)).toEqual(['System'])
    expect(pageTheme()).toEqual({ attribute: null, copy: null })
  })

  test('checks the saved theme, and the page draws it', async () => {
    installFakeApi({ theme: 'light' })
    const { container } = await render('settings')

    expect(checkedTheme(container)).toEqual(['Light'])
    expect(pageTheme()).toEqual({ attribute: 'light', copy: 'light' })
  })

  test('a press applies the theme at once, before its save lands, then saves it, with no toast and no event', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')
    vi.mocked(track).mockClear()

    const save = api.hold(savePreferences)
    await click(radioNamed(themeGroup(container), 'Dark'))

    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
    expect(checkedTheme(container)).toEqual(['Dark'])

    await act(async () => save.release())
    await settle()

    expect(savesOf(api)).toEqual([{ theme: 'dark' }])
    expect(api.preferences).toEqual({ theme: 'dark' })
    expect(toastText()).toBeNull()
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test('System removes the attribute and the copy', async () => {
    const api = installFakeApi({ theme: 'dark' })
    const { container } = await render('settings')
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })

    await click(radioNamed(themeGroup(container), 'System'))

    expect(pageTheme()).toEqual({ attribute: null, copy: null })
    expect(api.preferences).toEqual({ theme: 'system' })
  })

  test('a failed save puts the attribute, the copy and the checked theme back, and says so', async () => {
    const api = installFakeApi({ theme: 'light' })
    const { container } = await render('settings')

    api.failNext(savePreferences)
    await click(radioNamed(themeGroup(container), 'Dark'))

    expect(pageTheme()).toEqual({ attribute: 'light', copy: 'light' })
    expect(checkedTheme(container)).toEqual(['Light'])
    expect(toastText()).toBe(failedSaveNotice)
  })

  test('a failed save of another preference leaves the theme as it is', async () => {
    const api = installFakeApi({ theme: 'dark' })
    const { container } = await render('settings')

    api.failNext(savePreferences)
    await choose(container, 'Currency', 'EUR')

    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
    expect(checkedTheme(container)).toEqual(['Dark'])
  })

  test("the read landing sets the server's theme over the copy, and rewrites the copy", async () => {
    localStorage.setItem(themeCopyKey, 'dark')
    const api = installFakeApi({ theme: 'light' })
    const read = api.hold('GET /api/me/preferences')
    const { container } = await render('settings')
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })

    await act(async () => read.release())
    await settle()

    expect(pageTheme()).toEqual({ attribute: 'light', copy: 'light' })
    expect(checkedTheme(container)).toEqual(['Light'])
  })

  test('the read landing with no theme saved removes the attribute and the copy', async () => {
    localStorage.setItem(themeCopyKey, 'dark')
    const api = installFakeApi()
    const read = api.hold('GET /api/me/preferences')
    const { container } = await render('settings')

    await act(async () => read.release())
    await settle()

    expect(pageTheme()).toEqual({ attribute: null, copy: null })
    expect(checkedTheme(container)).toEqual(['System'])
  })

  test('a change before the read lands wins over the read', async () => {
    localStorage.setItem(themeCopyKey, 'light')
    const api = installFakeApi({ theme: 'light' })
    const read = api.hold('GET /api/me/preferences')
    const { container } = await render('settings')

    await click(radioNamed(themeGroup(container), 'Dark'))
    await act(async () => read.release())
    await settle()

    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
    expect(api.preferences).toEqual({ theme: 'dark' })
  })

  test('a failed read leaves the theme the copy gave, and the control shows it', async () => {
    localStorage.setItem(themeCopyKey, 'dark')
    const api = installFakeApi({ theme: 'light' })
    api.failNext('GET /api/me/preferences')
    const { container } = await render('settings')

    expect(alertOf(container)).toBe('Error: The API answered 500')
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
    expect(checkedTheme(container)).toEqual(['Dark'])
  })

  test('"Reset preferences" removes the attribute and the copy, and checks System', async () => {
    const api = installFakeApi({ theme: 'dark' })
    const { container } = await render('settings')
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })

    await click(buttonNamed(container, 'Reset preferences'))

    expect(api.preferences).toEqual({})
    expect(pageTheme()).toEqual({ attribute: null, copy: null })
    expect(checkedTheme(container)).toEqual(['System'])
  })

  test('"Reset preferences" after a failed read removes the attribute and the copy', async () => {
    localStorage.setItem(themeCopyKey, 'dark')
    const api = installFakeApi({ theme: 'dark' })
    api.failNext('GET /api/me/preferences')
    const { container } = await render('settings')
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })

    await click(buttonNamed(container, 'Reset preferences'))

    expect(api.preferences).toEqual({})
    expect(pageTheme()).toEqual({ attribute: null, copy: null })
    expect(checkedTheme(container)).toEqual(['System'])
  })
})

describe('the RPM switch on Settings (creator-analytics#357)', () => {
  const label = 'Count only ads and YouTube Premium in RPM'
  const hint = 'RPM then leaves out memberships and Supers.'
  const savesOf = (api: FakeApi) =>
    api.requests
      .filter(({ method, path }) => `${method} ${path}` === savePreferences)
      .map(({ body }) => body)
  /** The revenue card's RPM line. */
  const rpmLineOf = (container: HTMLElement) =>
    [...container.querySelectorAll('.card')]
      .map(({ textContent }) => textContent ?? '')
      .find((text) => text.startsWith('Estimated revenue'))
      ?.match(/RPM: \$[\d.,]+/)?.[0]
  /** The text of the element that describes the input, through its `aria-describedby`. */
  const descriptionOf = (input: HTMLElement) =>
    (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')

  test('is a switch named by its approved label, described by its approved hint, off by default', async () => {
    installFakeApi()
    const { container } = await render('settings')

    const input = switchNamed(container, label)
    expect(input.getAttribute('role')).toBe('switch')
    expect(input.checked).toBe(false)
    expect(descriptionOf(input)).toBe(hint)
  })

  test('a change saves the preference and sends rpm_sources_toggled with the new state, on and then off', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')
    vi.mocked(track).mockClear()

    await click(switchNamed(container, label))

    expect(switchNamed(container, label).checked).toBe(true)
    expect(savesOf(api).at(-1)).toEqual({ rpmAdsAndPremiumOnly: true })
    expect(api.preferences.rpmAdsAndPremiumOnly).toBe(true)

    await click(switchNamed(container, label))

    expect(switchNamed(container, label).checked).toBe(false)
    expect(savesOf(api).at(-1)).toEqual({ rpmAdsAndPremiumOnly: false })
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'rpm_sources_toggled', state: 'on' }],
      [{ name: 'rpm_sources_toggled', state: 'off' }],
    ])
  })

  test('"Reset preferences" turns a saved switch off', async () => {
    const api = installFakeApi({ rpmAdsAndPremiumOnly: true })
    const { container } = await render('settings')
    expect(switchNamed(container, label).checked).toBe(true)

    await click(buttonNamed(container, 'Reset preferences'))

    expect(switchNamed(container, label).checked).toBe(false)
    expect(api.preferences).toEqual({})
  })

  describe("on a video's page, ads are half the revenue", () => {
    /** The numbers table's RPM cells, by row, then its total row's. */
    function numbersTableRpmOf(container: HTMLElement) {
      const table = container.querySelector('.numbers-table table')
      if (!table) throw new Error('No numbers table')
      const headings = [...table.querySelectorAll('thead tr:first-child th')].map(
        ({ textContent }) => (textContent ?? '').replace(/[↑↓]/g, ''),
      )
      const column = headings.indexOf('RPM')
      if (column === -1) throw new Error('No RPM heading in the numbers table')
      const cellsAt = (rows: Iterable<Element>) =>
        [...rows].map((row) => row.children[column]?.textContent)
      return {
        rows: cellsAt(table.querySelectorAll('tbody tr')),
        total: cellsAt(table.querySelectorAll('tfoot tr')),
      }
    }
    const rpmChartIn = (container: HTMLElement) =>
      [...container.querySelectorAll('.metric-chart')].find(
        (each) => each.querySelector('h2')?.textContent === 'RPM',
      )
    /** The RPM chart's card at its last day, as the chart's live region reads it out. */
    async function rpmChartCardOf(container: HTMLElement) {
      const chart = rpmChartIn(container)
      const plot = chart?.querySelector<HTMLElement>('.chart-plot')
      if (!plot) throw new Error('No RPM chart plot')
      await act(async () => plot.focus())
      await act(async () => {
        plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      })
      // The app's own live region: the library's tooltip carries one too, off the accessibility tree.
      return chart?.querySelector('p.visually-hidden[aria-live="polite"] > span')?.textContent
    }
    /**
     * The RPM chart's scale labels, its top then its bottom, and the height its line draws each day
     * at, as a share of the plot from its bottom, to two places.
     */
    function rpmScaleAndLineOf(container: HTMLElement) {
      const chart = rpmChartIn(container)
      const plotHeight = Number(chart?.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[3])
      const path = chart?.querySelector('.ts-chart__line path')?.getAttribute('d') ?? ''
      return {
        labels: [...(chart?.querySelectorAll('.chart > .chart-label') ?? [])].map(
          ({ textContent }) => textContent,
        ),
        heights: [...path.matchAll(/[ML][\d.-]+,([\d.-]+)/g)].map(
          ([, y]) => Math.round((1 - Number(y) / plotHeight) * 100) / 100,
        ),
      }
    }

    // $2.74 of ads over 1,200 engaged views, against $5.48 in all. By day, $1.50 and $1.24 of ads
    // over 600 each, against $3.00 and $2.48.
    test('with the switch on, the revenue card, the numbers table and the RPM chart count only ads and YouTube Premium', async () => {
      earningDetailApi({ rpmAdsAndPremiumOnly: true })
      const { container } = await render('videos/video-1')

      expect(rpmLineOf(container)).toBe('RPM: $2.28')
      expect(numbersTableRpmOf(container)).toEqual({ rows: ['$2.07', '$2.50'], total: ['$2.28'] })
      expect(await rpmChartCardOf(container)).toBe('RPM $2.07')
    })

    test('with the switch off, each RPM counts the whole revenue, as before', async () => {
      earningDetailApi({ rpmAdsAndPremiumOnly: false })
      const { container } = await render('videos/video-1')

      expect(rpmLineOf(container)).toBe('RPM: $4.57')
      expect(numbersTableRpmOf(container)).toEqual({ rows: ['$4.13', '$5.00'], total: ['$4.57'] })
      expect(await rpmChartCardOf(container)).toBe('RPM $4.13')
    })

    // With the switch on, $1.50 and $1.24 of ads over 600 engaged views each: an RPM of $2.50, the
    // scale's top, then $2.07, 0.83 of it. With it off, $5.00 and $4.13 against a top of $5.
    test.each([
      [true, '$2.5'],
      [false, '$5'],
    ])(
      "with the switch saved %s, the RPM chart's scale tops at %s and its line draws each day's RPM against it",
      async (on, top) => {
        earningDetailApi({ rpmAdsAndPremiumOnly: on })
        const { container } = await render('videos/video-1')

        expect(rpmScaleAndLineOf(container)).toEqual({ labels: [top, '0'], heights: [1, 0.83] })
      },
    )

    test('every RPM label stays RPM with the switch on', async () => {
      earningDetailApi({ rpmAdsAndPremiumOnly: true })
      const { container } = await render('videos/video-1')

      expect(rpmLineOf(container)?.startsWith('RPM: ')).toBe(true)
      expect(
        [...container.querySelectorAll('.metric-chart h2')].map(({ textContent }) => textContent),
      ).toContain('RPM')
      expect(
        [...container.querySelectorAll('.numbers-table thead th')].some(
          ({ textContent }) => (textContent ?? '').replace(/[↑↓]/g, '') === 'RPM',
        ),
      ).toBe(true)
    })
  })

  // The channel earned $5.48 over its 1,200 engaged views, $2.74 of it from ads, on both days.
  test.each([
    [true, 'RPM: $2.28'],
    [false, 'RPM: $4.57'],
  ])("with the switch saved %s, the channel summary's revenue card reads %s", async (on, line) => {
    const api = earningDetailApi({ rpmAdsAndPremiumOnly: on })
    api.summaryRevenue = {
      estimatedRevenue: 5.48,
      estimatedAdRevenue: 2.74,
      estimatedRedPartnerRevenue: 0,
      currency: 'USD',
      noFormatRevenue: 0,
      everyFormatRevenue: 5.48,
    }
    api.summaryDays = api.days
    const { container } = await render()

    expect(rpmLineOf(container)).toBe(line)
  })

  describe('in the video list', () => {
    /** A channel with revenue consent whose one video earned $6, $3 of it from ads and Premium. */
    function earningListApi(saved: Preferences) {
      const api = installFakeApi(saved)
      api.channels = [{ ...fakeChannel, revenueConsentedAt: '2026-10-01T00:00:00.000Z' }]
      api.listRevenue = { currency: 'USD', reported: true }
      api.videos = [
        {
          ...fakeVideo,
          engagedViews: 1200,
          estimatedRevenue: 6,
          estimatedAdRevenue: 2.4,
          estimatedRedPartnerRevenue: 0.6,
        },
      ]
      return api
    }
    function rpmCellOf(container: HTMLElement): string | null | undefined {
      const headings = [...container.querySelectorAll('.video-list thead th')].map(
        ({ textContent }) => (textContent ?? '').replace(/[↑↓]/g, ''),
      )
      const column = headings.indexOf('RPM')
      if (column === -1) throw new Error('No RPM heading')
      return container.querySelector('.video-list tbody tr')?.children[column]?.textContent
    }

    test.each([
      [true, '$2.50'],
      [false, '$5.00'],
    ])('with the switch saved %s, the RPM column reads %s', async (on, text) => {
      earningListApi({ rpmAdsAndPremiumOnly: on })
      const { container } = await render()

      expect(rpmCellOf(container)).toBe(text)
    })
  })
})

describe("the channel summary's upload markers", () => {
  // The fake summary's days run 2026-10-03 and 2026-10-04: one video on the first, a Short and a
  // live stream on the second, newest first as the API answers them.
  function markedApi(): FakeApi {
    const api = installFakeApi()
    api.summaryDays = api.days
    api.summaryUploads = [
      { id: 'video-3', title: 'A Short', publishDay: '2026-10-04', format: 'short' },
      { id: 'video-2', title: 'A stream', publishDay: '2026-10-04', format: 'live' },
      { id: 'video-1', title: 'A video', publishDay: '2026-10-03', format: 'video' },
    ]
    return api
  }

  /**
   * The markers of the row under the axis, the fieldset "Uploads". At happy-dom's 1024 by 768 the
   * charts stack, so the pointer-only row under the first plot holds the same markers again.
   */
  function markersIn(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('fieldset.upload-markers .upload-marker')]
  }

  /** The rows of the open tile card, which Base UI portals to the document's body. */
  function cardRows(): HTMLAnchorElement[] {
    return [...document.querySelectorAll<HTMLAnchorElement>('.upload-marker-row')]
  }

  /**
   * A mouse moving onto `element` from the page, as Base UI's hover reads it: React's pointer enter,
   * which sets the pointer type, from a dispatched `pointerover`, then the `mouseenter` Base UI
   * listens for on the trigger itself.
   */
  async function hover(element: HTMLElement): Promise<void> {
    await pointer(element, 'pointerover', document.body)
    await act(async () => {
      element.dispatchEvent(new MouseEvent('mouseenter', { relatedTarget: document.body }))
    })
    await settle()
  }

  /** The mouse leaving `element` for the page, far from the card, as Base UI's hover reads it. */
  async function unhover(element: HTMLElement): Promise<void> {
    await pointer(element, 'pointerout', document.body)
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent('mouseleave', { relatedTarget: document.body, clientX: 900, clientY: 700 }),
      )
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 700 }))
    })
    await settle()
  }

  test('a mouse on a tile opens its card with every upload on it, and leaving closes it (creator-analytics#763)', async () => {
    markedApi()
    const { container } = await render()
    const tile = markersIn(container).find((marker) => marker.tagName === 'BUTTON')
    if (!tile) throw new Error('No tile')

    await hover(tile)
    expect(cardRows().map((row) => row.textContent)).toEqual([
      'Short: A ShortOct 4, 2026',
      'Live: A streamOct 4, 2026',
    ])

    await unhover(tile)
    expect(cardRows()).toEqual([])
  })

  test("a click on a hovered tile keeps its card open after the mouse leaves, Escape closes it, and a row opens its video's page (creator-analytics#763)", async () => {
    markedApi()
    const { container, address } = await render()
    const tile = markersIn(container).find((marker) => marker.tagName === 'BUTTON')
    if (!tile) throw new Error('No tile')

    await hover(tile)
    await click(tile)
    await unhover(tile)
    expect(cardRows()).toHaveLength(2)

    await press('Escape')
    expect(cardRows()).toEqual([])

    await hover(tile)
    await click(tile)
    const [short] = cardRows()
    if (!short) throw new Error('No row')
    await click(short)
    expect(address()).toBe('videos/video-3')
  })

  test('a click on a tile whose card has been open on hover for a while keeps it open after the mouse leaves, and once Escape closes it a hover opens it again only while the mouse stays (creator-analytics#763)', async () => {
    markedApi()
    const { container } = await render()
    const tile = markersIn(container).find((marker) => marker.tagName === 'BUTTON')
    if (!tile) throw new Error('No tile')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    await hover(tile)
    // Past Base UI's 500ms patient-click threshold, after which its own click closes a hover card.
    await act(async () => vi.advanceTimersByTime(600))
    await click(tile)
    expect(cardRows()).toHaveLength(2)
    await unhover(tile)
    expect(cardRows()).toHaveLength(2)

    await press('Escape')
    expect(cardRows()).toEqual([])

    await hover(tile)
    expect(cardRows()).toHaveLength(2)
    await unhover(tile)
    expect(cardRows()).toEqual([])
  })

  test("a click on a single upload's marker opens its video's page", async () => {
    markedApi()
    const { container, address } = await render()
    const [marker] = markersIn(container)
    if (!marker) throw new Error('No upload marker')

    expect(marker.getAttribute('aria-label')).toBe('Video: A video')
    await click(marker)

    expect(address()).toBe('videos/video-1')
  })

  test('the summary reads the uploads of the visibility switch, and reads again when it changes', async () => {
    const api = markedApi()
    const { container } = await render()
    const summaryReads = () => api.requests.filter(({ path }) => path.endsWith('/summary'))

    expect(summaryReads().at(-1)?.query.get('visibility')).toBeNull()
    await click(switchNamed(container, 'Show unlisted and private'))

    expect(summaryReads().at(-1)?.query.get('visibility')).toBe('all')
  })

  test('the right and left arrows move focus between the markers, which stop at either end', async () => {
    markedApi()
    const { container } = await render()
    const [first, tile] = markersIn(container)
    if (!first || !tile) throw new Error('No upload markers')

    await act(async () => first.focus())
    await press('ArrowRight')
    expect(document.activeElement).toBe(tile)
    expect(tile.getAttribute('tabindex')).toBe('0')
    expect(first.getAttribute('tabindex')).toBe('-1')

    await press('ArrowRight')
    expect(document.activeElement).toBe(tile)

    await press('ArrowLeft')
    expect(document.activeElement).toBe(first)
  })

  test("Enter on a tile opens its card, which lists both uploads newest first, each a link to its video's page", async () => {
    markedApi()
    const { container, address } = await render()
    const tile = markersIn(container).find((marker) => marker.tagName === 'BUTTON')
    if (!tile) throw new Error('No tile')
    expect(tile.getAttribute('aria-label')).toBe('2 uploads')

    await act(async () => tile.focus())
    await pressToActivate('Enter')
    const rows = [...document.querySelectorAll<HTMLAnchorElement>('.upload-marker-row')]

    expect(rows.map((row) => row.textContent)).toEqual([
      'Short: A ShortOct 4, 2026',
      'Live: A streamOct 4, 2026',
    ])
    const [short] = rows
    if (!short) throw new Error('No row')
    await click(short)
    expect(address()).toBe('videos/video-3')
  })

  describe('at a narrow width, where the two days would overlap', () => {
    /**
     * Gives the marker track the width happy-dom has no layout for: 10px, where the two days'
     * centres sit closer than one marker's 1.5rem. Every other element reads as happy-dom has it.
     */
    function narrowTrack() {
      const read = HTMLElement.prototype.getBoundingClientRect
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('upload-markers-track')
          ? DOMRect.fromRect({ x: 0, y: 0, width: 10, height: 20 })
          : read.call(this)
      })
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test("the row holds one tile of every upload, whose card lists them newest first, each with its own date, and a row opens its video's page", async () => {
      markedApi()
      narrowTrack()
      const { container, address } = await render()
      const markers = markersIn(container)

      expect(markers.map((marker) => marker.getAttribute('aria-label'))).toEqual(['3 uploads'])
      const [tile] = markers
      if (!tile) throw new Error('No tile')
      await act(async () => tile.focus())
      await pressToActivate('Enter')
      const rows = [...document.querySelectorAll<HTMLAnchorElement>('.upload-marker-row')]

      expect(rows.map((row) => row.textContent)).toEqual([
        'Short: A ShortOct 4, 2026',
        'Live: A streamOct 4, 2026',
        'Video: A videoOct 3, 2026',
      ])
      const video = rows.at(-1)
      if (!video) throw new Error('No row')
      await click(video)
      expect(address()).toBe('videos/video-1')
    })
  })
})

describe("a chart plot's keys", () => {
  const videoA = { ...fakeVideo, id: 'video-a', title: 'Video A', engagedViewsByDay: [10, 20, 30] }
  const videoB = { ...fakeVideo, id: 'video-b', title: 'Video B', engagedViewsByDay: [90, 5, 60] }
  // With no retention points, no retention chart draws.
  const retentionPoints = [
    { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
    { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.6, relativeRetentionPerformance: 0.5 },
    { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
  ]

  /** Whether a keydown on the plot was prevented. Only a cancelable event can be. */
  async function prevented(plot: HTMLElement, key: string): Promise<boolean> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    await act(async () => {
      plot.dispatchEvent(event)
    })
    return event.defaultPrevented
  }

  // The plot is found by its slider role, which the chart ports keep, not by its markup. Each
  // handled key is pressed where it steps the card, so none falls back to the page.
  test.each([
    {
      chart: 'stacked metric plot',
      address: 'videos/video-1',
      videos: null,
      retention: null,
      plotSelector: '.metric-chart [role="slider"]',
      handled: ['ArrowRight', 'ArrowLeft', 'Home', 'End'],
    },
    {
      chart: 'launch chart',
      address: '?window=first7',
      videos: [videoA, videoB],
      retention: null,
      plotSelector: '.launch-chart [role="slider"]',
      handled: ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowDown', 'ArrowUp'],
    },
    // The retention section has no class of its own, so each of its plots is found by its slider
    // role and its approved accessible name, which ends with the sentence on the video player.
    {
      chart: 'audience retention plot',
      address: 'videos/video-1',
      videos: null,
      retention: retentionPoints,
      plotSelector: `[role="slider"][aria-label="${chartLabelOf('Audience retention', playerMoveText.moveSentence)}"]`,
      handled: ['ArrowRight', 'ArrowLeft', 'Home', 'End'],
    },
    {
      chart: 'relative retention plot',
      address: 'videos/video-1',
      videos: null,
      retention: retentionPoints,
      plotSelector: `[role="slider"][aria-label="${chartLabelOf(relativeName, playerMoveText.moveSentence)}"]`,
      handled: ['ArrowRight', 'ArrowLeft', 'Home', 'End'],
    },
  ])(
    'on the $chart, a handled key keeps the page from scrolling, and Tab stays with the page',
    async ({ address, videos, retention, plotSelector, handled }) => {
      const api = installFakeApi()
      if (videos) api.videos = videos
      if (retention) api.retention = retention
      const { container } = await render(address)
      const plot = container.querySelector<HTMLElement>(plotSelector)
      if (!plot) throw new Error(`No plot at ${plotSelector}`)
      await act(async () => plot.focus())

      for (const key of handled) {
        expect(await prevented(plot, key), key).toBe(true)
      }
      expect(await prevented(plot, 'Tab')).toBe(false)
    },
  )
})

describe("the steps on a video's detail screen", () => {
  const steppedThrough = [
    fakeVideo,
    { ...fakeVideo, id: 'video-2', title: 'Another video' },
    { ...fakeVideo, id: 'video-3', title: 'A third video' },
  ]

  /** The first stepper's two places, previous then next, by their text: the stepper shows twice. */
  function stepTexts(container: HTMLElement): (string | null)[] {
    return ['previous', 'next'].map(
      (direction) => container.querySelector(`a.video-stepper-${direction}`)?.textContent ?? null,
    )
  }

  test.each([
    ['no sort, so newest first', '', 'Newer video', 'Older video'],
    ['newest first', '?sort=-publishedAt', 'Newer video', 'Older video'],
    ['oldest first', '?sort=publishedAt', 'Older video', 'Newer video'],
    ['a metric sort', '?sort=-engagedViews', 'Previous in list', 'Next in list'],
  ])(
    "read in a list with %s by which way each goes, and are named for that and the neighbour's title",
    async (_, query, previous, next) => {
      const api = installFakeApi()
      api.videos = steppedThrough
      const { container } = await render(`videos/video-2${query}`)

      expect(stepTexts(container)).toEqual([previous, next])
      expect(linkLabelled(container, `${previous}: A video`).className).toBe(
        'video-stepper-previous',
      )
      expect(linkLabelled(container, `${next}: A third video`).className).toBe('video-stepper-next')
      expect(linkNamed(container, previous).getAttribute('aria-label')).toBe(`${previous}: A video`)
    },
  )

  test("send video_stepped with the list's direction, not the words on the button", async () => {
    const api = installFakeApi()
    api.videos = steppedThrough
    const { container, address } = await render('videos/video-2?sort=publishedAt')
    vi.mocked(track).mockClear()

    await click(linkLabelled(container, 'Newer video: A third video'))
    expect(address()).toBe('videos/video-3?sort=publishedAt')
    await click(linkLabelled(container, 'Older video: Another video'))
    expect(address()).toBe('videos/video-2?sort=publishedAt')

    expect(
      vi
        .mocked(track)
        .mock.calls.map(([event]) => event)
        .filter(({ name }) => name === 'video_stepped'),
    ).toEqual([
      { name: 'video_stepped', direction: 'next' },
      { name: 'video_stepped', direction: 'previous' },
    ])
  })
})

describe("a video's thumbnail", () => {
  test.each([
    ['on the list', '', '.video-list-thumbnail', listThumbnailSizes],
    ['on the video page', 'videos/video-1', '.video-detail-thumbnail', detailThumbnailSizes],
  ])('%s offers the browser the sizes of its own place', async (_, address, place, sizes) => {
    const api = installFakeApi()
    const medium = 'https://i.ytimg.com/vi/video-1/mqdefault.jpg'
    api.videos = [{ ...fakeVideo, thumbnailUrl: medium, thumbnails: [{ url: medium, width: 320 }] }]
    const { container } = await render(address)

    expect(container.querySelector(`${place} img`)?.getAttribute('sizes')).toBe(sizes)
  })
})

describe('the placeholder of a video Google has not processed while its detail is read', () => {
  /** The places of the sections a processed video's answer fills, which an awaiting one does not. */
  const sectionPlaces = [
    '.placeholder-card',
    '.placeholder-chart',
    '.placeholder-since-publish-table',
    '.video-detail-breakdowns',
  ]

  test('opened from its list row, holds only the awaiting answer, which then lands in its place', async () => {
    const api = installFakeApi()
    api.videos = [
      { ...fakeVideo, id: 'video-awaiting', title: 'A new video', awaitingProcessing: true },
    ]
    const { container } = await render()

    // The screen's own read of the list page waits too, so the row the list read is all it knows.
    const steps = holdBoth(api, 'GET /api/channels/c-1/videos')
    const detail = holdBoth(api, 'GET /api/channels/c-1/videos/video-awaiting')
    await click(linkNamed(container, 'A new video'))

    const placeholders = container.querySelector('.placeholders')
    expect(placeholders?.querySelectorAll('.placeholder-not-processed')).toHaveLength(1)
    expect(placeholders?.querySelectorAll('.placeholder-note')).toHaveLength(1)
    for (const place of sectionPlaces) expect(placeholders?.querySelector(place)).toBeNull()

    await act(async () => {
      steps.release()
      detail.release()
    })
    await settle()
    expect(container.querySelector('.placeholders')).toBeNull()
    expect(container.textContent).toContain(notProcessedText)
  })

  test('opened cold at its address, which the page knows nothing of beforehand, holds every section', async () => {
    const api = installFakeApi()
    api.videos = [
      { ...fakeVideo, id: 'video-cold', title: 'A cold video', awaitingProcessing: true },
    ]
    const list = holdBoth(api, 'GET /api/channels/c-1/videos')
    const detail = holdBoth(api, 'GET /api/channels/c-1/videos/video-cold')
    const { container } = await render('videos/video-cold')

    const placeholders = container.querySelector('.placeholders')
    expect(placeholders).not.toBeNull()
    expect(placeholders?.querySelector('.placeholder-not-processed')).toBeNull()
    for (const place of sectionPlaces) expect(placeholders?.querySelector(place)).not.toBeNull()

    await act(async () => {
      list.release()
      detail.release()
    })
    await settle()
  })
})

describe("the list pages a video's detail screen reads for its steps", () => {
  test.each([
    ['the default preferences', {}, '10', 'public'],
    ['a saved page size and visibility', { pageSize: 25, visibility: 'all' }, '25', 'all'],
  ] as const)(
    "with %s, are read with the list's own query, apart from the page, so the API answers them from the list's cached read",
    async (_, preferences, pageSize, visibility) => {
      const api = installFakeApi(preferences)
      api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
      api.pageCount = 2
      const { container } = await render('?window=last90&sort=-views')
      const listReads = () => api.requests.filter(({ path }) => path.endsWith('/videos'))
      const listQuery = listReads().at(-1)?.query.toString()
      const before = listReads().length

      await click(linkNamed(container, 'A video'))

      const stepReads = listReads()
        .slice(before)
        .map(({ query }) => new URLSearchParams(query))
      expect(stepReads.map((query) => query.get('page'))).toEqual(['1', '2'])
      for (const query of stepReads) {
        expect([query.get('pageSize'), query.get('visibility')]).toEqual([pageSize, visibility])
        query.set('page', '1')
      }
      expect(stepReads.map(String)).toEqual([listQuery, listQuery])
    },
  )
})

const listRoute = `GET /api/channels/${fakeChannel.id}/videos`

/** The page numbers the app asked the video list for, in order. */
function pagesRead(api: FakeApi): string[] {
  return api.requests
    .filter(({ method, path }) => method === 'GET' && path.endsWith('/videos'))
    .map(({ query }) => query.get('page') ?? '1')
}

/** The first stepper's next place: the stepper shows twice. */
function nextPlace(container: HTMLElement): Element {
  const place = container.querySelector('.video-stepper-next')
  if (!place) throw new Error('No next place')
  return place
}

describe("the pager's landing on the video list", () => {
  /** The list's table, the one node that stays through a page's read. */
  function listTable(container: HTMLElement): HTMLTableElement {
    const table = container.querySelector<HTMLTableElement>('.video-list-scroll table')
    if (!table) throw new Error('No list table')
    return table
  }

  /**
   * Gives the page the sizes happy-dom has no layout for: scrolled 200px, the list's table 900px
   * down the screen and the controls bar 80px tall, so a landing asks for a scroll to 1020px. Spies
   * the scroll the app asks for.
   */
  function laidOut(container: HTMLElement) {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(200)
    vi.spyOn(listTable(container), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 900, width: 1000, height: 600 }),
    )
    const bar = container.querySelector('.controls-bar')
    if (!bar) throw new Error('No controls bar')
    vi.spyOn(bar as HTMLElement, 'offsetHeight', 'get').mockReturnValue(80)
    return vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  }
  const landingTop = 1020

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    ['Next page', '?page=1', 2],
    ['Previous page', '?page=3', 2],
    ['First page', '?page=4', 1],
    ['Last page', '?page=2', 5],
  ])(
    '%s does not ask for the top of the page, brings the table under the controls bar and moves focus to it, its caption naming the new page',
    async (link, address, page) => {
      const api = installFakeApi()
      api.pageCount = 5
      const { container } = await render(address)
      const scrollTo = laidOut(container)

      await click(linkNamed(container, link))

      expect(scrollTo).not.toHaveBeenCalledWith(0, 0)
      expect(scrollTo).toHaveBeenCalledWith({ top: landingTop })
      const table = listTable(container)
      expect(document.activeElement).toBe(table)
      expect(table.getAttribute('tabindex')).toBe('-1')
      expect(table.querySelector('caption')?.textContent).toBe(`Videos, page ${page} of 5`)
    },
  )

  test.each([
    [
      'First page',
      '?window=last90&sort=-views&format=short&page=4&pageSize=25&visibility=all',
      '?window=last90&sort=-views&format=short&pageSize=25&visibility=all',
      '1',
    ],
    [
      'Last page',
      '?window=last90&sort=-views&format=short&pageSize=25&visibility=all',
      '?window=last90&sort=-views&format=short&page=5&pageSize=25&visibility=all',
      '5',
    ],
  ])(
    "%s opens its page and keeps the list's window, sort, format, page size and visibility",
    async (link, start, end, page) => {
      const api = installFakeApi()
      api.pageCount = 5
      const { container, address } = await render(start)

      await click(linkNamed(container, link))

      expect(address()).toBe(end)
      const lastRead = api.requests.filter(({ path }) => path.endsWith('/videos')).at(-1)?.query
      expect(pagesRead(api).at(-1)).toBe(page)
      expect(lastRead?.get('window')).toBe('last90')
      expect(lastRead?.get('sort')).toBe('-views')
      expect(lastRead?.get('format')).toBe('short')
      expect(lastRead?.get('pageSize')).toBe('25')
      expect(lastRead?.get('visibility')).toBe('all')
    },
  )

  test('under "Publish day", the publish day top above the list stays while the next page reads, so the table it landed on does not ride up', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    api.publishDayTop = [
      { id: 'top-1', title: 'A top video', publishedAt: fakeVideo.publishedAt, engagedViews: 90 },
      {
        id: 'top-2',
        title: 'Another top video',
        publishedAt: fakeVideo.publishedAt,
        engagedViews: 40,
      },
    ]
    const { container } = await render('?window=first1&page=1')
    laidOut(container)
    const nextPage = holdBoth(api, `GET /api/channels/${fakeChannel.id}/videos`)

    await click(linkNamed(container, 'Next page'))

    expect(container.querySelector('.video-list-scroll .placeholder')).not.toBeNull()
    const top = container.querySelector('.publish-day-top')
    expect([...(top?.querySelectorAll('li a') ?? [])].map((link) => link.textContent)).toEqual([
      'A top video',
      'Another top video',
    ])
    nextPage.release()
    await settle()
  })

  test("a video's title link still asks for the top of the screen", async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render()
    const scrollTo = laidOut(container)

    await click(linkNamed(container, 'A video'))

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(scrollTo).not.toHaveBeenCalledWith({ top: landingTop })
  })

  test("a single-page list's caption names its one page", async () => {
    installFakeApi()
    const { container } = await render()

    expect(listTable(container).querySelector('caption')?.textContent).toBe('Videos, page 1 of 1')
  })

  test('an empty list is still named "Videos" for a screen reader', async () => {
    const api = installFakeApi()
    api.videos = []
    api.pageCount = 0
    const { container } = await render('?format=short')

    expect(container.textContent).toContain('This channel has no public uploads in this format.')
    const list = container.querySelector('section.video-list')
    expect(list?.getAttribute('aria-label')).toBe('Videos')
  })

  test('a list with rows carries the same name, and its caption still names the page', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render()

    const list = container.querySelector('section.video-list')
    expect(list?.getAttribute('aria-label')).toBe('Videos')
    expect(listTable(container).querySelector('caption')?.textContent).toBe('Videos, page 1 of 5')
  })

  // One case per check in the guard that leaves a click to the browser (creator-analytics#340). A
  // browser sends a middle button as `auxclick`, not `click`, so the Middle case pins the
  // guard against a non-primary `click`, the one happy-dom delivers to React's `onClick`, not a
  // real middle click; the browser walk does not cover a middle click either.
  test.each<{ name: string; init: MouseEventInit }>([
    { name: 'Cmd', init: { metaKey: true } },
    { name: 'Ctrl', init: { ctrlKey: true } },
    { name: 'Shift', init: { shiftKey: true } },
    { name: 'Alt', init: { altKey: true } },
    { name: 'Middle', init: { button: 1 } },
  ])(
    '$name-click on Next page is left to the browser: no scroll and no focus move',
    async ({ init }) => {
      const api = installFakeApi()
      api.pageCount = 5
      const { container, address } = await render('?page=1')
      const scrollTo = laidOut(container)
      const before = address()
      // The test stands in for the browser's new tab, so the page here stays put.
      container.addEventListener('click', (event) => event.preventDefault())

      await act(async () => {
        linkNamed(container, 'Next page').dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
        )
      })
      await settle()

      expect(scrollTo).not.toHaveBeenCalled()
      expect(document.activeElement).not.toBe(listTable(container))
      expect(address()).toBe(before)
    },
  )

  test.each(['status', 'network'] as const)(
    'Next page with the page read refused (%s) leaves keyboard focus on the list, not on the page body',
    async (how) => {
      const api = installFakeApi()
      api.pageCount = 5
      const { container } = await render('?page=1')
      laidOut(container)
      api.failNext(listRoute, how)
      // A keyboard user tabs to the link, then presses Enter on it.
      const next = linkNamed(container, 'Next page')
      next.focus()
      expect(document.activeElement).toBe(next)

      await click(next)

      const alert = container.querySelector('.video-list [role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('tabindex')).toBe('-1')
      expect(document.activeElement).toBe(alert)
    },
  )

  test('leaves keyboard focus the creator moved while the next page reads where they put it when the read is refused', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render('?page=1')
    laidOut(container)
    const nextPage = api.hold(listRoute)
    api.failNext(listRoute)

    await click(linkNamed(container, 'Next page'))
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => wordmark.focus())
    await act(async () => nextPage.fail())
    await settle()

    expect(container.querySelector('.video-list [role="alert"]')).not.toBeNull()
    expect(document.activeElement).toBe(wordmark)
  })

  test('a refused read no pager link led to takes no focus', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    api.failNext(listRoute)

    const { container } = await render('?page=1')

    const refusal = container.querySelector('.video-list [role="alert"]')
    expect(refusal).not.toBeNull()
    expect(document.activeElement).not.toBe(refusal)
  })

  test('a refused re-read of the first page after Next then Previous keeps focus in the list', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render('?page=1')
    laidOut(container)
    const page2 = api.hold(listRoute)
    api.failNext(listRoute)

    await click(linkNamed(container, 'Next page'))
    await click(linkNamed(container, 'Previous page'))
    await settle()

    const alert = container.querySelector('.video-list [role="alert"]')
    expect(alert).not.toBeNull()
    expect(document.activeElement).toBe(alert)
    page2.release()
  })

  test.each(['status', 'network'] as const)(
    'a sort heading pressed with its read refused (%s) leaves keyboard focus on the list, not on the page body',
    async (how) => {
      const api = installFakeApi()
      const { container } = await render()
      api.failNext(listRoute, how)
      // A keyboard user tabs to the heading, then presses Enter on it.
      const heading =
        listTable(container).querySelector<HTMLButtonElement>('button.sortable-heading')
      if (!heading) throw new Error('No sortable heading in the list')
      heading.focus()
      expect(document.activeElement).toBe(heading)

      await click(heading)

      const alert = container.querySelector('.video-list [role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('tabindex')).toBe('-1')
      expect(document.activeElement).toBe(alert)
    },
  )

  test('leaves keyboard focus the creator moved while a sort reads where they put it when the read is refused', async () => {
    const api = installFakeApi()
    const { container } = await render()
    const sorted = api.hold(listRoute)
    const heading = listTable(container).querySelector<HTMLButtonElement>('button.sortable-heading')
    if (!heading) throw new Error('No sortable heading in the list')
    heading.focus()

    await click(heading)
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => wordmark.focus())
    expect(container.querySelector('.video-list [role="alert"]')).toBeNull()
    await act(async () => sorted.fail())
    await settle()

    expect(container.querySelector('.video-list [role="alert"]')).not.toBeNull()
    expect(document.activeElement).toBe(wordmark)
  })

  test('after Next page answers, a refused read the visibility switch starts takes no focus', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render('?page=1')
    laidOut(container)
    await click(linkNamed(container, 'Next page'))
    // Focus on the page, where a refusal that followed a pager link would take it.
    act(() => (document.activeElement as HTMLElement).blur())
    expect(document.activeElement).toBe(document.body)
    api.failNext(listRoute)

    await click(switchNamed(container, 'Show unlisted and private'))

    const alert = container.querySelector('.video-list [role="alert"]')
    expect(alert).not.toBeNull()
    expect(document.activeElement).not.toBe(alert)
  })
})

// creator-analytics#944 review pass 3 F3.1: the traffic source select and the minimum impressions
// field leave the controls row when the list stops offering them, under the creator who has one
// focused; focus then goes to the control before them, not the page.
describe('the history filters leaving the controls row with focus in one', () => {
  function minimumFieldIn(container: HTMLElement): HTMLInputElement | null {
    const label = [...container.querySelectorAll('label')].find((each) =>
      each.textContent?.startsWith(minImpressionsLabel),
    )
    return label?.querySelector('input') ?? null
  }

  /**
   * Renders a paid channel whose list answered with the history earlier on this page load, so its
   * controls hold their place, then mounts the list anew with its next read held, which then
   * answers without the history: the list's memo of its last answer is the page's, not the test's,
   * so a first read of the page load cannot be staged here once another test has answered.
   */
  async function readingAfterAnAnswerWithHistory() {
    const api = installFakeApi()
    api.entitlements = entitlementsOf(subscribedToOneBlock, {
      channelId: fakeChannel.id,
      tier: 'paid',
      canManage: true,
    })
    api.listHistory = { firstDay: '2026-10-03', newestDay: '2026-10-04' }
    await render()
    rendered?.unmount()
    api.listHistory = undefined
    const read = holdBoth(api, listRoute)
    const { container } = await render()
    return { container, read }
  }

  async function renderProWithMinimumField(search?: string) {
    const api = installFakeApi()
    api.entitlements = entitlementsOf(subscribedToOneBlock, {
      channelId: fakeChannel.id,
      tier: 'paid',
      canManage: true,
    })
    api.listHistory = { firstDay: '2026-10-03', newestDay: '2026-10-04' }
    const { container } = await render(search)
    const minimum = minimumFieldIn(container)
    if (!minimum) throw new Error('No minimum impressions field')
    return { container, minimum }
  }

  test('on a Pro channel, a minimum committed with Enter keeps focus in the minimum field', async () => {
    const { container, minimum } = await renderProWithMinimumField()
    act(() => minimum.focus())

    await act(async () => {
      minimum.value = '500'
      minimum.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await settle()

    expect(window.location.search).toContain('minImpressions=500')
    expect(document.activeElement).toBe(minimumFieldIn(container))
  })

  test('a change of the minimum in the address puts the new minimum in the field', async () => {
    const { container } = await renderProWithMinimumField('?minImpressions=500')

    await act(async () => {
      window.history.pushState(null, '', '?minImpressions=100')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await settle()

    expect(minimumFieldIn(container)?.value).toBe('100')
  })

  test('on a free channel, choosing All sources gives focus to Videos per page', async () => {
    installFakeApi()
    const { container } = await render('?trafficSource=YT_SEARCH')
    const source = selectNamed(container, trafficSourceLabel)
    act(() => source.focus())

    await choose(container, trafficSourceLabel, allTrafficSources)

    expect(comboboxesNamed(container, trafficSourceLabel)).toEqual([])
    expect(document.activeElement).toBe(selectNamed(container, pageSizeLabel))
  })

  test('on a free channel, emptying the minimum and pressing Enter gives focus to Videos per page', async () => {
    installFakeApi()
    const { container } = await render('?minImpressions=500')
    const minimum = minimumFieldIn(container)
    if (!minimum) throw new Error('No minimum impressions field')
    act(() => minimum.focus())

    await act(async () => {
      minimum.value = ''
      minimum.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await settle()

    expect(minimumFieldIn(container)).toBeNull()
    expect(document.activeElement).toBe(selectNamed(container, pageSizeLabel))
  })

  test('an answer without the history, landing with the select focused, gives focus to Videos per page', async () => {
    const { container, read } = await readingAfterAnAnswerWithHistory()
    const source = selectNamed(container, trafficSourceLabel)
    act(() => source.focus())

    await act(async () => read.release())
    await settle()

    expect(comboboxesNamed(container, trafficSourceLabel)).toEqual([])
    expect(document.activeElement).toBe(selectNamed(container, pageSizeLabel))
  })

  test('an answer without the history leaves focus the creator moved off the select where they put it', async () => {
    const { container, read } = await readingAfterAnAnswerWithHistory()
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => selectNamed(container, trafficSourceLabel).focus())
    act(() => wordmark.focus())

    await act(async () => read.release())
    await settle()

    expect(comboboxesNamed(container, trafficSourceLabel)).toEqual([])
    expect(document.activeElement).toBe(wordmark)
  })
})

describe('a CTR or impressions sort the list cannot show', () => {
  test('refused for a channel whose history is not readable, the list runs newest first in place of the address', async () => {
    const api = installFakeApi()
    api.failNext(listRoute, { status: 403, body: { error: 'sort_without_history' } })
    const entries = window.history.length
    const { container, address } = await render('?sort=-ctr')

    expect(address()).toBe('')
    expect(window.history.length).toBe(entries)
    expect(vi.mocked(track).mock.calls.map(([{ name }]) => name)).toEqual(['video_list_viewed'])
    expect(alertOf(container)).toBeNull()
    expect(
      api.requests
        .filter(({ path }) => path.endsWith('/videos'))
        .map(({ query }) => query.get('sort')),
    ).toEqual(['-ctr', '-publishedAt'])
    expect(container.querySelector('.video-list tbody tr')).not.toBeNull()
  })

  test('with a traffic source in the address, the newest first read refused for the filter shows its refusal and the filter to clear', async () => {
    const api = installFakeApi()
    api.failNext(listRoute, { status: 403, body: { error: 'sort_without_history' } })
    api.failNext(listRoute, { status: 403, body: { error: 'filter_without_history' } })
    const { container, address } = await render('?sort=-ctr&trafficSource=YT_SEARCH')

    expect(address()).toBe('?trafficSource=YT_SEARCH')
    expect(alertOf(container)).not.toBeNull()
    expect(comboboxesNamed(container, trafficSourceLabel)).not.toEqual([])
    expect(
      api.requests
        .filter(({ path }) => path.endsWith('/videos'))
        .map(({ query }) => query.get('sort')),
    ).toEqual(['-ctr', '-publishedAt'])
  })
})

describe('a refused list page next to the video on view', () => {
  /** Opens video-1, on page 1 of two pages and at or next to its end, with the read of page 2 refused. */
  async function openedWithPageTwoRefused(api: FakeApi): Promise<RenderedApp> {
    api.pageCount = 2
    const pageOne = api.hold(listRoute)
    api.failNext(listRoute)
    const shown = await render('videos/video-1')
    await act(async () => pageOne.release())
    await settle()
    expect(pagesRead(api)).toEqual(['1', '2'])
    return shown
  }

  test('shows its failure and Try again in the next place, where the end of the list shows neither', async () => {
    installFakeApi()
    const end = await render('videos/video-1')
    expect(nextPlace(end.container).textContent).toBe('')
    expect(nextPlace(end.container).querySelector('button')).toBeNull()
    end.unmount()
    vi.unstubAllGlobals()

    const { container } = await openedWithPageTwoRefused(installFakeApi())

    expect(nextPlace(container).textContent).toContain(refusedPageText)
    expect(nextPlace(container).querySelector('button')?.textContent).toBe(retryText)
  })

  test('is read again by Try again, which holds the empty place while it reads and then shows the step', async () => {
    const api = installFakeApi()
    const { container } = await openedWithPageTwoRefused(api)
    const tracked = vi.mocked(track).mock.calls.length

    const retried = api.hold(listRoute)
    await click(buttonNamed(container, retryText))
    expect(nextPlace(container).textContent).toBe('')
    expect(nextPlace(container).querySelector('button')).toBeNull()
    await act(async () => retried.release())
    await settle()

    expect(pagesRead(api)).toEqual(['1', '2', '2'])
    expect(
      linkLabelled(container, stepLabelOf('next', defaultRoute.sort, fakeVideo.title)),
    ).not.toBeNull()
    // No product event for Try again: the API's logs record each failed list read.
    expect(vi.mocked(track).mock.calls.length).toBe(tracked)
  })

  test('keeps keyboard focus in the stepper while Try again reads, and gives it to the step once it lands', async () => {
    const api = installFakeApi()
    const { container } = await openedWithPageTwoRefused(api)
    const button = buttonNamed(container, retryText)
    const stepper = button.closest('nav')
    act(() => button.focus())

    const retried = api.hold(listRoute)
    await click(button)
    expect(document.activeElement).toBe(stepper)
    await act(async () => retried.release())
    await settle()

    expect(document.activeElement).toBe(
      linkLabelled(container, stepLabelOf('next', defaultRoute.sort, fakeVideo.title)),
    )
  })

  test('gives keyboard focus back to Try again when the page is refused again', async () => {
    const api = installFakeApi()
    const { container } = await openedWithPageTwoRefused(api)
    act(() => buttonNamed(container, retryText).focus())

    api.failNext(listRoute)
    await click(buttonNamed(container, retryText))

    expect(pagesRead(api)).toEqual(['1', '2', '2'])
    expect(document.activeElement).toBe(buttonNamed(container, retryText))
  })

  test('leaves keyboard focus the creator moved out of the stepper while Try again reads where they put it', async () => {
    const api = installFakeApi()
    const { container } = await openedWithPageTwoRefused(api)
    const button = buttonNamed(container, retryText)
    act(() => button.focus())

    const retried = api.hold(listRoute)
    await click(button)
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => wordmark.focus())
    await act(async () => retried.release())
    await settle()

    expect(
      linkLabelled(container, stepLabelOf('next', defaultRoute.sort, fakeVideo.title)),
    ).not.toBeNull()
    expect(document.activeElement).toBe(wordmark)
  })

  test('is read again, once, by a step to another video that needs it', async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    const { container, address } = await openedWithPageTwoRefused(api)

    await click(linkLabelled(container, stepLabelOf('next', defaultRoute.sort, 'Another video')))

    expect(address()).toBe('videos/video-2')
    expect(pagesRead(api)).toEqual(['1', '2', '2'])
    expect(
      linkLabelled(container, stepLabelOf('next', defaultRoute.sort, fakeVideo.title)),
    ).not.toBeNull()
  })
})

describe('a refused list page holding the video on view', () => {
  const another = stepLabelOf('next', defaultRoute.sort, 'Another video')

  /** Opens video-1, first of two videos on the list's one page, with the read of that page refused. */
  async function openedWithItsPageRefused(api: FakeApi): Promise<RenderedApp> {
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    api.failNext(listRoute)
    const shown = await render('videos/video-1')
    expect(pagesRead(api)).toEqual(['1'])
    return shown
  }

  /** The first stepper: the stepper shows twice. */
  function firstStepper(container: HTMLElement): HTMLElement {
    const stepper = container.querySelector<HTMLElement>('nav.video-stepper')
    if (!stepper) throw new Error('No stepper')
    return stepper
  }

  test("shows the stepper's failure and one Try again, where a page without the video shows no stepper", async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    const page = api.hold(listRoute)
    const elsewhere = await render('videos/video-2')
    api.videos = [fakeVideo]
    await act(async () => page.release())
    await settle()
    expect(elsewhere.container.querySelector('nav.video-stepper')).toBeNull()
    elsewhere.unmount()
    vi.unstubAllGlobals()

    const { container } = await openedWithItsPageRefused(installFakeApi())

    const steppers = [...container.querySelectorAll('nav.video-stepper')]
    expect(steppers).toHaveLength(2)
    for (const stepper of steppers) {
      expect(stepper.textContent).toContain(refusedPageText)
      expect([...stepper.querySelectorAll('button')].map((each) => each.textContent)).toEqual([
        retryText,
      ])
      expect(stepper.querySelector('a')).toBeNull()
    }
  })

  test('is read again by Try again, which holds the empty places while it reads and then shows the steps', async () => {
    const api = installFakeApi()
    const { container } = await openedWithItsPageRefused(api)
    const tracked = vi.mocked(track).mock.calls.length

    const retried = api.hold(listRoute)
    await click(buttonNamed(container, retryText))
    expect(firstStepper(container).textContent).toBe('')
    expect(firstStepper(container).querySelector('a, button')).toBeNull()
    await act(async () => retried.release())
    await settle()

    expect(pagesRead(api)).toEqual(['1', '1'])
    expect(linkLabelled(container, another).className).toBe('video-stepper-next')
    expect(firstStepper(container).textContent).not.toContain(refusedPageText)
    // No product event for Try again: the API's logs record each failed list read.
    expect(vi.mocked(track).mock.calls.length).toBe(tracked)
  })

  test('keeps keyboard focus in the stepper while Try again reads, and gives it to the step once it lands', async () => {
    const api = installFakeApi()
    const { container } = await openedWithItsPageRefused(api)
    const button = buttonNamed(container, retryText)
    const stepper = button.closest('nav')
    act(() => button.focus())

    const retried = api.hold(listRoute)
    await click(button)
    expect(document.activeElement).toBe(stepper)
    await act(async () => retried.release())
    await settle()

    expect(document.activeElement).toBe(linkLabelled(container, another))
  })

  test('keeps keyboard focus in the stepper until the page next to its own lands too', async () => {
    const api = installFakeApi()
    // One video on page 1 of two, so its next video is the first on page 2.
    api.pageCount = 2
    api.failNext(listRoute)
    const { container } = await render('videos/video-1')
    const button = buttonNamed(container, retryText)
    const stepper = button.closest('nav')
    act(() => button.focus())

    const ownPage = api.hold(listRoute)
    const nextPage = api.hold(listRoute)
    await click(button)
    await act(async () => ownPage.release())
    await settle()
    expect(pagesRead(api)).toEqual(['1', '1', '2'])
    expect(document.activeElement).toBe(stepper)
    await act(async () => nextPage.release())
    await settle()

    expect(document.activeElement).toBe(
      linkLabelled(container, stepLabelOf('next', defaultRoute.sort, fakeVideo.title)),
    )
  })

  test('gives keyboard focus back to Try again when the page is refused again', async () => {
    const api = installFakeApi()
    const { container } = await openedWithItsPageRefused(api)
    act(() => buttonNamed(container, retryText).focus())

    api.failNext(listRoute)
    await click(buttonNamed(container, retryText))

    expect(pagesRead(api)).toEqual(['1', '1'])
    expect(document.activeElement).toBe(buttonNamed(container, retryText))
  })

  test('leaves keyboard focus the creator moved out of the stepper while Try again reads where they put it', async () => {
    const api = installFakeApi()
    const { container } = await openedWithItsPageRefused(api)
    const button = buttonNamed(container, retryText)
    act(() => button.focus())

    const retried = api.hold(listRoute)
    await click(button)
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => wordmark.focus())
    await act(async () => retried.release())
    await settle()

    expect(linkLabelled(container, another)).not.toBeNull()
    expect(document.activeElement).toBe(wordmark)
  })

  test("gives keyboard focus to the video's title when Try again brings the page back without the video", async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    api.failNext(listRoute)
    const { container } = await render('videos/video-2')
    const button = buttonNamed(container, retryText)
    act(() => button.focus())

    // A new upload or a deletion moves the video to another page while the page is refused.
    api.videos = [fakeVideo]
    await click(button)

    expect(container.querySelector('nav.video-stepper')).toBeNull()
    const focused = document.activeElement
    expect(focused?.tagName).toBe('H1')
    expect(focused?.textContent).toBe('Another video')
  })

  test('keeps focus the creator moved while Try again reads when the page lands without the video', async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    api.failNext(listRoute)
    const { container } = await render('videos/video-2')
    const button = buttonNamed(container, retryText)
    act(() => button.focus())

    api.videos = [fakeVideo]
    const page = api.hold(listRoute)
    await click(button)
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    act(() => wordmark.focus())
    await act(async () => page.release())
    await settle()

    expect(container.querySelector('nav.video-stepper')).toBeNull()
    expect(document.activeElement).toBe(wordmark)
  })

  test('leaves focus on the body when a stepper whose Try again was never pressed goes away', async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    const page = api.hold(listRoute)
    const { container } = await render('videos/video-2')
    // The detail landed and focused the title once; the creator then clicks blank page.
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    expect(document.activeElement).toBe(document.body)

    api.videos = [fakeVideo]
    await act(async () => page.release())
    await settle()

    expect(container.querySelector('nav.video-stepper')).toBeNull()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('a refused list page that an arrival by Back or Forward needs', () => {
  const older = (title: string) => stepLabelOf('next', defaultRoute.sort, title)
  const newer = (title: string) => stepLabelOf('previous', defaultRoute.sort, title)

  /**
   * Three videos on page 1 of two, so video-1 needs page 1 alone, while video-2 and video-3, at or
   * next to the page's end, need page 2 too, and video-3's next video is on it. Opens video-1,
   * holds page 2, steps to video-2 then video-3, and returns to video-2 by `back`, with page 2
   * still held, then fails page 2 there.
   */
  async function refusedOnTheWayBack(back: (container: HTMLElement) => Promise<void>) {
    const api = installFakeApi()
    api.videos = [
      fakeVideo,
      { ...fakeVideo, id: 'video-2', title: 'Another video' },
      { ...fakeVideo, id: 'video-3', title: 'A third video' },
    ]
    api.pageCount = 2
    const shown = await render('videos/video-1')
    expect(pagesRead(api)).toEqual(['1'])

    const pageTwo = api.hold(listRoute)
    await click(linkLabelled(shown.container, older('Another video')))
    await click(linkLabelled(shown.container, older('A third video')))
    expect(shown.address()).toBe('videos/video-3')
    await back(shown.container)
    expect(shown.address()).toBe('videos/video-2')
    await act(async () => pageTwo.fail())
    await settle()
    expect(pagesRead(api)).toEqual(['1', '2'])
    return { api, ...shown }
  }

  test('is read again on Back to the video that needs it', async () => {
    const { api, container, address } = await refusedOnTheWayBack((container) =>
      click(linkLabelled(container, newer('Another video'))),
    )

    await act(async () => window.history.back())
    await settle()

    expect(address()).toBe('videos/video-3')
    expect(pagesRead(api)).toEqual(['1', '2', '2'])
    expect(linkLabelled(container, older(fakeVideo.title))).not.toBeNull()
  })

  test('is read again on Forward to the video that needs it', async () => {
    const { api, container, address } = await refusedOnTheWayBack(async () => {
      await act(async () => window.history.back())
      await settle()
    })

    await act(async () => window.history.forward())
    await settle()

    expect(address()).toBe('videos/video-3')
    expect(pagesRead(api)).toEqual(['1', '2', '2'])
    expect(linkLabelled(container, older(fakeVideo.title))).not.toBeNull()
  })
})

describe("a young video's since publish placeholder, while its detail is read", () => {
  // `fakeVideo` was published on 2026-10-01 and the fake's last processed day is 2026-10-04, so the
  // video is 4 days old: its table shows the heading row, Publish day and Lifetime. A video the page
  // has had no answer for holds every stage, 7 rows. The page remembers videos for as long as it
  // lives, which here is the whole file, so each test opens a video of its own id.
  const youngRows = '3'
  const unknownRows = '7'
  const listRead = 'GET /api/channels/c-1/videos'

  function youngVideo(api: FakeApi, id: string) {
    api.videos = [{ ...fakeVideo, id, title: 'A young video' }]
    return `${listRead}/${id}`
  }

  function sincePublishRows(container: HTMLElement): string | undefined {
    return container
      .querySelector<HTMLElement>('.placeholders .placeholder-since-publish-table')
      ?.style.getPropertyValue('--rows')
  }

  test('opened from the list, holds the rows the list answer told of', async () => {
    const api = installFakeApi()
    const detailRead = youngVideo(api, 'young-from-list')
    const { container } = await render()

    // The screen's own reads wait, so the list answer is all it knows.
    const steps = holdBoth(api, listRead)
    const detail = holdBoth(api, detailRead)
    await click(linkNamed(container, 'A young video'))

    expect(sincePublishRows(container)).toBe(youngRows)

    await act(async () => {
      steps.release()
      detail.release()
    })
    await settle()
  })

  test('opened cold at its address, holds every stage, then the rows its list page tells of', async () => {
    const api = installFakeApi()
    const detailRead = youngVideo(api, 'young-cold')
    const list = holdBoth(api, listRead)
    const detail = holdBoth(api, detailRead)
    const { container } = await render('videos/young-cold')
    expect(sincePublishRows(container)).toBe(unknownRows)

    await act(async () => list.release())
    await settle()

    expect(sincePublishRows(container)).toBe(youngRows)

    await act(async () => detail.release())
    await settle()
  })

  test('read again for another window, holds the rows its own answer told of', async () => {
    const api = installFakeApi()
    const detailRead = youngVideo(api, 'young-window')
    // The list pages wait for both windows, so the video's own answer is all the screen knows.
    const lists = [holdBoth(api, listRead), holdBoth(api, listRead)]
    const { container } = await render('videos/young-window')
    expect(container.querySelector('.placeholders')).toBeNull()

    const detail = holdBoth(api, detailRead)
    await choose(container, 'Date range', 'last90')

    expect(sincePublishRows(container)).toBe(youngRows)

    await act(async () => {
      for (const list of lists) list.release()
      detail.release()
    })
    await settle()
  })
})

describe("the launch chart's placeholder while the list is read (creator-analytics#325)", () => {
  // The fake answers its one video on every page, so a page of 1 row, which draws no first-10 note.
  // The page remembers each list answer's rows for as long as it lives, which here is the whole
  // file, so each test reads a route at page size 25 that no other test in the file answers.
  const listRead = 'GET /api/channels/c-1/videos'

  /** Whether the summary's place holds the launch chart's placeholder, and the first-10 note's. */
  function placesHeld(container: HTMLElement) {
    return {
      chart: container.querySelector('.placeholder-chart') !== null,
      firstRowsNote: container.querySelector('.placeholder-first-rows-note') !== null,
    }
  }

  /**
   * Whether `step` draws the first-10 note's place at any commit, even one a later commit in the
   * same step takes back: every node `step` adds or removes is read for it.
   */
  async function drawsFirstRowsNote(container: HTMLElement, step: () => Promise<void>) {
    const touched: Node[] = []
    const record = (records: MutationRecord[]) => {
      for (const each of records) touched.push(...each.addedNodes, ...each.removedNodes)
    }
    const observer = new MutationObserver(record)
    observer.observe(container, { childList: true, subtree: true })
    await step()
    record(observer.takeRecords())
    observer.disconnect()
    const note = '.placeholder-first-rows-note'
    return touched.some(
      (node) =>
        node instanceof Element && (node.matches(note) || node.querySelector(note) !== null),
    )
  }

  test('back from a video opened from a page of 10 rows or fewer, holds no first-10 note place', async () => {
    const api = installFakeApi({ pageSize: 25 })
    const { container } = await render('?window=first28')
    await click(linkNamed(container, fakeVideo.title))

    const list = holdBoth(api, listRead)
    await act(async () => window.history.back())
    expect(placesHeld(container)).toEqual({ chart: true, firstRowsNote: false })

    await act(async () => list.release())
    await settle()
  })

  test('on a page the list has not answered, holds the first-10 note place at page size 25', async () => {
    const api = installFakeApi({ pageSize: 25 })
    api.pageCount = 2
    const list = holdBoth(api, listRead)
    const { container } = await render('?window=first7&page=2')
    expect(placesHeld(container)).toEqual({ chart: true, firstRowsNote: true })

    await act(async () => list.release())
    await settle()
  })

  // creator-analytics#376: the list reads a watch-time sort with Watch hours off newest first, and
  // remembers its answer under that read, so the note place reads its row count there too. Back
  // lands on the sorted address for the one commit before the list's address replace.
  test('back mid read to a sort the list reads newest first, draws no first-10 note place for its 1 row', async () => {
    const api = installFakeApi({ pageSize: 25, watchTimeColumn: false })
    api.pageCount = 2
    const { container } = await render('?window=first365&format=short')
    await click(linkNamed(container, 'Next page'))
    // An entry App has not followed, sorted by watch time, which Back from the next move lands on.
    window.history.pushState(
      null,
      '',
      '?window=first365&format=short&sort=-estimatedMinutesWatched',
    )

    const list = holdBoth(api, listRead)
    await click(linkNamed(container, 'Previous page'))
    const drawn = await drawsFirstRowsNote(container, () => act(async () => window.history.back()))
    expect(drawn).toBe(false)
    expect(placesHeld(container)).toEqual({ chart: true, firstRowsNote: false })

    await act(async () => list.release())
    await settle()
  })
})

describe("the video list's placeholder rows after Back (creator-analytics#344)", () => {
  // The fake answers its one video on every page, so a page of 1 row. The page remembers each list
  // answer's rows for as long as it lives, which here is the whole file, so the test reads a route
  // at page size 25 that no other test in the file answers.
  const listRead = 'GET /api/channels/c-1/videos'

  test('back from a video opened from a page of 1 row, holds 1 placeholder row', async () => {
    const api = installFakeApi({ pageSize: 25 })
    const { container } = await render('?window=first90')
    await click(linkNamed(container, fakeVideo.title))

    const list = holdBoth(api, listRead)
    await act(async () => window.history.back())
    const rows = container.querySelector('.video-list-rows')
    expect(rows?.getAttribute('aria-busy')).toBe('true')
    expect(rows?.querySelectorAll('tbody tr')).toHaveLength(1)

    await act(async () => list.release())
    await settle()
  })
})

describe('the bar places a placeholder holds after the same read answered (creator-analytics#510)', () => {
  // The page remembers each answer's bars for as long as it lives, which here is the whole file, so
  // each test reads an address no other test in the file reads.

  test('the publish day top placeholder holds the bars the read answered, back from a video', async () => {
    const api = installFakeApi()
    api.publishDayTop = [
      {
        id: 'top-1',
        title: 'A first day video',
        publishedAt: '2026-10-01T16:00:00.000Z',
        engagedViews: 90,
      },
      {
        id: 'top-2',
        title: 'A second day video',
        publishedAt: '2026-09-30T16:00:00.000Z',
        engagedViews: 40,
      },
    ]
    const { container } = await render('?window=first1&format=short')
    await click(linkNamed(container, fakeVideo.title))

    const list = holdBoth(api, `GET /api/channels/${fakeChannel.id}/videos`)
    await act(async () => window.history.back())
    const placeholder = container.querySelector('.video-detail-section[aria-busy="true"]')
    expect(placeholder?.querySelectorAll('.placeholder-bar-row')).toHaveLength(2)

    await act(async () => list.release())
    await settle()
  })

  test("the Audience placeholder holds the bars each section of the read answered, and an empty section's text place, on the next visit", async () => {
    const api = installFakeApi()
    api.genders = []
    const { container } = await render('audience?window=last90&format=video')
    await click(sidebarLink(container, videosLinkText))

    const audience = holdBoth(api, `GET /api/channels/${fakeChannel.id}/audience`)
    await click(sidebarLink(container, audienceLinkText))
    const cards = [
      ...container.querySelectorAll('.audience-grid[aria-busy="true"] .video-detail-section'),
    ]
    // The fake answers three rows in each section but the genders, and one subscriber split.
    expect(cards.map((card) => card.querySelectorAll('.placeholder-bar-row').length)).toEqual([
      3, 3, 3, 3, 0, 3, 3, 0,
    ])
    expect(cards[4]?.querySelector('.placeholder-audience-empty-text')).not.toBeNull()

    await act(async () => audience.release())
    await settle()
  })
})

/**
 * The button that opens the account menu, found by its name: in the open sidebar's column the
 * account row, the avatar, "Settings" over the email and a chevron, named "Settings, " and the
 * email; collapsed, and in the header, the avatar alone, named "Settings". It throws with none, or
 * with more than one.
 */
function avatarIn(container: HTMLElement): HTMLButtonElement {
  const names = [accountRowLabelOf('nick@example.com'), settingsName]
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')].filter((each) =>
    names.includes(each.getAttribute('aria-label') ?? ''),
  )
  const [avatar] = found
  if (!avatar || found.length > 1) throw new Error(`${found.length} account menu buttons, not 1`)
  return avatar
}

/**
 * The open account menu, found by its role. Its popup is portalled to the document's body, outside
 * the app's container, so it is found in the document. Null with the menu closed.
 */
function accountMenu(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menu"]')
}

function openAccountMenu(): HTMLElement {
  const menu = accountMenu()
  if (!menu) throw new Error('No account menu open')
  return menu
}

/** The open account menu's items, in order. */
function menuItems(): HTMLElement[] {
  return [...openAccountMenu().querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

/** The open account menu's item with this accessible name. */
function menuItemNamed(name: string): HTMLElement {
  const item = menuItems().find((each) => accessibleNameOf(each, true) === name)
  if (!item) throw new Error(`No menu item named ${name}`)
  return item
}

/** Opens the account menu from its avatar, and returns the menu. */
async function openMenuFrom(container: HTMLElement): Promise<HTMLElement> {
  await click(avatarIn(container))
  return openAccountMenu()
}

/** Sends `key` to the focused element, as a keyboard does. */
async function press(key: string): Promise<void> {
  const target = document.activeElement ?? document.body
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
  await settle()
}

/**
 * Sends `key` to the focused button as a keyboard does, with the click whose detail is 0 that a
 * browser activates the button with (on Enter's keydown, on Space's keyup) unless a handler
 * prevents the key. happy-dom activates no button from a key, so this sends that click itself.
 */
async function pressToActivate(key: 'Enter' | ' '): Promise<void> {
  const target = document.activeElement ?? document.body
  await act(async () => {
    const keptDown = target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
    const activate = () =>
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    if (key === 'Enter' && keptDown) activate()
    const keptUp = target.dispatchEvent(
      new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }),
    )
    if (key === ' ' && keptDown && keptUp) activate()
  })
  await settle()
}

describe('the account menu', () => {
  function expectClosedToAvatar(container: HTMLElement) {
    expect(accountMenu()).toBeNull()
    expect(avatarIn(container).getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(avatarIn(container))
  }

  /** Opens the menu from the avatar and puts focus on its Settings item, away from the avatar. */
  async function openedWithFocusInside() {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)
    act(() => menuItemNamed(settingsItem).focus())
    expect(document.activeElement).toBe(menuItemNamed(settingsItem))
    return container
  }

  test('opens from the avatar, a button named Settings, as a menu the avatar says it opened', async () => {
    installFakeApi()
    const { container } = await render()
    const avatar = avatarIn(container)
    expect(avatar.getAttribute('aria-haspopup')).toBe('menu')
    expect(avatar.getAttribute('aria-expanded')).toBe('false')
    expect(accountMenu()).toBeNull()

    await openMenuFrom(container)

    expect(avatar.getAttribute('aria-expanded')).toBe('true')
    expect(accountMenu()).not.toBeNull()
  })

  test('the avatar shows the first letter of the email, not of the name', async () => {
    installFakeApi()
    const { container } = await render()

    expect(avatarIn(container).querySelector('.avatar')?.textContent).toBe('N')
  })

  /** The open menu's items' accessible names, in order. */
  const itemNames = [
    settingsItem,
    'Mid-Roll Manager (opens in a new tab)',
    'Sign out',
    'Version 2026.11.9',
  ]

  test('opens with a header of the avatar letter and the email, a label, not an item, then Settings, a separator, the Theme group, a separator, the free tools, a separator, Sign out and the version', async () => {
    installFakeApi()
    const { container } = await render()

    const menu = await openMenuFrom(container)

    expect([...menu.children].map((each) => each.getAttribute('role'))).toEqual([
      'group',
      'separator',
      'group',
      'separator',
      'group',
      'separator',
      'menuitem',
      'menuitem',
    ])
    expect(menuItems().map((each) => accessibleNameOf(each, true))).toEqual(itemNames)
    const [account, , theme, , tools] = menu.children
    expect(theme).toBe(groupNamed(menu, 'group', themeLabel))
    const header = account?.querySelector(`#${account.getAttribute('aria-labelledby')}`)
    expect({
      header: [...(header?.children ?? [])].map((each) => ({
        avatar: each.matches('.avatar[aria-hidden="true"]'),
        text: each.textContent,
      })),
      items: [...(account?.querySelectorAll('[role="menuitem"]') ?? [])].map((each) =>
        accessibleNameOf(each, true),
      ),
    }).toEqual({
      header: [
        { avatar: true, text: 'N' },
        { avatar: false, text: 'nick@example.com' },
      ],
      items: [settingsItem],
    })
    expect(menuItems().some((each) => each.textContent?.includes('nick@example.com'))).toBe(false)
    expect(tools).toBe(groupNamed(menu, 'group', 'Free tools from the maker of Stillstats'))
    expect(
      [...(tools?.querySelectorAll('[role="menuitem"]') ?? [])].map((each) => each.textContent),
    ).toEqual(['Mid-Roll Manager'])
  })

  test('every item carries an icon hidden from a screen reader, and keeps its name', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)

    expect(
      menuItems().map((each) => [
        accessibleNameOf(each, true),
        each.querySelectorAll('svg').length,
        each.querySelectorAll('svg[aria-hidden="true"]').length,
      ]),
    ).toEqual(itemNames.map((name) => [name, 1, 1]))
  })

  test('links each free tool to its nlvogel.com page, in a new tab', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)

    const links = ['Mid-Roll Manager'].map((name) => {
      const item = menuItemNamed(`${name} (opens in a new tab)`)
      return {
        tag: item.tagName,
        href: item.getAttribute('href'),
        target: item.getAttribute('target'),
        rel: item.getAttribute('rel'),
      }
    })
    expect(links).toEqual([
      {
        tag: 'A',
        href: 'https://nlvogel.com/tools/mid-roll-manager',
        target: '_blank',
        rel: 'noopener',
      },
    ])
  })

  /** The open menu's last item, as a link: its name, where it goes and whether a new tab. */
  function lastItemLink() {
    const item = menuItems().at(-1)
    return {
      tag: item?.tagName,
      name: item && accessibleNameOf(item, true),
      href: item?.getAttribute('href'),
      target: item?.getAttribute('target'),
    }
  }

  test('ends with the version, after Sign out, linked to its release page in the same tab', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)

    expect(lastItemLink()).toEqual({
      tag: 'A',
      name: 'Version 2026.11.9',
      href: '/releases/2026.11.9',
      target: null,
    })
  })

  describe('below 48rem, from the header', () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    test('ends with the version, linked to its release page', async () => {
      installFakeApi()
      const { container } = await render()
      const header = container.querySelector<HTMLElement>('header')
      if (!header) throw new Error('No header')
      await openMenuFrom(header)

      expect(lastItemLink()).toEqual({
        tag: 'A',
        name: 'Version 2026.11.9',
        href: '/releases/2026.11.9',
        target: null,
      })
    })
  })

  test('the version line shows the version alone, on staging and on production', async () => {
    const api = installFakeApi()
    api.clientSettings = { ...api.clientSettings, environment: 'staging' }
    const staging = await render()
    await openMenuFrom(staging.container)
    const onStaging = menuItems().at(-1)?.textContent
    staging.unmount()
    rendered = null

    const production = installFakeApi()
    production.clientSettings = { ...production.clientSettings, environment: 'production' }
    const { container } = await render()
    await openMenuFrom(container)
    const onProduction = menuItems().at(-1)?.textContent

    expect({ onStaging, onProduction }).toEqual({
      onStaging: 'Version 2026.11.9',
      onProduction: 'Version 2026.11.9',
    })
  })

  test('with no version in the build, ends with Sign out', async () => {
    const api = installFakeApi()
    api.clientSettings = { ...api.clientSettings, version: null, releasePath: null }
    const { container } = await render()
    await openMenuFrom(container)

    expect(menuItems().at(-1)?.textContent).toBe('Sign out')
  })

  test('with the client settings unread, ends with Sign out', async () => {
    const api = installFakeApi()
    api.failNext('GET /api/client-settings')
    const { container } = await render()
    await openMenuFrom(container)

    expect(menuItems().at(-1)?.textContent).toBe('Sign out')
  })

  test('choosing the version leaves the link to the browser and sends no event', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)
    vi.mocked(track).mockClear()
    // happy-dom follows a link no handler prevented, so the test prevents it, after recording
    // whether the app left the default to the browser, as the tool link test does.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)

    try {
      await click(menuItemNamed('Version 2026.11.9'))
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(leftToTheBrowser).toBe(true)
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test('the arrow keys move focus between the items, the Theme items among them, past the header, the group labels and the separators', async () => {
    await openedWithFocusInside()

    const reached = []
    for (let step = 0; step < 5; step++) {
      await press('ArrowDown')
      reached.push(accessibleNameOf(document.activeElement as Element, true))
    }
    await press('ArrowUp')
    reached.push(accessibleNameOf(document.activeElement as Element, true))

    expect(reached).toEqual([
      ...themeOptions.map(({ label }) => label),
      'Mid-Roll Manager (opens in a new tab)',
      'Sign out',
      'Mid-Roll Manager (opens in a new tab)',
    ])
  })

  test.each([
    { key: 'ArrowDown', name: 'ArrowDown', clicksOn: null },
    { key: 'Enter', name: 'Enter', clicksOn: 'keydown' },
    { key: ' ', name: 'Space', clicksOn: 'keyup' },
  ] as const)(
    'opens from the focused avatar on $name with focus on Settings, and the arrow keys reach Sign out',
    async ({ key, clicksOn }) => {
      installFakeApi()
      const { container } = await render()
      const avatar = avatarIn(container)
      act(() => avatar.focus())

      // A browser sends a focused button's keys to it, and activates it with a click whose
      // detail is 0 (on Enter's keydown, on Space's keyup) unless a handler prevents the key.
      await act(async () => {
        const keptDown = avatar.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        )
        const activate = () =>
          avatar.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }),
          )
        if (clicksOn === 'keydown' && keptDown) activate()
        const keptUp = avatar.dispatchEvent(
          new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }),
        )
        if (clicksOn === 'keyup' && keptDown && keptUp) activate()
      })
      await settle()

      expect(accountMenu()).not.toBeNull()
      expect(document.activeElement).toBe(menuItemNamed(settingsItem))
      // Past the three Theme items and the one free tool.
      for (let step = 0; step < 5; step++) await press('ArrowDown')
      expect(document.activeElement).toBe(menuItemNamed('Sign out'))
    },
  )

  test('closes on Escape, and focus goes back to the avatar', async () => {
    const container = await openedWithFocusInside()

    await press('Escape')

    expectClosedToAvatar(container)
  })

  test('closes on a press on nothing outside it, and focus goes back to the avatar', async () => {
    const container = await openedWithFocusInside()

    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      // A browser takes focus off the item when the press lands on nothing focusable; happy-dom
      // moves no focus on a press, so the test does.
      ;(document.activeElement as HTMLElement | null)?.blur()
      document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    await settle()

    expectClosedToAvatar(container)
  })

  test('closes on a press on another control outside it, and focus stays on that control', async () => {
    const container = await openedWithFocusInside()
    const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
    if (!wordmark) throw new Error('No wordmark')
    // The press would follow the wordmark's link; this test is about the menu, so it stays put.
    wordmark.addEventListener('click', (event) => event.preventDefault())

    await act(async () => {
      wordmark.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      wordmark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      // A browser gives the pressed control focus; happy-dom moves no focus on a press, so the test
      // does.
      wordmark.focus()
      wordmark.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      wordmark.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      wordmark.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      )
    })
    await settle()

    expect(accountMenu()).toBeNull()
    expect(avatarIn(container).getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wordmark)
  })

  test('Settings on another screen opens Settings, with focus on its heading "Settings"', async () => {
    installFakeApi()
    const { container, address } = await render()
    await openMenuFrom(container)

    await click(menuItemNamed('Settings'))

    expect(accountMenu()).toBeNull()
    expect(address()).toBe('settings')
    const heading = container.querySelector('h1:focus')
    expect(heading?.textContent).toBe('Settings')
    expect(document.activeElement).toBe(heading)
  })

  test('Settings on the Settings screen closes the menu, with focus back on the avatar and no new history entry', async () => {
    installFakeApi()
    const { container, address } = await render('settings')
    await openMenuFrom(container)
    act(() => menuItemNamed(settingsItem).focus())
    const entries = window.history.length

    await click(menuItemNamed(settingsItem))

    expectClosedToAvatar(container)
    expect(address()).toBe('settings')
    expect(window.history.length).toBe(entries)
  })

  test.each([{ modifier: 'metaKey' }, { modifier: 'ctrlKey' }] as const)(
    'a $modifier click on Settings leaves the menu open and the page where it is, and leaves the click to the browser',
    async ({ modifier }) => {
      installFakeApi()
      const { container, address } = await render()
      await openMenuFrom(container)

      const leftToTheBrowser = await modifiedClick(menuItemNamed(settingsItem), modifier)

      expect(address()).toBe('')
      expect(accountMenu()).not.toBeNull()
      expect(leftToTheBrowser).toBe(true)
    },
  )

  test('Settings on the Settings screen closes the menu and scrolls to the top, without navigating', async () => {
    const api = installFakeApi()
    const { container } = await render('settings')
    await openMenuFrom(container)
    const replace = vi.spyOn(window.history, 'replaceState')
    const push = vi.spyOn(window.history, 'pushState')
    const scroll = vi.spyOn(window, 'scrollTo')
    const requests = api.requests.length

    try {
      await click(menuItemNamed(settingsItem))

      expect(accountMenu()).toBeNull()
      expect(api.requests.length).toBe(requests)
      expect(push).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(scroll).toHaveBeenCalledWith(0, 0)
    } finally {
      replace.mockRestore()
      push.mockRestore()
      scroll.mockRestore()
    }
  })

  test("closes on a free tool's link, after it sends tool_link_clicked, and focus goes back to the avatar, and leaves the click to the browser", async () => {
    const container = await openedWithFocusInside()
    // happy-dom follows a link no handler prevented, and would load the tool's page, so the test
    // prevents it. React listens on the menu portal's container, below the document, so the app
    // has handled the click by the time this listener sees it, and it first records whether the
    // app left the default to the browser.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)

    try {
      await click(menuItemNamed('Mid-Roll Manager (opens in a new tab)'))
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(vi.mocked(track)).toHaveBeenCalledWith({
      name: 'tool_link_clicked',
      tool: 'mid-roll-manager',
      source: 'account-menu',
    })
    expectClosedToAvatar(container)
    expect(leftToTheBrowser).toBe(true)
  })

  test('closes on a Sign out that fails, with focus back on the avatar of the signed-in screen it keeps', async () => {
    const api = installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)
    act(() => menuItemNamed('Sign out').focus())
    api.failNext('POST /api/auth/sign-out')

    await click(menuItemNamed('Sign out'))

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )
    expectClosedToAvatar(container)
  })

  test('Sign out signs out, and the signed-out screen shows', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)

    await click(menuItemNamed('Sign out'))

    expect(buttonNamed(container, 'Sign in with Google')).toBeTruthy()
    expect(accountMenu()).toBeNull()
  })
})

/** The open account menu's radio items, in order. */
function menuRadios(): HTMLElement[] {
  return [...openAccountMenu().querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
}

/** The names of the open account menu's checked radio items. */
function checkedInMenu(): string[] {
  return menuRadios()
    .filter((each) => each.getAttribute('aria-checked') === 'true')
    .map((each) => accessibleNameOf(each, true))
}

/** The open account menu's radio item with this accessible name. */
function menuRadioNamed(name: string): HTMLElement {
  const item = menuRadios().find((each) => accessibleNameOf(each, true) === name)
  if (!item) throw new Error(`No menu radio item named ${name}`)
  return item
}

// The theme from the account menu (creator-analytics#692). As for Settings' control, these tests
// read the root's `data-theme` and the browser's copy, not the tokens drawn; the browser walk
// checks that the page changes at once in Chrome.
describe('the Theme items in the account menu (creator-analytics#692)', () => {
  const themeNames = themeOptions.map(({ label }) => label)

  test.each([
    { saved: {}, checked: 'System' },
    { saved: { theme: 'dark' }, checked: 'Dark' },
    { saved: { theme: 'light' }, checked: 'Light' },
  ] as const)(
    'is a group named Theme of three radio items, $checked checked, the same choice Settings shows',
    async ({ saved, checked }) => {
      installFakeApi(saved)
      const { container } = await render('settings')
      const menu = await openMenuFrom(container)

      const group = groupNamed(menu, 'group', themeLabel)
      expect(
        [...group.querySelectorAll('[role="menuitemradio"]')].map((each) =>
          accessibleNameOf(each, true),
        ),
      ).toEqual(themeNames)
      expect(menuRadios().map((each) => accessibleNameOf(each, true))).toEqual(themeNames)
      expect(checkedInMenu()).toEqual([checked])
      expect(checkedTheme(container)).toEqual([checked])
    },
  )

  test('choosing Dark applies it at once, before its save lands, then saves it, with no toast and no event, and Settings then checks Dark', async () => {
    const api = installFakeApi()
    const { container, address } = await render()
    await openMenuFrom(container)
    vi.mocked(track).mockClear()

    const save = api.hold(savePreferences)
    await click(menuRadioNamed('Dark'))

    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
    expect(checkedInMenu()).toEqual(['Dark'])
    expect(accountMenu()).not.toBeNull()

    await act(async () => save.release())
    await settle()

    expect(savesOf(api)).toEqual([{ theme: 'dark' }])
    expect(api.preferences).toEqual({ theme: 'dark' })
    expect(toastText()).toBeNull()
    expect(vi.mocked(track)).not.toHaveBeenCalled()

    await click(menuItemNamed(settingsItem))

    expect(address()).toBe('settings')
    expect(checkedTheme(container)).toEqual(['Dark'])
  })

  test('choosing System removes the attribute and the copy', async () => {
    const api = installFakeApi({ theme: 'dark' })
    const { container } = await render()
    await openMenuFrom(container)
    expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })

    await click(menuRadioNamed('System'))

    expect(pageTheme()).toEqual({ attribute: null, copy: null })
    expect(api.preferences).toEqual({ theme: 'system' })
  })

  test('a failed save puts the attribute, the copy and the checked item back, and says so as Settings does', async () => {
    const api = installFakeApi({ theme: 'light' })
    const { container } = await render()
    await openMenuFrom(container)

    api.failNext(savePreferences)
    await click(menuRadioNamed('Dark'))

    expect(pageTheme()).toEqual({ attribute: 'light', copy: 'light' })
    expect(checkedInMenu()).toEqual(['Light'])
    expect(toastText()).toBe(failedSaveNotice)
  })

  test('choosing the checked item sends no save', async () => {
    const api = installFakeApi({ theme: 'dark' })
    const { container } = await render()
    await openMenuFrom(container)
    const requests = api.requests.length

    await click(menuRadioNamed('Dark'))

    expect(api.requests.length).toBe(requests)
    expect(savesOf(api)).toEqual([])
    expect(checkedInMenu()).toEqual(['Dark'])
  })

  test('each radio item leads with an icon hidden from a screen reader, the checked one ends with a hidden check, and each keeps its name', async () => {
    installFakeApi({ theme: 'dark' })
    const { container } = await render()
    await openMenuFrom(container)

    expect(
      menuRadios().map((each) => [
        accessibleNameOf(each, true),
        each.querySelectorAll('svg').length,
        each.querySelectorAll('svg[aria-hidden="true"]').length,
        each.firstElementChild?.matches('svg[aria-hidden="true"]'),
      ]),
    ).toEqual([
      ['Light', 1, 1, true],
      ['Dark', 2, 2, true],
      ['System', 1, 1, true],
    ])
  })

  describe('below 48rem, from the header', () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    test('the group is there, System checked, and choosing Dark applies and saves it', async () => {
      const api = installFakeApi()
      const { container } = await render()
      const header = container.querySelector<HTMLElement>('header')
      if (!header) throw new Error('No header')
      const menu = await openMenuFrom(header)

      expect(groupNamed(menu, 'group', themeLabel)).toBeTruthy()
      expect(checkedInMenu()).toEqual(['System'])

      await click(menuRadioNamed('Dark'))

      expect(pageTheme()).toEqual({ attribute: 'dark', copy: 'dark' })
      expect(checkedInMenu()).toEqual(['Dark'])
      expect(savesOf(api)).toEqual([{ theme: 'dark' }])
    })
  })
})

/**
 * The open custom range Popover, found by its role and name. Its popup is portalled to the
 * document's body, as the account menu is, so it is found in the document. Null with it closed.
 */
function rangePopover(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[role="dialog"][aria-label="${customRangeText.option}"]`,
  )
}

/**
 * The Calendar's button for `day`, found by its accessible name, the day's long date in the
 * browser's locale, in the Popover. Null with no such day on view.
 */
function dayButtonOrNull(day: string): HTMLButtonElement | null {
  const name = longDateOf(day)
  return (
    [...(rangePopover()?.querySelectorAll<HTMLButtonElement>('[role="grid"] button') ?? [])].find(
      (each) => each.getAttribute('aria-label') === name,
    ) ?? null
  )
}

function dayButton(day: string): HTMLButtonElement {
  const button = dayButtonOrNull(day)
  if (!button) throw new Error(`No Calendar day ${day} on view`)
  return button
}

/** Taps `day` on the Calendar, as a person does. */
async function pickDay(day: string): Promise<void> {
  await click(dayButton(day))
}

/**
 * The range the Calendar shows, from its gridcells marked selected, apart from the hidden cells
 * a month keeps for the days of the months beside it: the first is the start, and the last is the
 * end once the range has one, which the end's button marks.
 */
function rangeDaysIn(): { from: string; to: string } {
  const popover = rangePopover()
  if (!popover) throw new Error('No custom range Popover')
  const selected = [
    ...popover.querySelectorAll('[role="gridcell"][aria-selected="true"]:not([data-hidden])'),
  ].map((cell) => cell.getAttribute('data-day') ?? '')
  const ended = !!popover.querySelector('button[data-range-end="true"]')
  return { from: selected[0] ?? '', to: ended ? (selected.at(-1) ?? '') : '' }
}

/** Presses the custom range's Apply in its Popover, as a person does. */
async function applyRange(): Promise<void> {
  await click(buttonNamed(document.body, customRangeText.apply))
}

/** The custom range's error: the alert in its Popover, or null with no Popover or no alert. */
function rangeErrorIn(): string | null {
  return rangePopover()?.querySelector('[role="alert"]')?.textContent ?? null
}

describe('a custom range Calendar opened before the list answers', () => {
  /**
   * Renders the channel screen with its list reads held, so no bounds have landed, picks "Custom
   * range", optionally taps a day on the Calendar, then lets the list answer. The screen reads the
   * list three times before it settles.
   */
  async function pickedBeforeTheList(): Promise<void> {
    const api = installFakeApi()
    const held = [api.hold(listRoute), api.hold(listRoute), api.hold(listRoute)]
    const { container } = await render()
    await choose(container, 'Date range', 'custom')
    expect(rangeDaysIn()).toEqual({ from: '', to: '' })
    for (const read of held) read.release()
    await settle()
  }

  test("Custom range picked while the list reads shows the window's days once the list answers", async () => {
    await pickedBeforeTheList()

    expect(rangeDaysIn()).toEqual(prefillOf(defaultRoute, fakeBounds))
    expect(rangeDaysIn()).toEqual({ from: '2026-09-07', to: '2026-10-04' })
  })

  test('a day picked on a custom range while the list reads stays picked once the list answers', async () => {
    const api = installFakeApi()
    const held = [api.hold(listRoute), api.hold(listRoute), api.hold(listRoute)]
    const { container } = await render('?window=custom&from=2026-09-01&to=2026-09-30')
    await choose(container, 'Date range', 'custom')
    expect(rangeDaysIn()).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    await pickDay('2026-09-15')
    for (const read of held) read.release()
    await settle()

    expect(rangeDaysIn()).toEqual({ from: '2026-09-15', to: '' })
    expect(dayButton('2026-09-15').disabled).toBe(false)
  })

  test('once the list answers, the days after the last processed day are disabled', async () => {
    await pickedBeforeTheList()

    expect(dayButton('2026-10-05').disabled).toBe(true)
    expect(dayButton('2026-10-04').disabled).toBe(false)
  })
})

describe('a channel switch with a custom range open', () => {
  test('picking another channel drops the day picked and the error Apply answered on the first', async () => {
    installFakeApi()
    // A second channel, answered as the first is but with an earlier creation day of its own.
    const secondChannel: ListedChannel = { ...fakeChannel, id: 'c-2', title: 'Second channel' }
    const inner = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, 'http://localhost')
      if ((init.method ?? 'GET') === 'GET' && url.pathname === '/api/channels') {
        const channels = [fakeChannel, secondChannel]
        return { ok: true, status: 200, json: async () => ({ channels }) } as Response
      }
      if (url.pathname.startsWith(`/api/channels/${secondChannel.id}/`)) {
        const path = url.pathname.replace(`/${secondChannel.id}/`, `/${fakeChannel.id}/`)
        const response = await inner(`${path}${url.search}`, init)
        const answer = { ...(await response.json()), creationDay: '2018-01-01' }
        return { ok: response.ok, status: response.status, json: async () => answer } as Response
      }
      return inner(input, init)
    })
    const shown = await render()
    const { container } = shown
    await choose(container, 'Date range', 'custom')
    await pickDay('2026-09-15')
    await applyRange()
    expect(rangeErrorIn()).toBe(customRangeText.emptyField)

    await pickInSidebar(container, 'Second channel')

    expect(shown.address()).toContain(`channel=${secondChannel.id}`)
    expect(rangeErrorIn()).toBeNull()
    expect(rangePopover()).toBeNull()
  })
})

describe('a custom range applied', () => {
  test('two days picked and Apply put the range in the address and send video_window_changed with its days only', async () => {
    installFakeApi()
    const shown = await render()
    const { container } = shown
    await choose(container, 'Date range', 'custom')
    await pickDay('2026-09-01')
    await pickDay('2026-10-01')
    vi.mocked(track).mockClear()

    await applyRange()

    expect(rangeErrorIn()).toBeNull()
    expect(shown.address()).toContain('window=custom&from=2026-09-01&to=2026-10-01')
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'video_window_changed', window: 'custom', days: 31 }],
    ])
  })

  test('one day picked and Apply ask for both days, and the Popover stays open', async () => {
    installFakeApi()
    const shown = await render()
    const { container } = shown
    await choose(container, 'Date range', 'custom')
    await pickDay('2026-09-15')
    vi.mocked(track).mockClear()

    await applyRange()

    expect(rangeErrorIn()).toBe('Pick a start day and an end day.')
    expect(rangePopover()).not.toBeNull()
    expect(shown.address()).not.toContain('window=custom')
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })
})

/** The compact button beside the select on a custom range, found by its accessible name. */
function compactRangeButtonIn(container: HTMLElement): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll<HTMLButtonElement>('button')].find((each) =>
      each.getAttribute('aria-label')?.startsWith(`${customRangeText.option}, `),
    ) ?? null
  )
}

describe('the custom range Popover', () => {
  /** Picks "Custom range" with focus on the select, as a person who picks in it does. */
  async function pickedFromTheSelect(container: HTMLElement): Promise<HTMLSelectElement> {
    const select = selectNamed(container, 'Date range')
    act(() => select.focus())
    await choose(container, 'Date range', 'custom')
    return select
  }

  test('picking "Custom range" opens it, with focus on a day of the Calendar, and no Calendar in the bar', async () => {
    installFakeApi()
    const { container } = await render()

    await pickedFromTheSelect(container)

    expect(rangePopover()).not.toBeNull()
    expect(document.activeElement?.closest('[role="grid"]')).not.toBeNull()
    expect(rangePopover()?.contains(document.activeElement)).toBe(true)
    expect(container.querySelector('.controls-bar [role="grid"]')).toBeNull()
  })

  test.each([
    { key: 'Enter', name: 'Enter' },
    { key: ' ', name: 'Space' },
  ] as const)(
    'ArrowRight moves focus to the next day, and $name on it picks it',
    async ({ key }) => {
      installFakeApi()
      const { container } = await render()
      await pickedFromTheSelect(container)
      const focused = document.activeElement as HTMLButtonElement
      const next = dayButton('2026-09-08')
      expect(focused).toBe(dayButton('2026-09-07'))

      await press('ArrowRight')
      expect(document.activeElement).toBe(next)

      await pressToActivate(key)
      expect(rangeDaysIn()).toEqual({ from: '2026-09-08', to: '' })
    },
  )

  test('shows two months at the desktop width', async () => {
    installFakeApi()
    const { container } = await render()
    await pickedFromTheSelect(container)

    expect(rangePopover()?.querySelectorAll('[role="grid"]')).toHaveLength(2)
  })

  describe('below 40rem', () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    test('shows one month, the one the range ends in', async () => {
      installFakeApi()
      const { container } = await render()
      await pickedFromTheSelect(container)

      expect(rangePopover()?.querySelectorAll('[role="grid"]')).toHaveLength(1)
      expect(dayButtonOrNull('2026-10-04')).not.toBeNull()
      expect(dayButtonOrNull('2026-09-07')).toBeNull()
    })
  })

  test('Escape closes it without applying, the select shows the window before, and focus is back on the select', async () => {
    installFakeApi()
    const shown = await render()
    const { container } = shown
    const select = await pickedFromTheSelect(container)
    await pickDay('2026-09-01')
    vi.mocked(track).mockClear()

    await press('Escape')

    expect(rangePopover()).toBeNull()
    expect(select.value).toBe('last28')
    expect(document.activeElement).toBe(select)
    expect(shown.address()).not.toContain('window=custom')
    expect(compactRangeButtonIn(container)).toBeNull()
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test('Apply closes it, and the bar shows "Custom range" and the compact button naming the range', async () => {
    installFakeApi()
    const { container } = await render()
    await pickedFromTheSelect(container)
    await pickDay('2026-09-01')
    await pickDay('2026-10-01')

    await applyRange()

    expect(rangePopover()).toBeNull()
    expect(selectNamed(container, 'Date range').value).toBe('custom')
    const compact = compactRangeButtonIn(container)
    expect(compact?.getAttribute('aria-label')).toMatch(/^Custom range, .+ to .+2026$/)
    expect(compact?.textContent).toMatch(/ to /)
  })

  test('the compact button reopens it on the applied range, and closing it puts focus back on the button', async () => {
    installFakeApi()
    const { container } = await render()
    await pickedFromTheSelect(container)
    await pickDay('2026-09-01')
    await pickDay('2026-10-01')
    await applyRange()
    const compact = compactRangeButtonIn(container)
    if (!compact) throw new Error('No compact range button')
    vi.mocked(track).mockClear()

    act(() => compact.focus())
    await click(compact)

    expect(rangePopover()).not.toBeNull()
    expect(compact.getAttribute('aria-expanded')).toBe('true')
    expect(rangeDaysIn()).toEqual({ from: '2026-09-01', to: '2026-10-01' })

    await press('Escape')

    expect(rangePopover()).toBeNull()
    expect(document.activeElement).toBe(compact)
    expect(selectNamed(container, 'Date range').value).toBe('custom')
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test.each([
    ['the Audience screen', 'audience'],
    ["a video's page", 'videos/video-1'],
  ])('on %s, the same Calendar opens and Apply moves to the range', async (_screen, address) => {
    installFakeApi()
    const shown = await render(address)
    await pickedFromTheSelect(shown.container)

    expect(rangePopover()?.querySelectorAll('[role="grid"]')).toHaveLength(2)
    await pickDay('2026-09-01')
    await pickDay('2026-10-01')
    await applyRange()

    expect(shown.address()).toContain('window=custom&from=2026-09-01&to=2026-10-01')
  })
})

/** The sidebar, or null with none in the page. */
function sidebarIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.sidebar')
}

/** The sidebar's nav, which holds its links, or null with no sidebar in the page. */
function sidebarNavIn(container: HTMLElement): HTMLElement | null {
  return (
    sidebarIn(container)?.querySelector<HTMLElement>(`nav[aria-label="${sidebarLabel}"]`) ?? null
  )
}

function sidebarLink(container: HTMLElement, name: string): HTMLAnchorElement {
  const sidebar = sidebarIn(container)
  if (!sidebar) throw new Error('No sidebar')
  return linkNamed(sidebar, name)
}

/** The text of each sidebar link marked as the current page. */
function currentSidebarLinks(container: HTMLElement): (string | null)[] {
  return [...(sidebarIn(container)?.querySelectorAll('a[aria-current="page"]') ?? [])].map(
    (each) => each.textContent,
  )
}

/** The accessible name of each `nav` in the page, from `aria-label` or `aria-labelledby`. */
function navNamesIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll('nav')].map((nav) => {
    const labelledBy = nav.getAttribute('aria-labelledby')
    const name = labelledBy
      ? labelledBy
          .split(' ')
          .map((id) => container.ownerDocument.getElementById(id)?.textContent ?? '')
          .join(' ')
      : (nav.getAttribute('aria-label') ?? '')
    return name.trim()
  })
}

/** The sidebar's toggle, the one button in it named for collapsing or expanding it, or null. */
function sidebarToggleOrNullIn(container: HTMLElement): HTMLButtonElement | null {
  const names = [collapseSidebarLabel, expandSidebarLabel]
  return (
    [...(sidebarIn(container)?.querySelectorAll('button') ?? [])].find((each) =>
      names.includes(accessibleNameOf(each, true)),
    ) ?? null
  )
}

function sidebarToggleIn(container: HTMLElement): HTMLButtonElement {
  const toggle = sidebarToggleOrNullIn(container)
  if (!toggle) throw new Error('No toggle in the sidebar')
  return toggle
}

/** The sidebar's open state, as its toggle names it and app.css reads it. */
function sidebarStateIn(container: HTMLElement) {
  return {
    button: accessibleNameOf(sidebarToggleIn(container), true),
    state: sidebarIn(container)?.getAttribute('data-state'),
  }
}

const sidebarOpen = { button: collapseSidebarLabel, state: 'expanded' }
const sidebarCollapsed = { button: expandSidebarLabel, state: 'collapsed' }

/** The bodies of the preference saves made since request number `before`. */
function savesSince(api: FakeApi, before: number): unknown[] {
  return api.requests
    .slice(before)
    .filter(({ method, path }) => `${method} ${path}` === savePreferences)
    .map(({ body }) => body)
}

// happy-dom answers matchMedia from its viewport, 1024px wide unless a test sets it, so these tests
// render the sidebar as the column it is from 48rem, and the ones at 375px the header's Menu, which
// holds the sidebar's items below it (creator-analytics#891). It applies no stylesheet, so they
// cannot see that the collapsed column hides the text of its links and buttons, where the column
// sits, the tooltips, or that the Menu's button shares one row with the header's other items and
// its panel sits under the header; the built CSS tests in web.test.ts read those rules, and the
// browser walk collapses the sidebar, focuses each collapsed icon and opens the Menu in Chrome.
/** The sidebar's "Thumbnail preview" item's accessible name (creator-analytics#799). */
const thumbnailPreviewLabel = 'Thumbnail preview (opens in a new tab)'

describe('collapsing the sidebar', () => {
  test('is open with nothing saved, and its button is named for the change a press makes in each state', async () => {
    installFakeApi()
    const { container } = await render()
    expect(sidebarStateIn(container)).toEqual(sidebarOpen)

    await click(sidebarToggleIn(container))
    expect(sidebarStateIn(container)).toEqual(sidebarCollapsed)

    await click(sidebarToggleIn(container))
    expect(sidebarStateIn(container)).toEqual(sidebarOpen)
  })

  test('collapsing saves the preference, and a reload opens the sidebar collapsed', async () => {
    const api = installFakeApi()
    const first = await render()
    const before = api.requests.length

    await click(sidebarToggleIn(first.container))
    expect(savesSince(api, before)).toEqual([{ sidebarOpen: false }])
    first.unmount()
    const reloaded = await render()

    expect(sidebarStateIn(reloaded.container)).toEqual(sidebarCollapsed)
  })

  test('"Reset preferences" opens a collapsed sidebar again', async () => {
    installFakeApi({ sidebarOpen: false })
    const { container } = await render('settings')
    // It opens only after it was collapsed.
    expect(sidebarStateIn(container)).toEqual(sidebarCollapsed)

    await click(buttonNamed(container, 'Reset preferences'))

    expect(sidebarStateIn(container)).toEqual(sidebarOpen)
  })

  test.each([
    ['Ctrl+B', 'ctrlKey'],
    ['Cmd+B', 'metaKey'],
  ] as const)('%s changes nothing, on the page or on a focused link', async (_keys, modifier) => {
    const api = installFakeApi()
    const { container } = await render()
    const link = sidebarLink(container, videosLinkText)
    link.focus()
    const before = api.requests.length

    for (const target of [document, link]) {
      await act(async () => {
        target.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'b',
            bubbles: true,
            cancelable: true,
            [modifier]: true,
          }),
        )
      })
      await settle()
    }

    expect(sidebarStateIn(container)).toEqual(sidebarOpen)
    expect(api.requests.slice(before)).toEqual([])
  })

  test.each([
    ['open', {}],
    ['collapsed', { sidebarOpen: false }],
  ])(
    '%s, the nav keeps its name, each link its text as its name, the "Thumbnail preview" item last, and the current link aria-current="page"',
    async (_state, saved) => {
      installFakeApi(saved)
      const { container } = await render('audience')

      expect(navNamesIn(container)).toContain(sidebarLabel)
      expect(
        [...(sidebarNavIn(container)?.querySelectorAll('a') ?? [])].map((each) => each.textContent),
      ).toEqual([
        videosLinkText,
        audienceLinkText,
        retentionLinkText,
        whatsNewLinkText,
        'Thumbnail preview',
      ])
      expect(currentSidebarLinks(container)).toEqual([audienceLinkText])
    },
  )

  test('collapsed, the "Thumbnail preview" item stays in the nav, keeps its name and still opens the tool page in a new tab (creator-analytics#799, creator-analytics#890)', async () => {
    installFakeApi({ sidebarOpen: false })
    const { container } = await render()
    const nav = sidebarNavIn(container)
    if (!nav) throw new Error('No nav in the sidebar')
    const link = linkLabelled(nav, thumbnailPreviewLabel)

    expect([
      accessibleNameOf(link, true),
      link.getAttribute('href'),
      link.getAttribute('target'),
    ]).toEqual([thumbnailPreviewLabel, '/tools/thumbnail-preview', '_blank'])
  })
})

const anotherChannel: ListedChannel = { ...fakeChannel, id: 'c-2', title: 'Second channel' }
const sidebarSupportLink = 'https://buy.stripe.com/test_00g3cd?client_reference_id=user-1'

/** Whether each element comes after the one before it in the document. */
function inDocumentOrder(elements: Element[]): boolean {
  return elements.every((each, index) => {
    const before = elements[index - 1]
    return (
      !before || Boolean(before.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_FOLLOWING)
    )
  })
}

describe('the sidebar from 48rem (creator-analytics#476)', () => {
  test('holds the wordmark, the three links and the "Thumbnail preview" item, and in its footer the "Send feedback" item, the support item, the channel picker, the account menu and the collapse button, in that order (creator-analytics#890)', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    api.support = { link: sidebarSupportLink, prompt: true }
    const { container } = await render()
    const sidebar = sidebarIn(container)
    if (!sidebar) throw new Error('No sidebar')
    const wordmark = sidebar.querySelector('a.wordmark')
    const footer = sidebar.querySelector('[data-slot="sidebar-footer"]')
    if (!wordmark || !footer) throw new Error('No wordmark or no footer in the sidebar')

    const nav = sidebarNavIn(container)
    if (!nav) throw new Error('No nav in the sidebar')
    const footerParts = [
      linkNamed(footer as HTMLElement, sendFeedbackText),
      linkNamed(footer as HTMLElement, supportHeading),
      sidebarPickerIn(footer as HTMLElement),
      buttonLabelled(footer as HTMLElement, accountRowLabelOf('nick@example.com')),
      sidebarToggleIn(container),
    ]
    expect(footerParts.every((part) => footer.contains(part))).toBe(true)
    expect(footer.querySelector(`a[aria-label="${thumbnailPreviewLabel}"]`)).toBeNull()
    expect(
      inDocumentOrder([
        wordmark,
        sidebarLink(container, videosLinkText),
        sidebarLink(container, audienceLinkText),
        sidebarLink(container, retentionLinkText),
        sidebarLink(container, whatsNewLinkText),
        linkLabelled(nav, thumbnailPreviewLabel),
        footer,
        ...footerParts,
      ]),
    ).toBe(true)
  })

  test('the nav\'s "Thumbnail preview" item opens the tool page in a new tab, named so, and a click sends tool_link_clicked from the sidebar and leaves the click to the browser (creator-analytics#799, creator-analytics#890)', async () => {
    installFakeApi()
    const { container } = await render()
    const nav = sidebarNavIn(container)
    if (!nav) throw new Error('No nav in the sidebar')
    const link = linkLabelled(nav, thumbnailPreviewLabel)

    expect({
      text: link.textContent,
      href: link.getAttribute('href'),
      target: link.getAttribute('target'),
      rel: link.getAttribute('rel'),
      name: accessibleNameOf(link, true),
    }).toEqual({
      text: 'Thumbnail preview',
      href: '/tools/thumbnail-preview',
      target: '_blank',
      rel: 'noopener',
      name: thumbnailPreviewLabel,
    })

    // happy-dom follows a link no handler prevented, so the test prevents it, after it records
    // whether the app, which React listens for below the document, left the default to the browser.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)
    try {
      await click(link)
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(vi.mocked(track)).toHaveBeenCalledWith({
      name: 'tool_link_clicked',
      tool: 'thumbnail-preview',
      source: 'sidebar',
    })
    expect(leftToTheBrowser).toBe(true)
  })

  test.each([
    ['the channel screen', ''],
    ['the Audience screen', 'audience'],
    ['"What\'s new"', 'whats-new'],
    ['Settings', 'settings'],
    ['the feedback form', 'feedback'],
  ])(
    'on %s, the "Thumbnail preview" item is never the current page (creator-analytics#890)',
    async (_screen, address) => {
      installFakeApi()
      const { container } = await render(address)
      const nav = sidebarNavIn(container)
      if (!nav) throw new Error('No nav in the sidebar')

      expect(linkLabelled(nav, thumbnailPreviewLabel).hasAttribute('aria-current')).toBe(false)
      expect(currentSidebarLinks(container)).not.toContain('Thumbnail preview')
    },
  )

  test('shows no header beside it', async () => {
    installFakeApi()
    const { container } = await render()

    expect(sidebarIn(container)).not.toBeNull()
    expect(container.querySelector('header')).toBeNull()
  })

  test('a creator with no channel has no sidebar, and keeps the header with its wordmark and avatar', async () => {
    const api = installFakeApi()
    api.channels = []
    const { container } = await render()
    const header = container.querySelector<HTMLElement>('header')
    if (!header) throw new Error('No header')

    expect(sidebarIn(container)).toBeNull()
    expect(header.querySelector('a.wordmark')).not.toBeNull()
    expect(buttonLabelled(header, settingsName)).toBeTruthy()
  })

  // 38rem is 608px at happy-dom's 16px root (sidebar-column.ts).
  test("a window too short for the column's rows keeps the header, with its Menu, and no sidebar (creator-analytics#891)", async () => {
    setViewport({ width: 1024, height: 607 })
    try {
      const api = installFakeApi()
      api.channels = [fakeChannel, anotherChannel]
      const { container } = await render()
      const header = container.querySelector<HTMLElement>('header')
      if (!header) throw new Error('No header')

      expect(header.querySelector('a.wordmark')).not.toBeNull()
      expect(buttonLabelled(header, settingsName)).toBeTruthy()
      expect(menuStateIn(container)).toEqual(menuClosed)
      expect(sidebarIn(container)).toBeNull()
    } finally {
      setViewport({ width: 1024, height: 768 })
    }
  })

  test("a window as tall as the column's rows need shows the column, and no header", async () => {
    setViewport({ width: 1024, height: 608 })
    try {
      const api = installFakeApi()
      api.channels = [fakeChannel, anotherChannel]
      api.support = { link: sidebarSupportLink, prompt: true }
      const { container } = await render()

      expect(container.querySelector('header')).toBeNull()
      expect(sidebarToggleIn(container)).toBeTruthy()
    } finally {
      setViewport({ width: 1024, height: 768 })
    }
  })

  test('the support item hides with an x of no visible text, named for what it hides', async () => {
    const api = installFakeApi()
    api.support = { link: sidebarSupportLink, prompt: true }
    const { container } = await render()
    const sidebar = sidebarIn(container)
    if (!sidebar) throw new Error('No sidebar')

    const hide = buttonLabelled(sidebar, hideSupportLabel)
    expect(hide.textContent).toBe('')
    expect(hide.type).toBe('button')
  })

  test('collapsed, the support link keeps its name and no x shows', async () => {
    const api = installFakeApi({ sidebarOpen: false })
    api.support = { link: sidebarSupportLink, prompt: true }
    const { container } = await render()
    const sidebar = sidebarIn(container)
    if (!sidebar) throw new Error('No sidebar')

    expect(linkNamed(sidebar, supportHeading).getAttribute('href')).toBe(sidebarSupportLink)
    expect(
      [...sidebar.querySelectorAll('button')].filter(
        (each) => each.getAttribute('aria-label') === hideSupportLabel,
      ),
    ).toEqual([])
  })

  test('collapsed, the channel icon stands for the picker; a click on it opens the sidebar, saves that, and moves focus to the picker', async () => {
    const api = installFakeApi({ sidebarOpen: false })
    api.channels = [fakeChannel, anotherChannel]
    const { container } = await render()
    expect(sidebarPickersIn(container)).toEqual([])
    const before = api.requests.length

    await click(buttonNamed(container, channelIconLabelOf(fakeChannel)))

    expect(sidebarStateIn(container)).toEqual(sidebarOpen)
    expect(savesSince(api, before)).toEqual([{ sidebarOpen: true }])
    expect(document.activeElement).toBe(sidebarPickerIn(container))
  })

  test('collapsed, the account menu shows the avatar and not the email; open, the email beside it', async () => {
    installFakeApi({ sidebarOpen: false })
    const { container } = await render()
    const email = 'nick@example.com'
    const footer = () => sidebarIn(container)?.querySelector('[data-slot="sidebar-footer"]')

    expect(footer()?.textContent).not.toContain(email)
    await click(sidebarToggleIn(container))
    expect(footer()?.textContent).toContain(email)
  })

  describe('the channel picker, a two-line button (creator-analytics#531)', () => {
    const second: ListedChannel = {
      ...fakeChannel,
      id: 'c-2',
      title: 'Second channel',
      handle: '@second_channel',
    }

    /** The text of each line a picker's button or option shows, in order. */
    function linesOf(element: Element): string[] {
      return [...element.querySelectorAll('.picker-lines > span')].map(
        (line) => line.textContent ?? '',
      )
    }

    test("the button shows the channel's handle over its name, and is named Channel and the channel", async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      const { container } = await render()
      const picker = sidebarPickerIn(container)

      expect(linesOf(picker)).toEqual(['@nick_vogel', 'Nick Vogel'])
      expect(accessibleNameOf(picker, true)).toBe(channelIconLabelOf(fakeChannel))
      expect(accessibleNameOf(picker, true)).toBe('Channel: Nick Vogel (@nick_vogel)')
    })

    test('no Channel label shows above the button', async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      const { container } = await render()
      const footer = sidebarIn(container)?.querySelector('[data-slot="sidebar-footer"]')
      if (!footer) throw new Error('No footer in the sidebar')

      expect(footer.querySelector('label')).toBeNull()
      expect(footer.textContent).not.toContain(pickerLabel)
    })

    test('a click opens the list of channels, each option on the same two lines', async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      const { container } = await render()

      await click(sidebarPickerIn(container))

      expect(sidebarPickerIn(container).getAttribute('aria-expanded')).toBe('true')
      expect(pickerOptions().map(linesOf)).toEqual([
        ['@nick_vogel', 'Nick Vogel'],
        ['@second_channel', 'Second channel'],
      ])
    })

    test('picking the second channel puts it in the address, and the button shows it', async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      const shown = await render()

      await pickInSidebar(shown.container, 'Second channel')

      expect(new URLSearchParams(shown.address()).get('channel')).toBe(second.id)
      expect(linesOf(sidebarPickerIn(shown.container))).toEqual([
        '@second_channel',
        'Second channel',
      ])
      expect(accessibleNameOf(sidebarPickerIn(shown.container), true)).toBe(
        channelIconLabelOf(second),
      )
    })

    test('a channel with no handle shows its name alone, on one line', async () => {
      const api = installFakeApi()
      api.channels = [{ ...fakeChannel, handle: null }, second]
      const { container } = await render()

      expect(linesOf(sidebarPickerIn(container))).toEqual(['Nick Vogel'])
    })

    test('a channel with no title shows its YouTube channel id alone, on one line', async () => {
      const api = installFakeApi()
      api.channels = [{ ...fakeChannel, title: null }, second]
      const { container } = await render()

      expect(linesOf(sidebarPickerIn(container))).toEqual([fakeChannel.youtubeChannelId])
    })
  })

  describe('the account row, one button (creator-analytics#531, #590)', () => {
    const email = 'nick@example.com'

    /** The footer's buttons that open the account menu. */
    function accountButtonsIn(container: HTMLElement): HTMLButtonElement[] {
      const footer = sidebarIn(container)?.querySelector('[data-slot="sidebar-footer"]')
      return [...(footer?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter(
        (each) => each.getAttribute('aria-haspopup') === 'menu',
      )
    }

    test('open, the row shows Settings over the email and is one button named Settings, and the email, which opens the menu', async () => {
      installFakeApi()
      const { container } = await render()
      const buttons = accountButtonsIn(container)

      expect(buttons.map((each) => accessibleNameOf(each, true))).toEqual([
        accountRowLabelOf(email),
      ])
      const lines = buttons[0]?.querySelector('.account-lines')?.children ?? []
      expect([...lines].map((each) => [each.className, each.textContent])).toEqual([
        ['account-heading', settingsName],
        ['sidebar-email', email],
      ])
      expect(buttons[0]?.getAttribute('aria-haspopup')).toBe('menu')

      await click(buttons[0] as HTMLButtonElement)

      expect(accountMenu()).not.toBeNull()
      expect(buttons[0]?.getAttribute('aria-expanded')).toBe('true')
    })

    test('collapsed, the button is the avatar alone, named Settings', async () => {
      installFakeApi({ sidebarOpen: false })
      const { container } = await render()
      const buttons = accountButtonsIn(container)

      expect(buttons.map((each) => accessibleNameOf(each, true))).toEqual([settingsName])
      expect([...(buttons[0]?.children ?? [])].map((each) => each.className)).toEqual(['avatar'])
    })
  })
})

/** The sidebar's part `slot`: its header, content or footer. */
function sidebarPartIn(container: HTMLElement, slot: string): HTMLElement {
  const part = sidebarIn(container)?.querySelector<HTMLElement>(`[data-slot="sidebar-${slot}"]`)
  if (!part) throw new Error(`No sidebar ${slot}`)
  return part
}

/** Whether `part` holds a placeholder, each hidden from a screen reader. */
function holdsPlaceholders(part: HTMLElement): boolean {
  const placeholders = [...part.querySelectorAll('.placeholder')]
  return (
    placeholders.length > 0 &&
    placeholders.every((each) => each.getAttribute('aria-hidden') === 'true')
  )
}

describe('the sidebar while the session is read (creator-analytics#507)', () => {
  test('from 48rem, holds the wordmark and the places of its links and footer from the first paint, and becomes the sidebar with no header at any point', async () => {
    const api = installFakeApi()
    const session = holdBoth(api, 'GET /api/me')
    const { container } = await render()
    const sidebar = sidebarIn(container)
    if (!sidebar) throw new Error('No sidebar while the session is read')
    const wordmark = sidebarPartIn(container, 'header').querySelector('a.wordmark')

    expect(container.querySelector('header')).toBeNull()
    expect(sidebar.getAttribute('aria-busy')).toBe('true')
    expect(wordmark?.textContent).toBe('stillstats')
    expect(holdsPlaceholders(sidebarPartIn(container, 'content'))).toBe(true)
    const footer = sidebarPartIn(container, 'footer')
    expect(holdsPlaceholders(footer)).toBe(true)
    expect(footer.querySelector('.placeholder-avatar')).not.toBeNull()
    expect(container.querySelectorAll('nav')).toHaveLength(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)

    act(() => session.release())
    await settle()

    expect(container.querySelector('header')).toBeNull()
    expect(sidebarIn(container)?.getAttribute('aria-busy')).toBeNull()
    expect(sidebarLink(container, videosLinkText)).toBeTruthy()
    expect(sidebarLink(container, audienceLinkText)).toBeTruthy()
    expect(
      buttonLabelled(sidebarPartIn(container, 'footer'), accountRowLabelOf('nick@example.com')),
    ).toBeTruthy()
    expect(sidebarToggleIn(container)).toBeTruthy()
    expect(sidebarPartIn(container, 'header').querySelector('a.wordmark')).toBe(wordmark)
  })

  test('a creator with no channel sees the same place, then ends on the header with its wordmark and avatar, and no sidebar', async () => {
    const api = installFakeApi()
    api.channels = []
    const session = holdBoth(api, 'GET /api/me')
    const { container } = await render()

    expect(container.querySelector('header')).toBeNull()
    expect(sidebarIn(container)?.getAttribute('aria-busy')).toBe('true')
    expect(holdsPlaceholders(sidebarPartIn(container, 'footer'))).toBe(true)

    act(() => session.release())
    await settle()
    const header = container.querySelector<HTMLElement>('header')
    if (!header) throw new Error('No header')

    expect(sidebarIn(container)).toBeNull()
    expect(header.querySelector('a.wordmark')).not.toBeNull()
    expect(buttonLabelled(header, settingsName)).toBeTruthy()
  })

  test.each([
    ['375px wide', { width: 375, height: 812 }],
    ["too short for the column's rows", { width: 1024, height: 455 }],
  ])(
    '%s, the header holds the wait with its avatar placeholder, and no sidebar or Menu shows',
    async (_window, viewport) => {
      setViewport(viewport)
      try {
        const api = installFakeApi()
        holdBoth(api, 'GET /api/me')
        const { container } = await render()
        const header = container.querySelector<HTMLElement>('header')
        if (!header) throw new Error('No header')

        expect(header.getAttribute('aria-busy')).toBe('true')
        expect(header.querySelector('a.wordmark')).not.toBeNull()
        expect(header.querySelector('.placeholder-avatar')).not.toBeNull()
        expect(sidebarIn(container)).toBeNull()
        expect(menuButtonOrNullIn(container)).toBeNull()
      } finally {
        setViewport({ width: 1024, height: 768 })
      }
    },
  )
})

/** The header's Menu button, or null with none in the page (creator-analytics#891). */
function menuButtonOrNullIn(container: HTMLElement): HTMLButtonElement | null {
  const header = container.querySelector<HTMLElement>('header')
  return header ? (buttonsNamed(header, menuButtonText)[0] ?? null) : null
}

function menuButtonIn(container: HTMLElement): HTMLButtonElement {
  const button = menuButtonOrNullIn(container)
  if (!button) throw new Error('No Menu button in the header')
  return button
}

/** The panel the header's Menu button controls, found through its `aria-controls`. */
function menuPanelIn(container: HTMLElement): HTMLElement {
  const id = menuButtonIn(container).getAttribute('aria-controls')
  const panel = id ? document.getElementById(id) : null
  if (!panel) throw new Error('No element the Menu button controls')
  return panel
}

/** Whether the header's Menu says it is open, and whether its panel is on view. */
function menuStateIn(container: HTMLElement) {
  return {
    expanded: menuButtonIn(container).getAttribute('aria-expanded'),
    hidden: menuPanelIn(container).hidden,
  }
}

const menuOpen = { expanded: 'true', hidden: false }
const menuClosed = { expanded: 'false', hidden: true }

/** Opens the header's Menu with a press of its button, and returns its panel. */
async function openMenuPanel(container: HTMLElement): Promise<HTMLElement> {
  await click(menuButtonIn(container))
  const panel = menuPanelIn(container)
  if (panel.hidden) throw new Error('The Menu panel did not open')
  return panel
}

/** The Menu panel's nav, which holds the channel screens' links. */
function menuNavIn(panel: HTMLElement): HTMLElement {
  const nav = panel.querySelector<HTMLElement>(`nav[aria-label="${sidebarLabel}"]`)
  if (!nav) throw new Error('No nav in the Menu panel')
  return nav
}

/** Sends a `pointerdown` to `target`, as the start of a press there does. */
async function pointerDownOn(target: Element): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  })
  await settle()
}

describe("the header's Menu below 48rem (creator-analytics#891)", () => {
  beforeEach(() => setViewport({ width: 375, height: 812 }))
  afterEach(() => setViewport({ width: 1024, height: 768 }))

  // The row's layout is the browser walk's ("state: the header's Menu at 375px", with two
  // channels listed): at 375px the row has no room for the picker beside the Menu button and the
  // avatar (creator-analytics#891 review pass 1 finding 1).
  test("the header holds the wordmark, the Menu button, closed, and the avatar, in that order; with two channels the picker sits in the Menu panel, not in the header's row; and no sidebar or collapse button shows", async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    const { container } = await render()
    const header = container.querySelector<HTMLElement>('header')
    const wordmark = header?.querySelector('a.wordmark')
    if (!header || !wordmark) throw new Error('No header or no wordmark')

    expect(
      inDocumentOrder([wordmark, menuButtonIn(container), buttonLabelled(header, settingsName)]),
    ).toBe(true)
    expect(selectNamed(header, pickerLabel).closest('.header-menu-panel')).toBe(
      menuPanelIn(container),
    )
    expect(menuStateIn(container)).toEqual(menuClosed)
    expect(sidebarIn(container)).toBeNull()
    expect(sidebarToggleOrNullIn(container)).toBeNull()
  })

  // An arrow key on a focused, closed select changes its value at once in Chrome and Firefox on
  // Windows and Linux, so a pick that closed the panel would stop a keyboard user from stepping
  // through the channels (review pass 2 finding 1).
  test("with two channels, a pick in the panel's picker opens that channel's screen, and the panel stays open with focus on the picker", async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    const shown = await render()
    const panel = await openMenuPanel(shown.container)
    selectNamed(panel, pickerLabel).focus()

    await choose(panel, pickerLabel, anotherChannel.id)

    expect(shown.address()).toBe(`?channel=${anotherChannel.id}`)
    expect(menuStateIn(shown.container)).toEqual(menuOpen)
    expect(document.activeElement).toBe(selectNamed(menuPanelIn(shown.container), pickerLabel))
  })

  test('a press opens the panel and a second press closes it', async () => {
    installFakeApi()
    const { container } = await render()

    await click(menuButtonIn(container))
    expect(menuStateIn(container)).toEqual(menuOpen)

    await click(menuButtonIn(container))
    expect(menuStateIn(container)).toEqual(menuClosed)
  })

  test('the panel holds the channel screens and "Thumbnail preview" in its nav, then a rule, then "Send feedback" and the support item with its Hide, each link with its icon', async () => {
    const api = installFakeApi()
    api.support = { link: sidebarSupportLink, prompt: true }
    const { container } = await render()
    const panel = await openMenuPanel(container)
    const nav = menuNavIn(panel)
    const rule = panel.querySelector('hr')
    if (!rule) throw new Error('No rule in the Menu panel')
    const links = [...panel.querySelectorAll('a')]

    expect(links.map((each) => each.textContent)).toEqual([
      videosLinkText,
      audienceLinkText,
      retentionLinkText,
      whatsNewLinkText,
      'Thumbnail preview',
      sendFeedbackText,
      supportHeading,
    ])
    expect(links.map((each) => nav.contains(each))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ])
    expect(inDocumentOrder([nav, rule, linkNamed(panel, sendFeedbackText)])).toBe(true)
    expect(links.every((each) => each.querySelector('svg[aria-hidden="true"]'))).toBe(true)
    expect(buttonLabelled(panel, hideSupportLabel).textContent).toBe(hideSupportText)
  })

  test('its "Thumbnail preview" item opens the tool page in a new tab, named so, with the external link icon after its own', async () => {
    installFakeApi()
    const { container } = await render()
    const link = linkLabelled(await openMenuPanel(container), thumbnailPreviewLabel)

    expect({
      href: link.getAttribute('href'),
      target: link.getAttribute('target'),
      rel: link.getAttribute('rel'),
      name: accessibleNameOf(link, true),
      icons: link.querySelectorAll('svg[aria-hidden="true"]').length,
    }).toEqual({
      href: '/tools/thumbnail-preview',
      target: '_blank',
      rel: 'noopener',
      name: thumbnailPreviewLabel,
      icons: 2,
    })
  })

  test.each([
    ['the channel screen', '', [videosLinkText]],
    ["a video's page", `videos/${fakeVideo.id}`, [videosLinkText]],
    ['the Audience screen', 'audience', [audienceLinkText]],
    ['the retention comparison', 'retention', [retentionLinkText]],
    ['"What\'s new"', 'whats-new', [whatsNewLinkText]],
    ['the feedback form', 'feedback', [sendFeedbackText]],
    ['Settings', 'settings', []],
  ])('on %s, the panel marks the current screen alone', async (_screen, address, current) => {
    installFakeApi()
    const { container } = await render(address)
    const panel = await openMenuPanel(container)

    expect(
      [...panel.querySelectorAll('a[aria-current="page"]')].map((each) => each.textContent),
    ).toEqual(current)
  })

  test.each([
    [audienceLinkText, 'audience', audienceHeading],
    [sendFeedbackText, 'feedback', sendFeedbackText],
  ])(
    'choosing %s closes the panel, opens the screen in place, and leaves focus on the Menu button',
    async (name, address, heading) => {
      installFakeApi()
      const shown = await render()
      const panel = await openMenuPanel(shown.container)

      await click(linkNamed(panel, name))

      expect(menuStateIn(shown.container)).toEqual(menuClosed)
      expect(shown.address()).toBe(address)
      expect(topHeadingIn(shown.container)).toBe(heading)
      expect(document.activeElement).toBe(menuButtonIn(shown.container))
    },
  )

  test('a modified click on a channel screen leaves the click to the browser and the panel open', async () => {
    installFakeApi()
    const shown = await render()
    const panel = await openMenuPanel(shown.container)

    expect(await modifiedClick(linkNamed(panel, audienceLinkText), 'metaKey')).toBe(true)
    expect(menuStateIn(shown.container)).toEqual(menuOpen)
    expect(shown.address()).toBe('')
  })

  test.each([
    ['a link in the panel', (panel: HTMLElement) => linkNamed(panel, audienceLinkText)],
    ['the Menu button', (_panel: HTMLElement, button: HTMLButtonElement) => button],
  ])(
    'Escape with focus on %s closes the panel and leaves focus on the Menu button',
    async (_where, focused) => {
      installFakeApi()
      const { container } = await render()
      const panel = await openMenuPanel(container)
      const button = menuButtonIn(container)
      focused(panel, button).focus()

      await press('Escape')

      expect(menuStateIn(container)).toEqual(menuClosed)
      expect(document.activeElement).toBe(button)
    },
  )

  test('a press outside the panel closes it, and a press inside it does not', async () => {
    installFakeApi()
    const { container } = await render()
    const panel = await openMenuPanel(container)

    await pointerDownOn(menuNavIn(panel))
    expect(menuStateIn(container)).toEqual(menuOpen)

    await pointerDownOn(document.body)
    expect(menuStateIn(container)).toEqual(menuClosed)
  })

  test('a click on "Thumbnail preview" sends tool_link_clicked from the menu alone and leaves the click to the browser', async () => {
    installFakeApi()
    const { container } = await render()
    const link = linkLabelled(await openMenuPanel(container), thumbnailPreviewLabel)
    vi.mocked(track).mockClear()
    // happy-dom follows a link no handler prevented, so the test prevents it, after it records
    // whether the app, which React listens for below the document, left the default to the browser.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)
    try {
      await click(link)
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'tool_link_clicked', tool: 'thumbnail-preview', source: 'menu' }],
    ])
    expect(leftToTheBrowser).toBe(true)
  })

  test("the support item's Hide removes it and tracks support_prompt_dismissed, and the panel stays open with focus on its nav", async () => {
    const api = installFakeApi()
    api.support = { link: sidebarSupportLink, prompt: true }
    const { container } = await render()
    const panel = await openMenuPanel(container)
    const hide = buttonLabelled(panel, hideSupportLabel)
    hide.focus()
    vi.mocked(track).mockClear()

    await click(hide)

    expect(panel.textContent).not.toContain(supportHeading)
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'support_prompt_dismissed' }]])
    expect(menuStateIn(container)).toEqual(menuOpen)
    expect(document.activeElement).toBe(menuNavIn(panel))
  })

  test('a creator with no channel has no Menu button', async () => {
    const api = installFakeApi()
    api.channels = []
    const { container } = await render()

    expect(container.querySelector('header a.wordmark')).not.toBeNull()
    expect(menuButtonOrNullIn(container)).toBeNull()
  })
})

describe('the sidebar', () => {
  const query = `?channel=${fakeChannel.id}&window=last90&sort=views&format=short&page=2`

  test("each link keeps the address's query, followed from the channel screen and back", async () => {
    const api = installFakeApi()
    api.pageCount = 3
    const shown = await render(query)
    const { container } = shown

    expect(sidebarLink(container, videosLinkText).getAttribute('href')).toBe(`/${query}`)
    expect(sidebarLink(container, audienceLinkText).getAttribute('href')).toBe(`/audience${query}`)

    await click(sidebarLink(container, audienceLinkText))
    expect(shown.address()).toBe(`audience${query}`)

    await click(sidebarLink(container, videosLinkText))
    expect(shown.address()).toBe(query)
  })

  // creator-analytics#452 added the video's page, whose two steppers are navs of their own.
  test.each<{
    screen: string
    address: string
    setUp: (api: FakeApi) => void
    stepperNames: string[]
  }>([
    {
      screen: 'the channel screen',
      address: query,
      setUp: (api) => {
        api.pageCount = 3
      },
      stepperNames: [],
    },
    {
      screen: "a video's page",
      address: 'videos/video-2',
      // video-2 in the middle of the list's one page, so both steppers show with both links.
      setUp: (api) => {
        api.videos = [
          fakeVideo,
          { ...fakeVideo, id: 'video-2', title: 'Another video' },
          { ...fakeVideo, id: 'video-3', title: 'A third video' },
        ]
      },
      stepperNames: ['Videos, top of page', 'Videos, bottom of page'],
    },
  ])(
    'on $screen, beside another nav, every nav has a name of its own',
    async ({ address, setUp, stepperNames }) => {
      setUp(installFakeApi())
      const { container } = await render(address)
      const names = navNamesIn(container)
      const steppers = [...container.querySelectorAll('nav.video-stepper')]

      expect(sidebarIn(container)).not.toBeNull()
      expect(steppers.map((nav) => nav.getAttribute('aria-label'))).toEqual(stepperNames)
      expect(names.length).toBeGreaterThan(1)
      expect(names.filter((name) => name === '')).toEqual([])
      expect(new Set(names).size).toBe(names.length)
    },
  )

  test.each([
    ['the channel screen', '', [videosLinkText]],
    ["a video's page", `videos/${fakeVideo.id}`, [videosLinkText]],
    ['the Audience screen', 'audience', [audienceLinkText]],
    ['the retention comparison', 'retention', [retentionLinkText]],
    ['"What\'s new"', 'whats-new', [whatsNewLinkText]],
    ['Settings', 'settings', []],
  ])('on %s, marks the current link', async (_screen, address, current) => {
    installFakeApi()
    const { container } = await render(address)

    expect(currentSidebarLinks(container)).toEqual(current)
  })

  test.each(['first7', 'lifetime'])(
    'from the window %o, "Audience" opens the last 28 days, and "Videos" returns to the window (creator-analytics#1049)',
    async (window) => {
      installFakeApi()
      const shown = await render(`?window=${window}`)

      await click(sidebarLink(shown.container, audienceLinkText))

      expect(shown.address()).toBe(`audience?listWindow=${window}`)

      await click(sidebarLink(shown.container, videosLinkText))

      expect(shown.address()).toBe(`?window=${window}`)
    },
  )

  test('does not show for a creator with no channel', async () => {
    const api = installFakeApi()
    api.channels = []
    const { container } = await render()

    expect(sidebarIn(container)).toBeNull()
  })

  test('is hidden behind a consent screen, with the rest of the signed-in view', async () => {
    installFakeApi()
    const { container } = await render('settings')

    await click(buttonNamed(container, 'Connect a channel'))

    expect(sidebarIn(container)?.closest('[hidden]')).toBeTruthy()
  })

  test('does not show on the signed-out screen', async () => {
    installFakeApi()
    const { container } = await render()
    await openMenuFrom(container)

    await click(menuItemNamed('Sign out'))

    expect(sidebarIn(container)).toBeNull()
  })
})

/**
 * Each highlight on the "What's new" screen as its title, its description's HTML, and each link
 * in it as its text and its href, in the order the screen lists them.
 */
function highlightsIn(container: HTMLElement) {
  return [...container.querySelectorAll('.whats-new-item')].map((item) => ({
    title: item.querySelector('h2')?.textContent,
    description: item.querySelector('.whats-new-description')?.innerHTML.trim(),
    links: [...item.querySelectorAll('a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ]),
  }))
}

/** The screen's top heading, or null with none. */
function topHeadingIn(container: HTMLElement): string | null {
  return container.querySelector('h1')?.textContent ?? null
}

// The highlights are the web app's fixtures (apps/web/test/fixtures/), which the root
// vitest.config.ts builds into `virtual:highlights`: 2026.11.9 lists one with a screen, and
// 2026.11.2 one with none.
describe('the "What\'s new" screen (creator-analytics#577)', () => {
  test("from 48rem, the sidebar's link after Audience and Retention opens it, keeping the query", async () => {
    installFakeApi()
    const shown = await render('?window=last90')
    const { container } = shown

    expect(
      [...(sidebarNavIn(container)?.querySelectorAll('a') ?? [])].map((each) => each.textContent),
    ).toEqual([
      videosLinkText,
      audienceLinkText,
      retentionLinkText,
      whatsNewLinkText,
      'Thumbnail preview',
    ])
    expect(sidebarLink(container, whatsNewLinkText).getAttribute('href')).toBe(
      '/whats-new?window=last90',
    )

    await click(sidebarLink(container, whatsNewLinkText))

    expect(shown.address()).toBe('whats-new?window=last90')
    expect(topHeadingIn(container)).toBe(whatsNewHeading)
    expect(currentSidebarLinks(container)).toEqual([whatsNewLinkText])
  })

  test("below 48rem, the header's Menu holds it after Audience and Retention, and it opens the screen (creator-analytics#891)", async () => {
    setViewport({ width: 375, height: 812 })
    try {
      installFakeApi()
      const shown = await render()
      const nav = menuNavIn(await openMenuPanel(shown.container))

      expect([...nav.querySelectorAll('a')].map((each) => each.textContent).slice(0, 4)).toEqual([
        videosLinkText,
        audienceLinkText,
        retentionLinkText,
        whatsNewLinkText,
      ])

      await click(linkNamed(nav, whatsNewLinkText))

      expect(shown.address()).toBe('whats-new')
      expect(topHeadingIn(shown.container)).toBe(whatsNewHeading)
    } finally {
      setViewport({ width: 1024, height: 768 })
    }
  })

  test('lists every highlight in the build newest first, each with its title, its description, a link to its release page, and a link to its screen only when it has one', async () => {
    installFakeApi()
    const { container } = await render('whats-new')

    expect(highlightsIn(container)).toEqual([
      {
        title: 'Audience in the sidebar',
        description:
          '<p>Open the <strong>Audience</strong> screen from the sidebar on any channel screen.</p>',
        links: [
          ['Stillstats 2026.11.9', '/releases/2026.11.9'],
          [screenLinkText, '/audience'],
        ],
      },
      {
        title: 'A page for every release',
        description: '<p>Read what changed in each release on its own page.</p>',
        links: [['Stillstats 2026.11.2', '/releases/2026.11.2']],
      },
    ])
  })

  test("a highlight's screen link opens that screen in place, on the channel on view", async () => {
    installFakeApi()
    const shown = await render(`whats-new?channel=${fakeChannel.id}&window=last90`)
    const [item] = shown.container.querySelectorAll<HTMLElement>('.whats-new-item')
    if (!item) throw new Error('No highlight')
    const link = linkNamed(item, screenLinkText)

    expect(link.getAttribute('href')).toBe(`/audience?channel=${fakeChannel.id}`)

    await click(link)

    expect(shown.address()).toBe(`audience?channel=${fakeChannel.id}`)
    expect(topHeadingIn(shown.container)).toBe(audienceHeading)
  })

  test("a click on the sidebar's link sends whats_new_opened once, from the sidebar, with no account ID", async () => {
    installFakeApi()
    const { container } = await render()
    vi.mocked(track).mockClear()

    await click(sidebarLink(container, whatsNewLinkText))

    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'whats_new_opened', from: 'sidebar' }]])
  })

  test("below 48rem, a click on the header's Menu link sends whats_new_opened once, from the sidebar, with no account ID (creator-analytics#891)", async () => {
    setViewport({ width: 375, height: 812 })
    try {
      installFakeApi()
      const { container } = await render()
      const panel = await openMenuPanel(container)
      vi.mocked(track).mockClear()

      await click(linkNamed(panel, whatsNewLinkText))

      expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'whats_new_opened', from: 'sidebar' }]])
    } finally {
      setViewport({ width: 1024, height: 768 })
    }
  })

  test("a click on the sidebar's link while the screen is on view sends nothing", async () => {
    installFakeApi()
    const { container } = await render('whats-new')
    vi.mocked(track).mockClear()

    await click(sidebarLink(container, whatsNewLinkText))

    expect(vi.mocked(track).mock.calls).toEqual([])
  })
})

/** The "What's new" banner, the region named `bannerLabel`, or null when it is not on view. */
function bannerIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${bannerLabel}"]`)
}

function shownBannerIn(container: HTMLElement): HTMLElement {
  const banner = bannerIn(container)
  if (!banner) throw new Error('No banner on view')
  return banner
}

/**
 * A creator whose account is older than every fixture release, with the marker saved, or none.
 * The fixtures' newest highlighted release is 2026.11.9; 2026.11.9.1 comes after it that day and
 * lists no highlight.
 */
function installOlderAccount(preferences: Preferences = {}): FakeApi {
  const api = installFakeApi(preferences)
  api.me = { ...api.me, createdAt: '2026-11-01T08:00:00.000Z' }
  return api
}

// The highlights are the web app's fixtures, as for the screen: 2026.11.2 and 2026.11.9 each list
// one, and 2026.11.9.1, a second release on 2026-11-09, lists none.
describe('the "What\'s new" banner (creator-analytics#580)', () => {
  test.each([
    ['no marker', {}],
    ['a marker older than the newest highlighted release', { whatsNewMarker: '2026.11.2' }],
  ])('shows one line, a link to "What\'s new" and a close button with %s', async (_, saved) => {
    installOlderAccount(saved)
    const { container } = await render()

    const banner = shownBannerIn(container)
    expect(banner.textContent).toBe(`${bannerText} ${bannerLinkText}`)
    expect(banner.querySelectorAll('p')).toHaveLength(1)
    expect(linkNamed(banner, bannerLinkText).getAttribute('href')).toBe('/whats-new')
    expect(buttonLabelled(banner, bannerCloseLabel).type).toBe('button')
  })

  test('is a region named for what it is, with its link before its close button', async () => {
    installOlderAccount()
    const { container } = await render()

    const banner = shownBannerIn(container)
    expect(banner.tagName).toBe('SECTION')
    expect(banner.getAttribute('aria-label')).toBe(bannerLabel)
    expect(
      [...banner.querySelectorAll('a, button')].map(
        (each) => each.getAttribute('aria-label') ?? each.textContent,
      ),
    ).toEqual([bannerLinkText, bannerCloseLabel])
  })

  test('shows above the screen content', async () => {
    installOlderAccount()
    const { container } = await render()

    const screen = container.querySelector('.signed-in-screen')
    expect(screen?.firstElementChild).toBe(shownBannerIn(container))
  })

  test('shows for a creator with no channel too', async () => {
    const api = installOlderAccount()
    api.channels = []
    const { container } = await render()

    expect(bannerIn(container)).not.toBeNull()
  })

  test.each([
    // 2026.11.9.1 is newer than this marker, but lists no highlight.
    ['the newest highlighted release', '2026.11.9'],
    ['a release newer than every highlighted one', '2026.11.9.1'],
  ])('is absent with a marker at %s', async (_, whatsNewMarker) => {
    installOlderAccount({ whatsNewMarker })
    const { container } = await render()

    expect(bannerIn(container)).toBeNull()
  })

  test.each([
    ['on the day of the newest highlighted release', '2026-11-09T06:00:00.000Z'],
    ['after every release', '2026-11-10T12:00:00.000Z'],
  ])('is absent for an account created %s', async (_, createdAt) => {
    const api = installFakeApi()
    api.me = { ...api.me, createdAt }
    const { container } = await render()

    expect(bannerIn(container)).toBeNull()
  })

  // The open's marker save fails, so the old marker comes back: a successful save would hide the
  // banner by the marker alone, whatever the screen.
  test('is absent on the "What\'s new" screen, with its marker save failed', async () => {
    const api = installOlderAccount()
    api.failNext(savePreferences)
    const { container } = await render('whats-new')
    await settle()

    expect(toastText()).toBe(failedSaveNotice)
    expect(bannerIn(container)).toBeNull()
  })

  test('is absent until the preferences read lands', async () => {
    const api = installOlderAccount({ whatsNewMarker: '2026.11.9' })
    const reads = holdBoth(api, 'GET /api/me/preferences')
    const { container } = await render()

    expect(bannerIn(container)).toBeNull()
    await act(async () => reads.release())
    await settle()

    expect(bannerIn(container)).toBeNull()
  })

  test('its close saves the marker at the newest highlighted release once, hides it, and sends whats_new_banner_closed once', async () => {
    const api = installOlderAccount()
    const { container } = await render()
    const before = api.requests.length
    vi.mocked(track).mockClear()

    await click(buttonLabelled(shownBannerIn(container), bannerCloseLabel))

    expect(savesSince(api, before)).toEqual([{ whatsNewMarker: '2026.11.9' }])
    expect(bannerIn(container)).toBeNull()
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'whats_new_banner_closed' }]])
  })

  test('its link opens "What\'s new" in place, saves the marker once, and sends whats_new_opened once, from the banner', async () => {
    const api = installOlderAccount()
    const shown = await render('?window=last90')
    const before = api.requests.length
    vi.mocked(track).mockClear()

    await click(linkNamed(shownBannerIn(shown.container), bannerLinkText))

    expect(shown.address()).toBe('whats-new?window=last90')
    expect(topHeadingIn(shown.container)).toBe(whatsNewHeading)
    expect(savesSince(api, before)).toEqual([{ whatsNewMarker: '2026.11.9' }])
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'whats_new_opened', from: 'banner' }]])
  })

  test('is gone after "What\'s new" opens from its link, back on the list', async () => {
    installOlderAccount()
    const shown = await render()

    await click(linkNamed(shownBannerIn(shown.container), bannerLinkText))
    await click(sidebarLink(shown.container, videosLinkText))

    expect(shown.address()).toBe('')
    expect(bannerIn(shown.container)).toBeNull()
  })

  test('is gone after "What\'s new" opens from the sidebar, which saves the marker once', async () => {
    const api = installOlderAccount()
    const shown = await render()
    const before = api.requests.length

    await click(sidebarLink(shown.container, whatsNewLinkText))
    await click(sidebarLink(shown.container, videosLinkText))

    expect(savesSince(api, before)).toEqual([{ whatsNewMarker: '2026.11.9' }])
    expect(bannerIn(shown.container)).toBeNull()
  })

  test('an address that opens "What\'s new" saves the marker once', async () => {
    const api = installOlderAccount()
    await render('whats-new')

    expect(savesSince(api, 0)).toEqual([{ whatsNewMarker: '2026.11.9' }])
  })

  test('an open of "What\'s new" saves nothing with the marker already there', async () => {
    const api = installOlderAccount({ whatsNewMarker: '2026.11.9' })
    await render('whats-new')

    expect(savesSince(api, 0)).toEqual([])
  })

  test('a failed save of the marker on an open is not sent again while "What\'s new" stays on view', async () => {
    const api = installOlderAccount()
    api.failNext(savePreferences)
    const { container } = await render('whats-new')
    await settle()

    expect(savesSince(api, 0)).toEqual([{ whatsNewMarker: '2026.11.9' }])
    expect(toastText()).toBe(failedSaveNotice)
    expect(topHeadingIn(container)).toBe(whatsNewHeading)
  })

  test('comes back after "Reset preferences"', async () => {
    installOlderAccount({ whatsNewMarker: '2026.11.9' })
    const { container } = await render('settings')
    expect(bannerIn(container)).toBeNull()

    await click(buttonNamed(container, 'Reset preferences'))

    expect(bannerIn(container)).not.toBeNull()
  })

  test('a failed save of its close brings it back', async () => {
    const api = installOlderAccount()
    const { container } = await render()
    const held = api.hold(savePreferences)

    await click(buttonLabelled(shownBannerIn(container), bannerCloseLabel))
    expect(bannerIn(container)).toBeNull()
    await act(async () => held.fail())
    await settle()

    expect(bannerIn(container)).not.toBeNull()
  })
})

describe('a modified click on an in-place link', () => {
  const steppedThrough = [
    fakeVideo,
    { ...fakeVideo, id: 'video-2', title: 'Another video' },
    { ...fakeVideo, id: 'video-3', title: 'A third video' },
  ]

  // Each address is one the link would leave, were the click followed in place.
  test.each<{
    link: string
    address: string
    setUp?: (api: FakeApi) => void
    find: (container: HTMLElement) => HTMLAnchorElement
  }>([
    {
      link: 'the wordmark',
      address: 'settings',
      find: (container) => {
        const wordmark = container.querySelector<HTMLAnchorElement>('a.wordmark')
        if (!wordmark) throw new Error('No wordmark')
        return wordmark
      },
    },
    {
      link: "the sidebar's Audience",
      address: '',
      find: (container) => sidebarLink(container, audienceLinkText),
    },
    {
      link: "a list row's title",
      address: '',
      find: (container) => linkNamed(container, fakeVideo.title),
    },
    {
      link: 'Previous page',
      address: '?page=2',
      setUp: (api) => {
        api.pageCount = 3
      },
      find: (container) => linkNamed(container, 'Previous page'),
    },
    {
      link: 'Next page',
      address: '?page=2',
      setUp: (api) => {
        api.pageCount = 3
      },
      find: (container) => linkNamed(container, 'Next page'),
    },
    {
      link: 'Back to videos',
      address: `videos/${fakeVideo.id}`,
      find: (container) => linkNamed(container, 'Back to videos'),
    },
    {
      link: 'a step',
      address: 'videos/video-2',
      setUp: (api) => {
        api.videos = steppedThrough
      },
      find: (container) => linkLabelled(container, 'Older video: A third video'),
    },
    {
      link: 'a publish day top title',
      address: '?window=first1',
      setUp: (api) => {
        api.publishDayTop = [
          {
            id: 'young-video',
            title: 'A young video',
            publishedAt: '2026-10-02T16:00:00.000Z',
            engagedViews: 40,
          },
        ]
      },
      find: (container) => linkNamed(container, 'A young video'),
    },
  ])(
    'a Cmd click on $link leaves the page where it is, and leaves the click to the browser',
    async ({ address, setUp, find }) => {
      const api = installFakeApi()
      setUp?.(api)
      const shown = await render(address)

      const leftToTheBrowser = await modifiedClick(find(shown.container), 'metaKey')

      expect(shown.address()).toBe(address)
      expect(leftToTheBrowser).toBe(true)
    },
  )
})

/** The query of each Audience answer the app read, oldest first. */
function audienceReadsOf(api: FakeApi): URLSearchParams[] {
  return api.requests
    .filter(({ method, path }) => method === 'GET' && path.endsWith('/audience'))
    .map(({ query }) => query)
}

/** The section under `heading`. */
function sectionUnder(container: HTMLElement, heading: string): HTMLElement {
  const section = [...container.querySelectorAll('section')].find(
    (each) => each.querySelector('h2')?.textContent === heading,
  )
  if (!section) throw new Error(`No section under ${heading}`)
  return section
}

/** The name of each bar in the section under `heading`. */
function barNamesUnder(container: HTMLElement, heading: string): (string | null)[] {
  return [...sectionUnder(container, heading).querySelectorAll('.bars li > span:first-child')].map(
    (each) => each.textContent,
  )
}

/** The text of each note in the section under `heading`. */
function notesUnder(container: HTMLElement, heading: string): (string | null)[] {
  return [...sectionUnder(container, heading).querySelectorAll('.note')].map(
    (each) => each.textContent,
  )
}

/** The name of each bar under "Countries (engaged views)". */
function countryNamesIn(container: HTMLElement): (string | null)[] {
  return barNamesUnder(container, 'Countries (engaged views)')
}

/**
 * An element's accessible name as these tests compute it: the text of the elements its
 * `aria-labelledby` names, joined, else its `aria-label`, else, with `fromContent`, its own text.
 * A subset of the browser's computation (see the Limits at the top).
 */
function accessibleNameOf(element: Element, fromContent: boolean): string {
  const ids = element.getAttribute('aria-labelledby')?.trim()
  if (ids) {
    return ids
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const label = element.getAttribute('aria-label')?.trim()
  if (label) return label
  return fromContent ? (element.textContent ?? '').replace(/\s+/g, ' ').trim() : ''
}

/** The one element on view with this role and accessible name. It throws with none or several. */
function groupNamed(container: HTMLElement, role: string, name: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>(`[role="${role}"]`)].filter(
    (each) => accessibleNameOf(each, false) === name,
  )
  const [group] = found
  if (!group || found.length > 1) throw new Error(`${found.length} ${role}s named ${name}, not 1`)
  return group
}

/** The radios in `group`, in order. */
function radiosIn(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>('[role="radio"]')]
}

/** The one radio in `group` with this accessible name. */
function radioNamed(group: HTMLElement, name: string): HTMLElement {
  const radio = radiosIn(group).find((each) => accessibleNameOf(each, true) === name)
  if (!radio) throw new Error(`No radio named ${name}`)
  return radio
}

/** The controls bar's Format group, found by its role and name. */
function formatGroup(container: HTMLElement): HTMLElement {
  return groupNamed(container, 'radiogroup', formatLabel)
}

/** Picks the format named `label` in the controls bar. */
async function chooseFormat(container: HTMLElement, label: string): Promise<void> {
  await click(radioNamed(formatGroup(container), label))
}

describe('the Format control', () => {
  test('is a radio group named Format, each Format a radio named by its text, with one tab stop on the checked one', async () => {
    installFakeApi()
    const { container } = await render()

    const radios = radiosIn(formatGroup(container))
    expect(radios.map((each) => accessibleNameOf(each, true))).toEqual([
      'All',
      'Videos',
      'Shorts',
      'Live',
    ])
    expect(radios.map((each) => each.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ])
    expect(radios.filter((each) => each.tabIndex === 0)).toEqual([radios[0]])
  })

  test('choosing Shorts reads the list for Shorts, shows it, checks Shorts and sends video_format_changed', async () => {
    const api = installFakeApi()
    const shown = await render()
    api.videos = [{ ...fakeVideo, id: 'short-1', title: 'A short' }]
    vi.mocked(track).mockClear()

    await chooseFormat(shown.container, 'Shorts')

    const listReads = api.requests.filter(({ path }) => path.endsWith('/videos'))
    expect(listReads.at(-1)?.query.get('format')).toBe('short')
    expect(new URLSearchParams(shown.address()).get('format')).toBe('short')
    expect(linkNamed(shown.container, 'A short')).toBeTruthy()
    const group = formatGroup(shown.container)
    expect(radioNamed(group, 'Shorts').getAttribute('aria-checked')).toBe('true')
    expect(radioNamed(group, 'All').getAttribute('aria-checked')).toBe('false')
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'video_format_changed', format: 'short' }],
    ])
  })

  test('the right arrow key moves the focus and the choice to the next Format, and sends video_format_changed', async () => {
    const api = installFakeApi()
    const { container } = await render()
    vi.mocked(track).mockClear()

    const all = radioNamed(formatGroup(container), 'All')
    await act(async () => all.focus())
    await act(async () => {
      all.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    await settle()

    const videos = radioNamed(formatGroup(container), 'Videos')
    expect(container.ownerDocument.activeElement).toBe(videos)
    expect(videos.getAttribute('aria-checked')).toBe('true')
    const listReads = api.requests.filter(({ path }) => path.endsWith('/videos'))
    expect(listReads.at(-1)?.query.get('format')).toBe('video')
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'video_format_changed', format: 'video' }],
    ])
  })
})

/** A stored curve of a video in the list, read on 2026-11-18 at noon UTC. */
function storedCurveOf(video: VideoRow, top: number): StoredRetentionCurve {
  return {
    video: {
      id: video.id,
      title: video.title,
      durationSeconds: video.durationSeconds,
      publishedAt: video.publishedAt,
    },
    readAt: '2026-11-18T12:00:00.000Z',
    points: [
      { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: top },
      { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: top / 2 },
      { elapsedVideoTimeRatio: 1, audienceWatchRatio: top / 4 },
    ],
  }
}

/** The list's videos, `count` of them, each with an id and a title of its own. */
function comparedVideos(count: number): VideoRow[] {
  return Array.from({ length: count }, (_, index) => ({
    ...fakeVideo,
    id: `video-${index + 1}`,
    title: `Video ${index + 1}`,
  }))
}

/** The retention comparison's pick box for a video, found by its label's title. */
function pickBoxOf(container: HTMLElement, title: string): HTMLButtonElement {
  const box = [
    ...container.querySelectorAll<HTMLButtonElement>('.comparison-videos [role="checkbox"]'),
  ].find(
    (each) => each.labels?.[0]?.querySelector('.comparison-video-title')?.textContent === title,
  )
  if (!box) throw new Error(`No pick box for ${title}`)
  return box
}

function isPicked(box: HTMLElement): boolean {
  return box.getAttribute('aria-checked') === 'true'
}

/** The picker's "Clear all picks" button, or undefined when it shows none. */
function clearPicksIn(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('.comparison-picker button')].find(
    (each) => each.textContent === pickerText.clear,
  )
}

/** The legend's entries, each its title and its read date or why it has no curve. */
function legendIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.comparison-legend li')].map(
    (each) => each.textContent ?? '',
  )
}

/** A legend entry of the video titled `title`, with its curve's read date of 2026-11-18. */
function readOn18November(title: string): unknown {
  return expect.stringMatching(new RegExp(`^${title} .*Nov 18, 2026$`))
}

/** The paths and ids of each curves read the app made, oldest first. */
function curvesReadsOf(api: FakeApi): (string | null)[] {
  return api.requests
    .filter(({ path }) => path === `/api/channels/${fakeChannel.id}/retention-curves`)
    .map(({ query }) => query.get('ids'))
}

describe('the retention comparison (creator-analytics#951)', () => {
  test('the sidebar\'s "Retention" link opens it in the lifetime window, current, with its h1, and "Videos" returns to the list\'s window (creator-analytics#1049)', async () => {
    installFakeApi()
    const shown = await render('?window=last90&sort=-averageViewPercentage')

    await click(sidebarLink(shown.container, retentionLinkText))

    expect(shown.address()).toBe(
      'retention?window=lifetime&sort=-averageViewPercentage&listWindow=last90',
    )
    expect(topHeadingIn(shown.container)).toBe(comparisonText.heading)
    expect(currentSidebarLinks(shown.container)).toEqual([retentionLinkText])

    await click(sidebarLink(shown.container, videosLinkText))

    expect(shown.address()).toBe('?window=last90&sort=-averageViewPercentage')
  })

  test('draws the picked curves on one chart, each in the legend with its title and its read date, in pick order, with one slider for the shared hover', async () => {
    const api = installFakeApi()
    const [first, second] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(first, 1), storedCurveOf(second, 0.8)]
    const { container } = await render('retention?window=lifetime&curves=video-2,video-1')

    expect(curvesReadsOf(api)).toEqual(['video-2,video-1'])
    expect(legendIn(container)).toEqual([readOn18November('Video 2'), readOn18November('Video 1')])
    expect(
      [...container.querySelectorAll('.comparison-legend [data-launch-position]')].map((each) =>
        each.getAttribute('data-launch-position'),
      ),
    ).toEqual(['1', '2'])
    expect(container.querySelectorAll('.comparison-chart [role="slider"]')).toHaveLength(1)
    expect([
      isPicked(pickBoxOf(container, 'Video 1')),
      isPicked(pickBoxOf(container, 'Video 2')),
    ]).toEqual([true, true])
  })

  test('a key on the chart shows one card that reads every drawn curve at the same share of the video', async () => {
    const api = installFakeApi()
    const [first, second] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(first, 1), storedCurveOf(second, 0.8)]
    const { container } = await render('retention?window=lifetime&curves=video-1,video-2')
    const plot = container.querySelector<HTMLElement>('.comparison-chart [role="slider"]')
    if (!plot) throw new Error('No comparison plot')

    await act(async () => plot.focus())
    await act(async () => {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })

    // The slider's value is the card's title, the share of the video; its live region reads a row
    // per drawn curve.
    expect(plot.getAttribute('aria-valuetext')).toBe('100%')
    expect(
      container.querySelector('.comparison-chart p.visually-hidden[aria-live="polite"] > span')
        ?.textContent,
    ).toBe('Video 1 25%, Video 2 20%')
  })

  test('a picked video with no curve says so in its legend entry, with no colour', async () => {
    const api = installFakeApi()
    const [first, second] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(first, 1), { ...storedCurveOf(second, 1), points: [] }]
    const { container } = await render('retention?window=lifetime&curves=video-1,video-2')

    expect(legendIn(container)).toEqual([
      readOn18November('Video 1'),
      `Video 2 ${comparisonText.noCurve}`,
    ])
    expect(container.querySelectorAll('.comparison-legend [data-launch-position]')).toHaveLength(1)
  })

  test('a pick in the address the channel no longer holds is dropped from it, and the rest are drawn', async () => {
    const api = installFakeApi()
    const [first, second] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(first, 1), storedCurveOf(second, 0.8)]
    const shown = await render('retention?window=lifetime&curves=video-1,gone,video-2')

    expect(shown.address()).toBe('retention?window=lifetime&curves=video-1,video-2')
    expect(legendIn(shown.container)).toEqual([
      readOn18November('Video 1'),
      readOn18November('Video 2'),
    ])
    expect(shown.container.querySelector('.comparison-chart-section [role="alert"]')).toBeNull()
  })

  test('on open with no pick, reads the curves with no id, lists the videos over their lifetime, and asks for a pick', async () => {
    const api = installFakeApi()
    const { container } = await render('retention?window=lifetime')

    expect(curvesReadsOf(api)).toEqual([null])
    const lists = api.requests.filter(
      ({ path }) => path === `/api/channels/${fakeChannel.id}/videos`,
    )
    expect(lists.map(({ query }) => [query.get('window'), query.get('sort')])).toEqual([
      ['lifetime', '-publishedAt'],
    ])
    expect(container.querySelector('.comparison-chart-section')?.textContent).toContain(
      comparisonText.empty,
    )
  })

  test('a pick adds the video to the address and reads its curve; a second pick reads both, in pick order; clearing one reads the rest', async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(3)
    const shown = await render('retention?window=lifetime')

    await click(pickBoxOf(shown.container, 'Video 3'))
    await click(pickBoxOf(shown.container, 'Video 1'))
    expect(shown.address()).toBe('retention?window=lifetime&curves=video-3,video-1')
    await click(pickBoxOf(shown.container, 'Video 3'))

    expect(shown.address()).toBe('retention?window=lifetime&curves=video-1')
    expect(curvesReadsOf(api)).toEqual([null, 'video-3', 'video-3,video-1', 'video-1'])
  })

  test('with 5 picked, a sixth pick box is disabled and the limit sentence names the limit', async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(6)
    const { container } = await render(
      'retention?window=lifetime&curves=video-1,video-2,video-3,video-4,video-5',
    )
    const sixth = pickBoxOf(container, 'Video 6')
    const limit = document.getElementById(sixth.getAttribute('aria-describedby') ?? '')

    expect(sixth.disabled).toBe(true)
    expect(limit?.textContent).toBe(comparisonText.limit)
    expect(limit && getComputedStyle(limit).visibility).not.toBe('hidden')
    expect(pickBoxOf(container, 'Video 5').disabled).toBe(false)
  })

  test('with 4 picked, no box is disabled and the limit sentence is hidden in its place (creator-analytics#1049)', async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(6)
    const { container } = await render(
      'retention?window=lifetime&curves=video-1,video-2,video-3,video-4',
    )
    const limit = container.querySelector('.comparison-limit')

    expect(pickBoxOf(container, 'Video 6').disabled).toBe(false)
    expect(limit && getComputedStyle(limit).visibility).toBe('hidden')
  })

  test('shows the backfill note while the refresh has uploads to read, and none once it has read them all', async () => {
    const api = installFakeApi()
    api.retentionUnread = 12
    const filling = await render('retention?window=lifetime')
    expect(filling.container.querySelector('.comparison-note')?.textContent).toMatch(/\b12\b/)
    filling.unmount()
    rendered = null

    api.retentionUnread = 0
    const filled = await render('retention?window=lifetime')
    expect(filled.container.querySelector('.comparison-note')).toBeNull()
  })

  test("a free channel's page shows the refusal once, in the chart's place, and lists no video", async () => {
    const api = installFakeApi()
    api.retentionRefusal = { error: 'sort_without_history' }
    const { container } = await render('retention?window=lifetime')

    expect(
      [...container.querySelectorAll('[role="alert"]')].map((each) => each.textContent),
    ).toEqual([comparisonText.refused])
    expect(container.querySelector('.comparison-chart-section [role="alert"]')).not.toBeNull()
    expect(container.querySelector('.comparison-chart')).toBeNull()
    expect(container.querySelectorAll('.comparison-videos li')).toHaveLength(0)
  })

  test('sends retention_curves_compared with the count when a pick draws a second curve, not on the first, and not on a load from the address', async () => {
    const api = installFakeApi()
    const videos = comparedVideos(3)
    api.videos = videos
    api.retentionCurves = videos.map((video) => storedCurveOf(video, 1))
    const shown = await render('retention?window=lifetime&curves=video-1,video-2')
    const compared = () =>
      vi
        .mocked(track)
        .mock.calls.map(([event]) => event)
        .filter(({ name }) => name === 'retention_curves_compared')

    // The load from the address drew 2 curves, and sent nothing.
    expect(compared()).toEqual([])
    await click(pickBoxOf(shown.container, 'Video 2'))
    expect(compared()).toEqual([])
    await click(pickBoxOf(shown.container, 'Video 3'))
    expect(compared()).toEqual([{ name: 'retention_curves_compared', count: 2 }])
    await click(pickBoxOf(shown.container, 'Video 2'))

    expect(compared()).toEqual([
      { name: 'retention_curves_compared', count: 2 },
      { name: 'retention_curves_compared', count: 3 },
    ])
  })

  test("the format and sort change the picker's list from its first page and keep the picks", async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(2)
    const shown = await render('retention?window=lifetime&page=2&curves=video-1')

    await chooseFormat(shown.container, 'Shorts')
    await choose(shown.container, comparisonText.sort, 'averageViewPercentage')

    expect(shown.address()).toBe(
      'retention?window=lifetime&sort=averageViewPercentage&format=short&curves=video-1',
    )
    const last = api.requests
      .filter(({ path }) => path === `/api/channels/${fakeChannel.id}/videos`)
      .at(-1)
    expect([last?.query.get('sort'), last?.query.get('format'), last?.query.get('page')]).toEqual([
      'averageViewPercentage',
      'short',
      '1',
    ])
  })

  test('a video YouTube has not processed yet says so in the picker, in place of its average viewed', async () => {
    const api = installFakeApi()
    const [processed, fresh] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [processed, { ...fresh, averageViewPercentage: 0, awaitingProcessing: true }]
    const { container } = await render('retention?window=lifetime')

    const rowOf = (title: string) => pickBoxOf(container, title).labels?.[0]?.textContent ?? ''
    expect(rowOf('Video 1')).toContain(
      `${averageViewedColumn.label} ${averageViewedColumn.textOf(processed)}`,
    )
    expect(rowOf('Video 2')).toContain(notProcessedText)
    expect(rowOf('Video 2')).not.toContain(averageViewedColumn.label)
  })

  test('a format with no video the chart can draw says Stillstats has read none, with no empty list', async () => {
    const api = installFakeApi()
    api.videos = []
    api.pageCount = 0
    const { container } = await render('retention?window=lifetime&format=live')

    const picker = container.querySelector('.comparison-picker')
    expect(picker?.querySelector('.comparison-videos')).toBeNull()
    expect(picker?.textContent).toContain(pickerText.noDrawable)
  })

  test('a page past the last moves to the last, replacing the address and keeping the picks', async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(2)
    api.pageCount = 2
    const push = vi.spyOn(window.history, 'pushState')
    try {
      const shown = await render('retention?window=lifetime&page=5&curves=video-1')

      expect(shown.address()).toBe('retention?window=lifetime&page=2&curves=video-1')
      expect(push).not.toHaveBeenCalled()
      const pages = api.requests
        .filter(({ path }) => path === `/api/channels/${fakeChannel.id}/videos`)
        .map(({ query }) => query.get('page'))
      expect(pages).toEqual(['5', '2'])
      expect(
        shown.container.querySelector('.comparison-picker .video-list-pager-place')?.textContent,
      ).toBe('Page 2 of 2')
    } finally {
      push.mockRestore()
    }
  })
  // creator-analytics#1044, from Nick's staging walk of PR #1032.
  test('the picker reads only the videos with a stored curve to draw, on open and after a control changes', async () => {
    const api = installFakeApi()
    const shown = await render('retention?window=lifetime')

    await chooseFormat(shown.container, 'Shorts')

    const lists = api.requests.filter(
      ({ path }) => path === `/api/channels/${fakeChannel.id}/videos`,
    )
    expect(lists.map(({ query }) => query.get('withRetentionCurve'))).toEqual(['true', 'true'])
  })

  test('"Clear all picks" clears every pick, one off the picker\'s page too, reads the curves with none, and stays in place, disabled (creator-analytics#1049)', async () => {
    const api = installFakeApi()
    const [first, second, offPage] = comparedVideos(3) as [VideoRow, VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(offPage, 1)]
    api.pageCount = 2
    const shown = await render('retention?window=lifetime&page=2&curves=video-3,video-1')
    const clear = clearPicksIn(shown.container)
    if (!clear) throw new Error('No "Clear all picks" button')

    await click(clear)

    expect(shown.address()).toBe('retention?window=lifetime&page=2')
    expect(curvesReadsOf(api).at(-1)).toBeNull()
    expect(isPicked(pickBoxOf(shown.container, 'Video 1'))).toBe(false)
    expect(clearPicksIn(shown.container)?.disabled).toBe(true)
    expect(document.activeElement?.textContent).toBe(comparisonText.pick)
  })

  test("a pick box toggles from its row's label and from Space, as the native box did", async () => {
    const api = installFakeApi()
    api.videos = comparedVideos(2)
    const shown = await render('retention?window=lifetime')

    await click(pickBoxOf(shown.container, 'Video 2').labels?.[0] ?? shown.container)
    expect(shown.address()).toBe('retention?window=lifetime&curves=video-2')
    await act(async () => pickBoxOf(shown.container, 'Video 1').focus())
    await pressToActivate(' ')

    expect(shown.address()).toBe('retention?window=lifetime&curves=video-2,video-1')
  })
})

/** The Audience screen's section headings, in the screen's order. */
const audienceSectionHeadings = [
  'Countries (engaged views)',
  'US states (engaged views)',
  'Cities (engaged views)',
  'Age (share of signed-in viewers)',
  'Gender (share of signed-in viewers)',
  'Devices (engaged views)',
  'Operating systems (engaged views)',
  'Subscribers and non-subscribers (engaged views)',
]

describe('the Audience screen', () => {
  test('names itself in one visually hidden h1, and shows a controls bar with the calendar windows, a custom range and the format (creator-analytics#350)', async () => {
    installFakeApi()
    const { container } = await render('audience')

    expect(
      [...container.querySelectorAll('h1')].map((each) => [each.textContent, each.className]),
    ).toEqual([[audienceHeading, 'visually-hidden']])
    expect(audienceHeading).toBe('Audience')
    expect([...selectNamed(container, 'Date range').options].map(({ value }) => value)).toEqual([
      'last7',
      'last28',
      'last90',
      'last365',
      'custom',
    ])
    const radios = radiosIn(formatGroup(container))
    expect(radios.map((each) => accessibleNameOf(each, true))).toEqual(
      formatFilterOptions.map(({ label }) => label),
    )
    expect(radioNamed(formatGroup(container), 'All').getAttribute('aria-checked')).toBe('true')
  })

  test('sends no event when the sidebar opens it, nor on a change in its bar', async () => {
    installFakeApi()
    const { container } = await render()
    vi.mocked(track).mockClear()

    await click(sidebarLink(container, audienceLinkText))
    await choose(container, 'Date range', 'last90')
    await chooseFormat(container, 'Shorts')

    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test('on view, reads the Audience answer for the last 28 days and shows its countries under "Countries (engaged views)"', async () => {
    const api = installFakeApi()
    const { container } = await render('audience')

    expect(audienceReadsOf(api).map((query) => query.get('window'))).toEqual(['last28'])
    expect(countryNamesIn(container)).toEqual(['United States', 'India', 'Germany'])
  })

  test("on view, shows the answer's US states and cities under their headings, after the countries", async () => {
    const api = installFakeApi()
    api.usStates = [
      { code: 'US-CA', engagedViews: 557, views: 800 },
      { code: 'US-DC', engagedViews: 120, views: 150 },
    ]
    api.cities = [
      { name: 'Mumbai', engagedViews: 300, views: 600 },
      { name: 'Chicago', engagedViews: 120, views: 200 },
    ]
    const { container } = await render('audience')

    expect([...container.querySelectorAll('section > h2')].map((each) => each.textContent)).toEqual(
      audienceSectionHeadings,
    )
    expect(barNamesUnder(container, 'US states (engaged views)')).toEqual([
      'California',
      'Washington, D.C.',
    ])
    expect(barNamesUnder(container, 'Cities (engaged views)')).toEqual(['Mumbai', 'Chicago'])
  })

  // creator-analytics#350: a card is found by the heading's ancestor that shadcn's Card marks, never
  // by a class, so a restyle that keeps the Card keeps the test. happy-dom lays nothing out, so the
  // cards stay in the one column in DOM order they render in before they are measured; the browser
  // walk checks the packing by height (creator-analytics#711).
  test('on view, puts each section in a card of its own, and the eight cards in DOM order in one column before any layout packs them, in the order and under the headings above', async () => {
    installFakeApi()
    const { container } = await render('audience')
    const headings = [...container.querySelectorAll('h2')]
    const cards = headings.map((heading) => heading.closest('[data-slot="card"]'))

    expect(headings.map((heading) => heading.textContent)).toEqual(audienceSectionHeadings)
    expect(cards.map((card) => card?.querySelectorAll('h2').length)).toEqual(
      audienceSectionHeadings.map(() => 1),
    )
    expect(new Set(cards.map((card) => card?.parentElement)).size).toBe(1)
    expect([...(cards[0]?.parentElement?.children ?? [])]).toEqual(cards)
  })

  test('with no numbers in any section, each section keeps its card, its heading and its no numbers text', async () => {
    const api = installFakeApi()
    api.countries = []
    api.usStates = []
    api.cities = []
    api.ageGroups = []
    api.genders = []
    api.devices = []
    api.operatingSystems = []
    api.subscriberSplit = null
    const { container } = await render('audience')
    const cards = [...container.querySelectorAll('[data-slot="card"]')]

    expect(
      cards.map((card) => [
        card.querySelector('h2')?.textContent,
        [...card.querySelectorAll('p')].map((each) => each.textContent),
      ]),
    ).toEqual(audienceSectionHeadings.map((heading) => [heading, [noNumbersText]]))
  })

  test("on view, shows the answer's age groups and genders under their headings", async () => {
    const api = installFakeApi()
    api.ageGroups = [
      { ageGroup: 'age25-34', viewerPercentage: 40.3 },
      { ageGroup: 'age18-24', viewerPercentage: 31.4 },
    ]
    api.genders = [
      { gender: 'male', viewerPercentage: 81.6 },
      { gender: 'female', viewerPercentage: 18.4 },
    ]
    const { container } = await render('audience')

    expect(barNamesUnder(container, 'Age (share of signed-in viewers)')).toEqual([
      '18 to 24',
      '25 to 34',
    ])
    expect(barNamesUnder(container, 'Gender (share of signed-in viewers)')).toEqual([
      'Female',
      'Male',
    ])
  })

  test('reads its answer again for a new window', async () => {
    const api = installFakeApi()
    const { container } = await render('audience')

    api.countries = [{ code: 'FR', engagedViews: 10, views: 20 }]
    await choose(container, 'Date range', 'last90')

    expect(audienceReadsOf(api).map((query) => query.get('window'))).toEqual(['last28', 'last90'])
    expect(countryNamesIn(container)).toEqual(['France'])
  })

  test('reads its answer again for a new format', async () => {
    const api = installFakeApi()
    const { container } = await render('audience')

    api.countries = [{ code: 'FR', engagedViews: 10, views: 20 }]
    await chooseFormat(container, 'Shorts')

    expect(audienceReadsOf(api).map((query) => query.get('format'))).toEqual([null, 'short'])
    expect(countryNamesIn(container)).toEqual(['France'])
  })

  test(`with a format chosen, says "${everyFormatText}" under the US states and the cities`, async () => {
    installFakeApi()
    const { container } = await render('audience')
    const headings = ['US states (engaged views)', 'Cities (engaged views)']

    expect(
      headings.map((heading) => notesUnder(container, heading).includes(everyFormatText)),
    ).toEqual([false, false])
    await chooseFormat(container, 'Shorts')

    expect(
      headings.map((heading) => notesUnder(container, heading).includes(everyFormatText)),
    ).toEqual([true, true])
  })

  test('stays on view after a channel switch, for the new channel', async () => {
    const api = installFakeApi()
    const secondChannel: ListedChannel = { ...fakeChannel, id: 'c-2', title: 'Second channel' }
    api.channels = [fakeChannel, secondChannel]
    const shown = await render('audience')

    await pickInSidebar(shown.container, 'Second channel')

    expect(shown.address()).toBe(`audience?channel=${secondChannel.id}`)
    expect([...shown.container.querySelectorAll('h1')].map((each) => each.textContent)).toContain(
      audienceHeading,
    )
  })
})

describe('the four selects, found by role and name', () => {
  const secondChannel: ListedChannel = { ...fakeChannel, id: 'c-2', title: 'Second channel' }

  test('Channel, with two channels, puts the picked channel in the address and sends no event', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, secondChannel]
    const shown = await render()
    vi.mocked(track).mockClear()

    await pickInSidebar(shown.container, 'Second channel')

    expect(new URLSearchParams(shown.address()).get('channel')).toBe(secondChannel.id)
    expect(vi.mocked(track).mock.calls).toEqual([])
  })

  test('Channel is not on view with one channel', async () => {
    installFakeApi()
    const { container } = await render()

    expect(comboboxesNamed(container, 'Date range')).toHaveLength(1)
    expect(comboboxesNamed(container, 'Channel')).toEqual([])
    expect(sidebarPickersIn(container)).toEqual([])
  })

  test('Date range on the channel screen puts the window in the address and sends video_window_changed', async () => {
    installFakeApi()
    const shown = await render()
    vi.mocked(track).mockClear()

    await choose(shown.container, 'Date range', 'last90')

    expect(new URLSearchParams(shown.address()).get('window')).toBe('last90')
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'video_window_changed', window: 'last90' }],
    ])
  })

  test('Currency on Settings shows the picked currency, says it is saved, and sends currency_changed', async () => {
    installFakeApi()
    const { container } = await render('settings')
    vi.mocked(track).mockClear()

    await choose(container, 'Currency', 'EUR')

    expect(selectNamed(container, 'Currency').value).toBe('EUR')
    expect(toastText()).toBe(currencySavedNotice)
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'currency_changed', currency: 'EUR' }]])
  })

  test('Videos per page puts the size in the address and sends page_size_changed', async () => {
    installFakeApi()
    const shown = await render()
    vi.mocked(track).mockClear()

    await choose(shown.container, 'Videos per page', '25')

    expect(new URLSearchParams(shown.address()).get('pageSize')).toBe('25')
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'page_size_changed', size: 25 }]])
  })

  test('a name no select has finds none, and the find throws', async () => {
    installFakeApi()
    const { container } = await render()

    expect(comboboxesNamed(container, 'Date')).toEqual([])
    expect(() => selectNamed(container, 'Date')).toThrow('0 comboboxes named Date, not 1')
  })
})

// creator-analytics#589: the profile became Settings. Stripe's Payment Link still returns to
// /app/profile?support=thanks, so the old path opens Settings with the route's query and takes its
// own history entry's place.
describe('the Settings screen at its old profile address', () => {
  function headingText(container: HTMLElement): string | null | undefined {
    return container.querySelector('h1')?.textContent
  }

  function thanksLines(container: HTMLElement): string[] {
    return [...container.querySelectorAll('p')]
      .map((each) => each.textContent ?? '')
      .filter((text) => text === supportThanksText)
  }

  test.each([
    ['profile', 'settings', []],
    ['profile?support=thanks', 'settings', [supportThanksText]],
    ['profile?channel=c-2&window=last90', 'settings?channel=c-2&window=last90', []],
  ])(
    'the address %o opens Settings at %o, replacing the history entry, with the thanks line %o',
    async (old, settings, thanks) => {
      const api = installFakeApi()
      api.channels = [fakeChannel, { ...fakeChannel, id: 'c-2', title: 'Second channel' }]
      const push = vi.spyOn(window.history, 'pushState')
      const entries = window.history.length

      try {
        const { container, address } = await render(old)

        expect(address()).toBe(settings)
        expect(headingText(container)).toBe('Settings')
        expect(push).not.toHaveBeenCalled()
        expect(window.history.length).toBe(entries)
        expect(thanksLines(container)).toEqual(thanks)
      } finally {
        push.mockRestore()
      }
    },
  )
})

describe('the event the Settings screen sends', () => {
  test.each(['settings', 'profile'])(
    'opened at %o under StrictMode, is settings_opened once, and profile_opened never',
    async (address) => {
      installFakeApi()
      vi.mocked(track).mockClear()

      await render(address)

      const names = vi.mocked(track).mock.calls.map(([event]) => event.name)
      expect(names.filter((name) => name === 'settings_opened')).toEqual(['settings_opened'])
      expect(names).not.toContain('profile_opened')
    },
  )
})

describe("the Settings screen's Support section", () => {
  const link = 'https://buy.stripe.com/test_00g3cd?client_reference_id=user-1'

  function supportHeadingIn(container: HTMLElement): HTMLHeadingElement | undefined {
    return [...container.querySelectorAll('h2')].find((each) => each.textContent === supportHeading)
  }

  function tipLinks(container: HTMLElement): HTMLAnchorElement[] {
    return [...container.querySelectorAll('a')].filter(
      (each) => each.textContent === supportLinkText,
    )
  }

  test('shows with a link to the Payment Link when the support answer has one', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render('settings')

    expect(supportHeadingIn(container)).toBeDefined()
    expect(tipLinks(container).map((each) => each.getAttribute('href'))).toEqual([link])
  })

  test('is absent when the support answer has no link', async () => {
    installFakeApi()
    const { container } = await render('settings')

    expect(supportHeadingIn(container)).toBeUndefined()
    expect(tipLinks(container)).toEqual([])
  })

  test("opens the tip in a new tab, as the sidebar's link does, and a click sends support_opened from Settings alone", async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render('settings')
    const [tip] = tipLinks(container)
    if (!tip) throw new Error('No tip link on view')
    vi.mocked(track).mockClear()
    // happy-dom follows a link no handler prevented, so the test prevents it, after recording
    // whether the app left the default to the browser.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)

    try {
      await click(tip)
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'support_opened', surface: 'settings' }]])
    expect(leftToTheBrowser).toBe(true)
    expect({ target: tip.getAttribute('target'), rel: tip.getAttribute('rel') }).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  test.each([
    ['shows', 'settings?support=thanks', [supportThanksText]],
    ['does not show', 'settings', []],
  ])('%s the thanks line for the address %o', async (_shows, address, lines) => {
    installFakeApi()
    const { container } = await render(address)

    expect(
      [...container.querySelectorAll('p')]
        .map((each) => each.textContent)
        .filter((text) => text === supportThanksText),
    ).toEqual(lines)
  })
})

describe("the Settings screen's Pro section (creator-analytics#780, stillstats#20)", () => {
  const subscribeButtons = (container: HTMLElement) =>
    [subscribeTexts.monthly, subscribeTexts.annual].flatMap((name) => buttonsNamed(container, name))

  const memberChannel: ListedChannel = { ...fakeChannel, id: 'c-3', title: 'A channel of others' }

  /** The line under each channel on Settings that says whether it is Pro, or null for none. */
  const tierLinesIn = (container: HTMLElement) =>
    [...container.querySelectorAll('.channel')].map(
      (channel) => channel.querySelector('.channel-tier')?.textContent ?? null,
    )

  /** The Pro section, found by its heading, or null with none on view. */
  const proSectionIn = (container: HTMLElement) =>
    [...container.querySelectorAll('section')].find(
      (section) => section.querySelector('h2')?.textContent === proHeading,
    ) ?? null

  test('shows Pro or Free under each channel the user owns and nothing under one they do not, and the slots in use of their blocks', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel, memberChannel]
    api.entitlements = entitlementsOf(
      subscribedToOneBlock,
      { channelId: fakeChannel.id, tier: 'paid', canManage: true },
      { channelId: anotherChannel.id, tier: 'free' },
      { channelId: memberChannel.id, tier: 'free', owner: false },
    )
    const { container } = await render('settings')

    expect(tierLinesIn(container)).toEqual([channelTierTexts.paid, channelTierTexts.free, null])
    const section = proSectionIn(container)
    expect([...(section?.querySelectorAll('p') ?? [])].map((p) => p.textContent)).toEqual([
      '1 of 4 slots in use',
    ])
    expect(subscribeButtons(container)).toEqual([])
    expect(
      [...(section?.querySelectorAll('button') ?? [])].map(({ textContent }) => textContent),
    ).toEqual([manageSubscriptionText])
  })

  test('shows one button for each plan, and no slots, while the user may subscribe', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    api.entitlements = entitlementsOf(
      { canSubscribe: true },
      { channelId: fakeChannel.id, tier: 'free', canSubscribe: true },
      { channelId: anotherChannel.id, tier: 'free', canSubscribe: true },
    )
    const { container } = await render('settings')

    expect(subscribeButtons(container).map((each) => each.textContent)).toEqual([
      subscribeTexts.monthly,
      subscribeTexts.annual,
    ])
    expect(proSectionIn(container)?.querySelectorAll('p')).toHaveLength(0)
    expect(buttonsNamed(container, manageSubscriptionText)).toEqual([])
  })

  test.for(['monthly', 'annual'] as const)(
    "a click on %s sends checkout_started with the plan alone, and goes to the user's Checkout the API answers",
    async (plan) => {
      const api = installFakeApi()
      api.entitlements = entitlementsOf(
        { canSubscribe: true },
        { channelId: fakeChannel.id, tier: 'free', canSubscribe: true },
      )
      const { container } = await render('settings')
      const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
      vi.mocked(track).mockClear()

      try {
        await click(buttonNamed(container, subscribeTexts[plan]))

        expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'checkout_started', plan }]])
        expect(
          api.requests
            .filter(({ method }) => method === 'POST')
            .map(({ path, body }) => ({ path, body })),
        ).toEqual([{ path: '/api/me/checkout', body: { plan } }])
        expect(assign.mock.calls).toEqual([[fakeCheckoutUrl]])
      } finally {
        assign.mockRestore()
      }
    },
  )
})

describe("the sidebar's support item", () => {
  const link = 'https://buy.stripe.com/test_00g3cd?client_reference_id=user-1'

  /**
   * The sidebar's support link and the button that hides it, the x from 48rem and "Hide" below,
   * or undefined for each that is absent.
   */
  function supportItemIn(container: HTMLElement) {
    const sidebar = sidebarIn(container)
    return {
      link: [...(sidebar?.querySelectorAll('a') ?? [])].find(
        (each) => each.textContent === supportHeading,
      ),
      hide: [...(sidebar?.querySelectorAll('button') ?? [])].find(
        (each) => each.getAttribute('aria-label') === hideSupportLabel,
      ),
    }
  }

  test('shows a link to the support link in a new tab and a button to hide it when the prompt shows', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()

    const item = supportItemIn(container)
    expect(item.link?.getAttribute('href')).toBe(link)
    expect({
      target: item.link?.getAttribute('target'),
      rel: item.link?.getAttribute('rel'),
    }).toEqual({ target: '_blank', rel: 'noopener noreferrer' })
    expect(item.hide?.type).toBe('button')
  })

  test.each([
    ['the prompt is off', { link, prompt: false }],
    ['the link is null', { link: null, prompt: false }],
  ])('is absent while the sidebar shows when %s', async (_when, support) => {
    const api = installFakeApi()
    api.support = support
    const { container } = await render()

    expect(sidebarIn(container)).not.toBeNull()
    expect(supportItemIn(container)).toEqual({ link: undefined, hide: undefined })
  })

  // The support answer already says whether the prompt was dismissed, so the item never waits on
  // the preferences read, and a failed one leaves it for a creator who never dismissed it
  // (creator-analytics#907 re-review).
  test('still shows after a failed preferences read, for a creator who never dismissed it', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    // StrictMode sends each read twice.
    for (let read = 0; read < 2; read += 1) api.failNext('GET /api/me/preferences')
    const { container } = await render()

    expect(supportItemIn(container).link?.getAttribute('href')).toBe(link)
  })

  test('is absent for a creator with no channel, whom the sidebar does not show', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    api.channels = []
    const { container } = await render()

    expect(sidebarIn(container)).toBeNull()
    expect(container.textContent).not.toContain(hideSupportText)
  })

  test('its hide button sends the dismissal, removes the item at once and tracks support_prompt_dismissed', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()
    const { hide } = supportItemIn(container)
    if (!hide) throw new Error('No hide button on view')
    vi.mocked(track).mockClear()
    const before = api.requests.length

    await click(hide)

    expect(
      api.requests
        .slice(before)
        .filter(({ method, path }) => `${method} ${path}` === savePreferences)
        .map(({ body }) => body),
    ).toEqual([{ supportPromptDismissed: true }])
    expect(supportItemIn(container)).toEqual({ link: undefined, hide: undefined })
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'support_prompt_dismissed' }]])
  })

  test("its hide button leaves focus on the sidebar's nav", async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()
    const { hide } = supportItemIn(container)
    if (!hide) throw new Error('No hide button on view')
    hide.focus()

    await click(hide)

    expect(document.activeElement).toBe(sidebarNavIn(container))
  })

  test('a click on the link is left to the browser and tracks support_opened from the sidebar', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()
    const { link: sidebarSupport } = supportItemIn(container)
    if (!sidebarSupport) throw new Error('No sidebar support link on view')
    vi.mocked(track).mockClear()
    // happy-dom follows a link no handler prevented, so the test prevents it, after recording
    // whether the app left the default to the browser.
    let leftToTheBrowser = false
    const keepPage = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', keepPage)

    try {
      await click(sidebarSupport)
    } finally {
      document.removeEventListener('click', keepPage)
    }

    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'support_opened', surface: 'sidebar' }]])
    expect(leftToTheBrowser).toBe(true)
  })

  test("a failed save of its hide button brings the item back with the failed save's notice", async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()
    const { hide } = supportItemIn(container)
    if (!hide) throw new Error('No hide button on view')
    const held = api.hold(savePreferences)

    await click(hide)
    // The item comes back only after it went.
    expect(supportItemIn(container).hide).toBeUndefined()
    await act(async () => held.fail())
    await settle()

    expect(supportItemIn(container).link?.getAttribute('href')).toBe(link)
    expect(toastText()).toBe(failedSaveNotice)
  })

  test('"Reset preferences" brings back an item dismissed before the screen opened', async () => {
    const api = installFakeApi({ supportPromptDismissed: true })
    api.support = { link, prompt: true }
    const shown = await render('settings')
    // The item comes back only after it was absent.
    expect(supportItemIn(shown.container).hide).toBeUndefined()
    const before = api.requests.length

    await click(buttonNamed(shown.container, 'Reset preferences'))

    const after = api.requests.slice(before).map(({ method, path }) => `${method} ${path}`)
    expect(after.indexOf('GET /api/me/support')).toBeGreaterThan(
      after.indexOf('DELETE /api/me/preferences'),
    )
    expect(after.indexOf('DELETE /api/me/preferences')).toBeGreaterThanOrEqual(0)
    expect(supportItemIn(shown.container).link?.getAttribute('href')).toBe(link)
  })

  /** Sets the page's visibility and sends the event a browser sends when it changes. */
  async function becomeVisible(visibility: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { value: visibility, configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await settle()
  }

  test("goes once the tab is on view again and the support answer, read again, has the tip recorded: the tip's return opened a new tab", async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const { container } = await render()
    // It goes only after it showed.
    expect(supportItemIn(container).link?.getAttribute('href')).toBe(link)
    api.support = { link, prompt: false }

    try {
      await becomeVisible('visible')
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
    }

    expect(supportItemIn(container)).toEqual({ link: undefined, hide: undefined })
  })

  test('reads nothing while the tab is hidden', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    await render()
    const before = api.requests.length

    try {
      await becomeVisible('hidden')
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
    }

    expect(api.requests.slice(before)).toEqual([])
  })

  test('"Reset preferences" brings back an item hidden on this screen', async () => {
    const api = installFakeApi()
    api.support = { link, prompt: true }
    const shown = await render('settings')
    const { hide } = supportItemIn(shown.container)
    if (!hide) throw new Error('No hide button on view')
    await click(hide)
    // The item comes back only after it went.
    expect(supportItemIn(shown.container).hide).toBeUndefined()

    await click(buttonNamed(shown.container, 'Reset preferences'))

    expect(supportItemIn(shown.container).link?.getAttribute('href')).toBe(link)
  })
})

/** The feedback messages the app posted, their bodies in order. */
function feedbackSentTo(api: FakeApi): unknown[] {
  return api.requests
    .filter(({ method, path }) => `${method} ${path}` === 'POST /api/feedback')
    .map(({ body }) => body)
}

/** The control a `<label>` with this text names through its `for`. */
function controlLabelled<E extends HTMLElement>(container: HTMLElement, text: string): E {
  const label = [...container.querySelectorAll('label')].find(
    (each) => each.textContent?.trim() === text,
  )
  const control = label?.htmlFor ? container.ownerDocument.getElementById(label.htmlFor) : null
  if (!control) throw new Error(`No control labelled ${text}`)
  return control as E
}

/**
 * Types `text` into a field as a browser does: through the element's native value setter, which
 * React's change tracking reads, then an input event.
 */
async function typeInto(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const prototype = Object.getPrototypeOf(field) as object
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  await act(async () => {
    setter?.call(field, text)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}

function feedbackTypeGroupIn(container: HTMLElement): HTMLElement {
  return groupNamed(container, 'radiogroup', feedbackTypeLabel)
}

function feedbackTextIn(container: HTMLElement): HTMLTextAreaElement {
  return controlLabelled(container, feedbackTextLabel)
}

function replyBoxIn(container: HTMLElement): HTMLInputElement {
  return controlLabelled(container, replyCheckboxText)
}

function replyAddressIn(container: HTMLElement): HTMLInputElement {
  return controlLabelled(container, replyAddressLabel)
}

/** The live region that holds the counter, and its text. */
function counterIn(container: HTMLElement): { live: string | null; text: string } {
  const counter = container.querySelector('.feedback-counter')
  if (!counter) throw new Error('No counter region')
  return { live: counter.getAttribute('aria-live'), text: counter.textContent ?? '' }
}

/** The one signed number in the counter's text, so a test reads the count without pinning copy. */
function countIn(text: string): number | null {
  const counts = text.match(/-?\d+/g) ?? []
  return counts.length === 1 ? Number(counts[0]) : null
}

/** The counter's text with its number taken out: the form it took, under the limit or past it. */
function formOf(text: string): string {
  return text.replace(/-?\d+/g, '#')
}

/** Fills the form with a type and a text, as a creator does before a send. */
async function fillFeedback(container: HTMLElement, type: string, text: string) {
  await click(radioNamed(feedbackTypeGroupIn(container), type))
  await typeInto(feedbackTextIn(container), text)
}

describe("the sidebar's Upgrade item (creator-analytics#907)", () => {
  /** The entitlements answer for the channel: Pro offered unless said, free, owned. */
  function entitled(
    api: FakeApi,
    channel: Partial<Pick<ChannelEntitlement, 'tier' | 'canSubscribe'>> = {},
    paidTierOffered = true,
  ) {
    const tier = channel.tier ?? 'free'
    const canSubscribe = channel.canSubscribe ?? (paidTierOffered && tier === 'free')
    api.entitlements = entitlementsOf(
      { paidTierOffered, canSubscribe },
      { channelId: fakeChannel.id, tier, canSubscribe },
    )
  }

  /** The item's link and its hide button in `within`, or undefined for each that is absent. */
  function upgradeItemIn(within: HTMLElement | null) {
    return {
      link: [...(within?.querySelectorAll('a') ?? [])].find(
        (each) => each.textContent === upgradeLinkText,
      ),
      hide: [...(within?.querySelectorAll('button') ?? [])].find(
        (each) => each.getAttribute('aria-label') === hideUpgradeLabel,
      ),
    }
  }

  const absent = { link: undefined, hide: undefined }
  const query = `?channel=${fakeChannel.id}&window=last90`

  test("shows the owner of a free channel a link to the upgrade screen for the channel on view, keeping the list's query, and a button to hide it", async () => {
    const api = installFakeApi()
    entitled(api)
    const { container } = await render(query)

    const item = upgradeItemIn(sidebarIn(container))
    expect(item.link?.getAttribute('href')).toBe(`/upgrade${query}`)
    expect(item.link?.getAttribute('target')).toBeNull()
    expect(item.hide?.type).toBe('button')
  })

  test.each([
    ['a paid channel', { tier: 'paid' as const, canSubscribe: false }, true],
    ['a free channel the creator does not own', { canSubscribe: false }, true],
    ['a free channel with Pro not offered', {}, false],
  ])('is absent while the sidebar shows for %s', async (_who, channel, offered) => {
    const api = installFakeApi()
    entitled(api, channel, offered)
    const { container } = await render()

    expect(sidebarIn(container)).not.toBeNull()
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)
  })

  test('is absent until the entitlements answer lands, and after a failed read of it', async () => {
    const api = installFakeApi()
    entitled(api)
    // StrictMode sends each read twice.
    const reads = [api.hold('GET /api/me/entitlements'), api.hold('GET /api/me/entitlements')]
    const { container } = await render()
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)

    await act(async () => {
      for (const read of reads) read.fail()
    })
    await settle()

    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)
    expect(alertOf(container)).toBeNull()
  })

  test('follows the channel on view: shown on the free channel the creator owns, absent on the one they do not', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    api.entitlements = entitlementsOf(
      { canSubscribe: true },
      { channelId: fakeChannel.id, tier: 'free', canSubscribe: true },
      { channelId: anotherChannel.id, tier: 'free', owner: false },
    )
    const owned = await render(`?channel=${fakeChannel.id}`)
    expect(upgradeItemIn(sidebarIn(owned.container)).link).toBeDefined()
    owned.unmount()

    const notOwned = await render(`?channel=${anotherChannel.id}`)

    expect(upgradeItemIn(sidebarIn(notOwned.container))).toEqual(absent)
  })

  test('a click opens the upgrade screen in place for the channel on view and sends upgrade_link_clicked from the sidebar', async () => {
    const api = installFakeApi()
    entitled(api)
    api.upgrade = {
      historyStart: '2026-08-09',
      newestDay: '2026-10-03',
      comparisons: [
        { window: 'first7', count: 2, availableOn: null },
        { window: 'first28', count: 2, availableOn: null },
      ],
      prices: fakePrices,
    }
    const shown = await render(query)
    const { link } = upgradeItemIn(sidebarIn(shown.container))
    if (!link) throw new Error('No Upgrade item on view')
    vi.mocked(track).mockClear()

    await click(link)

    expect(shown.address()).toBe(`upgrade${query}`)
    expect(shown.container.querySelector('h1')?.textContent).toBe(upgradeText.heading)
    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'upgrade_link_clicked', source: 'sidebar' }],
      [{ name: 'upgrade_screen_viewed' }],
    ])
    expect(upgradeItemIn(sidebarIn(shown.container)).link?.getAttribute('aria-current')).toBe(
      'page',
    )
  })

  test('its hide button saves the dismissal, removes the item at once, leaves focus on the nav and sends upgrade_prompt_dismissed', async () => {
    const api = installFakeApi()
    entitled(api)
    const { container } = await render()
    const { hide } = upgradeItemIn(sidebarIn(container))
    if (!hide) throw new Error('No hide button on view')
    hide.focus()
    vi.mocked(track).mockClear()
    const before = api.requests.length

    await click(hide)

    expect(
      api.requests
        .slice(before)
        .filter(({ method, path }) => `${method} ${path}` === savePreferences)
        .map(({ body }) => body),
    ).toEqual([{ upgradePromptDismissed: true }])
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)
    expect(document.activeElement).toBe(sidebarNavIn(container))
    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'upgrade_prompt_dismissed' }]])
  })

  // The reload reads the dismissal back from the server. While that read is out the channel on view
  // waits on it, so no channel's item shows either way; once it lands the dismissal keeps it absent.
  test('stays hidden after a reload once hidden, once the preferences read lands', async () => {
    const api = installFakeApi()
    entitled(api)
    const first = await render()
    const { hide } = upgradeItemIn(sidebarIn(first.container))
    if (!hide) throw new Error('No hide button on view')
    await click(hide)
    first.unmount()
    expect(api.preferences).toEqual({ upgradePromptDismissed: true })

    const reads = holdBoth(api, 'GET /api/me/preferences')
    const reloaded = await render()
    expect(sidebarIn(reloaded.container)).not.toBeNull()
    const whileRead = upgradeItemIn(sidebarIn(reloaded.container))
    await act(async () => reads.release())
    await settle()

    expect(whileRead).toEqual(absent)
    expect(upgradeItemIn(sidebarIn(reloaded.container))).toEqual(absent)
  })

  test('for a creator who hid it, is absent once the preferences read lands, as while the channel on view waits on it', async () => {
    const api = installFakeApi({ upgradePromptDismissed: true })
    entitled(api)
    const reads = holdBoth(api, 'GET /api/me/preferences')
    const { container } = await render()
    const whileRead = upgradeItemIn(sidebarIn(container))
    await act(async () => reads.release())
    await settle()

    expect(whileRead).toEqual(absent)
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)
  })

  test('for a creator who has not hidden it, shows once the preferences read lands, and not while the channel on view waits on it', async () => {
    const api = installFakeApi()
    entitled(api)
    const reads = holdBoth(api, 'GET /api/me/preferences')
    const { container } = await render()
    const whileRead = upgradeItemIn(sidebarIn(container))
    await act(async () => reads.release())
    await settle()

    expect(whileRead).toEqual(absent)
    expect(upgradeItemIn(sidebarIn(container)).link).toBeDefined()
  })

  // A failed read cannot tell whether the creator hid it, so it stays hidden for the visit.
  test('is absent after a failed preferences read, for a creator who hid it', async () => {
    const api = installFakeApi({ upgradePromptDismissed: true })
    entitled(api)
    // StrictMode sends each read twice.
    for (let read = 0; read < 2; read += 1) api.failNext('GET /api/me/preferences')
    const { container } = await render()

    expect(sidebarIn(container)).not.toBeNull()
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)
  })

  // A failed read leaves the dismissal unknown; a reset clears it on the server, so the item is due.
  test('after a failed preferences read, "Reset preferences" on Settings brings the item back', async () => {
    const api = installFakeApi({ upgradePromptDismissed: true })
    entitled(api)
    for (let read = 0; read < 2; read += 1) api.failNext('GET /api/me/preferences')
    const { container } = await render('settings')
    // It comes back only after it was absent.
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)

    await click(buttonNamed(container, 'Reset preferences'))

    expect(api.preferences).toEqual({})
    expect(upgradeItemIn(sidebarIn(container)).link).toBeDefined()
  })

  test("a failed save of its hide button brings the item back with the failed save's notice", async () => {
    const api = installFakeApi()
    entitled(api)
    const { container } = await render()
    const { hide } = upgradeItemIn(sidebarIn(container))
    if (!hide) throw new Error('No hide button on view')
    const held = api.hold(savePreferences)

    await click(hide)
    // The item comes back only after it went.
    expect(upgradeItemIn(sidebarIn(container)).hide).toBeUndefined()
    await act(async () => held.fail())
    await settle()

    expect(upgradeItemIn(sidebarIn(container)).link).toBeDefined()
    expect(toastText()).toBe(failedSaveNotice)
  })

  test('"Reset preferences" brings back an item dismissed before the screen opened', async () => {
    const api = installFakeApi({ upgradePromptDismissed: true })
    entitled(api)
    const { container } = await render('settings')
    // The item comes back only after it was absent.
    expect(upgradeItemIn(sidebarIn(container))).toEqual(absent)

    await click(buttonNamed(container, 'Reset preferences'))

    expect(upgradeItemIn(sidebarIn(container)).link).toBeDefined()
  })

  test('the support item and the Upgrade item hide apart', async () => {
    const api = installFakeApi({ supportPromptDismissed: true })
    entitled(api)
    api.support = { link: 'https://buy.stripe.com/test_00g3cd', prompt: true }
    const { container } = await render()

    expect(upgradeItemIn(sidebarIn(container)).link).toBeDefined()
    expect(sidebarIn(container)?.textContent).not.toContain(supportHeading)
  })

  test('collapsed, the item keeps its icon link and its name, and shows no hide button', async () => {
    const api = installFakeApi({ sidebarOpen: false })
    entitled(api)
    const { container } = await render()

    const { link, hide } = upgradeItemIn(sidebarIn(container))
    expect(link?.getAttribute('href')).toBe('/upgrade')
    expect(hide).toBeUndefined()
  })

  test('is absent for a creator with no channel, whom the sidebar does not show', async () => {
    const api = installFakeApi()
    entitled(api)
    api.channels = []
    const { container } = await render()

    expect(sidebarIn(container)).toBeNull()
    expect(container.textContent).not.toContain(upgradeLinkText)
  })

  describe("in the header's Menu below 48rem", () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    test('shows the item with its "Hide"; a click opens the upgrade screen, closes the panel and sends upgrade_link_clicked from the menu', async () => {
      const api = installFakeApi()
      entitled(api)
      const shown = await render(query)
      const panel = await openMenuPanel(shown.container)
      const { link, hide } = upgradeItemIn(panel)
      if (!link) throw new Error('No Upgrade item in the Menu panel')
      expect(link.getAttribute('href')).toBe(`/upgrade${query}`)
      expect(hide?.textContent).toBe(hideSupportText)
      vi.mocked(track).mockClear()

      await click(link)

      expect(shown.address()).toBe(`upgrade${query}`)
      expect(menuStateIn(shown.container)).toEqual(menuClosed)
      expect(vi.mocked(track).mock.calls[0]).toEqual([
        { name: 'upgrade_link_clicked', source: 'menu' },
      ])
    })

    test('its "Hide" removes the item, sends upgrade_prompt_dismissed, and the panel stays open with focus on its nav', async () => {
      const api = installFakeApi()
      entitled(api)
      const { container } = await render()
      const panel = await openMenuPanel(container)
      const hide = buttonLabelled(panel, hideUpgradeLabel)
      hide.focus()
      vi.mocked(track).mockClear()

      await click(hide)

      expect(upgradeItemIn(panel)).toEqual(absent)
      expect(api.preferences).toEqual({ upgradePromptDismissed: true })
      expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'upgrade_prompt_dismissed' }]])
      expect(menuStateIn(container)).toEqual(menuOpen)
      expect(document.activeElement).toBe(menuNavIn(panel))
    })

    test('is absent from the panel for a paid channel', async () => {
      const api = installFakeApi()
      entitled(api, { tier: 'paid', canSubscribe: false })
      const { container } = await render()

      expect(upgradeItemIn(await openMenuPanel(container))).toEqual(absent)
    })
  })
})

// creator-analytics#907: the homepage's "Subscribe" opens /app/upgrade, which a signed-out visitor
// reaches through the web app's sign-in and a new one through the connect step too. The API's
// sign-in and connect tests follow the redirects; these show what the web app asks for.
describe('the way to the upgrade screen from the homepage (creator-analytics#907)', () => {
  /** The POSTs the app made since `before`, each as its path and query. */
  function postsSince(api: FakeApi, before: number): string[] {
    return api.requests
      .slice(before)
      .filter(({ method }) => method === 'POST')
      .map(({ path, query }) => `${path}${query.size > 0 ? `?${query}` : ''}`)
  }

  /** Renders the app at `address` for a visitor the API answers 401. */
  async function renderSignedOut(api: FakeApi, address: string) {
    // StrictMode reads the session twice.
    for (let read = 0; read < 2; read += 1) {
      api.failNext('GET /api/me', { status: 401, body: { error: 'unauthenticated' } })
    }
    return render(address)
  }

  // Its sign-in takes a new visitor straight on to Google's connect consent, so the screen must
  // say what the connection reads first, as the signed-out screen does at /app (review of
  // creator-analytics#907).
  test('signed out on the upgrade screen, the sign-in screen carries the connection consent text, word for word, and the Terms line', async () => {
    const api = installFakeApi()
    const { container } = await renderSignedOut(api, 'upgrade')

    const section = container.querySelector('section.consent')
    expect({
      heading: section?.querySelector('h2')?.textContent,
      paragraphs: [...(section?.querySelectorAll('p') ?? [])].map(({ textContent }) => textContent),
      signIn: buttonNamed(container, 'Sign in with Google').type,
      terms: container.querySelector('p.notice a[href="/terms"]')?.textContent,
    }).toEqual({
      heading: signedOutConsent.heading,
      paragraphs: [...signedOutConsent.paragraphs, signedOutConsent.closing],
      signIn: 'button',
      terms: 'Terms',
    })
  })

  test.each([
    ['the upgrade screen', 'upgrade', '/api/auth/sign-in/google?then=connect&landing=upgrade'],
    ['the channel screen', '', '/api/auth/sign-in/google?then=connect'],
  ])(
    'signed out on %s, "Sign in with Google" asks the API for a sign-in that lands there',
    async (_screen, address, signIn) => {
      const api = installFakeApi()
      const { container } = await renderSignedOut(api, address)
      const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
      const before = api.requests.length

      try {
        await click(buttonNamed(container, 'Sign in with Google'))

        expect(postsSince(api, before)).toEqual([signIn])
        expect(assign.mock.calls).toEqual([[fakeGoogleUrl]])
      } finally {
        assign.mockRestore()
      }
    },
  )

  test.each([
    ['the upgrade screen', 'upgrade', '/api/channels/connect?landing=upgrade'],
    ['the channel screen', '', '/api/channels/connect'],
  ])(
    'with no channel on %s, the connect from the empty state asks the API for a connect that lands there',
    async (_screen, address, connect) => {
      const api = installFakeApi()
      api.channels = []
      const { container } = await render(address)
      const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})

      try {
        await click(buttonNamed(container, 'Connect a channel'))
        const before = api.requests.length
        await click(buttonNamed(container, 'Continue to Google'))

        expect(postsSince(api, before)).toEqual([connect])
        expect(assign.mock.calls).toEqual([[fakeGoogleUrl]])
      } finally {
        assign.mockRestore()
      }
    },
  )

  test('signed in, the upgrade screen with no channel named opens for the channel the app opens first', async () => {
    const api = installFakeApi()
    api.channels = [fakeChannel, anotherChannel]
    const { container } = await render('upgrade')

    expect(container.querySelector('h1')?.textContent).toBe(upgradeText.heading)
    expect(
      api.requests.filter(({ path }) => path.endsWith('/upgrade')).map(({ path }) => path),
    ).toContain(`/api/channels/${fakeChannel.id}/upgrade`)
    expect(
      api.requests.some(({ path }) => path === `/api/channels/${anotherChannel.id}/upgrade`),
    ).toBe(false)
  })
})

describe('the feedback form (creator-analytics#582)', () => {
  test("from 48rem, the footer's item opens the form, and the item is current there", async () => {
    installFakeApi()
    const shown = await render('audience?window=last90')
    const footer = sidebarIn(shown.container)?.querySelector<HTMLElement>(
      '[data-slot="sidebar-footer"]',
    )
    if (!footer) throw new Error('No footer in the sidebar')

    await click(linkNamed(footer, sendFeedbackText))

    expect(shown.address()).toBe('feedback?window=last90&screen=audience')
    expect(topHeadingIn(shown.container)).toBe(sendFeedbackText)
    expect(currentSidebarLinks(shown.container)).toEqual([sendFeedbackText])
  })

  test("opened from a video's page, a send carries the video's page as its screen", async () => {
    const api = installFakeApi()
    const shown = await render(`videos/${fakeVideo.id}`)

    await click(sidebarLink(shown.container, sendFeedbackText))
    await fillFeedback(shown.container, 'An idea', 'Sort by likes')
    await click(buttonNamed(shown.container, sendText))

    expect(shown.address()).toBe('feedback?screen=video_detail')
    expect(feedbackSentTo(api)).toEqual([
      { type: 'idea', text: 'Sort by likes', screen: 'video_detail', appVersion: '2026.11.9' },
    ])
  })

  test.for([
    ['a version', '2026.11.9'],
    ['no version', null],
  ] as const)(
    'with %s in the build, the form shows neither the screen nor a version, and a send still carries both the screen and the version the build has',
    async ([, version]) => {
      const api = installFakeApi()
      if (version === null) {
        api.clientSettings = { ...api.clientSettings, version: null, releasePath: null }
      }
      const { container } = await render('feedback?screen=audience')

      const formText = container.querySelector('form')?.textContent ?? ''
      expect(formText).not.toContain('2026.11.9')
      expect(formText).not.toContain(screenNames.audience)

      await fillFeedback(container, 'An idea', 'Sort by likes')
      await click(buttonNamed(container, sendText))

      const [sent] = feedbackSentTo(api)
      expect(sent).toStrictEqual({
        type: 'idea',
        text: 'Sort by likes',
        screen: 'audience',
        ...(version === null ? {} : { appVersion: version }),
      })
    },
  )

  test("below 48rem, the header's Menu item opens the form (creator-analytics#891)", async () => {
    setViewport({ width: 375, height: 812 })
    try {
      installFakeApi()
      const shown = await render()

      await click(linkNamed(await openMenuPanel(shown.container), sendFeedbackText))

      expect(shown.address()).toBe('feedback')
      expect(topHeadingIn(shown.container)).toBe(sendFeedbackText)
    } finally {
      setViewport({ width: 1024, height: 768 })
    }
  })

  test('opens with no type checked', async () => {
    installFakeApi()
    const { container } = await render('feedback')

    const radios = radiosIn(feedbackTypeGroupIn(container))
    expect(radios).toHaveLength(3)
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toEqual([])
  })

  test('the counter, in a polite live region, shows from 4,500 characters, counts down, and past the limit counts the characters over in another form', async () => {
    installFakeApi()
    const { container } = await render('feedback')

    await typeInto(feedbackTextIn(container), 'a'.repeat(4499))
    expect(counterIn(container)).toEqual({ live: 'polite', text: '' })

    await typeInto(feedbackTextIn(container), 'a'.repeat(4600))
    const under = counterIn(container)
    expect(under.live).toBe('polite')
    expect(countIn(under.text)).toBe(400)

    await typeInto(feedbackTextIn(container), 'a'.repeat(5002))
    const over = counterIn(container).text
    expect(countIn(over)).toBe(2)
    expect(formOf(over)).not.toBe(formOf(under.text))
  })

  test("the reply box opens unticked, the address holds the account's email, and the address is editable only while the box is ticked", async () => {
    installFakeApi()
    const { container } = await render('feedback')

    expect(replyBoxIn(container).checked).toBe(false)
    expect(replyAddressIn(container).value).toBe('nick@example.com')
    expect(replyAddressIn(container).disabled).toBe(true)

    await click(replyBoxIn(container))
    expect(replyAddressIn(container).disabled).toBe(false)
    await typeInto(replyAddressIn(container), 'other@example.com')
    expect(replyAddressIn(container).value).toBe('other@example.com')
  })

  test('an invalid reply address shows its error, tied to the field and announced, and sends nothing', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(replyBoxIn(container))
    await typeInto(replyAddressIn(container), 'nick@')

    await click(buttonNamed(container, sendText))

    const field = replyAddressIn(container)
    const error = container.ownerDocument.getElementById(
      field.getAttribute('aria-describedby') ?? '',
    )
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(error?.textContent).toBe(invalidAddressText)
    expect(error?.getAttribute('role')).toBe('alert')
    expect(feedbackSentTo(api)).toEqual([])
  })

  test('a send with no type sends nothing, and the alert says what is missing', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback')
    await typeInto(feedbackTextIn(container), 'Sort by likes')

    await click(buttonNamed(container, sendText))

    expect(alertOf(container)).toBe(incompleteText)
    expect(feedbackSentTo(api)).toEqual([])
  })

  test('a send posts the type, the text and the screen, with no reply address, and the thank-you line takes the form’s place', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback?screen=settings')
    await fillFeedback(container, 'Something is wrong', 'The chart is blank')

    await click(buttonNamed(container, sendText))

    expect(feedbackSentTo(api)).toEqual([
      {
        type: 'something_wrong',
        text: 'The chart is blank',
        screen: 'settings',
        appVersion: '2026.11.9',
      },
    ])
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('.feedback-thanks')?.textContent).toBe(feedbackThanksText)
  })

  test('after a send, Reset form brings back an empty form on the same screen, with focus on its first control', async () => {
    installFakeApi()
    const shown = await render('feedback?screen=settings')
    const { container } = shown
    await click(replyBoxIn(container))
    await typeInto(replyAddressIn(container), 'other@example.com')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(buttonNamed(container, sendText))

    await click(buttonNamed(container, resetFormText))

    expect(container.querySelector('form')).not.toBeNull()
    expect(container.querySelector('.feedback-thanks')).toBeNull()
    const radios = radiosIn(feedbackTypeGroupIn(container))
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toEqual([])
    expect(feedbackTextIn(container).value).toBe('')
    expect(replyBoxIn(container).checked).toBe(false)
    expect(replyAddressIn(container).value).toBe('nick@example.com')
    expect(replyAddressIn(container).disabled).toBe(true)
    expect(container.ownerDocument.activeElement).toBe(radios[0])
    expect(shown.address()).toBe('feedback?screen=settings')
  })

  test('a second send from the reset form posts again with the same screen', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback?screen=settings')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(buttonNamed(container, sendText))
    await click(buttonNamed(container, resetFormText))

    await fillFeedback(container, 'Other', 'Hello again')
    await click(buttonNamed(container, sendText))

    expect(feedbackSentTo(api)).toEqual([
      { type: 'idea', text: 'Sort by likes', screen: 'settings', appVersion: '2026.11.9' },
      { type: 'other', text: 'Hello again', screen: 'settings', appVersion: '2026.11.9' },
    ])
    expect(container.querySelector('.feedback-thanks')?.textContent).toBe(feedbackThanksText)
  })

  // Each send is its own POST, which the API counts toward the daily limit in its database
  // (apps/api/src/feedback.test.ts holds the count), so the fake refuses the second as the API would.
  test('a second send refused for the daily limit shows the daily-limit alert and keeps its text', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback?screen=settings')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(buttonNamed(container, sendText))
    await click(buttonNamed(container, resetFormText))
    await fillFeedback(container, 'Other', 'Hello again')
    api.failNext('POST /api/feedback', { status: 429, body: { error: 'rate_limited' } })

    await click(buttonNamed(container, sendText))

    expect(alertOf(container)).toBe(dailyLimitText)
    expect(feedbackTextIn(container).value).toBe('Hello again')
    expect(container.querySelector('.feedback-thanks')).toBeNull()
  })

  test('Reset form sends no event', async () => {
    installFakeApi()
    const { container } = await render('feedback')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(buttonNamed(container, sendText))
    vi.mocked(track).mockClear()

    await click(buttonNamed(container, resetFormText))

    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })

  test('with the box ticked, a send posts the reply address', async () => {
    const api = installFakeApi()
    const { container } = await render('feedback')
    await fillFeedback(container, 'Other', 'Hello')
    await click(replyBoxIn(container))

    await click(buttonNamed(container, sendText))

    expect(feedbackSentTo(api)).toEqual([
      {
        type: 'other',
        text: 'Hello',
        screen: 'video_list',
        appVersion: '2026.11.9',
        replyTo: 'nick@example.com',
      },
    ])
  })

  test.for([
    ['a dropped connection', 'network', failedSendText],
    ['the daily limit', { status: 429, body: { error: 'rate_limited' } }, dailyLimitText],
    ['a refused body', { status: 400, body: { error: 'invalid_feedback_text' } }, failedSendText],
  ] as const)('on %s, the text stays and the alert says why', async ([, how, alert]) => {
    const api = installFakeApi()
    const { container } = await render('feedback')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    api.failNext('POST /api/feedback', how)

    await click(buttonNamed(container, sendText))

    expect(alertOf(container)).toBe(alert)
    expect(feedbackTextIn(container).value).toBe('Sort by likes')
    expect(container.querySelector('.feedback-thanks')).toBeNull()
  })

  test('opened under StrictMode, sends feedback_opened once, and a send feedback_sent once with its type, neither with the text, the reply address or an account ID', async () => {
    installFakeApi()
    vi.mocked(track).mockClear()
    const { container } = await render('feedback')
    await fillFeedback(container, 'An idea', 'Sort by likes')
    await click(replyBoxIn(container))

    await click(buttonNamed(container, sendText))

    const events = vi.mocked(track).mock.calls.map(([event]) => event)
    expect(events.filter(({ name }) => name.startsWith('feedback_'))).toEqual([
      { name: 'feedback_opened' },
      { name: 'feedback_sent', type: 'idea' },
    ])
    expect(JSON.stringify(events)).not.toMatch(/Sort by likes|nick@example\.com|user-/)
  })

  test("a click on the sidebar's item opens the form and sends feedback_opened once", async () => {
    installFakeApi()
    const { container } = await render()
    vi.mocked(track).mockClear()

    await click(sidebarLink(container, sendFeedbackText))

    expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'feedback_opened' }]])
  })
})

const scriptPayload = '<script>alert(1)</script>'
const imagePayload = '<img src=x onerror=alert(1)>@example.com'

/** Two messages, newest first: one open with every field, one "Done" with no version or address. */
function adminMessages(): AdminFeedbackMessage[] {
  return [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'something_wrong',
      text: 'The chart is blank\non Audience',
      screen: 'audience',
      appVersion: '2026.11.9',
      replyTo: 'reply@example.com',
      createdAt: '2026-11-15T12:05:00.000Z',
      doneAt: null,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'idea',
      text: 'Sort by likes',
      screen: 'video_detail',
      appVersion: null,
      replyTo: null,
      createdAt: '2026-11-14T09:30:00.000Z',
      doneAt: '2026-11-14T10:00:00.000Z',
    },
  ]
}

/** Each message on the admin screen as its fields' labels and texts, and its "Done" state. */
function adminMessagesIn(container: HTMLElement) {
  return [...container.querySelectorAll('article')].map((article) => ({
    fields: [...article.querySelectorAll('dt')].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
    done: doneBoxIn(article).checked,
  }))
}

function doneBoxIn(article: Element): HTMLInputElement {
  const label = [...article.querySelectorAll('label')].find((each) => each.textContent === doneText)
  const box = label && article.ownerDocument.getElementById(label.htmlFor)
  if (!(box instanceof HTMLInputElement)) throw new Error('No "Done" box in the message')
  return box
}

function articleAt(container: HTMLElement, place: number): HTMLElement {
  const article = container.querySelectorAll<HTMLElement>('article')[place]
  if (!article) throw new Error(`No message at ${place}`)
  return article
}

function openOnlyBoxIn(container: HTMLElement): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find(
    (each) => each.textContent === openOnlyText,
  )
  const box = label && container.ownerDocument.getElementById(label.htmlFor)
  if (!(box instanceof HTMLInputElement)) throw new Error('No open filter')
  return box
}

/** The query of each read of the list, oldest first. StrictMode sends the first read twice. */
function adminReadsOf(api: FakeApi): string[] {
  return api.requests
    .filter(({ method, path }) => method === 'GET' && path === '/api/admin/feedback')
    .map(({ query }) => query.toString())
}

function doneSavesOf(api: FakeApi): string[] {
  return api.requests
    .filter(({ path }) => path.endsWith('/done'))
    .map(({ method, path }) => `${method} ${path}`)
}

// Limits: happy-dom evaluates no stylesheet and runs no screen reader, so no test here shows the
// text's line breaks on screen (`white-space: pre-wrap`) or what VoiceOver reads for a "Done" box's
// description. The browser walk finds both payloads as text in Chrome under the page's policy, and
// Nick checks the screen's look at /app/admin/feedback.
describe('the admin feedback screen (creator-analytics#583)', () => {
  test('lists the messages in the order the API answers, each with its type, time sent, screen, version, reply address, text and "Done" state', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    expect(topHeadingIn(container)).toBe(adminFeedbackHeading)
    expect(adminMessagesIn(container)).toEqual([
      {
        fields: [
          ['Type', 'Something is wrong'],
          ['Sent', sentTextOf('2026-11-15T12:05:00.000Z')],
          ['Screen', 'Audience'],
          ['Version', '2026.11.9'],
          ['Reply address', 'reply@example.com'],
          ['Message', 'The chart is blank\non Audience'],
        ],
        done: false,
      },
      {
        fields: [
          ['Type', 'An idea'],
          ['Sent', sentTextOf('2026-11-14T09:30:00.000Z')],
          ['Screen', "a video's page"],
          ['Version', 'No version'],
          ['Reply address', 'No reply address'],
          ['Message', 'Sort by likes'],
        ],
        done: true,
      },
    ])
    expect(adminReadsOf(api)).toEqual(['page=1', 'page=1'])
  })

  test('each "Done" box is described by its message\'s type and time sent', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    const box = doneBoxIn(articleAt(container, 1))
    const description = container.ownerDocument.getElementById(
      box.getAttribute('aria-describedby') ?? '',
    )

    expect(description?.textContent).toBe(`An idea, ${sentTextOf('2026-11-14T09:30:00.000Z')}`)
  })

  test('a tick of "Done" sends PUT and a clear sends DELETE, and each box shows the state the API answers', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    await click(doneBoxIn(articleAt(container, 0)))
    await click(doneBoxIn(articleAt(container, 1)))

    expect(doneSavesOf(api)).toEqual([
      'PUT /api/admin/feedback/11111111-1111-4111-8111-111111111111/done',
      'DELETE /api/admin/feedback/22222222-2222-4222-8222-222222222222/done',
    ])
    expect(adminMessagesIn(container).map(({ done }) => done)).toEqual([true, false])
    expect(api.adminFeedback?.map(({ doneAt }) => doneAt)).toEqual([fakeDoneAt, null])
    expect(alertOf(container)).toBeNull()
  })

  test.for([
    ['a refusal', 'status'],
    ['a dropped connection', 'network'],
  ] as const)('on %s, a "Done" change keeps the old state and alerts', async ([, how]) => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')
    api.failNext('PUT /api/admin/feedback/11111111-1111-4111-8111-111111111111/done', how)

    await click(doneBoxIn(articleAt(container, 0)))

    expect(doneBoxIn(articleAt(container, 0)).checked).toBe(false)
    expect(alertOf(container)).toBe(doneFailedText)
  })

  test('the open filter starts unticked, and a tick asks for the open messages only', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')
    expect(openOnlyBoxIn(container).checked).toBe(false)

    await click(openOnlyBoxIn(container))

    expect(adminReadsOf(api)).toEqual(['page=1', 'page=1', 'page=1&open=true'])
    expect(adminMessagesIn(container)).toHaveLength(1)
    expect(container.querySelector('article dd')?.textContent).toBe('Something is wrong')
  })

  test('with more than one page, "Older" asks for the next page', async () => {
    const api = installFakeApi()
    const [first] = adminMessages()
    if (!first) throw new Error('No message')
    api.adminFeedback = Array.from({ length: 51 }, (_, place) => ({
      ...first,
      id: `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`,
      text: `Message ${51 - place}`,
    }))
    const { container } = await render('admin/feedback')
    expect(adminMessagesIn(container)).toHaveLength(50)

    await click(buttonNamed(container, olderText))

    expect(adminReadsOf(api)).toEqual(['page=1', 'page=1', 'page=2'])
    expect(
      [...container.querySelectorAll('.admin-feedback-text dd')].map((each) => each.textContent),
    ).toEqual(['Message 1'])
  })

  test('with one page, shows no paging', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    expect(buttonsNamed(container, olderText)).toEqual([])
    expect(buttonsNamed(container, newerText)).toEqual([])
  })

  test('with no message, says so', async () => {
    const api = installFakeApi()
    api.adminFeedback = []
    const { container } = await render('admin/feedback')

    expect(container.querySelector('.admin-feedback')?.textContent).toContain(noMessagesText)
    expect(container.querySelectorAll('article')).toHaveLength(0)
  })

  test('a <script> and an <img onerror> payload in the text and in the reply address show as their literal text, and add no element', async () => {
    const api = installFakeApi()
    const [first, second] = adminMessages()
    if (!first || !second) throw new Error('No message')
    api.adminFeedback = [
      { ...first, text: scriptPayload, replyTo: imagePayload },
      { ...second, text: imagePayload, replyTo: scriptPayload },
    ]
    const { container } = await render('admin/feedback')

    const texts = adminMessagesIn(container).map(({ fields }) =>
      Object.fromEntries(
        fields.filter(([label]) => label === 'Message' || label === 'Reply address'),
      ),
    )
    expect(texts).toEqual([
      { 'Reply address': imagePayload, Message: scriptPayload },
      { 'Reply address': scriptPayload, Message: imagePayload },
    ])
    const screen = container.querySelector('.admin-feedback')
    expect(screen?.querySelectorAll('script, img')).toHaveLength(0)
    expect(screen?.querySelectorAll('a[href^="mailto:"]')).toHaveLength(0)
  })

  test('a creator the API answers 404, as it does anyone not on the allowlist, sees the not-found screen and nothing of the admin screen', async () => {
    const api = installFakeApi()
    const shown = await render('admin/feedback?window=last90')

    expect(topHeadingIn(shown.container)).toBe(notFoundHeading)
    expect(shown.container.textContent).not.toContain(adminFeedbackHeading)
    expect(shown.container.querySelectorAll('article')).toHaveLength(0)
    expect(adminReadsOf(api)).toEqual(['page=1', 'page=1'])

    await click(linkNamed(shown.container, notFoundLinkText))

    expect(shown.address()).toBe('?window=last90')
  })

  test('shows no heading while the list is read', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const held = holdBoth(api, 'GET /api/admin/feedback')
    const { container } = await render('admin/feedback')

    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('.admin-feedback[aria-busy="true"]')).not.toBeNull()

    held.release()
    await settle()
    expect(topHeadingIn(container)).toBe(adminFeedbackHeading)
  })

  test('the sidebar links nothing to it, and marks no link current there', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    const sidebar = sidebarIn(container)
    expect(sidebar).not.toBeNull()
    expect(sidebar?.querySelectorAll('a[href*="admin"]')).toHaveLength(0)
    expect(currentSidebarLinks(container)).toEqual([])
  })
})

describe("a paid channel's impressions and CTR history in the channel summary (creator-analytics#783)", () => {
  // The fake summary's days run 2026-10-02 to 2026-10-04, and the history holds the last two: 100
  // impressions at 10%, then 300 at 2%, a channel CTR of 4% over both.
  function paidApi(): FakeApi {
    const api = installFakeApi()
    api.summaryDays = [
      { day: '2026-10-02', engagedViews: 600, views: 700, estimatedMinutesWatched: 300 },
      {
        day: '2026-10-03',
        engagedViews: 600,
        views: 700,
        estimatedMinutesWatched: 300,
        impressions: 100,
        ctr: 0.1,
      },
      {
        day: '2026-10-04',
        engagedViews: 600,
        views: 800,
        estimatedMinutesWatched: 438,
        impressions: 300,
        ctr: 0.02,
      },
    ]
    api.summaryHistory = {
      impressions: 400,
      ctr: 0.04,
      firstDay: '2026-10-03',
      newestDay: '2026-10-04',
    }
    return api
  }

  /** Each card as its label, its number and its smaller line. */
  function cardsIn(container: HTMLElement) {
    return [...container.querySelectorAll('.cards > div')].map((card) => ({
      label: card.querySelector('dt')?.textContent,
      text: card.querySelector('.card-number, .card-message')?.textContent,
      detail: card.querySelector('.card-detail')?.textContent,
    }))
  }

  /** The chart under the heading, and what its live region reads after a key on its plot. */
  function chartNamed(container: HTMLElement, heading: string) {
    const chart = [...container.querySelectorAll<HTMLElement>('.metric-chart')].find(
      (each) => each.querySelector('h2')?.textContent === heading,
    )
    const plot = chart?.querySelector<HTMLElement>('.chart-plot')
    if (!chart || !plot) throw new Error(`No ${heading} chart`)
    const readAfter = async (key: string) => {
      await act(async () => plot.focus())
      await act(async () => {
        plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
      return chart.querySelector('p.visually-hidden[aria-live="polite"] > span')?.textContent
    }
    return { chart, readAfter }
  }

  test("the cards show the history's impressions and channel CTR, and the note under them names its newest day", async () => {
    paidApi()
    const { container } = await render()

    expect(cardsIn(container).slice(3)).toMatchObject([
      { label: 'Impressions', text: '400' },
      { label: 'Impressions click-through rate', text: '4.0%' },
    ])
    expect(
      [...container.querySelectorAll('p.note')].some(({ textContent }) =>
        textContent?.includes(longDateOf('2026-10-04')),
      ),
    ).toBe(true)
  })

  test('the impressions and CTR charts read each day daily, and the sum and the channel CTR to date as a running total', async () => {
    paidApi()
    const { container } = await render()
    const daily = [
      await chartNamed(container, 'Impressions').readAfter('End'),
      await chartNamed(container, 'Impressions click-through rate').readAfter('End'),
    ]

    await click(buttonNamed(container, 'Running total'))
    const running = [
      await chartNamed(container, 'Impressions').readAfter('End'),
      await chartNamed(container, 'Impressions click-through rate').readAfter('End'),
    ]

    expect({ daily, running }).toEqual({
      daily: ['Impressions 300', 'CTR 2.0%'],
      running: ['Impressions 400', 'CTR 4.0%'],
    })
  })

  test('a range that starts before the history: the cards say how many of its days the history holds, the note names the history start, and only the history charts mark it, and a day before it reads no impressions', async () => {
    paidApi()
    const { container } = await render()

    expect(
      cardsIn(container)
        .slice(3)
        .map(({ detail }) => detail),
    ).toEqual(['2 of 3 days', '2 of 3 days'])
    expect(
      [...container.querySelectorAll('p.note')].some(({ textContent }) =>
        textContent?.includes(longDateOf('2026-10-03')),
      ),
    ).toBe(true)
    const marked = [...container.querySelectorAll('.metric-chart')].flatMap((chart) =>
      chart.querySelector('.history-start-line')
        ? [
            [
              chart.querySelector('h2')?.textContent,
              (chart.querySelector('.history-start-line') as HTMLElement).style.left,
            ],
          ]
        : [],
    )
    expect(marked).toEqual([
      ['Impressions', '50%'],
      ['Impressions click-through rate', '50%'],
    ])
    expect(await chartNamed(container, 'Impressions').readAfter('Home')).toBe('Impressions')
  })

  test('a free channel, whose summary carries no history, shows no impressions or CTR card or chart', async () => {
    const api = installFakeApi()
    api.summaryDays = api.days
    const { container } = await render()

    expect(cardsIn(container).map(({ label }) => label)).not.toContain('Impressions')
    expect(
      [...container.querySelectorAll('.metric-chart h2')].map(({ textContent }) => textContent),
    ).toEqual(['Engaged views and views', 'Watch hours'])
  })
})

describe("a paid channel's impressions and CTR in the video list and on the video screen (creator-analytics#785)", () => {
  const ends = { firstDay: '2026-09-10', newestDay: '2026-10-04' }

  function paidList(): FakeApi {
    const api = installFakeApi()
    api.videos = [
      { ...fakeVideo, impressions: 12_340, ctr: 0.0456 },
      {
        ...fakeVideo,
        id: 'video-2',
        title: 'An older video',
        impressions: 100,
        ctr: 0.1,
        historyPartial: { days: 24, of: 28 },
      },
    ]
    api.listHistory = ends
    return api
  }

  /** The list's column headings, and each row's cells under them by heading. */
  function listIn(container: HTMLElement) {
    const headings = [...container.querySelectorAll('.video-list-rows thead th')].map(
      ({ textContent }) => textContent ?? '',
    )
    const rows = [...container.querySelectorAll('.video-list-rows tbody tr')].map((row) => {
      const cells = [...row.querySelectorAll('th, td')]
      return Object.fromEntries(
        headings.map((heading, index) => [heading, cells[index]?.textContent ?? '']),
      )
    })
    return { headings, rows }
  }

  function paragraphsIn(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.video-list-rows > p')].map(
      ({ textContent }) => textContent ?? '',
    )
  }

  test("the list shows a paid channel's Impressions and CTR after Engaged views, each row's numbers, and the note on the history's newest day", async () => {
    paidList()
    const { container } = await render('?window=last28')
    const { headings, rows } = listIn(container)

    expect(headings.slice(3, 6)).toEqual(['Engaged views', 'Impressions', 'CTR'])
    expect(rows[0]).toMatchObject({ Impressions: '12,340', CTR: '4.6%' })
    expect(paragraphsIn(container)).toContain(
      `Impressions and click-through rate are stored up to ${longDateOf('2026-10-04')}. The history starts on ${longDateOf('2026-09-10')}.`,
    )
  })

  test('a row whose days start before the history carries the "N of M days" label in its Impressions and CTR cells', async () => {
    paidList()
    const { container } = await render('?window=last28')
    const { rows } = listIn(container)

    expect(rows[1]).toMatchObject({ Impressions: '10024 of 28 days', CTR: '10.0%24 of 28 days' })
    expect(rows[0]?.Impressions).not.toContain('days')
  })

  test("a free channel's list shows no Impressions or CTR column and no history note", async () => {
    installFakeApi()
    const { container } = await render('?window=last28')

    expect(listIn(container).headings).not.toContain('Impressions')
    expect(listIn(container).headings).not.toContain('CTR')
    expect(paragraphsIn(container).some((text) => text.includes('click-through rate'))).toBe(false)
  })

  test('in a window after publish, a full newest average names its 10 uploads under the engaged views sentence', async () => {
    const api = paidList()
    api.newestHistoryAverage = { format: 'all', count: 10, impressions: 4321.4, ctr: 0.052 }
    const { container } = await render('?window=first7')

    expect(paragraphsIn(container)).toContain(
      'Your 10 newest public uploads averaged 4,321 impressions at a 5.2% click-through rate in their first 7 days.',
    )
  })

  test('a thin newest average names its count', async () => {
    const api = paidList()
    api.newestHistoryAverage = { format: 'all', count: 3, impressions: 120, ctr: 0.05 }
    const { container } = await render('?window=first7')

    expect(paragraphsIn(container)).toContain(
      'Your 3 newest public uploads averaged 120 impressions at a 5.0% click-through rate in their first 7 days.',
    )
  })

  test('with no newest average, the list says nothing of one', async () => {
    paidList()
    const { container } = await render('?window=first7')

    expect(paragraphsIn(container).some((text) => text.includes('impressions at'))).toBe(false)
  })

  /**
   * The video screen's impressions and CTR (creator-analytics#1048): the table, its heading and
   * its notes in their row, where it sits beside the breakdowns grid, the video's own two cards in
   * the headline cards, and any heading, table, cards or paragraph in the traffic sources section,
   * which holds only its bars.
   */
  function sourceReachIn(container: HTMLElement) {
    const sectionHeaded = (heading: string) =>
      [...container.querySelectorAll('.video-detail-section')].find(
        (each) => each.querySelector('h2')?.textContent === heading,
      )
    const traffic = sectionHeaded('Traffic sources (engaged views)')
    const section = sectionHeaded('Impressions and click-through rate')
    const grid = container.querySelector('.video-detail-breakdowns')
    const headline = container.querySelector('.video-detail-sections > .cards')
    return {
      heading: section?.querySelector('h2')?.textContent,
      inGrid: section ? section.closest('.video-detail-breakdowns') !== null : undefined,
      afterGrid:
        section && grid
          ? (grid.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          : undefined,
      bars: [...(traffic?.querySelectorAll('.bars-name') ?? [])].map(
        ({ textContent }) => textContent,
      ),
      leftInTraffic: [...(traffic?.querySelectorAll('h3, .traffic-reach, .cards, p') ?? [])].map(
        ({ textContent }) => textContent,
      ),
      rows: [...(section?.querySelectorAll('.traffic-reach tr') ?? [])].map((row) =>
        [...row.children].map(({ textContent }) => textContent),
      ),
      cardsInRow: section?.querySelectorAll('.cards').length,
      headline: [...(headline?.querySelectorAll(':scope > div') ?? [])].map((card) => ({
        label: card.querySelector('dt')?.textContent,
        text: card.querySelector('.card-number, .card-message')?.textContent,
        detail: card.querySelector('.card-detail')?.textContent,
      })),
      paragraphs: [...(section?.querySelectorAll(':scope > p') ?? [])].map(
        ({ textContent }) => textContent,
      ),
    }
  }

  test("the video screen shows each source's impressions and CTR and the newest uploads' average for it in a row of its own under the breakdowns, the video's own as the last two headline cards, and the history's newest day (creator-analytics#1048)", async () => {
    const api = installFakeApi()
    api.trafficSources = [
      { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
      { type: 'RELATED_VIDEO', engagedViews: 0, views: 0, impressions: 100, ctr: 0.04 },
    ]
    api.detailHistory = {
      impressions: 3100,
      ctr: 0.0216,
      ...ends,
      newestAverage: {
        format: 'video',
        count: 4,
        impressions: 2000,
        ctr: 0.03,
        trafficSources: [{ type: 'YT_SEARCH', impressions: 1800, ctr: 0.025 }],
      },
    }
    const { container } = await render('videos/video-1?window=first7')
    const reach = sourceReachIn(container)

    expect(reach).toMatchObject({
      heading: 'Impressions and click-through rate',
      inGrid: false,
      afterGrid: true,
      bars: ['YouTube search', 'Suggested videos'],
      leftInTraffic: [],
      cardsInRow: 0,
    })
    expect(reach.rows).toEqual([
      ['', 'Impressions', 'CTR', 'Newest uploads, impressions', 'Newest uploads, CTR'],
      ['YouTube search', '3,000', '2.1%', '1,800', '2.5%'],
      ['Suggested videos', '100', '4.0%', '', ''],
    ])
    expect(reach.headline).toEqual([
      expect.objectContaining({ label: 'Engaged views' }),
      expect.objectContaining({ label: 'Watch hours' }),
      { label: 'Impressions', text: '3,100', detail: undefined },
      { label: 'Impressions click-through rate', text: '2.2%', detail: undefined },
    ])
    expect(reach.paragraphs).toEqual([
      'The newest uploads columns average your 4 newest public videos in their first 7 days.',
      `Impressions and click-through rate are stored up to ${longDateOf('2026-10-04')}.`,
    ])
  })

  test("in a calendar window, the video screen's table has no newest average, and a range that starts before the history carries its label and the history start", async () => {
    const api = installFakeApi()
    api.trafficSources = [
      { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
    ]
    api.detailHistory = { impressions: 3000, ctr: 0.021, ...ends, partial: { days: 24, of: 28 } }
    const { container } = await render('videos/video-1?window=last28')

    expect(
      [...container.querySelectorAll('.traffic-reach thead th')].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(['Impressions', 'CTR'])
    expect(sourceReachIn(container).headline.slice(2)).toEqual([
      { label: 'Impressions', text: '3,000', detail: '24 of 28 days' },
      { label: 'Impressions click-through rate', text: '2.1%', detail: '24 of 28 days' },
    ])
    expect(sourceReachIn(container)).toMatchObject({
      cardsInRow: 0,
      paragraphs: [
        `Impressions and click-through rate are stored up to ${longDateOf('2026-10-04')}. The history starts on ${longDateOf('2026-09-10')}.`,
      ],
    })
  })

  test("the video screen's impressions table lists its sources by impressions, most first, equal ones in the API's order and 0 last, while the bars keep the API's order (creator-analytics#1042)", async () => {
    const api = installFakeApi()
    api.trafficSources = [
      { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 100, ctr: 0.05 },
      { type: 'SUBSCRIBER', engagedViews: 40, views: 45, impressions: 0, ctr: null },
      { type: 'RELATED_VIDEO', engagedViews: 30, views: 35, impressions: 3000, ctr: 0.02 },
      { type: 'PLAYLIST', engagedViews: 20, views: 25, impressions: 100, ctr: 0.03 },
      { type: 'SHORTS', engagedViews: 0, views: 0, impressions: 500, ctr: 0.01 },
    ]
    api.detailHistory = { impressions: 3700, ctr: 0.0216, ...ends }
    const { container } = await render('videos/video-1?window=last28')
    const reach = sourceReachIn(container)

    expect(reach.rows.slice(1).map(([name]) => name)).toEqual([
      'Suggested videos',
      'Shorts',
      'YouTube search',
      'Playlists',
      'Browse features',
    ])
    expect(reach.bars).toEqual([
      'YouTube search',
      'Browse features',
      'Suggested videos',
      'Playlists',
      'Shorts',
    ])
  })

  test("with no impressions in the range, the video screen's CTR card says so in place of a rate (creator-analytics#1042)", async () => {
    const api = installFakeApi()
    api.trafficSources = [
      { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 0, ctr: null },
    ]
    api.detailHistory = { impressions: 0, ctr: null, ...ends }
    const { container } = await render('videos/video-1?window=last28')

    expect(sourceReachIn(container).headline.slice(2)).toEqual([
      { label: 'Impressions', text: '0', detail: undefined },
      {
        label: 'Impressions click-through rate',
        text: 'No impressions in this range',
        detail: undefined,
      },
    ])
  })

  describe('on a screen too small to stack the charts (creator-analytics#1048)', () => {
    beforeEach(() => setViewport({ width: 375, height: 812 }))
    afterEach(() => setViewport({ width: 1024, height: 768 }))

    const headingsIn = (container: HTMLElement) =>
      [...container.querySelectorAll('.metric-chart h2')].map(({ textContent }) => textContent)
    const cardIn = (container: HTMLElement, label: string) =>
      [...container.querySelectorAll('.video-detail-sections > .cards > div')].find(
        (card) => card.querySelector('dt')?.textContent === label,
      )

    test("the video's impressions and CTR cards choose no chart, and the cards before them still choose theirs", async () => {
      const api = installFakeApi()
      api.trafficSources = [
        { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
      ]
      api.detailHistory = { impressions: 3000, ctr: 0.021, ...ends }
      const { container } = await render('videos/video-1?window=last28')

      for (const label of ['Impressions', 'Impressions click-through rate']) {
        const card = cardIn(container, label)
        expect(card?.className).toBe('card')
        expect(card?.querySelector('button')).toBeNull()
      }
      expect(headingsIn(container)).toEqual(['Engaged views and views'])

      const watchHours = cardIn(container, 'Watch hours')?.querySelector('button.card-choose')
      if (!(watchHours instanceof HTMLButtonElement)) throw new Error('No Watch hours chooser')
      await click(watchHours)

      expect(headingsIn(container)).toEqual(['Watch hours'])
      expect(watchHours.getAttribute('aria-pressed')).toBe('true')
    })
  })

  test("a free channel's video screen shows no impressions in its traffic sources", async () => {
    const api = installFakeApi()
    api.trafficSources = [{ type: 'YT_SEARCH', engagedViews: 50, views: 60 }]
    const { container } = await render('videos/video-1')

    expect(container.querySelector('.bars-name')?.textContent).toBe('YouTube search')
    expect(container.querySelector('.traffic-reach')).toBeNull()
    expect(container.textContent).not.toContain('impressions')
  })
})

describe('a free channel shows only its own numbers, and the upgrade screen (creator-analytics#788, creator-analytics#915)', () => {
  type Who = 'owner' | 'member'

  /** A free channel on a product that offers Pro, seen by its owner or another member. */
  function freeApi(who: Who): FakeApi {
    const api = installFakeApi()
    const owner = who === 'owner'
    api.entitlements = entitlementsOf(
      { canSubscribe: owner },
      { channelId: fakeChannel.id, tier: 'free', owner, canSubscribe: owner },
    )
    api.summaryDays = api.days
    api.trafficSources = [{ type: 'YT_SEARCH', engagedViews: 50, views: 60 }]
    api.upgrade = {
      historyStart: '2026-08-09',
      newestDay: '2026-10-03',
      comparisons: [
        { window: 'first7', count: 2, availableOn: null },
        { window: 'first28', count: 1, availableOn: '2026-10-16' },
      ],
      prices: fakePrices,
    }
    return api
  }

  /** The paid channel of the same product, whose answers carry its history. */
  function paidApi(): FakeApi {
    const api = installFakeApi()
    api.entitlements = entitlementsOf(
      { blocks: 1, slotsInUse: 1 },
      { channelId: fakeChannel.id, tier: 'paid' },
    )
    const ends = { firstDay: '2026-10-03', newestDay: '2026-10-04' }
    api.summaryDays = api.days.map((day) => ({ ...day, impressions: 100, ctr: 0.05 }))
    api.summaryHistory = { impressions: 200, ctr: 0.05, ...ends }
    api.videos = [{ ...fakeVideo, impressions: 300, ctr: 0.04 }]
    api.listHistory = ends
    api.trafficSources = [
      { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
    ]
    api.detailHistory = { impressions: 3000, ctr: 0.021, ...ends }
    return api
  }

  /**
   * Every impressions and CTR figure on the channel screen: the summary's cards, the charts'
   * headings, the numbers table's columns and the video list's columns.
   */
  function reachOn(container: HTMLElement) {
    const isReach = (text: string | null | undefined) =>
      text?.startsWith('Impressions') === true || text?.startsWith('CTR') === true
    return {
      cards: [...container.querySelectorAll('.cards > div dt')]
        .map(({ textContent }) => textContent)
        .filter(isReach),
      charts: [...container.querySelectorAll('.metric-chart h2')]
        .map(({ textContent }) => textContent)
        .filter(isReach),
      table: [...container.querySelectorAll('.numbers-table thead th')]
        .map(({ textContent }) => textContent)
        .filter(isReach),
      list: [...container.querySelectorAll('.video-list-rows thead th')]
        .map(({ textContent }) => textContent)
        .filter(isReach),
    }
  }

  /** The sentences and notes above the video list's table. */
  function listParagraphsIn(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.video-list-rows > p')].map(
      ({ textContent }) => textContent ?? '',
    )
  }

  const noReach = { cards: [], charts: [], table: [], list: [] }

  test.each(['owner', 'member'] as const)(
    'the %s of a free channel, with Pro offered, sees no impressions or CTR card, chart, numbers table column or list column, no "Sample" mark and no sample note, and only its own three summary cards (creator-analytics#915)',
    async (who) => {
      freeApi(who)
      const { container } = await render('?window=last28')

      expect(reachOn(container)).toEqual(noReach)
      expect(container.querySelectorAll('.cards > div')).toHaveLength(3)
      expect(container.textContent).not.toMatch(/sample/i)
      expect(container.textContent).not.toContain('click-through rate')
    },
  )

  test("in a window after publish, a free channel's list says nothing of a newest uploads' impressions average (creator-analytics#915)", async () => {
    freeApi('owner')
    const { container } = await render('?window=first7')

    expect(reachOn(container).list).toEqual([])
    expect(listParagraphsIn(container).some((text) => text.includes('impressions'))).toBe(false)
    expect(container.textContent).not.toMatch(/sample/i)
  })

  test("a free channel's video screen shows its traffic sources with no impressions or CTR table, and no sample note (creator-analytics#915)", async () => {
    freeApi('owner')
    const { container } = await render('videos/video-1?window=last28')

    expect(container.querySelector('.bars-name')?.textContent).toBe('YouTube search')
    expect(container.querySelector('.traffic-reach')).toBeNull()
    expect(container.textContent).not.toContain('Impressions')
    expect(container.textContent).not.toMatch(/sample/i)
  })

  test("a Pro channel still sees its own impressions and CTR in the summary's cards, charts, numbers table and video list, with no sample mark", async () => {
    paidApi()
    const { container } = await render('?window=last28')

    expect(reachOn(container)).toEqual({
      cards: ['Impressions', 'Impressions click-through rate'],
      charts: ['Impressions', 'Impressions click-through rate'],
      table: ['Impressions', 'CTR'],
      list: ['Impressions', 'CTR'],
    })
    expect(container.textContent).not.toMatch(/sample/i)
  })

  test("a Pro channel still sees its own impressions and CTR in a video's traffic sources", async () => {
    paidApi()
    const { container } = await render('videos/video-1?window=last28')

    expect(
      [...container.querySelectorAll('.traffic-reach tr')].map((row) =>
        [...row.children].map(({ textContent }) => textContent),
      ),
    ).toEqual([
      ['', 'Impressions', 'CTR'],
      ['YouTube search', '3,000', '2.1%'],
    ])
  })

  test('with Pro not offered, a free channel sees no impressions at all, as before', async () => {
    const api = freeApi('owner')
    api.entitlements = { ...api.entitlements, paidTierOffered: false }
    const { container } = await render('?window=last28')

    expect(container.textContent).not.toContain('Impressions')
  })

  /** The sidebar's "Upgrade" item (creator-analytics#907), the owner's way to the upgrade screen. */
  function upgradeLinksIn(container: HTMLElement): HTMLAnchorElement[] {
    return [...(sidebarIn(container)?.querySelectorAll('a') ?? [])].filter(
      (each) => each.textContent === upgradeLinkText,
    )
  }

  /** Each feature card's heading, its lines and, under the Upload comparisons card, its count. */
  function featureCardsIn(container: HTMLElement) {
    return [...container.querySelectorAll('.upgrade-feature')].map((card) => ({
      title: card.querySelector('h2')?.textContent,
      lines: [...card.querySelectorAll(':scope > p')].map(({ textContent }) => textContent),
      counts: [...card.querySelectorAll('.upgrade-comparisons li')].map(
        ({ textContent }) => textContent,
      ),
      dashed: card.classList.contains('upgrade-feature-next'),
    }))
  }

  /** Each pricing card's name, badge, price, line under it and button, in order. */
  function pricingCardsIn(container: HTMLElement) {
    return [...container.querySelectorAll('.upgrade-plan')].map((card) => ({
      name: card.querySelector('h2')?.textContent,
      recommended: card.classList.contains('upgrade-plan-recommended'),
      badge: card.querySelector('.upgrade-badge')?.textContent ?? null,
      price: card.querySelector('.upgrade-price')?.textContent ?? null,
      detail: card.querySelector('.upgrade-plan-detail')?.textContent ?? null,
      button: card.querySelector('button')?.textContent,
      outline: card.querySelector('button')?.classList.contains('button-outline'),
    }))
  }

  // creator-analytics#913: the approved copy, word for word, creator-analytics#945's drafted
  // Repackaging view card, and creator-analytics#952's Retention comparison card, held to its place.
  test("the owner's \"Upgrade\" item opens the upgrade screen with its approved copy, the feature cards with the channel's own count, the two pricing cards at the configured prices, and a subscribe button sends checkout_started and goes to the user's Checkout", async () => {
    const api = freeApi('owner')
    const { container } = await render('?window=last90')
    const [action] = upgradeLinksIn(container)
    if (!action) throw new Error('No "Upgrade" item')
    const retentionCard = upgradeFeatures.find(({ key }) => key === 'retention')
    if (!retentionCard) throw new Error('No retention comparison card')

    await click(action)

    expect(rendered?.address()).toBe('upgrade?window=last90')
    expect(container.querySelector('.upgrade-eyebrow')?.textContent).toBe('Stillstats Pro')
    expect(container.querySelector('h1')?.textContent).toBe('Upgrade to Pro')
    expect(container.querySelector('.upgrade-intro h1 + p')?.textContent).toBe(
      'Everything in the free tier, plus deeper analytics for this channel.',
    )
    expect(featureCardsIn(container)).toEqual([
      {
        title: 'Reach',
        lines: [
          'Impressions and click-through rate beside engaged views, in your summary, charts, video list and traffic sources.',
          "A video's sponsor report can include them too.",
        ],
        counts: [],
        dashed: false,
      },
      {
        title: 'Upload comparisons',
        lines: [
          'Each new upload beside the average of your own newest uploads at the same age, over its first 7 and first 28 days.',
        ],
        counts: [
          'Ready today: 2 of your uploads are ready for review.',
          'First 28 days: 1 of your uploads would count if you subscribed today. It needs 2, so it starts on October 16, 2026.',
        ],
        dashed: false,
      },
      {
        title: 'Repackaging view',
        lines: [
          'Sort your video list by click-through rate or impressions, for all traffic sources or just one, and hide videos under a minimum number of impressions.',
        ],
        counts: [],
        dashed: false,
      },
      { title: retentionCard.title, lines: retentionCard.lines, counts: [], dashed: false },
      {
        title: 'Your history',
        lines: [
          "Stillstats keeps your channel's history while you subscribe, and for 30 days after you stop, so it is still there if you change your mind in that time.",
          'Deleting your channel still removes all of its data within 6 hours.',
        ],
        counts: [],
        dashed: false,
      },
      {
        title: 'More on the way',
        lines: ['New Pro features arrive in your subscription.'],
        counts: [],
        dashed: true,
      },
    ])
    expect(pricingCardsIn(container)).toEqual([
      {
        name: 'Monthly',
        recommended: false,
        badge: null,
        price: '$7 a month',
        detail: 'Billed every month. Cancel any time.',
        button: 'Subscribe monthly',
        outline: true,
      },
      {
        name: 'Yearly',
        recommended: true,
        badge: 'Save $14',
        price: '$70 a year',
        detail: '$5.83 a month, billed annually.',
        button: 'Subscribe yearly',
        outline: false,
      },
    ])
    expect(
      [...container.querySelectorAll('.upgrade-prices-note')].map((note) => note.textContent),
    ).toEqual([
      'Prices are for this one channel*. Checkout opens on Stripe, and tax may apply. Manage or cancel your subscription in Settings.',
      '* This is changing soon: $7 a month or $70 a year will cover up to 4 channels for one person.',
    ])
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    vi.mocked(track).mockClear()
    try {
      await click(buttonNamed(container, subscribeTexts.annual))

      expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'checkout_started', plan: 'annual' }]])
      expect(
        api.requests
          .filter(({ method }) => method === 'POST')
          .map(({ path, body }) => ({ path, body })),
      ).toEqual([{ path: '/api/me/checkout', body: { plan: 'annual' } }])
      expect(assign.mock.calls).toEqual([[fakeCheckoutUrl]])
    } finally {
      assign.mockRestore()
    }
  })

  test('the upgrade screen sends upgrade_screen_viewed once each time it opens, with no property', async () => {
    freeApi('owner')
    const { container } = await render('?window=last28')
    const viewed = () =>
      vi.mocked(track).mock.calls.filter(([event]) => event.name === 'upgrade_screen_viewed')
    vi.mocked(track).mockClear()

    const [action] = upgradeLinksIn(container)
    if (!action) throw new Error('No "Upgrade" item')
    await click(action)
    expect(viewed()).toEqual([[{ name: 'upgrade_screen_viewed' }]])

    await click(linkNamed(container, videosLinkText))
    const [again] = upgradeLinksIn(container)
    if (!again) throw new Error('No "Upgrade" item')
    await click(again)
    expect(viewed()).toHaveLength(2)
  })

  test("a member's upgrade screen shows the feature cards with the channel's count, and no pricing card or subscribe button", async () => {
    freeApi('member')
    const { container } = await render('upgrade')

    expect(featureCardsIn(container).map(({ title }) => title)).toEqual(
      upgradeFeatures.map(({ title }) => title),
    )
    expect(container.querySelectorAll('.upgrade-comparisons li')).toHaveLength(2)
    expect(pricingCardsIn(container)).toEqual([])
    expect(container.querySelector('.upgrade-prices-note')).toBeNull()
    expect(buttonsNamed(container, subscribeTexts.monthly)).toEqual([])
    expect(buttonsNamed(container, subscribeTexts.annual)).toEqual([])
  })

  test('with prices Stripe could not give, the pricing cards show their names, lines and buttons, and no amount and no badge', async () => {
    const api = freeApi('owner')
    if (api.upgrade) api.upgrade = { ...api.upgrade, prices: null }
    const { container } = await render('upgrade')

    expect(pricingCardsIn(container)).toEqual([
      {
        name: planTexts.monthly.name,
        recommended: false,
        badge: null,
        price: null,
        detail: planTexts.monthly.detail,
        button: subscribeTexts.monthly,
        outline: true,
      },
      {
        name: planTexts.annual.name,
        recommended: true,
        badge: null,
        price: null,
        detail: null,
        button: subscribeTexts.annual,
        outline: false,
      },
    ])
    expect(featureCardsIn(container)[1]?.counts).toEqual([
      'Ready today: 2 of your uploads are ready for review.',
      'First 28 days: 1 of your uploads would count if you subscribed today. It needs 2, so it starts on October 16, 2026.',
    ])
  })

  test('a refused upgrade answer still shows the feature cards, with no count, and the pricing cards with no amount', async () => {
    const api = freeApi('owner')
    delete api.upgrade
    const { container } = await render('upgrade')

    expect(container.querySelector('.upgrade [role="alert"]')).not.toBeNull()
    expect(featureCardsIn(container).map(({ counts }) => counts)).toEqual([[], [], [], [], [], []])
    expect(pricingCardsIn(container).map(({ name, price }) => ({ name, price }))).toEqual([
      { name: planTexts.monthly.name, price: null },
      { name: planTexts.annual.name, price: null },
    ])
  })

  // creator-analytics#913: no pricing card shows before the first answer, so none flashes with no
  // amount and none takes a press with no price on it.
  test('the pricing cards wait for the first upgrade answer, then show its prices', async () => {
    const api = freeApi('owner')
    const held = api.hold(`GET /api/channels/${fakeChannel.id}/upgrade`)
    const { container } = await render('upgrade')

    expect(container.querySelector('h1')?.textContent).toBe(upgradeText.heading)
    expect(pricingCardsIn(container)).toEqual([])
    expect(buttonsNamed(container, subscribeTexts.annual)).toEqual([])

    await act(async () => held.release())
    await settle()

    expect(pricingCardsIn(container).map(({ price }) => price)).toEqual([
      '$7 a month',
      '$70 a year',
    ])
  })

  test("a format change keeps the pricing cards' amounts while the new answer loads", async () => {
    const api = freeApi('owner')
    const { container } = await render('upgrade')
    const held = api.hold(`GET /api/channels/${fakeChannel.id}/upgrade`)

    await act(async () => {
      window.history.pushState(null, '', '/upgrade?format=video')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await settle()

    expect(
      api.requests
        .filter(({ path }) => path.endsWith('/upgrade'))
        .at(-1)
        ?.query.get('format'),
    ).toBe('video')
    expect(pricingCardsIn(container).map(({ price, badge }) => ({ price, badge }))).toEqual([
      { price: '$7 a month', badge: null },
      { price: '$70 a year', badge: 'Save $14' },
    ])

    await act(async () => held.release())
    await settle()

    expect(pricingCardsIn(container).map(({ price }) => price)).toEqual([
      '$7 a month',
      '$70 a year',
    ])
  })

  test("with both comparisons under 2, the card shows no ready count and keeps each one's start date line", async () => {
    const api = freeApi('owner')
    if (api.upgrade) {
      api.upgrade = {
        ...api.upgrade,
        comparisons: [
          { window: 'first7', count: 1, availableOn: '2026-10-09' },
          { window: 'first28', count: 0, availableOn: null },
        ],
      }
    }
    const { container } = await render('upgrade')

    expect(featureCardsIn(container)[1]?.counts).toEqual([
      'First 7 days: 1 of your uploads would count if you subscribed today. It needs 2, so it starts on October 9, 2026.',
      'First 28 days: 0 of your uploads would count if you subscribed today. It needs 2, so it starts once 2 of your public uploads have had those days.',
    ])
  })
})

describe('an ended channel and the Customer Portal (creator-analytics#787)', () => {
  type Who = 'owner' | 'member'

  /** A channel whose subscription has ended, its history still stored, seen by its owner or not. */
  function endedApi(who: Who): FakeApi {
    const api = installFakeApi()
    const owner = who === 'owner'
    api.entitlements = entitlementsOf(
      { canSubscribe: owner },
      {
        channelId: fakeChannel.id,
        tier: 'free',
        owner,
        purgeDate: '2026-12-17',
        canSubscribe: owner,
      },
    )
    api.summaryDays = api.days.map((day) => ({ ...day, impressions: 100, ctr: 0.05 }))
    api.summaryHistory = {
      impressions: 200,
      ctr: 0.05,
      firstDay: '2026-10-03',
      newestDay: '2026-10-04',
      purgeDate: '2026-12-17',
    }
    return api
  }

  /** A paid channel, seen by its owner, who may manage it, or by another member, who may not. */
  function paidApi(who: Who): FakeApi {
    const api = installFakeApi()
    const owner = who === 'owner'
    api.entitlements = owner
      ? entitlementsOf(subscribedToOneBlock, {
          channelId: fakeChannel.id,
          tier: 'paid',
          canManage: true,
        })
      : entitlementsOf({}, { channelId: fakeChannel.id, tier: 'paid', owner, picked: false })
    return api
  }

  const purgeNote = `Your subscription has ended. This history is deleted on ${longDateOf('2026-12-17')}.`

  function purgeNotesIn(container: HTMLElement) {
    return [...container.querySelectorAll('p.note')].filter(({ textContent }) =>
      textContent?.startsWith(purgeNote),
    )
  }

  function subscribeAgainLinksIn(container: HTMLElement): HTMLAnchorElement[] {
    return [...container.querySelectorAll('a')].filter(
      (each) => each.textContent === 'Subscribe again',
    )
  }

  test('the owner of an ended channel sees its history cards, the note on its purge date and the subscribe-again link, which opens Settings with its two subscribe buttons', async () => {
    endedApi('owner')
    const { container } = await render('?window=last28')

    expect(
      [...container.querySelectorAll('.cards > div')].slice(3).map((card) => ({
        label: card.querySelector('dt')?.textContent,
        text: card.querySelector('.card-number')?.textContent,
        detail: card.querySelector('.card-detail')?.textContent ?? null,
      })),
    ).toEqual([
      { label: 'Impressions', text: '200', detail: null },
      { label: 'Impressions click-through rate', text: '5.0%', detail: null },
    ])
    expect(purgeNotesIn(container)).toHaveLength(1)
    const [link] = subscribeAgainLinksIn(container)
    if (!link) throw new Error('No subscribe-again link')
    expect(link.getAttribute('href')).toBe('/settings')

    await click(link)

    expect(rendered?.address()).toBe('settings')
    expect(
      [subscribeTexts.monthly, subscribeTexts.annual].flatMap((name) =>
        buttonsNamed(container, name).map(({ textContent }) => textContent),
      ),
    ).toEqual([subscribeTexts.monthly, subscribeTexts.annual])
  })

  test('another member of an ended channel sees the note on its purge date and no subscribe-again link', async () => {
    endedApi('member')
    const { container } = await render('?window=last28')

    expect(purgeNotesIn(container)).toHaveLength(1)
    expect(subscribeAgainLinksIn(container)).toEqual([])
  })

  test("the owner of an ended channel sees its list's own impressions and CTR columns, with no sample mark (creator-analytics#915)", async () => {
    const api = endedApi('owner')
    api.videos = [{ ...fakeVideo, impressions: 300, ctr: 0.04 }]
    api.listHistory = { firstDay: '2026-10-03', newestDay: '2026-10-04' }
    const { container } = await render('?window=last28')

    const columns = [...container.querySelectorAll('thead th')].map(
      ({ textContent }) => textContent,
    )
    expect(columns).toContain('Impressions')
    expect(container.textContent).not.toMatch(/sample/i)
  })

  test('a paid channel shows no note on a purge date', async () => {
    const api = paidApi('owner')
    api.summaryDays = api.days.map((day) => ({ ...day, impressions: 100, ctr: 0.05 }))
    api.summaryHistory = {
      impressions: 200,
      ctr: 0.05,
      firstDay: '2026-10-03',
      newestDay: '2026-10-04',
    }
    const { container } = await render('?window=last28')

    expect(container.textContent).not.toContain('Your subscription has ended')
  })

  test('the owner of a paid channel sees "Manage subscription" on Settings, whose click sends customer_portal_opened with no property and goes to the user\'s Portal the API answered', async () => {
    const api = paidApi('owner')
    const { container } = await render('settings')
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    vi.mocked(track).mockClear()

    try {
      expect(buttonsNamed(container, subscribeTexts.monthly)).toEqual([])
      await click(buttonNamed(container, manageSubscriptionText))

      expect(vi.mocked(track).mock.calls).toEqual([[{ name: 'customer_portal_opened' }]])
      expect(
        api.requests.filter(({ method }) => method === 'POST').map(({ path }) => path),
      ).toEqual(['/api/me/portal'])
      expect(assign.mock.calls).toEqual([[fakePortalUrl]])
    } finally {
      assign.mockRestore()
    }
  })

  test('a refused Portal sends no event and goes nowhere', async () => {
    const api = paidApi('owner')
    const { container } = await render('settings')
    api.failNext('POST /api/me/portal')
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    vi.mocked(track).mockClear()

    try {
      await click(buttonNamed(container, manageSubscriptionText))

      expect(vi.mocked(track).mock.calls).toEqual([])
      expect(assign).not.toHaveBeenCalled()
      expect(container.querySelector('[role="alert"]')).not.toBeNull()
    } finally {
      assign.mockRestore()
    }
  })

  test('another member of a paid channel sees no "Manage subscription"', async () => {
    paidApi('member')
    const { container } = await render('settings')

    expect(buttonsNamed(container, manageSubscriptionText)).toEqual([])
  })
})

describe('the timing of the budget screens (creator-analytics#1053)', () => {
  // A clock, a performance observer and a page the test drives, as main.tsx hands the browser's.
  let time = 0
  const observed = new Map<ScreenTimingEntryType, (entries: ScreenTimingEntry[]) => void>()
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as const })
  let stop: () => void = () => {}

  beforeEach(() => {
    time = 0
    stop = startScreenTiming({
      now: () => time,
      observe: (type, onEntries) => {
        observed.set(type, onEntries)
        return () => observed.delete(type)
      },
      document: page,
    })
  })
  afterEach(() => stop())

  const entries = (type: ScreenTimingEntryType, list: ScreenTimingEntry[]) =>
    observed.get(type)?.(list)
  const input = () => page.dispatchEvent(new Event('pointerdown'))
  const timingEvents = () =>
    vi
      .mocked(track)
      .mock.calls.map(([event]) => event)
      .filter(({ name }) => name === 'web_vital' || name === 'answer_shown')

  /** Opens the channel screen from its address with the page load's events sent, and clears them. */
  async function onTheList(address = '') {
    const shown = await render(address)
    input()
    vi.mocked(track).mockClear()
    return shown
  }

  test.each([
    ['the channel screen', '', '/app/', 'last28', 'miss'],
    ["a video's detail", `videos/${fakeVideo.id}`, '/app/videos/:id', 'last28', 'miss'],
    ['Audience', 'audience', '/app/audience', 'last28', 'miss'],
    ['the retention comparison', 'retention', '/app/retention', 'lifetime', 'stored'],
  ])(
    'opening %s from its address sends its load, from navigation start, and its LCP',
    async (_, address, screen, window, cache) => {
      installFakeApi()
      entries('largest-contentful-paint', [{ startTime: 1180.4, duration: 0 }])
      time = 1625

      await render(address)
      input()

      expect(timingEvents()).toEqual([
        { name: 'answer_shown', screen, trigger: 'load', window, cache, ms: 1625 },
        { name: 'web_vital', metric: 'LCP', value: 1180, screen },
      ])
    },
  )

  test('the click that opens Audience counts in the channel screen INP, though its entry comes after', async () => {
    installFakeApi()
    const { container } = await onTheList()

    // A browser reports the click's entry only once the next screen has painted.
    time = 3010
    await click(sidebarLink(container, audienceLinkText))
    entries('event', [{ startTime: 3000, duration: 184, interactionId: 4 }])
    await click(sidebarLink(container, retentionLinkText))

    expect(timingEvents()).toEqual([
      expect.objectContaining({ name: 'answer_shown', screen: '/app/audience', trigger: 'load' }),
      { name: 'web_vital', metric: 'INP', value: 184, screen: '/app/' },
      expect.objectContaining({ name: 'answer_shown', screen: '/app/retention', trigger: 'load' }),
    ])
  })

  test.each([
    ['a format', 'filter', 'format', (c: HTMLElement) => chooseFormat(c, 'Shorts')],
    [
      'the visibility',
      'filter',
      'visibility',
      (c: HTMLElement) => click(switchNamed(c, visibilitySwitchLabel)),
    ],
    ['a sort', 'sort', undefined, (c: HTMLElement) => click(headingNamed(c, 'Engaged views'))],
    ['a page', 'page', undefined, (c: HTMLElement) => click(linkNamed(c, 'Next page'))],
    ['a page size', 'page', undefined, (c: HTMLElement) => choose(c, pageSizeLabel, '50')],
    ['the window', 'window', undefined, (c: HTMLElement) => choose(c, 'Date range', 'last90')],
  ])(
    '%s change on the channel screen sends its answer shown with its trigger',
    async (_, trigger, filter, change) => {
      const api = installFakeApi()
      api.pageCount = 2
      const { container } = await onTheList()

      await change(container)

      expect(timingEvents()).toEqual([
        {
          name: 'answer_shown',
          screen: '/app/',
          trigger,
          ...(filter ? { filter } : {}),
          window: trigger === 'window' ? 'last90' : 'last28',
          cache: 'miss',
          ms: 0,
        },
      ])
    },
  )

  test('a change measures from the input to its answer, and an answer from the cache is a hit', async () => {
    const api = installFakeApi()
    const { container } = await onTheList()
    api.fromCache = true
    const reads = holdBoth(api, `GET /api/channels/${fakeChannel.id}/videos`)

    time = 4000
    await chooseFormat(container, 'Videos')
    time = 4385
    reads.release()
    await settle()

    expect(timingEvents()).toEqual([
      {
        name: 'answer_shown',
        screen: '/app/',
        trigger: 'filter',
        filter: 'format',
        window: 'last28',
        cache: 'hit',
        ms: 385,
      },
    ])
  })

  test('Back to the filter just had sends its answer shown', async () => {
    installFakeApi()
    const { container } = await onTheList()
    await chooseFormat(container, 'Shorts')
    vi.mocked(track).mockClear()

    await act(async () => window.history.back())
    await settle()

    expect(timingEvents()).toEqual([
      expect.objectContaining({ screen: '/app/', trigger: 'filter', filter: 'format' }),
    ])
  })

  test.each([
    ["a video's detail", `videos/${fakeVideo.id}`, '/app/videos/:id'],
    ['Audience', 'audience', '/app/audience'],
  ])('a window change on %s sends its answer shown', async (_, address, screen) => {
    const api = installFakeApi()
    const { container } = await onTheList(address)
    api.fromCache = true

    await choose(container, 'Date range', 'last90')

    expect(timingEvents()).toEqual([
      { name: 'answer_shown', screen, trigger: 'window', window: 'last90', cache: 'hit', ms: 0 },
    ])
  })

  test("the retention comparison's picker change measures the picker's own read, and a pick sends nothing", async () => {
    const api = installFakeApi()
    const [first, second] = comparedVideos(2) as [VideoRow, VideoRow]
    api.videos = [first, second]
    api.retentionCurves = [storedCurveOf(first, 1), storedCurveOf(second, 0.8)]
    const { container } = await onTheList('retention')

    await click(pickBoxOf(container, 'Video 1'))
    api.fromCache = true
    await choose(container, comparisonText.sort, 'averageViewPercentage')

    expect(timingEvents()).toEqual([
      {
        name: 'answer_shown',
        screen: '/app/retention',
        trigger: 'sort',
        window: 'lifetime',
        cache: 'hit',
        ms: 0,
      },
    ])
  })

  test('no timing event carries a channel ID, a video ID, an account or an address', async () => {
    const api = installFakeApi()
    api.pageCount = 2
    const { container } = await render(`videos/${fakeVideo.id}?channel=${fakeChannel.id}`)
    entries('event', [{ startTime: 3000, duration: 96, interactionId: 2 }])
    await click(linkNamed(container, 'Back to videos'))
    await chooseFormat(container, 'Shorts')
    await click(linkNamed(container, 'Next page'))
    await click(sidebarLink(container, audienceLinkText))
    await click(sidebarLink(container, retentionLinkText))
    input()

    const sent = JSON.stringify(timingEvents())
    expect(timingEvents().length).toBeGreaterThan(5)
    for (const held of [fakeChannel.id, fakeChannel.youtubeChannelId, fakeVideo.id, 'Ada', '@']) {
      expect(sent).not.toContain(held)
    }
    expect(sent).not.toContain('?')
    const screens = new Set(timingEvents().map((event) => 'screen' in event && event.screen))
    expect([...screens].sort()).toEqual([
      '/app/',
      '/app/audience',
      '/app/retention',
      '/app/videos/:id',
    ])
  })
})
