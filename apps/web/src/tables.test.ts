import { describe, expect, test } from 'vitest'
import { revenueSourcesToggledEvent } from './tables.ts'

describe('revenue sources button event', () => {
  test.each([
    ['numbers', true, 'shown'],
    ['numbers', false, 'hidden'],
    ['list', true, 'shown'],
    ['list', false, 'hidden'],
  ] as const)(
    'the button above the %s table, showing sources: %s, sends only its table and the state %s',
    (table, shown, state) => {
      expect(revenueSourcesToggledEvent(table, shown)).toStrictEqual({
        name: 'revenue_sources_toggled',
        table,
        state,
      })
    },
  )
})
