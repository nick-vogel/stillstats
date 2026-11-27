#!/usr/bin/env bash
# creator-analytics#5 pre-PR review 1, finding 5. Drops the creation-time sort from the reach
# reports the gateway lists, in a scratch checkout, then runs the worker and gateway suites there.
# Usage: report-order.mutant.sh <scratch checkout at the commit under test>
# Never pass the live worktree: the script edits packages/youtube-gateway/src/reporting-job.ts in
# the checkout it is given.
# Exit 1 "MUTANT SURVIVED" is the defect (7b640f3b); exit 0 "MUTANT KILLED" is the fix.
set -euo pipefail
checkout="${1:?pass a scratch checkout}"
cd "$checkout"
perl -pi -e 's/return reports\.toSorted\(\(a, b\) => a\.createdAt\.getTime\(\) - b\.createdAt\.getTime\(\)\)/return reports/' packages/youtube-gateway/src/reporting-job.ts
if git diff --quiet -- packages/youtube-gateway/src/reporting-job.ts; then
  echo "the mutant did not apply: the sort changed, update the pattern" >&2
  exit 2
fi
if env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/worker packages/youtube-gateway packages/fake-google; then
  echo "MUTANT SURVIVED: no test fails with the reports stored in the order Google lists them"
  exit 1
fi
echo "MUTANT KILLED"
