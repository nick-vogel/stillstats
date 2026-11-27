import { describe, expect, test } from 'vitest'
import { tracesSampleRateOf } from './tracing.ts'

describe('the trace sample rate setting', () => {
  test.for([
    ['unset', undefined],
    ['empty', ''],
  ] as const)('%s is 0, so no trace leaves the process', ([, value]) => {
    expect(tracesSampleRateOf({ GLITCHTIP_TRACES_SAMPLE_RATE: value })).toBe(0)
  })

  test.for([
    ['0', 0],
    ['0.1', 0.1],
    ['1', 1],
    ['1.0', 1],
  ] as const)('%s, a number from 0 to 1, is the rate', ([value, rate]) => {
    expect(tracesSampleRateOf({ GLITCHTIP_TRACES_SAMPLE_RATE: value })).toBe(rate)
  })

  test.for(['abc', '-1', '2', '1.5', ' ', '0x1', 'Infinity', 'NaN'])(
    '%j stops the process at start, naming the setting',
    (value) => {
      expect(() => tracesSampleRateOf({ GLITCHTIP_TRACES_SAMPLE_RATE: value })).toThrow(
        'GLITCHTIP_TRACES_SAMPLE_RATE must be a number from 0 to 1',
      )
    },
  )
})
