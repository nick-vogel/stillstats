# Pre-PR review: creator-analytics#266 Web app fixes, re-review of review 4's remediation

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `1dc23c5` "Merge pull request #321 from nick-vogel/creator-analytics-266-web-app-fixes")
**Reviewed at:** HEAD `41e837e` ("creator-analytics#266 pre-PR review 4 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 5 files, +490 / −1 (`apps/web/src/App.tsx`, `apps/web/src/app.test.ts`, review 4's doc and its two `repro/` files).
**Delta under review:** since `decea94` ("creator-analytics#320 A second Disconnect of the same channel leaves a false alert until Sign out"), the commit `pre-pr-review-4.md` reviewed. 5 files, +323 / −10, of which code: `dab6be6` ("creator-analytics#266 pre-PR review 4 finding 1: a first Disconnect that fails before the re-read channel list renders leaves a false alert"), `App.tsx` +4 / −8 and `app.test.ts` +20 / −1. The rest is review 4's doc and closure table (`41e837e`).
**Reviewed against:** `pre-pr-review-4.md` (findings 1 to 3, Approach decisions, Remediation closure table), creator-analytics#319 and #320 as summarised there, `CODING_STANDARDS.md` 1 to 3. The repo has no `CLAUDE.md`. Delta-scoped, not `--fresh`.
**Date:** 2026-10-24
**Reviewer:** 1 code-review finder, 1 test-quality and mutation audit agent, + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (480 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110/110 files, 2482 passed, 1 expected fail |
| Delta tests against `decea94` | Scratch worktree at `decea94`, HEAD's `app.test.ts` copied in, `-t 'Disconnect'` | 2 red, as intended: the flipped assertion (`:580`) and the new "before the list renders" test (`:604`), both `expected 'Error: The API answered 500' to be null`. 6 green |
| HEAD tests against `$BASE` | Scratch worktree at `1dc23c5`, HEAD's `app.test.ts` copied in | 3 red (the three same-channel Disconnect tests), 94 green |
| Mutations at HEAD | Scratch worktree at `41e837e`, one at a time, `pnpm exec vitest run apps/web/src/app.test.ts` | Set check removed: 3 red. `add` removed: 3 red. `add` moved after the re-read: 2 red. `sessionNumber.current += 1` removed from `deleteYourself` only: both "fails after "Delete me" succeeds" rows red (review 4 finding 2 closed). First `clearAlertFrom` removed: 2 red |
| Review 4 repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-4-disconnect-race.vitest.config.ts` | green at HEAD (2/2), red at `decea94` (2/2) |
| Does the new test exercise the render window | Console tracing in a scratch copy of `decea94`'s `App.tsx` | The old guard read the stale list, the alert was written, and the empty list rendered only after it, inside one `act`. It does |
| Second Disconnect answering and first failing in one checkpoint (finding 1) | `repro/review-5-disconnect-retries.test.ts`, "finding 1" | red at HEAD and at `1dc23c5`, green at `decea94` |
| A second press of a channel whose re-read failed (finding 2) | Same file, "finding 2" | red at HEAD, `decea94` and `1dc23c5` (the row stays). At HEAD the press changes nothing at all |
| Recommended fix for findings 1 and 2 | Scratch worktree at HEAD with the diff below | `app.test.ts` 97/97, review 5 repro 2/2, review 4 repro 2/2, typecheck and `biome check` green. Tail clear removed: finding 1 red. Dropped failure returning before the re-read: finding 2 red. Neither mutant turns `app.test.ts` red, so both tests move into the suite |
| Real browser timing | Not run | happy-dom only. #294 is the human walk in Chrome and Safari |

**Overall:** Review 4's remediation does what it set out to do: the render-timing window is closed by a set the success writes, the Delete me row pins its guard again, and every new test goes red under its mutation. Removing the second clear reopened one narrow order that `decea94` covered, a first failure and a second success settling in one microtask checkpoint, and a retry on a channel whose list read failed after its Disconnect is now silently swallowed. Both are LOW and one small change to `disconnect` fixes both; nothing gates the PR.

## Approach decisions
- Late failures after sign-out (#302, carried): a session counter `sessionNumber` (`App.tsx:233`) that a successful Sign out or Delete me bumps. `alertOnFailure(from)` captures it when a request starts and writes the alert only while it is unchanged. `start(action, from)` is the one way a button's action attaches it.
- Clearing on a retry's success (#302, carried): the alert carries `from` (`reset`, `disconnect:<channelId>`), and that action's success clears it with `clearAlertFrom` (`App.tsx:202-203`).
- A late failure of a Disconnect whose channel another Disconnect already disconnected (review 4 finding 1, carried): the `disconnected` ref (`App.tsx:197`), a `Set` of channel ids added to synchronously when a Disconnect's POST answers and read in that action's failure catch. Precedent: `resetSinceOpened` (`App.tsx:191`). Not chosen: disabling the button or an in-flight set, which would change the `QuietButton` surface.
- **Amended by this review (finding 1 and 2):** the re-read of the channel list and the clear after it run on both paths of `disconnect`, a success and a failure the set drops. Review 4 dropped the clear after the re-read as unreachable in a browser; it stays a one-line backstop for the order the catch cannot see, because the catch and `start`'s alert write are several microtask hops apart. Precedent: `decea94`'s clear after the re-read, which review 4 replaced.
- Test gaps are closed with a test in the describe for their ticket, never with a production change, and each test must go red under the mutation its finding names (carried from reviews 1 to 4).
- The render-timing window of a Disconnect failure (carried from review 4's remediation): pinned in `app.test.ts` ("an action's alert") by the "in one act" form. The "outside act" form stays in `repro/` only.
- Remediation of findings 1 and 2 (2026-10-24): the recommended diff split into its two halves, one commit per finding: the trailing clear (finding 1) and the dropped failure falling through to the re-read (finding 2). The trailing clear carries the one load-bearing comment line the brief asked for. The dropped path's own failure, a re-read that fails on the second press, is pinned by its own test: the read's failure shows and the row stays.

## Prior-review closure
Review 4 (`pre-pr-review-4.md`): 3 findings, all LOW.
- Finding 1: fully fixed. The review 4 repro is green at HEAD and red at `decea94`, and the in-suite pin (`app.test.ts:587-605`) is red at `decea94`. The fix's removal of the second clear opens finding 1 below.
- Finding 2: fully fixed, with no diff of its own: removing the `deleteYourself` bump turns both "fails after "Delete me" succeeds" rows red (`app.test.ts:461`).
- Finding 3: untouched, deferred by Nick's scope decision (review 4's Remediation scope). Still present: `alertOf` beside the long `querySelector` form, and `holdBoth` beside item 2's own pair.
- Nothing was "resolved" only by a comment or a doc edit. No prior MEDIUM-or-higher findings existed.

## Confirmed Issues
### 1. A first Disconnect failing in the same moment a second one of the channel answers still leaves a false alert — LOW
- **Location:** `apps/web/src/App.tsx:362-371` (`disconnect`)
- **Attribution:** introduced by `dab6be6` (review 4's remediation), as a removal: `decea94` had `clearAlertFrom(disconnectAlertOf(channelId))` after `setChannels(await readChannels())`, and the repro is green there. It is red at `$BASE` (`1dc23c5`), where #320's defect was still open, so this is the part of #320's defect the remediation reopened. Review 4's brief dropped the clear on purpose ("Must preserve", finding 1: "needs two network answers in one browser task, so it is not reachable"); this review agrees on reachability and disagrees on dropping a one-line backstop.
- **Real-world trigger:** none known in a browser. The two answers must settle in one microtask checkpoint, and the Fetch standard delivers each response and each body read as its own task. LOW, capped: the consequence is a false alert, a confusing display. Upgrade to MEDIUM if #294's browser walk shows an alert surviving a double Disconnect.

**Evidence**
```ts
const answer = await disconnectChannel(channelId).catch((reason: unknown) => {
  if (disconnected.current.has(channelId)) return null
  throw reason
})
if (answer === null) return
disconnected.current.add(channelId)
const { text, asksToAct } = answer
clearAlertFrom(disconnectAlertOf(channelId))
showSuccess(text, asksToAct)
setChannels(await readChannels())
```

**Failure mode** — the first Disconnect's catch checks the set, then its rejection travels through `await`, the async function's rejection and `start`'s `.catch(showError)` before the alert is written. When the second Disconnect's POST answers in that gap, its `add` and its clear run after the check and before the write, and the alert stays beside the success toast with nothing left to clear it. `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-5-disconnect-retries.vitest.config.ts -t 'finding 1'`: both POSTs held, `second.release(); first.fail()` in one `act`, fails with `expected 'Error: The API answered 500' to be null`. With `fail('network')` it shows "TypeError: Failed to fetch". The reverse order passes.

**Recommended fix** (with finding 2's, one diff)
```diff
@@ apps/web/src/App.tsx (disconnect)
     const answer = await disconnectChannel(channelId).catch((reason: unknown) => {
       if (disconnected.current.has(channelId)) return null
       throw reason
     })
-    if (answer === null) return
-    disconnected.current.add(channelId)
-    const { text, asksToAct } = answer
-    clearAlertFrom(disconnectAlertOf(channelId))
-    showSuccess(text, asksToAct)
+    if (answer !== null) {
+      disconnected.current.add(channelId)
+      clearAlertFrom(disconnectAlertOf(channelId))
+      showSuccess(answer.text, answer.asksToAct)
+    }
     setChannels(await readChannels())
+    clearAlertFrom(disconnectAlertOf(channelId))
   }
```
Then move both tests of `repro/review-5-disconnect-retries.test.ts` into `app.test.ts`'s "an action's alert" describe, after "shows none of a first "Disconnect" that fails after a second one's channels read answers, before the list renders" (`:587-605`), using its helpers (`render`, `buttonNamed`, `buttonsNamed`, `click`, `alertOf`, `disconnectRoute`) in place of the repro's copies. The trailing clear needs one load-bearing comment line (Standard 1), naming the order in Design intent below.

**Remediation brief**
- **Design intent:** a Disconnect failure is untrue once any Disconnect of the same channel has succeeded (the API disconnects in one transaction, `apps/api/src/app.ts:234-241`, and a channel comes back only through a full page load, `goToGoogle`, `App.tsx:91-96`). The `disconnected` set records the success the moment it is known, and the catch drops a failure of a channel in it. The catch cannot see a success that lands between its check and `start`'s alert write, a few microtask hops later, so the clear after the re-read is the backstop: by the time the list has been read again, every such write has landed. A failure that lands before any success still shows, and that success's first clear removes it.
- **Full surface:** `apps/web/src/App.tsx:366-371` only. `disconnect` has one caller (`App.tsx:458`, `start(() => disconnect(channelId), disconnectAlertOf(channelId))`). Tests: `apps/web/src/app.test.ts`, the "an action's alert" describe (`:496`), two new tests.
- **Must preserve:** `track({ name: 'disconnect_channel_clicked' })` and the confirm stay first. The order add, then first clear, then `showSuccess`, pinned by "goes once a second "Disconnect" succeeds" (`:502`) and "of a failed "Disconnect" goes with the success toast of a second one, before the channels are read" (`:607-626`). The per-channel tag, "keeps one channel's failed Disconnect alert when another channel disconnects" (`:531`). No success toast on a dropped failure. The session guard for a Disconnect failing after Sign out (`:443`) and Delete me (`:461`), both rows. The three same-channel tests (`:547-605`) unchanged.
- **Do not touch:** `alertOnFailure`, `start`, `clearAlertFrom`, `disconnectAlertOf`, `sessionNumber` (Reviewed and Dismissed). The `QuietButton` in `Profile.tsx`: no disabled state (Approach decisions).
- **Failure of the fix:** if the re-read fails, `start` writes the read's own failure tagged `disconnect:<channelId>`, which is true, and the trailing clear is not reached; the same as a success whose re-read fails today. A dropped failure that lands after Sign out or Delete me now issues a channels read; the real API refuses it with 401 and the session guard drops that alert, so nothing reaches the signed-out screen. The fake API answers it, so a test of that order would see `setChannels` run on the signed-out screen, which renders no channels.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-5-disconnect-retries.vitest.config.ts` is red now (2 failed) and must be green after; then `pnpm exec vitest run apps/web/src/app.test.ts` green (99 tests with the two moved in), red before the `App.tsx` change for exactly the two new tests. In a scratch worktree at the fix, deleting the trailing `clearAlertFrom(disconnectAlertOf(channelId))` must turn the finding 1 test red. Checked in review against the repro: it does, and `app.test.ts` without the moved tests stays green, which is why they move in.
- **Escalation:** this is the third change to the Disconnect false-alert guard (`02c2334` #320, `dab6be6` review 4, this one). The fix is not a rewrite: it restores `decea94`'s trailing clear and lets the dropped path share the re-read. If a sixth review finds another window here, stop and file a split ticket with its own test matrix of answer orders rather than a fourth in-place change.

### 2. After a Disconnect succeeds but its channel list read fails, pressing that channel's Disconnect again does nothing at all — LOW
- **Location:** `apps/web/src/App.tsx:363,366`
- **Attribution:** pre-existing, exposed. The stale row is pre-existing: at `$BASE` and `decea94` a failed re-read also leaves the channel listed (the repro's "finding 2" is red at both). `dab6be6` changed what a second press does: at `decea94` the catch saw the channel still listed and rethrew the server's refusal as an alert; at HEAD the set holds the channel, the catch returns null, and the press changes nothing.
- **Real-world trigger:** a creator disconnects a channel on a flaky connection. The POST succeeds and the list read after it fails, so they see the success toast, an alert "Error: The API answered 500", and the channel still listed. They press its Disconnect again to retry, confirm, and nothing happens; the row stays until a page load. LOW: a confusing display, two failures deep.

**Evidence** — `if (disconnected.current.has(channelId)) return null` then `if (answer === null) return`: a dropped failure skips the re-read too. The server refuses the second POST (`not_connected`, `packages/accounts/src/accounts.ts`).

**Failure mode** — `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-5-disconnect-retries.vitest.config.ts -t 'finding 2'`: `api.failNext('GET /api/channels')`, Disconnect, then Disconnect again; fails with `expected [ <button …(2)></button> ] to have a length of +0 but got 1`.

**Recommended fix** — finding 1's diff: a dropped failure re-reads the list, so the retry the creator meant now shows the channel gone, and the trailing clear removes the earlier read failure's alert once a read succeeds.

**Remediation brief**
- **Design intent:** a press on a channel the app already knows is disconnected should bring the screen up to date, not stay silent: the drop is right about the failure, and the stale list is what the creator is acting on.
- **Full surface:** finding 1's.
- **Must preserve:** finding 1's.
- **Do not touch:** finding 1's.
- **Proof:** the "finding 2" test of `repro/review-5-disconnect-retries.test.ts`, red now and green after, moved into `app.test.ts` as finding 1 says. In a scratch worktree at the fix, putting `if (answer === null) return` back before the `if (answer !== null)` block must turn it red. Checked in review: it does.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The `disconnected` set hides a true failure: no. A channel enters it only when the server has accepted its Disconnect, and every reconnect or sign-in is a full page load (`goToGoogle`, `App.tsx:91-96`; `git grep location.assign apps/web/src` finds no other path), so the set starts empty again.
- A Disconnect failure after Delete me is now dropped by the set before the session guard: no. A channel whose Disconnect never succeeded is not in the set; the mutation table shows the Delete me Disconnect row red without the bump.
- The catch rethrows something other than the original: no, `throw reason`.
- A successful Disconnect whose re-read fails writes an alert tagged `disconnect:<channelId>` beside the success toast: the read's own true failure, same at `$BASE` (carried from review 4). After finding 1's fix a later successful read of the same press path clears it, which is right.
- `alertOnFailure`, `start`, `clearAlertFrom`, `disconnectAlertOf` and `sessionNumber`: #302's mechanism, unchanged, each half pinned by #319.
- The new comment at `App.tsx:196`: load-bearing and accurate. No comment still names the removed `channelsOnView` check (`grep -n "channelsOnView\|no longer holds\|Again, for" apps/web/src/App.tsx apps/web/src/app.test.ts` finds nothing).
- No `track()` call changed, so no OpenPanel question arises.

## Minor / nits
- `App.tsx:197` names the ref `disconnected`, and `disconnectChannel` (`App.tsx:147`) has a local string `disconnected`. Different scopes, nothing shadowed, but two meanings fifty lines apart; `disconnectedChannels` would read cleaner if the line is touched again.
- `useRef(new Set<string>())` builds a throwaway `Set` each render; `useState(() => new Set<string>())` matches the lazy initialisers beside it (`App.tsx:194-195`). Negligible cost.
- The new test (`app.test.ts:587-605`) and the flipped `:580` assert only that no alert is left, not that the first failure was delivered. The `decea94` red run shows the path is reached.

## Test quality
Tests added in the delta: 1 case, plus 1 flipped assertion (`:580`). Red against `decea94`: both, as intended. Red against `$BASE`: both, along with "fails after a second one of the channel succeeds". Mutation audit: every guard of `disconnect` and the `deleteYourself` bump is killed by at least one test. Tautology shapes: none; expectations are literals, the unit is not mocked (only `fetch` and `track`), no call-shaped assertion, snapshot or prose assertion. Keep every test. Finding 1 and 2's tests join the suite.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite green at `41e837e`. The review 5 repro files pass `biome check`, are outside the root vitest include, and do not run in CI.
- **Commit hygiene:** commit this doc with `repro/review-5-disconnect-retries.test.ts` and its `.vitest.config.ts`. No scratch left in the tree.
- **Likely reviewer asks:** why a clear after the re-read when the set already drops late failures (finding 1, Design intent); why a dropped failure reads the list (finding 2).

## Verdict
**Ready to open the PR as-is.** Both findings are LOW and neither gates it; the confirmed count shrank from three behaviour-and-test findings to two narrow behaviour findings, both downstream of the same one-line removal, which is the expected shape for a remediation re-review. One small change to `disconnect`, with the two repro tests moved into the suite, fixes both and is cheap to do before the PR. Review 4's findings 1 and 2 are fully closed; finding 3 stays open by Nick's scope decision. Nothing was "resolved" only by a comment or a doc edit. This is the third change to the Disconnect false-alert guard: a further window found here should become a split ticket, not another in-place change.

## Remediation, 2026-10-24
Scope: Nick's close-out decision, 2026-10-24: fix confirmed findings 1 and 2, both LOW. This replaces the default CRITICAL, HIGH and MEDIUM scope. The Escalation note on finding 1 was read as written: this round is the brief's own recommended change, and the split-ticket threshold is a sixth review finding another window.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (LOW) | `ac05387` creator-analytics#266 pre-PR review 5 finding 1: a first Disconnect failing in the same moment a second one of the channel answers leaves a false alert | red then green: `pnpm exec vitest run apps/web/src/app.test.ts`, "shows none of a first "Disconnect" that fails as a second one of the channel answers" (moved in from the repro). Mutant in a scratch worktree at `f5c552c`: trailing clear removed turns it red | 1 (the brief's load-bearing line naming the order the set check cannot see) | proved by execution |
| 2 (LOW) | `f5c552c` creator-analytics#266 pre-PR review 5 finding 2: after a Disconnect succeeds but its channels read fails, a second press of that channel does nothing | red then green: same file, "of a "Disconnect" whose channels read failed goes, with the channel, on a second press" (moved in from the repro, plus an alert assertion) and "shows the channels read failure of a second press of a disconnected channel" (the new path failing). Mutant: `if (answer === null) return` put back before the `if (answer !== null)` block turns both red | 0 | proved by execution |

Also run at `f5c552c`: `app.test.ts` 100/100; review 5 repro 2/2 and review 4 repro 2/2 green (both stay outside the root vitest include); `pnpm lint`, `pnpm typecheck`, `pnpm build` green; `pnpm test` 110/110 files, 2485 passed, 1 expected fail. No verify agent: both fixes are LOW, proved by execution, and their preserve-suites (the "an action's alert", "a failed sign-out" and Delete me rows of `app.test.ts`) pass.

### Known regressions, deferred
None.

### Rework briefs
None.
