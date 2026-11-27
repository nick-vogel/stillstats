import type { JobData, JobName, Scoped, WorkerDatabase } from '@creator-analytics/database'
import type { Reporter } from '@creator-analytics/reporter'
import {
  type DeletionJobName,
  deletionJobData,
  enqueueHistoryPurges,
  historyPurgeJobData,
  purgeEndedHistory,
  type Retention,
} from '@creator-analytics/retention-engine'
import {
  type ConnectionProbe,
  enqueueConnectionProbes,
  fanOutSecurityEvent,
  googleRevocationJobData,
  markRevokedByGoogle,
  probeConnectionJobData,
  securityEventJobData,
} from '@creator-analytics/token-vault'
import { sweepExpiredCache } from '@creator-analytics/youtube-gateway'
import type { PgBoss } from 'pg-boss'
import {
  type ActiveUserCountOptions,
  countActiveUsers,
  pruneActivityDaysNoRetryNeeds,
} from './active-user-count.ts'
import {
  checkDeletedVideos,
  type DeletedVideoOptions,
  deletedVideoCheckData,
  enqueueDeletedVideoChecks,
} from './deleted-videos.ts'
import {
  enqueueReportingJobs,
  ensureReportingJob,
  ensureReportingJobData,
  type ReportingJobOptions,
} from './reporting-jobs.ts'
import {
  enqueueRetentionCurveRefreshes,
  type RetentionCurveOptions,
  refreshRetentionCurves,
  retentionCurveRefreshData,
} from './retention-curves.ts'

/**
 * Runs one job: it opens the job's scope, which no module code does, except the retention curve
 * refresh, which opens one scope per Google read so that no transaction holds the quota row every
 * channel shares across a run of reads.
 */
type Handler = (worker: WorkerDatabase, data: JobData) => Promise<void>

/** One handler for every queue, so a queue without one fails the type check. */
export function jobHandlers(
  retention: Retention,
  prober: ConnectionProbe,
  activeUsers: ActiveUserCountOptions,
  reporting: {
    gateway: ReportingJobOptions['gateway'] &
      DeletedVideoOptions['gateway'] &
      RetentionCurveOptions['gateway']
    reporter: Reporter
  },
): Record<JobName, Handler> {
  const ensureJob = ensureReportingJob(reporting)
  const checkVideos = checkDeletedVideos(reporting)
  const refreshCurves = refreshRetentionCurves(reporting)
  const inChannelScope =
    (name: DeletionJobName): Handler =>
    (worker, data) => {
      const deletion = deletionJobData(name, data)
      return worker.forChannel(deletion.channelId, (tx) => retention[name](tx, deletion))
    }
  // A scheduled job carries no data: each runs over every channel, in the system scope.
  const inSystemScope =
    (handle: (tx: Scoped<'system'>) => Promise<unknown>): Handler =>
    async (worker) => {
      await worker.asSystem(handle)
    }
  return {
    deleteChannel: inChannelScope('deleteChannel'),
    cancelSubscription: inChannelScope('cancelSubscription'),
    deletionCheck: inChannelScope('deletionCheck'),
    deletionAlarm: inChannelScope('deletionAlarm'),
    cacheSweep: inSystemScope(sweepExpiredCache),
    deletionLogRetention: inSystemScope(retention.deletionLogRetention),
    deletionRequestRetention: inSystemScope(retention.deletionRequestRetention),
    feedbackRetention: inSystemScope(retention.feedbackRetention),
    securityEvent: (worker, data) =>
      worker.asSystem((tx) => fanOutSecurityEvent(tx, securityEventJobData(data))),
    googleRevocation: (worker, data) => {
      const revocation = googleRevocationJobData(data)
      return worker.forChannel(revocation.channelId, (tx) => markRevokedByGoogle(tx, revocation))
    },
    probeRoster: inSystemScope(enqueueConnectionProbes),
    probeConnection: (worker, data) => {
      const { channelId } = probeConnectionJobData(data)
      return worker.forChannel(channelId, (tx) => prober.probe(tx, channelId))
    },
    activeUserCount: async (worker) => {
      await worker.asSystem(pruneActivityDaysNoRetryNeeds)
      await worker.asSystem(countActiveUsers(activeUsers))
    },
    reportingJobRoster: inSystemScope(enqueueReportingJobs),
    ensureReportingJob: (worker, data) => {
      const job = ensureReportingJobData(data)
      return worker.forChannel(job.channelId, (tx) => ensureJob(tx, job))
    },
    deletedVideoCheckRoster: inSystemScope(enqueueDeletedVideoChecks),
    deletedVideoCheck: (worker, data) => {
      const check = deletedVideoCheckData(data)
      return worker.forChannel(check.channelId, (tx) => checkVideos(tx, check))
    },
    historyPurgeRoster: inSystemScope(enqueueHistoryPurges),
    historyPurge: (worker, data) => {
      const job = historyPurgeJobData(data)
      return worker.forChannel(job.channelId, (tx) => purgeEndedHistory(tx, job))
    },
    retentionCurveRoster: inSystemScope(enqueueRetentionCurveRefreshes),
    retentionCurveRefresh: (worker, data) => refreshCurves(worker, retentionCurveRefreshData(data)),
  }
}

/**
 * Runs each queue's jobs through its handler. A handler that throws is reported, then rethrown so
 * pg-boss retries the job: pg-boss itself emits no error for a failed job.
 */
export async function work(
  boss: Pick<PgBoss, 'work'>,
  worker: WorkerDatabase,
  handlers: Record<JobName, Handler>,
  reporter: Reporter,
): Promise<void> {
  for (const [name, handler] of Object.entries(handlers)) {
    await boss.work<JobData>(name, async (jobs) => {
      for (const job of jobs) {
        try {
          await handler(worker, job.data)
        } catch (error) {
          reporter.report({ message: `A ${name} job failed`, context: { jobId: job.id }, error })
          throw error
        }
      }
    })
  }
}
