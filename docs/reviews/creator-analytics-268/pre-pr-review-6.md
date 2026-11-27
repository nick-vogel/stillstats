# Pre-PR review: creator-analytics#268 Channel audience screen, third PR (#476, #477, #469, #463, #468)

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `a187286` "Merge pull request #475 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `9eea5ca` ("creator-analytics#468 Placeholders: a section heading's place is as tall as the section's heading"). The tree was clean, with no uncommitted or untracked files at review time. 29 files, +2,189 / −776 against the merge-base, in 10 commits (`f699430`/`cda5781` #476, `fc5f5f4`/`0010ea9` #477, `fbdf227`/`c2166f5` #469, `e0b56d5`/`9ea9fb9` #463, `5b6c4a1`/`9eea5ca` #468).
**Delta under review:** none: a fresh full review of the branch against the merge-base (`--fresh`). Reviews 1 to 5 in this folder covered the earlier two PRs (#336 and #474), both merged.
**Reviewed against:** the epic creator-analytics#268 (body and its 2026-11-04 amendment); the bodies of #476, #477, #469, #463 and #468; ADR 0014; `CODING_STANDARDS.md` 1 to 3; the run's assumptions for the five tickets (`.epic-loop/tickets/<n>/assumptions.md`) and the close-out decisions (`.epic-loop/closeout.md`); the finding headings of each ticket's review pass (`.epic-loop/tickets/<n>/review-1.md`); the Approach decisions of pre-PR review 5.
**Date:** 2026-11-06
**Reviewer:** 3 code-review agents + 1 base-oracle test audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 563 files) | pass at HEAD; pass again with this doc and its repro added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 131 files, 3,145 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` (system Chrome, built app, stub API) | passed, "No content security policy violation in 43 steps" |
| Placeholder measurements | `sh docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh` (#477's sweep, 320px to 3000px, open and collapsed) | "no DIFF"; the screen is 2256px open and 2432px collapsed at both 2560px and 3000px |
| The sidebar's column on a short window | new repro `repro/sidebar-column-footer.ts` in headless Chrome against the built app and the walk's stub, two channels, support item on | red at 915x340 and 844x340: the column needs 378px and the collapse button ends 38px below the window (finding 1) |
| The account row's avatar | same repro at 1280x800 | red: the avatar is 32.7px wide and 40px tall (finding 2) |
| Where the account menu opens beside the open sidebar | scratch probe (not kept): open the menu at 1280x800 and read the rects | the menu's left edge is at 45px, over the email (48.7px to 219px), and it runs to 317.6px, past the sidebar's 224px edge (comment hygiene entry 1) |
| The recommended fixes for findings 1 and 2 | applied in a scratch worktree at HEAD (removed after): the repro, `vitest run` on `web.test.ts`, `app.test.ts`, `sidebar.test.ts`, `components.test.ts`, biome on `apps/web/src`, and the full browser walk | repro green at all three windows (the row of links at 340px tall, a 40px by 40px avatar at 1280x800); 471 tests passed; lint clean; walk passed, 43 steps, no violation |
| happy-dom against a height query | `new Window({ width: 1024, height: 340 }).matchMedia('(min-width: 48rem) and (min-height: 24rem)')` | `false` at 1024x340, `true` at 1024x768, so an app test can hold finding 1's fix |
| Tests the branch adds | base-oracle audit: the 7 changed test files and the changed `testing.ts` helper copied into a worktree at `a187286`, built there | see Test quality |
| Conformance (ADR 0014, copy, CSP, events) | agent and orchestrator read of the diff | no transition or animation in a new rule, colours from tokens only, no "Google" or em-dash in new UI strings, no new dependency or OpenPanel event, no inline style |
| The overturned review 4 approach (`:has(...)` collapsed bands) | `grep` of `app.css` for `data-collapsible` and `--lines` under `@media` | no placeholder band is left on the window; the one `:has(.sidebar[data-collapsible="icon"])` left sets the screen's offset |
| Not run | a real phone in landscape; Safari | finding 1's window is Chrome's device emulation at the window a landscape phone gives; Nick's walk (#335) |

**Overall:** The five tickets do what they say. The sidebar is a fixed full-height column from 48rem with the footer in the order #476 asks. The screen grows to the 2560px stop. Every placeholder holds its text's lines beside both sidebar widths, by container queries the sweep and the walk confirm. The publish day titles keep to one line, and the heading places match their headings. Every full check passes. Two MEDIUMs, both introduced by #476 and both proved in a real browser, should be fixed before the PR. The first: on a window from 48rem wide but under 378px tall (a phone held sideways), the fixed column runs past the window's bottom, so the collapse button is out of reach. The second: the account row squeezes the avatar into an oval beside any email as long as the sample's. Each is a one or two line fix, audited against the suites and the walk. One aggregated comment hygiene LOW follows.

## Approach decisions
- Carried from reviews 1 to 5, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run.
- Overturned by #477 (its assumption 4, accepted by its landing): review 4's collapsed bands scoped to `.signed-in-shell:has(> .sidebar[data-collapsible="icon"])` are replaced by container queries on the box each text wraps in (`signed-in-screen`, `head-text`, `audience-card`). Recommended fixes here keep the container queries.
- The sidebar's column on a short window (finding 1): the column renders only where the window holds every row of it, by adding a height to the one column query, `sidebarColumnQuery`, which `app.css` writes again. Below the height the app shows the header and the row of links, the layout below 48rem. Precedent: `stackedChartsQuery = '(min-width: 60rem) and (min-height: 45rem)'` (`apps/web/src/stacked-charts.ts:7`) with `app.css:1728`. This keeps #476 assumption A17 (the panel does not scroll, so no overflow box clips a row's focus ring) rather than overturning it. Rejected: `overflow-y: auto` on `.sidebar`, which A17 rules out.
- The account row's avatar (finding 2): it keeps its size in the flex row with `flex-shrink: 0`, as `.sidebar-support button` does in the same block (`app.css:2001-2006`).

## Confirmed Issues

### 1. On a window from 48rem wide but shorter than the sidebar's rows, the fixed column runs past the window's bottom and the collapse button is out of reach — MEDIUM
- **Location:** `apps/web/src/app.css:1883` (the column's `@media (min-width: 48rem)`), `:1906-1918` (`.sidebar`, fixed, `inset-block: 0`, no overflow); `apps/web/src/sidebar-column.ts:8` (`sidebarColumnQuery = '(min-width: 48rem)'`)
- **Attribution:** introduced, `f699430` "creator-analytics#476 Sidebar: the full-height shadcn layout from 48rem" (`git log --oneline -S'sidebarColumnQuery' a187286..HEAD` names only it; at `a187286` the sidebar is a grid track in flow, beside the screen, and scrolls with the page). The decision not to scroll is #476 assumption A17, which Nick accepted at close-out on the premise "the rows need about 22rem, more than any window the app supports". The measure below disproves the premise: the rows need 23.6rem, and a phone held sideways gives about 21rem.
- **Real-world trigger:** a creator with more than one channel and the support item on, on a phone held sideways. A Pixel 7 is 915px wide in landscape, and Chrome's toolbar leaves a window about 340px tall; an iPhone in landscape is 844px wide with a similar height. Both are past 48rem, so the column renders. User path: open stillstats.com/app on the phone, turn it sideways, try to collapse the sidebar: the button is under the window's bottom edge, and the fixed panel does not move when the page scrolls. MEDIUM: a control out of reach on a real device, no data at risk. One channel, or no support item, takes 40px to 48px off the column, which then fits a 340px window.

**Evidence**
```css
  .sidebar {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: var(--sidebar-width);
```
No rule sets `overflow` on `.sidebar`, `[data-slot="sidebar-content"]` or `[data-slot="sidebar-footer"]`. The copied `SidebarContent` and `SidebarFooter` (`components/ui/sidebar.tsx:100-111`) carry no classes, so shadcn's own `min-h-0 overflow-auto` is not there either.

**Failure mode** — `node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts` at HEAD:
```
915x340: {"window":340,"picker":282.359375,"avatar":330.359375,"collapse":378.359375,...} RED: collapse ends below the window
844x340: {"window":340,"picker":282.359375,"avatar":330.359375,"collapse":378.359375,...} RED: collapse ends below the window
1280x800: {"window":800,"picker":704,"avatar":752,"collapse":800,...}
```
The column's content is 378px (23.625rem) tall: the header's wordmark, the two links, and in the footer the support item, the picker's label and select, the account row and the collapse button. The collapse button's 40px row runs from 338px to 378px, so 2px of it shows. Collapsed, the Expand button sits in the same place.

**Recommended fix**
```diff
--- a/apps/web/src/sidebar-column.ts
+++ b/apps/web/src/sidebar-column.ts
-export const sidebarColumnQuery = '(min-width: 48rem)'
+export const sidebarColumnQuery = '(min-width: 48rem) and (min-height: 24rem)'
--- a/apps/web/src/app.css
+++ b/apps/web/src/app.css
-@media (min-width: 48rem) {
+@media (min-width: 48rem) and (min-height: 24rem) {
```
The second hunk is the block at `app.css:1883`, the only `48rem` block in the sheet. The two strings must match character for character, since `web.test.ts:543-553` compares the rule's condition with the constant. Add one app test in `describe('the sidebar from 48rem (creator-analytics#476)')` in `apps/web/src/app.test.ts` (beside `:3932`), named for the rule, e.g. "a window too short for the column's rows keeps the header and the row of links". It calls `setViewport({ width: 1024, height: 340 })` before the render, as the 375px tests do, and expects the header with its avatar, the `Channel screens` nav, and no button named "Collapse sidebar" or "Expand sidebar". happy-dom evaluates the height (checked: `matchMedia` is `false` at 1024x340 and `true` at 1024x768).

**Remediation brief**
- **Design intent:** From 48rem the sidebar is shadcn's fixed panel, the window's full height, and by #476 A17 it never scrolls: an overflow box would clip the 5px focus ring (`:focus-visible`'s 2px outline at a 3px offset, `packages/visual-system/src/styles.css:159-163`) of each full-width row against the panel's 0.25rem padding. So the column is only correct where the window holds all its rows. Where it cannot, the app falls back to the layout it already has below 48rem: the header holds the wordmark, the picker and the account menu, and the sidebar is the row of links and the support item. One query decides this. `sidebarColumnQuery` drives `useSidebarColumn` (`components/ui/sidebar.tsx:30-43`), which decides the header against the column in `App.tsx:287-290` and whether the collapsed state applies (`components/ui/sidebar.tsx:68`). `app.css` writes the query again for the column's rules. 24rem is 384px, 6px over the 378px the column needs with every footer item, measured by the repro.
- **Full surface:** `apps/web/src/sidebar-column.ts:8`, and its doc comment at `:1-7`, which says "From this width": it has to name the height and why (the panel does not scroll, so it shows only where its rows fit). `apps/web/src/app.css:1883`. The comments that say "from 48rem" for the column: `App.tsx:285` ("From 48rem the sidebar's column holds the wordmark, ..."), `Sidebar.tsx:37-41` (the component's doc comment, "From 48rem it is a column ... Below 48rem the header stays"), `app.css:1884-1888`. Correct each to say the column's query, or "from 48rem on a window tall enough for its rows". The test at `app.test.ts` beside `:3932`. Nothing else reads the literal: `web.test.ts:463`, `:521`, `:551` read the constant, and `components/ui/sidebar.tsx:31`, `:40` read it through `matchMedia`.
- **Must preserve:** every test in `apps/web/test/web.test.ts` that reads `sidebarColumnQuery` (the widths, the fill, the sidebar outside the scroll, the column media test at `:543`); `app.test.ts`'s sidebar suites at 1024x768 and 375x812 (`describe('the sidebar from 48rem (creator-analytics#476)')`, `describe('collapsing the sidebar')`, `describe("the sidebar's support item")`); the browser walk's sidebar steps (`browser-walk.ts:424`, `:502`, `:581`, `:2916`). All its wide viewports are at least 800px tall (`viewport` 1280x800, `wideAt` 900px tall, `browser-walk.ts:73-82`), so none of them crosses the new height. The scratch audit ran all of these green with the fix.
- **Do not touch:** `.sidebar`'s missing `overflow` is deliberate (A17; Reviewed and Dismissed, "scroll the panel"). The collapsed sidebar's `max-md:hidden` tooltip class (`components/ui/sidebar.tsx:160`) is Tailwind's width breakpoint and needs no height: no tooltip opens outside the column, because `Tooltip` is disabled unless `state === 'collapsed'`, and `state` is only collapsed in the column.
- **Proof:** `pnpm --filter @creator-analytics/web build && node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts`. Red now at 915x340 and 844x340 ("collapse ends below the window"). Green after: "no column, the row of links" at both, and the column at 1280x800. The repro also gates finding 2, so it exits 0 only once both are fixed. Then `pnpm exec vitest run apps/web/src/app.test.ts -t "too short"` for the new test, red before the fix and green after.

### 2. The account row squeezes the avatar into an oval beside the email — MEDIUM
- **Location:** `apps/web/src/app.css:2022-2027` (`.sidebar-account`, a flex row), with the avatar's rule in `packages/visual-system/src/styles.css:174-187` (`.avatar`, `width: 2.5rem; height: 2.5rem; border-radius: 50%`, flex-shrink left at its default 1); markup `apps/web/src/Sidebar.tsx:186-195`
- **Attribution:** introduced, `f699430` (`git log --oneline -S'sidebar-account' a187286..HEAD` names only it; the row is new in #476).
- **Real-world trigger:** every signed-in screen from 48rem, sidebar open, for a creator whose email is about 20 characters or more. The walk's sample `fennmoor.kitchen@example.com` (28 characters) already squeezes it to 32.7px. User path: sign in on a laptop. The round avatar in the sidebar's footer reads as an upright oval. A longer email squeezes it further, down to the letter's own width. MEDIUM: a visible defect of the visual system's avatar on every screen, with no data or access at stake.

**Evidence**
```css
  .sidebar-account {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
```
The email beside it (`.sidebar-email`, `min-width: 0`, `white-space: nowrap`) asks for its full width, so both items shrink and the avatar gives up width.

**Failure mode** — the repro at 1280x800: `"avatarWidth":32.703125,"avatarHeight":40 ... RED: the avatar is not round`. The same at both 340px windows. Collapsed, the panel's content box is 39px (3rem less 0.5rem of padding and the 1px border), so the avatar is 39px by 40px there too, though no email shows.

**Recommended fix**
```diff
--- a/apps/web/src/app.css
+++ b/apps/web/src/app.css
@@ inside the column's @media block, before .sidebar-email
+  .sidebar-account .avatar {
+    flex-shrink: 0;
+  }
+
   .sidebar-email {
```
Hold it with a check of real output in the browser walk's `state: sidebar in place as the list scrolls` step (`browser-walk.ts:581`), which already measures the footer at 1280px. Read the `Account menu` button's rect and fail when its width and height differ by more than 0.5px. A built CSS test of the declaration would only restate it.

**Remediation brief**
- **Design intent:** The avatar is the visual system's fixed 2.5rem circle, the account menu's trigger (A7: the trigger stays the avatar, and the email is a plain label beside it). In the sidebar's account row, the email is the part that gives way: it is cut short with an ellipsis (`.sidebar-email`), and the avatar keeps its size. Open, the row has 14rem less padding to share. Collapsed, the email is not rendered, and the 40px avatar overflows the 39px content box by 1px into the 4px padding. That is not clipped, since the panel has no overflow (A17).
- **Full surface:** `apps/web/src/app.css`, a new rule in the column's block next to `.sidebar-account` (`:2022`) and `.sidebar-email` (`:2029`). If finding 1 lands first, the block's condition is `(min-width: 48rem) and (min-height: 24rem)`. The walk step at `browser-walk.ts:581-660`. `packages/visual-system/src/styles.css:174` stays as it is: the header's avatar is not in a shrinking row.
- **Must preserve:** the email's ellipsis (`.sidebar-email`'s `min-width: 0; overflow: hidden; text-overflow: ellipsis`); the header's avatar below 48rem (`Header.tsx`, untouched); the account menu step `state: account menu open` (`browser-walk.ts:671`), which presses the avatar; `app.test.ts`'s account menu tests.
- **Do not touch:** the menu's `side="right"` placement (A8, accepted; see comment hygiene entry 1 and Reviewed and Dismissed).
- **Proof:** `pnpm --filter @creator-analytics/web build && node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts`, whose 1280x800 line reads `"avatarWidth":40,"avatarHeight":40 ... green` after the fix (red now at 32.703125). Then `pnpm test:browser` with the new walk check.

### 3. Comment hygiene — LOW (aggregated)
- `apps/web/src/AccountMenu.tsx:28-30`: "in the sidebar's footer, at the window's bottom, it opens beside the sidebar, its bottom at the avatar's, where there is room for it" → "in the sidebar's footer, at the window's bottom, it opens to the avatar's right, its bottom at the avatar's, where there is room for it: over the email beside the avatar while the sidebar is open, and beside the sidebar when it is collapsed". Measured at 1280x800, open: the menu spans 45px to 317.6px, over the email at 48.7px to 219px and past the sidebar's edge at 224px. Introduced, `f699430`.
- `apps/web/src/App.tsx:600-601`: "The screen's top heading; the wordmark and the channel picker name it on sight." → "The screen's top heading. With more than one channel the picker names it on sight; collapsed from 48rem, the channel icon's tooltip names it on a hover or a focus." Pre-existing at `a187286` (`App.tsx:590`) and exposed by #476: the collapsed column replaces the picker with an icon. The wordmark never named the channel.
- `apps/web/test/web.test.ts:150-153` (`lineCountsIn`): "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order, which is the order a later rule wins in." → "Outside any block first, then the @media blocks, then the @container blocks, each in the sheet's order. That is the cascade's order only while no `--lines` rule sits under @media, which the 'no placeholder's lines follow the window' test holds, and each @container rule follows in the sheet the rule outside any block that it overrides." `rulesIn` now groups by at-rule (`fc5f5f4`), so the three groups no longer keep source order. Introduced, `fc5f5f4`.
- `apps/site/test/screenshot/browser-walk.ts:23-24`: the header goes from the #468 clause to the date range bar inset and leaves out the #469 step, which runs between them (`walk('state: publish day bars land in their places at 320px to 1440px')` at `:2420`). → after "(creator-analytics#468)," insert "then each publish day bar row as tall as its place, a long title cut short to one line, at 320px to 1440px (creator-analytics#469)," and rewrap the clause at 100 columns. Line 24 is 145 characters today. Introduced, `fbdf227` (the step) and `5b6c4a1` (the line).
- Comment lines the branch added past 100 columns, which the files otherwise wrap at 100: `apps/site/test/screenshot/screen-ready.ts:2` (144) and `:4` (108), `f699430`; `browser-walk.ts:42` (101). Rewrap each. To list them: `git diff a187286 -- apps/site/test/screenshot/ | grep -E '^\+ *(//|\*)' | awk 'length > 101'`.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- Scroll the panel (`overflow-y: auto` on `.sidebar` or its content) as finding 1's fix: #476 A17, accepted. With the panel's 0.25rem padding, an overflow box clips the 5px ring of every full-width row. Finding 1's fix keeps the panel unscrolled instead.
- The account menu opening over the email row as a defect (web finder F1): #476 A8 (`side="right" align="end"`) and A7 (the trigger stays the avatar, named "Account menu" as approved in #66) were both accepted. The walk at code complete reported "The account menu opens to the right of the avatar." Only the comment is wrong (entry 1 above).
- The header giving way to the column once the session lands from 48rem, and the picker appearing in the footer once the channels land (web finder F5): #476 A11. It is proposal P2, which Nick filed under #268 at the close-out of 2026-11-06.
- The walk's "nothing moves" step leaving out the list route `/app/` (walk finder F2): #477 review F1.6, recorded LOW at the ticket. The list's summary cards keep their own #242 steps (`browser-walk.ts:2830`, `:2867`) at 1280px.
- Leftover collapsed-sidebar bands from review 4's approach: none. No `--lines` rule sits under `@media`, and no placeholder selector names `data-collapsible` (`grep` of `app.css`). The one `:has(... [data-collapsible="icon"])` at `:1897` sets the screen's offset.
- `container-type: inline-size` on the three containers breaking the sticky date range bar, the fixed sidebar or a portaled popup: `.sidebar` is the screen's sibling, not inside a container. The toast, tooltips and menus are portaled to the body (`toast.tsx:132`, `tooltip.tsx:33`, `dropdown-menu.tsx:35`). The walk's sticky bar, account menu and toast steps pass.
- `screenLanded`'s `main header, main nav` firing early: from 48rem the sidebar's nav renders only once signed in with the channels listed, and the `main h1` and `aria-busy` conditions still hold the check until the screen lands. `SignedOut.tsx` renders no `nav`. `screen-ready.test.ts` fails when the selector reverts.
- The stub's `publishDayTopOf` diverging from the API: same filter, order (most first, ties newest first, then by id) and 10-row cap as `apps/api/src/video-list.ts:345`. Its `first1`-only scope is #469 review F1.7.
- `flushSync(toggleSidebar)` then `picker.current?.focus()` focusing nothing: `preferences.save` sets the saved state synchronously (`App.tsx:342`), so the picker is mounted before the focus. The app test "collapsed, the channel icon..." holds it.
- The web.test.ts column media test (`:543`) being green at base: it is a drift guard between the CSS and the JS constant, and it goes red when they differ.
- `app.test.ts:3932` ("a creator with no channel has no sidebar, and keeps the header") being green at base: #476's acceptance criteria ask for it word for word, as a guard.
- The placeholder line-count tests as copy tests (CSS finder F5): they pin the line counts the repro measured per band, not fixed copy, and `web.test.ts`'s header and `placeholder.test.ts`'s "Limits:" comment state that the repro and the walk are what observe the text.
- #476 review F1.1 (MEDIUM, deferred to #477): closed. #477 measured every place again beside both widths, and the sweep reports "no DIFF".

## Minor / nits
- The walk's collapsed-sidebar step (`browser-walk.ts:566-572`) navigates straight after the Expand click's save. If the save were lost, every later step would run beside the collapsed sidebar. The next step would then fail loudly on its missing "Collapse sidebar" button, so nothing passes falsely. A `delay(settleMs)` after the click, as the notes step's `finally` has (`:2398-2402`), closes it.
- The walk's Audience heading places are compared at the notes' 1px tolerance (`browser-walk.ts:2336`), while the video page's are compared at 0.1px (`:2352`). `web.test.ts:1376` holds the formula, so a CSS drift still goes red.
- The #469 step requires a long title only at 320px (`browser-walk.ts:2469`). The #463 widths have no precondition that any Audience heading wraps (`:2260-2280`).
- A failing restore in a walk step's `finally` (`:572`, `:2215`, `:2368`, `:2486`) replaces the step's own error.
- Crossing 48rem (or finding 1's height) remounts the nav, because the row and the column are different trees (`Sidebar.tsx:94-119`). A focused link loses focus on a rotate.
- No test resizes across the column query after a render, so `subscribeToViewport` (`components/ui/sidebar.tsx:30-34`) is unexercised. The support item's link and Hide button below 48rem (`Sidebar.tsx:103-117`) carry no behaviour test of their own.
- Below the column the context gives `open: false` beside `state: 'expanded'` (`components/ui/sidebar.tsx:65-71`). Only column-only readers use `open` today.
- `rulesIn` (`packages/visual-system/test/testing.ts:68-96`) mislabels a `@container` nested in `@media`, and the plain rules of that `@media`. The CSS finder executed it, but `app.css` has no such nesting today.
- `web.test.ts:507`'s sticky test asserts `position: sticky` only, not an ancestor free of `overflow`. `web.test.ts:851-863` reads the h2's line height outside any block only.
- `onSignOut={() => start(signOut)}` is now written three times in `App.tsx` (the Header, the Sidebar and the Profile).
- The column's x, the collapsed wordmark and the collapsed avatar have no tooltip. #476 asks for none.

### Known LOWs from the ticket reviews, still open
Recorded at each ticket's review pass in this run and not re-rated here (`.epic-loop/tickets/<n>/review-1.md`): #476 F1.2 to F1.11; #477 F1.1 to F1.10; #469 F1.1 to F1.8; #463 F1.2 to F1.10; #468 F1.2 to F1.7.

### Known MEDIUMs, deferred by decision at the ticket reviews
- #463 F1.1: the Audience placeholder holds three bar rows against up to eleven landed bars, so a row of cards still grows when a real answer lands. Deferred to the proposal "The Audience placeholder's bar rows" (`.epic-loop/tickets/463/proposals.md`).
- #468 F1.1: a video page section heading that wraps is skipped, so its section moves about 19px at 768px beside the collapsed sidebar. Deferred to the proposal "A video page section heading's place holds the lines its heading wraps to on a phone" (`.epic-loop/tickets/468/proposals.md`).

## Test quality
Tests added or changed: 57 cases in 7 files (each `test.each` row and loop instance counted). Red at `a187286`: 47, plus the 2 new `testing.test.ts` cases, which are red against the base helper and green only with the branch's `testing.ts`, as they should be. Green at base: 6 in `app.test.ts`, all from `f699430`. Five are renames of existing support item and collapse tests to the new names; `:3932` is the no-channel header guard the AC asks for. `components.test.ts` and `web.test.ts` fail to import at base (`StillstatsMark.tsx`, `sidebar-column.ts`). In a stub pass, 2 `web.test.ts` cases are green there: `:543`, a drift guard (dismissed above), and `:727`, "the charts, the numbers table and the video list fill the screen ... the stacked charts stay one above the other". The base already had no cap on those selectors. The test is a weak guard: it reads `max-width` on exact last compounds only, and `grid-template-columns` on `.metric-charts` only, and it does not state those limits. Strengthen it with a limits line, or widen its scan to `width` and the ancestors.

Shapes found:
- `components.test.ts:1175` and `:1179` assert the exact class string `publish-day-title` (standard 2). This is #469 review F1.6, still open.
- `web.test.ts` now takes the column's condition from the production `sidebarColumnQuery` (`:76`, `:463`, `:521`, `:551`), so no test pins 48rem itself. A change of the constant and the CSS together passes every test, and the walk samples only 375px and 1280px.
- `sidebar.test.ts:84-85` build the expected label's prefix from the production `pickerLabel`.
- No snapshots, no assertion-free tests, no mocked unit under test, and no copy test in the new code.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and the browser walk pass at `9eea5ca`. This doc and `repro/sidebar-column-footer.ts` pass biome. `origin/main` has moved to `a72b6bc` (PR #484, #253) since the merge-base. The run's record has the merge-tree as clean.
- **Commit hygiene:** this doc and its repro are the only new files. Nothing to drop.
- **Likely reviewer asks:** the open children #329 (Privacy Policy wording) and #335 (Nick's walk in Chrome and Safari, which should now take in the 1920px and 2560px screens, the collapsed sidebar, and a phone held sideways); the deferred MEDIUMs above as follow-up issues; the reading width (44rem, #477 assumption 1), which #477 asks Nick to check in the walk.

## Verdict
**Not ready as-is: ready once findings 1 and 2 are fixed.** No CRITICAL or HIGH. Two MEDIUMs, both introduced by #476 and both proved in a real browser: the collapse button out of reach on a phone held sideways, and the squeezed avatar on every screen from 48rem. They gate the PR. Each fix is one or two lines, already audited green against the suites, the walk and the repro, plus one test each. The comment hygiene LOW, the Minor items and the ticket reviews' recorded LOWs can ride along or follow. The two deferred MEDIUMs from the ticket reviews go to their proposals. This is a fresh review, so there are no prior findings of this branch to close.

## Remediation — 2026-11-06
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `b345f83` creator-analytics#268 pre-PR review 6 finding 1: the sidebar's column needs a window tall enough for its rows | red→green: `pnpm --filter @creator-analytics/web build && node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts` (915x340 and 844x340 "collapse ends below the window" → "no column, the row of links"); `pnpm exec vitest run apps/web/src/app.test.ts -t "too short"` red ("No header or no sidebar") → green | 0 new; the comment lines in the diff correct the existing ones that said the column shows from 48rem (`sidebar-column.ts`, `App.tsx:285`, `Sidebar.tsx:37-42`, `components/ui/sidebar.tsx:13-21` and `:37`, `support.ts:14`), rewrapped at 100 columns | fixed (one `pr-review-finder` disprove agent: JS and CSS agree at every width x height; happy-dom table at 1024x340, 383, 384, 768 and 768x900 tells the old and new queries apart) |
| 2 (MEDIUM) | `80a48f4` creator-analytics#268 pre-PR review 6 finding 2: the account row's avatar keeps its round size beside the email | red→green: the repro's 1280x800 line, `"avatarWidth":32.703125` RED → `"avatarWidth":40,"avatarHeight":40` green; `pnpm test:browser` with the new check red ("The avatar beside the email is not round: {"width":32.703125,"height":40}") → passed, 43 steps, no violation | 0 new; the walk header gains the check in its existing sentence and is rewrapped | fixed |
| 3 (LOW, comment hygiene) | — deferred | — | — | LOW tail, deferred by the default scope (eng-pipeline#34) |

Preserve suites, after both fixes: `pnpm exec vitest run apps/web/test/web.test.ts apps/web/src/app.test.ts apps/web/src/sidebar.test.ts apps/web/src/components.test.ts apps/web/test/built-css.test.ts apps/site/test/screenshot/screen-ready.test.ts` 497 passed; `pnpm lint` clean (564 files); `pnpm typecheck` pass; `pnpm build` pass; `pnpm test` 131 files, 3,146 passed, 1 expected fail; `pnpm test:browser` passed, 43 steps. Both fixes follow this doc's Approach decisions for findings 1 and 2 as recorded (the height on the one column query, after `stackedChartsQuery`; `flex-shrink: 0` after `.sidebar-support button`).

### Known regressions, deferred
None. The verify agent reported no introduced defect. It named three LOW leftovers, left for the next round with finding 3:
- Width-only comments outside the corrected set still say the column shows from 48rem: `app.css:1795-1796` ("Below the tablet width they stack ... from it the sidebar is a column"), `browser-walk.ts:367`, `:579`, `:2329-2330`, `:2393`, `screen-ready.ts:2` and the test name at `screen-ready.test.ts:28`, `web.test.ts:302` and the test name above `:551`, `app.test.ts:3794`. The test-side ones describe tests that run on windows 768px tall or more, where they hold. Verdict: "comments the commit said it had corrected but are still width-only".
- `components/ui/sidebar.tsx:164`'s `max-md:hidden` on the collapsed tooltip is Tailwind's width-only breakpoint, so at 1024x340 it does not apply. No effect, since the tooltip is disabled outside the column (this doc's finding 1 Do not touch). Verdict: "a redundant guard that no longer matches the rule".
- Collapsed, the 40px avatar now keeps its size in the 39px content box and runs 1px into the padding (unclipped, A17), where it was 39x40 before; the walk checks roundness only open, and `app.css:1819` ("3rem holds the 2.5rem avatar") ignores the 1px border. Verdict: "the collapsed state is untested".
- Not measured by the verify agent: that 24rem holds the column when the support label wraps to two lines. The repro measures 378px with the walk's stub copy.

### Rework briefs
None. No rework pass was needed.
