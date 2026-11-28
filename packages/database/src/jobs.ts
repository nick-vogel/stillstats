import { errorTrackingReporter, type Reporter } from '@creator-analytics/reporter'
import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { type ConstructorOptions, type Db, fromDrizzle, PgBoss } from 'pg-boss'
import type { DrizzleTransaction } from './scopes.ts'

/** Every pg-boss queue the product runs. The migrate step creates each one. */
export const jobNames = [
  'deleteChannel',
  'cancelSubscription',
  'cancelAccountSubscription',
  'accountCancellationAlarm',
  'deletionCheck',
  'deletionAlarm',
  'cacheSweep',
  'deletionLogRetention',
  'deletionRequestRetention',
  'feedbackRetention',
  'securityEvent',
  'googleRevocation',
  'probeRoster',
  'probeConnection',
  'activeUserCount',
  'reportingJobRoster',
  'ensureReportingJob',
  'deletedVideoCheckRoster',
  'deletedVideoCheck',
  'historyPurgeRoster',
  'historyPurge',
  'retentionCurveRoster',
  'retentionCurveRefresh',
  'proGrantEnd',
] as const

export type JobName = (typeof jobNames)[number]

/**
 * The queues pg-boss sends a job to on a cron expression, in UTC. The migrate step writes each
 * schedule, and the worker's cron pass sends the jobs.
 */
export const jobSchedules: Partial<Record<JobName, string>> = {
  cacheSweep: '0 * * * *',
  deletionLogRetention: '0 3 * * *',
  deletionRequestRetention: '0 3 * * *',
  feedbackRetention: '0 3 * * *',
  historyPurgeRoster: '0 3 * * *',
  probeRoster: '0 4 * * *',
  reportingJobRoster: '30 4 * * *',
  deletedVideoCheckRoster: '0 5 * * *',
  // After Google's quota day turns at midnight Pacific, 07:00 or 08:00 UTC.
  retentionCurveRoster: '0 9 * * *',
  activeUserCount: '15 0 * * *',
}

/**
 * The queues whose retries differ from pg-boss's defaults, two retries with no delay. The active
 * user count's six retries five minutes apart ride out a short OpenPanel outage, and all still run
 * on the day after the day they count. A subscription cancellation's eleven retries an hour apart
 * ride out a Stripe outage, the last one before the deletion's alarm at 12 hours reports it; an
 * account deletion's cancellation retries the same way before its own alarm.
 */
export const queueOptions: Partial<Record<JobName, { retryLimit: number; retryDelay: number }>> = {
  activeUserCount: { retryLimit: 6, retryDelay: 300 },
  cancelSubscription: { retryLimit: 11, retryDelay: 3600 },
  cancelAccountSubscription: { retryLimit: 11, retryDelay: 3600 },
}

/**
 * Job data holds internal ids only, never a YouTube id or an analytics value, because pg-boss
 * keeps completed jobs. Every value has to be a uuid, which no YouTube id is.
 */
export type JobData = Readonly<Record<string, string>>

/**
 * What a throttle is for, when one queue throttles a key for more than one reason: `subscribed`,
 * the history download a subscription sends as it turns its channel paid.
 */
export type ThrottlePurpose = 'subscribed'

export interface EnqueueOptions {
  startAfter?: Date
  /**
   * One job per key in each time slot of `seconds`, through pg-boss's singletonKey and
   * singletonSeconds: the slots are fixed windows, not a rolling period. The key is an internal id
   * too. pg-boss holds one job per queue, key and slot start, whatever the window, so a purpose
   * keeps a throttle's slots apart from another throttle's of the same queue and key.
   */
  throttle?: { key: string; seconds: number; purpose?: ThrottlePurpose }
}

/** Sends a job inside the transaction it is given, so the job exists only if that commits. */
export interface JobQueue {
  /** The job's id, or null for a throttled job its time slot already holds. */
  send(
    tx: DrizzleTransaction,
    name: JobName,
    data: JobData,
    options?: EnqueueOptions,
  ): Promise<string | null>
  /**
   * How many of the queue's jobs, in any state, hold every field of `data` in theirs, as the
   * transaction sees them. pg-boss keeps a job until its queue's deletion window has passed after
   * it ended, so the count covers that long.
   */
  count(tx: DrizzleTransaction, name: JobName, data: JobData): Promise<number>
}

