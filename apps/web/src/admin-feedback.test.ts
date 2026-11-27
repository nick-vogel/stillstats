// Limits: these tests cover the admin screen's strings, addresses and reads as values, the reads over
// a stubbed `fetch`. app.test.ts renders the screen over the fake API, and the browser walk opens it
// in Chrome. Every expected text is written out here, never taken from the module.
import { type AdminFeedbackMessage, feedbackScreens } from '@creator-analytics/api-types'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  adminFeedbackPathOf,
  doneDescriptionOf,
  readAdminFeedback,
  replyAddressTextOf,
  saveDone,
  screenTextOf,
  sentTextOf,
  typeTextOf,
  versionTextOf,
} from './admin-feedback.ts'

const message: AdminFeedbackMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'idea',
  text: 'Sort by likes',
  screen: 'audience',
  appVersion: '2026.11.9',
  replyTo: 'reply@example.com',
  createdAt: '2026-11-15T12:05:00.000Z',
  doneAt: null,
}

function answering(status: number, body: unknown) {
  const fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the admin screen's words for a message", () => {
  test.each([
    ['something_wrong', 'Something is wrong'],
    ['idea', 'An idea'],
    ['other', 'Other'],
  ] as const)('the type %s reads as the form names it, %o', (type, text) => {
    expect(typeTextOf(type)).toBe(text)
  })

  test('every screen a message can come from reads as a name of its own', () => {
    const names = feedbackScreens.map(screenTextOf)

    for (const name of names) expect(name).toMatch(/\S/)
    expect(new Set(names).size).toBe(feedbackScreens.length)
  })

  test('the time sent reads as a medium date and a short time in the locale', () => {
    expect(sentTextOf('2026-11-15T12:05:00.000Z', 'en-GB', 'UTC')).toBe('15 Nov 2026, 12:05')
    expect(sentTextOf('2026-11-15T12:05:00.000Z', 'en-US', 'America/Los_Angeles')).toBe(
      'Nov 15, 2026, 4:05 AM',
    )
  })

  test('a version and a reply address read as sent, and an absent one says so', () => {
    expect(versionTextOf('2026.11.9')).toBe('2026.11.9')
    expect(versionTextOf(null)).toBe('No version')
    expect(replyAddressTextOf('reply@example.com')).toBe('reply@example.com')
    expect(replyAddressTextOf(null)).toBe('No reply address')
  })

  test('the "Done" control is described by its message\'s type and time sent', () => {
    expect(doneDescriptionOf(message, 'en-GB', 'UTC')).toBe('An idea, 15 Nov 2026, 12:05')
  })
})

describe("the admin screen's reads", () => {
  test.each([
    [1, false, '/api/admin/feedback?page=1'],
    [2, false, '/api/admin/feedback?page=2'],
    [3, true, '/api/admin/feedback?page=3&open=true'],
  ] as const)('page %i, open only %s, is read from %s', (page, open, path) => {
    expect(adminFeedbackPathOf(page, open)).toBe(path)
  })

  test('a list the API answers is the list', async () => {
    const fetch = answering(200, { messages: [message], pageCount: 1 })

    expect(await readAdminFeedback(2, true)).toEqual({
      kind: 'list',
      messages: [message],
      pageCount: 1,
    })
    expect(fetch).toHaveBeenCalledWith('/api/admin/feedback?page=2&open=true')
  })

  test('a 404 is the not-found screen', async () => {
    answering(404, { error: 'not_found' })

    expect(await readAdminFeedback(1, false)).toEqual({ kind: 'not-found' })
  })

  test.each([
    ['a refusal', 500],
    ['a bad query', 400],
  ])('%s alerts that the messages did not load', async (_, status) => {
    answering(status, { error: 'internal' })

    expect(await readAdminFeedback(1, false)).toEqual({
      kind: 'failed',
      alert: 'The messages did not load. Try again.',
    })
  })

  test('a dropped connection alerts that the messages did not load', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await readAdminFeedback(1, false)).toEqual({
      kind: 'failed',
      alert: 'The messages did not load. Try again.',
    })
  })
})

describe('the admin screen\'s save of "Done"', () => {
  test.each([
    [true, 'PUT'],
    [false, 'DELETE'],
  ] as const)(
    'done %s sends %s, and answers the message as it now stands',
    async (done, method) => {
      const saved = { ...message, doneAt: done ? '2026-11-15T13:00:00.000Z' : null }
      const fetch = answering(200, saved)

      expect(await saveDone(message.id, done)).toEqual({ ok: true, message: saved })
      expect(fetch).toHaveBeenCalledWith(`/api/admin/feedback/${message.id}/done`, { method })
    },
  )

  test.each([
    ['a refusal', () => answering(500, { error: 'internal' })],
    ['an unknown message', () => answering(404, { error: 'not_found' })],
    [
      'a dropped connection',
      () =>
        vi.stubGlobal('fetch', async () => {
          throw new TypeError('Failed to fetch')
        }),
    ],
  ])('on %s, alerts that the change did not save', async (_, fail) => {
    fail()

    expect(await saveDone(message.id, true)).toEqual({
      ok: false,
      alert: 'The change did not save. Try again.',
    })
  })
})
