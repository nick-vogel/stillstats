import { packageContentRoot, type Release, readReleaseContent } from './read-release-content.ts'
import { compareVersions, isAppVersion } from './version.ts'

export interface RollbackCheck {
  version: string
}

function listOf(versions: readonly string[]): string {
  if (versions.length <= 1) return versions.join('')
  return `${versions.slice(0, -1).join(', ')} and ${versions.at(-1)}`
}

/**
 * The rollback workflow's first step: a rollback may go back to an app version only when no
 * newer app release removed something the target's code still needs. It throws, with a message
 * for the workflow's log, as `checkReleaseTag` does.
 */
export function checkRollback(target: string, releases: readonly Release[]): RollbackCheck {
  if (!isAppVersion(target)) {
    throw new Error(
      `The rollback target "${target}" is not a valid app version (CalVer YYYY.M.D or YYYY.M.D.N).`,
    )
  }
  if (!releases.some(({ product, version }) => product === 'app' && version === target)) {
    throw new Error(
      `The rollback target ${target} has no app release note, so it was never released and has no images to go back to.`,
    )
  }
  const removals = releases
    .filter(
      ({ product, version, removes }) =>
        product === 'app' && removes && compareVersions(version, target) > 0,
    )
    .map(({ version }) => version)
    .sort(compareVersions)
  if (removals.length > 0) {
    const which = removals.length === 1 ? 'which removes something' : 'which remove something'
    throw new Error(
      `A rollback to ${target} would go back past ${listOf(removals)}, ${which}. The code of ${target} may not fit the production schema after it, so fix forward in a new release instead.`,
    )
  }
  return { version: target }
}

/**
 * The rollback workflow's check over the release content at `root`, which the workflow reads at
 * the newest release tag, so the content holds every release production may have run. A refused
 * rollback throws, as `checkRollback` does.
 */
export function rollbackFor(target: string, root: string = packageContentRoot): RollbackCheck {
  return checkRollback(target, readReleaseContent(root).releases)
}
