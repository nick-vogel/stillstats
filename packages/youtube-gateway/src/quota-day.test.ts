// Limits: this proves the conversion to Pacific Time only. That Google's quota day turns at midnight
// Pacific Time comes from Google's quota calculator page (checked 2026-10-04); the Cloud Console's
// quota graph on the deployed product (#21) is the human check.
import { describe, expect, test } from 'vitest'
import { quotaDayOf } from './youtube-gateway.ts'

describe('the quota day', () => {
  test('turns at midnight Pacific Time, in summer and in winter', () => {
    expect(quotaDayOf(new Date('2026-10-04T06:59:59Z'))).toBe('2026-10-03')
    expect(quotaDayOf(new Date('2026-10-04T07:00:00Z'))).toBe('2026-10-04')
    expect(quotaDayOf(new Date('2026-12-04T07:59:59Z'))).toBe('2026-12-03')
    expect(quotaDayOf(new Date('2026-12-04T08:00:00Z'))).toBe('2026-12-04')
  })
})
