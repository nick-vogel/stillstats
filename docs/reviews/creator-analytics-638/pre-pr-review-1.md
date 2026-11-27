# Pre-PR review: creator-analytics#638 Audience screen in CSS columns

**Branch:** `creator-analytics-638-audience-mosaic` vs `origin/main` (merge-base `511ab6b` "Merge pull request #681 from nick-vogel/creator-analytics-637-retention-player")
**Reviewed at:** HEAD `9cbd27c` ("creator-analytics#689 Audience cards in CSS columns, with the placeholders in the same columns", the no-ff merge of lane commit `5534f66` with the same subject), clean tree, no uncommitted or untracked files at review time. 6 files, +122 / −77.
**Reviewed against:** epic creator-analytics#638 (its body is the spec), its only child creator-analytics#689 and its acceptance criteria, `CODING_STANDARDS.md` standards 1 to 3. No plan docs and no prior review docs for this epic.
**Date:** 2026-11-12
**Reviewer:** 1 code-review agent + 1 verification agent + verify pass (`--fresh`)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green, 671 files including this review's repro |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green: 162 files, 4,109 passed, 1 expected fail |
| Touched test files | `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/placeholder.test.ts apps/web/test/web.test.ts` | green: 480 passed |
| Browser walk at HEAD | `pnpm test:browser` in a scratch worktree at `9cbd27c` | green: no content security policy violation in 62 steps, first run, 73s |
| Base oracle for the walk | HEAD's `browser-walk.ts` copied over a scratch worktree at `511ab6b`, then `pnpm test:browser` | red in `state: audience grid columns` only: stretched cards at 1280px and 2560px (US states 144px, Gender 68px, and more) and a row-major order. The placeholder step and the second-read step pass at base (see Test quality) |
| Column use at wide widths (Finding 1) | `docs/reviews/creator-analytics-638/repro/measure-columns.ts` at HEAD and base, 1280 to 3840px | HEAD fills 6 of 7 column boxes from 2560px up, 324.58px blank at the right; base's grid fills all 7 tracks |
| Mutation: `break-inside: avoid` removed | scratch worktree at `9cbd27c`, the line deleted from `apps/web/src/app.css`, `pnpm test:browser` | red in three steps: the column order, the second read, and the note places. So the walk holds the rule (Dismissed bullet 1) |
| Fragmented card in the walk's measure | scratch HTML page in headless Chrome with the branch's `.audience-grid` rules | a card split over three columns reads `getClientRects().length` 3, a union box and slack −17, so `slack > 1` alone misses it; the walk's other steps catch it on the real data (row above) |
| Tautology audit | base oracle above, plus a read of the renamed vitest tests | see Test quality |
| Real displays at 2560px and wider | not run on hardware | the walk's 2560px emulation and the measurement stand in |

**Overall:** The branch does what #689 asks. The cards flow into 18rem columns, none stretches, the DOM order reads down the columns, the placeholder sits in the same container, and the second read holds every card's left edge, top and height. Every full check is green, and the walk's new checks go red at base. Three LOW findings remain: a blank trailing column from 2560px up that no comment admits, the `audience-grid` name the change walked past, and comment hygiene. Nothing blocks the PR.

## Approach decisions

- Layout: CSS multi-column (`columns: 18rem; column-gap: 1rem`) with `break-inside: avoid` and a 1rem end margin per card, as the epic decided on 2026-11-12. A JavaScript masonry and fixed spans stay rejected, and native Grid Lanes is out of scope until Baseline. No finding below changes the layout mechanism. Finding 1 is fixed by stating the limit, not by a new layout.
- The layout's only test is the browser walk (happy-dom lays out nothing), as the epic's testing seam says. No fix below adds a stylesheet-value test to `apps/web/test/web.test.ts`.

## Confirmed Issues

### 1. From 2560px up the cards fill 6 of the 7 columns, leaving a column's width blank at the right, and nothing says this can happen — LOW

