import { randomUUID } from 'node:crypto'
import {
  type Answer,
  type ChannelData,
  type FakeReportingJob,
  googleError,
} from '../channel-data.ts'

/** A Reporting API request: the channel its access token reads, and the fake's data. */
export interface ReportingAsked {
  youtubeChannelId: string
  data: ChannelData
}

function jobsOf({ youtubeChannelId, data }: ReportingAsked): FakeReportingJob[] {
  let jobs = data.reportingJobs.get(youtubeChannelId)
  if (!jobs) {
    jobs = []
    data.reportingJobs.set(youtubeChannelId, jobs)
  }
  return jobs
}

/** `jobs.list`: the channel's jobs. Google leaves `jobs` out of the body when there are none. */
export function listJobs(asked: ReportingAsked): Answer {
  const jobs = jobsOf(asked)
  return { status: 200, body: jobs.length > 0 ? { jobs } : {} }
}

/**
 * `jobs.create` with `{ reportTypeId, name }`. Google answers 409 to a second job of a report type
 * the channel already has one for, and 400 to a body without either field.
 */
export function createJob(asked: ReportingAsked, body: unknown): Answer {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const { reportTypeId, name } = fields
  if (typeof reportTypeId !== 'string' || typeof name !== 'string' || !reportTypeId || !name) {
    return googleError(400, 'A job needs a reportTypeId and a name')
  }
  const jobs = jobsOf(asked)
  if (jobs.some((job) => job.reportTypeId === reportTypeId)) {
    return googleError(409, 'Requested entity already exists')
  }
  const job = { id: randomUUID(), reportTypeId, name, createTime: new Date().toISOString() }
  jobs.push(job)
  return { status: 200, body: job }
}
