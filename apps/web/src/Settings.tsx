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
  consentGivenTextOf,
  currencyChangedEvent,
  currencyLabel,
  currencyOptionsOf,
  noChannelText,
  resetPreferencesButton,
  rpmSourcesHint,
  rpmSourcesLabel,
  rpmSourcesToggledEvent,
  settingsHeading,
  settingsOpenedEvent,
  themeLabel,
  themeOptions,
} from './settings.ts'
import { manageSubscriptionText, subscribeTexts } from './subscribe.ts'
import {
  supportHeading,
  supportLinkText,
  supportOpenedEvent,
  supportText,
  supportThanksText,
} from './support.ts'

/**
 * The creator's channels, each by its name on YouTube, the Support section when the support answer
 * has a link, and account: disconnect and revenue consent for each channel, and a subscribe action
 * for each plan for a channel the user may subscribe, or the Customer Portal's for a channel they
 * may manage, then the currency revenue shows in, the
 * theme, the RPM switch, connect, reset of the preferences, sign-out and delete. While the channels
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
  subscribable,
  manageable,
  theme,
  onDisconnect,
  onGiveRevenueConsent,
  onSubscribe,
  onManage,
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
  /** The channels the user may start a Checkout for: their own, free, with Pro offered. */
  subscribable: ReadonlySet<string>
  /** The channels the user may open the Customer Portal for: their own, paid. */
  manageable: ReadonlySet<string>
  /** The theme the page draws, which App applies. */
  theme: Theme
  onDisconnect: (channelId: string) => void
  onGiveRevenueConsent: (channelId: string) => void
  onSubscribe: (channelId: string, plan: BillingPlan) => void
  onManage: (channelId: string) => void
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
            {channels.map((channel) => (
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
                {subscribable.has(channel.id) && (
                  <div className="app-actions">
                    {billingPlans.map((plan) => (
                      <button
                        className="button"
                        type="button"
                        key={plan}
                        onClick={() => onSubscribe(channel.id, plan)}
                      >
                        {subscribeTexts[plan]}
                      </button>
                    ))}
                  </div>
                )}
                {manageable.has(channel.id) && (
                  <div className="app-actions">
                    <button className="button" type="button" onClick={() => onManage(channel.id)}>
                      {manageSubscriptionText}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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
