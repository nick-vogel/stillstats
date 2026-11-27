# Pre-PR review: creator-analytics#1108 Extension redraw timing

**Branch:** `creator-analytics-1108-extension-redraw-timing` vs `origin/main` (merge-base `14264dea`, "Merge pull request #1121 from nick-vogel/release-2026.11.24.1")
**Reviewed at:** HEAD `0a24108c` (creator-analytics#1108 format the mutant runner), pushed, 0 files with uncommitted changes, 0 untracked files; vs `$BASE` 11 files, +1124 / −18
**Reviewed against:** issue `nick-vogel/creator-analytics#1108`, the briefs and Approach decisions in `docs/reviews/creator-analytics-1037/pre-pr-review-3.md` (findings 1, 2, 3 and Needs Further Investigation A), `docs/reviews/creator-analytics-1108/mutation-run.md`, the global rules in `~/.claude/rules/`, and the repo rules in `.claude/rules/` (`youtube-test-limits`, `row-level-security-tests`). The repo has no `AGENTS.md` or `CLAUDE.md`.
**Date:** 2026-11-25
**Reviewer:** Gemini through Antigravity (Gemini 4 Neon) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Extension unit and surface suite | `pnpm exec vitest run apps/extension` at `0a24108c`, Node 26.3.0 (CI runs 24) | 34 files, 1105 passed |
| Extension typecheck | `pnpm --filter @creator-analytics/extension typecheck` at `0a24108c` | exit 0 |
| Extension build (Chrome and Firefox MV3) | `pnpm --filter @creator-analytics/extension build` at `0a24108c` | exit 0 |
| Lint and format | `pnpm lint` (`biome check .`) at `0a24108c` | 884 files checked, exit 0 |
| Mutant runner pattern integrity | Read-only check of all 39 `find` patterns in `docs/reviews/creator-analytics-1108/mutants.mjs` against `apps/extension/src/surfaces/*.ts` at `0a24108c` | 39/39 unique matches, 0 stale patterns |
| Finding 1 repro | Isolated copy of `apps/extension` in `mktemp -d` running `repro/read-ahead-leave-and-return.case.ts` against `page-watcher.ts` at `0a24108c` | red on all 3 cases: `dashboard` and `playlists` detours after ahead redraw both report `ms: 61450, fromCache: false` (rule: `ms: 0, fromCache: true`); detour after ahead shown reports `ms: 1200, fromCache: false` (rule: `ms: 50, fromCache: true`) |
| Finding 1 recommended fix | Proposed 2-line fix applied to the scratch copy of `page-watcher.ts`; ran the 3 repro cases and all 15 surface test files (`apps/extension/src/surfaces`) | 3/3 repro cases green; 15 files, 734/734 surface tests green (including 54/54 `page-watcher.test.ts`) |
| Finding 2 proof (5 YouTube failed-read guards) | Isolated copy of `apps/extension` in `mktemp -d` running `repro/youtube-failed-read-guards.case.ts` at HEAD `0a24108c` and again with the 5 exact mutants (`WP-guard`, `SH-tiles-guard`, `SH-player-guard`, `FD-guard`, `CP-guard`) from `mutants.mjs` | 5/5 green at HEAD (`ms: 25350, fromCache: false`); 5/5 red under their mutants (`ms: 30100, fromCache: false`) |
| Finding 3 proof | Isolated copy of `content-list.test.ts` replacing `ms: expect.any(Number)` at `:1976` with `ms: expect.toSatisfy((ms: number) => ms < 1_200)` | passes at HEAD (`ms: 250`) |
| Em-dash check in added lines | `git diff 14264dea -- apps/ docs/` added lines checked for `—` and `–` | none |
| Tautology audit against `$BASE` checkout | Not run | Non-Claude review run keeps `git worktree add` out of the run; all 30 new test cases inspected by reading against the four tautology shapes and `tests-can-go-red` instead |
| Root `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm run test:browser` | Not run | Branch changes only `apps/extension/src/surfaces/*` and `docs/reviews/creator-analytics-1108/*`; extension suite, typecheck, build and repo lint all ran and passed |

**Overall:** The branch closes #1108's Content list kept-branch waits (review 3 finding 1 plus the heading/title and ahead-flag waits), the ahead-pass redraw record (review 3 finding 3), the move-away-and-back leak on `nav.redrawn` (Needs Further Investigation A), and 34 of the 39 redraw mutants. Two MEDIUM gaps remain: `readAhead` has the exact symmetric leak to Needs Further Investigation A when the browser leaves an ahead URL without WXT reporting and later navigates there (widened by `3be4e3b3` into an unbounded `ms` inflation across minutes on another page), and the five YouTube failed-read guard mutants (`WP-guard`, `SH-tiles-guard`, `SH-player-guard`, `FD-guard`, `CP-guard`) that `mutation-run.md` calls equivalent are observable and killable through `watchPage` with two held channels. Fix finding 1, kill the five guards (or decide explicitly to accept them with an accurate explanation in `mutation-run.md`), tighten the weak `ms` assertion (finding 3), and sweep two stale comments (finding 4) before merging.

## Approach decisions
Carried forward from `docs/reviews/creator-analytics-1037/pre-pr-review-3.md`, binding:
- A redraw is a `Redrawn` answer beside `Cut`, which `placementOf` maps to its `counts`; the watch's per-navigation record lives only through consecutive own-pass redrawn answers, a bare answer ends it, a navigation the give-up hands back starts with none; a finished read-ahead time survives a redraw whole; a pill surface answers redrawn only when `PillsRead.answered`, and a pill page only when every tile was repointed.
- A redraw on a pass ahead of WXT's report notes an open start, flagged `redrawn: true`, in the read-ahead record; a later ahead redrawn answer folds its cache result in, an ahead shown or cut answer closes it, and an ahead bare answer deletes it. A first finished time or unflagged cut start still wins.

Added this round:
- A pass on a URL other than `readAhead.url` clears `readAhead`, mirroring `if (ahead) nav.redrawn.clear()` (`b4383324`), so an abandoned ahead pass on a URL WXT never reported cannot survive to mistime a later navigation to that URL (finding 1).
- The two-channel failed-read fixture is one helper, `failingAcrossTheKeep` in `apps/extension/src/surfaces/testing.ts`, beside `uploadsOf`, which each of the four surface test files calls with its own redraw (remediation, 2026-11-25).
- The five YouTube failed-read guards stay in production code and are pinned by two-channel failed-read redraw tests (one channel fails at once, a second fails after `signedInReadKeptMs` with a redraw halfway), killing all five guard mutants through `watchPage` and bringing the mutant suite to 39/39 (finding 2).

## Confirmed Issues

### 1. Leaving an ahead URL without WXT reporting leaves `readAhead` alive to mistime a later navigation to that URL — MEDIUM
- **Location:** `apps/extension/src/surfaces/page-watcher.ts:343-346` (`placeAll`), interacting with `:379-381`, `:410-419`, and `:443-464` (`noteReadAhead`)
- **Attribution:** Pre-existing, exposed and widened by `3be4e3b3` ("creator-analytics#1108 a redraw on a pass ahead of WXT's report was timed as an instant cache hit") and incomplete beside `b4383324` ("creator-analytics#1108 a redraw's start outlived a move away from its page and back that WXT never reported"). At `$BASE` (`14264dea`), `git show 14264dea:apps/extension/src/surfaces/page-watcher.ts` lines 434-442 already retained `readAhead` only inside `noteReadAhead` (never clearing it on a return to `nav.url` or a move to a URL with no active surface), so a finished ahead `shown` time survived a detour. Commit `3be4e3b3` widened that to open `{ since, fromCache, redrawn: true }` starts, turning a bounded stale `ms` into an unbounded duration covering all time spent on other pages; commit `b4383324` fixed only the `nav.redrawn` half of the symmetric pair (`whole-surface-of-a-change`).
- **Real-world trigger:** In a browser whose content script has no Navigation API (such as Firefox, where WXT polls `location.href` every 1 s), a creator on the Studio dashboard clicks the Content list (an ahead pass runs for `count = navigation + 1` and its read lands redrawn or shown), then immediately clicks Back to the dashboard (or to Playlists, where no surface has `isOn(here) === true`) before WXT's poll notices, so WXT never reports a navigation and `navigation` stays unchanged. Minutes later, the creator navigates to the Content list and stays there: WXT reports `navigated(contentList)` with `nav.count === readAhead.count` and `nav.url === readAhead.url`, `takesOver` matches, and `extension_surface_shown` reports the entire elapsed time since the abandoned visit (plus `fromCache: false`) instead of the real visit's timing. MEDIUM, capped: telemetry only, never a creator's figure, but a wrong number (potentially minutes of inflation) silently delivered to the baseline (#1056) and #555.

**Evidence**
```ts
    const ahead = here !== nav.url
    // The page left the navigation's URL, so a redraw's start before the move times nothing after
    // it, should the URL come back before WXT reports a move.
    if (ahead) nav.redrawn.clear()
    const settledAtStart = nav.settled && !ahead
    ...
    for (const [index, surface] of surfaces.entries()) {
      if (!surface.isOn(here)) {
        if (!ahead) removeSurface(document, surface.name)
        continue
      }
```
When the URL returns to `nav.url` (`ahead === false`), `noteReadAhead` is never called; when the URL moves to a page with no active surface (e.g. Playlists), every iteration hits `continue` and `noteReadAhead` is never called. `readAhead` retains `{ url: contentList, count: navigation + 1, surfaces }` until `navigated(contentList)` later consumes it via `takesOver` at `:379-381`.

**Failure mode** — executed with `docs/reviews/creator-analytics-1108/repro/read-ahead-leave-and-return.case.ts` against HEAD `0a24108c`:
1. Ahead pass on `contentList` waits 1,200 ms and returns `redrawnFrom(false, 'not-found')`; URL leaves to `dashboard` (or to `playlists`, where no surface `isOn`) for 60,000 ms; then URL moves to `contentList` and `watcher.navigated(contentList)` runs, showing at once from cache. Received `ms: 61450, fromCache: false` on both detours; rule is `ms: 0, fromCache: true`.
2. Ahead pass on `contentList` waits 1,200 ms and returns `shownFrom(false)`; URL returns to `dashboard` for 60,000 ms; then `watcher.navigated(contentList)` runs and shows in 50 ms from cache. Received `ms: 1200, fromCache: false`; rule is `ms: 50, fromCache: true`.

**Recommended fix**
```diff
     const ahead = here !== nav.url
     if (ahead) nav.redrawn.clear()
+    if (readAhead.url !== '' && here !== readAhead.url)
+      readAhead = { url: '', count: Number.NaN, surfaces: new Map() }
```

**Remediation brief**
- **Design intent:** `readAhead` holds what ahead passes did for the page the browser is currently visiting ahead of WXT's report (`readAhead.url`), to hand off if WXT reports that navigation next. Once any pass observes the browser on another URL (`here !== readAhead.url`) — whether returning to `nav.url` or moving to a page with no active surface — that ahead visit is over and `readAhead` must be cleared so a later navigation to the same URL at the same `navigation` count cannot inherit its open start or finished time. (Clearing happens when a pass runs on the other URL, the same bound as `if (ahead) nav.redrawn.clear()`.)
- **Full surface:** `apps/extension/src/surfaces/page-watcher.ts:344-347` (plus the docblock on `readAhead` at `:314-317` to say a pass on another URL clears it); `apps/extension/src/surfaces/page-watcher.test.ts` (inside `describe("a figure read by a pass ahead of WXT's report, ...")`); `docs/reviews/creator-analytics-1108/mutants.mjs` (add a mutant for the new clear line, beside `PW-off-url-clears`, and re-run `mutation-run.md`).
- **Must preserve:** All 54 existing tests in `apps/extension/src/surfaces/page-watcher.test.ts` (including every ahead-pass, cut-read, `noteUnplacedAhead`, and Navigation API non-commit test) and all 15 surface suites (`apps/extension/src/surfaces`, 734 tests). Passes on `here === readAhead.url` (consecutive ahead passes on the same URL, and the own pass after `navigated(readAhead.url)`) keep `readAhead` untouched; under the Navigation API, `navigated(to)` before `location.href` commits has `readAhead.url === ''` unless an abandoned earlier visit existed on `to`, in which case clearing is desired.
- **Do not touch:** `noteReadAhead`'s internal state machine (`:433-465`), `noteUnplacedAhead` (`:475-493`), `giveUp`'s `nav.redrawn.clear()` (`:576`), and `content-list.ts`.
- **Proof:** Paste `docs/reviews/creator-analytics-1108/repro/read-ahead-leave-and-return.case.ts` inside `describe("a figure read by a pass ahead of WXT's report, ...")` in `apps/extension/src/surfaces/page-watcher.test.ts`, then run `pnpm exec vitest run apps/extension/src/surfaces/page-watcher.test.ts -t 'repro:'`: all 3 cases red at `0a24108c` (`ms: 61450`, `ms: 61450`, `ms: 1200`), all 3 green after. Rename without `repro:` when landing.

### 2. The five YouTube failed-read guard mutants are not equivalent, leaving five finding-2 mutants unkilled and `mutation-run.md` stating a false invariant — MEDIUM
- **Location:** `docs/reviews/creator-analytics-1108/mutation-run.md:29`, `:31`, `:34`, `:36`, `:39`, `:51-57`, and the four YouTube test files where `d3d9ca04` dropped the failed-read tests (`apps/extension/src/surfaces/watch-page.test.ts`, `shorts.test.ts`, `feed.test.ts`, `channel-page.test.ts`)
- **Attribution:** Introduced by `9e562b09` ("creator-analytics#1108 the redraw mutants and their run: 33 of 38 killed, and why the five YouTube failed-read guards cannot be"), `d3d9ca04` ("creator-analytics#1108 drop the five failed-read redraw tests on the YouTube surfaces, which no change to their guard can make fail"), and `52b7c30c` ("creator-analytics#1108 the mutant run at d3d9ca04: 34 of 39 killed, the five YouTube failed-read guards equivalent"). The guards themselves in `watch-page.ts:78`, `shorts.ts:172`, `shorts.ts:204`, `feed.ts:172`, and `channel-page.ts:72` are intact and pre-existing from `#1037`.
- **Real-world trigger:** No live bug today because the production guards are still in place. The observable path when any guard is removed is a creator who holds two channels in Stillstats: on a youtube.com surface, channel 1's `read-uploads` fails quickly (starting its 30 s keep in `publicPageReads` at `t0`) while channel 2's `read-uploads` stalls for >= 30 s and fails while YouTube redraws the block, tiles, or Shorts channel bar. Pass 1 settles with `answered: false`. Without the guard, Pass 1 opens `nav.redrawn` at `t0`; Pass 2 immediately retries channel 1 (whose 30 s keep has expired), succeeds, and inflates `extension_surface_shown.ms` by the wait since `t0` (+4,750 ms on initial load after `giveUp`, or +30,000 ms after settle). Recording in `mutation-run.md` that "no event differs: the mutants are equivalent" invites a future cleanup to delete working guards, and leaves #1108's acceptance criterion ("Every mutant listed under finding 2 is killed by at least one test") unmet (34/39 instead of 39/39). MEDIUM, capped (wrong telemetry silently delivered on a regression, plus false invariant claim in the review record; `tests-can-go-red`, `test-every-fallback-path`).

**Evidence**
In `docs/reviews/creator-analytics-1108/mutation-run.md:53`:
```markdown
On a youtube.com surface a read that holds no answer stands `signedInReadKeptMs` (30 s, `public-pages.ts`). The redraw asks for the next pass, which gets that same failed read at once, with no read out for YouTube to redraw during, so it answers bare, and a bare answer ends the redraw's record (`page-watcher.ts`). ... The record the mutant opens is gone before any figure can read it, so no event differs: the mutants are equivalent.
```
In `apps/extension/src/surfaces/public-pages.ts:81-84` and `:135-146`, each held channel's `uploadsPillsOf` stamps its own `uploads.at = Date.now()` when *that* channel's request fails, independently of when `Promise.all(outcomes)` resolves.

**Failure mode** — executed with `docs/reviews/creator-analytics-1108/repro/youtube-failed-read-guards.case.ts` (two held channels `nick` and `otherCh`; `nick` fails immediately on call 1 and succeeds in 100 ms on call 2; `otherCh` fails after `signedInReadKeptMs` with the surface redrawn halfway):
- At HEAD `0a24108c` (guards intact): all 5 surfaces (`watch_page`, `shorts` tab, `shorts` player, `feed`, `channel_page`) report `ms: 25350, fromCache: false` (timed from the `giveUp` pass ask at 5,000 ms).
- Under each of the 5 exact mutants from `mutants.mjs` (`WP-guard`, `SH-tiles-guard`, `SH-player-guard`, `FD-guard`, `CP-guard`): all 5 fail, reporting `ms: 30100, fromCache: false` (timed from Pass 1 at 250 ms).

**Recommended fix** — keep all five production guards untouched; add one two-channel failed-read redraw test per guard in `watch-page.test.ts`, `shorts.test.ts` (tab and player), `feed.test.ts`, and `channel-page.test.ts` (using the `nick` and `someoneElse` fixtures already defined in all four files, mirroring `repro/youtube-failed-read-guards.case.ts`); then re-run `node docs/reviews/creator-analytics-1108/mutants.mjs .` and update `docs/reviews/creator-analytics-1108/mutation-run.md` to record 39 of 39 killed and remove the "five guards no test can kill" section.

**Remediation brief**
- **Design intent:** Only an answered uploads read (`PillsRead.answered === true`) carries a redraw start into `nav.redrawn`. Because `publicPageReads` tracks each held channel's failed-read keep (`uploads.at`) per channel, a fast-failing channel's keep can expire while a second channel's read is still in flight across `signedInReadKeptMs`, so the next pass retries channel 1 immediately without an intervening bare pass. Each of the five YouTube failed-read guards prevents Pass 1's failed read from inflating Pass 2's shown event, and each needs a test that goes red under its mutant.
- **Full surface:** `apps/extension/src/surfaces/watch-page.test.ts`, `apps/extension/src/surfaces/shorts.test.ts` (both tab and player cases), `apps/extension/src/surfaces/feed.test.ts`, `apps/extension/src/surfaces/channel-page.test.ts`, and `docs/reviews/creator-analytics-1108/mutation-run.md`. Production files (`watch-page.ts`, `shorts.ts`, `feed.ts`, `channel-page.ts`, `public-pages.ts`) need no change.
- **Must preserve:** Every existing test in `watch-page.test.ts`, `shorts.test.ts`, `feed.test.ts`, `channel-page.test.ts`, and `youtube-surfaces.test.ts`; every `videoIdsSentIn` privacy invariant in those suites; all 34 currently killed mutants in `mutants.mjs`.
- **Do not touch:** The five production `answered` guards, `public-pages.ts`, or `page-watcher.ts`.
- **Proof:** Copy `docs/reviews/creator-analytics-1108/repro/youtube-failed-read-guards.case.ts` or port its five cases into the four test files, then run `node docs/reviews/creator-analytics-1108/mutants.mjs . WP-guard SH-tiles-guard SH-player-guard FD-guard CP-guard`: all 5 survive at `0a24108c`, all 5 are killed after (39/39 total).

### 3. The Content list "Views" line navigation test asserts `ms: expect.any(Number)` instead of timing from its own read — LOW
- **Location:** `apps/extension/src/surfaces/content-list.test.ts:1961-1980` (specifically `:1976`)
- **Attribution:** Introduced by `40d4fc53` ("creator-analytics#1108 a test for each redraw branch of the extension's surfaces, so a change to one goes red").
- **Real-world trigger:** None today; `CL-kept-word-line-here` currently fails on `fromCache: true` only because the first navigation's read happened to be cold (`fromCache: false`). The test's own title claims the figure "is timed on that navigation from its own read", yet `ms: expect.any(Number)` checks nothing about `ms`, so if read 1 were cached a 5,000 ms inflation from navigation 2's unsettled pass would pass green (`tests-state-a-rule`, `tests-can-go-red`). LOW.

**Evidence**
```ts
    expect(reads()).toBe(2)
    expect(shownEvents()).toEqual([
      {
        name: 'extension_surface_shown',
        surface: 'content_list',
        ms: expect.any(Number),
        fromCache: true,
      },
    ])
```

**Failure mode** — the test passes for any `ms` (including `5000` when `CL-kept-word-line-here` leaks navigation 2's unsettled pass start into navigation 2's settled read). Verified by execution in a scratch copy: at HEAD `0a24108c`, `ms` is `250`, so `timedFromItsOwnPass` (`ms < 1_200, fromCache: true`, already defined at `:1898-1903` and used by the sibling Views-heading test at `:1958`) passes cleanly.

**Recommended fix**
```diff
-    expect(shownEvents()).toEqual([
-      {
-        name: 'extension_surface_shown',
-        surface: 'content_list',
-        ms: expect.any(Number),
-        fromCache: true,
-      },
-    ])
+    expect(shownEvents()).toEqual([timedFromItsOwnPass])
```

**Remediation brief**
- **Design intent:** The test pins `CL-kept-word-line-here` (that a kept answer from an earlier navigation waiting on the "Views" line does not open a redraw record on the new navigation) on both `ms` and `fromCache`, matching the sibling Views-heading navigation test immediately above it (`:1947-1959`).
- **Full surface:** `apps/extension/src/surfaces/content-list.test.ts:1972-1979`.
- **Must preserve:** All 117 tests in `apps/extension/src/surfaces/content-list.test.ts` and mutant `CL-kept-word-line-here` killed.
- **Do not touch:** `content-list.ts` or `timedFromItsOwnPass` (`:1898-1903`).
- **Proof:** `pnpm exec vitest run apps/extension/src/surfaces/content-list.test.ts -t 'with its "Views" line taken away, and a navigation WXT reports'` and `node docs/reviews/creator-analytics-1108/mutants.mjs . CL-kept-word-line-here`.

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/surfaces/page-watcher.ts:40-43` — `"A later pass of the same navigation that shows the figure is timed from the pass that first answered this, or, when a pass ahead of WXT's report showed the figure or was cut short reading it, with that pass's whole time or from its start: see \`watchPage\`."` → `"A later pass of the same navigation that shows the figure is timed from the pass that first answered this, or, when a pass ahead of WXT's report showed the figure, was cut short reading it, or answered this, with that pass's whole time or from its start: see \`watchPage\`."`
- `apps/extension/src/surfaces/content-list.ts:359` — `"// None placed is an answer whose figures waited on the Views heading's line."` → `"// None placed is an answer that waited on Studio's Views heading, its \"Views\" line, or the page title."`

## Needs Further Investigation
None.

## Reviewed and Dismissed
- **A move away from `nav.url` and back inside one in-flight read without any pass running on the other URL keeps `nav.redrawn`.** Checked `page-watcher.ts:343-346` and `:509-536`: if `url()` leaves `nav.url` and returns before the already-running read on `nav.url` lands, `placeAll` runs with `ahead === false` on both passes. Because the read itself was started for `nav.url` and no pass ever ran on the other URL, clearing only when a pass runs on another URL is the intended bound of `b4383324`.
- **`content-list.ts:335-342` (`!heading || !title`) when `answered.read.state !== 'read'` (e.g. a failed or signed-out read kept for 30 s).** Checked `content-list.ts:339-341`: the branch explicitly guards `answered.read.state === 'read'` and returns bare `'not-found'` for non-read states, so a line state never opens a redraw record.
- **`content-list.ts:336` returning `'not-found'` when `rows` change while waiting on a missing Views heading or page title.** Checked `content-list.ts:321`, `:336`, `:400-415`: `answered.key` holds the requested video ids, so repointed rows produce a different `key`, return bare `'not-found'` (ending `nav.redrawn`), and read the new ids fresh once the heading returns; pinned by `content-list.test.ts:1933`.
- **`noteUnplacedAhead` (`page-watcher.ts:475-493`) interacting with a flagged `redrawn` entry in `readAhead`.** Checked `noteReadAhead` (`:445-464`): `noteUnplacedAhead` calls `noteReadAhead(..., cutFrom(true), ...)`, which preserves `noted.since` and `noted.fromCache` and closes the flagged redraw into an unflagged cut start, as review 3 finding 3 intended.
- **`analytics.ts:132-134` with a pass between the cold read landing and Studio drawing the Views number row.** Checked `analytics.ts:92-135` and `video-row.ts:161-171`: while `viewsNumberRow` stays `null`, `held.standsOn === standsOn` (`undefined === undefined`), so `placeRow` returns the kept `shownFrom(false)` and `analytics.ts:132` keeps returning `redrawnFrom(false, 'not-found')` across intermediate passes without ending `nav.redrawn`.
- **YouTube fixture test limits (`youtube-test-limits` rule).** Checked the file headers of all four modified YouTube/Studio fixture test files (`analytics.test.ts`, `content-list.test.ts`, `feed.test.ts`, `shorts.test.ts`, `watch-page.test.ts`): each already carries its `// Limits:` block naming what jsdom and saved fixtures cannot observe and the human hand-check step.
- **The five YouTube production `answered` guards themselves (`watch-page.ts:78`, `shorts.ts:172`, `:204`, `feed.ts:172`, `channel-page.ts:72`).** All five are right and must stay (finding 2 is about their dropped tests and the false equivalence claim in `mutation-run.md`).

## Minor / nits
- `apps/extension/src/surfaces/content-list.ts:413-415`: because line 393 already returns whenever `(!headingNow || !titleNow) && read.state !== 'read'`, at line 412 `read.state === 'read'` and `view.kind !== 'line'` are always true, so `view.kind !== 'line' ? 'shown' : 'placed'` simplifies to `'shown'` (matching `:421`) and `read.state === 'read' &&` is redundant (matching the nit noted on `:423` in review 3).
- `apps/extension/src/surfaces/feed.test.ts:294`, `shorts.test.ts:571`, `watch-page.test.ts:770`: the 10-line `changedDuringFirstRead` / `blockRedrawnDuringFirstRead` helper is duplicated across three test files (a candidate for `testing.ts` if these files grow further).
- `apps/extension/src/surfaces/video-row.ts:206`: the `read.state === 'read'` failed-read guard when a custom `render` returns a disconnected anchor (`!placing.every(...)`) has no dedicated mutant in `mutants.mjs` or failed-read test in `video-row.test.ts` (outside review 3 finding 2's list, which named `:183` only).

## Test quality
Tests added: 30 cases across 7 files (`analytics.test.ts` 1, `content-list.test.ts` 13, `feed.test.ts` 2, `page-watcher.test.ts` 6, `shorts.test.ts` 3, `video-row.test.ts` 4, `watch-page.test.ts` 1).
- **Base-checkout run (`$BASE` oracle):** not run (non-Claude run avoids `git worktree add`).
- **Tautology-shape inspection:** none of the 30 cases compute their own expectation from production helpers, mock the unit under test, assert call shape only, use unread snapshots, omit assertions, or assert on prose. One case (`content-list.test.ts:1961-1980`) weakens its `ms` assertion to `expect.any(Number)` despite asserting timing in its title (finding 3). Five finding-2 failed-read guard tests were deleted in `d3d9ca04` on a false equivalence proof (finding 2).

## Before opening the PR
- **CI readiness:** `pnpm exec vitest run apps/extension` (34 files, 1105 passed), `pnpm --filter @creator-analytics/extension typecheck`, `pnpm --filter @creator-analytics/extension build`, and `pnpm lint` all pass at `0a24108c` on Node 26.3.0 (CI runs 24).
- **Commit hygiene:** commit this doc and the two repros (`docs/reviews/creator-analytics-1108/repro/read-ahead-leave-and-return.case.ts`, `docs/reviews/creator-analytics-1108/repro/youtube-failed-read-guards.case.ts`) as `creator-analytics#1108 pre-PR review 1` if preserving the review trail before remediation.
- **Likely reviewer asks:** PR #1122 is already open against `main`; confirm Nick wants finding 2's five two-channel guard tests added rather than keeping the earlier "accept the five equivalent mutants" decision now that the equivalence proof is disproved.

## Verdict
**Not ready as-is; ready once findings 1, 2, 3 and 4 are addressed** (2 MEDIUM, 2 LOW; 0 CRITICAL, 0 HIGH).
- **Gate before merge:**
  - **Finding 1 (MEDIUM):** clear `readAhead` in `page-watcher.ts` when a pass runs on another URL (`here !== readAhead.url`), with its tests and mutant.
  - **Finding 2 (MEDIUM):** add the five two-channel failed-read redraw tests so all 39/39 mutants in `mutants.mjs` are killed, and update `mutation-run.md` to remove the false equivalence claim (or, if Nick explicitly elects to leave those five guards untested even knowing they are observable on multi-channel accounts, correct `mutation-run.md` to state the real condition instead of claiming equivalence).
  - **Finding 3 (LOW):** replace `ms: expect.any(Number)` with `timedFromItsOwnPass` in `content-list.test.ts:1972-1979`.
  - **Finding 4 (LOW):** update the two stale comments in `page-watcher.ts:40-43` and `content-list.ts:359`.

## Remediation: 2026-11-25
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `f9abafe0` pre-PR review 1 finding 1: a pass ahead of WXT's report outlived a move off its page, and timed a later navigation to that page | red to green: `pnpm exec vitest run apps/extension/src/surfaces/page-watcher.test.ts -t 'a page the URL left before WXT reported it'` (red at `58dae3a9`: ms 61450, 61450, 1200); new mutant `PW-ahead-left-clears` killed; 15 surface files, 737 tests green | 1 (the `readAhead` docblock sentence the brief asked for; plus the test helper's docblock, as its siblings have) | fixed (proved by execution) |
| 2 (MEDIUM) | `90931fbb` pre-PR review 1 finding 2: the five YouTube failed-read guards had no test, on a wrong claim that no test could fail them | `node docs/reviews/creator-analytics-1108/mutants.mjs . WP-guard SH-tiles-guard SH-player-guard FD-guard CP-guard`: 5 of 5 killed (survived at `0a24108c`); full run 40 of 40 killed; `apps/extension` 34 files, 1113 tests green | 1 (the fixture's docblock in `testing.ts`, as its siblings have) | fixed (proved by execution) |
| 3 (LOW) | deferred | | | filed as #1123 under the collector #1060 (Nick, 2026-11-25) |
| 4 (LOW) | deferred | | | filed as #1124 under the collector #1060 (Nick, 2026-11-25) |

### Known regressions, deferred
None.

### Rework briefs
None.

