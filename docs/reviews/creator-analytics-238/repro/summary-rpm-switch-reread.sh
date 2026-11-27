#!/bin/sh
# Pre-PR review 4, finding 1 (creator-analytics#238): the channel summary reads again when the RPM
# switch changes while it is on view, through `adsAndPremiumOnly` in its read's deps
# (apps/web/src/ChannelSummaryFigures.tsx), but no test fails when that dep is removed.
# Run from the repo root. It adds a detached worktree at HEAD in a temporary folder, installs, removes
# the dep there, runs apps/web/src/app.test.ts, and removes the worktree. Exit 1 when every test still
# passes (the mutant survives, so the gap is open), 0 when a test fails (the gap is closed), 2 when the
# deps line is not found.
set -eu
repo=$(pwd)
dir=$(mktemp -d)
wt="$dir/wt"
git worktree add --detach "$wt" HEAD >/dev/null
trap 'git -C "$repo" worktree remove -f -f "$wt"; rm -rf "$dir"' EXIT
cd "$wt"
pnpm install --frozen-lockfile >/dev/null
file=apps/web/src/ChannelSummaryFigures.tsx
deps='[channelId, window, range?.from, range?.to, format, adsAndPremiumOnly]'
grep -qF "$deps" "$file" || { echo "deps line not found in $file"; exit 2; }
sed -i.bak 's/\[channelId, window, range?.from, range?.to, format, adsAndPremiumOnly\]/[channelId, window, range?.from, range?.to, format]/' "$file"
if pnpm exec vitest run apps/web/src/app.test.ts >/dev/null 2>&1; then
  echo "mutant survives: no app test fails without the RPM switch in the summary's read deps"
  exit 1
fi
echo "mutant killed: a test fails without the RPM switch in the summary's read deps"
