#!/bin/sh
# creator-analytics#237 pre-PR review 3, finding 2: inserts second-card.case.ts into the upload
# markers describe of apps/web/src/app.test.ts in a scratch worktree and runs it. Run from the repo
# root, with a scratch directory outside the repo:
#   sh docs/reviews/creator-analytics-237/repro/second-card.sh /path/to/scratch [rev]
# Red at 95de9319 ("expected [ …(4) ] to have a length of 2"). Green once one tile card shows at a
# time. Removes its worktree when done. Never set TEST_DATABASE_ADMIN_URL.
set -u
scratch=$1
rev=${2:-HEAD}
repro=$(cd "$(dirname "$0")" && pwd)
tree="$scratch/second-card-wt"
unset TEST_DATABASE_ADMIN_URL
git worktree add --detach "$tree" "$rev" >/dev/null
(
  cd "$tree" || exit 1
  pnpm install --frozen-lockfile >/dev/null 2>&1
  node -e '
    const fs = require("node:fs")
    const [file, casePath] = process.argv.slice(1)
    const anchor = "  test(\"a click on a single upload\x27s marker opens its video\x27s page\""
    const source = fs.readFileSync(file, "utf8")
    if (!source.includes(anchor)) throw new Error("anchor test not found")
    fs.writeFileSync(file, source.replace(anchor, `${fs.readFileSync(casePath, "utf8")}\n${anchor}`))
  ' apps/web/src/app.test.ts "$repro/second-card.case.ts"
  pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'
)
status=$?
git worktree remove --force "$tree"
exit $status
