# Pre-PR review: creator-analytics#120 Extension: engaged views on YouTube's public pages

**Branch:** `creator-analytics-120-youtube-engaged-views` vs `origin/main` (merge-base `94ba99b` "Merge pull request #546 from nick-vogel/creator-analytics-238-own-channel-metrics")
**Reviewed at:** HEAD `6204077` ("creator-analytics#120 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 84 files, +23,335 / −234 (15,572 of those lines are the nine saved youtube.com pages under `apps/extension/test/fixtures/youtube/`), 58 commits.
**Delta under review:** since `4c4f424` ("creator-analytics#140 Public pages: the feed surface"), the HEAD pre-PR review 1 (`docs/reviews/creator-analytics-120/pre-pr-review-1.md`) reviewed. Three commits: `9807ba8` (the review 1 doc), `b0ee201` ("creator-analytics#120 pre-PR review 1 finding 1: take the creator's pill off a tile YouTube points at another video while the next read is out") and `6204077` (the closure table). Code delta: 7 files, +117 / −7, in `apps/extension/src/surfaces/` (`public-pages.ts`, `channel-page.ts`, `feed.ts`, `shorts.ts` and the three surfaces' test files).
**Reviewed against:** pre-PR review 1's Finding 1 and its brief, Approach decisions, Remediation closure table and verifier observations; epic nick-vogel/creator-analytics#120 as amended by #520 (the creator's ids are matched in the browser, no page id is sent), as distilled in review 1; `CODING_STANDARDS.md` (standards 1 to 3); ADR 0016.
**Date:** 2026-11-08
**Reviewer:** 1 code-review agent (which also ran the delta's mutation checks) and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` | green (593 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 141 files, 3,593 tests, 1 expected fail (`packages/token-vault/src/token-vault.test.ts:619`, a `test.fails` on `main`, unrelated) |
| Browser walk | `pnpm run --if-present test:browser` | green, no content security policy violation in 47 steps |
| The four new tests go red without the fix (Phase 4.5) | Executed by the agent in a detached scratch worktree at HEAD: the four source files put back to `4c4f424` with HEAD's tests | exactly the 4 new cases red (channel tab, feed watch to watch, feed search to search, Shorts tab), 142 green |
| The "kept" half of each new test can go red | Executed by the agent: `takeDownRepointed` mutated to remove every host | the same 4 red, so a flicker during the held read is caught |
| The Shorts sweep's ordering is pinned | Executed by the agent: the new Shorts line moved after `if (!playerPill) return` | the Shorts tab test red; every existing player test green with the line first |
| `drawnFor` consistent with `shown` | Read: `public-pages.ts:157-173` | both set together on the only draw path; the same-key keep only matches a host this placer drew, whose key starts with the same id |
| Same-video href variants (`&t=`, `&pp=`) | Read: `videoIdOfLink` (`youtube-url.ts:26-34`), used by both `place` and the sweep | id only, so a variant keeps its pill |
| The Shorts player pill and other surfaces' pills | Read: the sweep's selector is `[data-stillstats-surface="<own surface>"]` inside `ytm-shorts-lockup-view-model`; the player pill sits in `ytd-shorts` with no lockup ancestor (player fixture: 0 lockups; Shorts tab fixture: 0 `ytd-shorts`) | untouched |
| Page rule and no id sent | `apps/extension/test/page-boundary.test.ts` green; the sweeps call no `ask`; `videoIdsSentIn` in each suite's `afterEach` | holds |
| Prior LOW findings 2 to 4 still present | Read: `youtube-access.ts:148-172`, `popup-page.test.ts:58-59, 128, 236, 264-267`, `events.test.ts:39` | unchanged, carried as Findings 2 to 4 |
| Sweep cost in a real Chrome on a long home feed | Not run: no browser on live youtube.com in a review | caps Finding 1 |
| YouTube reusing a video lockup as a playlist or Mix lockup, or blanking a lockup's href mid-redraw | Not run: needs live youtube.com | NFI E and F |

**Overall:** Finding 1 of review 1 is fixed as its brief intended: a pill on a tile YouTube points at another video comes down at the next tick while the next uploads read is still out, a pill whose tile still links its video stays, and all four new tests go red without the fix. All five full checks pass. No MEDIUM or higher finding remains. The one new confirmed finding is a LOW cost concern in the fix's own sweep; the other confirmed items are review 1's three deferred LOWs, carried unchanged. The branch can open its PR.

## Approach decisions

- **A pill on a re-pointed tile (F1, carried from review 1):** each tile surface's `sweep` takes down a pill whose tile no longer links the video the pill was drawn for, using an id the shared `pillPlacer` records when it draws. The sweep runs on every scheduled tick, outside the pass lock, so it acts while a pass awaits the next navigation's read. Precedent: the watch page's `sweep` (`apps/extension/src/surfaces/watch-page.ts`) and the Shorts player's `sweep` (`shorts.ts:196-207`). The tile id is read through each surface's existing href reader, so the page rule (hrefs and the URL only) holds.
- **The feed's tile id reader (F1, carried from review 1's remediation):** one module function `videoIdIn(read, tile)` in `apps/extension/src/surfaces/feed.ts`, shared by the pass and the sweep, mirroring `videoIdIn` in `channel-page.ts` and `shortIdIn` in `shorts.ts`.
- **The re-pointed sweep's scan (Finding 1, this review):** the channel page and Shorts sweeps start from the surface's own pills and walk up to each one's tile with `closest`, instead of scanning every tile in the document. Precedent: the feed's sweep already starts from its pills (`feedPillsIn`, `feed.ts:100`) and the feed's `takeDownAllBut` walks up from each pill (`feed.ts:85-91`). The feed's own re-pointed scan stays tile-first, because it only runs on a feed page and only inside the shown container.

## Prior-review closure

Review 1 confirmed 4 findings: 1 MEDIUM and 3 LOW.

| Review 1 finding | State | Notes |
| --- | --- | --- |
| 1 (MEDIUM) stale pill during the next read | fully fixed | `b0ee201`; verified against intent: taken down during the held read on the channel tab, watch sidebar, search and Shorts tab, kept on a tile still linking the creator's video, ordering before the player check pinned. Fixed in code, not by a comment edit |
| 2 (LOW) double injection on a wake by the grant | untouched | deferred by review 1's remediation scope (CRITICAL to MEDIUM only); carried as Finding 2 |
| 3 (LOW) popup toggle test asserts copy | untouched | same scope; carried as Finding 3 |
| 4 (LOW) comment hygiene | untouched | same scope; carried into Finding 4 |

Review 1's NFI A to D are untouched by the delta and carried. Review 1's three verifier observations: the sweep's per-tick scan is this review's Finding 1; the tile that leaves the tile selector is NFI E; the home feed's missing test is under Test quality. No MEDIUM-or-higher prior finding is left open, and none is deferred.

## Confirmed Issues

### 1. The channel page and Shorts sweeps scan every tile on every YouTube page at each tick, though almost no page holds their pills — LOW

- **Location:** `apps/extension/src/surfaces/channel-page.ts:30-32`, `apps/extension/src/surfaces/shorts.ts:197`, `apps/extension/src/surfaces/public-pages.ts:176-180`
- **Attribution:** introduced by the remediation, `b0ee201` ("creator-analytics#120 pre-PR review 1 finding 1: ..."); `git show 4c4f424:apps/extension/src/surfaces/channel-page.ts | grep -n sweep` finds nothing, so the channel page had no sweep before. Not a known regression, deferred: review 1's "Known regressions, deferred" reads "None". Review 1 named it under "Verifier observations, not worked (LOW, for the next round)": "Each tick the channel page and Shorts sweeps scan the document's tiles on every YouTube page, the lockup selector using `:has()`, then run one `querySelectorAll` per tile ... A cheaper equal shape starts from the surface's pills and walks up to each one's tile with `closest`."
- **Real-world trigger:** the creator scrolls a long home feed or a watch page's sidebar. The watcher runs every surface's sweep on each scheduled tick, at most every 250 ms, on every page (`page-watcher.ts:24-33`, `:254-268`). The channel page's sweep runs a document-wide `yt-lockup-view-model:not(:has(yt-collection-thumbnail-view-model, yt-collections-stack))` query and one `querySelectorAll` per match, over every lockup the infinite-scrolled feed and YouTube's hidden pages hold, to find `channel_page` pills that exist only on a channel tab. The Shorts sweep does the same over every Shorts lockup, for example a search's Shorts shelf. LOW, capped: no wrong result, and the cost in Chrome is not measured. Upgrade to MEDIUM if a Chrome performance trace of a home feed scrolled to a few hundred tiles shows the sweep taking a visible share of each tick (check: DevTools Performance panel, filter by the content script's `sweep` frames).

