import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// eng-pipeline#53. Every launcher that runs one child (here, the env wrapper) hands its exit status back to pnpm, and passes Ctrl-C on. A launcher
// that reports 0 when its dev server was interrupted tells pnpm, and any
// script chained after it, that the run passed.

const RUN_CHILD = join(import.meta.dirname, 'run-child.mjs')

/** A launcher script that runs `command args` through runChild. */
function launcher(command, args) {
  const dir = mkdtempSync(join(tmpdir(), 'run-child-'))
  const file = join(dir, 'launch.mjs')
  writeFileSync(
    file,
    `import { runChild } from ${JSON.stringify(RUN_CHILD)}\n` +
      `runChild({ command: ${JSON.stringify(command)}, args: ${JSON.stringify(args)}, cwd: ${JSON.stringify(dir)}, env: process.env, name: 'test' })\n`,
  )
  return file
}

describe('runChild', () => {
  it("exits with the child's exit code", () => {
    const run = spawnSync(process.execPath, [launcher('/bin/sh', ['-c', 'exit 7'])])
    expect(run.status).toBe(7)
  })

  // The bug this replaces: the launcher's own SIGINT listener was still attached
  // when it re-raised the signal on itself, so the re-raise was caught and the
  // process exited 0.
  it('dies of the same signal when the child is interrupted', async () => {
    const child = spawn(process.execPath, [launcher('/bin/sleep', ['30'])], { stdio: 'ignore' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    child.kill('SIGINT')
    const [code, signal] = await new Promise((resolve) =>
      child.on('exit', (...result) => resolve(result)),
    )
    expect({ code, signal }).toEqual({ code: null, signal: 'SIGINT' })
  })

  it('exits 1 and names the command when it cannot start', () => {
    const run = spawnSync(process.execPath, [launcher('/no/such/command', [])], {
      encoding: 'utf8',
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/test: could not run \/no\/such\/command \(ENOENT\)/)
  })

  // Node reports ENOENT later, as an 'error' event, but throws any other spawn
  // error at once. A file on PATH (Nick's has /opt/homebrew/bin/mongod) makes
  // the lookup of a missing command fail with ENOTDIR, which used to escape as a
  // stack trace instead of this one line.
  it('exits 1 and names the command when the PATH lookup fails with ENOTDIR', () => {
    const fileOnPath = join(mkdtempSync(join(tmpdir(), 'run-child-path-')), 'not-a-dir')
    writeFileSync(fileOnPath, '')
    const run = spawnSync(process.execPath, [launcher('no-such-command', [])], {
      encoding: 'utf8',
      env: { PATH: fileOnPath },
    })
    expect(run.stderr).toMatch(/test: could not run no-such-command \(ENOTDIR\)/)
    expect(run.status).toBe(1)
  })
})
