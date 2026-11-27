import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose'
import type { CloudflareAccess } from '../src/cloudflare-access.ts'

const keyId = 'fake-access-1'
const teamIssuer = 'https://a-test-team.cloudflareaccess.com'
const applicationAud = 'a-test-application-aud-tag'

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']

/** What a test changes in a token the fake Access team signs. */
export interface AccessTokenChanges {
  issuer?: string
  audience?: string
  /** Seconds since the epoch. Unset, an hour from now. */
  expiresAt?: number
  /** Signs with a key the team never published, under the team's own key id. */
  foreignKey?: boolean
}

export interface FakeCloudflareAccess {
  /** The API's dependency, with the team's public key as a local key set. */
  access: CloudflareAccess
  /** A token as Cloudflare sends it in `Cf-Access-Jwt-Assertion`, valid unless changed. */
  sign(changes?: AccessTokenChanges): Promise<string>
}

/** A Cloudflare Access team of one RS256 key, and its staging application's AUD tag. */
export async function fakeCloudflareAccess(): Promise<FakeCloudflareAccess> {
  const team = await generateKeyPair('RS256')
  const foreign = await generateKeyPair('RS256')
  const publicJwk: JWK = {
    ...(await exportJWK(team.publicKey)),
    kid: keyId,
    alg: 'RS256',
    use: 'sig',
  }
  const signWith = (key: PrivateKey, changes: AccessTokenChanges) =>
    new SignJWT({ email: 'nick@example.com', type: 'app' })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(changes.issuer ?? teamIssuer)
      .setAudience(changes.audience ?? applicationAud)
      .setSubject('a-test-access-user')
      .setIssuedAt()
      .setExpirationTime(changes.expiresAt ?? Math.floor(Date.now() / 1000) + 3600)
      .sign(key)
  return {
    access: {
      issuer: teamIssuer,
      audience: applicationAud,
      keys: createLocalJWKSet({ keys: [publicJwk] }),
    },
    sign: (changes = {}) =>
      signWith(changes.foreignKey ? foreign.privateKey : team.privateKey, changes),
  }
}
