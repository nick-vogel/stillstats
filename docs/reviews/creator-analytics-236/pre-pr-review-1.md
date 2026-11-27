# Pre-PR review: creator-analytics#236 Video list paging and the daily table

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `1dc23c5` "Merge pull request #321 from nick-vogel/creator-analytics-266-web-app-fixes")
**Reviewed at:** HEAD `f0916ea` ("creator-analytics#240 Video list: First page and Last page links"). The tree was clean, with no uncommitted or untracked files at review time. 19 files, +671 / −236 against the merge-base. The branch is origin/main plus the harness fix `35ca0da` and three lanes: #241 (`2c19de3`, merge `79dab2d`), #239 (`eeba0ed`, review-pass fix `189dbd9`, merge `7e9740c`) and #240 (`fee2044`, merge `f0916ea`).
**Reviewed against:** the epic body of creator-analytics#236 (End state, User Stories, Implementation and Testing Decisions), the bodies of #239, #240 and #241 (their acceptance criteria are the requirements), the per-ticket assumptions recorded by the run, and `CODING_STANDARDS.md` 1 to 3. A full review (`--fresh`), not delta-scoped; this folder held no prior review. The repo has no `CLAUDE.md`.
**Date:** 2026-10-22
**Reviewer:** 2 code-review agents + tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (478 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110/110 files, 2496 passed, 1 expected fail |
| New tests against `$BASE` (tautology oracle) | Scratch worktree at `1dc23c5`, the branch's 8 modified test files copied in, each run alone; the extension file rerun with the branch's `testing.ts` copied in | Every test that pins new behaviour is red at base. Green at base: the two preservation pins the spec asked for (a video title still asks for the top; a modified click is left to the browser), the in-flight `video-list.test.ts` cases whose fixture only gained `listKey`, and 6 `numbers-table.test.ts` cases whose arguments only lost `mode`. See Test quality |
| Callers of the dropped `mode` | `git grep` over `apps/` and `packages/` for `viewsTableOf`, `numbersTableBoxRowsOf`, `numbersTableRowsOf`, `daysIn`, `<NumbersTable` | Only the updated call sites. `VideoDetail.tsx:156` and `ChannelSummaryFigures.tsx:57` both render the one `MetricCharts`, so the channel summary and the video page share the daily table; both placeholders go through `MetricChartsPlaceholder` |
| `table:has(tfoot)` dropped from `app.css` | Grep of the `numbers-table` class and specificity of the row-line rules | Only `NumbersTable.tsx` uses the class, every numbers table now has a tfoot, and the new rule still outranks the shared row line |
| Extension timeout guard (`35ca0da`) | Read of vitest 5.0.3's runner (`withTimeout`, `abortIfTimeout`, `context.signal`) | The test's `signal` aborts on timeout, and `throwIfAborted` only throws after `withTimeout` has settled, so the guard cannot mask a failure or leave an unhandled rejection |
| Table node through a page read | Read of `VideoListRows` and `videoListShownOf` | `placeholder-rows` and `videos` render the same `<table>` at the same tree position, so focus set in the click handler survives the rows landing (the App test asserts `activeElement` after settle) |
| Pager markup, order, hrefs | Read of `Pager` and the component markup test | First page from page 3, Last page to page M − 1 exclusive, order First, Previous, Page N of M, Next, Last, no pager on one page, each link `{ ...route, page }` |
| Em-dashes in shipped copy | Grep of added lines | none |
| Browser behaviour (landing under the bar, VoiceOver, 375px pager, focus ring) | Not run | happy-dom has no layout, stylesheet or screen reader. The epic names Nick's browser walk for these; items A and B below add to it |

**Overall:** All three tickets do what their acceptance criteria ask, the full checks are green, and every test that pins new behaviour goes red at the base. No finding gates the PR. The confirmed findings are LOW test hygiene under `CODING_STANDARDS.md` 2 (two pairs of tests that state one rule twice, two exact-class-string assertions, and a missing limits note for the pager's CSS) and one loose comment. Two layout and screen-reader questions need Nick's browser walk.

## Approach decisions
- Where a pager link lands (#239): `RouteLink` takes an optional `land` callback, defaulting to `window.scrollTo(0, 0)`; `Pager` passes `() => landOnList(table, controlsBar, window)`, which runs synchronously in the click handler right after `navigate`, scrolls instantly to `max(0, scrollY + tableTop − barHeight)` and focuses the table with `preventScroll`. Kept.
- Keeping the summary's place steady while another page reads (#239 review pass 1 finding 1, `189dbd9`): `readsAnotherPageOf` compares `listKey` (the read's key minus its page) and `summaryPlaceListOf` keeps the last answer only under "Publish day" (`first1`), whose top ranks the whole list. Kept; item A asks whether the other after-publish windows need the same.
- The daily table (#241): `mode` is removed from `viewsTableOf`, `numbersTableBoxRowsOf`, `numbersTableRowsOf` and `NumbersTable`, so the table cannot follow the toggle; `ViewsTable.total` is required and the tfoot unconditional. Kept.

## Confirmed Issues

### 1. Two pairs of tests state one rule twice — LOW
- **Location:** `apps/web/src/video-list.test.ts:472-480`; `apps/web/src/components.test.ts:865-881`; `apps/web/src/heading-hold.test.ts:45-47` and `:54-56`
- **Attribution:** introduced. `git log -S"listCaptionOf(2, 5)" 1dc23c5..HEAD` → `eeba0ed` (#239); `git log -S"carry the route with only its page changed"` → `fee2044` (#240); `git log -S"with no controls bar, puts"` → `eeba0ed` (#239).
- **Real-world trigger:** none for a creator. The cost is maintenance: an edit to the approved caption or to the pager's hrefs has to be made in two tests, and `CODING_STANDARDS.md` 2 ("A duplicate that covers a rule an existing test already covers. One rule, one test") calls for deletion.

**Evidence**
```ts
// video-list.test.ts:473-479
expect(listCaptionOf(2, 5)).toBe('Videos, page 2 of 5')
expect(listCaptionOf(1, 1)).toBe('Videos, page 1 of 1')
// app.test.ts:1075 and :1156 already read both strings from the rendered table's caption
// components.test.ts:878-879
expect(hrefFor('First page')).toBe(escaped(hrefOf({ ...route, page: 1 })))
expect(hrefFor('Last page')).toBe(escaped(hrefOf({ ...route, page: 12 })))
```

**Failure mode** —
- The caption unit pair restates the approved literal (close to a copy test), and the App tests at `app.test.ts:1063-1077` and `:1151-1157` pin the same two strings through the DOM, where the branch they observe (the page changed, a single page) is real.
- The components test builds its expected href with `hrefOf`, the helper `RouteLink` writes the href with, so a serialisation bug cannot fail it; the App test "%s opens its page and keeps the list's window, sort, format, page size and visibility" (`app.test.ts:1079-1110`) pins the same rule against literal addresses and the API reads.
- `heading-hold.test.ts:45` ("lands the table lower under a taller bar") is the `:40` case with other numbers. `:54` ("with no controls bar") calls `listLandingTopOf` with `barHeight: 0`, so it never drives the code that handles a missing bar, `bar?.offsetHeight ?? 0` in `landOnList` (`heading-hold.ts:59`), although its name claims that case.

**Recommended fix** — delete `video-list.test.ts:472-480` (and the now-unused `listCaptionOf` import in that file), delete the `components.test.ts:865-881` test, delete `heading-hold.test.ts:45-47`, and delete `heading-hold.test.ts:54-56` or rewrite it to call `landOnList(table, undefined, fakeWindow)` and assert the scroll top equals `scrollY + tableTop`.

**Remediation brief**
- **Design intent:** the epic's Testing Decisions put the caption and the First/Last route rules in the App tests over the fake API, and the link choice in the component markup tests. `listLandingTopOf` is the pure landing formula; `landOnList` reads the browser sizes and calls it.
- **Full surface:** `apps/web/src/video-list.test.ts:472-480` and its `listCaptionOf` import; `apps/web/src/components.test.ts:865-881` (keep the `hrefOf` import only if another test in the file still uses it, check with `grep -n hrefOf apps/web/src/components.test.ts`); `apps/web/src/heading-hold.test.ts:45-47`, `:54-56`, and the `listLandingTopOf` import stays.
- **Must preserve:** `app.test.ts` "the pager's landing on the video list" describe (`:1025-1179`), which must keep asserting both caption strings and the First/Last addresses; the components pager `test.each` at `:847-863` and "shows nothing on a single page"; `heading-hold.test.ts:40`, `:49` and `:58`.
- **Do not touch:** the green-at-base preservation pins (`app.test.ts:1140` a video title still asks for the top, `:1159` a modified click), see Reviewed and Dismissed.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/src/video-list.test.ts apps/web/src/heading-hold.test.ts` stays green after the deletions, and `pnpm typecheck` and `pnpm lint` stay green (an unused import fails lint).

### 2. Two new assertions read an exact class string — LOW
- **Location:** `apps/web/src/components.test.ts:860`; `apps/web/src/placeholder.test.ts:46-47`
- **Attribution:** introduced. `git log -S'class="video-list-pager" aria-label="Pages">/' 1dc23c5..HEAD` → `fee2044` (#240); `git log -S'placeholder placeholder-table" style' 1dc23c5..HEAD` → `2c19de3` (#241).
- **Real-world trigger:** none for a creator. A styling change (a second class on the pager, or a second inline style on the table placeholder) fails these tests with the rule intact. `CODING_STANDARDS.md` 2 lists "an exact class string" among things no rule cares about.

**Evidence**
```ts
// components.test.ts:860
expect(markup).toMatch(/^<nav class="video-list-pager" aria-label="Pages">/)
// placeholder.test.ts:46-47
const tableOn = (markup: string) =>
  /class="placeholder placeholder-table" style="--rows:(\d+)"/.exec(markup)?.[1]
```

**Failure mode** — at `placeholder.test.ts`, an added class or style property makes `tableOn` return `undefined`, so `expect(daily).toBeDefined()` fails though both modes still hold one height. At `components.test.ts:860`, the class is not part of the rule the test names (which links show, in which order).

**Recommended fix**
```diff
-      expect(markup).toMatch(/^<nav class="video-list-pager" aria-label="Pages">/)
+      expect(markup).toMatch(/^<nav\b[^>]*aria-label="Pages"/)
```
```diff
-    /class="placeholder placeholder-table" style="--rows:(\d+)"/.exec(markup)?.[1]
+    /class="placeholder placeholder-table[^"]*"[^>]*--rows:(\d+)/.exec(markup)?.[1]
```

**Remediation brief**
- **Design intent:** markup tests observe what a screen holds by element, text and attributes; a class is acceptable only to find the element, never as the asserted value.
- **Full surface:** the two lines above. The legend test at `placeholder.test.ts:53-60` also compares whole class strings, but it is pre-existing and its rule is which class the legend carries, so it stays.
- **Must preserve:** both tests still fail when their rule breaks: the pager test when a link's presence or order is wrong, the placeholder test when the two modes hold different row counts (it was red at `$BASE`, 12 vs 11).
- **Do not touch:** `placeholder.test.ts:53-60`.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/placeholder.test.ts` green; then confirm the edited placeholder test is still red at the base: `git worktree add --detach <scratch>/base 1dc23c5`, `pnpm install --frozen-lockfile` there, copy the edited `apps/web/src/placeholder.test.ts` in, run `pnpm exec vitest run apps/web/src/placeholder.test.ts` (expect the "same height in both modes" test red, 12 vs 11), then `git worktree remove --force <scratch>/base`.

### 3. The pager's narrow layout and the table's missing focus ring have no limits note — LOW
- **Location:** `apps/web/src/app.css:176` (`.video-list-scroll table:focus`) and `:813-818` (the `@media (max-width: 40rem)` pager rule); `apps/web/src/components.test.ts:1-8` (the header)
- **Attribution:** introduced. The rules arrived with `eeba0ed` (#239, focus ring) and `fee2044` (#240, narrow pager).
- **Real-world trigger:** none for a creator. `CODING_STANDARDS.md` 2, "A test states its own limits": happy-dom and the server renderer evaluate no stylesheet or media query, so the pager markup test cannot show "Page N of M" on its own line at 375px or the table drawing no ring. The epic assigns both to Nick's browser walk, but neither test file says so. The App test header (`app.test.ts:12-17`) names the walk for the landing and the caption only.

**Evidence** — `grep -rn "video-list-pager\|40rem\|outline" apps/web/test apps/web/src/*.test.ts` finds no check of either rule, and the components header names "the profile's placeholder, the notices' style, the sources button and the sorted tables", not the pager.

**Failure mode** — a later change to the pager's flex rules or the focus rule passes the suite, and nothing in the files tells a maintainer that the human walk is the only check.

**Recommended fix** — add one sentence to the `components.test.ts` header limits: "The pager's narrow layout, 'Page N of M' on its own line at 375px, and the video list table drawing no focus ring after a pager link, are app.css rules no test here evaluates; Nick checks both in the browser walk."

**Remediation brief**
- **Design intent:** each test file's header lists what its environment cannot observe and names the human step that covers it.
- **Full surface:** `apps/web/src/components.test.ts:1-8` only.
- **Must preserve:** the existing header sentences.
- **Do not touch:** `app.css`.
- **Proof:** `pnpm lint` green; the header contains "375px".

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/testing.ts:52` — "Thrown before and after each advance, so the body touches nothing of the next test's page." → "Thrown before and after each advance, so once vitest aborts the test its body starts no further advance." (Vitest's timeout timer is real, so an abort can land during an advance already under way; the comment should claim only what the guard does.)

## Needs Further Investigation

### A. In an after-publish window other than "Publish day", the summary above the list may change height after the landing — confirm in the browser walk
`landOnList` measures the table synchronously in the click handler, before React renders the read. In a window after publish other than `first1`, `summaryPlaceListOf` (`video-list.ts:247`) returns `reading` while the next page reads, so the launch chart above the list is swapped for its placeholder and back when the page lands. If the two differ in height, the table moves off the bar after it landed (Safari has no scroll anchoring). Keeping the last answer there would be wrong, because the launch chart draws the page's own videos. Confirm by opening an after-publish window other than "Publish day" on a channel with several pages in Safari, pressing Next page, and checking the table's heading row stays just under the controls bar while the page reads and after it lands. If it jumps, the fix is matching the placeholder's height to the chart's, not the landing.

### B. VoiceOver reads the new page's caption after a pager link — confirm in the browser walk
Focus moves to the table before React renders the navigation, so at the moment of focus the caption still names the old page, and the table sits inside `aria-busy="true"` (`VideoList.tsx:567`) while the page reads. The render most likely lands before VoiceOver speaks, but only the walk shows it. Confirm by pressing Next page with VoiceOver on and checking it reads "Videos, page 2 of N".

## Reviewed and Dismissed
- `landOnList` does nothing when the table ref is null (`heading-hold.ts:54`) — unreachable: the pager needs `pageCount > 1`, the table is absent only for the `empty` and `placeholder-empty` bodies (zero rows), and a page-past-last answer is never stored because `routeAfterListAnswerOf` replaces the route.
- The caption and pager can briefly name a page outside the count during a read ("Page 9 of 5" after Back to a page the list no longer has) — the pager read `route.page` the same way at `$BASE`, the replace from `routeAfterListAnswerOf` corrects it when the answer lands, and the caption following the route's page is the recorded #239 assumption.
- Source columns under the running total toggle are not rendered by any test — `viewsTableOf` no longer takes a mode, so the rule holds by construction, and the source rows are pinned mode-free at `numbers-table.test.ts:410` and `:431`.
- "The charts' mode never changes it" (`numbers-table.ts:90`) and "in either chart mode" (`numbers-table.ts:170`) read as change narration — they record a decision made and rejected (#67's toggle-following table), which `CODING_STANDARDS.md` 1 keeps so a later reader does not fix it back.
- Dropping `table:has(tfoot)` (`app.css:1643-1644`) — safe, see the verification table.
- The extension timeout guard masking failures — it cannot, see the verification table.
- `landOnList` living in `heading-hold.ts` — both the hold and the landing are worked out against the controls bar, and the module is small; not a walked-past refactor.
- Green-at-base tests `app.test.ts:1140` (a video's title link still asks for the top) and `:1159` (a modified click is left to the browser) — preservation pins the spec asked for; they fail if `land` leaks into other links or runs on a modified click.
- 6 `numbers-table.test.ts` cases green at base — they pin behaviour that already held, with only `mode` dropped from their calls.
- `video-list.test.ts:1033`'s added negative assertion green at base — it came with `189dbd9` (#239 review pass 1 finding 1) and guards that the keep-last-answer path applies only under "Publish day"; keep it.

## Minor / nits
- `heading-hold.ts:59` uses `bar.offsetHeight`, which rounds to whole pixels, so at some zoom levels the landing can be up to half a pixel off the bar's fractional bottom; `bar.getBoundingClientRect().height` would match the hold, which reads `getBoundingClientRect().bottom`. `headingHeight` at `:105` uses `offsetHeight` too, so the current choice has precedent.
- Last page, or Next page onto a short last page near the end of the document, can leave the table below the bar once the shorter page lands and the browser clamps the scroll. Inherent to a page shorter than the viewport.
- A pointer click on a non-link cell now focuses the table (`tabIndex={-1}`), invisibly given the no-ring rule.
- `app.test.ts:1112`'s name says the table "does not ride up", which happy-dom cannot observe; what it pins is that the publish day top's links stay while the next page reads. Its `laidOut(container)` call only stubs `scrollTo` for the landing.
- The modified-click pin uses only `metaKey`; the Ctrl, Shift, Alt and middle-button branches of `RouteLink.follow` are pre-existing and unchanged.
- `numbers-table.test.ts:108` "sorts a number column by its value": its fixture's value order matches the default newest-first order, so a sort that ignored the column would pass. Pre-existing, untouched.
- `advanceWhileRunning` (`testing.ts:55`) has no test of its own showing an aborted signal stops the advance.
- `placeholder.test.ts:45` is relational only; the 12-row value is pinned in `numbers-table.test.ts`.
- `numbersTableBoxRowsOf`'s trailing `+ 1` (`numbers-table.ts:173`) is unnamed; a `totalRows` constant would read like `shownBodyRows`.
- `app.css:1282-1283` reflowed comment leaves one short line.
- `runningTotalOf` (`views-chart.ts:53`) stays exported, used outside its module only by `views-chart.test.ts`.

## Test quality
Tests added or modified: about 80 (5 `heading-hold.test.ts`, 1 `placeholder.test.ts`, 10 `app.test.ts`, 8 `components.test.ts` plus 3 with a changed helper, 11 `video-list.test.ts`, 41 `numbers-table.test.ts`, 1 `web.test.ts`, 2 `content-list.test.ts`). Green against `$BASE` and asserting nothing new: none. The green-at-base cases are two spec-requested preservation pins, signature-only edits, and one review-pass negative guard (see Reviewed and Dismissed). Tautology shapes found: 1, the components First/Last test computing its expectation with `hrefOf` (finding 1, deleted as a duplicate). 7 running total mode tests were deleted with the behaviour, as #241 asks. No snapshots, assertion-free tests, or prose tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `f0916ea`.
- **Commit hygiene:** commit this doc. No scratch files in the tree.
- **Likely reviewer asks:** the browser walk for items A and B, the 375px pager and the focus ring.

## Verdict
Ready to open the PR with follow-ups. No finding gates it. Findings 1 to 4 are LOW and cheap to remediate on this branch; items A and B go to Nick's browser walk.
