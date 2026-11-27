import type { ChartCursorState } from '@tanstack/charts/cursor'
import { describe, expect, test } from 'vitest'
import { cursorStateAt, fromPointer, selectionOf } from './chart-cursor.ts'

/** The x values of a chart of four points whose x is the index, as the stacked charts' are. */
const indexes = [0, 1, 2, 3]

describe('the cursor state a key step or a tap writes', () => {
  test("anchors on the point's x value, unpinned and not from the pointer", () => {
    const state = cursorStateAt(3)

    expect(state).toMatchObject({ anchor: 'value', value: { x: 3 }, pinned: false })
    expect(fromPointer(state)).toBe(false)
  })

  test('names the point it was written at', () => {
    expect(selectionOf(cursorStateAt(0), indexes)).toBe(0)
    expect(selectionOf(cursorStateAt(3), indexes)).toBe(3)
  })
})

describe('the point a cursor state names', () => {
  const at = (x: number): ChartCursorState<number, number> => ({
    anchor: 'value',
    value: { x },
    pinned: false,
    source: 'pointer',
  })

  test('is none with no state', () => {
    expect(selectionOf(null, indexes)).toBeNull()
  })

  test("is the index of the point at the library pointer's x", () => {
    expect(selectionOf(at(2), indexes)).toBe(2)
  })

  test('is none for an x off the chart, not whole, or not finite', () => {
    expect(selectionOf(at(4), indexes)).toBeNull()
    expect(selectionOf(at(-1), indexes)).toBeNull()
    expect(selectionOf(at(1.5), indexes)).toBeNull()
    expect(selectionOf(at(Number.NaN), indexes)).toBeNull()
    expect(selectionOf(at(Number.POSITIVE_INFINITY), indexes)).toBeNull()
  })

  test('follows unevenly spaced x values, as retention points are, and names no point between them', () => {
    const ratios = [0.01, 0.02, 0.5, 1]

    expect(selectionOf(at(0.5), ratios)).toBe(2)
    expect(selectionOf(at(0.01), ratios)).toBe(0)
    expect(selectionOf(at(0.3), ratios)).toBeNull()
  })

  test('is none on a chart with no point', () => {
    expect(selectionOf(at(0), [])).toBeNull()
  })

  test('is none for a state with no x value', () => {
    expect(
      selectionOf(
        { anchor: 'normalized', normalized: { x: 0.5 }, pinned: false, source: 'pointer' },
        indexes,
      ),
    ).toBeNull()
  })
})

describe('whether the library pointer wrote a state', () => {
  test('holds for a pointer source only', () => {
    const base = { anchor: 'value', value: { x: 1 }, pinned: false } as const

    expect(fromPointer({ ...base, source: 'pointer' })).toBe(true)
    expect(fromPointer({ ...base, source: 'keyboard' })).toBe(false)
    expect(fromPointer({ ...base, source: 'programmatic' })).toBe(false)
    expect(fromPointer(null)).toBe(false)
  })
})
