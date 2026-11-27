// @vitest-environment happy-dom
// Pre-PR review 5 of creator-analytics#266, findings 1 and 2. Red until each fix lands.
// Finding 1: a second Disconnect of a channel answers and a first one fails in one microtask
// checkpoint, so the first's catch reads the set before the second adds the channel, and its alert
// is written after the second's clear. Finding 2: a Disconnect succeeds and its channels read fails,
// so the channel stays listed; pressing its Disconnect again does nothing at all.

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fakeChannel,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from '../../../../apps/web/src/fake-api.ts'

vi.mock('../../../../apps/web/src/analytics.ts', () => ({ track: vi.fn() }))

let rendered: RenderedApp | null = null
beforeEach(() => vi.stubGlobal('confirm', () => true))
afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

const disconnectRoute = `POST /api/channels/${fakeChannel.id}/disconnect`

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

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

const alertOf = (container: HTMLElement) =>
  container.querySelector('p[role="alert"]')?.textContent ?? null

describe('review 5: Disconnect retries', () => {
  test('finding 1: a second Disconnect answers and a first one fails in one checkpoint', async () => {
    const api = installFakeApi()
    rendered = await renderApp('profile')
    const { container } = rendered
    const first = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    const second = api.hold(disconnectRoute)
    await click(buttonNamed(container, 'Disconnect'))
    expect(alertOf(container)).toBeNull()

    await act(async () => {
      second.release()
      first.fail()
    })
    await settle()

    expect(api.channels).toEqual([])
    expect(alertOf(container)).toBeNull()
  })

  test('finding 2: a second press of a channel whose list read failed after its Disconnect', async () => {
    const api = installFakeApi()
    rendered = await renderApp('profile')
    const { container } = rendered
    api.failNext('GET /api/channels')
    await click(buttonNamed(container, 'Disconnect'))
    expect(api.channels).toEqual([])
    expect(alertOf(container)).toBe('Error: The API answered 500')

    await click(buttonNamed(container, 'Disconnect'))

    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(0)
  })
})
