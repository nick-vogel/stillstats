#!/bin/sh
# Pre-PR review 4 of creator-analytics#359, finding 1.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-359/repro/cancel-stop-unpinned.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir> and runs
# apps/web/src/cursor-plot.test.ts on three builds of apps/web/src/CursorPlot.tsx: HEAD, HEAD
# without the `pointercancel` capture listener, and HEAD with the filter stopping a pen too
# (`!== 'mouse'`). It runs that matrix twice: on the test file as committed, then on the file
# with finding 1's recommended change applied (a pen's move before the finger's cancel, and the
# mouse control run for a pen too). The live worktree is never touched.
#
# At 1fc8989, as committed: every test passes on all three builds, so neither the cancel stop
# nor a pen's passing is pinned. With the recommended change: all pass on HEAD, the finger test
# fails without the cancel listener, and the pen control fails with the pen stopped.
set -u
scratch=${1:?usage: cancel-stop-unpinned.sh <scratch-dir>}
repo=$(git rev-parse --show-toplevel)
tree="$scratch/cancel-stop-unpinned"
git -C "$repo" worktree add --detach "$tree" HEAD >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null
plot=apps/web/src/CursorPlot.tsx
spec=apps/web/src/cursor-plot.test.ts

run() {
  echo "=== $1"
  env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run "$spec" --reporter=verbose 2>&1 |
    grep -E '^ +(✓|×|✗)' | sed 's/ [0-9]*ms$//'
}

matrix() {
  git show HEAD:"$plot" > "$plot"
  run "$1: head"
  git show HEAD:"$plot" | grep -v "'pointercancel', stopTouch" > "$plot"
  run "$1: no cancel listener"
  git show HEAD:"$plot" |
    sed "s/if (event.pointerType === 'touch') event.stopPropagation()/if (event.pointerType !== 'mouse') event.stopPropagation()/" > "$plot"
  run "$1: pen stopped too"
  git show HEAD:"$plot" > "$plot"
}

matrix committed

perl -0pi -e "s/(    expect\(shown\(\)\)\.toEqual\(placed\)\n\n)(    sendTo\(watching, 'touch', \[\['pointercancel')/\$1    sendTo(watching, 'pen', [['pointermove', watchingPoint.first]])\n    expect(shown()).toEqual(placed)\n\$2/" "$spec"
perl -0pi -e "s/  test\(\"lets a mouse's move and cancel reach the library, which hides the card on both plots\", \(\) => \{\n    const \{ watching, shown \} = placedOnWatching\(\)\n\n    sendTo\(watching, 'mouse',/  test.each(['mouse', 'pen'])(\"lets a %s's move and cancel reach the library, which hides the card on both plots\", (pointerType) => {\n    const { watching, shown } = placedOnWatching()\n\n    sendTo(watching, pointerType,/" "$spec"
echo "=== recommended change"
git diff --stat -- "$spec"

matrix recommended

git show HEAD:"$spec" > "$spec"
cd "$repo" && git worktree remove --force "$tree"
