import { describe, expect, test } from 'vitest'
import { startFakeCloudflareEmail } from '../test/fake-cloudflare-email.ts'
import { cloudflareEmailPort, type EmailSettings, emailSettingsOf } from './notification-email.ts'

const allFour = {
  CLOUDFLARE_EMAIL_ACCOUNT_ID: 'a-test-account-id',
  CLOUDFLARE_EMAIL_API_TOKEN: 'a-test-api-token',
  FEEDBACK_EMAIL_FROM: 'feedback@stillstats.com',
  FEEDBACK_EMAIL_TO: 'nick@example.com',
} as const

type Setting = keyof typeof allFour
const settings = Object.keys(allFour) as Setting[]

describe('the email settings at start', () => {
  test('none set answers no settings, so nothing is sent', () => {
    expect(emailSettingsOf({})).toBeUndefined()
  })

  test('all four set answers them', () => {
    expect(emailSettingsOf(allFour)).toEqual({
      accountId: 'a-test-account-id',
      apiToken: 'a-test-api-token',
      from: 'feedback@stillstats.com',
      to: 'nick@example.com',
    })
  })

  test.for(settings)('%s alone throws, naming the other three as missing', (only) => {
    const missing = settings.filter((setting) => setting !== only)

    expect(() => emailSettingsOf({ [only]: allFour[only] })).toThrow(
      `Missing: ${missing.join(', ')}`,
    )
  })

  test.for(settings)('%s missing throws, naming it and only it', (left) => {
    const { [left]: _, ...rest } = allFour

    expect(() => emailSettingsOf(rest)).toThrow(
      new Error(
        `Set all four of CLOUDFLARE_EMAIL_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, FEEDBACK_EMAIL_FROM and FEEDBACK_EMAIL_TO, or none. Missing: ${left}`,
      ),
    )
  })

  test('an empty setting counts as missing', () => {
    expect(() => emailSettingsOf({ ...allFour, FEEDBACK_EMAIL_TO: '' })).toThrow(
      'Missing: FEEDBACK_EMAIL_TO',
    )
  })

  test.for(['FEEDBACK_EMAIL_FROM', 'FEEDBACK_EMAIL_TO'] as const)(
    '%s that is not an email address throws, naming the setting',
    (setting) => {
      expect(() => emailSettingsOf({ ...allFour, [setting]: 'nick@' })).toThrow(
        new Error(`${setting} is not an email address`),
      )
    },
  )
})

describe('the Cloudflare Email Service adapter', () => {
  const settings: EmailSettings = {
    accountId: 'a-test-account-id',
    apiToken: 'a-test-api-token',
    from: 'feedback@stillstats.com',
    to: 'nick@example.com',
  }
  const email = { subject: 'A subject', text: 'A line.\nAnother line.' }

  test('posts the email as JSON to the account’s send path with the bearer token', async () => {
    const cloudflare = await startFakeCloudflareEmail()

    await cloudflareEmailPort(settings, { apiRoot: cloudflare.apiRoot }).send(email)

    expect(cloudflare.received).toEqual([
      {
        method: 'POST',
        path: '/client/v4/accounts/a-test-account-id/email/sending/send',
        headers: expect.objectContaining({
          authorization: 'Bearer a-test-api-token',
          'content-type': 'application/json',
        }),
        body: {
          from: { address: 'feedback@stillstats.com', name: 'Stillstats' },
          to: 'nick@example.com',
          subject: 'A subject',
          text: 'A line.\nAnother line.',
        },
      },
    ])
  })

  test('a recipient queued for later counts as sent', async () => {
    const cloudflare = await startFakeCloudflareEmail()
    cloudflare.answerWith(200, {
      success: true,
      errors: [],
      messages: [],
      result: { delivered: [], permanent_bounces: [], queued: ['nick@example.com'] },
    })

    await expect(
      cloudflareEmailPort(settings, { apiRoot: cloudflare.apiRoot }).send(email),
    ).resolves.toBeUndefined()
  })

  test.for([
    [
      'a 4xx',
      400,
      {
        success: false,
        errors: [{ code: 10001, message: 'email.sending.error.invalid_request_schema' }],
        messages: [],
        result: null,
      },
      /status 400.*10001/,
    ],
    ['a 5xx', 503, 'Service Unavailable', /status 503/],
    [
      'a 200 whose success is not true',
      200,
      {
        success: false,
        errors: [{ code: 10002, message: 'email.sending.error.unknown' }],
        messages: [],
        result: null,
      },
      /status 200.*10002/,
    ],
    [
      'a permanent bounce',
      200,
      {
        success: true,
        errors: [],
        messages: [],
        result: { delivered: [], permanent_bounces: ['nick@example.com'], queued: [] },
      },
      /bounced/,
    ],
  ] as const)(
    '%s rejects, naming neither the token nor an address',
    async ([, status, body, named]) => {
      const cloudflare = await startFakeCloudflareEmail()
      cloudflare.answerWith(status, body)

      const error: unknown = await cloudflareEmailPort(settings, { apiRoot: cloudflare.apiRoot })
        .send(email)
        .then(
          () => undefined,
          (rejected: unknown) => rejected,
        )

      expect(error).toBeInstanceOf(Error)
      const { message } = error as Error
      expect(message).toMatch(named)
      for (const secret of [settings.apiToken, settings.from, settings.to, 'email.sending.error']) {
        expect(message).not.toContain(secret)
      }
    },
  )

  test('an answer that never comes rejects once the send times out', async () => {
    const cloudflare = await startFakeCloudflareEmail()
    cloudflare.answerNothing()

    await expect(
      cloudflareEmailPort(settings, {
        apiRoot: cloudflare.apiRoot,
        sendTimeout: () => AbortSignal.timeout(50),
      }).send(email),
    ).rejects.toThrow()
  })
})