**Evidence**

```ts
// channel-page.ts:30-32, on every page, every tick
sweep(document) {
  placer.takeDownRepointed(videoTilesIn(document), videoIdIn)
},
// public-pages.ts:176-180
takeDownRepointed(tiles: Iterable<Element>, idIn: (tile: Element) => string | undefined): void {
  for (const tile of tiles)
    for (const host of tile.querySelectorAll(`[data-stillstats-surface="${surface}"]`))
      if (drawnFor.get(host) !== idIn(tile)) host.remove()
},
```

**Failure mode** — the sweep contract says "It must be synchronous and cheap" (`page-watcher.ts:28`). Off a channel tab the scan almost always finds no `channel_page` host, so its whole cost buys nothing, and that cost grows with the feed's length. Proved by reading only; no measurement.

**Recommended fix**

```diff
--- a/apps/extension/src/surfaces/public-pages.ts
+++ b/apps/extension/src/surfaces/public-pages.ts
-    takeDownRepointed(tiles: Iterable<Element>, idIn: (tile: Element) => string | undefined): void {
-      for (const tile of tiles)
-        for (const host of tile.querySelectorAll(`[data-stillstats-surface="${surface}"]`))
-          if (drawnFor.get(host) !== idIn(tile)) host.remove()
-    },
+    takeDownRepointed(
+      document: Document,
+      tileOf: (host: Element) => Element | null,
+      idIn: (tile: Element) => string | undefined,
+    ): void {
+      for (const host of document.querySelectorAll(`[data-stillstats-surface="${surface}"]`)) {
+        const tile = tileOf(host)
+        if (tile && drawnFor.get(host) !== idIn(tile)) host.remove()
+      }
+    },
--- a/apps/extension/src/surfaces/channel-page.ts
+++ b/apps/extension/src/surfaces/channel-page.ts
     sweep(document) {
-      placer.takeDownRepointed(videoTilesIn(document), videoIdIn)
+      placer.takeDownRepointed(document, (host) => host.closest('yt-lockup-view-model'), videoIdIn)
     },
--- a/apps/extension/src/surfaces/shorts.ts
+++ b/apps/extension/src/surfaces/shorts.ts
     sweep(document) {
-      placer.takeDownRepointed(shortsTilesIn(document), shortIdIn)
+      placer.takeDownRepointed(
+        document,
+        (host) => host.closest('ytm-shorts-lockup-view-model'),
+        shortIdIn,
+      )
       if (!playerPill) return
--- a/apps/extension/src/surfaces/feed.ts
+++ b/apps/extension/src/surfaces/feed.ts
-      placer.takeDownRepointed(read.tilesIn(container), (tile) => videoIdIn(read, tile))
+      const tiles = new Set(read.tilesIn(container))
+      placer.takeDownRepointed(
+        document,
+        (host) => {
+          let on = host.parentElement
+          while (on && !tiles.has(on)) on = on.parentElement
+          return on
+        },
+        (tile) => videoIdIn(read, tile),
+      )
```

