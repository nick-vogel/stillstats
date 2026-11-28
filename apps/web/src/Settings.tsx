import {
  type BillingPlan,
  billingPlans,
  currencyOf,
  type ListedChannel,
  type RevenueCurrency,
  type Theme,
} from '@creator-analytics/api-types'
import { useEffect, useMemo, useRef } from 'react'
import { signOutItem } from './account-menu.ts'
import { track } from './analytics.ts'
import { channelTitleOf } from './channel-picker.ts'
import { ListSelect } from './ListSelect.tsx'
import { LoadingStatus, Placeholder } from './Placeholder.tsx'
import { rpmAdsAndPremiumOnlyOf, usePreferences } from './preferences.ts'
import { QuietButton } from './QuietButton.tsx'
import { SegmentedControl } from './SegmentedControl.tsx'
import { Switch } from './Switch.tsx'
import {
  accountHeading,
  channelsHeading,
  channelsLoadingTextOf,
  channelTierTexts,
  consentGivenTextOf,
  currencyChangedEvent,
  currencyLabel,
  currencyOptionsOf,
  noChannelText,
  pickChannelText,
  proHeading,
  proPurgeTextOf,
  proSlotsTextOf,
  resetPreferencesButton,
  rpmSourcesHint,
  rpmSourcesLabel,
  rpmSourcesToggledEvent,
  settingsHeading,
  settingsOpenedEvent,
  slotsFullText,
  themeLabel,
  themeOptions,
  unpickChannelText,
} from './settings.ts'
import { manageSubscriptionText, type ProSection, subscribeTexts } from './subscribe.ts'
import {
  supportHeading,
  supportLinkText,
  supportOpenedEvent,
  supportText,
  supportThanksText,
} from './support.ts'

/**
 * The creator's channels, each by its name on YouTube, with disconnect and revenue consent, and
 * under each one the user owns whether it is Pro or Free while there is a Pro section, and while
 * the user holds a block its purge date while it has one, that it stays Free while every slot is
 * in use, and its pick or unpick control; the Pro
 * section, with the slots in use once the user holds a block, a subscribe action for each plan
 * while they may subscribe and the Customer Portal's while they may manage; the Support section
 * when the support answer has a link; and account: the currency revenue shows in, the theme, the
 * RPM switch, connect, reset of the preferences, sign-out and delete. While the channels
 * are read, their place holds a placeholder, until the read fails. A change of currency saves the
 * preference and sends `currency_changed`; a change of the RPM switch saves its preference and
 * sends `rpm_sources_toggled`, with no toast, as the switch shows its own state. A change of theme
 * saves it with no toast and no event (Nick, 2026-11-12): App draws it at once. App holds what each
 * action does, with its confirmation and the toast it raises.
 */
