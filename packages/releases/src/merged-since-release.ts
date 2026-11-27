import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { compareVersions, isAppVersion } from './version.ts'

const run = promisify(execFile)

export type ReleaseRangeBase = { tag: string } | { commit: string }

export interface MergedPullRequest {
  number: number
  title: string
  branch: string
  /** The issue numbers named by the branch and the title, sorted, each once. */
  issues: number[]
  /** The merge commit on `main`. */
  commit: string
}

/**
 * A commit on `main` that no GitHub pull request merge message names, such as a direct push, a
 * squash merge, or a merge whose message was edited, which can change what a creator sees as much
 * as a pull request can.
 */
export interface DirectCommit {
  commit: string
  subject: string
}

export interface MergedSinceRelease {
  base: ReleaseRangeBase
  /** Oldest first. */
  pullRequests: MergedPullRequest[]
  /** Oldest first. */
  commits: DirectCommit[]
  /** The names of the highlights the range added, sorted. */
  highlights: string[]
}

export interface ReleaseRangeOptions {
  /** A path inside the repository. */
  repo: string
  /** Where the range starts when no app release tag exists yet, before the first release. */
  since?: string
  /** Where the range ends. */
  to?: string
}

async function git(repo: string, ...args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: repo, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

async function lastAppReleaseTag(repo: string, to: string): Promise<string | undefined> {
  const tags = (await git(repo, 'tag', '--merged', to)).split('\n').filter(isAppVersion)
  return tags.sort(compareVersions).at(-1)
}

/** A given commit starts the range only before the first release, so a stale one cannot widen it. */
async function rangeBase(
  repo: string,
  since: string | undefined,
  to: string,
): Promise<ReleaseRangeBase> {
  const tag = await lastAppReleaseTag(repo, to)
  if (tag !== undefined) return { tag }
  if (since !== undefined) return { commit: since }
  throw new Error(
    `No app release tag is merged into ${to}, so the range has no start. Before the first release, pass --since <commit>.`,
  )
}

const fieldSeparator = '\u001f'
const recordSeparator = '\u001e'
const pullRequestMerge = /^Merge pull request #(\d+) from [^/\s]+\/(\S+)$/
const branchIssue = /^creator-analytics-(\d+)-/
// `#268` or `creator-analytics#268`, never another repository's `riverbed#42`.
const titleIssue = /(?<![\w-])(?:creator-analytics)?#(\d+)\b/g

function issuesOf(branch: string, title: string): number[] {
  const numbers = [
    branch.match(branchIssue)?.[1],
    ...[...title.matchAll(titleIssue)].map((m) => m[1]),
  ]
  return [...new Set(numbers.filter((n) => n !== undefined).map(Number))].sort((a, b) => a - b)
}

const highlightsFolder = 'packages/releases/highlights/'

/**
 * Highlights present at the range end and absent at its start. `readReleaseContent` reads the
 * folder without descending, so a file in a subfolder is no highlight.
 */
async function highlightsAdded(repo: string, from: string, to: string): Promise<string[]> {
  const added = await git(
    repo,
    'diff',
    '--name-only',
    '--no-renames',
    '--diff-filter=A',
    from,
    to,
    '--',
    `:(top)${highlightsFolder}`,
  )
  return added
    .split('\n')
    .map((path) => path.slice(highlightsFolder.length))
    .filter((name) => name.endsWith('.md') && !name.includes('/'))
    .map((name) => name.slice(0, -'.md'.length))
    .sort()
}

/**
 * What a release starting from the last app release tag would ship: the pull requests merged to
 * the range end since then, read from the merge commits GitHub writes on `main`.
 */
export async function mergedSinceRelease({
  repo,
  since,
  to = 'HEAD',
}: ReleaseRangeOptions): Promise<MergedSinceRelease> {
  const base = await rangeBase(repo, since, to)
  const from = 'tag' in base ? base.tag : base.commit
  const log = await git(
    repo,
    'log',
    '--first-parent',
    '--reverse',
    `--format=%H${fieldSeparator}%s${fieldSeparator}%b${recordSeparator}`,
    `${from}..${to}`,
  )
  const pullRequests: MergedPullRequest[] = []
  const commits: DirectCommit[] = []
  for (const record of log.split(recordSeparator)) {
    if (record.trim() === '') continue
    const [commit = '', subject = '', body = ''] = record.trim().split(fieldSeparator)
    const merge = pullRequestMerge.exec(subject)
    if (merge) {
      const branch = merge[2] ?? ''
      const title = body.split('\n')[0]?.trim() ?? ''
      pullRequests.push({
        number: Number(merge[1]),
        title,
        branch,
        issues: issuesOf(branch, title),
        commit,
      })
    } else {
      commits.push({ commit, subject })
    }
  }
  return { base, pullRequests, commits, highlights: await highlightsAdded(repo, from, to) }
}
