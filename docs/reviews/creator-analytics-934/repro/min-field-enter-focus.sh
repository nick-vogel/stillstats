#!/bin/sh
# creator-analytics#934 pre-PR review 1, finding 1: inserts min-field-enter-focus.case.ts into the
# describe "the history filters leaving the controls row with focus in one" of
# apps/web/src/app.test.ts in a scratch worktree and runs it. Run from the repo root, with a
# scratch directory outside the repo:
#   sh docs/reviews/creator-analytics-934/repro/min-field-enter-focus.sh /path/to/scratch [rev]
# Red at a5a8a81c (focus is on the body, not the field). Green once a committed minimum keeps
# focus in the field. Removes its worktree when done. Never set TEST_DATABASE_ADMIN_URL.
set -u
scratch=$1
rev=${2:-HEAD}
repro=$(cd "$(dirname "$0")" && pwd)
tree="$scratch/min-field-enter-focus-wt"
unset TEST_DATABASE_ADMIN_URL
git worktree add --detach "$tree" "$rev" >/dev/null
(
  cd "$tree" || exit 1
  pnpm install --frozen-lockfile >/dev/null 2>&1
  node -e '
    const fs = require("node:fs")
    const [file, casePath] = process.argv.slice(1)
    const anchor = "  test(\x27on a free channel, choosing All sources gives focus to Videos per page\x27"
    const source = fs.readFileSync(file, "utf8")
    if (!source.includes(anchor)) throw new Error("anchor test not found")
    fs.writeFileSync(file, source.replace(anchor, `${fs.readFileSync(casePath, "utf8")}\n${anchor}`))
  ' apps/web/src/app.test.ts "$repro/min-field-enter-focus.case.ts"
  pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'
)
status=$?
git worktree remove --force "$tree"
exit $status
