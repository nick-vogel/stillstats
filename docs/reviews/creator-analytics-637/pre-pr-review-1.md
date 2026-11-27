# Pre-PR review: creator-analytics#637 Retention chart: an in-app player that plays the part you click

**Branch:** `creator-analytics-637-retention-player` vs `origin/main` (merge-base `ceaabc2` "Merge pull request #661 from nick-vogel/release-2026.11.11.3")
**Reviewed at:** HEAD `6126d7f` ("creator-analytics#649 Videos that cannot play, and videos made for kids"). The tree was clean, with no uncommitted or untracked files at review time. 44 files, +3,775 / −182, 22 commits: the five landed child tickets #645, #646, #647, #648 and #649, each a lane commit plus its merge, the review-pass fix commits `3583126`, `65713ac` (#645), `20bbc11`, `3bbafa3`, `61a3633`, `b9f01ef` (#646), `4b4f7b8`, `a09ccd0` (#647), and the merge of `origin/main` at `37660fa`.
**Reviewed against:** the epic body of creator-analytics#637 (its End state, User Stories, Implementation Decisions and Testing Decisions are the spec) and the grill decisions in its first comment; the bodies of sub-issues #645 to #649 (open, In Review) and #650 (the manual walk on staging, open, carried by no commit here); the recorded assumptions and Nick's buffering decision in each ticket's run notes; `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, ADR 0007, 0014, 0015 and the new 0019. No prior review of this branch (`--fresh`).
**Date:** 2026-11-12
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 653 files |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 159 files, 4,065 passed, 1 expected fail. happy-dom logs "Iframe page loading is disabled" for each player frame: it refuses the frame's page, so no test reaches youtube-nocookie.com. |
| Browser walk | `pnpm run --if-present test:browser` | pass, "No content security policy violation in 62 steps" |
| Fake player out of the production build | read `apps/web/test/web.test.ts:2057`, which builds into its own directory and asserts `https://www.youtube.com/iframe_api` present and `youtube-iframe-api.js` absent; `grep -rn` of `apps/web/src` for YouTube's hosts and `window.YT` | holds; only `youtube-player.ts` (and its type in `vite-env.d.ts`) touches the player |
| Content security policy | read `packages/visual-system/src/content-security-policy.ts` and its tests | `script-src 'self' https://www.youtube.com`, `frame-src https://www.youtube-nocookie.com`, nothing else changed, no unsafe source, nonce or hash; the referrer policy in `apps/web/index.html:6` stays `strict-origin` |
| Approved text | diff of `apps/site/privacy.html`, ADR 0019, `CONTEXT.md`, `README.md` against #645, #646 and #649 | the three privacy replacements, both Google links, ADR 0019, the glossary entries and both events in the README list are in place; "Last updated November 11, 2026" was already that date at base, the day #645 landed |
| Em-dashes in shipped copy | grep of every added line under `apps/`, `packages/`, `CONTEXT.md`, `README.md`, `docs/adr/` | none |
| Made-for-kids rule | read `VideoPlayer.tsx:156` and `VideoDetail.tsx:265-268` | both events go only when `madeForKids === false`; an unknown value during a step sends nothing |
| The seek rule | read `youtube-player.ts:107-109,164-175` against Nick's buffering decision on #646 | matches in every state: `seekTo` while playing, paused, or buffering after anything but a pause; a cue at the time otherwise |
| Tests green at `$BASE` | scratch worktree at `ceaabc2`, the 11 new or changed test files copied in, run there | 2 added or changed tests green at base, both negative controls of red positives; 4 files red on import (new modules). See Test quality. |
| Executed repros | `pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts` | 4 tests, all red: findings 1, 2, 3 and 4 |
| Not run | the real YouTube player, the privacy-enhanced host under the real policy, a real private video, and YouTube's actual state events after a seek | #650's manual walk on staging, per the epic's Testing Decisions |

