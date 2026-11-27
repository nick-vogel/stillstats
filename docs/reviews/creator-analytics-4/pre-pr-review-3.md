# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `9a13d3b` ("creator-analytics#211 Background: a read that never answers stops every surface on the tab"), clean tree, no uncommitted or untracked files at review time. 122 files, +18,651 / −136 (7,965 of those lines are the saved Studio HTML fixtures, 1,095 are `pnpm-lock.yaml`, and 858 are pre-PR reviews 1 and 2 with their `repro/`), 280 commits.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-14) and its sub-issues, `CODING_STANDARDS.md`, `CONTEXT.md`, ADRs 0007, 0008, 0011 and 0013, `README.md`, and pre-PR reviews 1 and 2 (findings, Approach decisions, dismissals, Known regressions deferred). Run with `--fresh`: the whole branch, not only the delta since review 2. Since review 2 (`0824f32` "creator-analytics#4 pre-PR review 2") the branch took #208, #209, #210, #211 and #212, which turned review 2's findings and review 1's NFIs B and D into tickets.
**Date:** 2026-10-14
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (437 files; 438 with this review's repro) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` (writes both extension builds) | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 105 files, 2,094 tests |
| Manifest permissions | Read the built `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | hold: host access to `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions`; Firefox gecko id `@stillstats`, 140, `authenticationInfo` required and `technicalAndInteraction` optional |
| Em-dashes in shipped copy | `git diff 5d4457d -- apps/site apps/web apps/extension/src packages README.md CONTEXT.md docs/adr docs/deploy.md apps/api \| grep '^+.*—'` | none |
| "Ranking by views" in the extension | `grep -rni 'ranking by views' apps/extension/src` outside tests | none |
| `ids` filter, event relay, CORS, shared types, harness | Agent read of the API halves against the spec | hold (details under Reviewed and Dismissed and Minor) |
| Reused Content list row during a read (Finding 1) | Executed: `repro/review-3.test.ts` "finding 1", real `watchStudio` and `contentList` on the saved Content list | red |
| Card comparison after a failed format read (Finding 2) | Executed: `repro/review-3.test.ts` "finding 2", real `watchStudio` and `latestVideoCard` on the saved dashboard | red |
| Page line on a tab with no rows (Finding 3) | Executed: `repro/review-3.test.ts` "finding 3" | red |
| README says the extension is free (Finding 4) | `grep -n -i free README.md`; the epic's Further Notes | absent |
| Tautology audit | Tests changed since `0824f32` copied into a scratch worktree at `0824f32` and run there; mutations of HEAD in a second scratch worktree. Review 1 audited the whole branch against `5d4457d` | 45 new or changed tests: 30 red at `0824f32`, 15 green; 9 of the 15 red under a targeted mutation, the other 6 are a signature change whose rule `watch.test.ts:163` pins. Two limit gaps (Finding 5), notes under Test quality |
| Prior repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | review 1's 6 green; this review's 3 red |
| Live browsers (Chrome and Firefox, WXT's Navigation API dispatch, Studio's real redraw timing, Firefox's popup during a permission prompt) | Not run: no browser in a review | NFI A to C; #99 / #101 |

**Repro command for every confirmed proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts` from the repo root. The repro files sit outside the root `vitest.config.ts` include pattern, so `pnpm test` stays green while they are red.

**Overall:** The branch is in good shape and all four CI checks pass. The API halves, the manifest, the two-host boundary, event privacy, and every fix from reviews 1 and 2 and from #208 to #212 hold. This fresh pass found no HIGH or MEDIUM defect. It confirmed three LOW extension defects, each proved red: a reused Content list row can show another video's figure while a read is in flight, a card whose format read fails once never gets its comparison row, and the Content list's page line stays on a tab with no rows. It also found one spec gap, the README's pricing section, and two test files that do not state their limits. The PR can open as it stands; Finding 4 is one line and is worth doing first.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210):** the give-up judges the navigation WXT reported, now held in `nav` from `freshNavigation(to)`; a pass on a URL WXT has not reported yet places for the next navigation (`ahead`) and reports nothing. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it (see Reviewed and Dismissed).
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, injectable for tests. Precedent: `createEventRelay`'s `sendTimeoutMs`.
- **Row sweep (Finding 1, new):** a figure whose row Studio points at another video is dropped on the watch's pass tick even while another pass holds the lock, through an optional synchronous `sweep(document)` on `Surface` that `schedulePass`'s timer calls before `pass()`. Precedent: `dropChangedRows` in `content-list.ts`, which already does this at the start of a pass.
- **Comparison retry (Finding 2, new):** a card figure whose format read did not answer is kept like a line (`signedInReadKeptMs`), not like a shown answer, while the pass still returns `shown`. Precedent: `isKept`'s split between a line and a shown answer.

## Confirmed Issues

### 1. A Content list row Studio points at another video while a read is in flight keeps the old video's figure until the read lands — LOW
- **Location:** `apps/extension/src/surfaces/content-list.ts:180-193`, with `apps/extension/src/surfaces/watch.ts:175-197`
- **Attribution:** Introduced. `dropChangedRows` and the read after it arrived with #95 (`541ca44` "creator-analytics#95 Content list: engaged views on every row"); the pass lock in `watch.ts` is also branch-only. Neither file exists at `5d4457d`.
- **Real-world trigger:** a first Studio change alters the page's set of ids, so a new read goes out, while some rows keep their video and figure; a second change then repoints those rows before the read answers. That happens when Studio redraws a page or filter change in two batches more than 250 ms apart, or when the creator changes filter or sort twice inside one cold read (a cold read waits on the YouTube APIs and is bounded at 15 s by `apiAnswerWithinMs`). LOW, capped by attainability: upgrade to MEDIUM if #99's walk-through sees Studio repoint Content list rows in more than one batch during a page, sort or filter change.

**Evidence**
```ts
      dropChangedRows(rows)
      const read = readOfAll(
        await Promise.all(
          chunksOf(ids).map((chunk) =>
            readVideosAndSendHeldClicks(options, {
```
`dropChangedRows` runs once, at the start of the pass. While the read is awaited, `pass()` holds `running`, so every mutation only sets `again = true` (`watch.ts:176-178`) and no other pass, and so no other sweep, runs until the read lands. The doc on `dropChangedRows` (`content-list.ts:125`, "Another video's figure never stays up in a row while the background answers for this one") states the rule this breaks.

**Failure mode** — Saved Content list, every row shown. Row 0 is pointed at a new id, so a second read goes out and is held. One second later row 1, which still shows `10,001 engaged views` for its first video, is pointed at `zzzzzzzzzz1`. Three seconds later row 1 still shows `10,001 engaged views` beside a row now listing another video. Executed: `repro/review-3.test.ts` "finding 1", red: `expected [ '10,001 engaged views' ] to deeply equal []`. In real use the figure goes when the read lands (the in-flight pass's `showInRows` with `fresh: true`, or its `!current()` return and the next pass's `dropChangedRows`), so the wrong figure lasts as long as the read.

**Recommended fix**
```diff
--- a/apps/extension/src/surfaces/watch.ts
+++ b/apps/extension/src/surfaces/watch.ts
@@ export interface Surface {
   name: ExtensionSurface
   isOn(url: string): boolean
+  sweep?(document: Document): void
@@ function schedulePass(): void {
     passTimer = setTimeout(() => {
       passTimer = undefined
+      for (const surface of surfaces) {
+        try {
+          surface.sweep?.(document)
+        } catch {}
+      }
       void pass()
     }, passEveryMs)
--- a/apps/extension/src/surfaces/content-list.ts
+++ b/apps/extension/src/surfaces/content-list.ts
@@ return {
     name: 'content_list',
     isOn: isContentList,
+    sweep(document) {
+      const list = videoListIn(document)
+      if (list) dropChangedRows(videoRowsIn(list))
+    },
     async place({ document, url, navigation, settled, current }) {
```
Diff audit: nothing existing is removed or reordered. `dropChangedRows` at `content-list.ts:180` stays, so a pass still sweeps before it reads. The sweep only removes a figure whose row now shows another video, which is never correct to keep, so running it more often cannot remove a right figure. `stop()` clears `passTimer` and disconnects the observer, so no sweep runs after a stop. If a sweep throws, the `catch` keeps the pass running, the same way `placeAll` maps a throwing `place` to `not-found`; the backstop for a swept row is then the pass-start `dropChangedRows` as today.

**Remediation brief**
- **Design intent:** the watch runs one pass at a time per tab (`pass()` in `watch.ts`), and a Content list pass awaits one background read per page. Figures live in `placed` (a `WeakMap` from Studio's row element to `{ videoId, host }`). The rule is that a row never shows a figure for a video other than the one it links; the sweep enforces it on Studio's own redraw cadence (the 250 ms pass tick), independent of the read.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:18-35` (`Surface`, add `sweep?`), `watch.ts:191-197` (`schedulePass`); `apps/extension/src/surfaces/content-list.ts:147-150` (the returned surface, add `sweep`), reusing `dropChangedRows` (`:126-134`), `videoListIn` and `videoRowsIn` (already imported). `card.ts` and `analytics.ts` need no `sweep`: their element is keyed per Studio element and video in `video-row.ts`.
- **Must preserve:** `content-list.test.ts` "a row Studio points at another video loses its figure at once, while the background answers for the new one" (`:337`), "rows Studio points at other videos and back before the answer lands show the answer's figures, with no second request" (`:377`, a row pointed back must get its figure from the held answer, which `showInRows` does when the read lands), "rows Studio reorders within one navigation while the background answers each show their own video's figure" (`:399`), and the three "once the extension stops" tests (`:611-646`); `watch.test.ts` whole file (fake surfaces have no `sweep`, so the optional method must stay optional).
- **Do not touch:** the pass lock itself (`running` / `again`) and `stop()`'s `again = false` (review 1 F2 rework `89a8152`); the `ahead` handling in `placeAll` (#210).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts -t "finding 1"` red now, green after. Add the same case to `apps/extension/src/surfaces/content-list.test.ts` beside `:337` ("a row Studio points at another video while a read is in flight loses its figure at once"), red before the fix. Then `pnpm exec vitest run apps/extension`.

### 2. A card whose format read fails once never gets its comparison row while Studio keeps the card — LOW
- **Location:** `apps/extension/src/surfaces/video-row.ts:70-75`, `:92`, `:105-106`; `apps/extension/src/surfaces/card.ts:34-44`; `apps/extension/src/surfaces/watch.ts:66-68`
- **Attribution:** Introduced with #94 (`f59e1ff` "creator-analytics#94 Latest video card: place among the last 10 by engaged views"), which added the format read and the test that pins the immediate state only (`card.test.ts:676`).
- **Real-world trigger:** the card's own read answers and the format read (newest 10 public uploads of the format, a separate query) comes back failed, refused or signed out: a YouTube error or a 15 s timeout on a cold query, or `quota_reserved` crossing between the two reads. Studio keeps the dashboard's card element while the creator stays on it, so the row stays missing until a reload.

**Evidence**
```ts
    if (held && sameRead && (!held.host || held.host.isConnected) && isKept(held)) {
      return held.placement
    }
```
```ts
export function isKept({ placement, at }: { placement: Placement; at: number }): boolean {
  return placement === 'shown' || Date.now() - at < signedInReadKeptMs
}
```
A figure whose comparison read failed is still `shown`, and `isKept` keeps a shown placement with no time limit, so neither read is asked again while the Views row element and video stand.

**Failure mode** — Saved dashboard; the card's own read answers, the first format read answers `{ state: 'failed' }`, every later one answers. The card shows "1,234 engaged views" with no comparison row. After `signedInReadKeptMs` plus a second and a Studio mutation, the format has been read once and the card still has no row. Executed: `repro/review-3.test.ts` "finding 2", red: `format reads asked: expected 1 to be greater than 1`. The creator loses the "n of m Format" row for the rest of that dashboard visit, with nothing saying why.

**Recommended fix**
```diff
--- a/apps/extension/src/surfaces/card.ts
+++ b/apps/extension/src/surfaces/card.ts
@@ async comparisonOf(video) {
           const read = await readVideosAndSendHeldClicks(options, {
             youtubeChannelId,
             format: video.format,
             newest: comparedUploads,
             window: 'lifetime',
           })
-          return comparisonOf(video, read)
+          return read.state === 'read' ? comparisonOf(video, read) : 'unread'
         },
--- a/apps/extension/src/surfaces/video-row.ts
+++ b/apps/extension/src/surfaces/video-row.ts
@@
-  comparisonOf?: (video: VideoRow) => Promise<ComparisonView | undefined>
+  comparisonOf?: (video: VideoRow) => Promise<ComparisonView | 'unread' | undefined>
@@ const placed = new WeakMap<
       host: Element | undefined
       placement: Placement
+      keptAs: Placement
       at: number
@@
-    if (held && sameRead && (!held.host || held.host.isConnected) && isKept(held)) {
+    if (
+      held &&
+      sameRead &&
+      (!held.host || held.host.isConnected) &&
+      isKept({ placement: held.keptAs, at: held.at })
+    ) {
       return held.placement
     }
@@
     const comparison = video && (await comparisonOf?.(video))
@@ renderSurface({
-      comparison,
+      comparison: comparison === 'unread' ? undefined : comparison,
@@
     const placement: Placement = showsAnswer(view) ? 'shown' : 'placed'
-    placed.set(after, { videoId, window, periodLabel, host, placement, at: Date.now() })
+    const keptAs: Placement = comparison === 'unread' ? 'placed' : placement
+    placed.set(after, { videoId, window, periodLabel, host, placement, keptAs, at: Date.now() })
     return placement
```
Diff audit: the pass still returns `shown` for a figure without its row, so `extension_surface_shown` is still asked once per navigation (the watch's `nav.shown` deduplicates the later passes). `sameRead` is true on the retry, so `held.host` is not removed before the reads and the figure stays up while they run; `removeSurface(root, surface)` then swaps in the new element as today. The analytics surface passes no `comparisonOf`, so `comparison` is `undefined` there and `keptAs` equals `placement`. When the retry fails again, the card keeps its figure with no row and retries again after another `signedInReadKeptMs`, the same cadence as a line; each retry is one background request (`readVideos` keeps only `read` answers).

**Remediation brief**
- **Design intent:** `videoRowPlacer` places one element after a Studio element (the card's Views row, the analytics key metric header) and keeps it while that element, video, window and period stand. `isKept` keeps a shown answer for as long as its element stands and a line (sign in, connect, try again) only `signedInReadKeptMs`, because only time tells a surface to look again. A comparison row that was due but could not be read is in the line's position: something to look at again later, not a finished answer.
- **Full surface:** `apps/extension/src/surfaces/card.ts:34-44`; `apps/extension/src/surfaces/video-row.ts:37` (the `comparisonOf` type), `:46-56` (`placed`), `:70-75` (the keep check), `:92` and the `renderSurface` call at `:94-102`, `:105-106`. `comparison.ts`'s `comparisonOf(video, read)` keeps its signature. `watch.ts`'s `isKept` is unchanged.
- **Must preserve:** `card.test.ts` "a format read that is %s leaves the figure with no comparison row and no line, counted as shown once" (`:676`, three rows), "a format answer that leaves the card video out shows the figure and no comparison row" (`:693`, that `undefined` must stay kept as shown, with no retry), "a latest upload YouTube has not processed shows ... makes no second read" (`:668`), "a Studio redraw of only the Views row leaves one extension row" (`:245`), the stop test (`:282`); `analytics.test.ts` whole file.
- **Do not touch:** the card and analytics figures not being re-read while their element stands (review 1 dismissal, restated below); `comparisonOf`'s sort and tie order in `comparison.ts`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts -t "finding 2"` red now, green after. Add the case to `card.test.ts` beside `:676` ("a format read that failed is asked again once a line's time has passed, and its row then shows"), red before the fix. Then `pnpm exec vitest run apps/extension`.

### 3. The Content list's page line stays on a tab Studio draws with no rows — LOW
- **Location:** `apps/extension/src/surfaces/content-list.ts:157`
- **Attribution:** Introduced with #95 (`541ca44`). Review 1 listed it as a reasoned nit; this round executed it.
- **Real-world trigger:** the creator opens a Content list tab with no uploads (Live on a channel that never streamed, Shorts on one with none) or a filter that matches nothing, and Studio keeps the list and its column headings.

**Evidence**
```ts
      if (!list || !header || !youtubeChannelId || ids.length === 0) return 'not-found'
```
The early return leaves the previous page's `answered.pageHost` (the pill, the icon and "Through 7 Oct") after Studio's headings.

**Failure mode** — Saved Videos tab, shown; the URL moves to `/videos/live` and every row is removed. Three give-up periods later one `content_list` element is still in the page. Executed: `repro/review-3.test.ts` "finding 3", red: `expected 1 to be +0`. The creator sees an engaged views line over an empty list. Unverified: whether real Studio keeps `#table-header` on an empty tab (#99).

**Recommended fix**
```diff
-      if (!list || !header || !youtubeChannelId || ids.length === 0) return 'not-found'
+      if (list && header && ids.length === 0) answered?.pageHost.remove()
+      if (!list || !header || !youtubeChannelId || ids.length === 0) return 'not-found'
```
Diff audit: nothing is removed. `answered` is kept, so rows that come back as answered re-place the page line through `content-list.ts:171-173` and reuse the read, as a redraw does today. A list or heading that is missing (Studio mid-redraw) still leaves the line, since only an empty drawn list removes it. The placement is still `not-found`, so the empty tab is still reported missing as `content-list.test.ts:521` pins.

**Remediation brief**
- **Design intent:** the Content list places one page line after Studio's column headings and one figure per row; `answered` carries the last page's read into the next navigation until that one settles, so Studio's outgoing rows are not read again mid-navigation. A page line belongs to rows; with no rows it states nothing.
- **Full surface:** `apps/extension/src/surfaces/content-list.ts:157` only.
- **Must preserve:** `content-list.test.ts` "a navigation to a tab Studio draws empty, after the outgoing rows stood for a pass, is reported missing and not shown" (`:521`), "a creator who leaves the Content list and comes back to the same rows ..." (`:454`), "a Studio redraw of one row leaves one figure in its views cell" (`:597`), "a list Studio draws before the give-up time is not reported missing" (`:775`).
- **Do not touch:** the empty tab being reported `extension_surface_missing` (pinned at `:521` on purpose; the noise it adds to the missing signal is a question for #99, not this fix).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts -t "finding 3"` red now, green after. Extend `content-list.test.ts:521` to assert no `content_list` element is left once the empty tab settles, red before the fix.

### 4. README's pricing section does not say the extension is free — LOW
- **Location:** `README.md:20-24`
- **Attribution:** Introduced by omission. The epic's Further Notes: "`README.md`'s pricing section does not say the extension is free. It changes with this epic." The branch adds three extension paragraphs to README (`:104-117`) and none says so; `git log 5d4457d..HEAD -- README.md` shows no pricing edit.
- **Real-world trigger:** any reader of the product brief.

**Evidence** — `grep -n -i free README.md` matches only "a free result" (`:13`), "Free tier: current analytics ..." (`:23`) and "free tools links" (`:102`). `CONTEXT.md:161` does say it: "It is free and shows free tier numbers only."

**Failure mode** — The epic's own spec item is unmet, and the README and CONTEXT.md disagree on what the extension costs.

**Recommended fix**
```diff
 - Free tier: current analytics for the creator's own channel, including engaged views. No stored history.
+- Studio extension: free, and shows free tier numbers only.
 - Paid tier: about $6 to $9 a month, for CTR and impressions history, and later outlier scores.
```
Copy is Nick's to approve; the line reuses CONTEXT.md's wording and has no em-dash.

**Remediation brief**
- **Design intent:** README holds the product brief; the pricing section is the "working" price list. The extension is free and shows free tier numbers only (epic, Plan; CONTEXT.md **Studio extension**).
- **Full surface:** `README.md:20-24`. No other file states pricing.
- **Must preserve:** the other three pricing bullets and the competitor line.
- **Do not touch:** `CONTEXT.md:161`.
- **Proof:** `grep -n -i 'extension: free' README.md` finds the line.

### 5. Two test files do not state their limits, and one relay test claims less than its file says — LOW
- **Location:** `apps/extension/src/product-api.test.ts:1-4`; `apps/extension/src/surfaces/watch.test.ts:1`; `apps/api/src/events.test.ts:1-8` with `:123-134`
- **Attribution:** Introduced. The bound tests arrived with #211 (`1aba17b`, `9a13d3b`); the watch's navigation tests with #210 (`e84971f`, `d864c97`); the extension-origin relay test with #89.
- **Real-world trigger:** a maintainer reads a green suite as proof of something it cannot observe. CODING_STANDARDS.md rule 2, "A test states its own limits".

**Evidence**
- `product-api.test.ts:134`, `:229`, `:419` each pass `answerWithinMs: shortBoundMs` (20 ms). The production default `apiAnswerWithinMs = 15_000` is pinned by nothing: setting it to `2_147_483_647` left all three green (audit mutation). The header names only the cookie limit.
- `watch.test.ts` opens with no `Limits:` comment, though its three new tests (`:134`, `:163`, `:192`) model WXT 0.21.4's 1 s location poll and its Navigation API dispatch order, which #210 says "was not checked in a browser". Every other jsdom test file in `surfaces/` states its limits (`studio-surfaces.test.ts:2-5`).
- `events.test.ts:123-134` "a signed-in request from %s is relayed" uses the test `Browser`, which attaches the session cookie whatever the origin, so it shows only that the API does not refuse an extension origin. Its sibling `channels.test.ts:54-56` says so; `events.test.ts`'s header does not.

**Failure mode** — No behaviour is wrong; the suite claims coverage it lacks.

**Recommended fix** — Add to `product-api.test.ts`'s header: the bound tests use a 20 ms bound and a fake fetch that rejects on abort, so they show a bound ends a hung request, not that 15 s suits the API or that each browser's fetch aborts the same way; creator-analytics#99 stalls the API in both browsers. Add a `Limits:` header to `watch.test.ts`: fake surfaces and hand-called `navigated`, so neither WXT's real `wxt:locationchange` (1 s poll or the Navigation API's `navigate` event) nor Studio's real draw timing is seen; creator-analytics#99 walks real Studio. Add to `events.test.ts`'s header the sentence `channels.test.ts:54-56` uses: the extension-origin tests cannot show a browser sending the session cookie from an extension origin; creator-analytics#101 does.

**Remediation brief**
- **Design intent:** rule 2 of `CODING_STANDARDS.md`: where the environment cannot observe the real behaviour, the file says so and names the human step.
- **Full surface:** the three headers named above. No test body changes.
- **Must preserve:** every test in the three files as written.
- **Do not touch:** `event-relay.test.ts:1-3`, which already states the matching limit for the relay's 3 s default.
- **Proof:** `pnpm lint` green; the three headers read as above.

## Needs Further Investigation

### A. A `navigate` that never commits leaves the watch "ahead" until the next navigation
`watch.ts:149` treats a pass whose `url()` differs from the URL WXT reported as ahead of it, and an ahead pass reports nothing. WXT 0.21.4's Navigation API path (`wxt/dist/utils/internal/location-watcher.mjs`) dispatches `wxt:locationchange` from every `navigate` event, including a cross-document one that is later cancelled or a link that turns into a download, so `nav.url` can name a URL `location.href` never reaches. Until the next navigation, no surface reports shown or missing, and the give-up judges a page the creator is not on. Telemetry only; figures still draw. What would confirm it: whether Studio has `<a download>` links or a navigation it cancels (the unsaved-changes prompt in the Details editor), checked in #99; and a `watch.test.ts` case calling `navigated(x)` where `url()` never becomes `x`.

### B. Studio replacing the card's Views row or the analytics header leaves the old figure up while the new read runs
`video-row.ts:76-77` removes the old figure before the read only when Studio reuses the same element; with a new element, `held` is undefined and the old host stays until `removeSurface` after the read (`:103`). On the analytics page, a move from video A to video B whose `#key-metric-header` Studio replaces would show A's figure beside B's header for the read's duration. What would confirm it: #99 moving between two videos' analytics pages, or a fixture of Studio's redraw. The comment at `:76` ("Another video's or period's numbers never stay up while the background answers for these") is true only for a reused element.

### C. Firefox may close the popup when "Allow access" opens its permission prompt
`popup-page.ts:38-44` and `:83-86` re-render after `permissions.request` settles. If Firefox closes a toolbar popup when the prompt opens, the creator has to reopen the popup to see the channels. Not checked against Mozilla's docs or a browser. What would confirm it: #101's Firefox pass.

Review 1's NFI A (Firefox's data declaration may need `websiteContent` or `browsingActivity`) and NFI C (a surface whose page goes off, the Collabs tab) stand unchanged. Review 1's NFI B (a hung read) was closed by #211 and NFI D (`x-client-ip`) by #212; review 2's NFI A (a shown surface reported twice around WXT's report) was closed by #210's `ahead` handling.

## Reviewed and Dismissed
- A 401 on an event send does not forget the kept channels and video reads (`product-api.ts:180-192`) — an event is not a read (Approach decisions). It creates no disagreement between views: no surface draws from an event's answer, and the popup's 30 s of "Signed in" is the same window any sign-out the background has not seen yet gets.
- Concurrent reads are not deduplicated, so a cold cache can repeat `GET /api/channels` or a video list request (`product-api.ts:132-179`, `content-list.ts:181-190`) — review 1's dismissal stands: one pass at a time per tab, and a page is one chunk unless Studio shows more than 50 rows (its rows-per-page choice is believed to top out at 50, not checked here).
- `apiAnswerWithinMs` bounds each request, so a cold video read can take two bounds (`product-api.ts:13-21`) — a channels read that times out fails the video read at once, so two full bounds need a channels answer just inside the bound followed by a stalled list read. The comment's claim holds for a stalled API.
- "The background never answers" labels a fake that rejects at once (`popup.test.ts:211-216`, `popup-link.test.ts:77-83`) — in Chrome, `runtime.sendMessage` with no receiver rejects with "Could not establish connection", which is what the fake does; the label names the cause.
- `cf-connecting-ip` trusted without proof of Cloudflare, a partial OpenPanel config switching the relay off silently, sibling scopes in the database harness (`routes/events.ts:37-41`, `server.ts:35-59`, `packages/database/test/harness.ts:58-84`) — review 1's dismissals stand: analytics only behind Cloudflare, "all three or none" documented in README and `docs/deploy.md`, no caller opens sibling scopes.
- The card and analytics figures are not re-read on a later navigation while Studio keeps their element (`video-row.ts:73`) — deliberate, per `isKept`'s doc; review 1's dismissal stands. Finding 2 changes only a figure whose comparison read did not answer.
- `period-default` shows lifetime labelled "Lifetime" (`analytics.ts:27-33`) — the spec's rule for a period not carried in the URL ("If Studio does not carry the analytics period in the URL, the panel shows lifetime labelled Lifetime"); review 1's dismissal stands.
- `product-api.ts:16-17` cites `sendTimeoutMs` in `event-relay.ts`, which #210 renamed to `defaultSendTimeoutMs` — `sendTimeoutMs` is still the option name there and holds the 3 s default, so the reference resolves.

## Minor / nits
- `idSetOf` checks an id's characters, not its length (`routes/videos.ts:47-51`), so `ids=a` is left out rather than refused `invalid_ids`. Harmless: an unknown id is left out anyway.
- `POST /api/events` has no body size limit (`routes/events.ts:52`); no POST route in the API has one, and the relay's limit caps the count.
- `void firstRunOnInstalled(...)` (`background.ts:44`) rejects unhandled when `tabs.create` or `permissions.getAll` rejects, and a failed open also skips `extension_installed`; the first-run page's "Got it" (`first-run/main.ts:11-14`) has the same shape. Carried from review 1.
- A 200 in flight when another read's 401 clears the caches writes its read back (`product-api.ts:141`, `:177`). Carried from review 2.
- `isKept` measures with `Date.now()` (`watch.ts:67`); a clock stepped back keeps a line longer. Carried from review 1.
- The popup comments say Chrome's `sendMessage` throws before it returns a promise "once the extension is updated under an open popup" (`popup-link.ts:7-9`, `popup.ts:139-140` and their tests); Chrome closes an extension's own pages on update, so the case may be a content-script one only. Unverified; the guard is harmless.
- Copied test helpers: `popupStorage()` and `recordingAsk()` across the popup tests, `analytics.test.ts:330-343` building its own clicks beside `clicks` from `testing.ts`; `card.ts:34`'s method `comparisonOf` shadows the imported `comparisonOf` by name; `video.format === null` checked in both `card.ts:35` and `comparison.ts:23`.

## Test quality
Tests new or changed since review 2 (`0824f32`): 45 (parameterised cases counted singly) · red at `0824f32`: 30 (assertion or timeout failures, none import) · green at `0824f32`: 15, of which 9 go red under a targeted mutation of HEAD (each the proof of a #208, #210 or #212 finding) and 6 are `navigated()` → `navigated(url)` signature changes that cannot tell `to` from `url()`; the `to` rule is pinned by `watch.test.ts:163`, which the same mutation turns red · tautology shapes found: none (no expectation computed with the production helper, no mocked unit under test, no call-shaped-only or assertion-free test). Review 1 audited the whole branch against `5d4457d`. Notes:
- `popup-page.test.ts:140`, `expect(checks).toBe(2)`, is the only assertion that sees the re-read after "Allow access" (a clone mutation leaves the identity check at `:139` green). It also fixes the reads per `show` at exactly one. Optional: make the second answer observable in the DOM.
- `host-access-request.test.ts:210`, `expect(chrome.requested).toEqual([])` when the open tabs query fails, can barely go red (no tab id exists to ask on); `unhandled` and `started` carry the test. Optional: drop the line.
- `event-relay.test.ts:29` accepts any `Error` for the timeout case; `received` of length 1 rules out a failure before the send. Optional: assert `{ name: 'TimeoutError' }`.
- The limit gaps are Finding 5.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `9a13d3b`.
- **Commit hygiene:** commit this doc and `repro/review-3.test.ts` (outside the suite's include pattern, so `pnpm test` stays green while it is red). Nothing else to drop; the tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets still open under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126); the OpenPanel variables unset in Dokploy; review 1's NFI A before the AMO submission; review 1's note that `0fa5357`'s commit body overstates the video list smoke test.

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it: this fresh whole-branch pass found no CRITICAL, HIGH or MEDIUM defect. Do Finding 4 before the PR opens, since it is one line and an explicit item of the epic. Findings 1 to 3 are LOW extension defects, each with a red repro and a small fix; Finding 1 rises to MEDIUM if #99 sees Studio repoint rows in batches. They fit one short remediation round or follow-up tickets, as does Finding 5's three header lines. Every finding from reviews 1 and 2 stays closed, and #208 to #212 closed review 1's NFIs B and D and review 2's NFI A.
