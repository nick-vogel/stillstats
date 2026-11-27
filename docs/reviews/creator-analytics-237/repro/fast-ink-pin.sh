#!/bin/sh
# creator-analytics#237 pre-PR review 4, finding 1: deletes the marker ink declaration
# (`color: var(--ink-soft);` in the `.upload-marker` rule of apps/web/src/app.css) in a scratch
# worktree and runs the fast suites that own the marker's sheet and markup. Run from the repo root,
# with a scratch directory outside the repo:
#   sh docs/reviews/creator-analytics-237/repro/fast-ink-pin.sh /path/to/scratch [rev]
# Red for the finding at ecc21416: both files pass (269 tests) with the ink gone, so only the local
# browser walk sees it. Green for the fix once a test there fails, so this script exits 0 only when
# vitest exits non-zero. Removes its worktree when done. Never set TEST_DATABASE_ADMIN_URL.
set -u
scratch=$1
rev=${2:-HEAD}
tree="$scratch/fast-ink-pin-wt"
unset TEST_DATABASE_ADMIN_URL
git worktree add --detach "$tree" "$rev" >/dev/null
(
  cd "$tree" || exit 2
  pnpm install --frozen-lockfile >/dev/null 2>&1
  node -e '
    const fs = require("node:fs")
    const file = "apps/web/src/app.css"
    const source = fs.readFileSync(file, "utf8")
    const rule = /(\n\.upload-marker \{[^}]*?)\n  color: var\(--ink-soft\);/
    if (!rule.test(source)) throw new Error("ink declaration not found in .upload-marker")
    fs.writeFileSync(file, source.replace(rule, "$1"))
  '
  if pnpm exec vitest run apps/web/test/web.test.ts apps/web/src/components.test.ts; then
    echo "the fast suites pass without the marker ink: finding holds"
    exit 1
  fi
  echo "a fast test fails without the marker ink: finding fixed"
)
status=$?
git worktree remove --force "$tree"
exit $status
