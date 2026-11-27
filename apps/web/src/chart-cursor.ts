/**
 * The bridge between a chart group's selection, the point index its card shows or null with no
 * card, and the TanStack Charts cursor its plots share. Every plot of a group draws its points at
 * the same x values, so one cursor state names the same point on each: the stacked charts' x is a
 * day's index, the audience retention charts' a point's share of the video. Nothing here knows
 * the DOM.
 */
import type { ChartCursorState } from '@tanstack/charts/cursor'

/** The cursor state of a group whose x values are numbers. */
export type IndexCursorState = ChartCursorState<number, number>

/**
 * The app-owned cursor state a key step or a tap writes: anchored on a point's x value, unpinned,
 * and from a source other than the pointer. The library's pointer clears only the state it wrote
 * itself, so this one stays when a finger lifts.
 */
export function cursorStateAt(x: number): IndexCursorState {
  return { anchor: 'value', value: { x }, pinned: false, source: 'programmatic' }
}

/**
 * The index of the point a cursor state names on a chart whose points sit at `xs`, in order, or
 * null: with no state, and for an x that is missing or no point's.
 */
export function selectionOf(state: IndexCursorState | null, xs: readonly number[]): number | null {
  const x = state?.value?.x
  const index = x === undefined ? -1 : xs.indexOf(x)
  return index === -1 ? null : index
}

/**
 * Whether the library's own pointer wrote the state. A pointer moving the card empties the live
 * region, so a key step's values never outlive the card that showed them (creator-analytics#343).
 */
export function fromPointer(state: IndexCursorState | null): boolean {
  return state?.source === 'pointer'
}
