import { describe, expect, test } from 'vitest'
import { refusalMessageOf } from './refusals.ts'

describe('the text a screen shows for a refusal', () => {
  test("a screen's own text for a code wins over the shared one", () => {
    expect(
      refusalMessageOf({ refusal: 'quota_reserved' }, 'the videos', {
        quota_reserved: 'No quota left.',
      }),
    ).toBe('No quota left.')
  })

  test('an expired session reads as a prompt to sign in again', () => {
    expect(refusalMessageOf({ error: 'unauthenticated' }, 'the videos')).toBe(
      'Your session has ended. Sign in again to see your numbers.',
    )
  })

  test('a code with no text names what failed and the code', () => {
    expect(refusalMessageOf({ error: 'internal' }, 'engaged views')).toBe(
      'Reading engaged views failed: internal',
    )
  })
})
