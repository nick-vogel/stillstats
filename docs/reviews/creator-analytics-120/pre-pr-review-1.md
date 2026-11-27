# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `94ba99b` "Merge pull request #546 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `4c4f424` ("creator-analytics#140 Public pages: the feed surface"), clean tree, no uncommitted or untracked files at review time. 83 files, +22,944 / −234 (15,572 of those lines are the nine saved youtube.com pages under `apps/extension/test/fixtures/youtube/`), 55 commits across #134 to #142, #486, #487 and #520 to #523.
**Reviewed against:** epic nick-vogel/creator-analytics#120 (body as of 2026-10-11) as amended by #520 (match tiles against the creator's own uploads in the browser, so no page id is sent), the bodies of #140, #486, #520, #521, #522, #523, #539 and #540, `CODING_STANDARDS.md`, `CONTEXT.md`, ADR 0008 and ADR 0016. Every child ticket was reviewed on its own lane; this review looks for whole-branch and cross-ticket defects. No prior review doc for #120; run with `--fresh`.
**Date:** 2026-11-08
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (593 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green, both extension builds |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 141 files, 3,589 tests, 1 expected fail (`packages/token-vault/src/token-vault.test.ts:619`, a `test.fails` on `main`, unrelated) |
| Browser walk | `pnpm run --if-present test:browser` | green, no content security policy violation in 47 steps |
| Stale pill on a re-pointed tile during the next read (Finding 1) | Executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-120/repro/stale-pill-during-next-read.vitest.config.ts` | 3 of 3 red (channel page 30 pills left, watch sidebar 20, Shorts tab 45). With the recommended fix applied in a scratch worktree: 3 of 3 green, `pnpm exec vitest run apps/extension` 33 files and 929 tests green, extension typecheck and biome green |
| Double injection on a wake by the grant (Finding 2) | Executed by an agent: a scratch vitest over `keepYouTubeAccessInStep` with fakes, grant already true, `onAdded` fired before the start repair settled, two open tabs | injected `[11, 12, 11, 12]`; confirmed by reading `apps/extension/src/youtube-access.ts:148-172` |
| Tautology audit | Branch tests copied into a scratch worktree at `94ba99b` and run there (with an alias-only `page-watcher.ts` shim for the `watch.ts` rename, and the branch's `surfaces/testing.ts` for imports) | 548 tests run: 78 red, 470 green, plus 10 whole files red at import (new modules). Of the green, 13 are new: every one a negative or "as before" guard paired with a red positive test. Findings 3 and the manifest duplicate under Minor |
| No page video id leaves the browser (#520) | Read: every `ask` in `apps/extension/src/surfaces/public-pages.ts`, the `read-videos` refusal for a www.youtube.com sender in `apps/extension/src/background-answer.ts:77-79`, and each surface test's `afterEach` `videoIdsSentIn` check | holds |
| Sender guard | Read: `fromYouTubeTab` (`background-answer.ts:15-22`) against the registration's `matches` and `allFrames` default, Studio's static script, an unparseable or missing sender URL | holds |
| Access and registration (R1 to R3) | Read by agent: manifest and its test for both browsers and both modes, `permissions.request` with no await before it, listeners registered before the first await, `inTurn` ordering, `namesYouTube`, the popup toggle's state on every open | holds, except Finding 2 |
| Removal, back/forward cache, re-ask (#486, #522, #523) | Read by agent: `ctx.abort` on the removal message and on a persisted `pageshow` without the grant, `current()` after every read, `stands()` and `signedInReadKeptMs` | holds |
| Studio surfaces unchanged (R11) | Read: the `watch.ts` to `page-watcher.ts` rename and the card, content list, analytics, video row and Studio surfaces diffs | holds: names, imports and comments only |
| Events (R9) | Read: `packages/api-types/src/events.ts`, the relay test over HTTP in `apps/api/src/events.test.ts`, every `settle` call in `youtube-access.ts` | holds: name-only payloads, consent-gated |
| Approved copy (R12) and em-dashes | `grep` of the popup and privacy diffs against #120's approved copy; `git diff 94ba99b -- apps packages docs CONTEXT.md README.md ':!apps/extension/test/fixtures' \| grep '^+.*—'` | verbatim; no em-dash |
| Firefox `tabs.query({ url })` with a host permission only | Not run: no Firefox in a review | NFI A |
| YouTube's real element reuse across an in-page move | Not run: no browser on live youtube.com in a review; #143 walks it | caps Finding 1 |

**Overall:** The branch is in good shape. All five full checks pass, the #520 rule that no page video id leaves the browser holds on every path, and the access, removal and restore paths hold. One MEDIUM cross-surface defect should be fixed before the PR opens: on the channel page, the feed and the Shorts tab, a pill drawn on the last page stays on a tile YouTube points at another channel's video for as long as the next page's uploads read is out, so the creator's figure sits beside someone else's video. The fix is one shared check in the pill placer and three one-line sweeps, proved in a scratch worktree. The other confirmed findings are LOW.

## Approach decisions

- **A pill on a re-pointed tile (F1):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using an id the shared `pillPlacer` records when it draws. The sweep runs on every scheduled tick, outside the pass lock, so it acts while a pass awaits the next navigation's read. Precedent: the watch page's `sweep` (`apps/extension/src/surfaces/watch-page.ts:42-45`) already takes its pill down once the URL's video is not the one it was drawn for, and the Shorts player's `sweep` (`shorts.ts:196-207`) does the same for its Short and channel link. The tile id is read through each surface's existing href reader, so the page rule (hrefs and the URL only) holds.
- **The feed's tile id reader (F1, remediation 2026-11-08):** one module function `videoIdIn(read, tile)` in `apps/extension/src/surfaces/feed.ts`, shared by the pass and the sweep. It mirrors the module-level `videoIdIn` in `channel-page.ts` and `shortIdIn` in `shorts.ts`. A test of a pill taken down during a held read starts with pills drawn, holds the next `read-uploads` through the suite's `through` hook, and asserts both that the re-pointed tiles lose their pills and that a tile still linking the creator's video keeps its pill.

## Confirmed Issues

### 1. On the channel page, the feed and the Shorts tab, the creator's pill stays beside another channel's video while the next page's uploads read is out — MEDIUM

- **Location:** `apps/extension/src/surfaces/channel-page.ts:22-58` (no `sweep`); `apps/extension/src/surfaces/feed.ts:93-96` (the sweep checks the container only); `apps/extension/src/surfaces/shorts.ts:196-207` (the sweep checks the player only, not the tab's tiles)
- **Attribution:** introduced. All three files are new on the branch: `channel-page.ts` from `1d05e8f` ("creator-analytics#138 Public pages: the channel page surface and the engaged views pill"), the feed's container-only sweep from `5238e7d` ("creator-analytics#140 Public pages: the feed surface"), the Shorts tab's `placeTab` from `4da1fa6` ("creator-analytics#141 Public pages: the Shorts surface"). It is cross-ticket: #520 made every new navigation read the channels and uploads afresh, which is the window, and only the watch page and the Shorts player gained a sweep that closes it.
- **Real-world trigger:** the creator watches one of their own videos, so the watch page's sidebar shows pills on their other videos, then clicks a sidebar video. YouTube moves the URL to `/watch?v=<next>` and redraws the sidebar for the next video. The new navigation asks `read-channels` and each held channel's `read-uploads`; when the background's 30-second keep has run out, which it has after watching for more than 30 seconds, that is a network read paging the uploads 50 at a time (#540), so seconds for a channel with hundreds of uploads. Every sidebar tile YouTube reuses for another video keeps the creator's figure beside that video's view count until the read lands. The same holds for a move from the creator's Videos, Home or Live tab to another channel's tab, a move between two searches, and a move from the creator's Shorts tab to another channel's. MEDIUM, capped: wrong figures silently delivered, but transient, and it depends on YouTube reusing tile elements across the move rather than replacing them. Upgrade to HIGH if the #143 walk sees a pill beside another channel's video after a watch-page-to-watch-page click in Chrome or Firefox.

**Evidence**

```ts
// feed.ts:93-96, the feed's whole sweep: a pill inside the shown container stays, whatever its tile now links
sweep(document) {
  const container = containerOf(document, document.URL)
  for (const host of feedPillsIn(document)) if (!container?.contains(host)) host.remove()
},
// channel-page.ts:40, the only place a stale pill comes down, after the read
const pills = tiles.length > 0 ? await reads.pillsOn(navigation) : new Map()
```

The channel page's doc comment (`channel-page.ts:18-20`) claims "a grid YouTube reuses across an in-page move, its old tiles drawn late or the next channel's drawn early, shows a pill only on a tile that is the creator's", which is false during that read.

**Failure mode** — a new navigation resets `publicPageReads` (`public-pages.ts:50-54`), so the pass awaits a fresh read while holding the watcher's pass lock (`page-watcher.ts:198-252`); no other pass runs until it lands. Only `sweep` runs meanwhile (`page-watcher.ts:254-268`), and none of these three sweeps compares a pill with its tile's current link. Executed proof, `docs/reviews/creator-analytics-120/repro/stale-pill-during-next-read.test.ts`: with the next uploads read held, the URL moves, YouTube points every tile at another channel's videos, four pass intervals pass, and the creator's pills are still drawn on 30 of 30 channel page tiles, 20 of 20 sidebar tiles and 45 of 45 Shorts tab tiles. Each existing test of a tile re-pointed during the read (`channel-page.test.ts:566`, `feed.test.ts:480`, `shorts.test.ts:317`) either starts with no pill drawn or asserts only after the read lands.

**Recommended fix**

```diff
--- a/apps/extension/src/surfaces/public-pages.ts
+++ b/apps/extension/src/surfaces/public-pages.ts
@@ export function pillPlacer(surface: ExtensionSurface) {
   const shown = new WeakMap<Element, string>()
+  const drawnFor = new WeakMap<Element, string>()
@@
       const host = renderEngagedViewsPill({ document, surface, view })
       shown.set(host, key)
+      drawnFor.set(host, videoId)
       viewCount.after(host)
     },
+
+    takeDownRepointed(tiles: Iterable<Element>, idIn: (tile: Element) => string | undefined): void {
+      for (const tile of tiles)
+        for (const host of tile.querySelectorAll(`[data-stillstats-surface="${surface}"]`))
+          if (drawnFor.get(host) !== idIn(tile)) host.remove()
+    },
   }
