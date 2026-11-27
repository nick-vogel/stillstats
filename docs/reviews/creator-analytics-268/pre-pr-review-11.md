# Pre-PR review: creator-analytics#268 run 6, round 2, the publish day top's memo key after review 10's remediation

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `b04d419` "Merge pull request #538 from nick-vogel/creator-analytics-268-channel-audience-screen")
**Reviewed at:** HEAD `ca2aefa` ("creator-analytics#268 pre-PR review 10 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 27 files, +2050 / −265, in 18 commits.
**Delta under review:** since `07596d0` ("creator-analytics#512 Placeholders: a video page section heading's place holds the lines its heading wraps to"), the HEAD pre-PR review 10 reviewed. The delta is three commits: `ff6adeb` (review 10's doc and repro), `1fa9111` ("creator-analytics#268 pre-PR review 10 finding 1: under Publish day, a sort or page size change holds 10 bar rows for a top the same channel just answered shorter") and `ca2aefa` (the closure table). Code in the delta: `apps/web/src/video-list.ts`, `apps/web/src/video-list.test.ts`, `apps/web/src/placeholder.test.ts`, +32 / −9.
**Reviewed against:** review 10's finding 1 (its intent, brief and Must preserve), its Approach decisions and its closure table; creator-analytics#510's decision that each placeholder holds the rows the same answer last had, else the full size; `CODING_STANDARDS.md` 1 to 3 and the five binding review rules; the API's `publishDayTop` contract (`packages/api-types/src/videos.ts:323-328`) and its derivation (`apps/api/src/video-list.ts:345-352`, `:504-527`).
**Date:** 2026-11-09
**Reviewer:** 1 code-review agent + verify pass (base oracle and mutation runs by the orchestrator)

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome) | pass, 570 files; pass again with this doc and its repro added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `env -u TEST_DATABASE_ADMIN_URL pnpm test` (Docker up, Testcontainers Postgres) | 132 files, 3,203 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` | passed, "No content security policy violation in 51 steps" |
| The new test against the last reviewed commit | scratch worktree at `07596d0`, HEAD's `video-list.test.ts` and `placeholder.test.ts` copied in, both files run | 1 red (`a top answered under one sort is expected under another sort and page size`, `expected 10 to be 2`), 289 green |
| The changed tests can go red | scratch worktree, HEAD's `video-list.ts` with `format` added to the key's delete list | 2 red: the two format-swap tests (`video-list.test.ts:1085`, `placeholder.test.ts:382`) |
| The new test can go red | same, with `sort` kept in the key | 1 red: the new test |
| The key's `page` drop and `visibility` keep are pinned | `repro/publish-day-top-key-mutants.sh` (each mutant over `video-list.test.ts`, `placeholder.test.ts`, `app.test.ts`) | both mutants pass all 566 tests (finding 1) |
| Finding 1's recommended tests | own scratch worktree at HEAD, the three test edits applied: run at HEAD's code, then under each mutant; `biome check` on both files | 566 green at HEAD; each mutant turns exactly one test red; lint clean |
| Is the top independent of sort, page and page size | read `apps/api/src/video-list.ts:504-527`: `listed` is filtered by `ids`, `includeScheduled`, `visibility` and `format`, then sorted and sliced for the page; `publishDayTopOf(listed)` reads the unsorted, unsliced set | yes; the key drops exactly the three it should |
| Do the write and read keys match | `VideoList.tsx:337` takes `query` from `listReadOf`, as `publishDayTopRowsExpectedFor` does; both pass through `publishDayTopKeyOf`'s `URLSearchParams` round trip | yes (Dismissed) |
| Comment lines over 100 columns, em-dashes in added lines | the delta's added lines | none |
| Not run | Safari; a real screen reader; review 10's Needs Further Investigation A to C | unchanged by the delta, still open there |

**Overall:** review 10's MEDIUM is fixed as its brief asked. Under "Publish day", a sort or page size change now finds the top the same channel last answered, the list's own memo keeps the whole query, and every full check passes, the browser walk included. Two LOW findings remain on the new key. Its `page` drop and its `visibility` keep have no test that goes red without them, and two test names still say "another read" where the rule is now "a read with another top". A doc comment on the placeholder still says "the same read". No MEDIUM or higher is open. The branch is ready for a PR, with the LOWs going in alongside it or following as tickets.

## Approach decisions
- Carried from reviews 1 to 10, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run; the column shows only where the window holds every row, by `sidebarColumnQuery`; content raised with a z-index inside the scrolled screen is held under the sticky controls bar by its nearest positioned box's `position: relative; z-index: 0`; an approved name is tested as the rule it serves, never as its literal; a page-load memo of an answer's size is keyed on exactly the parts of the read that the answer depends on (the publish day top drops `page`, `sort` and `pageSize`, precedent `listReadOf`'s `listKey`); a test that needs "another read" of the publish day top uses a read whose top differs, never a sort or page size change.
- New: a memo key that drops some of a read's parts is pinned in both directions, one assertion per part. Each dropped part (`page`, `sort`, `pageSize`) has a read that differs only in it and expects the remembered count; each kept part the answer depends on (`format`, `visibility`) has a read that differs only in it and expects the full size. Precedent: the two describes in `video-list.test.ts` at `:1043` (this memo) and the list rows describe above it.

## Confirmed Issues
### 1. The publish day top's key drops `page` and keeps `visibility` with no test that goes red without either, and two test names still call the rule "another read" — LOW
- **Location:** `apps/web/src/video-list.test.ts:1062` and `:1085`; `apps/web/src/placeholder.test.ts:382`
- **Attribution:** introduced by `1fa9111`, which added the key's delete list (`git log --oneline -S"['page', 'sort', 'pageSize']" b04d419..HEAD` names only it). The `visibility` half was already unpinned under the whole-query key `a6b1527` introduced, so it is pre-existing on the branch, and the remediation's test edits left it so. Neither is on `b04d419`, which had no such memo.
- **Real-world trigger:** none for a user today; the code is right. The gap is for the next change: a refactor of `publishDayTopKeyOf` that stops dropping `page` would hold 10 bars under "Publish day" on Back from a video on page 2 (the list remounts with no read, `video-list.ts:106-107`), and one that drops `visibility` would hold the public top's count for the "all videos" read. Neither would turn a test red. Test gap, no user path, so LOW.

**Evidence**
```ts
function publishDayTopKeyOf(channelId: string, query: string): string {
  const top = new URLSearchParams(query)
  for (const key of ['page', 'sort', 'pageSize']) top.delete(key)
  return answeredRowsKeyOf(channelId, top.toString())
}
```
The tests vary only `sort` and `pageSize` (remembered count) and `format` (full size):
```ts
  test('a top answered under one sort is expected under another sort and page size', () => {
  ...
  test('another read of the same channel, or the same read of another, still expects 10', () => {
```

**Failure mode** — `sh docs/reviews/creator-analytics-268/repro/publish-day-top-key-mutants.sh` prints `mutant keeps page: passed (no test pins it)` and `mutant drops visibility: passed (no test pins it)`: with `['sort', 'pageSize']`, or with `['page', 'sort', 'pageSize', 'visibility']`, all 566 tests in `video-list.test.ts`, `placeholder.test.ts` and `app.test.ts` pass. The names: since `1fa9111`, a read that differs only in its sort, page or page size is "another read" that does not expect 10, so `video-list.test.ts:1085` and `placeholder.test.ts:382` state a rule the code no longer has (standard 2, a test's name states its rule).

**Recommended fix** — tests only, no production change. In `apps/web/src/video-list.test.ts`:
```ts
  test('a top answered under one sort is expected under another sort, page and page size', () => {
    const two = channelOf('p-resort')
    remember(two, first1, 2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, sort: '-engagedViews' }, {})).toBe(2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, page: 2 }, {})).toBe(2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, pageSize: 50 }, {})).toBe(2)
  })
