#!/usr/bin/env bash
# Pre-PR review 1, finding 4. Run from the repo root, with the Fontshare fonts in
# packages/visual-system/fonts/ (`pnpm fonts`). Works in a scratch worktree of HEAD.
# Case 1: a source folder that holds the two fonts but no licence.
#   Today: the script throws, but both fonts are already copied in (the listing shows them).
#   After the fix: it throws before it copies anything, and the listing shows only JetBrains Mono.
# Case 2: `pnpm fonts --from .stillstats-fonts` from the repo root, with the folder there.
#   Today: it fails and blames the fonts repository, with the relative path only.
#   After the fix: the error names the absolute folder it read, or the copy succeeds.
set -uo pipefail
root=$(pwd)
scratch=$(mktemp -d)
trap 'git -C "$root" worktree remove -f -f "$scratch/tree" >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
git worktree add -q --detach "$scratch/tree" HEAD
cd "$scratch/tree"
pnpm install --frozen-lockfile >/dev/null
mkdir "$scratch/no-licence"
cp "$root"/packages/visual-system/fonts/{CabinetGrotesk-Variable.woff2,Switzer-Variable.woff2} "$scratch/no-licence/"
echo "=== case 1"
node packages/visual-system/src/fetch-fonts-cli.ts --from "$scratch/no-licence" 2>&1 | grep '^Error'
ls packages/visual-system/fonts/
echo "=== case 2"
mkdir .stillstats-fonts
cp "$root"/packages/visual-system/fonts/{CabinetGrotesk-Variable.woff2,Switzer-Variable.woff2,LICENSE-ITF-FFL.txt} .stillstats-fonts/
pnpm fonts --from .stillstats-fonts 2>&1 | grep -E '^Error|Copied'
