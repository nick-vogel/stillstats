# Pre-PR review: creator-analytics#266 Web app fixes, stage 2 of the fourth run: #319 and #320

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `1dc23c5` "Merge pull request #321 from nick-vogel/creator-analytics-266-web-app-fixes")
**Reviewed at:** HEAD `decea94` ("creator-analytics#320 A second Disconnect of the same channel leaves a false alert until Sign out"). The tree was clean, with no uncommitted or untracked files at review time. 2 files, +177 / −1 against the merge-base. The branch equals origin/main plus two stage-2 tickets: #319 (`126cec3`, merge `0ec4c6d`, test-only) and #320 (`02c2334`, its review-pass proof `ddb8d96`, merge `decea94`).
**Reviewed against:** creator-analytics#319 and #320 (read in full; their "Done when" lists are the requirements), the epic body of creator-analytics#266 (Implementation and Testing Decisions), `CODING_STANDARDS.md` 1 to 3, and `pre-pr-review-3.md` Approach decisions (findings 1 and 2 there became #319). A full review (`--fresh`), not delta-scoped. The repo has no `CLAUDE.md`.
**Date:** 2026-10-22
**Reviewer:** 2 agents (1 code-review finder, 1 test-quality and mutation audit) + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (478 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up, `TEST_DATABASE_ADMIN_URL` unset) | 110/110 files, 2481 passed, 1 expected fail |
| New tests against `$BASE` (tautology oracle) | Scratch worktree at `1dc23c5`, HEAD's `app.test.ts` copied in | #320's "fails after a second one succeeds" and "fails while a second one reads the channels" red. The seven #319 tests and #320's "goes with the success toast" green, as intended: #319 pins existing guards, and the toast test is `ddb8d96`'s pin of the existing first clear |
| #319 mutations at HEAD | Scratch worktree at `decea94`, one mutation at a time, `pnpm exec vitest run apps/web/src/app.test.ts -t <name>` | Items 2, 3 (both variants), 4 and 5: their tests red. Item 1 (`sessionNumber.current += 1` removed from `deleteYourself`): the Reset preferences row red, **the Disconnect row green** (finding 2). The same row is red under that mutation at `$BASE` |
| #320 mutations at HEAD | Same harness | Channel-list drop removed: "after a second one succeeds" red, "while a second one reads" **green**. Second clear removed: "while a second one reads" red. First clear removed: "goes with the success toast" red |
| Render-timing window in #320's guard | Repro `repro/review-4-disconnect-race.test.ts`, outside `act` (render scheduled as a Scheduler task, as in a browser) and inside one `act` | Both red: "Error: The API answered 500" stays after the channel is gone (finding 1) |
| Recommended fix for findings 1 and 2 | Scratch worktree at HEAD with finding 1's diff and its test edit applied | `app.test.ts` 96/96 green, repro 2/2 green, web typecheck and biome green. Mutations: `deleteYourself` bump removed, both Delete me rows red; set check removed, or `add` removed, both same-channel tests red; first clear removed, 2 red |
| Can the drop hide a true failure | Read `setChannels` callers (`App.tsx:279`, `:373`, `:386`) and the API's disconnect (`apps/api/src/app.ts:234-241`, one transaction) | No: see Reviewed and Dismissed |
| A reconnect without a page load | `git grep location.assign apps/web/src` | Every connect and sign-in goes through `goToGoogle` (`App.tsx:91-96`), a full page load, so App state starts over |
| Real browser timing | Not run | happy-dom only. #294 is the human walk in Chrome and Safari |

**Overall:** Both tickets do what their "Done when" asks, and the full checks are green. #320's guard reads the channel list as it was at the last render, so a first Disconnect failure that lands between the list read and React's render still leaves the false alert for good, and the same guard now catches a late Disconnect failure after Delete me before the session guard does, so one #319 row stops pinning its guard. One small change fixes both: record the channel at the moment its Disconnect succeeds, as `resetSinceOpened` does for a reset. All three findings are LOW, and no finding gates the PR.

