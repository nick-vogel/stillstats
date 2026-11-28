// @vitest-environment happy-dom
// Limits: these tests cover the Grants tab's strings and request as values, and render App in
// happy-dom over the fake API (`fake-api.ts`) to drive the tab by its controls, as app.test.ts drives
// the feedback tab. happy-dom evaluates no stylesheet and draws nothing, so no test here shows the
// form's or the list's look, and its date input is a plain text field: no test shows Chrome's date
// picker or that it hands over `YYYY-MM-DD`. Nick checks those at /app/admin/grants. Every expected
// text is written out here, never taken from the module.
import type { AdminGrant } from '@creator-analytics/api-types'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  adminGrantRequestOf,
  allBlocksTextOf,
  endsTextOf,
  removeQuestionOf,
} from './admin-grants.ts'
import { track } from './analytics.ts'
import {
  type FakeApi,
  fakeGrantCreatedAt,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from './fake-api.ts'

vi.mock('./analytics.ts', () => ({ track: vi.fn() }))
vi.mock('./youtube-player.ts', () => import('./fake-youtube-player.ts'))

let rendered: RenderedApp | null = null

async function render(address: string): Promise<RenderedApp> {
  rendered = await renderApp(address)
  return rendered
}

beforeEach(() => {
  vi.stubGlobal('confirm', () => true)
  vi.mocked(track).mockClear()
})

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

const scriptPayload = '<script>alert(1)</script>@example.com'

/** Two grants, newest first: one with an end to a user who also pays, one with no end. */
function grants(): AdminGrant[] {
  return [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'paying@example.com',
      blocks: 2,
      endsAt: '2026-12-01T00:00:00.000Z',
      createdAt: '2026-11-20T10:00:00.000Z',
      paidBlocks: 1,
      grantedBlocks: 2,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'friend@example.com',
      blocks: 1,
      endsAt: null,
      createdAt: '2026-11-19T10:00:00.000Z',
      paidBlocks: 0,
      grantedBlocks: 1,
    },
  ]
}

/** The fake API with the creator on the allowlist, the grants above, and the users they go to. */
function adminApi(): FakeApi {
  const api = installFakeApi()
  api.adminGrants = grants()
  api.adminGrantUsers = {
    'paying@example.com': 1,
    'friend@example.com': 0,
    'new@example.com': 3,
  }
  return api
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

/** Types `text` as a browser does: the native value setter React's tracking reads, then input. */
async function typeInto(field: HTMLInputElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field) as object,
    'value',
  )?.set
  await act(async () => {
    setter?.call(field, text)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}

function fieldLabelled(container: HTMLElement, text: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((each) => each.textContent === text)
  const field = label && container.ownerDocument.getElementById(label.htmlFor)
  if (!(field instanceof HTMLInputElement)) throw new Error(`No field labelled ${text}`)
  return field
}

function buttonsNamed(container: HTMLElement, name: string): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((each) => each.textContent === name)
}

function buttonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const [button] = buttonsNamed(container, name)
  if (!button) throw new Error(`No button named ${name}`)
  return button
}

function tabNamed(container: HTMLElement, name: string): HTMLAnchorElement {
  const tab = [...container.querySelectorAll<HTMLAnchorElement>('nav a')].find(
    (each) => each.textContent === name,
  )
  if (!tab) throw new Error(`No tab named ${name}`)
  return tab
}

function headingIn(container: HTMLElement): string | null {
  return container.querySelector('h1')?.textContent ?? null
}

function alertsIn(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('.admin-grants [role="alert"]')].map(
    (each) => each.textContent,
  )
}

/** Each grant on the tab as its fields' labels and texts. */
function grantsIn(container: HTMLElement): [string | null, string | null | undefined][][] {
  return [...container.querySelectorAll('.admin-grants article')].map((article) =>
    [...article.querySelectorAll('dt')].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
  )
}

