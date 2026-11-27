// Limits: these tests read the headers a build mode answers. The built bundle carrying them is
// test/manifest.test.ts's; Cloudflare Access letting them through on real staging is #581's walk.
import { describe, expect, test } from 'vitest'
import { accessHeadersOf } from './staging-access.ts'

const both = { CF_ACCESS_CLIENT_ID: 'fake-id.access', CF_ACCESS_CLIENT_SECRET: 'fake-secret' }

describe('a production or development build sends no Access headers', () => {
  test.each(['production', 'development'])(
    'the %s build sends none, even with both values set',
    (mode) => {
      expect(accessHeadersOf(mode, both)).toEqual({})
    },
  )
})

describe('a staging build sends the Access service token', () => {
  test('with both values set, it sends both headers', () => {
    expect(accessHeadersOf('staging', both)).toEqual({
      'CF-Access-Client-Id': 'fake-id.access',
      'CF-Access-Client-Secret': 'fake-secret',
    })
  })

  test.each([
    ['neither value', {}],
    ['only the id', { CF_ACCESS_CLIENT_ID: 'fake-id.access' }],
    ['only the secret', { CF_ACCESS_CLIENT_SECRET: 'fake-secret' }],
    ['an empty id', { ...both, CF_ACCESS_CLIENT_ID: '' }],
    ['an empty secret', { ...both, CF_ACCESS_CLIENT_SECRET: '' }],
  ])('with %s, it fails naming both values', (_, env) => {
    expect(() => accessHeadersOf('staging', env)).toThrow(
      /CF_ACCESS_CLIENT_ID.*CF_ACCESS_CLIENT_SECRET/s,
    )
  })
})
