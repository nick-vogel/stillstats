#!/bin/sh
# Pre-PR review 5 of creator-analytics#359, finding 2.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-359/repro/launch-pen-unpinned.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, changes the launch chart's two pointer
# filters in apps/web/src/LaunchChart.tsx to pass a mouse only (a pen stopped too: the move
# `!== 'touch'` becomes `=== 'mouse'`, and the leave `!== 'touch'` becomes `=== 'mouse'`), and runs
# every apps/web unit test. The live worktree is never touched.
#
# At 1a2391c: every apps/web test passes with the mutant (51 files, 1390 tests), so no unit test
# pins that a pen moves and clears the launch chart's card. The browser walk sends a pen only in
# `state: stacked charts pen`, so it does not cover the launch chart either.
set -u
scratch=${1:?usage: launch-pen-unpinned.sh <scratch-dir>}
repo=$(git rev-parse --show-toplevel)
tree="$scratch/launch-pen-unpinned"
git -C "$repo" worktree add --detach "$tree" HEAD >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null
plot=apps/web/src/LaunchChart.tsx
perl -pi -e "s/if \(event\.pointerType !== 'touch'\) pointAt\(event\)/if (event.pointerType === 'mouse') pointAt(event)/; s/if \(pointerType !== 'touch'\) leave\.current\(\)/if (pointerType === 'mouse') leave.current()/" "$plot"
echo "=== mutant applied"
git diff --stat -- "$plot"
echo "=== apps/web unit tests with a pen stopped on the launch chart"
env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web 2>&1 | grep -E 'Test Files|Tests |FAIL'
cd "$repo" && git worktree remove --force "$tree"
