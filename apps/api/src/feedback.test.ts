import {
  type ErrorAnswer,
  type FeedbackRequest,
  feedbackScreens,
  feedbackTypes,
} from '@creator-analytics/api-types'
import type { WebDatabase } from '@creator-analytics/database'
import { readFeedbackMessages, test } from '@creator-analytics/database/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { recordingEmailPort } from '../test/fake-cloudflare-email.ts'
import { signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'
import type { EmailSettings } from './notification-email.ts'

// Emails no other test file signs in with: test files run in parallel against one database.
const creator = { sub: '518204', email: 'feedback@example.com', name: 'A Creator' }
const otherCreator = { sub: '618204', email: 'feedback-other@example.com', name: 'Another' }

const message: FeedbackRequest = {
  type: 'idea',
  text: 'Sort by likes, please.',
  screen: 'audience',
}

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

function send(browser: Browser, body: unknown) {
  return browser.postJson('/api/feedback', body).then(answerOf)
}

/** A raw body, for the ones the web app never sends, such as malformed JSON. */
function sendRaw(browser: Browser, body: string) {
  return browser
    .fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    .then(answerOf)
}

const saved = { status: 201, body: null }

describe('seam 1: POST /api/feedback saves a signed-in creator’s message', () => {
  test('a signed-out request is refused', async ({ web }) => {
    const api = await startApi(web)

    const response = await fetch(`${api.origin}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: api.origin },
      body: JSON.stringify(message),
    })

    expect(await answerOf(response)).toEqual({
      status: 401,
      body: { error: 'unauthenticated' } satisfies ErrorAnswer,
    })
  })

  test('a message is saved as the creator’s, at the time sent, with no reply address and no version', async ({
    web,
    transaction,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const browser = await signIn(await startApi(web), creator)

    expect(await send(browser, message)).toEqual(saved)

    expect(await readFeedbackMessages(transaction)).toEqual([
      {
        id: expect.any(String),
        userId: await userIdOf(web, creator.email),
        type: 'idea',
        text: 'Sort by likes, please.',
        screen: 'audience',
        appVersion: null,
        replyTo: null,
        createdAt: new Date('2026-11-15T12:00:00Z'),
        doneAt: null,
      },
    ])
  })

  test('every type and every screen the API types allow is saved', async ({ web, transaction }) => {
    const browser = await signIn(await startApi(web), creator)
    const sent = feedbackScreens.map((screen, place) => ({
      type: feedbackTypes[place % feedbackTypes.length],
      screen,
    }))

    for (const { type, screen } of sent) {
      expect(await send(browser, { type, text: 'Hello', screen })).toEqual(saved)
    }

    const stored = await readFeedbackMessages(transaction)
    expect(stored.map(({ type, screen }) => ({ type, screen }))).toEqual(
      expect.arrayContaining(sent),
    )
    expect(new Set(stored.map(({ type }) => type))).toEqual(new Set(feedbackTypes))
  })

  test('the text loses its control characters and keeps its line breaks and tabs', async ({
    web,
    transaction,
  }) => {
    const browser = await signIn(await startApi(web), creator)

    await send(browser, { ...message, text: '  One\u0000 line\nand\ta\u001b tab\r\n ' })

    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { text: 'One line\nand\ta tab' },
    ])
  })

  test('a text of 5,000 characters is saved, an emoji counted as one', async ({
    web,
    transaction,
  }) => {
    const browser = await signIn(await startApi(web), creator)

    expect(await send(browser, { ...message, text: '😀'.repeat(5000) })).toEqual(saved)
    expect(await readFeedbackMessages(transaction)).toHaveLength(1)
  })

  test('the reply address is saved when the creator sends one', async ({
    web,
    transaction,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const browser = await signIn(await startApi(web), creator)

    await send(browser, { ...message, replyTo: 'reply@example.com' })
    clock.advance(1000)
    await send(browser, { ...message, replyTo: null })

    expect((await readFeedbackMessages(transaction)).map(({ replyTo }) => replyTo)).toEqual([
      'reply@example.com',
      null,
    ])
  })

  test('a valid version is stored as sent, a same-day release included', async ({
    web,
    transaction,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const browser = await signIn(await startApi(web), creator)

    expect(await send(browser, { ...message, appVersion: '2026.11.15' })).toEqual(saved)
    clock.advance(1000)
    expect(await send(browser, { ...message, appVersion: '2026.11.15.2' })).toEqual(saved)

    expect((await readFeedbackMessages(transaction)).map(({ appVersion }) => appVersion)).toEqual([
      '2026.11.15',
      '2026.11.15.2',
    ])
  })

  test('no version, absent or null, stores none', async ({ web, transaction, clock }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const browser = await signIn(await startApi(web), creator)

    expect(await send(browser, message)).toEqual(saved)
    clock.advance(1000)
    expect(await send(browser, { ...message, appVersion: null })).toEqual(saved)

    expect((await readFeedbackMessages(transaction)).map(({ appVersion }) => appVersion)).toEqual([
      null,
      null,
    ])
  })

  test.for([
    ['a body that is not an object', '[]', 'invalid_feedback'],
    ['malformed JSON', '{"type":', 'invalid_feedback'],
    ['no type', JSON.stringify({ text: 'Hello', screen: 'audience' }), 'invalid_feedback_type'],
    ['an unknown type', JSON.stringify({ ...message, type: 'complaint' }), 'invalid_feedback_type'],
    ['no text', JSON.stringify({ type: 'idea', screen: 'audience' }), 'invalid_feedback_text'],
    ['a text of spaces', JSON.stringify({ ...message, text: ' \n\t ' }), 'invalid_feedback_text'],
    [
      'a text of control characters',
      JSON.stringify({ ...message, text: '\u0000\u0007' }),
      'invalid_feedback_text',
    ],
    [
      'a text of 5,001 characters',
      JSON.stringify({ ...message, text: 'a'.repeat(5001) }),
      'invalid_feedback_text',
    ],
    ['no screen', JSON.stringify({ type: 'idea', text: 'Hello' }), 'invalid_feedback_screen'],
    [
      'a path for the screen',
      JSON.stringify({ ...message, screen: '/app/videos/abc' }),
      'invalid_feedback_screen',
    ],
    [
      'a malformed version',
      JSON.stringify({ ...message, appVersion: 'v2026.11.15' }),
      'invalid_app_version',
    ],
    [
      'a version with a leading zero',
      JSON.stringify({ ...message, appVersion: '2026.11.09' }),
      'invalid_app_version',
    ],
    [
      'a version that is no calendar date',
      JSON.stringify({ ...message, appVersion: '2026.2.30' }),
      'invalid_app_version',
    ],
    [
      'an extension version',
      JSON.stringify({ ...message, appVersion: '1.0.0' }),
      'invalid_app_version',
    ],
    [
      'a version that is a number',
      JSON.stringify({ ...message, appVersion: 20261115 }),
      'invalid_app_version',
    ],
    ['an empty version', JSON.stringify({ ...message, appVersion: '' }), 'invalid_app_version'],
    [
      'a reply address that is not one',
      JSON.stringify({ ...message, replyTo: 'nick@' }),
      'invalid_reply_address',
    ],
    [
      'an empty reply address',
      JSON.stringify({ ...message, replyTo: '' }),
      'invalid_reply_address',
    ],
    [
      'a reply address of 255 characters',
      JSON.stringify({ ...message, replyTo: `${'a'.repeat(243)}@example.com` }),
      'invalid_reply_address',
    ],
  ] as const)(
    '%s answers 400 %s and saves nothing',
    async ([, body, error], { web, transaction }) => {
      const browser = await signIn(await startApi(web), creator)

      expect(await sendRaw(browser, body)).toEqual({ status: 400, body: { error } })
      expect(await readFeedbackMessages(transaction)).toEqual([])
    },
  )

  test('the rules run in order: the type, the text, the screen, the version, the reply address', async ({
    web,
  }) => {
    const browser = await signIn(await startApi(web), creator)
    const allWrong = {
      type: 'complaint',
      text: '',
      screen: '/app',
      appVersion: 'v1',
      replyTo: 'nick@',
    }

    expect(await send(browser, allWrong)).toEqual({
      status: 400,
      body: { error: 'invalid_feedback_type' },
    })
    expect(await send(browser, { ...allWrong, type: 'idea' })).toEqual({
      status: 400,
      body: { error: 'invalid_feedback_text' },
    })
    expect(await send(browser, { ...allWrong, type: 'idea', text: 'Hello' })).toEqual({
      status: 400,
      body: { error: 'invalid_feedback_screen' },
    })
    expect(
      await send(browser, { ...allWrong, type: 'idea', text: 'Hello', screen: 'audience' }),
    ).toEqual({ status: 400, body: { error: 'invalid_app_version' } })
    expect(
      await send(browser, {
        ...allWrong,
        type: 'idea',
        text: 'Hello',
        screen: 'audience',
        appVersion: '2026.11.15',
      }),
    ).toEqual({ status: 400, body: { error: 'invalid_reply_address' } })
  })
})

describe('seam 1: the daily limit of feedback messages', () => {
  test('the 11th message in 24 hours answers 429 and saves nothing, and one sent 24 hours and a second after the first is saved', async ({
    web,
    transaction,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const browser = await signIn(await startApi(web), creator)
    expect(await send(browser, message)).toEqual(saved)
    clock.set(new Date('2026-11-16T11:00:00Z'))
    for (let sent = 1; sent < 10; sent += 1) expect(await send(browser, message)).toEqual(saved)

    expect(await send(browser, message)).toEqual({
      status: 429,
      body: { error: 'rate_limited' } satisfies ErrorAnswer,
    })
    expect(await readFeedbackMessages(transaction)).toHaveLength(10)

    clock.set(new Date('2026-11-16T12:00:01Z'))
    expect(await send(browser, message)).toEqual(saved)
    expect(await readFeedbackMessages(transaction)).toHaveLength(11)
  })

  test('the limit answers before the body is checked, and counts only the creator’s own', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    for (let sent = 0; sent < 10; sent += 1) await send(browser, message)

    expect(await sendRaw(browser, '{"type":')).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    })
    expect(await send(await signIn(api, otherCreator), message)).toEqual(saved)
  })
})

describe('seam 1: "Delete me" and the feedback messages', () => {
  test('deleting the account removes its messages and keeps another creator’s', async ({
    web,
    transaction,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    await send(browser, message)
    await send(await signIn(api, otherCreator), message)

    await browser.fetch('/api/me', { method: 'DELETE' })

    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { userId: await userIdOf(web, otherCreator.email) },
    ])
  })
})

const emailSettings: EmailSettings = {
  accountId: 'a-test-account-id',
  apiToken: 'a-test-api-token',
  from: 'feedback@stillstats.com',
  to: 'nick@example.com',
}

/** The API with these email settings, `undefined` for none, and a recording port in Cloudflare's place. */
async function startApiWithEmail(web: WebDatabase, settings: EmailSettings | undefined) {
  const port = recordingEmailPort()
  const api = await startApi(web, { email: { settings, port } })
  return { api, port }
}

describe('seam 2: the notification email after a saved message', () => {
  test('one email per saved message, holding the type, the time and the admin link', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-15T12:34:56Z'))
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)

    expect(await send(browser, message)).toEqual(saved)

    expect(port.sent).toEqual([
      {
        subject: 'Stillstats feedback: An idea',
        text: [
          'A feedback message arrived.',
          '',
          'Type: An idea',
          'Sent: 2026-11-15 12:34 UTC',
          `Read it: ${api.origin}/app/admin/feedback`,
          '',
        ].join('\n'),
      },
    ])
  })

  test.for([
    ['something_wrong', 'Something is wrong'],
    ['idea', 'An idea'],
    ['other', 'Other'],
  ] as const)('the type %s reads as "%s"', async ([type, words], { web }) => {
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)

    await send(browser, { ...message, type })

    expect(port.sent).toMatchObject([
      {
        subject: `Stillstats feedback: ${words}`,
        text: expect.stringContaining(`Type: ${words}\n`),
      },
    ])
  })

  test('the email holds neither the text, nor the reply address, nor the user ID, nor the message ID', async ({
    web,
    transaction,
  }) => {
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)

    await send(browser, { ...message, text: 'A distinctive text', replyTo: 'reply@example.com' })

    const [stored] = await readFeedbackMessages(transaction)
    const email = JSON.stringify(port.sent)
    expect(port.sent).toHaveLength(1)
    for (const held of [
      'A distinctive text',
      'reply@example.com',
      creator.email,
      await userIdOf(web, creator.email),
      stored?.id,
    ]) {
      expect(held).toBeTruthy()
      expect(email).not.toContain(held)
    }
  })

  test('two messages, two emails', async ({ web, clock }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)

    await send(browser, message)
    clock.set(new Date('2026-11-15T13:05:00Z'))
    await send(browser, { ...message, type: 'other' })

    expect(port.sent.map(({ subject, text }) => [subject, text.split('\n')[3]])).toEqual([
      ['Stillstats feedback: An idea', 'Sent: 2026-11-15 12:00 UTC'],
      ['Stillstats feedback: Other', 'Sent: 2026-11-15 13:05 UTC'],
    ])
  })

  test('a failing port still answers 201, keeps the message, and reports once with its ID and no text', async ({
    web,
    transaction,
  }) => {
    const { api, port } = await startApiWithEmail(web, emailSettings)
    port.failWith(new Error('Cloudflare did not send the email: status 503, error codes none'))
    const browser = await signIn(api, creator)

    expect(
      await send(browser, { ...message, text: 'A distinctive text', replyTo: 'reply@example.com' }),
    ).toEqual(saved)

    const stored = await readFeedbackMessages(transaction)
    expect(stored).toHaveLength(1)
    expect(api.reporter.reports).toEqual([
      {
        message: 'The feedback notification did not send',
        context: { feedbackMessageId: stored[0]?.id },
        error: expect.any(Error),
      },
    ])
    const [report] = api.reporter.reports
    const serialized = JSON.stringify({ ...report, error: String(report?.error) })
    for (const held of ['A distinctive text', 'reply@example.com', creator.email]) {
      expect(serialized).not.toContain(held)
    }
  })

  test.for([
    ['a refused body, a 400', '{"type":'],
    ['an unknown type, a 400', JSON.stringify({ ...message, type: 'complaint' })],
  ] as const)('%s sends no email', async ([, body], { web }) => {
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)

    expect((await sendRaw(browser, body)).status).toBe(400)
    expect(port.sent).toEqual([])
  })

  test('the 11th message in 24 hours, a 429, sends no email', async ({ web }) => {
    const { api, port } = await startApiWithEmail(web, emailSettings)
    const browser = await signIn(api, creator)
    for (let sent = 0; sent < 10; sent += 1) await send(browser, message)

    expect((await send(browser, message)).status).toBe(429)
    expect(port.sent).toHaveLength(10)
  })

  test('with no email settings, a saved message answers 201 and nothing is sent', async ({
    web,
    transaction,
  }) => {
    const { api, port } = await startApiWithEmail(web, undefined)
    const browser = await signIn(api, creator)

    expect(await send(browser, message)).toEqual(saved)

    expect(await readFeedbackMessages(transaction)).toHaveLength(1)
    expect(port.sent).toEqual([])
    expect(api.reporter.reports).toEqual([])
  })
})
