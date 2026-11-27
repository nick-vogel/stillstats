# Pre-PR review: creator-analytics#268 Channel audience screen, fourth PR (#531), round 1

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `a4e8c83` "Merge pull request #519 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `2098769` ("creator-analytics#531 Sidebar: a roomier footer, a two-line channel picker and a clickable account row", the merge of `57b0ee6` into the branch; `git diff 57b0ee6 2098769` is empty). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 14 files, +811 / −81, in 2 commits (`57b0ee6`, the work, and `2098769`, a merge that adds nothing).
**Delta under review:** none. A `--fresh` review of the whole working surface: issue #531 alone, since PR #517 (the earlier #268 work, reviewed in pre-PR reviews 1 to 8) merged to `main` before the merge-base.
**Reviewed against:** creator-analytics#531 (body and acceptance criteria); its parent #268; `CODING_STANDARDS.md` 1 to 3 and the five binding review rules; ADR 0014 (bundled libraries, the shadcn rules 1 to 3, the CSP gate); review 8's Approach decisions; the ticket's 12 recorded assumptions (`.epic-loop/tickets/531/assumptions.md`).
**Date:** 2026-11-06
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome) | pass, 568 files; pass again with this doc and its repro added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 131 files, 3,170 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` | passed, "No content security policy violation in 47 steps" |
| Base oracle for the new tests | tautology agent: scratch worktree at `a4e8c83`, HEAD's four test files copied in, run there (worktree removed after) | 29 new or changed cases; 23 red at base, 6 green (see Test quality) |
| Mutants on the 6 green-at-base tests | tautology agent: scratch worktree at `2098769`, one mutant each (`sidebar-column.ts` to 26rem; two `AccountMenu.tsx` changes; `Sidebar.tsx` without `pickerShownFor`; `transition-all` in `select.tsx`; a `<select />` in `SidebarChannelPicker.tsx`) | each turned its test red; 0 vacuous |
| Identity mutants on the two names | tautology agent: `accountMenuLabelOf`'s separator changed; `channelIconLabelOf` without the handle | 1 of 274 red, the copy test; 1 of 270 red, only through a literal (finding 2) |
| The re-pick guard | own scratch worktree at `2098769`, guard dropped from `SidebarChannelPicker.tsx:43`, `pnpm exec vitest run apps/web/src/app.test.ts` | 270 passed: no test holds it; then `repro/repick-current-channel.sh` (finding 1) |
| Base UI 1.9.0 Select's name, ref, value, CSP | finder agent read `select/trigger`, `root`, `item`, `popup` in `node_modules/.pnpm/@base-ui+react@1.9.0*/` | `aria-labelledby` resolves to nothing here, the caller's `aria-label` survives `mergeProps`; `ref` reaches the button; the one `<style>` is gated by `disableStyleElements`, which `main.tsx:47` and `fake-api.ts:458` set |
| The collapsed selector | `components/ui/sidebar.tsx:92-101` | `data-collapsible="icon"` and `className="sidebar"` sit on one div, so `.sidebar[data-collapsible="icon"] .sidebar-account` matches |
| The avatar's place as the column folds | headless Chrome over the built `index-CT6NaCVN.css`, a static sidebar open and collapsed at 1280x900 | avatar left 12px open, 4px collapsed; the link icon 16px both (comment hygiene, Minor) |
| Comment lines over 100 columns in the diff | `git diff a4e8c83 -- apps/ \| grep -E '^\+ *(//\|\*\|/\*)' \| awk 'length > 101'` | two (comment hygiene) |
| Em-dashes in added lines | `git diff a4e8c83 -- apps/ \| grep '^+.*—'` | none |
| Not run | Safari; a real screen reader; Chrome's minimum font size setting | Nick's walk (#335) |

**Overall:** #531 does what it asks. The sidebar's picker is a two-line Base UI Select whose name, ref, value and CSP all hold; the account row is one button with the approved name; the footer gap, row padding and the 25.5rem height condition match, in app.css and `sidebarColumnQuery`, and the walk proves the fit at 408px and the header at 407px. Every full check passes. No CRITICAL, HIGH or MEDIUM. Six LOW findings remain: one untested guard, test shapes that standard 2 rules out, two walk checks narrower than their acceptance sentence, test names that claim layout happy-dom cannot see, code left dead or copied on the change's path, and comment hygiene. The branch is ready for its PR; the LOWs can be remediated first or follow it.

## Approach decisions
- Carried from reviews 1 to 8, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run; the column shows only where the window holds every row, by `sidebarColumnQuery`; the account row's avatar keeps its size with `flex-shrink: 0`; content raised with a z-index inside the scrolled screen is held under the sticky controls bar by its nearest positioned box's `position: relative; z-index: 0`.
- New: an approved name is tested as the rule it serves, never as its literal. The account row's name starts with `accountMenuLabel` and holds the email the row shows (WCAG 2.5.3); the picker's name starts with `pickerLabel` and holds each line the button shows. A pure wording change, such as the separator, is then held by Nick's approval on the issue and not by the suite (`CODING_STANDARDS.md` 2, "No test asserts that fixed copy is present"). Precedent: `newTabLabelOf`'s test in `account-menu.test.ts`, named for its rule.

## Confirmed Issues

### 1. Picking the channel already on view keeps the page only by an untested guard — LOW
- **Location:** `apps/web/src/SidebarChannelPicker.tsx:42-44`
- **Attribution:** introduced, `57b0ee6` (`git log -S'channelId !== selected.id' a4e8c83..HEAD` names it; the native select it replaces fired no change for its own value).
- **Real-world trigger:** none today, the guard holds. A creator on page 2 of the list opens the picker and presses the channel already shown. LOW, capped: no user path while the guard stands; the loss is the page and the list's place if a later edit drops it.
**Evidence**
```tsx
onValueChange={(channelId) => {
  if (typeof channelId === 'string' && channelId !== selected.id) onPick(channelId)
}}
```
Base UI 1.9.0 calls `onValueChange` on every item press with no equality check (`select/root/SelectRoot.js:277-278`, `setValue` calls `onValueChange?.(nextValue, …)` first; `select/item/SelectItem.js:117-119` calls `setValue` on each press). `onPick` is `navigate(routeToChannel(route, channelId))` (`Sidebar.tsx:183`), and `routeToChannel` sets `page: 1` (`channel-picker.ts:22-25`).
**Failure mode** — with the guard dropped, `pnpm exec vitest run apps/web/src/app.test.ts` stays 270 green, so the suite does not hold the rule. The repro's test, on `?channel=c-1&page=2`, re-picks "Nick Vogel": green at HEAD; with the guard dropped, `expected '?channel=c-1' to be '?channel=c-1&page=2'`.
**Recommended fix** — add this test to `describe('the channel picker, a two-line button (creator-analytics#531)')` in `apps/web/src/app.test.ts`, before `'picking the second channel puts it in the address, and the button shows it'` (line 4144):
```ts
    test('picking the channel already on view keeps the address as it is', async () => {
      const api = installFakeApi()
      api.channels = [fakeChannel, second]
      api.pageCount = 3
      const shown = await render(`?channel=${fakeChannel.id}&page=2`)
      const before = shown.address()

      await pickInSidebar(shown.container, 'Nick Vogel')

      expect(shown.address()).toBe(before)
    })