**Overall:** Every End-state item of the epic is implemented, and lint, typecheck, build, the suite and the browser walk all pass. The policy exception is as narrow as the spec asks, the fake player stays out of the production build, and the seek rule matches Nick's decision. This round confirms no CRITICAL, HIGH or MEDIUM finding. Six LOWs remain, all introduced on this branch and each cheap: two teardown and failure gaps in the player boundary, two keyboard and start-time edges on the screen, and two browser-walk checks weaker than the rules they stand for. The PR can open as it is; the LOWs can be remediated in-branch or ticketed.

## Approach decisions
- Playback starts only from YouTube's own button: the boundary has no play method, and a seek on a stopped player cues the video at the time (#645 prep and #646 prep assumptions; Nick's buffering decision on #646). Fixes below add no play call and keep `seekKeepsPlaybackAsItIs` as it is.
- A player error replaces the frame with the line and the Watch on YouTube link through `cannotPlayLineOf` (`video-player.ts:43`); any code other than 100, 101 and 150 shows the failure text (#649 prep). Finding 2's fix routes a failed script load through that same path, as one more code.
- The press, the start time and the held error live in memory only, in `useVideoPlayerMoves` and `VideoDetail`'s state (#645 and #646 prep). Finding 3's fix keeps them there.

## Confirmed Issues
### 1. A player removed after YouTube's API loads but before the player is ready is never destroyed on YouTube's side — LOW
- **Location:** `apps/web/src/youtube-player.ts:121,134-151,182-187`
- **Attribution:** introduced, `b038d9f` "creator-analytics#645 The video player behind the player placeholder" (`git log -S'player?.destroy()' ceaabc2..HEAD`). The file is new.
- **Real-world trigger:** the creator presses "Load the video player" and, before YouTube reports ready, leaves the screen, steps to a video with no curve, or the answer lands with `embeddable` false. Each removes the frame. LOW: nothing visible goes wrong; YouTube's widget object and its window `message` listener stay alive for the page load. Upgrade to MEDIUM if #650's walk shows the widget keeps polling the removed frame (watch the Performance panel's timers after a quick leave).
**Evidence**
```ts
let player: YouTubePlayer | undefined
...
const created = new YT.Player(frame, { events: { onReady: () => { player = created ...
...
destroy() { destroyed = true; player?.destroy(); player = undefined; frame.remove() }
```
**Failure mode** — `player` is set only in `onReady`, so a destroy between `new YT.Player` and `onReady` calls no `destroy` on the YouTube player. If `onReady` still fires, it cues and calls `events.onReady` on a destroyed wrapper. Proved: `repro/player-boundary.test.ts` "finding 1" loads the API, destroys, and expects the fake player's `destroy` once; it gets 0 calls.
**Recommended fix**
```diff
   let player: YouTubePlayer | undefined
+  let created: YouTubePlayer | undefined
   let destroyed = false
@@
   void loadIframeApi().then((YT) => {
     if (destroyed) return
-    const created = new YT.Player(frame, {
+    const made = new YT.Player(frame, {
       events: {
         onReady: () => {
-          player = created
+          if (destroyed) return
+          player = made
           if (pendingCue) player.cueVideoById(pendingCue)
@@
       },
     })
+    created = made
   })
@@
     destroy() {
       destroyed = true
-      player?.destroy()
+      created?.destroy()
+      created = undefined
       player = undefined
       frame.remove()
     },
```
**Remediation brief**
- **Design intent:** `youtube-player.ts` is the one module that talks to YouTube (ADR 0019). It builds the frame itself, hands it to `YT.Player`, and answers no call until `onReady`. The screen destroys it on unmount, on a player error, and when the screen stops holding a player; destroy must tear down whatever YouTube object exists, ready or not.
- **Full surface:** `apps/web/src/youtube-player.ts:121-151` (the create), `:182-187` (destroy); a new test in `apps/web/src/youtube-player.test.ts` beside "a player destroyed before the API loads never becomes a YouTube player" (`:336`).
- **Must preserve:** a destroy before the API loads creates no YouTube player (`youtube-player.test.ts:336`); a destroy after ready calls YouTube's `destroy` once and removes the frame (`:325-334`); the pending cue on ready ("a cue before YouTube's player is ready points the frame at the next video ...", `:166`). `player` stays undefined until ready, so `currentTime`, `state`, `cue` and `seekTo` keep their before-ready behaviour.
- **Do not touch:** the frame's `src` change in `cue` before ready (Reviewed and Dismissed, "a cue before ready re-points the frame").
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts -t 'finding 1'` is red now and must pass; then move the case into `youtube-player.test.ts` with its harness and run `pnpm exec vitest run apps/web/src/youtube-player.test.ts`.

### 2. When YouTube's API script fails to load, the screen never says so, and every chart seek is announced and counted though nothing moves — LOW
- **Location:** `apps/web/src/youtube-player.ts:75-89,134`; seen through `apps/web/src/VideoPlayer.tsx:42-46`
- **Attribution:** introduced, `b038d9f` (`git log -S'script.src = iframeApiUrl' ceaabc2..HEAD`). The file is new.
- **Real-world trigger:** a content blocker or a network that blocks `https://www.youtube.com/iframe_api` but not the frame, or a press while offline. LOW, capped: no default browser setting is known to block the loader. Upgrade to MEDIUM if #650's walk, or a common blocker list (uBlock Origin's defaults, Brave Shields), blocks the script; check by pressing the button with each on.
**Evidence**
```ts
iframeApi ??= new Promise((resolve) => {
  ...
  const script = document.createElement('script')
  script.src = iframeApiUrl
  document.head.append(script)
})
```
**Failure mode** — the promise has no reject and no `onerror`, and it stays memoised. The plain embed frame still shows (its `src` is set at creation), but `player` never becomes ready: each seek waits in `pendingCue` for good, the playhead never shows, and no error reaches the screen. Meanwhile `move` in `useVideoPlayerMoves` sees a loaded player, so the live region says "Video player at 1:20." and `video_player_seeked` is sent for a seek that never happened. A later player on the page reuses the dead promise, so nothing retries. Proved: `repro/player-boundary.test.ts` "finding 2" dispatches `error` on the script and expects `onError`; it is never called.
**Recommended fix**
```diff
+export const iframeApiFailed = -1
+
 function loadIframeApi(): Promise<YouTubeNamespace> {
-  iframeApi ??= new Promise((resolve) => {
+  iframeApi ??= new Promise((resolve, reject) => {
     const previous = window.onYouTubeIframeAPIReady
     window.onYouTubeIframeAPIReady = () => {
       previous?.()
       if (window.YT) resolve(window.YT)
     }
     const script = document.createElement('script')
     script.src = iframeApiUrl
+    script.onerror = () => {
+      iframeApi = undefined
+      script.remove()
+      reject(new Error('YouTube IFrame API script failed to load'))
+    }
     document.head.append(script)
   })
   return iframeApi
 }
@@
-  void loadIframeApi().then((YT) => {
+  void loadIframeApi().then(
+    (YT) => {
       if (destroyed) return
       ...
-  })
+    },
+    () => {
+      if (!destroyed) events.onError?.(iframeApiFailed)
+    },
+  )
```
Add `-1` to the `onError` doc comment's code list (`youtube-player.ts:17`) as the module's own code for a script that did not load.
**Remediation brief**
- **Design intent:** a player error reaches the screen through `events.onError`, `VideoPlayer`'s `onError`, and `useVideoPlayerMoves`'s `fail`. `cannotPlayLineOf` then shows "The video player could not load this video." with the Watch on YouTube link for any code outside 100, 101 and 150, removes the frame (which destroys the player), and drops `onMove` from the plots, so no further seek is announced or sent. A failed script must take that path, and must not stay memoised, so a later press can retry.
- **Full surface:** `apps/web/src/youtube-player.ts:17` (the code list), `:75-89` (`loadIframeApi`), `:134-151` (the create); a new test in `apps/web/src/youtube-player.test.ts`; an app-level case in `apps/web/src/video-player.test.ts` beside the "another error code" case of the cannot-play section, which needs the fake player (`apps/web/src/fake-youtube-player.ts`) to fire `onError(-1)` as it fires any code.
- **Must preserve:** the script loads once for every player the page creates while it succeeds (`youtube-player.test.ts`, "loads YouTube's IFrame API script once, however many players the page creates", `:97`); the chained `previous?.()` call to an earlier `onYouTubeIframeAPIReady`; a destroy before the load creates no player; codes 100, 101 and 150 still show the not-embeddable text (`video-player.test.ts`, the cannot-play section).
- **Failure of the fix:** a script that loads but never calls `onYouTubeIframeAPIReady`, or a player that never reports ready, still hangs with no error. This fix does not cover that case; a ready timeout would, and it is out of scope here.
- **Do not touch:** `seekKeepsPlaybackAsItIs` and the seek rule (Approach decisions).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts -t 'finding 2'` is red now and must pass; then `pnpm exec vitest run apps/web/src/youtube-player.test.ts apps/web/src/video-player.test.ts`.

### 3. A start time set before the press comes back when the creator steps away and back to the video — LOW
- **Location:** `apps/web/src/VideoPlayer.tsx:38-39,48`
- **Attribution:** introduced, `61b2ee1` "creator-analytics#646 A chart click, a tap, Enter or Space moves the video player" (`git log -S'start?.videoId === videoId' ceaabc2..HEAD`).
- **Real-world trigger:** before the press, the creator clicks a plot (the placeholder says "Starts at 1:20"), steps to the older video, then back. The line says "Starts at 1:20" again, and the press starts the player there. After the press, the same old start is used if the player is recreated for that video, for example after a step through a video with no curve. LOW: the time shown is one the creator did set on that video, so nothing plays wrongly, but it breaks the rule the hook's own comment states.
**Evidence**
```ts
const [start, setStart] = useState<{ videoId: string; seconds: number } | null>(null)
const startSeconds = start?.videoId === videoId ? start.seconds : null
```
**Failure mode** — a step only hides the start, because it is filtered by video id rather than cleared. The hook's comment (`VideoPlayer.tsx:30-35`) says "which a step to another video drops", and the #646 assumption says the new video starts at 0:00. Proved: `repro/player-screen.test.ts` "finding 3" clicks at 1:20 on video-2, steps to video-3 (no line), steps back, and gets `['Starts at 1:20']` where it expects none.
**Recommended fix**
```diff
 export function useVideoPlayerMoves(videoId: string, loaded: boolean, sendsEvents: boolean) {
   const player = useRef<Player | null>(null)
   const [start, setStart] = useState<{ videoId: string; seconds: number } | null>(null)
+  const [startVideoId, setStartVideoId] = useState(videoId)
+  if (startVideoId !== videoId) {
+    setStartVideoId(videoId)
+    setStart(null)
+  }
   const startSeconds = start?.videoId === videoId ? start.seconds : null
```
**Remediation brief**
- **Design intent:** the start time is a moment on one video's curve, held in memory only, until the press creates the player at it. A step to another video drops it for good. A date-range change keeps the same video id, so it keeps the start.
- **Full surface:** `apps/web/src/VideoPlayer.tsx:36-53` (`useVideoPlayerMoves`); a test in `apps/web/src/video-player.test.ts` beside "a step to another video drops the start time" (`:853`).
- **Must preserve:** "the press creates the player at the start time" (`video-player.test.ts:845`); "a step to another video drops the start time" (`:853`); the held player error per video (`error`/`playerError`, a recorded #649 assumption), which this fix leaves alone.
- **Do not touch:** the held error's "last error only" shape (Reviewed and Dismissed).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts -t 'finding 3'` is red now and must pass; then `pnpm exec vitest run apps/web/src/video-player.test.ts`.

### 4. After Enter moves the player, Home on the first point (or End on the last) reads nothing to a screen reader — LOW
- **Location:** `apps/web/src/ChartSlider.tsx:130-131`
- **Attribution:** introduced by `61b2ee1`, which added `say` (`git log -S'activate && selection !== null' ceaabc2..HEAD`). The stay-on-point rule is older (#374); this branch's new announcement breaks the assumption it rests on.
- **Real-world trigger:** a keyboard and screen reader user presses Home, then Enter (the region says "Video player starts at 0:05."), then Home again to hear the point's values. Nothing is read. LOW: the user can step away and back to hear them.
**Evidence**
```ts
const stays = selection !== null && sameAs(selection, next)
if (reading && (!stays || spoken === '')) {
  group.announce(reading, plotId)
}
```
**Failure mode** — the rule assumes a non-empty region already holds the point's values. After `say`, it holds the player's sentence instead, so a step that stays reads nothing. Proved: `repro/player-screen.test.ts` "finding 4" expects the second Home to read what the first did ("Watching 100%" and the rest); the region still says "Video player starts at 0:05.".
**Recommended fix**
```diff
     const stays = selection !== null && sameAs(selection, next)
-    if (reading && (!stays || spoken === '')) {
+    if (reading && (!stays || spoken !== announcementAfter(group.announcement, reading).text)) {
       group.announce(reading, plotId)
     }
```
Update the comment above it (`:125-128`) to say a step that stays reads its values unless the region already holds them.
**Remediation brief**
- **Design intent:** each plot's live region reads a key step's values; a step that stays on its point reads them again only when the region does not already hold them, so Home on the first point never repeats itself (#374). The region can now also hold the player's sentence (`say`, #646), which is not the point's values.
- **Full surface:** `apps/web/src/ChartSlider.tsx:125-132`, and the hook's doc comment at `:54-56` ("a step that stays while the region holds the point's values reads nothing again", still true after the fix); a test in `apps/web/src/video-player.test.ts`'s keyboard cases.
- **Must preserve:** the #374 rule, Home on the first point with the region holding its values reads nothing again; the tests in `apps/web/src/cursor-plot.test.ts` and `apps/web/src/app.test.ts` that pin it; the live region text after Enter ("Video player at 1:20." / "Video player starts at 1:20.").
- **Do not touch:** Enter and Space falling through to the page when no point is shown (a recorded #646 assumption).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-637/repro/vitest.config.ts -t 'finding 4'` is red now and must pass; then `pnpm exec vitest run apps/web/src/cursor-plot.test.ts apps/web/src/app.test.ts apps/web/src/video-player.test.ts`.

### 5. The browser walk's Short check passes any height from 200px up to 60% of the window — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:4171-4177`
- **Attribution:** introduced, `e6c7789` "creator-analytics#648 The video player beside the retention pair, and a 9:16 frame for a Short".
- **Real-world trigger:** a later change to the Short's width rule (`app.css`, `width: min(100%, calc(60vh * 9 / 16))`) shrinks the frame, say to 200 by 356 at 1280 by 800. The walk stays green, though #648 asks for a frame that stops at about 60% of the window height. LOW: a test claims more than it checks.
**Evidence**
```ts
short.aspectRatio !== '9 / 16' ||
short.height > 0.6 * view.height + 0.5 ||
short.height < 200 ||
```
**Failure mode** — the check is one-sided. At both walk widths the box should be exactly 60% of the window height (480px at 1280 by 800, about 487px at 375 by 812), but any height from 200px up passes. Proved by the condition itself: no clause fails for a height between 200 and `0.6 * view.height`.
**Recommended fix**
```diff
-            short.height > 0.6 * view.height + 0.5 ||
+            Math.abs(short.height - Math.max(200, 0.6 * view.height)) > 1 ||
             short.height < 200 ||
```
**Remediation brief**
- **Design intent:** the walk measures in Chrome what happy-dom cannot: the Short's box is 9:16, its height is capped at about 60% of the window, it is at least 200 by 200, and it is centred in its column. At both walk windows the column is wide enough that the cap binds, so the height should equal it.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:4171-4181` (the condition and its error message).
- **Must preserve:** the 200px minimum and the centring clauses; the step's `finally` that disables Fetch and restores the viewport.
- **Proof:** `pnpm run test:browser` must pass after the change. To see it go red, set `.video-player-short`'s `width` in `apps/web/src/app.css` to `200px` in a scratch worktree and run the walk there.

### 6. The browser walk never checks that a tap moves the player once, or that a finger scroll does not — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:1902-1972` (the "state: retention charts tap" and "state: retention charts touch drag" steps)
- **Attribution:** introduced, by `61b2ee1`, which changed how `CursorPlot.tsx` handles a tap's follow-up click on every cursor plot and cites the walk as its evidence, but left these steps asserting only the hover card.
- **Real-world trigger:** a change to Chrome's compat click after a tap, or to `keepTouchFromLibrary` in `CursorPlot.tsx`, makes a tap pick twice (two seeks and two `video_player_seeked` events) or makes a pan pick. The happy-dom tests (`video-player.test.ts:662-674`) model the browser's events, so they stay green. LOW: a gap in the one real-browser check of the touch path.
**Evidence**
```ts
await tapAt({ x, y })
await cardStaysAt(sliders, valueNow, `A tap beside retention point ${valueNow}`)
const to = await across(watching, 0.85)
await dragFrom({ x, y }, to.x)
await cardStaysAt(sliders, valueNow, 'A finger scroll that starts on a retention chart')
```
**Failure mode** — `grep -n "Starts at" apps/site/test/screenshot/browser-walk.ts` finds nothing; the only player move the walk checks is a mouse click at 1280px (`clickMovesPlayer`, `:4130`).
**Recommended fix** — these steps run before the press, so after `tapAt` read the placeholder's "Starts at" line (`.video-player-load p`) and the plot's live region, and assert they name the tapped point's time (its ratio times the sample's duration, less 3, rounded, as `clickMovesPlayer` computes it). After `dragFrom`, assert both are unchanged.
**Remediation brief**
- **Design intent:** a finger picks on its own `pointerdown`, the click the browser follows a tap with stops at the plot in the capture phase, and a pan (pointercancel) picks nothing (#646 implement assumption, review pass 4 finding 1). Only Chrome shows whether its real event sequence matches that model.
- **Full surface:** `apps/site/test/screenshot/browser-walk.ts:1952-1970` (touch drag), and optionally `:1902` (the tap step); `clickMovesPlayer` at `:3952` for the time formula to reuse.
- **Must preserve:** both steps' existing card checks (#390, #396); the touch emulation reset in each `finally`; the walk's rule of finding elements by role and name, with a class only inside a role-found element (as the playhead check does).
- **Proof:** `pnpm run test:browser` must pass. To see it go red, remove `stopTapClick` from `keepTouchFromLibrary` in `apps/web/src/CursorPlot.tsx` in a scratch worktree and run the walk there.

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/VideoPlayer.tsx:58-60` — "...and the player goes with the box. The player drives the playhead on the retention plots" runs to 144 characters on one line → rewrap the doc comment at 100.
- `apps/web/src/video-player.test.ts:8` — the header line "...`web.test.ts` holds to 9:16 in the built CSS. The playhead tests drive..." runs to 136 characters → rewrap at 100.
- `apps/api/src/video-list.ts:87` — "A read of every upload, a query a batch of `uploadBatchesOf`, as one map by video id." (133 characters) → "A read of every upload, one query for each batch `uploadBatchesOf` gives, as one map by video id. A video Google answers no row for is absent.", wrapped at 100.
- `apps/site/test/screenshot/browser-walk.ts:3918-3919` — "at 1280px and at 375px, the video player's placeholder sits above the audience retention pair" → "beside the audience retention pair at 1280px and above it at 375px" (#648 moved it).
- `apps/site/test/screenshot/browser-walk.ts:1342-1343` — "Every sample video has a duration, so its retention pair sits beside the video player and each name ends with the sentence on moving it" → "Every video the retention steps open has a duration and can play, so each name ends with the sentence on moving the video player" (the sample's oldest video is not embeddable since #649, and "beside" holds only from 60rem).
- `apps/web/src/CursorPlot.tsx:266` — "Named again beside the click: Enter and Space there do what the click does." → name the reason the handler is repeated after the `{...slider.plotProps}` spread (biome's `a11y/useKeyWithClickEvents`, if that is it: confirm by deleting the line and running `pnpm lint`), so a reader does not delete it as a duplicate.
- `apps/web/test/web.test.ts:2001` — test name "which the policy's script-src 'self' would block" → "which the policy's script-src, admitting no inline script, would block" (script-src now also names YouTube's host).
- `apps/site/test/site.test.ts:576` — test name "which the policy's script-src and style-src 'self' would block" → "which the policy's script-src and style-src, admitting no inline code, would block".

## Needs Further Investigation
### A. A private video shows the "Load the video player" button — the epic's Implementation Decisions say a privacy status the player cannot play shows the not-embeddable text before the press, but #649 asks only for `embeddable` false, and the web app reads no `video.privacy` from the detail answer (`grep -rn "\.privacy" apps/web/src` finds only the list's marker). Today a private video gets the button, the press loads YouTube and sends `video_player_loaded`, and only error 100 brings the text. The epic's Further Notes leave an owner's own private video to #650's walk. Confirm on #650 whether YouTube plays a private video to its signed-in owner in the embed; if it does not, add `privacy` to `cannotPlayLineOf` (`apps/web/src/video-player.ts:43`) and its caller `VideoDetail.tsx:270-272`.
### B. The walk's new Fetch listener can end the process on a CDP error and leak Chrome — `browser-walk.ts:3937` and `:3944` call `void send('Fetch.fulfillRequest' ...)` and `void send('Fetch.failRequest' ...)` with no catch (none at base), and `send` rejects on any CDP error. A request cancelled before the answer (a navigation during the frame's load) would make an unhandled rejection, which ends Node before the walk's `finally` kills Chrome and closes the stub. Confirm by forcing the race (navigate away inside the listener before answering) in a scratch worktree; if it holds, add `.catch` to both calls that records the error in the step.
### C. The 19-minute hang in flaky-3 — the walk's CDP `send` (`apps/site/test/screenshot/take-screenshot.ts`, untouched here) has no timeout, and a closed socket rejects no pending call, so an unanswered command waits forever with no output. Pre-existing and untouched; confirm by timing out each `send` and running the walk until the hang recurs. Follow-up ticket material against `creator-analytics#310`.
### D. The comment on Google's defaults — `packages/youtube-gateway/src/reads/uploads.ts:70-73` says a missing `embeddable` is true and a missing `madeForKids` false per the videos resource page, checked 2026-11-11. Not re-checked here (no fetch). Read https://developers.google.com/youtube/v3/docs/videos; if the page states no default, reword the comment to say these are the app's defaults, matching the spec.
### E. The playhead after a chart seek on a paused player — `playhead.ts` reads the time while playing and once per later state change. If YouTube reports no state change after a `seekTo` on a paused player, the line stays at the old time while the player sits at the new one. #650's real-YouTube walk shows which; if it stays, read the time once after each seek in `useVideoPlayerMoves.move`.

## Reviewed and Dismissed
- `madeForKids` falls back to false when videos.list answers no video at all (`uploads.ts:173`) — such an upload has no duration (`durations.get` is unset), and `holdsVideoPlayer` (`video-player.ts:80-88`) shows no player without one, so no player event can be sent for it.
- The held player error keeps only the last error — a recorded #649 implement assumption ("until another error replaces it").
- After the press, a step to a video whose list row has no duration cues the kept player at it until the answer lands — a recorded #645 prep assumption; the player goes when the answer lands.
- Before the press, the placeholder leaves during a date-range re-read — a recorded #645 fix pass 2 assumption.
- `playerThumbnailSizes` still says 40rem though the box is a column from 60rem — a recorded #648 assumption: 40rem stays a true upper bound, so the cost is bytes, and the `thumbnail.ts` comment says "at most".
- The embed URL carries `start=` beyond `enablejsapi` and `origin` — the first cue at the start time works with no API call, and `youtube-player.test.ts` pins it.
- A cue before ready re-points the frame's `src` — #645 fix pass 1's fix (F1.1), from YouTube's widget source.
- The touch click stopped in the capture phase on every cursor plot, not only the retention pair — no other app handler listens for it (`CursorPlot.tsx:218-221` is the only native click or pointerdown listener in `apps/web/src`), and the walk's real-Chrome stacked-chart tap step still passes.
- `video-format.ts:37`'s "no batch holds the video" branch — unreachable, as the #648 assumption says: `videoDetail` refuses an id the channel does not hold before it gets there. A type guard, kept.
- The `video-list.ts` refactor into `video-format.ts` and `uploadBatchesOf` — same slices, same order, and `apps/api/src/video-list.test.ts` is unchanged and passes.
- Adding `https://www.youtube.com` to `script-src` widens the `worker-src` fallback — a dedicated worker must be same-origin, so no worker can load from YouTube.
- The built-CSS tests in `web.test.ts` that read the stylesheet's values (9:16, 60vh, 200px) — the epic's Testing Decisions name these Built CSS tests; the walk measures the layout.
- The madeForKids gate during a step — `VideoDetail.tsx:268` passes `sendsEvents` false for an unknown value, and `VideoPlayer.tsx:156` checks `=== false`.

## Minor / nits
- Holding Enter on a plot seeks, and sends `video_player_seeked`, once per key repeat (`ChartSlider.tsx:107`); `event.repeat` could be ignored. Shift+Space and Ctrl or Cmd+Enter on a plot with a point shown are taken too.
- A seek before ready replaces the pending cue, so if the creator started playback in the plain frame before YouTube's handshake, `onReady`'s cue stops it (`youtube-player.ts:167`). Narrow window, and nothing plays wrongly.
- The cue effect lists `video.title` as a dependency but returns early for the same id, so a frame title follows a rename only on the next step (`VideoPlayer.tsx:130-135`).
- `apps/api/src/video-detail.test.ts:446` builds `embeddable: false, madeForKids: true` into an upload it never reads back, and pins the order of the Google calls where the rule is their count.
- The `uploads:v5` cache-key bump has no test showing a v4-shaped entry is not read as v5; the version comment is the only guard, as with v1 to v4.
- No built-page test reads `frame-src` on the site or the web app; the shared `contentSecurityPolicyOf` test covers the value.
- `web.test.ts:2057`'s marker scan cannot fail, since nothing in `apps/web` imports the walk's fake; the URL assertions carry the rule.
- `youtube-player.test.ts:163` proves "no play method" by method names matching `/play/i`.
- `video-player.test.ts:347-349` asserts the box's only child's class string for "nothing drawn over the player".
- `apps/api/src/window-after-publish.ts:118-119` keeps its own batching loop, which a generic `batchesOf` beside `uploadBatchesOf` could serve; a walked-past refactor one module off the path.
- The walk's Fetch patterns match `http://` YouTube URLs that its listener then leaves paused (`browser-walk.ts:3934`); theoretical.

## Test quality
Tests added or changed: about 125 (24 in `youtube-player.test.ts`, about 65 in `video-player.test.ts`, the rest across 9 files). Green against `$BASE`: 2, both negative controls of red positives: `apps/api/src/video-detail.test.ts:446` (the detail makes no extra Google call; pairs with `:720`, `:757`, `:767`, `:777`) and `packages/visual-system/test/content-security-policy.test.ts:82` (no unsafe source, nonce or hash; pairs with `:52` and `:61`). Four files are red on import at base (`app.test.ts`, `components.test.ts`, `video-player.test.ts`, `youtube-player.test.ts`), which is weaker evidence than an assertion going red. Tautology shapes: none vacuous; the unit under test is never mocked (`video-player.test.ts` mocks only the boundary, and says so in its header); no snapshots and no assertion-free tests. A few cases build their expected value with the production helper (`youtubeWatchUrlOf` at `video-player.test.ts:923`, `:940`, `:955`, and the joined `playerText` line at `:153-155`), so a wrong URL builder or join would pass there; each is backed elsewhere by a literal or by the walk. The nits list the call-shaped and class-string cases.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite pass at `6126d7f`. The repros in `repro/` are linted by `pnpm lint` and run only under their own config, never in CI.
- **Commit hygiene:** commit this doc and `repro/` together. Nothing else is in the tree.
- **Likely reviewer asks:** #650's manual walk is still open, and NFI A, D and E fold into it; the privacy policy says "Last updated November 11, 2026", the day #645 landed on this branch, so if Nick reads "the day this ticket lands" as the merge to main, the date moves when the PR merges.

## Verdict
Ready to open the PR, with follow-ups. No CRITICAL, HIGH or MEDIUM finding gates it. Findings 1 to 4 are small fixes in the web app with red repros ready under `repro/`, and 5 and 6 tighten the browser walk; each can be remediated on this branch before the PR or filed as a ticket. NFI A and E belong to #650's walk; NFI B and C are walk robustness, and C is pre-existing.
