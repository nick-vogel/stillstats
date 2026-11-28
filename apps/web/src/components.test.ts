// Limits: these tests render the markup a component first mounts with, through React's server
// renderer, and run no effect and no browser. They show what a screen holds, by its elements, text
// and attributes, not how it looks or what a screen reader then says. Nick checks the Settings
// screen's placeholder, the notices' style, the sources button and the sorted tables at /app in a real
// browser, with VoiceOver for the live regions. The server renderer reads
// `useStackedCharts`'s server snapshot, every chart stacked, so every render of the metric charts
// here is the wide layout; none shows the one chart a small screen draws (`stackedChartsQuery`),
// its heading or its labels.
import { readFileSync } from 'node:fs'
import {
  type ChannelSummaryAnswer,
  type ListedChannel,
  type Preferences,
  type SummaryUpload,
  type VideoDay,
  type VideoDetailAnswer,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoRow,
  type VideoSort,
  videoWindowDays,
} from '@creator-analytics/api-types'
import { createElement, createRef, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { AudienceRetention } from './AudienceRetention.tsx'
import { everyFormatText, noNumbersText } from './audience.ts'
import { Cards } from './Cards.tsx'
import { ChannelSummaryFigures } from './ChannelSummaryFigures.tsx'
import { Cities } from './Cities.tsx'
import { ControlsBar, CustomRangeCalendar } from './ControlsBar.tsx'
import { Countries } from './Countries.tsx'
import { summaryViewOf } from './channel-summary.ts'
import { chartLabelOf } from './chart-slider.ts'
import { Devices, OperatingSystems } from './Devices.tsx'
import { launchChartText } from './launch-chart.ts'
import { MetricCharts } from './MetricCharts.tsx'
import { metricChartsText } from './metric-charts.ts'
import { NumbersTable } from './NumbersTable.tsx'
import { newestAverageTextOf } from './newest-average.ts'
import { PreferencesContext } from './preferences.ts'
import { delayNoteOf, longDateOf } from './processing.ts'
import { publishDayTopText } from './publish-day-top.ts'
import { RevenueSourcesButton } from './RevenueSourcesButton.tsx'
import { relativeName } from './retention.ts'
import { defaultRoute, hrefOf, type Route, routeToVideo } from './route.ts'
import { Settings } from './Settings.tsx'
import { SignedOut } from './SignedOut.tsx'
import { SincePublishTable } from './SincePublishTable.tsx'
import { StillstatsMark } from './StillstatsMark.tsx'
import { SubscriberSplitFigures } from './SubscriberSplitFigures.tsx'
import { Switch } from './Switch.tsx'
import { UsStates } from './UsStates.tsx'
import { uploadMarkersLabel } from './upload-markers.ts'
import { VideoDetailScreen } from './VideoDetail.tsx'
import { Pager, VideoListRow, VideoListRows } from './VideoList.tsx'
import { VideoStepper } from './VideoStepper.tsx'
import { AgeGroups, Genders } from './ViewerShares.tsx'
import type { SummaryPlaceList } from './video-list.ts'
import { playerMoveText } from './video-player.ts'
import {
  type RefusedPlace,
  refusedPageText,
  retryText,
  type Stepper,
  type StepperPosition,
} from './video-step.ts'
import type { ChartDay } from './views-chart.ts'

function markupOf(element: ReactNode, saved: Preferences = {}): string {
  return renderToStaticMarkup(
    createElement(
      PreferencesContext,
      { value: { saved, save: () => {}, settled: async () => {} } },
      element,
    ),
  )
}

const noop = () => {}

function settingsOf(channels: ListedChannel[] | null, channelsFailed = false) {
  return markupOf(
    createElement(Settings, {
      channels,
      channelsFailed,
      supportLink: null,
      supportThanks: false,
      pro: null,
      theme: 'system',
      onDisconnect: noop,
      onGiveRevenueConsent: noop,
      onSubscribe: noop,
      onManage: noop,
      onConnect: noop,
      onResetPreferences: noop,
      onSignOut: noop,
      onDeleteMe: noop,
    }),
  )
}

const channel: ListedChannel = {
  id: 'c-1',
  youtubeChannelId: 'UC1234567890',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}

describe('the Settings screen', () => {
  test('holds the channel list place, busy, while the channels are read', () => {
    const markup = settingsOf(null)

    expect(markup).toMatch(
      /<div class="placeholders" aria-busy="true"><div class="placeholder placeholder-channel"/,
    )
  })

  test('holds no place, and is not busy, once the read of the channels failed', () => {
    const markup = settingsOf(null, true)

    expect(markup).not.toContain('aria-busy')
    expect(markup).not.toContain('placeholder-channel')
  })

  test("names each channel by its name on YouTube alone, linked to the channel's page there", () => {
    expect(settingsOf([channel])).toContain(
      '<a class="channel-name" href="https://www.youtube.com/channel/UC1234567890">Nick Vogel</a>',
    )
  })

  test('names a channel YouTube gave no name by its YouTube channel id', () => {
    expect(settingsOf([{ ...channel, title: null }])).toContain('>UC1234567890</a>')
  })
})

const day: VideoDay = { day: '2026-09-01', engagedViews: 1, views: 2, estimatedMinutesWatched: 3 }
const detailAnswer: VideoDetailAnswer = {
  video: {
    id: 'dQw4w9WgXcQ',
    title: 'A video',
    thumbnailUrl: null,
    thumbnails: [],
    publishedAt: '2026-09-01T16:00:00Z',
    scheduled: false,
    durationSeconds: 270,
    format: 'video',
    privacy: 'public',
    embeddable: true,
    madeForKids: false,
  },
  window: 'last28',
  totals: {
    engagedViews: 1,
    views: 2,
    averageViewPercentage: 40,
    subscribersGained: 0,
    estimatedMinutesWatched: 3,
  },
  days: [day, { ...day, day: '2026-09-02' }],
  audienceRetention: [
    { elapsedVideoTimeRatio: 0, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
    { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
  ],
  trafficSources: [{ type: 'YT_SEARCH', engagedViews: 1, views: 2 }],
  subscriberSplit: {
    subscribed: { engagedViews: 0, views: 0 },
    unsubscribed: { engagedViews: 1, views: 2 },
  },
  sincePublish: { rows: [] },
  awaitingProcessing: false,
  lastProcessedDay: '2026-10-05',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-08T10:00:00Z',
  fromCache: false,
}

/** The markup of a video's screen showing `answer`. */
function detailScreenOf(answer: VideoDetailAnswer): string {
  return markupOf(
    createElement(VideoDetailScreen, {
      video: answer.video.id,
      answer,
      headRow: null,
      stepper: () => null,
      title: createRef<HTMLHeadingElement>(),
      route: defaultRoute,
      navigate: noop,
      onGiveRevenueConsent: noop,
    }),
  )
}

// Twelve countries, `ZZ` in its place by its number, as the API sorts them.
const twelveCountries = [
  'US',
  'GB',
  'DE',
  'ZZ',
  'FR',
  'IN',
  'CA',
  'AU',
  'BR',
  'JP',
  'MX',
  'ES',
].map((code, i) => ({ code, engagedViews: 1200 - i * 100, views: 1300 - i * 100 }))

// creator-analytics#357: the RPM switch on Settings is the list's switch, with a hint under it.
describe('a switch with a hint', () => {
  const markup = markupOf(
    createElement(Switch, {
      label: 'A label',
      hint: 'A hint.',
      checked: false,
      onChange: noop,
    }),
  )

  test('is a switch, named by its label', () => {
    expect(markup).toMatch(
      /<label class="list-switch"><input type="checkbox" role="switch"[^>]*\/>/,
    )
    expect(markup).toContain('A label')
  })

  test('is described by its hint', () => {
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1]

    expect(describedBy).toBeDefined()
    expect(markup).toContain(`<p class="switch-hint" id="${describedBy}">A hint.</p>`)
  })

  test('without a hint, is described by nothing', () => {
    const plain = markupOf(
      createElement(Switch, { label: 'A label', checked: true, onChange: noop }),
    )

    expect(plain).not.toContain('aria-describedby')
    expect(plain).not.toContain('switch-hint')
  })
})

describe('the countries section', () => {
  test('shows under "Countries (engaged views)" as 10 named bars, then "Other countries", ZZ as "Unknown country", each with its number and share', () => {
    const markup = markupOf(createElement(Countries, { countries: twelveCountries }))
    const rows = [
      ...markup
        .slice(0, markup.indexOf('</ul>'))
        .matchAll(
          /<li><span class="bars-name">([^<]*)<\/span><span class="bars-number">([^<]*)<\/span>/g,
        ),
    ].map(([, name, number]) => [name, number])

    expect(markup).toContain('<h2>Countries (engaged views)</h2>')
    expect(rows).toHaveLength(11)
    expect(rows[0]).toEqual(['United States', '1,200 (15%)'])
    expect(rows[3]).toEqual(['Unknown country', '900 (12%)'])
    // Mexico and Spain: 200 + 100 of every country's 7,800.
    expect(rows[10]).toEqual(['Other countries', '300 (4%)'])
  })

  test('the note follows the bars', () => {
    const markup = markupOf(createElement(Countries, { countries: twelveCountries }))

    expect(markup.indexOf('<p class="note">')).toBeGreaterThan(markup.indexOf('</ul>'))
  })

  test(`with no country, shows its heading and "${noNumbersText}", no bars and no note`, () => {
    const markup = markupOf(createElement(Countries, { countries: [] }))

    expect(markup).toContain('<h2>Countries (engaged views)</h2>')
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('<ul')
    expect(markup).not.toContain('class="note"')
  })
})

const twelveStates = [
  'US-CA',
  'US-TX',
  'US-ZZ',
  'US-NY',
  'US-FL',
  'US-IL',
  'US-PA',
  'US-OH',
  'US-GA',
  'US-NC',
  'US-MI',
  'US-DC',
].map((code, i) => ({ code, engagedViews: 1200 - i * 100, views: 1300 - i * 100 }))

const twelveCities = [
  'Mumbai',
  'Chicago',
  'London',
  'Toronto',
  'Berlin',
  'Sydney',
  'Austin',
  'Delhi',
  'Paris',
  'Lagos',
  'Seoul',
  'Lima',
].map((name, i) => ({ name, engagedViews: 1200 - i * 100, views: 1300 - i * 100 }))

/** The notes of a section's markup, in order. */
function notesOf(markup: string): string[] {
  return [...markup.matchAll(/<p class="note">([^<]*)<\/p>/g)].map(([, note]) => note ?? '')
}

describe.each([
  {
    section: 'the US states section',
    heading: 'US states (engaged views)',
    of: (rows: 'some' | 'none', format: VideoFormatFilter) =>
      createElement(UsStates, { usStates: rows === 'some' ? twelveStates : [], format }),
    first: ['California', '1,200 (15%)'],
    // Michigan and Washington, D.C.: 200 + 100 of every state's 7,800.
    last: ['Other states', '300 (4%)'],
  },
  {
    section: 'the cities section',
    heading: 'Cities (engaged views)',
    of: (rows: 'some' | 'none', format: VideoFormatFilter) =>
      createElement(Cities, { cities: rows === 'some' ? twelveCities : [], format }),
    first: ['Mumbai', '1,200 (15%)'],
    // Seoul and Lima: 200 + 100 of every city's 7,800.
    last: ['Other cities', '300 (4%)'],
  },
])('$section', ({ heading, of, first, last }) => {
  test(`shows under its heading 10 named bars, then the rest's bar, each with its number and share`, () => {
    const markup = markupOf(of('some', 'all'))
    const rows = barRowsOf(markup)

    expect(markup).toContain(`<h2>${heading}</h2>`)
    expect(rows).toHaveLength(11)
    expect(rows[0]).toEqual(first)
    expect(rows[10]).toEqual(last)
  })

  test('for every format, one note follows the bars', () => {
    const markup = markupOf(of('some', 'all'))

    expect(notesOf(markup)).toHaveLength(1)
    expect(markup.indexOf('<p class="note">')).toBeGreaterThan(markup.indexOf('</ul>'))
  })

  test(`with a format chosen, "${everyFormatText}" follows the few-views note`, () => {
    const notes = notesOf(markupOf(of('some', 'short')))

    expect(notes).toHaveLength(2)
    expect(notes[1]).toBe(everyFormatText)
  })

  test(`with no row, shows its heading and "${noNumbersText}", no bars and no note, a format chosen or not`, () => {
    for (const format of ['all', 'video'] as const) {
      const markup = markupOf(of('none', format))

      expect(markup).toContain(`<h2>${heading}</h2>`)
      expect(markup).toContain(noNumbersText)
      expect(markup).not.toContain('<ul')
      expect(markup).not.toContain('class="note"')
    }
  })
})

/** The name and share of each bar row in the markup, in order. */
function barRowsOf(markup: string): string[][] {
  return [
    ...markup
      .slice(0, markup.indexOf('</ul>'))
      .matchAll(
        /<li><span class="bars-name">([^<]*)<\/span><span class="bars-number">([^<]*)<\/span>/g,
      ),
  ].map(([, name, share]) => [name ?? '', share ?? ''])
}

const signedInNote = 'These shares count only viewers who are signed in to YouTube.'

describe('the age section', () => {
  test('shows under "Age (share of signed-in viewers)" one bar per age group, in age order, each with its share', () => {
    const markup = markupOf(
      createElement(AgeGroups, {
        ageGroups: [
          { ageGroup: 'age65-', viewerPercentage: 2.1 },
          { ageGroup: 'age18-24', viewerPercentage: 31.4 },
          { ageGroup: 'age25-34', viewerPercentage: 40.3 },
        ],
      }),
    )

    expect(markup).toContain('<h2>Age (share of signed-in viewers)</h2>')
    expect(barRowsOf(markup)).toEqual([
      ['18 to 24', '31%'],
      ['25 to 34', '40%'],
      ['65 and over', '2%'],
    ])
    expect(markup).not.toContain('class="note"')
  })

  test(`with no age group, shows its heading and "${noNumbersText}", no bars`, () => {
    const markup = markupOf(createElement(AgeGroups, { ageGroups: [] }))

    expect(markup).toContain('<h2>Age (share of signed-in viewers)</h2>')
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('<ul')
  })
})

describe('the gender section', () => {
  const genders = [
    { gender: 'male', viewerPercentage: 81.2 },
    { gender: 'user_specified', viewerPercentage: 0.4 },
    { gender: 'female', viewerPercentage: 18.4 },
  ]

  test('shows under "Gender (share of signed-in viewers)" Female, Male and Self-described, each with its share', () => {
    const markup = markupOf(createElement(Genders, { genders }))

    expect(markup).toContain('<h2>Gender (share of signed-in viewers)</h2>')
    expect(barRowsOf(markup)).toEqual([
      ['Female', '18%'],
      ['Male', '81%'],
      // "<1%", as the markup escapes its "<".
      ['Self-described', '&lt;1%'],
    ])
  })

  test('the signed-in note follows the bars', () => {
    const markup = markupOf(createElement(Genders, { genders }))

    expect(markup).toContain(`<p class="note">${signedInNote}</p>`)
    expect(markup.indexOf('<p class="note">')).toBeGreaterThan(markup.indexOf('</ul>'))
  })

  test(`with no gender, shows its heading and "${noNumbersText}", no bars and no note`, () => {
    const markup = markupOf(createElement(Genders, { genders: [] }))

    expect(markup).toContain('<h2>Gender (share of signed-in viewers)</h2>')
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('<ul')
    expect(markup).not.toContain(signedInNote)
  })
})

describe('the devices section', () => {
  test('shows under "Devices (engaged views)" each device by its name, most engaged views first as the API orders them, with no note', () => {
    const markup = markupOf(
      createElement(Devices, {
        devices: [
          { deviceType: 'MOBILE', engagedViews: 600, views: 800 },
          { deviceType: 'DESKTOP', engagedViews: 300, views: 400 },
          { deviceType: 'UNKNOWN_PLATFORM', engagedViews: 100, views: 120 },
        ],
      }),
    )

    expect(markup).toContain('<h2>Devices (engaged views)</h2>')
    expect(barRowsOf(markup)).toEqual([
      ['Mobile', '600 (60%)'],
      ['Desktop', '300 (30%)'],
      ['Unknown device', '100 (10%)'],
    ])
    expect(markup).not.toContain('class="note"')
  })

  test(`with no device, shows its heading and "${noNumbersText}", no bars`, () => {
    const markup = markupOf(createElement(Devices, { devices: [] }))

    expect(markup).toContain('<h2>Devices (engaged views)</h2>')
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('<ul')
  })
})

describe('the operating systems section', () => {
  const twelveSystems = [
    'WINDOWS',
    'ANDROID',
    'IOS',
    'MACINTOSH',
    'LINUX',
    'PLAYSTATION',
    'XBOX',
    'SMART_TV',
    'CHROMECAST',
    'WEBOS',
    'TIZEN',
    'PLAYSTATION_VITA',
  ].map((operatingSystem, i) => ({
    operatingSystem,
    engagedViews: 1200 - i * 100,
    views: 1300 - i * 100,
  }))

  test('shows under "Operating systems (engaged views)" 10 named bars, then "Other operating systems", each with its number and share', () => {
    const markup = markupOf(createElement(OperatingSystems, { operatingSystems: twelveSystems }))
    const rows = barRowsOf(markup)

    expect(markup).toContain('<h2>Operating systems (engaged views)</h2>')
    expect(rows).toHaveLength(11)
    expect(rows[0]).toEqual(['Windows', '1,200 (15%)'])
    // Tizen and PlayStation Vita: 200 + 100 of every system's 7,800.
    expect(rows[10]).toEqual(['Other operating systems', '300 (4%)'])
  })

  test(`with no operating system, shows its heading and "${noNumbersText}", no bars`, () => {
    const markup = markupOf(createElement(OperatingSystems, { operatingSystems: [] }))

    expect(markup).toContain('<h2>Operating systems (engaged views)</h2>')
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('<ul')
  })
})

describe("the Audience screen's subscriber split", () => {
  const heading = '<h2>Subscribers and non-subscribers (engaged views)</h2>'

  test('shows its two figures, each with its number and share, and the split bar', () => {
    const markup = markupOf(
      createElement(SubscriberSplitFigures, {
        split: {
          subscribed: { engagedViews: 300, views: 400 },
          unsubscribed: { engagedViews: 900, views: 1100 },
        },
      }),
    )

    expect(markup).toContain(heading)
    expect(markup).toContain('300 (25%)')
    expect(markup).toContain('900 (75%)')
    // The split bar draws the rest past the subscribers' quarter.
    expect(markup).toMatch(/<rect class="bar-rest"[^>]*><\/rect><rect class="bar" width="25"/)
  })

  test(`with no split, shows its heading and "${noNumbersText}", no figures and no bar`, () => {
    const markup = markupOf(createElement(SubscriberSplitFigures, { split: null }))

    expect(markup).toContain(heading)
    expect(markup).toContain(noNumbersText)
    expect(markup).not.toContain('class="figures')
    expect(markup).not.toContain('<svg')
  })
})

describe("a video's breakdowns", () => {
  test("a video's screen shows no countries section (creator-analytics#192)", () => {
    expect(detailScreenOf(detailAnswer)).not.toContain('Countries (engaged views)')
  })

  test('traffic sources then the subscriber split share one grid, with the since publish table and audience retention outside it', () => {
    const markup = detailScreenOf({
      ...detailAnswer,
      sincePublish: {
        rows: [{ stage: 'lifetime', engagedViews: 1, views: 2, estimatedMinutesWatched: 3 }],
        daysSincePublish: 36,
      },
    })
    const gridStart = markup.indexOf('<div class="video-detail-breakdowns">')
    const headings = [
      'Since publish',
      'Audience retention',
      'Traffic sources (engaged views)',
      'Subscribers and non-subscribers (engaged views)',
    ].map((heading) =>
      markup.search(new RegExp(`<h2[^>]*>${heading.replace(/[()]/g, '\\$&')}</h2>`)),
    )

    expect(gridStart).toBeGreaterThan(-1)
    expect(headings.every((at) => at > -1)).toBe(true)
    expect(headings).toEqual(headings.toSorted((a, b) => a - b))
    expect(headings.slice(0, 2).every((at) => at < gridStart)).toBe(true)
    expect(headings.slice(2).every((at) => at > gridStart)).toBe(true)
    // The grid's two sections are its only children, and it ends after the last.
    const grid = markup.slice(gridStart)
    expect(
      grid.match(
        /^<div class="video-detail-breakdowns">(<section class="video-detail-section">(?:(?!<\/section>).)*<\/section>){2}<\/div>/,
      ),
    ).not.toBeNull()
  })
})

test("a video's screen heads itself with the video's title as its h1, its sections with h2, and the relative retention chart with an h3 under the retention section's h2", () => {
  const markup = markupOf(
    createElement(VideoDetailScreen, {
      video: detailAnswer.video.id,
      answer: detailAnswer,
      headRow: null,
      stepper: () => null,
      title: createRef<HTMLHeadingElement>(),
      route: defaultRoute,
      navigate: noop,
      onGiveRevenueConsent: noop,
    }),
  )
  const levels = [...markup.matchAll(/<h([1-6])\b/g)].map(([, level]) => Number(level))

  expect(markup).toContain('<h1 tabindex="-1">A video</h1>')
  expect(levels[0]).toBe(1)
  expect(levels.filter((level) => level === 1)).toHaveLength(1)
  expect(levels).toContain(2)
  const retention = markup.indexOf('<h2>Audience retention</h2>')
  const relative = markup.indexOf('<h3>Relative retention</h3>')
  const nextSection = markup.indexOf('<h2', retention + 1)
  expect(retention).toBeGreaterThan(-1)
  expect(relative).toBeGreaterThan(retention)
  expect(nextSection === -1 || relative < nextSection).toBe(true)
  expect(levels.every((level, i) => i === 0 || level <= (levels[i - 1] ?? 0) + 1)).toBe(true)
})

/** The audience retention section of a video's screen showing `answer`. */
function retentionSectionOf(answer: VideoDetailAnswer): string {
  const markup = detailScreenOf(answer)
  const start = markup.indexOf('<h2>Audience retention</h2>')
  if (start === -1) throw new Error('No audience retention section')
  return markup.slice(start, markup.indexOf('</section>', start))
}

// Pinned before creator-analytics#370 moved the audience retention pair onto TanStack Charts, so
// the port keeps each chart's heading, its approved name and its slider. The answer holds the video
// player, so the name ends with the sentence on moving it (creator-analytics#646).
test('each audience retention chart keeps its heading and a slider with its approved name and no point', () => {
  const section = retentionSectionOf(detailAnswer)
  const sliders = [...section.matchAll(/<[a-z]+ [^>]*role="slider"[^>]*>/g)].map(([slider]) => {
    const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(slider)?.[1]
    return { label: attribute('aria-label'), valueText: attribute('aria-valuetext') }
  })

  expect(section).toContain(`<h3>${relativeName}</h3>`)
  expect(sliders).toEqual(
    ['Audience retention', relativeName].map((heading) => ({
      label: chartLabelOf(heading, playerMoveText.moveSentence),
      valueText: 'No point selected',
    })),
  )
})

// Each chart's explanation is a muted caption under its own time axis, not a note above the
// charts, so the plots start at the section's heading, level with the video player beside them
// (Nick, creator-analytics#637, 2026-11-12).
test("each audience retention chart's explanation is a caption under its chart and time axis, and the section holds no note", () => {
  const section = retentionSectionOf(detailAnswer)
  const order = [
    ...section.matchAll(/<h3>|class="(chart|retention-chart-axis|retention-caption|note)"/g),
  ].map(([match, kind]) => (match === '<h3>' ? 'h3' : kind))

  expect(order).toEqual([
    'chart',
    'retention-chart-axis',
    'retention-caption',
    'h3',
    'chart',
    'retention-chart-axis',
    'retention-caption',
  ])
})

test("while the video's detail is read, the audience retention section holds only its heading's place above the charts' places", () => {
  const markup = markupOf(createElement(AudienceRetention, { retention: null, player: null }))
  const places = [...markup.matchAll(/class="placeholder placeholder-([a-z-]+)"/g)].map(
    ([, shape]) => shape,
  )

  expect(places).toEqual(['heading', 'chart', 'line', 'line', 'chart', 'line'])
})

// creator-analytics#337: each chart's slider and its live region read its values, so the pair
// needs no numbers table.
test('the audience retention section shows no numbers table and no disclosure under its charts', () => {
  const section = retentionSectionOf(detailAnswer)

  expect(section).not.toContain('<table')
  expect(section).not.toContain('<details')
})

describe('the signed-out screen', () => {
  test('with a message, such as the one after "Delete me", shows it as a status above the sign-in button', () => {
    const markup = markupOf(
      createElement(SignedOut, { notice: 'You are deleted.', onSignIn: noop }),
    )

    expect(markup).toMatch(
      /^<p role="status"[^>]*>You are deleted\.<\/p><button[^>]*>Sign in with Google<\/button>/,
    )
  })

  test('with no message, opens on the sign-in button', () => {
    const markup = markupOf(createElement(SignedOut, { notice: null, onSignIn: noop }))

    expect(markup).not.toContain('role="status"')
    expect(markup).toMatch(/^<button[^>]*>Sign in with Google<\/button>/)
  })
})

describe('the revenue sources button', () => {
  test('with nothing saved, says "Show revenue sources", collapsed', () => {
    expect(markupOf(createElement(RevenueSourcesButton, { table: 'numbers' }))).toMatch(
      /aria-expanded="false"[^>]*>Show revenue sources</,
    )
  })

  test('with the sources shown, says "Hide revenue sources", expanded', () => {
    expect(
      markupOf(createElement(RevenueSourcesButton, { table: 'numbers' }), { revenueSources: true }),
    ).toMatch(/aria-expanded="true"[^>]*>Hide revenue sources</)
  })
})

test('a revenue card without consent holds a button that gives it, not a link to Settings', () => {
  const markup = renderToStaticMarkup(
    createElement(Cards, {
      cards: [
        {
          label: 'Estimated revenue',
          text: 'Revenue needs your consent.',
          message: true,
          consentButton: 'Give revenue consent',
        },
      ],
      onGiveRevenueConsent: noop,
    }),
  )

  expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Give revenue consent<\/button>/)
  expect(markup).not.toContain('<a ')
})

describe("the engaged views card's ratio line", () => {
  const summaryAnswer: ChannelSummaryAnswer = {
    window: 'last28',
    format: 'all',
    engagedViews: 1200,
    views: 1920,
    estimatedMinutesWatched: 0,
    revenue: { refusal: 'consent_missing' },
    daily: [],
    uploads: [],
    lastProcessedDay: '2026-10-04',
    creationDay: '2019-02-28',
    fetchedAt: '2026-10-07T19:00:00.000Z',
    fromCache: false,
  }

  /** The markup of the channel summary's cards, from the view its figures take. */
  function summaryCardsOf(answer: ChannelSummaryAnswer): string {
    const view = summaryViewOf(answer, 'en-US')
    if (view.kind !== 'figures') throw new Error(`no figures: ${view.kind}`)
    return markupOf(createElement(Cards, { cards: view.cards, onGiveRevenueConsent: noop }))
  }

  function engagedViewsCardIn(markup: string): string {
    const card =
      /<div class="card[^"]*">(?:(?!<\/div>).)*?Engaged views(?:(?!<\/div>).)*<\/div>/.exec(
        markup,
      )?.[0]
    if (card === undefined) throw new Error('no engaged views card')
    return card
  }

  /** The smaller lines of the engaged views card in `markup`, in order. */
  function engagedViewsDetailsOf(markup: string): string[] {
    return [...engagedViewsCardIn(markup).matchAll(/<dd class="card-detail">(.*?)<\/dd>/g)].map(
      ([, inner]) => inner ?? '',
    )
  }

  const ratioLine =
    '<span aria-hidden="true">Views are 1.6× engaged views</span>' +
    '<span class="visually-hidden">Views are 1.6 times engaged views</span>'

  test('on the channel summary, shows under the views line in the engaged views card', () => {
    expect(engagedViewsDetailsOf(summaryCardsOf(summaryAnswer))).toEqual(['1,920 views', ratioLine])
  })

  test("on a video's page, shows under the views line in the engaged views card", () => {
    const markup = detailScreenOf({
      ...detailAnswer,
      totals: { ...detailAnswer.totals, engagedViews: 1200, views: 1920 },
    })

    expect(engagedViewsDetailsOf(markup)).toEqual(['1,920 views', ratioLine])
  })

  test('hides the "×" sign from a screen reader, which reads "times" in its place', () => {
    const [, line] = engagedViewsDetailsOf(summaryCardsOf(summaryAnswer))

    expect(line).toContain('<span aria-hidden="true">Views are 1.6× engaged views</span>')
    expect(line).toContain('<span class="visually-hidden">Views are 1.6 times engaged views</span>')
  })

  test('at zero engaged views, the card has the views line and no ratio line', () => {
    const markup = summaryCardsOf({ ...summaryAnswer, engagedViews: 0, views: 34 })

    expect(engagedViewsDetailsOf(markup)).toEqual(['34 views'])
  })

  // The markup only: the browser walk measures that the place keeps the card as tall as its
  // placeholder.
  test("at zero engaged views, the card keeps the ratio line's place, empty and hidden from a screen reader", () => {
    const markup = summaryCardsOf({ ...summaryAnswer, engagedViews: 0, views: 34 })
    const places = [
      ...engagedViewsCardIn(markup).matchAll(
        /<dd class="card-detail" aria-hidden="true">(.*?)<\/dd>/g,
      ),
    ].map(([, inner]) => inner)

    expect(places).toEqual([''])
  })
})

