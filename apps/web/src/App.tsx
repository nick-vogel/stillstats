import highlights from 'virtual:highlights'
import type {
  BillingPlan,
  BlockAddAnswer,
  BlockPreviewAnswer,
  ChannelsAnswer,
  CheckoutStartAnswer,
  ClientSettingsAnswer,
  ConsentStartAnswer,
  DeleteMeAnswer,
  DisconnectAnswer,
  EntitlementsAnswer,
  ListedChannel,
  MeAnswer,
  PortalStartAnswer,
  Preferences,
  PreferencesAnswer,
  PreferencesUpdate,
  RefusalAnswer,
  SupportAnswer,
  Theme,
} from '@creator-analytics/api-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SidebarProvider, useSidebarColumn } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/toast'
import { AdminFeedback } from './AdminFeedback.tsx'
import { AdminGrants } from './AdminGrants.tsx'
import { Audience } from './Audience.tsx'
import { track } from './analytics.ts'
import { ChannelSummaryFigures } from './ChannelSummaryFigures.tsx'
import { ConsentScreen } from './ConsentScreen.tsx'
import { ControlsBar, useChannelBounds } from './ControlsBar.tsx'
import { CanUpgradeContext, canUpgradeOf, channelPaidOf } from './can-upgrade.ts'
import { channelTitleOf, selectedChannelOf } from './channel-picker.ts'
import {
  type ConsentLanding,
  type ConsentRequest,
  connectionRequestOf,
  continuedEvent,
  googleConsentPathOf,
  landingOfRoute,
  openedEvent,
  signInEvent,
  signInPathOf,
} from './consent.ts'
import { Feedback } from './Feedback.tsx'
import { Header } from './Header.tsx'
import {
  type FailedSave,
  failedSaveAfterFailureOf,
  failedSaveAfterSuccessOf,
  failedSaveNotice,
  failedSaveOn,
  PreferencesContext,
  preferencesAfterFailedSave,
  preferencesAfterRead,
  preferencesResetEvent,
  saveTracker,
  settledOf,
  sidebarOpenOf,
  themeOnViewOf,
  toastCloseLabel,
  writeQueue,
} from './preferences.ts'
import { RetentionComparison } from './RetentionComparison.tsx'
import { refusalMessageOf } from './refusals.ts'
import {
  addressOf,
  revertAddressAfterFailedSave,
  routeToUpgrade,
  routeWithoutPreferences,
  useRoute,
} from './route.ts'
import { Settings } from './Settings.tsx'
import { Sidebar } from './Sidebar.tsx'
import { SignedOut } from './SignedOut.tsx'
import { SponsorReport } from './SponsorReport.tsx'
import {
  currencySavedNotice,
  noChannelText,
  noFreeSlotText,
  preferencesResetNotice,
  proChannelSelectedEvent,
  resetPreferencesWarning,
  unpickWarning,
} from './settings.ts'
import {
  addBlockQuestionOf,
  blockAddedEvent,
  blockAddedTextOf,
  blocksChangedText,
  checkoutStartedEvent,
  portalOpenedEvent,
  proSectionOf,
  totalBlocksOf,
} from './subscribe.ts'
import {
  sidebarSupportLinkOf,
  supportOpenedEvent,
  supportPromptDismissedEvent,
  supportThanksOf,
} from './support.ts'
import { type ToastNotice, ToastShown } from './Toast.tsx'
import { applyTheme, pageStorage, storedTheme } from './theme.ts'
import { Upgrade } from './Upgrade.tsx'
import {
  upgradeItemShownOf,
  upgradeLinkClickedEvent,
  upgradePromptDismissedEvent,
} from './upgrade-prompt.ts'
import { VideoDetail } from './VideoDetail.tsx'
import { VideoList } from './VideoList.tsx'
import {
  type ListMark,
  markedVideoOf,
  routeAfterLostSwitches,
  type SummaryPlaceList,
} from './video-list.ts'
import { WhatsNew } from './WhatsNew.tsx'
import { WhatsNewBanner } from './WhatsNewBanner.tsx'
import {
  bannerReleaseOf,
  markerAfterOpen,
  whatsNewBannerClosedEvent,
  whatsNewOpenedEvent,
  whatsNewOpenedFromBannerEvent,
} from './whats-new.ts'

type Session =
  | { state: 'loading' }
  // The session read failed: the alert says why, and nothing waits on it.
  | { state: 'failed' }
  | { state: 'signed-out' }
  | { state: 'signed-in'; user: MeAnswer }

/**
 * The alert's text, and the action whose failure wrote it, such as `reset` or `disconnect:<channel>`,
 * so that action's success clears it. Null for any other writer.
 */
type Alert = { text: string; from: string | null }

const jsonPost = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }

function assertAnswered(response: Response): void {
  if (!response.ok) throw new Error(`The API answered ${response.status}`)
}

async function readSession(): Promise<Session> {
  const response = await fetch('/api/me')
  if (response.status === 401) return { state: 'signed-out' }
  assertAnswered(response)
  return { state: 'signed-in', user: (await response.json()) as MeAnswer }
}

