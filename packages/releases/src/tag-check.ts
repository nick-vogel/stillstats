import {
  newestAppRelease,
  packageContentRoot,
  type Release,
  readReleaseContent,
} from './read-release-content.ts'
import { isAppVersion, isExtensionVersion } from './version.ts'

export type ReleaseTagCheck = { deploy: true; version: string } | { deploy: false }

export type ReleaseForTag = { deploy: true; version: string; body: string } | { deploy: false }

/**
 * An app release tag is the bare version, such as `2026.11.9`. An extension release tag carries a
 * prefix, such as `extension-1.0.0`, because a CalVer version is also valid SemVer and the two
 * products' tags must not be mistaken for each other.
 */
const extensionTagPrefix = 'extension-'

/**
 * The release workflow's first step: a tag deploys only when it is a valid app version equal to
 * the newest app release note in the tagged commit, so the version a creator sees always matches
 * the page that describes it. An extension tag deploys nothing. Any other tag throws, with a
 * message for the workflow's log.
 */
export function checkReleaseTag(tag: string, releases: readonly Release[]): ReleaseTagCheck {
  if (
    tag.startsWith(extensionTagPrefix) &&
    isExtensionVersion(tag.slice(extensionTagPrefix.length))
  ) {
    return { deploy: false }
  }
  if (!isAppVersion(tag)) {
    throw new Error(
      `The tag "${tag}" is not a valid app version (CalVer YYYY.M.D or YYYY.M.D.N) or an extension tag (${extensionTagPrefix}MAJOR.MINOR.PATCH).`,
    )
  }
  const newest = newestAppRelease(releases)
  if (!newest) {
    throw new Error(
      `The tag "${tag}" names an app release, but the commit has no app release note.`,
    )
  }
  if (newest.version !== tag) {
    throw new Error(
      `The tag "${tag}" does not match the newest app release note in the commit, ${newest.version}.`,
    )
  }
  return { deploy: true, version: tag }
}

/**
 * The release workflow's tag check over the release content at `root`, the tagged commit's: it
 * answers the version to deploy and its note's markdown, the GitHub release body, or no deploy for
 * an extension tag. A tag the check refuses throws, as `checkReleaseTag` does.
 */
export function releaseForTag(tag: string, root: string = packageContentRoot): ReleaseForTag {
  const { releases } = readReleaseContent(root)
  const check = checkReleaseTag(tag, releases)
  if (!check.deploy) return check
  const note = releases.find(({ product, version }) => product === 'app' && version === tag)
  if (!note) throw new Error(`The tag "${tag}" passed the check, but no app note has its version.`)
  return { deploy: true, version: check.version, body: note.body }
}