export const jobSchema = 'pgboss'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether a value has the form of an internal id: a uuid, which no YouTube id is. */
export function isInternalId(value: string): boolean {
  return uuidPattern.test(value)
}

export class JobDataError extends Error {
  constructor(name: JobName, key: string) {
    super(`Job ${name} refused its ${key}: job data holds internal ids only`)
    this.name = 'JobDataError'
  }
}

/** Reads the named fields of a job's data as pg-boss stored it, and throws for a missing one. */
export function jobDataOf<const Key extends string>(
  name: JobName,
  data: JobData,
  ...keys: Key[]
): Record<Key, string> {
  const fields = {} as Record<Key, string>
  for (const key of keys) {
    const value = data[key]
    if (!value) throw new Error(`A ${name} job lacks its ${key}`)
    fields[key] = value
  }
  return fields
}

/** Runs pg-boss statements through the pool's own connections, as its login role. */
export function poolDb(pool: pg.Pool): Db {
  return { executeSql: (text, values) => pool.query(text, values) }
}

/** The pg-boss statements of a scope, run inside its transaction under its role. */
export function transactionDb(tx: DrizzleTransaction): Db {
  return fromDrizzle(tx, sql)
}

export type JobRunnerOptions = Pick<ConstructorOptions, 'supervise' | 'schedule'> & {
  reporter?: Reporter
}

/**
 * A started pg-boss that never changes its schema: only the migration role does, so no login
 * role comes to own a pg-boss table. `supervise` runs pg-boss's maintenance and `schedule` its
 * cron pass, both in the worker only.
 */
export async function startJobRunner(
  pool: pg.Pool,
  {
    supervise = false,
    schedule = false,
    reporter = errorTrackingReporter(),
  }: JobRunnerOptions = {},
): Promise<PgBoss> {
  const boss = new PgBoss({
    db: poolDb(pool),
    schema: jobSchema,
    migrate: false,
    createSchema: false,
    schedule,
    supervise,
    // REINDEX needs the owner of the indexes, which the login role must never be.
    reindex: false,
  })
  boss.on('error', (error) => reporter.report({ message: 'pg-boss reported an error', error }))
  return boss.start()
}

export function jobQueue(boss: PgBoss): JobQueue {
  return {
    async send(tx, name, data, { throttle, ...options } = {}) {
      for (const [key, value] of Object.entries(data)) {
        if (!isInternalId(value)) throw new JobDataError(name, key)
      }
      if (throttle && !isInternalId(throttle.key)) throw new JobDataError(name, 'throttle key')
      const id = await boss.send(name, data, {
        ...options,
        ...(throttle && {
          singletonKey: throttle.purpose ? `${throttle.purpose}:${throttle.key}` : throttle.key,
          singletonSeconds: throttle.seconds,
        }),
        db: transactionDb(tx),
      })
      // pg-boss resolves null, not a rejection, for a job its time slot already holds.
      if (!id && !throttle) {
        throw new Error(`pg-boss accepted no ${name} job`)
      }
      return id
    },
    async count(tx, name, data) {
      return (await boss.findJobs(name, { data, db: transactionDb(tx) })).length
    },
  }
}

/**
 * Installs or upgrades pg-boss's schema, creates each queue and writes each schedule, as the
 * migration role. The two application roles get the rows of pg-boss's tables, never its schema.
 */
export async function installJobs(pool: pg.Pool): Promise<void> {
  const boss = new PgBoss({
    db: poolDb(pool),
    schema: jobSchema,
    migrate: true,
    schedule: false,
    supervise: false,
  })
  await boss.start()
  try {
    for (const name of jobNames) {
      const options = queueOptions[name]
      if (!(await boss.getQueue(name))) await boss.createQueue(name, options)
      else if (options) await boss.updateQueue(name, options)
    }
    for (const [name, cron] of Object.entries(jobSchedules)) {
      // A deploy that spans an occurrence sends the latest missed one when the worker is back.
      await boss.schedule(name, cron, null, { missed: 'once' })
    }
  } finally {
    await boss.stop({ graceful: false })
  }
  await pool.query(`
    grant usage on schema ${jobSchema} to app_web, app_worker;
    grant select, insert, update, delete on all tables in schema ${jobSchema} to app_web, app_worker;
    grant usage, select on all sequences in schema ${jobSchema} to app_web, app_worker;`)
}