describe("the stacked charts' headings and scale labels", () => {
  const dayOf = (day: string, engagedViews: number, estimatedRevenue: number): VideoDay => ({
    day,
    engagedViews,
    views: 1,
    estimatedMinutesWatched: 0,
    estimatedRevenue,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  })

  function chartsOf(days: ChartDay[]): string {
    return markupOf(
      createElement(MetricCharts, {
        days,
        total: {
          engagedViews: days.reduce((sum, { engagedViews }) => sum + engagedViews, 0),
          views: days.length,
          estimatedMinutesWatched: 0,
          estimatedRevenue: days.reduce(
            (sum, { estimatedRevenue }) => sum + (estimatedRevenue ?? 0),
            0,
          ),
          estimatedAdRevenue: 0,
          estimatedRedPartnerRevenue: 0,
          currency: 'USD',
        },
        route: { ...defaultRoute, chart: 'daily' },
        navigate: noop,
        shown: null,
      }),
    )
  }

  test("are compact in the revenue's currency, the revenue chart's bottom one its lowest day below zero", () => {
    const markup = chartsOf([dayOf('2026-09-01', 1, 3), dayOf('2026-09-02', 1, -1.2)])

    expect(markup).toContain('<span class="chart-label" style="top:0%">$3</span>')
    expect(markup).toContain('<span class="chart-label" style="top:100%">-$1.2</span>')
  })

  test('are compact while the numbers table keeps the full number', () => {
    const markup = chartsOf([dayOf('2026-09-01', 12_345_678, 0), dayOf('2026-09-02', 1, 0)])

    expect(markup).toContain('<span class="chart-label" style="top:0%">12M</span>')
    expect(markup).toContain('12,345,678')
  })

  /** Each stacked chart's markup, in the order the page draws them. */
  const chartsIn = (markup: string) => markup.split('<div class="metric-chart">').slice(1)
  const headingOf = (chart: string) => /<h2>([^<]*)<\/h2>/.exec(chart)?.[1]

  test('draw the RPM chart after the revenue chart, with its own slider', () => {
    const charts = chartsIn(chartsOf([dayOf('2026-09-01', 1, 3), dayOf('2026-09-02', 2, 1)]))

    expect(charts.map(headingOf)).toEqual([
      'Engaged views and views',
      'Watch hours',
      'Estimated revenue',
      'RPM',
    ])
    expect(charts.at(-1)).toContain(`aria-label="${chartLabelOf('RPM')}"`)
  })

  test('draw no RPM chart when the days carry no revenue', () => {
    const plain: VideoDay[] = [
      { day: '2026-09-01', engagedViews: 1, views: 1, estimatedMinutesWatched: 0 },
      { day: '2026-09-02', engagedViews: 2, views: 2, estimatedMinutesWatched: 0 },
    ]
    const markup = markupOf(
      createElement(MetricCharts, {
        days: plain,
        total: { engagedViews: 3, views: 3, estimatedMinutesWatched: 0 },
        route: { ...defaultRoute, chart: 'daily' },
        navigate: noop,
        shown: null,
      }),
    )

    expect(chartsIn(markup).map(headingOf)).toEqual(['Engaged views and views', 'Watch hours'])
    expect(markup).not.toContain(`aria-label="${chartLabelOf('RPM')}"`)
  })

  // $3 over 1 engaged view is an RPM of $3,000; -$1.2 over 1 is -$1,200.
  test("show the RPM chart's scale compact in the revenue's currency, its bottom its lowest day below zero", () => {
    const charts = chartsIn(chartsOf([dayOf('2026-09-01', 1, 3), dayOf('2026-09-02', 1, -1.2)]))
    const rpm = charts.find((chart) => headingOf(chart) === 'RPM') ?? ''

    expect(rpm).toContain('<span class="chart-label" style="top:0%">$3K</span>')
    expect(rpm).toContain('<span class="chart-label" style="top:100%">-$1.2K</span>')
  })

  // Pinned before creator-analytics#369 moved the stacked charts onto TanStack Charts, so the port
  // keeps each chart's heading, its approved name and its slider.
  test('each stacked chart keeps its heading and a slider with its approved name and no point', () => {
    // A paid channel's days, which carry the stored history, so every chart draws.
    const held = { impressions: 10, ctr: 0.1 }
    const markup = chartsOf([
      { ...dayOf('2026-09-01', 1, 3), ...held },
      { ...dayOf('2026-09-02', 2, 1), ...held },
    ])
    const charts = markup.split('<div class="metric-chart">').slice(1)
    const sliderOf = (chart: string) => {
      const slider = /<[a-z]+ [^>]*role="slider"[^>]*>/.exec(chart)?.[0] ?? ''
      const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(slider)?.[1]
      return { label: attribute('aria-label'), valueText: attribute('aria-valuetext') }
    }

    expect(
      charts.map((chart) => ({
        heading: /<h2>([^<]*)<\/h2>/.exec(chart)?.[1],
        ...sliderOf(chart),
      })),
    ).toEqual(
      Object.values(metricChartsText.headings).map((heading) => ({
        heading,
        label: chartLabelOf(heading),
        valueText: 'No point selected',
      })),
    )
  })
})

