// @vitest-environment happy-dom
// Pre-PR review 1 of creator-analytics#267. Each test is red until its finding is fixed.

import { act } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  fakeVideo,
  installFakeApi,
  type RenderedApp,
  renderApp,
} from '../../../../apps/web/src/fake-api.ts'

vi.mock('../../../../apps/web/src/analytics.ts', () => ({ track: vi.fn() }))

let rendered: RenderedApp | null = null

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

function rowOf(container: HTMLElement, title: string): HTMLElement {
  const row = [...container.querySelectorAll<HTMLElement>('tr.video-list-row')].find(
    (each) => each.querySelector('a')?.textContent === title,
  )
  if (!row) throw new Error(`No row for ${title}`)
  return row
}

async function pointer(target: Element, type: string, relatedTarget: Element | null = null) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerType: 'mouse', relatedTarget }),
    )
  })
}

async function key(plot: HTMLElement, name: string) {
  await act(async () => {
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

function stateOf(container: HTMLElement, plot: HTMLElement) {
  return {
    marked: [...container.querySelectorAll('tr.video-list-row-marked')].map(
      (row) => row.querySelector('a')?.textContent,
    ),
    valuetext: plot.getAttribute('aria-valuetext'),
    card: container.querySelector('.launch-chart .chart-hover-title')?.textContent ?? null,
  }
}

test('finding 2: a key selection made while the pointer rests on a row survives the pointer leaving that row', async () => {
  const api = installFakeApi()
  api.videos = [
    { ...fakeVideo, id: 'a', title: 'Video A', engagedViewsByDay: [10, 20, 30] },
    { ...fakeVideo, id: 'b', title: 'Video B', engagedViewsByDay: [90, 5, 60] },
  ]
  rendered = await renderApp('?window=first7')
  const { container } = rendered
  const plot = container.querySelector<HTMLElement>('.launch-chart .chart-plot')
  if (!plot) throw new Error('No launch chart plot')

  await pointer(rowOf(container, 'Video B'), 'pointerover')
  await act(async () => plot.focus())
  await key(plot, 'ArrowDown')
  await key(plot, 'ArrowRight')
  const afterKeys = stateOf(container, plot)
  expect(afterKeys).toEqual({ marked: ['Video A'], valuetext: 'Video A', card: 'Day 2' })

  await pointer(rowOf(container, 'Video B'), 'pointerout', document.body)
  expect(stateOf(container, plot)).toEqual(afterKeys)
})
