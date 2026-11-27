import { sql } from 'drizzle-orm'
import type { Scoped, ScopeKind } from '../src/scopes.ts'

/**
 * Every table with a channel_id column, and channels itself, read from the catalog. By column
 * name, not by the foreign key the deletion finds tables by, so a table holding a channel id
 * without the foreign key fails the tests that use it. A deletion request outlives its channel,
 * and the retention engine's tests prove that completing it clears its channel id. A consent state
 * belongs to its user, not to the channel it names, and expires in ten minutes. A subscription
 * cancellation outlives its channel until Stripe accepts it, and the retention engine's tests prove
 * it is deleted then.
 */
async function channelTables(scope: Scoped<ScopeKind>) {
  const result = await scope.sql.execute<{ table: string; column: string }>(sql`
    select c.relname as table, a.attname as column
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where a.attname = 'channel_id' and not a.attisdropped and c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and c.relname not in ('deletion_requests', 'consent_states', 'subscription_cancellations')
    union all select 'channels', 'id'
    order by 1`)
  return result.rows
}

/** The channel's rows in every table that holds a channel id, as the channel's scope sees them. */
export async function channelRowCounts(
  scope: Scoped<'channel'>,
  channelId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const { table, column } of await channelTables(scope)) {
    const result = await scope.sql.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.identifier(column)} = ${channelId}`,
    )
    counts[table] = result.rows[0]?.n ?? -1
  }
  return counts
}