describe("the channel summary's place in a window after publish", () => {
  // These hold that the place renders its text constants, as React's markup escapes them. No test
  // holds the words themselves (the global rule `tests-state-a-rule`).
  function htmlOf(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;')
  }

  function launchRow(
    id: string,
    engagedViewsByDay: number[],
    partial?: VideoRow['partial'],
  ): VideoRow {
    return {
      id,
      title: `Upload ${id}`,
      thumbnailUrl: null,
      thumbnails: [],
      durationSeconds: null,
      publishedAt: '2026-09-01T15:00:00Z',
      scheduled: false,
      privacy: 'public',
      format: 'video',
      engagedViews: 0,
      views: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
      awaitingProcessing: false,
      engagedViewsByDay,
      ...(partial ? { partial } : {}),
    }
  }

  function listOf(
    window: VideoListAnswer['window'],
    videos: VideoRow[],
    publishDayTop: VideoListAnswer['publishDayTop'] = [],
  ): VideoListAnswer {
    return {
      videos,
      window,
      page: 1,
      pageSize: 50,
      pageCount: 1,
      revenue: { refusal: 'consent_missing' },
      lastProcessedDay: '2026-10-04',
      creationDay: '2019-02-28',
      fetchedAt: '2026-10-07T09:00:00.000Z',
      fromCache: false,
      publishDayTop,
    }
  }

  function placeOf(
    route: Route,
    list: SummaryPlaceList,
    markedVideoId: string | null = null,
  ): string {
    return markupOf(
      createElement(ChannelSummaryFigures, {
        channel,
        route,
        navigate: noop,
        onGiveRevenueConsent: noop,
        list,
        markedVideoId,
        markedBy: markedVideoId === null ? null : 'row',
        onMark: noop,
      }),
    )
  }

  /**
   * The launch chart's lines, as the library's server-rendered markup groups each one, counted in
   * the launch chart's own markup.
   */
  function launchLinesIn(markup: string): number {
    const chart = markup.slice(markup.indexOf('launch-chart'))
    return chart.match(/<g [^>]*class="ts-chart__line"/g)?.length ?? 0
  }

  /** The approved name on the launch chart's slider, the element its role names. */
  function launchSliderLabelOf(markup: string): string | undefined {
    const slider = /<[a-z]+ [^>]*role="slider"[^>]*>/.exec(markup)?.[0] ?? ''
    return /aria-label="([^"]*)"/.exec(slider)?.[1]
  }

  /** The processed note of every list answer here, as the markup holds it. */
  const processedNote = `<p class="note">${htmlOf(delayNoteOf('2026-10-04'))}</p>`
  const first28: Route = { ...defaultRoute, window: 'first28', chart: 'daily' }
  const launchList = listOf('first28', [
    launchRow(
      'a',
      Array.from({ length: 28 }, (_, i) => i),
    ),
    launchRow('b', [4, 2, 1], { days: 3, of: 28 }),
    launchRow('c', [], { days: 0, of: 28 }),
  ])

  test.for(['first7', 'first28', 'first90', 'first365'] as const)(
    'under %s, shows the launch chart with its approved heading and label, one line per video with a processed day, and the processed note under it',
    (window) => {
      const markup = placeOf(
        { ...first28, window },
        { kind: 'list', channelId: 'c-1', answer: { ...launchList, window } },
      )

      expect(markup).toContain(`<h2>${htmlOf(launchChartText.heading)}</h2>`)
      expect(launchSliderLabelOf(markup)).toBe(htmlOf(launchChartText.label))
      expect(launchLinesIn(markup)).toBe(2)
      expect(markup).toContain('<span>Day 1</span>')
      expect(markup).toContain(`<span>Day ${videoWindowDays[window]}</span>`)
      expect(markup).not.toContain('The channel summary covers')
      expect(markup).not.toContain(htmlOf(launchChartText.empty))
      expect(markup.split(processedNote)).toHaveLength(2)
      expect(markup.indexOf(processedNote)).toBeGreaterThan(markup.indexOf('metric-charts-axis'))
    },
  )

  test("draws no upload marker row, as the launch chart takes the summary charts' place", () => {
    const markup = placeOf(first28, { kind: 'list', channelId: 'c-1', answer: launchList })

    expect(markup).toContain('metric-charts-axis')
    expect(markup).not.toContain('upload-markers')
  })

  test('obeys "Show numbers as", and under "Running total" shows its approved sentence, with the processed note after it', () => {
    const daily = placeOf(first28, { kind: 'list', channelId: 'c-1', answer: launchList })
    const total = placeOf(
      { ...first28, chart: 'aggregate' },
      { kind: 'list', channelId: 'c-1', answer: launchList },
    )

    expect(daily).toContain('<fieldset class="metric-charts-modes" aria-label="Show numbers as">')
    expect(daily).toMatch(/aria-pressed="true"[^>]*>Daily</)
    expect(daily).not.toContain(htmlOf(launchChartText.runningTotalNote))
    expect(total).toMatch(/aria-pressed="true"[^>]*>Running total</)
    expect(total).toContain(`<p class="note">${htmlOf(launchChartText.runningTotalNote)}</p>`)
    expect(total.indexOf(processedNote)).toBeGreaterThan(
      total.indexOf(htmlOf(launchChartText.runningTotalNote)),
    )
  })

  test('labels its top in compact notation', () => {
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', [launchRow('a', [12_345_678, 1])]),
    })

    expect(markup).toContain('<span class="chart-label" style="top:0%">12M</span>')
  })

  test('with only zeros, labels its top and its bottom 0', () => {
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', [launchRow('a', [0, 0, 0])]),
    })

    expect(launchLinesIn(markup)).toBe(1)
    expect(markup).toContain('<span class="chart-label" style="top:0%">0</span>')
    expect(markup).toContain('<span class="chart-label" style="top:100%">0</span>')
  })

  const firstRowsNote = `<p class="note">${htmlOf(launchChartText.firstRowsNote)}</p>`
  const rowsOf = (count: number) =>
    Array.from({ length: count }, (_, i) => launchRow(`v${i + 1}`, [i + 1, 1]))

  test('with 25 rows on the page, draws the first 10 and says so under the axis', () => {
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', rowsOf(25)),
    })

    expect(launchLinesIn(markup)).toBe(10)
    expect(markup.split(firstRowsNote)).toHaveLength(2)
    expect(markup.indexOf(firstRowsNote)).toBeGreaterThan(markup.indexOf('metric-charts-axis'))
  })

  test('with 10 rows on the page, draws them all and shows no note on the first 10', () => {
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', rowsOf(10)),
    })

    expect(launchLinesIn(markup)).toBe(10)
    expect(markup).not.toContain(firstRowsNote)
  })

  const unprocessedList = listOf('first28', [
    launchRow('c', [], { days: 0, of: 28 }),
    launchRow('d', []),
  ])

  /** What the empty launch chart must leave out: the plot, its axis and the "Show numbers as" toggle. */
  function expectNoPlot(markup: string) {
    expect(markup).not.toContain('chart-plot')
    expect(markup).not.toContain('role="slider"')
    expect(markup).not.toContain('chart-label')
    expect(markup).not.toContain('metric-charts-axis')
    expect(markup).not.toContain('ts-chart')
    expect(markup).not.toContain('metric-charts-modes')
    expect(markup).not.toContain('aria-label="Show numbers as"')
    expect(markup).not.toContain('data-launch-position')
    expect(markup).not.toContain('aria-live')
  }

  test('with no row processed, shows its heading and approved empty sentence in place of the plot, axis and toggle, with the processed note under it', () => {
    const markup = placeOf(first28, { kind: 'list', channelId: 'c-1', answer: unprocessedList })

    expect(markup).toContain(`<h2>${htmlOf(launchChartText.heading)}</h2>`)
    expect(markup).toContain(`<p>${htmlOf(launchChartText.empty)}</p>`)
    expect(markup.indexOf(htmlOf(launchChartText.empty))).toBeGreaterThan(
      markup.indexOf(htmlOf(launchChartText.heading)),
    )
    expectNoPlot(markup)
    expect(markup).not.toContain('The channel summary covers')
    expect(markup.split(processedNote)).toHaveLength(2)
    expect(markup.indexOf(processedNote)).toBeGreaterThan(
      markup.indexOf(htmlOf(launchChartText.empty)),
    )
  })

  test('with no row processed under "Running total", shows no running total sentence', () => {
    const markup = placeOf(
      { ...first28, chart: 'aggregate' },
      { kind: 'list', channelId: 'c-1', answer: unprocessedList },
    )

    expect(markup).toContain(`<p>${htmlOf(launchChartText.empty)}</p>`)
    expectNoPlot(markup)
    expect(markup).not.toContain(htmlOf(launchChartText.runningTotalNote))
  })

  test('with 25 rows and none processed, shows the empty sentence and no note on the first 10', () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      launchRow(`v${i + 1}`, [], { days: 0, of: 28 }),
    )
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', rows),
    })

    expect(markup).toContain(`<p>${htmlOf(launchChartText.empty)}</p>`)
    expectNoPlot(markup)
    expect(markup).not.toContain(htmlOf(launchChartText.firstRowsNote))
  })

  test('with only rows past the first 10 processed, draws them with the note on the first 10, and no empty sentence', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      i < 10 ? launchRow(`v${i + 1}`, [], { days: 0, of: 28 }) : launchRow(`v${i + 1}`, [5, 1]),
    )
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', rows),
    })

    expect(launchLinesIn(markup)).toBe(2)
    expect(markup).not.toContain(htmlOf(launchChartText.empty))
    expect(markup.split(firstRowsNote)).toHaveLength(2)
  })

  test('with one processed drawn row, draws the chart with its plot, axis and toggle, and no empty sentence', () => {
    const markup = placeOf(first28, {
      kind: 'list',
      channelId: 'c-1',
      answer: listOf('first28', [launchRow('c', [], { days: 0, of: 28 }), launchRow('a', [3, 1])]),
    })

    expect(markup).not.toContain(htmlOf(launchChartText.empty))
    expect(markup).toContain('role="slider"')
    expect(markup).toContain('<span>Day 1</span>')
    expect(markup).toContain('aria-label="Show numbers as"')
    expect(launchLinesIn(markup)).toBe(1)
  })

  test('under "Publish day", shows the top as bars with its approved heading, titles linked to the detail screen, no rank number, and the processed note under the bars', () => {
    const markup = placeOf(
      { ...defaultRoute, window: 'first1' },
      {
        kind: 'list',
        channelId: 'c-1',
        answer: listOf(
          'first1',
          [launchRow('a', [3])],
          [
            {
              id: 'a',
              title: 'Upload a',
              publishedAt: '2026-09-01T15:00:00.000Z',
              engagedViews: 1600,
            },
            {
              id: 'b',
              title: 'Upload b',
              publishedAt: '2026-09-02T15:00:00.000Z',
              engagedViews: 400,
            },
          ],
        ),
      },
    )

    expect(markup).toContain(`<h2>${htmlOf(publishDayTopText.heading)}</h2>`)
    expect(markup).toMatch(
      /<li><a class="bars-name" href="[^"]*videos\/a\?[^"]*">Upload a<\/a><span class="bars-number">1,600<\/span>/,
    )
    // The bar name's class cuts it short to one line, as its place holds (creator-analytics#469,
    // #511).
    expect(markup).toMatch(/<a class="bars-name" href="[^"]*videos\/b\?[^"]*">Upload b<\/a>/)
    expect(markup).not.toContain('launch-chart')
    expect(markup).not.toContain('data-launch-position')
    expect(markup).not.toMatch(/#\d|\b\d+ of \d+\b/)
    expect(markup).not.toContain('The channel summary covers')
    expect(markup.split(processedNote)).toHaveLength(2)
    expect(markup.indexOf(processedNote)).toBeGreaterThan(markup.indexOf('</ul>'))
  })

  test('under "Publish day", with no processed publish day, says so in its approved text, with the processed note under it', () => {
    const markup = placeOf(
      { ...defaultRoute, window: 'first1' },
      { kind: 'list', channelId: 'c-1', answer: listOf('first1', [launchRow('a', [])], []) },
    )

    expect(markup).toContain(`<p>${htmlOf(publishDayTopText.empty)}</p>`)
    expect(markup.split(processedNote)).toHaveLength(2)
    expect(markup.indexOf(processedNote)).toBeGreaterThan(
      markup.indexOf(htmlOf(publishDayTopText.empty)),
    )
  })

  test("holds a chart's place, not the last channel's chart, while the list still shows another channel's answer", () => {
    const markup = placeOf(first28, { kind: 'list', channelId: 'c-0', answer: launchList })

    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('launch-chart')
  })

  test("in a calendar window, takes no processed note and no launch chart from the list's answer", () => {
    const markup = placeOf(
      { ...defaultRoute, window: 'last28', chart: 'daily' },
      { kind: 'list', channelId: 'c-1', answer: { ...launchList, window: 'last28' } },
    )

    expect(markup).not.toContain(processedNote)
    expect(markup).not.toContain('launch-chart')
  })

  test("holds a chart's place while the list is read, and shows nothing for a refused or empty list, which the list says itself", () => {
    expect(placeOf(first28, { kind: 'reading' })).toContain('aria-busy="true"')
    expect(placeOf(first28, { kind: 'none' })).toBe('<p role="status" class="visually-hidden"></p>')
  })
})

