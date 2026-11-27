# Pre-PR review: creator-analytics#266 Web app fixes after #64: preferences, sign out, the custom range and the video stepper

**Branch:** `creator-analytics-266-web-app-fixes` vs `origin/main` (merge-base `c05d863` "creator-analytics#34 The OAuth runbook's shot list answers Google's 2026-10-19 rejection")
**Reviewed at:** HEAD `477b050` ("creator-analytics#293 A preference changed while a reset is in flight disappears from the screen but stays saved"). The tree was clean, with no uncommitted or untracked files at review time. 33 files, +2,259 / −161 against the merge-base, including review 1's doc and repro. Since review 1 (`ec7a862`), the branch merged origin/main (`f748bab`) and landed four stage-2 tickets: #285 (`32f9af5`, merge `f30b09e`), #284 (`cce8624`, merge `aee1471`), #286 (`3c2d98d`, merge `7f9ea28`) and #293 (`f27b119` and `d5737fa`, merge `477b050`), 14 files, +607 / −56.
**Reviewed against:** the epic body of creator-analytics#266 (End state, Implementation Decisions and Testing Decisions are the spec), its child issues, with #284, #285, #286 and #293 read in full, `CODING_STANDARDS.md` 1 to 3, the stage-2 assumptions the loop recorded for each ticket, and `pre-pr-review-1.md`. A full review, not delta-scoped (`--fresh`), with the most attention on the four stage-2 tickets.
**Date:** 2026-10-20
**Reviewer:** 2 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 470 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres) | 110 files, 2,399 passed, 1 expected fail |
| Tests green at `$BASE` | scratch worktree at `c05d863`, the changed test files and `fake-api.ts` from HEAD copied in, each file run | 29 new or modified cases since review 1: 24 red at base. The 5 green: #284 items 2 and 7 (three tests, test-only by design), the #293 failed-save test (`d5737fa`, pass 1's proof), and a renamed `video-step.test.ts` case that kept only its old assertions. Each green one goes red under its named mutation. See Test quality. |
| Named mutations (#284 items 1 to 7, #285, #286, #293) | scratch worktree at HEAD, one mutation at a time | every one turns at least one target test red |
| #293 save marks | executed scenarios: two resets with changes between them, a change during a reset whose DELETE fails, the first read landing mid-reset | screen and server agree in each; no off-by-one in `changedSince` |
| #286 answer kinds | `LandedListView` traced through `video-list.ts:53-66`, the API's past-the-end page (`apps/api/src/video-list.ts:461`) | every non-`list` own page is a real refusal; a page past the end answers `videos: []` and still maps to null |
| #286 Try again when the page lands without the video | executed repro | focus falls to the body. Finding 1. |
| A signed-in action failing after a successful sign-out | executed repro | its alert shows on the signed-out screen. Finding 2. |
| Review 1 investigation B (two quick sign-outs) | read the installed better-auth 1.7.7 `dist/api/routes/sign-out.mjs:41-54` | a sign-out with no session cookie deletes the cookie and answers 200, so a second press cannot raise an alert. Killed. |
| Em-dashes in shipped strings | grep of added lines | none |
| Browser-only behaviour | not run | heights, wraps, focus rings and a real locale: #294 owns Nick's Chrome and Safari walk, after the merge. |

**Overall:** Every End state item and the four stage-2 tickets are implemented, all four CI checks pass, and every new test goes red at base or under its named mutation. No finding is above LOW. Two are new in this round: #286's whole-stepper "Try again" drops keyboard focus to the page body when the re-read page no longer holds the video, and its failure markup is now written twice in one file. A third is an older gap that #284 narrowed without closing: a signed-in action that fails after a successful sign-out still puts its alert on the signed-out screen. The PR can open. The rest is carried from review 1 (one oracle finding and comment hygiene) or is a pre-existing follow-up.

## Approach decisions
- Sign-out failure (#165, #284): `signOut` throws on a non-ok answer through `assertAnswered`, and each call site catches it with `.catch(showError)`. A successful sign-out or "Delete me" clears the alert with `setError(null)` beside `clearToasts()` (`App.tsx:339`, `:372`). Finding 2 keeps that and drops late failures with an error setter that only writes while the session is signed in. It does not clear the alert again, and it does not gate `showError` itself, because the signed-out screen's sign-in failure needs `showError`.
- A refused own list page (#286) is one failure across the whole stepper (`stepperOf` returns the `RefusedPlace`), and focus after its "Try again" follows #187: the nav holds focus while the page is read, then focus goes to what lands. Finding 1 adds the case where nothing lands. Focus then goes to the screen's `h1`, the same target the screen already uses for a new video (`VideoDetail.tsx:485-491`).
- Test gaps are closed with a test in the describe for their ticket, never with a production change, and each test must go red under the mutation its finding names (carried from review 1).

## Confirmed Issues

### 1. "Try again" on a failed own list page drops keyboard focus to the page body when the page comes back without the video — LOW
- **Location:** `apps/web/src/VideoStepper.tsx:58` (the effect's early return) and `:85` (`if (stepper === null) return null`)
- **Attribution:** introduced. `3c2d98d` ("creator-analytics#286 The video stepper shows nothing when the read of the video's own list page fails") adds the whole-stepper Try again (`git log -S'video-stepper-whole' c05d863..HEAD` names only it). At `$BASE` a refused own page gave no stepper and no Try again, so this transition did not exist. #187's adjacent Try again cannot reach it, because the nav stays mounted while the own page holds the video.
- **Real-world trigger:** the read of the page holding the video fails (a 5xx or a dropped connection). The creator tabs to "Try again" and presses it. Meanwhile a new upload has pushed the video onto the next page, or in a metric sort the video's numbers moved it across a page edge. The page comes back without the video, so both steppers go away. The nav they pressed held focus, so focus falls to `<body>`. A keyboard or screen reader user loses their place, with nothing announced. LOW: focus is lost on a rare path, and nothing is wrong or destroyed.

**Evidence**
```ts
    const pressed = retried.current
    if (pressed === null || stepper === null) return
    ...
  if (stepper === null) return null
```
**Failure mode:** the own page is refused, Try again is focused and pressed, the re-read answers a page without the video, `stepperOf` returns null, and `VideoStepper` unmounts its focused `<nav>`. `document.activeElement` becomes the body, and `retried.current` stays `'whole'`. Executed: `repro/review-2.test.ts` "finding 1" fails with `expected <body>… not to be <body>…`.

**Recommended fix**
```diff
 export function VideoStepper({
   stepper,
   listRoute,
   navigate,
   onStep,
   onRetry,
+  fallbackFocus,
 }: {
   stepper: Stepper | RefusedPlace | null
   ...
   onRetry: (page: number) => void
+  fallbackFocus: RefObject<HTMLElement | null>
 }) {
   ...
   useEffect(() => {
     const pressed = retried.current
-    if (pressed === null || stepper === null) return
+    if (pressed === null) return
+    if (stepper === null) {
+      retried.current = null
+      if (document.activeElement === document.body) fallbackFocus.current?.focus()
+      return
+    }
     const whole = 'refused' in stepper
```
In `VideoDetail.tsx:494-503`, pass `fallbackFocus={title}` (the `h1` ref from `:446`, which already has `tabIndex={-1}` at `:116`). Add `type RefObject` to the `react` import in `VideoStepper.tsx`. Then move the repro's "finding 1" test into `describe('a refused list page holding the video on view', …)` in `apps/web/src/app.test.ts` (:1004), using that describe's `openedWithItsPageRefused`-style setup. Strengthen its last assertion to `expect(document.activeElement).toBe(container.querySelector('h1'))`.

**Remediation brief**
- **Design intent:** "Try again" goes away with the refused place, so the pressed stepper's `<nav>` (tabIndex -1) holds focus while the page is read. The effect then gives focus to what lands: the step link, Try again on a repeat refusal, or for the whole stepper its first link or button once neither place is still reading. Focus the creator moved elsewhere stays put (the `document.activeElement !== nav.current` guard). The missing case is "nothing lands": the stepper is gone, and focus has to land somewhere meaningful, which is the screen's title.
- **Full surface:** `apps/web/src/VideoStepper.tsx:1` (import), `:37-51` (props), `:56-58` (the effect's guard), and the doc comment at `:33-34`, which should add: "When the page lands without the video there is no stepper, and focus goes to the screen's title." Also `apps/web/src/VideoDetail.tsx:494-503`, the only place `VideoStepper` is created (it renders twice through `{stepper}` at `:215` and `:226`).
- **Must preserve:** the six tests in `app.test.ts` `describe('a refused list page holding the video on view')` (:1004 on), the #187 focus tests in `describe('a refused list page next to the video on view')`, including "leaves keyboard focus the creator moved out of the stepper…" (the `activeElement` guard at `:69` stays as is), the components markup test at `components.test.ts:873`, and the `'whole'` wait for both places to stop reading (pinned by "keeps keyboard focus in the stepper until the page next to its own lands too"). A direction retry whose stepper turns null now also clears `retried` and falls back to the title if focus is on the body, which is intended.
- **Failure of the fix:** if the title has not mounted, `fallbackFocus.current` is null and focus stays on the body, which is today's behaviour, so the fix does no harm. That cannot happen while a stepper was on screen, because the steppers render only beside a head (`VideoDetail.tsx:215`, `:226`).
- **Do not touch:** the dismissed "refusal kept when the same video arrives on another page" (see Reviewed and Dismissed).
- **Proof:** red now, green after: `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-2.vitest.config.ts -t "finding 1"`. Then run the moved test: `pnpm exec vitest run apps/web/src/app.test.ts -t "refused list page holding the video"`.

### 2. A signed-in action that fails after a successful sign-out puts its alert on the signed-out screen — LOW
- **Location:** `apps/web/src/App.tsx:212` (`showError`, which sets the alert in any session state) with `:413` (disconnect) and `:416` (reset), which catch with it, and the signed-in reads at `:244-247` and `:255-256`
- **Attribution:** pre-existing, untouched. At `$BASE` `showError` is the only setter and nothing clears the alert (`git show c05d863:apps/web/src/App.tsx`: `setError` only at :209, with `resetPreferences().catch(showError)` at :404 and `disconnect(...).catch(showError)` at :401). `cce8624` (#284) clears the alert when the sign-out or "Delete me" request itself succeeds. That closes review 1's retry path, but a failure that lands after that point still sets the alert.
- **Real-world trigger:** on the profile, the creator presses "Reset preferences" (or "Disconnect"), then presses "Sign out" before the first request answers. The sign-out succeeds, and the reset then fails, for example on a dropped connection. The signed-out screen reads "Error: The API answered 500" above "Sign in with Google", which says something is wrong when it is not. LOW: the display is misleading, the race is narrow, and no data or session is wrong.

**Evidence**
```ts
  const showError = useCallback((reason: unknown) => setError(String(reason)), [])
  ...
                onResetPreferences={() => resetPreferences().catch(showError)}
```
**Failure mode:** the DELETE is held, Reset is pressed, Sign out succeeds (signed-out screen, `error` null), then the DELETE fails, `showError` runs, and the alert shows on the signed-out screen. Executed: `repro/review-2.test.ts` "finding 2" fails with `expected <p role="alert"></p> to be null`.

**Recommended fix**
```diff
   const showError = useCallback((reason: unknown) => setError(String(reason)), [])
+  const sessionState = useRef(session.state)
+  sessionState.current = session.state
+  const showSessionError = useCallback((reason: unknown) => {
+    if (sessionState.current === 'signed-in') setError(String(reason))
+  }, [])
```
Use `showSessionError` in place of `showError` at `App.tsx:413` (disconnect), `:416` (reset), `:246` (the `readChannels` failure) and `:256` (the `readPreferences` failure), and add it to that effect's dependency list (`:261`). Leave every other `showError` call as it is. Move the repro's "finding 2" test into `describe('the signed-out screen', …)` in `app.test.ts`, and add the same test with a held `DELETE /api/channels/<id>` disconnect if its confirm path makes that cheap.

**Remediation brief**
- **Design intent:** the app has one alert line, `error`. It belongs to the session it showed in, as toasts do (`clearToasts`). A successful sign-out or "Delete me" ends that session and clears it. A failure from a request the old session started must not reach the next screen. Sign-in and session-read failures belong to the signed-out or loading screen, so they keep writing the alert.
- **Full surface:** `apps/web/src/App.tsx:212` (add the setter beside `showError`, mirroring the `routeOnView` ref at `:230-231`, the nearest precedent), `:246`, `:256`, `:261`, `:413`, `:416`.
- **Must preserve:** `showError` unchanged at `:236-239` (session read failure), `:387`, `:417` and `:418` (sign-out and Delete me failures, while still signed in), `:394` (sign-in failure on the signed-out screen), and `:400` (consent screen). Every failed-action alert test in `app.test.ts` while signed in: "a failed sign-out" (:379 on), the reset and disconnect failure tests, and "shows no alert of a failed "Sign out"/"Delete me" once a second one succeeds" (:346, :362).
- **Failure of the fix:** if `sessionState.current` were stale, reading `'signed-in'` after a sign-out, a late failure would still show, which is today's behaviour. The ref is written on every render, and a late failure always settles after the sign-out's re-render, so this cannot happen.
- **Do not touch:** the `setError(null)` lines at `:339` and `:372`, which are #284's fix and correct.
- **Proof:** red now, green after: `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-2.vitest.config.ts -t "finding 2"`. Then: `pnpm exec vitest run apps/web/src/app.test.ts -t "signed-out screen"`.

### 3. The refused-page failure line is written twice in `VideoStepper` — LOW
- **Location:** `apps/web/src/VideoStepper.tsx:86-95` (whole stepper) and `:133-139` (one place)
- **Attribution:** introduced by `3c2d98d` (#286), which copied the #187 place markup into a second branch. CODING_STANDARDS 3: the change was already on this path, so the shared piece belongs in the same change.
- **Real-world trigger:** none for users. A copy or behaviour change to the failure line (approved words, the button's handler) has to be made twice, and the whole-stepper `<nav>` at `:90` repeats the nav's props without the comment the other `<nav>` carries at `:97-98` ("Two of these are on the screen… not in the Tab order").

**Evidence**
```tsx
        <span className="video-stepper-failed video-stepper-whole">
          {refusedPageText}{' '}
          <QuietButton onClick={() => retry('whole', refused)}>{retryText}</QuietButton>
        </span>
  ...
      <span className={`${className} video-stepper-failed`}>
        {refusedPageText} <QuietButton onClick={() => onRetry(refused)}>{retryText}</QuietButton>
      </span>
```
**Recommended fix:** one component in `VideoStepper.tsx`:
```tsx
function RefusedPage({ className, onRetry }: { className: string; onRetry: () => void }) {
  return (
    <span className={className}>
      {refusedPageText} <QuietButton onClick={onRetry}>{retryText}</QuietButton>
    </span>
  )
}
```
Call it with `className="video-stepper-failed video-stepper-whole"` and `onRetry={() => retry('whole', refused)}` at `:90`, and with `` className={`${className} video-stepper-failed`} `` and `onRetry={() => onRetry(refused)}` at `:136`. Then make the two `<nav>` returns share one element: render the nav once, with the comment, and choose its children by `'refused' in stepper`.

**Remediation brief**
- **Design intent:** one failure line, the approved words "The rest of the list did not load." and "Try again", wherever a list page was refused. It spans the stepper for the own page and sits in one place for an adjacent page.
- **Full surface:** `apps/web/src/VideoStepper.tsx:85-115` and `:133-139`.
- **Must preserve:** the exact class strings, because `components.test.ts:873` matches `class="video-stepper-failed video-stepper-whole"` literally, and the adjacent place's `video-stepper-<direction> video-stepper-failed`. Also the `ref={nav}`, `tabIndex={-1}` and `aria-label="Videos"` on the one nav, and every test in `components.test.ts` and `app.test.ts` that reads the stepper's markup.
- **Do not touch:** the focus effect beyond finding 1's change.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts apps/web/src/app.test.ts apps/web/src/video-step.test.ts` green, and `pnpm lint` green.

### 4. The retention chart's time axis and the list's durations still write Latin digits in a locale with other digits — LOW
- **Location:** `apps/web/src/retention.ts:64-70` (`timeLabelOf`), used by `retentionAxisOf` (`:79`), the retention rows (`:98`) and the list thumbnails' duration (`apps/web/src/thumbnail.ts:54`)
- **Attribution:** pre-existing, untouched. `timeLabelOf` builds the label from template strings, and neither #186 nor #285 names it. #285 (`32f9af5`) now writes the same chart's 100% and 50% in the locale's digits, so in ar-EG one chart reads ١٠٠٪ on its y axis and "0:00" and "12:34" on its x axis. Each axis is still one numbering system, which is the epic's rule (user story 12), so this is a follow-up and not a gate.
- **Real-world trigger:** a creator whose browser language is ar-EG or hi-IN opens a video's page. The retention chart's time labels, its rows and the list's duration badges read in Latin digits, while every other figure reads in the locale's own digits.

**Evidence**
```ts
  const secs = String(whole % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
```
**Recommended fix:** a follow-up ticket under #266 or the next web epic. Format each part with `new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 })` (the hours and the first minutes unpadded), and give `timeLabelOf` an optional `locale` the way `retentionScaleLabelsOf` takes one. Not for this branch.

**Remediation brief**
- **Design intent:** every number the app writes goes through the locale's formatter, so one screen never reads in two numbering systems (#186, #285).
- **Full surface:** `apps/web/src/retention.ts:64-70`, `:79`, `:98`; `apps/web/src/thumbnail.ts:54`; their tests in `retention.test.ts` and `thumbnail.test.ts`.
- **Must preserve:** en-US and fr-FR output byte for byte ("0:00", "12:34", "1:02:03"), which the existing `timeLabelOf` tests pin.
- **Do not touch:** `retentionScaleLabelsOf`, which is correct.
- **Proof:** a `timeLabelOf(754, 'ar-EG')` unit test expecting Arabic-Indic digits goes red on the template strings and green after.

### 5. Four custom range assertions compute their expectation with the production helper — LOW (carried from review 1, finding 6)
- **Location:** `apps/web/src/app.test.ts:1435` and `:1444-1445`; `apps/web/src/controls-bar.test.ts:157-159` and `:171-173`
- **Attribution:** introduced by `65b5c49` ("creator-analytics#182 Prefill the custom range fields when the bounds land after the fields opened"), and left untouched since review 1. Neither #284 nor any later commit changed these lines.
- **Real-world trigger:** a bug in `prefillOf` or `customRangeErrorOf` moves both sides of these assertions together. Three of the four sit beside a literal assertion of the same value, so they only duplicate it. `app.test.ts:1444-1445` has no literal, so its message check is an identity against the production function. CODING_STANDARDS 2: "A test builds only its input, and observes only real output."

**Evidence**
```ts
    const { from } = prefillOf(defaultRoute, fakeBounds)
    expect(rangeErrorIn(container)).toBe(customRangeErrorOf(from, '2026-10-06', fakeBounds))
```
**Recommended fix:** delete the oracle lines at `app.test.ts:1435`, `controls-bar.test.ts:157-159` and `:171-173`, and keep the literal assertion after each. At `app.test.ts:1444-1445`, replace both lines with one assertion on the literal sentence the app shows. It names the fake's last processed day, 2026-10-04, in the sentence form `controls-bar.test.ts:174-176` pins ("YouTube has processed data up to … Pick that day or an earlier one."). Print `rangeErrorIn(container)` once to copy the exact text, and check by eye that it names 4 October 2026. Then drop the imports these lines leave unused (`customRangeErrorOf` and `prefillOf` at `app.test.ts:20`, and in `controls-bar.test.ts:15` whichever the file no longer uses).

**Remediation brief**
- **Design intent:** each test states a rule from #182 ("the fields fill with the window's days once the bounds land"; "the past-the-last-processed-day message follows from the filled fields") and observes it in the real output.
- **Full surface:** the four sites above and the imports at `app.test.ts:20` and `controls-bar.test.ts:15`.
- **Must preserve:** every test name and every literal assertion. The tests stay red at `$BASE`.
- **Do not touch:** `fakeBounds` in `fake-api.ts`, which is used as an input elsewhere, and that is fine.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/controls-bar.test.ts` green; `pnpm lint` green (no unused imports).

### 6. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.test.ts:8-11`: the header now states only the Sign out half of the limit. Current text: "that "Sign out" clears the toasts (`clearToasts`) only once it succeeds is pinned from the other side, by a failed sign-out, which keeps the signed-in screen and its toasts." Corrected text: the same, with "; no test pins the same for "Delete me", whose failure also keeps the signed-in screen" appended before the full stop. #284 dropped this limit for "Delete me", and that half is still unpinned.
- `apps/web/src/app.test.ts:586`: current text "The change's save queues behind the reset's DELETE, so it lands after the reset clears the screen." Corrected text: "The change's save queues behind the reset's DELETE, so it lands after the reset has cleared every other value." Since #293 the reset no longer clears that change.
- `apps/web/src/VideoDetail.tsx:236-238` (carried from review 1): current text "the head's place and then only the awaiting answer's". Corrected text: "the head's place unless its list row heads the screen, then only the awaiting answer's". A row opened from the list sets `withHead` false.
- `apps/web/src/metric-charts.ts:114-116` (carried from review 1): the short line "day when one is below zero." left by an earlier reflow. Reflow the paragraph.
- `apps/web/src/placeholder.test.ts:173` (carried from review 1): current text "(creator-analytics issue 166, review pass 1)". Corrected text: "(creator-analytics#166)". This drops the process narration.

## Needs Further Investigation
None. Review 1's investigation A was proved and fixed as #293. Its investigation B was killed (see What was verified).

## Reviewed and Dismissed
- A refused page is not read again when the same video arrives under the same read but with another `page` in the address (`VideoDetail.tsx:352-355`, refusals dropped only when `video` changes). This is the recorded design: the `useListPages` doc comment says a refused page is read again "by "Try again" (`retry`), or by a move to another video that needs it, and never by another render of the same video". Try again stays on screen, and review 1 dismissed the same shape.
- `placeOf` maps every non-`list` own page to a refusal. `LandedListView` is only `list` or `refused` (`video-list.ts:104`, `invalid-range` never lands), and a page past the end answers `videos: []`, which still maps to null.
- #293's `changedSince(mark, …)` off by one. `count` is the id of the last save started, the reset's DELETE is not counted, and `mark` is taken before the DELETE is queued, so `> mark` is exactly "queued behind the reset". The scenarios run (two resets, a change during a failed reset, the first read landing mid-reset) all end with screen and server agreeing.
- A change made during a reset to a value the address carries: unreachable while the DELETE is in flight, because every other screen's read waits on `settled()` behind it. By reasoning it would also be consistent: `saved` keeps the value, and the stripped address falls back to it.
- #284's `setError(null)` dropping the landing message. Landing messages describe the ending session's connect or consent outcome, or a sign-in failure shown while signed out, where no sign-out can run.
- The #286 test "shows the stepper's failure and one Try again, where a page without the video shows no stepper" holding two parts. It is one rule (refused versus not on the page) shown by contrast, the same shape review 1 dismissed for #187.
- Two tests pinning the focus guard (`app.test.ts:969` for an adjacent place, `:1120` for the whole stepper). They reach the guard through different branches, since the whole stepper skips the per-place reading check.
- The `'a, button'` selector in the whole-stepper focus effect: mutations to `'button'`, to "never wait for reading" and `||` to `&&` each turn #286 tests red.
- The `.video-stepper-whole` `grid-column: 1 / -1` rule: `.video-stepper` is `1fr 1fr` with no media query override, so it spans at every width.

## Minor / nits
- `App.tsx:347` `const mark = saves.count()` shadows the App-scope `mark` state at `:205` (`useState<ListMark | null>`). `savesBeforeReset` would read unambiguously.
- `retention.test.ts` (ar-EG case) and the app test "writes the retention chart's 100% and 50%…" hard-code ICU's trailing U+061C letter mark after ٪, so a Node ICU update could turn them red with no code change. The #186 tests carry the same dependence.
- The `_bounds` parameters of `windowPickedOf` and `dayTypedOf` (`controls-bar.ts`), carried from review 1, are Nick's call, since the epic pins the unit cases that call them.
- No app test drives a refused own page being read again on Back or Forward. It shares `withoutRefused` with the adjacent case that #284 item 6 pins, and #286 did not ask for it.
- "closes on Profile chosen on the profile screen…" asserts "no new history entry", a rule `historyMoveOf` already owns (`route.ts:428`), so that clause only goes red when two mutations are combined. The focus assertion carries the test.
- `components.test.ts:873` interpolates `refusedPageText` and `retryText` into a regex unescaped, so the `.` in "did not load." is a wildcard. This is harmless.
- `retentionScaleLabelsOf()` builds a new `Intl.NumberFormat` on every render of the retention section. This is cheap and matches `revenue.ts`.

## Prior-review closure
Review 1 (`pre-pr-review-1.md`, at `ae2ff6d`) had seven findings, all LOW.
- **Fully fixed (5):** 1 (alert after a failed then successful sign-out, and "Delete me" too: `setError(null)` plus two app tests), 2 (reset counts only after the DELETE), 3 (a cleared field stays cleared), 4 (a failed sign-out keeps toasts, with the header rewritten) and 5 (focus moved away during Try again). All five came in #284 (`cce8624`), and each new test goes red under its finding's mutation.
- **Partially fixed (1):** 7, comment hygiene. The `VideoStepper.tsx` reflow was fixed by #286's rewrite of that comment. The `VideoDetail.tsx`, `metric-charts.ts` and `placeholder.test.ts` entries are untouched and carried into finding 6.
- **Untouched (1):** 6, the four oracle assertions, carried as finding 5.
- No fix was made only by editing a comment. Investigation A was proved and fixed by #293. Investigation B was killed.

## Test quality
Tests added or modified since review 1: 29 cases across `app.test.ts`, `components.test.ts`, `controls-bar.test.ts`, `preferences.test.ts`, `retention.test.ts` and `video-step.test.ts`. 24 were red against `$BASE` for their ticket's reason. 5 were green, all expected, and each red under a mutation:
- #284 item 2 "that fails leaves the read to show the values the server still holds" (red with `resetSinceOpened` set before the `await`).
- #284 item 7's two account menu tests (red with the press-outside check forced true, and with `followAndClose`'s on-view branch not returning focus).
- #293 "whose save fails goes back to the default the reset left on the server". It is `d5737fa`'s proof, and goes red without `confirmed.current = {}`.
- `video-step.test.ts` "there is no stepper for a video not on the address's page", renamed with its refused assertion moved to the new #286 case. No coverage was lost.

Tautology shapes: none assertion-free, none mocking its own unit, none call-shaped only, no snapshots, no copy tests. The one oracle shape left is review 1's, carried as finding 5. Repro for this round: `docs/reviews/creator-analytics-266/repro/review-2.test.ts`, run with `pnpm exec vitest run --config docs/reviews/creator-analytics-266/repro/review-2.vitest.config.ts`. Findings 1 and 2 are both red. Review 1's repro (`repro/sign-out-and-reset.test.ts`) stays as its audit trail.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite all pass at `477b050`.
- **Commit hygiene:** commit this doc and `repro/review-2.*`. Nothing else is in the tree.
- **Likely reviewer asks:** the real-browser walk (#294, deferred until after merge by decision); why the own page's failure uses the adjacent page's words ("The rest of the list did not load."), which is a recorded #286 assumption reusing approved copy; and the fr-FR retention labels now reading "100 %" with a narrow no-break space (a #285 assumption).

## Verdict
Ready to open the PR, with follow-ups. No finding is above LOW, so none gates it. Findings 1 and 3 were introduced by #286 and are cheap to fix before the PR opens. Finding 2 is pre-existing, and #284 narrowed it without closing it. It is cheap and fits this epic's sign-out work, but it can be a follow-up. Finding 4 is pre-existing and out of this epic's scope, so it is follow-up ticket material. Findings 5 and 6 are carried test and comment hygiene. Of review 1's seven findings, five are fully fixed, one is partially fixed and one is untouched.
