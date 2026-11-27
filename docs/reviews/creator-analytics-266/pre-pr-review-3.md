# Pre-PR review: creator-analytics#266 Web app fixes, stage 2 of the second run: #302, #303 and #304

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `b10c8d4` "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `e20924a` ("creator-analytics#302 The failure alert stays after a retry succeeds, and a late failure shows it on the signed-out screen"). The tree was clean, with no uncommitted or untracked files at review time. 12 files, +216 / −122 against the merge-base. The branch equals origin/main plus three stage-2 tickets: #304 (`402a5eb`, merge `aaaf6fb`), #303 (`62dcf5c`, merge `ea2ef70`) and #302 (`4259d88`, merge `e20924a`). It deletes `repro/review-2.test.ts` and its config, because #302 and #304 moved those repros into `apps/web/src/app.test.ts`.
**Reviewed against:** creator-analytics#302, #303 and #304 (read in full; their "Done when" lists are the requirements), the epic body of creator-analytics#266 (Implementation and Testing Decisions), `CODING_STANDARDS.md` 1 to 3, and `pre-pr-review-2.md` findings 1, 2 and 4 and its Approach decisions. A full review (`--fresh`), not delta-scoped. The repo has no `CLAUDE.md`.
**Date:** 2026-10-20
**Reviewer:** 2 code-review agents + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | green (478 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres, Docker up) | 110/110 files, 2471 passed, 1 expected fail |
| New tests against `$BASE` (tautology oracle) | Scratch worktree at `b10c8d4`, branch's `app.test.ts`, `components.test.ts`, `retention.test.ts`, `thumbnail.test.ts` copied in | All 12 new tests red, except the fr-FR preservation pin (intended green). Rerun with the branch's `fake-api.ts` too: the four #302 tests stay red on the base `App.tsx`; "stays when another action succeeds" goes green (it pins against over-clearing, see Test quality) |
| Production revert, tests kept | Scratch worktree at HEAD with base `retention.ts`, `thumbnail.ts`, `VideoStepper.tsx`, `VideoDetail.tsx` | Exactly the 6 new #303/#304 tests red, 177 green |
| Mutations of the #302 fix | Scratch worktree at HEAD, `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts` per mutation | Removing both bumps, or the signOut bump: 2 red. `clearAlertFrom` no-op: 2 red. `clearAlertFrom` clears all: 1 red. Removing the Delete me bump, unguarding the signed-in reads, clearing on any channel's disconnect: **139/139 green** (finding 1) |
| Mutations of the #304 fix | Same harness | Calling `onGone()` without the focus check, or moving the null branch above `pressed === null`: **139/139 green** (finding 2) |
| `timeLabelOf` scope leak | Differential harness (agent): base vs HEAD over 28 inputs (rounding edges 59.5 and 3599.6, negatives, NaN, ±Infinity, 1e9) × 8 locales | 162 cells identical. Only change in a Latin locale: `Infinity` writes "∞:NaN:NaN" for "Infinity:NaN:NaN" (unreachable from JSON, see Minor) |
| Callers of the time helpers | `git grep` over `apps/` and `packages/` | `AudienceRetention.tsx:52,73,103,115` and `Thumbnail.tsx:32` all pass no locale, as do `retentionScaleLabelsOf()` and every other formatter in the web app, so one screen uses one numbering system |
| Browser behaviour (focus, real locale digits) | Not run | happy-dom only. #294 is the human walk in Chrome and Safari |