Both `shortsTilesIn` (`placeTab`) and `videoTilesIn` (`place`) keep other callers, so their imports stay.

**Remediation brief**

- **Design intent:** a public page surface's pill belongs to the video its tile linked when it was drawn. Between passes, and while a new navigation's read is out, the sweep is the only thing that runs, and it takes down at once a pill whose tile now links another video (`page-watcher.ts:24-33`). The sweep runs on every page for every surface, so its cost must scale with the surface's own pills, which are zero on most pages, not with the page's tiles. Whose a video is comes only from the uploads read (ADR 0016, #520), so the sweep compares ids only, reads hrefs only, and stays synchronous.
- **Full surface:** `apps/extension/src/surfaces/public-pages.ts:176-180` (the new signature); its three callers, `channel-page.ts:31`, `shorts.ts:197`, `feed.ts:104` (`git grep -n takeDownRepointed apps/extension/src` lists exactly these four sites). A channel page pill is always inside its lockup, because `place` draws it with `viewCount.after(host)` and `viewCountIn(tile)` reads inside the tile (`channel-page.ts:38`, `:50`), so `closest('yt-lockup-view-model')` finds the tile the pass drew it on. A Shorts tab pill is inside its `ytm-shorts-lockup-view-model` the same way; the Shorts player pill has no such ancestor, so `tileOf` returns `null` and it is left to the player check that follows. The feed's `tileOf` keeps today's scope, the shown container's tiles only, by walking up as `takeDownAllBut` does (`feed.ts:85-91`).
- **Must preserve:** the four tests `b0ee201` added: `channel-page.test.ts` "a move to another channel's tab takes the creator's pills off the tiles ...", the two `feed.test.ts` `test.each` cases "a move from one watch page to the next ..." and "... search to the next ...", and `shorts.test.ts` "a move to another channel's Shorts tab takes the creator's pills off ...", each of which asserts both the take-down and the kept pill; every Shorts player test in `shorts.test.ts` (the player pill is never removed by this line); the feed sweep's container check on its first line (`feed.ts:100`); `pillPlacer`'s same-key keep (`public-pages.ts:165`); a tile re-pointed at another of the creator's videos shows the new pill on the next pass (`channel-page.test.ts` "a tile YouTube points at another of the creator's videos loses the old video's pill and shows the new one's"); the page rule (`apps/extension/test/page-boundary.test.ts`); no read and no id sent from a sweep (`videoIdsSentIn` in each suite's `afterEach`). One behaviour widens on purpose: a `channel_page` pill whose lockup YouTube turned into a playlist or Mix lockup is now compared against that lockup's link instead of being skipped (see NFI E).
- **Failure of the fix itself:** `closest` with a plain tag selector cannot throw; if a sweep throws for any other reason, the watcher skips it and the pass still runs, and the pass's own after-read re-check (`channel-page.ts:48`, `feed.ts:122`, `shorts.ts:141`) still stops a wrong pill being drawn. A host with no tile ancestor is left alone, which for the channel page and the Shorts tab cannot occur by the draw path above, and for the feed is a pill outside the container, which the container check on the line before already removed.
- **Do not touch:** the Shorts player's bar guard (`shorts.ts:93-118`, `noteDrawn` and `leftOver`), converged over six review passes on #520; the feed's container check.
- **Proof:** no red exists for a cost fix. Run `pnpm exec vitest run apps/extension/src/surfaces/channel-page.test.ts apps/extension/src/surfaces/feed.test.ts apps/extension/src/surfaces/shorts.test.ts` green before and after, then `pnpm exec vitest run apps/extension` green. The four `b0ee201` tests still go red with `takeDownRepointed`'s body emptied (a scratch mutation, not committed).

### 2. A grant that wakes the background injects the youtube.com script into every open tab twice — LOW

- **Location:** `apps/extension/src/youtube-access.ts:148-155` (the `onAdded` step) and `:165-172` (the start repair)
- **Attribution:** introduced in `f001a9d` ("creator-analytics#137 Extension: the YouTube access toggle"). Carried unchanged from review 1 Finding 2, deferred there by the remediation's scope (CRITICAL to MEDIUM only); the delta does not touch this file.
- **Real-world trigger:** the creator grants YouTube access from the browser's extension settings, or from the popup after Chrome stopped the service worker, with www.youtube.com tabs open. The start repair finds the grant and no registration, registers and injects; the `onAdded` step queued behind it finds the script registered, skips the register and injects again. LOW: WXT's script-started message aborts the older copy within milliseconds, before its first pass (`passEveryMs` is 250), so the cost is a wasted script run and at most one more `read-channels` ask the background's keep absorbs. No user path shows a wrong result.

**Evidence**

```ts
onAccessAdded((change) => {
  if (!namesYouTube(change)) return
  void inTurn(async () => {
    await register()
    await injectIntoOpenTabs()
  })
```

**Failure mode** — review 1 executed it with the module's fakes: grant already true, `onAdded` fired before the repair settled, two open tabs: injected `[11, 12, 11, 12]`. The test "a grant during the start repair registers the script once" (`youtube-access.test.ts:246`) asserts `registerCalls` and never `injected`.

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
- **Proof:** extend `youtube-access.test.ts:246` with `expect(background.injected).toEqual(injectedInto(11, 12))`; red now (`[11, 12, 11, 12]`), green after. Run `pnpm exec vitest run apps/extension/src/youtube-access.test.ts`.

### 3. The popup page's toggle test asserts the approved copy on top of the rule it states — LOW

- **Location:** `apps/extension/src/popup-page.test.ts:264-267`, and the `toggleText` constant at `:58-59` appended to the full-text assertions at `:128` and `:236`
- **Attribution:** introduced in `f001a9d` ("creator-analytics#137 Extension: the YouTube access toggle"). The full-text `toBe` on `root.textContent` at `:128` and `:236` is pre-existing at `94ba99b`; the branch extends it. Carried unchanged from review 1 Finding 3, deferred there by scope.
- **Real-world trigger:** none in the product; a standards breach (`CODING_STANDARDS.md` standard 2, "No test asserts that fixed copy is present"). A wording change Nick approves on #539 fails the test without any code breaking. LOW.

**Evidence**

```ts
expect(youtubeToggle().checked).toBe(granted)
expect(youtubeToggle().closest('label')?.textContent).toBe('Show engaged views on youtube.com')
expect(root.textContent).toContain(toggleText)
```

**Recommended fix** — delete the two copy assertions at `:264-267` and keep `.checked`; at `:128` and `:236`, assert the toggle's presence structurally (`expect(youtubeToggle()).not.toBeNull()`, the helper that already finds the `input[role="switch"]`) instead of appending `toggleText` to the full-text `toBe`, and drop `toggleText`.

**Remediation brief**

- **Design intent:** a popup test states which view the popup took, signed in, signed out or access withheld, and whether the toggle shows the browser's grant. Copy is held by Nick's approval on #120, not by the suite.
- **Full surface:** `apps/extension/src/popup-page.test.ts:58-59`, `:128`, `:236`, `:264-267`.
- **Must preserve:** the rule of each test: the toggle reads the grant on open, signed in and signed out (`:255-268`); the signed-in and signed-out views' own lines, which observe a branch through its text and stay (standard 2's exemption). `popup.test.ts`'s `youtubeToggleOff` (`:26-31`) is a view-model `toEqual` in the same shape as the pre-existing `openStillstats` (`:20-24`), so it stays.
- **Proof:** `pnpm exec vitest run apps/extension/src/popup-page.test.ts` green after; changing the label's literal in `apps/extension/src/popup.ts` no longer fails it.

