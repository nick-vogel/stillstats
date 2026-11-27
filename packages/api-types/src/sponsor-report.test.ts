import { describe, expect, test } from 'vitest'
import { sponsorChoiceOf, sponsorFiguresOf } from './sponsor-report.ts'

describe("the sponsor report's figures, from the read's query", () => {
  test('no figures asked is all nine, in report order', () => {
    expect(sponsorFiguresOf(undefined)).toEqual({
      figures: [
        'views',
        'engagedViews',
        'estimatedMinutesWatched',
        'averageViewDuration',
        'averageViewPercentage',
        'likes',
        'comments',
        'shares',
        'subscribersGained',
      ],
    })
  })

  test('the figures asked come back in report order, each once', () => {
    expect(sponsorFiguresOf('shares,views,likes,views')).toEqual({
      figures: ['views', 'likes', 'shares'],
    })
  })

  test.each([
    'estimatedRevenue',
    'estimatedAdRevenue',
    'grossRevenue',
    'estimatedRedPartnerRevenue',
    'monetizedPlaybacks',
    'playbackBasedCpm',
    'adImpressions',
    'cpm',
    'rpm',
    'revenue',
  ])('%s is a revenue figure, and refused', (figure) => {
    expect(sponsorFiguresOf(`views,${figure}`)).toEqual({ fault: 'revenue_figure' })
  })

  test('a revenue figure beside an unknown one is still a revenue refusal', () => {
    expect(sponsorFiguresOf('impressionz,rpm')).toEqual({ fault: 'revenue_figure' })
  })

  test('impressions and CTR, from the stored history, come after the nine', () => {
    expect(sponsorFiguresOf('ctr,impressions,subscribersGained,views')).toEqual({
      figures: ['views', 'subscribersGained', 'impressions', 'ctr'],
    })
  })

  test.each(['impressionz', 'Views', 'CTR', 'views,', ',views', ''])(
    '"%s" holds an unknown or empty figure',
    (text) => {
      expect(sponsorFiguresOf(text)).toEqual({ fault: 'invalid_figure' })
    },
  )
})

describe("the sponsor report's stored figure choice, from the PUT's body", () => {
  test('the figures come back in report order, each once', () => {
    expect(sponsorChoiceOf({ figures: ['ctr', 'likes', 'views', 'impressions', 'likes'] })).toEqual(
      { figures: ['views', 'likes', 'impressions', 'ctr'] },
    )
  })

  test('all eleven figures are a choice', () => {
    expect(
      sponsorChoiceOf({
        figures: [
          'ctr',
          'impressions',
          'subscribersGained',
          'shares',
          'comments',
          'likes',
          'averageViewPercentage',
          'averageViewDuration',
          'estimatedMinutesWatched',
          'engagedViews',
          'views',
        ],
      }),
    ).toEqual({
      figures: [
        'views',
        'engagedViews',
        'estimatedMinutesWatched',
        'averageViewDuration',
        'averageViewPercentage',
        'likes',
        'comments',
        'shares',
        'subscribersGained',
        'impressions',
        'ctr',
      ],
    })
  })

  test.each([
    'estimatedRevenue',
    'estimatedAdRevenue',
    'grossRevenue',
    'estimatedRedPartnerRevenue',
    'monetizedPlaybacks',
    'playbackBasedCpm',
    'adImpressions',
    'cpm',
    'rpm',
    'revenue',
  ])('%s is a revenue figure, and refused', (figure) => {
    expect(sponsorChoiceOf({ figures: ['views', figure] })).toEqual({ fault: 'revenue_figure' })
  })

  test('a revenue figure beside an unknown one is still a revenue refusal', () => {
    expect(sponsorChoiceOf({ figures: ['impressionz', 'rpm'] })).toEqual({
      fault: 'revenue_figure',
    })
  })

  test.each([
    ['an empty list', { figures: [] }],
    ['an unknown name', { figures: ['views', 'impressionz'] }],
    ['a name in the wrong case', { figures: ['Views'] }],
    ['a figure that is not a string', { figures: ['views', 7] }],
    ['figures that are not a list', { figures: 'views' }],
    ['an extra key', { figures: ['views'], channel: 'all' }],
    ['no figures key', {}],
    ['null', null],
    ['a list', ['views']],
    ['a string', 'views'],
  ])('%s is refused as an invalid figure', (_name, body) => {
    expect(sponsorChoiceOf(body)).toEqual({ fault: 'invalid_figure' })
  })
})
