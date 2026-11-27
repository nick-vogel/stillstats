import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { REPO_ROOT } from './repo-root.mjs'

// THE ENFORCEMENT HALF OF `repo-root.mjs`.
//
// That module closes a defect class by normalising the working directory, but only
// for scripts that actually CALL it. A convention nobody checks is how this class
// reached five instances across four review rounds in the first place: each fix
// anchored the one path someone had found, and the next instance was a file nobody
// had opened.
//
// So the rule is mechanical here rather than remembered: a script that spawns a
// child process must run in its own checkout first, because a child inherits the
// parent's working directory and will otherwise resolve its own relative paths
// against whatever directory the operator was standing in. For the migration gates
// that meant running ANOTHER checkout's migration against a database, which is a
// wrong write rather than a wrong verdict.

const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Scripts that read the checkout they are CALLED from, on purpose, so they must not move to
 * their own. `check-private-terms.mjs` checks the repository its caller is in: the local
 * pre-push hook runs a copy of the pushed commit's version from a temporary folder, inside the
 * repository being pushed, and its tests run it inside scratch repositories. Moving it to its own
 * checkout would check the wrong repository and pass. Its test spawns it the same way.
 */
const READS_THE_CALLERS_CHECKOUT = ['check-private-terms.mjs', 'check-private-terms.test.mjs']

/** Every `.mjs` in `scripts/`, excluding the `lib/` helpers themselves and the scripts above. */
const scriptFiles = readdirSync(SCRIPTS_DIR)
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => !READS_THE_CALLERS_CHECKOUT.includes(f))
  .map((f) => ({ name: f, source: readFileSync(join(SCRIPTS_DIR, f), 'utf8') }))

/** Comment lines stripped, so a mention in prose is never mistaken for a call. */
const codeOf = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

/** The child_process entry points that launch something. */
const SPAWN_NAMES = ['execSync', 'execFileSync', 'spawnSync', 'execFile', 'spawn', 'exec', 'fork']

/**
 * Does this source spawn a child process, and where does it first do so?
 * Returns `-1` when it does not.
 *
 * TWO WRONG VERSIONS PRECEDED THIS ONE, and both are the reason it is written the
 * way it is. Keeping the history because a detector is the last place a mistake
 * gets noticed: it fails silently, by reporting coverage.
 *
 *   1. `/\b(exec|spawn|...)\s*\(/` FLAGGED FILES THAT SPAWN NOTHING.
 *      `RegExp.prototype.exec` is spelled `re.exec(...)`, and `\b` matches between
 *      the dot and the name. Four innocent scripts were reported. A detector with
 *      false positives gets relaxed by the next person who trips it.
 *   2. Parsing the file's `node:child_process` import fixed that and introduced a
 *      worse failure: it MISSED. Riverbed's `gate-optimistic-sources.mjs` spawns through
 *      `const { execFileSync } = await import('node:child_process')`, which is not
 *      a static named import, so the detector returned -1 and both enforcement
 *      cases silently skipped the file. It also missed a double-quoted specifier,
 *      a bare `'child_process'`, `import * as cp`, and `require`.
 *
 * So it no longer tries to model HOW the module arrives. It asks two cheap
 * questions instead: does this file reference `child_process` at all, in any
 * spelling, and does it then CALL one of the launcher names as a bare identifier?
 * The negative lookbehind is what fixes version 1, and refusing to parse the import
 * is what fixes version 2.
 */
const firstSpawnIndex = (code) => {
  // A file that never names the module cannot spawn through it. This is what keeps
  // `re.exec(...)` in an unrelated script from being considered at all.
  if (!code.includes('child_process')) return -1

  // Bare identifier only: `re.exec(` and `foo.spawn(` are excluded by the lookbehind.
  const call = new RegExp(String.raw`(?<![.\w$])(${SPAWN_NAMES.join('|')})\s*\(`)
  return code.search(call)
}

describe('repo-root', () => {
  it('resolves the checkout containing scripts/', () => {
    expect(SCRIPTS_DIR).toBe(join(REPO_ROOT, 'scripts'))
  })

  it('names a checkout that has this project in it', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('creator-analytics')
  })
})

describe('every script that spawns a child runs in its own checkout first', () => {
  // Anti-vacuity. If the detector ever stops matching, this whole block passes by
  // finding nothing to check, which is the failure mode it exists to prevent.
  // In this repo the one direct spawner is `pnpm env:check`. The env wrapper
  // spawns through `lib/run-child.mjs`, and runs from its root all the same.
  it('finds the spawning scripts at all', () => {
    const spawners = scriptFiles
      .filter((f) => firstSpawnIndex(codeOf(f.source)) !== -1)
      .map((f) => f.name)
    expect(spawners).toContain('check-local-env.mjs')
  })

  // The detector's own false-positive mode, pinned. `re.exec(...)` is not a spawn,
  // and matching it is what the first version of this file did.
  it('does not mistake RegExp.prototype.exec for spawning a process', () => {
    expect(firstSpawnIndex('const m = /x/.exec(s)\nconst n = re.exec(s)')).toBe(-1)
    expect(firstSpawnIndex("import { readFileSync } from 'node:fs'\nre.exec(s)")).toBe(-1)
  })

  // EVERY SPELLING THE PREVIOUS VERSION MISSED, pinned. The dynamic-import case is
  // not hypothetical: Riverbed's gate-optimistic-sources.mjs uses it, and the detector skipped
  // that file entirely while both enforcement cases reported green.
  it('sees a spawn however the module was brought in', () => {
    const spellings = [
      "import { execSync } from 'node:child_process'\nexecSync('ls')",
      'import { execSync } from "node:child_process"\nexecSync("ls")',
      "import { execSync } from 'child_process'\nexecSync('ls')",
      "const { execFileSync } = await import('node:child_process')\nexecFileSync('git', [])",
      "import * as cp from 'node:child_process'\nspawnSync('ls')",
      "const { spawn } = require('child_process')\nspawn('ls')",
    ]
    for (const code of spellings) {
      expect(firstSpawnIndex(code), `missed: ${code.split('\n')[0]}`).toBeGreaterThan(-1)
    }
  })

  it('has every one of them call runFromRepoRoot', () => {
    const offenders = scriptFiles
      .filter((f) => firstSpawnIndex(codeOf(f.source)) !== -1)
      .filter((f) => !/runFromRepoRoot\s*\(/.test(codeOf(f.source)))
      .map((f) => f.name)

    expect(
      offenders,
      `these spawn a child process without first running in their own checkout, so the child ` +
        `resolves its paths against the caller's directory: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  // The call has to come BEFORE the spawn, or the child is already launched from
  // the wrong directory by the time it happens.
  it('calls it before the first spawn, not after', () => {
    const outOfOrder = scriptFiles
      .filter((f) => firstSpawnIndex(codeOf(f.source)) !== -1)
      .filter((f) => {
        const code = codeOf(f.source)
        const call = code.search(/runFromRepoRoot\s*\(/)
        return call === -1 || call > firstSpawnIndex(code)
      })
      .map((f) => f.name)

    expect(
      outOfOrder,
      `runFromRepoRoot must run before the first spawn in: ${outOfOrder.join(', ')}`,
    ).toEqual([])
  })
})
