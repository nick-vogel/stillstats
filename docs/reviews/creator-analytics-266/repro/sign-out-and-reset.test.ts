// @vitest-environment happy-dom
// Pre-PR review 1 of creator-analytics#266. Finding 1's test is red until it is fixed. Findings 2,
// 3 and 4's tests are green on the branch: each pins a rule no suite test pins, and goes red under
// the mutation its finding names.

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { dayTypedOf, rangeFieldsOf, windowPickedOf } from '../../../../apps/web/src/controls-bar.ts'
import {
  fakeBounds,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from '../../../../apps/web/src/fake-api.ts'
import { failedSaveNotice } from '../../../../apps/web/src/preferences.ts'
import { defaultRoute } from '../../../../apps/web/src/route.ts'

vi.mock('../../../../apps/web/src/analytics.ts', () => ({ track: vi.fn() }))

let rendered: RenderedApp | null = null
beforeEach(() => vi.stubGlobal('confirm', () => true))
afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

function accountSignOut(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button.account-menu-sign-out')
  if (!button) throw new Error('No "Sign out" in the account menu')
  return button
}

function selectNamed(container: HTMLElement, label: string): HTMLSelectElement {
  const field = [...container.querySelectorAll('label.list-select')].find((each) =>
    each.textContent?.startsWith(label),
  )
  const select = field?.querySelector('select')
  if (!select) throw new Error(`No select named ${label}`)
  return select
}

describe('finding 1: a sign-out that succeeds after a failed one', () => {
  test('shows the signed-out screen with no alert from the failed one', async () => {
    const api = installFakeApi()
    rendered = await renderApp()
    const { container } = rendered

    api.failNext('POST /api/auth/sign-out', 'status')
    await click(accountSignOut(container))
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      'Error: The API answered 500',
    )

    await click(accountSignOut(container))

    expect(container.querySelector('.signed-in-view')).toBeNull()
    expect(container.querySelector('p[role="alert"]')).toBeNull()
  })
})

describe('finding 2: a reset whose DELETE fails before the first preferences read lands', () => {
  test('lets that read fill the screen with the values the server still holds', async () => {
    const api = installFakeApi({ currency: 'EUR' })
    const read = api.hold('GET /api/me/preferences')
    rendered = await renderApp('profile')
    const { container } = rendered

    api.failNext('DELETE /api/me/preferences', 'status')
    const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (each) => each.textContent?.trim() === 'Reset preferences',
    )
    if (!reset) throw new Error('No "Reset preferences"')
    await click(reset)
    await act(async () => read.release())
    await settle()

    expect(api.preferences).toEqual({ currency: 'EUR' })
    expect(selectNamed(container, 'Currency').value).toBe('EUR')
  })
})

describe('finding 3: a cleared custom range field', () => {
  test('stays empty with the bounds known, and is not refilled from the window', () => {
    const { draft: opened } = windowPickedOf(defaultRoute, 'custom', fakeBounds)
    const cleared = dayTypedOf(opened, defaultRoute, fakeBounds, { from: '' })

    expect(rangeFieldsOf(cleared, defaultRoute, fakeBounds).fields?.from).toBe('')
  })
})

describe('finding 4: a failed sign-out', () => {
  test("keeps the session's notice on the signed-in screen", async () => {
    const api = installFakeApi()
    rendered = await renderApp()
    const { container } = rendered
    api.failNext('PUT /api/me/preferences')
    const views = [...container.querySelectorAll('label.list-switch')]
      .find((each) => each.textContent === 'Views')
      ?.querySelector('input')
    if (!views) throw new Error('No Views switch')
    await click(views)
    const toast = () => container.querySelector('.toast [role="status"]')?.textContent ?? null
    expect(toast()).toBe(failedSaveNotice)

    api.failNext('POST /api/auth/sign-out', 'status')
    await click(accountSignOut(container))

    expect(toast()).toBe(failedSaveNotice)
  })
})
