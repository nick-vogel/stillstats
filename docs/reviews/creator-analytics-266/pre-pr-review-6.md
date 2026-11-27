# Pre-PR review: creator-analytics#266 Web app fixes, re-review of review 5's remediation

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `1dc23c5` "Merge pull request #321 from nick-vogel/creator-analytics-266-web-app-fixes")
**Reviewed at:** HEAD `4b64f1f` ("creator-analytics#266 pre-PR review 5 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 8 files, +804 / −3 (`apps/web/src/App.tsx`, `apps/web/src/app.test.ts`, review 4 and 5's docs and their four `repro/` files).
**Delta under review:** since `41e837e` ("creator-analytics#266 pre-PR review 4 remediation closure table"), the commit `pre-pr-review-5.md` reviewed. 5 files, +317 / −5, of which code: `ac05387` ("creator-analytics#266 pre-PR review 5 finding 1: a first Disconnect failing in the same moment a second one of the channel answers leaves a false alert") and `f5c552c` ("creator-analytics#266 pre-PR review 5 finding 2: after a Disconnect succeeds but its channels read fails, a second press of that channel does nothing"), together `App.tsx` +7 / −5 and `app.test.ts` +50. The rest is review 5's doc, its repro and its closure table (`90e3d5b`, `4b64f1f`).
**Reviewed against:** `pre-pr-review-5.md` (findings 1 and 2, Approach decisions, Remediation closure table), creator-analytics#319 and #320 as summarised there, `CODING_STANDARDS.md` 1 to 3. The repo has no `CLAUDE.md`. Delta-scoped, not `--fresh`.
**Date:** 2026-10-24
**Reviewer:** 1 code-review finder + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (482 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110/110 files, 2485 passed, 1 expected fail |
| Delta tests against `41e837e` | Scratch worktree at `41e837e`, HEAD's `app.test.ts` copied in | the 3 new tests red (`:607`, `:627`, `:642`), 97 green |
| Mutations at HEAD | Scratch worktree at `4b64f1f`, one at a time, `pnpm exec vitest run apps/web/src/app.test.ts` | Trailing clear removed: `:607`, `:627` red. `if (answer === null) return` put back: `:627`, `:642` red. First clear removed: `:657` red. Set check removed: 5 red. `add` removed: 5 red. Trailing clear moved before the read: `:607` red (finder). Trailing clear on one path only: `:607` or `:627` red (finder) |
| Success toast on a dropped failure (finding 1) | Mutant: `else showSuccess('The channel is disconnected. Its data is deleted within 24 hours.', false)` after the `if (answer !== null)` block | `app.test.ts` 100/100 green under it. `repro/review-6-dropped-disconnect-toast.test.ts` green at HEAD, red under it |
| Review 4 and 5 repros, `sign-out-and-reset` repro | `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/<name>.vitest.config.ts` | 2/2, 2/2, 4/4 green at HEAD |
| A dropped failure's read after Sign out or Delete me | Reading `signOut` (`App.tsx:405-412`), `deleteYourself` (`:375-386`), `alertOnFailure` (`:234-239`) | The real API answers 401, `assertAnswered` throws, and the session guard drops the alert. Not executed |
| Real browser timing | Not run | happy-dom only. #294 is the human walk in Chrome and Safari |

**Overall:** Review 5's remediation does what it set out to do: both repro tests are green, the three new suite tests are red at `41e837e`, and every guard of `disconnect` is killed by at least one test. No new window in the Disconnect false-alert guard turned up. What remains is one test gap the fall-through opened (nothing pins that a dropped failure shows no success toast) and one comment that names only half of what its line does. Both are LOW, and neither gates the PR.

## Approach decisions
- Late failures after sign-out (#302, carried): a session counter `sessionNumber` (`App.tsx:233`) that a successful Sign out or Delete me bumps. `alertOnFailure(from)` captures it when a request starts and writes the alert only while it is unchanged. `start(action, from)` is the one way a button's action attaches it.
- Clearing on a retry's success (#302, carried): the alert carries `from` (`reset`, `disconnect:<channelId>`), and that action's success clears it with `clearAlertFrom` (`App.tsx:202-203`).
- A late failure of a Disconnect whose channel another Disconnect already disconnected (review 4 finding 1, carried): the `disconnected` ref (`App.tsx:197`), a `Set` of channel ids added to synchronously when a Disconnect's POST answers and read in that action's failure catch. Not chosen: disabling the button or an in-flight set, which would change the `QuietButton` surface.
- The re-read and the trailing clear run on both paths of `disconnect`, a success and a failure the set drops (review 5 findings 1 and 2, carried). The trailing clear is the backstop for a failure that passed the set check before a success's add; on the dropped path it also clears an earlier press's failed read once a read succeeds. Not chosen (this review, finder's alternative): re-checking the set at the alert write through a new `start` parameter, which would close the one-round-trip overlap in Dismissed but widen `start`'s surface for an order no browser produces.
- Test gaps are closed with a test in the describe for their ticket, never with a production change, and each test must go red under the mutation its finding names (carried from reviews 1 to 5).
- The render-timing window of a Disconnect failure (carried from review 4's remediation): pinned in `app.test.ts` ("an action's alert") by the "in one act" form. The "outside act" form stays in `repro/` only.

## Prior-review closure
Review 5 (`pre-pr-review-5.md`): 2 findings, both LOW.
- Finding 1: fully fixed. `repro/review-5-disconnect-retries.test.ts` "finding 1" green at HEAD; its suite copy (`app.test.ts:607`) is red at `41e837e` and red with the trailing clear removed.
- Finding 2: fully fixed. The suite copy (`app.test.ts:627`) and the new read-failure test (`:642`) are red at `41e837e` and red with the early return put back. The fall-through opens finding 1 below, a test gap and not a defect.
- Review 4 finding 3 (LOW, test helper duplication): still untouched, deferred by Nick's scope decision in review 4's Remediation scope.
- Nothing was "resolved" only by a comment or a doc edit. No prior MEDIUM-or-higher findings existed.

## Confirmed Issues
### 1. Nothing tests that a dropped Disconnect failure shows no success toast — LOW
- **Location:** `apps/web/src/App.tsx:366-374` (`disconnect`); `apps/web/src/app.test.ts:627-655`
- **Attribution:** introduced by `f5c552c` (review 5 finding 2's fix), as a coverage loss. At `41e837e`, `if (answer === null) return` sat before `showSuccess`, so a dropped failure could not reach a toast by construction. At HEAD the dropped path falls through to the re-read, and only the `if (answer !== null)` branch keeps the toast out. Review 5's brief listed "No success toast on a dropped failure" under Must preserve, and no test pins it.
- **Real-world trigger:** none today; the code is right. The gap bites when a later change to `disconnect` puts a toast on the dropped path: a creator pressing Disconnect a second time on a channel already disconnected would see a second "The channel is disconnected" toast for a press the server refused. LOW: a test gap, and its regression would be a confusing display.

**Evidence**
```ts
if (answer !== null) {
  disconnected.current.add(channelId)
  clearAlertFrom(disconnectAlertOf(channelId))
  showSuccess(answer.text, answer.asksToAct)
}
setChannels(await readChannels())
```

**Failure mode** — with `else showSuccess('The channel is disconnected. Its data is deleted within 24 hours.', false)` added after the block, `pnpm exec vitest run apps/web/src/app.test.ts` stays 100/100 green. The first press's own toast hides the second one in every existing test, because both carry the same text. `repro/review-6-dropped-disconnect-toast.test.ts` closes the first toast before the second press and asserts none comes back; it is green at HEAD and fails under the mutant with `expected 'The channel is disconnected. Its data…' to be null`.

**Recommended fix** — move the repro's test into `app.test.ts`'s "an action's alert" describe, after "of a "Disconnect" whose channels read failed goes, with the channel, on a second press" (`:627-640`), using the file's own helpers (`render`, `buttonNamed`, `buttonsNamed`, `buttonLabelled`, `click`, `toastText`, and `toastCloseLabel`, already imported at `:31`):
```diff
@@ apps/web/src/app.test.ts ("an action's alert", after :640)
+  test('of a second press of a disconnected channel shows no success toast', async () => {
+    const api = installFakeApi()
+    const { container } = await render('profile')
+
+    api.failNext('GET /api/channels')
+    await click(buttonNamed(container, 'Disconnect'))
+    expect(api.channels).toEqual([])
+    await click(buttonLabelled(container, toastCloseLabel))
+    expect(toastText(container)).toBeNull()
+
+    await click(buttonNamed(container, 'Disconnect'))
+
+    expect(buttonsNamed(container, 'Disconnect')).toHaveLength(0)
+    expect(toastText(container)).toBeNull()
+  })
```
No production change.

**Remediation brief**
- **Design intent:** a dropped failure is a press the server refused because the channel is already gone (`not_connected`). The app treats it as a request to bring the screen up to date: it re-reads the list and clears the channel's stale alert, and it claims no success of its own, since it disconnected nothing. The toast belongs to the press that did.
- **Full surface:** `apps/web/src/app.test.ts` only, one new test after `:640`. No change to `App.tsx`.
- **Must preserve:** every existing test of the "an action's alert" describe (`:496` onward) unchanged, in particular `:627` (the second press's re-read clears the alert) and `:642` (the second press's read failure shows). One rule per test (Standard 2): the new test asserts the toast rule only, with the list assertion as the sign that the second press ran.
- **Do not touch:** the `disconnect` body (`App.tsx:359-374`), `start`, `alertOnFailure`, `clearAlertFrom`, `showSuccess`, the `Toast` component. See Reviewed and Dismissed.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-6-dropped-disconnect-toast.vitest.config.ts` is green at HEAD (the test pins present behaviour). After the move, `pnpm exec vitest run apps/web/src/app.test.ts` is 101/101 green; in a scratch worktree, adding `else showSuccess('The channel is disconnected. Its data is deleted within 24 hours.', false)` after the `if (answer !== null)` block of `disconnect` must turn the new test red. Checked in review against the repro: it does.

### 2. Comment hygiene — LOW (aggregated)
- `apps/web/src/App.tsx:372` — `// Any failure that passed the set check before the add has written its alert by now.` → `// Untrue once the channels are read: an earlier press's failed read, and a Disconnect failure that passed the set check before a success's add, whose alert has landed by then.` (The current line names only the success path's job; on the dropped path this press made no add, and the line's job there, clearing an earlier press's failed read, is the one `:627` pins.)

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The trailing clear erases a true alert: no. It clears only `disconnect:<channelId>` for this channel, and it runs only once the page holds a success for the channel (this press added it, or the set already held it). A failure from before any success never meets it while true; another channel's alert and the channels effect's alert (`from: null`) carry other tags.
- One press's failed channels read survives or not depending on which of two reads answers last (finder 3): either outcome is a true statement about a read; when the alert survives, the list beside it is already fresh, and the next successful read of any press clears it. Not a defect.
- In the same-checkpoint race, the false alert shows for as long as the second press's channels read takes (finder 4): the residual review 5 accepted when it chose the trailing clear as a backstop. The order needs two network answers in one microtask checkpoint, which the Fetch standard does not produce. See Approach decisions for the rejected alternative.
- A dropped failure that lands after Sign out or Delete me now reads the channels: the real API answers 401, `assertAnswered` throws, and `start`'s `alertOnFailure` sees a changed `sessionNumber` and writes nothing. If a read did answer, `setChannels` lands on the signed-out screen, which renders no channels, and every sign-in is a full page load (`goToGoogle`, `App.tsx:91-96`). Same as a late success's re-read at `41e837e`.
- `track`, the confirm, and the success path's order (add, first clear, `showSuccess`) are unchanged in the diff; `:657` pins the first clear.
- No `track()` call changed, so no OpenPanel question arises.

## Minor / nits
- `disconnectAlertOf(channelId)` is now computed twice in `disconnect` (`App.tsx:368`, `:373`). A `const alert = disconnectAlertOf(channelId)` at the top would read cleaner if the function is touched again. Cosmetic.
- Carried from review 5: the ref name `disconnected` beside `disconnectChannel`'s local string `disconnected` (`App.tsx:147`), and `useRef(new Set<string>())` building a throwaway `Set` each render.

## Test quality
Tests added in the delta: 3 (`app.test.ts:607`, `:627`, `:642`). Red against `41e837e`: all 3, as intended. Red against `$BASE`: all 3 (review 5's repro rows were red there). Mutation audit: each is killed by a different set of `disconnect` mutants, so none duplicates another's rule or an earlier same-channel test's (`:547`, `:568`, `:588` pass under every delta mutant). Tautology shapes: none; expectations are literals, only `fetch` and `track` are faked, no call-shaped, snapshot or prose assertion. Keep every test. Finding 1 adds one.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite green at `4b64f1f`. The review 6 repro files pass `biome check`, sit outside the root vitest include, and do not run in CI.
- **Commit hygiene:** commit this doc with `repro/review-6-dropped-disconnect-toast.test.ts` and its `.vitest.config.ts`. No scratch left in the tree.
- **Likely reviewer asks:** why the dropped path re-reads the list (review 5 finding 2), and why a clear runs after the read when the set already drops late failures (review 5 finding 1).

## Verdict
**Ready to open the PR as-is.** Zero CRITICAL, HIGH or MEDIUM findings; two LOW: a test gap the fall-through opened and one comment. The confirmed count went from two narrow behaviour findings to one test gap and comment hygiene, which is the expected shape once a remediation has converged. Review 5's findings 1 and 2 are fully closed, proved by execution; review 4 finding 3 stays open by Nick's scope decision. Nothing was "resolved" only by a comment or a doc edit. Review 5's escalation tripwire (a sixth review finding another window in the Disconnect false-alert guard) did not fire: no new window was found, so no split ticket is called for.
