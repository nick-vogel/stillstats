import { describe, expect, test } from 'vitest'
import { billingSettingsOf } from './billing.ts'

const secretKey = 'sk_test_a1b2c3'
const monthly = 'price_test_monthly'
const annual = 'price_test_annual'
const webhookSecret = 'whsec_test_secret'
const allSet = {
  STRIPE_SECRET_KEY: secretKey,
  STRIPE_PRICE_MONTHLY: monthly,
  STRIPE_PRICE_ANNUAL: annual,
  STRIPE_WEBHOOK_SECRET: webhookSecret,
}
const namesAllThree = /STRIPE_SECRET_KEY.*STRIPE_PRICE_MONTHLY.*STRIPE_PRICE_ANNUAL/

describe('Pro settings', () => {
  test('with none of them set, Pro is not offered', () => {
    expect(billingSettingsOf({})).toBeUndefined()
  })

  test('with the webhook secret alone, as a tip sets it, Pro is not offered', () => {
    expect(billingSettingsOf({ STRIPE_WEBHOOK_SECRET: webhookSecret })).toBeUndefined()
  })

  test.for(['sk_test_a1b2c3', 'rk_live_a1b2c3'])(
    'with all of them set, a key %o included, Pro is offered with them',
    (key) => {
      expect(billingSettingsOf({ ...allSet, STRIPE_SECRET_KEY: key })).toEqual({
        secretKey: key,
        prices: { monthly, annual },
        webhookSecret,
      })
    },
  )

  test.for([
    ['the secret key', 'STRIPE_SECRET_KEY'],
    ['the monthly price', 'STRIPE_PRICE_MONTHLY'],
    ['the annual price', 'STRIPE_PRICE_ANNUAL'],
  ] as const)('the API refuses to start with all but %s set', ([, unset]) => {
    expect(() => billingSettingsOf({ ...allSet, [unset]: undefined })).toThrow(namesAllThree)
  })

  test('the API refuses to start with Pro set and no webhook secret', () => {
    expect(() => billingSettingsOf({ ...allSet, STRIPE_WEBHOOK_SECRET: undefined })).toThrow(
      /STRIPE_WEBHOOK_SECRET/,
    )
  })

  test.for([
    ['STRIPE_PRICE_MONTHLY', 'prod_test_stillstats'],
    ['STRIPE_PRICE_ANNUAL', '7000'],
  ] as const)('the API refuses to start with a %s that is not a price_ ID', ([name, value]) => {
    expect(() => billingSettingsOf({ ...allSet, [name]: value })).toThrow(
      new RegExp(`${name}.*price_`),
    )
  })

  test.for(['pk_test_a1b2c3', 'whsec_test_secret'])(
    'the API refuses to start with a secret key %o, which is no secret or restricted key',
    (key) => {
      expect(() => billingSettingsOf({ ...allSet, STRIPE_SECRET_KEY: key })).toThrow(
        /STRIPE_SECRET_KEY.*sk_.*rk_/,
      )
    },
  )
})
