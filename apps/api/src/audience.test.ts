// Limits: these tests read from the fake Google server, so they cannot prove which country codes
// Google answers, the threshold under which it leaves out a country with few views, or what it
// answers for each format's countries, nor which age groups and genders Google answers or their
// shares, nor the state codes and city names Google answers, the thresholds under which it leaves
// out a state or a city with few views, or the wrong numbers it answers to either under a format
// filter, nor which device types, operating systems and subscribed statuses Google answers, for
// the channel or for each format. Nick's browser walk of the Audience screen on his own channel
// covers those.
import type { AudienceAnswer } from '@creator-analytics/api-types'
import { test } from '@creator-analytics/database/testing'
import type { FakeChannel } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '309179', email: 'audience-reader@example.com', name: 'An Audience Reader' }

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

const channel: FakeChannel = {
  createdAt: '2019-03-01T06:00:00Z',
  uploads: [],
  countries: {
    DE: { engagedViews: 793, views: 1100 },
    US: { engagedViews: 2772, views: 3900 },
    ZZ: { engagedViews: 900, views: 950 },
    IN: { engagedViews: 1704, views: 2500 },
    // Ties DE on engaged views, with fewer views.
    FR: { engagedViews: 793, views: 1000 },
  },
  // Held out of Google's value order, which the answer sorts into.
  ageGroups: { 'age65-': 2.1, 'age18-24': 31.4, 'age13-17': 4.2, 'age25-34': 40.3 },
  genders: { user_specified: 0.6, male: 81.2, female: 18.2 },
  usStates: {
    'US-TX': { engagedViews: 310, views: 400 },
    'US-CA': { engagedViews: 557, views: 800 },
    'US-ZZ': { engagedViews: 420, views: 450 },
    // Ties US-TX on engaged views, with more views.
    'US-NY': { engagedViews: 310, views: 500 },
  },
  cities: {
    Chicago: { engagedViews: 120, views: 700 },
    // Has fewer views than Chicago and Austin, so only an engaged views order puts it first.
    Mumbai: { engagedViews: 300, views: 600 },
    // Ties Chicago on engaged views and views, so the name orders them.
    Austin: { engagedViews: 120, views: 700 },
  },
  devices: {
    TABLET: { engagedViews: 90, views: 140 },
    DESKTOP: { engagedViews: 1900, views: 2600 },
    MOBILE: { engagedViews: 2400, views: 3300 },
    // Ties TABLET on engaged views, with more views.
    TV: { engagedViews: 90, views: 160 },
  },
  operatingSystems: {
    IOS: { engagedViews: 800, views: 1000 },
    WINDOWS: { engagedViews: 1500, views: 2000 },
    // Ties IOS on engaged views and views, so the value orders them.
    ANDROID: { engagedViews: 800, views: 1000 },
  },
  subscribedStatuses: {
    UNSUBSCRIBED: { engagedViews: 3100, views: 4400 },
    SUBSCRIBED: { engagedViews: 1300, views: 1700 },
  },
}

