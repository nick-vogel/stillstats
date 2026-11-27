import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  childEnv,
  localEnvFile,
  localEnvSource,
  outerSpawn,
  PACKAGE_ENV_DIRS,
  PROFILES,
  profileArgv,
  readDotenv,
  secretsDir,
  shadowedNames,
  strayEnvFiles,
} from './with-env.mjs'

// eng-pipeline#58. This repo's local env lives in the private secrets repo, cloned at
// `~/.config/sops/envs`, as `creator-analytics/local.env`. `node scripts/with-env.mjs <profile>` finds it from
// the `name` in package.json, lays the file over the root `.env` over the shell, checks the names
// `.env.example` sets, and runs one fixed command per profile. These tests cover the half that
// decrypts nothing.

const HOME = '/Users/someone'
const NODE = '/opt/node/bin/node'

describe('secretsDir', () => {
  it('is ~/.config/sops/envs by default', () => {
    expect(secretsDir({ env: {}, home: HOME })).toBe(join(HOME, '.config', 'sops', 'envs'))
  })

  it('is SOPS_ENV_DIR when it is set', () => {
    expect(secretsDir({ env: { SOPS_ENV_DIR: '/srv/envs' }, home: HOME })).toBe('/srv/envs')
  })

  it('ignores an empty SOPS_ENV_DIR', () => {
    expect(secretsDir({ env: { SOPS_ENV_DIR: '' }, home: HOME })).toBe(
      join(HOME, '.config', 'sops', 'envs'),
    )
  })
})

describe('localEnvFile', () => {
  // The package name, not the folder, so every lane worktree (creator-analytics-1037,
  // creator-analytics-eng-pipeline-58) reads the same file.
  it('names the project folder from package.json, not from the worktree', () => {
    expect(localEnvFile({ dir: '/srv/envs', pkgName: 'creator-analytics' })).toBe(
      '/srv/envs/creator-analytics/local.env',
    )
  })

  it('refuses a package name that is not a bare folder name', () => {
    for (const bad of ['', '../creator-analytics', '@creator-analytics/api', 'Creator Analytics']) {
      expect(() => localEnvFile({ dir: '/srv/envs', pkgName: bad })).toThrow(/package name/)
    }
  })
})

describe('childEnv', () => {
  // The SOPS file is laid on top by `sops exec-env` itself, which sets the decrypted values after
  // the inherited ones. So the wrapper builds only the two lower layers: `.env` over the shell.
  it('lays .env over the shell', () => {
    expect(
      childEnv({
        env: { A: 'shell', B: 'shell' },
        dotenv: { B: 'dotenv', C: 'dotenv' },
        sopsFile: false,
      }),
    ).toEqual({ env: { A: 'shell', B: 'dotenv', C: 'dotenv' }, dropped: [] })
  })

  it('is the shell alone when there is no .env', () => {
    expect(childEnv({ env: { A: 'shell' }, dotenv: null, sopsFile: true })).toEqual({
      env: { A: 'shell' },
      dropped: [],
    })
  })

  // This repo has no per-lane names, so with the SOPS file in use nothing is dropped from `.env`.
  it('drops nothing from .env when the SOPS file is in use, since no name is per-lane', () => {
    const dotenv = { DATABASE_URL: 'postgres://127.0.0.1:5432/creator_analytics', A: '1' }
    expect(childEnv({ env: { PATH: '/bin' }, dotenv, sopsFile: true })).toEqual({
      env: { PATH: '/bin', DATABASE_URL: 'postgres://127.0.0.1:5432/creator_analytics', A: '1' },
      dropped: [],
    })
  })
})

describe('localEnvSource', () => {
  /** A checkout whose package.json names `creator-analytics`, and a secrets repo that may hold its file. */
  function setup({ withFile }) {
    const root = mkdtempSync(join(tmpdir(), 'with-env-root-'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'creator-analytics' }))
    const dir = mkdtempSync(join(tmpdir(), 'with-env-envs-'))
    if (withFile) {
      mkdirSync(join(dir, 'creator-analytics'))
      writeFileSync(join(dir, 'creator-analytics', 'local.env'), '')
    }
    return { root, env: { SOPS_ENV_DIR: dir }, dir }
  }

  it("names the project's file in the secrets repo when it exists", () => {
    const { root, env, dir } = setup({ withFile: true })
    expect(localEnvSource({ root, env, home: HOME })).toEqual({
      file: join(dir, 'creator-analytics', 'local.env'),
      exists: true,
    })
  })

  it('says the file is absent when the secrets repo does not hold it', () => {
    const { root, env, dir } = setup({ withFile: false })
    expect(localEnvSource({ root, env, home: HOME })).toEqual({
      file: join(dir, 'creator-analytics', 'local.env'),
      exists: false,
    })
  })
})

describe('outerSpawn', () => {
  const base = {
    execPath: NODE,
    self: '/repo/scripts/with-env.mjs',
    profile: 'migrate',
    args: ['--verbose'],
  }

  // `sops exec-env` takes one file and one command string for `/bin/sh -c`. The wrapper builds
  // the string itself, so an argument pnpm appends survives.
  it('runs the inner step inside sops exec-env when the secrets repo has the file', () => {
    expect(outerSpawn({ ...base, envFile: '/srv/envs/creator-analytics/local.env' })).toEqual({
      command: 'sops',
      args: [
        'exec-env',
        '/srv/envs/creator-analytics/local.env',
        `'${NODE}' '/repo/scripts/with-env.mjs' '--inner' 'migrate' '--verbose'`,
      ],
    })
  })

  // An outside clone has no secrets repo and no SOPS, and runs from `.env`.
  it('runs the inner step directly, with no sops, when there is no file', () => {
    expect(outerSpawn({ ...base, envFile: null })).toEqual({
      command: NODE,
      args: ['/repo/scripts/with-env.mjs', '--inner', 'migrate', '--verbose'],
    })
  })

  it('quotes an argument so a quote inside it cannot end the shell string', () => {
    const { args } = outerSpawn({ ...base, envFile: '/f', args: ["a'; env; '"] })
    expect(args[2]).toMatch(/'a'\\''; env; '\\'''$/)
  })
})

