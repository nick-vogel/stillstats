import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  auditLocalEnv,
  exampleNames,
  expectedNames,
  formatAudit,
  interpretChild,
  missingNames,
  scrubbedEnv,
} from './local-env.mjs'

// eng-pipeline#58. `pnpm env:check`
// decrypts this project's `local.env` from the secrets repo (or lays `.env`
// over) into a child and reports which names arrived. These tests pin the pure half: which
// names are expected, which ones the file must never hold, and that the report
// carries names and never a value. The decrypting half needs the `dev` key, so it
// runs on Nick's Mac and never in CI.

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const EXAMPLE = readFileSync(resolve(REPO_ROOT, '.env.example'), 'utf8')

describe('exampleNames', () => {
  it('reads every name set on its own line', () => {
    expect(exampleNames('A=1\nB=\nC=x=y\n')).toEqual(['A', 'B', 'C'])
  })

  // A commented name documents an option, and nobody reaches it by forgetting a file.
  it('skips a commented name', () => {
    expect(exampleNames('# A=1\n#B=\n  # C=x\nD=1\n')).toEqual(['D'])
  })

  it('skips blank lines and prose', () => {
    expect(exampleNames('\n# ---- Database ----\nnot a line\nA=1\n')).toEqual(['A'])
  })
})

describe('expectedNames', () => {
  it('expects every name the file sets, as no name is per-lane here', () => {
    expect(expectedNames('A=1\n# B=\nC=\n')).toEqual(['A', 'C'])
  })
})

describe('the real .env.example', () => {
  // The source files of the two wrapped commands: the migration's CLI and the staging build's
  // token read. The wrapper fails a run on any name the file sets that has not arrived, so a
  // name no wrapped command reads would fail `pnpm migrate` for a value it never uses.
  const READERS = ['packages/database/src/migrate-cli.ts', 'apps/extension/src/staging-access.ts']
  const sources = READERS.map((path) => readFileSync(resolve(REPO_ROOT, path), 'utf8'))
  const names = expectedNames(EXAMPLE)

  it('names only values a wrapped command reads', () => {
    expect(names.filter((name) => !sources.some((source) => source.includes(name)))).toEqual([])
  })

  // Anti-vacuity: an empty file, or a reader that lost its names, would pass the rule above.
  it('names at least one value each wrapped command reads', () => {
    expect(sources.map((source) => names.some((name) => source.includes(name)))).toEqual([
      true,
      true,
    ])
  })
})

describe('missingNames', () => {
  it('lists the expected names the environment lacks', () => {
    expect(missingNames({ expected: ['A', 'B', 'C'], env: { A: '1', C: '' } })).toEqual(['B'])
  })

  // A clone with no Access token still migrates; only the staging build needs one.
  it('counts an empty value as present', () => {
    expect(
      missingNames({ expected: ['CF_ACCESS_CLIENT_ID'], env: { CF_ACCESS_CLIENT_ID: '' } }),
    ).toEqual([])
  })
})

describe('auditLocalEnv', () => {
  const expected = ['A', 'B']

  it('passes when every expected name arrived', () => {
    const audit = auditLocalEnv({ expected, env: { A: '1', B: '' } })
    expect(audit).toEqual({ ok: true, expectedCount: 2, missing: [], laneNames: [], quoted: [] })
  })

  // An empty value still counts: a clone with no Access token migrates all the same.
  it('counts an empty value as present', () => {
    expect(auditLocalEnv({ expected, env: { A: '', B: '' } }).missing).toEqual([])
  })

  it('fails on a missing name, and names it', () => {
    const audit = auditLocalEnv({ expected, env: { A: '1' } })
    expect(audit.ok).toBe(false)
    expect(audit.missing).toEqual(['B'])
  })

  // SOPS gives quotes no special handling, so `BETTER_AUTH_SECRET="abc"` arrives with
  // the quotes as part of the value. dotenv used to strip them, so a file made from
  // an old `.env` can change a value without anyone seeing it.
  it('fails on a value wrapped in quotes, and names it', () => {
    const audit = auditLocalEnv({ expected, env: { A: '"1"', B: "'2'" } })
    expect(audit.ok).toBe(false)
    expect(audit.quoted).toEqual(['A', 'B'])
  })

  it('does not call a value with one inner quote a quoted value', () => {
    expect(auditLocalEnv({ expected, env: { A: 'Riverbed <"x">', B: '"' } }).quoted).toEqual([])
  })
})

