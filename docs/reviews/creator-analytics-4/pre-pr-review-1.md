# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `a8e4958` ("creator-analytics#206 Studio extension: the three proven LOW findings from the fifth epic-loop run"), clean tree, no uncommitted or untracked files at review time. 115 files, +17,053 / −134 (7,965 of those lines are the saved Studio HTML fixtures and 1,095 are `pnpm-lock.yaml`), 233 commits across #4's sub-issues.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-14) and its sub-issues, `CODING_STANDARDS.md`, `CONTEXT.md`, ADR 0008, `README.md`'s event list, Mozilla's built-in data consent page (fetched 2026-10-14). Every child ticket was reviewed on its own lane; this review looks for whole-branch and cross-ticket defects. No prior review doc for #4; run with `--fresh`.
**Date:** 2026-10-14
**Reviewer:** 3 code-review agents, 1 test-audit agent, 1 repro agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (432 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` (writes both extension builds) | green |
| Full suite | `pnpm test` (Testcontainers Postgres), run twice (here and in the audit's HEAD worktree) | green both times: 104 files, 2,046 tests |
| Manifest permissions | Read `apps/extension/src/manifest.ts`, `wxt.config.ts` and the built `.output/{chrome,firefox}-mv3/manifest.json` | hold: host access to Studio and stillstats.com only, no `permissions`, the local origin in development builds only, Firefox's gecko id, 140 and data declaration as written |
| Em-dashes in shipped copy | `git diff 5d4457d -- apps/site apps/web apps/extension/src packages README.md CONTEXT.md docs \| grep '^+.*—'` | none (the only em-dashes are in Studio's saved HTML fixtures, which do not ship) |
| "Ranking by views" in the extension | `grep -rni 'ranking by views' apps/extension/src` | only in `card.test.ts`'s negative assertions |
| `ids` filter: parsing, cap, visibility, scheduled, paging | Read, plus an agent probe of empty, `a,,b`, trailing comma, over 50 and repeated `ids` | hold (one nit on the cap counting duplicates) |
| Event relay: validation, privacy, 401, limit, OpenPanel failure | Read, plus an agent probe of the real `event-relay.ts` and `event-limit.ts` (unreachable OpenPanel, minute boundary) | hold; test gaps are Finding 7 |
| Extension origins against the API | Read `apps/api/src/app.ts`; the branch's tests for `chrome-extension://` and `moz-extension://` | hold: no Origin check on signed-in routes. Whether a browser sends the cookie from an extension is #101's hand check |
| Background is the only API caller | `apps/extension/test/api-boundary.test.ts` plus read | holds |
| Analytics link window (Finding 1) | Executed: repro below | 1 of 1 red |
| Watch stop and stale reads (Findings 2, 3, 4) | Executed: repro below, real `watchStudio` and surfaces on the saved Content list fixture | 3 of 3 red |
| Product API session cache and malformed answer (Findings 5, 6) | Executed: repro below, real `createProductApi` | 2 of 2 red |
| Tautology audit | Branch's non-extension tests copied into a scratch worktree at `5d4457d` and run there; mutation tests at HEAD in a second scratch worktree | 261 run at base: 18 red, 243 green. Of the 69 added or changed non-extension tests, 13 are green at base and none is vacuous. One real gap (Finding 7), two notes under Test quality |
| Firefox `data_collection_permissions` against Mozilla's definitions | Fetched extensionworkshop.com's built-in data consent page (rung 4, vendor docs domain; no skill, docs MCP or context7 covers it) | NFI A |
| Live browsers (Chrome and Firefox, extension update under an open Studio tab, Firefox popup and permission prompt) | Not run: no browser in a review | NFI and #99 / #101 |
| OpenPanel honouring `x-client-ip` | Not run: no OpenPanel server here | NFI D |

**Repro command for every confirmed proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` from the repo root. The repro files sit outside the root `vitest.config.ts` include pattern, so `pnpm test` stays green while they are red.

**Overall:** The branch is in good shape. All four CI checks pass, the API halves (the `ids` filter and the event relay) hold, and the extension keeps to its two hosts, its no-numbers-from-Studio rule and its event privacy. Two MEDIUM extension defects should be fixed before the PR opens, and both are small: the analytics page's "Open in Stillstats" link opens a lifetime figure's video on the last 28 days, and figures the content script placed stay in Studio after the extension is updated or disabled, where a reused Content list row can then show another video's number. The rest are LOW.

## Approach decisions

- **Analytics link window (F1):** the extension always writes `window` into the detail link, lifetime included. It does not rely on the web app's default, which is `defaultVideoWindow` (`last28`) and may change again. Precedent: the analytics surface already writes every other window explicitly.
- **Watch stop (F2, F3):** `stop()` removes every host the surfaces placed, through the existing `removeSurface` in `render.ts`, and the Content list's `place` checks `current()` after its read the way `video-row.ts` does. Precedent: `video-row.ts:86` and `:93`; `removeSurface`'s own doc already covers "one left beside a row Studio redrew".
- **Give-up URL (F4):** the give-up judges the URL its navigation was for, captured in `navigated()`, not the URL at the moment the timer fires. Treating a URL change seen by a pass as a navigation was considered and not chosen: it double-counts once WXT's own `wxt:locationchange` arrives and resends `extension_surface_shown`.
- **Session cache (F5):** a 401 from any read forgets the kept channels and the kept video reads. Precedent: `readChannels` already keeps nothing for a signed-out read.
- **Background answers (F6):** the background answers every message, mapping a rejected answer to that request type's failed value, and the channels answer is shape-checked as `isVideoListAnswer` checks the video list. Precedent: `isVideoListAnswer` in `product-api.ts`.

## Confirmed Issues

### 1. "Open in Stillstats" from a lifetime period opens the video on the last 28 days — MEDIUM
- **Location:** `apps/extension/src/surfaces/analytics.ts:51`, comment at `:36-37`; the test pinning it at `apps/extension/src/surfaces/analytics.test.ts:312-318`
- **Attribution:** Introduced on this branch (the extension does not exist at `$BASE`). The link was right when `f646c19` "creator-analytics#96 Video analytics page: engaged views for Studio's period" wrote it: the web app's default window was then `lifetime` (`git show f646c19:apps/web/src/route.ts` line 41). `7b118b9` "creator-analytics#119 Browser walk fixes for the web dashboard" on `main` changed the default to `defaultVideoWindow = 'last28'`, and `75fa60f` "creator-analytics#4: take main into the epic branch" brought that in without updating the link.
- **Real-world trigger:** a creator on a video's analytics page with Studio's "Lifetime" period, or any period the extension does not map (including `period-default`, which Studio's own nav drawer links to), clicks "Open in Stillstats".

**Evidence**
```ts
 * The video's detail screen in the web app, for the Stillstats channel the read matched, in the
 * page's window. Lifetime is the web app's default window, which its links leave out.
...
  const query = new URLSearchParams({ channel: channelId })
  if (window !== 'lifetime') query.set('window', window)
```
`packages/api-types/src/videos.ts:88`: `export const defaultVideoWindow = 'last28'`; `apps/web/src/route.ts:122` falls back to it when the address has no `window`. The window is not a saved preference (`routeKeysOfPreferences`, `route.ts:305-310`).

**Failure mode** — the extension shows the video's lifetime engaged views, and its link opens the detail screen on the last 28 days, so the creator lands on a different number for a different period. Proof (executed): `repro/analytics-link.test.ts` reads the href `analytics.test.ts:315` pins through the web app's `routeOf` and gets `last28`, not `lifetime`.

**Recommended fix**
```diff
 /**
  * The video's detail screen in the web app, for the Stillstats channel the read matched, in the
- * page's window. Lifetime is the web app's default window, which its links leave out.
+ * page's window.
  */
 ...
-  const query = new URLSearchParams({ channel: channelId })
-  if (window !== 'lifetime') query.set('window', window)
+  const query = new URLSearchParams({ channel: channelId, window })
```
and in `analytics.test.ts:312-318`, rename the test to "writes lifetime into the link, since the web app's default window is the last 28 days" and expect `` `${origin}/app/videos/NDha0z6zDA8?channel=channel-1&window=lifetime` ``.

**Remediation brief**
- **Design intent:** the analytics surface shows engaged views over Studio's period (or lifetime as the fallback), and its link opens the same video in the web app in the same window, so the creator sees the same number on both sides. The web app reads `window` from the address and falls back to `defaultVideoWindow` (`last28`).
- **Full surface:** `apps/extension/src/surfaces/analytics.ts:36-37` (comment) and `:50-51`; `apps/extension/src/surfaces/analytics.test.ts:312-318`. No other extension link carries a window: the card's and Content list's links go to `/app` (`surfaces/states.ts:47`).
- **Must preserve:** `analytics.test.ts` "opens the video in the channel and window of the page in a new tab" (`?channel=channel-1&window=last90`, `_blank`, `noopener`); the click and middle-click `extension_web_app_opened` tests below it; the period table and `fallbackPeriod` in `analytics.ts:19-33`.
- **Do not touch:** the `period-default` → "Lifetime" mapping (Dismissed: it is the spec's rule for an unmapped period).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 1"` is red now and green after; `pnpm exec vitest run apps/extension/src/surfaces/analytics.test.ts` green.

### 2. After the extension is updated or disabled under an open Studio tab, its figures stay, and a reused Content list row shows another video's number — MEDIUM
- **Location:** `apps/extension/src/surfaces/watch.ts:208-213`
- **Attribution:** Introduced: `stop()` came with `dd2473a` "creator-analytics#93 Latest video card: engaged views beside Studio's views" and has never removed a host.
- **Real-world trigger:** the store updates the extension (or the creator disables or reloads it) while a Studio tab is open. WXT's `ctx.onInvalidated` calls `stop()` (`entrypoints/studio.content.ts:21`); Chrome does not re-inject the new content script into an open tab. The creator then pages or sorts the Content list, and Studio repoints a row at another video by changing only its links' hrefs (the watch's own comment at `watch.ts:200-202`). Capped at MEDIUM: upgrade to HIGH if #99's walk-through shows it in real Studio (with a Content list open, reload the extension from `chrome://extensions`, navigate once in Studio, then page the list).

**Evidence**
```ts
    stop() {
      navigation += 1
      observer.disconnect()
      clearTimeout(passTimer)
      clearTimeout(giveUpTimer)
    },
```
**Failure mode** — every host stays in Studio with nothing left to update it. Proof (executed, `repro/surfaces.test.ts` "finding 2"): after `stop()`, 31 hosts remain (30 row figures and the page line); with row 0's links pointed at `zzzzzzzzzzz`, row 0 still shows "10,000 engaged views", its previous video's figure.

**Recommended fix**
```diff
 import type { VideosQuery, VideosRead } from '../product-api.ts'
 import { type LineClicks, sendOnce } from './line-clicks.ts'
+import { removeSurface } from './render.ts'
 ...
     stop() {
       navigation += 1
       observer.disconnect()
       clearTimeout(passTimer)
       clearTimeout(giveUpTimer)
+      for (const surface of surfaces) removeSurface(document, surface.name)
     },
```
**Remediation brief**
- **Design intent:** the extension adds figures beside Studio's and never leaves one beside the wrong video. While the watch runs, each surface's `place` removes or replaces what it placed; once the watch stops, nothing runs again in that tab, so `stop()` is the last chance to take its figures down. `render.ts` imports nothing from `watch.ts` at runtime, so the import adds no cycle.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:1-5` (import) and `:208-213`; Finding 3 is the other half (a read already in flight when `stop()` runs must not draw afterwards). Add a test to `apps/extension/src/surfaces/watch.test.ts` or `content-list.test.ts` that states the rule from what the creator sees.
- **Must preserve:** every surface test's `afterEach(() => stop())` (`content-list.test.ts:212-215`, `studio-surfaces.test.ts:55`, `watch.test.ts:41`), which then also clears the fixture's hosts; `stop()` still bumps `navigation`, disconnects the observer and clears both timers.
- **Do not touch:** `removeSurface`'s selector in `render.ts:83-85`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 2"` red now, green after.

### 3. A Content list read that lands after a navigation or after the watch stops still draws — LOW
- **Location:** `apps/extension/src/surfaces/content-list.ts:150` and `:192-196`
- **Attribution:** Introduced: `place` has not taken `current` since `1284aad` "creator-analytics#95 review pass 2 finding 1 ..." shaped it; `video-row.ts:86` and `:93` check it.
- **Real-world trigger:** the read is in flight when the extension is updated (`stop()`), or when the creator navigates away. No other channel's numbers can appear (rows are matched by id, and the API answers only that channel's ids), so the visible effect is a stale page line or figures drawn after a stop, and an `answered` record for the wrong navigation.

**Evidence**
```ts
    async place({ document, url, navigation, settled }) {
...
      // Studio may redraw the list while the background answers; the next pass places it then.
      if (!header.isConnected) return 'not-found'
```
**Failure mode** — proof (executed, `repro/surfaces.test.ts` "finding 3"): with the read held, `stop()`, then the read released: 31 hosts are drawn after the stop.

**Recommended fix**
```diff
-    async place({ document, url, navigation, settled }) {
+    async place({ document, url, navigation, settled, current }) {
 ...
-      if (!header.isConnected) return 'not-found'
+      if (!header.isConnected || !current()) return 'not-found'
```
**Remediation brief**
- **Design intent:** a surface's `place` may await the background; `current()` is false once a newer navigation (or `stop()`) has begun, and nothing read for an outgoing navigation is drawn. `video-row.ts` is the precedent.
- **Full surface:** `apps/extension/src/surfaces/content-list.ts:150`, `:193`. The keep branch (`:166-178`) draws without awaiting, so it needs no check.
- **Must preserve:** `content-list.test.ts`'s navigation tests (the settle-time re-read of rows still as answered, the outgoing figures kept until the navigation settles, a redrawn row never showing another video's figure); `answered` is left as it was when the read is dropped.
- **Do not touch:** `rowsStandAsAnswered` and the keep branch.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 3"` red now, green after. It is green with this fix alone: the read is held from the start, so no host exists before the stop and a dropped read leaves the count at 0.

