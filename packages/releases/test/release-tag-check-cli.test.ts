// The release workflow runs this command in a checkout of the tagged commit and reads its stdout
// into $GITHUB_OUTPUT, so these tests hold what the workflow reads: the output lines, the notes
// file, and the exit code that stops the workflow before any migration.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { fixtureContentRoot } from './testing.ts'

const cli = fileURLToPath(new URL('../src/release-tag-check-cli.ts', import.meta.url))

interface Run {
  code: number
  stdout: string
  stderr: string
  notesFile: string
}

async function releaseTagCheck(tag: string): Promise<Run> {
  const notesFile = join(await mkdtemp(join(tmpdir(), 'release-tag-check-')), 'notes.md')
  try {
    const { stdout, stderr } = await promisify(execFile)(
      process.execPath,
      [cli, '--tag', tag, '--notes-file', notesFile],
      { env: { ...process.env, RELEASE_CONTENT_ROOT: fixtureContentRoot } },
    )
    return { code: 0, stdout, stderr, notesFile }
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string }
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr, notesFile }
  }
}

describe('the release tag check command', () => {
  test("a tag equal to the newest app release note prints the version to deploy and writes the note's markdown", async () => {
    const run = await releaseTagCheck('2026.11.9.1')

    expect(run.code).toBe(0)
    expect(run.stdout).toBe('deploy=true\nversion=2026.11.9.1\n')
    expect(await readFile(run.notesFile, 'utf8')).toBe(
      'The video list kept the old date range after you changed it. It now follows the controls bar.\n',
    )
  })

  test('an extension tag prints no deploy and writes no notes', async () => {
    const run = await releaseTagCheck('extension-1.0.0')

    expect(run.code).toBe(0)
    expect(run.stdout).toBe('deploy=false\n')
    expect(existsSync(run.notesFile)).toBe(false)
  })

  test('a refused tag exits 1 with the refusal on stderr, printing nothing to deploy', async () => {
    const run = await releaseTagCheck('2026.11.9')

    expect(run.code).toBe(1)
    expect(run.stdout).toBe('')
    expect(run.stderr).toMatch(
      /does not match the newest app release note in the commit, 2026\.11\.9\.1/,
    )
    expect(existsSync(run.notesFile)).toBe(false)
  })
})