**Overall:** All three tickets do what their "Done when" asks, and every new test goes red when its production change is reverted. No finding gates the PR. Each guard the branch added has one half no test pins (the Delete me bump, the signed-in reads, the per-channel tag, and the focus check on the stepper's null branch), the end-the-session sequence is now duplicated with a counter that must stay in step, and two new comments are loose. All four findings are LOW and cheap to remediate on this branch.

## Approach decisions
- Late failures after sign-out (#302, overrides review 2's recommended `sessionState` ref): a session counter `sessionNumber` (`App.tsx:231`) that a successful Sign out or Delete me bumps. `alertOnFailure(from)` captures the counter when a request starts and writes the alert only while it is unchanged. `start(action, from)` is the one way a button's action attaches it. The readSession failure writes unguarded, since it precedes any session. Kept: it also covers a request started in one signed-in session and failing in a later one.
- Clearing on a retry's success (#302): the alert carries `from`, the action whose failure wrote it (`reset`, `disconnect:<channelId>`), and that action's success clears it with `clearAlertFrom` (`App.tsx:200-201`). An alert from any other writer has `from: null` and only a session end clears it (#284's `setError(null)`).
- Focus when "Try again" lands no stepper (#304, overrides review 2's `fallbackFocus` ref): `VideoStepper` takes an `onGone` callback, called by the pressed instance only, and only when focus fell to the body. `VideoDetail` passes `() => title.current?.focus()`, the same `h1` the screen focuses for a new video (`VideoDetail.tsx:490`).
- Locale digits for times (#303): `timeLabelOf` formats each part with `Intl.NumberFormat(locale)` (no grouping, two integer digits for minutes and seconds after the first part), with an optional `locale` threaded through `retentionAxisOf`, `retentionRowOf` and `lengthTextOf`. Production callers pass none, so Intl takes the browser's language, as every other formatter in the web app does.
- Test gaps are closed with a test in the describe for their ticket, never with a production change, and each test must go red under the mutation its finding names (carried from reviews 1 and 2).

## Confirmed Issues

### 1. The #302 guards are pinned for only one of their halves — LOW
- **Location:** `apps/web/src/App.tsx:373` (the bump in `deleteYourself`), `:275` (`alertOnFailure()` in the signed-in effect, guarding the `readChannels` and `readPreferences` failures at `:276-279` and `:287-291`), `:200-201` with `:157` (the per-channel tag `disconnect:<channelId>`). Tests: `apps/web/src/app.test.ts:427-445` and `:447-481`.
- **Attribution:** introduced by `4259d88` ("creator-analytics#302 The failure alert stays after a retry succeeds, and a late failure shows it on the signed-out screen"). The guards are new; their tests cover Sign out, and reset against disconnect, only.
- **Real-world trigger:** none for users today; the code is correct. The trigger is a regression: a later edit drops the Delete me bump, unguards the signed-in reads, or clears on a prefix match, and the suite stays green while #302's bug returns on that path. LOW, as a test gap with no user path. CODING_STANDARDS 2 and the standing "a test for every fallback path" rule.

**Evidence**
```ts
    setError(null)
    sessionNumber.current += 1
    setChannels([])
    setSession({ state: 'signed-out' })
  ...
    if (session.state !== 'signed-in') return
    const showError = alertOnFailure()
```
**Failure mode** — executed in a scratch worktree at HEAD, `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts`, 139/139 green under each of: (M2) delete `sessionNumber.current += 1` from `deleteYourself`; (M6) replace `alertOnFailure()` at `:275` with `(reason: unknown) => setError({ text: String(reason), from: null })`; (M7) make `clearAlertFrom` compare only the part of `from` before the colon. Each mutation re-opens a real path: a late reset or disconnect failure after Delete me reaches the signed-out screen (M2); a `GET /api/channels` or `GET /api/me/preferences` still in flight when Sign out succeeds writes its alert on the signed-out screen (M6, reachable because the account menu's Sign out shows once `email` is read, `Header.tsx:39-42`); a successful disconnect of one channel clears another channel's failure (M7).

**Recommended fix** — three tests, no production change. In `app.test.ts`, widen the `test.each` at `:427`:
```diff
-  test.each([
-    ['Reset preferences', 'DELETE /api/me/preferences'],
-    ['Disconnect', `POST /api/channels/${fakeChannel.id}/disconnect`],
-  ])('shows no alert of a "%s" that fails after "Sign out" succeeds', async (name, route) => {
+  test.each([
+    ['Reset preferences', 'DELETE /api/me/preferences', 'Sign out'],
+    ['Disconnect', `POST /api/channels/${fakeChannel.id}/disconnect`, 'Sign out'],
+    ['Reset preferences', 'DELETE /api/me/preferences', 'Delete me'],
+    ['Disconnect', `POST /api/channels/${fakeChannel.id}/disconnect`, 'Delete me'],
+  ])('shows no alert of a "%s" that fails after "%s" succeeds', async (name, route, ending) => {
     const api = installFakeApi()
     const { container } = await render('profile')
 
     const held = api.hold(route)
     await click(buttonNamed(container, name))
-    await click(buttonNamed(container, 'Sign out'))
+    await click(buttonNamed(container, ending))
```
Add to the same describe a test that holds `GET /api/me/preferences` (or `GET /api/channels` if the profile does not render before the preferences land), signs out, fails the hold with `held.fail()`, and expects no `p[role="alert"]`. Add to `describe("an action's alert")` (`:447`) a test with `api.channels = [fakeChannel, { ...fakeChannel, id: 'channel-2', title: 'Second channel' }]` that fails the first channel's disconnect (`api.failNext(\`POST /api/channels/${fakeChannel.id}/disconnect\`)`), disconnects the second channel successfully, and expects the alert to stay. `fake-api.ts:213-217` already answers the disconnect of any id in `api.channels`; pick the second channel's button by its accessible name in `Profile.tsx`.

**Remediation brief**
- **Design intent:** the app has one alert line. It belongs to the session that showed it: a session end (successful Sign out or Delete me) clears it and bumps `sessionNumber`, and every failure from a request the session started is dropped once the counter moves. Within a session, an action's success clears only the alert its own failure wrote, keyed by `from`, so another action's failure stays.
- **Full surface:** `apps/web/src/app.test.ts:427-445` (the widened `test.each`), the describe at `:379` (the signed-in read test), `:447-481` (the per-channel test). Production lines pinned, unchanged: `App.tsx:157`, `:200-201`, `:231-242`, `:275`, `:373`, `:408`.
- **Must preserve:** every existing test in `describe('the signed-out screen')` and `describe("an action's alert")`, including "shows no alert of a failed "Delete me" once a second one succeeds" (`:412`), which needs the `DELETE /api/me` success the new Delete me rows rely on. Each new row must go red under its mutation above.
- **Do not touch:** the production code, which is correct. The re-read's tag after a successful disconnect (Minor) is a separate nit.
- **Proof:** each new test green at HEAD, then red under M2, M6 and M7 respectively, applied by hand in a scratch worktree (not the live tree): `pnpm exec vitest run apps/web/src/app.test.ts -t "succeeds"`.

### 2. The stepper's new null branch has no test for either of its guards — LOW
- **Location:** `apps/web/src/VideoStepper.tsx:66` (`if (pressed === null) return`, above the new branch) and `:71` (`if (document.activeElement === document.body || document.activeElement === null) onGone()`). Test: `apps/web/src/app.test.ts:1269`.
- **Attribution:** introduced by `402a5eb` ("creator-analytics#304 Focus falls to the page body when Try again brings back the stepper's own page without the video"). The one new test covers only the case where focus was on Try again when the page landed.
- **Real-world trigger:** none today; the code is correct. Without a pin, a regression that drops the focus check takes focus the creator moved (Tab to "Back to videos" while the page reads) back to the title, breaking #187's "focus the creator moved elsewhere stays put". One that reorders the checks makes every stepper with no stepper to show (a video not on the list's page) yank focus from the body to the title on each render. LOW, test gap.

**Evidence**
```ts
    if (pressed === null) return
    if (stepper === null) {
      retried.current = null
      ...
      if (document.activeElement === document.body || document.activeElement === null) onGone()
      return
    }
```
**Failure mode** — executed in a scratch worktree at HEAD: replacing `:71` with an unconditional `onGone()`, or moving the `stepper === null` block above `if (pressed === null) return`, leaves `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts` at 139/139 green.

**Recommended fix** — two tests in `describe('a refused list page holding the video on view')` (`app.test.ts:1135`), modelled on `:1269` and on #187's "leaves keyboard focus the creator moved out of the stepper" test:
```ts
  test('leaves keyboard focus the creator moved away while Try again read a page that comes back without the video', async () => {
    const api = installFakeApi()
    api.videos = [fakeVideo, { ...fakeVideo, id: 'video-2', title: 'Another video' }]
    api.failNext(listRoute)
    const { container } = await render('videos/video-2')
    const button = buttonNamed(container, retryText)
    act(() => button.focus())

    api.videos = [fakeVideo]
    const page = api.hold(listRoute)
    await click(button)
    const elsewhere = linkLabelled(container, 'Back to videos')
    act(() => elsewhere?.focus())
    await act(async () => page.release())

    expect(container.querySelector('nav.video-stepper')).toBeNull()
    expect(document.activeElement).toBe(elsewhere)
  })
```
Use whichever focusable outside the stepper the screen has (check the label `linkLabelled` takes against the existing #187 test). The second test opens a video not on its list page, so no stepper shows from the start, blurs to the body with `act(() => (document.activeElement as HTMLElement | null)?.blur())`, causes one more render (release a held read the video screen makes after its head; the routes are in `fake-api.ts` `answerOf`), and expects `document.activeElement` to stay `document.body`.

**Remediation brief**
- **Design intent:** "Try again" leaves with the refused place, so the pressed stepper's `<nav>` holds focus while the page reads, and the effect then gives focus to what lands. When nothing lands (the own page came back without the video), only the instance whose Try again was pressed acts (`retried` is per instance, and `VideoDetail` renders the stepper twice), and only when focus fell to the body; focus the creator moved stays.
- **Full surface:** `apps/web/src/app.test.ts:1135-1287` (the describe). Production lines pinned, unchanged: `VideoStepper.tsx:63-74`, `VideoDetail.tsx:502`.
- **Must preserve:** every test in the describes at `:1135` and the #187 describe "a refused list page next to the video on view"; the components markup tests passing `onGone: noop` (`components.test.ts:796`, `:924`).
- **Do not touch:** the production code, which is correct.
- **Proof:** both tests green at HEAD; the first red with `:71` made an unconditional `onGone()`, the second red with the null block moved above `if (pressed === null) return` (mutations in a scratch worktree): `pnpm exec vitest run apps/web/src/app.test.ts -t "without the video"`.

### 3. Ending the session is written twice, and the new counter had to go into both copies — LOW
- **Location:** `apps/web/src/App.tsx:370-375` (`deleteYourself`) and `:405-409` (`signOut`)
- **Attribution:** introduced by `4259d88`, which added `sessionNumber.current += 1` to both copies of the sequence #284 had already duplicated. CODING_STANDARDS 3: the change edited both lines, so the shared piece belongs in the same change. Finding 1's M2 shows one copy can lose the bump with no test noticing.
- **Real-world trigger:** none for users. A third way to end the session, or a change to what ending clears, has to be made in both places.

**Evidence**
```ts
    clearToasts()
    // The alert of a failed try belongs to the session that has just ended, as the toasts do.
    setError(null)
    sessionNumber.current += 1
    setChannels([])
    setSession({ state: 'signed-out' })
  ...
    clearToasts()
    setError(null)
    sessionNumber.current += 1
    setSession({ state: 'signed-out' })
```
**Recommended fix**
```diff
+  function endSession() {
+    clearToasts()
+    setError(null)
+    sessionNumber.current += 1
+    setSession({ state: 'signed-out' })
+  }
+
   async function deleteYourself() {
     track({ name: 'delete_user_clicked' })
     if (!window.confirm(deleteUserWarning)) return
     const notice = await deleteUser()
-    clearToasts()
-    // The alert of a failed try belongs to the session that has just ended, as the toasts do.
-    setError(null)
-    sessionNumber.current += 1
+    endSession()
     setChannels([])
-    setSession({ state: 'signed-out' })
     setSignedOutNotice(notice)
   }
 ...
   async function signOut() {
     assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
-    clearToasts()
-    setError(null)
-    sessionNumber.current += 1
-    setSession({ state: 'signed-out' })
+    endSession()
   }
```
Keep the comment "The alert of a failed try belongs to the session that has just ended, as the toasts do." by moving it above `endSession`, and keep `signOut`'s comment "A failed sign-out leaves the session cookie…" where it is (the hunk above elides it).

**Remediation brief**
- **Design intent:** a session end clears what belonged to the session (toasts, failed save, alert) and moves `sessionNumber` so the session's late failures are dropped, then shows the signed-out screen. Delete me also empties the channels and shows its notice.
- **Full surface:** `apps/web/src/App.tsx:366-376`, `:403-410`, and the `sessionNumber` comment at `:228-229`, which stays true.
- **Must preserve:** order within the sequence matters only for the bump, which must happen before any await resumes a request's catch; the bump and the `setSession` stay in the same synchronous block. `setChannels([])` moving after `setSession` is intended: the updates batch into one render after the `await`. Suites: `app.test.ts` describes "the signed-out screen" (`:379`), "an action's alert" (`:447`), "a failed sign-out", and `profile.test.ts`.
- **Do not touch:** `alertOnFailure` and `start`.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/profile.test.ts` green, `pnpm lint` and `pnpm typecheck` green, and `grep -c 'sessionNumber.current += 1' apps/web/src/App.tsx` prints 1.

### 4. Comment hygiene — LOW (aggregated)
- `apps/web/src/VideoStepper.tsx:69` — "The focused stepper unmounted, so focus fell to the page;" → "The focused nav left the page, so focus fell to the body;" (`VideoStepper` stays mounted and returns null; the effect depends on that).
- `apps/web/src/VideoStepper.tsx:54-58` — "Told when a "Try again" this stepper pressed brings back no stepper, so the screen can give focus to its title." → "Told when a "Try again" this stepper pressed brings back no stepper while focus has fallen to the page, so the screen can give focus to its title."
- `apps/web/src/VideoStepper.tsx:34-36` — "…are gone, and the screen is told (`onGone`) to give focus to its title." → "…are gone, and unless the creator has moved focus elsewhere, the screen is told (`onGone`) to give focus to its title."

## Needs Further Investigation
None.

## Reviewed and Dismissed
- ConsentScreen's `onError={alertOnFailure()}` makes a new function on every render — `ConsentScreen.tsx` uses `onError` only inside its click handler (`:34-39`) and no effect depends on it; the screen renders only while signed in, so the captured counter is right.
- A path that ends the session without a bump — `setSession` is called only at `App.tsx:267-268` (readSession, before any session, when no action can have started: the account menu needs `email`), `:375` and `:409`.
- The readSession failure writing the alert unguarded (`:269`) — correct, it precedes any session; its comment is accurate.
- The fake API's new disconnect answer changing other tests — before this branch no test pressed Disconnect, and the route fell through to 404; the new branch matches only `POST` for an id in `api.channels`.
- `VideoStepper` unmounted by its parent when `stepper` is null — `VideoDetail` renders `{head && stepper}`, `head` comes from the landed answer, so the component stays mounted and returns null; the effect runs.
- Both stepper instances calling `onGone` — `retried` is a per-instance ref set only by that instance's `retry()`.
- Two numbering systems on one screen after #303 — every caller of the time helpers and every other formatter in the web app passes no locale, so one screen uses the browser's language throughout; the hover titles reuse `row.point`.
- `timeLabelOf` changing output for Latin locales — the differential harness shows byte identity over 28 inputs × 5 Latin locales, rounding edges and negatives included, except `Infinity` (Minor).
- Success toasts of a reset or disconnect that land after sign-out — toasts render only while `session.state === 'signed-in'`, so none shows on the signed-out screen.
- The deletion of `repro/review-2.test.ts` and its config — #302 and #304 ask for those repros to move into `app.test.ts`, and both moved tests are red at `$BASE` and green at HEAD.

## Minor / nits
- `timeLabelOf` (`retention.ts:68-69`) builds two `Intl.NumberFormat` objects per call; an agent measured about 30 µs per label against 0.1 µs at `$BASE`, so about 3 ms per render of a 100-point retention table. Memoise per locale if a profile ever shows it.
- `timeLabelOf(Infinity)` now writes "∞:NaN:NaN" for "Infinity:NaN:NaN", and NaN writes the locale's word in ar and fa-IR; durations come from JSON, which cannot carry either.
- After a successful disconnect, a failure of the following `readChannels()` (`App.tsx:363`) carries the disconnect's tag `disconnect:<id>`, though it is a list read failure. No visible effect: the channel is gone, so no later success of that action exists to clear it either way.
- A reset or disconnect that succeeds after sign-out still rewrites the address and sends `preferences_reset` (`App.tsx:390-393`). Pre-existing and true (the reset happened); outside #302's alert scope.
- The "fails after Sign out succeeds" tests do not assert the held request was sent before the sign-out; the M1 mutation shows they go red today.
- The sign-in failure alert (`App.tsx:430`) and the consent screen's failure alert (`:436`) have no app test; pre-existing, though this branch rewrote both call sites. Follow-up material.
- `AudienceRetention` calls five locale-taking helpers without a locale; consistent today, and one `locale` value passed to all five would keep it so. Not on this branch's path.

## Test quality
Tests added: 12 (app: 6, retention: 5, thumbnail: 1), plus 7 en-US assertions given an explicit locale. Green against `$BASE`: 2, both intended. "keeps Latin digits in a locale that writes them" (fr-FR) pins the output #303 must keep. "stays when another action succeeds" is red at `$BASE` only through the fake's missing disconnect answer; with the branch's fake on base `App.tsx` it is green, because base never clears, but it goes red when `clearAlertFrom` clears every alert, which is the rule it states. Tautology shapes found: 0. No self-computed expectations, mocks of the unit, call-shaped or snapshot assertions. The alert text assertions observe a branch through its text and are not copy tests. Gaps: findings 1 and 2.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite green at `e20924a`.
- **Commit hygiene:** this doc is the only new file. The branch carries two merge commits from the lanes (`ebcc394`, `521aaac`), as the earlier rounds did.
- **Likely reviewer asks:** the real-browser walk (#294) for the focus move and the Arabic-Indic digits, since happy-dom stands in for both here.

## Verdict
Ready with follow-ups: no finding gates the PR. Findings 1 to 4 are all LOW (two test gaps, one walked-past refactor, comment hygiene) and cheap enough to remediate on this branch before it opens. Of the prior review's findings this branch claimed (review 2 findings 1, 2 and 4, as #304, #302 and #303), all three are fixed in code, each with a test that goes red without its fix; none was resolved by editing only a comment or a doc.
