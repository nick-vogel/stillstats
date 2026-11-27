import { describe, expect, test } from 'vitest'
import { cleanFeedbackText, feedbackLengthOf, isReplyAddress } from './feedback.ts'

describe("a feedback message's text, cleaned", () => {
  test.each([
    ['a null', 'a\u0000b'],
    ['a bell', 'a\u0007b'],
    ['an escape', 'a\u001bb'],
    ['a delete', 'a\u007fb'],
    ['a C1 control', 'a\u0085b'],
  ])('loses %s', (_, text) => {
    expect(cleanFeedbackText(text)).toBe('ab')
  })

  test('keeps its line breaks and tabs', () => {
    expect(cleanFeedbackText('one\ntwo\r\nthree\tfour')).toBe('one\ntwo\r\nthree\tfour')
  })

  test('is trimmed after its control characters go, so a text of only those is empty', () => {
    expect(cleanFeedbackText('  \n hello \t ')).toBe('hello')
    expect(cleanFeedbackText('\u0000 \u0007')).toBe('')
  })
})

describe("a feedback message's length", () => {
  test('counts an emoji as one character, as a creator reads it', () => {
    expect(feedbackLengthOf('a😀b')).toBe(3)
  })
})

describe('a reply address', () => {
  test.each(['nick@example.com', 'first.last+tag@mail.example.co.uk', 'a@b'])('%s is one', (text) =>
    expect(isReplyAddress(text)).toBe(true),
  )

  test.each(['', 'nick', 'nick@', '@example.com', 'nick@example..com', 'ni ck@example.com'])(
    '%j is not',
    (text) => expect(isReplyAddress(text)).toBe(false),
  )

  test('is 254 characters at most', () => {
    const domain = `${'d'.repeat(60)}.${'d'.repeat(60)}.${'d'.repeat(60)}.${'d'.repeat(60)}`
    const at254 = `${'a'.repeat(254 - domain.length - 1)}@${domain}`
    expect(at254).toHaveLength(254)
    expect(isReplyAddress(at254)).toBe(true)
    expect(isReplyAddress(`a${at254}`)).toBe(false)
  })
})
