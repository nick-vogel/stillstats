import { describe, expect, test } from 'vitest'
import { avatarLabelOf, signedInUserOf } from './signed-in.ts'

const user = { email: 'nick@example.com', name: 'Nick' }

function answering(response: Response): () => Promise<Response> {
  return async () => response
}

describe('the signed-in check', () => {
  test('a 200 from /api/me gives the signed-in user', async () => {
    expect(await signedInUserOf(answering(Response.json(user)))).toEqual(
      expect.objectContaining({ email: 'nick@example.com' }),
    )
  })

  test('a 401, or any other status but 200, gives no user, even with a user in the body', async () => {
    for (const status of [401, 500]) {
      expect({
        status,
        user: await signedInUserOf(answering(Response.json(user, { status }))),
      }).toEqual({ status, user: null })
    }
  })

  test('a fetch that rejects gives no user', async () => {
    expect(await signedInUserOf(() => Promise.reject(new TypeError('Failed to fetch')))).toBeNull()
  })

  test('a 200 whose body does not read as a user gives no user', async () => {
    const bodies = [
      new Response('<!doctype html>', { status: 200 }),
      Response.json(null),
      Response.json({ name: 'Nick' }),
      Response.json({ email: 42 }),
    ]

    for (const body of bodies) {
      expect(await signedInUserOf(answering(body))).toBeNull()
    }
  })
})

describe('the avatar', () => {
  test("its accessible name is the approved text with the user's email", () => {
    expect(avatarLabelOf('nick@example.com')).toBe('Open Stillstats, signed in as nick@example.com')
  })
})