### 4. A give-up judges the page the creator has just moved to, so it reports a false missing surface and drops a real one — LOW
- **Location:** `apps/extension/src/surfaces/watch.ts:175-186`
- **Attribution:** Introduced with `dd2473a` (the give-up timer).
- **Real-world trigger:** a browser without the Navigation API, where WXT polls `location.href` once a second (`wxt/dist/utils/internal/location-watcher.mjs`), so `wxt:locationchange` arrives up to a second after the URL changes. The creator navigates in the last second before the previous navigation's 5-second give-up. Whether Firefox 140+ has the Navigation API is unverified; Chrome has it, so Chrome does not hit this. Telemetry only: `extension_surface_missing` is how Studio changes reach Nick, so a false one costs a needless investigation and a lost one hides a real break.

**Evidence**
```ts
    if (navigationAtStart !== navigation) return
    const here = url()
    for (const surface of surfaces) {
      if (surface.isOn(here) && !found.has(surface.name)) {
        report({ name: 'extension_surface_missing', surface: surface.name })
```
**Failure mode** — proof (executed, `repro/surfaces.test.ts` "finding 4"): on the dashboard with no card drawn, the URL moves to the Content list 1 ms before the give-up; 200 ms later `extension_surface_missing` was sent once, for `content_list` (not missing, only not drawn yet), and never for `card` (which really was missing).