describe("a list row's launch chart swatch", () => {
  const video: VideoRow = {
    id: 'c',
    title: 'Upload c',
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: null,
    publishedAt: '2026-09-01T15:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews: 0,
    views: 0,
    subscribersGained: 0,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
    engagedViewsByDay: [2],
  }

  /** The row's markup, as the list draws it with this launch chart color position. */
  function rowOf(launchPosition: number | undefined): string {
    return markupOf(
      createElement(
        'table',
        null,
        createElement(
          'tbody',
          null,
          createElement(VideoListRow, {
            video,
            route: { ...defaultRoute, window: 'first28' },
            switches: { views: false, watchTime: false, revenue: false },
            columnConditions: { window: 'first28' },
            currency: undefined,
            navigate: noop,
            marked: null,
            onHover: noop,
            launchPosition,
          }),
        ),
      ),
    )
  }

  const swatchOf = (markup: string) => markup.match(/<svg [^>]*class="launch-swatch"[^>]*>/g)

  // Which rows get a position, and in which windows, is the list's, held through the rendered
  // list in app.test.ts.
  test('shows before the title, in its position, hidden from assistive technology, and not without a position', () => {
    const markup = rowOf(3)

    expect(swatchOf(markup)).toHaveLength(1)
    expect(swatchOf(markup)?.[0]).toContain('aria-hidden="true"')
    expect(swatchOf(markup)?.[0]).toContain('data-launch-position="3"')
    expect(markup.indexOf('launch-swatch')).toBeLessThan(markup.indexOf('Upload c'))
    expect(markup).not.toMatch(/<(svg|rect)[^>]* style=/)
    expect(swatchOf(rowOf(undefined))).toBeNull()
  })
})