describe('formatAudit', () => {
  const SECRET = 'do-not-print-this-value'

  it('prints names and never a value', () => {
    const audit = auditLocalEnv({
      expected: ['A', 'B', 'C'],
      env: { A: `"${SECRET}"`, C: SECRET },
    })
    const text = formatAudit(audit)
    expect(text).toContain('A')
    expect(text).toContain('B')
    expect(text).not.toContain(SECRET)
  })

  it('says PASS only on a passing audit', () => {
    const pass = auditLocalEnv({ expected: ['A'], env: { A: '1' } })
    expect(formatAudit(pass, 'creator-analytics/local.env')).toMatch(
      /^PASS: creator-analytics\/local.env delivers all 1 names/m,
    )
    const fail = auditLocalEnv({ expected: ['A'], env: {} })
    expect(formatAudit(fail)).not.toMatch(/^PASS/m)
  })
})

describe('scrubbedEnv', () => {
  // The decrypting child starts from this, so any expected name it reports can
  // only have come from the file. Without the scrub, a DATABASE_URL exported in
  // the shell would hide a file that lacks one.
  it('removes every expected name', () => {
    const env = scrubbedEnv({
      env: { PATH: '/bin', HOME: '/h', DATABASE_URL: 'x', CF_ACCESS_CLIENT_ID: 'y' },
      expected: ['DATABASE_URL', 'CF_ACCESS_CLIENT_ID'],
    })
    expect(env).toEqual({ PATH: '/bin', HOME: '/h' })
  })

  // The `dev` key lives in the SOPS default key file, so the child needs HOME to
  // find it. Anything that names a key is kept for the same reason.
  it('keeps what SOPS needs to find a key', () => {
    const env = scrubbedEnv({
      env: { HOME: '/h', SOPS_AGE_KEY_FILE: '/k', XDG_CONFIG_HOME: '/c' },
      expected: [],
    })
    expect(env).toEqual({ HOME: '/h', SOPS_AGE_KEY_FILE: '/k', XDG_CONFIG_HOME: '/c' })
  })
})

describe('the scripts that need values run through the env wrapper', () => {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'))
  const wrapped = (name) => pkg.scripts[name]?.startsWith('node scripts/with-env.mjs ') ?? false

  // CI holds no age key and runs `pnpm lint`, `pnpm typecheck`, `pnpm build` and
  // `pnpm test` bare: the tests start their own Postgres and set their own fixed
  // values. The contrast with the wrapped scripts is what makes this a rule
  // rather than a snapshot.
  it('wraps the scripts that need values and leaves the CI scripts bare', () => {
    expect(
      ['migrate', 'build:extension:staging', 'lint', 'typecheck', 'test', 'build'].map(wrapped),
    ).toEqual([true, true, false, false, false, false])
  })
})

describe('interpretChild', () => {
  const SECRET = 'do-not-print-this-value'

  it('reads the verdict the child printed', () => {
    expect(interpretChild({ status: 0, stdout: '{"audit":{"ok":true}}' })).toEqual({
      verdict: { audit: { ok: true } },
    })
  })

  // sops missing from PATH: the cause surfaces as the spawn error's own code.
  it('names the spawn error when sops cannot run', () => {
    const run = {
      error: Object.assign(new Error('spawn sops ENOENT'), { code: 'ENOENT' }),
      status: null,
    }
    expect(interpretChild(run).failure).toMatch(/could not run sops \(ENOENT\)/)
  })

  // No key, or a file sops cannot decrypt: sops has said why on stderr already,
  // and the exit status is carried through so it is not reported as a pass.
  it('carries the sops exit status when the decrypt fails', () => {
    expect(interpretChild({ status: 128, stdout: '' }).failure).toMatch(/exited 128/)
  })

  it('never echoes a child that printed something other than its verdict', () => {
    const result = interpretChild({ status: 0, stdout: `DATABASE_URL=${SECRET}` })
    expect(result.failure).toMatch(/other than its verdict/)
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })
})
