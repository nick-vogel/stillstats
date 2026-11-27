# Pre-PR review: creator-analytics#938 Sponsor report

**Branch:** `creator-analytics-938-sponsor-report` vs `origin/main` (merge-base `50d69539`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `523e6c82` (creator-analytics#938 pre-PR review 1 remediation closure table) + 0 files with uncommitted changes, 48 files total, +6630 / −21
**Delta under review:** since `91d1cb92` (creator-analytics#958 Describe the sponsor report in the FAQ and its Pro figures on the upgrade screen), the HEAD that `pre-pr-review-1.md` reviewed. 4 files, +464 / −2, of which 2 are code: `apps/web/src/sponsor-report.ts` (+5 / −2) and `apps/web/src/sponsor-report.test.ts` (+15). The other two are review 1's doc and its repro. Commits: `359b16e5` (review 1), `d8c50230` (finding 1's fix), `523e6c82` (closure table).
**Reviewed against:** `pre-pr-review-1.md` (finding 1 in full, its Approach decisions, its closure table and its Known regressions list), epic #938's acceptance criteria as distilled in review 1, the global rules in `~/.claude/rules/` (`tests-can-go-red` and `tests-state-a-rule` read in full for this round), and the repo rules `.claude/rules/row-level-security-tests.md` and `.claude/rules/youtube-test-limits.md`.
**Date:** 2026-11-20
**Reviewer:** 1 code-review agent + verify pass
**Gemini:** gemini-4-carbon, 20566 in / 4630 out+thinking tokens, est. $0.0874. Found 0: confirmed 0 (unique 0), rejected 0, NFI 0, nits 0

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, nothing changed |
| Lint | `pnpm lint` | green (841 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5508 passed, 1 expected fail |
| Time-zone matrix | `TZ=<zone> pnpm exec vitest run apps/web/src/sponsor-report.test.ts` for UTC, Asia/Tokyo, Pacific/Kiritimati, America/Los_Angeles, Pacific/Honolulu, Europe/London | green in all six, 39/39 |
| Prior finding 1, against its intent | Finder's differential harness: the web's `sponsorPublishedOf` against `longDateOf(publishDayOf(upload))` from the API, for both 2024 DST transitions, the Pacific midnights around them, 2024-03-04T07:30Z and 08:30Z, and a year boundary, each as published and as scheduled, under the six zones above | 0 divergences. `reportingDayOf` is `pacificDayOf` itself (`packages/youtube-gateway/src/youtube-gateway.ts:229`), and the web's `publishedAt` is the API's `publishTimeOf` (`scheduledFor ?? publishedAt`) |
| Tautology audit (Phase 4.5): the delta's one new test | HEAD's `apps/web/src/sponsor-report.test.ts` copied into a scratch worktree at `91d1cb92` (pre-fix code), the new test run there | red under UTC and Europe/London ("expected 'Published March 4, 2024' to be 'Published March 3, 2024'"), and Asia/Tokyo and Pacific/Kiritimati per the finder. **Green under America/Los_Angeles and Pacific/Honolulu** (finding 1) |
| Finding 1's recommended test | `repro/publish-date-any-zone.case.ts` put in place of the new test in a scratch worktree at HEAD, then run against HEAD's code and against `91d1cb92`'s `apps/web/src/sponsor-report.ts` | at HEAD: green 40/40 under UTC, Pacific/Honolulu and Asia/Tokyo. Against the pre-fix code: both rows red under UTC, Pacific/Honolulu and America/Los_Angeles. The committed test stays green against the pre-fix code under Pacific/Honolulu |
| Repro lint | `pnpm exec biome check docs/reviews/creator-analytics-938/repro/` | green (2 files) |
| Browser walk | Not re-run: the delta changes one formatter's expression and no markup, CSS or route | not run this round; green at `91d1cb92` in review 1 |

**Overall:** prior finding 1 is fully fixed. The printed publish line now uses the same Pacific day the API counts every window from, in every reader time zone, DST days included, and nothing it had to keep was lost. Lint, typecheck, build and the full suite are green. This round confirms two LOW findings, both about what the tests can prove rather than what the code does. The fix's new test cannot go red for a reader west of Pacific, though its name says "in any time zone". An older page test also takes its expected publish line from the helper under test. Neither blocks the PR.

## Approach decisions
- Serialising the checklist's saves: through `writeQueue` from `apps/web/src/preferences.ts`, held once per component with `useState(writeQueue)` as `apps/web/src/App.tsx:301` does, with the existing `turn` guard kept for the re-read (review 1 finding 2, still open).
- The publish line's day: the Pacific day from `pacificDayOf`, which the API counts day 1 from, formatted by `longDateOf` as the "Data through" line already is (review 1 finding 1, landed in `d8c50230`).
- A channel-owned table's write refusal: a per-table Postgres test in `packages/database/test/`, mirroring `packages/database/test/preferences.test.ts:51` (review 1 finding 5, still open).
- The stricter history coverage (every day of the window, not `historyPartialOf`'s forgiveness after the newest day) is #957's recorded decision and stands.
- A test that depends on the reader's time zone stubs the zone inside the test with `vi.stubEnv('TZ', ...)` and `onTestFinished(() => vi.unstubAllEnvs())`, as `apps/web/src/views-chart.test.ts:146-153` does, so it goes red in any runner zone (finding 1, new this round).
- A page test's expected date is written from a literal day through `longDateOf`, as `apps/web/src/sponsor-report.test.ts:338` does for "Data through", never from the helper under test (finding 2, new this round).

## Confirmed Issues
### 1. The fix's new test cannot go red for a reader west of Pacific, though its name says "in any time zone" — LOW
- **Location:** `apps/web/src/sponsor-report.test.ts:297-311`
- **Found by:** Claude
- **Attribution:** introduced by the remediation, in `d8c50230` (creator-analytics#938 pre-PR review 1 finding 1: the printed publish date used the reader's time zone while the windows and Data through count from the Pacific day). `git log -S"in any time zone" 91d1cb92..HEAD -- apps/web/src/sponsor-report.test.ts` names only that commit. It is not in review 1's Known regressions list.
- **Real-world trigger:** none for users. The production code is right in every zone (the harness in the table above). The gap is in the suite: if someone later goes back to a reader's-day formatter, this test catches it only when the runner's zone is east of Pacific. CI runs in UTC (no `TZ` in `ci.yml`), so CI would catch the east half, and nothing pins the west half: a reader in Hawaii shown "Published March 3" for a video published 00:30 Pacific on March 4. LOW, capped: no user path, since the behaviour is correct today.

**Evidence**
```ts
  test('the publish line names the Pacific day the windows count from, in any time zone', () => {
    const report = {
      ...fakeSponsorReport,
      video: {
        ...fakeSponsorReport.video,
        publishedAt: '2024-03-04T07:30:00.000Z',
        scheduled: false,
      },
```
The one instant is 23:30 Pacific on March 3, which only a reader east of Pacific sees as another day. The test runs in whatever zone the process has.

**Failure mode:** executed. HEAD's test file against `91d1cb92`'s `sponsorPublishedOf` passes this test under `TZ=Pacific/Honolulu` and `TZ=America/Los_Angeles`. The pre-fix formula on `2024-03-04T08:30:00.000Z` under Honolulu gives "March 3, 2024", while the Pacific day is March 4. The test breaks `tests-can-go-red` ("a regression test that was never seen to fail against the unfixed code", for half the zones its name covers) and its name over-claims (`tests-state-a-rule`).

**Recommended fix:** replace the test with a `test.each` that fixes the reader's zone inside each row, one row each side of Pacific. Add `onTestFinished` to the file's `vitest` import.
```diff
-import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
+import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest'
```
```diff
-  test('the publish line names the Pacific day the windows count from, in any time zone', () => {
-    const report = {
-      ...fakeSponsorReport,
-      video: {
-        ...fakeSponsorReport.video,
-        publishedAt: '2024-03-04T07:30:00.000Z',
-        scheduled: false,
-      },
-      lastProcessedDay: '2024-06-01',
-    }
-
-    expect(sponsorDataThroughOf(report, 'en-US')).toBe('Data through April 1, 2024')
-    expect(sponsorPublishedOf(report.video, 'en-US')).toBe('Published March 3, 2024')
-  })
+  test.each([
+    ['Europe/London', '2024-03-04T07:30:00.000Z', 'Published March 3, 2024'],
+    ['Pacific/Honolulu', '2024-03-04T08:30:00.000Z', 'Published March 4, 2024'],
+  ])('a reader in %s sees the Pacific publish day of %s', (zone, publishedAt, line) => {
+    vi.stubEnv('TZ', zone)
+    onTestFinished(() => {
+      vi.unstubAllEnvs()
+    })
+
+    expect(sponsorPublishedOf({ publishedAt, scheduled: false }, 'en-US')).toBe(line)
+  })
```
Diff audit: the removed `sponsorDataThroughOf` assertion ("Data through April 1, 2024" for `2024-03-04T07:30:00.000Z`) is the same rule as the `'an older video'` row of the `test.each` at `apps/web/src/sponsor-report.test.ts:206`, so it stays pinned there. Dropping it here is intended (one rule, one test). The fixture spread goes because `sponsorPublishedOf` takes only `publishedAt` and `scheduled`. If `vi.stubEnv` stopped changing the zone, both rows would still be red against a reader's-day formatter under UTC, since London is UTC in March, so that failure still surfaces in CI.

**Remediation brief**
- **Design intent:** the sponsor report's every printed date agrees with the windows, which count from the publish day in Pacific time (`pacificDayOf`, the same function the API calls `reportingDayOf`). The publish line's test is the proof of that rule, so it has to fail for a reader's-day formatter whatever zone the runner is in, on both sides of Pacific.
- **Full surface:** `apps/web/src/sponsor-report.test.ts:9` (the `vitest` import) and `apps/web/src/sponsor-report.test.ts:297-311` (the test). No production change.
- **Must preserve:** the `'an older video'` row of the "Data through" `test.each` (`apps/web/src/sponsor-report.test.ts:204-221`); `the day the data runs through and the publish date are long dates` (`apps/web/src/sponsor-report.test.ts:196`); the whole file green under any `TZ`. Each test's stub is undone when it finishes, so no other test sees the zone. `apps/web/src/views-chart.test.ts:146-153` is the pattern.
- **Do not touch:** `sponsorPublishedOf` and `sponsorDataThroughOf` in `apps/web/src/sponsor-report.ts`. Both are right. See Reviewed and Dismissed.
- **Proof:** paste `docs/reviews/creator-analytics-938/repro/publish-date-any-zone.case.ts` (from its `test.each(` line) in place of the test above and add `onTestFinished` to the import. Then, from the repo root, run `TZ=UTC pnpm exec vitest run apps/web/src/sponsor-report.test.ts` and `TZ=Pacific/Honolulu pnpm exec vitest run apps/web/src/sponsor-report.test.ts`, which must both be green 40/40. For red, in a scratch worktree with `git show 91d1cb92:apps/web/src/sponsor-report.ts > apps/web/src/sponsor-report.ts`, run `TZ=Pacific/Honolulu pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'`, which must show both rows red. This review ran it that way. Drop the `repro:` prefix when the case lands.

### 2. The page test takes its expected publish line from the helper under test — LOW
- **Location:** `apps/web/src/sponsor-report.test.ts:323`
- **Found by:** Claude
- **Attribution:** introduced on the branch in `5b8baddc` (creator-analytics#956 A printable sponsor report of one video's first 7, 14 and 30 days), before this round's delta, and not named in review 1. Its file is in this round's delta, and finding 1's fix changed what the helper returns, so the assertion's expected value moved with the fix without being touched.
- **Real-world trigger:** none for users. The line passed before review 1's fix and still passes after it, so it never checked the date on the page. LOW, capped: no user path.

**Evidence**
```ts
    expect(report.textContent).toContain(sponsorPublishedOf(fakeSponsorReport.video))
```
`SponsorReport.tsx:240` renders `sponsorPublishedOf(answer.video)`, so both sides call one function. This is the shape `tests-can-go-red` calls "the expectation comes from the code under test". Lines 338 and 355 of the same file already write their "Data through" day out as a literal through `longDateOf`.

**Failure mode:** found by reading, confirmed by the fix's history. The assertion was green with the reader's-day formatter at `91d1cb92` and is green with the Pacific-day formatter at HEAD, under every zone in the matrix.

**Recommended fix**
```diff
-    expect(report.textContent).toContain(sponsorPublishedOf(fakeSponsorReport.video))
+    expect(report.textContent).toContain(`Published ${longDateOf('2026-10-01')}`)
```
Diff audit: the fake video's `publishedAt` is `2026-10-01T16:00:00.000Z` (`apps/web/src/fake-api.ts:64`), 09:00 Pacific on October 1. The page passes no locale, and neither does `longDateOf` here, so the expected text follows the runner's default locale as the page does, and stays green under any `TZ`. It still checks that the page shows the publish line. It now also goes red under Asia/Tokyo for a reader's-day formatter. `sponsorPublishedOf` may stay in the file's imports, since lines 198, 200 and 309 still use it, and `longDateOf` is already imported (line 19).

**Remediation brief**
- **Design intent:** a page test observes the rendered report and compares it with a value worked out independently of the unit that rendered it. The date's rule (the Pacific day) is pinned by the unit tests at `apps/web/src/sponsor-report.test.ts:196` and finding 1's test. This page test pins that the page prints that line.
- **Full surface:** `apps/web/src/sponsor-report.test.ts:323`. No production change.
- **Must preserve:** every other assertion in that page test (`apps/web/src/sponsor-report.test.ts:313-340`), including the locale-independent `toLocaleString()` cells and line 338's `longDateOf('2026-10-10')`.
- **Do not touch:** `apps/web/src/SponsorReport.tsx:240`.
- **Proof:** `TZ=UTC pnpm exec vitest run apps/web/src/sponsor-report.test.ts` and `TZ=Asia/Tokyo pnpm exec vitest run apps/web/src/sponsor-report.test.ts` are both green after the change. With `git show 91d1cb92:apps/web/src/sponsor-report.ts > apps/web/src/sponsor-report.ts` in a scratch worktree, the page test is red under `TZ=Asia/Tokyo`. Not executed in this review: LOW.

## Needs Further Investigation
- None new. Review 1's A (a video with no publish time printing "0" impressions) is outside this delta and still stands as written there.

## Reviewed and Dismissed
- The fix's use of `pacificDayOf` on the web against the API's `reportingDayOf`. They are the same function (`packages/youtube-gateway/src/youtube-gateway.ts:229`, `export const reportingDayOf = pacificDayOf`), and the harness found 0 divergences, DST days included. (found by: Claude)
- The "Scheduled for" path. The web's `publishedAt` is `publishTimeOf(upload)`, `scheduledFor ?? publishedAt` (`apps/api/src/uploads.ts:60-63`), which is the same instant `publishDayOf` counts a scheduled video's windows from. (found by: Claude)
- A malformed `publishedAt` now throws a RangeError from `Intl.DateTimeFormat#format` where `toLocaleDateString` printed "Invalid Date". The API always sends `new Date(time).toISOString()` (`apps/api/src/uploads.ts:62`), and `sponsorDataThroughOf` already passed the same field through `pacificDayOf` before the fix, so this adds no new way for the page to fail. (found by: Claude)
- The new test's "Data through" assertion repeating the `'an older video'` row. It was put there on purpose, to show both printed lines agree on one page. Finding 1's recommended test drops it and the brief says why. (found by: Claude)
- The rewritten doc comment on `sponsorPublishedOf`. It says why the Pacific day is used and matches the code (`comments-must-be-load-bearing`). (found by: Claude)

## Minor / nits
- The video detail screen formats the publish time in the reader's zone (`apps/web/src/video-list.ts:425`), so for a late-evening Pacific publish read in Europe the detail screen and the sponsor report name different days. Review 1 kept this out of scope on purpose, since the list has no Pacific-counted window beside it. Noted here so it is not mistaken for a regression of the fix. (found by: Claude)

## Test quality
- **Tests added or changed in the delta:** 1 (`the publish line names the Pacific day the windows count from, in any time zone`, `apps/web/src/sponsor-report.test.ts:297`).
- **Green at the pre-fix code:** under America/Los_Angeles and Pacific/Honolulu only. Red under UTC, Europe/London, Asia/Tokyo and Pacific/Kiritimati. It is review 1 finding 1's proof, so keep it and strengthen it (finding 1), never delete it.
- **Tautology shapes:** 1, outside the delta's lines but in its file: the expectation from the code under test at line 323 (finding 2).
- **Repo rules:** the delta touches no Google-facing or database test, so `youtube-test-limits` and `row-level-security-tests` do not apply this round.

## Prior-review closure
- **Fully fixed: 1.** Finding 1 (MEDIUM), in `d8c50230`. It was verified against the fix's intent, not only its diff: the publish line now agrees with the API's day-1 anchor for every instant and zone tested, and every behaviour on its Must preserve list holds. The one gap is in its test, not its fix (finding 1 of this doc).
- **Partially fixed: 0.**
- **Untouched: 8,** all LOW and all deferred by review 1's remediation ("LOW tail, not worked this round"): 2 (two quick ticks race their saves), 3 (a refused re-read after a save puts the old choice back), 4 (no test pins the report's activity day), 5 (the stored choice's write is never checked in the database), 6 (awaiting processing prints an early "Data through" and counts nine figures), 7 (copy tests #958 asked for, Nick's call on the PR), 8 (refactors walked past), 9 (comment hygiene). None is MEDIUM or higher. Their briefs in `pre-pr-review-1.md` still apply. The only drift is line numbers below `apps/web/src/sponsor-report.ts:212`, now 3 lines lower, so finding 6's `sponsor-report.ts:223-226` is now `226-229`, and `apps/web/src/sponsor-report.test.ts` below line 296, now 15 lines lower, so finding 6's `sponsor-report.test.ts:387` is now `402`.
- **Resolved only by a comment or doc edit: 0.**

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `523e6c82`. `apps/web/src/sponsor-report.test.ts` is green under all six zones tested, so review 1's time-zone-dependent red is gone.
- **Commit hygiene:** commit this doc with `repro/publish-date-any-zone.case.ts`. The tree is otherwise clean.
- **Likely reviewer asks:** unchanged from review 1: migration 0037 colliding with #950's, the privacy policy's storage section, Nick's approval of the #958 copy and the copy-test conflict (review 1 finding 7), and the one-page light print resting on Nick's print preview.

## Verdict
Ready to open the PR as is. The MEDIUM that gated review 1 is fully fixed, and its fix was checked against what it was meant to achieve, including DST days and scheduled videos. The two new findings are LOW and only about test strength: findings 1 and 2 can be worked in this loop or filed as follow-ups. Review 1's eight LOW findings stay open as deferred. As expected for a delta this small, the confirmed list shrank from one MEDIUM and eight LOWs to two LOW test findings. This is not a sign the branch has more to fix.
