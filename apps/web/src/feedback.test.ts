// Limits: these tests cover the form's rules as pure values. app.test.ts renders the form over the
// fake API, and the browser walk opens it in Chrome.
import { describe, expect, test } from 'vitest'
import {
  charactersLeftOf,
  dailyLimitText,
  type FeedbackForm,
  failedSendText,
  feedbackAlertOf,
  feedbackOpenedEvent,
  feedbackProblemOf,
  feedbackRequestOf,
  feedbackSentEvent,
} from './feedback.ts'

const form: FeedbackForm = {
  type: 'idea',
  text: 'Sort by likes',
  screen: 'audience',
  appVersion: null,
  replyWanted: false,
  replyTo: 'nick@example.com',
}

describe("the feedback form's counter", () => {
  test('shows nothing under 4,500 characters', () => {
    expect(charactersLeftOf('a'.repeat(4499))).toBeNull()
  })

  test('from 4,500 characters, counts down to the limit, past it below zero', () => {
    expect(charactersLeftOf('a'.repeat(4500))).toBe(500)
    expect(charactersLeftOf('a'.repeat(5000))).toBe(0)
    expect(charactersLeftOf('a'.repeat(5002))).toBe(-2)
  })

  test('counts an emoji as one character, and the spaces a send trims as none', () => {
    expect(charactersLeftOf(`  ${'😀'.repeat(4600)}\n`)).toBe(400)
  })
})

describe("the feedback form's check before a send", () => {
  test('a type and a text pass', () => {
    expect(feedbackProblemOf(form)).toBeNull()
  })

  test.each([
    ['no type', { type: null }],
    ['a text of spaces', { text: ' \n ' }],
  ] as const)('%s is incomplete', (_, change) => {
    expect(feedbackProblemOf({ ...form, ...change })).toBe('incomplete')
  })

  test('a text over 5,000 characters is too long', () => {
    expect(feedbackProblemOf({ ...form, text: 'a'.repeat(5001) })).toBe('too_long')
  })

  test('a reply address that is not one fails only while the box is ticked', () => {
    expect(feedbackProblemOf({ ...form, replyTo: 'nick@' })).toBeNull()
    expect(feedbackProblemOf({ ...form, replyWanted: true, replyTo: 'nick@' })).toBe(
      'invalid_address',
    )
  })
})

describe('the body a send posts', () => {
  test('carries no reply address unless the box is ticked', () => {
    expect(feedbackRequestOf({ ...form, type: 'idea' })).toStrictEqual({
      type: 'idea',
      text: 'Sort by likes',
      screen: 'audience',
    })
    expect(feedbackRequestOf({ ...form, type: 'idea', replyWanted: true })).toStrictEqual({
      type: 'idea',
      text: 'Sort by likes',
      screen: 'audience',
      replyTo: 'nick@example.com',
    })
  })

  test('carries the app version when there is one, and no key when there is none', () => {
    expect(feedbackRequestOf({ ...form, type: 'idea', appVersion: '2026.11.15' })).toStrictEqual({
      type: 'idea',
      text: 'Sort by likes',
      screen: 'audience',
      appVersion: '2026.11.15',
    })
    expect(feedbackRequestOf({ ...form, type: 'idea' })).not.toHaveProperty('appVersion')
  })
})

describe("a failed send's alert", () => {
  test('names the daily limit when the API refuses for it, and says the send failed otherwise', () => {
    expect(feedbackAlertOf('rate_limited')).toBe(dailyLimitText)
    expect(feedbackAlertOf('internal')).toBe(failedSendText)
    expect(feedbackAlertOf('network')).toBe(failedSendText)
  })
})

describe("the feedback form's events", () => {
  test('carry no text, no reply address and no account ID: the open nothing, the send its type', () => {
    expect(feedbackOpenedEvent).toStrictEqual({ name: 'feedback_opened' })
    expect(feedbackSentEvent('something_wrong')).toStrictEqual({
      name: 'feedback_sent',
      type: 'something_wrong',
    })
  })
})