/** Signs the creator in and connects their channel, which the fake holds as given. */
async function connectedCreator(api: StartedApi, fakeChannel: FakeChannel = channel) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-audience')
  api.google.setChannel('UC-audience', fakeChannel)
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function readAudience(
  browser: Browser,
  channelId: string,
  query: Record<string, string> = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/audience?${search}`)
  return { status: response.status, body: (await response.json()) as AudienceAnswer }
}

/** The Analytics queries that asked for the channel's countries. */
function countryQueriesOf(api: StartedApi) {
  return api.google.analyticsRequests.filter((query) => query.get('dimensions') === 'country')
}

describe("the Audience answer's countries", () => {
  test("for a window, one country query over the window's days answers the channel's countries, most engaged views first, then most views, ZZ placed by its number", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const audience = await readAudience(browser, channelId, { window: 'last28' })

    expect(audience.status).toBe(200)
    expect(audience.body).toMatchObject({
      window: 'last28',
      format: 'all',
      lastProcessedDay: '2026-10-04',
      creationDay: '2019-02-28',
    })
    expect(audience.body.countries).toEqual([
      { code: 'US', engagedViews: 2772, views: 3900 },
      { code: 'IN', engagedViews: 1704, views: 2500 },
      { code: 'ZZ', engagedViews: 900, views: 950 },
      { code: 'DE', engagedViews: 793, views: 1100 },
      { code: 'FR', engagedViews: 793, views: 1000 },
    ])
    expect(
      countryQueriesOf(api).map((query) => ({
        startDate: query.get('startDate'),
        endDate: query.get('endDate'),
        metrics: query.get('metrics'),
        filters: query.get('filters'),
      })),
    ).toEqual([
      {
        startDate: '2026-09-07',
        endDate: '2026-10-04',
        metrics: 'engagedViews,views',
        filters: null,
      },
    ])
  })

  test.for([
    ['video', 'videoOnDemand'],
    ['short', 'shorts'],
    ['live', 'liveStream'],
  ] as const)(
    "a %s answer is that format's countries, read with Google's lowercase %s filter",
    async ([format, contentType], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, {
        ...channel,
        formats: {
          videoOnDemand: { countries: { US: { engagedViews: 10, views: 20 } } },
          shorts: { countries: { IN: { engagedViews: 30, views: 40 } } },
          liveStream: { countries: { BR: { engagedViews: 50, views: 60 } } },
        },
      })

      const audience = await readAudience(browser, channelId, { window: 'last7', format })

      const held = { video: 'US', short: 'IN', live: 'BR' }[format]
      expect(audience.status).toBe(200)
      expect(audience.body.format).toBe(format)
      expect(audience.body.countries.map(({ code }) => code)).toEqual([held])
      expect(countryQueriesOf(api).map((query) => query.get('filters'))).toEqual([
        `creatorContentType==${contentType}`,
      ])
    },
  )

  test('a country Google answers with 0 engaged views and 0 views is absent', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      countries: {
        US: { engagedViews: 5, views: 7 },
        GB: { engagedViews: 0, views: 0 },
        CA: { engagedViews: 0, views: 3 },
      },
    })

    const audience = await readAudience(browser, channelId)

    expect(audience.body.countries.map(({ code }) => code)).toEqual(['US', 'CA'])
  })

  test('a channel Google answers no country rows for is answered with no countries', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { countries: _, ...withoutCountries } = channel
    const { browser, channelId } = await connectedCreator(api, withoutCountries)

    const audience = await readAudience(browser, channelId)

    expect(audience.status).toBe(200)
    expect(audience.body.countries).toEqual([])
  })
})

/** The Analytics queries that asked for the channel's shares by this dimension. */
function viewerShareQueriesOf(api: StartedApi, dimensions: 'ageGroup' | 'gender') {
  return api.google.analyticsRequests.filter((query) => query.get('dimensions') === dimensions)
}

describe("the Audience answer's age groups and genders", () => {
  test("for a window, one age group query and one gender query over the window's days answer Google's own shares, age groups in age order and genders by Google's value", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const audience = await readAudience(browser, channelId, { window: 'last28' })

    expect(audience.status).toBe(200)
    expect(audience.body.ageGroups).toEqual([
      { ageGroup: 'age13-17', viewerPercentage: 4.2 },
      { ageGroup: 'age18-24', viewerPercentage: 31.4 },
      { ageGroup: 'age25-34', viewerPercentage: 40.3 },
      { ageGroup: 'age65-', viewerPercentage: 2.1 },
    ])
    expect(audience.body.genders).toEqual([
      { gender: 'female', viewerPercentage: 18.2 },
      { gender: 'male', viewerPercentage: 81.2 },
      { gender: 'user_specified', viewerPercentage: 0.6 },
    ])
    const asked = (['ageGroup', 'gender'] as const).map((dimensions) =>
      viewerShareQueriesOf(api, dimensions).map((query) => ({
        startDate: query.get('startDate'),
        endDate: query.get('endDate'),
        metrics: query.get('metrics'),
        filters: query.get('filters'),
      })),
    )
    const once = [
      {
        startDate: '2026-09-07',
        endDate: '2026-10-04',
        metrics: 'viewerPercentage',
        filters: null,
      },
    ]
    expect(asked).toEqual([once, once])
  })

  test.for([
    ['video', 'videoOnDemand'],
    ['short', 'shorts'],
    ['live', 'liveStream'],
  ] as const)(
    "a %s answer is that format's age groups and genders, each read with Google's lowercase %s filter",
    async ([format, contentType], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, {
        ...channel,
        formats: {
          videoOnDemand: { ageGroups: { 'age25-34': 60 }, genders: { male: 70 } },
          shorts: { ageGroups: { 'age13-17': 55 }, genders: { female: 65 } },
          liveStream: { ageGroups: { 'age45-54': 50 }, genders: { user_specified: 3 } },
        },
      })

      const audience = await readAudience(browser, channelId, { window: 'last7', format })

      const held = {
        video: { ageGroup: 'age25-34', gender: 'male' },
        short: { ageGroup: 'age13-17', gender: 'female' },
        live: { ageGroup: 'age45-54', gender: 'user_specified' },
      }[format]
      expect(audience.status).toBe(200)
      expect(audience.body.ageGroups.map(({ ageGroup }) => ageGroup)).toEqual([held.ageGroup])
      expect(audience.body.genders.map(({ gender }) => gender)).toEqual([held.gender])
      for (const dimensions of ['ageGroup', 'gender'] as const) {
        expect(viewerShareQueriesOf(api, dimensions).map((query) => query.get('filters'))).toEqual([
          `creatorContentType==${contentType}`,
        ])
      }
    },
  )

  test('a channel Google answers no age group or gender rows for is answered with none of either, while its countries answer', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { ageGroups: _, genders: __, ...withoutShares } = channel
    const { browser, channelId } = await connectedCreator(api, withoutShares)

    const audience = await readAudience(browser, channelId)

    expect(audience.status).toBe(200)
    expect(audience.body.ageGroups).toEqual([])
    expect(audience.body.genders).toEqual([])
    expect(audience.body.countries).toHaveLength(5)
  })
})

/** The Analytics queries that asked for the channel's US states, and for its cities. */
function placeQueriesOf(api: StartedApi) {
  const of = (dimensions: string) =>
    api.google.analyticsRequests.filter((query) => query.get('dimensions') === dimensions)
  return { usStates: of('province'), cities: of('city') }
}

describe("the Audience answer's US states and cities", () => {
  test("for a window, one province query and one city query over the window's days answer the channel's US states and cities, most engaged views first, then most views, then by code or name", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const audience = await readAudience(browser, channelId, { window: 'last28' })

    expect(audience.status).toBe(200)
    expect(audience.body.usStates).toEqual([
      { code: 'US-CA', engagedViews: 557, views: 800 },
      { code: 'US-ZZ', engagedViews: 420, views: 450 },
      { code: 'US-NY', engagedViews: 310, views: 500 },
      { code: 'US-TX', engagedViews: 310, views: 400 },
    ])
    expect(audience.body.cities).toEqual([
      { name: 'Mumbai', engagedViews: 300, views: 600 },
      { name: 'Austin', engagedViews: 120, views: 700 },
      { name: 'Chicago', engagedViews: 120, views: 700 },
    ])
    const { usStates, cities } = placeQueriesOf(api)
    const asked = (queries: URLSearchParams[]) =>
      queries.map((query) => ({
        startDate: query.get('startDate'),
        endDate: query.get('endDate'),
        metrics: query.get('metrics'),
      }))
    const once = [{ startDate: '2026-09-07', endDate: '2026-10-04', metrics: 'engagedViews,views' }]
    expect({ usStates: asked(usStates), cities: asked(cities) }).toEqual({
      usStates: once,
      cities: once,
    })
  })

  test('the city query asks for the 250 cities with most views, as Google requires a sort and a cap of 250', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    await readAudience(browser, channelId)

    expect(
      placeQueriesOf(api).cities.map((query) => ({
        sort: query.get('sort'),
        maxResults: query.get('maxResults'),
      })),
    ).toEqual([{ sort: '-views', maxResults: '250' }])
  })

  test.for([
    ['video', 'videoOnDemand'],
    ['short', 'shorts'],
    ['live', 'liveStream'],
  ] as const)(
    "a %s answer reads the channel's own US states and cities with no format filter, while its countries take the %s filter",
    async ([format, contentType], { web }) => {
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, {
        ...channel,
        formats: {
          videoOnDemand: { countries: { US: { engagedViews: 10, views: 20 } } },
          shorts: { countries: { IN: { engagedViews: 30, views: 40 } } },
          liveStream: { countries: { BR: { engagedViews: 50, views: 60 } } },
        },
      })

      const audience = await readAudience(browser, channelId, { format })

      expect(audience.status).toBe(200)
      expect(audience.body.usStates.map(({ code }) => code)).toEqual([
        'US-CA',
        'US-ZZ',
        'US-NY',
        'US-TX',
      ])
      expect(audience.body.cities.map(({ name }) => name)).toEqual(['Mumbai', 'Austin', 'Chicago'])
      const { usStates, cities } = placeQueriesOf(api)
      expect({
        usStates: usStates.map((query) => query.get('filters')),
        cities: cities.map((query) => query.get('filters')),
        countries: countryQueriesOf(api).map((query) => query.get('filters')),
      }).toEqual({
        usStates: ['country==US'],
        cities: [null],
        countries: [`creatorContentType==${contentType}`],
      })
    },
  )

  test('a state and a city Google answers with 0 engaged views and 0 views are absent', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      usStates: {
        'US-CA': { engagedViews: 5, views: 7 },
        'US-WY': { engagedViews: 0, views: 0 },
        'US-VT': { engagedViews: 0, views: 2 },
      },
      cities: {
        Chicago: { engagedViews: 4, views: 6 },
        Mumbai: { engagedViews: 0, views: 0 },
      },
    })

    const audience = await readAudience(browser, channelId)

    expect(audience.body.usStates.map(({ code }) => code)).toEqual(['US-CA', 'US-VT'])
    expect(audience.body.cities.map(({ name }) => name)).toEqual(['Chicago'])
  })

  test('a channel Google answers no state or city rows for is answered with none of either, while its countries answer', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { usStates: _, cities: __, ...withoutPlaces } = channel
    const { browser, channelId } = await connectedCreator(api, withoutPlaces)

    const audience = await readAudience(browser, channelId)

    expect(audience.status).toBe(200)
    expect(audience.body.usStates).toEqual([])
    expect(audience.body.cities).toEqual([])
    expect(audience.body.countries).toHaveLength(5)
  })
})

/** The Analytics queries that asked for the channel's devices, operating systems and split. */
function technologyQueriesOf(api: StartedApi) {
  const of = (dimensions: string) =>
    api.google.analyticsRequests.filter((query) => query.get('dimensions') === dimensions)
  return {
    devices: of('deviceType'),
    operatingSystems: of('operatingSystem'),
    subscriberSplit: of('subscribedStatus'),
  }
}

describe("the Audience answer's devices, operating systems and subscribers", () => {
  test("for a window, one device query, one operating system query and one subscribed status query over the window's days answer the channel's devices and operating systems, most engaged views first, then most views, then by value, and its subscriber split", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const audience = await readAudience(browser, channelId, { window: 'last28' })

    expect(audience.status).toBe(200)
    expect(audience.body.devices).toEqual([
      { deviceType: 'MOBILE', engagedViews: 2400, views: 3300 },
      { deviceType: 'DESKTOP', engagedViews: 1900, views: 2600 },
      { deviceType: 'TV', engagedViews: 90, views: 160 },
      { deviceType: 'TABLET', engagedViews: 90, views: 140 },
    ])
    expect(audience.body.operatingSystems).toEqual([
      { operatingSystem: 'WINDOWS', engagedViews: 1500, views: 2000 },
      { operatingSystem: 'ANDROID', engagedViews: 800, views: 1000 },
      { operatingSystem: 'IOS', engagedViews: 800, views: 1000 },
    ])
    expect(audience.body.subscriberSplit).toEqual({
      subscribed: { engagedViews: 1300, views: 1700 },
      unsubscribed: { engagedViews: 3100, views: 4400 },
    })
    const asked = Object.values(technologyQueriesOf(api)).map((queries) =>
      queries.map((query) => ({
        startDate: query.get('startDate'),
        endDate: query.get('endDate'),
        metrics: query.get('metrics'),
        filters: query.get('filters'),
      })),
    )
    const once = [
      {
        startDate: '2026-09-07',
        endDate: '2026-10-04',
        metrics: 'engagedViews,views',
        filters: null,
      },
    ]
    expect(asked).toEqual([once, once, once])
  })

  test.for([
    ['video', 'videoOnDemand'],
    ['short', 'shorts'],
    ['live', 'liveStream'],
  ] as const)(
    "a %s answer is that format's devices, operating systems and subscriber split, each read with Google's lowercase %s filter",
    async ([format, contentType], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const sides = (engagedViews: number) => ({
        SUBSCRIBED: { engagedViews, views: engagedViews + 1 },
        UNSUBSCRIBED: { engagedViews: engagedViews + 2, views: engagedViews + 3 },
      })
      const { browser, channelId } = await connectedCreator(api, {
        ...channel,
        formats: {
          videoOnDemand: {
            devices: { DESKTOP: { engagedViews: 10, views: 20 } },
            operatingSystems: { WINDOWS: { engagedViews: 10, views: 20 } },
            subscribedStatuses: sides(10),
          },
          shorts: {
            devices: { MOBILE: { engagedViews: 30, views: 40 } },
            operatingSystems: { ANDROID: { engagedViews: 30, views: 40 } },
            subscribedStatuses: sides(30),
          },
          liveStream: {
            devices: { TV: { engagedViews: 50, views: 60 } },
            operatingSystems: { SMART_TV: { engagedViews: 50, views: 60 } },
            subscribedStatuses: sides(50),
          },
        },
      })

      const audience = await readAudience(browser, channelId, { window: 'last7', format })

      const held = {
        video: { deviceType: 'DESKTOP', operatingSystem: 'WINDOWS', subscribed: 10 },
        short: { deviceType: 'MOBILE', operatingSystem: 'ANDROID', subscribed: 30 },
        live: { deviceType: 'TV', operatingSystem: 'SMART_TV', subscribed: 50 },
      }[format]
      expect(audience.status).toBe(200)
      expect(audience.body.devices.map(({ deviceType }) => deviceType)).toEqual([held.deviceType])
      expect(audience.body.operatingSystems.map(({ operatingSystem }) => operatingSystem)).toEqual([
        held.operatingSystem,
      ])
      expect(audience.body.subscriberSplit?.subscribed.engagedViews).toBe(held.subscribed)
      for (const queries of Object.values(technologyQueriesOf(api))) {
        expect(queries.map((query) => query.get('filters'))).toEqual([
          `creatorContentType==${contentType}`,
        ])
      }
    },
  )

  test('a channel Google answers no device, operating system or subscribed status rows for is answered with none of either and no split, while its countries answer', async ({
    web,
  }) => {
    const api = await startApi(web)
    const {
      devices: _,
      operatingSystems: __,
      subscribedStatuses: ___,
      ...withoutTechnology
    } = channel
    const { browser, channelId } = await connectedCreator(api, withoutTechnology)

    const audience = await readAudience(browser, channelId)

    expect(audience.status).toBe(200)
    expect(audience.body.devices).toEqual([])
    expect(audience.body.operatingSystems).toEqual([])
    expect(audience.body.subscriberSplit).toBeNull()
    expect(audience.body.countries).toHaveLength(5)
  })

  test('a device and an operating system Google answers with 0 engaged views and 0 views are absent', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      devices: {
        DESKTOP: { engagedViews: 5, views: 7 },
        GAME_CONSOLE: { engagedViews: 0, views: 0 },
        TV: { engagedViews: 0, views: 2 },
      },
      operatingSystems: {
        WINDOWS: { engagedViews: 5, views: 7 },
        XBOX: { engagedViews: 0, views: 0 },
      },
    })

    const audience = await readAudience(browser, channelId)

    expect(audience.body.devices.map(({ deviceType }) => deviceType)).toEqual(['DESKTOP', 'TV'])
    expect(audience.body.operatingSystems.map(({ operatingSystem }) => operatingSystem)).toEqual([
      'WINDOWS',
    ])
  })

  test('a subscriber split Google answers one side of reads the other side as 0 and 0', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      subscribedStatuses: { UNSUBSCRIBED: { engagedViews: 40, views: 55 } },
    })

    const audience = await readAudience(browser, channelId)

    expect(audience.body.subscriberSplit).toEqual({
      subscribed: { engagedViews: 0, views: 0 },
      unsubscribed: { engagedViews: 40, views: 55 },
    })
  })
})

describe('the Audience answer refuses as the channel summary does', () => {
  test('a window after publish is refused with window_after_publish, and lifetime with invalid_window, before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      ['first7', 'lifetime'].map((window) => readAudience(browser, channelId, { window })),
    )

    expect(refused).toEqual([
      { status: 400, body: { error: 'window_after_publish' } },
      { status: 400, body: { error: 'invalid_window' } },
    ])
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a failed country read refuses the whole answer, never answering empty countries', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    // The channel's snippet and last processed day are now cached, so only the countries fail.
    await readAudience(browser, channelId, { window: 'last28' })
    api.google.failAnalytics(500)

    const failed = await readAudience(browser, channelId, { window: 'last90' })

    expect(failed).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // The one query Google failed was the countries'.
    expect(api.google.analyticsRequests.at(-1)?.get('dimensions')).toBe('country')
  })
})
