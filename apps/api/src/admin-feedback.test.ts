import type {
  AdminFeedbackAnswer,
  AdminFeedbackMessage,
  ErrorAnswer,
  FeedbackRequest,
} from '@creator-analytics/api-types'
import { feedbackMessages } from '@creator-analytics/database'
import { readFeedbackMessages, test } from '@creator-analytics/database/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'
import { adminUserIdsOf } from './admin-feedback.ts'

// Emails no other test file signs in with: test files run in parallel against one database.
const nick = { sub: '583001', email: 'admin-feedback-nick@example.com', name: 'Nick' }
const creator = { sub: '583002', email: 'admin-feedback-creator@example.com', name: 'A Creator' }
const otherCreator = { sub: '583003', email: 'admin-feedback-other@example.com', name: 'Another' }

const unknownId = '00000000-0000-4000-8000-000000000000'

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

function send(browser: Browser, message: Partial<FeedbackRequest>) {
  return browser.postJson('/api/feedback', { type: 'idea', screen: 'audience', ...message })
}

function list(browser: Browser, query = '') {
  return browser.fetch(`/api/admin/feedback${query}`).then(answerOf)
}

function setDone(browser: Browser, id: string) {
  return browser.fetch(`/api/admin/feedback/${id}/done`, { method: 'PUT' }).then(answerOf)
}

function clearDone(browser: Browser, id: string) {
  return browser.fetch(`/api/admin/feedback/${id}/done`, { method: 'DELETE' }).then(answerOf)
}

async function listed(browser: Browser, query = ''): Promise<AdminFeedbackAnswer> {
  const { status, body } = await list(browser, query)
  expect(status).toBe(200)
  return body as AdminFeedbackAnswer
}

const notFound = { status: 404, body: { error: 'not_found' } satisfies ErrorAnswer }

/**
 * The API with Nick signed in and on the allowlist, and a creator signed in and not on it. The
 * allowlist is filled after sign-in, since Better Auth makes the user ID then.
 */
async function startWithAdmin(web: Parameters<typeof startApi>[0]) {
  const adminUserIds = new Set<string>()
  const api = await startApi(web, { adminUserIds })
  const admin = await signIn(api, nick)
  adminUserIds.add(await userIdOf(web, nick.email))
  const sender = await signIn(api, creator)
  return { api, admin, sender, adminUserIds }
}