/** Starts a Google consent through one of the API's routes, which answers with Google's URL. */
async function goToGoogle(path: string): Promise<void> {
  const response = await fetch(path, jsonPost)
  assertAnswered(response)
  const { url } = (await response.json()) as ConsentStartAnswer
  window.location.assign(url)
}

async function readChannels(): Promise<ListedChannel[]> {
  const response = await fetch('/api/channels')
  assertAnswered(response)
  return ((await response.json()) as ChannelsAnswer).channels
}

async function readPreferences(): Promise<Preferences> {
  const response = await fetch('/api/me/preferences')
  assertAnswered(response)
  return (await response.json()) as PreferencesAnswer
}

async function readSupport(): Promise<SupportAnswer> {
  const response = await fetch('/api/me/support')
  assertAnswered(response)
  return (await response.json()) as SupportAnswer
}

async function readEntitlements(): Promise<EntitlementsAnswer> {
  const response = await fetch('/api/me/entitlements')
  assertAnswered(response)
  return (await response.json()) as EntitlementsAnswer
}

/** Opens Stripe's Checkout for the user's Pro subscription, one block, as a Google consent opens. */
async function startCheckout(plan: BillingPlan): Promise<void> {
  track(checkoutStartedEvent(plan))
  const response = await fetch('/api/me/checkout', {
    ...jsonPost,
    body: JSON.stringify({ plan }),
  })
  assertAnswered(response)
  const { url } = (await response.json()) as CheckoutStartAnswer
  window.location.assign(url)
}

/**
 * Opens Stripe's Customer Portal for the user's subscription, as Checkout opens. The event goes
 * once the API has answered the Portal's URL, so a refused open is not counted.
 */
async function openPortal(): Promise<void> {
  const response = await fetch('/api/me/portal', jsonPost)
  assertAnswered(response)
  const { url } = (await response.json()) as PortalStartAnswer
  track(portalOpenedEvent)
  window.location.assign(url)
}

/**
 * What one more block costs, read from Stripe by the API, or the refusal of a user with no live
 * paid subscription.
 */
async function readBlockPreview(): Promise<BlockPreviewAnswer | RefusalAnswer> {
  const response = await fetch('/api/me/block-preview')
  if (response.status === 409) return (await response.json()) as RefusalAnswer
  assertAnswered(response)
  return (await response.json()) as BlockPreviewAnswer
}

/** Adds the block the preview priced, by the count it answered, or answers the API's refusal. */
async function postBlock(blocks: number): Promise<BlockAddAnswer | RefusalAnswer> {
  const response = await fetch('/api/me/blocks', { ...jsonPost, body: JSON.stringify({ blocks }) })
  if (response.status === 409) return (await response.json()) as RefusalAnswer
  assertAnswered(response)
  return (await response.json()) as BlockAddAnswer
}

/** What `Alert.from` names a failed add of a block by. */
const addBlockAlert = 'add-block'

/**
 * Picks the channel for one of the user's Pro slots, or with DELETE takes it out, and answers the
 * changed entitlements, or the refusal of a pick with no free slot, which the alert explains.
 */
async function changeProPick(
  channelId: string,
  method: 'PUT' | 'DELETE',
): Promise<EntitlementsAnswer | RefusalAnswer> {
  const response = await fetch(`/api/channels/${channelId}/pro-pick`, { method })
  if (response.status === 409) return (await response.json()) as RefusalAnswer
  assertAnswered(response)
  return (await response.json()) as EntitlementsAnswer
}

/** What `Alert.from` names a failed pick or unpick of the channel by. */
const proPickAlertOf = (channelId: string) => `pro-pick:${channelId}`

async function savePreferences(change: PreferencesUpdate): Promise<void> {
  const response = await fetch('/api/me/preferences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(change),
  })
  assertAnswered(response)
}

async function clearPreferences(): Promise<void> {
  assertAnswered(await fetch('/api/me/preferences', { method: 'DELETE' }))
}

async function continueToGoogle(request: ConsentRequest): Promise<void> {
  track(continuedEvent(request))
  await goToGoogle(googleConsentPathOf(request))
}

// This screen carries the connection consent text, so its sign-in asks the API to take a user with
// no channel from Google sign-in straight on to Google's connect consent: on a first visit, this
// click is the last one before Google. On the upgrade screen's address it lands back there
// (creator-analytics#907).
async function signInWithGoogle(landing: ConsentLanding | undefined): Promise<void> {
  track(signInEvent)
  await goToGoogle(signInPathOf(landing))
}

const disconnectWarning =
  'Disconnect this channel? The product revokes its access and deletes all of its data within 24 hours.'

/**
 * Disconnects the channel, and answers its message: what the creator still has to do, if anything,
 * and whether that asks them to act.
 */
