// Limits: these tests cover a chart's slider as pure functions: which point a key reaches, the
// slider's accessible name and value text, what its live region reads after a key step and after a
// pointer, a tap or a hide, and when focus leaving a plot hides the card. No test here runs a DOM,
// so none gives the chart focus or hears a screen reader read the slider and its live region; the
// chart tests in app.test.ts drive them in happy-dom, and Nick checks them at /app in a real
// browser.
import { describe, expect, test } from 'vitest'
import {
  announcementAfter,
  blurHidesCard,
  chartLabelOf,
  emptied,
  keyStepOf,
  silence,
  sliderTextOf,
} from './chart-slider.ts'

describe('a key on a chart with focus', () => {
  test('the right arrow steps one point right, the left arrow one point left', () => {
    expect(keyStepOf('ArrowRight', 2, 5)).toEqual({ index: 3 })
    expect(keyStepOf('ArrowLeft', 2, 5)).toEqual({ index: 1 })
  })

  test('the arrows stop at the first and the last point', () => {
    expect(keyStepOf('ArrowLeft', 0, 5)).toEqual({ index: 0 })
    expect(keyStepOf('ArrowRight', 4, 5)).toEqual({ index: 4 })
  })

  test('with no card shown, the right arrow starts at the first point and the left arrow at the last', () => {
    expect(keyStepOf('ArrowRight', null, 5)).toEqual({ index: 0 })
    expect(keyStepOf('ArrowLeft', null, 5)).toEqual({ index: 4 })
  })

  test('Home jumps to the first point and End to the last', () => {
    expect(keyStepOf('Home', 2, 5)).toEqual({ index: 0 })
    expect(keyStepOf('End', 2, 5)).toEqual({ index: 4 })
  })

  test('Escape hides the card', () => {
    expect(keyStepOf('Escape', 2, 5)).toEqual({ index: null })
  })

  test('with no card shown, Escape is left to the page', () => {
    expect(keyStepOf('Escape', null, 5)).toBeUndefined()
  })

  test.each(['ArrowRight', 'ArrowLeft', 'Home', 'End'])(
    'on a chart with no point, %s is left to the page',
    (key) => {
      expect(keyStepOf(key, null, 0)).toBeUndefined()
    },
  )

  test('any other key is left to the page', () => {
    expect(keyStepOf('Tab', 2, 5)).toBeUndefined()
    expect(keyStepOf('ArrowDown', 2, 5)).toBeUndefined()
  })
})

describe("a chart's accessible name", () => {
  test('is its heading, followed by how to read it with the keys', () => {
    expect(chartLabelOf('Views over time')).toBe(
      'Views over time. Use the arrow keys to read each point.',
    )
  })
})

describe("the slider's value text", () => {
  test("is the shown card's title", () => {
    expect(sliderTextOf({ title: 'Sep 30, 2026', values: [] })).toBe('Sep 30, 2026')
  })

  test('with no card shown, says no point is selected rather than leaving the first point read', () => {
    expect(sliderTextOf(null)).toBe('No point selected')
  })
})

describe('what a screen reader hears after a key step', () => {
  const zeroDay = {
    title: 'Sep 3, 2026',
    values: [
      { label: 'Engaged views', value: '0' },
      { label: 'Views', value: '0' },
    ],
  }

  test("is the card's values as one sentence, without the title the slider already reads", () => {
    expect(
      announcementAfter(silence, {
        title: 'Sep 30, 2026',
        values: [
          { label: 'Engaged views', value: '352' },
          { label: 'Views', value: '701' },
        ],
      }).text,
    ).toBe('Engaged views 352, Views 701')
  })

  test('is a new announcement on each of two days whose values read the same', () => {
    const first = announcementAfter(silence, zeroDay)
    const second = announcementAfter(first, zeroDay)
    expect(second.text).toBe('Engaged views 0, Views 0')
    expect(second).not.toEqual(first)
  })

  test("reads a line with no value as its label alone, as the launch chart's day line", () => {
    expect(
      announcementAfter(silence, {
        title: 'A video',
        values: [
          { label: 'Day 12', value: '' },
          { label: 'Engaged views', value: '1,234' },
        ],
      }).text,
    ).toBe('Day 12, Engaged views 1,234')
  })
})

describe('the live region after a pointer, a tap or a hide moves the card', () => {
  test("is empty, with the last key step's count kept", () => {
    expect(emptied({ text: 'Engaged views 352, Views 701', step: 3 })).toEqual({
      text: '',
      step: 3,
    })
  })

  test('is the same announcement when the region is already empty', () => {
    const empty = { text: '', step: 3 }
    expect(emptied(empty)).toBe(empty)
    expect(emptied(silence)).toBe(silence)
  })
})

describe('focus leaving a plot', () => {
  // A tap on a second plot of a stack places the card on every plot before the first plot loses
  // focus, so hiding on that blur would blank the card the tap just placed.
  test('to another plot on the same hover keeps the card', () => {
    expect(blurHidesCard('stack', 'stack')).toBe(false)
  })

  test('to anything that is not a plot on the same hover hides the card', () => {
    expect(blurHidesCard('stack', 'another chart')).toBe(true)
    expect(blurHidesCard('stack', undefined)).toBe(true)
  })
})