### 4. Comment hygiene — LOW (aggregated)

- `apps/api/src/events.test.ts:39` — `describe('seam 1: the API relays the Studio extension events to OpenPanel'` → `describe('seam 1: the API relays the extension events to OpenPanel'` (it holds the four public page surfaces and the two YouTube access events; carried from review 1)
- `apps/extension/src/surfaces/shorts.ts:195` — `// Before any read: one Short's figure never sits under another Short's channel name.` → `// Before any read: a tab tile's pill goes once the tile links another Short, and one Short's figure never sits under another Short's channel name.` (the sweep's first line now does the tab's take-down too)

## Needs Further Investigation

### A. Firefox may not filter `tabs.query({ url })` by URL without the `tabs` permission, which would weaken the grant-time injection into open tabs — confirm in the #143 walk: in Firefox, open a www.youtube.com tab, turn on YouTube access, and see pills without a reload and no error in the background console

Carried from review 1, untouched by the delta. `apps/extension/src/entrypoints/background.ts:115-116` is the first Firefox path that queries tabs by URL. If Firefox refuses, `inTurn` swallows the error and no open tab gets the script; if it ignores the filter, `executeScript` is refused on the other tabs and the www.youtube.com ones are still injected.

### B. A live or upcoming search result may get a pill beside "N watching" — confirm with a search save holding a live or scheduled result, then a feed test

