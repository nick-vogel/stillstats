# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `d311ad1` ("creator-analytics#219 Content list: the engaged views pill pushes Studio's views over the date and wraps onto two lines"), clean tree, no uncommitted or untracked files at review time. 135 files, +21,216 / −160 (7,965 of those lines are the saved Studio HTML fixtures, 1,095 are `pnpm-lock.yaml`, and 1,667 are pre-PR reviews 1 to 4 with their `repro/`), 335 commits.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-14) and its sub-issues, with #216, #217, #218, #219 and #220 read in full along with the run's recorded assumptions for each; `CODING_STANDARDS.md`, `CONTEXT.md` (Comparison row, Content list, Video's analytics page), ADR 0008; pre-PR review 4 (Approach decisions, NFIs, dismissals, Minor). Run with `--fresh`: the whole branch, with extra scrutiny on what landed since review 4 (`b1b387c`, the HEAD review 4 read): #216 (Google outages during a token refresh or a connect), #217 (review 4's six proven LOWs), #218 (the comparison row over the same days since publish), #219 (the Content list figure under Studio's number) and #220 (the analytics tile).
**Date:** 2026-10-14
**Reviewer:** 3 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (440 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` (writes both extension builds) | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 106 files, 2,176 tests |
| Prior repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | review 1's 6 and review 4's 2 green (review 4's Findings 1 and 2 hold fixed); review 3's "finding 2" red since `d5ad807` (#218), a stale fixture (Finding 3); this review's 2 red (Finding 1) |
| Manifest permissions | Read the built `apps/extension/.output/{chrome,firefox}-mv3/manifest.json` | hold: host access to `https://studio.youtube.com/*` and `https://stillstats.com/*` only, no `permissions`, no `externally_connectable`, no `web_accessible_resources`; Firefox gecko id `@stillstats`, 140.0, `authenticationInfo` required, `technicalAndInteraction` optional |
| Only the background calls the API | Agent grep of the source and the built content script | holds: `fetch(` only in `product-api.ts`, imported by value only by `entrypoints/background.ts`; the built content script has none |
| Message trust | Agent read of `background.ts` and the manifests | only `runtime.onMessage`, no `onMessageExternal`, no `externally_connectable`: no web page can message the background |
| Channel separation in the background cache | Agent ran the real `product-api.ts` for the same ids on two channels inside 30 s; then a mutation of the cache key | the code holds (second read goes to the other channel); the mutation survives all 401 extension tests (Finding 2) |
| Em-dashes in shipped copy | `git diff 5d4457d -- apps/site apps/web apps/extension/src packages README.md CONTEXT.md docs/adr docs/deploy.md apps/api \| grep -c '^+.*—'`; agent grep of `.output/` | 0; none in either built extension |
| "Ranking by views" in the extension | `grep -rni 'ranking by views' apps/extension/src` outside tests | none |
| #216: every token endpoint and connect outage | Agent read of `requestToken`, `identifyGrant`, the gateway's `read` catch, gaxios 7.3.1's `_defaultAdapter` | reads: a stalled body, a non-JSON 200 and a 5xx each end `google_failed` with earlier units committed; `invalid_grant` unchanged; connect: an unanswered `channels.list` lands on `google_failed`. The connect callback's code exchange does not (Finding 1) |
| Connect callback code exchange outage (Finding 1) | Executed: `repro/review-5.test.ts`, both cases | red at HEAD: the browser stops on `/api/channels/connect/callback?...` with a 500; green with the recommended diff applied in a scratch worktree (with `apps/api`, `token-vault`, `youtube-gateway`, `apps/web` suites 1,504/1,504 green, typecheck and biome green) |
| #218: N, the window and each upload's first N days | Agent read of `window-after-publish.ts:54-71` plus executed tables of `windowCovering` (0 to 1,000 days) and `reportingDayOf` (12 cases over both 2026 DST changes, 07:59Z/08:00Z and 06:59Z/07:00Z) | holds: `engagedViewsByDay` is dense from the publish day (a missing day is 0), so the first N entries are the first N days; both sides count from `scheduledFor ?? publishedAt`; window choice and Pacific day correct. One unit-level edge (NFI D) |
| #217: page line and give-up | Agent trace of `watch.ts` and `content-list.ts`, executed probe | holds as recorded; one cosmetic one-pass reappearance (Minor) |
| #219 / #220 | Agent read of `render.ts`, `content-list.ts`, `analytics.ts` | Studio's own styles untouched (shadow host and shadow sheet only); every analytics state renders; the link carries `window`. Real layout is NFI A |
| Tautology audit | Tests changed since `b1b387c` copied into a scratch worktree at `b1b387c` and run there; targeted mutations of HEAD | 100 new or changed: 53 red at runtime, 20 red at import, 27 green (21 renames, 6 each turned red by a mutation). No unkillable test. Details under Test quality |
| Firefox's data declaration | Agent fetched extensionworkshop.com's "Firefox built-in data consent" page (rung 4, the vendor's own docs) | NFI B, carried from review 1 |
| Live browsers (Chrome and Firefox layout of the Content list figure and the analytics tile, `Intl` output, `sendResponse` on a closed channel) | Not run: no browser in a review | NFIs; #99, #101, #200 |

**Repro command for every executed proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-5.test.ts` from the repo root. The repro files sit outside the root `vitest.config.ts` include pattern, so `pnpm test` stays green while they are red. This review added the root config's `globalSetup` (`packages/database/test/global-setup.ts`) and `hookTimeout` to `repro/repro.vitest.config.ts`, because Finding 1's repro drives the real API against Testcontainers Postgres. The repro imports the workspace's test helpers by relative path, since `docs/` resolves no `@creator-analytics/*` package.

**Overall:** All four CI checks pass, and #216 to #220 each do what their issue asked, with tests that go red without the fix. This fresh whole-branch pass found no CRITICAL, HIGH or MEDIUM defect. It confirmed one LOW gap in #216's class (a Google outage at the connect callback's code exchange still ends as a raw 500), one LOW test gap on the rule that one channel's numbers never show on another's page, one stale review repro, and one aggregated comment hygiene entry. The PR can open as it stands.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210):** the give-up judges the navigation WXT reported, held in `nav`; a pass on a URL WXT has not reported yet places for the next navigation (`ahead`) and reports nothing. #217 adds: `giveUp` sets `nav.reached` when `url() === nav.url`.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default.
- **Row sweep (review 3 F1, #215):** an optional synchronous `sweep(document)` on `Surface`, run from `schedulePass`'s timer outside the pass lock. #217 adds: the page line comes down in `sweep` at once only while a read for another key is out (`readingKey`), and otherwise after two empty passes counted in `place`, with `passAgain()` for a settled list.
- **Comparison retry (review 3 F2, #215, #218):** a card figure whose format read did not answer is kept like a line; a format read counted to an earlier day than the figure's that gives no place is asked again as `'unread'`.
- **Comparison window (#218):** the API does not change; the format read runs in `windowCovering(N)`, the shortest window after publish covering N, and the extension sums each upload's first N entries of `engagedViewsByDay`; N is the card video's own array length in that answer.
- **Content list figure (#219):** out of flow inside the extension's own shadow root (`position: absolute`, `top: 1lh`, `inset-inline-end: 0`), with "engaged views" as visually hidden text; nothing of Studio's styled.
- **Google call bound (#214, #216):** one per-call bound, `googleCallTimeoutMs` (10 s); a token endpoint that does not answer, stalls on its body, or answers 5xx is a `TokenEndpointUnansweredError`, which the gateway's `read` maps to `google_failed` and logs as "Google's token endpoint did not answer a call". **New here (Finding 1):** the vault's `completeConsent` maps the same error to a `google_failed` consent refusal, and the connect callback logs the same line, mirroring `identifyGrant`'s outage mapping one call later in the same flow.

## Confirmed Issues

### 1. A Google outage at the connect callback's code exchange ends as a raw 500, not the `google_failed` landing — LOW
- **Location:** `packages/token-vault/src/token-vault.ts:683-689` (`completeConsent`'s catch), `packages/token-vault/src/token-vault.ts:130` (`ConsentRefusal`), `apps/api/src/app.ts:248-249` (the connect callback)
- **Attribution:** pre-existing, exposed. At `5d4457d` the same catch is at `token-vault.ts:641-646` (`git show 5d4457d:packages/token-vault/src/token-vault.ts | grep -n -A3 'GoogleRefusedGrantError)'`), so a token endpoint 5xx at the code exchange already ended as a 500, and a held one hung with no bound. #214 (`2add977`) turned the hang into a 500, and #216 (`0b465bc`, merged as `b9be21e`) made both cases a `TokenEndpointUnansweredError` and mapped it to `google_failed` for reads and for the connect's `channels.list`, but not here, one call earlier in the same flow. #216's issue named only `channels.list` for the connect, so this is the class it fixed, left open on its sibling call.
- **Real-world trigger:** Google's token endpoint answers 5xx, or does not answer within 10 s, at the moment a creator returns from Google's consent screen to connect a channel or give revenue consent. Rare (a Google outage), and the creator can start again; nothing is stored or lost. LOW because the outcome is a confusing page, not wrong data.

**Evidence**
```ts
      } catch (error) {
        // A code Google will not redeem is a consent that did not complete.
        if (error instanceof GoogleRefusedGrantError)
          return { ok: false, refusal: 'consent_denied', intent }
        throw error
      }
```
`apps/api/src/app.ts:248` calls `vault.completeConsent` inside `database.asUser` with no catch, so the error reaches the API's error handler.

**Failure mode** — `repro/review-5.test.ts`: sign in, `api.google.failTokenEndpoint(503)` (or `holdTokenEndpoint()` with a 500 ms bound), then the connect flow. The browser stops on `/api/channels/connect/callback?code=...&state=...` with `500 {"error":"internal"}` instead of redirecting to `/app?connect_error=google_failed`, where the web app already says "YouTube did not answer. Start the connection again." (`apps/web/src/landing.ts:53`; the revenue landing's words are at `:64`). GlitchTip records an internal error for a Google outage.

**Recommended fix**
```diff
--- a/packages/token-vault/src/token-vault.ts
-export type ConsentRefusal = 'state_invalid' | 'consent_denied' | 'scopes_missing'
+export type ConsentRefusal = 'state_invalid' | 'consent_denied' | 'scopes_missing' | 'google_failed'
@@ completeConsent
         if (error instanceof GoogleRefusedGrantError)
           return { ok: false, refusal: 'consent_denied', intent }
+        if (error instanceof TokenEndpointUnansweredError)
+          return { ok: false, refusal: 'google_failed', intent }
         throw error
--- a/apps/api/src/app.ts
       const consent = await vault.completeConsent(tx, c.req.query())
-      if (!consent.ok) return refusedLanding(consent.intent, consent.refusal)
+      if (!consent.ok) {
+        if (consent.refusal === 'google_failed')
+          logger.error("Google's token endpoint did not answer a call")
+        return refusedLanding(consent.intent, consent.refusal)
+      }
```
Then move the two repro cases into `apps/api/src/connect.test.ts`, beside "a connect whose channels.list Google holds open past the bound lands on google_failed and stores nothing" (`:153`), with the same timeout comment shape, and add the log assertion that test makes. Audited: the diff removes no line; `refusedLanding` keeps every other refusal's path; `ConsentLandingRefusal` (`packages/api-types/src/refusals.ts:43-51`) already admits `google_failed`, and no other code switches on `ConsentRefusal` (`git grep -n ConsentRefusal -- apps packages`). Applied in a scratch worktree: both repro cases green, typecheck, biome and the `apps/api`, `packages/token-vault`, `packages/youtube-gateway` and `apps/web` suites (62 files, 1,504 tests) green. The fix's own failure: a code-exchange error that is not `TokenEndpointUnansweredError` (a malformed 200 token response missing `refresh_token` or the ID token subject) still throws to the error handler, as today.

**Remediation brief**
- **Design intent:** a Google outage on any call of a creator-facing flow ends on the refusal the product already has for it (`google_failed`), never on the API's error handler, and is logged as Google not answering. Reads map it in the gateway's `read` catch (`youtube-gateway.ts:413-418`); the connect's `channels.list` maps it in `identifyGrant` (`youtube-gateway.ts:350-366`); the code exchange is the one Google call of the connect left. `invalid_grant` at the code exchange stays `consent_denied`.
- **Full surface:** `packages/token-vault/src/token-vault.ts:130` and `:683-689`; `apps/api/src/app.ts:248-249`; `apps/api/src/connect.test.ts` (two new tests). The revenue consent shares the callback (`intent.purpose === 'revenue'` lands on `revenue_error=google_failed`), so no second route changes.
- **Must preserve:** `consent_denied` for `GoogleRefusedGrantError` (`connect.test.ts`'s denied-consent tests); every other non-ok `completeConsent` result's landing; the `channels.list` held test at `connect.test.ts:153`; the token vault's `requestToken` classification (`token-vault.test.ts`, `video-list.test.ts`'s #216 tests).
- **Do not touch:** the stalled-body 4xx classification (Reviewed and Dismissed); `requestToken`'s non-HTTP catch (Minor).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-5.test.ts` is red now and green after; then `pnpm exec vitest run apps/api/src/connect.test.ts`.

### 2. No test pins that one channel's cached read never answers another channel's page — LOW
- **Location:** `apps/extension/src/product-api.ts:170`; the gap is in `apps/extension/src/product-api.test.ts`'s "reading videos for a Studio channel" describe (`:284`)
- **Attribution:** introduced (test gap). The behaviour is correct at HEAD; the rule (epic user story 30, "I never see one channel's numbers on another's page") has no test at the layer that would break it.
- **Real-world trigger:** none today. A refactor that drops `youtubeChannelId` from the background's cache key would pass the whole suite, and then a creator who switches Studio between two connected channels inside 30 s, on a page asking the same ids or the same format read, would be shown the first channel's numbers.

**Evidence**
```ts
      const key = JSON.stringify([query.youtubeChannelId, parametersOf(query)])
```
Mutation: `const key = JSON.stringify([parametersOf(query)])` in a scratch worktree at HEAD: `pnpm exec vitest run apps/extension` stays green, 20 files, 401 tests. The only tests naming a second channel (`product-api.test.ts:286`, `:310`) make one video read each; every surface test uses one Studio channel id.

**Failure mode** — none at HEAD; a coverage claim the suite does not make good on for a stated user story.

**Recommended fix** — one test, placed before "a read of other ids within 30 seconds asks the API for them" (`product-api.test.ts:449`):
```ts
  test("the same read for another listed channel within 30 seconds asks the API for that channel's videos", async () => {
    const other: ListedChannel = { ...channel, id: 'channel-2', youtubeChannelId: 'UC999' }
    const api = fakeApi(Response.json({ channels: [channel, other] }), videosReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(cardRead)
    const read = await product.readVideos({ ...cardRead, youtubeChannelId: 'UC999' })

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      `${origin}/api/channels/channel-1/videos?ids=NDha0z6zDA8&window=lifetime`,
      `${origin}/api/channels/channel-2/videos?ids=NDha0z6zDA8&window=lifetime`,
    ])
    expect(read).toMatchObject({ state: 'read', channelId: 'channel-2' })
  })
```
Checked in a scratch worktree: green at HEAD, red under the mutation above. No production change.

**Remediation brief**
- **Design intent:** the background holds a 30 s in-memory cache of video reads so Studio's in-page navigations do not repeat requests; each kept read is keyed by the Studio channel id and the query's parameters, and a Studio channel resolves to its own Stillstats channel through `GET /api/channels`.
- **Full surface:** `apps/extension/src/product-api.test.ts` only (one test). The format read shares the same key line, so one test covers both.
- **Must preserve:** every existing test in `product-api.test.ts`, in particular the 401-forgets-caches tests (`:330`, `:343`, `:360`) and "a repeat of the same read within 30 seconds sends no request" (`:433`).
- **Do not touch:** `product-api.ts` itself.
- **Proof:** add the test, run `pnpm exec vitest run apps/extension/src/product-api.test.ts -t "another listed channel"` (green); change `product-api.ts:170` to `JSON.stringify([parametersOf(query)])` and run it again (red); revert the mutation.

### 3. Review 3's preserved repro for its Finding 2 is red at HEAD because its fixture predates #218 — LOW
- **Location:** `docs/reviews/creator-analytics-4/repro/review-3.test.ts:130-161`
- **Attribution:** introduced by `d5ad807` (#218): the test-audit agent bisected `b1b387c..HEAD`, and `e10a71d`, its parent, is green.
- **Real-world trigger:** none for a creator. The repro's fake rows carry no `engagedViewsByDay`, so under #218's rule the card video has no processed day and the card shows no comparison row. Its first assertion, `formatReads > 1` (the retry), still passes; only `'1 of 2 Videos by engaged views'` fails. The rule it proved is still pinned by the suite: `card.test.ts:710`, "a format read that failed is asked again once a line's time has passed, and its row then shows", goes red when `card.ts:49`'s `return 'unread'` becomes `return undefined`.

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
Checked in a scratch worktree: with it, every repro except review 5's is green (13 of 13 once Finding 1 is fixed too), and biome is clean.

**Remediation brief**
- **Design intent:** preserved repros are the red-before-green record of each review; each stays green once its finding is fixed, so a later red means a regression or a stale fixture.
- **Full surface:** `docs/reviews/creator-analytics-4/repro/review-3.test.ts:132` and `:143`.
- **Must preserve:** both assertions of the test as written; the other two tests in the file.
- **Do not touch:** `card.ts`, `comparison.ts`.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts docs/reviews/creator-analytics-4/repro/review-3.test.ts` red now, green after.

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/product-api.ts:15-16` — "which the API answers only after its own unbounded calls to the YouTube Data and Analytics APIs (paging a large channel's uploads)" → "which the API answers only after its own calls to the YouTube Data and Analytics APIs, each bounded at 10 seconds (`googleCallTimeoutMs`) but unbounded in number (paging a large channel's uploads)". Stale since #214 bounded every Google call; the comment came with #211 (`1aba17b`).
- `apps/extension/test/studio-boundary.test.ts:34` — "Every way a script reads the text, a value or the look of a node." → "The ways the surfaces read a node's text, a value or its look today. Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `.href` and attribute-value selectors are not matched." None of those is used in `surfaces/` or `selectors/` today (agent grep).
- `packages/api-types/src/videos.ts:177-180` (the `ids` doc) — add after "and `sort` apply as usual": "and `publishDayTop` ranks the listed ids only." `apps/api/src/video-list.ts:474` computes it over the listed subset, as `video-list.test.ts`'s "in first1 with ids, the publish day top holds the listed unlisted and private uploads" pins.

## Needs Further Investigation

### A. The Content list figure may cover the Date column's second line, or be clipped, in real Studio
`render.ts:48-53` places the figure out of flow, end-aligned to a zero-width host at the Views cell's end, one line down, on one line. Anything wider than the Views column runs left toward the Date column, whose cell may carry a second line (Studio's status text); being out of flow, the figure adds no row height, so a cell with `overflow: hidden` could clip it. "Not processed yet" with the icon is the widest case. Reasoned, not executed: jsdom lays nothing out. What would confirm it: #219's Chrome hand check (and #200's walk) also looking at a "Not processed yet" row and a row with a status line under its date.

### B. Firefox's data declaration may under-declare what the extension sends (carried from review 1 NFI A)
`manifest.ts:52-57` declares `authenticationInfo` (required) and `technicalAndInteraction` (optional). Every read sends the Studio channel id, video ids and period, read from Studio's URL and links, to stillstats.com. Mozilla's "Firefox built-in data consent" page (extensionworkshop.com, fetched this round) defines `browsingActivity` as "information about the websites users visit, such as specific URLs" and `websiteContent` as "anything visible on a website, such as text, images, videos, and links", and data transmission as any data handled outside the add-on, with no core-function exemption. Whether AMO counts ids from Studio links as either is a reviewer's call. What would confirm it: ask AMO, or settle it at #100 before the submission.

### C. The Pacific publish day relies on `Intl.DateTimeFormat('en-CA')` printing YYYY-MM-DD in every browser
`comparison.ts:19-27`. If a browser's ICU data prints another pattern, `daysFrom` gets an unparseable day, N is 0 or NaN, and the comparison row disappears silently. The agent recalled (not fetched) a Chrome release whose CLDR update briefly changed en-CA dates. The same pattern is in the web app's `since-publish.ts:135` (already on `main`), the gateway and the fake. What would confirm it: evaluate the expression in current Chrome and Firefox during #99. Fix if confirmed: build the day from `formatToParts` in all five copies.

### D. N can be a day short when the figure's read and the format read count to different days
`card.ts:39-45` picks the format read's window from the ids read's `lastProcessedDay`, while `comparison.ts:71` takes N from the format read's array, which the API caps at the window's length. With the ids read at N = 7 (`first7`) and the format read counted one day later, the row says "First 7 days" while Google has processed 8. Executed at unit level (the agent's probe gave `{"place":"1 of 2 Videos by engaged views","through":"First 7 days"}`); every upload is still counted over the same 7 days, so the row is self-consistent and names its days. Reachability unverified: it needs the two reads to answer across Google's daily update, for example a kept ids read and a fresh format read. What would confirm it: a `card.test.ts` case answering the ids read at day D and the format read at D+1 at a window edge (7, 28, 90). Fix if confirmed: when the card video's array length equals the window's length but the format read's day gives more days, ask again in `windowCovering` of the new N.

Carried, unchanged: review 4 NFI B (real Studio may drop `#table-header` on a tab with no uploads; #129) and NFI C (`sendResponse` on a closed channel; #101; this round adds that a `null` request makes `backgroundAnswerer` reject, unreachable since only the extension's own contexts can message it); review 1 NFI C; review 3 NFI B and NFI C. Review 4 NFI A is closed by #217 item 6.

## Reviewed and Dismissed
- A token endpoint 4xx whose body stalls becomes `google_failed`, not internal (`token-vault.ts:429-432`) — the body, and so whether it says `invalid_grant`, was never read: no answer is an outage, as #216's recorded assumption treats a non-JSON 200; the next refresh decides.
- One channel's kept read answering another's page (`product-api.ts:170`) — executed: the key carries the Studio channel id and the second read goes to the other channel. Only the test is missing (Finding 2).
- `engagedViewsByDay` slicing (`comparison.ts:73-74`) — dense from the publish day, a missing day is 0 (`window-after-publish.ts:54-71`), so the first N entries are the first N days.
- `reportingDayOf` around DST and midnight Pacific — 12 executed cases over both 2026 changes, all correct.
- `windowCovering` — executed table from 0 to 1,000 days matches the rule, `first365` past 365.
- Timers and `passAgain` after `stop()` — `passAgain` runs only synchronously inside `place`, and no `place` starts after `stop` (`placeAll` returns on `!current()`).
- A different Stillstats account served the previous account's kept read inside 30 s on the same channel — no rule is broken; the creator's own channel.
- The comparison's tie tests pin the read's order rather than publish times (`comparison.test.ts:132-141`, `card.test.ts:600-615`) — the mechanism is the read's order kept by a stable sort, which is the video list's tie order; `comparison.test.ts:132` is #218's review finding 1 proof (`8fd769a`). See Test quality for the fixture note.
- Review 4's dismissals stand, as do reviews 1 to 3's (event-send 401 not clearing caches, undeduplicated concurrent reads, `cf-connecting-ip`, partial OpenPanel config, figures kept while their element stands, `period-default` as Lifetime, the 200 written back after another read's 401, the dev popup's localhost link).

## Minor / nits
- A Content list read that lands after Studio emptied the list, with no navigation, puts the page line back over zero rows for one pass (about 250 ms) before the two-empty-passes rule takes it down (`content-list.ts:243-247`). Executed by an agent probe; cosmetic. One guard would close it: place no page line when `tableHeaderIn(list)` holds and no row has an id.
- Any non-HTTP failure in a Google call (a bad `tokenEndpoint` URL, a programming error inside googleapis) is classified as Google not answering and never reaches GlitchTip (`token-vault.ts:420-422`, `youtube-gateway.ts:350-353`). The same pattern is in the gateway's `call` at `5d4457d`.
- `POST /api/events` buffers a JSON body of any size before refusing it (`routes/events.ts:51`); signed-in and rate-limited. A `hono/body-limit` of a few KB would bound it.
- A token endpoint 5xx is logged as "Google's token endpoint did not answer a call" though it answered (`video-list.test.ts`'s 5xx test pins it); #216's recorded choice of one class.
- `host-access.ts:16`'s `manifest.host_permissions ?? []` is dead (every build has them) and would answer "granted" if it ever fired; `host-access.test.ts:52-61` pins that fallback, and `:31` repeats `:19-29`'s assertion.
- Firefox for Android: no `gecko_android` entry (`manifest.ts:51`). Unverified whether addons-linter warns.
- WXT's content-script handoff listens for a window `postMessage` a page can post, which only turns the extension off on that page (fail-closed, framework behaviour).
- Carried: `isKept` and the background cache on `Date.now()` (a backwards clock change keeps reads past 30 s, executed by an agent this round); copied test helpers (the two-mode failure table in six test files, `popupStorage`, `recordingAsk`, `settle`); the popup's "throws before it returns a promise" comments; `card.ts`'s `comparisonOf` shadowing; `vitest.config.ts`'s `server.deps.inline` with no why line; `entrypoints/first-run/main.ts` reached by no test.

## Test quality
Tests new or changed since review 4's HEAD `b1b387c`: 100 (each `test.each` row counted) · red at `b1b387c`: 53 at runtime, 20 at import (`daysProcessedOf` and `windowCovering` not exported there; the fake's own new modes) · green: 27, of which 21 are renames or reshapes of tests base already satisfied (the analytics "row" to "tile" renames, one Content list rename) and 6 each go red under a targeted mutation (`content-list.ts`'s `readingKey` guard and `passAgain` call, two `watch.ts` drop branches, `card.ts`'s earlier-day `'unread'` check, `comparison.ts`'s missing-card-video case) · unkillable tests: none · tautology shapes found: none (no expectation computed with the production formatter, no mocked unit under test, no call-shaped-only, assertion-free, snapshot or prose test). Notes, none a merge gate:
- `analytics.test.ts:244-254` pins `font-size: 2em` exactly, which `render.ts:59-60` says is not measured; and its colour regex misses `background-color`, `border-color` and `fill` (adding `background-color: #fff` stays green). Optional: assert the number is larger than the label, and walk `sheet.cssRules` for every colour-bearing property.
- `content-list.test.ts:108-110`'s `clippedAway` checks only `clip-path: inset(50%)`; removing the hidden label's `position: absolute` and 1px box stays green. Optional: assert those too.
- `content-list.test.ts:319-334` (the #219 layout `test.each`) does not pin `inset-inline-end: 0`, which "right-aligned under Studio's number" depends on; dropping it stays green.
- `analytics.test.ts:214-233` asserts the tile's four parts twice in one test; the icon-in-label rule is asserted in three places (`:239`, each state row at `:433`, the Not processed yet test).
- #218's arithmetic is stated in both `comparison.test.ts` and `card.test.ts` (Publish day, first N days not lifetime, the window table, the missing card video). Optional: let the unit file own the tables and the card walk own the wiring. Keep `8fd769a`'s and `0b57a45`'s proofs.
- The tie fixtures (`comparison.test.ts:132`, `card.test.ts:600`) put an older-dated upload ahead of the newer card video, an order the API never gives; a same-time tie broken by id would match the API.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `d311ad1`.
- **Commit hygiene:** commit this doc, `repro/review-5.test.ts` and the `repro/repro.vitest.config.ts` change (outside the suite's include pattern, so `pnpm test` stays green while the repro is red). Nothing else to drop; the tree was clean before the review.
- **Likely reviewer asks:** the ready-for-human tickets still open under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); #216 to #220 open though their work is on the branch; #218's window line words ("Publish day", "First N days") and #220's "Engaged views" label, which wait for Nick's approval in the PR; #219's and #220's Chrome hand checks with screenshots; NFI B before the AMO submission.

## Verdict
**Ready to open the PR, with follow-ups.** No finding gates it: this fresh whole-branch pass found no CRITICAL, HIGH or MEDIUM defect, and all four CI checks pass. Finding 1 is a LOW gap in #216's class (a Google outage at the connect's code exchange still shows a raw error page), with a red repro and a five-line fix checked green; Finding 2 adds one test for the channel-separation rule; Finding 3 refreshes a stale review repro; Finding 4 is three comment lines. They fit one short remediation round or follow-up tickets. Review 4's Findings 1 and 2 are closed (its repro is green), its Finding 3 is closed by #216, its Finding 4 by #217 item 3 (both branch tests go red under their mutations), and its NFI A by #217 item 6.
