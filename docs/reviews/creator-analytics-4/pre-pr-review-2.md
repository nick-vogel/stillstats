# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `7326a65` ("creator-analytics#4 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 120 files, +17,871 / −136.
**Delta under review:** since `a8e4958` ("creator-analytics#206 Studio extension: the three proven LOW findings from the fifth epic-loop run"), the commit pre-PR review 1 (`docs/reviews/creator-analytics-4/pre-pr-review-1.md`) reviewed. 21 files, +849 / −33, of which 15 are code and tests (the rest are review 1's doc and its `repro/`). Eleven commits, `f3e4629` to `7326a65`.
**Reviewed against:** epic nick-vogel/creator-analytics#4 (body as of 2026-10-14), `CODING_STANDARDS.md`, pre-PR review 1's findings, closure table, Known regressions deferred, and Approach decisions.
**Date:** 2026-10-14
**Reviewer:** 2 code-review agents, 1 test-audit agent, and a verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (436 files) |
| Typecheck | `pnpm typecheck` | green, exit 0 |
| Build | `pnpm build` | green, exit 0 |
| Full suite | `pnpm test` (Testcontainers Postgres) | green: 104 files, 2,060 tests |
| Repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | 6 of 6 green at HEAD |
| Each fix against its intent (F1 to F8) | Read, plus a mutation per fix in scratch worktrees of HEAD (remove `again = false`, remove `\|\| !current()`, remove the `removeSurface` loop, remove each half of the 401 clear, give-up back on `url()`, remove the answerer's `try`, each F7 mutation) | every mutation red except two halves with no test (Findings 1 and 3) |
| Any draw after `stop()` | Agent trace of every `await` in `video-row.ts`, `content-list.ts`, `watch.ts` | none: each draw checks `current()` after its last await; nothing re-enters `pass()` after `stop()` |
| Every placed host carries the surface attribute | `grep` for `hostOf(`, `attachShadow`, `data-stillstats-surface` in `apps/extension/src` | all three host builders go through `hostOf` (`render.ts:88-99`), so `stop()`'s loop reaches every figure |
| Relay timeout fallback (Finding 2) | Executed: deleted `signal: AbortSignal.timeout(sendTimeoutMs)` from `event-relay.ts` in a scratch worktree of HEAD, ran `apps/api/src/events.test.ts` | 39 of 39 green, so the timeout is pinned by nothing |
| Tautology audit | Delta's test files copied into a scratch worktree at `a8e4958` and run there; mutations for the `events.test.ts` tests | 179 run: every added or changed extension test red at `a8e4958`; the four new `events.test.ts` tests green at base (they pin existing behaviour, as F7 asked) and each red under its own mutation |
| Live browsers (extension update under an open Studio tab, WXT's location polling) | Not run: no browser in a review | NFI A; #99 / #101 |
| Prior NFIs A to D (Firefox data declaration, hung read, page-off surface, `x-client-ip`) | Not re-examined: the delta does not touch their code | carried forward unchanged from review 1 |

**Overall:** The remediation holds. Every one of review 1's eight findings meets its stated intent, both MEDIUMs fully, and the four CI checks are green. This round finds no defect in shipped behaviour: the three confirmed findings are test gaps (two of them the untested halves of this round's own fixes, one a fallback the relay has had since #89) plus one comment hygiene batch, all LOW. The branch can open its PR as it stands.

## Approach decisions
- **Analytics link window (F1):** the extension always writes `window` into the detail link, lifetime included. Precedent: the analytics surface writes every other window explicitly. Unchanged.
- **Watch stop (F2, F3):** `stop()` removes every host the surfaces placed, through `removeSurface` in `render.ts`, and clears `again` so no queued pass runs; the Content list's `place` checks `current()` after its read the way `video-row.ts` does. No `stopped` flag, since nothing calls `pass()` after `stop()`. Unchanged.
- **Give-up URL (F4):** the give-up judges the URL its navigation was for, captured in `navigated()`. Unchanged; its known deferred regression stays deferred.
- **Session cache (F5):** a 401 from any read forgets the kept channels and the kept video reads, in `readSignedIn`. Unchanged; Finding 1 adds the missing test only.
- **Background answers (F6):** the mapping from a rejection to the failed value lives inside `backgroundAnswerer`. Unchanged.
- **Event relay tests (F7):** the fake OpenPanel's `dropEveryRequest` stands for a dropped connection, not a hang. A hang is tested through an injectable send timeout on `createEventRelay` (Finding 2), not by waiting out the real 3 seconds. Precedent: `createProductApi` takes `now` and `fetch` as options for its tests.
- **Stop tests (F2, Finding 3):** a surface's takedown on stop is pinned in that surface's own test file, against its saved Studio fixture, as `content-list.test.ts` already does, rather than in `watch.test.ts`, whose fake surfaces place no hosts.

## Confirmed Issues

### 1. A 401 on a channel read forgetting the kept video reads has no test — LOW
- **Location:** `apps/extension/src/product-api.ts:102-106` (the code, correct); `apps/extension/src/product-api.test.ts:271-298` (the two tests that drive the 401 from a video read only)
- **Attribution:** introduced by this round's remediation, `6daee3d` ("creator-analytics#4 pre-PR review 1 finding 5: forget the kept channels and video reads on any 401, ..."). Review 1's F5 intent was "a 401 from any read forgets the kept channels and the kept video reads"; the code does that, the tests cover only the video-read half.
- **Real-world trigger:** the popup asks for channels at t=0 and the answer is kept; a surface reads a video at t=20 s (channels still fresh, so only the video read goes out) and that is kept until t=50 s; at t=31 s the popup's channel read goes to the API and gets a 401. A later change that clears the video reads only on a video 401 would let a surface show that kept figure for up to 19 s after the session ended, and ship green.

**Evidence** — the clear is path-blind, and nothing pins that:
```ts
      if (response.status === 401) {
        keptChannels = null
        keptVideos.clear()
        return { state: 'signed-out' }
      }
```
**Failure mode** — executed by the extension review agent: making `keptVideos.clear()` conditional on the request path not being `/api/channels` left `product-api.test.ts` 55 of 55 green.

**Recommended fix** — add one test to `product-api.test.ts`, beside the two "after a 401 on a video read" tests:
```ts
  test('after a 401 on a channel read, a video read kept before it is not served: the same read asks the API again', async () => {
    const api = fakeApi(
      channelsReply(),
      videosReply(),
      new Response(null, { status: 401 }),
      channelsReply(),
      videosReply(),
    )
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })
    await product.readChannels()
    time.advance(20_000)
    await product.readVideos(cardRead)
    time.advance(11_000)
    expect(await product.readChannels()).toEqual({ state: 'signed-out' })

    await product.readVideos(cardRead)

    expect(api.requests).toHaveLength(5)
  })
```
Check against the file's `fakeApi`, `clock` and `api.requests` helpers (`product-api.test.ts:28-55`) before copying: if `api.requests` holds URLs, assert the fifth is the video list path rather than only the count, which is a stronger observation than the neighbouring test's count (see Test quality).

**Remediation brief**
- **Design intent:** the background keeps a signed-in channels read and each signed-in video read for `signedInReadKeptMs` (30 s, `kept.ts:8`). A 401 on any read means the session has ended, so every kept read is forgotten at once, so no surface and no popup speaks for a session that is gone.
- **Full surface:** `apps/extension/src/product-api.test.ts` only. No production change.
- **Must preserve:** the two existing "after a 401 on a video read" tests and the `test.each` "a 401 on %s reads as signed out" (`product-api.test.ts:261-269`).
- **Do not touch:** the in-flight race where a 200 landing after another read's 401 re-keeps its read (Minor / nits); it is not part of this finding.
- **Proof:** the new test red with `keptVideos.clear()` made conditional on `path !== '/api/channels'` in `readSignedIn`, green as written: `pnpm exec vitest run apps/extension/src/product-api.test.ts`.

### 2. The relay's send timeout has no test, and the test named for it covers a dropped connection — LOW
- **Location:** `apps/api/src/event-relay.ts:24` and `:51` (`sendTimeoutMs`, `signal: AbortSignal.timeout(sendTimeoutMs)`); `apps/api/src/events.test.ts:180` (the test name); `apps/api/test/fake-openpanel.ts:15-17`, `:27`
- **Attribution:** pre-existing, untouched: the timeout came with the relay in `77e8a4b` ("creator-analytics#89 Relay the Studio extension's events through the API"). Review 1's Finding 7 evidence named "OpenPanel unreachable or timing out", but its recommended fix (a socket-destroying fake, named "never answers") covered only the unreachable half, and `95a7254` followed it.
- **Real-world trigger:** the route awaits the relay before it answers (`routes/events.ts:55`), so the timeout is what keeps an OpenPanel that accepts the connection and never answers from holding every extension event request open. A refactor that drops the `signal` ships green.

**Evidence**
```ts
          signal: AbortSignal.timeout(sendTimeoutMs),
```
```ts
  test('an event OpenPanel never answers still answers 204, and the failure is reported', async ({
    ...
    openPanel.dropEveryRequest()
```
**Failure mode** — executed: with the `signal` line deleted in a scratch worktree of HEAD, `pnpm exec vitest run apps/api/src/events.test.ts` ran 39 of 39 green. `dropEveryRequest` destroys the socket once the request is read, so the fetch rejects in about 27 ms through the same `catch`, never reaching the timeout.

**Recommended fix**
1. Rename the existing test to `'an event whose connection OpenPanel drops still answers 204, and the failure is reported'`.
2. Make the send timeout an option of the relay, default unchanged:
```ts
export function createEventRelay(
  options: OpenPanelOptions | undefined,
  { reporter, sendTimeoutMs = defaultSendTimeoutMs }: { reporter: Reporter; sendTimeoutMs?: number },
): EventRelay {
```
with the existing `const sendTimeoutMs = 3_000` renamed `defaultSendTimeoutMs` (its comment kept above it) and `:51` unchanged.
3. Give the fake a hang mode, `answerNothing()`, that records the request and never calls `res.end` (`close()` already calls `server.closeAllConnections()`, so the test still ends).
4. Add a test that builds the relay directly, `createEventRelay({ apiUrl: openPanel.apiUrl, clientId: 'c', clientSecret: 's' }, { reporter, sendTimeoutMs: 50 })` with `recordingReporter()` from `@creator-analytics/reporter`, sends one event to the hanging fake, and asserts that `send` resolves and `reporter.reports` is `[{ message: 'The event relay could not reach OpenPanel', error: expect.any(Error) }]`. Name it for the rule: "an event OpenPanel accepts and never answers is given up after the send timeout, and the failure is reported".

**Remediation brief**
- **Design intent:** the relay never fails the extension's request. It answers 204 whatever OpenPanel does: a non-2xx is reported as "refused", and a rejection (dropped connection or timeout) is reported as "could not reach". The 3 s timeout bounds how long an extension event request waits on OpenPanel, since the route awaits the send.
- **Full surface:** `apps/api/src/event-relay.ts:22-24`, `:31-34`, `:51`; `apps/api/test/fake-openpanel.ts` (new `answerNothing`, and the interface doc at `:15-17` naming both modes, plus a one-line doc on `dropEveryRequest`: "Closes the connection on every later request, once it is read, with no answer."); `apps/api/src/events.test.ts:180` (rename) and the new test, in `events.test.ts` or a new `apps/api/src/event-relay.test.ts`. `apps/api/src/modules.ts:74` keeps calling `createEventRelay(openPanel, { reporter })`, so production takes the default.
- **Must preserve:** the relay's 3 s production timeout; `modules.ts:74`'s call unchanged; every `events.test.ts` test (39), in particular "an event OpenPanel refuses still answers 204" and the renamed dropped-connection test, which must keep its current assertion.
- **Do not touch:** the clock-minute limit window and the `admit` placement (Reviewed and Dismissed); the `cf-connecting-ip` trust (review 1, Dismissed).
- **Failure of the fix itself:** if the hang test's fake never closes its pending response, the file hangs rather than fails; `close()`'s `closeAllConnections()` is the backstop, so the test must register the fake's `close` the way the file's other fakes do.
- **Proof:** the new test red with the `signal` line removed from `event-relay.ts` (it then times out the test or never reports), green as written: `pnpm exec vitest run apps/api/src/events.test.ts` (plus `apps/api/src/event-relay.test.ts` if created there).

### 3. Taking down the card's and the analytics row's figures on stop has no test — LOW
- **Location:** `apps/extension/src/surfaces/watch.ts:216` (the code, correct); `apps/extension/src/surfaces/content-list.test.ts:574-585` (the only stop test)
- **Attribution:** introduced by this round's remediation, `6a8ff25` ("creator-analytics#4 pre-PR review 1 finding 2: take down every figure the watch placed when it stops, ..."). Review 1's F2 intent was "every figure the watch placed"; the test pins the Content list's only.
- **Real-world trigger:** a later change that narrows the loop to the Content list (where the repointed-row harm is worst) leaves the card's pill and comparison row and the analytics row standing after an update or disable, and ships green.

**Evidence**
```ts
      for (const surface of surfaces) removeSurface(document, surface.name)
```
**Failure mode** — executed by the extension review agent: replacing the loop with `removeSurface(document, 'content_list')` left all 168 tests in `apps/extension/src/surfaces` green.

**Recommended fix** — one test in each surface's own file, after its figure is shown:
- `card.test.ts`, in "the latest video card against the saved dashboard": "once the extension stops, as an update or a disable stops it, no figure or comparison row stays on the card". Show the card (the file's existing setup), call the module's `stop` (`card.test.ts:91`, `:134`), and assert `document.querySelectorAll('[data-stillstats-surface]')` has length 0.
- `analytics.test.ts`: the same for the analytics row and its link, calling `watcher.stop()`.

**Remediation brief**
- **Design intent:** when WXT invalidates the content script (`entrypoints/studio.content.ts:21`), `stop()` bumps the navigation, clears `again`, disconnects the observer, clears both timers, and removes every host of every surface, because Studio may later repoint the element a figure stands beside.
- **Full surface:** `apps/extension/src/surfaces/card.test.ts`, `apps/extension/src/surfaces/analytics.test.ts`. No production change.
- **Must preserve:** both files' `afterEach` calls to `stop` (`card.test.ts:211`, `analytics.test.ts:147`), which a second call after the test's own must not break (stop is idempotent: `removeSurface` on no hosts is a no-op); the two Content list stop tests.
- **Do not touch:** `watch.test.ts`'s fake surfaces, which place no hosts (Approach decisions).
- **Proof:** each new test red with `watch.ts:216` replaced by `removeSurface(document, 'content_list')`, green as written: `pnpm exec vitest run apps/extension/src/surfaces/card.test.ts apps/extension/src/surfaces/analytics.test.ts`.

### 4. Comment hygiene — LOW (aggregated)
- `apps/extension/src/product-api.ts:95` — `A GET carrying the session cookie: a 401 is signed out, a dropped request is failed.` → `A GET carrying the session cookie: a 401 is signed out and forgets every kept read, so no surface or popup speaks for an ended session; a dropped request is failed.`
- `apps/extension/src/surfaces/watch.ts:46-51` — `...once it passes, the watch runs one more pass with \`settled\` true, and a surface reports missing only if that pass finds nothing either.` → append: `That pass places surfaces for the URL at that moment, so a surface of a page the URL has just left is judged without being tried.` (the mechanism of review 1's known deferred regression)
- `apps/api/test/fake-openpanel.ts:15-17` — `the status \`answerWith\` sets, or nothing once \`dropEveryRequest\` is called.` → `the status \`answerWith\` sets, or closes the connection unanswered once \`dropEveryRequest\` is called.` (superseded by Finding 2's brief if it lands first)

## Needs Further Investigation

### A. Between a URL move and WXT's `wxt:locationchange`, a shown surface may be reported twice — what would confirm it
`placeAll` places for `url()` at the time (`watch.ts:130`), so a pass in that window draws the new page's surface under the old navigation and reports `extension_surface_shown` (`:145-147`); `navigated()` then resets `shown`, and the new navigation's settle-time pass reports it again. Pre-existing, untouched by the delta (F4 moved only the missing judgement onto `navigatedUrl`). Telemetry only. What would confirm it: a `watch.test.ts` case that changes `url()`'s answer, lets a pass run, then calls `navigated()` and counts `extension_surface_shown`; and WXT's location polling interval (believed 1 s, not checked).

Review 1's NFIs A to D stand unchanged.

## Reviewed and Dismissed
- `admit` placed between the body parse and the validation check survives every test (`routes/events.ts:49-54`) — the `.catch` means the parse never throws, so that order admits exactly the same requests; only a 429 reading the body would differ, which nothing outside can see. The comment at `:48` is accurate.
- `stop()`'s `removeSurface` could remove a new content script instance's hosts after an update (`watch.ts:216`) — the new instance's first draw is at least `passEveryMs` plus a background round trip after the old `stop()`. Unverified in a browser, reasoned only.
- `backgroundAnswerer`'s `catch` rethrows when `request` is `null` (`background-answer.ts:22`) — no caller sends a message without a body; the extension's own pages are the only senders.
- Another surface building an `/app/videos/` link without a window — only `analytics.ts` builds one (`grep`).
- `periodOf` could hand the web app a custom window without its range — it yields only lifetime and the four fixed windows, all in `videoWindows`.
- `isChannelsAnswer` checks only that `channels` is an array — same strictness as its precedent `isVideoListAnswer`; recorded in review 1's verify notes.

## Minor / nits
- `let navigatedUrl = url()` (`watch.ts:117`) is always overwritten by the `navigated()` call at construction (`:206`) before anything reads it; `let navigatedUrl: string` says so.
- A 200 already in flight when another read's 401 clears the caches re-keeps its read (`product-api.ts:122`, `:155`), so the popup can say "Signed in" again for up to 30 s. Needs the session to end between two overlapping requests; the Content list's chunked reads make that reachable but narrow. A sign-out counter captured before the fetch would close it.
- `backgroundAnswerer`'s `catch` drops the error unlogged, so a programming error in the background shows only as a lasting "Try again later" line.

## Test quality
Tests added or changed in the delta: 11 extension tests (3 rows in `background-answer.test.ts`, 3 in `product-api.test.ts` (one a table), 1 in `analytics.test.ts`, 3 in `content-list.test.ts`, 1 in `watch.test.ts`) and 4 in `events.test.ts` · green against `a8e4958`: the 4 `events.test.ts` tests, which pin existing behaviour as review 1's F7 asked, and each goes red under its own mutation (remove the `.catch`, remove the relay's `catch`, move `admit` below the validation, set the limit to 5) · tautology shapes found: none vacuous; notes:
- `events.test.ts:235,240`, "invalid events count toward the limit", loops to and expects `eventLimitPerWindow`, so it stays green when the limit changes. Acceptable: the 61st-event test now pins the literal 60.
- `product-api.test.ts:285-298`, "after a 401 on a video read, a video read kept before it is not served", asserts only `api.requests` has length 5. It discriminates (red at base and with the clear removed) but would pass if the re-asked read returned a wrong value. Optional: also assert the third read's answer.
- `docs/reviews/creator-analytics-4/repro/analytics-link.test.ts` is green against the pre-fix extension code: it reads a pinned href and checks the web app's route parsing, so it is a contract check, not a repro. Its header says so, and review 1's Approach decisions record it; the regression pin is `apps/extension/src/surfaces/analytics.test.ts`.

## Prior-review closure
Review 1 had 8 confirmed findings: 2 MEDIUM, 6 LOW.
- **Fully fixed, 8:** F1 (MEDIUM), F2 (MEDIUM, after the rework `89a8152`), F3, F4, F5, F6, F7, F8. Each fix's code meets the finding's intent, each was mutation-checked this round, and none was resolved by a comment alone except F8, which was a comment finding.
- **Partially fixed, 0.** Two fixes have a half without a test (F5's channel-read 401, Finding 1; F2's card and analytics, Finding 3) and F7's evidence named a timeout case its recommended fix did not cover (Finding 2). The code behaves as intended in all three; the gaps are coverage, reported as new LOW findings.
- **Untouched, 0.**
- **Known regressions, deferred:** review 1's give-up URL edge (introduced by `34625b5`) stays deferred and was not re-reported; Finding 4's `watch.ts:46-51` entry only makes the comment say what that edge does.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `7326a65`.
- **Commit hygiene:** commit this doc. Nothing else to drop; the tree was clean before and after the review.
- **Likely reviewer asks:** the ready-for-human tickets (#99, #100, #101, #122, #129, #200, #202) and needs-triage ones (#121, #126) under #4; the OpenPanel variables unset in Dokploy; review 1's NFI A before the AMO submission; review 1's note that `0fa5357`'s commit body overstates the video list smoke test.

## Verdict
**Ready to open the PR as-is.** No finding gates it. Findings 1 to 3 are test gaps in code that behaves correctly, and Finding 4 is three comments; all four fit one short remediation round or a follow-up ticket. Review 1 claimed 8 findings and all 8 are closed against their intent, none only by a comment edit (F8 was itself the comment finding). The confirmed count fell from 8 to 4 and moved from behaviour defects to coverage and comments, which is the expected shape of a converging branch rather than a sign of new trouble.
