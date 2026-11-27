#!/bin/sh
# Pre-PR review 4, finding 1: does any test catch a mode change that keeps the launch chart's
# selection? Builds a scratch worktree at HEAD, drops `mode` from LaunchChart's linesKey, and runs
# the two test files that render the launch chart. Exit 0: a test went red (the gap is closed).
# Exit 1: every test stayed green (the gap is open). Never sets TEST_DATABASE_ADMIN_URL.
set -u
ROOT=$(git rev-parse --show-toplevel)
WT="$(mktemp -d)/wt"
git -C "$ROOT" worktree add --detach "$WT" HEAD >/dev/null 2>&1 || exit 2
cleanup() { git -C "$ROOT" worktree remove --force --force "$WT" >/dev/null 2>&1; }
trap cleanup EXIT
cd "$WT" || exit 2
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null 2>&1 || exit 2
before=$(grep -c 'JSON.stringify(\[mode, chart.lines' apps/web/src/LaunchChart.tsx)
perl -pi -e 's/JSON\.stringify\(\[mode, chart\.lines/JSON.stringify([chart.lines/' apps/web/src/LaunchChart.tsx
after=$(grep -c 'JSON.stringify(\[mode, chart.lines' apps/web/src/LaunchChart.tsx)
if [ "$before" != 1 ] || [ "$after" != 0 ]; then echo "mutation did not apply"; exit 2; fi
if env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/src/launch-chart.test.ts; then
  echo "GAP OPEN: every test is green with the mode dropped from linesKey"
  exit 1
fi
echo "GAP CLOSED: a test is red with the mode dropped from linesKey"
exit 0
