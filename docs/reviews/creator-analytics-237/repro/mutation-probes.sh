#!/bin/sh
# creator-analytics#237 pre-PR review 1, findings 1 and 3: each probe removes one rule from the
# code and runs the suites that should hold it. A probe whose tests stay green names a rule no test
# holds. Run from the repo root, with a scratch directory outside the repo:
#   sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh /path/to/scratch [rev]
# At c87ee162 every probe prints "survived". After the fix, each prints "killed".
# Never set TEST_DATABASE_ADMIN_URL: the API suite starts its own Testcontainers Postgres.
set -u
scratch=$1
rev=${2:-HEAD}
tree="$scratch/probe-wt"
unset TEST_DATABASE_ADMIN_URL
git worktree add --detach "$tree" "$rev" >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile >/dev/null 2>&1

probe() {
  name=$1 file=$2 from=$3 to=$4
  shift 4
  sed -i.bak "s|$from|$to|" "$file"
  if cmp -s "$file" "$file.bak"; then
    echo "$name: mutation did not apply"
  elif pnpm exec vitest run "$@" >/dev/null 2>&1; then
    echo "$name: survived"
  else
    echo "$name: killed"
  fi
  mv "$file.bak" "$file"
}

web='apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/src/channel-summary.test.ts'
# Finding 1: the summary read stops following the visibility switch.
probe 'F1a visibility left out of the read deps' apps/web/src/ChannelSummaryFigures.tsx \
  'format, visibility, adsAndPremiumOnly\]' 'format, adsAndPremiumOnly]' $web
probe 'F1b summary read always public' apps/web/src/ChannelSummaryFigures.tsx \
  'const visibility = visibilityOf(route, saved)' "const visibility = 'public' as const" $web
# Finding 3: the API's scheduled exclusion, and a failed content types read.
probe 'F3a scheduled clause dropped' apps/api/src/channel-summary.ts \
  'upload.scheduledFor === null &&' 'true \&\&' apps/api/src/channel-summary.test.ts
probe 'F3b content types failure swallowed' apps/api/src/channel-summary.ts \
  'if (!contentTypes.ok) return contentTypes' 'if (!contentTypes.ok) return { ok: true, uploads: [] }' \
  apps/api/src/channel-summary.test.ts

cd - >/dev/null || exit 1
git worktree remove --force "$tree"
