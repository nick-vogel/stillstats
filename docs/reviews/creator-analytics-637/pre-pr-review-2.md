# Pre-PR review: creator-analytics#637 Player follow-ups (#686 slice start, #685 layout room, #684 player loads with the screen)

**Branch:** `creator-analytics-637-player-follow-ups` vs `origin/main` (merge-base `511ab6b` "Merge pull request #681 from nick-vogel/creator-analytics-637-retention-player")
**Reviewed at:** HEAD `c5cce11` ("creator-analytics#684 The video player loads with the video's screen, with no button"). The tree was clean, with no uncommitted or untracked files at review time. 19 files, +758 / −576, 9 commits: #686 (`eb1f876`, merge `ed15cba`), #685 (`2d38d9b`, merge `fb10972`), #684 (`1ccc332`, `b08bdfd`, `c2058f5`, merge `c5cce11`).
**Reviewed against:** the bodies of creator-analytics#686, #685 and #684 (their "What to build" and acceptance criteria are the spec), the epic #637's End state and Implementation Decisions for the invariants these tickets keep, `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, ADR 0019 and the new ADR 0020, and the Approach decisions of `pre-pr-review-1.md` (a different branch of the same epic, whose findings went to the collector #666). Run with `--fresh`: no delta scoping.
**Date:** 2026-11-12
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | pass, 672 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `env -u TEST_DATABASE_ADMIN_URL pnpm test` (Docker up, Testcontainers Postgres) | 163 files, 4,118 passed, 1 expected fail. happy-dom logs "Iframe page loading is disabled" for `youtube-player.test.ts`'s frames, so no test reaches YouTube. |
| Browser walk | `env -u TEST_DATABASE_ADMIN_URL pnpm run test:browser` | pass, "No content security policy violation in 63 steps" |
| #686 slice rule | read `video-player.ts:52-62` and the only caller `AudienceRetention.tsx:161-162`; keyboard (`CursorPlot.tsx:164`) and pointer/touch (`CursorPlot.tsx:235`) reach it with the same index; the live region text is built from the same seconds (`VideoPlayer.tsx:39-43`) | holds: point k gives the floor of point k-1's time, index 0 gives 0, the API sorts points by ratio (`apps/api/src/video-detail.ts:90`) |
| #686 tests discriminate | mutation run in a scratch worktree at HEAD (the test-oracle agent): old 3-second rule, floor of the point's own time, round instead of floor, no millisecond rounding, first point not forced to 0 | every mutant turns tests red (18, 17, 15, 1 and 2 tests); `moveCurve` (0.05, 0.11, 1 on 754 s) separates every rule |
| #685 built CSS | read `app.css:870-912` and the three new `web.test.ts` tests | the gap, the column template and the sticky rule are as the ticket gives them; the sticky media query equals `stackedChartsQuery` |
| #685 sticky fit | arithmetic over `app.css:897-911`: the bar is `position: sticky; top: 0; z-index: 1` (`app.css:553-556`), the property is written on `section.video-detail`, an ancestor of the player | the stuck box fits while the bar stays under 0.4 × window height − 16 px (272 px at the 720 px floor for a Short); the bar's open custom range was not measured (NFI B) |
| #684 removed press | `git grep` for `playerText`, `startsAt`, `startsAtSpoken`, `playerLoaded`, `onLoadPlayer`, `video-player-load`, "Load the video player" | gone from code and current docs; only ADR 0019's historical body, old review docs and the stale repro `repro/player-screen.test.ts` (a nit) still name them. #675's path (the start state) is gone. |
| #684 approved text | diff of `apps/site/privacy.html`, ADR 0020 and ADR 0019's top line against #684's body | word for word, both links and icon includes kept. "Last updated November 12, 2026" was already set at base and is today. |
| Content security policy, `youtube-player.ts` | diff | comment-only changes; no directive or code change |
| Em-dashes in shipped copy | grep of every added line | none |
| Tests at `$BASE` | scratch worktree at `511ab6b`, the 5 changed test files copied in (the test-oracle agent) | 58 tests added or edited; 3 green at base, all negative controls of red positives; `bar-height.test.ts` and `web.test.ts` red on import. See Test quality. |
| Executed repro | `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts docs/reviews/creator-analytics-637/repro/round2-step-creates-player.test.ts` | red: finding 1 |
| Not run | real YouTube (the handshake on the privacy-enhanced host, a blocked IFrame API script), the open custom range's bar height, where Chrome sticks the player | #650's manual walk on staging and Nick's browser pass |

