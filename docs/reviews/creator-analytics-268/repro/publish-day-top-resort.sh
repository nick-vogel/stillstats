#!/bin/sh
# Pre-PR review 10, finding 1. Adds one test to a scratch checkout of HEAD, in video-list.test.ts's
# describe 'how many bars the publish day top expects for a read (creator-analytics#510)': a top
# of 2 bars answered under the default sort is still expected after a sort or a page size change
# under "Publish day", as the top ranks every upload of the list's format and visibility whatever
# the sort, page and page size (packages/api-types/src/videos.ts, `publishDayTop`).
# Red at HEAD: expected 10 to be 2, since the memo is keyed on the whole list query.
# Run from the repo root: sh docs/reviews/creator-analytics-268/repro/publish-day-top-resort.sh
# It leaves no worktree behind.
set -eu
root="$PWD"
dir="$(mktemp -d)/resort"
git worktree add --detach "$dir" HEAD >/dev/null
trap 'git -C "$root" worktree remove --force "$dir"' EXIT
cd "$dir"
pnpm install --frozen-lockfile --offline >/dev/null
cat > "$dir/resort.snippet" <<'TS'
  test('a top answered under one sort is expected under another sort and page size', () => {
    const two = channelOf('p-resort')
    remember(two, first1, 2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, sort: '-engagedViews' }, {})).toBe(2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, pageSize: 50 }, {})).toBe(2)
  })

TS
awk -v f="$dir/resort.snippet" \
  "/test\\('with nothing remembered, or no channel yet, the most the top holds: 10'/ { while ((getline l < f) > 0) print l } { print }" \
  apps/web/src/video-list.test.ts > video-list.test.ts.new
mv video-list.test.ts.new apps/web/src/video-list.test.ts
env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts -t 'expected under another sort'
