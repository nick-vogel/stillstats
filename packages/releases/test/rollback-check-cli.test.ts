// The rollback workflow runs this command in a checkout of the newest release tag and reads its
// stdout into $GITHUB_OUTPUT, so these tests hold what the workflow reads: the output line, and the
// exit code that stops the workflow before latest moves.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { fixtureContentRoot } from './testing.ts'

const cli = fileURLToPath(new URL('../src/rollback-check-cli.ts', import.meta.url))

interface Run {
  code: number
  stdout: string
  stderr: string
}

async function rollbackCheck(args: string[], contentRoot = fixtureContentRoot): Promise<Run> {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [cli, ...args], {
      env: { ...process.env, RELEASE_CONTENT_ROOT: contentRoot },
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string }
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr }
  }
}

function note(removes: boolean): string {
  return `---\nproduct: app\ndate: 2026-11-10\nsummary: A release.\nhighlights: []\nremoves: ${removes}\n---\n\nA release.\n`
}

/** A content root of its own, so the shared fixture root the site builds from stays untouched. */
async function contentRootWithARemoveRelease(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'rollback-check-'))
  await mkdir(join(root, 'notes'))
  await writeFile(join(root, 'notes', '2026.11.10.md'), note(false))
  await writeFile(join(root, 'notes', '2026.11.10.1.md'), note(true))
  await writeFile(join(root, 'notes', '2026.11.10.2.md'), note(false))
  return root
}

describe('the rollback check command', () => {
  test('a rollback past no remove release prints the version to roll back to', async () => {
    const run = await rollbackCheck(['--version', '2026.11.9'])

    expect(run.code).toBe(0)
    expect(run.stdout).toBe('version=2026.11.9\n')
  })

  test('a rollback past a remove release exits 1 with the refusal on stderr, printing nothing', async () => {
    const run = await rollbackCheck(
      ['--version', '2026.11.10'],
      await contentRootWithARemoveRelease(),
    )

    expect(run.code).toBe(1)
    expect(run.stdout).toBe('')
    expect(run.stderr).toMatch(/past 2026\.11\.10\.1, which removes something/)
  })

  test('a missing version exits 1 with the usage, printing nothing', async () => {
    const run = await rollbackCheck([])

    expect(run.code).toBe(1)
    expect(run.stdout).toBe('')
    expect(run.stderr).toMatch(/Usage: rollback-check --version <version>/)
  })
})