Carried from review 1. `apps/extension/src/selectors/feed.ts:49-51` takes the first span of the metadata line whatever it is; the home feed and sidebar withhold a pill from a live tile (`feed.test.ts:331`).

### C. Each in-page move may read the channels and uploads twice, once for the `ahead` pass and once after WXT reports the URL — confirm with a watcher test that counts `read-uploads` across one `urlMovesTo` with a pass between the URL change and `navigated`

Carried from review 1. Reasoning only (`page-watcher.ts:207-218`, `public-pages.ts:50-54`). The new tests' `out` counts of 1 cover only the held-read case, so they do not settle it.

### D. A legacy `/c/<name>` or `/user/<name>` channel URL gets no channel page surface — confirm whether YouTube still serves those without redirecting to `/@handle`

Carried from review 1. `channelTabOf` (`youtube-url.ts:97-106`) accepts only `/@handle` and `/channel/UC…` paths.

### E. A pill on a lockup YouTube reuses as a playlist or Mix lockup during the read is not swept, and on the channel page is never taken down — confirm in the #143 walk whether YouTube reuses a video lockup element as a playlist or Mix lockup across an in-page move (a watch-page sidebar click, where Mix tiles are common)

`videoTilesIn` leaves out playlist and Mix lockups (`selectors/lockup.ts:13-15`), so the sweep and the channel page pass's own clean-up (`channel-page.ts:57-58`, pre-existing at `4c4f424`) never look inside one. The feed's `takeDownAllBut` removes it once the read lands. Finding 1's fix widens the channel page and Shorts sweeps to any lockup ancestor, which narrows this but does not settle it.

