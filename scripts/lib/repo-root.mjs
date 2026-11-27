// The checkout this script belongs to, and a way to make every relative path in
// the process resolve against it.
//
// WHY THIS IS A CHDIR, NOT A PATH HELPER. A script that resolves a path from
// the caller's working directory reads or writes another checkout when it is run
// by absolute path from somewhere else. Anchoring each path one at a time misses
// the next one nobody has opened. So this normalises the working directory
// itself, once, at the top of a script: after the call, every relative path in
// the process and in every child it spawns resolves against this checkout. The
// test beside this file checks that every script calling a child_process
// function directly calls this first.
//
// It is a NO-OP in normal use. A `pnpm` script already runs with the repo root
// as its working directory, so this only bites when a script is invoked by
// absolute path from somewhere else, which is the case it guards.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The root of the checkout this file belongs to. `scripts/lib` is two levels down. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Make this process, and everything it spawns, run in its own checkout.
 *
 * Call it FIRST, before reading a file, loading `.env`, or spawning anything.
 * Returns the root so a caller that also wants the path does not need a second
 * import.
 */
export function runFromRepoRoot() {
  // UNCONDITIONAL, with no `process.cwd() !== REPO_ROOT` guard in front of it.
  // That guard looks like a free optimisation and is not: `process.cwd()` THROWS
  // `ENOENT (uv_cwd)` when the directory the shell started in has been deleted,
  // which is exactly what happens after a neighbouring worktree is torn down. The
  // chdir itself succeeds from a deleted directory, so the guard could only ever
  // turn a working call into a crash.
  process.chdir(REPO_ROOT)
  return REPO_ROOT
}