export function Settings({
  channels,
  channelsFailed,
  supportLink,
  supportThanks,
  pro,
  theme,
  onDisconnect,
  onGiveRevenueConsent,
  onSubscribe,
  onManage,
  onPick,
  onUnpick,
  onConnect,
  onResetPreferences,
  onSignOut,
  onDeleteMe,
}: {
  channels: ListedChannel[] | null
  /** The read of the channels failed: the app's alert says so, and nothing waits on it. */
  channelsFailed: boolean
  /** The Payment Link a Tip opens, or null when there is none to offer. */
  supportLink: string | null
  /** Stripe returned here after a Tip: the line shows whatever the support answer holds. */
  supportThanks: boolean
  /** The user's Pro, or null for no Pro section (`proSectionOf`). */
  pro: ProSection | null
  /** The theme the page draws, which App applies. */
  theme: Theme
  onDisconnect: (channelId: string) => void
  onGiveRevenueConsent: (channelId: string) => void
  onSubscribe: (plan: BillingPlan) => void
  onManage: () => void
  /** Picks the channel for one of the user's Pro slots. */
  onPick: (channelId: string) => void
  /** Takes the channel out of its Pro slot, once the user confirms. */
  onUnpick: (channelId: string) => void
  onConnect: () => void
  onResetPreferences: () => void
  onSignOut: () => void
  onDeleteMe: () => void
}) {
  const opened = useRef(false)
  const channelsWaiting = channels === null && !channelsFailed
  const heading = useRef<HTMLHeadingElement>(null)
  const { saved, save } = usePreferences()
  // Named in the browser's language.
  const currencyOptions = useMemo(() => currencyOptionsOf(), [])

  function changeCurrency(currency: RevenueCurrency) {
    if (currency === currencyOf(saved)) return
    save({ currency })
    track(currencyChangedEvent(currency))
  }

  function toggleRpmSources(on: boolean) {
    save({ rpmAdsAndPremiumOnly: on })
    track(rpmSourcesToggledEvent(on))
  }

  // Once each time the screen opens. The ref outlives StrictMode's second effect, and a consent
  // screen opened from here hides the screen without closing it, so a Cancel sends nothing.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    track(settingsOpenedEvent)
  }, [])

  // The menu link that opened the screen is gone, so focus moves to the heading.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <div className="settings">
      <h1 ref={heading} tabIndex={-1}>
        {settingsHeading}
      </h1>
      {supportThanks && <p>{supportThanksText}</p>}
      <section className="settings-section">
        <h2>{channelsHeading}</h2>
        <LoadingStatus text={channelsLoadingTextOf(channelsWaiting)} />
        {channels === null ? (
          channelsWaiting && (
            <div className="placeholders" aria-busy="true">
              <Placeholder shape="channel" />
            </div>
          )
        ) : channels.length === 0 ? (
          <p>{noChannelText}</p>
        ) : (
          <ul className="channels">
            {channels.map((channel) => {
              const owned = pro?.channels.get(channel.id)
              return (
                <li className="channel" key={channel.id}>
                  <div className="channel-head">
                    <a
                      className="channel-name"
                      href={`https://www.youtube.com/channel/${channel.youtubeChannelId}`}
                    >
                      {channelTitleOf(channel)}
                    </a>
                    <QuietButton onClick={() => onDisconnect(channel.id)}>Disconnect</QuietButton>
                  </div>
                  {channel.revenueConsentedAt ? (
                    <p className="channel-consent">
                      {consentGivenTextOf(channel.revenueConsentedAt)}
                    </p>
                  ) : (
                    <QuietButton onClick={() => onGiveRevenueConsent(channel.id)}>
                      Give revenue consent
                    </QuietButton>
                  )}
                  {owned && <p className="channel-tier">{channelTierTexts[owned.tier]}</p>}
                  {/* Without a block, only subscribing again keeps the history, not a pick. */}
                  {pro && pro.blocks > 0 && owned?.tier === 'free' && owned.purgeDate && (
                    <p className="channel-pro-note">{proPurgeTextOf(owned.purgeDate)}</p>
                  )}
                  {owned?.slotsFull && <p className="channel-pro-note">{slotsFullText}</p>}
                  {owned?.control === 'pick' && (
                    <QuietButton onClick={() => onPick(channel.id)}>{pickChannelText}</QuietButton>
                  )}
                  {owned?.control === 'unpick' && (
                    <QuietButton onClick={() => onUnpick(channel.id)}>
                      {unpickChannelText}
                    </QuietButton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {pro && (
        <section className="settings-section">
          <h2>{proHeading}</h2>
          {pro.blocks > 0 && <p>{proSlotsTextOf(pro.slotsInUse, pro.blocks)}</p>}
          {(pro.canSubscribe || pro.canManage) && (
            <div className="app-actions">
              {pro.canSubscribe &&
                billingPlans.map((plan) => (
                  <button
                    className="button"
                    type="button"
                    key={plan}
                    onClick={() => onSubscribe(plan)}
                  >
                    {subscribeTexts[plan]}
                  </button>
                ))}
              {pro.canManage && (
                <button className="button" type="button" onClick={onManage}>
                  {manageSubscriptionText}
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {supportLink !== null && (
        <section className="settings-section">
          <h2>{supportHeading}</h2>
          <p>{supportText}</p>
          {/* A new tab, as the sidebar's link opens: Stripe's page returns to Settings there,
              on /app/profile?support=thanks, the old path that opens /app/settings, with its
              thanks, and this tab reads the support answer again once it is on view again. */}
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(supportOpenedEvent('settings'))}
          >
            {supportLinkText}
          </a>
        </section>
      )}
      <section className="settings-section">
        <h2>{accountHeading}</h2>
        {/* As wide as its longest currency name, not the whole section, and never wider. */}
        <ListSelect
          className="max-w-full justify-self-start"
          label={currencyLabel}
          value={currencyOf(saved)}
          options={currencyOptions}
          onChange={changeCurrency}
        />
        <SegmentedControl
          label={themeLabel}
          value={theme}
          options={themeOptions}
          onChange={(chosen) => save({ theme: chosen })}
        />
        <Switch
          label={rpmSourcesLabel}
          hint={rpmSourcesHint}
          checked={rpmAdsAndPremiumOnlyOf(saved)}
          onChange={toggleRpmSources}
        />
        <div className="app-actions">
          <button className="button" type="button" onClick={onConnect}>
            Connect a channel
          </button>
          <QuietButton onClick={onResetPreferences}>{resetPreferencesButton}</QuietButton>
          <QuietButton onClick={onSignOut}>{signOutItem}</QuietButton>
          <QuietButton onClick={onDeleteMe}>Delete me</QuietButton>
        </div>
      </section>
    </div>
  )
}
