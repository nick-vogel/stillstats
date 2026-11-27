import { channels, memberships, type Scoped, setting, users } from '@creator-analytics/database'
import type { IdentifiedGrant, ScopeName, TokenVault } from '@creator-analytics/token-vault'
import { eq, sql } from 'drizzle-orm'

export interface HeldChannel {
  id: string
  youtubeChannelId: string
  /** When the creator gave revenue consent for the channel, or null before they do. */
  revenueConsentedAt: string | null
}

/**
 * `channel_held_elsewhere`: another user owns the channel. `channel_disconnecting`: the channel has
 * no owner and waits for its deletion after a disconnect, so a claim can succeed once it is gone.
 */
export type ClaimRefusal = 'channel_held_elsewhere' | 'channel_disconnecting'

/** The user holds no membership to the channel, so it is not theirs to disconnect. */
export type DisconnectRefusal = 'not_connected'

/**
 * `not_connected`: the user holds no membership to the channel. `connection_revoked`: the
 * channel's connection has ended. `channel_mismatch`: the creator picked another channel on
 * Google's screen.
 */
export type RevenueConsentRefusal = 'not_connected' | 'connection_revoked' | 'channel_mismatch'

/** A revenue consent starts only for a channel the user holds with an active connection. */
export type RevenueStartRefusal = Exclude<RevenueConsentRefusal, 'channel_mismatch'>

const revenueScope: ScopeName = 'yt-analytics-monetary.readonly'

export interface Accounts {
  /**
   * Makes the signed-in user the owner of the grant's channel, creating the channel on its first
   * claim, and stores the grant as its connection. A claim of a channel the user already owns
   * replaces its connection. Either way it enqueues the job that gives the channel its reporting job.
   */
  claimChannel(
    tx: Scoped<'user'>,
    grant: IdentifiedGrant,
  ): Promise<
    { ok: true; channelId: string; created: boolean } | { ok: false; refusal: ClaimRefusal }
  >
  channelsOf(tx: Scoped<'user'>): Promise<HeldChannel[]>
  /**
   * Starts the revenue consent for a channel the user holds with an active connection, at Google's
   * account chooser, so the creator can pick the Google account that holds the channel.
   */
  beginRevenueConsent(
    tx: Scoped<'user'>,
    channelId: string,
  ): Promise<{ ok: true; authorizationUrl: string } | { ok: false; refusal: RevenueStartRefusal }>
  /**
   * Adds the revenue grant to the channel's connection, if the user still holds the channel and
   * the grant reads the same channel. A refusal changes nothing.
   */
  giveRevenueConsent(
    tx: Scoped<'user'>,
    channelId: string,
    grant: IdentifiedGrant,
  ): Promise<{ ok: true } | { ok: false; refusal: RevenueConsentRefusal }>
  /**
   * Ends the channel's connection through the token vault, whose deletion request ends the user's
   * membership with it, so the channel leaves the user's list at once and waits for its deletion
   * with no owner.
   */
  disconnectChannel(
    tx: Scoped<'user'>,
    channelId: string,
  ): Promise<{ ok: true; revokedAtGoogle: boolean } | { ok: false; refusal: DisconnectRefusal }>
  /**
   * Disconnects each channel the user holds as a user deletion, then deletes the user, whose
   * sessions, sign-in accounts and consent states go with it. `revokedAtGoogle` is false when
   * Google did not confirm the revoke of one of the channels' grants.
   */
  deleteUser(tx: Scoped<'user'>): Promise<{ endedChannels: string[]; revokedAtGoogle: boolean }>
}

type ClaimOutcome =
  | { outcome: 'created' | 'held'; channelId: string }
  | { outcome: ClaimRefusal; channelId: null }

