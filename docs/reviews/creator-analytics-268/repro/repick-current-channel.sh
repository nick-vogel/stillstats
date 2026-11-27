#!/bin/sh
# Pre-PR review 9, finding 1. Adds one app test to a scratch checkout of HEAD: on page 2 of the
# list, pick the channel already on view in the sidebar's picker, and the address must not change.
# Base UI's Select calls onValueChange on every item press, the current value included, so only
# the `channelId !== selected.id` guard in SidebarChannelPicker.tsx keeps the page.
# Green at HEAD. Red with MUTANT=1, which drops the guard:
#   expected '?channel=c-1' to be '?channel=c-1&page=2'
# Run from the repo root: sh docs/reviews/creator-analytics-268/repro/repick-current-channel.sh
# and again with MUTANT=1 in front. It leaves no worktree behind.
set -eu
root="$PWD"
dir="$(mktemp -d)/repick"
git worktree add --detach "$dir" HEAD >/dev/null
trap 'git -C "$root" worktree remove --force "$dir"' EXIT
cd "$dir"
pnpm install --frozen-lockfile --offline >/dev/null
if [ "${MUTANT:-0}" = 1 ]; then
  sed -i.bak "s/ && channelId !== selected.id) onPick/) onPick/" apps/web/src/SidebarChannelPicker.tsx
fi
cat > "$dir/repick.snippet" <<'TS'
    test('picking the channel already on view keeps the address as it is', async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      api.pageCount = 3
      const shown = await render(`?channel=${fakeChannel.id}&page=2`)
      const before = shown.address()

      await pickInSidebar(shown.container, 'Nick Vogel')

      expect(shown.address()).toBe(before)
    })

TS
awk -v f="$dir/repick.snippet" \
  "/test\\('picking the second channel puts it in the address, and the button shows it'/ { while ((getline l < f) > 0) print l } { print }" \
  apps/web/src/app.test.ts > app.test.ts.new
mv app.test.ts.new apps/web/src/app.test.ts
env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/app.test.ts -t 'already on view keeps the address'
