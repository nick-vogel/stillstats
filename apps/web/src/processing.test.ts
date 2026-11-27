import { describe, expect, test } from 'vitest'
import {
  awaitingProcessingFor,
  delayNoteOf,
  longDateOf,
  partialLabelOf,
  rememberAwaitingProcessingOf,
} from './processing.ts'

describe('the data delay note', () => {
  test('names the last processed day', () => {
    expect(delayNoteOf('2026-10-04', 'en-GB')).toBe(
      'YouTube has processed data up to 4 October 2026. New numbers usually take two to three days to appear.',
    )
  })
})

describe('a day in the long date format the screens share', () => {
  test('names the day, the month in words and the year', () => {
    expect(longDateOf('2019-03-12', 'en-GB')).toBe('12 March 2019')
  })
})

describe('the partial label of a video in a window after publish', () => {
  test('names the days Google has processed, of the window', () => {
    expect(partialLabelOf({ partial: { days: 10, of: 28 } })).toBe('10 of 28 days')
  })

  test('a video not yet published has 0 days', () => {
    expect(partialLabelOf({ partial: { days: 0, of: 7 } })).toBe('0 of 7 days')
  })

  test('a one-day window names its day in the singular', () => {
    expect(partialLabelOf({ partial: { days: 0, of: 1 } })).toBe('0 of 1 day')
  })

  test('a complete video has none', () => {
    expect(partialLabelOf({})).toBeNull()
  })
})

describe('what the page remembers of a video Google has not processed', () => {
  test('a video the page knows nothing of is not awaiting processing', () => {
    expect(awaitingProcessingFor('neverSeen1')).toBe(false)
  })

  test('a video an answer said is awaiting processing is', () => {
    rememberAwaitingProcessingOf([{ id: 'awaitingRow1', awaitingProcessing: true }])
    expect(awaitingProcessingFor('awaitingRow1')).toBe(true)
  })

  test('a later answer that says it is processed replaces the earlier one', () => {
    rememberAwaitingProcessingOf([{ id: 'processedRow1', awaitingProcessing: true }])
    rememberAwaitingProcessingOf([{ id: 'processedRow1', awaitingProcessing: false }])
    expect(awaitingProcessingFor('processedRow1')).toBe(false)
  })
})
