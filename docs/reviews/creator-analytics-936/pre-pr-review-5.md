# Pre-PR review: creator-analytics#936 stored retention curves, compared on one chart (round 5, fresh second opinion)

**Branch:** `creator-analytics-936-retention-curves` vs `origin/main` (merge-base `50d695399dfd8c31e04e16050a574403b987f933`, "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `27cff35cd2a94ac07a19fe94664054ba72ed2552` (`creator-analytics#936 Mark the copy approved`) + 0 files with uncommitted changes, 0 untracked files at the start, 64 files total, +7887 / −105 (`--fresh` full-branch review). The only untracked files are this review's own: this doc and its two repro files under `docs/reviews/creator-analytics-936/repro/`.
**Reviewed against:** issue not read: no network; judged against the commit messages (`50d69539..27cff35c`), `CONTEXT.md`, `README.md`, `docs/adr/` (0002, 0004, 0005, 0006, 0011, 0017, 0022), prior review docs `pre-pr-review-1.md` through `pre-pr-review-4.md` (including Approach decisions), `.claude/rules/`, and `~/.claude/rules/`. No plan or spec docs exist under `docs/specs/` or `docs/plans/`.
**Date:** 2026-11-22
**Reviewer:** Gemini through Antigravity (Gemini 4 Neon (High)) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` (`biome check .`), before and after adding repro files | green, 842 files |
| Typecheck | `pnpm typecheck` (`pnpm -r typecheck`) | green across all 19 workspace projects |
| Build | `pnpm build` (`pnpm -r build`) | green across extension, web, and site |
| Web unit tests (non-DB) | `pnpm exec vitest run` with a temporary config without Postgres `globalSetup` over `route.test.ts`, `upgrade.test.ts`, `retention-comparison.test.ts`, `retention-plot.test.ts`, `sidebar.test.ts`, `chart-colours.test.ts`, `app.test.ts`, `apps/web/test/web.test.ts` | 7 of 7 pure web unit files green (809 passed: `route` 218, `upgrade` 15, `retention-comparison` 20, `retention-plot` 12, `sidebar` 15, `chart-colours` 16, `app` 513); 100 of 124 passed in `web.test.ts` (24 failed only where Postgres or localhost bind is needed) |
| Postgres / Testcontainers suites (`apps/api`, `apps/worker`, `packages/database`, `packages/retention-engine`, `apps/site`) | attempted `pnpm exec vitest run packages/database/test/jobs.test.ts` | not runnable in sandbox: Testcontainers cannot open `~/.docker/config.json` (`EPERM`) and no `TEST_DATABASE_ADMIN_URL` is set |
| Browser walk (`pnpm test:browser`) | not run | not runnable in sandbox: requires headless Chrome and local HTTP server bind (`EPERM` on `127.0.0.1`) |
| Tautology audit against `$BASE` checkout | not run by execution; inspected all new and modified test files statically for the four tautology shapes and `tests-can-go-red` | `$BASE` test run not run (Antigravity review does not run `git worktree add`). Static inspection confirmed Findings 5, 6, 7, 12 and cleared the rest. |
| **Findings 1, 2 and 3 (RetentionComparison UI defects)** | executed `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/retention-comparison-ui.vitest.config.ts` | 4 of 4 red at `27cff35c`: `awaitingProcessing` row renders `"Brand new uploadOct 1, 2026Average viewed 0%"`; empty format renders `<ul class="comparison-videos" />` with no empty-state text; `page=5` with `pageCount=2` stays on `page=5` and renders `"Page 5 of 2"`; changing `channelId` keeps Channel A's legend and video list on screen while Channel B loads |
| Migration 0037, RLS policies, cascade, purge, deleted-video check | read `0037_retention_curves.sql`, `packages/database/src/retention-curves.ts`, `channel-owned.ts`, `migrate.ts`, `scopes.test.ts`, `seed.ts`, `history-purge.ts`, `deleted-videos.ts`, `delete-user.test.ts` | both new tables use `channelOwned` with `_web`/`_worker` RLS policies, FK cascade, `FORCE ROW LEVEL SECURITY` in `migrate.ts`, seeding in `seed.ts`, and cleanup in purge, deleted-video check, and delete-user tests |
| Activity-day surface | grepped `recordActivityDay` across `apps/api/src/` and compared against `CONTEXT.md:188`, `README.md:75`, and `apps/api/src/activity-days.test.ts:57-63` | `retention-curves` attaches `recordActivityDay(database)`, contradicting `CONTEXT.md` ("and no other route does") and untested in `activity-days.test.ts` (Finding 4) |
| Copy approval and em-dash sweep | read `368ff80a`, `27cff35c`, `apps/site/{index,partials/footer,privacy}.html`, `apps/web/src/{retention-comparison,sidebar,upgrade}.ts` | all shipped strings are marked approved in `27cff35c` and contain no em-dash |
| Real Google behaviour and production hold times | not run | needs Nick's walk of a paid channel on production |

**Overall:** The database schema, RLS isolation, purge, deleted-video cleanup, worker per-read transaction split, API validation, and approved copy hold up well across the full branch. However, a fresh end-to-end review of the retention comparison screen uncovered two real user-visible UI defects in `apps/web/src/RetentionComparison.tsx` (both MEDIUM, proved by execution): newly uploaded videos awaiting YouTube processing display `"Average viewed 0%"` instead of `"Not processed yet"` directly violating `CONTEXT.md`, and the picker renders an empty bordered list with no message on zero matching videos while failing to clamp out-of-range pages (rendering `"Page 5 of 2"`). Two smaller new LOW gaps (stale channel state on `channelId` change, and the undocumented/untested `recordActivityDay` middleware on `/retention-curves`) plus the nine unworked LOW items from rounds 1 to 4 also remain on HEAD. Fix Findings 1 and 2 before opening the PR.

## Approach decisions
- **Round 1, Finding 1, the curve refresh's transaction:** commit each video's read in its own channel scope, after one plan scope, as `activeUserCount` in `apps/worker/src/jobs.ts` runs two scopes in sequence. Rejected: committing quota outside the caller's transaction in the gateway's `spend`. Unchanged.
- **Round 1, Finding 2, the privacy policy:** describe the curves on the reach history's windows, item by item. Unchanged.
- **Copy pins against `tests-state-a-rule`:** overturned by Nick, 2026-11-20 ("We should not be writing tests for hard coded copy."). Copy was approved word for word in `27cff35c` (2026-11-22); only rules over copy derived from code stay (numbers matching constants, no em-dash, branch observation through text). Unchanged.
- **Remediation 1, Finding 1, where the scopes open:** the job handler hands `refreshRetentionCurves` the `WorkerDatabase`, and the module opens the plan scope and one scope per due video. Unchanged.
- **Remediation 1, Finding 1, the fix's own failure path:** a database error in one video's scope is proved with a curve that repeats a point. Unchanged.
- **Remediation 1, Finding 2, proof over the policy:** the `affirms` facts name the curves in the storage, paid-retention, deleted-video and disconnect items. Unchanged.
- **Remediation 1, Finding 3, the self-computed backfill note:** asserted with `toMatch(/\b12\b/)`. Unchanged.
- **Round 2, Finding 1, how the suite holds the per-read commit:** a test hands the handler a `WorkerDatabase` that counts open `forChannel` scopes. Unchanged.
- **Round 4, a number in the copy against the code:** extract it with a regex anchored on its unit and compare it to the exported constant the code enforces. Unchanged.
- **Round 4, a branch observed through its text:** assert the part of the text that shows which branch ran, never the surrounding sentence. Unchanged.
- **Round 5, retention picker row/list states (`nearest-in-repo-precedent`):** mirror `VideoList.tsx` (`apps/web/src/VideoList.tsx:399-405`, `:622-623`) and `video-list.ts:1034-1037` by reusing `notProcessedText` (`processing.ts`), `emptyListTextOf` (`video-list.ts`), `routeWithin` (`route.ts`), and `channelId`-tagged read state rather than inventing separate picker copy or custom clamping logic.
- **Remediation 5, Finding 2, the empty picker's test:** the fake answer carries `pageCount: 0`, as the API's `Math.ceil(listed.length / pageSize)` gives for no videos. The repro's Finding 2a keeps the fake API's default `pageCount: 1` with no videos, an answer the API never sends past a clamp, so it stays red against the fixed tree; `app.test.ts` holds the real proof. A list of no videos with `pageCount` above 0 is the past-the-last case, which the clamp handles.

## Confirmed Issues

### 1. A video awaiting processing shows "Average viewed 0%" in the retention picker instead of "Not processed yet" — MEDIUM
- **Location:** `apps/web/src/RetentionComparison.tsx:277-279`
- **Attribution:** introduced. `git log --oneline --reverse -S'averageViewedColumn' 50d69539..HEAD -- apps/web/src/RetentionComparison.tsx` names `3b51599d` (`creator-analytics#951 Compare up to 5 stored retention curves on one chart`). `RetentionComparison.tsx` does not exist at `$BASE`.
- **Real-world trigger:** any creator who uploaded a video within YouTube's 2-to-3-day processing delay opens `/app/retention`. Because the picker defaults to "Newest first", that unprocessed video sits at the very top of "Videos to compare", and `apps/api/src/video-list.ts:514-533` populates `averageViewPercentage: 0` from `noMetrics` alongside `awaitingProcessing: true`. The picker displays `"Average viewed 0%"` with no unprocessed indicator, contradicting the Video list (`"YouTube has not processed this video yet..."`) and `CONTEXT.md:139`.

**Evidence**
```tsx
// apps/web/src/RetentionComparison.tsx:273-281
<label htmlFor={id}>
  <span className="comparison-video-title">{video.title}</span>
  <span className="comparison-video-numbers">
    <span>{publishedColumn?.textOf(video)}</span>
    <span>
      {averageViewedColumn.label} {averageViewedColumn.textOf(video)}
    </span>
  </span>
</label>
```

**Failure mode** — When `video.awaitingProcessing` is `true` and `video.averageViewPercentage` is `0` (as `apps/api/src/video-list.ts:514, 520, 533` returns for every video published after `lastProcessedDay`), the row renders `Average viewed 0%` instead of `notProcessedText`. Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/retention-comparison-ui.vitest.config.ts` (Finding 1) observed `Received: "Brand new uploadOct 1, 2026Average viewed 0%"`.

**Recommended fix**
```diff
--- a/apps/web/src/RetentionComparison.tsx
+++ b/apps/web/src/RetentionComparison.tsx
@@ -13,6 +13,7 @@ import { ListSelect } from './ListSelect.tsx'
 import { loadingText } from './loading.ts'
 import { LoadingStatus, Placeholder } from './Placeholder.tsx'
 import { pageSizeOf, usePreferences, visibilityOf } from './preferences.ts'
+import { notProcessedText } from './processing.ts'
 import { retentionScaleLabelsOf } from './retention.ts'
 import {
   type ComparisonSort,
@@ -274,7 +275,9 @@ export function RetentionComparison({
                       <span className="comparison-video-title">{video.title}</span>
                       <span className="comparison-video-numbers">
                         <span>{publishedColumn?.textOf(video)}</span>
                         <span>
-                          {averageViewedColumn.label} {averageViewedColumn.textOf(video)}
+                          {video.awaitingProcessing
+                            ? notProcessedText
+                            : `${averageViewedColumn.label} ${averageViewedColumn.textOf(video)}`}
                         </span>
                       </span>
                     </label>
```

**Remediation brief**
- **Design intent:** `VideoRow.awaitingProcessing` (`packages/api-types/src/videos.ts:252-255`) is `true` whenever Google has processed no day since a video was published; the API fills `noMetrics` (`averageViewPercentage: 0`) on those rows so every web surface must check `awaitingProcessing` and render `notProcessedText` instead of zeros (`CONTEXT.md:139`, mirrored in `apps/web/src/video-list.ts:1034-1037`).
- **Full surface:** `apps/web/src/RetentionComparison.tsx:15` (import `notProcessedText` from `./processing.ts`) and `:277-279`; add a regression test in `apps/web/src/app.test.ts` inside `describe('the retention comparison (creator-analytics#951)')`. No other new surface reads `averageViewedColumn` (`git grep -n averageViewedColumn`).
- **Must preserve:** processed videos (`awaitingProcessing: false`) still display `${averageViewedColumn.label} ${averageViewedColumn.textOf(video)}` beside the published date; checkbox selection, disabled 6th-pick state, and all existing tests in `apps/web/src/app.test.ts` (513 tests) stay green.
- **Do not touch:** `apps/api/src/video-list.ts:514-533` (`noMetrics` + `awaitingProcessing` contract is shared with `VideoList`), `averageViewedColumn`, or `notProcessedText` itself.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/retention-comparison-ui.vitest.config.ts -t "Finding 1"` is red now and must be green after the fix, along with `pnpm exec vitest run apps/web/src/app.test.ts -t "retention comparison"`.

### 2. The retention picker renders an empty bordered list with no message when zero videos match, and never clamps a page past the last page — MEDIUM
- **Location:** `apps/web/src/RetentionComparison.tsx:191-196`, `:257-293`
- **Attribution:** introduced. `RetentionComparison.tsx` does not exist at `$BASE`; created in `3b51599d` (`creator-analytics#951 Compare up to 5 stored retention curves on one chart`).
- **Real-world trigger:** two common user paths:
  1. Any creator whose channel has no Live streams or no Shorts clicks `"Live"` or `"Shorts"` in the retention picker's format filter (or opens `/app/retention` on a channel with no uploads). The API returns `{ videos: [], pageCount: 0 }`, and the picker renders an empty `<ul class="comparison-videos">` (a lone top border) with no explanation.
  2. A creator opens `/app/retention?window=lifetime&page=5` (for example via a bookmarked URL, after changing their saved `pageSize` or `visibility` preference, or after deleting uploads), or lands on a page past `pageCount`. Because `routeToRetention` preserves `page` when `window === 'lifetime'` and `RetentionComparison` never clamps with `routeWithin`, the API returns `{ videos: [], page: 5, pageCount: 2 }` (`apps/api/src/video-list.ts:546, 556`) and the picker renders an empty `<ul>` above `"Page 5 of 2"` whose `"Previous page"` link steps to `"Page 4 of 2"` (also empty).

**Evidence**
```tsx
// apps/web/src/RetentionComparison.tsx:191-196, 257-292
useEffect(() => {
  if (channelId === null) return
  return latestOnly(readVideoList(channelId, listQuery), setList, (message) =>
    setList({ kind: 'refused', message }),
  )
}, [channelId, listQuery])
// ...
) : list.kind === 'list' ? (
  <>
    <ul className="comparison-videos">
      {list.answer.videos.map((video) => { /* ... */ })}
    </ul>
    <Pager pageCount={list.answer.pageCount} route={route} navigate={navigate} land={() => pickerHeading.current?.focus()} />
  </>
```

**Failure mode** — Executed via `docs/reviews/creator-analytics-936/repro/retention-comparison-ui.test.ts`:
- Finding 2a (`/retention?window=lifetime&format=live`, `api.videos = []`): renders `<ul class="comparison-videos" />` with 0 `<li>` elements and no empty-list text (`emptyListTextOf('live', 'public')` is absent).
- Finding 2b (`/retention?window=lifetime&page=5&pageSize=10`, `api.videos = []`, `api.pageCount = 2`): URL remains `?window=lifetime&page=5&pageSize=10`, `<ul>` has 0 items, and `.video-list-pager-place` renders `"Page 5 of 2"`.

**Recommended fix**
```diff
--- a/apps/web/src/RetentionComparison.tsx
+++ b/apps/web/src/RetentionComparison.tsx
@@ -33,12 +33,13 @@ import {
   picksAfterToggleOf,
 } from './retention-comparison.ts'
 import { comparisonPlotDefinitionOf } from './retention-plot.ts'
-import { type Navigate, type Route, routeWithControl, routeWithCurves } from './route.ts'
+import { type Navigate, type Route, routeWithControl, routeWithCurves, routeWithin } from './route.ts'
 import { SegmentedControl } from './SegmentedControl.tsx'
 import { Pager, readVideoList } from './VideoList.tsx'
 import {
   averageViewedColumn,
   detailColumns,
+  emptyListTextOf,
   type VideoListView,
   videoListQueryOf,
 } from './video-list.ts'
@@ -158,13 +159,14 @@ export function RetentionComparison({
   const pickerHeading = useRef<HTMLHeadingElement>(null)
   const { saved } = usePreferences()
   const sort = comparisonSortOf(route)
+  const visibility = visibilityOf(route, saved)
   const listQuery = videoListQueryOf({
     page: route.page,
     window: 'lifetime',
     sort,
     format: route.format,
     pageSize: pageSizeOf(route, saved),
-    visibility: visibilityOf(route, saved),
+    visibility,
   })
 
   // biome-ignore lint/correctness/useExhaustiveDependencies: the picks' key stands for the picks.
@@ -190,10 +192,20 @@ export function RetentionComparison({
 
   useEffect(() => {
     if (channelId === null) return
-    return latestOnly(readVideoList(channelId, listQuery), setList, (message) =>
-      setList({ kind: 'refused', message }),
+    return latestOnly(
+      readVideoList(channelId, listQuery),
+      (next) => {
+        if (next.kind === 'list') {
+          const clamped = routeWithin(latestRoute.current, next.answer.pageCount)
+          if (clamped !== latestRoute.current) {
+            navigate(clamped, { replace: true })
+            return
+          }
+        }
+        setList(next)
+      },
+      (message) => setList({ kind: 'refused', message }),
     )
-  }, [channelId, listQuery])
+  }, [channelId, listQuery, navigate])
 
   function toggle(videoId: string) {
     pickChanged.current = true
@@ -255,7 +267,9 @@ export function RetentionComparison({
         {!list ? (
           <Placeholder shape="line" />
         ) : list.kind === 'list' ? (
-          <>
+          list.answer.pageCount === 0 ? (
+            <p>{emptyListTextOf(route.format, visibility)}</p>
+          ) : (
+            <>
               <ul className="comparison-videos">
                 {list.answer.videos.map((video) => {
                   const id = `comparison-pick-${video.id}`
@@ -290,7 +304,8 @@ export function RetentionComparison({
                 navigate={navigate}
                 land={() => pickerHeading.current?.focus()}
               />
-          </>
+            </>
+          )
         ) : (
           <p role="alert">{list.kind === 'refused' ? list.message : null}</p>
         )}
```

**Remediation brief**
- **Design intent:** the retention picker reads the same `GET /api/channels/:channelId/videos` endpoint as `VideoList` and must honour its two boundary invariants: when `answer.pageCount === 0`, show `emptyListTextOf(route.format, visibility)` instead of an empty list (`apps/web/src/video-list.ts:264-265`, `apps/web/src/VideoList.tsx:622-623`); when `answer.pageCount > 0` and `route.page > answer.pageCount`, replace the route with `routeWithin(latestRoute.current, answer.pageCount)` so Back never returns to the out-of-range page and `curves` stay intact (`apps/web/src/VideoList.tsx:399-402`).
- **Full surface:** `apps/web/src/RetentionComparison.tsx:36-44`, `:160-169`, `:191-196`, `:257-295`; add regression tests for both empty-format text and page clamping in `apps/web/src/app.test.ts` under `describe('the retention comparison (creator-analytics#951)')`. Note `emptyListTextOf` is already exported at `apps/web/src/video-list.ts:1063` with approved copy, and `routeWithin` is already exported at `apps/web/src/route.ts:543`.
- **Must preserve:** `navigate` is memoized (`useCallback` in `route.ts:592`), so including it in the effect dependency array triggers no extra reads; `routeWithin` returns the identical object reference when `pageCount === 0` or `route.page <= pageCount`, so empty lists do not loop; format/sort/page changes still keep `route.curves`; `apps/web/src/app.test.ts` (513 tests) and `apps/web/src/route.test.ts` (218 tests) stay green.
- **The fix's own failure:** if the clamped page read fails (network error or refusal), the `latestOnly` rejection handler still sets `list` to `{ kind: 'refused', message }` so the alert surfaces instead of staying on a placeholder forever.
- **Do not touch:** `Pager` in `apps/web/src/VideoList.tsx`, `emptyListTextOf` wording, or `routeToRetention` keeping `page` when already in `lifetime`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/retention-comparison-ui.vitest.config.ts -t "Finding 2"` is red now (both 2a and 2b fail) and must be green after the fix, along with `pnpm exec vitest run apps/web/src/app.test.ts -t "retention comparison"`.

### 3. Switching channels while the retention comparison stays mounted keeps the previous channel's curves and video list on screen while the new channel loads — LOW
- **Location:** `apps/web/src/RetentionComparison.tsx:152-196`
- **Attribution:** introduced in `3b51599d` (`creator-analytics#951 Compare up to 5 stored retention curves on one chart`). `RetentionComparison.tsx` does not exist at `$BASE`.
- **Real-world trigger:** an agency user or multi-channel creator uses browser history (for example the Back/Forward history menu) to jump directly between `/app/retention?channel=<A>&...` and `/app/retention?channel=<B>&...`, or a future change lets `routeToChannel` stay on `/app/retention` as it already does for Audience. Because `routeToChannel` (`apps/web/src/channel-picker.ts:22-25`) currently routes off `/app/retention` to the new channel's video list, in-app channel switches unmount the component; attainability today is narrow (direct history jump between two channels' retention URLs), which caps severity at LOW. Upgrade to MEDIUM if `routeToChannel` is ever updated to keep `route.retention` (check `apps/web/src/channel-picker.ts:24`).

**Evidence**
```tsx
// apps/web/src/RetentionComparison.tsx:152-153, 171-196
const [view, setView] = useState<ComparisonView | null>(null)
const [list, setList] = useState<VideoListView | null>(null)
// ...
useEffect(() => {
  if (channelId === null) return
  return latestOnly(readCurves(channelId, picks), (read) => { /* ... */ setView(next) }, /* ... */)
}, [channelId, picksKey])
useEffect(() => {
  if (channelId === null) return
  return latestOnly(readVideoList(channelId, listQuery), setList, /* ... */)
}, [channelId, listQuery])
```

**Failure mode** — Unlike `Audience.tsx:234`, `Upgrade.tsx:171`, and `VideoList.tsx:405` (which clear or key state by `channelId`), neither `view` nor `list` is cleared or scoped to `channelId`. Executed: `docs/reviews/creator-analytics-936/repro/retention-comparison-ui.test.ts` (Finding 3) renders `RetentionComparison` for `ch-1` with `"Channel A Secret Video"`, re-renders with `channelId="ch-2"` while `ch-2`'s fetches are pending, and observes `"Channel A Secret Video"` still rendered in both `.comparison-legend` and `.comparison-videos`.

**Recommended fix**
```diff
--- a/apps/web/src/RetentionComparison.tsx
+++ b/apps/web/src/RetentionComparison.tsx
@@ -149,8 +149,10 @@ export function RetentionComparison({
 }) {
   const picks = useMemo(() => route.curves ?? [], [route.curves])
   const picksKey = picks.join(',')
-  const [view, setView] = useState<ComparisonView | null>(null)
-  const [list, setList] = useState<VideoListView | null>(null)
+  const [curvesRead, setCurvesRead] = useState<{ channelId: string; view: ComparisonView } | null>(null)
+  const [listRead, setListRead] = useState<{ channelId: string; view: VideoListView } | null>(null)
+  const view = curvesRead?.channelId === channelId ? curvesRead.view : null
+  const list = listRead?.channelId === channelId ? listRead.view : null
   const pickChanged = useRef(false)
   // The route on view when a read lands, so dropping a pick keeps a format or sort chosen meanwhile.
   const latestRoute = useRef(route)
@@ -170,6 +172,7 @@ export function RetentionComparison({
   // biome-ignore lint/correctness/useExhaustiveDependencies: the picks' key stands for the picks.
   useEffect(() => {
     if (channelId === null) return
+    const target = channelId
     return latestOnly(
       readCurves(channelId, picks),
       (read) => {
@@ -178,22 +181,28 @@ export function RetentionComparison({
           return
         }
         const next = read.view
-        setView(next)
+        setCurvesRead({ channelId: target, view: next })
         if (!pickChanged.current) return
         pickChanged.current = false
         const event = comparedEventOf(next)
         if (event) track(event)
       },
-      (message) => setView({ kind: 'refused', message }),
+      (message) => {
+        pickChanged.current = false
+        setCurvesRead({ channelId: target, view: { kind: 'refused', message } })
+      },
     )
   }, [channelId, picksKey])
 
   useEffect(() => {
     if (channelId === null) return
-    return latestOnly(readVideoList(channelId, listQuery), setList, (message) =>
-      setList({ kind: 'refused', message }),
+    const target = channelId
+    return latestOnly(
+      readVideoList(channelId, listQuery),
+      (next) => setListRead({ channelId: target, view: next }),
+      (message) => setListRead({ channelId: target, view: { kind: 'refused', message } }),
     )
   }, [channelId, listQuery])
```
Combine cleanly with Finding 2's `routeWithin` clamp inside the `readVideoList` callback if remediated together.

**Remediation brief**
- **Design intent:** channel data never crosses channel boundaries in the UI (ADR 0005). Tagging cached screen state with `channelId` (mirroring `VideoList.tsx:405` and `Upgrade.tsx:155-157`) drops another channel's curves and videos on the very first render of a new `channelId` without flickering on same-channel pick, format, sort, or page changes.
- **Full surface:** `apps/web/src/RetentionComparison.tsx:152-196`.
- **Must preserve:** same-channel pick toggles keep the previous chart mounted until the next curves response lands (no extra placeholder flash); `latestOnly` cancellation still prevents out-of-order responses from overwriting state; resetting `pickChanged.current = false` on read error prevents a stale flag from firing `retention_curves_compared` on a subsequent non-pick load; all `apps/web/src/app.test.ts` retention comparison tests stay green.
- **Do not touch:** `apps/web/src/channel-picker.ts` (`routeToChannel` leaving `/app/retention` for the video list was dismissed in round 1 as an explicit #951 assumption).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-936/repro/retention-comparison-ui.vitest.config.ts -t "Finding 3"` is red now and must be green after the fix.

### 4. The curves route records an activity day while CONTEXT.md and README.md still say only four routes do, and activity-days.test.ts never tests it — LOW
- **Location:** `apps/api/src/routes/retention-curves.ts:37`, `CONTEXT.md:188`, `README.md:75`, `apps/api/src/activity-days.test.ts:57-63`
- **Attribution:** introduced. `git log --oneline --reverse -S'recordActivityDay' 50d69539..HEAD -- apps/api/src/routes/retention-curves.ts` names `3b51599d` (`creator-analytics#951 Compare up to 5 stored retention curves on one chart`). At `$BASE`, only four routes attached `recordActivityDay` (`videos`, `videos/:videoId`, `summary`, `audience`), matching `CONTEXT.md:188`, `README.md:75`, and `activity-days.test.ts:57-63`.
- **Real-world trigger:** a maintainer reading `CONTEXT.md:188` ("A signed-in read of the video list, a video's detail, the channel summary or the audience records it, whatever the route answers, and no other route does") or `activity-days.test.ts` relies on a false invariant about which routes write `activity_days`, and removing `recordActivityDay(database)` from `retention-curves.ts` would break nothing in the test suite. Recording an activity day on `/retention-curves` is the right product behaviour (it reads a channel's numbers), so the defect is an incomplete surface (`whole-surface-of-a-change`) and a behavioural doc mismatch.

**Evidence**
```ts
// apps/api/src/routes/retention-curves.ts:37
signedIn.get('/channels/:channelId/retention-curves', recordActivityDay(database), async (c) => {

// CONTEXT.md:188
// A signed-in read of the video list, a video's detail, the channel summary or the audience records it, whatever the route answers, and no other route does.

// apps/api/src/activity-days.test.ts:57-63
/** The four routes that read a channel's numbers. */
const channelReads = [
  ['the video list', (channelId: string) => `/api/channels/${channelId}/videos`],
  ['a video detail', (channelId: string) => `/api/channels/${channelId}/videos/${upload.videoId}`],
  ['the channel summary', (channelId: string) => `/api/channels/${channelId}/summary`],
  ['the audience', (channelId: string) => `/api/channels/${channelId}/audience`],
] as const
```

**Failure mode** — `CONTEXT.md` explicitly asserts "and no other route does", `README.md:75` lists only four routes, and `apps/api/src/activity-days.test.ts` exercises neither signed-in recording nor signed-out 401 non-recording for `/api/channels/:channelId/retention-curves`. (Note: appending `/retention-curves` blindly to `channelReads` would fail line 76's `expect(response.status).toBe(200)` because `connectedCreator` creates a free channel, where `/retention-curves` answers 403 `sort_without_history`.)

**Recommended fix**
Update `CONTEXT.md:188` and `README.md:75` to include the retention comparison (`GET /api/channels/:channelId/retention-curves`) alongside the video list, a video's detail, the channel summary, and the audience. In `apps/api/src/activity-days.test.ts`, add a test verifying that a signed-in read of `/api/channels/${channelId}/retention-curves` (both a refused free-channel 403 read and/or a subscribed 200 read) records one activity day on the UTC day, and include `retention-curves` in the signed-out 401 test (which leaves no row).

**Remediation brief**
- **Design intent:** every signed-in read of a channel's analytics numbers records one UTC activity day before running the route handler, whatever the route answers, and signed-out reads answer 401 and record nothing (`apps/api/src/activity-days.ts`). `retention-curves` is the fifth channel-reading route.
- **Full surface:** `CONTEXT.md:188`; `README.md:75`; `apps/api/src/activity-days.test.ts:57-80` and `:169-182`. (`apps/api/src/routes/retention-curves.ts:37` already has `recordActivityDay(database)`.)
- **Must preserve:** the existing four routes in `channelReads` still assert HTTP 200 and one activity day; the non-channel routes test at `:184-211` still leaves zero activity days. Because `connectedCreator` in `activity-days.test.ts` creates a free channel, the new `/retention-curves` test must either assert `status === 403` (confirming a refused read records the row) or subscribe the channel first to assert `status === 200` (not leave an unhandled 403 against `expect(status).toBe(200)`).
- **Do not touch:** `apps/api/src/routes/upgrade.ts` (upgrade reads no analytics numbers and intentionally has no `recordActivityDay`).
- **Proof:** `pnpm exec vitest run apps/api/src/activity-days.test.ts` (requires Postgres/Testcontainers outside sandbox). Temporarily removing `recordActivityDay(database)` from `apps/api/src/routes/retention-curves.ts:37` must make the new test fail red, and restoring it must turn the suite green.

### 5. The singular backfill-note test stays green when singular and plural are swapped or the singular is empty — LOW
- **Location:** `apps/web/src/retention-comparison.test.ts:140`
- **Attribution:** introduced in `c2f5b4a9` (`creator-analytics#936 Remove the copy pins that #951 added`). Carried forward from `pre-pr-review-4.md` Finding 1 (still unfixed at `27cff35c`).
- **Real-world trigger:** a refactor of `backfillNoteOf` swaps singular/plural or empties the singular branch. No user path exists today (code is correct); capped at LOW as a test-strength gap (`tests-can-go-red`).

**Evidence**
```ts
// apps/web/src/retention-comparison.test.ts:138-142
test("the note counts the uploads to go in the locale's digits, one video in the singular", () => {
  expect(backfillNoteOf(1200, 'en-US')).toContain('1,200')
  expect(backfillNoteOf(1, 'en-US')).not.toBe(backfillNoteOf(2, 'en-US').replace('2', '1'))
  expect(backfillNoteOf(12, 'ar-EG')).not.toMatch(/[0-9]/)
})
```

**Failure mode** — Checking only inequality against `backfillNoteOf(2, 'en-US').replace('2', '1')` passes when singular and plural are swapped (`1 videos` vs `1 video`) or when `backfillNoteOf(1)` returns `""` (proved in round 4 with `docs/reviews/creator-analytics-936/repro/singular-inverted.patch`).

**Recommended fix**
```diff
--- a/apps/web/src/retention-comparison.test.ts
+++ b/apps/web/src/retention-comparison.test.ts
@@ -137,7 +137,8 @@ describe("the comparison's view of the curves read", () => {
 
   test("the note counts the uploads to go in the locale's digits, one video in the singular", () => {
     expect(backfillNoteOf(1200, 'en-US')).toContain('1,200')
-    expect(backfillNoteOf(1, 'en-US')).not.toBe(backfillNoteOf(2, 'en-US').replace('2', '1'))
+    expect(backfillNoteOf(1, 'en-US')).toMatch(/\b1 video\b/)
+    expect(backfillNoteOf(2, 'en-US')).toMatch(/\b2 videos\b/)
     expect(backfillNoteOf(12, 'ar-EG')).not.toMatch(/[0-9]/)
   })
```

**Remediation brief**
- **Design intent:** `backfillNoteOf(unread, locale)` (`apps/web/src/retention-comparison.ts:46-50`) picks `"video"` for `1` and `"videos"` otherwise. Asserting `\b1 video\b` and `\b2 videos\b` observes the branch through its noun form without pinning the surrounding sentence (Approach decisions).
- **Full surface:** `apps/web/src/retention-comparison.test.ts:140`.
- **Must preserve:** `toContain('1,200')`, the `ar-EG` non-ASCII digit check, and all 20 tests in `apps/web/src/retention-comparison.test.ts`.
- **Do not touch:** `backfillNoteOf` itself (copy approved in `27cff35c`).
- **Proof:** in a scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/singular-inverted.patch && pnpm exec vitest run apps/web/src/retention-comparison.test.ts -t "singular"` is green now and must be red after the fix; without the patch it must be green.

### 6. The refusal test stays green for any screen-specific text in place of the shared one — LOW
- **Location:** `apps/web/src/retention-comparison.test.ts:149-157`
- **Attribution:** introduced in `c2f5b4a9` (`creator-analytics#936 Remove the copy pins that #951 added`). Carried forward from `pre-pr-review-4.md` Finding 2 (still unfixed at `27cff35c`).
- **Real-world trigger:** someone adds a wrong or empty override for `google_failed` in `comparisonViewOf`'s `refusalMessageOf` call. No user path exists today; capped at LOW as a test-strength gap (`tests-can-go-red`).

**Evidence**
```ts
// apps/web/src/retention-comparison.test.ts:149-157
const shared = comparisonViewOf({ refusal: 'google_failed' })
const unknown = comparisonViewOf({ error: 'invalid_ids' })
if (shared.kind !== 'refused' || unknown.kind !== 'refused') throw new Error('Not refused')

// The shared text, not the Pro refusal, and not the fallback that names the code.
expect(shared.message).not.toBe(comparisonText.refused)
expect(shared.message).not.toContain('google_failed')
```

**Failure mode** — Both assertions on `shared.message` are negative, so any non-Pro string not containing `'google_failed'` (including `""`) passes (proved in round 4 with `docs/reviews/creator-analytics-936/repro/shared-refusal-override.patch`).

**Recommended fix**
```diff
--- a/apps/web/src/retention-comparison.test.ts
+++ b/apps/web/src/retention-comparison.test.ts
@@ -6,6 +6,7 @@
 // look at /app/retention.
 import type { RetentionCurvesAnswer, StoredRetentionCurve } from '@creator-analytics/api-types'
 import { describe, expect, test } from 'vitest'
+import { refusalMessageOf } from './refusals.ts'
 import {
   backfillNoteOf,
   comparedEventOf,
@@ -150,9 +151,7 @@ describe("the comparison's view of the curves read", () => {
     const unknown = comparisonViewOf({ error: 'invalid_ids' })
     if (shared.kind !== 'refused' || unknown.kind !== 'refused') throw new Error('Not refused')
 
-    // The shared text, not the Pro refusal, and not the fallback that names the code.
-    expect(shared.message).not.toBe(comparisonText.refused)
-    expect(shared.message).not.toContain('google_failed')
+    expect(shared.message).toBe(refusalMessageOf({ refusal: 'google_failed' }, 'another read'))
     expect(unknown.message).not.toBe(comparisonText.refused)
     expect(unknown.message).toContain('invalid_ids')
   })
```

**Remediation brief**
- **Design intent:** `comparisonViewOf` (`apps/web/src/retention-comparison.ts:119-130`) overrides only `sort_without_history` and delegates every other refusal to `refusalMessageOf`'s shared table (`apps/web/src/refusals.ts`). Comparing against `refusalMessageOf({ refusal: 'google_failed' }, 'another read')` verifies delegation without pinning the shared wording.
- **Full surface:** `apps/web/src/retention-comparison.test.ts:8` (import) and `:153-155`.
- **Must preserve:** the `sort_without_history` check at `:145-148`, the `unknown` fallback checks at `:156-157`, and all 20 tests in `apps/web/src/retention-comparison.test.ts`.
- **Do not touch:** `apps/web/src/refusals.ts` or `comparisonViewOf`.
- **Proof:** in a scratch worktree at HEAD, `git apply docs/reviews/creator-analytics-936/repro/shared-refusal-override.patch && pnpm exec vitest run apps/web/src/retention-comparison.test.ts -t "shared text"` is green now and must be red after the fix; without the patch it must be green.

### 7. Four copy numbers are not tied to the code's constants: the 28-day daily refresh window in two places and the retention page's own "up to 5" in two — LOW
- **Location:** `apps/worker/src/retention-curves.ts:24`, `apps/web/src/upgrade.ts:68`, `apps/site/partials/footer.html:40-41`, `apps/web/src/retention-comparison.ts:26,31`, `apps/web/src/app.test.ts:6886`
- **Attribution:** introduced across `8834444c`, `3b51599d`, `f87a26f8`, and half-covered by `2b6c5980` (`whole-surface-of-a-change`). Carried forward from `pre-pr-review-4.md` Finding 3 (still unfixed at `27cff35c`).
- **Real-world trigger:** changing `dailyAgeMs` (28 days) or `maxComparedCurves` (5) leaves the upgrade card, FAQ, or retention page intro/limit text claiming stale numbers while CI stays green. All seven sites match today; capped at LOW.

**Evidence**
```ts
// apps/web/src/retention-comparison.ts:26, 31
intro: 'Pick up to 5 videos to see their audience retention curves on one chart.',
limit: 'You can compare up to 5 videos. Clear a pick to choose another.',
// apps/worker/src/retention-curves.ts:24 (not exported)
const dailyAgeMs = 28 * dayMs
// apps/web/src/app.test.ts:6886 (asserts aria-describedby, not the number 5)
test('with 5 picked, a sixth pick box is disabled and the limit sentence names the limit', async () => {
```

**Failure mode** — Changing the intro/limit `"up to 5"` and both `"first 28 days"` strings leaves `retention-comparison.test.ts`, `upgrade.test.ts`, `app.test.ts`, and `site.test.ts` green (proved in round 4 with `docs/reviews/creator-analytics-936/repro/copy-numbers-drift.patch`, updated for `368ff80a`'s `"see their audience retention curves"` edit in `intro`).

**Recommended fix**
Export `dailyCurveReadDays = 28` from `packages/api-types/src/retention-curves.ts` and re-export it in `packages/api-types/src/index.ts`; use `dailyCurveReadDays * dayMs` in `apps/worker/src/retention-curves.ts:24`; assert `/\bdaily\b[^.]*?\bfirst (\d+) days\b/g` equals `[dailyCurveReadDays]` in `apps/web/src/upgrade.test.ts` and `apps/site/test/site.test.ts`; assert `/\bup to (\d+)\b[^.,]*?\bvideos\b/g` equals `[maxComparedCurves]` on both `comparisonText.intro` and `comparisonText.limit` in `apps/web/src/retention-comparison.test.ts`; rename `apps/web/src/app.test.ts:6886` to `'with 5 picked, a sixth pick box is disabled and points at the limit sentence'`.

**Remediation brief**
- **Design intent:** copy numbers backed by code rules (`maxComparedCurves = 5`, `dailyCurveReadDays = 28`) are enforced against exported constants across all seven copy sites (`tests-state-a-rule`, Approach decisions).
- **Full surface:** `packages/api-types/src/retention-curves.ts:2`; `packages/api-types/src/index.ts:139-145`; `apps/worker/src/retention-curves.ts:1, 24`; `apps/web/src/upgrade.test.ts:1, 55`; `apps/site/test/site.test.ts:34, 1410`; `apps/web/src/retention-comparison.test.ts:7, 160`; `apps/web/src/app.test.ts:6886`.
- **Must preserve:** `dailyAgeMs` stays 28 days; `monthlyReadAgeMs` stays unexported (the copy says "monthly", not a number); no approved copy wording changes; `apps/worker/test/retention-curves.test.ts`, `apps/web/src/upgrade.test.ts`, `apps/web/src/retention-comparison.test.ts`, `apps/site/test/site.test.ts`, and `apps/web/src/app.test.ts` stay green.
- **Do not touch:** the approved copy strings themselves; the FAQ's separate "first 28 days" sentence for new-upload averages (which lacks "daily" before it, so the regex does not match it).
- **Proof:** `pnpm exec vitest run apps/web/src/retention-comparison.test.ts apps/web/src/upgrade.test.ts` and `pnpm exec vitest run apps/site/test/site.test.ts -t "FAQ's Pro answer"` must fail red when either `intro`/`limit` changes `5` to `6` or the upgrade card/FAQ changes `28` to `14`, and pass green at HEAD. (Note: `docs/reviews/creator-analytics-936/repro/copy-numbers-drift.patch` needs its `retention-comparison.ts:26` context line updated after `368ff80a` changed `"draw their audience retention"` to `"see their audience retention curves"`.)

### 8. When pruning a deleted pick fails on that pick's own read, the comparison stays refused with no way to untick it, and heldPicksOf has no unit or failure-path tests — LOW
- **Location:** `apps/web/src/RetentionComparison.tsx:54-65`, `apps/web/src/retention-comparison.ts:218-235`
- **Attribution:** introduced in `1379fffc` (`creator-analytics#951 review pass 1 finding 1`). Carried forward from `pre-pr-review-1.md` Finding 4 (still unfixed at `27cff35c`).
- **Real-world trigger:** a creator opens a bookmarked `/app/retention?curves=v1,gone` URL where `gone` was deleted on YouTube, and the single-video prune probe for `gone` returns a transient refusal or error (e.g. `{ error: 'internal' }` or `{ refusal: 'google_failed' }`). Because `heldPicksOf` drops only `video_not_found`, it keeps `gone` and returns `null`, leaving the chart refused with `video_not_found` and no checkbox in the picker to clear `gone`. Transient and requires two coincidences, so LOW.

**Evidence**
```ts
// apps/web/src/retention-comparison.ts:226-235
export function heldPicksOf(
  picks: readonly string[],
  alone: readonly CurvesBody[],
): string[] | null {
  const held = picks.filter((_, index) => {
    const body = alone[index]
    return !body || !isPickNotHeld(body)
  })
  return held.length < picks.length ? held : null
}
```

**Failure mode** — `heldPicksOf` treats any non-`video_not_found` response as held (`!isPickNotHeld(body)`), so a failed probe for a deleted pick prevents pruning and leaves the comparison stuck on `video_not_found`. Neither `heldPicksOf` nor `isPickNotHeld` has any unit test or failure-path test (`test-every-fallback-path`).

**Recommended fix**
```diff
--- a/apps/web/src/retention-comparison.ts
+++ b/apps/web/src/retention-comparison.ts
@@ -227,7 +227,7 @@ export function heldPicksOf(
   alone: readonly CurvesBody[],
 ): string[] | null {
   const held = picks.filter((_, index) => {
     const body = alone[index]
-    return !body || !isPickNotHeld(body)
+    return body !== undefined && 'curves' in body
   })
   return held.length < picks.length ? held : null
 }
```
Add unit tests for `heldPicksOf` in `apps/web/src/retention-comparison.test.ts` (all held returns `null`, one `video_not_found` dropped, all dropped returns `[]`, and a failing one-pick read dropped) plus an `app.test.ts` test where the dead pick's prune probe fails.

**Remediation brief**
- **Design intent:** a pick that cannot be proven held by its one-pick read must never block the remaining held picks from drawing; keeping only picks whose one-pick read returns `{ curves, unread }` guarantees the prune terminates and never leaves an un-untickable dead pick in the URL.
- **Full surface:** `apps/web/src/retention-comparison.ts:226-235`, `apps/web/src/retention-comparison.test.ts`, and `apps/web/src/app.test.ts`.
- **Must preserve:** the happy-path prune test in `apps/web/src/app.test.ts:6836`, `latestOnly` cancellation mid-prune, and no `retention_curves_compared` event on prune.
- **The fix's own failure:** a transient failure on a valid pick's one-pick probe drops that pick from the URL, which is recoverable by ticking it again and strictly better than a permanently refused chart.
- **Do not touch:** `isPickNotHeld` (`RetentionComparison.tsx:60` still triggers pruning only on `video_not_found`).
- **Proof:** `pnpm exec vitest run apps/web/src/retention-comparison.test.ts apps/web/src/app.test.ts -t "retention comparison"` with the new failing-probe tests red before the change and green after.

### 9. On an ended channel, a video read with no curve still says YouTube has none "yet" though nothing will read it again — LOW
- **Location:** `apps/web/src/retention-comparison.ts:33, 138-144`
- **Attribution:** introduced in `3b51599d` and half-fixed in `dc4f2aa5` (`creator-analytics#951 review pass 1 finding 2`, which branched only the `readAt === null` case). Carried forward from `pre-pr-review-1.md` Finding 5 (still unfixed at `27cff35c`).
- **Real-world trigger:** a creator whose Pro subscription ended, inside the 30-day purge window, compares a video that the daily refresh had read with zero points. The legend displays `"YouTube has no retention curve for this video yet."` even though the refresh no longer runs for ended channels. Narrow state and copy-only promise, so LOW.

**Evidence**
```ts
// apps/web/src/retention-comparison.ts:137-145
detail:
  readAt === null
    ? body.unread === null
      ? comparisonText.notReadEnded
      : comparisonText.notRead
    : points.length === 0
      ? comparisonText.noCurve
      : readLabelOf(readAt, locale),
```

**Failure mode** — When `body.unread === null` (ended channel), `readAt !== null`, and `points.length === 0`, `comparisonViewOf` returns `comparisonText.noCurve` (`'YouTube has no retention curve for this video yet.'`), promising a future curve that will never be fetched.

**Recommended fix**
Add an ended-channel variant (e.g. `noCurveEnded: 'YouTube had no retention curve for this video when Stillstats last read it.'`, subject to Nick's copy approval, with no em-dash) to `comparisonText`, select it when `body.unread === null && points.length === 0`, and cover it in `apps/web/src/retention-comparison.test.ts` beside line 130.

**Remediation brief**
- **Design intent:** `unread === null` signals that the daily refresh no longer reads the channel; every legend message that would otherwise imply a future read must branch on it.
- **Full surface:** `apps/web/src/retention-comparison.ts:24-39, 138-145`; `apps/web/src/retention-comparison.test.ts:130-136` (and em-dash check at `:164-172` automatically covers `Object.values(comparisonText)`).
- **Must preserve:** `notRead`, `notReadEnded`, and paid-channel `noCurve` behaviour; all 20 tests in `apps/web/src/retention-comparison.test.ts`.
- **Do not touch:** the approved copy strings `notRead`, `notReadEnded`, and `noCurve`.
- **Proof:** `pnpm exec vitest run apps/web/src/retention-comparison.test.ts`, with the new ended-channel no-curve test red before the change and green after.

### 10. The curves API tests do not name the human step for what only real Google shows — LOW
- **Location:** `apps/api/src/retention-curves.test.ts:1-4`
- **Attribution:** introduced in `3b51599d` (`creator-analytics#951`). Carried forward from `pre-pr-review-1.md` Finding 6 (still unfixed at `27cff35c`).
- **Real-world trigger:** none for users; repo rule miss (`youtube-test-limits`).

**Evidence**
```ts
// apps/api/src/retention-curves.test.ts:1-4
// Limits: these tests write the curves straight into their two tables, as the worker's refresh
// stores them (apps/worker/src/retention-curves.ts), and read the uploads from the fake Google
// server. They cannot prove a real curve's shape against Studio's; the refresh's own tests cover
// what it stores.
```

**Failure mode** — The file uses `packages/fake-google` for the channel's uploads read (which drives `unread` and `video_not_found`) but names no human verification step, failing `.claude/rules/youtube-test-limits.md`.

**Recommended fix**
Extend the `Limits:` header in `apps/api/src/retention-curves.test.ts:1-4` to name Nick's walk of a paid channel on production at `/app/retention` as the human step covering real uploads publish times and real curve shapes against Studio, mirroring `apps/worker/test/retention-curves.test.ts:1-4`.

**Remediation brief**
- **Design intent:** every test file standing in for Google names both what the fake cannot observe and the human step that observes it (`youtube-test-limits`).
- **Full surface:** `apps/api/src/retention-curves.test.ts:1-4`.
- **Must preserve:** all 11 tests in `apps/api/src/retention-curves.test.ts`.
- **Do not touch:** test assertions or fixtures.
- **Proof:** inspect `apps/api/src/retention-curves.test.ts:1-6` and run `pnpm lint`.

### 11. The curve refresh has no test of a Google failure on its uploads read — LOW
- **Location:** `apps/worker/src/retention-curves.ts:126-127`, `apps/worker/test/retention-curves.test.ts`
- **Attribution:** introduced in `8834444c` (`creator-analytics#950`). Carried forward from `pre-pr-review-1.md` Finding 7 (still unfixed at `27cff35c`).
- **Real-world trigger:** a Data API outage at 09:00 UTC fails the plan scope's `uploads` read. The code returns `{ refusal: channel.refusal }` and reports `google_failed`, but no test exercises `dropDataApi()` on the refresh (`test-every-fallback-path` miss).

**Evidence**
```ts
// apps/worker/src/retention-curves.ts:126-127, 151
const channel = await gateway.read(tx, channelId, 'uploads', {})
if (!channel.ok) return { refusal: channel.refusal }
// ...
if ('refusal' in plan) return refused(plan.refusal)
```

**Failure mode** — `apps/worker/test/retention-curves.test.ts` tests `google.dropAnalyticsApi()` (`:609-638`) and a revoked connection (`:582-607`), but never calls `google.dropDataApi()`, leaving the plan-scope Data API failure path and its GlitchTip report unguarded.

**Recommended fix**
Add a test beside `:638` in `apps/worker/test/retention-curves.test.ts` that seeds a stored curve, calls `google.dropDataApi()`, runs `handlers.retentionCurveRefresh(worker, { channelId })`, and asserts the stored curve is unchanged, `google.analyticsRequests` is empty, and `reporter.reports` equals `[{ message: "A channel's retention curve refresh failed", context: { channelId } }]`.

**Remediation brief**
- **Design intent:** a Data API failure during the plan scope ends the run without touching stored curves or making Analytics calls, and reports the failure once naming only `channelId`.
- **Full surface:** `apps/worker/test/retention-curves.test.ts` (new test after `:638`).
- **Must preserve:** all 20 existing tests in `apps/worker/test/retention-curves.test.ts`.
- **Do not touch:** `apps/worker/src/retention-curves.ts` (behaviour is already implemented).
- **Proof:** `pnpm exec vitest run apps/worker/test/retention-curves.test.ts` (requires Postgres/Testcontainers). Removing `if ('refusal' in plan) return refused(plan.refusal)` must turn the new test red.

### 12. The curve refresh database-error test passes for any throw from the last video's scope — LOW
- **Location:** `apps/worker/test/retention-curves.test.ts:660`
- **Attribution:** introduced in `3fd33585` (`creator-analytics#936 pre-PR review 1 finding 1`). Carried forward from `pre-pr-review-2.md` Finding 2 (still unfixed at `27cff35c`).
- **Real-world trigger:** none for users; a `test-every-fallback-path` miss where `.rejects.toThrow()` accepts any error rather than confirming the original database constraint error surfaced.

**Evidence**
```ts
// apps/worker/test/retention-curves.test.ts:660
await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toThrow()
```

**Failure mode** — Any unrelated exception thrown in the third video's scope satisfies `.rejects.toThrow()` without proving Postgres's unique-constraint violation (`23505`, `retention_curves_point_idx`) surfaced unaltered.

**Recommended fix**
```diff
--- a/apps/worker/test/retention-curves.test.ts
+++ b/apps/worker/test/retention-curves.test.ts
@@ -639,7 +639,7 @@ describe('seam 2: the daily retention curve refresh of a paid channel', () => {
 
   // A curve that repeats a point breaks the unique point index, a database error the gateway does
   // not turn into a refusal.
-  test('a database error storing one curve keeps the curves read before it, and reaches the job runner', async ({
+  test('a database error storing one curve keeps the curves read before it, and throws to the job runner', async ({
     web,
     worker,
     clock,
@@ -657,7 +657,9 @@ describe('seam 2: the daily retention curve refresh of a paid channel', () => {
       { ...published('oldest', daysBefore(60)), retention: [repeated, repeated] },
     ])
 
-    await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toThrow()
+    await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toMatchObject({
+      cause: { code: '23505', constraint: 'retention_curves_point_idx' },
+    })
 
     expect(await storedReads(worker, channelId)).toEqual({
       newest: today.toISOString(),
```

**Remediation brief**
- **Design intent:** when a per-video scope fails on a database error, prior videos' commits stay intact and the original Postgres error propagates unchanged to the job runner (`test-every-fallback-path`, mirroring `packages/database/test/consent-states.test.ts:68`).
- **Full surface:** `apps/worker/test/retention-curves.test.ts:642, 660`.
- **Must preserve:** the stored-reads and stored-curves assertions at `:662-666` and the comment at `:640-641`.
- **Do not touch:** `apps/worker/src/retention-curves.ts`.
- **Proof:** `pnpm exec vitest run apps/worker/test/retention-curves.test.ts -t "a database error"` (requires Postgres/Testcontainers); throwing `new Error('unrelated')` on `oldest` in `apps/worker/src/retention-curves.ts` must fail red after the fix.

### 13. Comment hygiene — LOW (aggregated)
- `apps/worker/src/retention-curves.ts:62-66` — the JSDoc "The videos due a read, in the order they are read: ..." sits on `isYoung` (`:67`) → move it above `function dueVideos` at `:71`.
- `packages/database/src/retention-curves.ts:26` — `When Google answered the read that delivered the curve.` → `When the refresh's read of the curve ran (its scope's clock), or when the cached answer it used was fetched.`
- `packages/api-types/src/retention-curves.ts:33` — `ISO 8601, when the video was published. Null for a video not yet published.` → `ISO 8601: when the video was published, or when a scheduled video will be.` (matches `publishTimeOf` and `packages/api-types/src/videos.ts:223`).
- `packages/api-types/src/retention-curves.ts:36` — `when Google answered the read that stored the curve` → `when the read that stored the curve ran, or when its cached answer was fetched`.
- `README.md:85` — `(when Google answered the read that stored its curve` → `(when the read that stored its curve ran`.
- `apps/api/src/retention-curves.ts:14` — 165-column line inside a 100-column JSDoc paragraph → reflow to match surrounding width.
- `apps/site/test/site.test.ts:1805-1808` — `and the history purge deletes them with its reach history. The test holds those facts; the sentence rests on Nick's approval on the epic's PR.` → `and the history purge deletes them with its reach history (packages/retention-engine/src/history-purge.test.ts). The test holds that the storage item states those facts; the sentence rests on Nick's approval on the epic's PR.`
- `apps/worker/test/retention-curves.test.ts:7-9` — `The scope count test holds the shape that releases them, and the repro in docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts shows the release on separate connections.` → `The test 'a run opens one scope to plan and one per read, never one inside another' holds the shape that releases them, and the repro in docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts shows the Analytics quota row released between reads on separate connections; it does not probe the Data API row the plan's uploads read takes.`

## Needs Further Investigation

### A. A database error on one video's points repeats on every retry and every day, and loses that call's quota units — confirm whether Google ever answers a repeated or missing `elapsedVideoTimeRatio`
- Carried forward from rounds 1 to 4. The `retention_curves` insert has no `onConflictDoUpdate`, and `packages/youtube-gateway/src/reads/audience-retention.ts:19-23` does not guard against duplicate ratios or `NaN` from a missing ratio. Each failure rolls back that video's scope (losing its `quota_usage` increment while keeping earlier videos), retries via pg-boss's default retries, and blocks later videos in due order daily. What would confirm it: observing a duplicate or missing `elapsedVideoTimeRatio` in a live Analytics response during Nick's production walk. What would kill it: a documented YouTube Analytics API guarantee of unique, non-null ratios.

### B. A very large channel's run against pg-boss's job expiry — confirm the expiry setting
- Carried forward from rounds 1 to 4. A channel with 30,000+ older uploads runs at least 1,000 sequential Analytics reads (`readsPerRun`), and `packages/database/src/jobs.ts` configures no custom expiry on `retentionCurveRefresh`. Because each read commits in its own scope, an expired run preserves completed reads, but the timeout against real Google latency is unmeasured until production.

## Reviewed and Dismissed
- RLS isolation and cascading deletes on `retention_curves` and `retention_curve_reads` are untested — dismissed: both tables use `channelOwned` (`packages/database/src/channel-owned.ts`), `migrate.ts:11-20` runs `FORCE ROW LEVEL SECURITY`, `channel-owned.test.ts` checks cascade/forced RLS/policies across every `channel_id` table, `scopes.test.ts:77` iterates every channel-owned table dynamically, and `seed.ts:86-94` plus `delete-user.test.ts:176-185` seed both tables.
- Trailing `?` when `RetentionComparison.tsx:57` fetches `/api/channels/${channelId}/retention-curves?` with zero picks could trigger `invalid_ids` — dismissed: Hono parses an empty query string to `{}` so `singleQueryOf` leaves `single.query.ids` as `undefined`, which `idsOf(undefined)` turns into `[]` (covered by `apps/api/src/retention-curves.test.ts:207`).
- `RetentionComparison.tsx:294` (`list.kind === 'refused' ? list.message : null`) could render an empty `<p role="alert">` on empty lists — dismissed: an empty list has `list.kind === 'list'`, not `'invalid-range'`, and because `listQuery` hardcodes `window: 'lifetime'`, `'invalid-range'` is unreachable from the real API.
- `RetentionComparison` does not open a feedback screen of its own (`route.ts:525-532`) — dismissed: `apps/web/src/route.test.ts:874` explicitly tests that feedback opened from `/app/retention` reports `'video_list'`.
- `channel-picker.ts:22-25` (`routeToChannel`) leaves `/app/retention` for the new channel's video list — dismissed: recorded #951 assumption from round 1.
- Free channels can still tick checkboxes in the picker (`RetentionComparison.tsx:265`) — dismissed: explicitly tested in `apps/web/src/app.test.ts:6925` ("still lists the videos").
- `upgradeFeatures` lookup in `apps/web/src/app.test.ts:9244-9245` and `comparisonText` references in `retention-comparison.test.ts` — dismissed per round 4 Approach decisions (unpinned copy, branch observation through constants).
- Privacy policy `affirms` checks in `apps/site/test/site.test.ts:1814-1870` — dismissed per round 4 Approach decisions (facts driven by schema/purge/deleted-video code).
- `apps/api/src/retention-curves.ts:35` returning 403 `ErrorAnswer` `sort_without_history` instead of a `Refusal` — dismissed: mirrors sibling epic #934's shape (round 1).

## Minor / nits
- `apps/web/src/CursorPlot.tsx:30`: `HoverCardValues` uses `key={label}`; if two compared videos share an identical title, React emits a duplicate-key warning on hover.
- `apps/worker/src/retention-curves.ts:84`: the monthly re-read compares exact milliseconds (`>= 30 * dayMs`) while the daily re-read compares UTC days, so when `plan` runs at 09:00 UTC and the prior run's per-video `fetchedAt` landed seconds later, an older video slips to day 31 (still monthly).
- `apps/worker/src/retention-curves.ts:157-158`: unlike `apps/api/src/video-detail.ts:84`, there is no guard for `reportingDayOf(publishedAt) > reportingDayOf(tx.now)` (improbable at 09:00 UTC unless YouTube returns a future `videoPublishedAt`).
- `apps/api/src/routes/videos.ts:48` and `apps/api/src/routes/retention-curves.ts:23` duplicate the comma-separated video-id parser (`leave-the-code-better`).
- `apps/site/test/site.test.ts:1342` and `apps/web/src/upgrade.test.ts:51` duplicate the `comparedVideosLimit` regex without the `i` flag.
- `apps/web/src/app.test.ts:6759-6762`: `readOn18November` interpolates `title` into `new RegExp` unescaped (harmless for `"Video N"`).
- `apps/web/src/retention-comparison.test.ts:164-172`: em-dash check omits `comparisonSortOptions` labels and `retentionLinkText` (neither contains an em-dash today).
- `apps/web/src/RetentionComparison.tsx`: the five lines differ by colour alone, picker labels do not span the full row width, disabled 6th checkboxes cannot receive focus to announce `aria-describedby`, and `apps/web/src/app.test.ts` has no test driving a picker-list refusal (`:294`).
- `apps/api/src/retention-curves.ts:15`, `README.md:85`, `CONTEXT.md:173`: "the refusal Pro sorts use" is forward-looking until #934 merges.

## Test quality
Tests added or changed across the branch: ~104 cases across 16 test files. Execution against a `$BASE` checkout was not run (Antigravity review does not run `git worktree add`); static audit of every added and modified test file found no mocked-unit, call-shaped-only, assertion-free, or unread-snapshot tautology. Four remaining test-strength and coverage gaps are confirmed above: Finding 4 (missing activity-day tests for `/retention-curves`), Finding 5 (swapped/empty singular passes), Finding 6 (negative-only refusal check passes for any screen override), Finding 7 (four copy numbers untied to constants), Finding 8 (missing `heldPicksOf` unit and prune-failure tests), Finding 11 (missing `dropDataApi` refresh test), and Finding 12 (unconstrained `.rejects.toThrow()`).

## Before opening the PR
- **CI readiness:** `pnpm lint` (842 files), `pnpm typecheck`, `pnpm build`, and all 7 pure web unit suites (809 tests) are green at `27cff35c`. Postgres/Testcontainers suites (`pnpm test`) and `pnpm test:browser` could not run in this sandbox and must be verified green after remediation.
- **Commit hygiene:** commit this review doc and its two repro files (`docs/reviews/creator-analytics-936/repro/retention-comparison-ui.{test,vitest.config}.ts`) before running `/pr-review-remediate`.
- **Likely reviewer asks:** migration 0037's sequence number against sibling epics (#934, #938); the refresh's Analytics quota budget on large Pro channels; pg-boss retry/expiry settings for `retentionCurveRefresh` (NFI A and B).

## Verdict
**Not ready.** Gate: **Findings 1 and 2 (MEDIUM)** must be fixed before opening the PR — both are real, execution-proved UI defects on `/app/retention` (newly uploaded videos showing `"Average viewed 0%"` instead of `"Not processed yet"`, and empty/out-of-range picker pages showing a blank list or `"Page 5 of 2"`). **Findings 3 to 13 (LOW)** — two small new gaps (stale channel state on `channelId` change, activity-day doc/test parity) plus nine carried LOW items from rounds 1 to 4 — can be remediated in the same pass or tracked as follow-ups.

## Remediation — 2026-11-22
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `d2c07e5d` creator-analytics#936 pre-PR review 5 finding 1: a video awaiting processing shows Average viewed 0% in the retention picker | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t "has not processed yet says so in the picker"` red (`expected 'Video 2Oct 1, 2026Average viewed 0%' to contain 'YouTube has not processed this video …'`), green after; repro Finding 1 green | 0 | proved by execution |
| 2 (MEDIUM) | `d2bf6e4e` creator-analytics#936 pre-PR review 5 finding 2: the retention picker shows an empty list and keeps a page past the last | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t "a format with no videos says\|a page past the last moves"` both red (`expected <ul class="comparison-videos"></ul> to be null`; address stayed `page=5`), green after; a mutant that pushes in place of the replace turns the clamp test red; repro Finding 2b green, repro Finding 2a stays red for the harness reason in Approach decisions | 0 | proved by execution |
| 3 (LOW) | — deferred, not worked: LOW tail | — | — | — |
| 4 (LOW) | — deferred, not worked: LOW tail | — | — | — |
| 5 to 12 (LOW) | — deferred, not worked: LOW tail, carried from rounds 1 to 4 (5 is #1021, 6 is #1022, 7 is #1023, 8 is #1019, 9 is #1020) | — | — | — |
| 13 (LOW, comment hygiene) | — deferred, not worked: LOW tail | — | — | — |

Preserve suites through the root config: `apps/web/src/app.test.ts`, `route.test.ts`, `retention-comparison.test.ts` and `video-list.test.ts`, 1001 of 1001 green. Run from `apps/web` without the root config, 14 "What's new" tests fail because the highlights plugin has no fixtures there; that is the run, not the change. Full checks at `d2bf6e4e`: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (218 files, 5438 passed, 1 expected fail) and the browser walk, all green, at load 11.9 on 14 cores. Phase 2 sent no verify agent: both worked fixes are MEDIUM, their proofs were executed, and neither touched a shared core.

### Known regressions, deferred
- none

### Rework briefs
- none