- **Location:** `apps/web/src/app.css:973-986`, `apps/site/test/screenshot/browser-walk.ts:2605-2608`
- **Attribution:** introduced. The base grid's auto-fit tracks hold all 8 cards over 7 tracks at 2560px, so no track is empty there (`git show 511ab6b:apps/web/src/app.css | grep -n -A4 '^.audience-grid {'`). The multicol rule came in `5534f66`.
- **Real-world trigger:** a creator on a 2560px monitor (or wider: the screen caps its content at 2256px) opens Audience with the sidebar open. With the sample channel, the cards fill six columns and the seventh column box is blank, 324.58px wide. With other data the blank can be wider: with one card much taller than the rest, a 1500px container fills 3 of 4 columns (the finder's scratch page in Chrome). LOW, capped: the screen is still shorter than at base (632.89px against 880.64px at 2560px) and has less empty area overall, since base stretched seven cards to 632.89px and left six tracks blank beside the subscriber split. Upgrade to MEDIUM if Nick reads the blank column as the empty space the epic set out to remove; check by opening `head-cards-2560.png` from the repro's output.

**Evidence**

```css
.audience-grid {
  columns: 18rem;
  column-gap: 1rem;
}
```

The comment above it says "as many 18rem columns as fit on a full screen". That is true of the column boxes, but not of the columns that hold cards.

**Failure mode:** multicol balancing picks the shortest column height that fits all 8 unbreakable cards, and that height is at least the tallest card's. The cards then fill the columns in order, so any column boxes left over stay empty. Measured at HEAD (container content width 2256px, from 2560px up):

| Width | Column boxes | Columns with cards | Blank at right |
| --- | --- | --- | --- |
| 1280 | 3 | 3 | 0.02px |
| 1920 | 5 | 5 | 0.02px |
| 2560 / 3000 / 3840 | 7 | 6 | 324.58px |

The walk's `columnsOf` counts the distinct left edges of the cards, so its 2560px check (`widest <= wide`) passes on the sample's heights only, 6 against 3. With a tall-first card set it would read 3 against 3 and fail. That is a limit of the check, not a false pass today.

**Recommended fix:** state the limit where a maintainer reads the layout, and make the walk's comment state what its column count measures. No CSS change: no multicol property makes the cards fill every column box. A `column-count` cap is still data-dependent, and the alternatives are the rejected ones.

```diff
--- a/apps/web/src/app.css
-   order, which is the reading and the focus order. The placeholder holds the same columns only
+   order, which is the reading and the focus order. The columns balance to the tallest card at
+   least, so where one card is as tall as several others the last columns can stay empty: from
+   2560px the sample channel's cards fill 6 of 7. The placeholder holds the same columns only
--- a/apps/site/test/screenshot/browser-walk.ts
-  // The cards flow into as many 18rem columns as fit: more than one on a full screen, more again on
-  // a 2560px one, where the screen has no 76rem cap (creator-analytics#477), and one on a phone. At
+  // The cards flow into as many 18rem columns as fit: more than one on a full screen, more again on
+  // a 2560px one, where the screen has no 76rem cap (creator-analytics#477), and one on a phone,
+  // counted as the columns the stub's cards fill, which balancing can leave short of the boxes. At
```

**Remediation brief**

- **Design intent:** the Audience screen lays its eight cards out with CSS columns and no script. The browser picks the column count from the container's width (18rem minimum, 1rem gap), balances the column height, and keeps each card whole. The cards read down each column in DOM order. The number of filled columns depends on the card heights, which depend on the channel's data.
- **Full surface:** `apps/web/src/app.css:973-982` (the `.audience-grid` comment) and `apps/site/test/screenshot/browser-walk.ts:2605-2608` (the columns step's comment). No code line changes.
- **Must preserve:** `.audience-grid` and `.audience-grid > [data-slot="card"]` declarations exactly as they are. The walk's `state: audience grid columns` assertions are unchanged. `pnpm test:browser` stays green.
- **Do not touch:** the `break-inside: avoid` and slack checks (Dismissed bullets 1 and 2), and the placeholder step's width-only comparison (Dismissed bullet 4).
- **Proof:** no red-to-green exists for a comment. Run `docs/reviews/creator-analytics-638/repro/measure-columns.ts` per its header in a scratch worktree, and the 2560px line must still print 7 column boxes and 6 used. Then `pnpm lint` and `pnpm test:browser` must be green.
- **Escalation:** whether a blank trailing column on very wide screens is acceptable is a product call for Nick. If it is not, the layout needs Grid Lanes or a reopened decision, which is a new ticket, not this fix.

### 2. The `audience-grid` class and the walk step `state: audience grid columns` still say grid for a layout that is no longer a grid — LOW

- **Location:** `apps/web/src/Audience.tsx:54`, `apps/web/src/Audience.tsx:184`, `apps/web/src/app.css:983`, `apps/web/src/app.css:990`, `apps/site/test/screenshot/browser-walk.ts:2609`
- **Attribution:** introduced as a walked-past refactor (`CODING_STANDARDS.md` standard 3). The name was right at base, where `.audience-grid` was `display: grid`. This branch changed every declaration under the name and renamed the placeholder step to "in the columns", but kept the class and the columns step's name.
- **Real-world trigger:** no user path, so LOW. A maintainer reading `.audience-grid` looks for grid tracks or a `gap` row rule that no longer exists.

**Evidence**

```css
.audience-grid {
  columns: 18rem;
  column-gap: 1rem;
}
```

```ts
await walk('state: audience grid columns', async () => {
```

**Recommended fix:** rename the class to `audience-columns` at every site, and the step to `state: audience columns`.

**Remediation brief**

- **Design intent:** the class is the Audience screen's card container, used both by the landed screen and by its placeholder (`aria-busy="true"`), and the tests and walk find the placeholder by it.
- **Full surface (grep-verified, `grep -rn "audience-grid" apps`):** `apps/web/src/Audience.tsx:54`, `apps/web/src/Audience.tsx:184`, `apps/web/src/app.css:983`, `apps/web/src/app.css:990`, `apps/web/src/placeholder.test.ts:555`, `apps/web/src/app.test.ts:3564`, `apps/web/test/web.test.ts:1737`, `apps/site/test/screenshot/browser-walk.ts:2727`, `apps/site/test/screenshot/browser-walk.ts:2732`, `apps/site/test/screenshot/browser-walk.ts:3185`. Step name: `apps/site/test/screenshot/browser-walk.ts:2609`. The container name `audience-card` is right as it is and stays.
- **Must preserve:** the placeholder and the landed screen share one class, which the second-read step and `placeholder.test.ts`'s `audiencePlacesOn` depend on. `web.test.ts:1737`'s map key `'audience-card'` stays, and only its selector value changes. Suites: `apps/web/src/placeholder.test.ts`, `apps/web/src/app.test.ts`, `apps/web/test/web.test.ts`, `pnpm test:browser`.
- **Do not touch:** the `@container audience-card` breakpoints in `apps/web/src/app.css:1789-1970`.
- **Proof:** after the rename, `grep -rn "audience-grid" apps` prints nothing, and `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/placeholder.test.ts apps/web/test/web.test.ts` and `pnpm test:browser` are green. A missed site goes red in one of them: the placeholder selectors make `placeholder.test.ts` fail its `busyStart` expectation, and the walk's `waitFor` time out.

### 3. Comment hygiene — LOW (aggregated)

- `apps/web/src/app.css:975` — "each as wide as the breakdowns' auto-fit tracks" → "each as wide as an 18rem auto-fit track with a 1rem gap, so the card widths measured below hold". `.video-detail-breakdowns` has a 3rem column gap and only two sections, so its tracks are wider (471px against 319.3px in a 990px container).
- `apps/web/src/app.css:988-989` — "1rem sits under each, the space between the cards of a column" → "1rem sits under each, the space between the cards of a column, which a column break drops". The margin is truncated at an unforced column break, which the measurement shows: 0px under the last card at every width from 1280px.
- `apps/site/test/screenshot/browser-walk.ts:2645-2647` — "this step holds the width, and the second read's step holds the left edge" → "this step holds the width, so the places fill the cards' column count, and the second read's step holds the left edge". In multicol, equal widths mean only an equal column count, and the line should say that is all it proves.

## Needs Further Investigation

None.

## Reviewed and Dismissed

1. **"No walk check holds `break-inside: avoid`."** A fragmented card's bounding box is the union of its fragments, and its slack is negative, so `slack > 1` alone misses it. But with the line deleted, `pnpm test:browser` goes red in the columns step (order), the second-read step and the note-places step, so the rule is held. Do not add a fragment-count check as a fix for a missing test.
2. **The slack measure could false-pass through collapsed margins.** Each card's only child is `section.video-detail-section` (`display: grid`), and the card has padding and is a container, so no margin collapses through. A stretched grid card measured slack 300 in Chrome, and the base oracle went red on it.
3. **The trailing `margin-block-end` adds 1rem under the screen.** Measured 0px at 1280, 1920, 2560, 3000 and 3840px on the real screen. The finder's scratch page showed 1rem only in one tall column at 343px, where 1rem below the last card is not visible as a defect.
4. **The placeholder step dropped its left-edge check.** This is the epic's accepted compromise: on a first visit the places hold the most bars, so a card may change column (#510, #689). The second-read step now holds the left edge at 1280px and 375px, as #689 asks.
5. **"under 37rem whatever the window"** (`apps/web/src/app.css:1758`) is true for multicol with an 18rem width and 1rem gap: one column only below 37rem, and under 27.5rem with two or more.
6. **"A script masonry and fixed spans were rejected (creator-analytics issues 350 and 638)"** is load-bearing and stops a reintroduction. #350 chose the grid with no section spanning two columns, and #638 records both rejections.
7. **The order check compares against the walk's own `audienceHeadings`, not the DOM.** `apps/web/src/app.test.ts:5561` pins the DOM's heading order to the same eight headings, so the two cannot drift silently.
8. **The deleted `web.test.ts` stylesheet test** asserted exact CSS values (grid template, gap, no `align-items`), and its stretch rule is now reversed on purpose. The epic's seam makes the walk the only layout test. `web.test.ts:927-928` now points at the walk and at the breakdowns' test (`web.test.ts:900-916`), which exists.
9. **Container queries inside multicol.** The columns are as wide as the old grid's tracks at every width up to the screen's cap, so every `@container audience-card` breakpoint sees the widths app.css measured. The walk's note-place and bar-row steps are green at HEAD.

## Minor / nits

- `apps/site/test/screenshot/browser-walk.ts:2667-2672` collects each place's `left`, which the step no longer compares. Drop it from the evaluated object, or leave it as part of `Box`.
- The renamed tests `apps/web/src/app.test.ts:5561` ("...in one set of columns...") and `apps/web/src/placeholder.test.ts:591` ("...in the screen's columns") name a layout happy-dom cannot see. Their assertions check one shared parent holding only the cards. The old names had the same gap with "grid". "one container" would match the assertions.

## Test quality

- **Tests added or changed:** 3 walk steps changed, and 2 vitest tests renamed with no assertion change. 1 vitest test deleted (Dismissed bullet 8).
- **Red at base:** `state: audience grid columns`, with stretch faults and a row-major order at 1280px and 2560px. Its two new rules are real.
- **Green at base:**
  - `state: audience placeholder in the columns` is weaker by design (Dismissed bullet 4), and its comment is in Finding 3.
  - `state: audience cards stay put when the numbers land on a second read` cannot go red at base, since a grid card never changes column. Its new left-edge check is a guard for the columns, and the mutation run shows it goes red when columns break.
  - The renamed vitest tests are green at base by construction (Minor / nits).
- **Tautology shapes found:** 0. No mocked unit, no self-computed expectation, no call-only assertion, no snapshot.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite are green at `9cbd27c`, and so is `pnpm test:browser`. `origin/main` is 15 commits ahead of the merge-base and touches `apps/web/src/app.css`, `apps/site/test/screenshot/browser-walk.ts`, `apps/web/src/app.test.ts` and `apps/web/test/web.test.ts`. `git merge-tree` reports a clean merge, but run the walk on the merged tree.
- **Commit hygiene:** two commits, the lane commit and its no-ff merge, plus this review doc and its repro.
- **Likely reviewer asks:** a 2560px screenshot (Finding 1). Why the class kept its name (Finding 2).

## Verdict

**Ready to open a PR as-is**, with follow-ups. No finding gates it. Findings 1 to 3 are LOW: a comment-only fix for 1, a mechanical rename for 2, and a comment batch for 3. Whether a blank trailing column at 2560px and wider is acceptable is Nick's call (Finding 1, Escalation).