async function disconnectChannel(channelId: string): Promise<{ text: string; asksToAct: boolean }> {
  const response = await fetch(`/api/channels/${channelId}/disconnect`, jsonPost)
  assertAnswered(response)
  const { revokedAtGoogle } = (await response.json()) as DisconnectAnswer
  const disconnected = 'The channel is disconnected. Its data is deleted within 24 hours.'
  return revokedAtGoogle
    ? { text: disconnected, asksToAct: false }
    : {
        text: `${disconnected} Google did not confirm that it removed the product's access, so remove it in your Google Account settings.`,
        asksToAct: true,
      }
}

/** What `Alert.from` names a failed disconnect of the channel by. */
const disconnectAlertOf = (channelId: string) => `disconnect:${channelId}`

/** What `Alert.from` names a failed "Reset preferences" by. */
const resetAlert = 'reset'

const deleteUserWarning =
  'Delete yourself from the product? It signs you out, revokes its access to each of your channels and deletes all of their data within 24 hours.'

/** Deletes the user, and answers what the creator still has to do, if anything. */
async function deleteUser(): Promise<string> {
  const response = await fetch('/api/me', { method: 'DELETE' })
  assertAnswered(response)
  const { revokedAtGoogle } = (await response.json()) as DeleteMeAnswer
  const deleted =
    'You are deleted from the product. The data of your channels is deleted within 24 hours.'
  return revokedAtGoogle
    ? deleted
    : `${deleted} Google did not confirm that it removed the product's access, so remove it in your Google Account settings.`
}