```
**Remediation brief**
- **Design intent:** the sidebar picker hands a channel id to `onPick`, which navigates to that channel's first list page with the list's controls kept. A move to the channel already on view must be no move at all, as the native select gave for free. The guard is the only place that holds it.
- **Full surface:** `apps/web/src/app.test.ts` (the describe at line 4093; `second` is defined in it at about 4095, `pickInSidebar` at 247). No production change.
- **Must preserve:** the guard itself, and the `typeof channelId === 'string'` narrowing (Base UI types the value `string | null`). The describe's other tests, notably `'picking the second channel puts it in the address, and the button shows it'`.
- **Do not touch:** `SidebarChannelPicker.tsx`'s `onValueChange` (dismissed: correct as written).
- **Proof:** `sh docs/reviews/creator-analytics-268/repro/repick-current-channel.sh` (green) and `MUTANT=1 sh docs/reviews/creator-analytics-268/repro/repick-current-channel.sh` (red, as above), from the repo root. After the fix, the same test in place: `pnpm exec vitest run apps/web/src/app.test.ts -t 'already on view keeps the address'` green, and red with the guard's `&& channelId !== selected.id` removed.

### 2. The two new names are held by copy literals, and the App tests build their expected names with the production helpers — LOW
- **Location:** `apps/web/src/account-menu.test.ts:44-47`; `apps/web/src/app.test.ts:4115-4116`, `:4194-4196`; `apps/web/test/web.test.ts:556`
- **Attribution:** introduced, `57b0ee6`.
- **Real-world trigger:** none; a test-quality defect under `CODING_STANDARDS.md` 2 (no copy test; a test builds only its input). LOW, capped: the names are right today, and the literal does catch a wrong one, by the banned shape.
**Evidence**
```ts
expect(accountMenuLabelOf('nick@example.com')).toBe('Account menu, nick@example.com')   // account-menu.test.ts:46
expect(accessibleNameOf(picker, true)).toBe(channelIconLabelOf(fakeChannel))             // app.test.ts:4115
expect(accessibleNameOf(picker, true)).toBe('Channel: Nick Vogel (@nick_vogel)')         // app.test.ts:4116
expect(buttons.map((each) => accessibleNameOf(each, true))).toEqual([accountMenuLabelOf(email)])  // app.test.ts:4194
expect(/\(min-height:\s*([\d.]+rem)\)/.exec(sidebarColumnQuery)?.[1]).toBe('25.5rem')     // web.test.ts:556
```
**Failure mode** — the tautology agent's mutants: `accountMenuLabelOf`'s separator changed, 1 of 274 red, only the copy test; `channelIconLabelOf` without the handle, 1 of 270 red, only through the literal at 4116. The App tests compute their expectation with the helper the component uses, so they cannot see a wrong name. The 25.5rem literal fails only on an edit of the constant; the boundary is held by `app.test.ts:4002` and `:4026` (407px and 408px through matchMedia) and the walk's `'state: sidebar column at its minimum height'`, and its equality with app.css by the Set assertion just above it.
**Recommended fix** — per the Approach decision: (a) replace the account-menu.test.ts describe `"the sidebar's account row's name (creator-analytics#531)"` with nothing, and in `app.test.ts:4194-4196` assert from the DOM: `const name = accessibleNameOf(buttons[0] as HTMLButtonElement, true)`, `expect(name.startsWith(accountMenuLabel)).toBe(true)`, `expect(name).toContain(buttons[0]?.querySelector('.sidebar-email')?.textContent ?? '∅')`, keeping `expect(buttons).toHaveLength(1)` in place of the one-element `toEqual`. (b) In `app.test.ts:4115-4116`, replace both lines with `const name = accessibleNameOf(picker, true)`, `expect(name.startsWith(`${pickerLabel}: `)).toBe(true)` and `for (const line of linesOf(picker)) expect(name).toContain(line)`. (c) Delete the one assertion at `web.test.ts:556`; keep the rest of that test.
**Remediation brief**
- **Design intent:** both names are approved copy (#531, #66): the account row's keeps "Account menu" and holds the visible email (WCAG 2.5.3); the picker's is the collapsed icon's, "Channel: " and the channel's name. The suite holds the rule each name serves, read from the rendered DOM; the wording itself is Nick's, on the issue.
- **Full surface:** `apps/web/src/account-menu.test.ts:44-47` (the describe; drop the `accountMenuLabelOf` import if it goes unused); `apps/web/src/app.test.ts:4115-4116`, `:4194-4196`, and its imports at line 60 (`accountMenuLabelOf` stays imported if `avatarIn` at 3270 or line 3966 still use it; those two are finders, not assertions, and may stay); `apps/web/test/web.test.ts:556`.
- **Must preserve:** `app.test.ts:4205` ("collapsed, the button is the avatar alone, named Account menu"), which a mutant proved live; `:4002` and `:4026`; the Set equality in the web.test.ts test at line 544; `channel-picker.test.ts`'s `channelLinesOf` cases. After (b), the handle-dropping mutant of `channelIconLabelOf` must still turn the 4108 test red (the `@nick_vogel` line is not in the name). The separator mutant is intended to go green: it is a copy change.
- **Do not touch:** `accountMenuLabelOf` and `channelIconLabelOf` themselves.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/account-menu.test.ts apps/web/test/web.test.ts` green; then, in a scratch worktree, change `sidebar.ts`'s `channelIconLabelOf` to drop the handle and see the 4108 test red, and change `AccountMenu.tsx`'s open `aria-label` to `accountMenuLabel` and see the 4189 test red.

