#!/bin/sh
# Pre-PR review 3 of creator-analytics#360, finding 1.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-360/repro/modified-click-default-mutant.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, plants an `event.preventDefault()` at the
# top of `followInPlace` in apps/web/src/RouteLink.tsx, so a Cmd or Ctrl click no longer reaches the
# browser and no new tab opens, then runs the account menu's modified click tests and prints their
# vitest exit code. 1 means a test caught the plant. The live worktree is never touched.
#
# At af7800f the plant exits 0: no test sees the default prevented. After finding 1's fix, it
# exits 1.
set -u
scratch=${1:?usage: modified-click-default-mutant.sh <scratch-dir>}
wt="$scratch/modified-click-wt"
git worktree add --detach "$wt" HEAD >/dev/null
(cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
perl -0pi -e 's/(\): boolean \{\n)/$1  event.preventDefault()\n/' "$wt/apps/web/src/RouteLink.tsx"
(cd "$wt" && env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/app.test.ts \
  -t "click on Profile leaves the menu open" >/dev/null 2>&1)
echo "modified-click plant: $?"
git worktree remove --force "$wt"