**Overall:** All three tickets do what they ask, and lint, typecheck, build, the suite and the browser walk pass. The slice rule is right on every input and its tests catch every wrong rule tried. One MEDIUM: with no press to gate it, a step from a video that cannot play now creates YouTube's player for the next video before its answer says the screen holds one, which is the one thing #684's acceptance criteria and the new privacy text rule out. Five LOWs follow: a thumbnail that hides a working frame forever when YouTube never reports ready, three browser-walk or test-limit gaps, and a walked-past refactor, plus comment hygiene.

## Approach decisions
- Carried from pre-PR review 1: playback starts only from YouTube's own button (no play method; `seekKeepsPlaybackAsItIs` unchanged); a player error replaces the frame through `cannotPlayLineOf`; the player's state lives in memory only.
- Added here: a screen creates a YouTube player only for a video whose answer has landed. A player that already exists is kept across a step and cues the next video (the recorded #645 assumption, `VideoDetail.tsx:214-218`). Finding 1's fix gates creation on that, in `VideoPlayer`, and keeps the kept-player path as it is.
- Remediation round 1, Finding 1: applied as recorded. `VideoPlayer` holds a `live` state beside `ready`, set by the create effect and cleared by its cleanup, and `showsFrame` is `cannotPlay === null && (video.embeddable !== null || live)`, so only an answer's video (whose `embeddable` is always a boolean) creates a player and a kept player stays across a step's read. `VideoDetail.tsx`'s docblock already said nothing loads from YouTube before an answer holds the player, so it is unchanged. The repro's rule is now a test in `apps/web/src/video-player.test.ts`, with a second for the failed-player path during the read.

## Confirmed Issues
### 1. A step from a video that cannot play creates YouTube's player for the next video before its answer says the screen holds one — MEDIUM
- **Location:** `apps/web/src/VideoDetail.tsx:252-256` with `apps/web/src/VideoPlayer.tsx:85`
- **Attribution:** pre-existing, exposed. At `511ab6b` the same expression was gated by the press: `playerLoaded && (heldPlayerVideo?.id === video ? heldPlayerVideo : head && {...})` (`git show 511ab6b:apps/web/src/VideoDetail.tsx`). With the press gone (`1ccc332`), the path runs with no action by the creator, and #684's acceptance criteria, the comment at `VideoDetail.tsx:216-217` and the new privacy text all say it does not happen.
- **Real-world trigger:** the creator is on a video that does not allow embedding (or whose player failed, e.g. a private video, error 100) and presses "Older video" or "Newer video" to a video whose screen holds no player: a new upload with no retention curve yet, a live stream with no duration, or a video awaiting processing. Until the answer lands, the app loads YouTube's IFrame API script (if not already loaded) and asks youtube-nocookie.com for the next video's embed.
**Evidence**
```ts
const playerVideo: PlayerVideo | null = answer
  ? landedPlayerVideo
  : heldPlayerVideo &&
    (heldPlayerVideo.id === video
      ? heldPlayerVideo
      : head && { ...head, embeddable: null, madeForKids: null })
```
`heldPlayerVideo` is set for any answer that `holdsVideoPlayer`, which does not look at `embeddable`, so a not-embeddable video A holds it. During the step, `cannotPlayLineOf(null, null)` is null (the held error is keyed to A), so `VideoPlayer`'s `showsFrame` (`:85`, `cannotPlay === null`) turns true and the create effect (`:87-115`) calls `createVideoPlayer` for B.
**Failure mode** — proved by `repro/round2-step-creates-player.test.ts`: video-2 not embeddable, step to video-3 with the answer held and its curve emptied; during the read the fake boundary records a player created for `video-3`, and after the answer the box is gone. Received `{ createdDuringRead: ['video-3'], boxAfterAnswer: false }`, expected `{ createdDuringRead: [], boxAfterAnswer: false }`. The existing test `video-player.test.ts:1005` drives the same path (error 100, then a held step) and asserts a live player for video-3 during the read.
**Recommended fix** — in `VideoPlayer`, create a player only for a video whose answer has landed (the step head carries `embeddable: null`, an answer always a boolean), and keep an existing one across a step:
```diff
   const [ready, setReady] = useState(false)
+  const [live, setLive] = useState(false)
   useEffect(() => {
     latest.current = { video, onError }
   })
-  const showsFrame = cannotPlay === null
+  const showsFrame = cannotPlay === null && (video.embeddable !== null || live)
@@
     player.current = created
     follower.current = following
     cued.current = id
+    setLive(true)
     return () => {
       following.stop()
       created.destroy()
       player.current = null
       follower.current = null
       setReady(false)
+      setLive(false)
     }
```
Then update `VideoDetail.tsx:216-217`'s docblock only if it no longer matches, and rewrite the test at `video-player.test.ts:1005` (below).
**Remediation brief**
- **Design intent:** the retention section is one element across a step so the player's frame is never moved or detached (a detached frame reloads). During a step's read the screen is headed from the next video's list row, which says nothing of whether it embeds or is made for kids, so it carries `embeddable: null, madeForKids: null`. A screen loads YouTube only once an answer holds the player (`holdsVideoPlayer`, #684's acceptance criteria, the privacy page). A player that already exists is kept across the read and cues the next video: that is a recorded #645 assumption and stays.
- **Full surface:** `apps/web/src/VideoPlayer.tsx:85` (`showsFrame`), `:87-115` (the create effect and its cleanup); `apps/web/src/VideoDetail.tsx:252-256` (where the null playability comes from, unchanged) and `:214-218` (the docblock); `apps/web/src/video-player.test.ts:1005` (asserts creation during the read and must change); `apps/web/src/video-player.test.ts:961` (a step after a failure shows a player again once the answer lands; must still pass).
- **Must preserve:** a step from a ready player keeps the same player and cues the next video at 0:00 (`video-player.test.ts`, "the previous and next buttons keep the player" cases and `:279`'s window change); the thumbnail shows until ready and the frame is then the only child (`:174`); no `video_player_loaded` for a ready while a step is read before `madeForKids` is known (README's `video_player_loaded` line). Rebuild `:1005` on a path that still exists: render video-2, do not call `ready()`, hold video-3's read, step, call `ready()` on the kept player during the read, release, and expect no `video_player_loaded`.
- **Do not touch:** the kept player cueing the next video during a read (Dismissed: recorded #645 assumption); `madeForKids` falling back to null on the step head (Dismissed below).
- **Proof:** `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts docs/reviews/creator-analytics-637/repro/round2-step-creates-player.test.ts` red now, green after; then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-player.test.ts` and `env -u TEST_DATABASE_ADMIN_URL pnpm run test:browser`.
- **Failure of the fix:** if a render ever hands `VideoPlayer` an answer's video with `embeddable` null, no player is created for it; the thumbnail shows with no cannot-play line. `fake-api.ts:198` and the API both always give a boolean (`packages/youtube-gateway/src/reads/uploads.ts` defaults a missing `embeddable` to true), so no such answer exists today.

### 2. When YouTube's player never reports ready, the thumbnail covers a working frame for good, with no line and no way to play — LOW
- **Location:** `apps/web/src/VideoPlayer.tsx:127-136`
- **Attribution:** introduced in `1ccc332`. At base the press showed the frame with no thumbnail over it, so a frame whose API handshake never finished was still YouTube's plain, playable embed. Related to the open #674 (a failed API script load is never said), which this widens.
- **Real-world trigger:** a content blocker that blocks `https://www.youtube.com/iframe_api` but not the youtube-nocookie.com frame, a network that drops the script, or the privacy-enhanced host not completing the API handshake (an open question for #650). LOW, capped: upgrade to MEDIUM if #650's walk finds the handshake does not complete on youtube-nocookie.com.
**Evidence**
```tsx
{showsFrame && <div ref={frame} className="video-player-frame" />}
{!(showsFrame && ready) && (
  <Thumbnail ... className="video-player-thumbnail" />
)}
```
`ready` is set only in `onReady` (`:98-99`). The thumbnail fills the box (`app.css:941-950`) after the frame, so it is drawn over it and takes its clicks. Before ready the hidden iframe is also still in the tab order behind an `alt=""` image.
**Failure mode** — no `onReady` → the box shows the thumbnail forever, the creator cannot reach YouTube's play button, and chart picks queue a pending cue that never lands while the live region says "Video player at ...". The existing test `video-player.test.ts:174` shows the thumbnail stays until `ready()`; nothing ends it otherwise.
**Recommended fix** — route "the player did not become ready" through the existing failure path: in `youtube-player.ts`, report `onError` with a code the app treats as a failure (for example when the API script's `<script>` fires `error`, and after a fixed wait with no ready), so `cannotPlayLineOf` shows the failure line and the Watch on YouTube link (pre-PR review 1's Approach decision; same mechanism #674 asks for). Fix together with #674.
**Remediation brief**
- **Design intent:** nothing is drawn over YouTube's player once it is ready (Google's overlay rule); before ready the thumbnail stands in. Every player failure shows its line and the Watch on YouTube link through `cannotPlayLineOf` (`video-player.ts:30-37`); codes other than 100, 101 and 150 show the failure text.
- **Full surface:** `apps/web/src/youtube-player.ts:77-89` (`loadIframeApi`, the script element), `:134-150` (the player's creation and events); `apps/web/src/VideoPlayer.tsx:98-104` (events), `:127-136` (render); `apps/web/src/video-player.ts:30-37`; `apps/web/src/fake-youtube-player.ts` (the fake must be able to drive the new failure); #674's body.
- **Must preserve:** the thumbnail over the frame until ready and the frame alone after (`video-player.test.ts:174`); no play call; a pending seek before ready cued on ready (`youtube-player.test.ts:285`).
- **Do not touch:** the pending cue's re-pointing of `frame.src` before ready (pre-PR review 1, Dismissed, from YouTube's widget source).
- **Proof:** a new `video-player.test.ts` case: the fake player fails to become ready (the new failure event), and the box shows `cannotPlayText.failed` with the Watch on YouTube link and no thumbnail-only state.
- **Failure of the fix:** a timeout that fires on a slow but working network would replace a player that was about to be ready; the wait must be long (tens of seconds) and a later `onReady` after the failure must not bring a destroyed player back (`destroyed` in `youtube-player.ts:122`).

### 3. `bar-height.test.ts` says the browser walk checks where the player sticks, and nothing does — LOW
- **Location:** `apps/web/src/bar-height.test.ts:1-4`; the wiring at `apps/web/src/VideoDetail.tsx:525-531`
- **Attribution:** introduced in `2d38d9b`.
- **Real-world trigger:** none for the creator today; the cost is a later regression in the sticky offset (the property written on an element that is not the player's ancestor, a bar measured before it wraps, a player that never sticks) passing every check. Capped at LOW: no user path now.
**Evidence**
```ts
// ... They show the height the hold writes from the height it reads,
// not where a browser then sticks the video player. The browser walk's video player step and Nick's
// browser pass are the check of that (creator-analytics#685).
```
`grep -n -i "sticky\|controls-bar-height" apps/site/test/screenshot/browser-walk.ts` finds only the date range bar's checks (`:3274`, `:3546`, `:3572`, `:3621`). The video player step (`:4085-4200`) scrolls the section to the top and measures the beside, width and gap rules only. No test renders the video screen and reads `--controls-bar-height` on it.
**Failure mode** — a false limits statement under `CODING_STANDARDS.md` 2 ("A test states its own limits"): a maintainer trusts the walk to catch a broken stick, and it cannot.
**Recommended fix** — add to the walk's video player step at 1280 px, for the long video and the Short: scroll so the retention pair's top sits well above the controls bar, then assert the player box's top is within 0.5 px of the bar's bottom + 16 px and its bottom is at or above `innerHeight`. If that is not wanted, change the comment to name only Nick's browser pass.
**Remediation brief**
- **Design intent:** from `(min-width: 60rem) and (min-height: 45rem)` the player sticks 1rem under the sticky controls bar, whose height `holdBarHeightOn` writes on `section.video-detail` as `--controls-bar-height`; until written, `top` is invalid and the player does not stick.
- **Full surface:** `apps/web/src/bar-height.test.ts:1-4`; `apps/site/test/screenshot/browser-walk.ts:4085-4200` (the player step, `scrollToRetention`); `apps/web/src/app.css:897-911`.
- **Must preserve:** the walk's existing beside/above, 40rem and 1.5rem checks; the bar-height unit tests.
- **Do not touch:** the sticky media query (it equals `stackedChartsQuery` on purpose, held by `web.test.ts:1291`).
- **Proof:** the new walk step fails when `top: calc(var(--controls-bar-height) + 1rem)` is changed to `top: 0` in `app.css`, and passes as it stands: `env -u TEST_DATABASE_ADMIN_URL pnpm run test:browser`.

### 4. The walk's "the channel and audience screens ask YouTube for nothing" cannot see the IFrame API script — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:4318-4327`
- **Attribution:** introduced in `b08bdfd`.
- **Real-world trigger:** none today; a regression that loads the API script on another screen without creating a player (an eager `loadIframeApi`) would pass the walk and break the privacy page's "No other page in the app runs a script from YouTube".
**Evidence** — the walk's build sets `VITE_YOUTUBE_IFRAME_API_URL` to `/sample/youtube-iframe-api.js` on the page's own origin (`:149`, `:161`), and `youtubeRequests` (`:339`) records only requests to YouTube's hosts, so the script request is never in it.
**Failure mode** — the step's name claims more than it checks.
**Recommended fix** — in that step, also fail when `document.querySelector('script[src*="youtube-iframe-api"]')` exists or `window.YT` is defined after `ready()`.
**Remediation brief**
- **Design intent:** only `youtube-player.ts` loads the IFrame API, on the first player a page creates, never at import (`youtube-player.ts:1-3`, `:77-89`).
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:4318-4327`; `:149`, `:161` (the fake script's path).
- **Must preserve:** the step's YouTube-host request check.
- **Proof:** temporarily calling `loadIframeApi()` at import of `youtube-player.ts` makes the strengthened step fail; revert, and `env -u TEST_DATABASE_ADMIN_URL pnpm run test:browser` passes.

### 5. The walk no longer checks that nothing moves when the player becomes ready — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:4101` and `:4168`
- **Attribution:** introduced in `b08bdfd`. At base the walk measured the placeholder's box before the press and the frame's after it (`moved(before, after)` at base `:4117`). Now `before` is measured after `loadedFrame` has waited for ready, so `moved(before, shown.rect)` only checks the frame fills its own box.
- **Real-world trigger:** none today; a layout where the thumbnail's box differs from the ready frame's (the thumbnail in flow and taller than 16:9) would pass the walk. `web.test.ts:1198` holds that both fill one box in the built CSS, never in a browser.
**Recommended fix** — hold the frame's request in the walk's YouTube Fetch handler, measure `.video-player` with the thumbnail showing, release, wait for ready, measure again, and fail on `moved(before, after)`.
**Remediation brief**
- **Design intent:** the box is one element before and after ready, so the player shows where the thumbnail stood (`app.css:913-917`, `VideoPlayer.tsx` docblock).
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:4085-4175`, its `loadedFrame` helper, and the YouTube Fetch listener near `:330-345`.
- **Must preserve:** the step's 1280, 2560 and 375 px runs and their width, gap and 200 by 200 checks.
- **Proof:** making `.video-player-thumbnail` `position: static` in `app.css` fails the new check; reverted, `env -u TEST_DATABASE_ADMIN_URL pnpm run test:browser` passes.

### 6. The player boundary's start time is always 0 now, and was left in place — LOW
- **Location:** `apps/web/src/youtube-player.ts:23` (`startSeconds` option) and `:34` (`cue`'s `startSeconds`); callers `apps/web/src/VideoPlayer.tsx:95` and `:122`
- **Attribution:** introduced in `1ccc332`: the press's start time was the only non-zero caller, and both callers now pass the literal `0`.
- **Real-world trigger:** none; a walked-past refactor under `CODING_STANDARDS.md` 3 on a module the change touched (`youtube-player.ts`'s header).
**Recommended fix** — drop the `startSeconds` option and `cue`'s parameter, and cue and frame at 0 inside the boundary; the internal seek-on-a-stopped-player path keeps passing its time to `cueVideoById` directly (`:165`, `:174`). Leave it if Nick prefers the boundary's interface frozen for #650.
**Remediation brief**
- **Design intent:** `youtube-player.ts` is the one module that talks to YouTube; its interface is cue, seek, read time and state, and the events.
- **Full surface:** `apps/web/src/youtube-player.ts:20-36`, `:91-97` (`frameSourceOf`), `:111-175`; `apps/web/src/fake-youtube-player.ts`; `apps/web/src/VideoPlayer.tsx:93-96`, `:122`; `apps/web/src/youtube-player.test.ts` cases that pass a start.
- **Must preserve:** a seek before ready cues at the seek's time on ready (`youtube-player.test.ts:285`); a seek on a stopped player cues at the time.
- **Proof:** `pnpm typecheck` and `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/youtube-player.test.ts apps/web/src/video-player.test.ts` pass.

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:899-900` — "which sticks at the top over everything below it, so the bar is never drawn over the player" → "which sticks at the top over everything below it, so while the player sticks the bar is not drawn over it"
- `apps/web/src/app.css:904` — "which leaves at least 17rem above it for the bar and the 1rem" → "which leaves at least 18rem above it, 17rem for the bar and 1rem under it"
- `apps/web/src/ControlsBar.tsx:46-47` — "The channel screen passes a `ref`, which the video list's heading rows read to sit under the bar." → "The channel screen passes a `ref`, which the video list's heading rows read to sit under the bar, and the video screen one, whose height the video player sticks under (`bar-height.ts`)."
- `apps/web/test/web.test.ts:1263` — test title "..., while the pair's plots keep the section's gap (creator-analytics#685)" → drop "while the pair's plots keep the section's gap", which the body does not assert (the #648 test at `:1231` does).

## Needs Further Investigation
### A. "No other page in the app runs a script from YouTube" after an in-app move away from a video's screen — once a video's screen has loaded the IFrame API, the `<script>` and `window.YT` stay in the single-page app's document when the creator moves to the channel or audience screen. The privacy text is approved word for word; whether it holds depends on whether a loaded but idle API script "runs", and whether it makes requests. Confirm on #650: after a video's screen, navigate in-app to the channel screen and watch the network panel and `window.YT`; if YouTube's scripts make requests there, put the question to Nick.
### B. The open custom range's bar height — the sticky player's foot is hidden when the controls bar is taller than 0.4 × window height − 16 px (272 px at 720 px tall for a Short). The comment's 94 px is the closed bar. Measure the bar at 960 px wide with "Custom range" open and its error line showing; if it comes near 272 px, cap the Short's height by the bar in the sticky query.
### C. Two readies from one player — if a step re-points `frame.src` before ready while the first frame's ready message is in flight, YouTube's widget might report ready twice, sending two `video_player_loaded` and a duplicate cue. Pre-PR review 1 read `www-widgetapi.js` and found the handshake re-polls per load; confirm on #650 by stepping during the first load and counting `video_player_loaded` in OpenPanel's debug view.

## Reviewed and Dismissed
- A ready while a step is read never sends `video_player_loaded`, even when the answer then says not made for kids (`VideoPlayer.tsx:98-101`) — deliberate and documented in the README's `video_player_loaded` line, and pinned by `video-player.test.ts:1005`.
- `move` tracks and announces a seek when no player exists (`VideoPlayer.tsx:39-43`) — unreachable: `onMove` is passed only when `playerVideo && cannotPlay === null` (`VideoDetail.tsx:302`), and the create effect sets `player.current` before any chart can be used.
- The kept player cues the next video during a step's read, before its answer — a recorded #645 assumption (pre-PR review 1, Dismissed); the player goes when the answer lands. Finding 1 keeps it.
- The step head's `madeForKids: null` sends no event — the safe direction for the made-for-kids rule.
- `video_player_loaded` once per `YT.Player`, so a step in the same player sends none — matches "once each time YouTube's player reports ready"; a new player after an error sends again.
- StrictMode's double effect — the first player is destroyed before `loadIframeApi().then` runs, so `destroyed` blocks its `YT.Player` (`youtube-player.ts:134-135`).
- The millisecond rounding before the floor (`video-player.ts:61`) — Google's two-decimal ratios and whole-second durations never land within half a millisecond under a whole second.
- `--controls-bar-height` unset before the first write — `top` is invalid at computed time, falls back to `auto`, and the player does not stick, as `app.css:902-903` says.
- `holdBarHeightOn` without `ResizeObserver` — baseline since 2020, and `heading-hold.ts` already depends on it.
- `web.test.ts:1298` builds its expected `top` from `controlsBarHeightProperty` — that is the rule: the stylesheet's name must match the TypeScript constant.
- The walk's seek check computes its expectation with `playerSecondsAt` (`browser-walk.ts:4040`) — stated at `:4004-4007`; the unit tests hold the rule, as the mutation run shows.

## Minor / nits
- `docs/reviews/creator-analytics-637/repro/player-screen.test.ts:56-58`, `:112`, `:130` still assert the removed press ("Starts at 1:20", "Video player starts at 0:05."); not in the suite's include, and the historical red of pre-PR review 1's finding 3, now moot with #675.
- `web.test.ts:1279-1288` builds its expected column template from the sheet's own `.video-player` `max-width`, so the 40rem cap is pinned only by the walk's `640.5` (`browser-walk.ts:4128`); `expect(valueIn(own, '.video-player', 'max-width')).toBe('40rem')` would pin it.
- `video-player.test.ts:192` "sends video_player_loaded once each time the player reports ready" drives one ready only; a second player after an error and a step would show "each time".
- `video-player.test.ts:220`'s three negative cases could also assert the head's Watch on YouTube link, so a screen that renders nothing cannot pass.
- `scrollToRetention` puts the section's top at 0, under the sticky bar, and the walk's `inside` check ignores the bar (`browser-walk.ts:4070` area); pre-existing.
- `apps/web/src/thumbnail.ts:23` says "The video player placeholder's thumbnail width"; consistent with CONTEXT.md's Player placeholder term.

## Test quality
Tests added or edited: 58 (49 in `video-player.test.ts`, 5 in `web.test.ts`, 4 in `bar-height.test.ts`; `app.test.ts` and `components.test.ts` change setup only). Green against `$BASE`: 3, all one parameterised negative control, `video-player.test.ts:220` "shows no player box and asks nothing of the player boundary for a video with %s", paired with `:152`, red at base. `bar-height.test.ts` and `web.test.ts` are red on import at base; with `bar-height.ts` stubbed in, the four new or changed #685 and #684 CSS tests are red and the relaxed #648 test at `:1231` is green, its removed pins having moved to the new red tests. The #686 tests were proved by mutation (What was verified). Tautology shapes: none vacuous, no mocked unit under test, no snapshot, no assertion-free test, no copy test; happy-dom's limits are stated in each file's header, one of them falsely (finding 3).

## Before opening the PR
- **CI readiness:** lint, typecheck, build, the suite and the browser walk pass at `c5cce11`. `repro/round2-step-creates-player.test.ts` is linted by `pnpm lint` and runs only under `repro/vitest.config.ts`, never in CI.
- **Commit hygiene:** commit this doc and `repro/round2-step-creates-player.test.ts` together; nothing else is in the tree.
- **Likely reviewer asks:** #684 asks to close #675 if this change removes its path, and it does (the start state is gone); close it with that reason. The privacy page's "Last updated November 12, 2026" holds only if the PR merges today. #650's walk now also carries NFI A to C and finding 2's upgrade condition.

## Verdict
Ready to open the PR, with follow-ups. Finding 1 (MEDIUM) should be fixed on this branch before the PR opens: it is small, has a red repro, and it is the one place the code contradicts #684's acceptance criteria and the privacy text Nick approved. Findings 2 to 6 are LOW and can be fixed here or ticketed (2 belongs with #674); 7 is one comment batch.

## Remediation, 2026-11-12

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `9ae94f7` creator-analytics#684 pre-PR review 2 finding 1: a step from a video that cannot play created YouTube's player for the next video before its answer said the screen holds one | red then green: `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts docs/reviews/creator-analytics-637/repro/round2-step-creates-player.test.ts`, and two new tests in `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-player.test.ts` ("a step from a video not embeddable to one whose answer holds no retention curve asks nothing of the player boundary, during the read or after it", "a step from a video whose player failed creates no player while the next video is read, and one once its answer holds the player"), both red before the fix and green after (68 passed) | 0 | proved by execution |
| 2 (LOW) | deferred | none | none | LOW tail, out of scope this round |
| 3 (LOW) | deferred | none | none | LOW tail, out of scope this round |
| 4 (LOW) | deferred | none | none | LOW tail, out of scope this round |
| 5 (LOW) | deferred | none | none | LOW tail, out of scope this round |
| 6 (LOW) | deferred | none | none | LOW tail, out of scope this round |
| 7 (LOW, comment hygiene) | deferred | none | none | LOW tail, out of scope this round |

The test at `video-player.test.ts:1005` ("a ready while a step is read sends no video_player_loaded, ...") drove the path the fix removes (error 100, then a ready on a player created during the read), so it was rebuilt as the brief says: video-2's player is not made ready, video-3's read is held, the step cues the kept player, and a ready during the read sends no `video_player_loaded`. A mutation of the made-for-kids gate (`madeForKids !== true`) turns it red. After the fix: `pnpm lint` (673 files), `pnpm typecheck` and `pnpm build` green; `env -u TEST_DATABASE_ADMIN_URL pnpm test` green, 163 files, 4,120 passed, 1 expected fail (2 tests more than the review's run); `env -u TEST_DATABASE_ADMIN_URL pnpm run --if-present test:browser` green, "No content security policy violation in 63 steps". No verify agent ran: the finding is MEDIUM, its proof was executed red then green, and the fix touched no shared computation core.

### Known regressions, deferred

- none

### Rework briefs

- none
