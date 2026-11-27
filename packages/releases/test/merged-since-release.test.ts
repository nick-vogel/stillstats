// These tests build merge commits shaped like the ones GitHub writes when it merges a pull request
// (`Merge pull request #<n> from <owner>/<branch>`, the title as the body's first line). They cannot
// observe a change in GitHub's merge message, and they never call GitHub: drafting the first real
// release note from `main` is the step that shows the script still reads it.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, test } from 'vitest'
import { mergedSinceRelease } from '../src/merged-since-release.ts'

const run = promisify(execFile)

const repos: string[] = []

afterEach(async () => {
  await Promise.all(repos.splice(0).map((repo) => rm(repo, { recursive: true, force: true })))
})

/** A git repository whose history is the same on any machine, whatever the user's git config. */
async function fixtureRepo() {
  const repo = await mkdtemp(join(tmpdir(), 'merged-since-release-'))
  repos.push(repo)
  let clock = Date.UTC(2026, 10, 1) / 1000

  async function git(...args: string[]): Promise<string> {
    clock += 60
    const date = `${clock} +0000`
    const { stdout } = await run(
      'git',
      ['-c', 'commit.gpgSign=false', '-c', 'tag.gpgSign=false', ...args],
      {
        cwd: repo,
        env: {
          PATH: process.env.PATH,
          HOME: repo,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_AUTHOR_NAME: 'Fixture',
          GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_NAME: 'Fixture',
          GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
          GIT_COMMITTER_DATE: date,
        },
      },
    )
    return stdout.trim()
  }

  async function writeFiles(files: Record<string, string | null>): Promise<void> {
    for (const [path, text] of Object.entries(files)) {
      if (text === null) {
        await git('rm', '--quiet', path)
      } else {
        await mkdir(dirname(join(repo, path)), { recursive: true })
        await writeFile(join(repo, path), text)
        await git('add', path)
      }
    }
  }

  /** A commit straight on the current branch. `null` deletes a file. Answers the commit's sha. */
  async function commit(
    subject: string,
    files: Record<string, string | null> = {},
  ): Promise<string> {
    await writeFiles(files)
    await git('commit', '--quiet', '--allow-empty', '-m', subject)
    return git('rev-parse', 'HEAD')
  }

  /** A pull request merged into `main` the way GitHub merges one. Answers the merge commit's sha. */
  async function mergePullRequest(
    number: number,
    branch: string,
    title: string,
    files: Record<string, string | null> = {},
  ): Promise<string> {
    await git('switch', '--quiet', '-c', branch)
    await commit(`Work for ${branch}`, files)
    await git('switch', '--quiet', 'main')
    await git(
      'merge',
      '--quiet',
      '--no-ff',
      '-m',
      `Merge pull request #${number} from nick-vogel/${branch}`,
      '-m',
      title,
      branch,
    )
    return git('rev-parse', 'HEAD')
  }

  async function tag(name: string, ref = 'HEAD'): Promise<void> {
    await git('tag', name, ref)
  }

  await git('init', '--quiet', '-b', 'main')
  await commit('The first commit', { 'README.md': 'Stillstats\n' })
  return { repo, git, commit, mergePullRequest, tag }
}

function numbersOf(result: Awaited<ReturnType<typeof mergedSinceRelease>>): number[] {
  return result.pullRequests.map(({ number }) => number)
}

describe('the range of a release', () => {
  test('starts at the last app release tag', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await mergePullRequest(1, 'creator-analytics-10-first', 'creator-analytics#10: First')
    await tag('2026.11.8')
    await mergePullRequest(2, 'creator-analytics-11-second', 'creator-analytics#11: Second')
    await tag('2026.11.9')
    await mergePullRequest(3, 'creator-analytics-12-third', 'creator-analytics#12: Third')
    await mergePullRequest(4, 'creator-analytics-13-fourth', 'creator-analytics#13: Fourth')

    const result = await mergedSinceRelease({ repo })

    expect(result.base).toEqual({ tag: '2026.11.9' })
    expect(numbersOf(result)).toEqual([3, 4])
  })

  test('ignores an extension release tag', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'creator-analytics#10: First')
    await tag('extension-1.0.0')
    await mergePullRequest(2, 'creator-analytics-11-second', 'creator-analytics#11: Second')

    const result = await mergedSinceRelease({ repo })

    expect(result.base).toEqual({ tag: '2026.11.9' })
    expect(numbersOf(result)).toEqual([1, 2])
  })

  test('ignores a tag that is no release version', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'creator-analytics#10: First')
    await tag('latest')
    await mergePullRequest(2, 'creator-analytics-11-second', 'creator-analytics#11: Second')

    const result = await mergedSinceRelease({ repo })

    expect(result.base).toEqual({ tag: '2026.11.9' })
    expect(numbersOf(result)).toEqual([1, 2])
  })

  test('takes the newest app version, not the newest tag', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await mergePullRequest(1, 'creator-analytics-10-first', 'creator-analytics#10: First')
    await tag('2026.11.10')
    await tag('2026.11.9.1', 'HEAD~1')
    await mergePullRequest(2, 'creator-analytics-11-second', 'creator-analytics#11: Second')

    const result = await mergedSinceRelease({ repo })

    expect(result.base).toEqual({ tag: '2026.11.10' })
    expect(numbersOf(result)).toEqual([2])
  })

  test('ignores an app release tag the range end does not contain', async () => {
    const { repo, git, commit, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await git('switch', '--quiet', '-c', 'side')
    await commit('A commit main never merged')
    await tag('2026.11.10')
    await git('switch', '--quiet', 'main')
    await mergePullRequest(1, 'creator-analytics-10-first', 'creator-analytics#10: First')

    const result = await mergedSinceRelease({ repo })

    expect(result.base).toEqual({ tag: '2026.11.9' })
    expect(numbersOf(result)).toEqual([1])
  })

  test('ends where it is told to end', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    const first = await mergePullRequest(1, 'creator-analytics-10-first', 'A')
    await mergePullRequest(2, 'creator-analytics-11-second', 'B')

    const result = await mergedSinceRelease({ repo, to: first })

    expect(numbersOf(result)).toEqual([1])
  })

  test('falls back to a given commit when no app release tag exists', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('extension-1.0.0')
    const since = await mergePullRequest(1, 'creator-analytics-10-first', 'A')
    await mergePullRequest(2, 'creator-analytics-11-second', 'B')

    const result = await mergedSinceRelease({ repo, since })

    expect(result.base).toEqual({ commit: since })
    expect(numbersOf(result)).toEqual([2])
  })

  test('starts at the app release tag even when a commit is given', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    const since = await mergePullRequest(1, 'creator-analytics-10-first', 'A')
    await mergePullRequest(2, 'creator-analytics-11-second', 'B')
    await tag('2026.11.9')
    await mergePullRequest(3, 'creator-analytics-12-third', 'C')

    const result = await mergedSinceRelease({ repo, since })

    expect(result.base).toEqual({ tag: '2026.11.9' })
    expect(numbersOf(result)).toEqual([3])
  })

  test('with no app release tag and no given commit, refuses and asks for --since', async () => {
    const { repo, mergePullRequest } = await fixtureRepo()
    await mergePullRequest(1, 'creator-analytics-10-first', 'A')

    await expect(mergedSinceRelease({ repo })).rejects.toThrow(/--since/)
  })
})

