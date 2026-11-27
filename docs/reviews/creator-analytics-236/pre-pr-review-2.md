# Pre-PR review: creator-analytics#236 Video list paging and the daily table

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `4c032ab` "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `3944fd5` ("creator-analytics#341 Video list: keep focus on the list when a page read is refused"). The tree was clean, with no uncommitted or untracked files at review time. 22 files, +1221 / −344 against the merge-base, one of them this folder's `pre-pr-review-1.md`. Since review 1 (at `f0916ea`) the branch gained the `origin/main` merge `41b2008` and the second `/epic-loop` run's three tickets: #340 (`7efad5a`, merge `342dcc6`), #351 (`21c42dc`, merge `894ec83`) and #341 (`b446411`, merge `3944fd5`).
**Reviewed against:** the epic body of creator-analytics#236 with its "Amendment 2026-11-04", the bodies of #340, #341 and #351 (their acceptance criteria are the requirements), the per-ticket assumptions in `.epic-loop/tickets/<n>/assumptions.md`, the run 1 close-out decisions (`.epic-loop.2026-11-04/closeout.md`), and `CODING_STANDARDS.md` 1 to 3. The repo has no `CLAUDE.md`. A full review (`--fresh`) of the whole branch against `origin/main`, not delta-scoped.
**Date:** 2026-11-04
**Reviewer:** 2 code-review agents + tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (539 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 124/124 files, 2798 passed, 1 expected fail |
| Local browser walk | `pnpm run --if-present test:browser` | passed, no content security policy violation in 28 steps |
| New tests against `$BASE` (tautology oracle) | Scratch worktree at `4c032ab`, the branch's 8 modified test files (and `testing.ts`) copied in, each run alone | Every test that pins new behaviour is red at base. Green at base: preservation pins (a video title still asks for the top; the five modified-click cases; the two #341 over-reach guards), fixture-only `listKey` edits, and 6 `numbers-table.test.ts` signature-only edits. See Test quality |
| #340 mutants | Branch `RouteLink.tsx` guard, each of `ctrlKey`, `shiftKey`, `altKey`, `button !== 0`, `metaKey` deleted alone | each killed by exactly its own case |
| #341 mutants | 17 mutants of `VideoList.tsx` over app, components, video-list and heading-hold tests | killed: the focus call, `onLand()`, the `activeElement` guard, the `landed` early return, a reset while busy. Survived: drop `else if (!shown.busy) landed.current = false` (`:468`), drop the clear in the refused branch (`:464`), drop `tabIndex={-1}` on the refusal message (`:512`). Findings 1 and 2 |
| #351 CSS mutants | `apps/web/src/app.css` edits, full `web.test.ts` | 8 killed (each line rule dropped, a colour literal in each rule and in the shadow, a reset selector or the reset dropped, the shadow dropped). 2 survived: a later `.video-list td:nth-child(3) { border-inline-start: none }`, and the same with `0` in a media query. Both inside the limit the `web.test.ts` header states (rules as written, not which rule wins); dismissed |
| Built CSS for #351 | `vite build` into the scratchpad, grep of the emitted sheet | `border-inline-start:1px solid var(--line)`, the `:first-child` resets and `box-shadow:1px 0 0 var(--line)` come out as the source writes them |
| Group-start leftovers | `git grep -n 'column-group-start\|startsColumnGroup\|groupStart' -- apps packages` | nothing |
| Merge `41b2008` | `git show --remerge-diff 41b2008` over the six conflicted files | both sides kept, nothing lost or duplicated |
| Finding 1 | Repro in a scratch worktree at `3944fd5`, preserved at `repro/review-2-finding-1-landing-flag.case.ts` | red at HEAD (focus on `document.body`); green with the recommended fix; the cause confirmed by deleting `:468` alone, which turns it green |
| Recommended fix for finding 1 | Applied in the scratch worktree | `app.test.ts`, `video-list.test.ts`, `components.test.ts`: 502/502 with both repro cases; `tsc -p apps/web/tsconfig.json --noEmit` and `biome check` green |
| Em-dashes in shipped copy | Grep of added lines under `apps/` | none |
| Browser behaviour (the column lines' paint, the sticky column's line at fractional zoom, VoiceOver on the refusal) | Not run | happy-dom has no layout, paint or screen reader; `test:browser` reads computed styles only. Items A and B below go to Nick's walk (#342) |

**Overall:** All three tickets of the second run do what their acceptance criteria ask, the full checks and the local browser walk are green, and every new test that pins behaviour goes red at the base. No finding reaches MEDIUM. The one behavioural finding is LOW: after Next page then Previous page inside one read's latency, a refused re-read drops keyboard focus to the page body, because the landing flag clears on "not busy" rather than on the opened page answering. The rest is a missing pin for the refusal message's focusability, two unstyled class names #351 walked past, and one comment.

## Remediation scope
Nick's close-out decision 3 (2026-11-05, recorded in `.epic-loop/closeout.md`): this round fixes Confirmed findings 1 and 2, both LOW, test first, and no other finding. This replaces the default CRITICAL-to-MEDIUM scope, and the rule that leaves the LOW tail unfixed, for these two findings only. Findings 3 and 4 stay unfixed and deferred.

## Approach decisions
- Where a pager link lands (#239): `RouteLink` takes an optional `land` callback, defaulting to `window.scrollTo(0, 0)`; `Pager` passes `land`, which calls `onLand()` and then `landOnList(table, controlsBar, window)` synchronously right after `navigate`. Kept.
- Keeping the summary's place steady while another page reads (#239 review pass 1 finding 1, `189dbd9`): `readsAnotherPageOf` and `summaryPlaceListOf`, under "Publish day" only. Kept.
- The daily table (#241): `mode` removed from the numbers table's functions and component; `ViewsTable.total` required, `tfoot` unconditional. Kept.
- Focus on a refused page read (#341): a `landed` ref in `VideoList`, set through `onLand` by the pager's `land`; an effect focuses the `role="alert"` message (`tabIndex={-1}`, `preventScroll`) when `landed` is set, the read is refused, and focus fell to the body or nowhere. Kept. **This review changes when `landed` clears** (finding 1): on a `list` answer in the read effect's answer callback, and on the refusal, never on `!shown.busy`.
- A line between every column (#351): each `th` and `td` of the four tables draws `border-inline-start: 1px solid var(--line)`, the first column's cells reset it through `tbody tr > :first-child`, `tfoot tr > :first-child` and `thead tr:first-child > :first-child`; the video list's sticky video column draws the line after it as `box-shadow: 1px 0 0 var(--line)`; the sticky tables keep separate borders. Kept.
- Pinning a programmatic focus target (review 2 finding 2, `43b4cd6`): a test that asserts focus lands on an element also reads that element's `tabindex`, because happy-dom focuses an element no browser would. Mirrors the landing tests' `expect(table.getAttribute('tabindex')).toBe('-1')`.

## Confirmed Issues

### 1. After Next page then Previous page before the next page answers, a refused re-read drops keyboard focus to the page body — LOW
- **Location:** `apps/web/src/VideoList.tsx:468` (the clear), with `:356-357`, `:404-409` and `:459-470`
- **Attribution:** introduced by `b446411` (#341). `git show 4c032ab:apps/web/src/VideoList.tsx | grep -c landed` prints 0; `git log --oneline -S'else if (!shown.busy) landed.current = false' 4c032ab..HEAD` names `b446411`.
- **Real-world trigger:** a keyboard user presses Next page, then Previous page before page 2 answers (a slow connection makes this easy), and the re-read of page 1 is refused (an expired session, a network drop). The refusal shows and focus sits on the body, so the next Tab starts from the top of the page, the exact bug #341 fixed for a single click. Consequence is a focus loss, attainability needs two clicks inside one read and a refusal, so LOW. The lane review of #341 named the same mechanism (`.epic-loop/tickets/341/review-1.md` F1.1); this review proved it by execution.

**Evidence**
```tsx
// VideoList.tsx:461-469
useEffect(() => {
  if (!landed.current) return
  if (refused) {
    landed.current = false
    if (document.activeElement === document.body || document.activeElement === null) {
      refusal.current?.focus({ preventScroll: true })
    }
  } else if (!shown.busy) landed.current = false
}, [refused, shown.busy])
```

**Failure mode** — page 1 answered (read key K1). Next page sets `landed` and moves the route to K2, so `shown.busy` is true while K2 reads. Previous page (the pager still renders from the last answer) sets `landed` again and moves the route back to K1. `read.key` is still K1, so `videoListStateOf` shows the old page 1 answer with `busy` false, and the effect clears `landed`, though the key change has started a fresh read of page 1. When that read is refused, the table Previous page focused unmounts, focus falls to the body, and `landed` is already false, so the refusal message never takes focus. "Not busy" is not "the opened page answered". Proof: the first case in `repro/review-2-finding-1-landing-flag.case.ts` fails at `3944fd5` with `document.activeElement` the body; deleting `:468` alone turns it green.

**Recommended fix** — clear `landed` where the read the landing started actually answers, and only then:
```diff
@@ apps/web/src/VideoList.tsx:404 @@
         if (after && after !== currentRoute.current) navigate(after, { replace: true })
-        else setRead({ channelId, key, listKey, view: next })
+        else {
+          if (next.kind === 'list') landed.current = false
+          setRead({ channelId, key, listKey, view: next })
+        }
       },
@@ apps/web/src/VideoList.tsx:465 @@
         refusal.current?.focus({ preventScroll: true })
       }
-    } else if (!shown.busy) landed.current = false
-  }, [refused, shown.busy])
+    }
+  }, [refused])
```
The guard `next.kind === 'list'` is load-bearing: `readAnswer` turns an HTTP refusal into a `refused` view that arrives through this same answer callback, not through the failure callback, so an unguarded clear there wipes `landed` before the refusal renders and both #341 cases go red (executed).

**Remediation brief**
- **Design intent:** `landed` means "a pager link landed on the list, and the read it started has not yet answered with a list". It is set only through the pager's `land` (`VideoList.tsx:527-529`), never on a modified click (`RouteLink` returns before `land`). It clears when the list answer for the current read lands (the read effect's answer callback, which `latestOnly` calls for the latest read only, so a cancelled K2 read never clears it) or when the refusal shows. The refusal effect focuses the message only while `landed` is set and focus fell to the body, so focus a creator moved elsewhere stays put.
- **Full surface:** `apps/web/src/VideoList.tsx:404-408` (the answer branch), `:409` (the failure callback stays as it is: its `refused` view reaches the effect), `:461-470` (the effect and its dependency list); the comment at `:356` already states the corrected meaning ("until the page it opened answers or is refused") and needs no edit; `apps/web/src/app.test.ts`, describe "the pager's landing on the video list" (starts `:1902`), gains the two cases from the repro file.
- **Must preserve:** in `app.test.ts`, "Next page with the page read refused (%s) leaves keyboard focus on the list, not on the page body" (status and network), "leaves keyboard focus the creator moved while the next page reads where they put it when the read is refused", "a refused read no pager link led to takes no focus", and every other case in "the pager's landing on the video list"; the invalid-range and route-replace branches keep `landed` set, since each starts another read for the same landing; the `activeElement` guard at `:465`.
- **Do not touch:** `landed` outliving a non-pager route change made while the landed page reads (see Reviewed and Dismissed); `readsAnotherPageOf` and `summaryPlaceListOf`.
- **Proof:** paste both cases from `docs/reviews/creator-analytics-236/repro/review-2-finding-1-landing-flag.case.ts` as the last tests of describe "the pager's landing on the video list" in `apps/web/src/app.test.ts`, then `pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'`: the first case is red before the fix and both are green after. The second case ("after Next page answers, a refused read a sort heading starts takes no focus") is green before and after, and goes red if the fix drops `if (next.kind === 'list') landed.current = false`, so it pins the clear that replaces `:468` (the survived mutant M1). Rename both cases without the `repro:` prefix when they land. Then `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/video-list.test.ts apps/web/src/components.test.ts`, `pnpm typecheck` and `pnpm lint` green.

### 2. The refusal message's programmatic focusability is unpinned, and its test carries scaffolding — LOW
- **Location:** `apps/web/src/VideoList.tsx:512`; `apps/web/src/app.test.ts:2068-2089` and `:2110-2121`
- **Attribution:** introduced by `b446411` (#341): `git log --oneline -S'ref={refusal} tabIndex={-1}' 4c032ab..HEAD`.
- **Real-world trigger:** none today; the code is right. A later edit that drops `tabIndex={-1}` from the `<p role="alert">` breaks #341 in every browser (a browser ignores `focus()` on a `<p>` without a tabindex), and the suite stays green, because happy-dom focuses any element. No user path until someone makes that edit, so LOW.

**Evidence**
```ts
// app.test.ts:2076-2077, and the same pair at :2113-2114
api.failNext(listRoute, how)
api.failNext(listRoute, how)
// app.test.ts:2086-2087
expect(document.activeElement).not.toBe(document.body)
expect(document.activeElement).toBe(container.querySelector('.video-list [role="alert"]'))
```

**Failure mode** — deleting `tabIndex={-1}` at `VideoList.tsx:512` leaves all 517 tests of the four pager-related files green (mutant M3, executed). The table's twin attribute is pinned (`expect(table.getAttribute('tabindex')).toBe('-1')` in the landing tests), the message's is not, and the `app.test.ts` header does not say happy-dom focuses an element no browser would. Separately, each failing click makes one list read (traced: one answer callback after the click), so the second `failNext` in both tests is never consumed; deleting it leaves the 18 landing tests green (executed by the finder). The `not.toBe(document.body)` line is implied by the `toBe(alert)` line after it. Both are `CODING_STANDARDS.md` 2 scaffolding.

**Recommended fix**
```diff
@@ apps/web/src/app.test.ts:2076 @@
       api.failNext(listRoute, how)
-      api.failNext(listRoute, how)
@@ apps/web/src/app.test.ts:2085 @@
-      expect(container.querySelector('.video-list [role="alert"]')).not.toBeNull()
-      expect(document.activeElement).not.toBe(document.body)
-      expect(document.activeElement).toBe(container.querySelector('.video-list [role="alert"]'))
+      const alert = container.querySelector('.video-list [role="alert"]')
+      expect(alert).not.toBeNull()
+      expect(alert?.getAttribute('tabindex')).toBe('-1')
+      expect(document.activeElement).toBe(alert)
@@ apps/web/src/app.test.ts:2113 @@
     api.failNext(listRoute)
-    api.failNext(listRoute)
```
And one sentence in the limits header at the top of `apps/web/src/app.test.ts`: "happy-dom focuses an element with no tabindex, which a browser does not, so the refused page read test reads the refusal message's tabindex as well as where focus is; the browser walk refuses no page read."

**Remediation brief**
- **Design intent:** the epic's Testing Decisions assert where focus lands. A target that takes focus programmatically only carries `tabIndex={-1}`, and the tests pin that attribute because happy-dom cannot show focusability.
- **Full surface:** `apps/web/src/app.test.ts:2076-2077`, `:2085-2087`, `:2113-2114`, and the header block at `:1-60`.
- **Must preserve:** both test.each cases (status and network) still fail when the focus call at `VideoList.tsx:466` or `onLand()` at `:528` is removed (the tautology audit killed both mutants with these cases); "a refused read no pager link led to takes no focus" still fails when `if (!landed.current) return` at `:462` is removed.
- **Do not touch:** `VideoList.tsx:512` itself.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts -t "pager's landing"` green; then in a scratch worktree, delete ` tabIndex={-1}` from `VideoList.tsx:512` and rerun: both refused page read cases go red. `pnpm lint` green.

### 3. Two class names that no rule styles were left on the lines #351 rewrote — LOW
- **Location:** `apps/web/src/VideoList.tsx:635` (`className="video-list-group"`); `apps/web/src/NumbersTable.tsx:89` (`className="numbers-table-group"`)
- **Attribution:** pre-existing, exposed. Both arrived unstyled in `7b118b9` ("creator-analytics#119 Browser walk fixes for the web dashboard") beside `column-group-start`; #351 (`21c42dc`) rewrote both lines to drop that class and walked past the dead one. `git grep -n 'video-list-group\|numbers-table-group' -- apps` finds only these two lines, no CSS rule, test or walk selector.
- **Real-world trigger:** none for a creator. `CODING_STANDARDS.md` 3: a refactor on a line the change already touches belongs in the same change.

**Evidence**
```tsx
// NumbersTable.tsx:89
<th scope="colgroup" colSpan={sourceColumns.length} className="numbers-table-group">
// VideoList.tsx:632-635
scope="colgroup"
colSpan={sourceColumns.length}
className="video-list-group"
```

**Failure mode** — a reader takes the class for a styling or test hook and keeps it, or styles it, believing it already means something.

**Recommended fix** — delete `className="numbers-table-group"` at `NumbersTable.tsx:89` and the `className="video-list-group"` line at `VideoList.tsx:635`, and let biome reflow the elements.

**Remediation brief**
- **Design intent:** the colgroup heading names the revenue sources group; since #351 every column line comes from the shared cell rule, so the heading needs no class of its own.
- **Full surface:** the two lines above only.
- **Must preserve:** `scope="colgroup"`, `colSpan={sourceColumns.length}`, the `key` on the video list's heading, and the heading text.
- **Do not touch:** `app.css`.
- **Proof:** `git grep -n 'video-list-group\|numbers-table-group' -- apps` prints nothing; `pnpm lint`, `pnpm typecheck` and `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/test/web.test.ts` green.

### 4. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:1057-1058` — "each cell draws the line before it, so a sticky row or column keeps its lines as it moves" → "each cell draws the line before it, so a sticky row keeps its lines as it moves; the fixed video column draws the line after it as a shadow, above"

## Needs Further Investigation

### A. A screen reader may read the refusal message twice after a refused page read — confirm in the browser walk
The message is a `role="alert"` live region that renders and is then focused (`VideoList.tsx:466`), so VoiceOver may announce it once as the alert and again on focus. Confirm in Safari with VoiceOver on: open a channel with several pages, turn the network off in the developer tools, press Next page, and listen. If it reads twice, the choice between dropping the focus and dropping the live role is Nick's.

### B. The fixed video column's line may draw 2px or blurred at rest at a fractional zoom — confirm in the browser walk
At rest the sticky cell's `box-shadow: 1px 0 0 var(--line)` lies over the second column's own `border-inline-start`. At 110% or 125% zoom the two may round to different device pixels. Confirm by viewing the video list at 110% and 125% in Safari and Chrome, at rest and scrolled sideways at 375px.

Review 1's items A (the summary's height in after-publish windows other than "Publish day") and B (VoiceOver reading the new caption) are still open for the same walk, #342.

## Reviewed and Dismissed
- The browser walk saves no screenshots in light and dark mode — the amendment's Testing Decisions name a screenshot, but #351's acceptance criteria do not, and the recorded assumption (`.epic-loop/tickets/351/assumptions.md`) meets the walk with computed-style assertions in both modes and leaves the look to Nick's walk, #342.
- `test:browser` checks the lines of the numbers table and the video list only — #351's acceptance criteria name exactly those two; all four tables' rules are pinned in `web.test.ts`.
- The #351 pins read `src/app.css`, not the built sheet — the epic names the existing numbers-table box and placeholder pins as prior art, and every one of them reads `webOwnSheet()`; the built sheet keeps the rules as written (verified).
- The two surviving CSS mutants (a later `nth-child` reset, a reset inside a media query) — the `web.test.ts` header states that the column-line tests read rules as written, not which rule wins a cell.
- The fixed-column pin asserts the exact `box-shadow` string — that value is the rule (one 1px line in the line token), not a class string.
- Hovered and marked video list rows merge their column lines into the `--line` tint — recorded #351 assumption; the epic puts row hover tints out of scope.
- `box-shadow: 1px 0 0` is physical while the rest is logical — recorded #351 assumption; the app is left-to-right only.
- `landed` outlives a route change that is not the pager's, made while the landed page reads (a sort heading clicked during the read) — the refusal then takes focus only when focus fell to the body, which keeps it in the list, #341's goal (lane review F1.2). Finding 1's fix leaves this as it is.
- Merge `41b2008` dropping the branch's account-menu sentences from the `app.test.ts` header — main's longer rewrite covers them.
- Review 1's findings 1 to 4 (duplicate test pairs including `components.test.ts:1375-1376` building its expectation with `hrefOf`, two exact class string assertions, the missing limits note for the narrow pager and the focus ring, and the `testing.ts:53` comment) are still present — Nick's run 1 close-out (Decision 1, 2026-10-24) filed only L11, L12 and L14 and kept the tidy findings as a record only. Not renumbered here.
- 6 `numbers-table.test.ts` cases green at base — signature-only edits from `2c19de3` (#241), and the behaviour #241 claims is pinned by the components and placeholder tests, red at base.
- The Cmd row of the #340 table duplicating main's "a Cmd click on $link …" — the two observe different halves (scroll and focus here, the address and the default there), and #340 asked to extend this test.

## Minor / nits
- The #340 cases hand-roll a `preventDefault` listener rather than widening the in-repo `modifiedClick` helper (`app.test.ts:266`) to take a `MouseEventInit`, so the Ctrl, Shift, Alt and Middle rows do not assert the default was left alone. Every guard mutant is still killed through the address and the scroll.
- The landing flag's clear when the refusal shows (`VideoList.tsx:464`) has no test (mutant M2); with the pager gone while the refusal shows, only a control change re-reads, and focus then sits on that control.
- The `web.test.ts` reset filter (`:610-617`) counts only the literal `border-inline-start: 0`; `border: 0` or `border-inline-start: none` on a table cell would pass it.
- "a video's title link still asks for the top of the screen" asserts only on the stubbed `scrollTo`; it is review 1's dismissed preservation pin.
- `test:browser` reads computed styles, not paint, so a stacking change that covers the fixed column's shadow passes it.

## Test quality
Tests added or modified since the merge-base: about 95 (review 1's ~80, plus 5 modified-click cases, 4 #341 cases, 2 `web.test.ts` column-line pins, and edits to the numbers-table and video-list tests that dropped `groupStart` and the `startsColumnGroup` test). Green against `$BASE` and asserting nothing new: none. The green-at-base cases are preservation pins (the five modified-click cases and the title link), the two #341 over-reach guards (each killed a mutant), fixture-only and signature-only edits. Tautology shapes found: 1, `components.test.ts:1375-1376` computing its expectation with `hrefOf`, which is review 1 finding 1 kept as a record. Mutation coverage gaps: the three survivors of #341 (findings 1 and 2, and a nit). No snapshots, no `vi.mock` of the unit under test, no assertion-free or prose tests.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and `test:browser` are green at `3944fd5`.
- **Commit hygiene:** commit this doc and `repro/review-2-finding-1-landing-flag.case.ts` (it passes `biome check`). No scratch files in the tree.
- **Likely reviewer asks:** the #342 browser walk, now carrying items A and B here, review 1's A and B, the 375px pager, the focus ring, and the column lines in light and dark mode with the fixed column scrolled sideways.

## Verdict
Ready to open the PR with follow-ups. No finding gates it: findings 1 to 4 are LOW. Finding 1 is the one behavioural defect, a one-line move of where the landing flag clears with a proved red-to-green test, and is worth fixing on this branch before the PR; findings 2 to 4 are cheap tidy-ups. Items A and B go to Nick's browser walk, #342.

## Remediation — 2026-11-05
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (LOW) | `e93a179` creator-analytics#236 pre-PR review 2 finding 1: a refused re-read after Next then Previous drops keyboard focus to the page body | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t "Next then Previous\|a sort heading starts takes no focus"`, the Next then Previous case red before the fix (focus on the body), both green after; the repro's two cases landed in describe "the pager's landing on the video list" without the `repro:` prefix. Mutant in a scratch worktree at `43b4cd6`: dropping the new `if (next.kind === 'list') landed.current = false` turns "after Next page answers, a refused read a sort heading starts takes no focus" red | 0 | proved by execution |
| 2 (LOW) | `43b4cd6` creator-analytics#236 pre-PR review 2 finding 2: the refusal message's focusability is unpinned, and its tests carry scaffolding | `pnpm exec vitest run apps/web/src/app.test.ts -t "pager's landing"` 20/20 green; mutants in a scratch worktree at `43b4cd6`: dropping ` tabIndex={-1}` at `VideoList.tsx:515` turns both refused page read cases (status, network) red; dropping the focus call or `onLand`'s set turns them red too; dropping `if (!landed.current) return` turns "a refused read no pager link led to takes no focus" red | 3 (the limits header sentence the brief asks for: happy-dom focuses an element with no tabindex, a test-environment constraint the code cannot express) | proved by execution |
| 3 (LOW) | — deferred | — | — | out of scope: Nick's close-out decision 3 |
| 4 (LOW) | — deferred | — | — | out of scope: Nick's close-out decision 3 |

Phase 2 ran no verify agent: both fixes are LOW, their proofs were executed red then green in the repo's runner, and neither touched a shared computation core or a symmetric surface. Blast radius at `43b4cd6`: `app.test.ts`, `video-list.test.ts`, `components.test.ts` 503/503; `pnpm lint`, `pnpm typecheck`, `pnpm build` green; `pnpm test` 124/124 files, 2800 passed, 1 expected fail; `pnpm run --if-present test:browser` passed, no content security policy violation in 28 steps.

### Known regressions, deferred
None.

### Rework briefs
None: no rework pass ran.