test("the summary's processed note sits under the metric charts' axis and above their numbers table, as in every calendar window", () => {
  const day: VideoDay = {
    day: '2026-09-01',
    engagedViews: 1,
    views: 1,
    estimatedMinutesWatched: 0,
  }
  const note = delayNoteOf('2026-10-04')
  const markup = markupOf(
    createElement(MetricCharts, {
      days: [day],
      total: { engagedViews: 1, views: 1, estimatedMinutesWatched: 0 },
      route: { ...defaultRoute, chart: 'daily' },
      navigate: noop,
      note,
      shown: null,
    }),
  )
  const at = markup.indexOf(`<p class="note">${note}</p>`)

  expect(at).toBeGreaterThan(markup.indexOf('metric-charts-axis'))
  expect(at).toBeLessThan(markup.indexOf('numbers-table'))
})

describe('the upload marker row under the metric charts', () => {
  const days: VideoDay[] = ['2026-09-01', '2026-09-02', '2026-09-03'].map((day) => ({
    day,
    engagedViews: 1,
    views: 1,
    estimatedMinutesWatched: 0,
  }))
  const uploads: SummaryUpload[] = [
    { id: 'vid-3', title: 'Third', publishDay: '2026-09-03', format: 'short' },
    { id: 'vid-2', title: 'Second', publishDay: '2026-09-01', format: 'live' },
    { id: 'vid-1', title: 'First', publishDay: '2026-09-01', format: 'video' },
  ]

  function chartsWith(shown: 'engagedViews' | null, rowUploads?: SummaryUpload[]): string {
    return markupOf(
      createElement(MetricCharts, {
        days,
        total: { engagedViews: 3, views: 3, estimatedMinutesWatched: 0 },
        route: { ...defaultRoute, chart: 'daily' },
        navigate: noop,
        shown,
        ...(rowUploads ? { uploads: rowUploads } : {}),
      }),
    )
  }

  /** The marker row's markup, from its opening tag to the numbers table after it. */
  function rowIn(markup: string): string {
    const start = markup.indexOf('class="upload-markers"')
    return start === -1 ? '' : markup.slice(start, markup.indexOf('numbers-table', start))
  }

  test.each([
    ['every chart stacked', null],
    ['one chart shown', 'engagedViews'],
  ] as const)(
    'with %s, the row sits right under the axis and above the numbers table',
    (_, shown) => {
      const markup = chartsWith(shown, uploads)
      const row = markup.indexOf('class="upload-markers"')
      const axis = markup.indexOf('metric-charts-axis')

      expect(row).toBeGreaterThan(axis)
      expect(markup.slice(axis, row)).not.toContain('<p')
      expect(row).toBeLessThan(markup.indexOf('numbers-table'))
    },
  )

  test("a single upload is a link to its video's page named by its text alternative, and a day of more is a tile button with their count, named by it", () => {
    const row = rowIn(chartsWith(null, uploads))
    const href = hrefOf(routeToVideo({ ...defaultRoute, chart: 'daily' }, 'vid-3'))

    expect(row).toMatch(/<a [^>]*aria-label="Short: Third"/)
    expect(row).toContain(`href="${href.replaceAll('&', '&amp;')}"`)
    expect(row).toMatch(/<button [^>]*aria-label="2 uploads"[^>]*>.*2.*<\/button>/)
  })

  test('the row is a fieldset, a group, named by its label, which VoiceOver reads before its first marker', () => {
    const opening = chartsWith(null, uploads).match(/<(\w+) [^>]*class="upload-markers"[^>]*>/)

    expect(opening?.[1]).toBe('fieldset')
    expect(opening?.[0]).toContain(`aria-label="${uploadMarkersLabel}"`)
  })

  test('the row is one Tab stop: the first marker takes Tab, the others are skipped', () => {
    const row = rowIn(chartsWith(null, uploads))
    const tabIndexes = [...row.matchAll(/<(?:a|button) [^>]*tabindex="(-?\d)"/g)].map(
      ([, tabIndex]) => tabIndex,
    )

    expect(tabIndexes).toEqual(['0', '-1'])
  })

  test('each marker sits at its day across the plot, through its style, and draws in the one token class', () => {
    const row = rowIn(chartsWith(null, uploads))

    expect(row).toContain('style="left:0%"')
    expect(row).toContain('style="left:100%"')
    expect(row).toContain('text-muted-foreground')
    expect(row).not.toMatch(/(fill|stroke|color)="#/)
  })

  test("a single upload's marker carries the token class itself, so its frame draws in the axis's ink as a tile's does (creator-analytics#763)", () => {
    const row = rowIn(chartsWith(null, uploads))

    expect(row).toMatch(
      /<a [^>]*class="upload-marker text-muted-foreground"[^>]*aria-label="Short: Third"/,
    )
    expect(row).toMatch(
      /<button [^>]*class="upload-marker upload-marker-tile text-muted-foreground"/,
    )
  })

  /** Each plot's markup in the charts, from its opening tag to its library chart. */
  function plotsIn(markup: string): string[] {
    return markup
      .split('class="chart-plot cursor-plot"')
      .slice(1)
      .map((plot) => plot.slice(0, plot.indexOf('cursor-plot-chart')))
  }

  test.each([
    ['daily', 'daily'],
    ['running total', 'aggregate'],
  ] as const)(
    'in %s, with every chart stacked, each plot draws one aria-hidden line per upload day, under its chart (creator-analytics#763)',
    (_, chart) => {
      const markup = markupOf(
        createElement(MetricCharts, {
          days,
          total: { engagedViews: 3, views: 3, estimatedMinutesWatched: 0 },
          route: { ...defaultRoute, chart },
          navigate: noop,
          shown: null,
          uploads,
        }),
      )
      const plots = plotsIn(markup)

      expect(plots).toHaveLength(2)
      for (const plot of plots) {
        const lines = [...plot.matchAll(/<span [^>]*class="upload-day-line[^"]*"[^>]*>/g)].map(
          ([line]) => line,
        )
        expect(lines).toHaveLength(2)
        for (const line of lines) expect(line).toContain('aria-hidden="true"')
        expect(lines[0]).toContain('style="left:0%"')
        expect(lines[1]).toContain('style="left:100%"')
      }
    },
  )

  test('the day lines draw in the one token class, with no colour of their own (creator-analytics#763)', () => {
    const [plot = ''] = plotsIn(chartsWith(null, uploads))

    expect(plot).toMatch(/class="upload-day-line text-muted-foreground"/)
    expect(plot).not.toMatch(/upload-day-line[^>]*style="[^"]*color/)
  })

  test('a screen that passes no uploads, such as the video detail, draws no day line (creator-analytics#763)', () => {
    expect(chartsWith(null)).not.toContain('upload-day-line')
  })

  test('with every chart stacked, a second row sits under the first plot, aria-hidden and out of the Tab order, so only the row under the axis is the fieldset with a Tab stop (creator-analytics#763)', () => {
    const markup = chartsWith(null, uploads)
    const rows = [...markup.matchAll(/<(\w+) [^>]*class="upload-markers(?: [^"]*)?"[^>]*>/g)]
    const mirror = rows.find(([opening]) => opening.includes('upload-markers-mirror'))
    const mirrorAt = mirror?.index ?? -1
    const mirrorRow = markup.slice(mirrorAt, markup.indexOf('class="metric-chart"', mirrorAt))

    expect(rows).toHaveLength(2)
    expect(rows.filter(([, tag]) => tag === 'fieldset')).toHaveLength(1)
    expect(markup.match(/aria-label="Uploads"/g)).toHaveLength(1)
    expect(mirror?.[1]).not.toBe('fieldset')
    expect(mirror?.[0]).toContain('aria-hidden="true"')
    expect(
      [...mirrorRow.matchAll(/<(?:a|button) [^>]*tabindex="(-?\d)"/g)].map(([, t]) => t),
    ).toEqual(['-1', '-1'])
    expect(markup.match(/<(?:a|button) [^>]*class="upload-marker[^>]*tabindex="0"/g)).toHaveLength(
      1,
    )
    expect(mirrorAt).toBeGreaterThan(markup.indexOf('class="chart"'))
    expect(mirrorAt).toBeLessThan(
      markup.indexOf('class="metric-chart"', markup.indexOf('class="chart"')),
    )
  })

  test('with one chart shown, there is one marker row, the fieldset under the axis (creator-analytics#763)', () => {
    const markup = chartsWith('engagedViews', uploads)

    expect(markup.match(/class="upload-markers(?: [^"]*)?"/g)).toEqual(['class="upload-markers"'])
  })

  test('no uploads in the window, or a screen that passes none, such as the video detail, draws no row', () => {
    expect(chartsWith(null, [])).not.toContain('upload-markers')
    expect(chartsWith(null)).not.toContain('upload-markers')
  })
})

test('the numbers table under the metric charts has a caption', () => {
  const day: VideoDay = {
    day: '2026-09-01',
    engagedViews: 1,
    views: 1,
    estimatedMinutesWatched: 0,
  }
  const markup = markupOf(
    createElement(MetricCharts, {
      days: [day],
      total: { engagedViews: 1, views: 1, estimatedMinutesWatched: 0 },
      route: { ...defaultRoute, chart: 'daily' },
      navigate: noop,
      shown: null,
    }),
  )

  expect(markup).toMatch(/<caption [^>]*>[^<]+<\/caption>/)
})

/** The text of each cell of each row in a run of table rows, the row's heading first. */
function cellsOf(rows: string): string[][] {
  return (rows.match(/<tr>.*?<\/tr>/g) ?? []).map((row) =>
    (row.match(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g) ?? []).map((cell) => cell.replace(/<[^>]*>/g, '')),
  )
}

/** The numbers table's body rows and total row, as the cells' text. */
function numbersTableCellsOf(markup: string): { body: string[][]; foot: string[][] } {
  const table = /<section class="numbers-table".*?<\/section>/.exec(markup)?.[0] ?? ''
  return {
    body: cellsOf(/<tbody>(.*)<\/tbody>/.exec(table)?.[1] ?? ''),
    foot: cellsOf(/<tfoot>(.*)<\/tfoot>/.exec(table)?.[1] ?? ''),
  }
}

/** The numbers table's headings in its first heading row, each without its sort's direction mark. */
function numbersTableHeadingsOf(markup: string): string[] {
  const table = /<section class="numbers-table".*?<\/section>/.exec(markup)?.[0] ?? ''
  const head = /<thead><tr>(.*?)<\/tr>/.exec(table)?.[1] ?? ''
  return (head.match(/<th[^>]*>.*?<\/th>/g) ?? []).map((heading) =>
    heading.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, ''),
  )
}

