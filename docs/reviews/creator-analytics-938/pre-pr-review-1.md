# Pre-PR review: creator-analytics#938 Sponsor report

**Branch:** `creator-analytics-938-sponsor-report` vs `origin/main` (merge-base `50d69539`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `91d1cb92` (creator-analytics#958 Describe the sponsor report in the FAQ and its Pro figures on the upgrade screen) + 0 files with uncommitted changes, 46 files total, +6168 / −21
**Reviewed against:** epic #938 and its sub-issues #956, #957 and #958 (bodies read with `gh`), `CONTEXT.md`, `README.md`, ADRs 0002, 0003, 0013, 0014 and 0017, the global rules in `~/.claude/rules/`, the repo rules `.claude/rules/row-level-security-tests.md` and `.claude/rules/youtube-test-limits.md`. This folder held no review docs before this one, and no spec or plan under `docs/` names #938.
**Date:** 2026-11-20
**Reviewer:** 3 code-review agents + verify pass
**Gemini:** skipped, Gemini failed: an HTTP or network error, or the 10-minute timeout (exit 14). `gemini-review` printed `gemini-ask: network error: UND_ERR_INFO`

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok |
| Lint | `pnpm lint` | green (840 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Test suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 218 files, 5507 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | green ("The browser walk passed") |
| Finding 1 | `TZ=Asia/Tokyo pnpm exec vitest run src/sponsor-report.test.ts` from `apps/web`; the preserved case `repro/publish-date-pacific-day.case.ts` pasted into `apps/web/src/sponsor-report.test.ts` in a scratch worktree at HEAD and run under `TZ=Europe/London` | red both ways: "expected 'Published October 2, 2026' to be 'Published October 1, 2026'" (Tokyo, existing test) and "expected 'Published March 4, 2024' to be 'Published March 3, 2024'" (London, repro). `TZ=Europe/London` runs the existing file green, 38/38 |
| Findings 4 and 5 | Three mutants together in a scratch worktree at HEAD: `recordActivityDay(database),` deleted from the GET; `onConflictDoUpdate` replaced by `onConflictDoNothing()` in `saveSponsorChoice`; the web policy's `WITH CHECK` replaced by `WITH CHECK (true)` in migration 0037. Then `pnpm exec vitest run apps/api/src/sponsor-report.test.ts apps/api/src/activity-days.test.ts packages/database/test` | all three mutants survived: 16 files, 202 tests green |
| Finding 4's fix | The `channelReads` entry from finding 4 added in the same scratch worktree and `apps/api/src/activity-days.test.ts` run with the activity-day mutant on, then with it off | red with the mutant on (1 failed: "a signed-in read of the sponsor report leaves one activity day"), green with it off (16/16) |
| Tautology audit (Phase 4.5) | An agent checked out `50d69539` in a scratch worktree, copied in the branch's 11 new or changed test files and the 3 helpers, and ran them | 86 test definitions added or changed. 9 cases are green at base, none of them a review fix's proof (`git log -S` points each at `5b8baddc`). See Test quality |
| Fake Google against real Google | Not run: the fake's claims about Google's "Video reports" metric combinations can't be checked from here | not run; the human step is named in the headers of `apps/api/src/sponsor-report.test.ts` and `packages/fake-google/src/fake-google.test.ts` |
| One-page light print | Not run: happy-dom lays nothing out and prints nothing | not run; it rests on Nick's print preview, and `.epic-loop/tickets/956/proposals.md` already proposes a browser-walk check |

**Overall:** the API, database and gateway layer holds. The windows are counted correctly. Revenue is refused before any Google call. CTR is computed from counts, never by averaging ratios. Row-level security on the new table matches every other channel-owned table. All the repo's checks are green. One MEDIUM finding should be fixed before the PR opens: the printed publish date uses the reader's time zone, while the windows count from the Pacific day, and one test goes red for anyone east of UTC+8. The rest are LOW: a save race and a fallback in the checklist, three coverage gaps proved by surviving mutants, an awaiting-processing edge, the copy tests the #958 ticket asked for, and refactors the branch walked past.

## Approach decisions
- Serialising the checklist's saves: through `writeQueue` from `apps/web/src/preferences.ts`, held once per component with `useState(writeQueue)` as `apps/web/src/App.tsx:301` does, with the existing `turn` guard kept for the re-read (finding 2).
- The publish line's day: the Pacific day from `pacificDayOf`, which the API counts day 1 from, formatted by `longDateOf` as the "Data through" line already is (finding 1).
- A channel-owned table's write refusal: a per-table Postgres test in `packages/database/test/`, mirroring `packages/database/test/preferences.test.ts:51` (finding 5).
- The stricter history coverage (every day of the window, not `historyPartialOf`'s forgiveness after the newest day) is #957's recorded decision and stands. See Reviewed and Dismissed.

## Confirmed Issues
### 1. The printed publish date uses the reader's time zone, but the windows and "Data through" count from the Pacific day — MEDIUM
- **Location:** `apps/web/src/sponsor-report.ts:212-220` (`sponsorPublishedOf`)
- **Found by:** Claude
- **Attribution:** introduced in `5b8baddc` (creator-analytics#956 A printable sponsor report of one video's first 7, 14 and 30 days). `git log -S'new Date(publishedAt).toLocaleDateString' 50d69539..HEAD -- apps/web/src/sponsor-report.ts` names only that commit, and the file does not exist at base.
- **Real-world trigger:** a creator outside the Pacific zone, in the UK say, prints a report for a video published in the US afternoon or evening (16:00 to 24:00 Pacific is the next UTC day). The PDF the sponsor gets reads "Published March 4", "First 30 days" and "Data through April 1", which is 29 days. The window actually starts on March 3, the Pacific day. East of UTC+8 the shift catches morning publishes too. That same shift turns the file's own test red: `apps/web/src/sponsor-report.test.ts:198` fails under `TZ=Asia/Tokyo`.

**Evidence**
```ts
export function sponsorPublishedOf(
  { publishedAt, scheduled }: Pick<SponsorReportAnswer['video'], 'publishedAt' | 'scheduled'>,
  locale?: string,
): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt).toLocaleDateString(locale, { dateStyle: 'long' })
  return scheduled ? `Scheduled for ${date}` : `Published ${date}`
}
```
`sponsorDataThroughOf`, a few lines above it, counts from `pacificDayOf(video.publishedAt)`, and so does the API through `publishDayOf` → `reportingDayOf` (`apps/api/src/uploads.ts:66-69`).

**Failure mode:** take `publishedAt: '2024-03-04T07:30:00.000Z'` (March 3 in Pacific time) with `lastProcessedDay: '2024-06-01'`. Under `TZ=Europe/London` the publish line reads "Published March 4, 2024" while the Data through line reads "Data through April 1, 2024". Executed: the case below is red at HEAD with "expected 'Published March 4, 2024' to be 'Published March 3, 2024'". The existing test is red under `TZ=Asia/Tokyo` with "expected 'Published October 2, 2026' to be 'Published October 1, 2026'".

**Recommended fix**
```diff
-  const date = new Date(publishedAt).toLocaleDateString(locale, { dateStyle: 'long' })
+  const date = longDateOf(pacificDayOf(publishedAt), locale)
   return scheduled ? `Scheduled for ${date}` : `Published ${date}`
```
Both `longDateOf` and `pacificDayOf` are already imported in that file, since `sponsorDataThroughOf` uses them. Change the function's doc line, "in the reader's long date format", to say it is the Pacific day the windows count from, in the reader's long date format.

**Remediation brief**
- **Design intent:** a sponsor report counts every window from the video's publish day in Pacific time (the reporting day, `reportingDayOf`/`pacificDayOf`), the publish day being day 1, and its "Data through" day from the same anchor. Every date the page prints has to agree with that anchor, so the printed document is self-consistent whatever the reader's time zone. `longDateOf` formats a `YYYY-MM-DD` day at UTC midnight in UTC, so it never shifts.
- **Full surface:** `apps/web/src/sponsor-report.ts:212-220` (the function and its doc line). Its single caller is `apps/web/src/SponsorReport.tsx:240`. The test that pins it is `apps/web/src/sponsor-report.test.ts:196-202`. `apps/web/src/video-list.ts:425` also formats a publish time in local time, but it is a list cell with no Pacific-counted window beside it, so it stays out of scope.
- **Must preserve:** `null` for a video with no `publishedAt`; the "Scheduled for" wording for a scheduled video and "Published" otherwise; the long date style, which is the format `longDateOf` already writes ("October 1, 2026"). Two existing tests must stay green under any `TZ`: `the day the data runs through and the publish date are long dates` (`apps/web/src/sponsor-report.test.ts:196`), and the `test.each` of the 30th day just below it.
- **Do not touch:** `sponsorDataThroughOf`. It is right and tested, and it is the #956 review pass 1 finding 2 fix (`3363ba0b`).
- **Proof:** paste the case in `docs/reviews/creator-analytics-938/repro/publish-date-pacific-day.case.ts` (from its `test(` line) as the last test of describe "a sponsor report's figures, as the page writes them" in `apps/web/src/sponsor-report.test.ts`, then run `TZ=Europe/London pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'` from the repo root. It is red at HEAD and must be green after the fix. Then run `TZ=Asia/Tokyo pnpm exec vitest run apps/web/src/sponsor-report.test.ts`, which must be green, 39/39. Rename the case without the `repro:` prefix when it lands.

### 2. Two quick ticks in the figure checklist send their saves at once, so the older choice can be the one stored — LOW
- **Location:** `apps/web/src/SponsorReport.tsx:176-194` (`choose`)
- **Found by:** Claude
- **Attribution:** introduced in `05292899` (creator-analytics#957 Choose the sponsor report's figures, remembered per channel, with impressions and CTR for Pro).
- **Real-world trigger:** a creator ticks two boxes within one round trip on a slow connection. Both PUTs are in flight together, and when the first one commits after the second, the channel stores the first choice. The page then shows the second choice, but the next visit, and every other member's report, opens with the first. If the first commits between the second's PUT and its re-read, the boxes jump back to the first choice. This is capped at LOW because it needs the server to reorder two requests one tick apart. The finding also departs from the repo's own answer to this problem (`nearest-in-repo-precedent`).

**Evidence**
```ts
turn.current += 1
const mine = turn.current
setPending(figures)
setChoiceFailure(null)
const failure = await saveSponsorChoice(channelId, figures)
if (turn.current !== mine) return
```
The `turn` guard drops only the first save's continuation. It does not stop the first request from reaching the server after the second. `apps/web/src/preferences.ts:316-327`'s `writeQueue` exists for exactly this case: it starts each write once the one before it has settled. `App.tsx:301` uses it for preferences.

**Failure mode:** tick A, then tick B before A's PUT answers. `api.requests` then holds two PUTs to `sponsor-figures` while the first is unanswered. The stored choice is whichever commits last. This was not executed: the fake API settles in order, so the reorder itself can only be shown on a real server.

**Recommended fix**
```diff
+  const [saveInTurn] = useState(writeQueue)
   const turn = useRef(0)
 ...
-    const failure = await saveSponsorChoice(channelId, figures)
+    const failure = await saveInTurn(() => saveSponsorChoice(channelId, figures))
     if (turn.current !== mine) return
```
Add `writeQueue` to the imports, from `./preferences.ts`.

**Remediation brief**
- **Design intent:** the checklist shows the pending choice (`pending`) ahead of the answer. Each tick stores the whole choice with PUT, then reads the report again. Only the latest tick's continuation lands, through `turn`. The stored choice must be the last one the creator made, so the writes have to reach the server in click order, as preferences' writes do.
- **Full surface:** `apps/web/src/SponsorReport.tsx:157-194` (the state and `choose`) and the import at `SponsorReport.tsx:9-11`. Writes to `sponsor-figures` have no other caller (`git grep sponsorChoicePathOf apps/web/src`).
- **Must preserve:**
  - The `turn` guard on both awaits, so a channel switch or a newer tick drops a stale continuation.
  - A failed save clears `pending` and shows its text. `a refused save shows its text and keeps the last answer's boxes and rows` in `apps/web/src/sponsor-report.test.ts` pins this.
  - The current report stays on screen while the next one is read, pinned by `keeps showing the current report while the next one is read`.
  - The fix's own failure case: a queued save after a failed one still runs, because `writeQueue` catches the predecessor, and its own failure still reaches `choose` through `saveSponsorChoice`'s return.
- **Do not touch:** the effect's `latestOnly` read (`SponsorReport.tsx:164-173`). See Reviewed and Dismissed.
- **Proof:** add a test to the checklist describe in `apps/web/src/sponsor-report.test.ts`:
  1. Render `videos/video-1/sponsor-report`.
  2. `const held = api.hold(\`PUT ${choicePath}\`)`.
  3. Click "Likes", then "Comments".
  4. Assert `api.requests.filter((r) => r.method === 'PUT' && r.path === choicePath)` has length 1.
  5. `held.release()`, then `await settle()`.
  6. Assert two such requests, the second one's body without `likes` and without `comments`, and `api.sponsorChoice` equal to the second body's `figures`.

  At HEAD the first length assertion is red (2). Run it with `pnpm exec vitest run apps/web/src/sponsor-report.test.ts`.

### 3. A save that lands followed by a refused re-read puts the old choice back on the boxes, and the next tick reverts the saved one — LOW
- **Location:** `apps/web/src/SponsorReport.tsx:189-193`
- **Found by:** Claude
- **Attribution:** introduced in `05292899`.
- **Real-world trigger:** the PUT succeeds and the GET that follows fails, for example on a network drop or a Google refusal such as quota. `pending` clears, so the boxes fall back to the old `answer.figures` while the server holds the new choice. The alert shows the read's refusal, which reads as if the change did not save. The next tick is then built from the stale boxes and stores a choice that drops the earlier change. The fallback path has no test (`test-every-fallback-path`).

**Evidence**
```ts
const next = await readSponsorReport(channelId, video)
if (turn.current !== mine) return
setPending(null)
if (next.kind === 'report') setView(next)
else setChoiceFailure(next.message)
```

**Failure mode:** the starting choice is the nine. Untick Likes: the PUT answers 200 and stores eight, then the GET fails. The boxes show Likes ticked again, while the stored choice has no Likes. Tick Comments off next, and `nextChoiceOf` builds from the stale boxes, so the stored choice becomes the nine less Comments, Likes back in. Found by reading. `failNext` is used in the file only for the first GET and for a PUT, never for a GET after a successful PUT.

**Recommended fix**
```diff
     const next = await readSponsorReport(channelId, video)
     if (turn.current !== mine) return
-    setPending(null)
-    if (next.kind === 'report') setView(next)
-    else setChoiceFailure(next.message)
+    if (next.kind === 'report') {
+      setPending(null)
+      setView(next)
+    } else setChoiceFailure(next.message)
```

**Remediation brief**
- **Design intent:** `pending` is the choice on screen ahead of the answer. Once a save has landed, the stored choice is `pending`. So when the read that follows fails, the boxes must keep showing what is stored, and the next tick must build on it. The table keeps the last answer either way.
- **Full surface:** `apps/web/src/SponsorReport.tsx:189-193`. `chosen={pending ?? answer.figures}` at `SponsorReport.tsx:221` is what keeps the boxes on the stored choice.
- **Must preserve:**
  - A failed save (the `failure !== null` branch at `:184-188`) still clears `pending`, since nothing was stored.
  - A successful re-read still clears `pending` and shows the new view.
  - The effect's reset of `pending` on a channel or video change (`:168`).
  - `a refused save shows its text and keeps the last answer's boxes and rows` stays green.
  - The fix's own failure case: a later successful tick still clears `pending`, through the success branch.
- **Do not touch:** finding 2's queue, if it has landed. The two compose.
- **Proof:** add a test to `apps/web/src/sponsor-report.test.ts`:
  1. Render the report.
  2. `api.failNext(\`GET ${reportPath}\`)`.
  3. Click "Likes".
  4. Assert `boxNamed(reportOf(container), 'Likes').checked` is false, the alert shows, and `api.sponsorChoice` lacks `likes`.

  At HEAD the checked assertion is red (true). Run it with `pnpm exec vitest run apps/web/src/sponsor-report.test.ts`.

### 4. No test pins that reading a sponsor report records an activity day — LOW
- **Location:** `apps/api/src/routes/sponsor-report.ts:45`; the test list at `apps/api/src/activity-days.test.ts:57-62`
- **Found by:** Claude
- **Attribution:** introduced. The branch adds the read and its `recordActivityDay` (`5b8baddc`), and names it in `README.md:75`, but it leaves `channelReads`, the list the activity-day suite walks, at "the four routes that read a channel's numbers". This is a `whole-surface-of-a-change` miss.
- **Real-world trigger:** a later change drops or reorders the middleware, and the daily active user count silently stops counting users who only open sponsor reports. No test goes red. Capped at LOW: the code is right today.

**Evidence**
```ts
/** The four routes that read a channel's numbers. */
const channelReads = [
  ['the video list', (channelId: string) => `/api/channels/${channelId}/videos`],
  ['a video detail', (channelId: string) => `/api/channels/${channelId}/videos/${upload.videoId}`],
  ['the channel summary', (channelId: string) => `/api/channels/${channelId}/summary`],
  ['the audience', (channelId: string) => `/api/channels/${channelId}/audience`],
] as const
```

**Failure mode:** executed. With `recordActivityDay(database),` deleted from the GET, `apps/api/src/sponsor-report.test.ts`, `apps/api/src/activity-days.test.ts` and `packages/database/test` all stay green.

**Recommended fix**
```diff
-/** The four routes that read a channel's numbers. */
+/** The five routes that read a channel's numbers. */
 const channelReads = [
   ...
   ['the audience', (channelId: string) => `/api/channels/${channelId}/audience`],
+  [
+    'the sponsor report',
+    (channelId: string) => `/api/channels/${channelId}/videos/${upload.videoId}/sponsor-report`,
+  ],
 ] as const
```

**Remediation brief**
- **Design intent:** a signed-in read of a channel's numbers inserts one activity day for the user on the UTC day, and the `activeUserCount` job counts it (`README.md:75`). `channelReads` is the suite's list of those reads. Every `test.for(channelReads)` covers each entry: one activity day, the UTC day, and none when signed out.
- **Full surface:** `apps/api/src/activity-days.test.ts:57-62`, the list and its doc line. Every `test.for(channelReads)` in that file picks up the new entry with no other change.
- **Must preserve:** the four existing entries and their tests.
- **Do not touch:** `apps/api/src/routes/sponsor-report.ts:45`, which is right.
- **Proof:** executed in a scratch worktree. With the entry added and `recordActivityDay(database),` deleted from `apps/api/src/routes/sponsor-report.ts`, `pnpm exec vitest run apps/api/src/activity-days.test.ts` is red: "a signed-in read of the sponsor report leaves one activity day for the user, on the UTC day". With the line restored it is green, 16/16.

### 5. The stored choice's write is never checked in the database: neither the policy's write refusal nor the replace — LOW
- **Location:** `packages/database/drizzle/0037_sponsor_report_figures.sql:11` (the `sponsor_report_figures_web` policy's `WITH CHECK`); `apps/api/src/sponsor-choice.ts:18-28` (`saveSponsorChoice`); the tests at `apps/api/src/sponsor-report.test.ts:529` and `:592`
- **Found by:** Claude
- **Attribution:** introduced in `05292899`.
- **Real-world trigger:** none today. The policy is right, and the route's `heldChannelsOf` guard refuses a non-member before any write. The cost is coverage. `a creator who is no member of the channel gets not_connected and changes nothing` is decided by the route guard, so it would stay green with a policy that admits every write. `a choice of every figure the types allow is stored, so the database holds the same set` asserts only the PUT's echo of its own input, which is computed before the write, so it says nothing about what the database holds. Tenant isolation is a MEDIUM-cap class. This stays LOW because the code is correct and only the test is missing. Upgrade it to MEDIUM if the route guard is ever removed or bypassed.

**Evidence**
```ts
const held = (await heldChannelsOf(tx)).some((each) => each.channelId === channelId)
if (held) await saveSponsorChoice(tx, channelId, choice.figures)
```
```ts
expect(saved).toEqual({ status: 200, body: { figures: [...sponsorReportFigures] } })
expect(replaced).toEqual({ status: 200, body: { figures: ['shares'] } })
```

**Failure mode:** executed. With the web policy's `WITH CHECK` replaced by `WITH CHECK (true)` in migration 0037, and `onConflictDoUpdate(...)` replaced by `onConflictDoNothing()`, `apps/api/src/sponsor-report.test.ts`, `apps/api/src/activity-days.test.ts` and `packages/database/test` (16 files, 202 tests) all stay green. `scopes.test.ts` covers the read half (`USING`) for every channel-owned table through the new seed row, but not the write half.

**Recommended fix:** two tests, no production change.
- A new file, `packages/database/test/sponsor-report-figures.test.ts`, mirroring `packages/database/test/preferences.test.ts` near `:51`, on the database harness as the `app` role in `web.asUser`. It covers three cases:
  - A user with no membership of a seeded channel inserts that channel's row, and gets "new row violates row-level security policy for table \"sponsor_report_figures\"".
  - A non-owner member's insert and upsert are admitted.
  - The owner's row, read back in the owner's scope, is unchanged after the refused write.
- Extend `apps/api/src/sponsor-report.test.ts:592` so that after each PUT it reads the report with no `figures` on a history-readable channel and asserts `body.figures`: the eleven, then `['shares']`.

**Remediation brief**
- **Design intent:** `sponsor_report_figures` is channel-owned (ADR 0002), one row per channel, written by any member of the channel whatever its role, and refused to anyone else by the `channelOwned` web policy, `USING` and `WITH CHECK` alike. A PUT replaces the whole choice. Only Postgres can show what the policy admits (`.claude/rules/row-level-security-tests.md`).
- **Full surface:** a new file `packages/database/test/sponsor-report-figures.test.ts`; `apps/api/src/sponsor-report.test.ts:592-` (the test body). Seed helpers live in `packages/database/test/seed.ts`, which already seeds a `sponsorReportFigureChoices` row, and `packages/database/test/harness.ts`.
- **Must preserve:** `scopes.test.ts`'s generic read coverage and `seed.ts`'s row. The test at `:529`, which is the route-level half.
- **Do not touch:** migration 0037 and `channel-owned.ts`. The policy is correct.
- **Proof:** re-run the mutation. In a scratch worktree, set the web policy's `WITH CHECK` to `(true)` in `packages/database/drizzle/0037_sponsor_report_figures.sql`, then run `pnpm exec vitest run packages/database/test/sponsor-report-figures.test.ts`: it must be red. Change `onConflictDoUpdate(...)` to `onConflictDoNothing()` in `apps/api/src/sponsor-choice.ts`, then run `pnpm exec vitest run apps/api/src/sponsor-report.test.ts`: it must be red. Both must be green unmutated.

### 6. A video awaiting processing prints a "Data through" day before its publish day, and its export event counts nine figures it does not show — LOW
- **Location:** `apps/web/src/SponsorReport.tsx:244` and `apps/web/src/sponsor-report.ts:197-210` (`sponsorDataThroughOf`); `apps/web/src/sponsor-report.ts:223-226` (`sponsorExportEventOf`)
- **Found by:** Claude
- **Attribution:** introduced in `5b8baddc`.
- **Real-world trigger:** a creator opens the report for a video published in the last two or three days, or for a scheduled one. `awaitingProcessing` is then true and `lastProcessedDay` falls before the publish day. `sponsorWindowEndOf` returns `lastProcessedDay`, so the page reads "Published November 19" above "Data through November 16". The table is replaced by the not processed text, yet "Save as PDF" sends `figures: 9`. That misstates the count `README.md:144` defines as "the count of figures the sponsor report shows". This is a confusing display and analytics noise, so LOW.

**Evidence**
```tsx
<SponsorReportTable answer={answer} />
<p className="note">{sponsorDataThroughOf(answer)}</p>
```
```ts
return { name: 'sponsor_export_downloaded', figures: answer.figures.length }
```

**Failure mode:** found by reading. `a video awaiting processing shows the not processed text in the table's place, and keeps the button` (`apps/web/src/sponsor-report.test.ts:387`) asserts neither line nor count.

**Recommended fix**
```diff
-          <p className="note">{sponsorDataThroughOf(answer)}</p>
+          {!answer.awaitingProcessing && <p className="note">{sponsorDataThroughOf(answer)}</p>}
```
```diff
-export function sponsorExportEventOf(answer: Pick<SponsorReportAnswer, 'figures'>): ProductEvent {
-  return { name: 'sponsor_export_downloaded', figures: answer.figures.length }
+export function sponsorExportEventOf(
+  answer: Pick<SponsorReportAnswer, 'figures' | 'awaitingProcessing'>,
+): ProductEvent {
+  return {
+    name: 'sponsor_export_downloaded',
+    figures: answer.awaitingProcessing ? 0 : answer.figures.length,
+  }
 }
```

**Remediation brief**
- **Design intent:** the report states the day its data runs through (ADR 0017) only when it has data. A video Google has processed no day of shows `notProcessedText` in the table's place and keeps the button, by #956's recorded choice. The event's `figures` is the number of figures the printed page shows.
- **Full surface:** `apps/web/src/SponsorReport.tsx:244` and `:207`; `apps/web/src/sponsor-report.ts:223-226`; every caller of `sponsorExportEventOf` (`git grep sponsorExportEventOf apps/web/src`), the tests in `apps/web/src/sponsor-report.test.ts` included; the README event line at `README.md:144`, which needs no change because it already says "shows".
- **Must preserve:**
  - The button stays for an awaiting video. The 387 test pins it.
  - The Data through line and the count are unchanged for a processed video. The tests at `:196` and `:327`, and the export tests that expect `figures: 9` and `figures: 10`, pin them.
- **Do not touch:** `sponsorWindowEndOf` and `sponsorDataThroughOf`'s day arithmetic.
- **Proof:** extend the test at `apps/web/src/sponsor-report.test.ts:387`. Assert that no paragraph's text starts with "Data through". Click "Save as PDF", and assert `vi.mocked(track).mock.calls` equals `[[{ name: 'sponsor_export_downloaded', figures: 0 }]]`. Both are red at HEAD. Run `pnpm exec vitest run apps/web/src/sponsor-report.test.ts`.

### 7. Three new tests pin fixed copy, as #958's ticket asked, against the global rule tests-state-a-rule — LOW
- **Location:**
  - `apps/site/test/site.test.ts:1399`, the FAQ answer, word for word.
  - `apps/site/test/site.test.ts:1343`, the Pro card `<li>`, word for word, and no "sponsor report" on the Free card.
  - `apps/web/src/upgrade.test.ts:43`, the Reach card's two lines.
  - `apps/web/src/app.test.ts:8959`, the new line in the card-shape expectation.
- **Found by:** Claude
- **Attribution:** introduced in `dcce7f01` (creator-analytics#958 Describe the sponsor report in the FAQ and its Pro figures on the upgrade screen).
- **Real-world trigger:** no user path. Each test fails when the copy is edited, never when code breaks. The global rule says copy is held by Nick's approval, not the suite. #958's acceptance criterion says "`site.test.ts` and `upgrade.test.ts` pin the copy". The plan and the standard disagree, and that disagreement is the finding.

**Evidence**
```ts
expect(reach?.lines).toEqual([
  'Impressions and click-through rate beside engaged views, in your summary, charts, video list and traffic sources.',
  "A video's sponsor report can include them too.",
])
```

**Failure mode:** these assertions restate the source, so they state no rule. One part of `site.test.ts:1343` is arguably a rule over the copy rather than copy: the Free card names no sponsor report, because the report is free and only its Pro addition is listed.

**Recommended fix:** Nick's decision. Either keep the tests as #958 asks, or delete the literal assertions and keep only the Free card's absence check.

**Remediation brief**
- **Design intent:** the copy is approved word for word by Nick on the epic's PR (#958). Under `tests-state-a-rule`, that approval, not a test, holds the copy.
- **Full surface:** the four locations above.
- **Must preserve:** `app.test.ts:8959`'s card-shape assertions other than `lines`, such as title, counts and dashed.
- **Do not touch:** the copy itself.
- **Proof:** none. This is a standards decision.
- **Remediation scope:** not for the loop. Leave these tests as they are, and raise the conflict with Nick on the PR, because the ticket's acceptance criterion asks for them.

### 8. Refactors the branch walked past — LOW
- **Location:**
  - `apps/api/src/routes/sponsor-report.ts:23-31`
  - `packages/fake-google/src/reports/video-sponsor-figures.ts:28-33`
  - `apps/api/src/sponsor-report.ts:74-83`
- **Found by:** Claude
- **Attribution:** introduced in `05292899` and `5b8baddc`.
- **Real-world trigger:** none. These are `leave-the-code-better` and `nearest-in-repo-precedent` departures: each repeats a helper the module already reads.

**Evidence**
- `jsonOf` in `apps/api/src/routes/sponsor-report.ts:25-31` is a verbatim copy, comment included, of `apps/api/src/routes/preferences.ts:14-20`.
- `metricNamesOf` in `packages/fake-google/src/reports/video-sponsor-figures.ts:28-33` re-implements `metricsAmong` from `packages/fake-google/src/reports/report.ts:176`.
- `historyDaysOf` in `apps/api/src/sponsor-report.ts:74-83` repeats `heldCountOf` and `dayCountOf` from `apps/api/src/video-history.ts:77-88`, both private there.

**Failure mode:** two copies of one rule drift apart.

**Recommended fix:**
- Move `jsonOf` into one shared module, for example `apps/api/src/json-body.ts`, and import it from both routes.
- Export `metricsAmong` from `report.ts` and use it in place of `metricNamesOf`.
- Export `heldCountOf` and `dayCountOf` from `video-history.ts` and build `historyDaysOf` from them as `{ days: heldCountOf(range, held), of: dayCountOf(range) }`.

**Remediation brief**
- **Design intent:** one helper per rule. `jsonOf` turns a malformed JSON body into `undefined`, so the route answers 400 rather than 500. `metricsAmong` accepts a query whose metrics are all in a given set. `heldCountOf` and `dayCountOf` count a range's held days and its days.
- **Full surface:** the three locations above, their originals, and `git grep -n "function jsonOf\|function metricNamesOf\|function historyDaysOf"` (currently 4 hits).
- **Must preserve:**
  - The PUT's 400 on malformed JSON, pinned in `apps/api/src/sponsor-report.test.ts`.
  - Preferences' 400 on malformed JSON, pinned in its own suite.
  - The fake refusing a revenue metric beside the nine with 400, pinned by `it answers 400 to the nine metrics with %s beside them` (`packages/fake-google/src/fake-google.test.ts:1239`).
  - `dayCountOf`'s 0 for a backwards range, which a sponsor range never is.
- **Do not touch:** `historyPartialOf`'s forgiving rule (see Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run apps/api/src/sponsor-report.test.ts apps/api/src/preferences.test.ts packages/fake-google/src/fake-google.test.ts apps/api/src/video-detail.test.ts` stays green, and so do `pnpm typecheck` and `pnpm lint`.

### 9. Comment hygiene — LOW (aggregated)
- `packages/fake-google/src/reports/video-sponsor-figures.ts:36-40`. Current: "else its lifetime numbers to a range that starts on or before its publish day, and no row to any other range, as `videoWindowSummary` does". Corrected: "... and no row to any other range. Unlike `videoWindowSummary`, a video with no publish time gets no lifetime row". (found by: Claude)
- `apps/web/src/app.css:3240-3244`. Current: "and the report fits one page". Corrected: "and the report's table is kept from breaking across pages; that the whole report fits one page rests on Nick's print preview". `break-inside: avoid` is the only rule that works towards one page. (found by: Claude)

## Needs Further Investigation
### A. A video with no publish time, on a channel with readable history and impressions or CTR chosen, would print "0" impressions rather than "Not stored". To confirm, find out whether YouTube's uploads playlist ever answers an item with no `contentDetails.videoPublishedAt` and no scheduled time (a private video never published, say). If it does, treat a null publish day like awaiting processing in `apps/api/src/sponsor-report.ts:149`, or give each window `historyPartial: { days: 0, of: 0 }`. To kill it, show the field is always present for a playlist item.
- **Found by:** Claude
- **Detail:** `publishDayOf` returns null when `publishTimeOf(upload)` is null (`apps/api/src/uploads.ts:66-69`). The window loop then skips both reads, so `figures` still lists `impressions` and `ctr` while each window has neither them nor `historyPartial`. `sponsorCellOf` writes `(window.numbers.impressions ?? 0)` (`apps/web/src/sponsor-report.ts:129`).

## Reviewed and Dismissed
- `?figures=views,views` and a PUT of `["views","views"]` answer `["views"]` instead of being refused. Deduplication is deliberate and pinned: `sponsorFiguresOf('shares,views,likes,views')` in `packages/api-types/src/sponsor-report.test.ts`. A repeated query parameter is refused through `singleQueryOf`, which is what the README's "sent twice" means. (found by: Claude)
- `historyPartial` counts days after the history's newest day, unlike `historyPartialOf`. This is #957's recorded decision: a printed report never shows impressions over fewer days than its views. Do not loosen it. (found by: Claude)
- The PUT, and the GET's `figures`, are validated before membership, so a non-member with a bad body gets 400, not 404. This matches `video-detail.ts` and the other routes, and nothing leaks. (found by: Claude)
- Ticking a box after the history stopped being readable drops a stored `impressions` from the choice. This is #957's recorded choice: the checklist offers only what it can show. (found by: Claude)
- The print palette block. `:root:root:root` (0,3,0) beats `:root[data-theme="dark"]` and `:root:not([data-theme="light"])` (0,2,0). It sets `color-scheme: light`, `styles.test.ts` and `web.test.ts` pin each dark token's light value, and `app.css` writes no colour. (found by: Claude)
- The print header rule. `.app-header:not([hidden])` matches the screen rule's specificity and comes later, so the #956 review pass 1 finding 1 fix (`6f47611d`) holds. `web.test.ts` checks it at 375px. (found by: Claude)
- The effect's read through `latestOnly`, unmount during a fetch, and a channel switch during a save. `latestOnly` drops stale answers, and the effect bumps `turn`. (found by: Claude)
- Route edges. A trailing slash falls through to the list, as `videos/<id>/` already does. Ids round-trip through `encodeURIComponent`. `routeToList` drops `sponsorReport`. (found by: Claude)
- `README.md`'s refusal list for the PUT gives no order, so it is not wrong about the body-before-membership order. (found by: Claude)
- Window arithmetic, CTR from counts (clicks summed as `impressions * ctr` over impressions, ADR 0013), revenue refusal before any Google call, `video_not_found` before any Analytics query, the gateway's Analytics-only scope and nine metrics, and the migration matching its snapshot. All were checked and correct. (found by: Claude)
- No OpenPanel event for a checklist tick. This is already a proposal for Nick in `.epic-loop/tickets/957/proposals.md`. (found by: Claude)

## Minor / nits
- The App-level error alert (`apps/web/src/App.tsx:704`, `<p role="alert">` under `<main>`) is not in the print block's hide list (`apps/web/src/app.css:3245-3255`). An app error on screen at print time, such as a failed sign-out, would print on the sponsor's PDF. (found by: Claude)
- The "Sponsor report" link on the video detail screen sends no OpenPanel event, and no proposal asks Nick whether it should. Only the checklist's question was raised. (found by: Claude)
- The fake answers lifetime numbers to any unseeded window that starts on the publish day (`packages/fake-google/src/reports/video-sponsor-figures.ts:49-50`). A wrong `endDate` from the API would be caught only where a test seeds the exact range. The old-video test does seed them. This mirrors `videoWindowSummary`. (found by: Claude)
- `apps/web/src/fake-api.ts`'s `sponsorReportOf` answers `figures: []` for a stored choice of only `impressions` with no history, where the API answers the nine. It also gives every video the fixture's id. Neither is reached by a current test. (found by: Claude)
- `sponsorFiguresOf(undefined)` answers the nine, but the route never calls it with `undefined`: it short-circuits so the stored choice applies. (found by: Claude)
- The PUT's body guards for `{"figures":"views"}`, `{"figures":[1]}`, `null`, `[]` and `{"x":1}` are correct but untested. (found by: Claude)
- The answer carries no per-window end date, so every consumer re-derives "Data through" from `pacificDayOf`, as the web app does. (found by: Claude)
- The FAQ's "with Pro it can also include impressions and click-through rate" and the pricing line read broader than the code, which shows them only in a window the history holds every day of. The copy is Nick's to approve on the PR. (found by: Claude)
- A report of only `impressions` and/or `ctr` on a Pro channel still makes the nine-figure Analytics read per range (`apps/api/src/sponsor-report.ts:149-157`), so a Google refusal such as quota refuses a report that shows nothing from Google. Kept as a nit, not a finding: #956 recorded the always-nine read so one cache entry per range serves every checklist change, and `impressions and CTR make no Analytics query beyond the nine-figure read` (`apps/api/src/sponsor-report.test.ts:946`) pins the three reads on purpose. (found by: Claude)

## Test quality
- **Tests added or changed:** 86 definitions across 11 files.
- **Green at `$BASE`:** 9 cases, all from `5b8baddc` and none a review fix's proof:
  - `"Back to video" returns to the same detail screen, and the list from the report drops the video too` (`apps/web/src/route.test.ts:1019`) is green at base only because base's `routeOf` ignores the unknown path. Strengthen it by asserting `routeOf(...)` has `sponsorReport: true` before navigating.
  - The three `the path %o opens the list` cases are negative guards, green by design.
  - The three `it answers 400 to the nine metrics with %s beside them` cases (`packages/fake-google/src/fake-google.test.ts:1239`) are green at base because base refuses the nine outright. Strengthen each case by asserting the nine alone answer 200.
  - The toast-placement and sidebar-column tests in `apps/web/test/web.test.ts` were changed only to exclude `media === 'print'`.
- **Tautology shapes:** 4 copy tests (finding 7). One test name claims a database read it never makes: `a choice of every figure the types allow is stored, so the database holds the same set` (finding 5). One markup-instead-of-effect check: `web.test.ts`'s first print test checks that a `display: none` declaration exists for 7 of 8 selectors, not that it wins the cascade. Only the header is resolved. The cascade is correct today. Three coverage gaps were proved by surviving mutants (findings 4 and 5).
- **Repo rules:** the `youtube-test-limits` statements and human steps are present in the new API, fake-Google and web test headers. `row-level-security-tests` is met for reads through `scopes.test.ts` and the new seed row, but not for writes (finding 5).

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the full suite and the browser walk are green at `91d1cb92`. `apps/web/src/sponsor-report.test.ts:198` is time-zone dependent until finding 1 lands. CI runs it in UTC, so it is green there.
- **Commit hygiene:** two commits carry the same #958 subject: `dcce7f01` and the merge `91d1cb92`. The tree is clean. Commit this doc and `repro/` together.
- **Likely reviewer asks:**
  - Migration 0037 collides with #950's `0037_retention_curves.sql`, which is not on `main` yet. The epic that merges second regenerates its migration (`.epic-loop/tickets/957/proposals.md`).
  - The privacy policy's storage section does not yet name the per-channel figure choice (same proposals file).
  - Nick's word-for-word approval of the #958 copy, and the copy-test conflict (finding 7).
  - The one-page light print, which rests on Nick's print preview.

## Verdict
Ready to open the PR once finding 1 is fixed: it is MEDIUM, and the printed date it gets wrong goes to a sponsor. Findings 2 to 6, 8 and 9 are LOW. They can be remediated in this loop or filed as follow-ups. Finding 7 is Nick's call on the PR and is out of scope for remediation. The branch claimed three lane-review fixes (`6f47611d`, `3363ba0b`, `83635301`). All three hold, none of them only as a comment edit, and no prior pre-PR review findings were open.

## Remediation — 2026-11-20
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `d8c50230` creator-analytics#938 pre-PR review 1 finding 1: the printed publish date used the reader's time zone while the windows and Data through count from the Pacific day | red→green: `TZ=Europe/London pnpm exec vitest run apps/web/src/sponsor-report.test.ts -t 'repro:'` red at `359b16e5` ("expected 'Published March 4, 2024' to be 'Published March 3, 2024'"); after the fix the case, renamed without `repro:`, and the whole file are green 39/39 under `TZ` Europe/London, Asia/Tokyo, UTC, America/Los_Angeles and Pacific/Kiritimati | 1 (the function's doc line, rewritten as the brief asked to name the Pacific anchor; 4 lines) | proved by execution (MEDIUM, proof executed, preserve tests green); no verify agent |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 6 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 7 (LOW) | — deferred | — | — | LOW tail; its Remediation scope also says not for the loop, raise on the PR |
| 8 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 9 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked this round |

After the round: `pnpm typecheck` green, `pnpm lint` green (841 files), `pnpm test` green (218 files, 5508 passed, 1 expected fail) at `d8c50230`.

### Known regressions, deferred
- None.

### Rework briefs
- None. No verify pass ran, so no rework.

Approach decisions: finding 1 followed the recorded decision above (the Pacific day from `pacificDayOf`, formatted by `longDateOf`). No new decisions this round.
