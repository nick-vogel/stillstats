// Limits: these tests cover the share label as a pure function. The rule for a share under 1% is
// approved in creator-analytics#69; the zero cases and the share over 99% follow the assumptions
// recorded for that ticket.
import { describe, expect, test } from 'vitest'
import { numberWithShareOf, percentLabelOf, shareLabelOf } from './share.ts'

describe('the share label', () => {
  test('rounds to a whole percent, in parentheses', () => {
    expect(shareLabelOf(75, 288)).toBe('(26%)')
  })

  test('rounds a half up', () => {
    expect(shareLabelOf(1, 8)).toBe('(13%)')
  })

  test('shows a share above 0 and under 1% as under 1%, never rounded up to 1%', () => {
    expect(shareLabelOf(1, 1000)).toBe('(<1%)')
    expect(shareLabelOf(7, 1000)).toBe('(<1%)')
  })

  test('shows exactly 1% as 1%', () => {
    expect(shareLabelOf(1, 100)).toBe('(1%)')
  })

  test('shows a share above 99% and under the whole as over 99%, never rounded up to 100%', () => {
    expect(shareLabelOf(999, 1000)).toBe('(>99%)')
    expect(shareLabelOf(993, 1000)).toBe('(>99%)')
  })

  test('shows the whole as 100%', () => {
    expect(shareLabelOf(50, 50)).toBe('(100%)')
  })

  test('shows nothing of a whole that has some as 0%', () => {
    expect(shareLabelOf(0, 50)).toBe('(0%)')
  })

  test('shows no share of a whole of nothing', () => {
    expect(shareLabelOf(0, 0)).toBe('')
  })
})

describe('the percent label of a share Google answers', () => {
  test('rounds to a whole percent, with no parentheses', () => {
    expect(percentLabelOf(31.4)).toBe('31%')
    expect(percentLabelOf(12.5)).toBe('13%')
  })

  test('shows a share above 0 and under 1% as under 1%, never rounded up to 1% or down to 0%', () => {
    expect(percentLabelOf(0.3)).toBe('<1%')
    expect(percentLabelOf(0.7)).toBe('<1%')
  })

  test('shows a share above 99% and under 100% as over 99%, never rounded up to 100%', () => {
    expect(percentLabelOf(99.6)).toBe('>99%')
  })

  test('shows 0 as 0%, and 100 as 100%', () => {
    expect(percentLabelOf(0)).toBe('0%')
    expect(percentLabelOf(100)).toBe('100%')
  })
})

describe('a number with its share', () => {
  test('puts the share after the number', () => {
    expect(numberWithShareOf('1,234', '(61%)')).toBe('1,234 (61%)')
  })

  test('with no share, shows the bare number', () => {
    expect(numberWithShareOf('0', '')).toBe('0')
  })
})
