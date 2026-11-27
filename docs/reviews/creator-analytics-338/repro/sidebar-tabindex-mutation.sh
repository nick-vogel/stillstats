#!/bin/sh
# Usage: sh docs/reviews/creator-analytics-338/repro/sidebar-tabindex-mutation.sh <scratch-dir>
# Adds a detached worktree at HEAD under <scratch-dir>, removes tabIndex={-1} from the sidebar's nav
# there, runs the "Hide" focus test, and removes the worktree. Before the fix the test passes on the
# mutant (it cannot see the tabindex); after the fix it must fail.
set -eu
repo=$(git rev-parse --show-toplevel)
dir="$1/sidebar-tabindex-mutation"
git -C "$repo" worktree add --detach "$dir" HEAD >/dev/null
trap 'git -C "$repo" worktree remove --force "$dir"' EXIT
cd "$dir"
pnpm install --frozen-lockfile --offline >/dev/null
sed -i.bak 's/ ref={nav} tabIndex={-1}>/ ref={nav}>/' apps/web/src/Sidebar.tsx
grep -n '<nav className="sidebar"' apps/web/src/Sidebar.tsx
pnpm exec vitest run apps/web/src/app.test.ts -t 'leaves focus on the sidebar'