function grantRequestsOf(api: FakeApi): { method: string; path: string; body: unknown }[] {
  return api.requests
    .filter(({ method, path }) => method !== 'GET' && path.startsWith('/api/admin/grants'))
    .map(({ method, path, body }) => ({ method, path, body }))
}

async function fillGrant(
  container: HTMLElement,
  { email, blocks, endsOn }: { email: string; blocks: string; endsOn: string },
): Promise<void> {
  await typeInto(fieldLabelled(container, 'Email'), email)
  await typeInto(fieldLabelled(container, 'Blocks'), blocks)
  await typeInto(fieldLabelled(container, 'End date (optional)'), endsOn)
}

describe("the Grants tab's words (stillstats#24)", () => {
  test("a grant's blocks read as the user's granted blocks beside their paid ones", () => {
    expect(allBlocksTextOf(grants()[0] as AdminGrant)).toBe('2 granted, 1 paid')
    expect(allBlocksTextOf(grants()[1] as AdminGrant)).toBe('1 granted, 0 paid')
  })

  test('the end reads as its day in the locale, as Settings writes its dates, or says there is none', () => {
    expect(endsTextOf('2026-12-01T00:00:00.000Z', 'en-GB')).toBe('1 December 2026')
    expect(endsTextOf('2026-12-01T00:00:00.000Z', 'en-US')).toBe('December 1, 2026')
    expect(endsTextOf(null)).toBe('No end')
  })

  test('the question a removal asks names the blocks and the email', () => {
    expect(removeQuestionOf(grants()[0] as AdminGrant)).toBe(
      'Remove the grant of 2 blocks to paying@example.com?',
    )
    expect(removeQuestionOf(grants()[1] as AdminGrant)).toBe(
      'Remove the grant of 1 block to friend@example.com?',
    )
  })

  test('the form sends the email trimmed, the blocks as a number, and the end day or null', () => {
    expect(
      adminGrantRequestOf({ email: ' new@example.com ', blocks: '3', endsOn: '2026-12-01' }),
    ).toStrictEqual({ email: 'new@example.com', blocks: 3, endsOn: '2026-12-01' })
    expect(
      adminGrantRequestOf({ email: 'new@example.com', blocks: '1', endsOn: '' }),
    ).toStrictEqual({ email: 'new@example.com', blocks: 1, endsOn: null })
  })
})

