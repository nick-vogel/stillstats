#!/bin/sh
# Pre-PR review 1 of creator-analytics#359, finding 1.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, plants one stroke at a time on the
# audience retention lines (apps/web/src/retention-plot.ts, the shared `line` style), runs the
# series colour test, and prints each plant's vitest exit code. 1 means the test caught the plant.
# The live worktree is never touched. Needs Docker, as `pnpm test` does.
#
# At 73a1c3f: control-hex exits 1, and spacing-token, font-token and stroke-none exit 0. After the
# fix, every plant exits 1.
set -u
scratch=${1:?usage: plant-colour-strays.sh <scratch-dir>}
repo=$(git rev-parse --show-toplevel)
tree="$scratch/plant-colour-strays"
git -C "$repo" worktree add --detach "$tree" HEAD >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null
file=apps/web/src/retention-plot.ts
cp "$file" "$scratch/retention-plot.ts.orig"

plant() {
  sed "s|const line = { x: 'at', stroke: 'var(--ink)'|const line = { x: 'at', stroke: '$2'|" \
    "$scratch/retention-plot.ts.orig" > "$file"
  grep -q "stroke: '$2'" "$file" || { echo "$1: plant did not apply"; return; }
  env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/chart-colours.test.ts \
    >/dev/null 2>&1
  echo "$1: vitest exit $?"
}

plant control-hex '#ff0000'
plant spacing-token 'var(--gutter)'
plant font-token 'var(--font-body)'
plant stroke-none 'none'

cp "$scratch/retention-plot.ts.orig" "$file"
rm -f "$scratch/retention-plot.ts.orig"
cd "$repo" && git worktree remove --force "$tree"
