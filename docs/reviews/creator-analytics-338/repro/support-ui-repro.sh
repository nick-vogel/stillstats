#!/bin/sh
# Usage: sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>
# Adds a detached worktree at HEAD under <scratch-dir>, appends the repro block to
# apps/web/src/app.test.ts there, runs only that block, and removes the worktree.
set -eu
repo=$(git rev-parse --show-toplevel)
here="$repo/docs/reviews/creator-analytics-338/repro"
dir="$1/support-ui-repro"
git -C "$repo" worktree add --detach "$dir" HEAD >/dev/null
trap 'git -C "$repo" worktree remove --force "$dir"' EXIT
cd "$dir"
pnpm install --frozen-lockfile --offline >/dev/null
cat "$here/support-ui-repro.block" >> apps/web/src/app.test.ts
pnpm exec vitest run apps/web/src/app.test.ts -t 'pre-PR review 1 repro'
