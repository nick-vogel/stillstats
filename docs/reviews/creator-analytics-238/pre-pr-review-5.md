# Pre-PR review: creator-analytics#238 More own-channel metrics (ratio, newest average, RPM by day, by video and as a chart, and the RPM switch)

**Branch:** `creator-analytics-238-own-channel-metrics` vs `origin/creator-analytics-236-video-list-paging-daily-table` (merge-base `7d7c506` "creator-analytics#236 pre-PR review 6", which is also the base branch's tip, so the base has not moved since the merge)
**Reviewed at:** HEAD `3c9112e` ("creator-analytics#238 Fail the suite on a migrations folder that drizzle cannot run, as two branches numbering the same migration leave it"). The tree was clean, with no uncommitted or untracked files at review time. 75 files, +8262 / −386 against the merge-base. About 3460 of those lines are the two generated drizzle snapshots, and about 950 are review docs 1 to 4 and their repro scripts.
**Delta under review:** since `ede96cc` ("creator-analytics#357 RPM: a Profile switch that leaves other sources out"), the HEAD that `pre-pr-review-4.md` reviewed. Three commits: `b4b9e1a` (review 4's doc), `22571ca` (the merge of the PR base at `7d7c506`, which renumbered this branch's migrations to 0018 and 0019 and hand-resolved 7 conflicted files), and `3c9112e` (a new `packages/database/test/migrations.test.ts`). `git diff ede96cc` is 82 files, +7869 / −328, nearly all of it the base's own work (#338 tips and support, #236 review rounds 4 to 6). The branch's own part of the delta is the merge resolution (`git show --remerge-diff 22571ca`: 12 files) and the 63-line test.
**Reviewed against:** the epic creator-analytics#238 body and its 2026-11-04 amendment (the spec), `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, `docs/deploy.md`, and `pre-pr-review-4.md` in full (findings, Approach decisions, Dismissed). No remediation pass ran on review 4, so it has no closure table and no "Known regressions, deferred" list. The repo has no `CLAUDE.md`.
**Date:** 2026-11-06
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green, 557 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 130 files, 3062 passed, 1 expected fail; `migrations.test.ts` included by the root `include` glob |
| Browser walk | `pnpm run --if-present test:browser` | passed, 35 steps, no content security policy violation |
| Base drift | `git rev-parse origin/creator-analytics-236-video-list-paging-daily-table` after `git fetch --prune` | `7d7c506`, the merge-base: no drift, review 4's merge gate is closed |
| Conflict markers | `git grep -nE '^(<<<<<<<\|>>>>>>>) ' -- apps packages docs CONTEXT.md README.md` | none |
| Migrations 0018/0019 | agent: SQL read, `python3 -m json.tool` diffs 0017→0018→0019, journal read, prevId chain | 0018 only widens `preferences_chart_card` with `'rpm'`, 0019 only adds nullable `rpm_ads_and_premium_only`; base's `support_prompt_dismissed_at` and `tips` (RLS, FK, index, 3 policies) kept, nothing duplicated; chain 0015→0019 intact; `when` strictly increasing |
| Migrator order on production | agent: read of `drizzle-orm/pg-core/dialect.js:56-69` (`created_at < folderMillis` against the newest applied row) against the journal | production applied base's 0016/0017 (newest `when` 1793852810206); 0018 (1793975548097) and 0019 (1793975548656) are later, so both run; a fresh database runs in order |
| Preferences after the merge | agent: read of `apps/api/src/preferences.ts`, `packages/database/src/preferences.ts`, `packages/api-types/src/preferences.ts`, `apps/api/src/preferences.test.ts` across both parents | `supportPromptDismissed`, `rpmAdsAndPremiumOnly` and `chartCard: 'rpm'` validated, saved, read back and cleared together; Reset deletes the row, so the switch goes off and the dismissal clears (base's rule); every test name and case row of both parents present |
| Web merge | agent: three-way read of each auto-merged file both sides touched; `pnpm exec vitest run` on `app.test.ts`, `components.test.ts`, `placeholder.test.ts`, `video-list.test.ts`, `test/web.test.ts` | 677 passed; summary read deps still name the switch; #439 count beside base's `channel` rename; RPM sort goes through the same `SortableHeading` and `onTableRead()` as base's refused sort read; no `onLand` left; no app.css selector changed by both sides |
| Lost or doubled tests | agent: per test-title count, branch + base − merge-base against HEAD, for the five web test files | zero mismatches |
| Walk structure | agent: read of the merged `browser-walk.ts`, site typecheck and `biome check` | both sides' steps whole and closed; no step clicks the support item's Hide; comment drift only (finding 4) |
| Tautology audit | agent: `migrations.test.ts` copied onto a scratch checkout of `7d7c506`, then run in bad states built in scratch worktrees | 4/4 green at base (expected: the base folder is consistent); each test red in at least one named bad state (Test quality) |
| Migrations test mutations | agent: in a scratch worktree at HEAD, a column with no migration; 0018's snapshot re-parented on 0016; 0018's `when` below 0017's | test 4, test 3 and test 1 red respectively |
| Review 4 finding 1, re-verified | `TMPDIR=<scratchpad> sh docs/reviews/creator-analytics-238/repro/summary-rpm-switch-reread.sh` at `3c9112e` | "mutant survives", exit 1: still open |
| Review 4 findings 2 to 4, re-verified | `grep` of each indicted line at HEAD | all still stand, lines shifted by the merge (updated below) |
| Not run | VoiceOver on an RPM gap day; a migrate against a database that ran this branch before the renumbering | Needs Further Investigation B; Reviewed and Dismissed |

**Overall:** The merge is clean. It renumbered the two migrations correctly on top of main's 0016 and 0017, kept both sides' preferences, tests and walk steps, and every full check is green, so review 4's one gate is closed. The new migrations test is real: each assertion goes red on a bad folder it names. No finding is MEDIUM or higher. Review 4's four LOW findings were not remediated and still stand, and this round adds only comment drift to its comment hygiene list.

## Approach decisions
- Carried from reviews 1 to 4, all kept: the ratio line's two-line place (`--card-ratio-place`), the empty `aria-hidden` `card-detail` at zero engaged views, and one shared `--card-place` read by `.card`'s `min-height` and `.placeholder-card`'s `height`; a further in-place change to the card height rule for a new state is a split ticket with a width-by-state matrix.
- One RPM rule: `rpmRevenueOf(amounts, adsAndPremiumOnly)` in `packages/api-types/src/channel-summary.ts`, read by the API sort and every web RPM (#357). Kept.
- A screen that builds its numbers when the read lands names the RPM switch in its read deps (`ChannelSummaryFigures.tsx:192`); a screen that builds at render does not. Kept; finding 1 adds the missing test, not a new mechanism.
- The video list's RPM column follows the numbers table's order, right after Revenue and before the sources group (review 4 finding 2, carried as finding 2). Still a product call for Nick: align, or record the current order here.
- New, this review: a branch whose migration numbers collide with the base's renumbers its own after the base's (here 0018 and 0019), with `drizzle-kit generate` regenerating the snapshots, and `packages/database/test/migrations.test.ts` guards the folder's invariants (journal numbering and times, one SQL per entry, the snapshot chain, no ungenerated schema change). Kept.

## Prior-review closure
Prior doc: `pre-pr-review-4.md` (HEAD `ede96cc`). It had 4 confirmed findings, all LOW, and no remediation ran on them.
- Fully fixed: 0.
- Partially fixed: 0.
- Untouched: 4 (findings 1 to 4), re-verified at `3c9112e` and carried below as findings 1 to 4 with their lines updated. Finding 1's repro still exits 1.
- Prior MEDIUM-or-higher left open: 0. Deferred by decision: 0.

## Confirmed Issues
### 1. When the RPM switch changes while the channel summary is on view, the summary reads again, but no test would notice if it stopped — LOW
- **Location:** `apps/web/src/ChannelSummaryFigures.tsx:186-193`, `apps/web/src/app.test.ts:1915` (the describe "the RPM switch on the profile (creator-analytics#357)")
- **Attribution:** introduced by `06b8916` "creator-analytics#357 RPM: a Profile switch that leaves other sources out" (review 4 finding 1). The merge `22571ca` changed neither the dep nor the describe.
- **Real-world trigger:** on the Profile, the creator turns the switch on and goes back to the channel summary before the save's round trip ends, and the save fails; the rollback then changes the switch while the summary is on view. The dep handles it today; nothing pins it. Capped at LOW: the code is correct. Raise to MEDIUM (wrong numbers silently shown) only if the dep is ever removed.

**Evidence** — `[channelId, window, range?.from, range?.to, format, adsAndPremiumOnly]` at `ChannelSummaryFigures.tsx:192` is the only thing that re-reads on a switch change (`useViewInSavedCurrency`, `apps/web/src/preferences.ts:277-291`); every switch-on app test sets the preference before the screen mounts (`installFakeApi({ rpmAdsAndPremiumOnly: true })` at `app.test.ts:1967`, `earningDetailApi({ rpmAdsAndPremiumOnly: true })` at `:2031`).

**Failure mode** — executed at `3c9112e`: `TMPDIR=<scratchpad> sh docs/reviews/creator-analytics-238/repro/summary-rpm-switch-reread.sh` prints "mutant survives: no app test fails without the RPM switch in the summary's read deps" and exits 1.

**Recommended fix** — unchanged from `pre-pr-review-4.md` finding 1: one app test in the describe at `app.test.ts:1915` that holds the switch's save, reaches the summary, fails the save, and asserts the switch-off RPM line, using the describe's existing helpers by name.

**Remediation brief**
- **Design intent:** the channel summary builds its revenue card when its read lands, so a change of the switch while it is mounted must re-read; every read waits on `settled()`, so a read never lands ahead of a save in flight. The video page, the numbers table, the list cells and the charts compute at render and need no such dep.
- **Full surface:** `apps/web/src/app.test.ts` (one new test in the describe at `:1915`). No production change.
- **Must preserve:** `ChannelSummaryFigures.tsx:192` as it is; the describe's existing tests (`app.test.ts:1915-2075`); `failedOnTheProfile` (`app.test.ts:312`) and the hold helpers in `apps/web/src/fake-api.ts` unchanged.
- **Do not touch:** the `biome-ignore` at `apps/web/src/preferences.ts:284`, the hook's documented contract.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green with the new test, then `sh docs/reviews/creator-analytics-238/repro/summary-rpm-switch-reread.sh` from the repo root exits 0 ("mutant killed") on the commit that adds it.

### 2. With the revenue sources shown, the video list's RPM column sits after the three sources, not beside Revenue as #264 asks and as the numbers table places it — LOW
- **Location:** `apps/web/src/video-list.ts:499` (the RPM column, after Other sources at `:491`), `apps/web/src/video-list.ts:427-428` (its doc comment), `apps/web/src/VideoList.tsx:634` (the sources heading placed after Revenue)
- **Attribution:** introduced by `14e8a85` "creator-analytics#264 Video list: an RPM column and sort" (review 4 finding 2). Untouched by the merge.
- **Real-world trigger:** a creator with revenue consent who shows the revenue sources sees Revenue, Ads, YouTube Premium, Other sources, RPM in the list, and Revenue, RPM, then the sources in the numbers table. With the sources hidden, the default, they agree. A display inconsistency, LOW.

**Evidence** — #264: "The video list gains an "RPM" column beside "Revenue"". `numbers-table.ts:27` orders `['estimatedRevenue', 'rpm', ...revenueSourceSortKeys]`. `video-list.test.ts:177` ("with revenue on and the sources shown, Ads, YouTube Premium and Other sources follow Revenue") pins the current list order.

**Recommended fix** — as `pre-pr-review-4.md` finding 2: move the RPM column object to directly after the Revenue object (`video-list.ts:466`) in `metricColumnsOf`; change `VideoList.tsx:634` from `shownColumn.column.sortKey === 'estimatedRevenue'` to `shownColumn.column.sortKey === 'rpm'`; change the doc comment at `video-list.ts:427-428` from "after the sources when they show" to "right after Revenue"; update the expected order of `video-list.test.ts:177` to `'Revenue', 'RPM', 'Ads', 'YouTube Premium', 'Other sources'` and rename it "with revenue on and the sources shown, RPM follows Revenue and Ads, YouTube Premium and Other sources follow RPM". If Nick prefers the current order, record it under Approach decisions instead and leave the code.

**Remediation brief**
- **Design intent:** body cells follow `listColumnsShownOf`'s order; with the sources shown the header has two rows, every non-source column spanning both, and one `colgroup` heading over the source columns that must sit, in the first row, where the source columns start in the body. RPM is never shown without Revenue (both `optional: 'revenue'`), so `'rpm'` is present whenever `grouped` is true.
- **Full surface:** `apps/web/src/video-list.ts:427-428` and `:466-505`, `apps/web/src/VideoList.tsx:634`, `apps/web/src/video-list.test.ts:177`. The not-processed row's `colSpan` (`video-list.ts:958`) counts shown columns and needs no change.
- **Must preserve:** header and body alignment with the sources shown and hidden (add one assertion in `apps/web/src/components.test.ts`'s list markup tests that the header's leaf headings read in the body cells' order); `video-list.test.ts:207` (RPM gone with Revenue); `sortKeysOfColumn` for Revenue giving `['estimatedRevenue', 'rpm']` (the `test.each` at `video-list.test.ts:1311`); the vertical column lines of #351 (the browser walk's last step).
- **Do not touch:** the numbers table's order (`numbers-table.ts:27`, `NumbersTable.tsx:88-95`), the reference.
- **Proof:** `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/components.test.ts` with the renamed order test red before the move and green after; `pnpm build && pnpm test:browser` green.

### 3. Duplicate, exact-markup and weak tests break the one-rule-one-test rule — LOW
- **Location:** per item below (lines at `3c9112e`).
- **Attribution:** introduced on this branch by `ec38e1d` (#242), `485d85d` (#244), `14e8a85` (#264), `aaa9c94` (#439), `faef458` (#356), `06b8916` (#357); review 4 finding 3, carried unchanged in substance. None was added by a finding's fix commit.
- **Real-world trigger:** none for users; `CODING_STANDARDS.md` 2.

**Evidence and recommended fix, per item** (each as `pre-pr-review-4.md` finding 3 describes it, at its HEAD line)
- `apps/web/src/components.test.ts:201` "is a switch, named by its label" and `:208` "is described by its hint": exact class strings; rewrite against structure (the `<label>` holds the input and the label text; the element named by `aria-describedby` holds the hint and is outside the `<label>`). Keep `:215`.
- `apps/web/src/components.test.ts:720` "hides the "×" sign from a screen reader…": duplicates the first ratio test. Delete.
- `apps/web/src/placeholder.test.ts:402`, `:409`, `:424` against `apps/web/src/video-detail.test.ts:205-215`: each #439 rule at both levels. Keep the pure `detailCardCountOf` cases and the one render case at `placeholder.test.ts:409` (custom range, two places); delete `:402` and `:424`.
- `apps/web/src/app.test.ts:2067`: `rpmLineOf(container)?.startsWith('RPM: ')` cannot be false. Replace with `expect(rpmLineOf(container)).toBeDefined()`.
- `apps/web/src/metric-charts.test.ts:184` "its scale runs from zero up to the highest RPM, over the days that have one": repeats the daily scale test's `rpm: { top: 200 }`. Delete.
- `apps/web/src/metric-charts.test.ts:237-244` `rpmsOf`: test `dayRpmOf` directly over the days (daily) and over `runningTotalOf(days)` (to date), and name the tests for `dayRpmOf`.
- `apps/web/src/video-list.test.ts:363-364`: two empty-cell lines repeating the test at `:367`. Delete them.
- `apps/web/src/video-list.test.ts:1397-1399` and the `'?sort=-rpm&page=3'` and `'?sort=rpm&window=first7'` rows of the `test.each` at `:1364-1370`: green at the old merge-base, where an RPM sort parsed to `-publishedAt`. Add `expect(byRpm.sort).toBe('-rpm')` before `:1398`, and assert the parsed route's sort matches `/rpm/` for the RPM rows.
- `apps/web/src/numbers-table.test.ts:542`: an RPM sort over two no-RPM days; add a day with an RPM and assert it sorts ahead of both.
- `apps/web/src/numbers-table.test.ts:554` and `:503`: covered by the revenue column list and de-DE cell tests. Delete both.
- `apps/web/src/components.test.ts:1800`: `/<button type="button" class="sortable-heading">RPM<span/`, an exact class string. Assert the RPM `<th>` holds a `<button>` instead.

**Remediation brief**
- **Design intent:** one rule, one test, observed through rendered output or returned values, never class names (`CODING_STANDARDS.md` 2).
- **Full surface:** the locations above; no production code.
- **Must preserve:** the first ratio test in `components.test.ts` (`toEqual(['1,920 views', ratioLine])`), `components.test.ts:215`, the pure cases in `video-detail.test.ts:205-260`, the daily scale test in `metric-charts.test.ts` asserting `rpm: { top: 200 }`, `video-list.test.ts:367`, the numbers table revenue column list and de-DE cell tests, the rest of the describe at `app.test.ts:1915`.
- **Do not touch:** `newest-average.test.ts`'s per-format and per-window sentence tests; the switch-off halves of the switch tests in `channel-summary.test.ts` and `video-detail.test.ts`; the absence tests that pass at base (review 4's Test quality), which are the controls for new branches.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/placeholder.test.ts apps/web/src/video-detail.test.ts apps/web/src/app.test.ts apps/web/src/metric-charts.test.ts apps/web/src/video-list.test.ts apps/web/src/numbers-table.test.ts` green, the case count down by the deletions; the strengthened `video-list.test.ts:1398` and `numbers-table.test.ts:542` red when their file is copied onto a scratch checkout of `21534e5`.

### 4. Comment hygiene — LOW (aggregated)
Carried from review 4 finding 4, still open at HEAD:
- `apps/web/src/numbers-table.ts:24-25`: "so a sort the list gains never becomes a column of this table." → "so the list's own sorts, such as RPM, do not set this table's order. The sources are the list's source sort keys on purpose, shared with `isSourceColumn`."
- `apps/web/src/numbers-table.ts:89`: "The columns the table shows, in order: the day, then its numbers." → "The columns the table shows, in order: the day, its numbers, then the revenue columns with RPM when revenue shows."
- `packages/api-types/src/videos.ts:333-334`: "(under `all`, of any format, those Google gives none too)" → "(under `all`, any format, including uploads Google gives no format)"
- `apps/web/src/metric-charts.ts:83`: "or null with no engaged views or no revenue on the day" → "or null with no engaged views, or on a day that carries no revenue amount; a day of $0 with engaged views is 0"
- `apps/web/src/Placeholder.tsx:94`: "which shows only once the answer carries revenue" → "the revenue and RPM charts, which show only once the answer carries revenue"
- `apps/api/src/preferences.test.ts:158-159`: "off by default, so a GET of a user who never touched it names no value." → "saved and read back; off by default means the key is absent until saved." (or add `expect(await read(browser)).toEqual({ status: 200, body: {} })` before the save and keep the comment)

New in this delta:
- `packages/database/test/migrations.test.ts:9-10` (introduced by `3c9112e`): "the migrator runs migrations in journal order and skips one older than the last applied" → "the migrator runs migrations in journal order and skips one not later than the newest applied". Then add, per `CODING_STANDARDS.md` 2 (a test states its own limits): "It reads the folder only: it does not check a SQL file against its snapshot, and it cannot see a database that already applied an older numbering of the folder."
- `apps/site/test/screenshot/browser-walk.ts:7-27` (header rewritten by the merge `22571ca`, wording from the base): the desktop step `'state: sidebar support item'` (`:406`) runs right after `'state: profile support section'` (`:399`), not "at the desktop width after the list's route" near the end. Move "the sidebar's support item, its link and its Hide button, at the desktop width (creator-analytics#413)" up beside the profile's Support section, and keep "and at 375px" where it is. The header also names neither `'state: stacked charts click'` (`:1704`) nor `'state: wrapped cards row as tall as its placeholders'` (`:2175`); add both in their places.
- `apps/site/test/screenshot/browser-walk.ts:1701-1702` (pre-existing from `69dddbc`, widened: the base had four steps after it, this branch adds four more): "the one step after it loads the screen afresh." → "every step after it loads its screen afresh."
- `apps/web/src/Profile.tsx:35-43` (pre-existing, from the base): the doc comment does not name the thanks line rendered first (`:106`). Add "the thanks line after Stripe's return," before "the creator's channels".

## Needs Further Investigation
### A. An upcoming public live stream or Premiere may count in the newest average with zero engaged views — confirm what Google answers for an upcoming broadcast
Carried from reviews 1 to 4, unchanged. Confirmed by a recorded Data API answer for an upcoming public broadcast showing `privacyStatus: public` with no `actualStartTime`, and the newest average counting it; it dies if Google reports such an upload as scheduled or partial.

### B. The RPM plot's unseen every-day focus line may be exposed to assistive technology on a gap day
Carried from review 4, unchanged. `apps/web/src/metric-plot.ts:127-135` adds a non-decorative line, id `every-day`, along the bottom edge when an RPM day has no value. Confirm with VoiceOver in Safari or Chrome on a window with a zero engaged views day that the RPM chart announces nothing extra; kill it if so.

## Reviewed and Dismissed
- A database that ran this branch's old 0016/0017 before the renumbering: drizzle's migrator compares each migration against only the newest applied `created_at`, so such a database would skip the base's 0016 and 0017 and then fail loudly on 0019's `ADD COLUMN` ("column already exists"), rolling the whole migrate back. Not reachable for users: the branch never deployed, `docs/deploy.md` names only the production `migrate` job (no preview databases), production applied the base's 0016/0017 at earlier times than 0018/0019, and the test suite starts a fresh Testcontainers database. Only a local dev database Nick migrated on this branch before `22571ca` is affected; recreate it rather than editing `__drizzle_migrations` (Before opening the PR).
- `migrations.test.ts` passes 4/4 at `7d7c506` — expected: the base's folder is consistent. Each test was shown red in a bad state it names (Test quality), so it is a guard, not a vacuous test.
- `migrations.test.ts` tests 2 and 3 build their expected filenames from the journal — they compare the journal with a separate directory listing, so they are not identities. Dropping the last entry and its files together is folder-consistent and caught by test 4; dropping a middle entry is caught by test 1.
- `apps/api/src/preferences.test.ts:160-178`, the two near-copy RPM save tests — review 4 kept them for their exact-body GET read-back. Leave them.
- The merge's two `onLand` → `onTableRead` edits in `components.test.ts:1691` and `:1760` — the base's prop rename, required for the branch's new list tests to compile. Correct.
- Reset preferences clears `supportPromptDismissed` along with the RPM switch — the base's own rule (`packages/api-types/src/preferences.ts`: "Reset preferences clears it"), and `App.tsx` reads the support answer again after a reset.
- The RPM chart press at 375px in the walk may save a chart card choice — no base walk step depends on the chart card, and the walk passed.
- Carried from review 4 and still valid: the API RPM sort's comparator, the running-total RPM caveat, `metric-charts.ts`'s type-narrowing filter, the newest average sentence held while a new window reads, `newest-average.ts`'s `count < 2` guard, a 1,000× ratio line, a saved `?card=rpm` with no window RPM, #439's card count, the Profile switch showing off until preferences land, the switch having no failed-save test of its own, and the type-widening tests that pass at base. See `pre-pr-review-4.md` Reviewed and Dismissed for each reason.

## Minor / nits
- `packages/database/test/migrations.test.ts:33`: `expect(new Set(journal.map(({ tag }) => tag.slice(0, 4))).size).toBe(journal.length)` cannot fail while `:31` (idx equals place) and `:32` (each tag starts with its idx) pass. Delete the line.
- `packages/database/test/migrations.test.ts:57`: a rename-shaped schema change makes test 4 red with drizzle-kit's "Interactive prompts require a TTY terminal" rather than a message naming `drizzle-kit generate`. The test still fails, which is what matters.
- `apps/api/src/delete-user.test.ts:107` saves `rpmAdsAndPremiumOnly: true` though the test asserts only that the row is gone; the key changes nothing it checks. Revert to `{ chartMode: 'aggregate' }` if the file is next touched.
- Carried from review 4: `packages/api-types/src/index.ts:97` re-exports `revenueSortKeys`, which no app imports any more; `apps/site/test/screenshot/stub-api.ts` sorts RPM over the whole revenue whatever the saved switch says; comment lines over the 100-column width (`MetricCharts.tsx`, `route.ts`); no API test pages an RPM sort; `newest-average.test.ts` "names the days" runs four windows through one branch; `apps/web/test/web.test.ts` still has no assertion reading `.card`'s `min-height: var(--card-place)` (review 3 finding 2).

## Test quality
Tests added in the delta: 4, all in `packages/database/test/migrations.test.ts`; the merge changed two test call sites (`onLand` → `onTableRead`) and lost or doubled no test of either side (per-title three-way count over `app.test.ts`, `components.test.ts`, `placeholder.test.ts`, `video-list.test.ts`, `test/web.test.ts`: zero mismatches; every name and case row of both parents of `apps/api/src/preferences.test.ts` present).

Oracle, run in scratch worktrees under the session scratchpad and removed afterwards:
- At `7d7c506` with HEAD's test copied in: 4/4 green, as expected for a consistent folder.
- At `b4b9e1a` with `git merge --no-commit 7d7c506`, journal as the naive union of both sides (two idx 16, two idx 17), all four SQL files kept: test 1 red, test 3 red, test 4 red (`rpm_ads_and_premium_only` and the chart card check missing), test 2 green.
- The same merge with the journal taken from `b4b9e1a` only: test 2 red (`0016_preferences_support_prompt_dismissed.sql`, `0017_tips.sql` unlisted), test 4 red.
- At HEAD, a nullable column added to `packages/database/src/preferences.ts` with no migration: test 4 red (`ALTER TABLE "preferences" ADD COLUMN …`). The last journal entry's `when` set below the one before: test 1 red. 0018's snapshot re-parented onto 0016's id: test 3 red.

Tautology shapes: no mocks, no generated snapshot as the expected value, every test asserts. One redundant assertion (Minor / nits). The audit of the branch's earlier tests stands as review 4 recorded it.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and tests green at `3c9112e`; the browser walk green (35 steps). The PR base has not moved since the merge.
- **Local database:** a dev database migrated on this branch before `22571ca` holds the old 0016/0017 numbering; recreate it before running the app on it (Reviewed and Dismissed, first bullet).
- **Commit hygiene:** commit this doc. No new repro: finding 1's proof is still `repro/summary-rpm-switch-reread.sh`.
- **Likely reviewer asks:** the migration renumbering and the new migrations test; the list's RPM placement (finding 2); the Reset preferences warning, whose approved text does not name the RPM switch (#357 assumption).

## Verdict
Ready to open the PR with follow-ups. Review 4's one gate, the merge of the moved base with the migrations renumbered, is done and correct, and every full check is green. No finding is MEDIUM or higher. Findings 1 to 4 are LOW: three carried untouched from review 4 (no remediation pass ran on it), plus the comment hygiene list, which gains five drift entries from this delta. The confirmed list holds steady only because nothing was remediated; the delta itself added no behaviour defect. Finding 1 is still the one worth doing first, and finding 2 is still Nick's product call.
