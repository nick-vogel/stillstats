// Limits: these tests cover the age and gender bars as pure functions over the answer's rows. The
// labels are approved word for word in creator-analytics#268 on 2026-10-19. Which age groups and
// genders Google answers, and their shares, are Nick's browser walk of the Audience screen.
import { describe, expect, test } from 'vitest'
import { ageGroupBarsOf, genderBarsOf } from './viewer-shares.ts'

describe('the age bars', () => {
  test("label each of Google's age groups, in age order", () => {
    const bars = ageGroupBarsOf(
      ['age13-17', 'age18-24', 'age25-34', 'age35-44', 'age45-54', 'age55-64', 'age65-'].map(
        (ageGroup) => ({ ageGroup, viewerPercentage: 10 }),
      ),
    )

    expect(bars.map(({ name }) => name)).toEqual([
      '13 to 17',
      '18 to 24',
      '25 to 34',
      '35 to 44',
      '45 to 54',
      '55 to 64',
      '65 and over',
    ])
  })

  test('come in age order whatever order the answer gives', () => {
    const bars = ageGroupBarsOf([
      { ageGroup: 'age65-', viewerPercentage: 2 },
      { ageGroup: 'age13-17', viewerPercentage: 4 },
      { ageGroup: 'age25-34', viewerPercentage: 40 },
    ])

    expect(bars.map(({ key }) => key)).toEqual(['age13-17', 'age25-34', 'age65-'])
  })

  test("show Google's own share as a whole percent, not re-normalized over the rows answered", () => {
    const bars = ageGroupBarsOf([
      { ageGroup: 'age18-24', viewerPercentage: 31.4 },
      { ageGroup: 'age25-34', viewerPercentage: 20 },
    ])

    expect(bars.map(({ share }) => share)).toEqual(['31%', '20%'])
  })

  test('measure each bar against the longest bar shown', () => {
    const bars = ageGroupBarsOf([
      { ageGroup: 'age18-24', viewerPercentage: 40 },
      { ageGroup: 'age25-34', viewerPercentage: 10 },
    ])

    expect(bars.map(({ width }) => width)).toEqual([100, 25])
  })

  test("show an age group with no label under Google's value, after the known ones", () => {
    const bars = ageGroupBarsOf([
      { ageGroup: 'age99-', viewerPercentage: 1 },
      { ageGroup: 'age18-24', viewerPercentage: 31 },
    ])

    expect(bars.map(({ name }) => name)).toEqual(['18 to 24', 'age99-'])
  })

  test('with no rows, draw no bar', () => {
    expect(ageGroupBarsOf([])).toEqual([])
  })
})

describe('the gender bars', () => {
  test("label each of Google's genders, in the order Female, Male, Self-described", () => {
    const bars = genderBarsOf([
      { gender: 'user_specified', viewerPercentage: 0.4 },
      { gender: 'male', viewerPercentage: 81.2 },
      { gender: 'female', viewerPercentage: 18.4 },
    ])

    expect(bars.map(({ name, share }) => [name, share])).toEqual([
      ['Female', '18%'],
      ['Male', '81%'],
      ['Self-described', '<1%'],
    ])
  })

  test("show a gender with no label under Google's value, after the known ones", () => {
    const bars = genderBarsOf([
      { gender: 'unknown', viewerPercentage: 5 },
      { gender: 'male', viewerPercentage: 60 },
    ])

    expect(bars.map(({ name }) => name)).toEqual(['Male', 'unknown'])
  })

  test('with no rows, draw no bar', () => {
    expect(genderBarsOf([])).toEqual([])
  })
})