describe('profileArgv', () => {
  // Each runs its package's own script through `pnpm --filter`, the same script CI and the images
  // run bare, with the arguments pnpm appends last.
  it("runs the database package's migrate for migrate", () => {
    expect(profileArgv({ profile: 'migrate', args: ['--verbose'] })).toEqual([
      'pnpm',
      '--filter',
      '@creator-analytics/database',
      'migrate',
      '--verbose',
    ])
  })

  it("runs the extension package's build:staging for build:extension:staging", () => {
    expect(profileArgv({ profile: 'build:extension:staging', args: [] })).toEqual([
      'pnpm',
      '--filter',
      '@creator-analytics/extension',
      'build:staging',
    ])
  })

  // The wrapper runs a fixed command per profile. A command of the caller's choosing, such as
  // `env`, would print every decrypted value.
  it('refuses a profile it does not know', () => {
    expect(() => profileArgv({ profile: 'env', args: [] })).toThrow(/not a profile/)
  })
})

describe('strayEnvFiles', () => {
  /** A checkout with the extension's folder, holding the named files. */
  function checkout(files) {
    const root = mkdtempSync(join(tmpdir(), 'with-env-stray-'))
    mkdirSync(join(root, 'apps', 'extension'), { recursive: true })
    for (const file of files) writeFileSync(join(root, file), '')
    return root
  }

  // WXT loads every `.env`, `.env.<mode>` and `.env.<mode>.<browser>` file in the extension's
  // folder, each with a `.local` twin, into the build's environment. Any name such a file sets
  // that the SOPS file does not would reach the build.
  it("names the extension's .env files for the staging build", () => {
    const root = checkout([
      'apps/extension/.env',
      'apps/extension/.env.local',
      'apps/extension/.env.staging.local',
      'apps/extension/.env.staging.chrome',
    ])
    expect(strayEnvFiles({ root, profile: 'build:extension:staging' })).toEqual([
      'apps/extension/.env',
      'apps/extension/.env.local',
      'apps/extension/.env.staging.chrome',
      'apps/extension/.env.staging.local',
    ])
  })

  // The migration reads no package env file, so the extension's file in Nick's main clone, which
  // stays until the move's last step, never stops `pnpm migrate`.
  it('never stops the migration, which reads no package env file', () => {
    const root = checkout(['apps/extension/.env.staging.local'])
    expect(strayEnvFiles({ root, profile: 'migrate' })).toEqual([])
  })

  // `pnpm env:check` asks about every profile's folders at once.
  it("names every profile's files when no profile is given", () => {
    const root = checkout(['apps/extension/.env.staging.local'])
    expect(strayEnvFiles({ root })).toEqual(['apps/extension/.env.staging.local'])
  })

  it('passes a template, the root .env and an unrelated file', () => {
    const root = checkout([
      'apps/extension/.env.example',
      '.env',
      'apps/extension/.envrc',
      'apps/extension/wxt.config.ts',
    ])
    expect(strayEnvFiles({ root, profile: 'build:extension:staging' })).toEqual([])
  })

  // A new profile must say which package env files its command reads, or the outer step would
  // look up a missing entry.
  it('has an entry for every profile, and only for a profile', () => {
    expect(Object.keys(PACKAGE_ENV_DIRS).sort()).toEqual(Object.keys(PROFILES).sort())
  })
})

describe('readDotenv', () => {
  it('parses the root .env', () => {
    const root = mkdtempSync(join(tmpdir(), 'with-env-dotenv-'))
    writeFileSync(join(root, '.env'), 'A=1\nB=\n')
    expect(readDotenv(root)).toEqual({ A: '1', B: '' })
  })

  it('is null when the checkout has no .env', () => {
    expect(readDotenv(mkdtempSync(join(tmpdir(), 'with-env-dotenv-')))).toBeNull()
  })
})

describe('shadowedNames', () => {
  // A stray `.env` in Nick's checkout never wins over the SOPS file, and the wrapper says so by
  // name when the two disagree.
  it('names each .env value the environment no longer holds', () => {
    expect(
      shadowedNames({ dotenv: { A: 'old', B: 'same' }, env: { A: 'new', B: 'same' } }),
    ).toEqual(['A'])
  })

  it('is empty with no .env', () => {
    expect(shadowedNames({ dotenv: null, env: { A: '1' } })).toEqual([])
  })
})

describe('package.json', () => {
  const scripts = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
  ).scripts

  // The encrypted files live in the secrets repo, so a script that names `sops` or `secrets/`
  // would fail in every checkout.
  it('runs no script through sops directly', () => {
    expect(Object.entries(scripts).filter(([, line]) => /\bsops\b|secrets\//.test(line))).toEqual(
      [],
    )
  })

  // Anti-vacuity: every profile has its script, and each wrapped script names a known profile.
  it('runs every profile, and only a known profile, through the wrapper', () => {
    const wrapped = Object.values(scripts)
      .map((line) => /^node scripts\/with-env\.mjs (\S+)$/.exec(line)?.[1])
      .filter(Boolean)
    expect(wrapped.sort()).toEqual(Object.keys(PROFILES).sort())
  })
})
