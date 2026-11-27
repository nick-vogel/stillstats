import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface TokenKeys {
  /** The version every new ciphertext is sealed under: the highest one configured. */
  readonly current: number
  readonly byVersion: ReadonlyMap<number, Buffer>
}

export interface SealedToken {
  readonly ciphertext: string
  readonly keyVersion: number
}

const algorithm = 'aes-256-gcm'
const ivBytes = 12
const tagBytes = 16

/**
 * Reads `version:base64key` pairs separated by commas, as `TOKEN_ENCRYPTION_KEYS` holds them. A
 * rotation appends a higher version and keeps the older ones until no row is sealed under them.
 */
export function parseTokenKeys(text: string): TokenKeys {
  const byVersion = new Map<number, Buffer>()
  for (const pair of text.split(',')) {
    const [versionText = '', keyText = ''] = pair.trim().split(':')
    const version = Number(versionText)
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Token key version ${versionText} is not a positive integer`)
    }
    const key = Buffer.from(keyText, 'base64')
    if (key.length !== 32) throw new Error(`Token key ${version} is not 32 bytes`)
    byVersion.set(version, key)
  }
  return { current: Math.max(...byVersion.keys()), byVersion }
}

function keyFor(keys: TokenKeys, version: number): Buffer {
  const key = keys.byVersion.get(version)
  if (!key) throw new Error(`No token key has version ${version}`)
  return key
}

/**
 * The channel id is the additional authenticated data, so a ciphertext copied to another
 * channel's row fails to decrypt.
 */
export function encryptToken(keys: TokenKeys, token: string, channelId: string): SealedToken {
  const iv = randomBytes(ivBytes)
  const cipher = createCipheriv(algorithm, keyFor(keys, keys.current), iv)
  cipher.setAAD(Buffer.from(channelId))
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), encrypted])
  return { ciphertext: sealed.toString('base64url'), keyVersion: keys.current }
}

export function decryptToken(keys: TokenKeys, sealed: SealedToken, channelId: string): string {
  const bytes = Buffer.from(sealed.ciphertext, 'base64url')
  const decipher = createDecipheriv(
    algorithm,
    keyFor(keys, sealed.keyVersion),
    bytes.subarray(0, ivBytes),
  )
  decipher.setAAD(Buffer.from(channelId))
  decipher.setAuthTag(bytes.subarray(ivBytes, ivBytes + tagBytes))
  return Buffer.concat([
    decipher.update(bytes.subarray(ivBytes + tagBytes)),
    decipher.final(),
  ]).toString('utf8')
}
