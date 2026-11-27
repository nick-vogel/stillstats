# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `2f63331` ("creator-analytics#4 pre-PR review 9 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 148 files, +24,846 / −176, 404 commits. The only files this review adds are this doc and its two repros, `repro/review-10.test.ts` and `repro/review-10-placer.test.ts`.
**Delta under review:** since `bedf32b` ("creator-analytics#232 Studio extension: the proven LOW findings from the eleventh epic-loop run"), the HEAD pre-PR review 9 reviewed. 18 files, +848 / −50: review 9's remediation round, `c4f9e88` (Finding 1), `9f3df76` and its rework `a81583d` (Finding 2), `f4175ec` (Finding 3), `f6ec9bf` (Finding 4), and the closure table `2f63331`; plus review 9's own doc and repros (`d2c766c`). Product code in the delta: `apps/extension/src/surfaces/content-list.ts` (the sweep) and `apps/extension/src/surfaces/video-row.ts` (the placer's takedowns); the rest is comments, `CONTEXT.md`, tests and repros.
**Reviewed against:** epic creator-analytics#4; review 9's findings, Approach decisions, remediation closure table and its "Open after the round" note; `CODING_STANDARDS.md` rules 1 to 3; `CONTEXT.md` as the delta changes it.
**Date:** 2026-10-15
**Reviewer:** 2 code-review agents, 1 tautology-audit agent, plus a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green: 446 files at review start, 448 with this review's two repros |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `CI=1 pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 107 files, 2,256 tests |
| Preserved repro suite | `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | green at review start, 10 files, 21 tests (review 9's `review-9.test.ts`, `review-9-placer.test.ts` and the corrected `review-6.test.ts` included). With this review's repros: 12 files, 25 tests, 4 red by design (Findings 1 to 3) |
| Review 9 F1 (Content list line once the video list goes) | Finder read of `content-list.ts`; mutation (the no-list takedown removed) in a scratch worktree; 5 scratch scenarios on the saved fixture | fixed: the mutation turns 5 tests red (the 3 new suite tests and both `review-9.test.ts` rows). Scenario S2 found the regression in Finding 1 |
| Finding 1 repro | New `repro/review-10.test.ts` | red 1 of 1 at `2f63331` (`expected [] to have a length of 2 but got +0`); green at `bedf32b`'s `content-list.ts`, so introduced by `c4f9e88` |
| Finding 1's recommended fix | Applied in a scratch worktree at `2f63331` under the scratchpad, then removed | `review-10.test.ts` and `review-9.test.ts` green (3 of 3); `apps/extension/src/surfaces` 8 files, 283 tests green |
| Review 9 F2 and its rework (placer) | Finder ran HEAD's `video-row.test.ts` plus scratch scenarios against `video-row.ts` at `bedf32b`, `9f3df76` and `2f63331` | each of the 3 suite tests turns green at the commit that fixed its rule; review 9's "Open after the round" case still red at HEAD (Finding 2), and a second path with the same root cause (Finding 3) |
| Findings 2 and 3 repro | New `repro/review-10-placer.test.ts` | red 3 of 3 at `2f63331`, and red 3 of 3 with `bedf32b`'s `video-row.ts`, so present before the remediation round |
| Findings 2 and 3's candidate fix | Applied in a scratch worktree at `2f63331`, then removed | `review-10-placer`, `review-9-placer`, `review-8`, `review-6` green (9 of 9); `apps/extension` 21 files, 457 tests green; `tsc` on `apps/extension/tsconfig.json` and Biome clean. Held for the split ticket (see Escalation) |
| Review 9 F3 (review 6's stale repro) | Finder mutation of `analytics.ts`: old figure put back, then old line put back | fixed: both rows of `review-6.test.ts` go red under each mutation |
| Review 9 F4 (comment hygiene) | Finder read of each of the 12 entries against its code | 12 applied; 9 accurate as written, 3 still short of their code (entries in Finding 5) |
| Tautology audit | Agent: the delta's new and changed tests copied into a scratch worktree at `bedf32b`, run there | 10 added tests, 10 red at `bedf32b` on an assertion (not on import); the 2 rewritten `review-6.test.ts` rows green there by design; 89 existing Content list tests green there |
| Em-dashes in shipped copy | `git diff bedf32b -- . ':!docs/reviews' \| grep '^+.*—'` | none |
| Live browsers | Not run: no browser in a review | every finding below needs a Studio redraw no fixture shows; #99's mutation recording settles them |

**Repro command for the whole preserved suite:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` from the repo root. This round's repros alone: append `docs/reviews/creator-analytics-4/repro/review-10.test.ts docs/reviews/creator-analytics-4/repro/review-10-placer.test.ts`.

**Overall:** All four CI checks are green at `2f63331`, and review 9's MEDIUM (the Content list's line staying on a tab with no video list) is fixed. This round confirms three LOW behaviour findings, all capped because each needs a Studio redraw no fixture shows, plus a test hygiene batch and a comment hygiene batch. Finding 1 is a regression from review 9's Finding 1 fix: a video list Studio detaches for one pass while a re-sort's re-read is out takes the line and the pill down until the read lands. Its fix is the existing two-sweep tolerance applied to the no-list case, proven in scratch. Findings 2 and 3 are the placer's single `lastPlaced` slot, review 9's own open item and one more path; the placer's takedown has now been rewritten three times in response to reviews, so they go to a split ticket rather than a fourth in-place rewrite. The Confirmed count has shrunk from one MEDIUM to none, and the content has moved toward redraw edge cases and hygiene.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept (dismissed since review 1). Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock, for every surface whatever its `isOn` says. Unchanged.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list page elements (#219, #226, #230, amended by `e380c84` and #232):** the line goes directly after Studio's page header (`pageTitleIn`), and the pill's anchor directly after the Views heading's `h3` (`viewsWordLineIn`), never inside it. The page elements come down together. Unchanged.
- **Content list page elements once the video list goes (review 9 F1, amended by review 10 F1):** the Content list's `sweep` takes the page elements down when `videoListIn(document)` finds no list, on every page, with the same tolerance the empty-list case has: while the re-read of the answered rows is out, the first sweep in a row that finds no list asks for another pass instead, and only the second takes the page down; with no re-read out, the first sweep takes it down. One counter, `emptySweeps`, serves both. Precedent: the sweep's own `reReading && emptySweeps === 1` branch (`content-list.ts:249-250`).
- **Analytics placement and not-found (#225, review 6 F1, #228, #229):** a pass that misses the key metric header or card calls `removeSurface(document, 'analytics')` and answers `not-found`. The line needs only the header and card and goes directly before the card; the figure needs Studio's Views number too and comes on the pass that finds it (`standsOn`). A read answer shown with no Views number answers `not-found` (#228 assumption 1). Unchanged.
- **Analytics placement across redrawn anchors (review 8 F1, #232, review 9 F2 and its rework):** the placer's takedowns before a read judge `held` and `lastPlaced`, with `lastPlaced`'s another-read takedown before the keep check. Unchanged in this round. Review 10 Findings 2 and 3 show that one `lastPlaced` slot cannot hold every placement still up; the recorded candidate is a set of every placement that may be up (Finding 2's brief), and it goes to a split ticket with its own test matrix, not a fourth in-place rewrite.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link. Unchanged.
- **Preserved repros (review 6 F3, amended by review 8 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions, unless a later ticket changed the rule on purpose in a recorded assumption. Then the repro's assertion follows that ticket's in-suite test, and the repro keeps its name and intent. Unchanged. Repros are records: test hygiene entries below do not edit them.
- **Google call bound (#214, #216, #222, #227, #231):** unchanged.

## Confirmed Issues

### 1. A video list Studio takes away for one pass while a re-sort's re-read is out takes the line under the title and the pill down until the read lands — LOW (capped)
- **Location:** `apps/extension/src/surfaces/content-list.ts:231-235` (the sweep's no-list branch)
- **Attribution:** introduced by the remediation, `c4f9e88` ("creator-analytics#4 pre-PR review 9 finding 1: the Content list's line under the page title stays once Studio shows no video list"). `repro/review-10.test.ts` is green with `bedf32b`'s `content-list.ts` and red at `2f63331`. Review 9's brief named the fix's own failure only for a pass with no read out ("the next pass puts it back from the kept answer"); with a re-read out the pass is held, so nothing puts it back until the read lands.
- **Real-world trigger:** the creator re-sorts the Content list (same rows, new order); once the navigation settles the rows are read again, and Studio detaches and re-attaches `ytcp-video-section-content#video-list` while it redraws. Whether Studio detaches the whole list on a re-sort is unverified. Capped at LOW: upgrade to MEDIUM if #99's mutation recording of a re-sort shows the list element leaving the document.

**Evidence**
```ts
sweep(document, passAgain) {
  const list = videoListIn(document)
  if (!list) {
    emptySweeps = 0
    takeDownPage()
    return
  }
```
The list-present path just below gives rows taken away during a same-key re-read a second sweep before it takes the page down (`if (reReading && emptySweeps === 1) passAgain()`, `:249`); the no-list path takes it down on the first.

**Failure mode** — figures shown, re-sort, re-read out (held), the list detached for 300 ms and put back: the line and the pill are gone at once and stay gone while the read is out, while the row figures stay with no pill saying what they count. At `bedf32b` both stayed up. Executed: `repro/review-10.test.ts`, red 1 of 1, `expected [] to have a length of 2 but got +0`. The existing suite test for rows taken away in the same state, "rows Studio takes away for longer than a pass, while the settled re-read of those same rows is out, keep the line under the title and the pill in the Views heading up" (`content-list.test.ts:1041`), is the rule this breaks for the whole list.

**Recommended fix**
```diff
       if (!list) {
-        emptySweeps = 0
-        takeDownPage()
+        const reReading = readingKey !== undefined && readingKey === answered?.key
+        emptySweeps = reReading ? emptySweeps + 1 : 0
+        if (reReading && emptySweeps === 1) passAgain()
+        else takeDownPage()
         return
       }
```

**Remediation brief**
- **Design intent:** the Content list's page elements belong to the rows and come down together, and `sweep` runs on every scheduled tick for every surface whatever `isOn` says (`watch.ts`), so it is the one place that sees a tab the Content list does not run on. While a re-read of the answered rows is out, Studio may take its rows away for longer than a pass as it redraws, so a sweep that finds none asks for one more pass before it takes the page down. A list taken away is the same redraw at a larger scale and gets the same tolerance; a list that stays away (a move to Playlists) still comes down on the second sweep.
- **Full surface:** `apps/extension/src/surfaces/content-list.ts:231-235` only. Add the row of `repro/review-10.test.ts` as a suite test inside `describe("when the Content list's page elements, the line under the title and the pill in the Views heading, come down", ...)` (`content-list.test.ts:997`), beside the `:1041` test it mirrors, built with `showListFor` and `heldAnswer` as that test is. The comment above `sweep` is rewritten under Finding 5.
- **Must preserve:** with no re-read out, a sweep with no list resets `emptySweeps` to 0 and takes the page down at once (the reset is now the `: 0` arm); the three tests review 9 added (`content-list.test.ts:1111-1129` test.each, both rows, and `:1131`, "the Videos tab page Studio puts back on the same page shows the line under the title again, with no second read"); both rows of `repro/review-9.test.ts`; the rows-taken-away and links-stripped tests (`:1018`, `:1041`); the empty-tab tests; `passAgain` is called at most once per absence, on the first sweep.
- **Do not touch:** `place`'s guard and its `'not-found'` return when the header is detached (`:339`; a read landing while the list is away is discarded and read again, pre-existing, Minor below); the list-present branch.
- **Proof:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-10.test.ts docs/reviews/creator-analytics-4/repro/review-9.test.ts` is red 1 of 3 now and green 3 of 3 with the fix (checked in scratch), with `CI=1 pnpm exec vitest run apps/extension/src/surfaces` green (8 files, 283 tests). The fix's own failure: a creator who moves to Playlists while a same-key re-read is out keeps the line one tick longer (250 ms, `passEveryMs`) before the second sweep takes it down; a re-read that never answers is bounded by the background's 15 s abort, after which the pass ends and the next sweep has no re-read out.

### 2. A kept placement returns before the placer judges its other placements, so a figure of the same video stays beside a Views number Studio redrew, or beside none — LOW (capped)
- **Location:** `apps/extension/src/surfaces/video-row.ts:135-152` (the keep check returns before the `standing` rule reaches `lastPlaced`)
- **Attribution:** introduced on this branch; present at `bedf32b` and through the whole remediation round (`repro/review-10-placer.test.ts`'s finding 1 rows are red with `bedf32b`'s, `9f3df76`'s and `2f63331`'s `video-row.ts`). Review 9's remediation named it in its "Open after the round" note and did not apply it ("larger than one line and the round's one rework pass is spent"); it is not in that doc's closure table as escalated, nor in its "Known regressions, deferred".
- **Real-world trigger:** on a video's analytics page, a read for the video shows nothing on the first header (H1), Studio then redraws the header and the Views number (H2, N2) and the figure shows on N2, then Studio puts the first header and number back, or the first header with no number. No fixture shows such a sequence. Capped at LOW: upgrade to MEDIUM if #99's mutation recording shows Studio putting back a key metric header it replaced.

**Evidence**
```ts
if (
  held &&
  sameRead &&
  held.hosts.every((host) => host.isConnected) &&
  (held.placement !== 'shown' || held.standsOn === standsOn) &&
  isKept({ placement: held.keptAs, at: held.at })
) {
  return held.placement
}
```
H1's hostless entry passes every condition (`[].every(...)` is true; `'placed'` is kept for `signedInReadKeptMs`, 30 s), so the loop below it, the only code that applies the `standing` rule to `lastPlaced`, never runs.

**Failure mode** — the pass on H1 returns `'placed'` with no read, and the figure placed after N2 stays: beside N1 when Studio put N1 back, or alone in the Views tile when it did not. `analytics.ts` sees `'placed'`, so it does not answer `not-found` either, against `analytics.ts:62-64` ("the figure ... comes down on the pass that finds it gone"). It lasts until the kept entry expires (30 s) or another pass reads. Executed: `repro/review-10-placer.test.ts`, its two "finding 1" rows, red 2 of 2, `expected [ 'line:XXXXXXXXXXX', …(1) ] to deeply equal [ 'line:XXXXXXXXXXX' ]`.

**Recommended fix** — a split ticket, not an in-place fix here (see Escalation). The candidate mechanism, proven in scratch together with Finding 3: replace the one `lastPlaced` slot with a set of every placement that may still be up, judge each one other than `held` before the keep check with both rules, and judge `held` after it.
```diff
-  let lastPlaced: PlacedEntry | undefined
+  const mayBeUp = new Set<PlacedEntry>()
@@
     const held = placed.get(after)
-    const sameRead =
-      held?.videoId === videoId && held.window === window && held.periodLabel === periodLabel
     const forThisRead = (entry: PlacedEntry) =>
       entry.videoId === videoId && entry.window === window && entry.periodLabel === periodLabel
-    // Another video's or period's numbers never stay up beside these, whether Studio kept the
-    // element they were held by or drew a new one.
-    if (lastPlaced && lastPlaced !== held && !forThisRead(lastPlaced))
-      for (const host of lastPlaced.hosts) host.remove()
+    const judge = (before: PlacedEntry) => {
+      if (!forThisRead(before)) {
+        for (const host of before.hosts) host.remove()
+        mayBeUp.delete(before)
+      } else if (before.placement === 'shown' && before.standsOn !== standsOn)
+        for (const host of before.standing) host.remove()
+    }
+    for (const before of mayBeUp) if (before !== held) judge(before)
     if (
       held &&
-      sameRead &&
+      forThisRead(held) &&
@@
-    for (const before of new Set([held, lastPlaced])) {
-      if (!before) continue
-      if (!forThisRead(before)) for (const host of before.hosts) host.remove()
-      else if (before.placement === 'shown' && before.standsOn !== standsOn)
-        for (const host of before.standing) host.remove()
-    }
+    if (held) judge(held)
@@
     placed.set(after, entry)
-    lastPlaced = entry
+    for (const each of mayBeUp)
+      if (each.hosts.every((host) => host.parentNode === null)) mayBeUp.delete(each)
+    mayBeUp.add(entry)
```
The two comments the diff removes carry their constraint into the ticket's rewritten doc comments (`:50-58`, `:106-110`), not into the code.

**Remediation brief**
- **Design intent:** `videoRowPlacer` holds placements by the Studio element they are held by (`placed`, a WeakMap keyed on `after`). Before any read, and before any keep, nothing it placed for another video, window or period stays up, and no shown figure stays beside a `standsOn` element other than this pass's. Both rules apply to every placement whose hosts may still be on the page or may come back with a Studio subtree, not to one remembered slot. The prune uses `parentNode === null`, not `!isConnected`, because hosts in a detached Studio subtree can come back with it (Finding 3's path).
- **Full surface:** `apps/extension/src/surfaces/video-row.ts:106-110` (the `lastPlaced` declaration and doc), `:126-152` (the takedowns and keep check), `:201` (`lastPlaced = entry`), and the placer doc at `:50-58`; `grep -n lastPlaced apps/extension/src` finds no other user. New suite tests in `apps/extension/src/surfaces/video-row.test.ts` for the three rows of `repro/review-10-placer.test.ts`, named for the rule.
- **Must preserve:** the keep check's conditions other than the `sameRead` rename (connected hosts, `standsOn` for a shown placement, `isKept`); a kept held placement returns with no read; the line stays during the read when only the figure's anchor changed (`analytics.test.ts`, "a sign-in line stays up while Studio's Views number is gone for a moment on the same page"); every `video-row.test.ts`, `analytics.test.ts` and `card.test.ts` test; `repro/review-9-placer.test.ts`, `repro/review-8.test.ts` and `repro/review-6.test.ts` green; `card.ts:16` and `analytics.ts:71` each own their own placer instance, so the set is per surface.
- **Do not touch:** `analytics.ts`'s not-found rules (#228); `removeSurface(root, surface)` after the read.
- **Proof:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-10-placer.test.ts docs/reviews/creator-analytics-4/repro/review-9-placer.test.ts docs/reviews/creator-analytics-4/repro/review-8.test.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` is red 3 of 9 now and green 9 of 9 with the candidate (checked in scratch), with `CI=1 pnpm exec vitest run apps/extension` green (21 files, 457 tests). The candidate's own failure: same-read entries whose hosts sit in Studio subtrees Studio never reuses stay in the set until another read's pass judges them away, so a long stay on one video with many redraws grows the set by one entry per redraw; each pass walks it. The ticket's test matrix should bound that (for example, prune entries whose `after` is no longer held and whose hosts are all disconnected once a pass for another read runs).
- **Escalation:** fourth rewrite of the placer's takedown (#232 for review 8 F1, `9f3df76` for review 9 F2, `a81583d` its rework), so recommend a split ticket with its own test matrix (the held, last and earlier placements, each for the same read or another, shown or not, `standsOn` the same, changed or gone, kept or expired) rather than another in-place fix. `/pr-review-remediate` should skip this finding and Finding 3 as escalated.

### 3. After a kept placement the placer still remembers the placement before it, so a new card for another video leaves the kept video's line up while the read is out — LOW (capped)
- **Location:** `apps/extension/src/surfaces/video-row.ts:135-143` (the keep return) with `:201` (`lastPlaced = entry`, set only after a read)
- **Attribution:** introduced on this branch; present at `bedf32b` (`repro/review-10-placer.test.ts`'s "finding 2" row is red with `bedf32b`'s `video-row.ts` and at `2f63331`). New to this review.
- **Real-world trigger:** Studio puts back an earlier analytics container whose key metric card still holds the extension's line for video X, the placer keeps that placement, and Studio then draws a new card for video Y inside the same container. Contrived; no fixture shows it. Capped at LOW: upgrade to MEDIUM if #99's mutation recording shows Studio reusing an earlier container across a move to another video.

**Evidence**
```ts
    if (lastPlaced && lastPlaced !== held && !forThisRead(lastPlaced))
      for (const host of lastPlaced.hosts) host.remove()
    if (held && sameRead && /* … */ isKept({ placement: held.keptAs, at: held.at })) {
      return held.placement
    }
```
On the keep return `lastPlaced` still names the placement before (Y's), whose hosts were just taken down; the kept X placement's line is in no slot a later pass looks at.

**Failure mode** — X kept on the put-back container, then a new card for Y: `held` is undefined and `lastPlaced` is Y's own entry (the same read), so nothing comes down, and "View this video in Stillstats" for X stays beside Y's page while Y's read is out. The read landing clears it through `removeSurface(root, surface)`. Executed: `repro/review-10-placer.test.ts`, its "finding 2" row, red, `expected [ 'line:XXXXXXXXXXX' ] to deeply equal []`.

**Recommended fix** — the same split ticket and candidate as Finding 2: with every placement that may be up in one set, X's kept entry is judged on Y's pass.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as Finding 2; the third row of `repro/review-10-placer.test.ts` is this finding's proof.
- **Escalation:** as Finding 2. One ticket covers both.

### 4. Test hygiene — LOW (aggregated)
- **Attribution:** introduced by the remediation round's tests (`c4f9e88`, `9f3df76`, `a81583d`). Standard 2 ("one rule, one test"; "a test states its own limits"). The preserved repros are records and are not edited.
- `apps/extension/src/surfaces/content-list.test.ts:1111-1129` and `:1131-1143` — the put-back test's first half (tab page taken away, then `expect(hosts()).toEqual([])`) states the test.each's same-page row's rule again → drop `expect(hosts()).toEqual([])` from `:1137` and leave the put-back test about the put-back; keep both test.each rows.
- `apps/extension/src/surfaces/content-list.test.ts:1141` — the put-back test checks only the line → add `expect(pageHosts()).toHaveLength(2)` after the line's assertion, so the pill coming back is pinned too.
- `apps/extension/src/surfaces/content-list.test.ts:995-996` — the describe's `// Limits:` covers rows taken away or links stripped; the new tests stand in for Studio's Playlists tab with an invented `ytcp-playlist-section` → extend it: "…is a creator-analytics#99 check, and so is what Studio's Playlists tab puts in place of the Videos tab page, which these tests stand in for with an element of their own."
- `apps/extension/src/surfaces/video-row.test.ts:139` — `expect(up().filter((host) => host.endsWith('YYYYYYYYYYY'))).toEqual([])` → `expect(up()).toEqual([])`, which holds at HEAD and pins more (no X host is up while the read is out either).
- `apps/extension/src/surfaces/video-row.test.ts:174-178` — the hostless put-back test passes the same whether the keep check returned or a read went out and hung, so it never shows the kept path it exists for → keep the call's result, `const placement = placing(place, first, 'XXXXXXXXXXX', first.number)`, and after `settle()` assert `expect(await Promise.race([placement, Promise.resolve('pending')])).toBe('placed')`.

### 5. Comment hygiene — LOW (aggregated)
- **Attribution:** the first two entries are introduced by `c4f9e88`; the `video-row.ts` entries by `9f3df76` and `a81583d` (they stand until the Finding 2 ticket rewrites them); the rest are review 9 Finding 4 entries applied short of their code by `f6ec9bf`, or older text the delta left beside them.
- `apps/extension/src/surfaces/content-list.ts:227-228` — "A pass awaiting a read sweeps no row Studio repoints meanwhile, and takes down no page element." → "A pass awaiting a read cannot sweep the rows Studio repoints meanwhile, or take down the page elements of a list Studio no longer shows; the sweep does both, outside the pass lock."
- `apps/extension/src/surfaces/content-list.ts:63-65` — the surface's doc does not say what a tab with no video list shows → append "A tab with no video list, such as Playlists, shows nothing of the extension's." after "a line state still shows its line."
- `apps/extension/src/surfaces/video-row.ts:53-55` — "Before it reads again, it takes down the last elements it placed when they are for another video, window or period" → "Before it keeps or reads, it takes down the last elements it placed when they are for another video, window or period".
- `apps/extension/src/surfaces/video-row.ts:107-108` — "a new element for another video, window or period, such as a key metric card Studio redrew on a move, takes it down before its read." → "an element for another video, window or period, such as a key metric card Studio redrew on a move or put back, takes it down before it keeps or reads."
- `apps/extension/src/surfaces/video-row.ts:131-132` — "Another video's or period's numbers never stay up" → "Another video's, window's or period's numbers never stay up".
- `apps/extension/src/surfaces/video-row.ts:144-146` — the comment over the loop names only the `standing` rule, though the loop also takes down every host of a placement for another read → open it with "A placement for another read comes down whole." and keep the rest.
- `CONTEXT.md:180` — "A page without the Views heading's line that holds the word shows no figure and no pill, and a line state still shows its line under the title." → "A page without the Views heading's line that holds the word shows nothing of an answer with figures, no line, pill or figure, and a line state still shows its line under the title." `takeDownForNoWordLine` (`content-list.ts:195-200`) takes the line down too; review 9 corrected the code comment, not the glossary.
- `apps/extension/test/studio-boundary.test.ts:36-39` — the list of reads the scan does not match dropped `.href`, which `pageRead` still does not match and the scanned sources use (`surfaces/analytics.ts:80`, `surfaces/testing.ts`), and never named `.style` → "…`.className`, `.text`, `.label`, `.href`, `.style`, `outerText`, `getAttribute` (…) and attribute-value selectors are not matched."
- `apps/extension/test/api-boundary.test.ts:4-6` — the import kinds the scan cannot see omit two that its regex (`:28`, `^import\s+(?!type\s)[^']*from\s+'…'`) misses → "…not an extensionless, `.js`, double-quoted, dynamic, side-effect (`import '…'`) or indented import, an aliased fetch, or an `export ... from` re-export."
- `apps/api/src/app.ts:250-251` — "the vault answers only the refusal and what Google answered" → "the vault answers only the refusal, the consent's intent and what Google answered". The refusal carries `intent` (`token-vault.ts:191-192`), which the next lines pass to `refusedLanding`.

## Needs Further Investigation

### A. A surface whose page the URL leaves keeps its hosts — confirm in #99
Carried from reviews 1, 8 and 9. Review 9 F1 closed the Content list's case; the analytics page's Overview to Reach or Engagement move and the dashboard card are still open. What would confirm it: #99, on a video's analytics page, switch Overview to Reach and look for the figure and line. If either stays, the fix is in `placeAll`: replace the `continue` with `{ removeSurface(document, surface.name); continue }`.

### B. A `standsOn` re-read racing a navigation
Carried from reviews 8 and 9. What would confirm it: a recording in #99 of the DOM mutations around a period change.

### C. Firefox's data declaration, and Firefox for Android
Carried from review 9. What would confirm it: `addons-linter` on the Firefox build, or a decision at #100 not to mark the listing Android-compatible; the alternative is `gecko_android: { strict_min_version: '142.0' }`.

### D. `cf-connecting-ip` is trusted from any client
Carried. What would confirm it: whether the origin accepts traffic from outside Cloudflare's ranges (`docs/deploy.md`).

### E. The popup's storage calls may throw
Carried. What would confirm it: #101, in Firefox with cookies and site data blocked.

### F. Studio redrawing the Views heading's `h3` alone, to another spot in the cell
Carried from review 9. What would confirm it: #99's mutation recording of a Content list re-sort. If it happens, re-place when `pill.previousElementSibling !== wordLine`.

### G. A Chrome binding that throws synchronously in `addHostAccessRequest`
Carried from review 9. What would confirm it: #101, or Chrome's binding schema.

### H. A middle-click in Firefox sending `extension_popup_web_app_opened` twice
Carried from review 9. What would confirm it: #101, middle-click "Open Stillstats" in Firefox and count relay hits.

## Reviewed and Dismissed
- **"`repro/review-9-placer.test.ts` was never executed"** (finder) — it sits outside the root config's `include` on purpose; `repro/repro.vitest.config.ts` includes `docs/reviews/creator-analytics-4/repro/*.test.ts`, and this review's run of that config ran it green (10 files, 21 tests).
- **The new pre-keep-check takedown could disconnect `held`'s own hosts and defeat the keep check** — every entry's hosts are new elements from that call's `render`, so no two entries share a host, and the takedown runs only when `lastPlaced !== held`. Checked by a finder, and every suite and repro test passes.
- **The card surface and the analytics page could share placer state** — `card.ts:16` and `analytics.ts:71` each call `videoRowPlacer` once per surface factory; no shared `placed` or `lastPlaced`.
- **The no-list sweep takes the Content list down on the analytics page or dashboard** — it removes only the Content list's own `pageHosts`, already detached there.
- **A line state (sign-in) loses its line when the list leaves for one pass with no read out** — it comes back on the next pass from the kept answer with no second read (finder scenario S3); a flicker of one pass, Minor below.
- **A read in flight when the list leaves and comes back before it lands** — it places normally when it lands (finder scenario S4).
- **`review-6.test.ts`'s "another video" row is weaker than the old `hosts()` empty check** — mutations putting back the old figure, then the old line, each turn both rows red; the rewrite is review 9's recommended diff under the Preserved repros decision.
- **`sameRead` duplicates `forThisRead`, and the early another-read takedown repeats the loop's** — real (standard 3) but the rework brief kept the keep check and `sameRead` byte-identical on purpose; the Finding 2 ticket's candidate removes both. Do not touch outside that ticket.
- Reviews 1 to 9's other dismissals stand.

## Minor / nits
- With no re-read out, a list Studio detaches for one pass takes the line and pill down for that pass, and the next pass puts back new elements with no second read (finder scenario S1).
- A read that lands while the list is away is discarded (`content-list.ts:339` returns `'not-found'`), and a second read goes out when the list returns (finder scenario S5); pre-existing at `bedf32b`.
- `token-vault.ts:442` lets a 200 JSON array body through `body === null || typeof body !== 'object'`, though the doc (`:284`) and the error message say "not a JSON object"; Google sends no such body.
- Carried from review 9: `token-vault.ts:450-453` and the wrong-typed 200 fields; the unread `TokenEndpointUnansweredError` message; no relay test against an OpenPanel URL with a path; no quota units for an abandoned YouTube call; `connect.test.ts`'s 503 test timeout; `background-answer.test.ts` and `usage-events.test.ts` without a `// Limits:` header; the four copies of "a synchronous throw becomes a rejection"; and review 8's carried list.

## Test quality
Tests added since `bedf32b`: 10 (3 in `video-row.test.ts`, 3 in `content-list.test.ts`, 2 in `repro/review-9.test.ts`, 2 in `repro/review-9-placer.test.ts`) · red at `bedf32b`: 10, each on an assertion naming a leftover host, none on import · tests rewritten: 2 (`repro/review-6.test.ts`), green at `bedf32b` by design, since `f4175ec` changed only their assertions to #228's rule, and the `bedf32b` version is red there as review 9 reported · tautology shapes: none (expectations are literals, the unit is real, the only fakes are the background `ask` and, in the placer tests, a stand-in `render`) · strengthening and one duplicate: Finding 4. The review 9 repros duplicate their in-suite tests by design. `video-row.test.ts` states its limits in its header. This review adds 4 repro tests, red by design.

## Prior-review closure
Review 9 had four findings, one MEDIUM. Fully fixed: 2. Finding 1 (MEDIUM, the Content list's line on a tab with no video list) by `c4f9e88`, proven by mutation; its fix introduced this review's Finding 1, a LOW regression in the held re-read case. Finding 3 (review 6's stale repro) by `f4175ec`, green and able to go red. Partially fixed: 2. Finding 2 (LOW, placer): both of its executed paths and the rework's row are fixed, but its stated intent ("both rules apply to every placement it still holds") is not, as the remediation's own "Open after the round" note recorded; that open path is this review's Finding 2, and Finding 3 is a second path with the same root cause. Finding 4 (comment hygiene): all 12 entries applied, 3 still short of their code (`studio-boundary.test.ts`, `api-boundary.test.ts`, `app.ts`; entries in Finding 5). None was "resolved" by a comment or doc edit alone. Prior MEDIUM-or-higher findings left partially fixed or untouched: 0.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `2f63331`, and lint stays green with this review's repros (448 files). The preserved repro suite (not in CI) is red 4 of 25 by design: Finding 1's row and Findings 2 and 3's three rows.
- **Commit hygiene:** commit this doc, `repro/review-10.test.ts` and `repro/review-10-placer.test.ts`. The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); the split ticket for the placer (Findings 2 and 3); the #99 walk-through adding a Content list re-sort while watching the line, and a key metric header put back on the analytics page.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM finding; all four CI checks pass, and review 9's one MEDIUM is fixed. Every behaviour finding is LOW and capped on a Studio redraw no fixture shows. Finding 1 is a regression from the last remediation with a four-line fix proven in scratch, worth landing before the PR with Findings 4 and 5 (tests and comments). Findings 2 and 3 are the placer's fourth round of takedown fixes, so they go to one split ticket with its own test matrix, seeded with the candidate proven here, rather than another in-place rewrite. The Confirmed list has shrunk and drifted toward redraw edge cases and hygiene, the pattern of a branch that is converging, not one that is failing.