## Approach decisions
- Late failures after sign-out (#302, carried from review 3): a session counter `sessionNumber` (`App.tsx:234`) that a successful Sign out or Delete me bumps. `alertOnFailure(from)` captures the counter when a request starts and writes the alert only while it is unchanged. `start(action, from)` is the one way a button's action attaches it.
- Clearing on a retry's success (#302, carried from review 3): the alert carries `from` (`reset`, `disconnect:<channelId>`), and that action's success clears it with `clearAlertFrom` (`App.tsx:203-204`).
- A late failure of a Disconnect whose channel another Disconnect of it already disconnected (#320, **overrides the shipped channel-list check** at `App.tsx:181-183,363-368,374-375`): a `disconnected` ref holding a `Set` of channel ids, added to synchronously when a Disconnect's POST answers, and read in that action's failure catch. Precedent: `resetSinceOpened` (`App.tsx:194`, set in `resetPreferences` at `:396` the moment the reset answers, read by a first preferences read landing later). It depends on no render, and it leaves a Disconnect failure after Delete me to the session guard. Not chosen: disabling the button or an in-flight set (the ticket's other candidate), which would change the `QuietButton` surface and the issue's proof test's precondition `button.disabled === false`.
- Test gaps are closed with a test in the describe for their ticket, never with a production change, and each test must go red under the mutation its finding names (carried from reviews 1 to 3).
- The render-timing window of a Disconnect failure (remediation of review 4, finding 1): pinned inside the suite in `app.test.ts` ("an action's alert") by the repro's "in one act" form, the held channels read released and the first Disconnect failed in one `act`, which defers the render as a browser does. The repro's "outside act" form, which toggles `IS_REACT_ACT_ENVIRONMENT`, stays in `repro/` only.

## Confirmed Issues
### 1. A first Disconnect that fails before the re-read channel list renders still leaves the false alert for good — LOW
- **Location:** `apps/web/src/App.tsx:181-183` (`channelsOnView`, written during render) and `apps/web/src/App.tsx:363-375` (`disconnect`)
- **Attribution:** introduced by `02c2334` (#320). `git show 1dc23c5:apps/web/src/App.tsx | grep -n channelsOnView` finds nothing; the defect #320 fixes was pre-existing, and this is the part of it the fix leaves open.
- **Real-world trigger:** a creator presses Disconnect twice on one channel on a slow connection (#320's own path). The second POST succeeds, its channels read answers, and the first POST's 500 or dropped connection arrives in the one task before React renders the new list. LOW, capped: the consequence is a false alert (a confusing display, MEDIUM at most), and the window is about one task wide on top of a double press and a failed request. Upgrade to MEDIUM if #294's browser walk, or a report, shows the alert surviving a double Disconnect.

**Evidence**
```ts
const channelsOnView = useRef(channels)
channelsOnView.current = channels
...
const answer = await disconnectChannel(channelId).catch((reason: unknown) => {
  const listed = channelsOnView.current
  if (listed === null || listed.some(({ id }) => id === channelId)) throw reason
  return null
})
...
setChannels(await readChannels())
clearAlertFrom(disconnectAlertOf(channelId))
```

**Failure mode** — `channelsOnView.current` changes only when App renders. The second Disconnect calls `setChannels(newList)` and its second `clearAlertFrom` synchronously, outside a React event, so React renders on a later Scheduler task. A first failure landing before that render reads the old list, which still holds the channel, rethrows, and `start`'s `showError` writes the alert after the clear has run. Nothing clears it until Sign out. Proved by `repro/review-4-disconnect-race.test.ts`: "outside act" runs with `IS_REACT_ACT_ENVIRONMENT = false`, so React schedules the render as in a browser, and fails with `expected <p role="alert"></p> to be null` ("Error: The API answered 500"). "in one act" is red for the same reason. The suite's "while a second one reads the channels" test (`app.test.ts:568-586`) also pins this window's false alert as expected behaviour: at `:580` it asserts `'Error: The API answered 500'` while `api.channels` is already `[]`, so it stays green when the channel-list drop is removed entirely, and only the second clear makes it pass.

**Recommended fix**
```diff
@@ apps/web/src/App.tsx (App, state)
   const [channels, setChannels] = useState<ListedChannel[] | null>(null)
-  // The channels on view when a disconnect fails, which can come after a later one succeeded.
-  const channelsOnView = useRef(channels)
-  channelsOnView.current = channels
   // Its own value, not the error, so a landing message does not end the wait.
@@
   const [saves] = useState(saveTracker)
+  const disconnected = useRef(new Set<string>())
   const [error, setError] = useState<Alert | null>(
@@ apps/web/src/App.tsx (disconnect)
     const answer = await disconnectChannel(channelId).catch((reason: unknown) => {
-      // A failure of a channel the list no longer holds is untrue: another Disconnect of it won.
-      const listed = channelsOnView.current
-      if (listed === null || listed.some(({ id }) => id === channelId)) throw reason
-      return null
+      if (disconnected.current.has(channelId)) return null
+      throw reason
     })
     if (answer === null) return
+    disconnected.current.add(channelId)
     const { text, asksToAct } = answer
     clearAlertFrom(disconnectAlertOf(channelId))
     showSuccess(text, asksToAct)
     setChannels(await readChannels())
-    // Again, for an earlier Disconnect of the channel that failed while the list was read.
-    clearAlertFrom(disconnectAlertOf(channelId))
   }
@@ apps/web/src/app.test.ts:578-580 ("while a second one of the channel reads the channels")
     await act(async () => first.fail())
     await settle()
-    expect(alertOf(container)).toBe('Error: The API answered 500')
+    expect(alertOf(container)).toBeNull()
```
The `disconnected` ref needs a one-line load-bearing comment in the code (Standard 1): why it exists, which is the Design intent's first sentence below.

**Remediation brief**
- **Design intent:** a Disconnect failure is untrue once any Disconnect of the same channel has succeeded, because the API disconnects in one transaction (`apps/api/src/app.ts:234-241`) and the channel cannot come back without a full page load (`goToGoogle`, `App.tsx:91-96`). So the fact is recorded synchronously at the moment the success is known, not read back from rendered state. A failure that lands before any success still shows, and that success's first `clearAlertFrom` (before `showSuccess`) removes it. A Disconnect failure after Delete me or Sign out is left to the session guard (`alertOnFailure`, `App.tsx:235-240`), as every other action's is.
- **Full surface:** `apps/web/src/App.tsx:181-183` (remove `channelsOnView` and its comment), `apps/web/src/App.tsx:199` (add `disconnected` beside the other refs; any spot in App's body above `disconnect` works), `apps/web/src/App.tsx:363-368` (the catch), `apps/web/src/App.tsx:369` (add after the null return), `apps/web/src/App.tsx:374-375` (remove the second clear and its comment), `apps/web/src/app.test.ts:580` (the mid-test assertion flips to `toBeNull()`). `channelsOnView` has no other reader (`grep -n channelsOnView apps/web/src/App.tsx` gives only `:182,:183,:365`).
- **Must preserve:** the first `clearAlertFrom(disconnectAlertOf(channelId))` before `showSuccess`, pinned by "goes once a second "Disconnect" succeeds" and "of a failed "Disconnect" goes with the success toast of a second one, before the channels are read" (`app.test.ts:588-606`). The per-channel tag: "keeps one channel's failed Disconnect alert when another channel disconnects" (`:531-545`). The session guard for a Disconnect failing after Sign out (`:440-456`) and after Delete me (`:458-474`). "shows none of a first "Disconnect" that fails after a second one of the channel succeeds" (`:547-566`) unchanged, including its preconditions. `track({ name: 'disconnect_channel_clicked' })` and the confirm stay first. **Dropped on purpose:** the second clear after `readChannels()`. Its only job was the window between a success and its re-read, which the set now closes at the success itself. The one order it would still cover, the first failure's catch rethrowing and the second's success landing inside the same microtask checkpoint before `start`'s `showError` runs, needs two network answers in one browser task, so it is not reachable. If the second `readChannels()` fails, the alert it writes is the read's own true failure, which is the same as at `$BASE` (see Reviewed and Dismissed).
- **Failure of the fix:** if a future change lets a channel reconnect without a page load, the set would hide a true failure of its next Disconnect. The add site is the place to delete the id again on a reconnect. Today no such path exists.
- **Do not touch:** `alertOnFailure`, `start`, `clearAlertFrom` and `disconnectAlertOf` (Reviewed and Dismissed: they are #302's mechanism, pinned by #319). The `QuietButton` in `Profile.tsx`: no disabled state (Approach decisions).
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-4-disconnect-race.vitest.config.ts` is red now (2 failed) and must be green after. Then `pnpm exec vitest run apps/web/src/app.test.ts -t 'Disconnect'` green. In a scratch worktree, deleting `if (disconnected.current.has(channelId)) return null` must turn both same-channel tests (`:547`, `:568`) red. Checked in review: it does.

### 2. #319's "Delete me" Disconnect row no longer goes red when the Delete me session bump is removed — LOW
- **Location:** `apps/web/src/app.test.ts:458-474` (the `['Disconnect', ...]` row of "shows no alert of a "%s" that fails after "Delete me" succeeds"), via `apps/web/src/App.tsx:363-368` and `:386`
- **Attribution:** introduced by `02c2334` (#320) acting on `126cec3`'s test (#319). Under the mutation, the row is red at `$BASE` with HEAD's tests and green at HEAD (mutation audit). It goes red again only when #320's channel-list drop is removed too.
- **Real-world trigger:** none for users. It is a coverage claim: #319's "Done when" asks that each item's mutation turn its test red, and this row's guarantee for the Disconnect path is gone. LOW: the Reset preferences row of the same `test.each` still goes red, so the mutation is still killed.

**Evidence**
```ts
async function deleteYourself() {
  ...
  sessionNumber.current += 1
  setChannels([])
```
After Delete me, `channelsOnView.current` is `[]`, so the held Disconnect's failure is dropped by `listed.some(...)` being false before `start`'s session guard is ever consulted.

**Failure mode** — remove `sessionNumber.current += 1` from `deleteYourself` (`App.tsx:385`) and run `pnpm exec vitest run apps/web/src/app.test.ts -t 'fails after "Delete me" succeeds'`: at HEAD, only the Reset preferences row fails (`:473`, `expected 'Error: The API answered 500' to be null`) and the Disconnect row passes. The row passes whatever `deleteYourself` does with the session counter (Standard 2).

**Recommended fix** — none of its own: finding 1's fix restores it, because the `disconnected` set does not hold a channel whose Disconnect never succeeded, so the late failure reaches the session guard again. If finding 1 is not taken, delete the Disconnect row and leave the Reset preferences row as the item's pin.

**Remediation brief**
- **Design intent:** each #319 row pins one guard, the session bump in `deleteYourself`, for one request path. The Disconnect path has to reach `alertOnFailure` for the row to mean anything.
- **Full surface:** none beyond finding 1's. No test edit.
- **Must preserve:** both rows of `app.test.ts:458-474` unchanged.
- **Do not touch:** the row itself while finding 1 is fixed.
- **Proof:** after finding 1's fix, in a scratch worktree at the fix commit, delete the `sessionNumber.current += 1` line inside `deleteYourself` only (`signOut` has its own at `:420`, which stays) and run `pnpm exec vitest run apps/web/src/app.test.ts -t 'fails after "Delete me" succeeds'`. Both rows must fail. Checked in review against the recommended diff: both fail.

### 3. The new `alertOf` and the existing `holdBoth` are walked past in the tests this branch adds — LOW
- **Location:** `apps/web/src/app.test.ts:560,565` (#320's "after a second one succeeds" spells `container.querySelector('p[role="alert"]')` beside `alertOf`, added by this branch at `:107-109`); `apps/web/src/app.test.ts:481` (#319 item 2 builds `[api.hold(route), api.hold(route)]` with its own StrictMode comment, beside `holdBoth` at `:196-206`)
- **Attribution:** introduced, `126cec3` (`alertOf`, item 2) and `02c2334` (`:560,:565`).
- **Real-world trigger:** none for users. Standard 3: a walked-past refactor on lines the change touches is a finding.

**Evidence** — `:107-109` `function alertOf(container) { return container.querySelector('p[role="alert"]')?.textContent ?? null }`, and 12 uses of the long form remain in the file outside the helper (`grep -n "querySelector('p\[role=\"alert\"\]')" apps/web/src/app.test.ts` gives 13 lines, `:108` being `alertOf` itself), 10 of them in the two describes this branch edits (`:414-455`, `:508-565`). `holdBoth` returns only `release()`, so item 2 could not use it to fail both reads.

**Failure mode** — none at run time. Two spellings of one observation in one file, and a second StrictMode explanation that can drift from `holdBoth`'s.

**Recommended fix** — replace `expect(container.querySelector('p[role="alert"]')).toBeNull()` with `expect(alertOf(container)).toBeNull()`, and `container.querySelector('p[role="alert"]')?.textContent` with `alertOf(container)`, at `:421,:437,:455,:514,:560,:565` and `:414,:430,:508,:526`. Give `holdBoth` a `fail()` beside `release()` that calls `read.fail()` on both, and in item 2 (`:479-487`) use `const reads = holdBoth(api, route)` and `await act(async () => reads.fail())`, dropping its own comment.

**Remediation brief**
- **Design intent:** one helper per observation in `app.test.ts`, so a change to how the alert renders is made once.
- **Full surface:** `apps/web/src/app.test.ts:196-206` (`holdBoth`), `:414,:421,:430,:437,:455,:479-487,:508,:514,:526,:560,:565`. Leave `:638` and `:808` (other describes, outside this branch's path) alone.
- **Must preserve:** every assertion's meaning: `toBeNull()` on the element becomes `toBeNull()` on its text, which is equivalent because `alertOf` gives null only with no alert. Both T2 rows must still go red when `const showError = alertOnFailure()` in the signed-in effect (`App.tsx:278`) is replaced with an unguarded `setError`.
- **Do not touch:** the tests' names and their order.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green (96 tests), and `pnpm lint` green.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The channel-list drop hides a true failure: no. `channels === null` rethrows, and `setChannels` runs only at `App.tsx:279` (first read), `:373` (after a successful Disconnect) and `:386` (Delete me, where the session has ended). The API disconnects in one transaction (`apps/api/src/app.ts:234-241`), so a later list read cannot still hold the channel.
- The second `clearAlertFrom` clears a true alert: no reachable case. Only a Disconnect failure of that channel carries its tag, and any one landing before that clear started after the server had accepted a Disconnect of the channel.
- The second Disconnect's `readChannels()` fails and writes an alert tagged `disconnect:<id>` beside the success toast: same at `$BASE`. It is the read's own true failure. Out of scope.
- "after a second one succeeds" asserts `button.disabled === false` and the request count (`app.test.ts:553-559`): kept. They are #320's proof test word for word, and they prove the double press was reached rather than letting the test pass vacuously.
- `alertOnFailure`, `start`, `clearAlertFrom`, `disconnectAlertOf` and `sessionNumber`: #302's mechanism, unchanged here, and each of their halves is now pinned by #319 (mutation table above).
- #319 items 2 to 5: each test goes red under its named mutation at HEAD.
- StrictMode's second initial `readChannels` landing after a Disconnect's re-read: development only and pre-existing; a restored channel would only make the catch rethrow.
- No `track()` call changed, so no OpenPanel question arises.

## Minor / nits
- `app.test.ts:603-605` ("goes with the success toast") ends with `read.release()` and `settle()` and no assertion. It drains the held read before unmount. Harmless.
- `channelsOnView` (`App.tsx:182`) sits next to `channelOnView` (`:251`), which means something else. Finding 1's fix removes it.

## Test quality
Tests added: 10 cases (#319: 7, two `test.each` rows each for items 1 and 2; #320: 3). Green against `$BASE`: 8, all intended. The seven #319 cases pin guards that were already there, and their oracle is the mutation, which kills all of them except the Delete me Disconnect row at HEAD (finding 2). #320's "goes with the success toast" is `ddb8d96`'s pin of the existing first clear (`git log -S 'goes with the success toast' 1dc23c5..HEAD` gives `ddb8d96`, review pass 1 finding 1), and it goes red when that clear is removed. Red against `$BASE`: 2 (#320's two same-channel tests). Tautology shapes: no mocked unit, no call-shaped assertion, no snapshot, no copy test. One assertion pins a false intermediate state (`:580`, finding 1). Keep every test. Change `:580` as finding 1 says.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite green at `decea94`. The repro files under `repro/` pass `biome check`. They are not in the root vitest include and do not run in CI.
- **Commit hygiene:** commit this doc and `repro/review-4-disconnect-race.test.ts` with its `.vitest.config.ts`. No scratch left in the tree.
- **Likely reviewer asks:** why not disable the Disconnect button while one is in flight (Approach decisions); whether the set needs clearing on reconnect (finding 1, Failure of the fix: every reconnect is a page load).

## Verdict
**Ready to open the PR as-is.** No finding gates it: all three are LOW. Finding 1's fix is a few lines and also closes finding 2, so remediating both on this branch before the PR is cheap. Finding 3 is a tidy-up that can ride along. #319 and #320 claimed no prior review findings beyond the ones they were filed from. #319 closes review 3's findings 1 and 2 (each guard is now pinned), except the Delete me Disconnect row, which #320 then made redundant (finding 2). #320 closes its own defect except the render-timing window (finding 1). Nothing was "resolved" only by a comment or a doc edit.

## Remediation — 2026-10-24

**Remediation scope:** Nick's close-out decision of 2026-10-24: fix confirmed findings 1 and 2 (both LOW), test-first. Finding 3 is left unfixed on purpose.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (LOW) | `dab6be6` creator-analytics#266 pre-PR review 4 finding 1: a first Disconnect that fails before the re-read channel list renders leaves a false alert | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t 'Disconnect'` (2 red before: the flipped `:580` assertion and the new in-suite pin of the render-timing window, "fails after a second one's channels read answers, before the list renders"; 97/97 after). `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-4-disconnect-race.vitest.config.ts` 2 red before, 2 green after. Mutations in a scratch worktree at `dab6be6`: set check removed, 3 same-channel tests red; `add` removed, the same 3 red; first clear removed, 2 red | 1 (the `disconnected` ref's load-bearing line, which the brief asks for) | proved by execution |
| 2 (LOW) | `dab6be6` (no diff of its own; finding 1's fix closes it) | Mutation in a scratch worktree at `dab6be6`: `sessionNumber.current += 1` removed from `deleteYourself` only, both rows of "shows no alert of a "%s" that fails after "Delete me" succeeds" red, the Disconnect row included | 0 | proved by execution |
| 3 (LOW) | — skipped | — | — | deferred by Nick's scope decision |

Full checks at `dab6be6` from the repo entry: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (110/110 files, 2482 passed, 1 expected fail), all green.

### Known regressions, deferred
None.

### Rework briefs
None. No rework pass ran.