**Recommended fix**
```diff
   let navigation = 0
+  let navigatedUrl = url()
 ...
-    const here = url()
     for (const surface of surfaces) {
-      if (surface.isOn(here) && !found.has(surface.name)) {
+      if (surface.isOn(navigatedUrl) && !found.has(surface.name)) {
 ...
   function navigated(): void {
     navigation += 1
+    navigatedUrl = url()
     settled = false
```
**Remediation brief**
- **Design intent:** a navigation's give-up decides, once Studio has had `giveUpAfterMs` to draw, which of that navigation's surfaces never appeared. It must judge the page that navigation was for. `found` collects only surfaces a pass placed, and a pass on the new URL never places the old page's surfaces.
- **Full surface:** `apps/extension/src/surfaces/watch.ts:115` (state), `:180-182` (give-up), `:188-190` (`navigated`). `placeAll` keeps reading `url()` per pass.
- **Must preserve:** `studio-surfaces.test.ts` and the surface tests' missing and shown events (each at most once per surface per navigation); `navigated()` still runs once at start (`watch.ts:204`).
- **Do not touch:** `settled` handling; the leaking of `settled = true` into the new URL's first passes is real but harmless (it only lets the settle-time pass run sooner) and is not part of this fix.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 4"` red now, green after. With the fix, the card is reported missing and `content_list` is not.

