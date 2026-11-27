import { randomBytes } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { decryptToken, encryptToken, parseTokenKeys, type TokenKeys } from './encryption.ts'

const token = '1//a-refresh-token-from-google'
const channelA = '5d1f5c1e-6c0b-4b8e-9a51-0f6a1a1d3c01'
const channelB = '5d1f5c1e-6c0b-4b8e-9a51-0f6a1a1d3c02'

function keyText(): string {
  return randomBytes(32).toString('base64')
}

describe('token encryption', () => {
  test('a token encrypted for a channel decrypts to the same token', () => {
    const keys = parseTokenKeys(`1:${keyText()}`)

    const sealed = encryptToken(keys, token, channelA)

    expect(decryptToken(keys, sealed, channelA)).toBe(token)
  })

  test('the ciphertext does not hold the token', () => {
    const keys = parseTokenKeys(`1:${keyText()}`)

    const { ciphertext } = encryptToken(keys, token, channelA)

    expect(ciphertext).not.toContain(token)
    expect(Buffer.from(ciphertext, 'base64url').toString('latin1')).not.toContain(token)
  })

  test('a ciphertext copied to another channel does not decrypt', () => {
    const keys = parseTokenKeys(`1:${keyText()}`)

    const sealed = encryptToken(keys, token, channelA)

    expect(() => decryptToken(keys, sealed, channelB)).toThrow()
  })

  test('a token is encrypted under the highest key version', () => {
    const keys = parseTokenKeys(`1:${keyText()},2:${keyText()}`)

    expect(encryptToken(keys, token, channelA).keyVersion).toBe(2)
  })

  test('a token encrypted under an older key still decrypts after a newer key is added', () => {
    const older = keyText()
    const sealed = encryptToken(parseTokenKeys(`1:${older}`), token, channelA)

    const rotated: TokenKeys = parseTokenKeys(`1:${older},2:${keyText()}`)

    expect(decryptToken(rotated, sealed, channelA)).toBe(token)
  })

  test('a key that is not 32 bytes is refused', () => {
    expect(() => parseTokenKeys(`1:${randomBytes(16).toString('base64')}`)).toThrow(
      'Token key 1 is not 32 bytes',
    )
  })
})
