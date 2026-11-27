// @vitest-environment happy-dom
// Pre-PR review 4 of creator-analytics#266, finding 1. Red until the fix lands. A first Disconnect
// of a channel fails after a second one of it succeeded and its channels read answered, but before
// React rendered that answer. The browser-faithful case runs outside `act`, so React schedules the
// render as a Scheduler task, as it does in a browser. The `act` case packs both answers into one
// act scope, which defers the render the same way.

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

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.textContent?.trim() === name,
  )
  if (!button) throw new Error(`No button named ${name}`)
  return button
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

async function microtasks(count: number): Promise<void> {
  for (let tick = 0; tick < count; tick += 1) await Promise.resolve()
}

/** A first Disconnect held, and a second one of the channel succeeded and reading the channels. */
async function secondReadingChannels() {
  const api = installFakeApi()
  rendered = await renderApp('profile')
  const { container } = rendered
  const first = api.hold(disconnectRoute)
  await click(buttonNamed(container, 'Disconnect'))
  const read = api.hold('GET /api/channels')
  await click(buttonNamed(container, 'Disconnect'))
  expect(api.channels).toEqual([])
  expect(container.querySelector('p[role="alert"]')).toBeNull()
  return { container, first, read }
}

describe('review 4 finding 1: a first Disconnect failing before the read list renders', () => {
  test('outside act: the failure lands after the read answers, before React renders', async () => {
    const { container, first, read } = await secondReadingChannels()
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    env.IS_REACT_ACT_ENVIRONMENT = false
    try {
      read.release()
      await microtasks(5)
      first.fail()
      await microtasks(30)
      await new Promise((resolve) => setTimeout(resolve, 50))
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = true
    }
    await settle()

    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })

  test('in one act: the read answers and the first Disconnect fails before the render', async () => {
    const { container, first, read } = await secondReadingChannels()

    await act(async () => {
      read.release()
      first.fail()
    })
    await settle()

    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })
})