### 5. A 401 on a video read does not forget the kept channels, so the popup says "Signed in" while the surfaces say "Sign in" — LOW
- **Location:** `apps/extension/src/product-api.ts:95`, `:109`, `:145`
- **Attribution:** Introduced: `keptChannels` from `4ade958` "creator-analytics#93 review pass 1 finding 6 ...".
- **Real-world trigger:** the creator signs out of stillstats.com, or the session expires, within 30 seconds (`signedInReadKeptMs`) of a signed-in read. A surface's next video read answers 401 and shows the sign-in line; the popup keeps showing "Signed in to Stillstats" and the channel list, and other kept video reads keep serving numbers, until the 30 seconds pass. The 30-second keep is a deliberate design; the defect is that a 401 the background has already seen does not end it.

**Evidence**
```ts
      if (response.status === 401) return { state: 'signed-out' }
...
    keptChannels = read.state === 'signed-in' ? { read, at: now() } : null
```
**Failure mode** — proof (executed, `repro/product-api.test.ts` "finding 5"): channels answer, video read answers 401 → `signed-out`; the next `readChannels()` answers `signed-in` with the channel list and makes no request.

**Recommended fix**
```diff
       const response = await fetch(`${origin}${path}`, { credentials: 'include' })
-      if (response.status === 401) return { state: 'signed-out' }
+      if (response.status === 401) {
+        keptChannels = null
+        keptVideos.clear()
+        return { state: 'signed-out' }
+      }
```
**Remediation brief**
- **Design intent:** the background keeps a signed-in read for 30 seconds so Studio's in-page navigations do not repeat requests (`kept.ts`); a signed-out or failed read is never kept. A 401 is the API saying the session is gone, so nothing read with that session should be served after it.
- **Full surface:** `apps/extension/src/product-api.ts:94-95` only (`readSignedIn` serves both reads). `keptVideos` is declared at `:83`, before `readSignedIn`, so it is in scope. Add the test beside `product-api.test.ts:254-262` ("a 401 on %s reads as signed out"), asserting the next `readChannels()` makes a request and answers signed out.
- **Must preserve:** `product-api.test.ts`'s keep tests (a signed-in read kept 30 s, signed-out and failed reads not kept, refusals not kept); `readChannels` on its own 401 still keeps nothing.
- **Do not touch:** `signedInReadKeptMs` (30 s) and `isFresh`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 5"` red now, green after.

### 6. A rejected answer in the background leaves the asker with no answer, and a channels answer with no list makes every read reject for 30 seconds — LOW
- **Location:** `apps/extension/src/entrypoints/background.ts:79-83`; `apps/extension/src/product-api.ts:104-107`, `:117`
- **Attribution:** Introduced: the listener from `10eab79` "creator-analytics#92 Spike: extension skeleton, sign-in and popup in Chrome and Firefox".
- **Real-world trigger:** none known. The product API always answers `/api/channels` with `{ channels }`; a proxy or a future API change answering 200 with another JSON body would trigger it, and `browser.permissions.getAll()` rejecting inside `settle` is the other path. Capped at LOW: upgrade if any deployment puts a 200-answering page in front of the API (check: `curl -s https://stillstats.com/api/channels` signed out must answer 401).

**Evidence**
```ts
  browser.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    answer(request).then(sendResponse)
    return true
  })
```
```ts
      const { channels } = (await response.json()) as ChannelsAnswer
      return { state: 'signed-in', channels }
```
**Failure mode** — a 200 body without `channels` is kept for 30 s as signed in with `channels` undefined; `askForVideos` then throws at `channels.channels.find`, the listener's promise rejects unhandled, `sendResponse` is never called, and the content script's ask waits until the port closes. The watch runs one pass at a time, so every surface on the tab waits with it (see NFI B). The popup's `popupViewOf` reads `read.channels.length` and renders blank. Proof (executed, `repro/product-api.test.ts` "finding 6"): `readVideos` rejects with "Cannot read properties of undefined (reading 'find')".