describe('the admin routes of the feedback messages (creator-analytics#583)', () => {
  test("lists every creator's messages newest first, with every field and no account ID", async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const { api, admin, sender } = await startWithAdmin(web)
    const other = await signIn(api, otherCreator)

    await send(sender, { type: 'something_wrong', text: 'The chart is blank', screen: 'settings' })
    clock.advance(60_000)
    await send(other, {
      type: 'other',
      text: 'Hello',
      screen: 'whats_new',
      appVersion: '2026.11.9',
      replyTo: 'reply@example.com',
    })

    expect(await listed(admin)).toEqual({
      messages: [
        {
          id: expect.any(String),
          type: 'other',
          text: 'Hello',
          screen: 'whats_new',
          appVersion: '2026.11.9',
          replyTo: 'reply@example.com',
          createdAt: '2026-11-15T12:01:00.000Z',
          doneAt: null,
        },
        {
          id: expect.any(String),
          type: 'something_wrong',
          text: 'The chart is blank',
          screen: 'settings',
          appVersion: null,
          replyTo: null,
          createdAt: '2026-11-15T12:00:00.000Z',
          doneAt: null,
        },
      ],
      pageCount: 1,
    } satisfies AdminFeedbackAnswer)
  })

  test('51 messages make two pages of 50, the second holding the oldest, and a page past the last holds none', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-01T00:00:00Z'))
    const { admin, sender } = await startWithAdmin(web)
    // Three hours apart, so the daily limit of 10 never refuses one.
    for (let place = 1; place <= 51; place += 1) {
      await send(sender, { text: `Message ${place}` })
      clock.advance(3 * 60 * 60 * 1000)
    }

    const first = await listed(admin)
    const second = await listed(admin, '?page=2')

    expect(first.pageCount).toBe(2)
    expect(first.messages).toHaveLength(50)
    expect(first.messages[0]?.text).toBe('Message 51')
    expect(first.messages[49]?.text).toBe('Message 2')
    expect(second).toEqual({
      messages: [expect.objectContaining({ text: 'Message 1' })],
      pageCount: 2,
    })
    expect(await listed(admin, '?page=3')).toEqual({ messages: [], pageCount: 2 })
  })

  test('with no message, the list holds none on no page', async ({ web }) => {
    const { admin } = await startWithAdmin(web)

    expect(await listed(admin)).toEqual({ messages: [], pageCount: 0 })
  })

  test('the open filter leaves out a message marked "Done"', async ({ web, clock }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const { admin, sender } = await startWithAdmin(web)
    await send(sender, { text: 'Handled' })
    clock.advance(1000)
    await send(sender, { text: 'Open' })
    const handled = (await listed(admin)).messages.find(({ text }) => text === 'Handled')
    if (!handled) throw new Error('The list holds no "Handled" message')

    await setDone(admin, handled.id)

    expect((await listed(admin, '?open=true')).messages.map(({ text }) => text)).toEqual(['Open'])
    expect((await listed(admin, '?open=true')).pageCount).toBe(1)
    expect((await listed(admin)).messages.map(({ text }) => text)).toEqual(['Open', 'Handled'])
  })

  test('"Done" set answers the time it was set, a second set keeps it, and a clear answers none, each read back through the list', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const { admin, sender } = await startWithAdmin(web)
    await send(sender, { text: 'Sort by likes' })
    const [message] = (await listed(admin)).messages
    if (!message) throw new Error('The list holds no message')
    const doneAt = (expected: string | null) => ({ ...message, doneAt: expected })

    clock.set(new Date('2026-11-15T13:00:00Z'))
    expect(await setDone(admin, message.id)).toEqual({
      status: 200,
      body: doneAt('2026-11-15T13:00:00.000Z') satisfies AdminFeedbackMessage,
    })
    expect((await listed(admin)).messages).toEqual([doneAt('2026-11-15T13:00:00.000Z')])

    clock.set(new Date('2026-11-15T14:00:00Z'))
    expect(await setDone(admin, message.id)).toEqual({
      status: 200,
      body: doneAt('2026-11-15T13:00:00.000Z'),
    })

    expect(await clearDone(admin, message.id)).toEqual({ status: 200, body: doneAt(null) })
    expect((await listed(admin)).messages).toEqual([doneAt(null)])
  })

  test.for([
    ['unknown', unknownId],
    ['malformed', 'not-a-uuid'],
  ] as const)('a set and a clear of an %s ID answer 404', async ([, id], { web }) => {
    const { admin } = await startWithAdmin(web)

    expect(await setDone(admin, id)).toEqual(notFound)
    expect(await clearDone(admin, id)).toEqual(notFound)
  })

  test.for(['?page=0', '?page=-1', '?page=1.5', '?page=two', '?page=', '?open=false', '?open=1'])(
    'a list asked with %s answers 400 invalid_query',
    async (query, { web }) => {
      const { admin } = await startWithAdmin(web)

      expect(await list(admin, query)).toEqual({
        status: 400,
        body: { error: 'invalid_query' } satisfies ErrorAnswer,
      })
    },
  )

  test('a signed-in non-admin, a signed-out visitor, and the admin with an empty allowlist each get 404 from every admin route, and nothing changes', async ({
    web,
    transaction,
  }) => {
    const { api, admin, sender, adminUserIds } = await startWithAdmin(web)
    await send(sender, { text: 'Sort by likes' })
    const [message] = (await listed(admin)).messages
    if (!message) throw new Error('The list holds no message')
    const answersOf = async (browser: Browser | null) => {
      const fetchAs = (path: string, method = 'GET') =>
        browser
          ? browser.fetch(path, { method }).then(answerOf)
          : fetch(`${api.origin}${path}`, { method, headers: { origin: api.origin } }).then(
              answerOf,
            )
      return [
        await fetchAs('/api/admin/feedback'),
        await fetchAs(`/api/admin/feedback/${message.id}/done`, 'PUT'),
        await fetchAs(`/api/admin/feedback/${message.id}/done`, 'DELETE'),
      ]
    }
    const everyRouteNotFound = [notFound, notFound, notFound]

    expect(await answersOf(sender)).toEqual(everyRouteNotFound)
    expect(await answersOf(null)).toEqual(everyRouteNotFound)
    adminUserIds.clear()
    expect(await answersOf(admin)).toEqual(everyRouteNotFound)

    expect(await readFeedbackMessages(transaction)).toMatchObject([{ doneAt: null }])
  })

  test('an unknown path under /api/admin/ answers the admin 404, as it answers anyone else', async ({
    web,
  }) => {
    const { admin, sender } = await startWithAdmin(web)

    for (const path of ['/api/admin/', '/api/admin/users', '/api/admin/feedback/extra']) {
      expect(await admin.fetch(path).then(answerOf)).toEqual(notFound)
      expect(await sender.fetch(path).then(answerOf)).toEqual(notFound)
    }
  })

  test('a <script> payload in the text and an <img onerror> payload in the reply address come back byte for byte', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const { admin, sender } = await startWithAdmin(web)
    const script = '<script>alert(1)</script>'
    const image = '<img src=x onerror=alert(1)>@example.com'
    await send(sender, { text: script })
    // The API refuses such an address on a send, so it is stored as an older client might have.
    const userId = await userIdOf(web, creator.email)
    await web.asUser(userId, (scope) =>
      scope.sql.insert(feedbackMessages).values({
        id: '11111111-1111-4111-8111-111111111111',
        userId,
        type: 'other',
        text: image,
        screen: 'video_list',
        replyTo: image,
        createdAt: new Date('2026-11-15T11:00:00Z'),
      }),
    )

    const response = await admin.fetch('/api/admin/feedback')

    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    const { messages } = (await response.json()) as AdminFeedbackAnswer
    expect(messages.map(({ text, replyTo }) => ({ text, replyTo }))).toEqual([
      { text: script, replyTo: null },
      { text: image, replyTo: image },
    ])
  })
})

describe('the admin allowlist setting', () => {
  test.for([
    ['unset', {}, []],
    ['empty', { ADMIN_USER_IDS: '' }, []],
    ['only spaces and commas', { ADMIN_USER_IDS: ' , ,' }, []],
    ['one ID', { ADMIN_USER_IDS: 'id-a' }, ['id-a']],
    ['a list with spaces and an empty item', { ADMIN_USER_IDS: ' id-a, ,id-b ' }, ['id-a', 'id-b']],
  ] as const)('%s, names the users it lists', ([, env, expected]) => {
    expect([...adminUserIdsOf(env)]).toEqual(expected)
  })
})
