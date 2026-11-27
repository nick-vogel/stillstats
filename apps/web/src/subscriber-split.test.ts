// Limits: these tests cover the subscriber split, as a pure function. No test here draws the SVG,
// so none shows the bar or the layout at 375 pixels wide. Nick checks those at /app in a real
// browser.
import { describe, expect, test } from 'vitest'
import { subscriberSplitOf } from './subscriber-split.ts'

describe('the subscriber split', () => {
  test("shows each side's engaged views with its share of the two sides' engaged views, not views", () => {
    const split = subscriberSplitOf(
      {
        subscribed: { engagedViews: 1234, views: 10 },
        unsubscribed: { engagedViews: 789, views: 5000 },
      },
      'en-US',
    )

    expect(split.figures).toEqual([
      { label: 'Subscribers', text: '1,234 (61%)' },
      { label: 'Non-subscribers', text: '789 (39%)' },
    ])
  })

  test("splits the bar at the subscribers' share of the engaged views, not views", () => {
    const split = subscriberSplitOf({
      subscribed: { engagedViews: 30, views: 1 },
      unsubscribed: { engagedViews: 90, views: 1 },
    })

    expect(split.subscribedWidth).toBe(25)
  })

  test('with no engaged view on either side, shows the bare numbers with no share', () => {
    const split = subscriberSplitOf(
      {
        subscribed: { engagedViews: 0, views: 0 },
        unsubscribed: { engagedViews: 0, views: 3 },
      },
      'en-US',
    )

    expect(split.figures).toEqual([
      { label: 'Subscribers', text: '0' },
      { label: 'Non-subscribers', text: '0' },
    ])
  })

  test('with no engaged view on either side, draws no share for subscribers', () => {
    const split = subscriberSplitOf({
      subscribed: { engagedViews: 0, views: 0 },
      unsubscribed: { engagedViews: 0, views: 3 },
    })

    expect(split.subscribedWidth).toBe(0)
  })
})
