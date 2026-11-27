import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { expectedNames } from './local-env.mjs'

// eng-pipeline#58. The paths of `node scripts/with-env.mjs` where it refuses or
// cannot start, run for real. None of them reaches a profile's command, and none
// decrypts anything: each one stops before `sops` runs, or finds no `sops`.

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const WRAPPER = join(REPO_ROOT, 'scripts', 'with-env.mjs')
const EXPECTED = expectedNames(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'))

/** A PATH that holds this node and nothing else, so `sops` cannot be found. */
function nodeOnlyPath() {
  const dir = mkdtempSync(join(tmpdir(), 'with-env-path-'))
  symlinkSync(process.execPath, join(dir, 'node'))
  return dir
}

/** The shell's environment with every name `.env.example` sets taken out. */
function shellWithoutExpected(extra) {
  const env = { ...process.env, ...extra }
  for (const name of EXPECTED) delete env[name]
  return env
}

const wrapper = (args, env, script = WRAPPER) =>
  spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, env, encoding: 'utf8' })

/** A copy of this checkout's wrapper, package.json and .env.example, so a test can add files. */
function checkoutCopy() {
  const root = mkdtempSync(join(tmpdir(), 'with-env-copy-'))
  cpSync(join(REPO_ROOT, 'scripts'), join(root, 'scripts'), { recursive: true })
  for (const file of ['package.json', '.env.example'])
    cpSync(join(REPO_ROOT, file), join(root, file))
  mkdirSync(join(root, 'apps', 'extension'), { recursive: true })
  return root
}

describe('with-env, where it stops', () => {
  it('refuses an unknown profile with exit 2, before it looks for any value', () => {
    const run = wrapper(['env'], process.env)
    expect(run.status).toBe(2)
    expect(run.stderr).toMatch(/"env" is not a profile/)
  })

  // An outside clone that has not made its `.env` yet: no secrets repo, no
  // `.env`, and nothing in the shell. The inner step's name check is the backstop.
  // It runs in a copy of the checkout, which has no `.env` even where this one does.
  it('fails with exit 1 and names the missing names when there is no source at all', () => {
    const root = checkoutCopy()
    const run = wrapper(
      ['migrate'],
      shellWithoutExpected({ SOPS_ENV_DIR: mkdtempSync(join(tmpdir(), 'no-envs-')) }),
      join(root, 'scripts', 'with-env.mjs'),
    )
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(
      /no .*creator-analytics\/local\.env, so the values come from the shell alone/,
    )
    expect(run.stderr).toMatch(/FAIL: these names from \.env\.example have no value/)
    expect(run.stderr).toContain('  MIGRATION_DATABASE_URL')
  })

  // The secrets repo holds the file, but this machine has no `sops`.
  it('fails with exit 1 and a hint when the secrets repo has the file and sops is missing', () => {
    const envs = mkdtempSync(join(tmpdir(), 'envs-'))
    mkdirSync(join(envs, 'creator-analytics'))
    writeFileSync(join(envs, 'creator-analytics', 'local.env'), '')
    const run = wrapper(['migrate'], {
      ...process.env,
      SOPS_ENV_DIR: envs,
      PATH: nodeOnlyPath(),
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/with-env: could not run sops \(ENOENT\)\. Is it installed\?/)
  })

  // WXT would load the extension's own env file into the staging build, so the wrapper refuses
  // before it looks for a value, and names the file.
  it("fails with exit 1 and names a stray env file in the extension's folder", () => {
    const root = checkoutCopy()
    writeFileSync(
      join(root, 'apps', 'extension', '.env.staging.local'),
      'CF_ACCESS_CLIENT_ID=stray\n',
    )
    const run = wrapper(
      ['build:extension:staging'],
      process.env,
      join(root, 'scripts', 'with-env.mjs'),
    )
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/WXT would read these files ahead of the local env/)
    expect(run.stderr).toContain('  apps/extension/.env.staging.local')
    expect(run.stderr).not.toContain('stray')
  })
})

describe('env:check, with no secrets repo', () => {
  const check = (root) =>
    spawnSync(process.execPath, [join(root, 'scripts', 'check-local-env.mjs')], {
      cwd: root,
      env: shellWithoutExpected({ SOPS_ENV_DIR: mkdtempSync(join(tmpdir(), 'no-envs-')) }),
      encoding: 'utf8',
    })

  it('fails with exit 1 when there is no secrets repo file and no .env', () => {
    const root = checkoutCopy()
    const run = check(root)
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/FAIL: there is no .*creator-analytics\/local\.env and no \.env/)
  })

  // The move deletes the extension's env file only after this check passes, so the check warns
  // about the file and still passes, or it would block the file's own deletion.
  it("passes with a warning that names a stray file in the extension's folder", () => {
    const root = checkoutCopy()
    cpSync(join(root, '.env.example'), join(root, '.env'))
    writeFileSync(join(root, 'apps', 'extension', '.env.staging.local'), 'CF_ACCESS_CLIENT_ID=x\n')
    const run = check(root)
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/^PASS: \.env delivers all \d+ names/m)
    expect(run.stdout).toMatch(/^WARN: pnpm build:extension:staging refuses to run/m)
    expect(run.stdout).toContain('  apps/extension/.env.staging.local')
  })
})
