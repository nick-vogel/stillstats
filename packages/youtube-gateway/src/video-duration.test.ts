// Limits: the shapes come from the Data API's videos resource page (checked 2026-10-08), which
// documents `PT#M#S`, `PT#H#M#S` and, at a day or more, `P#DT#H#M#S`. It documents no value for a
// live or upcoming video, so a zero or unreadable duration is taken as no duration.
import { describe, expect, test } from 'vitest'
import { durationSecondsOf } from './video-duration.ts'

describe("a video's duration", () => {
  test('reads minutes and seconds, as in the documented example', () => {
    expect(durationSecondsOf('PT15M33S')).toBe(933)
    expect(durationSecondsOf('PT4M30S')).toBe(270)
  })

  test('reads hours, minutes and seconds', () => {
    expect(durationSecondsOf('PT1H2M3S')).toBe(3723)
  })

  test('reads days at a day or more', () => {
    expect(durationSecondsOf('P1DT2H3M4S')).toBe(93784)
    expect(durationSecondsOf('P1D')).toBe(86400)
  })

  test('reads a duration with parts left out', () => {
    expect(durationSecondsOf('PT45S')).toBe(45)
    expect(durationSecondsOf('PT1H')).toBe(3600)
  })

  test('is no duration at zero', () => {
    expect(durationSecondsOf('P0D')).toBeNull()
    expect(durationSecondsOf('PT0S')).toBeNull()
  })

  test('is no duration when Google gives none or one it cannot read', () => {
    expect(durationSecondsOf(undefined)).toBeNull()
    expect(durationSecondsOf(null)).toBeNull()
    expect(durationSecondsOf('')).toBeNull()
    expect(durationSecondsOf('PT')).toBeNull()
    expect(durationSecondsOf('P')).toBeNull()
    expect(durationSecondsOf('4:30')).toBeNull()
  })
})
