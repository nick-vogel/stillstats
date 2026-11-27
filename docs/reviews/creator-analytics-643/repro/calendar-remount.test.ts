// @vitest-environment happy-dom
// creator-analytics#643 pre-PR review 1, finding 1. Copy into apps/web/src/ of a scratch worktree
// and run `pnpm exec vitest run apps/web/src/calendar-remount.test.ts`. Red while calendar.tsx
// builds its Root and Chevron components inside the render, green once they are stable.
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { CustomRangeCalendar } from './ControlsBar.tsx'

const bounds = { creationDay: '2020-01-01', lastProcessedDay: '2026-10-13' }
const noop = () => {}

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.replaceChildren()
})

function rendered(fields: { from: string; to: string }) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props = { bounds, error: null, months: 1 as const, onPick: noop, onApply: noop }
  act(() => root.render(createElement(CustomRangeCalendar, { ...props, fields })))
  const rerender = (next: { from: string; to: string }) =>
    act(() => root.render(createElement(CustomRangeCalendar, { ...props, fields: next })))
  return { host, rerender }
}

describe('the custom range Calendar across a re-render', () => {
  test('a pick re-renders the Calendar without replacing its grid', () => {
    const { host, rerender } = rendered({ from: '2026-10-01', to: '2026-10-13' })
    const grid = host.querySelector('[role="grid"]')
    rerender({ from: '2026-10-05', to: '' })
    expect(grid?.isConnected).toBe(true)
  })

  test('the Previous month button keeps focus after a press', () => {
    const { host } = rendered({ from: '2026-10-01', to: '2026-10-13' })
    const previous = host.querySelector<HTMLButtonElement>('button[aria-label="Previous month"]')
    if (!previous) throw new Error('No Previous month button')
    act(() => previous.focus())
    act(() => previous.click())
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Previous month')
  })

  test("the caption's month dropdown keeps focus after a change", () => {
    const { host } = rendered({ from: '2026-10-01', to: '2026-10-13' })
    const month = host.querySelector<HTMLSelectElement>('select[aria-label="Month"]')
    if (!month) throw new Error('No Month dropdown')
    act(() => month.focus())
    act(() => {
      month.value = '5'
      month.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Month')
  })
})
