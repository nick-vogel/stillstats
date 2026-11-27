// @vitest-environment happy-dom
// Pre-PR review 6 of creator-analytics#266, finding 1. Green at HEAD: it pins that a dropped
// Disconnect failure shows no success toast, which no test in app.test.ts does. It goes red when
// the dropped path of `disconnect` calls `showSuccess`, the mutant the review ran.

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from '../../../../apps/web/src/fake-api.ts'
import { toastCloseLabel } from '../../../../apps/web/src/preferences.ts'

vi.mock('../../../../apps/web/src/analytics.ts', () => ({ track: vi.fn() }))

let rendered: RenderedApp | null = null
beforeEach(() => vi.stubGlobal('confirm', () => true))
afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

function buttonsNamed(container: HTMLElement, name: string): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].filter(
    (each) => each.textContent?.trim() === name,
  )
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const [button] = buttonsNamed(container, name)
  if (!button) throw new Error(`No button named ${name}`)
  return button
}

function buttonLabelled(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.getAttribute('aria-label') === label,
  )
  if (!button) throw new Error(`No button labelled ${label}`)
  return button
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

const toastText = (container: HTMLElement) =>
  container.querySelector('.toast [role="status"]')?.textContent ?? null

describe('review 6: a dropped Disconnect failure', () => {
  test('finding 1: shows no success toast on a second press of a disconnected channel', async () => {
    const api = installFakeApi()
    rendered = await renderApp('profile')
    const { container } = rendered
    api.failNext('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(api.channels).toEqual([])
    await click(buttonLabelled(container, toastCloseLabel))
    expect(toastText(container)).toBeNull()

    await click(buttonNamed(container, 'Disconnect'))

    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(0)
    expect(toastText(container)).toBeNull()
  })
})
