# Pre-PR review: creator-analytics#936 stored retention curves, compared on one chart (round 4)

**Branch:** `creator-analytics-936-retention-curves` vs `origin/main` (merge-base `50d695399dfd8c31e04e16050a574403b987f933`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `2b6c5980` (creator-analytics#936 Remove the copy pins that #952 added) + 0 files with uncommitted changes, 0 untracked files at the start, 60 files total, +7551 / −105. The only untracked files are this review's own: this doc and three proof patches under `docs/reviews/creator-analytics-936/repro/`.
**Delta under review:** since `21d5df57` (creator-analytics#936 pre-PR review 2 remediation closure table), the HEAD that `pre-pr-review-3.md` reviewed. The delta is the review 3 commit `57436281` and the close-out fix's three commits `746caf9b` (Remove the copy pins that #950 added), `c2f5b4a9` (… #951 added) and `2b6c5980` (… #952 added). Outside `docs/reviews/` that is 4 test files, +95 / −75: `apps/site/test/site.test.ts`, `apps/web/src/app.test.ts`, `apps/web/src/retention-comparison.test.ts`, `apps/web/src/upgrade.test.ts`. No production file and no shipped string changed.
**Reviewed against:** epic nick-vogel/creator-analytics#936 and its children #950, #951 and #952; Nick's close-out decision of 2026-11-20 ("We should not be writing tests for hard coded copy.", recorded in the run's close-out and the close-out fix brief), which reverses the round 1 to 3 Approach decision that kept the copy pins; `pre-pr-review-3.md` (its findings and Approach decisions); the repo's `.claude/rules/` and the global `~/.claude/rules/`. There are no plan or spec docs under `docs/`.
**Date:** 2026-11-20
**Reviewer:** 1 code-review agent (the whole delta, plus a sweep of the branch's other test files for pins the delta missed), 1 tautology-audit agent, Gemini, and a verify pass with executed mutants.
**Gemini:** gemini-4-carbon, 15860 in / 27180 out+thinking tokens, est. $0.3035. Found 9: confirmed 3 (unique 0), rejected 4, NFI 0, nits 2

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, already up to date |
| Lint | `pnpm lint` (biome check .) | green, 840 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5435 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | "The browser walk passed." The 401s it logs come from the signed-out states it walks. |
| Stability of the changed tests | the 3 site tests, 5 app tests and both unit files, each twice (audit agent) | green both times |
| Changed tests against `$BASE` production code | scratch worktree at `50d69539` with HEAD's test files (audit agent) | all red, mostly by a missing module or export (`./retention-comparison.ts`, `maxComparedCurves`, the retention card) |
| Mutants that each kept check is meant to catch | scratch worktree at HEAD; 23 mutants by the audit agent, 2 by the finder, 2 by the verify pass | red: the "up to 5" limit in the Pro card, FAQ and upgrade card; a plural-only note; a note that loses the count; the locale ignored; a long date style; the card rendered from another feature; an em-dash in the card; the privacy item saying "for 30 days". Green (gaps): see Findings 1 to 3 and Minor |
| The singular note with its branches swapped | `git apply docs/reviews/creator-analytics-936/repro/singular-inverted.patch` in a scratch worktree, `pnpm exec vitest run apps/web/src/retention-comparison.test.ts -t "singular"` | green, so the test does not hold its rule (Finding 1) |
| A screen-specific text for `google_failed` | `repro/shared-refusal-override.patch`, `pnpm exec vitest run apps/web/src/retention-comparison.test.ts` | 20 of 20 green (Finding 2) |
| The page's "up to 5" sentences and both "28 days" sentences changed | `repro/copy-numbers-drift.patch`, the retention-comparison, upgrade, app and site subsets | all green (Finding 3) |
| The recommended diffs of Findings 1 to 3 | applied in a scratch worktree at HEAD; `pnpm lint`, `pnpm typecheck`, the two unit files, `apps/worker/test/retention-curves.test.ts`, the FAQ subset of `site.test.ts` | green: 57 of 57 and 3 of 3; each new or changed assertion red under its mutant (inverted and empty singular, two overrides, intro and limit at 6, card and FAQ at 14 days, the constant at 21) |
| Copy pins the delta missed | `git diff 50d69539 --` the branch's other changed test files, read by the finder; a grep of the added lines in `site.test.ts` and `app.test.ts` | none word for word. `sidebar.test.ts` uses `retentionLinkText`; the hover card's `'Video 1 25%, Video 2 20%'` is data, not copy; the browser walk's names are dismissed below |
| Gemini finder | `~/.claude/bin/gemini-review 21d5df57` | ran, 9 findings |
| Real Google behaviour and production hold times | | not runnable here: needs Nick's walk of a paid channel on production |

**Overall:** The close-out fix did what Nick asked: no test this epic adds pins its drafted copy word for word, no shipped string moved, and the "up to 5" limit is now held to `maxComparedCurves` in the Pro card, the FAQ and the upgrade card, where it goes red on a change. Three kept checks are weaker than the rules their names claim. The singular test stays green with the singular and plural swapped. The refusal test stays green for any screen-specific text. The 28-day window and the retention page's own "up to 5" are tied to no constant. All three are LOW test-strength gaps in a round that changed only tests, and all full checks are green.

## Approach decisions
- **Round 1, Finding 1, the curve refresh's transaction:** commit each video's read in its own channel scope, after one plan scope, as `activeUserCount` in `apps/worker/src/jobs.ts` runs two scopes in sequence. Rejected: committing quota outside the caller's transaction in the gateway's `spend`. Unchanged.
- **Round 1, Finding 2, the privacy policy:** describe the curves on the reach history's windows, item by item. Unchanged.
- **Copy pins against `tests-state-a-rule`:** **overturned by Nick, 2026-11-20** ("We should not be writing tests for hard coded copy."). The epic's word-for-word pins are removed, and only rules over the copy that come from the code stay: a number that must match a constant, no em-dash, a branch observed through its text. Pins already on `origin/main` (#913's upgrade screen) stay, by the close-out fix brief.
- **Remediation 1, Finding 1, where the scopes open:** the job handler hands `refreshRetentionCurves` the `WorkerDatabase`, and the module opens the plan scope and one scope per due video. Unchanged.
- **Remediation 1, Finding 1, the fix's own failure path:** a database error in one video's scope is proved with a curve that repeats a point. Unchanged.
- **Remediation 1, Finding 2, proof over the policy:** the `affirms` facts name the curves in the storage, paid-retention, deleted-video and disconnect items. Unchanged. This round reads them as a rule over the copy that comes from the code (what the schema stores and what the purge deletes), not as copy pins (see Dismissed).
- **Remediation 1, Finding 3, the self-computed backfill note:** was `toContain('12 videos to go.')`, now `toMatch(/\b12\b/)` by the close-out fix. The rule is the count, not the words.
- **Round 2, Finding 1, how the suite holds the per-read commit:** a test hands the handler a `WorkerDatabase` that counts open `forChannel` scopes. Unchanged.
- **Round 2, Finding 1, one Google call per scope:** held by the existing read-count tests in `apps/worker/test/retention-curves.test.ts`. Unchanged.
- **Round 4, a number in the copy against the code:** extract it with a regex anchored on its unit (`/\bup to (\d+)\b[^.,]*?\bvideos\b/g`, `/\bdaily\b[^.]*?\bfirst (\d+) days\b/g`) and compare it to the exported constant the code enforces. This mirrors the close-out fix's `comparedVideosLimit` in `apps/site/test/site.test.ts:1342` and `apps/web/src/upgrade.test.ts:51`. Findings 3's new tests follow it.
- **Round 4, a branch observed through its text:** assert the part of the text that shows which branch ran (the count with its noun form, or equality with the shared table's text), never the surrounding sentence. Findings 1 and 2 follow it.

## Confirmed Issues

### 1. The singular test stays green when the note's singular and plural are swapped, or when the one-video note is empty — LOW
- **Location:** `apps/web/src/retention-comparison.test.ts:140`
- **Found by:** both
- **Attribution:** introduced by the delta. `git log -S".replace('2', '1')" 50d69539..HEAD` names only `c2f5b4a9` (creator-analytics#936 Remove the copy pins that #951 added). Before it, `toContain('1 video to go.')` held the singular.
- **Real-world trigger:** a refactor of `backfillNoteOf`'s plural, for example moving it to `Intl.PluralRules` with the branches the wrong way round. No user path exists today, since the code is correct. Capped at LOW because it is a test gap: the note would read "1 videos to go." to a channel with one video left, which is a confusing display.

**Evidence**
```ts
test("the note counts the uploads to go in the locale's digits, one video in the singular", () => {
  expect(backfillNoteOf(1200, 'en-US')).toContain('1,200')
  expect(backfillNoteOf(1, 'en-US')).not.toBe(backfillNoteOf(2, 'en-US').replace('2', '1'))
  expect(backfillNoteOf(12, 'ar-EG')).not.toMatch(/[0-9]/)
})
```

**Failure mode** — The middle assertion says only that the note for 1 differs from the note for 2 with its first "2" made a "1". With the branches swapped, the note for 1 is "… 1 videos to go." and the rewritten note for 2 is "… 1 video to go.". They differ, so the test passes. An empty note for 1 passes the same way. Executed: `repro/singular-inverted.patch` leaves the test green. The audit agent's empty-singular mutant also stays green. A plural-only note does go red, which is the one case the old pin also caught. The `.replace('2', '1')` also rewrites the first "2" anywhere in the sentence, so an approved wording with an earlier "2" in it would make the check pass for an unrelated reason.

**Recommended fix**
```diff
   test("the note counts the uploads to go in the locale's digits, one video in the singular", () => {
     expect(backfillNoteOf(1200, 'en-US')).toContain('1,200')
-    expect(backfillNoteOf(1, 'en-US')).not.toBe(backfillNoteOf(2, 'en-US').replace('2', '1'))
+    expect(backfillNoteOf(1, 'en-US')).toMatch(/\b1 video\b/)
+    expect(backfillNoteOf(2, 'en-US')).toMatch(/\b2 videos\b/)
     expect(backfillNoteOf(12, 'ar-EG')).not.toMatch(/[0-9]/)
   })
```

**Remediation brief**
- **Design intent:** `backfillNoteOf(unread, locale)` (`apps/web/src/retention-comparison.ts:46-50`) formats the count in the locale's digits and picks "video" for exactly 1, else "videos". The rule the test names is that branch. The count with its noun is the text that shows which branch ran (`tests-state-a-rule`'s behaviour-through-text exemption), so the assertion holds those two words and nothing of the sentence around them.
- **Full surface:** `apps/web/src/retention-comparison.test.ts:140` only. The other note checks (`:126`, `apps/web/src/app.test.ts:6916`) use 12 and are not about the singular.
- **Must preserve:** `toContain('1,200')` (locale grouping) and the `ar-EG` check (locale digits) in the same test; the test's name. `\b1 video\b` does not match "1 videos", which is what makes the swap red. Suite: `apps/web/src/retention-comparison.test.ts`, 20 tests.
- **Do not touch:** `backfillNoteOf` itself and its drafted sentence (no shipped string moves, by Nick's close-out decision); the `/\b12\b/` checks (Approach decisions).
- **Proof:** in a scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/singular-inverted.patch && pnpm exec vitest run apps/web/src/retention-comparison.test.ts -t "singular"` is green now and must be red after the fix. Without the patch, the same command must be green.

### 2. The refusal test stays green for any screen-specific text in place of the shared one — LOW
- **Location:** `apps/web/src/retention-comparison.test.ts:149-157`
- **Found by:** both
- **Attribution:** introduced by the delta. `git log -S"not.toContain('google_failed')" 50d69539..HEAD` names only `c2f5b4a9`. Before it, the test held `google_failed` to the shared table's words.
- **Real-world trigger:** someone adds a `google_failed` override to the comparison's `refusalMessageOf` call (`apps/web/src/retention-comparison.ts:126-128`), as `landing.ts:74` and `:85` do for their screens, and gives it a wrong or empty text. No user path exists today. Capped at LOW: a confusing display on a Google outage.

**Evidence**
```ts
const shared = comparisonViewOf({ refusal: 'google_failed' })
const unknown = comparisonViewOf({ error: 'invalid_ids' })
if (shared.kind !== 'refused' || unknown.kind !== 'refused') throw new Error('Not refused')

// The shared text, not the Pro refusal, and not the fallback that names the code.
expect(shared.message).not.toBe(comparisonText.refused)
expect(shared.message).not.toContain('google_failed')
```

**Failure mode** — Both assertions on `shared` are negative, so any message that is not the Pro refusal and does not name the code passes. Executed: `repro/shared-refusal-override.patch` (an override of `google_failed: ''`) leaves all 20 tests in the file green. The audit agent's override of `comparisonText.noCurve` also stays green. The comment above them claims "The shared text", which nothing checks.

**Recommended fix**
```diff
+import { refusalMessageOf } from './refusals.ts'
 ...
-    // The shared text, not the Pro refusal, and not the fallback that names the code.
-    expect(shared.message).not.toBe(comparisonText.refused)
-    expect(shared.message).not.toContain('google_failed')
+    expect(shared.message).toBe(refusalMessageOf({ refusal: 'google_failed' }, 'another read'))
     expect(unknown.message).not.toBe(comparisonText.refused)
     expect(unknown.message).toContain('invalid_ids')
```
Put the import after the `vitest` import and before `./retention-comparison.ts`, where biome's import order wants it.

**Remediation brief**
- **Design intent:** `comparisonViewOf` (`apps/web/src/retention-comparison.ts:119-130`) overrides one code, `sort_without_history`, with the Pro refusal, and leaves every other code to `refusalMessageOf`'s shared table (`apps/web/src/refusals.ts:5-13`), then to its fallback that names the code. The rule is "any other refusal is the shared text", which is equality with what the shared table gives a screen with no override. The expected value comes from the shared module, not from the unit under test, so a screen-specific override goes red and the shared words stay unpinned. The shared table's own behaviour is `apps/web/src/refusals.test.ts`'s job.
- **Full surface:** `apps/web/src/retention-comparison.test.ts` (the import block at `:7-23`, the assertions at `:153-155`). Nothing else.
- **Must preserve:** the Pro-refusal `toEqual` at `:145-148`; the two `unknown` assertions (the fallback names the code and is not the Pro refusal); the `Not refused` guard; the test's name. Equality with the shared text also keeps both dropped negatives, since the shared `google_failed` text is not the Pro refusal and does not name the code. The noun `'another read'` must differ from `'the retention curves'`, so the check does not depend on the noun. Suite: `apps/web/src/retention-comparison.test.ts`.
- **Do not touch:** `refusalMessageOf` and `refusalTexts` (no export is needed); the `invalid_ids` half, which the audit agent proved red against a replaced fallback.
- **Proof:** in a scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/shared-refusal-override.patch && pnpm exec vitest run apps/web/src/retention-comparison.test.ts -t "shared text"` is green now and must be red after the fix. Without the patch, the same command must be green.

### 3. The numbers the copy names are held to the code's constants in three places and not in four others: the 28-day window twice, and the retention page's own "up to 5" twice — LOW
- **Location:** `apps/web/src/upgrade.ts:68` and `apps/site/partials/footer.html:40-41` (the 28 days); `apps/web/src/retention-comparison.ts:26` and `:31` (`comparisonText.intro` and `.limit`, "up to 5"); the misleading test name at `apps/web/src/app.test.ts:6886`
- **Found by:** both (Gemini G4 and the finder, the 28 days; the finder alone, the page sentences)
- **Attribution:** introduced on the branch. The copy came in with `3b51599d` (creator-analytics#951 Compare up to 5 stored retention curves on one chart) and `f87a26f8` (creator-analytics#952 Describe the retention comparison on the upgrade screen, pricing section and FAQ). The delta applied the "number against constant" rule its brief named ("28 days, 5 videos") to the 5 in three places and to neither 28. The removed pins never tied the 28 to the code either: they held the literal and would not have gone red on a change to the refresh. So nothing went from covered to uncovered. The rule just landed in three of seven places, a half-fix under `whole-surface-of-a-change`.
- **Real-world trigger:** the refresh's daily window (`dailyAgeMs = 28 * dayMs`, `apps/worker/src/retention-curves.ts:24`) or `maxComparedCurves` changes, and the upgrade card, FAQ or retention page keeps promising the old number. No user path exists today: all seven sites match the code. Capped at LOW: the result would be a wrong product claim on a marketing or help surface, which tops out at MEDIUM. Upgrade to MEDIUM if a change to either constant is planned (check `gh issue list --repo nick-vogel/creator-analytics --search "retention curve daily OR maxComparedCurves"`).

**Evidence**
```ts
intro: 'Pick up to 5 videos to draw their audience retention on one chart.',   // retention-comparison.ts:26
limit: 'You can compare up to 5 videos. Clear a pick to choose another.',      // retention-comparison.ts:31
'The audience retention curves of up to 5 of your videos on one chart, each read daily for its first 28 days and monthly after.', // upgrade.ts:68
const dailyAgeMs = 28 * dayMs                                                  // apps/worker/src/retention-curves.ts:24, not exported
test('with 5 picked, a sixth pick box is disabled and the limit sentence names the limit', ...) // app.test.ts:6886, asserts only that aria-describedby points at comparisonText.limit
```

**Failure mode** — Executed: `repro/copy-numbers-drift.patch` sets both page sentences to "up to 6" and both 28s to 14. The retention-comparison and upgrade unit files, the app retention and upgrade subsets, and the site limit tests all stay green. The app test's name says the sentence "names the limit", but its assertion only checks that the sixth box's `aria-describedby` points at `comparisonText.limit`.

**Recommended fix**
```diff
--- a/packages/api-types/src/retention-curves.ts
 export const maxComparedCurves = 5
+
+export const dailyCurveReadDays = 28
--- a/packages/api-types/src/index.ts
 export {
+  dailyCurveReadDays,
   maxComparedCurves,
--- a/apps/worker/src/retention-curves.ts
+import { dailyCurveReadDays } from '@creator-analytics/api-types'
 import {
   connectionRoster,
 ...
-const dailyAgeMs = 28 * dayMs
+const dailyAgeMs = dailyCurveReadDays * dayMs
--- a/apps/web/src/upgrade.test.ts
-import { maxComparedCurves, type UpgradeComparison } from '@creator-analytics/api-types'
+import {
+  dailyCurveReadDays,
+  maxComparedCurves,
+  type UpgradeComparison,
+} from '@creator-analytics/api-types'
 ...
+  test('names the daily read window the refresh uses', () => {
+    const windows = retentionCard().lines.flatMap((line) =>
+      [...line.matchAll(/\bdaily\b[^.]*?\bfirst (\d+) days\b/g)].map(([, days]) => Number(days)),
+    )
+
+    expect(windows).toEqual([dailyCurveReadDays])
+  })
+
   test('holds no em-dash', () => {
--- a/apps/site/test/site.test.ts
-import { maxComparedCurves, productOrigin } from '@creator-analytics/api-types'
+import { dailyCurveReadDays, maxComparedCurves, productOrigin } from '@creator-analytics/api-types'
 ... after "the FAQ's Pro answer's limit on compared videos is the one the comparison enforces":
+  test("the FAQ's Pro answer's daily read window is the one the refresh uses", async ({ web }) => {
+    const footer = elementOf(homepageOf((await servedSite(web)).pages), 'footer')
+    const [answer = ''] = [...footer.matchAll(/<details>([\s\S]*?)<\/details>/g)]
+      .map(([, details = '']) => textOf(details))
+      .filter((details) => /Stillstats Pro/.test(details))
+    const windows = [...answer.matchAll(/\bdaily\b[^.]*?\bfirst (\d+) days\b/g)].map(([, days]) =>
+      Number(days),
+    )
+
+    expect(windows).toEqual([dailyCurveReadDays])
+  })
--- a/apps/web/src/retention-comparison.test.ts
-import type { RetentionCurvesAnswer, StoredRetentionCurve } from '@creator-analytics/api-types'
+import {
+  maxComparedCurves,
+  type RetentionCurvesAnswer,
+  type StoredRetentionCurve,
+} from '@creator-analytics/api-types'
 ... before 'the read date is the medium date the locale writes':
+  test('the intro and the limit sentence name the limit the pick rule enforces', () => {
+    const limitsIn = (text: string) =>
+      [...text.matchAll(/\bup to (\d+)\b[^.,]*?\bvideos\b/g)].map(([, count]) => Number(count))
+
+    expect([comparisonText.intro, comparisonText.limit].map(limitsIn)).toEqual([
+      [maxComparedCurves],
+      [maxComparedCurves],
+    ])
+  })
--- a/apps/web/src/app.test.ts:6886
-  test('with 5 picked, a sixth pick box is disabled and the limit sentence names the limit', async () => {
+  test('with 5 picked, a sixth pick box is disabled and points at the limit sentence', async () => {
```
Run `pnpm format` after the edit. The verify pass found that biome keeps the import order above.

**Remediation brief**
- **Design intent:** two product rules live in code. `maxComparedCurves` (`packages/api-types/src/retention-curves.ts:2`) caps the picks and the read. The refresh reads a video daily while it is younger than `dailyAgeMs` and monthly after (`apps/worker/src/retention-curves.ts:24-26`, `:68`, `:84`). Copy that names either number is a rule over the copy that comes from the code (`tests-state-a-rule`), so each sentence's number is pulled out by its unit and compared to the exported constant. Moving the 28 into `api-types` gives the worker, the web app and the site one value; `apps/worker/package.json` already depends on `@creator-analytics/api-types`. The JSDoc for the new constant, if the remediator adds one by the file's convention, says the window is in days after publish and is read daily before monthly.
- **Full surface:** `packages/api-types/src/retention-curves.ts:2` (new export); `packages/api-types/src/index.ts:122-128` (the explicit re-export list: without it the import resolves to `undefined`, which the verify pass hit); `apps/worker/src/retention-curves.ts:1` and `:24`; `apps/web/src/upgrade.test.ts:1` and a test after `:55`; `apps/site/test/site.test.ts:34` and a test after `:1410`; `apps/web/src/retention-comparison.test.ts:7` and a test before `:160`; the test name at `apps/web/src/app.test.ts:6886`. The Pro pricing `<li>` at `apps/site/index.html:204` names no day count, so it needs no 28 check. The FAQ's other "first 28 days" (`apps/site/partials/footer.html:36-37`, the new-upload averages) has no "daily" before it in its sentence, so the regex does not match it. It is #913's approved copy on a different rule.
- **Must preserve:** the refresh's behaviour: `dailyAgeMs` stays 28 days, and the 57 tests across `apps/worker/test/retention-curves.test.ts`, `apps/web/src/upgrade.test.ts` and `apps/web/src/retention-comparison.test.ts` stay green (verified). `monthlyReadAgeMs` stays as it is: the copy says "monthly", a word, not a number, so no check ties it, and that is declared here as intended. Every shipped string stays as drafted.
- **Do not touch:** the drafted copy itself (Nick's close-out decision); the `comparedVideosLimit` regex's case-sensitivity (Minor); the Pro card test's dropped retention filter (Minor).
- **Proof:** in a scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/copy-numbers-drift.patch`, then `pnpm exec vitest run apps/web/src/retention-comparison.test.ts apps/web/src/upgrade.test.ts` and `pnpm exec vitest run apps/site/test/site.test.ts -t "FAQ's Pro answer"`. Both are green now and must each be red after the fix: the intro test, the card's window test and the FAQ's window test. Without the patch, all must be green, with `apps/worker/test/retention-curves.test.ts` 20 of 20.

### 4. Comment hygiene — LOW (aggregated)
- `apps/site/test/site.test.ts:1805-1808` — "and the history purge deletes them with its reach history. The test holds those facts; the sentence rests on Nick's approval on the epic's PR." → "and the history purge deletes them with its reach history (`packages/retention-engine/src/history-purge.test.ts`). The test holds that the storage item states those facts; the sentence rests on Nick's approval on the epic's PR." The test reads the policy, not the purge. (found by: Claude)
- `apps/worker/test/retention-curves.test.ts:7` — carried from round 3, untouched: "The scope count test holds the shape that releases them" → "The test 'a run opens one scope to plan and one per read, never one inside another' holds the shape that releases them". (found by: Claude)
- `apps/worker/test/retention-curves.test.ts:7-9` — carried from round 3, untouched: "the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the release on separate connections" → "the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the Analytics quota row released between reads on separate connections; it does not probe the Data API row the plan's uploads read takes". (found by: Claude)

The comment at `apps/web/src/retention-comparison.test.ts:153` ("The shared text, …") goes with Finding 2's fix and is not listed here. Run `pnpm format` and `pnpm lint` after the edit. Proof: none needed beyond a green `pnpm exec vitest run apps/worker/test/retention-curves.test.ts apps/site/test/site.test.ts -t "storage section"`.

## Needs Further Investigation

### A. A database error on one video's points repeats on every retry and every day, and loses that call's quota units — confirm whether Google ever answers a repeated or missing `elapsedVideoTimeRatio`
- **Found by:** Claude
- Carried unchanged from round 3. The delta does not touch the refresh.

### B. A very large channel's run against pg-boss's job expiry — confirm the expiry setting
- **Found by:** Claude
- Carried unchanged from round 3.

## Reviewed and Dismissed
- The upgrade screen test builds the retention card's expected title and lines from `upgradeFeatures` (`apps/web/src/app.test.ts:9244-9245`, `:9275`), so an empty or wrong title stays green (audit mutants 5b, 5c). Dismissed. The unit is the screen's render and `upgradeFeatures` is its input data. The card's words are deliberately unpinned by Nick's decision. What the test holds, the card's place among the five and the render of its own entry, goes red when the render reads another feature (mutant 5a). (found by: both)
- The privacy `affirms` facts (`/each of its videos/`, `/when Stillstats read/`, `/as long as[^.]*reach history/`, `apps/site/test/site.test.ts:1814-1822`, and the paid-retention, deleted-video and disconnect items) are copy pins in disguise and should be deleted. Dismissed. They are round 1 Finding 2's recorded approach (Approach decisions). Each states a fact the code sets (what `retention_curves` and `retention_curve_reads` hold, and the purge), which is the rule's exemption "the policy names every third party the code sends data to" in shape. The finder's rewrite proved them phrase-sensitive, but a rephrase means a fresh approval on the PR anyway. Do not delete them in remediation. If Nick wants them gone, that is a decision that overturns an Approach decision. (found by: both)
- Legend and refusal tests take their expected texts from `comparisonText`, the module under test (`apps/web/src/retention-comparison.test.ts:115-119`, `:145-148`, `apps/web/src/app.test.ts:6836`). Dismissed. Each one observes which branch ran through the branch's own text constant, which the rule allows. Equal or empty constants are a copy question, not a branch. (found by: Gemini)
- Copy pins this epic added remain in the other privacy items, the sidebar and the #951 page tests. Dismissed after the sweep. `sidebar.test.ts` uses `retentionLinkText`. The other privacy items use the round 1 `affirms` facts (above). The added `app.test.ts` lines hold data values (`'Video 1 25%, Video 2 20%'`), not copy. (found by: Gemini)
- The browser walk selects the retention page by literal names (`pageHeading('Compare retention')`, `control('list', 'Compared videos')`, `control('slider', 'Retention comparison. …')`, `apps/site/test/screenshot/browser-walk.ts` near `:678-682`). Dismissed. The close-out brief prefers "the accessible role and name the app already exposes". `c2f5b4a9`'s message records the choice, and why `comparisonText` cannot be imported there (it pulls `route.ts` into the site's typecheck). The walk already selects by literal names elsewhere (`bannerLabel`). (found by: Claude)
- Dropping "Read" from `readLabelOf` stays green in all six legend and date tests (audit mutant 4a). Dismissed. The word is copy. The kept rules are the date's locale and medium style, which go red (4b, 4c). (found by: Claude)
- Dropping `expect(history).toMatch(/^For a channel on Stillstats Pro, its reach history:/)` from the privacy storage test loses a rule. Dismissed. It was a prefix pin on the reach history item, added by #950's `8834444c`, and states no rule the code sets. (found by: Claude)

## Minor / nits
- `comparedVideosLimit` (`apps/site/test/site.test.ts:1342`, and the same regex at `apps/web/src/upgrade.test.ts:51`) has no `i` flag, so an approved wording that opens a sentence with "Up to 5" goes falsely red (audit mutants 7b, 7c). The Pro card test no longer filters on "audience retention", so a different `<li>` carrying "up to 5 … videos" would pass (7a). The regex is written out twice, and a shared testing export could hold it. (found by: both)
- `readOn18November` (`apps/web/src/app.test.ts:6759-6762`) puts `title` into a `RegExp` unescaped and accepts any text before the date. That is harmless for "Video N". Its JSDoc mostly restates its name. (found by: both)
- The privacy retention fact `/as long as[^.]*reach history/` accepts a qualifier that shortens the curves' keep ("…or for 30 days, whichever is shorter", audit mutants 6b, 6c). Nick's approval of the words covers that. (found by: Claude)
- The upgrade screen test's name still says "with its approved copy … the five feature cards", while one card is drafted. The comment above it says so. (found by: Claude)
- Carried from round 3 and unchanged: the round 2 Findings 2 and 3 LOW tail; round 1's LOW tail (Findings 4 to 8); the scope-count test name and exact-count nits; the repro header's "Red until the refresh commits per read". (found by: Claude)

## Test quality
Tests changed in the delta: 12 assertions' worth across 4 files, 1 new test (`upgrade.test.ts` "holds no em-dash"). Against `$BASE` production code all are red, mostly by a missing module or export, which says little. Against mutants of the rules they name: the "up to 5" limit (3 sites), the locale's digits, the count in the note, the medium date, the card's place and render, the em-dash and the privacy keep all go red. Three gaps stay green and are Findings 1 to 3: the swapped singular, a screen-specific refusal text, and the numbers at four sites that are tied to nothing. Tautology shapes: none of the mocked-unit, call-shaped, snapshot or prose kind. The one expectation built from production data (`upgradeFeatures`) is dismissed above. The fake API is the seam, not the unit.

## Prior-review closure
- **Fully fixed: 0.**
- **Partially fixed: 0.**
- **Untouched: 1, LOW.** Round 3 Finding 1 (Comment hygiene, two wording fixes in `apps/worker/test/retention-curves.test.ts:7-9`). Round 3 had no MEDIUM-or-higher finding and no remediation table, so the run did not work it. Its two entries are re-emitted in this round's Finding 4. NFI A and B carry forward.
- **Overturned by decision: 1 Approach decision.** "Copy pins against `tests-state-a-rule`: kept" is reversed by Nick on 2026-11-20. The delta is its implementation, reviewed above.
- No prior fix was "resolved" by editing only a comment or a doc.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` are green at `2b6c5980`, and the browser walk passed.
- **Commit hygiene:** commit this doc and its three `repro/` patches. Nothing else is in the tree.
- **Likely reviewer asks:** the drafted copy, all pending Nick's word-for-word approval on the PR; whether the privacy `affirms` facts survive his "no tests for hard coded copy" (Dismissed, a decision for him); migration 0037's number against #934 and #938; the refresh's per-channel Analytics budget (#950's open proposal); the `retentionCurveRefresh` queue's retry setting (NFI A).

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it. Findings 1 to 3 are LOW test-strength gaps in checks the close-out fix kept or did not extend. Findings 1 and 2 are a few lines each in one test file. Finding 3 adds one exported constant and three small tests. They can ride with the PR or follow it. The close-out fix met its brief's main intent: no epic copy pin remains, no shipped string moved, and the "up to 5" limit is held to the code at three sites. Its half-landed part is the "number against constant" rule at four further sites. Of round 3's single LOW finding, 0 are fixed and 1 is untouched, by the run's choice not to remediate a LOW-only round. The confirmed list holds at LOW and is about test strength, not behaviour: no production line changed since round 3. The refresh has been rewritten once in response to review, so no split ticket is called for.