```
```ts
  test('a read with another top (another format or visibility), or the same read of another channel, still expects 10', () => {
    const one = channelOf('p-one')
    remember(one, first1, 4)
    expect(publishDayTopRowsExpectedFor(one, { ...first1, format: 'short' }, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(one, { ...first1, visibility: 'all' }, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(channelOf('p-two'), first1, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(null, first1, {})).toBe(10)
  })
```
In `apps/web/src/placeholder.test.ts:382`, rename the test to `'after the same read answered 4 videos it holds 4, and an answer for a read with another top leaves it at 10'`; its body stays.

**Remediation brief**
- **Design intent:** each placeholder holds the rows the same answer last had on this page load, else the full size (#510). The publish day top ranks every upload of the list's format and visibility (`apps/api/src/video-list.ts:504-527`: `listed` is filtered before the sort and the page slice), so its memo key drops `page`, `sort` and `pageSize` and keeps the rest of the list query (`video-list.ts:140-171`). The key's tests pin each dropped part with a read that differs only in it and finds the remembered count, and each kept part the top depends on with a read that differs only in it and finds 10.
- **Full surface:** `apps/web/src/video-list.test.ts:1062-1067` (the new test: renamed, `page: 2` assertion added), `apps/web/src/video-list.test.ts:1085-1091` (renamed, `visibility: 'all'` assertion added), `apps/web/src/placeholder.test.ts:382` (renamed). `Route.visibility` is optional (`apps/web/src/route.ts:59-62`); the fixture `first1` leaves it out, so its read is the default `public`, and `'all'` is the other value (`packages/api-types/src/preferences.ts:16`).
- **Must preserve:** `apps/web/src/video-list.ts` unchanged; every other assertion in the two `video-list.test.ts` tests and in `placeholder.test.ts:382-389`; the list rows describe's "another read" tests (`video-list.test.ts:1201`, `placeholder.test.ts:661`), which are about `answeredRows`, whose key keeps the whole query, so their names are true and stay.
- **Do not touch:** `publishDayTopKeyOf`'s `window` (Needs Further Investigation D); the Audience memo in `audience-rows.ts`; `summaryPlaceListOf`'s first1 page rule.
- **Proof:** before the edits, `sh docs/reviews/creator-analytics-268/repro/publish-day-top-key-mutants.sh` prints `passed (no test pins it)` for both mutants. After them, `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` is green (566 in the reviewer's run), and the script prints `FAILED (a test caught it)` for both. The script copies the tree's test files, so it checks the edited tests.

### 2. Comment hygiene — LOW (aggregated)
- `apps/web/src/Placeholder.tsx:165` — "as many bars as the same read of `channel` last answered on this page load" → "as many bars as a read of `channel` with the same top last answered on this page load". Made stale by `1fa9111`, whose new docblock on `publishDayTopRowsExpectedFor` (`video-list.ts:160-163`) says "a read with the same top".
- `apps/web/src/VideoList.tsx:391-392` — "Only a read of the first day after publish carries the top, whose placeholder holds the bars it answered the next time the page reads it" → "Only a read of a window after publish carries the top; the Publish day placeholder holds the bars it answered the next time the page reads it". Repeats review 10 finding 8's open entry (deferred LOW). Every window in `windowsAfterPublish` carries the top (`apps/api/src/video-list.ts:527`), and `1fa9111`'s memo comment (`video-list.ts:142`) now says so, so the two comments disagree.

## Needs Further Investigation
### D. The key keeps `window`, so a top answered under "First 7 days" or longer is never read under "Publish day" — confirm the top is the same in every window after publish
`AfterPublishPlaceholder` reads the memo only under `first1` (`Placeholder.tsx:185`), and `VideoList.tsx:393-394` writes it under every window after publish, so writes under `first7` to `first365` are never read. The finder read the top as window-independent: `publishDayTopOf` ranks on `engagedViewsByDay[0]` (`apps/api/src/video-list.ts:346`), which `engagedViewsByDayOf` (`apps/api/src/window-after-publish.ts:59-77`) fills from the publish day whatever the window, and `listed`'s filter reads no window. Not executed. If it holds, a creator who switches from "First 7 days" to "Publish day" sees 10 bars held where the remembered count would do; that is #510's designed fallback for a top not yet answered, not a regression (`b04d419` held a fixed three rows). To settle: an API test that lists one channel under `first1` and `first28` and compares `publishDayTop`; `apps/api/src/video-list.test.ts:1805` already reads `first28.body.publishDayTop`. If they always match, a follow-up may drop `window` from `publishDayTopKeyOf` and pin it per the new Approach decision; the mutant that drops `window` passes every test today.

## Reviewed and Dismissed
- The write and read keys — `VideoList.tsx:337` takes `query` from the same `listReadOf` the reader calls, and both sides go through `publishDayTopKeyOf`'s `URLSearchParams` parse and re-serialise, so encoding, a leading `?` and parameter order match; `delete` keeps the remaining order. `rememberPublishDayTopRowsOf` and `publishDayTopRowsExpectedFor` have no other callers.
- The scheduled filter left out of the memo comment — the web list query never sends `ids` or `includeScheduled` (`videoListQueryOf`, `video-list.ts:86-104`), and the route defaults `includeScheduled` to false, so the key keeps every input the web can vary.
- `range` kept in the key — never set for a window after publish, so it never splits the key; harmless.
- The format swap in the two pinned tests — green at `07596d0` by design (a format change was another read there too), and red under a key that drops `format`, so they still guard that half.

## Minor / nits
- None beyond the findings.

## Test quality
Tests added or changed in the delta: 3 (1 added, 2 rewritten) · red against `07596d0`: 1, the added test, as its proof · green against `07596d0`: 2, the format-swap pins, kept because they go red under a key that drops `format` (they are review 10's remediation, not vacuous) · tautology shapes found: none; the tests build only their input and read the real return value or rendered bars · gaps: the key's `page` drop and `visibility` keep (finding 1).

## Prior-review closure
Against review 10 (8 findings): 1 fully fixed, 1 partially fixed, 6 untouched.
- **Fully fixed:** finding 1 (MEDIUM). Verified against its intent, not only its diff: the top's memo now drops `page`, `sort` and `pageSize`, the repro test is red at `07596d0` and green at HEAD, and every item in its Must preserve holds (the list's own memo, the saved page size, the empty top's 0, no channel and another channel at 10, the app round trip and the walk). The `page` half has no test, which is finding 1 here (LOW).
- **Partially fixed:** finding 8 (LOW, comment hygiene). The `video-list.ts:141` entry closed in `1fa9111`; the `VideoList.tsx:391` twin and the rest stay open, deferred, and the twin is repeated in finding 2 here.
- **Untouched, deferred by default scope (LOW tail):** findings 2 to 7. They stand as written in `pre-pr-review-10.md`, briefs included; the delta does not touch their files.
- No MEDIUM or higher prior finding is partially fixed or untouched. Review 10's Known regressions, deferred list is empty.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite pass at `ca2aefa`; the browser walk passes locally. This doc and its repro pass lint.
- **Commit hygiene:** commit this doc and `repro/publish-day-top-key-mutants.sh`. Nothing to drop.
- **Likely reviewer asks:** whether a re-sort under "Publish day" keeps the page still (now yes); the stuck date range bar on the light theme (the deferred #461 proposal).

## Verdict
Ready to open the PR, with follow-ups. No CRITICAL, HIGH or MEDIUM finding is open. Review 10's one MEDIUM is fixed by its own test, which a fix that kept the sort turns red; it was not resolved by editing a comment or a doc. The two new LOWs are a test gap on the new key and comment hygiene. They can be remediated with review 10's LOW tail or filed as follow-ups. The confirmed list shrank from one MEDIUM and seven LOWs to two LOWs on a 30-line delta, which is the expected shape of a converging round, not a branch that failed to improve.
