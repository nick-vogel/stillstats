#!/usr/bin/env bash
# Pre-PR review 2, finding 1. Deletes the privacy policy's clauses naming the extension's install,
# page and YouTube access events from a scratch checkout, then runs the site tests there.
# Usage: policy-event-clauses.mutant.sh <scratch checkout at the commit under test>
# Never pass the live worktree: the script edits apps/site/privacy.html in the checkout it is given.
# Exit 1 "MUTANT SURVIVED" is the defect (aeec27ae); exit 0 "MUTANT KILLED" is the fix.
set -euo pipefail
checkout="${1:?pass a scratch checkout}"
cd "$checkout"
perl -0pi -e 's/that it was installed, which kind of page\s+showed a number or could not \(a Studio page, or a channel page, watch page, feed or Shorts\s+on www\.youtube\.com\), when you turn on access to www\.youtube\.com and when you or your\s+browser remove it, and //' apps/site/privacy.html
if git diff --quiet -- apps/site/privacy.html; then
  echo "the mutant did not apply: the policy's sentence changed, update the pattern" >&2
  exit 2
fi
if env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/site/test/site.test.ts; then
  echo "MUTANT SURVIVED: no test fails with the event clauses gone from the policy"
  exit 1
fi
echo "MUTANT KILLED"