**Recommended fix**
```diff
-      const { channels } = (await response.json()) as ChannelsAnswer
-      return { state: 'signed-in', channels }
+      const body: unknown = await response.json().catch(() => null)
+      return isChannelsAnswer(body) ? { state: 'signed-in', channels: body.channels } : { state: 'failed' }
```
with `isChannelsAnswer` beside `isVideoListAnswer` (`Array.isArray(Reflect.get(body, 'channels'))`), and in `background.ts`:
```diff
-    answer(request).then(sendResponse)
+    answer(request).then(sendResponse, () => sendResponse(failedAnswerOf(request)))
```
where `failedAnswerOf` (in `background-answer.ts`, tested there) answers `{ state: 'failed' }` for `read-channels` and `read-videos` and `false` for `usage-event`.

**Remediation brief**
- **Design intent:** the background is the only API caller and answers every message; a content script or popup turns a failed answer into a "Try again later" line or the popup's failed view. A thrown error must never leave an ask unanswered, because the watch serializes passes behind it.
- **Full surface:** `apps/extension/src/product-api.ts:59-61` (add `isChannelsAnswer`), `:104-107`; `apps/extension/src/entrypoints/background.ts:79-83`; `apps/extension/src/background-answer.ts` and `background-answer.test.ts` (which today covers only the `usage-event` branch). Note `readChannels`'s current `response.json()` throw is caught by `readSignedIn` as `failed` today, so a non-JSON 200 is already safe; only a JSON body without the list is not.
- **Must preserve:** `product-api.test.ts` "a signed-in read answers the creator's channels" and the keep tests; `return true` in the listener, which holds the channel open in both browsers.
- **Do not touch:** `readVideosAndSendHeldClicks`'s `.catch` in `watch.ts:76-78`, which already maps a rejected ask to `failed`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts -t "finding 6"` red now, green after.