export function App({
  landingMessage,
  clientSettings,
}: {
  landingMessage: string | null
  /** What the API answered at load, or null when it could not be read. */
  clientSettings: ClientSettingsAnswer | null
}) {
  const [session, setSession] = useState<Session>({ state: 'loading' })
  // Null until the API answers, so no channel reads as none.
  const [channels, setChannels] = useState<ListedChannel[] | null>(null)
  // Its own value, not the error, so a landing message does not end the wait.
  const [channelsFailed, setChannelsFailed] = useState(false)
  const [saved, setSaved] = useState<Preferences | null>(null)
  // Null until the API answers, and after a failed read, which shows no alert: support is optional,
  // and an alert over it would read as a broken product (ADR 0011).
  const [support, setSupport] = useState<SupportAnswer | null>(null)
  // Null until the API answers, and after a failed read, which shows no alert, as support's: no
  // subscribe action shows until it lands.
  const [entitlements, setEntitlements] = useState<EntitlementsAnswer | null>(null)
  // Whether the first read of the preferences has landed or failed. Not `saved`, which a change
  // made before the read sets, while the server's switches are still unknown.
  const [preferencesRead, setPreferencesRead] = useState(false)
  // The values the server last confirmed, which a failed save goes back to.
  const confirmed = useRef<Preferences>({})
  // Whether a reset has succeeded since the screen opened, so a first read that lands after it,
  // with the values the server held before it, puts none of them back.
  const resetSinceOpened = useRef(false)
  // Whether the server's preferences are known: their read landed, or a reset cleared them. A
  // failed read leaves them unknown. Until then the page keeps the theme the head script drew from
  // the browser's copy at load, and shows no "Upgrade" item, whose dismissal lives only in them
  // (creator-analytics#907).
  const [themeAtLoad] = useState(() => storedTheme(pageStorage))
  const [serverPreferencesKnown, setServerPreferencesKnown] = useState(false)
  const theme = themeOnViewOf(saved, serverPreferencesKnown, themeAtLoad)
  const [writePreferences] = useState(writeQueue)
  // One function for the app's life, so an effect that waits on it does not run again on each save.
  const [settled] = useState(() => settledOf(writePreferences))
  const [saves] = useState(saveTracker)
  // The channels a Disconnect has succeeded for, whose later Disconnect failures are untrue.
  const disconnected = useRef(new Set<string>())
  const [error, setError] = useState<Alert | null>(
    landingMessage === null ? null : { text: landingMessage, from: null },
  )
  /** Clears the alert if `from`'s own failure wrote it, as a success of that action makes it untrue. */
  const clearAlertFrom = (from: string) =>
    setError((current) => (current?.from === from ? null : current))
  // A success's toast: a reset, a disconnect or a saved currency. Its number starts the wait over
  // for a later one, and a message that asks the creator to act stays until its close.
  const [successToast, setSuccessToast] = useState<{
    id: number
    text: string
    asksToAct: boolean
  } | null>(null)
  const toastCount = useRef(0)
  const showSuccess = useCallback((text: string, asksToAct = false) => {
    toastCount.current += 1
    setSuccessToast({ id: toastCount.current, text, asksToAct })
  }, [])
  // The message after "Delete me", which signs the user out and shows on the signed-out screen.
  const [signedOutNotice, setSignedOutNotice] = useState<string | null>(null)
  const [failedSave, setFailedSave] = useState<FailedSave | null>(null)
  const [consentRequest, setConsentRequest] = useState<ConsentRequest | null>(null)
  // What the video list shows, which the summary's place draws in a window after publish, and the
  // video whose list row is hovered or whose launch chart line is selected: the list is the chart's
  // legend, so the two share it. A mark from either surface replaces the other's, but a clear from
  // one surface ends only a mark that surface made, so a row's pointer leave keeps the chart's
  // selection and the plot's blur keeps a hovered row's mark.
  const [summaryPlaceList, setSummaryPlaceList] = useState<SummaryPlaceList>({ kind: 'reading' })
  const [mark, setMark] = useState<ListMark | null>(null)
  const markedVideoId = markedVideoOf(mark, summaryPlaceList)
  const markedBy = markedVideoId === null ? null : (mark?.by ?? null)
  const markVideoBy = (by: ListMark['by']) => (videoId: string | null) =>
    setMark((last) =>
      videoId !== null ? { videoId, list: summaryPlaceList, by } : last?.by === by ? null : last,
    )
  const opener = useRef<HTMLElement | null>(null)
  // The channel screen's controls bar, which the video list's heading rows sit under.
  const controlsBar = useRef<HTMLDivElement>(null)
  // The session on view, which a successful Sign out or Delete me ends. A failure writes its alert
  // only while the session that started its request lasts, so none reaches the signed-out screen.
  const sessionNumber = useRef(0)
  const alertOnFailure = useCallback((from: string | null = null) => {
    const started = sessionNumber.current
    return (reason: unknown) => {
      if (sessionNumber.current === started) setError({ text: String(reason), from })
    }
  }, [])
  /** Starts an action, whose failure shows in the alert while the session that started it lasts. */
  function start(action: () => Promise<void>, from: string | null = null) {
    const showError = alertOnFailure(from)
    action().catch(showError)
  }
  // Before useRoute, whose read of the address drops the parameter, so a reload thanks no one twice.
  const [supportThanks] = useState(() => supportThanksOf(window.location.search))
  const [route, navigate] = useRoute()
  const selected = channels && selectedChannelOf(channels, route)
  // A channel screen waits for the preferences read too, so its chart never draws the default mode
  // and then jumps to the saved one, and the list never resets an address sort by the default
  // column switches.
  const channelOnView = preferencesRead ? selected : null
  // Meanwhile it holds its place. A failed read of the channels ends the wait; a failed read of
  // the preferences ends it with the defaults.
  const channelWaiting = !channelsFailed && (channels === null || !preferencesRead)
  const screenShown = channelOnView || channelWaiting
  // Beside every screen of a creator with a channel, and while the channels are read, so the
  // layout does not jump once they land.
  const sidebarShown = channels === null ? !channelsFailed : channels.length > 0
  // Where the sidebar is a column, from 48rem on a window tall enough for its rows, it holds the
  // wordmark, the picker and the account menu, so the header goes. While the session is read the
  // column holds its place from the first paint, as nothing says yet who the visitor is, so the
  // wordmark and the avatar hold still when a creator with a channel lands (creator-analytics#507);
  // below the column the header holds it, and its Menu holds the sidebar's items, as the sidebar
  // renders nothing there (creator-analytics#891).
  const sidebarColumn = useSidebarColumn()
  const sessionReadBesideColumn = session.state === 'loading' && sidebarColumn
  const headerShown =
    (session.state === 'loading' && !sidebarColumn) ||
    (session.state === 'signed-in' && !(sidebarShown && sidebarColumn))
  const sidebarSupportLink = sidebarSupportLinkOf(support, saved ?? {})
  const shownChannelId = channelOnView ? channelOnView.id : null
  // Whether the user may subscribe the channel on view: not until the entitlements answer lands.
  const canUpgrade = canUpgradeOf(entitlements, shownChannelId)
  // The sidebar's "Upgrade" item, for the channel on view: its owner's while it is free and the
  // Pro is offered, until the item is hidden (creator-analytics#907). Its dismissal lives
  // only in the preferences, unlike the support prompt's, which the support answer carries too, so
  // it waits for the server's preferences, and a failed read keeps it hidden for the visit.
  const knownPreferences = serverPreferencesKnown ? (saved ?? {}) : null
  const sidebarUpgradeRoute =
    knownPreferences !== null && upgradeItemShownOf(canUpgrade, knownPreferences)
      ? routeToUpgrade(route)
      : null
  // The days a custom range can cover on the channel screen and the Audience screen, from the last
  // answer of the video list, which is read in every window, or of the Audience screen. They are
  // the channel's own, so another channel's are dropped.
  const [channelBounds, takeListBounds] = useChannelBounds(shownChannelId)
  const address = addressOf(route)
  const failedSaveOnView = failedSaveOn(failedSave, address)
  // The route on view when a save fails, which can come after the screen it was made on.
  const routeOnView = useRef(route)
  routeOnView.current = route

  useEffect(() => setFailedSave((failed) => failedSaveOn(failed, address)), [address])

  // The theme on view, on the page's root and in the browser's copy, which the head script reads
  // at the next load: a change shows at once, before its save lands, and a failed save, the read
  // landing and a reset each move it as they move the saved preferences.
  useEffect(() => applyTheme(theme, document.documentElement, pageStorage), [theme])

  useEffect(() => {
    // Before any session, so its failure always shows.
    readSession().then(setSession, (reason: unknown) => {
      setSession({ state: 'failed' })
      setError({ text: String(reason), from: null })
    })
  }, [])

  useEffect(() => {
    if (session.state !== 'signed-in') return
    const showError = alertOnFailure()
    readChannels().then(setChannels, (reason: unknown) => {
      setChannelsFailed(true)
      showError(reason)
    })
    readSupport().then(setSupport, () => setSupport(null))
    readEntitlements().then(setEntitlements, () => setEntitlements(null))
    readPreferences().then(
      (read) => {
        const reset = resetSinceOpened.current
        confirmed.current = preferencesAfterRead(read, confirmed.current, reset)
        setSaved((current) => preferencesAfterRead(read, current, reset))
        setServerPreferencesKnown(true)
        setPreferencesRead(true)
      },
      (reason: unknown) => {
        showError(reason)
        setSaved((current) => current ?? {})
        setPreferencesRead(true)
      },
    )
  }, [session.state, alertOnFailure])

  // The change shows at once; the save goes on behind it. A failed save puts the values it changed
  // back, in the saved preferences and the address, so the screen never shows a choice the server
  // does not hold, and says so.
  const preferences = useMemo(
    () => ({
      saved: saved ?? {},
      save(change: Preferences) {
        setSaved((current) => ({ ...current, ...change }))
        const id = saves.started(change)
        writePreferences(() => savePreferences(change)).then(
          () => {
            confirmed.current = { ...confirmed.current, ...change }
            setFailedSave((failed) => failedSaveAfterSuccessOf(failed, change))
            if (change.currency !== undefined) showSuccess(currencySavedNotice)
          },
          () => {
            // A later save of the same keys holds the screen's values, so only the rest revert.
            const lost = saves.lostOf(id, change)
            if (Object.keys(lost).length === 0) return
            setSaved((current) =>
              preferencesAfterFailedSave(current ?? {}, lost, confirmed.current),
            )
            setSuccessToast(null)
            // Outside the updater, which StrictMode runs twice: the revert navigates.
            const shownOn = revertAddressAfterFailedSave(
              routeOnView.current,
              lost,
              navigate,
              (route) => routeAfterLostSwitches(route, lost),
            )
            setFailedSave((failed) =>
              failedSaveAfterFailureOf(failed, { id, address: shownOn, lost }),
            )
          },
        )
      },
      settled,
    }),
    [saved, writePreferences, settled, navigate, saves, showSuccess],
  )

  function openConsentScreen(request: ConsentRequest) {
    track(openedEvent(request))
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setConsentRequest(request)
  }

  function giveRevenueConsent(channelId: string) {
    openConsentScreen({ consent: 'revenue', channelId })
  }

  function giveShownChannelRevenueConsent() {
    if (shownChannelId) giveRevenueConsent(shownChannelId)
  }

  // A tip opens Stripe's page in a new tab, whose return lands on Settings there, so this tab
  // reads the support answer again whenever it is on view again: once the webhook has recorded the
  // tip, the sidebar's item goes. A failed read keeps the answer on view, as the reset's does.
  useEffect(() => {
    if (session.state !== 'signed-in') return
    const readSupportWhenVisible = () => {
      if (document.visibilityState === 'visible') readSupport().then(setSupport, () => {})
    }
    document.addEventListener('visibilitychange', readSupportWhenVisible)
    return () => document.removeEventListener('visibilitychange', readSupportWhenVisible)
  }, [session.state])

  // A Cancel hands focus back to the button that opened the consent screen.
  useEffect(() => {
    if (consentRequest !== null) return
    opener.current?.focus()
    opener.current = null
  }, [consentRequest])

  async function disconnect(channelId: string) {
    track({ name: 'disconnect_channel_clicked' })
    if (!window.confirm(disconnectWarning)) return
    const answer = await disconnectChannel(channelId).catch((reason: unknown) => {
      if (disconnected.current.has(channelId)) return null
      throw reason
    })
    if (answer !== null) {
      disconnected.current.add(channelId)
      clearAlertFrom(disconnectAlertOf(channelId))
      showSuccess(answer.text, answer.asksToAct)
    }
    setChannels(await readChannels())
    // Any failure that passed the set check before the add has written its alert by now.
    clearAlertFrom(disconnectAlertOf(channelId))
  }

  /**
   * Picks the channel, and redraws Settings from the answer. An accepted pick sends
   * `pro_channel_selected` with the user's blocks, paid and granted; a refused one shows why in
   * the alert.
   */
  async function pickChannel(channelId: string) {
    const showError = alertOnFailure(proPickAlertOf(channelId))
    const answer = await changeProPick(channelId, 'PUT')
    if ('refusal' in answer) {
      showError(refusalMessageOf(answer, 'Pro', { no_free_slot: noFreeSlotText }))
      return
    }
    clearAlertFrom(proPickAlertOf(channelId))
    setEntitlements(answer)
    track(proChannelSelectedEvent(totalBlocksOf(answer)))
  }

  /** Takes the channel out of Pro once the user confirms, and redraws Settings from the answer. */
  async function unpickChannel(channelId: string) {
    if (!window.confirm(unpickWarning)) return
    const answer = await changeProPick(channelId, 'DELETE')
    if ('refusal' in answer) throw new Error(`The API refused the unpick: ${answer.refusal}`)
    clearAlertFrom(proPickAlertOf(channelId))
    setEntitlements(answer)
  }

  /**
   * Adds a block once the user confirms the price and the prorated charge Stripe gave, then
   * redraws Settings with the new slots, raises a toast and sends `block_added` with the blocks
   * after it. A cancel, or a refusal, which the alert explains, sends nothing.
   */
  async function addBlock() {
    const showError = alertOnFailure(addBlockAlert)
    const refusalTexts = { blocks_changed: blocksChangedText }
    const preview = await readBlockPreview()
    if ('refusal' in preview) {
      showError(refusalMessageOf(preview, 'Pro', refusalTexts))
      return
    }
    if (!window.confirm(addBlockQuestionOf(preview))) return
    const added = await postBlock(preview.blocks)
    if ('refusal' in added) {
      showError(refusalMessageOf(added, 'Pro', refusalTexts))
      setEntitlements(await readEntitlements())
      return
    }
    clearAlertFrom(addBlockAlert)
    track(blockAddedEvent(added.blocks))
    const answer = await readEntitlements()
    setEntitlements(answer)
    // The toast says the slots the user now holds, a grant's included; the event, the paid blocks.
    showSuccess(blockAddedTextOf(totalBlocksOf(answer)))
  }

  async function deleteYourself() {
    track({ name: 'delete_user_clicked' })
    if (!window.confirm(deleteUserWarning)) return
    const notice = await deleteUser()
    clearToasts()
    // The alert of a failed try belongs to the session that has just ended, as the toasts do.
    setError(null)
    sessionNumber.current += 1
    setChannels([])
    setSession({ state: 'signed-out' })
    setSignedOutNotice(notice)
  }

  async function resetPreferences() {
    if (!window.confirm(resetPreferencesWarning)) return
    const mark = saves.count()
    await writePreferences(clearPreferences)
    clearAlertFrom(resetAlert)
    resetSinceOpened.current = true
    confirmed.current = {}
    setServerPreferencesKnown(true)
    // A change made while the reset ran stays: its save queued behind the reset's, so the server
    // holds it once that lands, and its own failure puts the default back.
    setSaved((current) => saves.changedSince(mark, current ?? {}))
    // The reset cleared the support prompt's dismissal too, so the support answer is read again for
    // the sidebar's item. A failed read keeps the answer on view and shows no alert, as support is
    // optional, and dropping it would hide the Settings screen's support section as well.
    readSupport().then(setSupport, () => {})
    setFailedSave(null)
    // The address's values would otherwise win over the defaults the confirmation promised. The
    // route on view, not the Settings screen's, as the creator may have left it while the reset ran.
    navigate(routeWithoutPreferences(routeOnView.current), { replace: true })
    track(preferencesResetEvent)
    showSuccess(preferencesResetNotice)
  }

  // Once the preferences read lands, so a marker the server holds is known first, and never on the
  // screen it opens. Its release is null for no banner.
  const bannerRelease =
    session.state === 'signed-in' && preferencesRead && !route.whatsNew
      ? bannerReleaseOf(highlights, saved?.whatsNewMarker, session.user.createdAt)
      : null

  // "What's new" on view, by any path (the sidebar, the header's Menu, the banner or the address),
  // moves the marker to the newest highlighted release, so the banner goes. Not before the
  // preferences read lands, whose marker may already be there or past it, and never back.
  const markerToSave =
    session.state === 'signed-in' && preferencesRead && route.whatsNew
      ? markerAfterOpen(highlights, saved?.whatsNewMarker)
      : undefined
  // Once per visit to the screen: a failed save puts the old marker back, and a second try then
  // would follow every failure with another.
  const markerSent = useRef<string | null>(null)
  const whatsNewOnView = route.whatsNew === true
  useEffect(() => {
    if (!whatsNewOnView) markerSent.current = null
  }, [whatsNewOnView])
  const { save: savePreference } = preferences
  useEffect(() => {
    if (markerToSave === undefined || markerSent.current === markerToSave) return
    markerSent.current = markerToSave
    savePreference({ whatsNewMarker: markerToSave })
  }, [markerToSave, savePreference])

  // The banner goes at once, as the saved preferences now hold the marker; a failed save brings it
  // back with the failed save's notice.
  function closeBanner(release: string) {
    preferences.save({ whatsNewMarker: release })
    track(whatsNewBannerClosedEvent)
  }

  // The item goes at once, as the saved preferences now hold the dismissal; a failed save takes it
  // back with the failed save's notice.
  function hideSupport() {
    preferences.save({ supportPromptDismissed: true })
    track(supportPromptDismissedEvent)
  }

  // As the support item's: the item goes at once, and a failed save takes it back with the failed
  // save's notice.
  function hideUpgrade() {
    preferences.save({ upgradePromptDismissed: true })
    track(upgradePromptDismissedEvent)
  }

  // The account menu's theme (creator-analytics#692) takes Settings' save, so the page changes at
  // once through the theme effect above, and a failed save's revert and notice are Settings' own.
  // No event, as from Settings (Nick, 2026-11-12).
  function changeTheme(chosen: Theme) {
    preferences.save({ theme: chosen })
  }

  // A toast belongs to the session it showed in, so none waits for the next sign-in.
  function clearToasts() {
    setFailedSave(null)
    setSuccessToast(null)
  }

  async function signOut() {
    // A failed sign-out leaves the session cookie, so the signed-in screen stays with the alert.
    assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
    clearToasts()
    setError(null)
    sessionNumber.current += 1
    setSession({ state: 'signed-out' })
  }

  // Not over a consent screen, which hides the view it is on. A failed save's toast comes before a
  // success's, which a failure clears.
  let toastNotice: ToastNotice | null = null
  if (session.state === 'signed-in' && consentRequest === null) {
    if (failedSaveOnView) {
      toastNotice = {
        key: `failed-${failedSaveOnView.id}`,
        text: failedSaveNotice,
        success: false,
        timed: true,
        onClose: () => setFailedSave(null),
      }
    } else if (successToast) {
      toastNotice = {
        key: `success-${successToast.id}`,
        text: successToast.text,
        success: true,
        timed: !successToast.asksToAct,
        onClose: () => setSuccessToast(null),
      }
    }
  }

  return (
    <main className={session.state === 'signed-out' ? 'app' : 'app app-signed-in'}>
      {headerShown && (
        // Hidden, not unmounted, behind a consent screen, as the rest of the signed-in view is. It
        // shows while the session is read below the column, with no email yet. It never shows
        // beside the column, so for a creator with a channel its Menu holds the sidebar's items.
        <Header
          email={session.state === 'signed-in' ? session.user.email : null}
          channels={channels}
          selected={selected}
          route={route}
          navigate={navigate}
          onSignOut={() => start(signOut)}
          clientSettings={clientSettings}
          hidden={consentRequest !== null}
          theme={theme}
          onThemeChange={changeTheme}
          menu={
            session.state === 'signed-in' && sidebarShown
              ? {
                  route,
                  navigate,
                  supportLink: sidebarSupportLink,
                  onSupportOpened: () => track(supportOpenedEvent('sidebar')),
                  onHideSupport: hideSupport,
                  upgradeRoute: sidebarUpgradeRoute,
                  onUpgradeOpened: () => track(upgradeLinkClickedEvent('menu')),
                  onHideUpgrade: hideUpgrade,
                  onWhatsNewOpened: () => track(whatsNewOpenedEvent),
                }
              : null
          }
        />
      )}
      {session.state === 'signed-out' && <h1>Stillstats</h1>}
      {error && <p role="alert">{error.text}</p>}
      {session.state === 'signed-out' && (
        <SignedOut
          notice={signedOutNotice}
          onSignIn={() => start(() => signInWithGoogle(landingOfRoute(route)))}
        />
      )}
      {session.state === 'signed-in' && consentRequest && (
        <ConsentScreen
          request={consentRequest}
          onContinue={() => continueToGoogle(consentRequest)}
          onError={alertOnFailure()}
          onCancel={() => setConsentRequest(null)}
        />
      )}
      {(session.state === 'signed-in' || sessionReadBesideColumn) && (
        // Hidden, not unmounted, behind a consent screen: a Cancel keeps the video list's page and
        // sends no second video_list_viewed or settings_opened. While the session is read beside
        // the column it holds the sidebar's place and an empty screen, in the same elements, so
        // the page has its offset and the wordmark stays the same element once the session lands.
        <div className="signed-in-view" hidden={consentRequest !== null}>
          <PreferencesContext value={preferences}>
            <CanUpgradeContext value={canUpgrade}>
              {/* Open until the preferences read lands, and then as saved, while the screen still
                waits for that read, so nothing with numbers moves. */}
              <SidebarProvider
                className="signed-in-shell"
                open={sidebarOpenOf(saved ?? {})}
                onOpenChange={(open) => preferences.save({ sidebarOpen: open })}
              >
                {sidebarShown && (
                  <Sidebar
                    email={session.state === 'signed-in' ? session.user.email : null}
                    channels={channels}
                    selected={selected}
                    route={route}
                    navigate={navigate}
                    onSignOut={() => start(signOut)}
                    clientSettings={clientSettings}
                    supportLink={sidebarSupportLink}
                    onSupportOpened={() => track(supportOpenedEvent('sidebar'))}
                    onHideSupport={hideSupport}
                    upgradeRoute={sidebarUpgradeRoute}
                    onUpgradeOpened={() => track(upgradeLinkClickedEvent('sidebar'))}
                    onHideUpgrade={hideUpgrade}
                    onWhatsNewOpened={() => track(whatsNewOpenedEvent)}
                    theme={theme}
                    onThemeChange={changeTheme}
                  />
                )}
                <div className="signed-in-screen">
                  {bannerRelease !== null && (
                    <WhatsNewBanner
                      route={route}
                      navigate={navigate}
                      onOpened={() => track(whatsNewOpenedFromBannerEvent)}
                      onClose={() => closeBanner(bannerRelease)}
                    />
                  )}
                  {session.state !== 'signed-in' ? null : route.settings ? (
                    <Settings
                      channels={channels}
                      channelsFailed={channelsFailed}
                      supportLink={support?.link ?? null}
                      supportThanks={supportThanks}
                      pro={proSectionOf(entitlements)}
                      theme={theme}
                      onDisconnect={(channelId) =>
                        start(() => disconnect(channelId), disconnectAlertOf(channelId))
                      }
                      onGiveRevenueConsent={giveRevenueConsent}
                      onSubscribe={(plan) => start(() => startCheckout(plan))}
                      onManage={() => start(openPortal)}
                      onAddBlock={() => start(addBlock, addBlockAlert)}
                      onPick={(channelId) =>
                        start(() => pickChannel(channelId), proPickAlertOf(channelId))
                      }
                      onUnpick={(channelId) =>
                        start(() => unpickChannel(channelId), proPickAlertOf(channelId))
                      }
                      onConnect={() => openConsentScreen({ consent: 'connection' })}
                      onResetPreferences={() => start(resetPreferences, resetAlert)}
                      onSignOut={() => start(signOut)}
                      onDeleteMe={() => start(deleteYourself)}
                    />
                  ) : route.whatsNew ? (
                    // Before the no-channel branch, as Settings is: highlights belong to no
                    // channel.
                    <WhatsNew route={route} navigate={navigate} />
                  ) : route.feedback ? (
                    // Before the no-channel branch too: a message belongs to no channel.
                    <Feedback
                      email={session.user.email}
                      screen={route.feedback}
                      version={clientSettings?.version ?? null}
                    />
                  ) : route.adminFeedback ? (
                    // Before the no-channel branch too: a message belongs to no channel.
                    <AdminFeedback route={route} navigate={navigate} />
                  ) : route.adminGrants ? (
                    // Before the no-channel branch too: a grant belongs to no channel.
                    <AdminGrants route={route} navigate={navigate} />
                  ) : channels?.length === 0 ? (
                    // After a cancelled or refused connect too: the app starts a consent only on a
                    // click. On the upgrade screen's address the connect lands back there, for the
                    // channel it connects (creator-analytics#907).
                    <>
                      <p>{noChannelText}</p>
                      <button
                        className="button"
                        type="button"
                        onClick={() => openConsentScreen(connectionRequestOf(route))}
                      >
                        Connect a channel
                      </button>
                    </>
                  ) : screenShown && route.upgrade ? (
                    <Upgrade
                      channelId={shownChannelId}
                      route={route}
                      canUpgrade={canUpgrade}
                      onSubscribe={(plan) => start(() => startCheckout(plan))}
                    />
                  ) : screenShown && route.video && route.sponsorReport ? (
                    <SponsorReport
                      channel={channelOnView || null}
                      video={route.video}
                      route={route}
                      navigate={navigate}
                    />
                  ) : screenShown && route.video ? (
                    <VideoDetail
                      channel={channelOnView || null}
                      video={route.video}
                      route={route}
                      navigate={navigate}
                      onGiveRevenueConsent={giveShownChannelRevenueConsent}
                    />
                  ) : screenShown && route.retention ? (
                    <RetentionComparison
                      channelId={shownChannelId}
                      route={route}
                      navigate={navigate}
                    />
                  ) : screenShown && route.audience ? (
                    <Audience
                      channelId={shownChannelId}
                      route={route}
                      navigate={navigate}
                      bounds={channelBounds}
                      onBounds={takeListBounds}
                    />
                  ) : (
                    screenShown && (
                      <>
                        {/* The screen's top heading; the wordmark and the channel picker name it on
                          sight. */}
                        {selected && (
                          <h1 className="visually-hidden">{channelTitleOf(selected)}</h1>
                        )}
                        <ControlsBar
                          route={route}
                          navigate={navigate}
                          bounds={channelBounds}
                          ref={controlsBar}
                        />
                        <ChannelSummaryFigures
                          channel={channelOnView}
                          route={route}
                          navigate={navigate}
                          onGiveRevenueConsent={giveShownChannelRevenueConsent}
                          list={summaryPlaceList}
                          markedVideoId={markedVideoId}
                          markedBy={markedBy}
                          onMark={markVideoBy('chart')}
                        />
                        <VideoList
                          channel={channelOnView}
                          route={route}
                          navigate={navigate}
                          onShown={setSummaryPlaceList}
                          markedVideoId={markedVideoId}
                          onRowHover={markVideoBy('row')}
                          onBounds={takeListBounds}
                          controlsBar={controlsBar}
                          paid={channelPaidOf(entitlements, shownChannelId)}
                        />
                      </>
                    )
                  )}
                </div>
              </SidebarProvider>
            </CanUpgradeContext>
          </PreferencesContext>
        </div>
      )}
      {/* Wherever the creator scrolled. */}
      <Toaster closeLabel={toastCloseLabel}>
        <ToastShown notice={toastNotice} />
      </Toaster>
    </main>
  )
}
