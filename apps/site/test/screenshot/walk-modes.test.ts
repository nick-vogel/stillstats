import { describe, expect, test } from 'vitest'
import { routeStep, walkModes } from './walk-modes.ts'

describe('the modes the browser walk visits every route in', () => {
  test('the first is light mode at the desktop width, under the step name the walk always used', () => {
    const [first] = walkModes
    expect(first).toEqual({ colorScheme: 'light', phone: false })
    expect(routeStep('/app/audience', first)).toBe('route: /app/audience')
  })

  test('the others are dark mode at the desktop width, light at a phone width, and dark at both', () => {
    expect(walkModes.slice(1)).toEqual([
      { colorScheme: 'dark', phone: false },
      { colorScheme: 'light', phone: true },
      { colorScheme: 'dark', phone: true },
    ])
  })

  test('a visit in each other mode names the mode, so a violation says which mode raised it', () => {
    expect(walkModes.map((mode) => routeStep('/releases/2026.11.9', mode))).toEqual([
      'route: /releases/2026.11.9',
      'route: /releases/2026.11.9 in dark mode',
      'route: /releases/2026.11.9 at a phone width',
      'route: /releases/2026.11.9 in dark mode at a phone width',
    ])
  })
})
