# Pre-PR review: creator-analytics#2 Web PoC: own-channel dashboard

**Branch:** `creator-analytics-2-web-poc-dashboard` vs `origin/main` (merge-base `6de6c35` "creator-analytics#3: land the marketing site epic")
**Reviewed at:** HEAD `4e0c508` ("creator-analytics#83: say in the privacy policy that thumbnails load from YouTube's image servers on ytimg.com"), clean tree, no uncommitted or untracked files at review time. 168 files, +10,337 / −1,058, 91 commits.
**Reviewed against:** epic nick-vogel/creator-analytics#2 (body as of 2026-10-08) and its 23 closed sub-issues (#42 to #63, #83, #84), `CODING_STANDARDS.md`, `CONTEXT.md`, ADRs 0002, 0003, 0005, 0007. No plan docs and no prior review docs.
**Date:** 2026-10-08
**Reviewer:** 3 code-review agents, 1 test-audit agent, 1 disprove agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | green (253 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green (site and web) |
| Full suite | `pnpm test` (testcontainers Postgres) | green: 50 files, 585 tests. A pg `DeprecationWarning` about concurrent `client.query()` comes from the test harness's `Promise.all` requests on one connection (`apps/api/src/video-list.test.ts:75`), not from production code (no `Promise.all` on a transaction in `apps/api/src`). |
| Tautology audit | Branch tests copied into a scratch worktree at `6de6c35` and run there | 180 tests ran, 119 red, 61 green. Every green one is unchanged, or tests a test-only helper, or is the scrub test whose only edit is a route string in its input. No tautology shapes. |
| OpenPanel referrer | Executed: `node docs/reviews/creator-analytics-2/repro/openpanel-referrer.mjs` against the installed `@openpanel/web@1.4.1` | Confirmed: every event carries `__referrer` (Finding 1) |
| Quota rollback | Executed: `pnpm vitest run --config docs/reviews/creator-analytics-2/repro/quota-rollback.vitest.config.ts` | Confirmed: 2 of 2 red (Finding 2) |
| Null last processed day | Executed: `node docs/reviews/creator-analytics-2/repro/null-last-processed-day.ts` | Confirmed (Finding 3) |
| Web state, routing, chart geometry, CSP, events | Read by agent and verified by reading | Findings 4, 6. Race guard, StrictMode events, URL round trip, chart NaN guards, CSP all hold. |
| Gateway cache keys, revocation before cache, reserve arithmetic, 500-id batching | Read by agent and spot-checked | Hold (see Dismissed) |
| Em-dashes in shipped copy | `git diff 6de6c35 -- apps packages \| grep '^+.*—'` | none |
| OAuth verification notes vs gateway | Read `docs/oauth-verification.md` against `packages/youtube-gateway/src/reads/uploads.ts` | Finding 5 |
| Live Google behaviour | Not run: no live Google call from a review | NFI B |
| Concurrent production load | Not run: the harness runs every scope on one connection | NFI C |

**Overall:** The epic's rules hold almost everywhere: windows, sorts, partial ordering, the format filter, zero fill, refusal codes, cache scoping and the shared types are right and well tested. Two findings break promises the product makes outside the code and gate the PR: product events carry the page's referrer, so a video id and a channel id can reach OpenPanel against the published privacy policy, and an unanswered Google call now rolls back a whole request, losing recorded quota and taking `GET /channels` down. Fix Findings 1 and 2 before the PR opens. Findings 3 to 5 should land in the same PR if cheap. The rest can follow.

## Approach decisions

- **Referrer in events (F1):** stop the referrer at the browser with a referrer policy on the web app's page (`strict-origin`), not by overriding SDK properties. Precedent: the CSP is also a page-level browser policy, pinned by `apps/web/test/web.test.ts`. Not `no-referrer`: under it a browser sends `Origin: null` on a same-origin POST, which an origin check can refuse.
- **Unanswered Google call (F2):** every unanswered call ends the read as the `google_failed` refusal, first call included, so the request transaction commits. Precedent: the existing later-call path in `googleCalls` and its test at `apps/api/src/video-list.test.ts:887-906`. Recording units outside the request transaction is rejected for now (second connection per request, untestable in the savepoint harness).
- **Processing state (F3):** one rule, in the API. The list's rows carry `awaitingProcessing` like the detail answer does, and the web app stops computing it. A null last processed day falls back to the 72-hour delay bound, not to the start of the 90-day search.
- **List screen state (F4):** controls render outside the answer, as on the detail screen, and the rows render only for the list request they answer.

## Confirmed Issues

### 1. Every product event carries the page's referrer, so a tab opened from the app sends a video id and a channel id to OpenPanel — MEDIUM

- **Location:** `apps/web/index.html:3-7` (no referrer policy), `apps/web/src/analytics.ts:10`, claim at `apps/web/src/route.ts:28-31`
- **Attribution:** Introduced. At `6de6c35` the SDK already sent `__referrer`, but the web app's addresses held no id. This branch puts the YouTube video id in the path (`/app/videos/<id>`, #55) and the channel's id in the query (`?channel=<uuid>`, #54), and `RouteLink` (`apps/web/src/RouteLink.tsx:17-20`) lets a modified click open them in a new tab.
- **Real-world trigger:** On a video's detail screen, the creator cmd-clicks "Back to videos". The new tab's `document.referrer` is the full detail address, under the browser's default `strict-origin-when-cross-origin` policy. Every event from that tab (`video_list_viewed`, `video_window_changed`, ...) carries it, reloads included. A creator with two channels who cmd-clicks a video title sends the list address with `?channel=<uuid>`.

**Evidence** — `@openpanel/web@1.4.1` `dist/index.js` constructor and `@openpanel/sdk@1.3.1` `track`:
```js
this.setGlobalProperties({__referrer:document.referrer})
...
properties:{...this.global??{},...i}
```
and the claim it breaks, `apps/web/src/route.ts:28-31`:
```ts
   * The id of the channel the list is for. Absent: the creator's first channel. No product event
   * carries it: the web app's OpenPanel client tracks no screen view, so it sends no path.
```

**Failure mode** — Executed. The repro builds the client as `analytics.ts` does, in a tab whose referrer is a detail address, and sends `video_list_viewed`:
```
{ "__referrer": "https://stillstats.com/app/videos/dQw4w9WgXcQ?channel=0b6f3c1e-...&window=first7", "__path": "" }
LEAK: the event carries the video id and the channel id
```
This breaks epic user story 59 ("no event to carry a video id, channel id, user id or email") and the published privacy policy (`apps/site/privacy.html`, "No event carries a channel ID"). OpenPanel is self-hosted (ADR 0007), so the data stays on Nick's server. Rated MEDIUM, not HIGH, for that reason. It gates the PR because the privacy policy is part of the OAuth verification submission.

**Recommended fix**
```diff
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="referrer" content="strict-origin" />
     <title>Stillstats</title>
```
In `apps/web/src/route.ts:28-31`, the comment's reason changes. No event carries the id because the page sends only its origin as a referrer and the client tracks no screen view.

**Remediation brief**
- **Design intent:** Product events carry only their fixed value. The OpenPanel SDK adds `__path`, empty because no screen view is tracked, and `__referrer`, read once from `document.referrer` when the client is built. The referrer of a same-origin navigation follows the source page's referrer policy. With `strict-origin` the referrer is `https://<host>/`, so no address of the app can carry an id into an event.
- **Full surface:** `apps/web/index.html` (meta tag). `apps/web/src/route.ts:28-31` (comment). `apps/web/test/web.test.ts` (new test beside `the page carries its policy before any script`, line 159). `README.md`, events paragraph: "No event carries a channel id, a user id or an email" gains "a video id" (story 59).
- **Must preserve:** The CSP meta stays first in `<head>`. The CSP plugin injects it `head-prepend` (`apps/web/vite.config.ts`), and the test at `apps/web/test/web.test.ts:159-165` pins that. Do not use `no-referrer`, because it sends `Origin: null` on a same-origin POST. The thumbnail's own `referrerPolicy="no-referrer"` (`apps/web/src/Thumbnail.tsx:26`) stays. No API code reads `Referer` (`grep -rni referer apps/api/src packages/accounts/src` is empty).
- **Do not touch:** `packages/reporter/src/scrub.ts`. GlitchTip masking is a separate path and holds (see Dismissed).
- **Proof:** Red then green: a new test in `apps/web/test/web.test.ts` asserting the served page carries `<meta name="referrer" content="strict-origin"`, run with `pnpm vitest run apps/web/test/web.test.ts`. The repro `node docs/reviews/creator-analytics-2/repro/openpanel-referrer.mjs` documents the SDK mechanism. It stays red after the fix, because it injects the referrer directly.

### 2. An unanswered Google call rolls back the whole request: answered units and cached reads vanish, and `GET /channels` answers 500 — MEDIUM

- **Location:** `packages/youtube-gateway/src/youtube-gateway.ts:207-226` (`googleCalls`), comments at `:44-47`, `:218-219` and `packages/youtube-gateway/src/read-definition.ts:13-16`. Exposed through `apps/api/src/channel-list.ts:16-19`, `apps/api/src/video-list.ts`, `apps/api/src/channel-summary.ts:21-34`, `apps/api/src/video-detail.ts`.
- **Attribution:** Introduced. At `6de6c35`, `read()` made one `spend()` per read, and each route ran at most one Google read per transaction. `GET /channels` made no Google call at all. `answeredCalls` arrived in `4f3ac8f` ("creator-analytics#44: settle the code review"), and the multi-read routes arrived with #44 to #54.
- **Real-world trigger:** A network failure or timeout to Google during a cold read: a DNS or connection blip, or a Google outage. On a cold video list, `uploads` spends its Data units, then `lastProcessedDay`'s first Analytics call gets no answer. In `GET /channels`, any channel's name read gets no answer.

**Evidence** — `youtube-gateway.ts:207-221`:
```ts
  function googleCalls(tx: Scoped<'user' | 'channel'>, clients: Clients): GoogleCalls {
    let answeredCalls = 0
    ...
        // An outage after an answered call ends the read as a refusal, so the transaction commits
        // the earlier calls' units. On the read's first call there are none to keep, and it throws.
        if (!unanswered || answeredCalls === 0) throw error
```
`googleCalls` is built per `read()`, but the transaction is per request (`database.asUser`, one `handle.transaction` in `packages/database` `scopes.ts:62`). `withAuthority` adds no savepoint. The throw reaches `app.onError` and a 500.

**Failure mode** — Executed, both red:
```
REPRO videos: { status: 500, answeredDataCalls: 3, unitsBefore: 2, unitsAfter: 2 }
 × GET /channels/:id/videos cold, Analytics unreachable: Data units Google answered stay recorded
   AssertionError: expected +0 to be 3
 × GET /channels with the name read unanswered: lists the channel (base made no Google call)
   AssertionError: expected 500 to be 200
```
Google charged 3 Data units and none were recorded. The earlier read's cache entry rolls back too, so the retry spends them again. The undercount erodes the 10% reserve without a trace. `GET /channels` going to 500 blanks the signed-in view, Disconnect included, during a Google outage. That contradicts `channel-list.ts:7-8` ("A refused name read still lists the channel"). It is MEDIUM: accounting and availability, with no wrong number shown.

**Recommended fix**
```diff
   function googleCalls(tx: Scoped<'user' | 'channel'>, clients: Clients): GoogleCalls {
-    let answeredCalls = 0
     async function call<T>(api: YouTubeApi, cost: number, run: () => Promise<T>): Promise<T> {
       if (!(await quotaAllows(tx, api, cost))) throw new RefusedCall('quota_reserved')
       let unanswered = false
       const answer = await spend(tx, api, cost, () =>
         run().catch((error: unknown) => {
           unanswered = !answeredByGoogle(error)
           throw error
         }),
       ).catch((error: unknown) => {
-        // An outage after an answered call ends the read as a refusal, so the transaction commits
-        // the earlier calls' units. On the read's first call there are none to keep, and it throws.
-        if (!unanswered || answeredCalls === 0) throw error
+        // An outage ends the read as a refusal, so the request's transaction commits the units of
+        // every call answered before it, in this read and in the request's earlier reads.
+        if (!unanswered) throw error
         // No status, as Google gave none, and no error: its message may carry the call's video ids.
         logger.error(`The YouTube ${api} API did not answer a call`)
         throw new RefusedCall('google_failed')
       })
-      answeredCalls += 1
       if (!answer.answered) throw new RefusedCall('google_failed')
       return answer.value
     }
```
The comment edit is a correction of an existing load-bearing comment, not a new one. Also rewrite `GoogleFailure`'s doc (`:44-47`): "Google answered the call with an error, and the call still spent its quota units. Or Google never answered a call." Rewrite `read-definition.ts:13-16`: "A refused call, an error answer, or an unanswered call ends the read with a refusal."

**Remediation brief**
- **Design intent:** Each Google call checks the reserve, then records its units in `quota_usage` whatever Google answers. A route runs all its reads in one transaction, so any throw out of a read discards every unit and cache row the request wrote. A refusal is a value: the route answers it with its status (`refuse()` in `apps/api/src/signed-in.ts`), and the transaction commits.
- **Full surface:** `packages/youtube-gateway/src/youtube-gateway.ts:44-47, 207-226`. `packages/youtube-gateway/src/read-definition.ts:13-16`. `packages/fake-google/src/index.ts`: add `dropAnalyticsApi(pathname)` beside `dropDataApi` (`:610-612`) and its handler, so the regression tests run in the repo's harness. New tests in `apps/api/src/video-list.test.ts`, next to the dropped-playlistItems test at `:887-906`, and in `apps/api/src/channels.test.ts`. They are the two cases of `docs/reviews/creator-analytics-2/repro/quota-rollback.test.ts`: an answered `uploads` then an unanswered Analytics call keeps the Data units and answers 502 `google_failed`, and an unanswered name read lists the channel with a null title and answers 200.
- **Must preserve:** A thrown error that is not an unanswered Google call (a programming error, a database error) still throws to `onError` and is reported. `quota_reserved` still refuses before the call. `identifyGrant` (`:233-249`) keeps its throw on an unanswered call: its transaction holds no earlier units. The test at `apps/api/src/video-list.test.ts:887-906` stays green. Declared drop: an unanswered first call no longer reaches `app.onError`, so it no longer goes to GlitchTip through the reporter. It is logged by `logger.error`, the same as an unanswered later call and an error answer are today. The gateway's `logger` (`apps/api/src/modules.ts:53`) does not send to GlitchTip. If outages must page someone, that is a separate decision for every `google_failed` path.
- **Failure of the fix:** If `spend`'s own `quota_usage` insert fails, it throws a database error. That is not an unanswered call, so it still throws and rolls back, which is correct: the database is down.
- **Do not touch:** `quotaAllows` reserve arithmetic and the per-call check (see Dismissed). The row-lock question is NFI C, not this fix.
- **Proof:** `pnpm vitest run --config docs/reviews/creator-analytics-2/repro/quota-rollback.vitest.config.ts` is red now and must go green. Then the moved tests: `pnpm vitest run apps/api/src/video-list.test.ts apps/api/src/channels.test.ts`.

### 3. A channel with no processed day marks windows that ended months ago as partial, and the list and the detail screen disagree on "not processed yet" — MEDIUM, capped

- **Location:** `apps/api/src/calendar-range.ts:30-36` (`processedThroughOf`), used by `apps/api/src/window-after-publish.ts:30-41` (`partialOf`) and `apps/api/src/video-detail.ts:35-41` (`isAwaitingProcessing`). A second copy of the rule is in `apps/web/src/video-list.ts:32-47` (`reportingDayOf`, `isProcessed`), pinned by `apps/web/src/video-list.test.ts:92-94`.
- **Attribution:** Introduced in `85a3a0b` ("creator-analytics#48: read windows after publish on the video list and the detail") and `2861ed5` ("creator-analytics#47: settle the code review").
- **Real-world trigger:** `lastProcessedDay` is null when Google answers no channel row by day in the last 90 days. The API type doc (`packages/api-types/src/videos.ts:117-118`) names the case: "a channel with no activity in that time". **Capped at MEDIUM:** upgrade to HIGH if Google omits zero-activity days from a channel `dimensions=day` report and a connected channel had no views for 90 days. Check by running `reports.query` with `dimensions=day&metrics=views` over a quiet channel's last 90 days (NFI B).

**Evidence** — `calendar-range.ts:30-36`:
```ts
/**
 * The last day Google has processed. With no last processed day, Google has processed none of the
 * days its search reaches, so the day before the search.
 */
export function processedThroughOf(lastProcessedDay: string | null, today: string): string {
  return lastProcessedDay ?? addDays(lastProcessedDaySearch(today).startDate, -1)
}
```
and the web copy, `apps/web/src/video-list.ts:44-47`:
```ts
function isProcessed({ publishedAt }: VideoRow, lastProcessedDay: string | null): boolean {
  if (!publishedAt || !lastProcessedDay) return true
```

**Failure mode** — Executed on 2026-10-07 with a null last processed day:
```
processedThroughOf(null) = 2026-07-09
partialOf('first28', '2026-06-29', null) = {"partial":{"days":11,"of":28}}
detail awaitingProcessing for 2026-08-01 = true
```
A video whose first 28 days ended on 26 July lists as "11 of 28 days" and sorts below every complete video. A video published in the last 90 days shows zeros on the list and "YouTube has not processed this video yet" on its detail screen. The comment's premise is also false: null means no activity, not "processed none". Two modules apply one rule with different null handling.

**Recommended fix**
- `processedThroughOf(null, today)` returns `addDays(today, -3)`, the 72-hour bound the epic states ("YouTube processes Analytics data 48 to 72 hours late"). Rewrite its doc comment to say exactly that.
- `VideoRow` in `packages/api-types/src/videos.ts:78` gains `awaitingProcessing: boolean`, documented as in `packages/api-types/src/video-detail.ts:66-70`. The list API computes it with the same `processedThroughOf` rule `video-detail.ts` uses.
- `apps/web/src/video-list.ts` `metricCellsOf` reads `video.awaitingProcessing`. Delete `reportingDayOf` and `isProcessed` there.
- Replace the test `with no processed day, a row shows its numbers` (`apps/web/src/video-list.test.ts:92-94`) with tests on the flag. Add API tests for the null case: a window that ended before `today - 3` is complete, and a video published after `today - 3` is awaiting processing on the list and the detail alike.

**Remediation brief**
- **Design intent:** "Processed through" is the one day that decides three things: whether a window after publish is partial (and how many days it has), whether a video is awaiting processing, and where a partial video sorts. It must be computed once, in the API, and both screens must read the API's answer. `lastProcessedDay` itself stays as Google answered it, null included, because the screens show it as YouTube's day.
- **Full surface:** `apps/api/src/calendar-range.ts:30-36`. `apps/api/src/window-after-publish.ts:25-41`. `apps/api/src/video-detail.ts:35-41`. `apps/api/src/video-list.ts`, where rows are built. `packages/api-types/src/videos.ts:78-100` (`VideoRow`). `apps/api/test/answer-types.ts`, whose row fixtures need the new field. `apps/web/src/video-list.ts:32-47, 197`. `apps/web/src/video-list.test.ts:80-94`.
- **Must preserve:** With a non-null last processed day, every current result is unchanged. `partialOf('first28','2026-09-25','2026-10-04',...)` is 10 of 28. A publish day after the last processed day is awaiting processing. A scheduled video is awaiting processing (`video-detail.ts` doc). A video with no publish date shows its numbers. Partial videos sort below complete ones in both directions. Suites: `apps/api/src/video-list.test.ts`, `apps/api/src/video-detail.test.ts`, `apps/web/src/video-list.test.ts`, `apps/web/src/processing.test.ts`.
- **Do not touch:** The `lastProcessedDay` read's own definition (latest day with a row). Whether it runs early on a quiet channel is NFI B, not this fix.
- **Proof:** `node docs/reviews/creator-analytics-2/repro/null-last-processed-day.ts` exits 1 now and must exit 0. The new API tests go red first: `pnpm vitest run apps/api/src/video-list.test.ts apps/api/src/video-detail.test.ts apps/web/src/video-list.test.ts`.

### 4. The video list keeps the last window's or channel's rows under the new controls while it reads, and a refusal removes the controls — MEDIUM

- **Location:** `apps/web/src/VideoList.tsx:142-163`. The detail screen's refused branch is at `apps/web/src/VideoDetail.tsx:124-136`.
- **Attribution:** Introduced (#52, #53, #54, #57).
- **Real-world trigger:** The creator picks "First 7 days" on a cold cache. A first7 list on a large channel makes several sequential Analytics queries (13 for 1,200 daily uploads). Until it answers, the Window control says First 7 days, the average viewed note shows, and the rows still show lifetime numbers. A channel switch shows the old channel's videos under the new channel's name. Also, any refusal (`quota_reserved`, `google_failed`) replaces the Window, Format and Sort controls with the alert, so the creator can only go back or reload.

**Evidence** — `VideoList.tsx:142-163`:
```tsx
  useEffect(
    () =>
      latestOnly(
        readVideoList(channelId, route),
        ...
      ),
    [channelId, route, navigate],
  )
  ...
  if (!view) return null
  if (view.kind === 'refused') return <p role="alert">{view.message}</p>
```
The effect never clears `view`, unlike `VideoDetail.tsx:99-100` and `ChannelSummaryFigures.tsx:38-40`. It depends on the whole `route`, so a views chart toggle on the channel summary (`route.chart`) re-reads the list for identical data.

**Failure mode** — Verified by reading. A creator can read lifetime numbers as first7 numbers for as long as the read takes, with no sign that the rows are old. It is MEDIUM: a confusing display that corrects itself, not a wrong number that stays.

**Recommended fix** — Follow the detail screen's precedent. Render the controls outside the answer, in every state, refused included. Read the list only on a change of `channelId`, `page`, `window`, `sort` or `format`. Show rows only for the list request they answer: clear the view when that request changes, or store the request's key with the view and render rows only when it matches.

**Remediation brief**
- **Design intent:** A screen never shows a number for a window, sort, format or channel other than the one its controls show. The controls stay mounted while the next answer is read, so keyboard focus stays on the control the creator just used (`VideoDetail.tsx:128`, "Outside the answer, so the control keeps its focus while the next window is read").
- **Full surface:** `apps/web/src/VideoList.tsx:35-43` (`readVideoList` takes the full `Route` and needs only the four list fields), `:132-163` (effect and render), and the controls block below it. `apps/web/src/VideoDetail.tsx:124-136` (refused branch hides the Window control).
- **Must preserve:** The page past the last page is replaced, not pushed (`VideoList.tsx:147-149`). That `navigate` must use the route current when the answer lands, or a chart toggle made during the read is undone. Read the latest route through a ref, or compute `routeWithin` from current values. `video_list_viewed` fires once per list opening (`:136-140`). The `aria-live` sort announcement (`:186-189`). A views chart toggle must not blank or re-read the list. The latest-only guard (`apps/web/src/api.ts:14-27`).
- **Do not touch:** `latestOnly` itself. It is correct (see Dismissed).
- **Proof:** No DOM test tooling exists (epic Testing Decisions), so this is a browser check. 1. Open `/app/` on a cold cache and pick First 7 days: no lifetime row shows under the new control. 2. Toggle Daily and Running total on the summary: the Network panel shows no new `/videos` request. 3. Make the list refuse (stop the API's network to Google) and confirm the controls stay. If a pure helper is extracted (for example the view-matches-request rule), test it in `apps/web/src/video-list.test.ts`.

### 5. The OAuth verification notes say the product calls no Data API method beyond `channels.list`, and that Analytics powers only the channel summary — MEDIUM

- **Location:** `docs/oauth-verification.md:79-87` (`youtube.readonly`), `:91-93` (`yt-analytics.readonly`), demo shot list `:134-150`
- **Attribution:** Introduced. The sentence "It reads no other part of the channel and calls no other Data API method." existed at `6de6c35` and was true there. This branch added `playlistItems.list`, `videos.list` and `channels.list part=contentDetails` (`packages/youtube-gateway/src/reads/uploads.ts:40, 56-61, 78-81`) and edited the paragraph above it in `7bcc070` without correcting it.
- **Real-world trigger:** Nick writes the OAuth verification submission's scope justifications and demo video from this doc. Google's reviewer then reads a justification that omits two Data API methods the app calls, and a demo that shows neither the video list nor the product's own consent screen.

**Evidence** — `docs/oauth-verification.md:87, 93`:
```
It reads no other part of the channel and calls no other Data API method.
...
What it powers: the channel summary. The user picks a window, and the product calls the YouTube Analytics API's `reports.query` with `ids=channel==MINE` and `metrics=engagedViews,views` (the `channelTotals` read ...
```
against `uploads.ts:40, 56, 78`: `channels.list({ part: ['snippet', 'contentDetails'] })`, `playlistItems.list(...)`, `videos.list({ part: ['status'] })`.

**Failure mode** — The scope justification understates what `youtube.readonly` powers: the uploads list (titles, thumbnails, publish dates, scheduled status). The `yt-analytics.readonly` section omits the video list, the detail screen and their reads (metrics, formats, daily rows, retention, traffic sources, subscriber split). The shot list's steps 6 and 10 skip the product's consent screen, which now opens before Google (#56). Step 9 shows only the summary, not the per-video screens.

**Recommended fix** — Rewrite the three sections against the catalogue in `packages/youtube-gateway/src/catalogue.ts` and `packages/youtube-gateway/src/video-detail-catalogue.ts`. Name each Data API method with its parts. Name the Analytics reads by screen. Add the consent screen click to shot list steps 6 and 10, and add a step that opens the video list and a video's detail screen.

**Remediation brief**
- **Design intent:** This doc is the source for Google's sensitive-scope verification. Every Google method and part the product calls must appear under the scope that authorises it, with what it powers, or the submission misstates the app's use of user data.
- **Full surface:** `docs/oauth-verification.md:77-99` (scope sections), `:117-150` (before recording, shot list). Cross-check `apps/site/privacy.html:41-55`, which already lists the uploads list and the per-video analytics.
- **Must preserve:** The narrower-scope arguments (`:89`, `:95`, `:101`) and the Google quotes and links. Approved copy rules apply: no em-dashes.
- **Do not touch:** `apps/site/privacy.html`. Its reads list is accurate (see Dismissed).
- **Proof:** `grep -n "playlistItems.list\|videos.list" docs/oauth-verification.md` returns both. `grep -n "calls no other Data API method" docs/oauth-verification.md` returns nothing. The shot list names the consent screen and the video list.

### 6. A response that is not JSON, or an expired session, shows raw error text — LOW

- **Location:** `apps/web/src/api.ts:4-7`, `apps/web/src/refusals.ts:5-12`
- **Attribution:** Introduced (#52).
- **Real-world trigger:** A deploy or a proxy answers an HTML 502, or the network drops. `response.json()` throws, and `latestOnly` passes `String(reason)` to the screen: "SyntaxError: Unexpected token '<'..." or "TypeError: Failed to fetch". An expired session answers `{error:'unauthenticated'}`, which has no text in `refusals.ts`, so the screen reads "Reading the videos failed: unauthenticated".

**Evidence** — `api.ts:4-7`:
```ts
export async function readAnswer<T>(path: string): Promise<T | RefusalAnswer | ErrorAnswer> {
  const response = await fetch(path)
  return (await response.json()) as T | RefusalAnswer | ErrorAnswer
}
```

**Failure mode** — Verified by reading: `grep -n unauthenticated apps/web/src/refusals.ts` is empty, and `ErrorCode` in `packages/api-types` includes it.

**Recommended fix** — `readAnswer` returns `{ error: 'internal' }` when the answer is not JSON or the fetch rejects. `refusals.ts` gains a text for `unauthenticated` that tells the creator to sign in again. The text needs Nick's approval (epic Copy rule).

**Remediation brief**
- **Design intent:** "A refusal or an error arrives as the answer, not as a throw" (`api.ts:3`). Every screen shows a sentence from `refusals.ts`, never an exception.
- **Full surface:** `apps/web/src/api.ts:4-7`. `apps/web/src/refusals.ts:5-12` and `apps/web/src/refusals.test.ts`.
- **Must preserve:** JSON refusals and error codes keep their current texts (`refusals.test.ts`). `latestOnly` still drops a stale answer.
- **Do not touch:** The API's `onError` answer shape.
- **Proof:** New tests in `apps/web/src/refusals.test.ts` for `unauthenticated` go red first. `pnpm vitest run apps/web/src/refusals.test.ts`.

### 7. The video detail route has no test for another user's channel or a revoked connection — LOW

- **Location:** `apps/api/src/video-detail.test.ts` (refusal block near `:453-483`)
- **Attribution:** Introduced (#47).
- **Real-world trigger:** None today: the route reads through `database.asUser` and the shared gateway, which `apps/api/src/video-list.test.ts` (near `:832`, `:843`) and `apps/api/src/channel-summary.test.ts` (near `:206`, `:253`) test for both rules. A later change to the detail route's wiring would pass unnoticed.

**Evidence** — `grep -n "otherCreator\|not_connected\|connection_revoked\|revoked" apps/api/src/video-detail.test.ts` returns nothing.

**Failure mode** — A missing test on a tenancy rule (ADR 0002): a user must never read another user's channel, and a revoked connection serves nothing even from cache.

**Recommended fix** — Add the two tests, mirroring the video list's.

**Remediation brief**
- **Design intent:** Each of the three new channel routes states the tenancy and revocation rules itself, because each wires its own `asUser` scope.
- **Full surface:** `apps/api/src/video-detail.test.ts`.
- **Must preserve:** The existing detail tests.
- **Do not touch:** Production code. No change is expected.
- **Proof:** New tests pass against the current code. To show they can fail, swap `asUser` for the other creator's id locally and see them go red, then revert. `pnpm vitest run apps/api/src/video-detail.test.ts`.

### 8. Comment hygiene — LOW (aggregated)

- `apps/api/src/window-after-publish.ts:59-61` — "a channel that publishes once a day takes one query for each 73 uploads in first28 ... so 1,200 such uploads take 17 and 13." → add: "A sparse channel costs more per upload: one upload a month for 15 years (180 uploads) takes 60 queries in first28 and 45 in first7, because each group spans at most 100 days."
- `packages/youtube-gateway/src/youtube-gateway.ts:186-189` — "Checked before each Google call, with a plain read and no lock held across the call. Calls in flight at once can overshoot by at most their combined cost, which stays inside the 10% kept back." → "Checked before each Google call, with a plain read. The units another request has recorded but not yet committed are invisible here, so concurrent requests can overshoot by their uncommitted spend, which stays inside the 10% kept back while requests are few."
- `README.md` events paragraph — "No event carries a channel id, a user id or an email." → "No event carries a video id, a channel id, a user id or an email." (if Finding 1's remediation does not already make this edit)

## Needs Further Investigation

### A. Cold windows after publish on a sparse, long-lived channel — measure the load time

`dailyRowsGroupsOf` (`apps/api/src/window-after-publish.ts:63-88`) closes a group at 100 days. Executed by the API agent: 180 uploads, one a month for 15 years, take 60 sequential Analytics queries in first28, more than the 1,200-upload daily channel's 17. Every read runs sequentially in one transaction. The epic says "a handful of Analytics queries whatever the channel size", which this does not meet for sparse channels. The 100-day cap is a deliberate row-size bound, and grouping the whole span in one query would ask Google for every day of every video. To confirm or kill: time a cold `GET /api/channels/<id>/videos?window=first28` against the fake with 180 monthly uploads. If it takes over a few seconds, record the deviation in the epic and consider a per-group row estimate (videos × span) instead of a fixed span.

### B. Does Google omit zero-activity days from a channel `dimensions=day` report?

`lastProcessedDay` (`packages/youtube-gateway/src/reads/last-processed-day.ts:11-29`) takes the latest day with a row. If Google omits days with no activity, a quiet channel's last processed day runs early with a non-null value too. Executed: `partialOf('first28','2026-09-07','2026-09-17','2026-10-07')` gives 11 of 28, so a video can show partial days after its window is fully processed. This also decides Finding 3's cap. To confirm: run `reports.query` with `ids=channel==MINE&dimensions=day&metrics=views` over a range with a known zero-view day on a small channel, and see whether that day has a row.

### C. The `quota_usage` row lock is held for the whole request transaction

`spend`'s `INSERT ... ON CONFLICT DO UPDATE` (`packages/youtube-gateway/src/youtube-gateway.ts:169-175`) locks the `(api, quota_day)` row until the request commits. A cold 1,200-upload list holds the Data row lock across about 49 sequential Google calls, and every other user's Data spend waits on it. The same holds for the Analytics row across a first28 list. Reasoned from Postgres semantics. Not executed, because the harness runs on one connection. To confirm: two concurrent cold list requests for two users against a real pool, and compare the second request's latency alone and in parallel. A fix (append-only unit rows summed in `quotaAllows`, or recording in a separate transaction) needs a schema or connection decision.

## Reviewed and Dismissed

- Revenue consent screen says nothing on storage or retention — story 44 asks only "what revenue data the product reads", and the text is approved word for word in #56 (`apps/web/src/consent.ts:12`).
- `averageViewPercentage` is absent, not null, in windows after publish — `VideoRow.averageViewPercentage?: number` and the API agree, and the epic asks only that the column be left empty.
- Scheduled videos left out of the list by default — documented on `includeScheduled` (`packages/api-types/src/videos.ts:62`) and tested in `apps/api/src/video-list.test.ts` (near `:336`).
- Lifetime collapses to one day when the creation date is null (`apps/api/src/calendar-range.ts:59`) — YouTube always sends `snippet.publishedAt` for a channel. Unreachable in practice.
- Cache leak across channels or windows — `read_cache` is filtered and keyed on `channelId` plus a key holding every request parameter (`youtube-gateway.ts` `read()`). The 500-id reads hash the sorted ids.
- A revoked connection served from cache — `authorityRefusal` runs before the cache select (`youtube-gateway.ts` `read()`).
- Concurrent queries on one transaction — no `Promise.all` in `apps/api/src` production code. The pg warning comes from the tests' own `Promise.all`.
- Quota counted per read, not per call — `googleCalls.call` checks and records per call, and the 1,200-upload test pins 49 Data units.
- Fetch race on window, sort or channel changes — `latestOnly` (`apps/web/src/api.ts:14-27`) drops every stale answer.
- NaN in chart paths — all-zero series scale by 1, and a single day spans the width (`apps/web/src/views-chart.ts`).
- Date labels shifting a day — chart and note dates format as UTC midnight with `timeZone: 'UTC'`.
- Scrub masks a video id only after `/videos/` (`packages/reporter/src/scrub.ts:63-64`) — no error event carries a thumbnail URL or `youtu.be` link today. `Thumbnail.tsx:27` swaps to an empty box on error and reports nothing.
- Retention curve with one point draws nothing — Google answers about 100 points.
- Privacy policy reads list (`apps/site/privacy.html:41-55`) — matches the reads. Average percentage viewed and the subscriber split fall under views and audience retention.
- Deleted `engaged-views.test.ts`, `readout.test.ts` and two revenue consent tests — every rule has a counterpart in `apps/api/src/channel-summary.test.ts` or `apps/web/src/channel-summary.test.ts`.

## Minor / nits

- A page number with more digits than a safe integer: the API answers `"page": null` (`apps/api/src/routes/videos.ts:21-25`), and the web app writes `page=1e+21` (`apps/web/src/route.ts:82`). Use `Number.isSafeInteger`.
- No upper bound on the `playlistItems` loop if Google repeats a page token (`packages/youtube-gateway/src/reads/uploads.ts:54-69`).
- `lastProcessedDay` reads the day by position (`last-processed-day.ts:27`), unlike `recordsOf` everywhere else.
- Fake fidelity: a fixture with `views: 0` gets a content-types row Google would not send (`packages/fake-google/src/reports/video-content-types.ts:18-21`). The fake accepts `sort`, `maxResults`, inverted ranges and more than 50 ids in `videos.list`.
- Duplicates on touched paths (standard 3): the fake's `pacificDayOf` (`reports/report.ts:47-59` and `reports/video-numbers.ts:3-15`), `numbersOverRange` (`reports/video-totals.ts:28-31`), inline `rowsOf` (`video-totals.ts:44`, `video-content-types.ts:31`), two `dailyMetricNamesOf`. The gateway's metrics mapping exists three times (`video-metrics.ts:62-64`, `video-window-summary.ts:13-15`, `channel-metrics.ts:15-17`). `channel-summary.ts:21-34` has no `readChannel` closure where its siblings do. The `connectedCreator`, `noonToday` and `readQuota` test helpers are copied across five API test files. The web app has its own `isOneOf`.
- The channel's creation date comes from two reads, `uploads` and `channelSnippet`, cached separately.
- `apps/api/test/answer-types.ts:46-67`: the `rowWithoutScheduled` fixture also lacks `window`.
- `packages/fake-google/src/fake-google.test.ts` "a report the fake does not support answers 400" asserts six cases in one `toEqual`.
- The Published column formats in the viewer's time zone (`apps/web/src/video-list.ts:94-95`), and every other day is a Pacific reporting day.
- The channel picker sits above the summary on the list only. #54 says "in the header", and it is absent on the detail screen.
- Event timing: `video_list_viewed` fires before the read and on a refusal. `video_detail_opened` fires on `video_not_found`. `consent_screen_continued` fires twice if the connect request fails and the creator retries.
- Web tests with no stated limits (`route.test.ts`, `channel-picker.test.ts`, `channel-summary.test.ts`, `processing.test.ts`, `consent.test.ts`, `refusals.test.ts`, `windows.test.ts`). `route.test.ts:131` overlaps the round-trip table at `:143`.
- `latestOnly` (`apps/web/src/api.ts:14-27`) has no test.

## Test quality

About 230 test declarations added (`test.each` rows add more at runtime). At `6de6c35`, 180 of the branch's new or modified tests ran: 119 red, and every green one is unchanged, tests a test-only helper (`packages/visual-system/test/testing.test.ts`, the new colour helper test), or is the scrub test whose only edit renames a route in its input. Tautology shapes found: 0. No mocks of the unit under test, no call-only assertions, no snapshots, and expected values are typed literals. Weak spots, none a defect:
- `apps/web/src/retention.test.ts:50` builds its expectation from the production `medianY`. Use the literal `M50,50`.
- `apps/web/src/content-security-policy.test.ts:34-50` exercise a matcher written in the test against a value line 31 already pins. Keep as intent, or fold into line 31's test.
- `apps/web/src/video-list.test.ts:92-94` pins the null rule Finding 3 replaces.

## Before opening the PR

- **CI readiness:** lint, typecheck, build and 585 tests green at `4e0c508`. The repro files under `docs/reviews/creator-analytics-2/repro/` pass `biome check`, and the root vitest `include` does not pick them up, so committing them keeps the gate green.
- **Commit hygiene:** commit this doc and its `repro/` folder. Nothing else is uncommitted.
- **Likely reviewer asks:** why GET /channels now calls Google (Finding 2), how the privacy claim on events is enforced (Finding 1), and the sparse-channel query cost (NFI A).

## Verdict

**Not ready as-is; ready after two fixes.** Gate: Finding 1 (referrer in events, against the published privacy policy) and Finding 2 (unanswered call rolls back quota and takes down `GET /channels`). Findings 3, 4 and 5 are MEDIUM and cheap. They are better in this PR, because Finding 5 feeds the OAuth submission and Finding 3 changes an API answer shape the extension (#4) will read. Findings 6 and 7, the nits and NFI A to C can be follow-up tickets. No prior review findings were claimed to be resolved on this branch.

## Remediation, 2026-10-08

Scope: all eight findings ("fix all"). Starting HEAD `fe8d50b`, clean tree. Every commit used `--no-verify`. After the last commit, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test` (51 files, 595 tests) are green.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `95a93e6` product events carry the page's full address as their referrer | red→green: `pnpm vitest run apps/web/test/web.test.ts` (new test `the page sends only its origin as a referrer...`). The repro `openpanel-referrer.mjs` stays red by design: it injects the referrer directly. | 0 (1 comment corrected in `route.ts`) | proved by execution |
| 2 (MEDIUM) | `291f860` an unanswered Google call rolls back the whole request | red→green: `pnpm vitest run --config docs/reviews/creator-analytics-2/repro/quota-rollback.vitest.config.ts` (2 of 2), and the two moved tests in `apps/api/src/video-list.test.ts` and `apps/api/src/channels.test.ts`. Suites: `apps/api`, `packages/youtube-gateway`, `packages/fake-google` green. | 2 (a test's unit count, the fake's interface doc); 3 corrected | fixed; introduced LOW latent (see Known regressions) |
| 3 (MEDIUM) | `3b1d64e` a channel with no processed day marks old windows partial, and the two screens disagree; follow-up `b668dfc` (test typing for `exactOptionalPropertyTypes`) | red→green: `node docs/reviews/creator-analytics-2/repro/null-last-processed-day.ts` exits 0; 3 new API tests red first. A fourth test (no publish date) passes and goes red under a mutated rule. Suites: `video-list`, `video-detail`, `channel-summary`, `apps/web/src` green. | 1 (test's expected-day reasoning); doc comments moved or corrected | fixed; one pre-existing gap open (see Open items) |
| 4 (MEDIUM) | `ad5e74e` the list shows the last request's rows under new controls, and a refusal removes the controls; rework `052ab2f` | Not executable: no DOM test tooling. Verified by two disprove agents. `apps/web` suite, typecheck and lint green. Browser check by Nick, 2026-10-09, local build at `052ab2f`: steps 1 to 3 pass (no lifetime rows under First 7 days; a chart mode change sends no `/videos` request; a blocked list request shows the error and the controls stay). | 0 (2 moved) | first pass: half-fixed and introduced MEDIUM (heading sort lost focus); after rework: fixed |
| 5 (MEDIUM) | `9a7e10b` the OAuth verification notes understate what each scope powers; rework `cefc8c1` | Brief's greps: `playlistItems.list` and `videos.list` present, "calls no other Data API method" absent, shot list names the consent screen and the video list. Every claim checked against the reads by agent. | n/a (doc) | first pass: half-fixed (3 claims wrong); after rework: fixed |
| 6 (LOW) | `6a4b0de` an answer that is not JSON, or an expired session, shows raw error text | red→green: `pnpm vitest run apps/web/src/api.test.ts apps/web/src/refusals.test.ts` (3 red first). | 1 (test file's Limits line, standard 2) | proved by execution. The `unauthenticated` text is approved by Nick, 2026-10-09 (epic copy rule). |
| 7 (LOW) | `01672d0` the video detail route has no test for another user's channel or a revoked connection | New tests pass; both go red when the route answers a refusal as an empty 200 (mutation reverted). | 0 | proved by execution |
| 8 (LOW, comment hygiene) | `3078862` two comments misstate query cost and quota overshoot | Read against the code: 3 per group in first28 (61 + 28 <= 100) and 4 in first7 (91 + 7 <= 100). README entry landed in `95a93e6`. | 0 new; 2 corrected | excluded from verify |

### Known regressions, deferred

- An error thrown inside a read's `run` callback with no `response` (for example a `TypeError` in the callback's own mapping, after Google answered) is now a `google_failed` refusal on a read's first call too, logged as "did not answer a call", with no units recorded. Introduced by `291f860`; on later calls it was already the behaviour. Verdict: "Introduced (LOW, latent) ... today's callbacks use optional chaining throughout, so I found no live trigger." Not reworked because it has no executable proof through the public API, and the fix (classify only a transport `GaxiosError` without `response` as unanswered) needs `gaxios` as a direct gateway dependency at the exact version `googleapis-common` resolves (`instanceof` checks the version). Next round: decide the dependency, then narrow `answeredByGoogle`'s use in `googleCalls`.

### Open items, pre-existing (not introduced this round)

- `apps/api/src/daily-series.ts:24-28` `everyDayOf` still reads a null last processed day as "nothing processed": a null-day video detail answers a complete window (no `partial`) with an empty daily series. The channel summary test `a channel with no processed day in the last 90 days answers ... an empty daily series` (`apps/api/src/channel-summary.test.ts`) pins the empty series, so changing it is a product decision for both screens, outside Finding 3's surface.
- `partialOf` gives a video with no publish day `{ days: 0, of }`, while `isAwaitingProcessing` gives false, so an undated video in a window after publish shows its numbers with a "0 of N days" label.
- `apps/web/src/VideoDetail.tsx:98-104` clears its view in an effect, so one committed render can pair the old window's answer with the new Window control. Finding 4's rework fixed this on the list only; the detail screen should adopt the same request-keyed view.
- The `youtube.readonly` narrower-scope argument in `docs/oauth-verification.md` still argues only for `channels.list mine=true`. It may need a sentence for `playlistItems.list` and `videos.list part=status` (a private video's `status.publishAt` needs the owner's authorization). Kept unchanged per the brief.
- List rework LOW notes from the re-verify: a heading-sort click that is refused loses focus to the alert; after an empty list or a refusal, a control change mounts the empty table for a moment.

### Rework briefs

- Finding 4: achieve rows, notes and pager rendered only from the answer to the current (channel, page, window, sort, format) request, with no committed render pairing an old answer and new controls, and the table headings mounted while the next answer is read so a heading sort keeps focus. Preserve the first fix: controls and aria-live outside the answer, reads only on the five fields, replace-not-push past the last page through the route ref, `video_list_viewed` once, `latestOnly`. Proof: typecheck, lint and `apps/web` suite green, plus a scoped disprove agent (no DOM tooling). Result: fixed.
- Finding 5: achieve three sentences that match the reads: scheduled videos are left out (the web app never sends `includeScheduled`), `videoDailyRows` reads engaged views, views and subscribers gained, `lastProcessedDay` reads all four video metrics. Preserve everything else in the rewrite. Proof: each sentence checked against `video-daily-rows.ts`, `last-processed-day.ts`, `video-metrics.ts` and `apps/web/src/VideoList.tsx` by the scoped agent. Result: fixed.

### Approach decisions (remediation round 1)

- F1 referrer: page-level `<meta name="referrer" content="strict-origin">` in `apps/web/index.html`, pinned beside the CSP test in `apps/web/test/web.test.ts`.
- F2 unanswered call: every unanswered call is the `google_failed` refusal, first call included (mirrors the existing later-call path). The fake's Analytics drop is `dropAnalyticsApi()` with no path argument, like `failAnalytics`, because the Analytics API has one report route.
- F3 processed through: `processedThroughOf` and `isAwaitingProcessing` live together in `apps/api/src/calendar-range.ts`; null falls back to `today - 3`; `VideoRow.awaitingProcessing` mirrors the detail answer's field and doc; the web app only reads the flag. Fake channels reach a null last processed day with `days: {}`, as `channel-summary.test.ts` does.
- F4 list state: a request-keyed view (`JSON.stringify([channelId, page, window, sort, format])` stored with the answer, matched in render) instead of clearing in an effect. The table stays mounted while reading. This supersedes the detail screen's clear-in-effect precedent, which should follow it.
- F6 fetch failures: `readAnswer` maps a rejected fetch or a non-JSON body to `{ error: 'internal' }`; tested with Node's fetch against a local `node:http` server.
