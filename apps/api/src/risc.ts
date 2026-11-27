import {
  googleCallTimeoutMs,
  isTokenIdentifierAlg,
  type RevokedGrant,
} from '@creator-analytics/token-vault'
import { createRemoteJWKSet, errors, jwtVerify } from 'jose'

/** Names the issuer and the signing keys of every Cross-Account Protection (RISC) event. */
export const googleRiscConfigurationUrl =
  'https://accounts.google.com/.well-known/risc-configuration'

const tokensRevoked = 'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked'
const tokenRevoked = 'https://schemas.openid.net/secevent/oauth/event-type/token-revoked'

export type ReadSecurityEvent = { ok: true; revoked: RevokedGrant[] } | { ok: false }

export interface SecurityEventReader {
  /** Verifies a security event token against Google's keys before it reads a claim of it. */
  read(token: string): Promise<ReadSecurityEvent>
}

// The token's own fault, which Google's RISC page answers with 400. Any other failure, such as
// Google's keys out of reach, is the receiver's, and a 500 lets Google deliver the event again.
const refusedToken = [
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JWTClaimValidationFailed,
  errors.JWKSNoMatchingKey,
  // jwtVerify tries no candidate key: a token without a key id against Google's several keys.
  errors.JWKSMultipleMatchingKeys,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function revokedGrantOf(eventType: string, event: unknown): RevokedGrant | undefined {
  const subject = isRecord(event) ? event.subject : undefined
  if (!isRecord(subject)) return undefined
  if (eventType === tokensRevoked && typeof subject.sub === 'string') {
    return { by: 'subject', sub: subject.sub }
  }
  const { token_type, token_identifier_alg, token } = subject
  if (
    eventType === tokenRevoked &&
    token_type === 'refresh_token' &&
    isTokenIdentifierAlg(token_identifier_alg) &&
    typeof token === 'string'
  ) {
    return { by: 'refresh_token', identifierAlg: token_identifier_alg, token }
  }
  return undefined
}

export function createSecurityEventReader({
  configurationUrl,
  clientId,
  callTimeoutMs = googleCallTimeoutMs,
}: {
  configurationUrl: string
  clientId: string
  /** The bound on the configuration fetch, its body included. Unset, `googleCallTimeoutMs`. */
  callTimeoutMs?: number | undefined
}): SecurityEventReader {
  let riscKeys: Promise<{ issuer: string; keys: ReturnType<typeof createRemoteJWKSet> }> | undefined

  function googleRiscKeys() {
    riscKeys ??= (async () => {
      const response = await fetch(configurationUrl, { signal: AbortSignal.timeout(callTimeoutMs) })
      if (!response.ok) throw new Error(`The RISC configuration answered ${response.status}`)
      const { issuer, jwks_uri } = (await response.json()) as { issuer: string; jwks_uri: string }
      return { issuer, keys: createRemoteJWKSet(new URL(jwks_uri)) }
    })()
    riscKeys.catch(() => {
      riscKeys = undefined
    })
    return riscKeys
  }

  return {
    async read(token) {
      const { issuer, keys } = await googleRiscKeys()
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer,
          audience: clientId,
          algorithms: ['RS256'],
          // Google's RISC page: security event tokens "represent historical events and as such,
          // don't expire", so no exp check, and no nbf check either. Refusing an old event would
          // drop a real revocation.
          clockTolerance: Number.MAX_SAFE_INTEGER,
        })
        const events = isRecord(payload.events) ? payload.events : {}
        const revoked = Object.entries(events).flatMap(([eventType, event]) => {
          const grant = revokedGrantOf(eventType, event)
          return grant ? [grant] : []
        })
        return { ok: true, revoked }
      } catch (error) {
        if (refusedToken.some((refused) => error instanceof refused)) return { ok: false }
        throw error
      }
    },
  }
}