test.for(['daily', 'aggregate'] as const)(
  "the numbers table under the metric charts stays daily under the %s chart mode, its RPM each day's own, YouTube's own total last",
  (mode) => {
    const dayOf = (
      day: string,
      engagedViews: number,
      views: number,
      estimatedMinutesWatched: number,
      estimatedRevenue: number,
    ): VideoDay => ({
      day,
      engagedViews,
      views,
      estimatedMinutesWatched,
      estimatedRevenue,
      estimatedAdRevenue: 0,
      estimatedRedPartnerRevenue: 0,
    })
    const markup = markupOf(
      createElement(MetricCharts, {
        days: [
          dayOf('2026-09-01', 100, 200, 60, 1.25),
          dayOf('2026-09-02', 300, 500, 180, 2.5),
          dayOf('2026-09-03', 50, 70, 30, 0.75),
        ],
        // YouTube's own total, which is not the sum of the days.
        total: {
          engagedViews: 461,
          views: 777,
          estimatedMinutesWatched: 300,
          estimatedRevenue: 4.6,
          estimatedAdRevenue: 0,
          estimatedRedPartnerRevenue: 0,
          currency: 'USD',
        },
        route: { ...defaultRoute, chart: mode },
        navigate: noop,
        shown: null,
      }),
    )
    const { body, foot } = numbersTableCellsOf(markup)

    expect(markup).toMatch(new RegExp(`aria-pressed="true"[^>]*>${metricChartsText.modes[mode]}<`))
    // Engaged views, views, watch hours, estimated revenue, RPM: each day's own, newest first. A
    // running total's RPM would read $10.00 on Sep 3 and $9.38 on Sep 2.
    expect(body).toEqual([
      ['Sep 3, 2026', '50', '70', '0.5', '$0.75', '$15.00'],
      ['Sep 2, 2026', '300', '500', '3.0', '$2.50', '$8.33'],
      ['Sep 1, 2026', '100', '200', '1.0', '$1.25', '$12.50'],
    ])
    expect(foot).toEqual([[expect.any(String), '461', '777', '5.0', '$4.60', '$9.98']])
  },
)

describe('the RPM column of the numbers table', () => {
  const earningDay = (day: string, engagedViews: number, estimatedRevenue: number) => ({
    day,
    engagedViews,
    views: engagedViews,
    estimatedMinutesWatched: 0,
    estimatedRevenue,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  })
  const earningDays = [earningDay('2026-09-01', 1000, 4.57), earningDay('2026-09-02', 0, 3)]
  const revenue = {
    estimatedRevenue: 21.2,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  }

  const summaryAnswer: ChannelSummaryAnswer = {
    window: 'last28',
    format: 'all',
    engagedViews: 4600,
    views: 4600,
    estimatedMinutesWatched: 0,
    revenue: { ...revenue, noFormatRevenue: 0, everyFormatRevenue: 21.2, currency: 'USD' },
    daily: earningDays,
    uploads: [],
    lastProcessedDay: '2026-10-04',
    creationDay: '2019-02-28',
    fetchedAt: '2026-10-07T19:00:00.000Z',
    fromCache: false,
  }

  /** The markup of the channel summary's metric charts, from the view its figures take. */
  function summaryChartsOf(answer: ChannelSummaryAnswer): string {
    const view = summaryViewOf(answer, 'en-US')
    if (view.kind !== 'figures') throw new Error(`no figures: ${view.kind}`)
    return markupOf(
      createElement(MetricCharts, {
        days: view.daily,
        total: view.total,
        route: { ...defaultRoute, chart: 'daily' },
        navigate: noop,
        shown: null,
      }),
    )
  }

  test("on the channel summary, heads a column with each day's RPM and the window's in the total row", () => {
    const markup = summaryChartsOf(summaryAnswer)
    const { body, foot } = numbersTableCellsOf(markup)
    const rpmAt = numbersTableHeadingsOf(markup).indexOf('RPM')

    expect(rpmAt).toBeGreaterThan(-1)
    expect(body.map((row) => [row[0], row[rpmAt]])).toEqual([
      ['Sep 2, 2026', ''],
      ['Sep 1, 2026', '$4.57'],
    ])
    expect(foot[0]?.[rpmAt]).toBe('$4.61')
  })

  test('on the channel summary without revenue consent, has no RPM column', () => {
    const markup = summaryChartsOf({ ...summaryAnswer, revenue: { refusal: 'consent_missing' } })

    const headings = numbersTableHeadingsOf(markup)

    // The date and the three numbers, and no revenue column.
    expect(headings).toHaveLength(4)
    expect(headings).not.toContain('RPM')
  })

  test("on a video's page, heads a column with each day's RPM and the window's in the total row", () => {
    const markup = detailScreenOf({
      ...detailAnswer,
      totals: { ...detailAnswer.totals, engagedViews: 4600 },
      days: earningDays,
      revenue: { ...revenue, currency: 'USD' },
    })
    const { body, foot } = numbersTableCellsOf(markup)
    const rpmAt = numbersTableHeadingsOf(markup).indexOf('RPM')

    expect(rpmAt).toBeGreaterThan(-1)
    expect(body.map((row) => [row[0], row[rpmAt]])).toEqual([
      ['Sep 2, 2026', ''],
      ['Sep 1, 2026', '$4.57'],
    ])
    expect(foot[0]?.[rpmAt]).toBe('$4.61')
  })

  test("on a video's page without revenue consent, has no RPM column", () => {
    const markup = detailScreenOf({
      ...detailAnswer,
      days: earningDays,
      revenue: { refusal: 'consent_missing' },
    })

    const headings = numbersTableHeadingsOf(markup)

    // The date and the three numbers, and no revenue column.
    expect(headings).toHaveLength(4)
    expect(headings).not.toContain('RPM')
  })
})

describe('the numbers table', () => {
  const days: VideoDay[] = [
    {
      day: '2026-09-01',
      engagedViews: 1,
      views: 1,
      estimatedMinutesWatched: 0,
      estimatedRevenue: 3,
      estimatedAdRevenue: 2,
      estimatedRedPartnerRevenue: 0.5,
    },
  ]
  const headings = {
    day: 'Date',
    engagedViews: 'Engaged views',
    views: 'Views',
    estimatedMinutesWatched: 'Watch hours',
    impressions: 'Impressions',
    ctr: 'CTR',
    estimatedRevenue: 'Estimated revenue',
    rpm: 'RPM',
    estimatedAdRevenue: 'Ads',
    estimatedRedPartnerRevenue: 'YouTube Premium',
    otherSources: 'Other sources',
  }
  const tableOf = (saved: Preferences) =>
    markupOf(
      createElement(NumbersTable, {
        days,
        total: {
          engagedViews: 1,
          views: 1,
          estimatedMinutesWatched: 0,
          estimatedRevenue: 3,
          estimatedAdRevenue: 2,
          estimatedRedPartnerRevenue: 0.5,
          currency: 'USD',
        },
        text: { caption: 'Numbers by day', headings, total: 'Total' },
      }),
      saved,
    )

  test('announces its sort in a live region', () => {
    expect(tableOf({})).toContain(
      '<p class="visually-hidden" aria-live="polite">Date, newest first</p>',
    )
  })

  test('with the sources shown, heads them "Revenue sources" in a second heading row', () => {
    const markup = tableOf({ revenueSources: true })

    expect(markup).toMatch(/<th scope="colgroup" colSpan="3"[^>]*>Revenue sources<\/th><\/tr><tr>/)
  })

  test('with the sources hidden, has no source column and one heading row', () => {
    const markup = tableOf({})
    const head = /<thead>(.*)<\/thead>/.exec(markup)?.[1] ?? ''

    expect(markup).not.toContain('Revenue sources</th>')
    expect(markup).not.toContain('>Ads<')
    expect(head.match(/<tr>/g)).toHaveLength(1)
  })
})

test('the since publish table announces its sort, engaged views highest first by default', () => {
  const markup = renderToStaticMarkup(
    createElement(SincePublishTable, {
      sincePublish: {
        rows: [{ stage: 'lifetime', engagedViews: 1, views: 2, estimatedMinutesWatched: 3 }],
        daysSincePublish: 172,
      },
    }),
  )

  expect(markup).toContain('aria-live="polite">Engaged views, highest first</p>')
  expect(markup).toMatch(/<th scope="col" aria-sort="descending"><button[^>]*>Engaged views/)
  expect(markup).toContain('<span class="since-publish-note">172 days since publish</span>')
})

describe('the controls bar', () => {
  const bounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }
  // Across a year, so the compact button's text holds the year on both ends whatever the clock's.
  const range = { from: '2025-12-28', to: '2026-01-04' }
  const onCustom: Route = { ...defaultRoute, window: 'custom', range }

  test('on a custom range, offers it between the last 365 days and the publish day, with the compact button beside it and no date field in the bar', () => {
    const markup = renderToStaticMarkup(
      createElement(ControlsBar, { route: onCustom, navigate: noop, bounds }),
    )

    expect(markup).toMatch(
      /<option[^>]*value="last365">Last 365 days<\/option><option[^>]*value="custom" selected="">Custom range<\/option><option[^>]*value="first1">Publish day<\/option>/,
    )
    const button = /<button[^>]*aria-label="([^"]*)"[^>]*>([^<]*)<\/button>/.exec(markup)
    expect(button?.[1]).toMatch(/^Custom range, .*2025.* to .*2026$/)
    expect(button?.[2]).toMatch(/^.*2025.* to .*2026$/)
    expect(markup).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-label="Custom range, /)
    expect(markup).not.toContain('type="date"')
    expect(markup).not.toContain('>Apply<')
  })

  test('on a calendar window, shows no compact button and no date field', () => {
    const markup = renderToStaticMarkup(
      createElement(ControlsBar, { route: defaultRoute, navigate: noop, bounds }),
    )

    expect(markup).toMatch(/<option[^>]*value="custom">Custom range<\/option>/)
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('type="date"')
    expect(markup).not.toContain('>Apply<')
  })
})

