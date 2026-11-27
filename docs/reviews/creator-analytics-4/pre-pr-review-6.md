# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `07308de` ("creator-analytics#226 Content list: say engaged views and the day in Studio's Views column heading, not at the edges of the list"), clean tree, no uncommitted or untracked files at review time. 139 files, +22,035 / −163 (7,978 of those lines are the saved Studio fixtures and their README, 1,095 are `pnpm-lock.yaml`, and 1,929 are pre-PR reviews 1 to 5 with their `repro/`), 360 commits.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-15) and its sub-issues, with #222, #223, #224, #225 and #226 read in full along with the run's recorded assumptions for each; `CODING_STANDARDS.md`, `CONTEXT.md` (Stillstats mark, Content list, Video's analytics page, Comparison row), ADRs 0008 and 0013; pre-PR review 5 (Approach decisions, findings, NFIs, dismissals, Minor). Run with `--fresh`: the whole branch, with extra scrutiny on what landed since review 5 read `d311ad1`: #222 (a Google outage at the consent's code exchange), #223 (ADR 0013's comparison row wording), #224 (review 5's proven LOWs), #225 (the analytics figure inside Studio's Views tile and the line above the chart) and #226 (the Content list's label in Studio's Views heading).
**Date:** 2026-10-15
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (441 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` (writes both extension builds) | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 106 files, 2,199 tests |
| Prior repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | review 5's 2 green (its Finding 1 holds fixed by #222); reviews 1 and 4 green; review 3's "finding 2" still red (review 5 Finding 3, never remediated: Finding 3 here); this review's 2 red (Finding 1) |
| Manifest permissions | Read the built `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | hold: host access to `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions`, `optional_permissions`, `externally_connectable` or `web_accessible_resources`; Firefox gecko id `@stillstats`, 140.0, `authenticationInfo` required, `technicalAndInteraction` optional |
| Only the background calls the API; message trust | Agent read of the source and the built bundles | hold: `fetch(` only in `product-api.ts`; only `runtime.onMessage`, no `onMessageExternal` |
| Channel separation in the background cache | Agent ran #224 item 1's test against the real module, then the cache key without the channel id | the test goes red under the mutation (it was the only one that did); the code holds |
| Em-dashes in shipped copy | `git diff 5d4457d -- apps/site apps/web apps/extension/src apps/extension/test/fixtures/studio/README.md packages README.md CONTEXT.md docs/adr docs/deploy.md apps/api \| grep -c '^+.*—'`; agent grep of `.output/` | 0; none in either built extension (the saved Studio HTML holds Studio's own, see Dismissed) |
| "Ranking by views" in the extension | `grep -rni 'ranking by views' apps/extension/src`, tests left out | none |
| #222: the code exchange outage | Agent read of `requestToken`, `completeConsent`, the callback in `app.ts`; review 5's repro | holds: a 5xx, no answer, a stalled body or a non-JSON 200 at the exchange lands on `connect_error=google_failed` or `revenue_error=google_failed` with the log line; `invalid_grant` stays `consent_denied`. Other 4xx answers still end on a 500 (Minor, unchanged from base) |
| #223 | Agent read of ADR 0013 against `CONTEXT.md`'s Comparison row and `comparison.ts` | agree |
| #224 items 1 to 4 | Agent trace of `content-list.ts`'s sweep, `card.ts`'s one re-ask, the new tests; test audit mutations | hold as recorded |
| #225: analytics figure, line and period | Agent read of `analytics.ts`, `video-row.ts`, `render.ts`; executed probe, then a repro | every state renders as CONTEXT.md says; the link writes `window`; no number read from Studio (`#metric-total` only locates the row). A move to another period or video while a selector misses leaves the old figure and link up (Finding 1) |
| Finding 1 | Executed: `repro/review-6.test.ts`, two cases | red at HEAD (both hosts of the page before stay); green with the recommended diff applied in a scratch worktree, where the extension suite (20 files, 420 tests), its typecheck and biome are green |
| #226: Views heading label | Agent read of `content-list.ts`, `render.ts`, `selectors/content-list.ts` | holds: the label replaces the page line on a page with figures, comes down with the rows, is re-placed once after a heading redraw, and `stop()` removes it. Real layout and the click-through are NFI A |
| Tautology audit | Tests changed since `d311ad1` copied into a scratch worktree at `d311ad1` and run there (Docker up for the API tests); targeted mutations of HEAD | 91 changed: 59 red at runtime, 0 at import, 32 green, each green one turned red by a mutation. No unkillable test. Details under Test quality |
| Live browsers (layout of the heading label and the tile figure, a screen reader's reading, `Intl` output, Firefox data consent) | Not run: no browser in a review | NFIs; #99, #101, #200, #225 and #226 hand checks |

**Repro command for every executed proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` from the repo root. The repro files sit outside the root `vitest.config.ts` include pattern, so `pnpm test` stays green while they are red. The repro imports the workspace's modules by relative path, since `docs/` resolves no `@creator-analytics/*` package.

**Overall:** All four CI checks pass, and #222 to #226 each do what their issue asked, with tests that go red without the change. This fresh whole-branch pass found no CRITICAL or HIGH defect. It confirmed one MEDIUM, capped for unproven attainability: on a video's analytics page, a move to another period or video while Studio has not drawn the Views number leaves the page before's figure and link up, now inside Studio's own Views tile. It also confirmed one LOW dead branch #225 left behind, review 5's stale repro (still red), and one aggregated comment hygiene entry, which carries review 5's three unfixed lines plus four new ones. Finding 1 is a four-line fix checked green; it is worth doing before the PR opens, though it does not have to gate it.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. A read already in flight that answers after the clear is kept (dismissed in reviews 1 to 3, restated below).
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock. #224 adds: while a same-key re-read is out, the sweep counts its own empty ticks (`emptySweeps`) and takes the page element down on the second, asking for that tick with `passAgain`.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** a card figure whose format read did not answer is kept like a line; the format read runs in `windowCovering(N)` and the extension sums each upload's first N entries; a format read counted to another day than the figure's is asked again at most once.
- **Content list figure and label (#219, #226):** each row's figure out of flow in the extension's own shadow root under Studio's number; the label and "Through <day>" in the extension's own host appended to Studio's Views heading cell, `pointer-events: none`, holding the page line's slot (`answered.pageHost`); a missing Views heading counts as not found.
- **Analytics placement (#225):** `videoRowPlacer` takes a per-call `render` returning each host with the Studio element it goes after; the figure goes after the Views tile's number row, the line after `#key-metric-header`; the placement is held by the header. **New here (Finding 1):** a pass that cannot find every one of the analytics page's Studio elements removes the surface's hosts before it answers `not-found`, as `stop()` does through `removeSurface`, so a page the extension cannot place shows nothing.
- **Google call bound (#214, #216, #222):** one per-call bound, `googleCallTimeoutMs` (10 s); a token endpoint that does not answer, stalls, or answers 5xx is a `TokenEndpointUnansweredError`, which the gateway's `read` and the vault's `completeConsent` both map to `google_failed`, logged as "Google's token endpoint did not answer a call". Unchanged.

## Confirmed Issues

### 1. A move to another period or video on the analytics page, while Studio has not drawn the Views number, leaves the page before's figure and link up — MEDIUM (capped)
- **Location:** `apps/extension/src/surfaces/analytics.ts:71-73`, with `apps/extension/src/surfaces/video-row.ts:129-130`
- **Attribution:** introduced by the branch, widened by #225. The not-found return before any removal came with `c3ecb41` (#96 review pass 1 finding 2), when the only selector the analytics page needed past the URL was the key metric header (`git show d311ad1:apps/extension/src/surfaces/analytics.ts`, line 73: `if (!videoId || !youtubeChannelId || !header) return 'not-found'`). `70b173f` (#225) added `!viewsNumberRow`, the Views tile's number row, which Studio is likelier to be without for a moment than the whole card's header, and moved the figure into Studio's own Views tile, where a stale number reads as part of Studio's tile.
- **Real-world trigger:** the creator changes the period in Studio's menu, or opens another video's analytics, and Studio's key metric card redraws its tiles (a loading state with no `#metric-total`, or a tile it rebuilds) at the moment the pass runs, and stays that way past the give-up. Unproven that Studio ever draws the tile without `#metric-total` for longer than a pass. **MEDIUM, capped: upgrade to HIGH if #99's walk-through, moving between periods and between two videos' analytics pages, ever shows the previous figure or link while Studio's Views number is missing or loading.** The consequence, if it happens, is the epic's own red line: one video's or period's number shown on another's page (user story 30, and "the extension shows nothing on a surface it cannot place", story 34).

**Evidence**
```ts
const header = keyMetricHeaderIn(document)
const viewsNumberRow = viewsNumberRowIn(document)
if (!videoId || !youtubeChannelId || !header || !viewsNumberRow) return 'not-found'
```
The only removals of an analytics host are in `videoRowPlacer` (`video-row.ts:130`, `if (held && !sameRead) for (const host of held.hosts) host.remove()`, and `removeSurface(root, surface)` at `:156`) and in `watch.ts:327`'s `stop()`. The first two run only after every selector matched; the analytics surface has no `sweep`.

**Failure mode** — Shown on `period-quarter` (both hosts up: "1,234 engaged views" in the Views tile, "Data from Stillstats as of 7 Oct. View this video in Stillstats." above the chart). Studio's number row goes, the URL moves to `period-week` (or to video `AAAAAAAAAAA`), `navigated` fires, the give-up passes. Executed (`repro/review-6.test.ts`, both cases red): both hosts of the page before are still there, the figure still the last 90 days' and the link still `.../app/videos/NDha0z6zDA8?channel=channel-1&window=last90`; `extension_surface_missing` is reported, so the miss reaches the maintainer, but the creator sees the old number in Studio's tile for as long as the selector misses.

**Recommended fix**
```diff
-import { type OpenedLink, renderVideoAnalytics } from './render.ts'
+import { type OpenedLink, removeSurface, renderVideoAnalytics } from './render.ts'
@@
       const header = keyMetricHeaderIn(document)
       const viewsNumberRow = viewsNumberRowIn(document)
-      if (!videoId || !youtubeChannelId || !header || !viewsNumberRow) return 'not-found'
+      if (!videoId || !youtubeChannelId || !header || !viewsNumberRow) {
+        removeSurface(document, 'analytics')
+        return 'not-found'
+      }
```
Checked in a scratch worktree at `07308de`: the repro goes green, the extension suite stays green (20 files, 420 tests), and the extension's typecheck and biome are clean. Diff audit: no existing line is removed or reordered; the only new behaviour is a removal on the not-found path. On a page where Studio has not drawn the card yet there is nothing to remove. When a selector misses for a moment on the same URL, the figure comes down and the next pass that finds every element draws it again: `placed`'s entry for the header then has disconnected hosts, so `videoRowPlacer` asks the background again (answered from its 30 s cache, or one API read after that). That flicker is the intended price: the spec says a surface that cannot place shows nothing. The fix adds no fallback that can itself fail; `removeSurface` is a `querySelectorAll` and `remove()`.

**Remediation brief**
- **Design intent:** `videoRowPlacer` holds one placement per Studio element (here the key metric header) and keeps its hosts while that element, the video, the window and the period label stand; a new video or period removes the old hosts before the read. That removal only runs once the surface has found every Studio element it needs, so a pass that finds fewer must clear the surface itself. A surface that cannot place shows nothing, and a figure never stays up for a video or period the URL no longer names.
- **Full surface:** `apps/extension/src/surfaces/analytics.ts:3` (the import from `./render.ts`) and `:73` (the not-found return). `removeSurface` is `render.ts:142`. Add the two repro cases to `apps/extension/src/surfaces/analytics.test.ts` beside "a change of period while the background answers never draws the old period's figure or link" (`:363`), using that file's `showPage`/`showPageFor`, `hosts()`, `pageUrl` and `watcher`. The card (`card.ts`) and the Content list are not in scope: the card has one video per channel, and the Content list's `sweep` (`dropChangedRows`) already drops a row's figure once Studio points the row at another video.
- **Must preserve:** `analytics.test.ts`'s "a change of period while the background answers never draws the old period's figure or link" (`:363`, exactly one `last7` link drawn, two hosts at the end); the "%s looks for no analytics figure and reports nothing" table (`:390-401`, pages where `isOn` is false: `place` never runs there); the not-found tests at `:516` (no key metric card, no header link), which must still report `extension_surface_missing` once; the line-click tests (`:533-567`); `watch.test.ts` as a whole.
- **Do not touch:** `video-row.ts`'s keep rule (a shown figure is not re-read while its element stands, review 1 dismissal); the content list's `place` not-found return (see NFI E); the analytics page's need for the Views number row on a line state (NFI D).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-6.test.ts` is red now (2 of 2) and must pass after; then `CI=1 pnpm exec vitest run apps/extension`.

### 2. `renderSurface`'s link branch is dead since #225 — LOW
- **Location:** `apps/extension/src/surfaces/render.ts:197-224`
- **Attribution:** introduced by `70b173f` (#225): the analytics page, the only surface passing `linkOf`, now draws through its own `render`, so the default `renderSurface` is reached only by the card, which passes no `linkOf`.
- **Real-world trigger:** none for a creator. A maintainer reading `renderSurface`'s doc ("`link` follows the day or "Not processed yet"") is told the card may carry a link it never can. `CODING_STANDARDS.md` rule 3 (a dead fallback on the change's own path).

**Evidence**
```ts
  if (link && showsAnswer(view))
    answer.append(
      ' ',
      whenOpened(newTabLink(document, link), () => link.opened()),
    )
```
`grep -rn linkOf apps/extension/src` outside tests: `video-row.ts:69,113,151` and `analytics.ts:91` only. `video-row.ts:154`: `render ? render(shown) : rowAfter(after, renderSurface(shown))`, and analytics always passes `render`.

**Recommended fix** — drop `link` from `renderSurface`'s parameters and type, delete the `if (link && showsAnswer(view))` statement, and delete the doc's sentence "`link` follows the day or "Not processed yet", never a line, which links the web app itself and tells `lineOpened` when the creator opens it." while keeping its "tells `lineOpened` ..." meaning for the line, as: "A line links the web app itself and tells `lineOpened` when the creator opens it." `renderSurface(shown)` at `video-row.ts:154` still type-checks, since `shown` carries `link` as an extra property of a variable, not a literal. Then fix the card test's comment (`card.test.ts:242`): "The card's figure row has no "Open in Stillstats" link, so no text on it says Stillstats." → "The card's figure row has no link, so no text on it says Stillstats."

**Remediation brief**
- **Design intent:** `renderSurface` draws the default single row (the card's) and `renderVideoAnalytics` the analytics page's two hosts; `VideoShown.link` stays, since the analytics `render` reads it.
- **Full surface:** `render.ts:197-224`; `card.test.ts:242`. `VideoShown` (`video-row.ts:25-33`) and `linkOf` keep `link`.
- **Must preserve:** `card.test.ts`'s "no text on it says Stillstats" assertion; every analytics link test (`analytics.test.ts:533-567`, and the line tests that read `viewInStillstats()`).
- **Do not touch:** `newTabLink` and `whenOpened` in `dom.ts`, still used by `renderVideoAnalytics` and the lines.
- **Proof:** `pnpm --filter ./apps/extension typecheck` and `CI=1 pnpm exec vitest run apps/extension` green after; `grep -n "link" apps/extension/src/surfaces/render.ts` shows no `link` parameter on `renderSurface`.

### 3. Review 3's preserved repro for its Finding 2 is still red, because its fixture predates #218 (review 5 Finding 3, not remediated) — LOW
- **Location:** `docs/reviews/creator-analytics-4/repro/review-3.test.ts:130-161`
- **Attribution:** introduced by `d5ad807` (#218), as review 5 found; review 5's Finding 3 was neither remediated nor filed, so it stands unchanged at `07308de`.
- **Real-world trigger:** none for a creator. The repro's fake rows carry no `engagedViewsByDay`, so under #218's rule the card video has no processed day and no comparison row; only its `'1 of 2 Videos by engaged views'` assertion fails. The rule it proved is pinned by `card.test.ts`'s "a format read that failed is asked again once a line's time has passed, and its row then shows".

**Recommended fix**
```diff
-  const card: VideoRow = { ...videoOf('NDha0z6zDA8', 1234), format: 'video' }
+  const card: VideoRow = {
+    ...videoOf('NDha0z6zDA8', 1234),
+    format: 'video',
+    engagedViewsByDay: [1234, 0],
+  }
@@
-      : readOf([card, videoOf('older000001', 99)])
+      : readOf([card, { ...videoOf('older000001', 99), engagedViewsByDay: [99, 0] }])
```
Review 5 checked this green in a scratch worktree; nothing in `card.ts` or `comparison.ts` that it depends on has changed since except #224's one re-ask, which a format read counted to the same day as the ids read never takes.

**Remediation brief**
- **Design intent:** preserved repros are each review's red-before-green record; each stays green once its finding is fixed, so a red one means a regression or a stale fixture.
- **Full surface:** `docs/reviews/creator-analytics-4/repro/review-3.test.ts:132` and `:143`.
- **Must preserve:** both assertions of the test as written; the file's other tests.
- **Do not touch:** `card.ts`, `comparison.ts`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts` red now, green after.

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/product-api.ts:13-19` — "How long the background waits for the API to answer a read or an event send before it gives up and answers failed. Long enough for a cold video list read, which the API answers only after its own unbounded calls to the YouTube Data and Analytics APIs (paging a large channel's uploads), ..." → "How long the background waits for the API to answer one request, a read or an event send, before it gives up and answers failed. A video read with no kept channels is two requests in a row, so it can wait twice this. Long enough for a cold video list read, which the API answers only after its own calls to the YouTube Data and Analytics APIs, each bounded at 10 seconds (`googleCallTimeoutMs`) but unbounded in number (paging a large channel's uploads), ..." (review 5's entry, still open, plus the two-request wait: `askForVideos` runs `readChannels` and then the video read, each through `readSignedIn`'s own `AbortSignal.timeout`).
- `apps/extension/test/studio-boundary.test.ts:34` — "Every way a script reads the text, a value or the look of a node." → "The ways the surfaces read a node's text, a value or its look today, in `selectors/` and `surfaces/` only (`dom.ts`, `messages.ts` and the content entrypoint are not scanned). Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `.href` and attribute-value selectors are not matched." (review 5's entry, still open, plus the unscanned files, which run in the content script and read nothing from the page today.)
- `packages/api-types/src/videos.ts:177-182` (the `ids` doc) — "`window`, `format` and `sort` apply as usual, and `pageSize` is capped at the number of ids. An empty or malformed list, one of more than `maxVideoIds`, ..." → "`window`, `format` and `sort` apply as usual, `publishDayTop` ranks the listed ids only, and `pageSize` is capped at the number of distinct ids. An empty or malformed list, one of more than `maxVideoIds` entries (duplicates counted), ..." (review 5's entry, still open, plus the duplicate count that `idSetOf` in `apps/api/src/routes/videos.ts:43-51` applies.)
- `packages/token-vault/src/token-vault.ts:270-273` — "The YouTube gateway ends a read that meets it as a Google outage." → "The YouTube gateway ends a read that meets it, and `completeConsent` a consent's code exchange, as a Google outage (`google_failed`)." (stale since #222, `c428509`.)
- `packages/token-vault/src/token-vault.ts:31-34` — "Under the extension's 15 s (...), with room left for the request's database work, so the API answers `google_failed` before the extension gives up." → "Under the extension's 15 s (...), with room left for the request's database work, so a request whose one Google call does not answer ends on `google_failed` before the extension gives up. The bound is per call: a request whose several calls each answer slowly can still outlast the extension."
- `apps/api/src/app.ts:250` — "No status and no error: the vault's error message may carry identifiers." → "No status and no error: the vault keeps the error, whose message may carry identifiers, and answers only the refusal." (the route never holds the error; the reason is the vault's.)

## Needs Further Investigation

### A. The Content list's heading label may run into the first row, and a click on it may not sort
`render.ts:59-73` (`headingStyle`) draws the label out of flow from a zero-width host appended to Studio's Views heading cell, `top: 1lh` plus `margin-block-start: 0.2em`, two lines tall (the pill, then "Through <day>"). If Studio's header row is shorter than about 2.5 extra lines, the label covers the first row's Views cell, where Studio's number sits. The fixture wires the sort to `<button id="views-header-name">` inside the heading (`content-list.html:903-915`), so a click through the `pointer-events: none` label lands on whatever is under it, which may not be the button: the recorded assumption that it "sorts as a click on Studio's heading does" is unproven. Reasoned, not executed: jsdom lays nothing out. What would confirm it: #226's Chrome hand check, light and dark, on a Videos tab with a long first row, clicking the label.

### B. Firefox's data declaration may under-declare what the extension sends (carried from review 1 NFI A)
`manifest.ts:52-57` declares `authenticationInfo` (required) and `technicalAndInteraction` (optional); every read sends Studio's channel id, video ids and period to stillstats.com. Whether AMO counts those as `browsingActivity` or `websiteContent` is a reviewer's call. What would confirm it: ask AMO, or settle it at #100 before the submission.

### C. The Pacific publish day relies on `Intl.DateTimeFormat('en-CA')` printing YYYY-MM-DD in every browser (carried from review 5 NFI C)
`comparison.ts:19-27`, and the same pattern in the web app, the gateway and the fake. What would confirm it: evaluate the expression in current Chrome and Firefox during #99.

### D. A line state on the analytics page needs Studio's Views number, which it never uses
`analytics.ts:73` requires `viewsNumberRow` before any placement, but a sign-in, connect or refusal line goes only after `header`. A Views tile Studio draws without `#metric-total` (a video with no data yet, or a loading state) would get no sign-in or connect line and report the page missing. What would confirm it: #99 opening the analytics page of a video published minutes ago, signed out.

### E. A Views heading that disappears after the Content list's figures show leaves them with no label
`content-list.ts:227` returns `not-found` before removing anything, so figures placed earlier stay with no label near them, the case the comment at `:226` exists to avoid. Studio dropping the heading while keeping the rows is unverified; the not-found test (`content-list.test.ts:1210`) removes the heading before the first show. Fix if confirmed: on a missing heading with the header present, `removeSurface(list, 'content_list')` before the return. Do not remove on `ids.length === 0`, which the two-empty-passes rule owns.

### F. A screen reader may hear "engaged viewsNot processed yet" in the analytics tile
`render.ts:280-283` appends the hidden label and the "Not processed yet" span with no space between them (the figure branch puts `' '` between number and label). Inside an `inline-flex` container the two may still be read apart. What would confirm it: VoiceOver or NVDA on a not-processed analytics page during #225's hand check. Fix if confirmed: `figure.append(heard, ' ', ...)`, and the same check for the Content list cell at `render.ts:363-366`.

Carried, unchanged: review 4 NFI B (real Studio may drop `#table-header` on a tab with no uploads; #129) and NFI C (`sendResponse` on a closed channel; #101); review 3's NFI on `#key-metric-header` replaced between two videos (the old line stays for the read's duration; the figure now goes with the header); review 1 NFI C. Review 5 NFI A (the row figure over the Date column) is now #219's hand-check history; its NFI D is closed by #224 item 4.

## Reviewed and Dismissed
- A video read in flight when another read's 401 clears the caches is written back and served for 30 s (`product-api.ts:177`, `:141`) — executed by an agent; already dismissed in reviews 1 to 3 ("the 200 written back after another read's 401"): the next read past 30 s, or any read that meets the 401, says signed out. Restated, not reopened.
- API answers shape-checked at the outer object only (`product-api.ts:72-84`) — the API is the product's own and typed through `@creator-analytics/api-types`; the recorded approach (review 1 F6) shape-checks as `isVideoListAnswer` does. A malformed element is a bug in the API, not an input the extension must survive.
- The connect tests' log assertions (`connect.test.ts`, the 503 and held-open cases) — #222's "Done when" asks for the repro cases "with its log assertion", and one message for one failure is its recorded assumption.
- Em-dashes in `apps/extension/test/fixtures/studio/*.html` (44) — Studio's own captured markup, saved verbatim as test input; editing it would falsify the capture. No authored copy carries one.
- `since_publish` and `period-default` show "Lifetime" (`analytics.ts:14-31`) — the spec's rule for a period the API does not serve; review 3's `period-default` dismissal stands.
- `cf-connecting-ip` trusted, `POST /api/events` with no body limit, a partly set OpenPanel config sending nothing — reviews 1 to 5's dismissals and Minor stand.
- `#224` item 3's sweep counter and item 4's single re-ask — each matches its recorded assumption; the counter resets whenever the list is not empty or no re-read is out.
- `stop()` and the new hosts — `removeSurface(document, name)` finds the heading host (light DOM inside Studio's heading), the cell hosts, the page line, and the analytics tile and line hosts.
- Reviews 1 to 5's other dismissals stand (event-send 401 not clearing caches, undeduplicated concurrent reads, harness sibling scopes, figures kept while their element stands, the dev popup's localhost link, the tie fixtures' order).

## Minor / nits
- A Google token endpoint 4xx other than `invalid_grant` (a 400 `invalid_request`, a 401 `invalid_client`, a 429) at the code exchange still ends on a raw 500 (`token-vault.ts:442`, rethrown at `:691`). Pre-existing, untouched: `5d4457d`'s `requestToken` throws the same plain `Error`. A 429 is arguably an outage; follow-up ticket material.
- The revenue half of #222 is tested for a 503 only (`revenue-consent.test.ts:154-167`), without the held-open case or the log assertion; the path is shared with the connect, whose tests cover both.
- `studio-boundary.test.ts` and `api-boundary.test.ts` match narrower than they could: the first scans `selectors/` and `surfaces/` only and misses `ariaLabel`-style reads (comment entry above); the second's import regex misses `'../product-api'` without `.ts`. `manifest.test.ts:78-88` asserts `permissions` undefined but not `optional_permissions`, `optional_host_permissions`, `externally_connectable` or `web_accessible_resources` (all absent in the built manifests today).
- `backgroundAnswerer` answers `undefined` to an unknown message type (`background-answer.ts:14-21`); only the extension's own contexts can message it.
- The web app's `google_failed` landing says "YouTube did not answer" (`apps/web/src/landing.ts:53,64`), and since #222 it also covers Google's token endpoint. Copy is Nick's call.
- Neither `CONTEXT.md`'s Comparison row nor ADR 0013 says a latest upload that is not public gets no comparison row; the spec and `card.ts` do.
- Carried from review 5: the one-pass page line reappearance over an emptied list; non-HTTP Google failures classed as unanswered; a token endpoint 5xx logged as "did not answer"; `host-access.ts:16`'s dead `?? []`; no `gecko_android`; WXT's `postMessage` handoff; `isKept` on `Date.now()`; copied test helpers; `card.ts`'s `comparisonOf` shadowing; `vitest.config.ts`'s `server.deps.inline` with no why line; `entrypoints/first-run/main.ts` reached by no test.

## Test quality
Tests new or changed since review 5's HEAD `d311ad1`: 91 (each `test.each` row counted; four tests whose bodies are unchanged and only sit beside edits left out) · red at `d311ad1`: 59 at runtime, 0 at import · green: 32, each turned red by a targeted mutation of HEAD (for example the cache key without the channel id for #224 item 1's test; `isOn: () => true` for the four "looks for no analytics figure" rows; reverting `a277b43`'s fix for the heading redraw test; an empty label in the heading on a line state for the seven line-state rows) · unkillable tests: none. Shapes found, none a merge gate:
- `content-list.test.ts:1183-1188` branches on its own expected value (`shown.startsWith('Through') ? [headingHost(), pageLineHost()] : [pageLineHost(), headingHost()]`), so one table carries two rules. Put the expected host in the table, or split the test.
- `analytics.test.ts:286-297` asserts on the `<style>` text with a regex (`colours(...)` equal to `['inherit']`, `labelRule` matching `clip-path: inset(50%)`), pinning a technique; `content-list.test.ts`'s `declaredFor` reads the CSSOM instead. Carried from review 5's note on the same file.
- `card.test.ts:817-853` is named for a review item ("NFI D: a format read counted one day past the figure, at a window edge", under "Proof for pre-PR review 5, NFI D") rather than the rule (`CODING_STANDARDS.md` rule 2). Rename to the rule, for example "a format read counted a day past the figure at a window edge names every day Google has processed"; keep the test, it is red at `d311ad1`.
- Carried from review 5: the #218 arithmetic stated in both `comparison.test.ts` and `card.test.ts`; `clippedAway` checking only `clip-path`.

## Prior-review closure
Review 5 (`3fc03fb`): 4 findings. Finding 1 (the code exchange outage) fixed by #222 (`c428509`), its repro green. Finding 2 (channel separation test) fixed by #224 item 1 (`4fb1fc8`), the test red under the mutation. Finding 3 (review 3's stale repro) untouched: Finding 3 here. Finding 4 (comment hygiene) untouched, all three lines: carried into Finding 4 here. Review 5's NFI D closed by #224 item 4. No MEDIUM-or-higher prior finding is open.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `07308de`.
- **Commit hygiene:** commit this doc and `repro/review-6.test.ts` (outside the suite's include pattern, so `pnpm test` stays green while it is red). The tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets still open under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); #222 to #226 open though their work is on the branch; the copy awaiting Nick's approval in the PR (#218's "Publish day" and "First N days", #225's "Data from Stillstats as of <day>. View this video in Stillstats." and its dayless cut); #225's and #226's Chrome hand checks with screenshots (NFI A, F); NFI B before the AMO submission.

## Verdict
**Ready to open the PR, with follow-ups; Finding 1 is worth fixing first.** No CRITICAL or HIGH defect, and all four CI checks pass. Finding 1 is a MEDIUM capped for unproven attainability (a moved analytics page whose Views number Studio has not drawn keeps the page before's figure and link), with a red repro and a four-line fix checked green; if the #99 walk-through ever shows it, it becomes a HIGH and gates the PR. Findings 2 to 4 are LOW (a dead branch, a stale repro, comment lines) and fit the same remediation round or a follow-up ticket. Of review 5's four findings, two are closed and two were never worked; this review carries both forward.

## Remediation — 2026-10-15
All four confirmed findings worked, the LOW tail included (the epic loop's rule: a round with a MEDIUM fixes every confirmed finding). Full checks after the last commit: `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` (106 files, 2,201 tests) green; the whole repro suite (`pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts`) green, 15 of 15.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM, capped) | `e4ff338` creator-analytics#4 pre-PR review 6 finding 1: a move on the analytics page while Studio has not drawn the Views number left the page before's figure and link up | red→green: `repro/review-6.test.ts` (2 of 2) and the same two cases added to `apps/extension/src/surfaces/analytics.test.ts` (red before the fix, green after); `CI=1 pnpm exec vitest run apps/extension` green (20 files, 422 tests) | 0 | proved by execution |
| 2 (LOW) | `3a82f63` creator-analytics#4 pre-PR review 6 finding 2: renderSurface's link branch was dead since #225 | no red possible (dead code); `pnpm --filter ./apps/extension typecheck` and `CI=1 pnpm exec vitest run apps/extension` green after; `renderSurface` has no `link` parameter | 0 (2 existing comment lines reworded as the brief directs: `renderSurface`'s doc and `card.test.ts:242`) | proved by execution |
| 3 (LOW) | `690a77c` creator-analytics#4 pre-PR review 6 finding 3: review 3's repro for its finding 2 was still red, its fixture predating #218 | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts` | 0 | proved by execution |
| 4 (LOW, comment hygiene) | `4ae9470` creator-analytics#4 pre-PR review 6 finding 4: six comments said less than, or other than, what their code does | each entry checked by reading its code: `askForVideos` runs `readChannels` then the video read, each through `readSignedIn`'s `AbortSignal.timeout`; `studioSources` globs `{selectors,surfaces}/**/*.ts`; `idSetOf` caps on entries before collapsing, `pageSize` uses `ids.size`, `publishDayTopOf(listed)` takes the id-filtered list; `completeConsent` maps `TokenEndpointUnansweredError` at `token-vault.ts:689`; the callback reads only `consent.refusal` | 6 entries (corrections, not additions) | excluded from verify (prose) |

No fix qualified for agent verification: none is CRITICAL or HIGH, none touched a shared computation core, and every proof was executed in the repo's runner.

### Known regressions, deferred
- None.

### Rework briefs
- None: no rework pass was needed.

### Approach decisions (this remediation)
- **Analytics not-found (Finding 1):** applied as recorded above: `place` calls `removeSurface(document, 'analytics')` before it answers `not-found`, mirroring `stop()`. The Content list's not-found return is untouched (NFI E).
- **Default row render (Finding 2):** `renderSurface` draws the card's row only and takes no link; a surface that needs a link on its figure draws through its own `render`, as the analytics page does with `renderVideoAnalytics`. `VideoShown.link` and `linkOf` stay.
- **Preserved repros (Finding 3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs (here `engagedViewsByDay`), never by changing its assertions.
