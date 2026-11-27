// The local environment, and what it must and must never hold (eng-pipeline#58).
// It is a copy of phon's `scripts/lib/local-env.mjs`, itself a twin of Riverbed's
// and one private repository's, so a fix belongs in all four.
//
// The values come from this project's `local.env` in the private secrets repo,
// encrypted with SOPS to the `dev` key and the recovery key, or from the root
// `.env` in a clone with no secrets repo. `scripts/with-env.mjs` delivers them to each
// `pnpm` script. The standard is `~/.claude/docs/secrets.md`.
//
// PER-LANE NAMES. In Riverbed these are the names that differ per worktree (the
// database, the mail port, the app origins), which the file must never hold.
// This repo has none: no wrapped script is a lane's dev server (the migration and
// the extension's staging build), and `pnpm test` makes its own database. So the
// list is empty. The mechanism stays, so a later per-lane name is added
// here and nowhere else.
//
// `sops exec-env` puts the decrypted values AFTER the inherited environment, so a
// name in the file wins over the same name in `.env` or the shell.
//
// This module is the pure half of `pnpm env:check` (scripts/check-local-env.mjs)
// and of the wrapper's name check. It decides and formats; it never decrypts and
// never prints a value.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The names that differ per worktree, and so never go in the local env file. None in this repo. */
export const PER_LANE_NAMES = Object.freeze([])

const NAME_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=/

/** Every name `.env.example` sets on a line of its own. A commented name is skipped. */
export function exampleNames(text) {
  const names = []
  for (const line of text.split(/\r?\n/)) {
    const match = NAME_LINE.exec(line)
    if (match && !names.includes(match[1])) names.push(match[1])
  }
  return names
}

/** The names the local env must deliver: `.env.example`'s, less the per-lane ones. */
export function expectedNames(exampleText) {
  return exampleNames(exampleText).filter((name) => !PER_LANE_NAMES.includes(name))
}

/** The names the local env must deliver, read from the checkout's `.env.example`. */
export function readExpectedNames(root) {
  return expectedNames(readFileSync(join(root, '.env.example'), 'utf8'))
}

/** The expected names the environment lacks. An empty value counts as present. */
export function missingNames({ expected, env }) {
  return expected.filter((name) => env[name] === undefined)
}

/**
 * The environment the decrypting child starts from: the caller's, with every
 * expected and per-lane name removed.
 *
 * Any of those names the child then sees can only have come from the file. That
 * is what makes the audit a statement about the FILE and not about the shell it
 * was run from.
 */
export function scrubbedEnv({ env = process.env, expected }) {
  const drop = new Set([...expected, ...PER_LANE_NAMES])
  return Object.fromEntries(Object.entries(env).filter(([name]) => !drop.has(name)))
}

function isQuoted(value) {
  if (value.length < 2) return false
  const first = value[0]
  return (first === '"' || first === "'") && value.at(-1) === first
}

/**
 * The verdict on what arrived from the file.
 *
 * `missing`: expected names that did not arrive. An empty value counts as
 * present: a clone that has no Access token can still migrate.
 * `laneNames`: per-lane names that did arrive, which the file must never hold.
 * `quoted`: expected names whose whole value is wrapped in matching quotes. SOPS
 * gives quotes no special handling and dotenv stripped them, so a file made from
 * an old `.env` can change a value with nobody seeing it.
 */
export function auditLocalEnv({ expected, env }) {
  const missing = missingNames({ expected, env })
  const laneNames = PER_LANE_NAMES.filter((name) => env[name] !== undefined)
  const quoted = expected.filter((name) => typeof env[name] === 'string' && isQuoted(env[name]))
  return {
    ok: missing.length === 0 && laneNames.length === 0 && quoted.length === 0,
    expectedCount: expected.length,
    missing,
    laneNames,
    quoted,
  }
}

/** The report, as text. Names only: no value ever reaches this function's output. */
export function formatAudit(audit, source = 'the local env') {
  const lines = []
  if (audit.ok) {
    if (PER_LANE_NAMES.length === 0) {
      lines.push(`PASS: ${source} delivers all ${audit.expectedCount} names from .env.example.`)
    } else {
      lines.push(`PASS: ${source} delivers all ${audit.expectedCount} names from .env.example`)
      lines.push('      except the per-lane ones, and holds no per-lane name.')
    }
    return lines.join('\n')
  }
  lines.push(`FAIL: ${source} is not the local environment this repo expects.`)
  if (audit.missing.length) {
    lines.push('  Missing, named in .env.example (an empty value is fine):')
    for (const name of audit.missing) lines.push(`    ${name}`)
  }
  if (audit.laneNames.length) {
    lines.push(
      '  Per-lane, and must not be in the file (each one beats the derived value in every lane):',
    )
    for (const name of audit.laneNames) lines.push(`    ${name}`)
  }
  if (audit.quoted.length) {
    lines.push('  Wrapped in quotes, which SOPS keeps as part of the value:')
    for (const name of audit.quoted) lines.push(`    ${name}`)
  }
  lines.push(
    '  Fix it in your own terminal: sops edit <project>/local.env from the secrets repo root, or edit .env.',
  )
  return lines.join('\n')
}

/**
 * What the decrypting child's run means, from `spawnSync`'s result.
 *
 * `{ verdict }` when the child printed one. Otherwise `{ failure }`, a line that
 * carries the cause (the spawn error's code, or sops's exit status, whose own
 * message is already on stderr). The child's stdout is never echoed: it ran with
 * the decrypted values, so a child that printed something unexpected may have
 * printed one of them.
 */
export function interpretChild(run) {
  if (run.error) {
    return {
      failure: `FAIL: could not run sops (${run.error.code ?? run.error.message}). Is it installed?`,
    }
  }
  if (run.status !== 0) {
    return { failure: `FAIL: sops exec-env exited ${run.status}. Its own message is above.` }
  }
  try {
    return { verdict: JSON.parse(run.stdout) }
  } catch {
    return { failure: 'FAIL: the decrypting child printed something other than its verdict.' }
  }
}
