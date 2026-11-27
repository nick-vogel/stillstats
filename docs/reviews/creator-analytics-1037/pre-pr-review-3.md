# Pre-PR review: creator-analytics#1037 Make Stillstats faster (delta after reviews 1 and 2)

**Branch:** `creator-analytics-1037-make-stillstats-faster` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `8aff9d8d` (creator-analytics#1037 pre-PR review 2 finding 2: the test's span carries the status SpanJSON requires), pushed, 0 files with uncommitted changes; vs `$BASE` 87 files, +7566 / −369
**Delta under review:** since `7aea7d5f` (creator-analytics#1054 Extension timing: the time from a surface element to its figure), the HEAD both `pre-pr-review-1.md` and `pre-pr-review-2.md` reviewed: 18 commits, 26 files outside `docs/reviews/`, +702 / −99. The remediation commits of both reviews, finding 1 of review 1 in two rounds.
**Reviewed against:** epic #1037's spec as distilled in the prior docs, the Approach decisions, closure tables, re-issued brief and Known regressions of `pre-pr-review-1.md` and `pre-pr-review-2.md`, ADR 0023, the README's analytics and tracing lines, the global rules in `~/.claude/rules/`, and the repo rules in `.claude/rules/` (`youtube-test-limits`, `row-level-security-tests`). The repo has no `AGENTS.md` or `CLAUDE.md`.
**Date:** 2026-11-24
**Reviewer:** 2 code-review agents + verify pass. Findings 3 and 4 come from a trial second opinion, Grok through T3 Code (grok-4.7, `--fresh`, 30 minutes, doc kept outside the repo), re-run and verified here; its fix for finding 3 is replaced (see the brief).

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint, typecheck, build, suite, browser walk | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm run --if-present test:browser` at `8aff9d8d`, Node 26.3.0 (CI runs 24) | all exit 0; suite 228 files, 5992 passed, 1 expected fail |
| Tautology audit (Phase 4.5) | The delta's 8 changed `*.test.ts` copied into a scratch worktree at `7aea7d5f` (`pnpm install --offline`), run there except `apps/api` (Docker); worktree removed after | 15 of the delta's 20 new cases red. 5 green, each a deliberate guard: see Test quality |
| Finder A, extension | `pr-review-finder` over the 13 extension files, with a mutation run: one new branch changed at a time, that surface's tests run | 1 executed defect (finding 1), 21 mutants of new branches that no test kills (finding 2) |
| Finder B, reporter, web, docs | `pr-review-finder` over the 13 other files; every SDK claim read in the installed `@sentry/*` 11.4.0 | the README, ADR 0023, deploy.md and worker.ts claims hold (status ranges inclusive, the named refusals answer 403 or 404, `sdkProcessingMetadata` deleted from the body in `core/build/esm/envelope.js:38`, the worker's spans need a parent); 9 LOW candidates |
| Finding 1 repro | `repro/content-list-word-line-pass-between.case.ts` pasted into `content-list.test.ts` (file restored after) | red at HEAD with a pass between (`ms: 0`), green without (`ms` 1460) |
| Finding 5 proof | the three keys deleted from `transactionKeys`, then `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` (file restored after) | 52/52 green: nothing pins them |
| Finding 6 proof | `node` on `scrubTransaction` with `contexts.os.laterKey` and `contexts.cloud_resource['host.id']` | both kept as sent |
| Em-dash in shipped copy | `git diff 7aea7d5f HEAD -- README.md docs/adr docs/deploy.md apps packages` added lines | none |
| Finding 3 repro (Grok) | `repro/ahead-redraw-timing.case.ts`, ported from Grok's standalone repro, pasted into `page-watcher.test.ts` (file restored after) | red at HEAD: `ms: 0, fromCache: true` for a cold 1,200 ms read; the rule is `ms: 1450, fromCache: false` |
| Finding 4 repro (Grok) | `repro/lcp-navigation-before-screen.case.ts`, ported, pasted into `screen-timing.test.ts` (file restored after); Grok's control (an input, then `screenShown`, no navigation) passes at HEAD | both navigation cases red at HEAD: `tracked()` is `[]` |
| Finding 4 fix audit | Grok's recommended diff laid against `endLcp`, `onVisibility` and the signed-out rule | rejected: it sets `lcp.screen` before a screen shows, so a later hide sends the floor for a load that never shows a screen; the brief's mechanism keeps `lcp.screen` undefined |
| Finding 4 recommended fix | the brief's diff applied to a copy, with the repro and a signed-out case (navigate from `/app/`, then hide), then `pnpm exec vitest run apps/web/src/screen-timing.test.ts apps/web/src/app.test.ts apps/web/src/analytics.test.ts`; both files restored after | 588/588 green, the repro and the signed-out case included |
| Not run | The tautology run's `apps/api` file at `7aea7d5f` | needs Docker in the scratch worktree; its new case was red against the pre-fix code during remediation (review 1 finding 2) |

**Overall:** the delta closes review 1's findings 2 to 5 and review 2's finding 2 against their intent. Review 1 finding 1, the extension's figure time after a redraw, is now right on the own-pass paths its tests cover, but the Content list's kept branch still loses the start (finding 1), a redraw on a pass ahead of WXT's report is still timed as an instant cache hit (finding 3), and most of its new branches have no test that can go red (finding 2). That subsystem has been rewritten twice in response to reviews, so findings 1 to 3 go to a split ticket rather than a third in-place rewrite. Review 2 finding 1, the LCP floor, holds for an input or a hide but not for a navigation before the screen shows (finding 4): a small web fix that can land in this PR, with two LOW trace-scrub findings and a comment sweep. No CRITICAL or HIGH.

## Approach decisions
Carried forward, binding:
- Review 1: a redraw is a `Redrawn` answer beside `Cut`, which `placementOf` maps to its `counts`; the watch's per-navigation record lives only through consecutive own-pass redrawn answers, a bare answer ends it, a navigation the give-up hands back starts with none; a finished read-ahead time survives a redraw whole; an ahead pass notes nothing for a redrawn answer; a pill surface answers redrawn only when `PillsRead.answered`, and a pill page only when every tile was repointed.
- Review 1: each request's root span starts a new trace (`Sentry.startNewTrace`); the trace scrub builds the event, each span and the trace context from named lists; an error event's transaction name goes through `maskSecrets`.
- Review 2: an LCP whose first input or hide comes before any screen shows is held as `lcp.endedAt` and sent as a floor with `beforeScreen: true`; the channel ID pattern's right boundary is `(?:\b|(?!\w))`.

Added this round:
- The extension timing subsystem takes no third in-place rewrite in this PR. Findings 1, 2 and 3, and Needs Further Investigation A, go to one split ticket with its own test matrix (delta-scoping step 5).
- A redraw on a pass ahead of WXT's report notes an open start, flagged as a redraw, in the read-ahead record; a later ahead redrawn answer folds its cache result in, an ahead shown answer closes it into a finished time, and an ahead bare answer deletes it, as D1 does on the own pass. A first finished time or cut start still wins, as today. This overturns review 1's line "an ahead pass notes nothing for a redrawn answer" (finding 3).
- A navigation from a budget route before any screen shows holds the LCP floor for the screen the page loaded on (`budgetScreenOf(previous)`), with `lcp.screen` left undefined until a screen shows, so a hide with no screen still sends nothing. A navigation from a route with no budget still ends the LCP with no event. This narrows review 2's line "`changeStarted` sets `lcp.screen = null`, so non-budget and signed-out loads send nothing" to non-budget loads (finding 4).
- The trace scrub's runtime contexts get named key lists, as the rest of a transaction has (finding 6). The error scrub keeps them whole.

## Confirmed Issues
### 1. On the Content list, a pass between the read landing and Studio drawing the "Views" line throws the redraw's start away — MEDIUM
- **Location:** `apps/extension/src/surfaces/content-list.ts:342` (the kept-answer branch), against `:397-400` (the read's redrawn answer)
- **Attribution:** review 1 finding 1, partially fixed. At `7aea7d5f` this path timed the figure from the pass that drew, as every redraw did. `073826b7` (round 1) made `:399` answer `redrawnFrom(...)`, beyond the brief; `e432b6d3` (round 2, D1) made a bare answer end the watch's record. The kept branch at `:342` answers a bare `'not-found'` (`takeDownPageAndRows`), so any pass in between ends the record. Neither prior closure's "Known regressions, deferred" names it.
- **Real-world trigger:** a creator opens the Content list on a cold read; the read lands while Studio has the Views heading but not the line that holds the word "Views"; any mutation in that window (Studio animates the table) runs a pass; then the line arrives and the figure shows from the kept answer. MEDIUM, capped: telemetry only, never a creator's figure, but a wrong number silently delivered to the baseline (#1056) and #555. Check during the baseline: the share of `content_list` shown events with `ms` under 50 on a creator's first open of a day.

**Evidence**
```ts
        const view = pageViewOf({ read: answered.read, origin, locale })
        if (view.kind !== 'line' && !wordLine) return takeDownPageAndRows(list)
```
`takeDownPageAndRows` returns `'not-found'`, and `page-watcher.ts` ends the record on any string: `} else if (typeof answer === 'string') nav.redrawn.delete(surface.name)`.

**Failure mode** — executed with `repro/content-list-word-line-pass-between.case.ts`: the line removed, the first read cold for 1,200 ms, later reads from the cache, the line put back. With no pass between, `ms: 1460, fromCache: false`. With one appended `div` between, `ms: 0, fromCache: false`.

**Recommended fix**
```diff
-        if (view.kind !== 'line' && !wordLine) return takeDownPageAndRows(list)
+        if (view.kind !== 'line' && !wordLine) {
+          takeDownPageAndRows(list)
+          return answeredHere && answered.read.state === 'read'
+            ? redrawnFrom(answered.read.answer.fromCache, 'not-found')
+            : 'not-found'
+        }
```
`answeredHere` keeps an answer read for an earlier navigation from lending its start. The placement it counts as stays `'not-found'`, so the missing and give-up judgments are unchanged. Audit the kept branch's other returns in the split ticket: the same shape may hold wherever a kept answer waits on Studio.

**Remediation brief**
- **Design intent:** the figure time runs from the pass that first found the surface's element to the figure showing; a redraw carries that start forward only while the surface keeps waiting on the same read for the same element (review 1, re-issued brief). A kept answer that still waits on Studio's "Views" line is that case, and must answer redrawn, not bare.
- **Full surface:** `apps/extension/src/surfaces/content-list.ts:342` and the other returns of the kept-answer branch (`:330-354`); `page-watcher.ts` needs no change.
- **Must preserve:** every test in `content-list.test.ts`, `page-watcher.test.ts` and `studio-surfaces.test.ts`; the missing judgment for a list that never draws the line; `answeredHere`'s rule that an answer read ahead stands only a line's time.
- **Do not touch:** the round 2 record lifetime in `page-watcher.ts` (Approach decisions; Reviewed and Dismissed: "a Cut reaching the record"); the ahead path, which is finding 3.
- **Proof:** paste `docs/reviews/creator-analytics-1037/repro/content-list-word-line-pass-between.case.ts` at the end of `apps/extension/src/surfaces/content-list.test.ts`, then `pnpm exec vitest run apps/extension/src/surfaces/content-list.test.ts -t 'repro:'`: red now for "a pass between: true", green for both after. Rename without `repro:` when landing.
- **Escalation:** third rewrite of the extension's redraw timing in response to reviews (`073826b7`, then `e432b6d3`, `62756a2e`, `7b423ecd`), so recommend a split ticket with its own test matrix rather than another in-place fix in this PR.

### 2. Most of the new redraw branches have no test that can go red — MEDIUM
- **Location:** `content-list.ts:377-378`, `:397-399`; `video-row.ts:183`, `:191-194`, `:193`, `:205-208`, `:207`; `watch-page.ts:78`; `shorts.ts:171-174`, `:204`; `feed.ts:172-174`; `channel-page.ts:72`; `analytics.ts:132-134`; `page-watcher.ts:435`
- **Attribution:** introduced by `073826b7`, `62756a2e` and `7b423ecd` (review 1 finding 1, rounds 1 and 2).
- **Real-world trigger:** none today; the code is right where the finder traced it. The risk is the next change to any of these branches: it would silently skew the number the baseline reads, and the suite would stay green. MEDIUM, capped (wrong results silently delivered): the rules `tests-can-go-red` and `test-every-fallback-path` bind.

**Evidence** — the finder's mutation run, one change at a time, each with that surface's test files: no test failed when the redrawn answer was made bare at `content-list.ts:377-378` and `:397-399`, `video-row.ts:191-194` and `:205-208`, `watch-page.ts:78`, `shorts.ts:171-174` and `:204`, `feed.ts:172-174`, `analytics.ts:132-134`; when the failed-read guards were removed (`content-list.ts:377`, `video-row.ts:183`, the `answered` guards at `watch-page.ts:78`, `shorts.ts:204`, `feed.ts:172`, `channel-page.ts:72`); when `repointed === tiles.length` became `> 0` (`shorts.ts:171`, `feed.ts:172`); when D5's `&& (compared?.fromCache ?? true)` was removed (`video-row.ts:193`, `:207`); or when the ahead-pass skip was removed (`page-watcher.ts:435`). Covered: the card's redraw, the give-up hand-back, the fold of two redraws, the channel page's every-tile rule.

**Failure mode** — a regression in any listed branch passes `pnpm exec vitest run apps/extension`.

**Recommended fix** — one shown-event test per surface in the shape of `card.test.ts` "a figure whose Views row Studio redraws during its cold read" and `channel-page.test.ts` "a pill drawn after YouTube points every tile at another of the creator's videos", each with a failed-read variant for its guard, plus one `page-watcher.test.ts` case for an ahead pass answering redrawn.

**Remediation brief**
- **Design intent:** as finding 1. Every branch that answers redrawn, and every guard that keeps a failed read or a partial repoint bare, has a test that fails when the branch changes.
- **Full surface:** the Location list above, and their test files: `content-list.test.ts`, `video-row.test.ts` or `analytics.test.ts`, `watch-page.test.ts`, `shorts.test.ts`, `feed.test.ts`, `channel-page.test.ts`, `page-watcher.test.ts`.
- **Must preserve:** every existing test in those files.
- **Do not touch:** production code; this finding adds tests only.
- **Proof:** each new test fails under its mutant from the Evidence list, and passes at HEAD.
- **Escalation:** as finding 1: the same split ticket owns this test matrix.

### 3. A redraw on a pass ahead of WXT's report is timed as an instant cache hit — MEDIUM
- **Location:** `apps/extension/src/surfaces/page-watcher.ts:434-435` (`noteReadAhead`)
- **Attribution:** review 1 finding 1, partially fixed: the ahead path. Introduced as a known gap in `073826b7` (round 1), whose Approach decisions line says "a redrawn answer on an ahead pass notes nothing in the read-ahead record", to keep the ahead path unchanged. At `7aea7d5f` the ahead path gave the same number. Neither prior closure's "Known regressions, deferred" names it; review 3's own finder A raised it as a reasoned candidate, and the Grok trial proved it.
- **Real-world trigger:** where the content script has no Navigation API, WXT's 1 s poll reports a move up to a second late, so the first pass on the new page runs ahead of the report. Its cold read lands on an element Studio redrew, it answers redrawn, and nothing is noted; when WXT reports, the navigation's own pass draws from the 30-second keep at once and reports about 0 ms with `fromCache: true`. MEDIUM, capped: telemetry only, but a wrong number silently delivered to the baseline (#1056) and #555. Check during the baseline: on a browser whose content script has no Navigation API, the share of shown events with `ms` under 50 and `fromCache: true` on a creator's first Studio move of a day.

**Evidence**
```ts
    if (readAhead.surfaces.has(name)) return
    if (typeof answer === 'string' || answer.placement === 'redrawn') return
```
An ahead `shown` records `ms` and an ahead `cut` records `since`; an ahead `redrawn` records nothing, and `placeAll`'s own-pass bookkeeping is skipped for an ahead pass (`if (ahead) continue`).

**Failure mode** — executed with `repro/ahead-redraw-timing.case.ts`: the dashboard, then the URL moves to the Content list and a node is added, with no `navigated` yet; the first `place` waits 1,200 ms and answers `redrawnFrom(false, 'not-found')`; `navigated(contentList)` runs and the next `place` answers `shownFrom(true)`. Received `ms: 0, fromCache: true`; the rule is `ms: 1450, fromCache: false`.

**Recommended fix** — the redraw's open start goes into the read-ahead record, flagged, and lives by the same rule D1 gives the own pass:
```diff
-type ReadAhead = { ms: number; fromCache: boolean } | { since: number; fromCache: boolean }
+type ReadAhead =
+  | { ms: number; fromCache: boolean }
+  | { since: number; fromCache: boolean; redrawn?: true }
@@ function noteReadAhead(
-    if (readAhead.surfaces.has(name)) return
-    if (typeof answer === 'string' || answer.placement === 'redrawn') return
-    readAhead.surfaces.set(
-      name,
-      answer.placement === 'shown'
-        ? { ms: msFrom(start, shownAt), fromCache: answer.fromCache }
-        : { since: start, fromCache: answer.fromCache },
-    )
+    const noted = readAhead.surfaces.get(name)
+    if (noted && !('redrawn' in noted)) return
+    if (typeof answer === 'string') {
+      if (noted) readAhead.surfaces.delete(name)
+      return
+    }
+    if (answer.placement === 'redrawn') {
+      if (noted) noted.fromCache &&= answer.fromCache
+      else readAhead.surfaces.set(name, { since: start, fromCache: answer.fromCache, redrawn: true })
+      return
+    }
+    const since = noted?.since ?? start
+    const fromCache = (noted?.fromCache ?? true) && answer.fromCache
+    readAhead.surfaces.set(
+      name,
+      answer.placement === 'shown'
+        ? { ms: msFrom(since, shownAt), fromCache }
+        : { since, fromCache },
+    )
```
Line by line against today: a first `shown` or `cut` with nothing noted records exactly what it records now (`since = start`, `fromCache = answer.fromCache`); a later answer after a finished time or an unflagged cut start returns, as `readAhead.surfaces.has(name)` did; a string with nothing noted returns, as now. Only a flagged record behaves differently. `noteUnplacedAhead`'s `cutFrom(true)` over a flagged record closes it into an unflagged start, keeping the redraw's start and cache result. The own pass reads `early` as now: a flagged record has `since`, so `'ms' in early` is false and the own pass times from `early.since`. Grok's recommended diff is not used: it let an open record survive an ahead pass that found nothing, the defect D1 removed from the own pass.

**Remediation brief**
- **Design intent:** as finding 1: the figure time runs from the pass that could first act on the element to the figure, and a redraw carries that start and its read's cache result forward only while the surface keeps waiting on the same read, on an own pass (D1) and on a pass ahead of WXT's report alike. A finished time or a cut start noted first still wins.
- **Full surface:** `apps/extension/src/surfaces/page-watcher.ts`: the `ReadAhead` type, `noteReadAhead`, and its docblock ("A line, or a surface not found, notes nothing"); `placeAll` and `noteUnplacedAhead` need no change.
- **Must preserve:** `page-watcher.test.ts` "a figure the ahead pass drew, which the navigation's own pass keeps, reports the ahead pass's time"; "a read the ahead pass started, which WXT's report cut short before it drew, is timed from the ahead pass's start"; the whole "a surface after the one whose read WXT's report cut short" block; "a figure the ahead pass drew, which the page redraws on the navigation's own pass and the next pass draws again, reports the ahead pass's time" (D4); every case in "a figure drawn after the page redrew its element while its read was out"; every surface test's ahead case (`card.test.ts`, `analytics.test.ts` "a cold read a pass ahead of WXT's report started ...").
- **Do not touch:** D1's own-pass record and `giveUp`'s `nav.redrawn.clear()`; D2, D3, D5, D6.
- **Proof:** paste `docs/reviews/creator-analytics-1037/repro/ahead-redraw-timing.case.ts` inside the `describe("a figure read by a pass ahead of WXT's report, ...")` block of `apps/extension/src/surfaces/page-watcher.test.ts`, then `pnpm exec vitest run apps/extension/src/surfaces/page-watcher.test.ts -t 'repro:'`: red now, green after. Add a second case: an ahead redrawn answer, then an ahead bare `'not-found'`, then the own pass's figure, timed from its own pass.
- **Escalation:** as finding 1: the same split ticket.

### 4. A navigation before the budget screen shows drops the page's LCP — MEDIUM
- **Location:** `apps/web/src/screen-timing.ts:320-323` (`changeStarted`), with `endLcp` (`:234-249`) and `screenShown` (`:371-377`)
- **Attribution:** review 2 finding 1, partially fixed. The drop is from `eeb0fb58` (creator-analytics#1053 Web timing in OpenPanel), whose `changeStarted` sets `lcp.screen = null` before `endLcp`; `6077b162` (review 2 finding 1) added the floor for an input or hide but left this line, so a click that navigates sets `endedAt` and then loses it. Review 2's brief recorded the line as intended ("`changeStarted` still sets `lcp.screen = null`, so non-budget and signed-out loads send nothing"); it did not consider a budget load. `apps/web/src/screen-timing.ts` does not exist at `20a6c7c2`.
- **Real-world trigger:** a creator opens `/app/`, `/app/videos/:id`, `/app/audience` or `/app/retention`; budget screens mount only once `/api/me` answers (`apps/web/src/App.tsx:764`), and meanwhile the header or sidebar wordmark is a live `RouteLink` (`apps/web/src/Header.tsx:43`, `apps/web/src/Sidebar.tsx:183`), and Back and Forward work (`popstate`, `apps/web/src/route.ts:691`). A click or a Back in that window drops the load. The slower `/api/me` is, the wider the window: the loads the floor exists to keep. MEDIUM, capped (wrong results silently delivered to the baseline's p75), as review 2 finding 1 was.

**Evidence**
```ts
  if (timing.lcp.screen === undefined) timing.lcp.screen = null
  endLcp(timing)
```
`endLcp` holds only while `lcp.screen` is undefined; `null` ends the LCP with no event, and `screenShown` names a screen only while it is still undefined.

**Failure mode** — executed with `repro/lcp-navigation-before-screen.case.ts`: an LCP candidate at 640, an input at 1,800, `changeStarted(list, list)`, then `screenShown('/app/')`: `tracked()` is `[]`, where an input with no navigation sends `{ metric: 'LCP', value: 1800, screen: '/app/', beforeScreen: true }`. A move from Audience to the list at 2,200 with no input, then `screenShown('/app/')`: `[]`, where the rule is `{ value: 2200, screen: '/app/audience', beforeScreen: true }`.

**Recommended fix** — keep `lcp.screen` undefined until a screen shows, and remember the load route's budget screen beside it:
```diff
   lcp: {
     screen: BudgetScreen | null | undefined
+    loadedOn: BudgetScreen | undefined
     candidate: number | null
@@ startScreenTiming
-      screen: undefined,
+      screen: undefined,
+      loadedOn: undefined,
@@ export function changeStarted(previous: Route, next: Route): void {
   if (!timing) return
-  if (timing.lcp.screen === undefined) timing.lcp.screen = null
+  if (timing.lcp.screen === undefined && timing.lcp.loadedOn === undefined) {
+    const loadedOn = budgetScreenOf(previous)
+    if (loadedOn === null) timing.lcp.screen = null
+    else timing.lcp.loadedOn = loadedOn
+  }
   endLcp(timing)
@@ export function screenShown(screen: BudgetScreen): void {
   if (!timing) return
   if (timing.lcp.screen === undefined) {
-    timing.lcp.screen = screen
+    timing.lcp.screen = timing.lcp.loadedOn ?? screen
     if (timing.lcp.endedAt !== null) endLcp(timing)
   }
```
Line by line: on a load from a budget route, `endLcp` now runs with `lcp.screen` still undefined, so it holds `endedAt ??= now()`: the first input's time when one came, else the move's time, never the shell's paint (review 2's rejected number). `screenShown` then sends it under the screen the page loaded on. A load from a route with no budget sets `null` and ends with no event, as now. A load whose screen never shows (signed out) keeps `lcp.screen` undefined, so a later hide only holds, and nothing is sent. A load whose screen already showed is unchanged (`lcp.screen` is set). A second move before a screen shows keeps the first `loadedOn` and the first `endedAt`. Grok's recommended diff is not used: it set `lcp.screen` to the load screen at the move, so a later hide with no screen shown sent the floor.

**Remediation brief**
- **Design intent:** review 2's: one LCP per page load, for the budget screen the page loaded on; the browser stops taking candidates at the first input; when that input, a hide or a navigation comes before the screen shows, the LCP is a floor at that moment, marked `beforeScreen: true`, sent when a budget screen shows. A load from a route with no budget, and a load whose screen never shows, send nothing.
- **Full surface:** `apps/web/src/screen-timing.ts` (`Timing['lcp']`, the `startScreenTiming` start state and its docblock, `changeStarted`'s LCP lines, `screenShown`, `endLcp`'s docblock); `README.md:151`, the `web_vital` line: say that an input, hide or change of screen before the screen shows is held and sent as a floor, for the screen the page loaded on, when a budget screen shows, and that a load on a screen with no budget sends none. The callers (`route.ts:691`, `:700`) need no change.
- **Must preserve:** `apps/web/src/screen-timing.test.ts`: "an input before the budget screen shows sends its time as the LCP, marked as a floor"; "a hide before the budget screen shows ..."; "sends no LCP for a page that loaded on a screen with no budget"; "an input before any screen shows sends no LCP when the page then moves to a screen with no budget, or never shows a screen" (it moves from Settings, a route with no budget); "sends no LCP for a page loaded in the background"; "sends the last LCP candidate once, at the first input, for the screen the page loaded on"; every INP case; the `answer_shown` path in `changeStarted`, `loadOpen` included. All of `apps/web/src/app.test.ts` and `apps/web/src/analytics.test.ts`.
- **Do not touch:** INP counting (`inpOf`, `onInteractions`, #1073); `replace` navigations, which skip `changeStarted` on purpose (`apps/web/src/route.ts:682`).
- **Proof:** paste `docs/reviews/creator-analytics-1037/repro/lcp-navigation-before-screen.case.ts` inside `describe('the web vitals', ...)` in `apps/web/src/screen-timing.test.ts`, then `pnpm exec vitest run apps/web/src/screen-timing.test.ts -t 'repro:'`: both red now, green after. Add a third case: a signed-out load (never `screenShown`) that navigates from `/app/` and is then hidden sends nothing.

### 5. Nothing pins the transaction keys the trace scrub keeps for the envelope and GlitchTip's filters — LOW
- **Location:** `packages/reporter/src/scrub.ts`, `transactionKeys` (`'release'`, `'environment'`, `'sdkProcessingMetadata'`)
- **Attribution:** introduced by `f99bc5c8` (review 1 finding 3).
- **Real-world trigger:** none today. A later edit that drops one of these keys loses the envelope's trace header (`sdkProcessingMetadata`, from which `core/build/esm/envelope.js` builds it) or GlitchTip's per-release and per-environment trace filters, with every test green. LOW.

**Evidence** — the three keys deleted from `transactionKeys`; `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts`: 7 files, 52/52 green. `grep -rn sdkProcessingMetadata packages/reporter/src/*.test.ts apps/api/src/traces.test.ts` finds nothing.

**Recommended fix** — in `scrub.test.ts`, "a transaction keeps only the keys the scrub names", add `release`, `environment` and `sdkProcessingMetadata: { dynamicSamplingContext: { trace_id: 'dbfe119901b14f399c9fb1a65490cafd' } }` to the event and assert each passes; in `packages/reporter/src/traces.test.ts`, "with a rate of 1.0, a request sends one trace", assert the envelope's first line carries `trace.trace_id` equal to the transaction's `contexts.trace.trace_id`.

**Remediation brief**
- **Design intent:** ADR 0023: a trace keeps a key only when it is on its list; a key on the list is a decision that it is safe, and the envelope header and GlitchTip's filters depend on three of them.
- **Full surface:** `packages/reporter/src/scrub.test.ts`, `packages/reporter/src/traces.test.ts`.
- **Must preserve:** both files' existing cases.
- **Do not touch:** `scrub.ts`.
- **Proof:** each new assertion fails with its key deleted from `transactionKeys`, and passes at HEAD.

### 6. The trace scrub keeps every key of a runtime context, though its docblock and ADR 0023 say it keeps only listed keys at every level — LOW
- **Location:** `packages/reporter/src/scrub.ts`, the `contexts` branch of `scrubTransaction` (`runtimeContexts.has(name) && name !== 'trace'`), and its docblock ("it keeps only the keys it names, at every level")
- **Attribution:** introduced in `a1d3bcb4` (creator-analytics#1052 GlitchTip traces per API route): base's `runtimeContexts` served the error scrub only. The claim widened in `f99bc5c8` (review 1 finding 3), whose docblock says "at every level". `git log -S"name !== 'trace'" 20a6c7c2..HEAD` names `a1d3bcb4`.
- **Real-world trigger:** none known on the Dokploy VPS. `app`, `browser`, `cloud_resource`, `culture`, `device`, `os` and `runtime` pass whole, so a key the SDK adds to one of them later leaves the process, and `cloud_resource` can carry `host.id` or `cloud.account.id` on a cloud host: the same server identity the scrub drops as `server_name`. A false security claim in an ADR the `@sentry/node` upgrade (#1092) relies on, so its own finding. LOW.

**Evidence**
```ts
        if (context === undefined || (runtimeContexts.has(name) && name !== 'trace'))
          return [name, context]
```

**Failure mode** — executed with `node` on `scrubTransaction`: `contexts: { os: { name: 'Linux', laterKey: '…' }, cloud_resource: { 'host.id': 'i-0abc', 'cloud.account.id': '123456789012' } }` comes out unchanged.

**Recommended fix** — give each runtime context of a transaction a named key list, read from what `@sentry/node` 11.4.0 puts there on a real traced request (the recording transport, as `f99bc5c8`'s commit did for the other levels), and keep `cloud_resource` out of a transaction entirely. The error scrub keeps runtime contexts whole, as today.

**Remediation brief**
- **Design intent:** ADR 0023: the trace scrubbing hook keeps a key only when it is on its list, at every level, so a key the SDK adds later stays in the process until someone adds it on purpose; the host's identity does not leave in a trace.
- **Full surface:** `packages/reporter/src/scrub.ts` (`scrubTransaction`'s `contexts` branch, beside `transactionKeys`, `spanKeys`, `traceContextKeys`); `docs/adr/0023-id-free-traces-leave-the-process.md:7` only if what a trace carries changes.
- **Must preserve:** `scrub.test.ts` "a transaction keeps its runtime contexts and drops its user, extra, breadcrumbs and any other context data" (runtime `name` and `version`, os `name`); the error scrub's runtime contexts; `apps/api/src/traces.test.ts`.
- **Do not touch:** `scrubEvent`'s contexts branch (errors keep runtime contexts whole by design).
- **Proof:** a `scrub.test.ts` case with an unlisted key in `os` and a `cloud_resource` context on a transaction: red now (both kept), green after.

### 7. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/page-watcher.ts:38-42` — "A later pass of the same navigation that shows the figure is timed from the pass that first answered this" → "A later pass of the same navigation that shows the figure is timed from the pass that first answered this, or, when a pass ahead of WXT's report read it first, from that pass's start or with its whole time"
- `packages/reporter/src/tracing.ts:36-39` — "The SDK drops a 401 to 404 answer whole." → "The SDK drops a 401 to 404 answer, and a redirect other than 300 and 304, whole."
- `apps/web/src/screen-timing.test.ts` (test title) — "an input before any screen shows sends no LCP when the page then moves to a screen with no budget, or never shows a screen" → "an input before any screen shows sends no LCP when the page loaded on a screen with no budget and then moves, or when no screen ever shows" (the test moves from Settings to the video list). The `startScreenTiming` docblock and the README's `web_vital` line are finding 4's surface, not this sweep.
- `packages/reporter/src/scrub.test.ts` (test title) — "and a longer token is kept whole" → "and a longer token of word characters is kept whole" (the test also asserts `UC…u-x` is masked)

## Needs Further Investigation
### A. A record may survive a move away from the navigation's URL and back that WXT never reports
Ahead passes never touch `nav.redrawn`. If the URL leaves `nav.url` and comes back between two of WXT's polls, a record from before the move times the figure across it. To confirm: a watch test that moves `url()` away and back with no `navigated` call, after a redrawn answer. For the split ticket.

### B. Review 1's Needs Further Investigation A, carried untouched
A refused answer leaves its change waiting in the web app's screen timing (`pre-pr-review-1.md`, Needs Further Investigation A). Out of scope for both remediations; still open.

## Reviewed and Dismissed
- **The new channel ID pattern masks `UC<21 chars>--x`, which `\b` kept whole.** That text holds a 22-character tail ending in `-` before a non-word character, which is the rule's stated addition; it errs toward masking.
- **The LCP floor stops at mount, not at paint** (`screenShown` runs in each screen's mount effect). Within Nick's decision: an input after the screen shows sends the last candidate, unmarked.
- **A `Cut` reaches the watch's record logic.** Every `cutFrom` sits behind `!current()`, and `placeAll` returns before the record code.
- **A read-ahead entry is written again after the navigation's own pass used it.** Passes run one at a time behind the lock.
- **The missing and give-up judgments changed.** Every redrawn answer counts as the bare answer it replaced, `takeDownPageAndRows`'s `'not-found'` included (finder A).
- **`startNewTrace` drops the active span for errors.** The reporter test "an error reported during a request carries that request's trace" pins it, and core's fallback runs (no OpenTelemetry override in 11.4.0).

## Minor / nits
- `apps/web/src/screen-timing.ts`, the observer's `current.lcp.endedAt === null` clause: no observable effect, since `endLcp` reads the candidate only when `endedAt` is null and nothing resets it.
- `feed.ts:172`, `shorts.ts:171`, `channel-page.ts:72`: `tiles.length > 0` is redundant (an empty list reads `noPills`, `answered: false`); `content-list.ts:399`: `read.state === 'read'` is redundant beside a non-line view.
- On the pill pages, one repointed tile beside tiles placed with no pill reports a cold read at `ms: 0` (`channel-page.test.ts`, the D3 test): the rule as decided in review 1 round 2.
- Only one direction of "the rate alone decides" is tested: no test shows a sampled caller header (`-1`) cannot force a trace at a rate between 0 and 1. `startNewTrace` covers both.
- No test covers an input or hide followed by a move to another budget screen before any screen shows (same path as the Settings case).

## Test quality
Tests added or changed in the delta: 20 cases in 8 files. Red at `7aea7d5f`: 15 (one more, the API's sentry-trace case, red against the pre-fix code during remediation and not re-run here). Green at `7aea7d5f`: 5, each a deliberate guard, none to delete:
- `screen-timing.test.ts` "an input before any screen shows sends no LCP when …": a must-preserve guard of review 2 finding 1; it goes red if the floor is sent for a null screen.
- `packages/reporter/src/traces.test.ts` "with a rate of 1.0, an error reported during a request carries that request's trace": the must-preserve of review 1 finding 2.
- `page-watcher.test.ts` "after a pass that found nothing, is timed from its own pass": base behaviour pinned beside the redraw cases.
- `page-watcher.test.ts` "on a navigation the give-up hands back after a dropped one …" and `channel-page.test.ts` "a pill drawn after YouTube points one tile at the creator's video … beside tiles of another channel's videos": regression guards for round 1's introduced defects, red at `073826b7` (`ms: 6200`) and at `62756a2e^` (`ms: 1450`).
Tautology shapes found: none. The coverage gap is finding 2.

## Prior-review closure
- `pre-pr-review-1.md`: findings 2, 3, 4 and 5 fully fixed. Finding 1 partially fixed: right on the own-pass paths of the card, video-row, watch page, Shorts, pill pages and analytics that its tests cover, still wrong on the Content list's kept branch (finding 1 here) and on the ahead path (finding 3 here). Round 1's six deferred regressions are closed by round 2, as its closure says; none reappears. Nothing was "resolved" by a comment edit alone.
- `pre-pr-review-2.md`: finding 2 fully fixed. Finding 1 partially fixed: the floor holds for an input or a hide before the screen shows, not for a navigation (finding 4 here). Their docblock and test-title edges are in finding 7.

## Remediation scope
Nick, 2026-11-24: remediate findings 4, 5, 6 and 7 in this PR. Finding 4 uses the brief's mechanism as written (approved: a navigation from a budget route before any screen shows holds the floor for the screen the page loaded on; a load from a route with no budget, and a load whose screen never shows, send nothing). Findings 1, 2 and 3 and Needs Further Investigation A are out of scope here: they moved to nick-vogel/creator-analytics#1108, a child of #1037, and `/pr-review-remediate` skips them. Needs Further Investigation B stays open, untouched.

## Before opening the PR
- **CI readiness:** all five full checks green at `8aff9d8d` on Node 26; CI runs 24.
- **Commit hygiene:** commit this doc and the three new repros (`repro/content-list-word-line-pass-between.case.ts`, `repro/ahead-redraw-timing.case.ts`, `repro/lcp-navigation-before-screen.case.ts`) as `creator-analytics#1037 pre-PR review 3`. Grok's own doc and repros stay in session scratch; this doc carries everything load-bearing from them. No commit carries AI attribution; the delta adds no em-dash.
- **Likely reviewer asks:** the split ticket for the extension timing; whether the baseline (#1056) should wait for it, since it reads `extension_surface_shown`.

## Verdict
Not ready as-is; ready once finding 4 is fixed and the split ticket is filed. The confirmed count is 4 MEDIUM and 2 LOW plus a comment sweep, against 5 and 2 in the prior rounds; three of the MEDIUMs are in the extension's redraw timing, now on its third round, and two of those four MEDIUMs came from the Grok trial or were proved by it. Gate: finding 4 (web), findings 5 and 6 (LOW) and finding 7 are small and can be fixed in this PR through `/pr-review-remediate`; findings 1, 2 and 3, with Needs Further Investigation A, go to one split ticket under #1037 with its own test matrix, filed before the PR opens. Whether #1056 starts before that ticket lands is Nick's call: until it does, the extension's figure time after a redraw can still read 0 ms on the Content list and on the ahead path.

## Remediation: 2026-11-24
Scope per the Remediation scope note: findings 4, 5, 6 and 7. Findings 1, 2 and 3 and Needs Further Investigation A skipped (moved to creator-analytics#1108); Needs Further Investigation B untouched.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 4 (MEDIUM) | `1a843e92` a navigation before the budget screen shows dropped the page's LCP | red→green: `pnpm exec vitest run apps/web/src/screen-timing.test.ts`, the two repro cases as real tests ("an input and then a move before the budget screen shows ...", "a move to another budget screen before either shows ...") red at `52584978` (`tracked()` is `[]`), green after; the signed-out guard ("a move from a budget screen and then a hide, with no screen ever shown, sends no LCP") green before and after. Preserve: `screen-timing.test.ts`, `app.test.ts`, `analytics.test.ts` 588/588 | 0 new; edited docblock lines of `endedAt`, `endLcp` and `startScreenTiming` (the brief's surface), plus README `web_vital` | fixed (pr-review-finder, 12-scenario differential vs `1a843e92^`: only the intended LCP events differ; INP and `answer_shown` identical) |
| 5 (LOW) | `66286ef8` nothing pinned the transaction keys the envelope and GlitchTip's filters need | red→green: each of `release`, `environment`, `sdkProcessingMetadata` deleted from `transactionKeys` one at a time, then `pnpm exec vitest run packages/reporter/src/scrub.test.ts packages/reporter/src/traces.test.ts`: the scrub case red for each, the reporter trace case also red for `sdkProcessingMetadata`; green at HEAD | 0 | proved by execution |
| 6 (LOW) | `83abcc2c` the trace scrub kept every key of a runtime context | red→green: `pnpm exec vitest run packages/reporter/src/scrub.test.ts -t "runtime contexts keep only"` red before (`os.laterKey` kept), green after. Preserve: `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` 53/53 | 2 (the `transactionKeys` docblock: the SDK version the lists come from, and why `cloud_resource` goes) | fixed (pr-review-finder: every key `@sentry/node` 11.4.0 sets in `integrations/context.js` and `sdk/client.js` is listed; `scrubEvent` identical on the same input) |
| 7 (LOW, comment hygiene) | `f2c68df5` comment hygiene | each of the four texts read against its code | n/a (corrections only) | excluded from verify |
| n/a | `2cbc2e42` the ahead-redraw repro passes lint | `pnpm lint` failed at `52584978` on `repro/ahead-redraw-timing.case.ts:33` (`noGlobalAssign`, the pasted case assigns the host file's `stop`); a `biome-ignore` with its reason, as the repros of #637 and #4 do; `pnpm lint` green after | 1 (the `biome-ignore`) | not a finding: the build was red before this round |

Full chain at `2cbc2e42`, Node 26.3.0: `pnpm lint`, `pnpm typecheck`, `pnpm build` green; `pnpm test` 5995 passed, 1 expected fail, 1 failed on a 5000 ms timeout in `apps/api/src/video-revenue.test.ts` ("with the RPM switch on, a last28 list sorts by ...", a file this round does not touch, run while the verify agent ran its own suites); that file alone 43/43 green on rerun; `pnpm run --if-present test:browser` green.

### Known regressions, deferred
None introduced. The verifier's LOW notes, for the next review to weigh, none a defect against the briefs:
- Finding 4: a signed-in load on a budget screen that moves to a screen with no budget before it paints, then is hidden, sends nothing, the same as the signed-out case, which the code cannot tell apart; if the creator later reaches a budget screen, the floor is sent then, late. Within the approved intent ("a load whose screen never shows sends nothing"). No test covers a second move keeping the first `loadedOn` and floor, a move then an input, or a background load with a move; the verifier's probe shows all three behave as intended.
- Finding 6: the kept `device.boot_time`, `app.app_start_time`, `device.memory_size` and `device.cpu_description` together are stable per host and process, so they can link traces to one server; `os.kernel_version` can name a cloud provider. Nothing kept identifies a creator. Dropping `boot_time` and `app_start_time` would close most of it; a decision for Nick, outside the brief, which asked for the lists the SDK fills. The new test covers `os` and `cloud_resource` only, not the `app`, `device`, `culture` and `runtime` lists.

### Rework briefs
None: no fix was half-fixed and none introduced a defect.

### Approach decisions (this remediation)
- Finding 4: the load screen is held as `lcp.loadedOn`, set once at the first move before any screen shows from `budgetScreenOf(previous)`, with `lcp.screen` left undefined so `endLcp` holds; `screenShown` names the LCP `loadedOn ?? screen`. The brief's mechanism as written, per the scope note.
- Finding 6: runtime contexts of a transaction keep a `Map` of named key lists beside `traceContextKeys`, read from a real traced request through the recording transport (as `f99bc5c8` did for the other levels); `cloud_resource` is dropped whole; `browser`, never filled on the server, takes the other-context path (`scrubTraceData`). The error scrub's `runtimeContexts` set is unchanged.
- Finding 5: the keys are pinned at both layers, the hook's own case in `scrub.test.ts` and the envelope header in the reporter's rate-1.0 trace test, so a deletion goes red where it bites.

### Follow-up: 2026-11-24
Nick chose to close the verifier's host-fingerprint note on finding 6 in this PR. `3cd5e3e6` drops `device.boot_time` and `app.app_start_time` from the trace scrub's runtime context lists: each is stable per host or process, so together they link traces to one server. Proof: `pnpm exec vitest run packages/reporter/src/scrub.test.ts -t "boot and start times"` red before (both kept), green after; `pnpm exec vitest run packages/reporter apps/api/src/traces.test.ts` 54/54. Comments added: 0 new lines (the `transactionKeys` docblock sentence now names the two times). `device.memory_size`, `device.cpu_description` and `os.kernel_version` stay: on their own they name a machine class, not one server. The error scrub is unchanged.