### 3. Two walk steps check less than their acceptance sentence — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:756-768` (the options), `:784-806` and `:866-870` (the account row)
- **Attribution:** introduced, `57b0ee6`. The avatar press was lost from `'state: account menu open'`, which pressed the avatar button at `a4e8c83` and now presses `centreOf(accountRow)`, a point over the email in the 14rem row.
- **Real-world trigger:** none today; the walk passes and a press on the avatar's `aria-hidden` span reaches its button. LOW, capped: coverage, not behaviour.
**Evidence**
```ts
const optionLines = (await evaluate(
  `[...document.querySelectorAll('[role="option"]')].map((option) =>
    [...option.querySelectorAll('span')]
      .filter((span) => !span.querySelector('span') && span.textContent.trim() !== '')
      .map((span) => span.textContent))`,
)) as string[][]
```
The button's lines go through `linesIn` (`oneLine`, `whole`); the options' only through their text. The account row step presses one point, `email.left + Math.min(email.width / 2, 40)`; no step presses the avatar or the row's padding.
**Failure mode** — an option that wraps or ellipsises its handle or name at 1280px passes the walk; a row whose avatar or padding stopped taking the press (say a later `pointer-events: none` on the avatar, or a trigger narrower than the row) passes too. #531's acceptance asks for "a press anywhere on the account row opens the menu" and each option "with the same two lines", each cut short only if it does not fit.
**Recommended fix** — in `'state: sidebar channel picker on two lines'`, after the text comparison, run the same one-line and no-ellipsis test on each option's line spans (inline `linesIn`'s height and `scrollWidth <= clientWidth` checks in the `evaluate`, or resolve each option to an object id and call `linesIn`), and throw on any line that fails. In `'state: account row opens the menu from the email'`, press three points in turn, the avatar's centre, the email's point as today, and `row.right - 4` at the row's middle, opening and closing with Escape at each. Retitle it `'state: account row opens the menu from anywhere on it'` and fix its comment and the walk header's clause to match.
**Remediation brief**
- **Design intent:** jsdom cannot see layout or hit testing, so the walk is the only check that the two lines fit and that the whole row is the target. Each step must fail on the break its acceptance sentence names.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:700-715` (`linesIn`), `:732-783`, `:784-806`, the header clause at `:45-50`, and the message at `:870`.
- **Must preserve:** the button's existing `linesIn` check; the `clear` check that the email sits beside the avatar; the Escape close after each open; `stub.listSecondChannel(false)` in the picker step's `finally`; `'state: account menu open'` and the steps after it, which expect the menu closed.
- **Do not touch:** `'state: sidebar column at its minimum height'` (dismissed below: it tests both sides of the threshold).
- **Proof:** `pnpm build && pnpm run test:browser` green. Then in a scratch worktree add `pointer-events: none` to `.sidebar-account .avatar` in `apps/web/src/app.css` and see the account row step red; and add `.sidebar [data-slot="select-item"], [data-slot="select-item"] .picker-name { max-width: 3rem }` and see the picker step red on an option.

### 4. App test names claim lines happy-dom cannot see, and the Limits block is silent on the new picker — LOW
- **Location:** `apps/web/src/app.test.ts:4161`, `:4169`; the Limits block at `:1-56`
- **Attribution:** introduced, `57b0ee6`.
- **Real-world trigger:** none; `CODING_STANDARDS.md` 2, "A test states its own limits". LOW.
**Evidence** — `test('a channel with no handle shows its name alone, on one line', …)` and `test('a channel with no title shows its YouTube channel id alone, on one line', …)` assert `linesOf(...)` is one span. happy-dom lays nothing out, so "on one line" is a claim the test cannot check; the walk's `linesIn` is what checks it. The Limits block names the account menu's and the selects' limits, but not the Base UI picker's: no layout, no ellipsis, the list's placement, and a press anywhere on the row.
**Recommended fix** — rename the two tests to drop ", on one line" (e.g. `'a channel with no handle shows its name alone'`), and add one sentence to the Limits block after the account menu's: "The sidebar's channel picker is Base UI's Select: these tests open it with a click and read its lines' text, and see no layout, so the walk's 'state: sidebar channel picker on two lines' checks each line fits on one line uncut, and 'state: account row opens the menu from the email' a real press on the row."
**Remediation brief**
- **Design intent:** a test name says which rule it proves; where the environment cannot observe the rule, the file says so and names the walk step that can.
- **Full surface:** `apps/web/src/app.test.ts:4161`, `:4169`, and the Limits comment at `:1-56` (wrap at 100 columns). If finding 3 renames the account row step, use the new name here.
- **Must preserve:** both tests' assertions.
- **Do not touch:** the Limits block's account menu sentences about "the avatar" (dismissed below: the header's avatar is still the button they describe).
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts -t 'channel picker, a two-line button'` green; `pnpm lint` green.