--- a/apps/extension/src/surfaces/channel-page.ts
+++ b/apps/extension/src/surfaces/channel-page.ts
     isOn: (url) => channelTabOf(url) !== undefined,
+    sweep(document) {
+      placer.takeDownRepointed(videoTilesIn(document), videoIdIn)
+    },
--- a/apps/extension/src/surfaces/feed.ts
+++ b/apps/extension/src/surfaces/feed.ts
     sweep(document) {
       const container = containerOf(document, document.URL)
       for (const host of feedPillsIn(document)) if (!container?.contains(host)) host.remove()
+      const page = feedPageOf(document.URL)
+      if (!page || !container) return
+      const read = tilesOf[page]
+      placer.takeDownRepointed(read.tilesIn(container), (tile) => {
+        const href = read.hrefIn(tile)
+        return href ? videoIdOfLink(href) : undefined
+      })
     },
--- a/apps/extension/src/surfaces/shorts.ts
+++ b/apps/extension/src/surfaces/shorts.ts
     sweep(document) {
+      placer.takeDownRepointed(shortsTilesIn(document), shortIdIn)
       if (!playerPill) return
```

The feed's `idIn` in `place` (`feed.ts:102-105`) and the new sweep's reader are the same function of `read`; hoisting one `idOf(read, tile)` beside `containerOf` is the refactor on this path (standard 3). Then add the three repro cases to the surfaces' own suites, `channel-page.test.ts`, `feed.test.ts` (the watch sidebar, plus a `/results` to `/results` move) and `shorts.test.ts`, each starting with pills drawn, and delete the repro folder's test in the same commit.

**Remediation brief**

- **Design intent:** a public page surface's pill belongs to the video its tile links at the moment it was drawn. A pass re-checks each tile's id and view count after its read and places only what still matches; between passes, and above all while a new navigation's read is out, the sweep is the only thing that runs, and it must take down at once whatever the page no longer stands for (`page-watcher.ts:24-33`). Whose a video is comes only from the uploads read, never from a channel link or draw order (ADR 0016, #520), so the sweep compares ids only. It must stay synchronous, read hrefs only, and leave a pill whose tile still links its video in place, so YouTube's redraws do not flicker it.
- **Full surface:** `apps/extension/src/surfaces/public-pages.ts:142-174` (`pillPlacer`: record the id, add `takeDownRepointed`); `apps/extension/src/surfaces/channel-page.ts:27-29` (add the sweep; the doc comment at `:13-21` becomes true and stays); `apps/extension/src/surfaces/feed.ts:93-96` (extend the sweep) and `:102-105` (the shared href reader); `apps/extension/src/surfaces/shorts.ts:196-197` (the tab's tiles, before the player check). Tests: `apps/extension/src/surfaces/channel-page.test.ts`, `feed.test.ts`, `shorts.test.ts`. `watch-page.ts` already has its own sweep and needs nothing.
- **Must preserve:** the feed sweep's container check (a pill outside the shown page's container comes down at once, `feed.test.ts` "a move from the home feed to search ... taking the home feed's down"); the Shorts player sweep's check of the URL's Short and the channel link, which runs after the new line and is unchanged (every player test in `shorts.test.ts`); `pillPlacer`'s same-key keep, so a pill already beside its view count for the same video and figure is not redrawn; a tile re-pointed at another of the creator's videos shows the new video's pill on the next pass (`channel-page.test.ts` "a tile YouTube points at another of the creator's videos loses the old video's pill and shows the new one's"); the page rule, held by `apps/extension/test/page-boundary.test.ts` (the sweep reads through `videoIdIn`, `read.hrefIn` and `shortIdIn`, which read `href` only); no read and no id sent from a sweep (`videoIdsSentIn` in every surface suite's `afterEach`). The player pill is not inside a `ytm-shorts-lockup-view-model`, so the new Shorts line never touches it.
- **Failure of the fix itself:** a pill drawn by another placer instance (a content script re-injected after a new grant, whose old copy WXT aborts) has no `drawnFor` entry, so the sweep removes it and the next pass redraws it once: one flicker, never a wrong figure. A sweep that throws is skipped and the pass still runs (`page-watcher.ts:262-266`), and the pass's own after-read re-check (`channel-page.ts:45`, `feed.ts:117`, `shorts.ts:141`) still stops a wrong pill being drawn.
- **Do not touch:** the Shorts player's bar guard (`shorts.ts:93-118`, `noteDrawn` and `leftOver`), six review passes on #520 converged it; see Dismissed, the agency player variant.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-120/repro/stale-pill-during-next-read.vitest.config.ts`, 3 red now, 3 green after; then `pnpm exec vitest run apps/extension` green.

### 2. A grant that wakes the background injects the youtube.com script into every open tab twice — LOW

- **Location:** `apps/extension/src/youtube-access.ts:148-155` (the `onAdded` step) and `:165-172` (the start repair)
- **Attribution:** introduced in `f001a9d` ("creator-analytics#137 Extension: the YouTube access toggle").
- **Real-world trigger:** the creator grants YouTube access from the browser's extension settings, or from the popup after Chrome stopped the service worker, with www.youtube.com tabs open. The grant wakes the background: the start repair finds the grant and no registration, registers and injects; the `onAdded` step queued behind it finds the script registered, skips the register and injects again. LOW: WXT's script-started message aborts the older copy within milliseconds, before its first pass (`passEveryMs` is 250), so the cost is a wasted script run and at most one more `read-channels` ask the background's keep absorbs. No user path shows a wrong result.

**Evidence**

```ts
onAccessAdded((change) => {
  if (!namesYouTube(change)) return
  void inTurn(async () => {
    await register()
    await injectIntoOpenTabs()
  })
```

**Failure mode** — executed by an agent with the module's fakes: grant already true, `onAdded` fired before the repair settled, two open tabs: injected `[11, 12, 11, 12]`. The test "a grant during the start repair registers the script once" (`youtube-access.test.ts:246`) asserts `registerCalls` and never `injected`.

**Recommended fix** — the `onAdded` step injects unless the start repair of this same background run already injected for this grant:

```diff
+  let repairInjected = false
@@ onAccessAdded
   void inTurn(async () => {
     await register()
-    await injectIntoOpenTabs()
+    if (repairInjected) repairInjected = false
+    else await injectIntoOpenTabs()
   })
@@ onAccessRemoved
+    repairInjected = false
@@ return inTurn(async () => {
     if (granted && !isRegistered) {
       await register()
       await injectIntoOpenTabs()
+      repairInjected = true
```

**Remediation brief**

- **Design intent:** the background keeps the registration in step with the grant and injects into already-open www.youtube.com tabs once per grant, so the creator needs no reload (#120 Access). `inTurn` serialises every step, so the repair and a listener step never overlap.
- **Full surface:** `apps/extension/src/youtube-access.ts:148-172`; test `apps/extension/src/youtube-access.test.ts:246` (assert `injected` is `injectedInto(11, 12)` once).
- **Must preserve:** "a grant that lands on a script already registered keeps it and still injects and sends" (`youtube-access.test.ts:266`): a grant with the script already registered from an earlier run still injects, which is why the fix keys on what the repair did this run, not on `register()` finding a registration; the granted event is sent from `onAdded` on every grant; a removal between the repair and a later grant resets the flag, so that grant injects.
- **Failure of the fix itself:** if the repair's injection threw, `inTurn` swallowed it before `repairInjected` was set, so the `onAdded` step injects again, which is the wanted retry.
- **Do not touch:** the removal side's double tell on a wake by `onRemoved` is harmless: the listener is removed after the first abort and `abort()` is idempotent.
- **Proof:** extend `youtube-access.test.ts:246` with `expect(background.injected).toEqual(injectedInto(11, 12))`; red now (`[11, 12, 11, 12]`), green after.

### 3. The popup page's toggle test asserts the approved copy on top of the rule it states — LOW

- **Location:** `apps/extension/src/popup-page.test.ts:264-267`, and the `toggleText` constant at `:58-59` appended to the full-text assertions at `:128` and `:236`
- **Attribution:** introduced in `f001a9d` ("creator-analytics#137 Extension: the YouTube access toggle"). The full-text `toBe` on `root.textContent` at `:128` and `:236` is pre-existing at `94ba99b`; the branch extends it.
- **Real-world trigger:** none in the product; a standards breach (`CODING_STANDARDS.md` standard 2, "No test asserts that fixed copy is present"). A wording change Nick approves on #539 fails the test without any code breaking. LOW.

**Evidence**

```ts
expect(youtubeToggle().checked).toBe(granted)
expect(youtubeToggle().closest('label')?.textContent).toBe('Show engaged views on youtube.com')
expect(root.textContent).toContain(toggleText)
```

**Recommended fix** — delete the two copy assertions at `:264-267` and keep `.checked`; at `:128` and `:236`, assert the toggle's presence structurally (`expect(youtubeToggle()).not.toBeNull()` or the `input[role="switch"]` the helper already finds) instead of appending `toggleText` to the full-text `toBe`, and drop `toggleText`.

**Remediation brief**

- **Design intent:** a popup test states which view the popup took, signed in, signed out or access withheld, and whether the toggle shows the browser's grant. Copy is held by Nick's approval on #120, not by the suite.
- **Full surface:** `apps/extension/src/popup-page.test.ts:58-59`, `:128`, `:236`, `:264-267`.
- **Must preserve:** the rule of each test: the toggle reads the grant on open, signed in and signed out (`:255-268`); the signed-in and signed-out views' own lines, which observe a branch through its text and stay (standard 2's exemption). `popup.test.ts`'s `youtubeToggleOff` (`:26-31`) is a view-model `toEqual` in the same shape as the pre-existing `openStillstats` (`:20-24`), so it stays.
- **Proof:** `pnpm exec vitest run apps/extension/src/popup-page.test.ts` green after; changing the label's literal in `apps/extension/src/popup.ts` no longer fails it.

### 4. Comment hygiene — LOW (aggregated)

- `apps/api/src/events.test.ts:39` — `describe('seam 1: the API relays the Studio extension events to OpenPanel'` → `describe('seam 1: the API relays the extension events to OpenPanel'` (it now holds the four public page surfaces and the two YouTube access events)

## Needs Further Investigation

### A. Firefox may not filter `tabs.query({ url })` by URL without the `tabs` permission, which would weaken the grant-time injection into open tabs — confirm in the #143 walk: in Firefox, open a www.youtube.com tab, turn on YouTube access, and see pills without a reload and no error in the background console

`apps/extension/src/entrypoints/background.ts:115-116` is the first Firefox path that queries tabs by URL; the Studio path that does so returns early in Firefox. If Firefox refuses, `inTurn` swallows the error and no open tab gets the script; if it ignores the filter, `executeScript` is refused on the other tabs and the www.youtube.com ones are still injected. The run's handoff already lists this walk step for #137.

### B. A live or upcoming search result may get a pill beside "N watching" — confirm with a search save holding a live or scheduled result, then a feed test

`apps/extension/src/selectors/feed.ts:49-51` takes the first span of the metadata line whatever it is. The home feed and sidebar withhold a pill from a live tile (`feed.test.ts:331`), so search would be inconsistent. The search fixture holds no live or upcoming result.

### C. Each in-page move may read the channels and uploads twice, once for the `ahead` pass and once after WXT reports the URL — confirm with a watcher test that counts `read-uploads` across one `urlMovesTo` with a pass between the URL change and `navigated`

Reasoning only (`page-watcher.ts:207-218` and `public-pages.ts:50-54`). The background's 30-second keep absorbs most of the cost.

### D. A legacy `/c/<name>` or `/user/<name>` channel URL gets no channel page surface — confirm whether YouTube still serves those without redirecting to `/@handle`

`channelTabOf` (`youtube-url.ts:97-106`) accepts only `/@handle` and `/channel/UC…` paths. Since #520 the surface needs no channel to match, so those tabs could carry pills.

## Reviewed and Dismissed

- Agency user: in the Shorts player one held channel's figure under another held channel's bar, before YouTube redraws it (`shorts.ts:111-115`) — the same transient race as #520 review 6 F6.17, rated LOW there because it lasts until the redraw and sends no id; the guard converged over six passes. Do not touch for Finding 1.
- A throw while building pills keeps a rejected uploads read for the navigation (`public-pages.ts:59-78`) — unreachable: `lastProcessedDay` is a non-null `YYYY-MM-DD` string in `UploadsRead` (`product-api.ts:87`), and the Studio surfaces call the same formatter.
- `channelTabOf` checks no host (`youtube-url.ts:97-99`) — the content script is registered only for `https://www.youtube.com/*`, so no other host reaches it.
- Handle comparison does no Unicode normalisation (`youtube-url.ts:77`) — fails closed: a pill is withheld, never misplaced.
- `read-channels` can answer `host-access-withheld`, which `ChannelsRead` does not declare — `public-pages.ts:89` treats any state but `signed-in` as no channels and asks again after the keep time; behaviour holds.
- The uploads keep can carry one stillstats.com account's lists into the next sign-in for up to 30 seconds (`product-api.ts:261`) — the same keep `keptChannels` and `keptVideos` have on `94ba99b`; a 401 clears all three.
- The relay accepts click events with a public page surface (`packages/api-types/src/events.ts`) — #120 gives `extensionSurfaces` the four values for every surface event; splitting the list is not in the spec.
- `content-list.test.ts` and `youtube-access-removed.test.ts` failing in an agent's scratch worktree — environmental (no `wxt prepare` there); both green in the live worktree's full suite.
- The feed and the Shorts surface claiming the same tile — their `isOn` paths do not overlap, and the feed's tile selectors never match `ytm-shorts-lockup-view-model`.
- A feed tile naming another channel whose id is among the creator's uploads gets a pill (`feed.test.ts:371`) — correct under #520: the id is the creator's upload.
- The sender guard (`background-answer.ts:15-22`) — exact origin match; m.youtube.com, music.youtube.com and frames get no script.

## Minor / nits

- The tile pass is written three times, `channel-page.ts:30-57`, `shorts.ts:123-152` and `feed.ts:97-126`, differing only in the clean-up scope (standard 3; #520 review 6 F6.33). Finding 1 touches all three; a shared `placeTiles` in `public-pages.ts` is the follow-up.
- `channelTabOf` and `shortsTabOf` return a decoded `LinkedChannel` every caller only tests for definedness (`youtube-url.ts:97-106`; #520 review 6 F6.29).
- `apps/extension/src/surfaces/public-pages.test.ts:332-345` repeats the rule of `:274-292`.
- `apps/extension/src/surfaces/youtube-surfaces.test.ts:119-157` drives two surfaces' `place` at once, a concurrency the watcher's pass lock never produces, on a document holding a watch page and a channel page together.
- `apps/extension/test/manifest.test.ts:116-131` mostly repeats `:85`, `:97` and `:249`; only the development build's `content_scripts` is new. Folding it into `:249` over both modes keeps one rule, one test.
- `videoIdsSentIn` (`surfaces/testing.ts`) reads only `ids` and `videoId`, and no test shows it catches a real send; one canary test would hold the #520 guarantee's own check.
- The feed's `extension_surface_missing` is nearly unreachable on `/watch`, since every save keeps the sidebar renderer in the document (`selectors/feed.ts:24-26`).
- A search Short drawn as `ytd-video-renderer` with a `/shorts/` href would get no pill (`selectors/feed.ts:41-43`); no fixture has one.
- The Shorts tab's clean-up covers only the shown channel page (`shorts.ts:150`); a hidden page's pills are invisible and re-placed if it comes back.

## Test quality

Tests run at `94ba99b`: 548, 78 red and 470 green, plus 10 whole files red at import because they test new modules (channel page, feed, public pages, Shorts, watch page, YouTube surfaces, YouTube URL, YouTube access, YouTube access removed, chosen images). Green and new on the branch: 13, every one a legitimate negative or "as before" guard paired with a red positive test (`events.test.ts:101-108` the unknown-surface rows, `background-answer.test.ts:346` and `:359`, `host-access.test.ts:52`, `popup-page.test.ts:353`, `popup.test.ts:195`, `manifest.test.ts:116`); none traces to a review finding's proof, and none is recommended for deletion. Green and moved: the two page boundary scans from the deleted `studio-boundary.test.ts`. Green and modified only to the new signatures: 14. Tautology shapes found: 0 vacuous; 1 copy test (Finding 3) and 1 duplicate (`manifest.test.ts:116`, Minor). No snapshot, no mocked unit under test, no assertion-free test. The call-shaped assertions in `youtube-access.test.ts` are on injected browser ports, where the call is the effect. The gap this review found is in coverage, not in tautology: no test starts a navigation's read with pills already drawn (Finding 1).

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite green at `4c4f424`; the browser walk green.
- **Commit hygiene:** commit this doc and `repro/` together as `creator-analytics#120 pre-PR review 1`. Finding 1's remediation deletes `repro/stale-pill-during-next-read.test.ts` and its config once the three cases live in the surface suites.
- **Likely reviewer asks:** the #143 walk in real Chrome and Firefox (it lifts or keeps Finding 1's cap and settles NFI A); #539, since the popup explanation, the privacy paragraph and ADR 0016 still say the creator's ids are sent while the branch sends none; #540 for large channels; the #140 body, #120's "Matching a video to a channel" and user story 27 still describe the channel-link match #520 replaced (flagged Needs Nick in the run).

## Verdict

Ready with follow-ups once Finding 1 is fixed. Gate: Finding 1 (MEDIUM) before the PR opens. Findings 2 to 4 are LOW and can ride along or ship as follow-up tickets; NFI A rides on the #143 walk. This review does not re-check prior lane findings; no prior review doc exists for the branch.

## Remediation — 2026-11-08

Scope: CRITICAL, HIGH and MEDIUM (Finding 1). Findings 2, 3 and 4 are LOW and deferred to Nick (eng-pipeline#34).

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `b0ee201` creator-analytics#120 pre-PR review 1 finding 1: take the creator's pill off a tile YouTube points at another video while the next read is out | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-120/repro/stale-pill-during-next-read.vitest.config.ts` 3 red before, 3 green after; the four cases moved into the suites (`channel-page.test.ts`, `feed.test.ts` watch-to-watch and search-to-search, `shorts.test.ts`) red before the source change, green after; `pnpm exec vitest run apps/extension` 33 files, 933 tests green | 0 | fixed (one `pr-review-finder` disprove agent: the four new tests fail with the parent commit's sources and pass with the fix; same-video href changes keep the same pill element) |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked |
| 4 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked |

Full checks at `b0ee201`: `pnpm lint` green, `pnpm typecheck` green, `pnpm build` green, `pnpm test` 141 files and 3,593 tests green plus the 1 expected fail, `pnpm run --if-present test:browser` green with no content security policy violation in 47 steps.

The repro test and its config for Finding 1 were deleted in `b0ee201` once their cases lived in the surface suites, as this doc's "Before opening the PR" directs. `repro/` is now empty.

### Known regressions, deferred

- None. The verify pass reported no introduced defect.

### Verifier observations, not worked (LOW, for the next round)

- Each tick the channel page and Shorts sweeps scan the document's tiles on every YouTube page, the lockup selector using `:has()`, then run one `querySelectorAll` per tile (`channel-page.ts:31`, `shorts.ts:197`). The cost in Chrome is not measured. A cheaper equal shape starts from the surface's pills and walks up to each one's tile with `closest`.
- A pill on a tile that stops matching the tile selector (a lockup YouTube reuses as a playlist lockup, which `videoTilesIn` leaves out, `lockup.ts:13-15`) is not swept. The pass's own clean-up on the channel page and the Shorts tab already had this gap (`channel-page.ts:58-59`), and the sweep mirrors it. The feed's `takeDownAllBut` catches it once the read lands. Whether YouTube ever reuses tiles this way is not known.
- The feed's new test covers the watch sidebar and search, not the home feed, which shares the sidebar's `lockups` path.

### Rework briefs

- None. No rework pass was needed.
