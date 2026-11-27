#!/bin/sh
# Pre-PR review 4 of creator-analytics#360, finding 1.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-360/repro/tool-link-default-mutant.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, plants an `event.preventDefault()` in the
# free tool link's `onClick` in apps/web/src/AccountMenu.tsx, so a click on the tool no longer opens
# it in a new tab, then runs the account menu's free tool link test and prints its vitest exit code.
# 1 means a test caught the plant. The live worktree is never touched.
#
# At acb68da the plant exits 0: no test sees the tool link's default prevented. After finding 1's
# fix, it exits 1.
set -u
scratch=${1:?usage: tool-link-default-mutant.sh <scratch-dir>}
wt="$scratch/tool-link-wt"
git worktree add --detach "$wt" HEAD >/dev/null
(cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
perl -0pi -e 's/onClick=\{\(\) => track\(toolLinkClickedEvent\(tool\)\)\}/onClick={(event) => { event.preventDefault(); track(toolLinkClickedEvent(tool)) }}/' "$wt/apps/web/src/AccountMenu.tsx"
grep -q 'event.preventDefault(); track(toolLinkClickedEvent' "$wt/apps/web/src/AccountMenu.tsx" || { echo "plant did not apply"; git worktree remove --force "$wt"; exit 2; }
(cd "$wt" && env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/app.test.ts \
  -t "closes on a free tool's link" >/dev/null 2>&1)
echo "tool-link plant: $?"
git worktree remove --force "$wt"
