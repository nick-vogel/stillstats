#!/usr/bin/env bash
# Pre-PR review 1, finding 2. Run from the repo root, with the Fontshare fonts in
# packages/visual-system/fonts/ (`pnpm fonts`). It points Switzer's url() at a folder that does not
# exist, in a scratch worktree of HEAD, and runs the stylesheet test there.
# Today: the test passes (9 passed). After the fix: the test fails on Switzer's path.
set -euo pipefail
root=$(pwd)
scratch=$(mktemp -d)
trap 'git -C "$root" worktree remove -f -f "$scratch/tree" >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
git worktree add -q --detach "$scratch/tree" HEAD
cd "$scratch/tree"
pnpm install --frozen-lockfile >/dev/null
cp "$root"/packages/visual-system/fonts/{CabinetGrotesk-Variable.woff2,Switzer-Variable.woff2,LICENSE-ITF-FFL.txt} packages/visual-system/fonts/
sed -i.bak 's#url("../fonts/Switzer-Variable.woff2")#url("../fontz/Switzer-Variable.woff2")#' packages/visual-system/src/styles.css
grep -q 'fontz/Switzer' packages/visual-system/src/styles.css
pnpm exec vitest run packages/visual-system/test/styles.test.ts