### 5. Code the change left dead or copied on its path — LOW
- **Location:** `apps/web/src/ListSelect.tsx:1`, `:15`, `:24`, `:32`, `:47`; `apps/web/src/app.css:2073-2079` against `:2090-2096`; `apps/web/src/AccountMenu.tsx:44-52` and `apps/web/src/Sidebar.tsx:192`
- **Attribution:** `ListSelect`'s `ref` is pre-existing, exposed: `ChannelPicker` was its only caller to pass `ref`, and `57b0ee6` removed that (`git grep -n "<ListSelect" apps/web/src`: ControlsBar, Profile, VideoList and ChannelPicker, none passes `ref` now). The ellipsis copy and the `side`/`row` pairing are introduced, `57b0ee6`.
- **Real-world trigger:** none; `CODING_STANDARDS.md` 3 (the refactor the change's own path exposes) and the Approach decision that the branch's own duplication folds into the rule it copies. LOW.
**Evidence**
```css
  .picker-handle,
  .picker-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
```
is `.sidebar-email`'s block at `app.css:2090-2096` line for line, less its colour. `ListSelect`'s doc still says "`ref` reaches the select." `AccountMenu`'s `side` is `'right'` exactly when `row` is set (Header passes neither, Sidebar both).
**Recommended fix** — (a) `ListSelect.tsx`: drop the `ref` prop, its type, `ref={ref}` on `NativeSelect`, `type Ref` from the import, and the doc's last sentence. (b) `app.css`: make the block's selector `.picker-handle,\n  .picker-name,\n  .sidebar-email` and reduce `.sidebar-email` at 2090 to `color: var(--ink-soft);`. (c) `AccountMenu.tsx`: drop the `side` prop and pass `side={row === undefined ? 'bottom' : 'right'}` to `DropdownMenuContent`; drop `side="right"` at `Sidebar.tsx:192`.
**Remediation brief**
- **Design intent:** `ListSelect` is the web app's one native select; the header's channel picker, the date range, the currency and the page size use it, none with a ref. The column's one-line ellipsis rule is one rule for the email and the picker's two lines. The account menu opens under the avatar in the header and beside the sidebar from its footer row.
- **Full surface:** the lines above. `valueIn` (`packages/visual-system/test/testing.ts`) matches a selector inside a list, so `web.test.ts:620-623` and `:680-690` read the folded rule unchanged.
- **Must preserve:** `.sidebar-email`'s `color: var(--ink-soft)`; the email's and both lines' ellipsis at `web.test.ts:620-623` and `:680-690`; the header menu's `side="bottom"` (the walk's `'state: account menu open'` and the header menu tests in app.test.ts); `ListSelect`'s `inline` prop, which ChannelPicker still passes.
- **Do not touch:** `ChannelPicker.tsx` (dismissed: no dead code left in it); `select.tsx`'s `SelectContent` defaults (Minor).
- **Proof:** `pnpm typecheck && pnpm lint && pnpm exec vitest run apps/web/test/web.test.ts apps/web/src/app.test.ts` green, and `pnpm build && pnpm run test:browser` green.

### 6. Comment hygiene — LOW (aggregated)
All introduced in `57b0ee6` unless noted.
- `apps/web/src/AccountMenu.tsx:30-31` — "in the sidebar's footer, at the window's bottom, it opens beside the sidebar, its bottom at the avatar's, where there is room for it." → "in the sidebar's footer, at the window's bottom, it opens beside the sidebar, its bottom at the account row's, where there is room for it." (The open row's 0.5rem padding puts the row's bottom 0.5rem under the avatar's; the walk's message at `browser-walk.ts:886` already says "the row's". Pre-existing at `f699430`, exposed.)
- `apps/web/src/app.css:1985` — "/* The footer's rows sit 1rem apart (creator-analytics issue 531). */" → delete; it restates `gap: 1rem` under it.
- `apps/web/src/app.css:1906-1908` — "Each row's icon sits 1rem from the edge, open and collapsed, so the icons hold still as the column folds." → "Each link's icon sits 1rem from the edge, open and collapsed, so the icons hold still as the column folds; the account row's avatar sits 0.75rem in open and 0.25rem collapsed, where the 2.5rem avatar fills the 3rem column." (Measured in Chrome: avatar left 12px open, 4px collapsed; link icon 16px both.)
- `apps/site/test/screenshot/sample-channel.ts:46-48` — "which the browser walk's stub lists only in the collapsed sidebar step, so the channel picker and its collapsed icon show there" → "which the browser walk's stub lists in the collapsed sidebar step and the #531 picker and minimum height steps, so the channel picker and its collapsed icon show there". (`listSecondChannel(true)` at `browser-walk.ts:524`, `:733`, `:817`.)
- `apps/site/test/screenshot/browser-walk.ts:695-697` — "a real press on the account row's avatar opens the menu" → "a real press on the account row opens the menu"; and `:870`'s message "The account menu did not open on a press of the avatar" → "The account menu did not open on a press of the account row". (No step presses the avatar; finding 3 restores one.)
- `apps/site/test/screenshot/browser-walk.ts:45-50` — the #531 clause sits after the #417/#476 clause that ends with the 375px step (line 3187), but its steps run at 732, 786 and 810, before `'state: account menu open'` (866). Move the clause to follow "with the collapse button at the window's bottom and the avatar as wide as it is tall beside the email;" and rewrap at 100 columns.
- `apps/web/test/web.test.ts:1659` (145 columns) — rewrap the comment block at 100 columns.
- `apps/web/src/app.test.ts:217` (102 columns) — rewrap so the quoted name "Channel: " stays on one line.

## Needs Further Investigation
### A. A minimum font size above 12px may push the collapse button past the window at exactly 408px — confirm with Chrome's Settings, Appearance, Customize fonts, Minimum font size at 14, a 408px-tall window, two channels and the support item shown
The 25.5rem condition leaves 0.4px over the measured 407.6px (`sidebar-column.ts`). The handle line is 0.75rem (12px); a 14px minimum grows it by about 2.8px. Kill it if the collapse button's bottom stays inside the window; confirm it if the button sits past the bottom, and then the condition takes its spare from the measurement, not the rem step. Nick's walk (#335).

## Reviewed and Dismissed
- The picker's name lost to Base UI's `aria-labelledby` — `SelectTrigger` resolves it from a Field or `Select.Label`, neither present; the caller's `aria-label` merges after Base UI's own props.
- The picker's `ref` not reaching the button — `Trigger.Props` is a `button`'s props with ref; `Sidebar.tsx`'s focus after `flushSync(toggleSidebar)` is held by `app.test.ts:4068`.
- Base UI's Select breaking the CSP — its one `<style>` renders only without `disableStyleElements`; `CSPProvider disableStyleElements` wraps the app (`main.tsx:47`) and the test app (`fake-api.ts:458`); the walk saw no violation in 47 steps. Positioning styles are set through the CSSOM, which the policy does not block.
- The options missing the two-line rules because the list is portalled — `.picker-lines`, `.picker-handle`, `.picker-name` are not scoped under `.sidebar`, and the picker renders only when the media query holds.
- `.sidebar[data-collapsible="icon"]` not matching — the attribute and the class share one div (`components/ui/sidebar.tsx:92-101`).
- The walk's `oneLine` going NaN on `line-height: normal` — the walk passed at HEAD, so the lines resolve a number.
- `'state: sidebar column at its minimum height'` passing vacuously — it checks the collapse button's bottom at the threshold and the header at one pixel shorter, and an exact `Account menu` name in the header rules out a stray match.
- A channel with no title showing its id alone even with a handle; the name reading "Title (@handle)" while the button shows the handle first — the ticket's recorded assumption and the spec's approved name.
- The collapsed account row's focus ring a rounded square, not a circle — the links' ring, as R3 asks.
- `ChannelPicker.tsx` dead code — its `inline` and `ref` props went with their use; Header is its only caller.
- The Limits block's account menu sentences about "the avatar" — the header's avatar is still the button they describe; the sidebar's row is covered by finding 4's sentence.
- The hover and focus look having no built-CSS test — #531's built-CSS list names the gap, the padding, the height and rule 3, not the hover; the hover is a recorded assumption.
- `web.test.ts:305`'s `test.for` green at base for `sidebar.tsx` and `tooltip.tsx` — title change only; the `select.tsx` case is new and died to `transition-all`.
- The merge commit `2098769` carrying the work's subject — it adds nothing (`git diff 57b0ee6 2098769` is empty); the stage 1 merge's own record.

## Minor / nits
- A hover anywhere on the account row fades the avatar over 0.2s: the visual system's `.avatar` carries `transition: background-color 0.2s` (`packages/visual-system/src/styles.css:187`), now triggered by `.sidebar-account:hover .avatar` (`app.css:2106`). The header's avatar has the same fade; the links fade their underline too (`styles.css:152`). #531's "no transition or animation" reads as the new rules' own, which hold.
- The rows' hover underline takes the font's default thickness and offset, where a link's is `0.08em` and `0.2em` (`styles.css:150-151`); the nearest button precedent, `.sidebar-support button` (`app.css:1872-1881`), does the same as these rows.
- The account row's avatar moves 0.5rem sideways as the column folds (12px to 4px), a consequence of R3's 0.5rem padding and the recorded no-padding collapsed row; finding 6 corrects the comment that says the icons hold still.
- `select.tsx:73`'s `rounded-[0.5rem]` on an item and `outline-none` on the popup lose to the visual system's unlayered `:focus-visible` (Tailwind's utilities are layered, `app.css:5-7`); the item has no fill or border, so the radius never shows.
- `SelectContent` keeps shadcn's positioning defaults (`select.tsx:35-40`) that its one caller overrides, except `alignOffset`, whose 0 is Base UI's own.
- `channel-picker.test.ts:110-133` and the App tests at `:4108`, `:4161`, `:4169` state the same `channelLinesOf` rules; one level would do. Keep the App tests if one goes.
- The walk's minimum height uses `Math.round(Number(minimum) * rem)` (`browser-walk.ts:816`); `Math.ceil` would stay right for a threshold that is not a whole pixel.
- `describe('the four selects, found by role and name')` (`app.test.ts:4795`) now holds a Base UI combobox among its selects.

## Test quality
Tests added or changed: 29 cases (account-menu.test.ts 1, channel-picker.test.ts 4, app.test.ts 17 of which 8 changed, web.test.ts 7 counting the `test.for` as 3), plus 3 new walk steps and one changed. Red against `$BASE` (`a4e8c83`): 23. Green against `$BASE`: 6, all added in `57b0ee6`, each killed by a mutant at HEAD: `app.test.ts:4026` (the threshold at 26rem; its partner `:4002` goes red at 24rem, so the pair holds both sides), `:4205` (the email shown collapsed, or the open name collapsed), `:4810`'s new assertion at 4816 (`channels.length > 0` for `pickerShownFor`), `web.test.ts:305`'s `sidebar.tsx` and `tooltip.tsx` cases (title only; the `select.tsx` case is new), and `web.test.ts:1664` (a `<select />` in `SidebarChannelPicker.tsx`). Tautology shapes found: 4, in finding 2: one copy test (`account-menu.test.ts:46`), two identities (`accountMenuLabelOf` at `app.test.ts:4194`, `channelIconLabelOf` at `:4115`, with the literal at `:4116`), and one constant restated (`web.test.ts:556`). No mocked unit under test, no call-shaped-only assertion, no snapshot, no assertion-free or prose test. Every walk step can go red; finding 3 names the two that check less than their sentence. The re-pick guard had no test (finding 1).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `2098769`; the browser walk passes with no CSP violation in 47 steps.
- **Commit hygiene:** commit this doc and `repro/repick-current-channel.sh` as `creator-analytics#268 pre-PR review 9`. Nothing to drop.
- **Likely reviewer asks:** the 0.4px spare under the height condition (NFI A); the ticket's proposal to retake the homepage screenshot, whose image still shows the old footer (`.epic-loop/tickets/531/proposals.md`); Safari and a screen reader on the Base UI picker (#335).

## Verdict
Ready to open the PR, with follow-ups. No finding gates it: zero CRITICAL, HIGH or MEDIUM. Findings 1 to 6 are LOW and can be remediated before the PR or filed after it; finding 1 is the one with a real behaviour behind it, a guard the suite does not hold. NFI A is for Nick's walk.
