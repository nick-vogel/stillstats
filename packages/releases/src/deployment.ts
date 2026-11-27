import { type Environment, environments } from '@creator-analytics/api-types'
import {
  newestAppRelease,
  packageContentRoot,
  type Release,
  readReleaseContent,
} from './read-release-content.ts'

/** What a running process reports about itself: where it runs, and what it is built from. */
export interface Deployment {
  environment: Environment
  /** The build's newest app release note, or null while the build holds none. */
  version: string | null
  /** The first 7 characters of the image's commit, git's default short length, or null. */
  commit: string | null
}

function isEnvironment(value: string | undefined): value is Environment {
  return environments.some((each) => each === value)
}

/**
 * The deployment from a process's env. `STILLSTATS_ENVIRONMENT` is required, as `NODE_ENV` is
 * `production` in both images: unset or unknown, it throws, so the process refuses to start
 * (ADR 0015). `RELEASE_CONTENT_ROOT` points the version's read at another content root, as it
 * does the site's build.
 */
export function deploymentOf(
  env: Readonly<Record<string, string | undefined>>,
  releases: readonly Release[] = readReleaseContent(
    env.RELEASE_CONTENT_ROOT || packageContentRoot,
  ).releases,
): Deployment {
  const environment = env.STILLSTATS_ENVIRONMENT
  if (!isEnvironment(environment)) {
    throw new Error(`STILLSTATS_ENVIRONMENT must be ${environments.join(' or ')}`)
  }
  return {
    environment,
    version: newestAppRelease(releases)?.version ?? null,
    commit: env.COMMIT_SHA ? env.COMMIT_SHA.slice(0, 7) : null,
  }
}