describe("the custom range's Calendar in its Popover", () => {
  const bounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }

  function calendarMarkup({
    fields = { from: '2026-09-21', to: '2026-10-05' },
    withBounds = bounds,
    error = null,
    months = 1,
  }: {
    fields?: { from: string; to: string }
    withBounds?: typeof bounds | null
    error?: string | null
    months?: 1 | 2
  } = {}): string {
    return renderToStaticMarkup(
      createElement(CustomRangeCalendar, {
        fields,
        bounds: withBounds,
        error,
        months,
        onPick: noop,
        onApply: noop,
      }),
    )
  }

  /** The opening tag of the day button named `day`'s long date, or undefined with none shown. */
  function dayButtonIn(markup: string, day: string): string | undefined {
    const name = `aria-label="${longDateOf(day)}"`
    return [...markup.matchAll(/<button\b[^>]*>/g)]
      .map(([tag]) => tag)
      .find((tag) => tag.includes(name))
  }

  /** The `data-day` of each gridcell marked selected, in the order shown. */
  function selectedDaysIn(markup: string): string[] {
    return [...markup.matchAll(/<td\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('aria-selected="true"'))
      .map((tag) => /data-day="([^"]+)"/.exec(tag)?.[1] ?? '')
  }

  test('names each day with its full date', () => {
    const name = /aria-label="([^"]*)"/.exec(dayButtonIn(calendarMarkup(), '2026-10-04') ?? '')?.[1]
    expect(name).toMatch(/\b4\b/)
    expect(name).toMatch(/October/)
    expect(name).toMatch(/2026/)
  })

  test("disables the days after the channel's last processed day, and not that day", () => {
    const markup = calendarMarkup()
    expect(dayButtonIn(markup, '2026-10-08')).toContain(' disabled=""')
    expect(dayButtonIn(markup, '2026-10-07')).not.toContain(' disabled=""')
  })

  test("disables the days before the channel's creation day, and not that day", () => {
    const markup = calendarMarkup({ fields: { from: '2019-03-14', to: '2019-03-20' } })
    expect(dayButtonIn(markup, '2019-03-11')).toContain(' disabled=""')
    expect(dayButtonIn(markup, '2019-03-12')).not.toContain(' disabled=""')
  })

  test('with no bounds yet, disables no day', () => {
    const markup = calendarMarkup({ withBounds: null })
    expect(dayButtonIn(markup, '2026-10-08')).toBeDefined()
    expect(markup).not.toContain('disabled=""')
  })

  test('marks the shown range selected, its ends and the days between, and opens on its end', () => {
    expect(
      selectedDaysIn(calendarMarkup({ fields: { from: '2026-10-02', to: '2026-10-05' } })),
    ).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
  })

  test('with only a start picked, marks that one day selected', () => {
    expect(selectedDaysIn(calendarMarkup({ fields: { from: '2026-10-02', to: '' } }))).toEqual([
      '2026-10-02',
    ])
  })

  test('shows one month, or two with the end in the second', () => {
    const one = calendarMarkup({ months: 1 })
    const two = calendarMarkup({ months: 2 })
    expect(one.match(/role="grid"/g)).toHaveLength(1)
    expect(two.match(/role="grid"/g)).toHaveLength(2)
    expect(dayButtonIn(two, '2026-09-01')).toBeDefined()
    expect(dayButtonIn(two, '2026-10-05')).toBeDefined()
    expect(dayButtonIn(one, '2026-09-01')).toBeUndefined()
  })

  test('offers the month and the year in its caption, named, from the creation year to the last processed year', () => {
    const markup = calendarMarkup()
    expect(markup).toMatch(/<select[^>]*aria-label="Month"/)
    const years = /<select[^>]*aria-label="Year"[^>]*>(.*?)<\/select>/.exec(markup)?.[1] ?? ''
    expect([...years.matchAll(/value="(\d+)"/g)].map(([, year]) => year)).toEqual([
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ])
  })

  test("names each month's grid with its month and year", () => {
    expect(calendarMarkup()).toMatch(/role="grid"[^>]*aria-label="[^"]*October[^"]*2026"/)
  })

  test('names its month buttons', () => {
    const markup = calendarMarkup()
    expect(markup).toMatch(/<button[^>]*aria-label="Previous month"/)
    expect(markup).toMatch(/<button[^>]*aria-label="Next month"/)
  })

  test('holds Apply, with no "From" or "To" label', () => {
    const markup = calendarMarkup()
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>Apply<\/button>/)
    expect(markup).not.toMatch(/>From<|>To</)
    expect(markup).not.toContain('role="alert"')
  })

  // The browser's own checks would refuse the form with their own bubble before Apply's texts.
  test('leaves the custom range check to Apply, not to the browser', () => {
    expect(calendarMarkup()).toMatch(/<form[^>]*noValidate=""/)
  })

  test('shows the error Apply answered as an alert under the Calendar', () => {
    const markup = calendarMarkup({ error: 'Pick a start day and an end day.' })
    expect(markup).toMatch(/<p role="alert"[^>]*>Pick a start day and an end day.<\/p>/)
    expect(markup.indexOf('role="alert"')).toBeGreaterThan(markup.lastIndexOf('role="grid"'))
  })
})

describe('the average sentence above the video list', () => {
  const video: VideoRow = {
    id: 'a',
    title: 'Upload a',
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: null,
    publishedAt: '2026-09-01T15:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'short',
    engagedViews: 5,
    views: 5,
    subscribersGained: 0,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
  }

  function answerIn(
    window: 'first7' | 'last28',
  ): VideoListAnswer & { window: 'first7' | 'last28' } {
    return {
      videos: [video],
      window,
      page: 1,
      pageSize: 50,
      pageCount: 1,
      revenue: { refusal: 'consent_missing' },
      lastProcessedDay: '2026-10-04',
      creationDay: '2019-02-28',
      fetchedAt: '2026-10-07T09:00:00.000Z',
      fromCache: false,
      newestAverage: { format: 'short', count: 4, engagedViews: 1234.4 },
    }
  }

  function rowsOf(answer: ReturnType<typeof answerIn>): string {
    return markupOf(
      createElement(VideoListRows, {
        shown: { busy: false, answer },
        body: { kind: 'videos', answer },
        route: { ...defaultRoute, window: answer.window, format: 'short' },
        switches: { views: false, watchTime: false, revenue: false },
        columnConditions: { window: answer.window },
        navigate: noop,
        changeControl: noop,
        markedVideoId: null,
        onRowHover: noop,
        controlsBar: undefined,
        onTableRead: noop,
      }),
    )
  }

  test('in a window after publish, the sentence sits above the list', () => {
    const answer = answerIn('first7')
    const sentence = `<p>${newestAverageTextOf(answer)}</p>`
    const markup = rowsOf(answer)

    expect(markup).toContain(sentence)
    expect(markup.indexOf(sentence)).toBeLessThan(markup.indexOf('<table'))
  })

  test('in a calendar window, the list shows no sentence', () => {
    const sentence = newestAverageTextOf(answerIn('first7')) ?? ''

    expect(rowsOf(answerIn('last28'))).not.toContain(sentence)
  })
})

