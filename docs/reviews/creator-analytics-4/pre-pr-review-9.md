# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `bedf32b` ("creator-analytics#232 Studio extension: the proven LOW findings from the eleventh epic-loop run"), clean tree, no uncommitted or untracked files at review time. Whole branch: 144 files, +24,048 / −176, 397 commits. The only files this review adds are this doc and its two repros, `repro/review-9.test.ts` and `repro/review-9-placer.test.ts`.
**Delta under review:** none. A fresh, whole-branch review (`--fresh`), not delta-scoped to review 8. The commits since review 8 (`5dbebaa`) were read most closely: Nick's re-tests `dec26d2`, `7dc845d`, `187a6a1` and `e380c84` (#229, #230), #231 (`419695a`, merged in `e23359d`) and #232 (`d8baa48`, merged in `bedf32b`).
**Reviewed against:** epic creator-analytics#4 (its spec, user stories and implementation decisions); the #231 and #232 plans and recorded assumptions (`.epic-loop/tickets/231/`, `.epic-loop/tickets/232/`); the re-test commit messages; `CODING_STANDARDS.md` rules 1 to 3; `CONTEXT.md`, ADR 0008, ADR 0013, `README.md` and `docs/deploy.md` as the branch changes them; review 8's Approach decisions, findings, NFIs and dismissals.
**Date:** 2026-10-15
**Reviewer:** 3 code-review agents, 1 tautology-audit agent, plus a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (443 files at review start; 445 with this review's two repros) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green; both production manifests carry `description` |
| Full suite | `CI=1 pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 106 files, 2,250 tests |
| Preserved repro suite | `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | **red**: 10 files, 21 tests, 5 failed. Review 8's `review-8.test.ts` is green now (#232). Review 6's "another period" row is still red (Finding 3, carried). This review's 4 new rows are red by design (Findings 1 and 2) |
| #231: malformed ID token, null body | Agent read of `token-vault.ts`, `fake-google`, `connect.test.ts`, `revenue-consent.test.ts` | holds: a payload that is not JSON or decodes to `null` lands on `google_failed`/`unusable`; a 200 `null` body lands on `google_failed`/`none`, as the #231 plan chose |
| #232: manifest `description`, card-redraw takedown, `standsOn` takedown, Content list line states | Agent read; `apps/extension/.output/*/manifest.json`; finder scratch harnesses on the real `videoRowPlacer` and `contentList` | hold for the paths the ticket names; two placer paths it does not cover stay open (Finding 2, executed) |
| Content list after `e380c84`: no-`h3` read kept and re-placed, `h3` dropped after show, title redraw | Finder scratch scenarios A, D, E, F on the saved fixture | hold: one read, the line, the pill and 30 figures come back with no second read; events once each |
| Content list line when the video list goes | New repro `repro/review-9.test.ts` | red 2 of 2: the line under the page title stays after a move to the Playlists tab and after Studio takes the Videos tab page away (Finding 1) |
| Placer takedowns across two held placements | New repro `repro/review-9-placer.test.ts` | red 2 of 2 (Finding 2) |
| Recommended fixes of Findings 1 and 2 | Applied in a scratch worktree at `bedf32b` under the scratchpad, then removed | Finding 1's fix: `review-9.test.ts` green, `apps/extension/src/surfaces` 7 files, 277 tests green. Finding 2's fix: `review-9-placer.test.ts` and `review-8.test.ts` green, `apps/extension` 20 files, 451 tests green, Biome and `tsc` clean |
| API `ids` filter, event relay, limiter, privacy | Agent read of `routes/videos.ts`, `video-list.ts`, `routes/events.ts`, `event-limit.ts`, `event-relay.ts` | hold, as review 8 recorded |
| Background, cache, 401, popup, first run, host access, manifest | Agent read; 12 extension test files run (171 tests); `tsc` on both extension tsconfigs | hold; test gaps listed under Test quality |
| Attribution of Finding 1 | `git log -S'title.after(line)'`; `git show 5dbebaa:apps/extension/src/surfaces/content-list.ts` | `e380c84` moved the line out of the video list to after Studio's page header; at `5dbebaa` both page elements sat inside `ytcp-video-section-content#video-list` (`header.after(pageLine)`, `sortControl.before(label)`) |
| Tautology audit | Agent: 13 base-existing test files copied into a scratch worktree at `5d4457d` (429 tests; 55 red plus 3 files failing import; 7 held-call tests counted red); second run with the branch's fakes and harness swapped in | 12 branch-added or changed tests green at base, each a guard, a finding's proof, a smoke test or a meta-test; see Test quality |
| Docs conformance | Read of the `CONTEXT.md`, ADR, `README.md` and `docs/deploy.md` diffs | match the code, with one wording entry under Comment hygiene |
| Em-dashes in shipped copy | `git diff 5d4457d -- . ':!docs/reviews' ':!pnpm-lock.yaml' ':!apps/extension/test/fixtures' \| grep '^+.*—'` | none; the 44 in the saved Studio fixtures are Studio's own text |
| Live browsers | Not run: no browser in a review | NFIs below; #99, #101, #200 hand checks |

**Repro command for the whole preserved suite:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` from the repo root. This round's repros alone: append `docs/reviews/creator-analytics-4/repro/review-9.test.ts docs/reviews/creator-analytics-4/repro/review-9-placer.test.ts`.

**Overall:** All four CI checks are green at `bedf32b`. #231 and #232 do what they say, and review 8's Findings 1, 2 and 4 are closed. This fresh pass confirmed one MEDIUM and three LOWs plus a comment hygiene batch. The MEDIUM is new, from Nick's Content list re-test: the line under Studio's page title now lives outside the video list. When the creator moves to a tab with no video list, such as Playlists, the line stays and still dates figures that are gone. Its fix is five lines in the Content list's sweep, proven in scratch. The LOWs are two placer paths #232 left open (both need a Studio redraw no fixture shows), and review 6's preserved repro, still red as review 8 found it. Fix Finding 1 before the PR opens; the rest can land with it or follow.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept (dismissed since review 1). Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock, for every surface whatever its `isOn` says. Unchanged; Finding 1 uses it.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list page elements (#219, #226, #230, amended by `e380c84` and #232):** the line goes directly after Studio's page header (`pageTitleIn`, a child of `ytcp-content-section#video-list`), and the pill's anchor directly after the Views heading's `h3` (`viewsWordLineIn`), never inside it. A page without the title shows nothing; a page without the `h3` shows no figure and no pill, and a line state still shows its line; a no-`h3` answer with figures is read once, kept as `'shown'` with no hosts, and re-placed with no second read when the `h3` returns (#232 assumptions 2, 3 and 7). The page elements come down together.
- **Content list page elements once the video list goes (review 9 F1, new):** the Content list's `sweep` takes the page elements down whenever `videoListIn(document)` finds no list, on every page. Precedent: the sweep's existing `takeDownPage()` for a list drawn with no rows (`content-list.ts:244-245`, the `else takeDownPage()` at `:245`), and the sweep's run on every tick whatever `isOn` says.
- **Analytics placement and not-found (#225, review 6 F1, #228, #229):** a pass that misses the key metric header or card calls `removeSurface(document, 'analytics')` and answers `not-found`. The line needs only the header and card and goes directly before the card; the figure needs Studio's Views number too and comes on the pass that finds it (`standsOn`). A read answer shown with no Views number answers `not-found` (#228 assumption 1). Unchanged.
- **Analytics placement across a redrawn anchor (review 8 F1, #232; amended by review 9 F2):** before it reads, the placer judges both its placement held by this `after` element and its last placement, `lastPlaced`. Either one for another video, window or period has all its hosts taken down; either one for the same read that was shown on another `standsOn` element has its `standing` hosts (the figure) taken down, and the line stays until the read lands. Precedent: #232's `held ?? lastPlaced` and `held.standing` takedowns at `video-row.ts:138-156`, widened from one entry to both.
- **Analytics placement, the last placement before the keep check (review 9 F2 rework, new):** a `lastPlaced` entry for another video, window or period that this `after` element does not hold has its hosts taken down before the keep check, so a kept placement (one with no hosts, say) cannot leave another read's line up; the keep check and `sameRead` are unchanged. One helper, `forThisRead`, judges "this read" for the new line and the loop. The same-read `standing` rule still runs only after the keep check (open, see the remediation section). Precedent: the loop's own another-read takedown, moved ahead for `lastPlaced` only.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link. Unchanged.
- **Preserved repros (review 6 F3, amended by review 8 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions, unless a later ticket changed the rule on purpose in a recorded assumption. Then the repro's assertion follows that ticket's in-suite test, and the repro keeps its name and intent. Unchanged.
- **Google call bound (#214, #216, #222, #227, #231):** one per-call bound, `googleCallTimeoutMs` (10 s). A code exchange Google answers that the consent cannot use, including an ID token that names no subject or does not parse, lands on `google_failed` with `answer: 'unusable'`; a 200 whose body is not a JSON object is no answer, `answer: 'none'` (#231 plan). Unchanged.

## Confirmed Issues

### 1. Once the creator leaves the Content list's videos for a tab with no video list, such as Playlists, the line under Studio's page title stays and still dates figures that are gone — MEDIUM
- **Location:** `apps/extension/src/surfaces/content-list.ts:228-233` (the `sweep`), with the placement at `:170` (`title.after(line)`)
- **Attribution:** introduced by `e380c84` ("creator-analytics#230 re-test: the day in a line under Channel content, a small engaged views pill under Views"). At `5dbebaa` both page elements sat inside the video list, `ytcp-video-section-content#video-list` (`header.after(pageLine)` for a line state, `sortControl.before(label)` for the label), so a tab page Studio took away took them with it. `e380c84` moved the line to after `ytcp-content-section#video-list > ytcp-entity-page-header`, which in the saved fixture is a sibling of the tab page (`ytcp-video-section`), not inside it.
- **Real-world trigger:** the creator, on Content > Videos with figures showing, clicks the Playlists, Posts or Podcasts tab. Those URLs (`/videos/playlists` and so on) fail `isContentList` (`studio-url.ts:8` allows `upload`, `short` and `live` only), so the watch never places the Content list there (`watch.ts:199`), and nothing else takes the line down. Studio keeping its section header across tabs is what the saved fixture's structure shows, not yet watched live. Downgrade to LOW if #99 shows Studio redrawing the "Channel content" header on a tab switch.

**Evidence**
```ts
sweep(document, passAgain) {
  const list = videoListIn(document)
  const rows = list ? videoRowsIn(list) : []
  dropChangedRows(rows)
  const empty =
    list !== null && tableHeaderIn(list) !== null && !rows.some((row) => rowIdOf(row))
```
With no list, `empty` is false and the sweep returns; `place` returns `'not-found'` before any takedown when `!list || !header` (`:274-275`), and is not called at all off the Content list's URLs.

**Failure mode** — figures shown, then a move to `/videos/playlists` with the tab page replaced, or the tab page removed on the same URL: the row figures and the pill go with the list, and the line "Data from Stillstats as of 7 Oct." stays under "Channel content". A line state's line (sign-in, connect, refusal) stays the same way, with its link. Executed: `repro/review-9.test.ts`, red 2 of 2, `expected [ <div …(1)></div> ] to deeply equal []`.

**Recommended fix**
```diff
     sweep(document, passAgain) {
       const list = videoListIn(document)
-      const rows = list ? videoRowsIn(list) : []
+      if (!list) {
+        emptySweeps = 0
+        takeDownPage()
+        return
+      }
+      const rows = videoRowsIn(list)
       dropChangedRows(rows)
-      const empty =
-        list !== null && tableHeaderIn(list) !== null && !rows.some((row) => rowIdOf(row))
+      const empty = tableHeaderIn(list) !== null && !rows.some((row) => rowIdOf(row))
```

**Remediation brief**
- **Design intent:** the Content list's page elements, the line under the title and the pill in the Views heading, belong to the rows and come down together. Since `e380c84` only the line lives outside the video list; the pill and the row figures are inside it and leave with it. `sweep` runs on every scheduled tick for every surface whatever `isOn` says (`watch.ts:241-254`), so it is the one place that sees a tab the Content list does not run on. When the list comes back on the same navigation, the kept branch of `place` re-places from the kept answer with no second read, because its `pageHosts` are disconnected (`content-list.ts:296-305`).
- **Full surface:** `apps/extension/src/surfaces/content-list.ts:228-233` (the sweep); a new test in `apps/extension/src/surfaces/content-list.test.ts` inside `describe("when the Content list's page elements, the line under the title and the pill in the Views heading, come down", ...)` (`:997`), with both rows of `repro/review-9.test.ts` (a move to `/videos/playlists`, and the tab page taken away on the same URL), plus a row that puts the same list back on the same URL and expects the line again with `readsAsked()` still 1; `CONTEXT.md:180`, the Content list entry, gains: "A tab of Studio's Content section that shows no video list, such as Playlists, shows nothing of the extension's."
- **Must preserve:** the old `list !== null` arm's effect, a sweep with no list resets `emptySweeps` to 0 (kept explicitly in the diff); the rows-taken-away and links-stripped rows that keep the line and pill up during a re-read (`content-list.test.ts:1019-1040`, `:1041`), which keep the list; the empty-tab tests (`:847`, `:1079`, `:1106`, `:1132`); the redraw tests (`:938`, `:952`, `:971`); the drop-after-show and redraw-back tests in `describe('when Studio drops the Views heading or its page title after the figures show', ...)` (`:1467`); the comment above `sweep` (`:226-227`), still true.
- **Do not touch:** `place`'s guard at `:270-275` (finder B2's "gate the read on the title only" is Dismissed below, #232 assumption 2); `watch.ts`'s `isOn` skip at `:199`, which NFI A owns for the other surfaces.
- **Proof:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-9.test.ts` is red 2 of 2 now and green 2 of 2 with the fix (checked in scratch), with `CI=1 pnpm exec vitest run apps/extension/src/surfaces` green (277 tests). The fix's own failure: a Studio redraw that detaches the whole list for a pass takes the line down and the next pass puts it back from the kept answer; a line state kept past `signedInReadKeptMs` reads again instead, as any kept line does.

### 2. The placer judges only one of its two held placements, so two Studio redraws keep an old analytics line or figure up while the next read is out — LOW (capped)
- **Location:** `apps/extension/src/surfaces/video-row.ts:138-156`
- **Attribution:** introduced on this branch: `a0019e9` (#229) put the analytics line outside the card, and #232 (`d8baa48`) closed the common path (a redrawn card) with `held ?? lastPlaced` and the `standsOn` takedown on `held` only. Both paths below predate #232 and are narrower since.
- **Real-world trigger:** (a) Studio puts back an earlier key metric card's header element for an earlier video after showing another; (b) Studio draws a new `#key-metric-header` and drops the Views number row in the same render, same video and period. Neither appears in any fixture or report. Capped at LOW: upgrade to MEDIUM if #99's mutation recording shows either.

**Evidence**
```ts
const before = held ?? lastPlaced
if (before && !(before.videoId === videoId && before.window === window && before.periodLabel === periodLabel)) {
  for (const host of before.hosts) host.remove()
}
if (held?.placement === 'shown' && sameRead && held.standsOn !== standsOn) {
  for (const host of held.standing) host.remove()
}
```
The doc comment at `:53-55` says it "takes down the last elements it placed when they are for another video", but with a `held` entry for this element, `lastPlaced` is never looked at.

**Failure mode** — (a) X placed on card A, Y on new card B, then A put back for X: `held` is A's same-read entry, so Y's line, with "View this video in Stillstats" for Y, stays during X's read. (b) a new header (`held` undefined) and no number row: `lastPlaced` is the same read, and the `standsOn` check reads `held` only, so the figure stays in the tile beside no number. Executed: `repro/review-9-placer.test.ts`, red 2 of 2 (`expected [ 'line:YYYYYYYYYYY' ] to deeply equal []`; `expected [ 'line:XXXXXXXXXXX', …(1) ] to deeply equal [ 'line:XXXXXXXXXXX' ]`).

**Recommended fix** — keep the two existing comments above the new loop, merged in their current order:
```diff
-    const before = held ?? lastPlaced
-    if (
-      before &&
-      !(
-        before.videoId === videoId &&
-        before.window === window &&
-        before.periodLabel === periodLabel
-      )
-    ) {
-      for (const host of before.hosts) host.remove()
-    }
-    if (held?.placement === 'shown' && sameRead && held.standsOn !== standsOn) {
-      for (const host of held.standing) host.remove()
-    }
+    for (const before of new Set([held, lastPlaced])) {
+      if (!before) continue
+      const sameAsBefore =
+        before.videoId === videoId && before.window === window && before.periodLabel === periodLabel
+      if (!sameAsBefore) for (const host of before.hosts) host.remove()
+      else if (before.placement === 'shown' && before.standsOn !== standsOn)
+        for (const host of before.standing) host.remove()
+    }
```

**Remediation brief**
- **Design intent:** `videoRowPlacer` holds placements by the Studio element they are held by (`placed`, a WeakMap keyed on `after`) and remembers its last one (`lastPlaced`). Before any read, nothing it placed for another video, window or period stays up, and a shown figure whose `standsOn` element changed comes down while the line stays (#228, #232). Both rules apply to every placement it still holds, not only the one this element holds.
- **Full surface:** `apps/extension/src/surfaces/video-row.ts:138-156` only; `sameRead` (`:127-128`) stays for the keep check. Add both rows of `repro/review-9-placer.test.ts` as suite tests in `apps/extension/src/surfaces/analytics.test.ts` beside "a change of period while the background answers never draws the old period's figure or link" (`:418`), on the saved fixture where it can show them, or keep them as placer-level tests; either way named for the rule.
- **Must preserve:** the keep check (`:129-137`); the `held` same-read `standsOn` takedown (#232 item 3, `describe('when Studio takes its Views number away after the figure shows', ...)` at `analytics.test.ts:791`); the line staying during the read (`"a sign-in line stays up while Studio's Views number is gone for a moment on the same page"`, `:769`); the redraw tests at `:381`, `:398`, the in-place period tests at `:353`, `:418`; every `card.test.ts` test (the card is the placer's only other caller and places once per page); `repro/review-8.test.ts` green.
- **Do not touch:** `analytics.ts`'s not-found rules (#228, Dismissed); `removeSurface(root, surface)` after the read (`:174`).
- **Proof:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-9-placer.test.ts docs/reviews/creator-analytics-4/repro/review-8.test.ts` is red 2 of 4 now and green 4 of 4 with the fix (checked in scratch), with `CI=1 pnpm exec vitest run apps/extension` green (20 files, 451 tests).

### 3. Review 6's preserved repro is still red since #228 changed its rule on purpose — LOW
- **Location:** `docs/reviews/creator-analytics-4/repro/review-6.test.ts:80-99`
- **Attribution:** review 8's Finding 3, untouched: no ticket carried it into #231 or #232. Introduced by `b29b02b` ("creator-analytics#228 Studio extension and API: the proven LOW findings from the tenth epic-loop run"), whose recorded assumption 3 changed the in-suite twin (`apps/extension/src/surfaces/analytics.test.ts`, "another period" now expects no figure and only the new period's line, `window=last7`) and left the preserved repro asserting `[]`.
- **Real-world trigger:** none for users; the preserved suite is the remediation loop's red-before-green record, and a red row with no live finding behind it reads as an open regression.

**Evidence**
```ts
['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week')],
...
expect(hosts()).toEqual([])
```
Received this run: one host, the new period's line linking `window=last7`. That is #228's rule, not review 6 F1 regressing.

**Recommended fix** — as review 8 wrote it:
```diff
 test.each([
-  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week')],
-  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA')],
+  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week'), ['last7']],
+  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA'), []],
 ])(
   'finding 1: a move to %s while Studio has not drawn the Views number leaves nothing of the page before',
-  async (_, next) => {
+  async (_, next, windowsUp) => {
 ...
-    expect(hosts()).toEqual([])
+    expect(document.querySelector('#EXTERNAL_VIEWS-tab [data-stillstats-surface="analytics"]')).toBeNull()
+    expect(
+      hosts().flatMap((host) =>
+        [...(host.shadowRoot?.querySelectorAll('a') ?? [])].map((link) =>
+          new URL(link.href).searchParams.get('window'),
+        ),
+      ),
+    ).toEqual(windowsUp)
   },
 )
```

**Remediation brief**
- **Design intent:** the preserved repros are each finding's red-before-green proof, kept runnable. Per the Preserved repros Approach decision, a repro whose rule a later ticket changed on purpose follows that ticket's in-suite test, keeping its name and intent (nothing of the page before stays).
- **Full surface:** `docs/reviews/creator-analytics-4/repro/review-6.test.ts:80-99` only. Leave the header comment.
- **Must preserve:** the "another video" row's outcome (nothing up); the setup (`#metric-total`'s row removed before the move); the in-suite rows in `analytics.test.ts` it mirrors.
- **Do not touch:** `analytics.ts`; the rule is #228's recorded decision (see Dismissed).
- **Proof:** `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` red 1 of 2 now, green 2 of 2 after. Mutation check: with the figure's takedown removed, the first new assertion goes red. Run `pnpm lint` after, since Biome checks the repro folder.

### 4. Comment hygiene — LOW (aggregated)
- **Attribution:** the first seven entries are review 8's Finding 5, untouched since (no ticket carried them); the rest are introduced on this branch.
- `apps/extension/test/studio-boundary.test.ts:35-38` — "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `.href` and attribute-value selectors are not matched." → "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel` and other `aria*` properties, `.className`, `.text`, `.label`, `outerText`, `getAttribute` (how the selectors read a link's href, which the file's header trusts) and attribute-value selectors are not matched."
- `apps/api/src/app.ts:250-251` — "No status, no error and no token: the vault keeps the error, whose message may carry identifiers, and answers only the refusal and what Google answered." → "No status, no error and no token: the vault answers only the refusal and what Google answered, never the error, whose message may carry identifiers."
- `packages/token-vault/src/token-vault.ts:282-284` — "no connection, no answer or no full body within the bound, or a 5xx." → "no connection, no answer or no full body within the bound, a 200 whose body is not a JSON object, or a 5xx." `requestToken` throws it for that 200 at `:442-447` since #231.
- `apps/extension/test/api-boundary.test.ts:3-5` — "a static `import` of the client, not an aliased fetch or an `export ... from` re-export." → "a static `import` of the client written `'…/product-api.ts'`, not an extensionless, `.js`, double-quoted or dynamic import, an aliased fetch, or an `export ... from` re-export."
- `apps/extension/src/product-api.ts:107` — the comment "Only a signed-in read is kept: a creator who has just signed in sees it on the next read." sits over `isFresh` → move it, unchanged, to directly above `keptChannels = read.state === 'signed-in' ? ...` at `:143`.
- `apps/extension/src/surfaces/card.ts:45-46` — keep "A format read with no answer is asked again, as a line is: see `videoRowPlacer`." and move the second sentence, reworded "A format read counted to an earlier day than the figure that gives no place is asked again too, since a later one can.", to directly above `return comparison === undefined && ...` at `:63`.
- `apps/extension/src/surfaces/watch.ts:23-24` — "Runs on the watch's tick before each pass, on every page" → "Runs on each scheduled tick, before the pass that tick starts, on every page; the give-up's pass and a pass asked for during another run have no sweep before them".
- `apps/extension/src/env.d.ts:2` — "The API this build calls, from `apiOriginOf` in `wxt.config.ts`." → "The API this build calls, written in by `wxt.config.ts` from `apiOriginOf` in `manifest.ts`." `apiOriginOf` is defined at `manifest.ts:9`.
- `apps/extension/src/host-access-request.ts:5-7` — "cannot read the tab's URL without the `tabs` permission" → "cannot read the URL of a tab whose host access is withheld, having no `tabs` permission".
- `apps/extension/src/surfaces/content-list.ts:62-64` — "one whose Views heading has no line holding the word shows no figure and no pill, and a line state still shows its line." → "one whose Views heading has no line holding the word shows nothing of an answer with figures, no line, pill or figure, and a line state still shows its line." `takeDownForNoWordLine` takes the line down too.
- `apps/extension/src/surfaces/video-row.ts:211-213` — the `PlacedEntry` doc comment has a 138-character line left by #232's edit → reflow to the file's 100-column comments, words unchanged.
- `CONTEXT.md:180` — "the Stillstats mark, then \"Data from Stillstats as of 7 Oct.\", with no link, as the analytics page's line does." → "the Stillstats mark, then \"Data from Stillstats as of 7 Oct.\", the words the analytics page's line opens with, and no link." The analytics line carries "View this video in Stillstats".

## Needs Further Investigation

### A. A surface whose page the URL leaves keeps its hosts — confirm in #99
Carried from reviews 1 and 8. `watch.ts:199` skips a surface whose `isOn(here)` is false, and analytics and the card have no `sweep`. Finding 1 closes the Content list's line; the analytics page's Overview to Reach or Engagement move and the dashboard card are still open. What would confirm it: #99, on a video's analytics page, switch Overview to Reach and look for the figure and line. If either stays, the fix is in `placeAll`: replace the `continue` with `{ removeSurface(document, surface.name); continue }`.

### B. A `standsOn` re-read racing a navigation
Carried from review 8 (its C). A shown figure whose number row Studio redraws reads again; #232 now takes the figure down first on the same element, and Finding 2 widens that to a redrawn header. What remains: a URL move during that read with the old line up for one read. What would confirm it: a recording in #99 of the DOM mutations around a period change.

### C. Firefox's data declaration, and Firefox for Android
Carried from review 1. Settle the `data_collection_permissions` category at #100 with AMO. New this round, unverified: `strict_min_version: '140.0'` (`manifest.ts:50-63`) also binds Firefox for Android, where a finder believes `data_collection_permissions` arrives at 142. What would confirm it: run `addons-linter` on the Firefox build, or decide at #100 not to mark the listing Android-compatible; the alternative fix is `gecko_android: { strict_min_version: '142.0' }`.

### D. `cf-connecting-ip` is trusted from any client
Carried from review 8 (its F). Analytics pollution only. What would confirm it: whether the origin accepts traffic from outside Cloudflare's ranges (`docs/deploy.md`).

### E. The popup's storage calls may throw
Carried from review 8 (its G). What would confirm it: #101, in Firefox with cookies and site data blocked, open the popup and watch the console.

### F. Studio redrawing the Views heading's `h3` alone, to another spot in the cell
A finder showed (scratch scenario D) that an `h3` replaced and appended at the end of the heading cell leaves the pill connected before it; the kept branch re-places only on a disconnected host (`content-list.ts:298-300`), so the pill's zero-width anchor no longer follows the word. What would confirm it: #99's mutation recording of a Content list re-sort. If it happens, re-place when `pill.previousElementSibling !== wordLine`.

### G. A Chrome binding that throws synchronously in `addHostAccessRequest`
`host-access-request.ts:31-35` catches each tab's rejection, but a synchronous throw from `map`'s callback stops the later tabs and is swallowed by `askQuietly`. Whether Chrome throws synchronously for a valid numeric `tabId` is unverified. What would confirm it: #101, or Chrome's binding schema. The fix shape would be `Promise.resolve().then(() => addHostAccessRequest({ tabId })).catch(() => {})`, but note the popup's `requestAccess` keeps its call synchronous on purpose, and this one has no click to keep.

### H. A middle-click in Firefox sending `extension_popup_web_app_opened` twice
`dom.ts:32-38` listens to `click` and `auxclick`. If Firefox 140 dispatched both for a middle button on an element, the event would send twice. What would confirm it: #101, middle-click "Open Stillstats" in Firefox and count relay hits.

## Reviewed and Dismissed
- **A token endpoint 200 whose body is `null` is an outage (`answer: 'none'`), not `unusable`** — the #231 plan's chosen mechanism ("`requestToken` throw `TokenEndpointUnansweredError` for a 200 body that is not an object, so `completeConsent` takes the existing outage path"), extending the older "a 200 whose body is not JSON is no answer" rule; pinned by `token-vault.test.ts`. Its log reads "did not answer a call", the wording #222 and #228 specified.
- **A Content list page with no Views heading cell shows no line state and reads nothing (`content-list.ts:270-275`)** — #232 assumption 2 keeps the Views heading as a gate for line states on purpose ("Keeping the Views heading follows item 5's 'the line states on the heading only'"). Not a defect; do not move the gate to the title alone.
- **A no-`h3` answer is kept as `'shown'` even when no row would show a figure (`content-list.ts:351-353`)** — #232 assumption 7, so a page waiting on Studio's `h3` is not re-read every pass; the kept branch recomputes the placement once the `h3` returns.
- **A `lastPlaced` entry whose hosts are already detached** — `remove()` on a detached node does nothing; executed by a finder.
- **The relay switches off silently when only some `OPENPANEL_*` variables are set (`server.ts:49-59`)** — documented: `docs/deploy.md:70`, "all three or none; with any unset the relay sends nothing".
- **A 200 in flight when another read's 401 clears the caches is written back (`product-api.ts:143`, `:179`)** — dismissed since review 1, in the Session cache Approach decision.
- **The analytics page reports `extension_surface_missing` while a read answer's line is up and the Views number is missing (`analytics.ts:118`)** — #228 assumption 1, on purpose.
- **The popup's failed channel read shows only "Open Stillstats"** — #106's recorded decision.
- **The outage log says "did not answer a call" for a 5xx Google did answer** — the wording #222 and #228 specified.
- **A token endpoint 4xx other than `invalid_grant` ends on a raw 500** — carried nit from reviews 6 to 8.
- **No CORS middleware** — nothing is opened; the background's requests are same-site by host permission.
- **The `ids` filter, the event relay's validation and the limiter** — checked and holding.
- Reviews 1 to 8's other dismissals stand.

## Minor / nits
- `token-vault.ts:450-453` destructures a non-2xx body that parses to JSON `null` (`const { error } = ...`), which throws a `TypeError` and a raw 500; pre-existing at `5d4457d:packages/token-vault/src/token-vault.ts:398`, and Google sends no such body.
- `token-vault.ts:264-265`, `:290`, `:721-729`: a 200 JSON object with wrong-typed fields (`id_token: 123`, `scope: 5`, `refresh_token: 1`, no `expires_in`) on a code exchange still throws or stores an invalid value; the refresh-side twin is #231's proposal.
- The message on `TokenEndpointUnansweredError` for a 200 non-object body (`token-vault.ts:443-446`) is never read: `completeConsent` maps it to `answer: 'none'` and the gateway logs a fixed string.
- No test drives the event relay against an OpenPanel API URL with a path (`apps/api/test/fake-openpanel.ts`); `event-relay.ts`'s join reads right for one.
- A YouTube call the 10 s bound abandons records no quota units (`youtube-gateway.ts:241-243`); pre-existing for network errors, more routine with the bound.
- `connect.test.ts`'s 503 test passes `googleCallTimeoutMs: 500` although the fake answers at once.
- `background-answer.test.ts` and `usage-events.test.ts` have no `// Limits:` header (standard 2, "a test states its own limits"); they cannot see `entrypoints/background.ts`'s wiring, which #101 covers.
- Standard 3, walked past on the branch's own path: "a synchronous throw becomes a rejection" is written four ways (`popup-page.ts:71-77`, `popup-link.ts:11-15`, `popup.ts:141-145`, `surfaces/line-clicks.ts:18-24`); test helpers are copied between files (`popupStorage`, `recordingAsk`, `auxClick`, `failureModes`); `product-api.ts:74-86` has three near-identical guards.
- Carried from review 8: `POST /api/events` has no body-size limit; `routes/videos.ts:49` accepts an id of any length; an `unusable` exchange carrying a refresh token leaves the grant unrevoked; freshness uses `Date.now`; concurrent cold reads each fetch `/api/channels`; two overlapping popup `show()` runs could both send the held click; `tabs.onUpdated` wakes the Chrome service worker on every tab load; the analytics selectors take the first document match; a long-lived tab's "Through <day>" does not refresh; during a read for a new Content list page, the outgoing page's line stays (same channel, same day).

## Test quality
Tests in the 13 base-existing test files the branch adds to or changes: 429 run at `5d4457d` · red at base: 55, plus 3 files that fail to import (`events.test.ts`, `event-relay.test.ts`, `site.test.ts`); the 7 held-call tests hang at base (`googleCallTimeoutMs` absent) and are counted red · a second run with the branch's fakes and harness swapped in kept every red API and vault test red, so they are red for the product code, not the fakes · branch-added or changed tests green at base: 12 · tautology shapes: 1 mild, 1 weak pattern. The extension's 22 test files are new and red at base by construction.

The 12: `channels.test.ts:61` (2, declared regression guards, `f9b5333`); `connect.test.ts:141` (2) and `:303` (#228's log-guard proofs, `b29b02b`); `video-list.test.ts:1818` (ordering guard, `0b1c7cd`) and `:2214` (#206 proof, `d7e873e`); `video-list.test.ts:2482` (labelled smoke test, `0fa5357`, flaky at base: red in 3 of 6 isolated runs); `scopes.test.ts:630`, `:641` (harness edge cases, `0fa5357`); `seed-ids.test.ts:45`, `:58` (meta-tests). None needs deleting.

Shapes: `apps/web/src/consent.test.ts:46-50` takes its expectation from the constant the production code spreads (Dismissed in review 8; the words are pinned in `first-run.test.ts:239-241`; pinning the three #56 strings here as literals would close it). `connect.test.ts:152-154` and `:317-319` assert only that an exact log message is absent, which a renamed message passes for free; assert that the refusal writes no error-level line instead. `host-access.test.ts:44-50` is call-shaped (its rule is a call fact: the request is the click's first synchronous call); `:52-61` tests a manifest with no host origins, which the built manifest never is.

Gaps, each grep-checked: no test pins that a 401 from `sendEvent` leaves the kept reads in place (`product-api.test.ts`, carried from review 8); no `renderPopup` test drives the signed-out popup's sign-in click through to `extension_popup_sign_in_clicked` on a signed-in render (`popup-page.ts:64`, `:95`; `git grep renderPopup` finds only the access-prompt tests in `popup-page.test.ts`); no test shows a `refused`, `channel-not-in-stillstats`, `signed-out` or `failed` video read is not kept (`product-api.ts:179`); `malformIdToken('null')` and `answerTokenEndpointWithNull()` reach only the vault tests, not the callback's landing and log line; the `'null'` payload test cannot tell the `claims && typeof claims === 'object'` guard from the `try` (`token-vault.ts:268-269`), a primitive payload such as `5` would; no test removes the `h3` before the first read and then restores it, the after-read branch at `content-list.ts:351-353` (a finder's scratch scenario shows it holds: one read, 32 hosts back). Review 6's notes stand.

## Prior-review closure
Fresh round, not delta-scoped. Review 8 had five findings, none MEDIUM or higher. Fully fixed: 3. Finding 1 (a redrawn card's old line) by #232 `d8baa48`, its repro `review-8.test.ts` green; Finding 2 (manifest `description`) by #232, both production builds carry it; Finding 4 (malformed ID token, `null` body) by #231 `419695a`. Untouched: 2. Finding 3 (review 6's stale repro) is Finding 3 here; Finding 5 (comment hygiene) is the first seven entries of Finding 4 here, the token vault's entry now one case further out of date. None was "resolved" by a comment or doc edit alone. Review 8's NFI B (a header replaced alone) is closed by #232's `lastPlaced`, except the path Finding 2(b) shows.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `bedf32b`, and lint stays green with this review's repros. The preserved repro suite (not in CI) is red 5 of 21: one row is Finding 3, four are this review's Findings 1 and 2.
- **Commit hygiene:** commit this doc, `repro/review-9.test.ts` and `repro/review-9-placer.test.ts`. The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); #231 and #232 closing with this branch; the copy awaiting Nick's approval; the Content list's new line and pill in the #99 walk-through, including a tab switch to Playlists (Finding 1); NFI C before the AMO submission.

## Verdict
**Ready to open the PR once Finding 1 is fixed.** No CRITICAL or HIGH defect; all four CI checks pass. The gate is Finding 1: it is introduced on this branch, visible to any creator who switches Content list tabs, and a five-line fix proven in scratch. Finding 2 (capped LOW until #99 shows the redraw) and Finding 3 (a stale preserved repro) are small and worth fixing in the same pass; Finding 4 is one comment commit. The NFIs belong to #99, #100 and #101.

## Remediation: 2026-10-15
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `c4f9e88` creator-analytics#4 pre-PR review 9 finding 1: the Content list's line under the page title stays once Studio shows no video list | red→green: `CI=1 pnpm exec vitest run apps/extension/src/surfaces/content-list.test.ts` (3 new tests: Playlists move, tab page taken away, tab page put back with one read) and the review-9.test.ts repro (2 of 2); `apps/extension/src/surfaces` 7 files, 280 tests green | 0 | fixed (disprove agent: 5 scratch probes, including a read in flight while the list goes and comes back) |
| 2 (LOW) | `9f3df76` creator-analytics#4 pre-PR review 9 finding 2: the placer judges only one of its two held placements before it reads; rework `a81583d` creator-analytics#4 pre-PR review 9 finding 2 rework: judge the last placement before the keep check | red→green: `CI=1 pnpm exec vitest run apps/extension/src/surfaces/video-row.test.ts` (new placer-level file, 3 tests: the review-9-placer.test.ts rows plus the rework's row); repro review-9-placer and review-8 4 of 4; `apps/extension` 21 files, 457 tests green | 9f3df76: 0 in product code, 1 `// Limits:` header in the new test file (standard 2); a81583d: 2 lines, the existing "another video's or period's numbers" comment moved and reworded to the line it now describes | 9f3df76 half-fixed (case (a) stayed open when the put-back card's held placement passes the keep check); after rework: fixed |
| 3 (LOW) | `f4175ec` creator-analytics#4 pre-PR review 9 finding 3: review 6's preserved repro still asserts the rule #228 changed | red→green: `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` (1 of 2 red, then 2 of 2). The brief's mutation check was not run. | 0 | proved by execution |
| 4 (LOW, comment hygiene) | `f6ec9bf` creator-analytics#4 pre-PR review 9 finding 4: comment hygiene | all 12 entries applied; each checked by reading the code it describes (the `pageRead` regex, `requestToken`'s 200 throw, the import scan regex, `wxt.config.ts`'s `define`, `takeDownForNoWordLine`) | corrections only | excluded from verify |

**Whole tree after the round:** `pnpm lint` (446 files), `pnpm typecheck`, `pnpm build` and `CI=1 pnpm test` (107 files, 2,256 tests) green at `a81583d`; the preserved repro suite `CI=1 pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` green, 10 files, 21 tests.

**Open after the round (not introduced here, outside the reworked diff):** the scoped re-verify found that the placer's same-read `standing` rule still runs only after the keep check. If header H1 holds a hostless placement for video X (a read that did not answer X), Studio then draws H2 and N2 and X's figure shows on N2, and then Studio puts H1 and N1 back while the read is out, the placer returns `'placed'` from H1's kept entry with no read, and X's figure stays beside N1. The figure is X's own, so this is not the stale-video defect, but it goes against Finding 2's design intent ("both rules apply to every placement it still holds"). The code path is the same as at `9f3df76`. Verifier's proposed fix, not run: before the keep check, `if (lastPlaced && lastPlaced !== held) { if (!forThisRead(lastPlaced)) remove its hosts; else if (lastPlaced.placement === 'shown' && lastPlaced.standsOn !== standsOn) remove its standing hosts }`. Not applied, because it is larger than one line and the round's one rework pass is spent. Capped LOW like Finding 2: no fixture shows the redraw (#99).

### Known regressions, deferred
- None. Neither verify pass reported a defect introduced by this round.

### Rework briefs
- Finding 2 rework (`a81583d`). **Achieve:** before the keep check can return, a `lastPlaced` entry for another video, window or period that this element does not hold has all its hosts taken down. **Preserve:** the keep check and `sameRead` byte-identical; a kept held placement still returns with no read; the loop's two rules; the card surface (one call per pass, no `standsOn`). **Proof:** a new `video-row.test.ts` row (the earlier card drew nothing, the later video shows, the earlier card is put back) red before and green after, with `apps/extension` green.
