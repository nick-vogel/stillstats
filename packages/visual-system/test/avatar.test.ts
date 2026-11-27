import { describe, expect, test } from 'vitest'
import { avatarLetterOf } from '../src/avatar.ts'

describe("the avatar's letter", () => {
  test('is the first letter of a lower-case email, upper case', () => {
    expect(avatarLetterOf('nick@example.com')).toBe('N')
  })

  test('is a whole first character outside the basic plane, not half of it', () => {
    expect(avatarLetterOf('𝒶da@example.com')).toBe('𝒶')
  })
})
