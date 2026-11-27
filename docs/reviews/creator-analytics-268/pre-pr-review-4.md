# Pre-PR review: creator-analytics#268 Channel audience screen, second PR (#326 to #330, #350, #417, #450 to #452)

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `3de6a3d` "Merge pull request #449 from nick-vogel/creator-analytics-267-launch-chart-color-per-video")
**Reviewed at:** HEAD `bb93809` ("creator-analytics#417 Sidebar: the shadcn Sidebar, collapsing to icons"). The tree was clean, with no uncommitted or untracked files at review time. 38 files, +4,159 / −211 against the merge-base, 1,733 of the added lines in `packages/database/drizzle/meta/0018_snapshot.json`.
**Delta under review:** none. A fresh review (`--fresh`) of everything since the merge-base. Pre-PR review 3 (`pre-pr-review-3.md`, at `7045229`) reviewed #326 to #330 on this branch before the third `/epic-loop` run; this review covers those again with the third run's #350 (`cd646b6`, merged as `fb04bb4`), #417 (`65306bc`, merged as `bb93809`), #450 (`180f9c2`, merged as `e40f5b8`), #451 (`290e88a`, merged as `642f4a7`) and #452 (`2c220f4`, merged as `e4b1298`), and the merge of `origin/main` at `1884459`.
**Reviewed against:** the epic creator-analytics#268 (its body is the spec) and its "Amendment 2026-11-04"; the children #350, #417 (and Nick's comment on it of 2026-11-05 on the support item), #450, #451, #452, #326, #327, #328 and #330; `CODING_STANDARDS.md` 1 to 3; ADR 0011 and ADR 0014; the run's ticket assumptions in `.epic-loop/tickets/{350,417,450,451,452}/assumptions.md`; the finding headings of pre-PR reviews 1 to 3.
**Date:** 2026-11-05
**Reviewer:** 3 code-review agents, 1 tautology audit agent, 1 disprove agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 555 files) | pass, before and after this doc and its repro were added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass (the web bundle is 766.1 kB, 248.9 kB gzip; vite's 500 kB chunk warning) |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 128 files, 2,913 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` (real Chrome, built app, stub API) | passed, "No content security policy violation in 34 steps" |
| Tests the branch adds or changes, against `$BASE` | agent: a detached scratch worktree at `3de6a3d` under the scratchpad, the 11 changed test files and `apps/web/test/built-css.ts` copied in, `pnpm exec vitest run` with the JSON reporter, then `built-css.test.ts` again with the base helper; worktree removed | every new rule red at base. 8 cases green, none a finding's proof, each a mechanical adaptation, a renamed title, or a pin of base behaviour (Test quality) |
| Collapsed-sidebar placeholders | agent harness, kept as `repro/collapsed-sidebar-placeholders.sh`: the built CSS (fonts pointed at `dist/assets`, Switzer loaded, checked through `document.fonts`), the real shell, sidebar, `.audience-grid` and Card markup, each note's place beside its landed note with the real text, headless Chrome at 700 to 1100px, sidebar open and collapsed | open: every place matches its note at every width. Collapsed: 12 of 12 rows from 768px have a mismatch, 1 to 6 places each. Finding 1 |
| `topBarsOf` scope leak (#328) | agent differential harness, base and HEAD `top-bars.ts` and `share.ts`, 42 cells (countries, US states, cities, devices, all-zero rows, an `OTHER` row with no `foldedKey`; n = 0, 1, 9, 10, 11, 12, 25) | 0 divergences |
| The `OTHER` fold's edge cases | agent ran `operatingSystemBarsOf` on `OTHER` alone, with 10 and 11 others, with 0 engaged views | each as #328 specifies |
| #327 | `routeAfterLostSwitches` (`video-list.ts:616`), `revertAddressAfterFailedSave` (`route.ts:363`), the `Route` screens in `route.ts:69-74` | the Audience route comes back as the same object; no other screen is skipped |
| #452 stepper names in every state | agent: `VideoStepper.tsx:110`, `:121`; `VideoDetail.tsx:220`, `:231`; every `<nav>` in `apps/web/src` | both names hold in the normal, refused, reading and placeholder states; no other nav collides |
| #417 against its ticket and Nick's comment | agent read of `components/ui/sidebar.tsx`, `tooltip.tsx`, `Sidebar.tsx`, `App.tsx`, the preferences stack and the migration; `grep sidebar_state\|document.cookie\|keydown` | no cookie, no shortcut, no Sheet, no transition; open by default; reset and user deletion clear it; both support links open a new tab and still track `support_opened`; Hide on the link's row; the collapsed item hidden (assumption recorded); migration additive and nullable, snapshot agrees |
| CSP of the sidebar's widths and the tooltip | `app.css:1797-1802` (`--sidebar-width`, `--sidebar-width-icon` in the sheet); Base UI's positioner style through React's `style` prop (CSSOM); the browser walk's CSP check | no inline style attribute or element; the walk passes |
| #350 grid, cards, bar and h1 | agent read of `Audience.tsx`, `card.tsx`, `app.css:369-384`, `:664-683`, `visually-hidden` | as specified; finding 3 on the copied track rule |
| #450 bar row height | declared sizes: name line 0.9375rem × 1.6 + 0.25rem gap + 0.5rem track = 36px against the place's 24px + 0.25rem + 0.5rem | equal on the Audience screen and the video page |
| #451 delay note steps | `app.css` `.placeholder-note` rules against their comment and `web.test.ts:941` | match |
| `docs/oauth-verification.md` | every "shot N" reference, the shot's texts against `sidebar.ts` and `Audience.tsx`, `grep '—'` on the added lines | all references right; no em-dash |
| Merge with `origin/main` | `git merge-tree --write-tree origin/main HEAD` (`origin/main` has moved on with PR #453, creator-analytics#236) | one conflict, `apps/site/test/screenshot/browser-walk.ts`; eight other files auto-merge |
| Browser-only behaviour | not run beyond the walk | the sticky bar's rounded corners over scrolled content (B), and Nick's walk #335 in real Chrome and Safari |

**Overall:** The five new children do what their tickets ask, and the four earlier ones still hold. All five full checks pass, including the browser walk with no policy violation. Six LOW findings and no MEDIUM or above. The broadest is finding 1: the collapsed sidebar, which #417 adds, widens the screen's column by 96px, and every loading placeholder measured "beside the sidebar" was measured beside the open one, so for a creator who collapses the sidebar the notes' places are a line or two off from 768px to about 1100px and the content moves when the numbers land. The rest are a dead prop, a copied grid rule, test and walk gaps, and comment hygiene. The branch is ready for its PR once it takes `origin/main`, whose merge conflicts in the browser walk.

## Approach decisions
- Carried from reviews 1 to 3, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies.
- The collapsed sidebar's placeholders (finding 1): keep the viewport media bands, and add, beside each band that says "beside the sidebar", a collapsed band scoped to `.signed-in-shell:has(> .sidebar[data-collapsible="icon"])`, with widths measured collapsed in the same harness (`repro/collapsed-sidebar-placeholders.sh`), the way #375 added the open bands beside the no-sidebar ones. Container queries on the screen's column would key every band on one width and collapse the three sets into one, but `container-type` adds layout containment to the screen, which makes it the containing block of every fixed descendant, so it is a design change for its own ticket, not this fix.
- The Audience grid's track (finding 3): one declaration for both grids, a selector list, the precedent of the shared `.placeholder-note, .placeholder-total-note` rule (`app.css:1328-1332`).

## Confirmed Issues

### 1. With the sidebar collapsed, the loading placeholders' notes hold the wrong number of lines from 768px to about 1100px, so the screen moves when the numbers land — LOW
- **Location:** `apps/web/src/app.css:1865-1867` (the collapsed column), against the bands measured beside the open sidebar at `:1284` (the video head's title, 61.25rem), `:1372` (`.placeholder-total-note`, 48rem to 54.3125rem), `:1378` (`.placeholder-note`, 48rem to 64.4375rem), `:1433` (`.placeholder-launch-total-note`, 48rem to 55.5rem), `:1558`, `:1570` and `:1625` (the Audience notes at 48rem, 52.75rem and 72.5rem) and `:1686` (`.placeholder-not-processed`, 65.875rem).
- **Attribution:** introduced, `65306bc` (#417). `git log --oneline -S'data-collapsible="icon"' 3de6a3d..HEAD` names `65306bc` and its merge only. The bands themselves are older (#326, #375, #350) and right for the open sidebar; the collapsed state made them wrong.
- **Real-world trigger:** a creator on a tablet in landscape, a small laptop or a narrowed window (768px to 1100px) collapses the sidebar to get width back, which #417 exists for. The choice is a saved preference, so every load of the Audience screen and the channel screen afterwards shows placeholders sized for the open sidebar's narrower column. On the Audience screen at 768px the countries note's place holds 2 lines while the note wraps to 4 (the grid has two columns collapsed and one open); at 1024px the delay note's place holds 2 lines for a 1-line note. LOW, as review 3 rated the same kind of jump (its finding 3, now #451): the numbers are right and the layout settles once they land, but the reach is every collapsed creator at those widths, which no earlier finding of this kind had.
**Evidence**
```css
  .signed-in-shell:has(> .sidebar[data-collapsible="icon"]) {
    grid-template-columns: var(--sidebar-width-icon) minmax(0, 1fr);
  }
```
```css
/* ... From 48rem
   the sidebar's 9rem column and its 2.5rem gap (11.5rem, 184px) narrow the screen's column, so each
   note holds 2 lines in a band from 48rem, measured beside the sidebar on 2026-11-04 ... */
```
`grep -n collapsible apps/web/src/app.css` finds only `:1865`, `:1875` and `:1893`: no placeholder rule knows the collapsed state.
**Failure mode** — Executed: `pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh`. Each cell is the place's height against the landed note's (40px = 1 line, 64 = 2, 88 = 3, 112 = 4):
```
open       768px screen=523 nav=144 cols=1/1 | countries 64/64 | us-states 64/64 | every-format 40/40 | cities 64/64 | gender 40/40 | total 64/64 | delay 64/64 | launch-total 64/64
collapsed  768px screen=619 nav=48 cols=2/2 | countries 64/112 DIFF | us-states 64/88 DIFF | every-format 40/64 DIFF | cities 64/88 DIFF | gender 40/64 DIFF | total 64/40 DIFF | delay 64/64 | launch-total 64/64 <<< 6 DIFF
collapsed  800px screen=648 nav=48 cols=2/2 | countries 64/88 DIFF | us-states 64/88 DIFF | every-format 40/40 | cities 64/88 DIFF | gender 40/64 DIFF | total 64/40 DIFF | delay 64/64 | launch-total 64/40 DIFF <<< 6 DIFF
collapsed  950px screen=786 nav=48 cols=2/2 | ... | delay 64/40 DIFF | launch-total 40/40 <<< 1 DIFF
collapsed 1100px screen=932 nav=48 cols=3/3 | countries 88/112 DIFF | us-states 88/112 DIFF | every-format 40/64 DIFF | cities 64/88 DIFF | ... <<< 4 DIFF
```
Every open row matches; the 700px control (below 48rem, the sidebar a row) matches in both states; every collapsed row from 768px to 1100px has at least one mismatch except 900px. The Audience grid itself follows the column in both states (placeholder and landed columns are equal), so the cards line up; it is the notes inside them that are off, and the grid's column breakpoints move too (3 columns from about 1064px collapsed, against 1160px open, which the 72.5rem band assumes).
**Recommended fix** — For each band listed under Location, add a collapsed band after it, scoped to the collapsed shell, with its widths measured collapsed. The shape, for the running total note (widths are placeholders the measurement replaces):
```diff
 @media (min-width: 48rem) and (max-width: 54.3125rem) {
   .placeholder-total-note {
     --lines: 2;
   }
 }
+@media (min-width: 48rem) {
+  .signed-in-shell:has(> .sidebar[data-collapsible="icon"]) .placeholder-total-note {
+    --lines: 1;
+  }
+}
```
Each comment that says "beside the sidebar" says "beside the open sidebar", and gains a sentence on the collapsed band and its measurement date, as `app.css:1308-1313` does for the open one.
**Remediation brief**
- **Design intent:** a loading placeholder holds exactly the lines its landed text wraps to at the screen's real column width, so nothing moves when an answer lands (#326, #450, #451). Below 48rem the sidebar is a row and the column is the viewport less the gutter; from 48rem the column is the viewport less the gutter, the sidebar's track (9rem open, 3rem collapsed, `app.css:1801-1802`) and its 2.5rem gap. The open bands exist; the collapsed ones do not.
- **Full surface:** `apps/web/src/app.css:1263-1290` (the head title rule and comment), `:1304-1332` and `:1372-1383` (delay and running total notes), `:1403-1438` (launch total note), `:1440-1460` and `:1521-1640` (the Audience notes and their comment), `:1660-1690` (`.placeholder-not-processed`); the stylesheet tests that pin each band, `apps/web/test/web.test.ts:659-690` (head title), `:922-945` (delay note), the running total and launch total tests beside it, `:1038-1135` (the Audience notes' `lineCounts` tables), and `notProcessedLinesAt` in `apps/web/src/placeholder.test.ts:518-544`, which mirrors the widths. The selector `.signed-in-shell:has(> .sidebar[data-collapsible="icon"])` is `app.css:1865`'s; the shell's markup is `SidebarProvider` in `App.tsx:529-533` around `Sidebar` (`components/ui/sidebar.tsx:65-75`, which sets `data-collapsible`).
- **Must preserve:** every open-sidebar and no-sidebar band and its measured widths (the repro's open rows all match, and must still match); the media blocks' ascending source order, so each later step overrides the one before. A collapsed rule's `:has()` selector outranks every open rule whatever the order, so each place's collapsed rules hold that place's whole step list from 48rem up, never one band that leans on a later open rule; `.placeholder-note` and `.placeholder-total-note` keeping separate `--lines` (#451); the stylesheet tests above, extended for the collapsed bands rather than rewritten; the walk's collapse step (`browser-walk.ts:427-484`).
- **Do not touch:** the collapsed column's 3rem width and the shell's grid (assumption of #417); the Audience grid's track (finding 3 changes its declaration, not its value); the delay note's 4-line base (#451).
- **Proof:** `pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh | grep -c DIFF` prints 12 now and 0 after. Add widths to the script's list when a collapsed band's edge falls between them.
- **Escalation:** the fix is a re-measurement of seven families of places, more than an in-place edit; recommend a follow-up ticket, as #450 and #451 were for review 3's placeholder findings.

### 2. `RouteLink`'s `ariaCurrent` prop has no caller left — LOW
- **Location:** `apps/web/src/RouteLink.tsx:31`, `:40-41`, `:51`
- **Attribution:** introduced, `65306bc` (#417). At `$BASE` the sidebar was the one caller (`git show 3de6a3d:apps/web/src/Sidebar.tsx | grep -n ariaCurrent` gives `:36`); #417 replaced it with its own `<a>` through the menu button's `render` prop, and `git grep -n ariaCurrent -- apps` now finds only `RouteLink.tsx`. A refactor walked past (`CODING_STANDARDS.md` 3): the change edited the only caller and left the parameter and its doc line.
- **Real-world trigger:** none for users. A reader takes the prop for a live feature and keeps it in step. LOW.
**Evidence**
```tsx
  ariaCurrent,
  ...
  /** Marks the link to the screen on view. */
  ariaCurrent?: 'page' | undefined
  ...
      aria-current={ariaCurrent}
```
**Failure mode** — Dead code with a doc comment that says it marks the current screen's link, which no `RouteLink` does now.
**Recommended fix**
```diff
   className,
   ariaLabel,
-  ariaCurrent,
   onFollow,
   children,
 }: {
@@
   ariaLabel?: string
-  /** Marks the link to the screen on view. */
-  ariaCurrent?: 'page' | undefined
   /** Called when the link is followed in place, before the screen moves. */
@@
       aria-label={ariaLabel}
-      aria-current={ariaCurrent}
       onClick={(event) => followInPlace(event, route, navigate, onFollow)}
```
**Remediation brief**
- **Design intent:** `RouteLink` is the app's in-place link; `followInPlace` (`RouteLink.tsx:9-23`) is its click rule, which the sidebar now calls directly because Base UI's tooltip trigger needs props `RouteLink` does not spread (assumption of #417).
- **Full surface:** `apps/web/src/RouteLink.tsx:31`, `:40-41`, `:51`. No other file names the prop.
- **Must preserve:** the six other `RouteLink` callers (`Header.tsx:29`, `PublishDayTop.tsx:36`, `VideoDetail.tsx:501`, `VideoList.tsx:161`, `:265`, `:273`, `VideoStepper.tsx:163`); the sidebar's `aria-current`, set in `Sidebar.tsx` and pinned by `app.test.ts:3106`.
- **Do not touch:** `Sidebar.tsx`'s own `<a>` with `followInPlace`, which is deliberate (dismissed below).
- **Proof:** `git grep -n ariaCurrent -- apps` prints three lines now and none after; `pnpm typecheck` and `pnpm exec vitest run apps/web/src/app.test.ts` green after.

### 3. The Audience grid copies the breakdowns' track rule instead of sharing it — LOW
- **Location:** `apps/web/src/app.css:679-683`, beside `:664-670`
- **Attribution:** introduced, `cd646b6` (#350). #350 asks for "the same auto-fit grid the video page's breakdowns use", and the change wrote a second declaration of it. `CODING_STANDARDS.md` 3.
- **Real-world trigger:** a later change to the breakdowns' minimum column edits one rule. `web.test.ts` pins the two values equal, so the drift goes red; the cost is a maintenance trap, not a wrong layout. LOW.
**Evidence**
```css
.video-detail-breakdowns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  ...
.audience-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}
```
**Failure mode** — Two declarations of one rule.
**Recommended fix**
```diff
-.video-detail-breakdowns {
+.video-detail-breakdowns,
+.audience-grid {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
+}
+
+.video-detail-breakdowns {
   row-gap: 1.5rem;
   column-gap: 3rem;
   align-items: start;
 }
@@
 .audience-grid {
-  display: grid;
-  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
   gap: 1rem;
 }
```
**Remediation brief**
- **Design intent:** one track rule for the app's section grids: as many columns of at least 18rem as fit, one on a phone. Each grid keeps its own gaps and alignment: the breakdowns borderless with 3rem columns and start alignment, the Audience cards 1rem apart and stretched to a row's tallest card.
- **Full surface:** `apps/web/src/app.css:664-670`, `:679-683`, and their comments at `:655-663` and `:672-678`; the grid test in `apps/web/test/web.test.ts` around `:560-580`, which reads `grid-template-columns` of `.audience-grid` with `valueIn`.
- **Must preserve:** `.video-detail-breakdowns`' `row-gap: 1.5rem`, `column-gap: 3rem` and `align-items: start`; `.audience-grid`'s `gap: 1rem` and its default stretch (the test at `web.test.ts:574` asserts no start alignment).
- **Do not touch:** the placeholder's use of `.audience-grid` (`Audience.tsx:47`), which keeps the cards' places in the same grid.
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "Audience"` green before and after; `grep -c 'minmax(min(100%, 18rem), 1fr)' apps/web/src/app.css` prints 2 now and 1 after (check `valueIn` matches a selector inside a list, as review 3 noted it does).

### 4. Five of the new tests assert copy or repeat a rule another test states — LOW
- **Location:** `apps/web/src/app.test.ts:3498`; `apps/web/src/sidebar.test.ts:30`, `:33`, `:42`, `:45`, `:54`, `:55`, `:65-68`; `apps/web/src/components.test.ts:1331`, `:1403`, `:1414`, `:1420-1421`, `:1530`; `apps/web/src/app.test.ts:3165`
- **Attribution:** introduced: `cd646b6` (#350, the h1 literal), `65306bc` (#417, sidebar.test.ts), `2c220f4` (#452, the stepper names).
- **Real-world trigger:** an approved rewording, or a new icon, turns these red when nothing broke; and a rule stated twice has to be edited twice. `CODING_STANDARDS.md` 2: no copy tests, one rule one test. LOW.
**Evidence**
```ts
    expect(audienceHeading).toBe('Audience')                                   // app.test.ts:3498
    { text: videosLinkText, icon: ListVideo, address: '?window=last90&page=2', current: true }, // sidebar.test.ts:30
    expect(sidebarToggleLabelOf(true)).toBe(collapseSidebarLabel)               // sidebar.test.ts:66
    expect(markup).toMatch(/^<nav class="video-stepper" aria-label="Videos, top of page"[^>]*>/) // components.test.ts:1403
```
**Failure mode** — Per site:
- `app.test.ts:3498` asserts the constant's literal, a copy test; the line before it already states the rule (one h1, its text the heading, visually hidden).
- `sidebar.test.ts` `icon: ListVideo` / `icon: Users`: the spec asks for one lucide icon per link, not which one, so the equality restates the source.
- `sidebar.test.ts:65-68` states the toggle's name per state, which `app.test.ts:3038` states through the rendered button.
- `components.test.ts:1331`, `:1403` and `:1414` carry the stepper's name inside tests of other rules (the links' names, the refused layout), which the `test.each` at `:1418-1435` states on its own; `:1420-1421`, `:1530` and `app.test.ts:3165` write the approved names as literals where `stepperNames` (`video-step.ts:73-76`) holds them, as the same file imports `refusedPageText` and `retryText`.
**Recommended fix** — Delete `app.test.ts:3498`. In `sidebar.test.ts`, drop the `icon` keys from the expected links and add one assertion that each link has an icon and the two differ (`new Set(links.map(({ icon }) => icon)).size === 2`), and delete the toggle test at `:65-68` with its imports. In `components.test.ts`, return `:1331`, `:1403` and `:1414` to `^<nav class="video-stepper"[^>]*>`, and in the `test.each` at `:1418-1435`, `:1530` and `app.test.ts:3165` import `stepperNames` and assert `stepperNames.top` and `stepperNames.bottom`, plus `expect(stepperNames.top).not.toBe(stepperNames.bottom)` once.
**Remediation brief**
- **Design intent:** a test states one rule as a fact about real output; approved copy is held by Nick's approval on its issue (`sidebar.ts:4-11`, `video-step.ts:71-76`), not by the suite.
- **Full surface:** the sites listed under Location.
- **Must preserve:** the rules each file keeps: the h1 count, text and class (`app.test.ts:3494-3497`); the links' addresses, kept query and current flag (`sidebar.test.ts:28-62`); the toggle's name in each state through the DOM (`app.test.ts:3038`); each stepper named for its position and keeping it while refused (`components.test.ts:1418-1435`); every nav's own name on both screens (`app.test.ts:3160-3180`).
- **Do not touch:** the API rejection row `preferences.test.ts:97` ("a string for the sidebar"), green at base only because the key did not exist (dismissed below).
- **Proof:** `pnpm exec vitest run apps/web/src/sidebar.test.ts apps/web/src/components.test.ts apps/web/src/app.test.ts` green after; in a scratch copy, change `stepperNames.top` to `'Videos'` and the `test.each` and the nav-name test go red.

### 5. The browser walk cannot see link text left on view in the collapsed sidebar, nor a placeholder that changes height — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:427-439` ("state: sidebar collapsed to icons"), `:1991-2020` ("state: audience placeholder in the grid")
- **Attribution:** introduced, `65306bc` (#417) and `cd646b6` (#350).
- **Real-world trigger:** a later change renames the menu button's `data-slot` or wraps its `<span>`, so `app.css:1875`'s rule stops clipping the text: the collapsed nav still measures 3rem (its grid track is fixed) and the walk passes with the text spilling over the screen. And a placeholder card that is shorter or taller than its landed card (finding 1, or #450's old 28px) passes the placeholder step, which compares `left` and `width` only. LOW, test coverage.
**Evidence**
```ts
      if (!(collapsedWidth < openWidth && collapsedWidth <= 3 * rem)) {
```
```ts
          const { left, width } = place.getBoundingClientRect()
          return { left, width }
```
**Failure mode** — The collapse check measures the nav, whose width the shell's track fixes whatever the content does; the placeholder check compares columns, which the shared `.audience-grid` makes equal by construction.
**Recommended fix** — In the collapse step, after `collapsedWidth`, read the `Videos` link's `scrollWidth` and fail when it is more than `3 * rem`. In the placeholder step, also return `top` and `height` per card, and compare each card's `height` with the landed card's in the same place for the cards whose section lands with three bars in the stub (state in the step which those are), or leave height to the declared-size tests and say so in the step's comment.
**Remediation brief**
- **Design intent:** the walk is the only place a real layout is observed (`CODING_STANDARDS.md` 2, a test states its limits); each step should fail on the break it names.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:427-439`, `:1991-2020`; the stub's Audience answer in `apps/site/test/screenshot/stub-api.ts` for how many bars each section lands with.
- **Must preserve:** the walk's 34 steps and its CSP check; the collapse step's `finally`, which expands the sidebar again for the later steps.
- **Do not touch:** the tooltip check's exclusion of text inside `nav` (`:465`), which keeps the link's own clipped text from counting as the tooltip.
- **Proof:** in a scratch copy, delete `app.css:1874-1881` (the collapsed span rule) and run `pnpm test:browser`: green now, red after the fix.

### 6. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:372-373` — "a border all round with the cards' 0.75rem radius" → "a border all round with the Audience cards' and the numbers table's 0.75rem radius" (the channel summary `.card` is 1rem, `app.css:200`)
- `apps/web/src/app.css:374-376` — "It no longer runs into the gutter, on either side or beside the sidebar (creator-analytics issue 350)." → "It sits inside the screen's column on every side, beside the sidebar too (creator-analytics issue 350)."
- `apps/web/test/web.test.ts:492` — "The bar no longer runs into the gutter, so the sidebar's side needs no rule of its own." → "The bar sits inside the screen's column, so the sidebar's side needs no rule of its own."
- `apps/web/test/web.test.ts:428` — test title "(creator-analytics#350, which undoes #119 W2)" → "(creator-analytics#350)"
- `apps/web/src/video-step.ts:71` — "The two steppers' accessible names, the words creator-analytics#452 names." → "The two steppers' accessible names, approved word for word in creator-analytics#452. Change them only with Nick." (the form of `sidebar.ts:4-5`, `:10`)
- `apps/site/test/screenshot/browser-walk.ts:27` — a 130-character header line → re-wrap the paragraph to the file's 100 columns

## Needs Further Investigation
### A. The support answer read on a tab's return can land after a newer read and bring the item back — confirm with two held reads
`App.tsx:388-394` calls `readSupport().then(setSupport, () => {})` on every `visibilitychange` to visible, with no guard on order, beside the first read (`:314`) and the reset's (`:439`). A read sent before the webhook recorded the tip (`prompt: true`) that lands after one sent after it (`prompt: false`) shows the item again until the next return; a visibility read answered before the reset's DELETE, landing after the reset's own read, keeps a dismissed item hidden. Reasoned, not executed. Confirm in `apps/web/src/app.test.ts` with the fake API's `api.hold('GET /api/me/support')` twice, releasing the second before the first. Fix shape if it holds: `latestOnly` (`apps/web/src/api.ts:18-31`), the guard the Audience read uses.

### B. Scrolled content may show through the stuck controls bar's rounded corners — confirm by a screenshot
`app.css:377-384` gives the sticky bar a 0.75rem radius on the page's background. Once stuck at the top, the four corner areas outside the radius are transparent, so rows and cards scrolling under it may show in them. Confirm with a headless Chrome screenshot of the channel screen scrolled by 400px at 1280px; it is a look question for Nick if it shows.

## Reviewed and Dismissed
- The sidebar's links use their own `<a>` with `followInPlace` instead of `RouteLink` — Base UI's tooltip trigger adds a ref and focus and hover handlers that `RouteLink` does not spread (assumption of #417); `aria-current` and the in-place follow hold (`app.test.ts:3106`).
- `SidebarProvider`'s open state is the saved preference with no state of its own — the save is optimistic (`App.tsx:337`), a failed save reverts through the generic path with its notice, and a collapse made before the read lands survives it (`preferencesAfterRead`).
- Base UI's tooltip and positioner styles break the content security policy — they go through React's `style` prop, so through the CSSOM, under `CSPProvider disableStyleElements` (`main.tsx:47`); the walk saw no violation.
- The collapsed sidebar hides the support item — Nick's comment asked for a decision; assumption of #417, reversible, collapsing dismisses nothing.
- Only `visibilitychange` triggers the re-read, not `focus` — Nick's comment names `visibilitychange` to visible; a `target="_blank"` link opens a tab, which hides the first.
- An `OTHER` with 0 engaged views draws an "Other operating systems 0 (0%)" bar (`top-bars.ts:31-33`) — #328: the rest bar "shows whenever Google answers OTHER"; review 3 noted the same.
- `topBarsOf`'s doc says folded rows always add into the `otherName` bar, while with no `otherName` they get bars of their own — the same comment's next sentence says "With no `otherName`, one bar for every row", and no caller passes `foldedKey` alone.
- `video-list.test.ts:1271-1282` repeats the Watch hours cell above it — #327's acceptance names "does not navigate" as its own rule, which the cell above does not observe.
- `docs/oauth-verification.md:194` says every Audience section "shows bars" while the subscriber split shows figures — the split shows a bar under its figures.
- The delay note's comment (`app.css:1315-1318`) says the 2 and 1 line steps were "not measured again" after a run "at every width from 320px to 1440px" — the run of 2026-10-24 measured the 4 to 3 step (#451); the other steps keep their 2026-10-09 measurement, as written.
- The Ctrl+B and Cmd+B tests went red at base only because the toggle helper throws — at HEAD they assert the sidebar's state and no request, a fair negative.
- The API rejection row "a string for the sidebar" (`apps/api/src/preferences.test.ts:97`) is green at base — the key did not exist there; at HEAD the row pins the type check, with the boolean's acceptance in "every value the shared types allow is saved and read back".
- `app.test.ts` "reads nothing while the tab is hidden" and the renamed "a click on the link is left to the browser" are green at base — a negative control paired with the red visible test, and an unchanged body with a new title.
- `App.tsx:526-527` "Open until the preferences read lands, and then as saved, while the screen still waits for that read" — `setSaved` and `setPreferencesRead(true)` land in one render, so the sidebar takes its saved state no later than the screen's numbers.

## Minor / nits
- `apps/web/src/App.tsx:388-394`: the re-read runs on every return to the tab for the whole session, also when the sidebar shows no item (tipped, hidden, no link, no channel). Reading only while `sidebarSupportLink !== null` would spare the requests.
- `apps/web/src/App.tsx:532`: `onOpenChange` is a new function each render, so the provider's `useMemo` (`components/ui/sidebar.tsx:44-51`) recomputes every render. Harmless.
- `apps/web/src/app.test.ts:3959`: `becomeVisible` is also called as `becomeVisible('hidden')` (`:3991`); `setVisibility` would say what it does.
- No test fails a `sidebarOpen` save; the generic failed-save tests cover the path.
- `apps/web/test/built-css.ts` `utilityRulesOf` splits selector lists on every comma, inside `:is()` and `:where()` too; harmless for the property checks today.
- `browser-walk.ts`: the 375px check passes when the button is absent under either label only for "Collapse the sidebar"; checking both labels would hold if a collapsed state were ever left saved. The tooltip check could scope to `[data-slot="tooltip-content"]`.
- `apps/web/test/web.test.ts`, the #450 test compares declared sizes; its file header states the limit.
- `VideoStepper.tsx:121`: a single video with no neighbours renders two named navs holding empty places. Pre-existing, untouched.
- `docs/oauth-verification.md:220`: shot 11's caption leaves out operating systems, and "Click 'Audience' in the sidebar" assumes the sidebar open; a "Before recording" line "The sidebar is open" would hold the take. Copy, for Nick.

## Carried forward from review 3, still open
Review 3's findings 1 and 3 closed through #452 and #451. Still open at `bb93809`, unchanged and not re-rated: finding 2 (the head title comment points at "creator-analytics issue 326's pull request", now `app.css:1269`), finding 4 (`placeholder.test.ts:466`, the every-format test skips the countries section), finding 5 (the Audience note places repeat the note place's width and height rule, `app.css:1456-1462` beside `:1328-1332`; the same `calc` is now written four times), and finding 6's third entry (`app.css:1267`, "the same way at every width"). The run's close-out filed none of them.

## Test quality
Tests added or changed: about 80 cases in 11 files (`delete-user.test.ts` 1, `apps/api/src/preferences.test.ts` 3, `app.test.ts` 19, `components.test.ts` 11, `devices.test.ts` 5, `placeholder.test.ts` 3, `apps/web/src/preferences.test.ts` 2, `sidebar.test.ts` 5, `video-list.test.ts` 4, `built-css.test.ts` 5, `web.test.ts` 14). Green against `$BASE`: 8, none a finding's red to green proof: the API rejection row, two support tests (a negative control and a retitled body), "on the profile, neither is current", two `components.test.ts` cases adapted to the new `stepper` prop, a comment-only edit, and the title-case fallback test with new inputs (review 3 kept it). Tautology shapes: no mocked unit, no snapshot, no assertion-free test; copy and duplicate assertions are finding 4; the stylesheet tables in `web.test.ts` mirror app.css's measured widths, a change detector its header owns. Coverage gaps: finding 5 (the walk), and NFI A (no ordering test for the support re-read).

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and the browser walk pass at `bb93809`. `origin/main` has moved on (PR #453, creator-analytics#236), and `git merge-tree` shows a conflict in `apps/site/test/screenshot/browser-walk.ts`; merge `origin/main` and run the full checks again before the PR.
- **Commit hygiene:** this doc and `repro/collapsed-sidebar-placeholders.sh` are the only new files. Nothing to drop.
- **Likely reviewer asks:** the collapsed-sidebar placeholders (finding 1, a follow-up ticket); review 3's head title list and bar count for #326 in the PR body (its finding 2); the open children #329 (Privacy Policy wording) and #335 (Nick's walk in Chrome and Safari, which should now include the collapsed sidebar at 768px to 1100px); the support item's collapsed form (assumption of #417) and the new-tab return, for Nick.

## Verdict
**Ready to open the PR, with follow-ups, once it takes `origin/main`.** No CRITICAL, HIGH or MEDIUM. Six LOWs, none a gate: finding 1 is a re-measurement best done as its own ticket; findings 2, 3 and 6 are small edits; findings 4 and 5 are test and walk edits. The one precondition is the merge of `origin/main`, whose conflict in the browser walk has to be resolved and the full checks run again.
