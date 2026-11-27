import { type ExtractTablesWithRelations, sql } from 'drizzle-orm'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgRole, PgTransaction } from 'drizzle-orm/pg-core'
import { webRole, workerRole } from './access.ts'
import type { EnqueueOptions, JobData, JobName, JobQueue } from './jobs.ts'

export type DatabaseHandle = PgDatabase<NodePgQueryResultHKT>
export type DrizzleTransaction = PgTransaction<
  NodePgQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>

export type ScopeKind = 'user' | 'anonymous' | 'channel' | 'system' | 'admin'

export interface Scoped<K extends ScopeKind> {
  readonly kind: K
  readonly sql: DrizzleTransaction
  /** The clock reading pinned at scope entry, also set as `app.now`. */
  readonly now: Date
  /** The same clock read at the call, for when something happened during the scope's work. */
  clock(): Date
  /**
   * Sends a job inside this scope's transaction, so the job exists only if the scope commits. The
   * id is null only for a throttled job its time slot already holds.
   */
  enqueue(name: JobName, data: JobData, options?: EnqueueOptions): Promise<string | null>
  /** How many of the queue's jobs hold every field of `data`, the ones this scope sent included. */
  countJobs(name: JobName, data: JobData): Promise<number>
}

type Work<K extends ScopeKind, T> = (scope: Scoped<K>) => Promise<T>

export interface WebDatabase {
  asUser<T>(userId: string, work: Work<'user', T>): Promise<T>
  asAnonymous<T>(work: Work<'anonymous', T>): Promise<T>
  /**
   * The admin scope, which reads every feedback message and sets only its "Done" time. Only the
   * API enters it, and only for a user on the allowlist. It sets `app.user_id` to the admin's ID,
   * to record whose scope it is; every policy and function that reads the setting also checks the
   * scope is `user`, so the ID admits nothing more.
   */
  asAdmin<T>(userId: string, work: Work<'admin', T>): Promise<T>
}

export interface WorkerDatabase {
  forChannel<T>(channelId: string, work: Work<'channel', T>): Promise<T>
  asSystem<T>(work: Work<'system', T>): Promise<T>
}

export interface ScopeOptions {
  jobs: JobQueue
  clock?: () => Date
}

interface Entry<K extends ScopeKind> {
  role: PgRole
  kind: K
  userId?: string
  channelId?: string
}

function systemClock(): Date {
  return new Date()
}

function enter<K extends ScopeKind, T>(
  handle: DatabaseHandle,
  { jobs, clock = systemClock }: ScopeOptions,
  entry: Entry<K>,
  work: Work<K, T>,
): Promise<T> {
  return handle.transaction(async (tx) => {
    const now = clock()
    // Every setting is written on every entry. Postgres keeps SET LOCAL values after RELEASE
    // SAVEPOINT, so a nested scope that wrote only its own settings would inherit the others.
    await tx.execute(sql`select
      set_config('role', ${entry.role.name}, true),
      set_config('app.scope', ${entry.kind}, true),
      set_config('app.user_id', ${entry.userId ?? ''}, true),
      set_config('app.channel_id', ${entry.channelId ?? ''}, true),
      set_config('app.now', ${now.toISOString()}, true)`)
    return work({
      kind: entry.kind,
      sql: tx,
      now,
      clock,
      enqueue: (name, data, options) => jobs.send(tx, name, data, options),
      countJobs: (name, data) => jobs.count(tx, name, data),
    })
  })
}

/**
 * Only composition roots call this. A handle that is already a transaction makes every scope a
 * savepoint inside it, which is how a test rolls back everything a scope wrote.
 */
export function webDatabase(handle: DatabaseHandle, options: ScopeOptions): WebDatabase {
  return {
    asUser: (userId, work) => enter(handle, options, { role: webRole, kind: 'user', userId }, work),
    asAnonymous: (work) => enter(handle, options, { role: webRole, kind: 'anonymous' }, work),
    asAdmin: (userId, work) =>
      enter(handle, options, { role: webRole, kind: 'admin', userId }, work),
  }
}

/** Only composition roots call this, as for `webDatabase`. */
export function workerDatabase(handle: DatabaseHandle, options: ScopeOptions): WorkerDatabase {
  return {
    forChannel: (channelId, work) =>
      enter(handle, options, { role: workerRole, kind: 'channel', channelId }, work),
    asSystem: (work) => enter(handle, options, { role: workerRole, kind: 'system' }, work),
  }
}
