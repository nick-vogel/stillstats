#!/bin/sh
# Pre-PR review 11, finding 1. Runs the publish day top's tests against two mutants of the memo's
# key in apps/web/src/video-list.ts (`publishDayTopKeyOf`): one that keeps `page` in the key, and
# one that drops `visibility` from it. The tests are copied from the working tree, so the script
# checks whatever tests the tree holds now.
# Today both mutants pass every test: nothing pins either half of the key.
# After the fix, each mutant must print FAILED (a test caught it).
# Run from the repo root: sh docs/reviews/creator-analytics-268/repro/publish-day-top-key-mutants.sh
# It leaves no worktree behind, and it changes nothing in the tree it runs from.
set -eu
root="$PWD"
dir="$(mktemp -d)/key-mutants"
git worktree add --detach "$dir" HEAD >/dev/null
trap 'git -C "$root" worktree remove --force "$dir"' EXIT
cd "$dir"
pnpm install --frozen-lockfile --offline >/dev/null
for file in video-list.test.ts placeholder.test.ts app.test.ts; do
  cp "$root/apps/web/src/$file" "apps/web/src/$file"
done
run() {
  label="$1"
  list="$2"
  cp "$root/apps/web/src/video-list.ts" apps/web/src/video-list.ts
  sed -i.bak "s/\\['page', 'sort', 'pageSize'\\]/$list/" apps/web/src/video-list.ts
  rm apps/web/src/video-list.ts.bak
  grep -qF "$list" apps/web/src/video-list.ts || { echo "$label: mutant not applied"; exit 2; }
  if env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts \
    apps/web/src/placeholder.test.ts apps/web/src/app.test.ts >/dev/null 2>&1; then
    echo "$label: passed (no test pins it)"
  else
    echo "$label: FAILED (a test caught it)"
  fi
}
run "mutant keeps page" "['sort', 'pageSize']"
run "mutant drops visibility" "['page', 'sort', 'pageSize', 'visibility']"