### 7. The event relay's fallback paths and its documented limit of 60 have no test — LOW
- **Location:** `apps/api/src/events.test.ts` (missing cases); the code is `apps/api/src/routes/events.ts:48-53` and `apps/api/src/event-relay.ts:60-62`
- **Attribution:** Introduced with the relay (`77e8a4b`, #89) and the limit (`3df8f0f`, #103).
- **Real-world trigger:** a later change breaking any of these paths ships green. The code itself works: an agent probe sent to an unreachable OpenPanel (`http://127.0.0.1:9`) and got the report in 31 ms.

**Evidence** — four gaps, each checked by `grep` and mutation:
- No test posts a body that is not JSON; `await c.req.json().catch(() => undefined)` (`routes/events.ts:53`) is untested. Precedent: `apps/api/src/preferences.test.ts:89`'s "malformed JSON" row.
- No test covers OpenPanel unreachable or timing out (`event-relay.ts:60-62`); `git grep "could not reach OpenPanel"` finds no test.
- No test shows an invalid event counts toward the limit, the rule the comment at `routes/events.ts:48` and README ("whatever the body") state.
- The limit tests take `eventLimitPerWindow` from production (`events.test.ts:12`, `:194-235`), so the README's "60 events in one clock minute" is pinned nowhere: the audit changed the constant to 5 and all 36 tests stayed green.

**Recommended fix** — in `events.test.ts`: add a row `['a body that is not JSON', '{"name":']` to the invalid-event table (posted raw); add "an event OpenPanel never answers still answers 204, and the failure is reported" with a fake OpenPanel that destroys the socket; add "invalid events count toward the limit" (post `eventLimitPerWindow` invalid bodies, then a valid event answers 429); and add `expect(eventLimitPerWindow).toBe(60)` to the first limit test, or post a literal 60 then a 61st.

**Remediation brief**
- **Design intent:** the relay answers 204 whatever OpenPanel does, reports a failure to GlitchTip, refuses anything not on the fixed list with 400, and counts every signed-in request toward 60 a minute before reading the body.
- **Full surface:** `apps/api/src/events.test.ts`; `apps/api/test/fake-openpanel.ts` for a socket-destroying mode; `postEvent` may need a raw-body variant.
- **Must preserve:** every existing `events.test.ts` case.
- **Do not touch:** the clock-minute window (Dismissed: by spec).
- **Proof:** each new test red against a mutation of its path (remove the `.catch`, remove the `try`, move `admit` after the parse, change 60), green as written.

### 8. Comment hygiene — LOW (aggregated)
- `packages/api-types/src/videos.ts:153` — `` `true` lists scheduled videos too, which the list leaves out by default. `` → `` `true` lists scheduled videos too, which the list leaves out by default. With `ids` it is still checked, and has no effect. `` (matches the `visibility` doc beside it)
- `apps/api/src/video-list.ts:342-343` — the `listVideos` doc breaks a line mid-sentence ("is refused" / "with `consent_missing`") → reflow the paragraph
- `apps/extension/src/product-api.ts:26` — "A query's parameters on the wire, and the key its read is kept under." → "A query's parameters on the wire. With the Studio channel id, they are the key its read is kept under."
- `apps/api/src/routes/videos.ts:43-46` — "...or has more than `maxVideoIds`. Duplicates collapse." → "...or has more than `maxVideoIds` entries, duplicates counted. Duplicates then collapse."
- `apps/extension/test/api-boundary.test.ts:1-3` — the limits comment names dependencies and bundles only → add that the scan sees a direct `fetch(` call and a static `import` only, not an aliased fetch or an `export … from` re-export

## Needs Further Investigation

### A. Firefox's data declaration may need `websiteContent` or `browsingActivity` — confirm with AMO before #100
`manifest.ts:52-57` declares `authenticationInfo` (required) and `technicalAndInteraction` (optional). The extension sends the channel id from Studio's URL and video ids from Studio's links to stillstats.com. Mozilla's page (extensionworkshop.com, fetched 2026-10-14) defines transmission as "any data collected, used, transferred, shared, or handled outside the add-on", lists no exemption for the developer's own service, and defines `websiteContent` as "anything visible on a website", links included, and `browsingActivity` as specific URLs. Nick did not choose run 1's proposal 9 ("Declare websiteContent ...") on 2026-10-10, and #100's body already checks that the declaration matches the listing. The same page gives Firefox for Android 142 as the minimum for the declaration; the manifest has no `gecko_android` block. What would settle it: AMO's answer at submission, or a reviewer ruling on whether ids read from the page count.

### B. A read the background never answers freezes every surface on the tab
Passes run one at a time and the give-up awaits the pass (`watch.ts:151-165`, `:178`), and no fetch in `product-api.ts` has a timeout. If a fetch hangs, or Finding 6's path leaves an ask unanswered, nothing places and nothing reports missing until the ask settles. What would confirm it: whether Chrome and Firefox keep `runtime.sendMessage` pending while the background's fetch hangs (a #99 check with the API stalled). The cheap guard either way is `AbortSignal.timeout` on the background's fetches, the pattern `event-relay.ts:52` already uses.

### C. A surface whose page goes off is never taken down
Surfaces are removed only by their own `place`, which runs only while `isOn` (`watch.ts:131`). If Studio keeps the Content list's rows for the Collabs tab (excluded at `studio-url.ts:3-8`) and repoints them at another channel's videos, the creator's own figures would stay beside them. What would confirm it: a saved Collabs tab fixture (#129 covers Shorts and Live only) or #99's walk-through.

### D. Whether the self-hosted OpenPanel reads `x-client-ip`
`event-relay.ts:44-45` forwards the IP as `x-client-ip`. The installed `@openpanel/sdk` sets no IP header, so it could not be confirmed here. Check OpenPanel's Track API docs; if the header is wrong, extension events get the API server's IP and geo.

## Reviewed and Dismissed
- Identical reads in flight at once are not deduplicated (`product-api.ts:102-146`) — the watch runs one pass at a time per tab and the Content list asks once per page, so R8 holds; a popup read alongside a surface read is two different requests.
- An unknown refusal code passes through as a `Refusal` (`product-api.ts:63-67`) — `surfaces/states.ts:59-61` shows it as "Try again later", the right fallback.
- 120 events can pass in 2 ms across a minute boundary (`event-limit.ts`) — the spec says "per clock minute"; memory is bounded by the per-window clear.
- Two of the three OpenPanel variables set turns the relay off silently (`server.ts:49-59`) — README and `docs/deploy.md` both document "all three or none".
- `cf-connecting-ip` is trusted without proof the request came through Cloudflare (`routes/events.ts:38-42`) — analytics only, and the API sits behind Cloudflare.
- An OpenPanel outage reports every failed send to GlitchTip (`event-relay.ts:53-62`) — bounded by the relay's limit of 60 per user per minute.
- The database harness runs sibling scopes opened with `Promise.all` inside one scope at once (`packages/database/test/harness.ts:69-84`) — no caller does it.
- The `ids` cap counts duplicates before they collapse (`routes/videos.ts:47-51`) — within R12 as written; the doc wording is in Finding 8.
- `period-default` and other unmapped periods show "Lifetime" (`analytics.ts:19-33`) — the spec's rule for a period the API does not serve.
- A shown card or analytics row is not re-read while its element stands (`watch.ts:61-63`) — deliberate, per `isKept`'s doc.
- The Chrome worker wakes on every completed tab load (`background.ts:69-72`) — the listener must be registered at top level to survive the worker's restarts.
- The privacy page's extension section does not mention the relayed IP and user agent (`apps/site/privacy.html:74-100`) — copy approved word for word in #98; #202 (ready-for-human) covers what the extension sends.
- The extension's null `lastProcessedDay` handling is dead code — known, recorded in the handoff.
- `watch.ts:66-69` says an unanswered request "is a failed read" — a restarted or updated background rejects the ask, which the `.catch` maps to failed, so the comment holds for the cases it names.

## Minor / nits
- `isKept` measures with `Date.now()` (`watch.ts:62`); a clock stepped back keeps a line longer. `performance.now()` would not.
- An empty filter or a channel with no uploads leaves the Content list with no rows, which `content-list.ts:157` returns as `not-found`, so it reports `extension_surface_missing` and leaves the previous page line up. Reasoned, not executed.
- A held sign-in click and a sign-in line refresh only on a Studio mutation or navigation after 30 s (`watch.ts:199`); no `visibilitychange` listener.
- `background.ts:43-51`, `:63-77` and `first-run/main.ts:11-14` fire promises with no catch; a failed `tabs.create` also drops `extension_installed`.
- The manifest test checks the development build's host access in Chrome only (`test/manifest.test.ts:92-97`).
- `studio-boundary.test.ts:35-36`'s page-read scan does not list `.title`, `.id`, `aria*`, `.checked` or `.selected`.
- Test helpers are copied across files: `popupStorage()` (`popup.test.ts:174`, `popup-page.test.ts:23`), `recordingAsk()` (`popup.test.ts:184`, `popup-link.test.ts:12`), the "throws before it returns a promise" fixture (six files), `auxClick` (`dom.test.ts`, `popup-link.test.ts`).

## Test quality
Tests added or changed: 69 outside `apps/extension` plus 289 new in `apps/extension` · green against `$BASE`: 13 of the 69, none vacuous (each either pins a prior review finding, tests code that lives in the test harness, or is a deliberate regression guard; mutations turned each red) · tautology shapes found: 1 real (Finding 7's limit constant) and 2 notes:
- `apps/api/src/video-list.test.ts` "twenty list requests in flight at once each answer the creator their own list" is a smoke test, as its comment says: with the harness queue disabled it went red in 5 of 11 runs, so `0fa5357`'s commit body ("Without the harness change it fails every run") overstates it. The deterministic guards are the four `packages/database/test/scopes.test.ts` tests, each red under its targeted mutation. Keep both; correct the claim in the PR text.
- `apps/web/src/consent.test.ts:46-50` builds its expectation from the same `retentionAndSharingLines` the code spreads, so it pins the wiring, not the wording; `apps/extension/src/first-run.test.ts:129-131` pins the wording. Optional: add one literal line on the web app's side.
- The extension's not-throwing and unhandled-rejection tests (`line-clicks.test.ts`, `popup-link.test.ts`, `host-access-request.test.ts`) are live: removing each `.catch` turned them red.
- `host-access.test.ts:41` compares one mock's calls with another's and `:52-61` asserts an unreachable empty-hosts manifest; both are covered by neighbouring tests and could go.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `a8e4958`.
- **Commit hygiene:** commit this doc and `repro/` (four files: `repro.vitest.config.ts`, `analytics-link.test.ts`, `product-api.test.ts`, `surfaces.test.ts`); they sit outside the suite's include pattern. Nothing else to drop.
- **Likely reviewer asks:** the ready-for-human tickets (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126) still open under #4; the OpenPanel variables unset in Dokploy (the relay sends nothing until they are set); NFI A before the AMO submission.

## Verdict
**Ready with follow-ups, after two fixes.** Fix Findings 1 and 2 before the PR opens: one is a wrong-window link from the analytics page, the other leaves stale figures in Studio after an update, and each is a few lines with a red repro waiting. Finding 3 rides with Finding 2 (same mechanism, one line). Findings 4 to 7 and the comment hygiene can ship in the same remediation round or as follow-up tickets. No prior review findings were claimed by this branch.

## Remediation, 2026-10-14
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `706a944` creator-analytics#4 pre-PR review 1 finding 1: write lifetime into the analytics page's Open in Stillstats link, since the web app's default window is the last 28 days | red→green: `pnpm exec vitest run apps/extension/src/surfaces/analytics.test.ts` (the renamed lifetime link test); repro `-t "finding 1"` green once its href was pointed at the one the test now pins | 0 (one existing doc sentence deleted) | proved by execution |
| 2 (MEDIUM) | `6a8ff25` creator-analytics#4 pre-PR review 1 finding 2: take down every figure the watch placed when it stops, so none stays beside a row Studio repoints after an update | red→green: `content-list.test.ts` "no figure stays in Studio, so a row Studio then points at another video shows none"; repro `-t "finding 2"` green | 0 | half-fixed (a pass queued behind a read in flight ran after `stop()` and drew again), closed by the rework `89a8152`; scoped re-verify: fixed |
| 3 (LOW) | `05e08bc` creator-analytics#4 pre-PR review 1 finding 3: draw no Content list read that lands after a navigation or after the watch stops, as the card and analytics rows already do | red→green: `content-list.test.ts` "a read the background answers only after the stop draws nothing"; repro `-t "finding 3"` green | 0 | half-fixed (same queued pass as finding 2), closed by the rework `89a8152`; scoped re-verify: fixed |
| 4 (LOW) | `34625b5` creator-analytics#4 pre-PR review 1 finding 4: judge a give-up against the URL its navigation was for, so a move in its last second neither reports a false missing surface nor drops a real one | red→green: `watch.test.ts` "a give-up judges the page its navigation was for, ..."; repro `-t "finding 4"` green | 0 | fixed, with one LOW edge introduced (below, deferred) |
| 5 (LOW) | `6daee3d` creator-analytics#4 pre-PR review 1 finding 5: forget the kept channels and video reads on any 401, so the popup stops saying Signed in once a surface has seen the session end | red→green: the two `product-api.test.ts` "after a 401 on a video read, ..." tests; repro `-t "finding 5"` green | 0 | proved by execution |
| 6 (LOW) | `974be3b` creator-analytics#4 pre-PR review 1 finding 6: answer every background request with its failed value when the read rejects, and read a channels answer with no list as failed | red→green: `background-answer.test.ts` "a request whose answer rejects still gets its failed answer, ..." (3 rows) and the two `product-api.test.ts` "not a channel list" tests; repro `-t "finding 6"` green | 0 | fixed |
| 7 (LOW) | `95a7254` creator-analytics#4 pre-PR review 1 finding 7: test the event relay's fallback paths and its limit of 60 a clock minute | each new test red under its mutation (remove the `.catch` on `c.req.json()`, remove the relay's `catch`, move `admit` after the parse, set the limit to 5), green as written: `pnpm exec vitest run apps/api/src/events.test.ts` | 2 (the fake OpenPanel's existing doc extended to name `dropEveryRequest`) | proved by execution |
| 8 (LOW, comment hygiene) | `d776e1d` creator-analytics#4 pre-PR review 1 finding 8: correct five comments to say what their code does | each entry checked by reading its code (`routes/videos.ts:64` checks `includeScheduled`, `video-list.ts:458` ignores it with ids; `idSetOf` counts before the `Set`; the boundary scan's two regexes) | n/a | excluded from verify |
| 2, 3 rework | `89a8152` creator-analytics#4 pre-PR review 1 findings 2 and 3 rework: drop the pass Studio queued behind a read in flight when the watch stops, so it cannot draw after the stop | red→green: `content-list.test.ts` "a pass Studio queued behind a read in flight draws nothing once the stop has come" (the re-verifier also saw it red with the one line removed) | 0 | fixed |

Checks after the round: `pnpm lint`, `pnpm typecheck` and `pnpm build` green; `pnpm test` green, 104 files, 2,059 tests (2,046 before, plus 13 new); the repro suite `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` 6 of 6 green. FIXED 8, OPEN 0 confirmed findings.

### Known regressions, deferred
- A give-up whose URL moved in its last second can now report the Content list missing for the page the navigation was for, when that navigation's rows stood as the previous navigation's answer and only its settle-time pass would have counted it shown (`content-list.ts:166-177` returns `not-found` while `!settled`). Introduced by `34625b5`, verdict "Introduced (LOW, from reasoning, not run). When the URL moves in the last second, the settled pass at give-up runs `placeAll` on the new URL, so the old page's surfaces are never placed with `settled` true." Not fixed because it is outside the one-line exception and the fix is a design choice (skip judging settle-dependent surfaces when `url() !== navigatedUrl`, which would drop a real missing Content list in the same window). Telemetry only, and narrower than the defect finding 4 closed.

### Rework briefs
- Findings 2 and 3, queued pass after stop. Must achieve: once `stop()` runs, no pass, in flight or queued, draws anything, so `current()` being false for the in-flight pass is not undone by the `do … while (again)` loop running `placeAll()` again under the bumped `navigation`. Must preserve: `stop()` still bumps `navigation`, disconnects the observer, clears both timers and removes every host; passes stay serialized while the watch runs; the give-up awaiting a pass still returns without reporting. Proof: `content-list.test.ts` "a pass Studio queued behind a read in flight draws nothing once the stop has come", red before `89a8152`, green after; `pnpm exec vitest run apps/extension` green.

### Notes from the verify pass, not defects of this round
- `isChannelsAnswer` checks only that `channels` is an array, as `isVideoListAnswer` checks `videos`; a list holding non-objects is kept as signed in and each video read then answers failed through the new catch. Same strictness as the precedent.
- `stop()` sets no stopped flag. A `navigated()` after `stop()` would arm a new pass; no route does that today, since WXT removes the `wxt:locationchange` listener in the same invalidation that calls `stop()` (`entrypoints/studio.content.ts:20-21`).

### Approach decisions, added this round
- **Background answers (F6), where the mapping lives:** the rejection to failed-value mapping sits inside `backgroundAnswerer` (`try` with `return await`, the catch answering `false` for `usage-event` and `{ state: 'failed' }` for both reads), not in the listener's `.then` as the recommended diff had it, so the unit test exercises the real path. `background.ts` is unchanged, `return true` included.
- **Watch stop (F2, F3), queued passes:** `stop()` clears `again`, so the pass loop ends with the pass in flight. No `stopped` flag, since nothing calls `pass()` after `stop()`.
- **Finding 1 repro:** `repro/analytics-link.test.ts` reads the href `analytics.test.ts` now pins (`&window=lifetime`), so it checks the web app's reading of the real link rather than the pre-fix one.
- **Event relay tests (F7):** the fake OpenPanel's `dropEveryRequest` destroys each request's socket to stand for an unreachable host; `postEvent` sends a string body as written, anything else as JSON; the limit test posts a literal 60, so the README's figure is pinned, while the other limit tests keep `eventLimitPerWindow`.