describe('the pull requests in a release', () => {
  test('each gives its number, title, branch and the issues its branch and title name', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    const title =
      'creator-analytics#268: a roomier sidebar footer, the fix for #301 and creator-analytics#268, after riverbed#42'
    const merge = await mergePullRequest(
      538,
      'creator-analytics-267-channel-audience-screen',
      title,
    )

    const result = await mergedSinceRelease({ repo })

    expect(result.pullRequests).toEqual([
      {
        number: 538,
        title,
        branch: 'creator-analytics-267-channel-audience-screen',
        issues: [267, 268, 301],
        commit: merge,
      },
    ])
  })

  test('a commit made straight on main is listed apart, not lost', async () => {
    const { repo, commit, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'A')
    const direct = await commit('creator-analytics#256 Record when Stillstats shows a fresh number')

    const result = await mergedSinceRelease({ repo })

    expect(numbersOf(result)).toEqual([1])
    expect(result.commits).toEqual([
      {
        commit: direct,
        subject: 'creator-analytics#256 Record when Stillstats shows a fresh number',
      },
    ])
  })

  test("a commit on a pull request's branch is not listed on its own", async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'A')

    const result = await mergedSinceRelease({ repo })

    expect(numbersOf(result)).toEqual([1])
    expect(result.commits).toEqual([])
  })

  test('a merge whose message was edited is listed apart, not lost', async () => {
    const { repo, git, commit, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await git('switch', '--quiet', '-c', 'creator-analytics-4-studio-extension')
    await commit('Work for the Studio extension')
    await git('switch', '--quiet', 'main')
    await git(
      'merge',
      '--quiet',
      '--no-ff',
      '-m',
      'creator-analytics#4: Studio extension (#249)',
      'creator-analytics-4-studio-extension',
    )
    const merge = await git('rev-parse', 'HEAD')

    const result = await mergedSinceRelease({ repo })

    expect(result.pullRequests).toEqual([])
    expect(result.commits).toEqual([
      { commit: merge, subject: 'creator-analytics#4: Studio extension (#249)' },
    ])
  })
})

const highlight = '---\ntitle: Switch channels from the sidebar\n---\n\nPick another channel.\n'

describe('the highlights a release adds', () => {
  test('lists a highlight a pull request in the range added, by name', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'A', {
      'packages/releases/highlights/channel-picker.md': highlight,
      'packages/releases/highlights/audience-cards.md': highlight,
    })

    const result = await mergedSinceRelease({ repo })

    expect(result.highlights).toEqual(['audience-cards', 'channel-picker'])
  })

  test('leaves out a highlight added before the range starts', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await mergePullRequest(1, 'creator-analytics-10-first', 'A', {
      'packages/releases/highlights/channel-picker.md': highlight,
    })
    await tag('2026.11.9')
    await mergePullRequest(2, 'creator-analytics-11-second', 'B', {
      'packages/releases/highlights/channel-picker.md': `${highlight}A second line.\n`,
    })

    const result = await mergedSinceRelease({ repo })

    expect(result.highlights).toEqual([])
  })

  test('leaves out a highlight added and removed inside the range', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'A', {
      'packages/releases/highlights/channel-picker.md': highlight,
    })
    await mergePullRequest(2, 'creator-analytics-11-second', 'B', {
      'packages/releases/highlights/channel-picker.md': null,
    })

    const result = await mergedSinceRelease({ repo })

    expect(result.highlights).toEqual([])
  })

  test('leaves out a file that is no highlight', async () => {
    const { repo, mergePullRequest, tag } = await fixtureRepo()
    await tag('2026.11.9')
    await mergePullRequest(1, 'creator-analytics-10-first', 'A', {
      'packages/releases/notes/2026.11.10.md': highlight,
      'packages/releases/highlights/README.txt': 'Not a highlight\n',
      'packages/releases/highlights/drafts/channel-picker.md': highlight,
      'apps/web/highlights/channel-picker.md': highlight,
    })

    const result = await mergedSinceRelease({ repo })

    expect(result.highlights).toEqual([])
  })
})
