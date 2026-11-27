# Pre-PR review: creator-analytics#266 Web app fixes after #64: preferences, sign out, the custom range and the video stepper

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `d34e9f2` "creator-analytics#253 The OG image for the marketing site")
**Reviewed at:** HEAD `ae2ff6d` ("creator-analytics#262 Video stepper: Previous video opens a later upload and Next video an earlier one"). The tree was clean, with no uncommitted or untracked files at review time. 27 files, +1,337 / −143, 24 commits (the ten child tickets #164, #165, #166, #171, #182, #183, #186, #187, #188, #262, each a lane commit plus its merge).
**Reviewed against:** the epic body of creator-analytics#266 (its End state, Implementation Decisions and Testing Decisions are the spec), its ten child issues, `CODING_STANDARDS.md` 1 to 3, and the per-ticket assumptions the loop recorded. No prior review of this branch (`--fresh`).
**Date:** 2026-10-18
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 468 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres) | 110 files, 2,371 passed, 1 expected fail |
| Tests green at `$BASE` | scratch worktree at `d34e9f2`, the branch's 11 changed test files plus `fake-api.ts` copied in, each run per file | 69 new or modified cases: 52 red at base, 17 green. Every green one is from the test-only tickets #171 and #188, or the #166 cold-open control. See Test quality. |
| #164 reset counted only after the DELETE succeeds | mutation: set `resetSinceOpened` before the `await` | suite green (135 of 135 in app, controls-bar, preferences tests). Finding 2. |
| #182 a cleared field counts as typed | mutation: drop `''` days in `typedDaysOf` | suite green. Finding 3. |
| #165 toasts kept on a failed sign-out | mutation: `clearToasts()` before the fetch | suite green. Finding 4. |
| #187 focus the creator moved stays put | mutation: delete `VideoStepper.tsx:57` | suite green (136 of 136 in app, components, video-step tests). Finding 5. |
| #165 alert after a failed then successful sign-out | executed repro | red: the alert reads "Error: The API answered 500" on the signed-out screen. Finding 1. |
| #183 channel in the draft key, #164 reset flags, #165 `assertAnswered` and `.catch` | mutations (finder agent) | each turns at least one suite test red |
| #187 refused-page state machine, #262 word mapping, #186 zero labels, #166 memory feeders | traced by a finder agent through `useListPages`, `acrossEdge`, `stepTextOf`, `scaleLabelsOf`, `processing.ts` | no defect found |
| Em-dashes in shipped strings | grep of added lines | none |
| Browser-only behaviour | not run | the awaiting placeholder's height (CSS widths are measured, not rendered in a test), the stepper nav's focus ring while Try again reads, and the stepper's words in each sort. Nick's browser walk, per the epic. |

**Overall:** Every requirement in the epic's End state is implemented and passes all four CI checks. No defect above LOW was found: the one behaviour defect is a stale alert left on the signed-out screen after a failed sign-out is retried successfully. The other confirmed findings are four rules this branch designed and implemented that no test would notice breaking, a handful of test oracles computed with the production helper, and comment hygiene. The PR can open; the LOWs are cheap enough to remediate first.

