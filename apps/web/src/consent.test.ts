import { retentionAndSharingLines } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  connectionRequestOf,
  consentScreens,
  continuedEvent,
  googleConsentPathOf,
  openedEvent,
  signedOutConsent,
  signInEvent,
  signInPathOf,
} from './consent.ts'

describe("the signed-out screen's consent text", () => {
  test('carries the same paragraphs as the connection consent screen', () => {
    expect(signedOutConsent.paragraphs).toEqual(consentScreens.connection.paragraphs)
    expect(signedOutConsent.paragraphs).toHaveLength(5)
  })

  test('signing in records consent_screen_continued with connection, and nothing about the user', () => {
    expect(signInEvent).toEqual({ name: 'consent_screen_continued', consent: 'connection' })
  })
})

describe('the text of the consent screens', () => {
  test("the connection screen says the shared lines on refresh, storage, deletion and sharing, in order, as the extension's first-run page does", () => {
    expect(consentScreens.connection.paragraphs.slice(-retentionAndSharingLines.length)).toEqual([
      ...retentionAndSharingLines,
    ])
  })
})

describe('the events of the consent screens', () => {
  test('opening the connection screen records connect_channel_clicked', () => {
    expect(openedEvent({ consent: 'connection' })).toEqual({ name: 'connect_channel_clicked' })
  })

  test('opening the revenue consent screen records give_revenue_consent_clicked, and no channel id', () => {
    expect(openedEvent({ consent: 'revenue', channelId: 'channel-1' })).toEqual({
      name: 'give_revenue_consent_clicked',
    })
  })

  test('continuing past the connection screen records consent_screen_continued with connection', () => {
    expect(continuedEvent({ consent: 'connection' })).toEqual({
      name: 'consent_screen_continued',
      consent: 'connection',
    })
  })

  test('continuing past the revenue consent screen records consent_screen_continued with revenue, and no channel id', () => {
    expect(continuedEvent({ consent: 'revenue', channelId: 'channel-1' })).toEqual({
      name: 'consent_screen_continued',
      consent: 'revenue',
    })
  })
})

describe('the Google consent each screen starts', () => {
  test('the connection screen starts the connect flow', () => {
    expect(googleConsentPathOf({ consent: 'connection' })).toBe('/api/channels/connect')
  })

  test("the revenue consent screen starts the revenue consent flow for the screen's channel", () => {
    expect(googleConsentPathOf({ consent: 'revenue', channelId: 'channel-1' })).toBe(
      '/api/channels/channel-1/revenue-consent',
    )
  })
})

// creator-analytics#907: begun on the upgrade screen, each lands back there.
describe('the landing of a sign-in or a connect', () => {
  test('a connection begun on the upgrade screen names it to the API, and one begun elsewhere names none', () => {
    expect(googleConsentPathOf(connectionRequestOf({ upgrade: true }))).toBe(
      '/api/channels/connect?landing=upgrade',
    )
    expect(googleConsentPathOf(connectionRequestOf({}))).toBe('/api/channels/connect')
  })

  test("the signed-out screen's sign-in asks for the hop to the connect consent, with the landing when it has one", () => {
    expect(signInPathOf('upgrade')).toBe('/api/auth/sign-in/google?then=connect&landing=upgrade')
    expect(signInPathOf(undefined)).toBe('/api/auth/sign-in/google?then=connect')
  })

  test('a connection consent with a landing records the same events as one without, and no landing', () => {
    const request = connectionRequestOf({ upgrade: true })

    expect(openedEvent(request)).toEqual({ name: 'connect_channel_clicked' })
    expect(continuedEvent(request)).toEqual({
      name: 'consent_screen_continued',
      consent: 'connection',
    })
  })
})
