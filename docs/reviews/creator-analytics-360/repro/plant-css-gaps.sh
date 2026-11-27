#!/bin/sh
# Pre-PR review 1 of creator-analytics#360, findings 1 to 3.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-360/repro/plant-css-gaps.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, plants one Tailwind class string at a
# time in apps/web/src/plant.ts (Tailwind scans the text, so the class needs no element), runs the
# web app's CSS tests, and prints each plant's vitest exit code. 1 means a test caught the plant.
# The live worktree is never touched. Needs Docker, as `pnpm test` does.
#
# At b74e6e0: control-literal exits 1, and token-utility, animation-utility and radius-important
# exit 0. After the fixes, every plant exits 1.
set -u
scratch=${1:?usage: plant-css-gaps.sh <scratch-dir>}
repo=$(git rev-parse --show-toplevel)
tree="$scratch/plant-css-gaps"
git -C "$repo" worktree add --detach "$tree" HEAD >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null

plant() {
  printf "export const plant = '%s'\n" "$2" > apps/web/src/plant.ts
  env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/test/web.test.ts \
    apps/web/test/built-css.test.ts >/dev/null 2>&1
  echo "$1: vitest exit $?"
  rm -f apps/web/src/plant.ts
}

plant control-literal 'bg-[#f00]'
plant token-utility '[--accent:oklch(0.97_0_0)]'
plant animation-utility 'animate-[spin_1s_linear_infinite]'
plant radius-important 'rounded-[.625rem]!'

cd "$repo" && git worktree remove --force "$tree"