## Approach decisions
- Sign-out failure (#165): `signOut` throws on a non-ok answer through `assertAnswered`, and both call sites wrap it in `.catch(showError)`, the shape `resetPreferences` and `deleteYourself` already use. Finding 1's fix clears the alert on the success path beside `clearToasts()`, not at the start of `signOut`, so a failure in flight keeps the earlier alert until the answer lands.
- Test gaps (findings 2 to 5) are closed with an app or unit test in the existing `describe` for that ticket, never with a production change, and each test must go red under the mutation its finding names.

## Confirmed Issues

### 1. A sign-out that succeeds after a failed one shows the failed one's alert on the signed-out screen — LOW
- **Location:** `apps/web/src/App.tsx:363-368` (`signOut`), with `:184` (the `error` state), `:212` (`showError`, its only setter) and `:386` (the alert, rendered whatever the session state)
- **Attribution:** pre-existing, exposed. At `$BASE` the app never clears `error` (`git show d34e9f2:apps/web/src/App.tsx` has `showError` at :209 as the only `setError` call), but a sign-out could not set it: its answer was ignored. `0c93d57` ("creator-analytics#165 Sign out: show the alert on an HTTP error or a dropped connection") makes a failed sign-out show the alert, so a retry that succeeds now carries it onto the signed-out screen.
- **Real-world trigger:** a creator signs out while the API answers 5xx or the connection drops, sees the alert, presses Sign out again once it recovers. The signed-out screen then reads "Error: The API answered 500" (or "TypeError: Failed to fetch") above "Sign in with Google", which says the sign-out failed when it did not. LOW: a misleading display on a rare path, with no data or session wrong.

**Evidence**
```ts
  async function signOut() {
    // A failed sign-out leaves the session cookie, so the signed-in screen stays with the alert.
    assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
    clearToasts()
    setSession({ state: 'signed-out' })
  }
```
**Failure mode** — failed sign-out (500) → alert set; second sign-out (200) → session `signed-out`, alert still set → the signed-out screen shows the 500 alert. Executed: `repro/sign-out-and-reset.test.ts` "finding 1" fails with `expected <p role="alert"></p> to be null` (text "Error: The API answered 500").

**Recommended fix**
```diff
   async function signOut() {
     // A failed sign-out leaves the session cookie, so the signed-in screen stays with the alert.
     assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
     clearToasts()
+    setError(null)
     setSession({ state: 'signed-out' })
   }
```
Then add the repro's "finding 1" test to the `describe('a failed sign-out', …)` block in `apps/web/src/app.test.ts` (around :346), using that file's `render`, `click` and `installFakeApi`.

**Remediation brief**
- **Design intent:** the app has one alert line (`error`), set by `showError` for any failed action and never cleared. The signed-out screen is a new session's start, as `clearToasts()` already says for toasts ("A toast belongs to the session it showed in"); the alert belongs to the old session too. Only a successful sign-out reaches the line after `assertAnswered`.
- **Full surface:** `apps/web/src/App.tsx:363-368` only. `deleteYourself` (`App.tsx:333-341`) also ends in the signed-out screen after `clearToasts()`, and an alert from an earlier failed action rides across it the same way; add `setError(null)` beside its `clearToasts()` too, in the same commit, so both ways into the signed-out screen start clean.
- **Must preserve:** the four tests in `app.test.ts` `describe('a failed sign-out')` (:346-381): a failed sign-out keeps the signed-in screen and shows the alert. Toasts stay on a failed sign-out (`clearToasts()` only after `assertAnswered`, see finding 4). The landing message (`useState(landingMessage)`) is dropped by a successful sign-out, which is intended: it describes the old session's arrival.
- **Do not touch:** other actions' alerts not clearing on a later success (reset, disconnect): pre-existing and untouched here, out of scope.
- **Proof:** red now, green after: `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/sign-out-and-reset.vitest.config.ts -t "finding 1"`, then the same test moved into `app.test.ts`: `pnpm exec vitest run apps/web/src/app.test.ts -t "failed sign-out"`.

### 2. No test pins that a reset only counts once its DELETE succeeds — LOW
- **Location:** `apps/web/src/App.tsx:345-346`
- **Attribution:** introduced. `eb5eaf5` ("creator-analytics#164 Keep a preferences reset made before the first preferences read lands") adds `resetSinceOpened` and sets it after the `await`, on purpose (its recorded design: "setting it only on a successful DELETE keeps a failed reset from dropping the server's values"), but no test fails when the order is swapped.
- **Real-world trigger:** none today, the code is right. A refactor that sets the flag first would make a failed reset, pressed while the first preferences read is in flight, discard the read: the screen shows the defaults while the server still holds the creator's preferences, and the next failed save reverts to values the server does not hold. That is wrong state silently shown, which is why the rule needs a pin.

**Evidence**
```ts
    await writePreferences(clearPreferences)
    resetSinceOpened.current = true
```
**Failure mode** — mutation: move `resetSinceOpened.current = true` above the `await`. `app.test.ts`, `controls-bar.test.ts` and `preferences.test.ts` stay green (135 of 135). The repro's "finding 2" test goes red under it.

**Recommended fix** — add the repro's "finding 2" test (EUR saved, the first read held, `failNext('DELETE /api/me/preferences', 'status')`, Reset, release, Currency still reads EUR) to `describe('a "Reset preferences" before the first preferences read lands', …)` in `apps/web/src/app.test.ts` (:488), using that file's helpers (`selectNamed`, `buttonNamed`, `click`). No production change.

**Remediation brief**
- **Design intent:** the first preferences read fills only what the creator has not touched since the screen opened. A reset touches everything, but only once the server has actually cleared it: a failed reset leaves the server's values, so the read must still fill them.
- **Full surface:** `apps/web/src/app.test.ts:488-526` (the describe the test joins). No production line changes.
- **Must preserve:** the two tests already in that describe ("survives that read…", "leaves a later failed save to go back to the default…").
- **Do not touch:** `App.tsx:345-346`, the order is correct.
- **Proof:** with the test added, `pnpm exec vitest run apps/web/src/app.test.ts -t "Reset preferences"` passes; then move `resetSinceOpened.current = true` above `await writePreferences(clearPreferences)` in `App.tsx`, rerun, and the new test must fail; restore. The repro equivalent: `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/sign-out-and-reset.vitest.config.ts -t "finding 2"`.

### 3. No test pins that a cleared custom range field stays cleared — LOW
- **Location:** `apps/web/src/controls-bar.ts:105-117` (`typedDaysOf`, `fieldDaysOf`)
- **Attribution:** introduced. `65b5c49` ("creator-analytics#182 Prefill the custom range fields when the bounds land after the fields opened") records "a field the creator cleared counts as typed and stays empty", and the spread in `fieldDaysOf` does it, but no test covers it.
- **Real-world trigger:** none today. A change that treats `''` as untyped (an easy "cleanup") would refill a cleared From or To from the window at once, so the creator could never empty a field, and the empty-field message ("Pick a start day and an end day.") could no longer be reached from a prefilled field.

**Evidence**
```ts
function fieldDaysOf(draft: RangeDraft, route: Route, bounds: RangeBounds | null): CustomRange {
  return { ...prefillOf(route, bounds), ...typedDaysOf(draft, route) }
}
```
**Failure mode** — mutation: `typedDaysOf` filters out `''` days. All 135 tests stay green; the repro's "finding 3" test goes red.

**Recommended fix** — add a unit test to `apps/web/src/controls-bar.test.ts` beside the #182 cases (:155-190): open the fields with the bounds known (`windowPickedOf(channelScreen, 'custom', bounds)`), `dayTypedOf(…, { from: '' })`, and assert `rangeFieldsOf(…).fields.from` is `''`. No production change.

**Remediation brief**
- **Design intent:** a field the creator has not typed in follows the window's days (`prefillOf`), per field; anything typed, including clearing the field, wins and survives the bounds landing or moving.
- **Full surface:** `apps/web/src/controls-bar.test.ts:155-190`. No production line changes.
- **Must preserve:** the four #182/#183 unit cases there, named as written (the epic pins them).
- **Do not touch:** the `_bounds` parameters of `windowPickedOf` and `dayTypedOf` (kept on purpose, see Minor).
- **Proof:** the new test passes; then in `controls-bar.ts:107-108` replace `return days` with `return Object.fromEntries(Object.entries(days).filter(([, day]) => day !== '')) as Partial<CustomRange>`, rerun `pnpm exec vitest run apps/web/src/controls-bar.test.ts`, the new test must fail; restore.

### 4. No test pins that a failed sign-out keeps the session's toast — LOW
- **Location:** `apps/web/src/App.tsx:365-366`; the stale reasoning at `apps/web/src/app.test.ts:6-10`
- **Attribution:** introduced. `0c93d57` (#165) orders `clearToasts()` after `assertAnswered`, and its recorded design keeps toasts on a failure ("the creator stays signed in, so the session's toasts still belong on screen"). Nothing tests it, and `app.test.ts`'s header still says no test can see `clearToasts` because "the signed-out screen shows no toast", which stopped being the only case once a failed sign-out keeps the signed-in screen.
- **Real-world trigger:** none today. Moving `clearToasts()` above the fetch would clear a failed-save notice when the sign-out then fails, so the creator loses the only notice that a choice was not saved.

**Evidence**
```ts
    assertAnswered(await fetch('/api/auth/sign-out', jsonPost))
    clearToasts()
```
**Failure mode** — mutation: `clearToasts()` before the fetch. All 58 app tests stay green; the repro's "finding 4" test goes red.

**Recommended fix** — add the repro's "finding 4" test to `describe('a failed sign-out', …)` in `app.test.ts` (start from the file's `failedOnTheList()` helper at :151, fail the sign-out, assert `toastText(container)` is still `failedSaveNotice`), and rewrite the header sentence at `app.test.ts:7-10` to: "…so no test reaches a second session in one render. A successful "Sign out" or "Delete me" leaves for the signed-out screen, which shows no toast whatever the notice holds, so those tests pin only that rule; a failed sign-out keeps the signed-in screen and its toast." No production change.

**Remediation brief**
- **Design intent:** toasts belong to the session they showed in. Only a successful sign-out ends the session, so only it clears them.
- **Full surface:** `apps/web/src/app.test.ts:6-10` (header) and `:346-381` (the describe the test joins).
- **Must preserve:** the four existing failed sign-out tests; the signed-out screen's tests.
- **Do not touch:** `App.tsx:365-366`, the order is correct.
- **Proof:** the new test passes; then swap `App.tsx:365` and `:366` so `clearToasts()` runs before the fetch, rerun `pnpm exec vitest run apps/web/src/app.test.ts -t "failed sign-out"`, the new test must fail; restore.

### 5. No test pins that focus the creator moved away during "Try again" stays where they put it — LOW
- **Location:** `apps/web/src/VideoStepper.tsx:56-57`
- **Attribution:** introduced. `28f7cc4` ("creator-analytics#187 review pass 1 finding 1: Try again drops keyboard focus to the body when its place unmounts") adds the guard and records it as the design ("Focus the creator has moved elsewhere in the meantime stays put"); its tests cover only focus landing on the step and on Try again.
- **Real-world trigger:** none today. Without the guard, a creator who presses Try again and then tabs on into the page while the read is slow gets focus yanked back up to the stepper when the page lands.

**Evidence**
```ts
    // Focus the creator has since moved elsewhere stays where it is.
    if (document.activeElement !== nav.current) return
```
**Failure mode** — mutation: delete line 57. `app.test.ts`, `components.test.ts` and `video-step.test.ts` stay green (136 of 136).

**Recommended fix** — add an app test to `describe` "a refused list page next to the video on view" in `app.test.ts` (:770-866), after "keeps keyboard focus in the stepper while Try again reads…": open with `openedWithPageTwoRefused(api)`, focus Try again, hold `listRoute`, click it, then `act(() => <another focusable element, such as the screen's h1 or the bottom stepper's nav>.focus())`, release, settle, and assert `document.activeElement` is still that element. No production change.

**Remediation brief**
- **Design intent:** "Try again" unmounts with the refused place, so the pressed stepper's `<nav>` (tabIndex -1) holds focus while the page reads, and the effect then hands focus to what lands (the step link, or Try again when refused again), only if the nav still has it.
- **Full surface:** `apps/web/src/app.test.ts:770-866`.
- **Must preserve:** "keeps keyboard focus in the stepper while Try again reads…" and "gives keyboard focus back to Try again when the page is refused again".
- **Do not touch:** the `retried` ref and effect in `VideoStepper.tsx:50-62`.
- **Proof:** the new test passes; then delete `VideoStepper.tsx:57`, rerun `pnpm exec vitest run apps/web/src/app.test.ts -t "refused list page"`, the new test must fail; restore.

### 6. Four custom range assertions compute their expectation with the production helper — LOW
- **Location:** `apps/web/src/app.test.ts:1072` and `:1081-1082`; `apps/web/src/controls-bar.test.ts:157-159` and `:171-173`
- **Attribution:** introduced by `65b5c49` (#182).
- **Real-world trigger:** a bug in `prefillOf`, `customRangeErrorOf` or `boundsOf` (which `fakeBounds` also comes from, `fake-api.ts:59`) moves both sides of these assertions together. Three of the four are each followed by a literal assertion of the same value, so they only duplicate it; `app.test.ts:1081-1082` has no literal, so that test's message check is an identity against the production function (it still goes red if From is not prefilled, because its From argument would differ). CODING_STANDARDS 2: "A test builds only its input, and observes only real output."

**Evidence**
```ts
    const { from } = prefillOf(defaultRoute, fakeBounds)
    expect(rangeErrorIn(container)).toBe(customRangeErrorOf(from, '2026-10-06', fakeBounds))
```
**Recommended fix** — delete the oracle lines at `app.test.ts:1072`, `controls-bar.test.ts:157-159` and `:171-173`, keeping the literal assertions after each. At `app.test.ts:1081-1082`, replace both lines with one assertion on the literal sentence the app shows: the message names the fake's last processed day, 2026-10-04, in the sentence form the controls-bar test pins ("YouTube has processed data up to … Pick that day or an earlier one."); print `rangeErrorIn(container)` once to copy the exact text, and check by eye that it names 4 October 2026. Then drop the now-unused imports (`customRangeErrorOf`, and `prefillOf` if nothing else uses it) from both files.

**Remediation brief**
- **Design intent:** each test states a rule from #182 ("the fields fill with the window's days once the bounds land"; "the past-the-last-processed-day message follows from the filled fields") and observes it in the real output.
- **Full surface:** the four sites above, and the imports at `app.test.ts:19` and the matching import in `controls-bar.test.ts`.
- **Must preserve:** every test name and every literal assertion; the tests stay red at `$BASE`.
- **Do not touch:** `fakeBounds` in `fake-api.ts`, used as an input elsewhere, which is fine.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/controls-bar.test.ts` green; `pnpm lint` green (unused imports).

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/VideoDetail.tsx:236-237` — "For a video the page's last answer said Google has not processed, as a list row opened from the list says, the head's place and then only the awaiting answer's" → "For a video the page's last answer said Google has not processed, as a list row opened from the list says, the head's place unless its list row heads the screen, then only the awaiting answer's" (a row opened from the list sets `withHead` false, so no head place is held)
- `apps/web/src/VideoStepper.tsx:26-27` — "No key opens either: they are reached with / * Tab." → reflow so "Tab." ends the line before it
- `apps/web/src/metric-charts.ts:114-116` — the short line "day when one is below zero." left by the reflow → reflow the paragraph
- `apps/web/src/placeholder.test.ts:171` — "(creator-analytics issue 166, review pass 1)" → "(creator-analytics#166)", dropping the process narration

## Needs Further Investigation

### A. A preference changed while a reset's DELETE is in flight is wiped from the screen but saved on the server — confirm with an app test
Pre-existing, untouched by this branch (`App.tsx:343-353`, unchanged order of `setSaved({})` after the await). Reasoned, not executed: confirm Reset, change Currency before the DELETE answers; the PUT queues behind the DELETE, the reset then sets `{}` on screen and strips the address, and the PUT lands, so the server holds the change while the screen shows the default. Confirm with `api.hold('DELETE /api/me/preferences')`, a Currency choice, release, then compare `api.preferences` with the select. If confirmed, it is a follow-up ticket, not a gate.

### B. Two quick presses of Sign out — confirm what the API answers a sign-out with no session
No in-flight guard (`App.tsx:363`, `AccountMenu.tsx:127`, `Profile.tsx:133`), so two presses send two POSTs. If the second answers an error once the first has cleared the cookie, its alert lands on the signed-out screen, even after finding 1's fix. Confirm by `POST /api/auth/sign-out` without a session cookie against the API (`apps/api/src/app.ts:147`); a 2xx kills this.

## Reviewed and Dismissed
- Stale refused page after the window changes and back on the same video (`VideoDetail.tsx:357`, `read.key` still the old key) — matches the spec: a re-render of the same video does not re-read; Try again still works.
- Focus stays on the stepper nav when a retried page lands empty (`VideoStepper.tsx:52-62`) — the spec names only the step and Try again; an empty adjacent page is the end of the list, and the nav is a sane place.
- On a cold open, the placeholder switches from the full set to the awaiting set when the detail screen's own list page lands first — recorded #166 design, the same moment the head row replaces the head placeholder.
- The draft key uses `route.channel` as the address writes it (`controls-bar.ts:99-102`) — absent and explicit forms of one channel are never consecutive routes while the bar is mounted; the channel switch itself is pinned (mutation turns both tests red).
- Module-level video memory leaking between app tests — the new tests use unique ids; no order dependence found.
- `processing.test.ts:52` passing against a constant-false stub — the test beside it rejects that stub, and a non-replacing mutation turns :52 red.
- Assertions on `refusedPageText`, `retryText` and `notProcessedText` (`app.test.ts:706`, `:800-801`, `components.test.ts:860-861`) — behaviour tests that observe a branch through its text, not copy tests.
- `placeholder.test.ts:199` comparing `app.css` with a measured line table — a rule from a measurement outside the CSS, with its limits stated.
- The shell test "shows its failure and Try again in the next place, where the end of the list shows neither" — one rule (refused vs end), shown by contrast.
- "Google" in comments vs "YouTube" in `notProcessedText` — matches the api-types wording.
- The thumbnail sizes test comparing against `listThumbnailSizes`/`detailThumbnailSizes` — its rule is which constant each screen passes (#188's recorded choice).

## Minor / nits
- `_bounds` parameters of `windowPickedOf` and `dayTypedOf` (`controls-bar.ts`) read nothing. CODING_STANDARDS 3 would drop them, but the epic pins the named unit cases "as written", which call them with bounds. Nick's call; dropping them means editing those unit cases.
- The #262 word mapping is asserted at unit (`video-step.test.ts`), markup (`components.test.ts:806-830`) and app (`app.test.ts:616-620`) levels, and `stepLabelOf`'s test repeats all six combinations; the epic asked for unit and app tests, and the markup and six-way label cases are duplicates under standard 2.
- `app.test.ts:616-620` asserts `className` `toBe('video-stepper-previous')`, an exact class string, and then repeats the name `linkLabelled` already proved.
- `route.test.ts:301` `toStrictEqual` on the whole route pins more than the page size.
- The detail screen's zero-label test pairs labels by index parity (`app.test.ts:572`), which assumes two labels per chart.
- The #183 app test fakes a second channel by wrapping `fetch` by hand; the fake's `channels` field (#188) could carry it if the fake learned per-channel paths.
- The stepper nav (tabIndex -1) has no focus-ring rule, so after a keyboard Try again the whole nav may show the visual system's ring while reading. Browser walk.

## Test quality
Tests added or modified: 69 cases. Green against `$BASE`: 17, all expected (#171's six and #188's nine pin already-shipped behaviour; #188's commit `17d4624` claims a mutation proof for each item, and #171's recorded assumptions say each since-publish test went red with its call alone deleted; the #166 cold-open test is that feature's negative control). Tautology shapes: none assertion-free, none mocking its own unit; four oracles computed with the production helper (finding 6). Rules implemented but unpinned: findings 2 to 5. Repro: `docs/reviews/creator-analytics-266/repro/sign-out-and-reset.test.ts`, run with `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/sign-out-and-reset.vitest.config.ts` (finding 1 red; findings 2 to 4 green, each red under its mutation).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite all pass at `ae2ff6d`.
- **Commit hygiene:** commit this doc and `repro/`. Nothing else is in the tree.
- **Likely reviewer asks:** the awaiting placeholder's height and the stepper's words in each sort in a real browser (Nick's walk, per the epic); the known flaky `apps/api/src/event-relay.test.ts:27` from the run's baseline.

## Verdict
Ready to open the PR. No finding is above LOW, so none gates it. Findings 1 to 7 are cheap and can be remediated before the PR opens or carried as follow-ups; finding 1 is the only behaviour change. Needs Further Investigation A and B are pre-existing or unconfirmed and are follow-up material.
