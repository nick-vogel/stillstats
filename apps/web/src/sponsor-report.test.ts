// @vitest-environment happy-dom
// Limits: these tests render App in happy-dom against the fake API (`fake-api.ts`). happy-dom
// evaluates no stylesheet, lays nothing out and prints nothing, so none shows the report printing
// light on one page, or the shell hidden in print: `web.test.ts` reads the print rules in the built
// CSS, and the one light page is Nick's print preview in Chrome and Safari. `window.print` is
// stubbed, so none opens the browser's print dialog.
import type { SponsorReportAnswer } from '@creator-analytics/api-types'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { track } from './analytics.ts'
import {
  fakeChannel,
  fakeSponsorReport,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from './fake-api.ts'
import { longDateOf, notProcessedText } from './processing.ts'
import {
  nextChoiceOf,
  sponsorChecklistOf,
  sponsorDataThroughOf,
  sponsorExportEventOf,
  sponsorFigureTextOf,
  sponsorPublishedOf,
  sponsorTableOf,
} from './sponsor-report.ts'

vi.mock('./analytics.ts', () => ({ track: vi.fn() }))

let rendered: RenderedApp | null = null

async function render(address: string): Promise<RenderedApp> {
  rendered = await renderApp(address)
  return rendered
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

const reportPath = `/api/channels/${fakeChannel.id}/videos/video-1/sponsor-report`
const choicePath = `/api/channels/${fakeChannel.id}/sponsor-figures`

const nine = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'comments',
  'shares',
  'subscribersGained',
] as const

const nineLabels = [
  'Views',
  'Engaged views',
  'Watch hours',
  'Average view duration',
  'Average view percentage',
  'Likes',
  'Comments',
  'Shares',
  'Subscribers gained',
]

/**
 * `fakeSponsorReport` for a Pro channel: its history from 2026-10-01 to 2026-10-07, which holds
 * every day of the first 7 days, from 2026-10-01, and 7 of the 10 days the first 14 and 30 hold.
 */
const proSponsorReport: SponsorReportAnswer = {
  ...fakeSponsorReport,
  history: { firstDay: '2026-10-01', newestDay: '2026-10-07' },
  windows: fakeSponsorReport.windows.map((window) =>
    window.days === 7
      ? { ...window, numbers: { ...window.numbers, impressions: 12000, ctr: 0.0525 } }
      : { ...window, historyPartial: { days: 7, of: 10 } },
  ),
}

/** The checklist's boxes, each its label, whether it is ticked, and whether it is disabled. */
function checklistOf(report: HTMLElement): [string, boolean, boolean][] {
  const fieldset = report.querySelector('fieldset')
  if (!fieldset) throw new Error('No figure checklist on view')
  return [...fieldset.querySelectorAll('label')].map((label) => {
    const box = label.querySelector('input')
    return [label.textContent?.trim() ?? '', box?.checked ?? false, box?.disabled ?? false]
  })
}

function boxNamed(report: HTMLElement, name: string): HTMLInputElement {
  const label = [...report.querySelectorAll('fieldset label')].find(
    (each) => each.textContent?.trim() === name,
  )
  const box = label?.querySelector('input')
  if (!box) throw new Error(`No box named ${name}`)
  return box
}

function reportOf(container: HTMLElement): HTMLElement {
  const report = container.querySelector<HTMLElement>('.sponsor-report')
  if (!report) throw new Error('No sponsor report on view')
  return report
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (!button) throw new Error(`No button named ${name}`)
  return button
}

function linkNamed(container: HTMLElement, name: string): HTMLAnchorElement {
  const link = [...container.querySelectorAll('a')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (!link) throw new Error(`No link named ${name}`)
  return link
}

/** The table's rows, each its heading cell then its cells, as text. */
function tableOf(report: HTMLElement): string[][] {
  return [...report.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim() ?? ''),
  )
}

beforeEach(() => {
  vi.mocked(track).mockClear()
})

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("a sponsor report's figures, as the page writes them", () => {
  test.each([
    ['views', 1500, '1,500'],
    ['engagedViews', 1200, '1,200'],
    ['estimatedMinutesWatched', 738, '12.3'],
    ['averageViewDuration', 184, '3:04'],
    ['averageViewDuration', 3723, '1:02:03'],
    ['averageViewPercentage', 42.5, '42.5%'],
    ['likes', 1234, '1,234'],
    ['comments', 12, '12'],
    ['shares', 5, '5'],
    ['subscribersGained', 7, '7'],
  ] as const)('%s of %d reads %s', (figure, value, text) => {
    expect(sponsorFigureTextOf(figure, value, 'en-US')).toBe(text)
  })

  test('the table has a heading per window, the partial ones saying how many days they hold, and a row per figure', () => {
    const table = sponsorTableOf(
      {
        ...fakeSponsorReport,
        figures: ['views', 'averageViewPercentage'],
        windows: [
          { days: 7, numbers: { views: 700, averageViewPercentage: 50 } },
          {
            days: 14,
            numbers: { views: 1000, averageViewPercentage: 45 },
            partial: { days: 10, of: 14 },
          },
          {
            days: 30,
            numbers: { views: 1000, averageViewPercentage: 45 },
            partial: { days: 10, of: 30 },
          },
        ],
      },
      'en-US',
    )

    expect(table).toEqual({
      headings: [
        { heading: 'First 7 days', note: null },
        { heading: 'First 14 days', note: '10 of 14 days' },
        { heading: 'First 30 days', note: '10 of 30 days' },
      ],
      rows: [
        { label: 'Views', cells: ['700', '1,000', '1,000'] },
        { label: 'Average view percentage', cells: ['50%', '45%', '45%'] },
      ],
      historyNote: null,
    })
  })

  test('the day the data runs through and the publish date are long dates', () => {
    expect(sponsorDataThroughOf(fakeSponsorReport, 'en-US')).toBe('Data through October 10, 2026')
    expect(sponsorPublishedOf(fakeSponsorReport.video, 'en-US')).toBe('Published October 1, 2026')
    expect(
      sponsorPublishedOf({ publishedAt: '2026-10-20T16:00:00.000Z', scheduled: true }, 'en-US'),
    ).toBe('Scheduled for October 20, 2026')
  })

  test.each([
    // The 30th day, from the Pacific publish day: 11:30pm on 3 March 2024 there, 4 March in UTC.
    ['an older video', '2024-03-04T07:30:00.000Z', 'Data through April 1, 2024'],
    [
      'a video still in its first 30 days',
      '2026-11-01T16:00:00.000Z',
      'Data through November 16, 2026',
    ],
    ['a video with no publish date', null, 'Data through November 16, 2026'],
  ])(
    '%s has its data through the earlier of its 30th day and the last processed day',
    (_, publishedAt, line) => {
      const video = { ...fakeSponsorReport.video, publishedAt }
      expect(sponsorDataThroughOf({ video, lastProcessedDay: '2026-11-16' }, 'en-US')).toBe(line)
    },
  )

  test.each([
    ['impressions', 12000, '12,000'],
    ['ctr', 0.0525, '5.3%'],
    ['ctr', null, 'None'],
  ] as const)('%s of %s reads %s', (figure, value, text) => {
    const window = { days: 7 as const, numbers: { [figure]: value } }
    const table = sponsorTableOf(
      { ...proSponsorReport, figures: [figure], windows: [window] },
      'en-US',
    )
    expect(table.rows).toEqual([{ label: expect.any(String), cells: [text] }])
  })

  test("a window the history does not hold whole reads Not stored for impressions and CTR, and the table's note gives the history's days", () => {
    const table = sponsorTableOf(
      { ...proSponsorReport, figures: ['views', 'impressions', 'ctr'] },
      'en-US',
    )

    expect(table.rows).toEqual([
      { label: 'Views', cells: ['1,500', '2,100', '2,400'] },
      { label: 'Impressions', cells: ['12,000', 'Not stored', 'Not stored'] },
      { label: 'Impressions click-through rate', cells: ['5.3%', 'Not stored', 'Not stored'] },
    ])
    expect(table.historyNote).toBe(
      'Impressions and click-through rate show only in a window the stored history holds every day of. The history runs from October 1, 2026 to October 7, 2026.',
    )
  })

  test('a table with no window the history misses has no history note', () => {
    expect(sponsorTableOf(fakeSponsorReport, 'en-US').historyNote).toBeNull()
    expect(
      sponsorTableOf({ ...proSponsorReport, figures: ['views'] }, 'en-US').historyNote,
    ).toBeNull()
  })

  test('the checklist offers the nine, ticked as the report shows them, and impressions and CTR only with a history', () => {
    expect(sponsorChecklistOf({ ...fakeSponsorReport, figures: ['views', 'likes'] })).toEqual(
      nine.map((figure, i) => ({
        figure,
        label: nineLabels[i],
        checked: figure === 'views' || figure === 'likes',
        disabled: false,
      })),
    )
    expect(sponsorChecklistOf({ ...proSponsorReport, figures: ['impressions'] }).slice(-3)).toEqual(
      [
        {
          figure: 'subscribersGained',
          label: 'Subscribers gained',
          checked: false,
          disabled: false,
        },
        { figure: 'impressions', label: 'Impressions', checked: true, disabled: true },
        { figure: 'ctr', label: 'Impressions click-through rate', checked: false, disabled: false },
      ],
    )
  })

  test('a tick adds its figure in report order, and an untick takes it out', () => {
    expect(nextChoiceOf(['views', 'ctr'], 'impressions', true)).toEqual([
      'views',
      'impressions',
      'ctr',
    ])
    expect(nextChoiceOf(['views', 'likes', 'ctr'], 'likes', false)).toEqual(['views', 'ctr'])
    expect(nextChoiceOf(['views'], 'views', true)).toEqual(['views'])
  })

  test('the export event carries the count of figures and nothing else', () => {
    expect(sponsorExportEventOf(fakeSponsorReport)).toEqual({
      name: 'sponsor_export_downloaded',
      figures: 9,
    })
  })

  test('the publish line names the Pacific day the windows count from, in any time zone', () => {
    const report = {
      ...fakeSponsorReport,
      video: {
        ...fakeSponsorReport.video,
        publishedAt: '2024-03-04T07:30:00.000Z',
        scheduled: false,
      },
      lastProcessedDay: '2024-06-01',
    }

    expect(sponsorDataThroughOf(report, 'en-US')).toBe('Data through April 1, 2024')
    expect(sponsorPublishedOf(report.video, 'en-US')).toBe('Published March 3, 2024')
  })
})

describe("the sponsor report's print page", () => {
  test("shows the channel name, the video's title, thumbnail and publish date, the nine figures over three windows, the partial labels, the day the data runs through and the source line", async () => {
    installFakeApi()

    const { container } = await render('videos/video-1/sponsor-report')

    const report = reportOf(container)
    expect(report.textContent).toContain('Nick Vogel (@nick_vogel)')
    expect(report.querySelector('h1')?.textContent).toBe('A video')
    expect(report.querySelector('.sponsor-report-thumbnail')).not.toBeNull()
    expect(report.textContent).toContain(sponsorPublishedOf(fakeSponsorReport.video))
    expect(tableOf(report)).toEqual([
      ['Figure', 'First 7 days', 'First 14 days10 of 14 days', 'First 30 days10 of 30 days'],
      ['Views', ...[1500, 2100, 2400].map((views) => views.toLocaleString())],
      ...[
        'Engaged views',
        'Watch hours',
        'Average view duration',
        'Average view percentage',
        'Likes',
        'Comments',
        'Shares',
        'Subscribers gained',
      ].map((label) => [label, expect.any(String), expect.any(String), expect.any(String)]),
    ])
    expect(report.textContent).toContain(`Data through ${longDateOf('2026-10-10')}`)
    expect(report.textContent).toContain('Figures from YouTube, through Stillstats.')
  })

  test("an older video's report gives its data through the 30th day, not the channel's last processed day", async () => {
    const api = installFakeApi()
    // Published at 9am Pacific on 3 March 2024, so its 30th day is 1 April 2024.
    api.sponsorReport = {
      ...fakeSponsorReport,
      video: { ...fakeSponsorReport.video, publishedAt: '2024-03-03T17:00:00.000Z' },
      windows: fakeSponsorReport.windows.map(({ days, numbers }) => ({ days, numbers })),
      lastProcessedDay: '2026-11-16',
    } satisfies SponsorReportAnswer

    const { container } = await render('videos/video-1/sponsor-report')

    const report = reportOf(container)
    expect(report.textContent).toContain(`Data through ${longDateOf('2024-04-01')}`)
    expect(report.textContent).not.toContain(longDateOf('2026-11-16'))
  })

  test('reads every figure: the read sends no figures parameter', async () => {
    const api = installFakeApi()

    await render('videos/video-1/sponsor-report')

    const reads = api.requests.filter(({ path }) => path === reportPath)
    expect(reads).toHaveLength(1)
    expect(reads[0]?.query.has('figures')).toBe(false)
  })

  test("the detail screen's Sponsor report link opens the page, and Back to video returns to the detail screen", async () => {
    installFakeApi()
    const { container, address } = await render('videos/video-1?window=first7')

    await click(linkNamed(container, 'Sponsor report'))

    expect(address()).toBe('videos/video-1/sponsor-report?window=first7')
    expect(reportOf(container).querySelector('h1')?.textContent).toBe('A video')

    await click(linkNamed(container, 'Back to video'))

    expect(address()).toBe('videos/video-1?window=first7')
    expect(container.querySelector('.sponsor-report')).toBeNull()
  })

  test('Save as PDF sends sponsor_export_downloaded with the figure count, then opens the print dialog once', async () => {
    installFakeApi()
    // happy-dom has no print dialog, and no window.print.
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const { container } = await render('videos/video-1/sponsor-report')

    await click(buttonNamed(container, 'Save as PDF'))

    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'sponsor_export_downloaded', figures: 9 }],
    ])
    expect(print).toHaveBeenCalledTimes(1)
    expect(vi.mocked(track).mock.invocationCallOrder[0]).toBeLessThan(
      print.mock.invocationCallOrder[0] ?? 0,
    )
  })

  test("a video awaiting processing shows the not processed text in the table's place, and keeps the button", async () => {
    const api = installFakeApi()
    api.sponsorReport = {
      ...fakeSponsorReport,
      awaitingProcessing: true,
      windows: fakeSponsorReport.windows.map(({ days, numbers }) => ({
        days,
        numbers: Object.fromEntries(Object.keys(numbers).map((figure) => [figure, 0])),
        partial: { days: 0, of: days },
      })),
    } satisfies SponsorReportAnswer

    const { container } = await render('videos/video-1/sponsor-report')

    const report = reportOf(container)
    expect(report.querySelector('table')).toBeNull()
    expect(report.textContent).toContain(notProcessedText)
    expect(buttonNamed(container, 'Save as PDF')).toBeDefined()
  })

  test('a refusal shows its text, and no figures', async () => {
    const api = installFakeApi()
    api.failNext(`GET ${reportPath}`, { status: 404, body: { refusal: 'video_not_found' } })

    const { container } = await render('videos/video-1/sponsor-report')

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'This video is not on this channel.',
    )
    expect(container.querySelector('.sponsor-report table')).toBeNull()
  })
})