export function createAccounts({ vault }: { vault: TokenVault }): Accounts {
  /** The channel's YouTube id, if the user holds it with an active connection. */
  async function heldConnected(
    tx: Scoped<'user'>,
    channelId: string,
  ): Promise<{ ok: true; youtubeChannelId: string } | { ok: false; refusal: RevenueStartRefusal }> {
    // The channels policy admits exactly the channels the user holds a membership to.
    const [held] = await tx.sql
      .select({ youtubeChannelId: channels.youtubeChannelId })
      .from(channels)
      .where(eq(channels.id, channelId))
    if (!held) return { ok: false, refusal: 'not_connected' }
    const status = await vault.status(tx, channelId)
    if (!status) return { ok: false, refusal: 'not_connected' }
    if (status.state === 'revoked') return { ok: false, refusal: 'connection_revoked' }
    return { ok: true, youtubeChannelId: held.youtubeChannelId }
  }

  return {
    async claimChannel(tx, grant) {
      const { rows } = await tx.sql.execute<ClaimOutcome>(
        sql`select outcome, channel_id as "channelId" from claim_channel(${grant.youtubeChannelId})`,
      )
      const [claimed] = rows
      if (!claimed) throw new Error('claim_channel returned no row')
      if (claimed.channelId === null) return { ok: false, refusal: claimed.outcome }
      await vault.attach(tx, claimed.channelId, grant)
      // A job, not a Google call here, so a Reporting API outage never fails a connect; the job
      // exists only if the connection commits, and the daily roster retries a failed one.
      await tx.enqueue('ensureReportingJob', { channelId: claimed.channelId })
      return { ok: true, channelId: claimed.channelId, created: claimed.outcome === 'created' }
    },

    async channelsOf(tx) {
      // The channels policy admits exactly the channels the user holds a membership to.
      const held = await tx.sql
        .select({ id: channels.id, youtubeChannelId: channels.youtubeChannelId })
        .from(channels)
        .orderBy(channels.createdAt)
      const withConsent: HeldChannel[] = []
      for (const channel of held) {
        const status = await vault.status(tx, channel.id)
        const revenue = status?.scopes.find((scope) => scope.name === revenueScope)
        withConsent.push({ ...channel, revenueConsentedAt: revenue?.grantedAt ?? null })
      }
      return withConsent
    },

    async beginRevenueConsent(tx, channelId) {
      const held = await heldConnected(tx, channelId)
      if (!held.ok) return held
      const { authorizationUrl } = await vault.beginConsent(
        tx,
        { purpose: 'revenue', channelId },
        'choose',
      )
      return { ok: true, authorizationUrl }
    },

    async giveRevenueConsent(tx, channelId, grant) {
      const held = await heldConnected(tx, channelId)
      if (!held.ok) return held
      if (grant.youtubeChannelId !== held.youtubeChannelId) {
        return { ok: false, refusal: 'channel_mismatch' }
      }
      return vault.addScopes(tx, channelId, grant)
    },

    async disconnectChannel(tx, channelId) {
      // The memberships policy admits only the user's own, so a row here is the user's membership.
      const [held] = await tx.sql
        .select({ role: memberships.role })
        .from(memberships)
        .where(eq(memberships.channelId, channelId))
      if (!held) return { ok: false, refusal: 'not_connected' }
      const { revokedAtGoogle } = await vault.disconnect(tx, channelId, 'in_app_revocation')
      return { ok: true, revokedAtGoogle }
    },

    async deleteUser(tx) {
      // A channel has one owner and no other member in this epic, so the user is the last member
      // of every channel they hold. Agency members (#7) must leave a channel others hold alone.
      const held = await tx.sql.select({ channelId: memberships.channelId }).from(memberships)
      let revokedAtGoogle = true
      for (const { channelId } of held) {
        const disconnected = await vault.disconnect(tx, channelId, 'user_deletion')
        revokedAtGoogle &&= disconnected.revokedAtGoogle
      }
      await tx.sql.delete(users).where(eq(users.id, setting('app.user_id')))
      return { endedChannels: held.map(({ channelId }) => channelId), revokedAtGoogle }
    },
  }
}
