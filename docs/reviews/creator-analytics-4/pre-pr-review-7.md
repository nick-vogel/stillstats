# Pre-PR review: creator-analytics#4 Studio extension

**Branch:** `creator-analytics-4-studio-extension` vs `origin/main` (merge-base `5d4457d` "Merge pull request #193 from nick-vogel/creator-analytics-64-web-dashboard-metrics-profile")
**Reviewed at:** HEAD `0f7bb7c` ("creator-analytics#4 pre-PR review 6 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 141 files, +22,388 / −163, 366 commits.
**Delta under review:** since `07308de` ("creator-analytics#226 Content list: say engaged views and the day in Studio's Views column heading, not at the edges of the list"), the HEAD pre-PR review 6 read. 12 files, +379 / −26: review 6's doc, its remediation (`e4ff338`, `3a82f63`, `690a77c`, `4ae9470`) and its closure table (`0f7bb7c`).
**Reviewed against:** pre-PR review 6 (findings 1 to 4 with their briefs, Approach decisions, NFIs, dismissals, remediation closure table); `CODING_STANDARDS.md` rules 1 to 3; the epic's rule that a surface the extension cannot place shows nothing and that no figure stays up for a video or period the URL no longer names.
**Date:** 2026-10-15
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green (442 files) |
| Typecheck | `pnpm typecheck` | green, every package |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 106 files, 2,201 tests |
| Prior repro suite | `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` | green: 7 files, 15 tests (review 6's `review-6.test.ts` and review 3's repro now green) |
| Review 6 Finding 1 against its intent | Agent differential harness (HEAD's `analytics.ts` against a copy with only the new `removeSurface` reverted, both through the real `watchStudio`); my own probe in a scratch worktree at `0f7bb7c` | holds: after a move to another period or video while the Views number is missing, no host of the page before stays (2 without the fix, 0 with it). On the same URL, a transient miss takes the hosts down and the next pass draws them again after one more background read; `extension_surface_shown` is not sent again, `extension_surface_missing` is sent once on a move and never after a same-URL miss. `removeSurface` matches `[data-stillstats-surface="analytics"]` only. No race with an in-flight read: `place` calls are serialized by the pass lock (`watch.ts:224-238`) and analytics has no `sweep` |
| Redraw after a transient miss is pinned | Mutation in the scratch worktree: `video-row.ts:124`'s `held.hosts.every((host) => host.isConnected)` replaced by `true` | the existing "Studio redrawing its Views tile alone gets the figure placed again in the new tile, with one line" goes red, so the redraw the fix depends on is pinned |
| Review 6 Finding 2 (`renderSurface`'s dead link) | Agent read of `render.ts` and its one caller, `video-row.ts:154` | holds: only analytics passes `linkOf`, and it always passes `render`; `newTabLink`, `whenOpened` and `showsAnswer` are still used; the new doc line matches `lineOf` |
| Review 6 Finding 3 (review 3's repro) | Repro suite run | green; only `engagedViewsByDay` added, assertions unchanged |
| Review 6 Finding 4 (six comments) | Agent read of each comment against its code; `grep -rn callTimeoutMs apps packages` | five true of their code; one names the wrong unmatched read (Finding 1 here); `app.ts`'s "keeps" reads as storing (same entry). Production passes no `callTimeoutMs` (only `apps/api/test/start-api.ts` does), so "each bounded at 10 seconds" holds |
| Tautology audit | HEAD's `analytics.test.ts` and `card.test.ts` copied into a scratch worktree at `07308de` and run there | the 2 new rows red at `07308de` (both cases); `card.test.ts`'s change is a comment, 119 other tests green as expected |
| Em-dashes in shipped copy | `git diff 07308de -- apps packages \| grep -c '^+.*—'`; the same over the whole branch's authored paths from `5d4457d` | 0 and 0 |
| Live browsers | Not run: no browser in a review | review 6's NFIs stand; #99, #101, #200, #225 and #226 hand checks |

**Repro command for the whole preserved suite:** `pnpm exec vitest run --config docs/reviews/creator-analytics-4/repro/repro.vitest.config.ts` from the repo root. No new repro this round: the one confirmed finding is comment text.

**Overall:** All four CI checks and the whole preserved repro suite are green. Review 6's four findings are each fixed against their intent, and the analytics fix was proved by execution both ways: it clears the page before on a move, and a same-URL miss redraws once Studio does. This delta-scoped pass found no CRITICAL, HIGH or MEDIUM defect and one LOW comment hygiene entry, in a comment review 6's own brief wrote. The branch is ready to open its PR.

## Approach decisions
- **Analytics link window (review 1 F1):** the extension always writes `window` into the detail link, lifetime included. Unchanged.
- **Watch stop (review 1 F2, F3):** `stop()` removes every host through `removeSurface` and clears `again`; no `stopped` flag. Unchanged.
- **Give-up URL (review 1 F4, #210, #217):** the give-up judges the navigation WXT reported, held in `nav`; `giveUp` sets `nav.reached` when `url() === nav.url`. Unchanged.
- **Dropped navigation (#215, #217):** only a reached navigation may become `previous`; each navigation record carries its own count. Unchanged.
- **Session cache (review 1 F5):** a 401 from any *read* forgets the kept channels and video reads, in `readSignedIn`. An event send is not a read and stays out of it. Unchanged.
- **Background answers (review 1 F6):** the rejection to failed-value mapping lives in `backgroundAnswerer`. Unchanged.
- **Hung reads (#211):** every background fetch carries `AbortSignal.timeout(answerWithinMs)`, 15 s by default, per fetch. Unchanged.
- **Row sweep (review 3 F1, #215, #217, #224):** an optional synchronous `sweep(document, passAgain)` on `Surface`, run from `schedulePass`'s timer outside the pass lock. Unchanged.
- **Comparison retry and window (review 3 F2, #215, #218, #224):** unchanged.
- **Content list figure and label (#219, #226):** unchanged; its not-found return still removes nothing (review 6 NFI E).
- **Analytics placement and not-found (#225, review 6 F1):** `videoRowPlacer` takes a per-call `render`; the figure goes after the Views tile's number row, the line after `#key-metric-header`. A pass that cannot find every one of the page's Studio elements calls `removeSurface(document, 'analytics')` before it answers `not-found`. The price, accepted: a same-URL miss takes the figure and any line down until the next full pass, which re-reads through the background (a 30 s cache hit for a signed-in figure, a real request otherwise). Confirmed this round by execution.
- **Default row render (review 6 F2):** `renderSurface` draws the card's row only and takes no link; a surface with a link on its figure draws through its own `render`. Unchanged.
- **Preserved repros (review 6 F3):** a stale repro fixture is brought up to the current rule by adding the data the rule needs, never by changing its assertions. Unchanged.
- **Google call bound (#214, #216, #222):** one per-call bound, `googleCallTimeoutMs` (10 s). Unchanged.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
- **Attribution:** introduced by the remediation, `4ae9470` ("creator-analytics#4 pre-PR review 6 finding 4: six comments said less than, or other than, what their code does"), which applied review 6's corrected text verbatim. Both errors are in review 6's own wording.
- `apps/extension/test/studio-boundary.test.ts:34-39` — "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `.href` and attribute-value selectors are not matched." → "Layout reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel`, `.className`, `getAttribute` (how the selectors read a link's href, which the file's header trusts) and attribute-value selectors are not matched." The scanned code's actual attribute reads are `getAttribute('href')` at `selectors/analytics.ts:33`, `selectors/card.ts:14` and `selectors/content-list.ts:29`, which `pageRead` does not match; the `.href` property appears in the scanned files only on a `URL` object (`surfaces/analytics.ts:69`).
- `apps/api/src/app.ts:250-251` — "No status and no error: the vault keeps the error, whose message may carry identifiers, and answers only the refusal." → "No status and no error: the vault answers only the refusal, never the error, whose message may carry identifiers." `completeConsent` (`packages/token-vault/src/token-vault.ts:687-694`) returns `{ ok: false, refusal, intent }` and holds nothing; "keeps" reads as if it stores the error.

## Needs Further Investigation

Review 6's NFIs A to F stand unchanged; the delta touched none of their code except D:

- **D (a line state needs Studio's Views number), widened slightly by review 6 F1's fix:** a sign-in, connect or refusal line already shown is now also taken down when `#metric-total` goes missing on the same URL, and comes back after one more background read (uncached while signed out, `product-api.ts:143`). Executed by the agent's harness: placed 1, during 0, after 1, one extra read. What would confirm it matters: #99 opening the analytics page of a video published minutes ago, signed out, and watching whether Studio's Views tile ever lacks `#metric-total`. If it does, the fix is the one D already names: require `viewsNumberRow` for the figure only.

Carried, unchanged: review 3's NFI on `#key-metric-header` replaced alone between two videos (no `held` entry for the new header, so `video-row.ts:130` removes nothing and the old line, with the page before's link, stays for the read's duration, up to 15 s; the figure goes with the old header). The agent raised it again this round; it is outside the delta and stays an NFI until #99 shows Studio replacing the header without its parent. Review 4 NFI B and C; review 1 NFI C.

## Reviewed and Dismissed
- No test pins the redraw after a same-URL transient miss — executed: a mutation of the keep check (`video-row.ts:124`, ignoring disconnected hosts) turns the existing "Studio redrawing its Views tile alone gets the figure placed again in the new tile, with one line" red. The redraw is pinned.
- The removal racing an in-flight analytics read — the pass lock serializes `place` calls (`watch.ts:224-238`) and analytics has no `sweep`, so `removeSurface` cannot run while `placeRow` awaits.
- The removal taking another surface's host — `removeSurface(document, 'analytics')` matches `[data-stillstats-surface="analytics"]` only (`render.ts:142-143`).
- `renderSurface` still receiving `shown`, which carries `link` — a variable with an extra property type-checks, and the link was never drawn there since #225.
- "Each bounded at 10 seconds" in `product-api.ts` — true in production: only `apps/api/test/start-api.ts` passes `callTimeoutMs`, so the gateway and vault take `googleCallTimeoutMs`.
- Reviews 1 to 6's other dismissals stand.

## Minor / nits
- The not-found removal in `analytics.ts:73-76` carries no comment saying the flicker on a same-URL miss is the accepted price. The Approach decisions line records it; a comment is optional.
- Carried from review 6: a Google token endpoint 4xx other than `invalid_grant` at the code exchange ends on a raw 500; the revenue half of #222 tested for a 503 only; the boundary tests' narrow matches; `backgroundAnswerer`'s `undefined` for an unknown message type; the `google_failed` landing copy; the Comparison row docs not naming a non-public latest upload; and review 5's carried list.

## Test quality
Tests new or changed since `07308de`: 2 (the two `test.each` rows in `analytics.test.ts:389-405`) · red at `07308de`: 2 of 2, at runtime · green at `07308de`: 0 · tautology shapes found: none. Each row names a rule ("a move to %s while Studio has not drawn the Views number leaves nothing of the page before's figure or line"). `card.test.ts` and `studio-boundary.test.ts` changed comments only. Review 6's test-quality notes (`content-list.test.ts:1183-1188` branching on its own expected value, `analytics.test.ts:286-297` asserting on `<style>` text, `card.test.ts:817-853` named for a review item) are untouched and stand.

## Prior-review closure
Review 6 (`07308de`): 4 findings, all fully fixed. Finding 1 (MEDIUM, capped; the analytics page's stale figure and link) fixed by `e4ff338`: its repro green, the two new suite rows red at `07308de` and green now, the redraw it depends on pinned. Finding 2 (LOW, dead link branch) fixed by `3a82f63`. Finding 3 (LOW, review 3's stale repro) fixed by `690a77c`, green. Finding 4 (LOW, comment hygiene) fixed by `4ae9470`, all six entries applied; two of review 6's corrected texts were themselves imprecise, which is Finding 1 here. No prior finding is partially fixed or untouched, none was resolved by a comment edit standing in for a code fix, and the closure table records no known regression or escalation.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and `pnpm test` all green at `0f7bb7c`; the preserved repro suite green, 15 of 15.
- **Commit hygiene:** commit this doc. The tree was clean before the review; no repro was added.
- **Likely reviewer asks:** unchanged from review 6: the ready-for-human tickets under #4 (#99, #100, #101, #122, #129, #200, #202) and the needs-triage ones (#121, #126, #221); #222 to #226 open though their work is on the branch; the copy awaiting Nick's approval (#218's "Publish day" and "First N days", #225's "Data from Stillstats as of <day>. View this video in Stillstats."); #225's and #226's Chrome hand checks; review 6 NFI B before the AMO submission.

## Verdict
**Ready to open the PR as-is.** No CRITICAL, HIGH or MEDIUM defect; all four CI checks and every preserved repro pass. Review 6's four findings are all closed against their intent, its MEDIUM proved fixed in both directions by execution. The one confirmed finding is a LOW comment hygiene entry (two comment lines whose corrected wording came from review 6's own brief) and can ride in the PR or a follow-up commit; it does not gate. The confirmed count has gone 4 to 1 and from behaviour bugs to comment text, which is the review running out of real defects in this delta, not the branch stalling.