describe('the Grants tab (stillstats#24)', () => {
  test('lists the grants in the order the API answers, each with its email, blocks, the granted blocks beside the paid ones, its end or none, and "Remove"', async () => {
    adminApi()
    const { container } = await render('admin/grants')

    expect(headingIn(container)).toBe('Pro grants')
    expect(grantsIn(container)).toEqual([
      [
        ['Email', 'paying@example.com'],
        ['Blocks', '2'],
        ['All blocks', '2 granted, 1 paid'],
        ['Ends', endsTextOf('2026-12-01T00:00:00.000Z')],
      ],
      [
        ['Email', 'friend@example.com'],
        ['Blocks', '1'],
        ['All blocks', '1 granted, 0 paid'],
        ['Ends', 'No end'],
      ],
    ])
    expect(buttonsNamed(container, 'Remove')).toHaveLength(2)
  })

  test('the form posts the email, blocks and end day, the list redraws from the answer, and the form empties', async () => {
    const api = adminApi()
    const { container } = await render('admin/grants')

    await fillGrant(container, { email: 'new@example.com', blocks: '3', endsOn: '2026-12-01' })
    await click(buttonNamed(container, 'Grant'))

    expect(grantRequestsOf(api)).toEqual([
      {
        method: 'POST',
        path: '/api/admin/grants',
        body: { email: 'new@example.com', blocks: 3, endsOn: '2026-12-01' },
      },
    ])
    expect(grantsIn(container)[0]).toEqual([
      ['Email', 'new@example.com'],
      ['Blocks', '3'],
      ['All blocks', '3 granted, 3 paid'],
      ['Ends', endsTextOf('2026-12-01T00:00:00.000Z')],
    ])
    expect(grantsIn(container)).toHaveLength(3)
    expect(api.adminGrants?.[0]?.createdAt).toBe(fakeGrantCreatedAt)
    expect(fieldLabelled(container, 'Email').value).toBe('')
    expect(fieldLabelled(container, 'Blocks').value).toBe('1')
    expect(fieldLabelled(container, 'End date (optional)').value).toBe('')
    expect(alertsIn(container)).toEqual([])
  })

  test('an empty end date posts a grant with no end', async () => {
    const api = adminApi()
    const { container } = await render('admin/grants')

    await fillGrant(container, { email: 'friend@example.com', blocks: '1', endsOn: '' })
    await click(buttonNamed(container, 'Grant'))

    expect(grantRequestsOf(api).map(({ body }) => body)).toEqual([
      { email: 'friend@example.com', blocks: 1, endsOn: null },
    ])
    expect(grantsIn(container)[0]).toContainEqual(['Ends', 'No end'])
    expect(grantsIn(container)[0]).toContainEqual(['All blocks', '2 granted, 0 paid'])
  })

  test('an email no user holds says so, keeps the form, and adds nothing', async () => {
    const api = adminApi()
    const { container } = await render('admin/grants')

    await fillGrant(container, { email: 'nobody@example.com', blocks: '1', endsOn: '' })
    await click(buttonNamed(container, 'Grant'))

    expect(alertsIn(container)).toEqual(['No user has that email.'])
    expect(grantsIn(container)).toHaveLength(2)
    expect(api.adminGrants).toHaveLength(2)
    expect(fieldLabelled(container, 'Email').value).toBe('nobody@example.com')
  })

  test.for([
    ['blocks of 0', { email: 'new@example.com', blocks: '0', endsOn: '' }],
    ['blocks past 100', { email: 'new@example.com', blocks: '101', endsOn: '' }],
    ['no plausible email', { email: 'new', blocks: '1', endsOn: '' }],
    ['an end day of today', { email: 'new@example.com', blocks: '1', endsOn: '2026-11-27' }],
  ] as const)('a body with %s shows what the grant needs, and adds nothing', async ([, form]) => {
    const api = adminApi()
    const { container } = await render('admin/grants')

    await fillGrant(container, form)
    await click(buttonNamed(container, 'Grant'))

    expect(alertsIn(container)).toEqual([
      'Check the grant: an email, a whole number of blocks from 1 to 100, and an end date after today, or none.',
    ])
    expect(api.adminGrants).toHaveLength(2)
  })

  test.for([
    ['a refusal', 'status'],
    ['a dropped connection', 'network'],
  ] as const)('on %s, a grant alerts that it did not save', async ([, how]) => {
    const api = adminApi()
    const { container } = await render('admin/grants')
    api.failNext('POST /api/admin/grants', how)

    await fillGrant(container, { email: 'new@example.com', blocks: '1', endsOn: '' })
    await click(buttonNamed(container, 'Grant'))

    expect(alertsIn(container)).toEqual(['The grant did not save. Try again.'])
    expect(grantsIn(container)).toHaveLength(2)
  })

  test('"Remove" asks first, sends DELETE, and the list redraws from the answer', async () => {
    const asked: string[] = []
    vi.stubGlobal('confirm', (message: string) => {
      asked.push(message)
      return true
    })
    const api = adminApi()
    const { container } = await render('admin/grants')

    const [first] = buttonsNamed(container, 'Remove')
    if (!first) throw new Error('No "Remove"')
    await click(first)

    expect(asked).toEqual(['Remove the grant of 2 blocks to paying@example.com?'])
    expect(grantRequestsOf(api)).toEqual([
      {
        method: 'DELETE',
        path: '/api/admin/grants/11111111-1111-4111-8111-111111111111',
        body: undefined,
      },
    ])
    expect(grantsIn(container).map((fields) => fields[0])).toEqual([
      ['Email', 'friend@example.com'],
    ])
  })

  test('a cancelled "Remove" deletes nothing', async () => {
    vi.stubGlobal('confirm', () => false)
    const api = adminApi()
    const { container } = await render('admin/grants')

    await click(buttonNamed(container, 'Remove'))

    expect(grantRequestsOf(api)).toEqual([])
    expect(grantsIn(container)).toHaveLength(2)
  })

  test('a failed "Remove" keeps the grant and alerts', async () => {
    const api = adminApi()
    const { container } = await render('admin/grants')
    api.failNext('DELETE /api/admin/grants/11111111-1111-4111-8111-111111111111')

    await click(buttonNamed(container, 'Remove'))

    expect(alertsIn(container)).toEqual(['The grant was not removed. Try again.'])
    expect(grantsIn(container)).toHaveLength(2)
  })

  test('with no grant, says so', async () => {
    const api = adminApi()
    api.adminGrants = []
    const { container } = await render('admin/grants')

    expect(container.querySelector('.admin-grants')?.textContent).toContain('No grants.')
    expect(grantsIn(container)).toEqual([])
  })

  test('a failed read alerts that the grants did not load, and keeps the form', async () => {
    const api = adminApi()
    api.failNext('GET /api/admin/grants')
    api.failNext('GET /api/admin/grants')
    const { container } = await render('admin/grants')

    expect(alertsIn(container)).toEqual(['The grants did not load. Try again.'])
    expect(buttonsNamed(container, 'Grant')).toHaveLength(1)
  })

  test('a <script> payload in an email shows as its literal text, and adds no element', async () => {
    const api = adminApi()
    const [first] = grants()
    if (!first) throw new Error('No grant')
    api.adminGrants = [{ ...first, email: scriptPayload }]
    const { container } = await render('admin/grants')

    expect(grantsIn(container)[0]?.[0]).toEqual(['Email', scriptPayload])
    expect(container.querySelector('.admin-grants')?.querySelectorAll('script')).toHaveLength(0)
  })

  test('a user off the allowlist, whom the API answers 404, sees the not-found page and nothing of the tab', async () => {
    const api = installFakeApi()
    const { container } = await render('admin/grants')

    expect(headingIn(container)).toBe('This page does not exist.')
    expect(container.textContent).not.toContain('Pro grants')
    expect(buttonsNamed(container, 'Grant')).toEqual([])
    expect(api.requests.filter(({ path }) => path === '/api/admin/grants')).toHaveLength(2)
  })

  test('the tab strip moves between feedback and grants, marking the tab on view', async () => {
    const api = adminApi()
    api.adminFeedback = []
    const shown = await render('admin/feedback?window=last90')

    expect(headingIn(shown.container)).toBe('Feedback')
    expect(tabNamed(shown.container, 'Feedback').getAttribute('aria-current')).toBe('page')
    expect(tabNamed(shown.container, 'Grants').getAttribute('aria-current')).toBeNull()

    await click(tabNamed(shown.container, 'Grants'))

    expect(shown.address()).toBe('admin/grants?window=last90')
    expect(headingIn(shown.container)).toBe('Pro grants')
    expect(tabNamed(shown.container, 'Grants').getAttribute('aria-current')).toBe('page')

    await click(tabNamed(shown.container, 'Feedback'))

    expect(shown.address()).toBe('admin/feedback?window=last90')
    expect(headingIn(shown.container)).toBe('Feedback')
  })

  test('a grant and a removal send no product event', async () => {
    adminApi()
    const { container } = await render('admin/grants')
    vi.mocked(track).mockClear()

    await fillGrant(container, { email: 'new@example.com', blocks: '1', endsOn: '' })
    await click(buttonNamed(container, 'Grant'))
    await click(buttonNamed(container, 'Remove'))

    expect(grantsIn(container)).toHaveLength(2)
    expect(vi.mocked(track).mock.calls).toEqual([])
  })
})
