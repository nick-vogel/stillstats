import {
  chartCards,
  chartModes,
  type Preferences,
  type PreferencesUpdate,
  pageSizes,
  revenueCurrencies,
  themes,
  visibilities,
} from '@creator-analytics/api-types'
import { test } from '@creator-analytics/database/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { savePreferences, signIn } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'

// The app versions of the test build's release notes, fixtureContentRoot's.
const appVersionsInTheBuild = ['2026.11.9', '2026.11.9.1']

const creator = { sub: '507291', email: 'preferences@example.com', name: 'A Creator' }
const otherCreator = { sub: '607291', email: 'preferences-other@example.com', name: 'Another' }

async function answerOf(response: Response): Promise<{ status: number; body: unknown }> {
  return { status: response.status, body: await response.json() }
}

async function read(browser: Browser) {
  return answerOf(await browser.fetch('/api/me/preferences'))
}

// A raw body, for the ones the web app never sends: malformed JSON, or values outside the types.
async function put(browser: Browser, body: string) {
  return answerOf(
    await browser.fetch('/api/me/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  )
}

async function save(browser: Browser, preferences: PreferencesUpdate) {
  return answerOf(await savePreferences(browser, preferences))
}

describe('seam 1: the signed-in user’s preferences', () => {
  test('GET with no saved preference answers no value', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)

    expect(await read(browser)).toEqual({ status: 200, body: {} })
  })

  test('PUT of one value saves it and leaves the other saved values', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)
    await save(browser, { chartMode: 'aggregate', pageSize: 25 })

    const saved = await save(browser, { pageSize: 50 })

    expect(saved).toEqual({ status: 200, body: { chartMode: 'aggregate', pageSize: 50 } })
    expect(await read(browser)).toEqual(saved)
  })

  test('DELETE clears every saved preference', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)
    await save(browser, {
      chartMode: 'aggregate',
      currency: 'EUR',
      revenueSources: true,
      rpmAdsAndPremiumOnly: true,
      sidebarOpen: false,
      supportPromptDismissed: true,
      upgradePromptDismissed: true,
      theme: 'dark',
      whatsNewMarker: '2026.11.9',
    })
    // A clear proves nothing unless the values were saved first.
    expect(await read(browser)).toEqual({
      status: 200,
      body: {
        chartMode: 'aggregate',
        currency: 'EUR',
        revenueSources: true,
        rpmAdsAndPremiumOnly: true,
        sidebarOpen: false,
        supportPromptDismissed: true,
        upgradePromptDismissed: true,
        theme: 'dark',
        whatsNewMarker: '2026.11.9',
      },
    })

    const response = await browser.fetch('/api/me/preferences', { method: 'DELETE' })

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 200,
      body: {},
    })
    expect(await read(browser)).toEqual({ status: 200, body: {} })
  })

  test.for([
    ['a page size outside 10, 25 and 50', '{"pageSize":20}'],
    ['an unknown preference', '{"fontSize":"large"}'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a null value', '{"chartMode":null}'],
    ['a string for a column', '{"viewsColumn":"true"}'],
    ['a string for the revenue sources', '{"revenueSources":"true"}'],
    ['a string for the RPM switch', '{"rpmAdsAndPremiumOnly":"true"}'],
    ['a string for the sidebar', '{"sidebarOpen":"false"}'],
    ['a lower-case currency', '{"currency":"eur"}'],
    ['a currency ISO 4217 does not name', '{"currency":"ABC"}'],
    // ISO 4217 names ISK, and the runtime knows it, but Google's Analytics API does not take it.
    ['a currency Google does not document', '{"currency":"ISK"}'],
    ['a false support prompt dismissal', '{"supportPromptDismissed":false}'],
    // The server stamps the dismissal's time, so a time the client sends is refused.
    [
      'a time for the support prompt dismissal',
      '{"supportPromptDismissed":"2026-11-04T00:00:00Z"}',
    ],
    ['a false upgrade prompt dismissal', '{"upgradePromptDismissed":false}'],
    [
      'a time for the upgrade prompt dismissal',
      '{"upgradePromptDismissed":"2026-11-18T00:00:00Z"}',
    ],
    // The test build holds the app versions 2026.11.9 and 2026.11.9.1, and the extension's 1.0.0.
    ['an app version the build holds no note for', '{"whatsNewMarker":"2026.11.8"}'],
    ['an extension version for the marker', '{"whatsNewMarker":"1.0.0"}'],
    ['a number for the marker', '{"whatsNewMarker":2026.11}'],
    ['a string that is no version for the marker', '{"whatsNewMarker":"latest"}'],
    ['an unknown theme', '{"theme":"sepia"}'],
    ['a theme in another case', '{"theme":"Dark"}'],
    ['a null theme', '{"theme":null}'],
    ['a boolean for the theme', '{"theme":true}'],
    ['malformed JSON', '{"chartMode":'],
  ] as const)(
    'PUT of %s is refused as invalid_preference and saves nothing',
    async ([, body], { web }) => {
      const browser = await signIn(await startApi(web), creator)
      await save(browser, { chartMode: 'aggregate' })

      expect(await put(browser, body)).toEqual({
        status: 400,
        body: { error: 'invalid_preference' },
      })
      expect(await read(browser)).toEqual({ status: 200, body: { chartMode: 'aggregate' } })
    },
  )

  // Every value the shared types allow, so the database's checks stay in step with those types.
  // The PUT answers with the row Postgres returned from the save, so each answer is the value read
  // back; "PUT of one value saves it and leaves the other saved values" shows a GET answers the same.
  // It makes about a hundred requests one after another, and a loaded full run has pushed it past
  // the 5 s default timeout (creator-analytics#299), so it gets more time.
  test('every value the shared types allow is saved and read back', { timeout: 30_000 }, async ({
    web,
  }) => {
    const browser = await signIn(await startApi(web), creator)
    const values: Preferences[] = [
      ...pageSizes.map((pageSize) => ({ pageSize })),
      ...[true, false].flatMap((on) => [
        { viewsColumn: on },
        { watchTimeColumn: on },
        { revenueColumn: on },
        { revenueSources: on },
        { rpmAdsAndPremiumOnly: on },
        { sidebarOpen: on },
      ]),
      ...chartModes.map((chartMode) => ({ chartMode })),
      ...chartCards.map((chartCard) => ({ chartCard })),
      ...revenueCurrencies.map((currency) => ({ currency })),
      ...visibilities.map((visibility) => ({ visibility })),
      ...themes.map((theme) => ({ theme })),
      { supportPromptDismissed: true },
      { upgradePromptDismissed: true },
      ...appVersionsInTheBuild.map((whatsNewMarker) => ({ whatsNewMarker })),
    ]

    const answers: unknown[] = []
    for (const value of values) {
      answers.push(await save(browser, value))
    }

    expect(answers).toEqual(
      values.map((value) => ({ status: 200, body: expect.objectContaining(value) })),
    )
  })

  // The "What's new" marker (creator-analytics#580): the newest app version whose highlights the
  // creator has seen.
  test('the "What\'s new" marker is saved and read back', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)

    const saved = await put(browser, '{"whatsNewMarker":"2026.11.9"}')

    expect(saved).toEqual({ status: 200, body: { whatsNewMarker: '2026.11.9' } })
    expect(await read(browser)).toEqual(saved)
  })

  test('the API takes the marker from the build it runs', async ({ web }) => {
    const browser = await signIn(
      await startApi(web, { appVersions: new Set(['2026.11.8']) }),
      creator,
    )

    expect(await put(browser, '{"whatsNewMarker":"2026.11.8"}')).toEqual({
      status: 200,
      body: { whatsNewMarker: '2026.11.8' },
    })
    expect(await put(browser, '{"whatsNewMarker":"2026.11.9"}')).toEqual({
      status: 400,
      body: { error: 'invalid_preference' },
    })
  })

  // The RPM switch on Settings (creator-analytics#357): off by default, so a GET of a user who
  // never touched it names no value.
  test('the RPM switch is saved and read back', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)

    const saved = await save(browser, { rpmAdsAndPremiumOnly: true })

    expect(saved).toEqual({ status: 200, body: { rpmAdsAndPremiumOnly: true } })
    expect(await read(browser)).toEqual(saved)
  })

  // The theme (creator-analytics#691): a GET of a user who never chose one names no theme, which
  // the web app reads as System, the default.
  test.for(themes)('the theme %s is saved and read back', async (theme, { web }) => {
    const browser = await signIn(await startApi(web), creator)
    expect(await read(browser)).toEqual({ status: 200, body: {} })

    const saved = await save(browser, { theme })

    expect(saved).toEqual({ status: 200, body: { theme } })
    expect(await read(browser)).toEqual(saved)
  })

  // The RPM chart's card (creator-analytics#356): the picker on a small screen can show it alone.
  test('the chart card RPM is saved and read back', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)

    expect(await put(browser, '{"chartCard":"rpm"}')).toEqual({
      status: 200,
      body: { chartCard: 'rpm' },
    })
    expect(await read(browser)).toEqual({ status: 200, body: { chartCard: 'rpm' } })
  })

  // Google documents VEF, which the runtime's own list of currencies no longer holds.
  test('a currency Google documents is saved even when the runtime does not know it', async ({
    web,
  }) => {
    const browser = await signIn(await startApi(web), creator)

    expect(await put(browser, '{"currency":"VEF"}')).toEqual({
      status: 200,
      body: { currency: 'VEF' },
    })
    expect(await read(browser)).toEqual({ status: 200, body: { currency: 'VEF' } })
  })

  test("one creator's saved preferences do not show in another creator's", async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    await save(browser, { chartMode: 'aggregate' })
    // An absence proves nothing unless the value was saved first.
    expect(await read(browser)).toEqual({ status: 200, body: { chartMode: 'aggregate' } })

    const other = await signIn(api, otherCreator)

    expect(await read(other)).toEqual({ status: 200, body: {} })
  })
})