describe('the RPM column of the video list', () => {
  const video = (id: string, engagedViews: number, estimatedRevenue: number): VideoRow => ({
    id,
    title: `Upload ${id}`,
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: null,
    publishedAt: '2026-09-01T15:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews,
    views: engagedViews,
    averageViewPercentage: 40,
    subscribersGained: 0,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
    estimatedRevenue,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  })

  const answer: VideoListAnswer = {
    videos: [video('a', 2500, 12.5), video('b', 0, 1)],
    window: 'last28',
    page: 1,
    pageSize: 50,
    pageCount: 1,
    revenue: { currency: 'USD', reported: true },
    lastProcessedDay: '2026-10-04',
    creationDay: '2019-02-28',
    fetchedAt: '2026-10-07T09:00:00.000Z',
    fromCache: false,
  }

  function rowsOf(revenue: boolean, sources: boolean, sort: VideoSort = '-publishedAt'): string {
    return markupOf(
      createElement(VideoListRows, {
        shown: { busy: false, answer },
        body: { kind: 'videos', answer },
        route: { ...defaultRoute, sort },
        switches: { views: true, watchTime: false, revenue },
        columnConditions: { window: 'last28', sources },
        navigate: noop,
        changeControl: noop,
        markedVideoId: null,
        onRowHover: noop,
        controlsBar: undefined,
        onTableRead: noop,
      }),
    )
  }

  /** Each heading row's headings: the attributes of each and its text, the mark aside. */
  const headingRowsOf = (markup: string) =>
    [...(markup.match(/<thead>(.*)<\/thead>/)?.[1] ?? '').matchAll(/<tr>(.*?)<\/tr>/g)].map(
      ([, row]) =>
        [...(row ?? '').matchAll(/<th([^>]*)>(.*?)<\/th>/g)].map(([, attributes, inner]) => ({
          attributes: attributes ?? '',
          text: (inner ?? '')
            .replace(/<span aria-hidden="true">.*?<\/span>/g, '')
            .replace(/<[^>]+>/g, ''),
        })),
    )
  const textsOf = (markup: string) =>
    headingRowsOf(markup).map((row) => row.map(({ text }) => text))
  const cellTextsOf = (markup: string) =>
    [...(markup.match(/<tbody>(.*)<\/tbody>/)?.[1] ?? '').matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map(
      ([, row]) =>
        [...(row ?? '').matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(([, inner]) =>
          (inner ?? '').replace(/<[^>]+>/g, ''),
        ),
    )

  test('with Revenue on, RPM heads a sortable column right after Revenue', () => {
    const [headings] = headingRowsOf(rowsOf(true, false))

    expect(headings?.map(({ text }) => text)).toEqual([
      'Video',
      'Format',
      'Published',
      'Engaged views',
      'Views',
      'Revenue',
      'RPM',
      'Average viewed',
      'Subscribers gained',
    ])
    expect(rowsOf(true, false)).toMatch(/<button type="button" class="sortable-heading">RPM<span/)
  })

  test('sorted by RPM, its heading says so', () => {
    const rpmOf = (sort: VideoSort) =>
      headingRowsOf(rowsOf(true, false, sort))[0]?.find(({ text }) => text === 'RPM')?.attributes
    expect(rpmOf('-rpm')).toContain('aria-sort="descending"')
    expect(rpmOf('rpm')).toContain('aria-sort="ascending"')
    expect(rpmOf('-publishedAt')).toContain('aria-sort="none"')
  })

  test('with the sources shown, RPM follows the sources heading in the first row, and the sources fill the second', () => {
    const markup = rowsOf(true, true)
    const [first, second] = headingRowsOf(markup)

    expect(textsOf(markup)).toEqual([
      [
        'Video',
        'Format',
        'Published',
        'Engaged views',
        'Views',
        'Revenue',
        'Revenue sources',
        'RPM',
        'Average viewed',
        'Subscribers gained',
      ],
      ['Ads', 'YouTube Premium', 'Other sources'],
    ])
    for (const label of ['Revenue', 'RPM', 'Average viewed']) {
      expect(first?.find(({ text }) => text === label)?.attributes).toContain('rowSpan="2"')
    }
    expect(second).toHaveLength(3)
  })

  test('with Revenue off, the list has no RPM heading or cell', () => {
    const markup = rowsOf(false, true)

    expect(textsOf(markup).flat()).not.toContain('RPM')
    expect(cellTextsOf(markup)[0]).not.toContain('$5.00')
  })

  test('each row shows its RPM after its revenue, and an empty cell for zero engaged views', () => {
    const [earning, unwatched] = cellTextsOf(rowsOf(true, false))

    expect(earning?.slice(-4)).toEqual(['$12.50', '$5.00', '40%', '0'])
    expect(unwatched?.slice(-4)).toEqual(['$1.00', '', '40%', '0'])
  })
})

describe('the video list pager', () => {
  const pagerMarkupOf = (route: Route, pageCount = 12) =>
    markupOf(createElement(Pager, { pageCount, route, navigate: noop, land: noop }))
  const placesOf = (markup: string) =>
    [...markup.matchAll(/<(a|span)\b[^>]*>([^<]*)<\/\1>/g)].map(([, , text]) => text)

  // First page shows from page 3 and Last page up to page M minus 2, so neither duplicates
  // Previous page or Next page (Nick, 2026-10-19).
  test.each([
    [1, ['Page 1 of 12', 'Next page', 'Last page']],
    [2, ['Previous page', 'Page 2 of 12', 'Next page', 'Last page']],
    [3, ['First page', 'Previous page', 'Page 3 of 12', 'Next page', 'Last page']],
    [10, ['First page', 'Previous page', 'Page 10 of 12', 'Next page', 'Last page']],
    [11, ['First page', 'Previous page', 'Page 11 of 12', 'Next page']],
    [12, ['First page', 'Previous page', 'Page 12 of 12']],
  ])(
    'on page %i of 12 shows First page and Last page only where they skip a page, in the order First, Previous, Page N of M, Next, Last',
    (page, places) => {
      const markup = pagerMarkupOf({ ...defaultRoute, page })

      expect(markup).toMatch(/^<nav class="video-list-pager" aria-label="Pages">/)
      expect(placesOf(markup)).toEqual(places)
    },
  )

  test("First page and Last page carry the route with only its page changed, to 1 and to the list's last page", () => {
    const route: Route = {
      ...defaultRoute,
      window: 'last90',
      sort: '-views',
      format: 'short',
      pageSize: 25,
      visibility: 'all',
      page: 5,
    }
    const markup = pagerMarkupOf(route)
    const hrefFor = (text: string) =>
      markup.match(new RegExp(`<a [^>]*href="([^"]*)"[^>]*>${text}</a>`))?.[1]
    const escaped = (href: string) => href.replaceAll('&', '&amp;')

    expect(hrefFor('First page')).toBe(escaped(hrefOf({ ...route, page: 1 })))
    expect(hrefFor('Last page')).toBe(escaped(hrefOf({ ...route, page: 12 })))
  })

  test('shows nothing on a single page', () => {
    expect(pagerMarkupOf(defaultRoute, 1)).toBe('')
  })
})

describe('the previous and next video links', () => {
  const listRoute: Route = { ...defaultRoute, page: 2 }
  const stepperMarkupOf = (
    stepper: Stepper | RefusedPlace | null,
    sort: VideoSort = listRoute.sort,
    position: StepperPosition = 'top',
  ) =>
    markupOf(
      createElement(VideoStepper, {
        stepper,
        position,
        listRoute: { ...listRoute, sort },
        navigate: noop,
        onStep: noop,
        onRetry: noop,
        onGone: noop,
      }),
    )
  const placesOf = (markup: string) =>
    [...markup.matchAll(/<(a|span)\b[^>]*>([^<]*)<\/\1>/g)].map(([, tag, text]) => [tag, text])

  const both: Stepper = {
    previous: { id: 'video-4', title: 'How I light a room', page: 2 },
    next: { id: 'video-7', title: 'How I edit my videos', page: 3 },
  }

  test('are links named for the neighbouring titles, previous then next, each to its video', () => {
    const markup = stepperMarkupOf(both)

    expect(markup).toMatch(/^<nav class="video-stepper" aria-label="Videos, top of page"[^>]*>/)
    expect(placesOf(markup)).toEqual([
      ['a', 'Newer video'],
      ['a', 'Older video'],
    ])
    expect(markup).toContain('aria-label="Newer video: How I light a room"')
    expect(markup).toContain('aria-label="Older video: How I edit my videos"')
    expect(markup).toContain('href="/videos/video-4?page=2"')
    expect(markup).toContain('href="/videos/video-7?page=3"')
  })

  test('in an oldest first list read Older video in the previous place and Newer video in the next', () => {
    const markup = stepperMarkupOf(both, 'publishedAt')

    expect(placesOf(markup)).toEqual([
      ['a', 'Older video'],
      ['a', 'Newer video'],
    ])
    expect(markup).toContain('aria-label="Older video: How I light a room"')
    expect(markup).toContain('aria-label="Newer video: How I edit my videos"')
    expect(markup).toMatch(/<a [^>]*class="video-stepper-previous"[^>]*>Older video<\/a>/)
    expect(markup).toMatch(/<a [^>]*class="video-stepper-next"[^>]*>Newer video<\/a>/)
  })

  test('in a metric sort read Previous in list and Next in list', () => {
    const markup = stepperMarkupOf(both, '-views')

    expect(placesOf(markup)).toEqual([
      ['a', 'Previous in list'],
      ['a', 'Next in list'],
    ])
    expect(markup).toContain('aria-label="Previous in list: How I light a room"')
    expect(markup).toContain('aria-label="Next in list: How I edit my videos"')
    expect(markup).toContain('href="/videos/video-4?sort=-views&amp;page=2"')
  })

  test("hold the missing link's place at an end of the list, with no disabled control", () => {
    const atFirst = stepperMarkupOf({
      previous: null,
      next: { id: 'video-2', title: 'Two', page: 1 },
    })
    const atLast = stepperMarkupOf({
      previous: { id: 'video-8', title: 'Eight', page: 3 },
      next: null,
    })

    expect(placesOf(atFirst)).toEqual([
      ['span', ''],
      ['a', 'Older video'],
    ])
    expect(placesOf(atLast)).toEqual([
      ['a', 'Newer video'],
      ['span', ''],
    ])
    expect(`${atFirst}${atLast}`).not.toMatch(/disabled|<button/)
  })

  test("show a refused page's place as its failure with a Try again button, not as an end of the list", () => {
    const markup = stepperMarkupOf({
      previous: { id: 'video-4', title: 'Four', page: 2 },
      next: { refused: 3 },
    })
    const next = markup.match(/<span class="video-stepper-next[^"]*">(.*?)<\/span><\/nav>/)?.[1]

    expect(placesOf(markup)[0]).toEqual(['a', 'Newer video'])
    expect(next).toContain(refusedPageText)
    expect(next).toMatch(new RegExp(`<button [^>]*type="button"[^>]*>${retryText}</button>`))
  })

  test("show a refused address's page as one failure across the stepper with one Try again", () => {
    const markup = stepperMarkupOf({ refused: 2 })

    expect(markup).toMatch(/^<nav class="video-stepper" aria-label="Videos, top of page"[^>]*>/)
    expect(markup).toMatch(
      new RegExp(
        `<nav [^>]*><span class="video-stepper-failed video-stepper-whole">${refusedPageText} <button [^>]*type="button"[^>]*>${retryText}</button></span></nav>$`,
      ),
    )
    expect(markup).not.toMatch(/<a /)
  })

  test('at the bottom of the page are named for it', () => {
    expect(stepperMarkupOf(both, listRoute.sort, 'bottom')).toMatch(
      /^<nav class="video-stepper" aria-label="Videos, bottom of page"[^>]*>/,
    )
  })

  // creator-analytics#452: a refused page changes what the stepper holds, never its name.
  test.each([
    ['top', 'Videos, top of page'],
    ['bottom', 'Videos, bottom of page'],
  ] as const)('at the %s keep their name while a page is refused', (position, name) => {
    const navOf = (markup: string) => markup.match(/^<nav [^>]*>/)?.[0]
    const whole = stepperMarkupOf({ refused: 2 }, listRoute.sort, position)
    const onePlace = stepperMarkupOf(
      { previous: { id: 'video-4', title: 'Four', page: 2 }, next: { refused: 3 } },
      listRoute.sort,
      position,
    )

    expect(whole).toContain(refusedPageText)
    expect(onePlace).toContain(refusedPageText)
    expect(navOf(whole)).toContain(`aria-label="${name}"`)
    expect(navOf(onePlace)).toContain(`aria-label="${name}"`)
  })

  test('hold both places with no link while the pages they need are read', () => {
    expect(placesOf(stepperMarkupOf({ previous: 'reading', next: 'reading' }))).toEqual([
      ['span', ''],
      ['span', ''],
    ])
  })

  test('show nothing with no stepper, for a video not on the list page', () => {
    expect(stepperMarkupOf(null)).toBe('')
  })

  // The server renderer writes no event handler and runs no effect, so this sees an access key
  // only. That the links add no keydown listener is the code review's to check.
  test('bind no access key', () => {
    const markup = stepperMarkupOf({
      previous: { id: 'video-4', title: 'Four', page: 2 },
      next: { id: 'video-6', title: 'Six', page: 2 },
    })

    expect(markup).not.toMatch(/accesskey/i)
  })
})

describe("a video's screen with the previous and next video", () => {
  const steps = (position: StepperPosition) =>
    createElement(VideoStepper, {
      stepper: {
        previous: { id: 'video-0', title: 'Before', page: 1 },
        next: { id: 'video-2', title: 'After', page: 1 },
      },
      position,
      listRoute: defaultRoute,
      navigate: noop,
      onStep: noop,
      onRetry: noop,
      onGone: noop,
    })
  const none = () => null
  const listRow: VideoRow = {
    id: detailAnswer.video.id,
    title: 'A video from the list',
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: 270,
    publishedAt: '2026-09-01T16:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews: 1,
    views: 2,
    averageViewPercentage: 40,
    subscribersGained: 0,
    estimatedMinutesWatched: 3,
    awaitingProcessing: false,
  }
  const screenOf = (
    answer: VideoDetailAnswer | null,
    headRow: VideoRow | null,
    stepper: (position: StepperPosition) => ReactNode,
  ) =>
    markupOf(
      createElement(VideoDetailScreen, {
        video: detailAnswer.video.id,
        answer,
        headRow,
        stepper,
        title: createRef<HTMLHeadingElement>(),
        route: defaultRoute,
        navigate: noop,
        onGiveRevenueConsent: noop,
      }),
    )
  const stepperCount = (markup: string) => markup.split('<nav class="video-stepper"').length - 1

  test('shows the links in the head and again after the last section', () => {
    const markup = screenOf(detailAnswer, null, steps)
    const head = markup.indexOf('<div class="video-detail-head">')
    const steppers = [...markup.matchAll(/<nav class="video-stepper"/g)].map(({ index }) => index)
    const lastSection = markup.lastIndexOf('<h2')

    expect(steppers).toHaveLength(2)
    expect(steppers[0]).toBeGreaterThan(head)
    expect(steppers[0]).toBeLessThan(markup.indexOf('<dl class="cards"'))
    expect(steppers[1]).toBeGreaterThan(lastSection)
  })

  test('names the links in the head for the top of the page and those after the last section for its bottom', () => {
    const names = [
      ...screenOf(detailAnswer, null, steps).matchAll(
        /<nav class="video-stepper" aria-label="([^"]*)"/g,
      ),
    ].map(([, name]) => name)

    expect(names).toEqual(['Videos, top of page', 'Videos, bottom of page'])
  })

  test("while the video's detail is read, heads itself from its list row with the links, and holds the rest with the placeholders", () => {
    const markup = screenOf(null, listRow, steps)

    expect(markup).toContain('<h1 tabindex="-1">A video from the list</h1>')
    expect(markup).toContain('Watch on YouTube')
    expect(stepperCount(markup)).toBe(2)
    expect(markup).toContain('<div class="placeholders" aria-busy="true">')
    expect(markup).toContain('placeholder-card')
    expect(markup).toContain('placeholder-since-publish-table')
    // The head is the row's, so no placeholder holds its place.
    expect(markup.match(/placeholder-thumbnail/g)).toBeNull()
  })

  test("with no list row read yet, holds the head's place too, with no links", () => {
    const markup = screenOf(null, null, steps)

    expect(markup).not.toContain('<h1')
    expect(markup).toContain('placeholder-thumbnail')
    expect(stepperCount(markup)).toBe(0)
  })

  test('with no stepper, shows no links', () => {
    expect(stepperCount(screenOf(detailAnswer, null, none))).toBe(0)
    expect(stepperCount(screenOf(null, listRow, none))).toBe(0)
  })
})

describe('the Stillstats mark', () => {
  test("draws the favicon's path in the favicon's viewBox (creator-analytics#476)", () => {
    const favicon = readFileSync(new URL('../../site/public/favicon.svg', import.meta.url), 'utf8')
    const mark = renderToStaticMarkup(createElement(StillstatsMark))
    const attribute = (svg: string, name: string) =>
      new RegExp(`\\b${name}="([^"]*)"`).exec(svg)?.[1]
    const pathOf = (svg: string) => /<path\b[^>]*>/.exec(svg)?.[0] ?? ''

    expect(attribute(mark, 'viewBox')).toBe(attribute(favicon, 'viewBox'))
    expect(attribute(pathOf(mark), 'd')).toBe(attribute(pathOf(favicon), 'd'))
    expect(attribute(pathOf(mark), 'transform')).toBe(attribute(pathOf(favicon), 'transform'))
  })
})