### F. A tile whose href is briefly missing while a read is out loses its pill until that read lands — confirm whether YouTube ever blanks a lockup's href during a redraw, with a MutationObserver log on live youtube.com

`public-pages.ts:179`: `idIn(tile)` is undefined for a tile with no href, which never equals the recorded id, so the pill comes down. With no read out the next pass redraws it at once, as before the fix; with a read out (a new navigation, or a re-read after the keep time) it stays off for the read. A flicker, never a wrong figure. Skipping an undefined id would keep the pill, at the cost of not clearing a tile that loses its link for good; not recommended until the behaviour is seen.

## Reviewed and Dismissed

- `drawnFor` drifting from `shown` (`public-pages.ts:143-144, 171-172`) — both are written together on the only draw path, and the same-key keep matches only a host this placer drew, whose key starts with the same id.
- A same-video href variant (`&t=`, `&pp=`) taking a pill down — `videoIdOfLink` keeps only `v` on `/watch` and the path id on `/shorts/`, and the pass and the sweep read through the same function.
- The new Shorts line taking the player pill down — the player pill is in `ytd-shorts` with no `ytm-shorts-lockup-view-model` ancestor; every player test is green with the line first.
- A sweep taking another surface's pill — the selector is `[data-stillstats-surface="<own surface>"]`; lockups the feed and the channel page share are not crossed.
- A pill an older content script drew (after a new grant or an extension update) — it has no `drawnFor` entry, so it comes down at the next tick and the next pass redraws it: one flicker, never a wrong figure.
- The channel page and Shorts sweeps running on pages where their surface is off — functionally harmless (a pill whose tile still links its video stays until the watcher's `removeSurface`); the cost is Finding 1.
- The new tests' never-resolving `through` leaking into the next test — the pending pass cannot resume after `stop()`, so it touches no later DOM; `out` (or `held.out()`) of 1 proves the pass really was held.
- The extension suite's 16 failures in the agent's scratch worktree (`content-list.test.ts`, `page-watcher.test.ts`, `youtube-access-removed.test.ts`, `ENTRYPOINT` undefined in WXT's `custom-events.mjs`) — environmental: the same 16 fail at `4c4f424` in that worktree, and the live worktree's full suite is green.
- Carried from review 1, unchanged by the delta: the Shorts player's transient one-channel-under-another race (`shorts.ts:111-115`); a throw while building pills (`public-pages.ts:59-78`, unreachable); `channelTabOf` checking no host; handle comparison without Unicode normalisation (fails closed); `read-channels` answering `host-access-withheld`; the uploads keep across a sign-in (same as `keptChannels` on `94ba99b`); the relay accepting click events with a public page surface; the feed and Shorts surfaces claiming the same tile; a feed tile naming another channel whose id is the creator's upload; the sender guard. Do not touch any of these.

## Minor / nits

- `drawnFor` repeats the first part of `shown`'s key (`public-pages.ts:143-144`); one `WeakMap<Element, { videoId: string; key: string }>` holds both (standard 3). The watch page's placer (`watch-page.ts:23`) now carries an unused `drawnFor`, harmless.
- The feed sweep parses the URL's page twice, once in `containerOf` and once in `feedPageOf` (`feed.ts:100-103`); `containerOf` returning `{ read, container }` removes one.
- The channel page and Shorts tests each write an inline `holding` / `out` / never-resolving `through` (`channel-page.test.ts:600-608`, `shorts.test.ts:329-337`), where `feed.test.ts` has a `holdUploads()` helper; moving it into `surfaces/testing.ts` gives the three suites one hold.
- Review 1's nits stand unchanged: the tile pass written three times (`channel-page.ts`, `shorts.ts`, `feed.ts`); `channelTabOf` and `shortsTabOf` returning a decoded value only tested for definedness; `public-pages.test.ts:332-345` repeating `:274-292`; `youtube-surfaces.test.ts:119-157` driving two surfaces' `place` at once; `manifest.test.ts:116-131` mostly repeating other tests; `videoIdsSentIn` with no canary test; the feed's `extension_surface_missing` nearly unreachable on `/watch`; a search Short drawn as `ytd-video-renderer` getting no pill; the Shorts tab's clean-up covering only the shown channel page.

## Test quality

Tests added in the delta: 4 cases (`channel-page.test.ts` 1, `feed.test.ts` 1 `test.each` of 2, `shorts.test.ts` 1). Green with the fix's source files put back to `4c4f424`: 0; all 4 go red. Each also goes red when `takeDownRepointed` removes every pill, so the "kept" half is live, and the Shorts case goes red when its line moves after the player check. Tautology shapes found: 0 (no computed expectation, no mocked unit under test, no call-shaped-only assertion, no snapshot). None is recommended for strengthening or deletion. Coverage gaps, no defect found: no case re-points a tile on the home feed (it shares the sidebar's lockup path); no case pins that the Shorts sweep's new line leaves the player pill alone (safe by selector, and the player tests pass); no case re-points a tile at another of the creator's videos during a held read and checks the new pill once the read lands. The whole-branch audit against `94ba99b` is review 1's and is not repeated.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and the full suite green at `6204077`; the browser walk green.
- **Commit hygiene:** commit this doc as `creator-analytics#120 pre-PR review 2`. `repro/` holds nothing this round; the mutation checks ran in a scratch worktree and proved no confirmed finding.
- **Likely reviewer asks:** the #143 walk in real Chrome and Firefox (NFI A, E and F, and Finding 1's cap); #539, since the popup explanation, the privacy paragraph and ADR 0016 still say the creator's ids are sent while the branch sends none; #540 for large channels; the #140 body, #120's "Matching a video to a channel" and user story 27 still describe the channel-link match #520 replaced.

## Verdict

Ready to open the PR, with follow-ups. Gate: none; no CRITICAL, HIGH or MEDIUM finding is open. Of review 1's findings, the one MEDIUM is fully fixed in code and proved by four tests that go red without it; the three LOWs are untouched by scope and carried here as Findings 2 to 4. The confirmed count shrank from 1 MEDIUM and 3 LOW to 0 MEDIUM and 4 LOW, the one new LOW being an unmeasured cost in the fix's own sweep, which is the expected end of a converging branch, not a new problem area. Findings 1 to 4 can ride along or ship as follow-up tickets; NFI A, E and F ride on the #143 walk.