describe("the sponsor report's figure checklist", () => {
  test('offers the nine, all ticked by default, and no impressions or CTR for a channel with no history', async () => {
    installFakeApi()

    const { container } = await render('videos/video-1/sponsor-report')

    const report = reportOf(container)
    expect(report.querySelector('fieldset legend')?.textContent).toBe('Figures to include')
    expect(checklistOf(report)).toEqual(nineLabels.map((label) => [label, true, false]))
  })

  test('unticking Likes stores the other eight and the table loses its Likes row, and the next report of the channel opens with Likes unticked', async () => {
    const api = installFakeApi()
    const { container } = await render('videos/video-1/sponsor-report')

    await click(boxNamed(reportOf(container), 'Likes'))

    const puts = api.requests.filter(({ method, path }) => method === 'PUT' && path === choicePath)
    expect(puts.map(({ body }) => body)).toEqual([
      { figures: nine.filter((figure) => figure !== 'likes') },
    ])
    const report = reportOf(container)
    expect(tableOf(report).map(([label]) => label)).toEqual([
      'Figure',
      ...nineLabels.filter((label) => label !== 'Likes'),
    ])
    expect(boxNamed(report, 'Likes').checked).toBe(false)
    expect(
      api.requests
        .filter(({ path }) => path === reportPath)
        .at(-1)
        ?.query.has('figures'),
    ).toBe(false)

    rendered?.unmount()
    const again = await render('videos/video-1/sponsor-report')

    expect(boxNamed(reportOf(again.container), 'Likes').checked).toBe(false)
    expect(tableOf(reportOf(again.container)).map(([label]) => label)).not.toContain('Likes')
  })

  test('keeps showing the current report while the next one is read', async () => {
    const api = installFakeApi()
    const { container } = await render('videos/video-1/sponsor-report')
    const held = api.hold(`GET ${reportPath}`)

    await click(boxNamed(reportOf(container), 'Likes'))

    expect(tableOf(reportOf(container)).map(([label]) => label)).toContain('Likes')
    expect(boxNamed(reportOf(container), 'Likes').checked).toBe(false)

    await act(async () => held.release())
    await settle()

    expect(tableOf(reportOf(container)).map(([label]) => label)).not.toContain('Likes')
  })

  test('the last ticked box is disabled, so the choice is never empty', async () => {
    const api = installFakeApi()
    api.sponsorChoice = ['shares']

    const { container } = await render('videos/video-1/sponsor-report')

    expect(checklistOf(reportOf(container)).filter(([, checked]) => checked)).toEqual([
      ['Shares', true, true],
    ])
  })

  test('with a history, Impressions and CTR are offered unticked, and ticking Impressions stores it and shows its row after Subscribers gained', async () => {
    const api = installFakeApi()
    api.sponsorReport = proSponsorReport
    const { container } = await render('videos/video-1/sponsor-report')

    expect(checklistOf(reportOf(container)).slice(-2)).toEqual([
      ['Impressions', false, false],
      ['Impressions click-through rate', false, false],
    ])

    await click(boxNamed(reportOf(container), 'Impressions'))

    expect(api.requests.filter(({ method }) => method === 'PUT').map(({ body }) => body)).toEqual([
      { figures: [...nine, 'impressions'] },
    ])
    expect(tableOf(reportOf(container)).slice(-2)).toEqual([
      ['Subscribers gained', expect.any(String), expect.any(String), expect.any(String)],
      ['Impressions', (12000).toLocaleString(), 'Not stored', 'Not stored'],
    ])
  })

  test("a window the history misses shows Not stored in the history rows, and the note gives the history's days", async () => {
    const api = installFakeApi()
    api.sponsorReport = proSponsorReport
    api.sponsorChoice = ['views', 'impressions', 'ctr']

    const { container } = await render('videos/video-1/sponsor-report')

    const report = reportOf(container)
    expect(
      tableOf(report)
        .slice(-2)
        .map(([label, , , last]) => [label, last]),
    ).toEqual([
      ['Impressions', 'Not stored'],
      ['Impressions click-through rate', 'Not stored'],
    ])
    expect(report.textContent).toContain(
      `The history runs from ${longDateOf('2026-10-01')} to ${longDateOf('2026-10-07')}.`,
    )
  })

  test("Save as PDF's event counts the figures shown, impressions among them", async () => {
    const api = installFakeApi()
    api.sponsorReport = proSponsorReport
    vi.stubGlobal('print', vi.fn())
    const { container } = await render('videos/video-1/sponsor-report')

    await click(boxNamed(reportOf(container), 'Impressions'))
    await click(buttonNamed(container, 'Save as PDF'))

    expect(vi.mocked(track).mock.calls).toEqual([
      [{ name: 'sponsor_export_downloaded', figures: 10 }],
    ])
  })

  test("a refused save shows its text and keeps the last answer's boxes and rows", async () => {
    const api = installFakeApi()
    const { container } = await render('videos/video-1/sponsor-report')
    api.failNext(`PUT ${choicePath}`, { status: 404, body: { refusal: 'not_connected' } })

    await click(boxNamed(reportOf(container), 'Likes'))

    const report = reportOf(container)
    expect(report.querySelector('[role="alert"]')?.textContent).toBe(
      'This channel is not connected. Connect it to see its numbers.',
    )
    expect(boxNamed(report, 'Likes').checked).toBe(true)
    expect(tableOf(report).map(([label]) => label)).toContain('Likes')
    expect(api.sponsorChoice).toBeUndefined()
  })
})
