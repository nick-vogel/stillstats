# Pre-PR review: creator-analytics#643 Custom date range in a Popover with a Calendar

**Branch:** `creator-analytics-643-custom-range-picker` vs `origin/main` (merge-base `40288fb` "Merge pull request #710 from nick-vogel/creator-analytics-638-audience-mosaic", which is `origin/main` itself)
**Reviewed at:** HEAD `b101faa` ("creator-analytics#690 Custom range: the Calendar in place of the date fields", the no-ff merge of lane `3e237d8` onto `740a2f6`), clean tree, no uncommitted or untracked files at review time. 17 files, +1580 / −239.
**Reviewed against:** epic creator-analytics#643 (its body is the spec, its first comment the grilled decisions), children #687 (Popover and compact button) and #690 (Calendar) and their acceptance criteria, ADR 0014, `CONTEXT.md` (calendar window), `CODING_STANDARDS.md` standards 1 to 3. No plan docs under `docs/`, and no prior review docs in this folder (`--fresh`).
**Date:** 2026-11-12
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass (`--fresh`)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, lockfile unchanged |
| Lint | `pnpm lint` | green, 678 files; this review's repro passes `biome check` |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | first run: 1 failed, `apps/api/src/video-list.test.ts:1500` "after first365, the cache answers each later window's first slice" timed out at 5000ms (a known flake on #310, in a file this branch does not touch); re-run after 60s green: 164 files, 4,198 passed, 1 expected fail |
| Browser walk | `pnpm test:browser` at HEAD | green: no content security policy violation in 91 steps, custom range Popover in light and dark at 1280px and 375px among them |
| Calendar remount (Finding 1) | `docs/reviews/creator-analytics-643/repro/calendar-remount.test.ts` copied into `apps/web/src/` of a scratch worktree at `b101faa` | red 3 of 3 at HEAD: the grid node is replaced on a re-render, focus is `null` after a press on "Previous month" and after a Month dropdown change. Green 3 of 3 with the Recommended fix applied; `app.test.ts` and `components.test.ts` 475 of 475 green and `tsc` green with the fix |
| Mutation: #183 drop removed | scratch worktree, `draftOnViewOf` returns the draft unchanged | `app.test.ts` "picking another channel drops the day picked..." still green; `controls-bar.test.ts` red in 4 tests (Finding 3) |
| Mutation: an event on opening from the select | scratch worktree, `ControlsBar.tsx` select `onChange` calls `track` when `picked === 'custom'` | `app.test.ts` 343 of 343, `controls-bar.test.ts` and `components.test.ts` 170 of 170 green (Finding 2) |
| Mutation: outside press ignored | scratch worktree, `onOpenChange` returns early on `details.reason === 'outside-press'` | `app.test.ts` and `components.test.ts` 475 of 475 green, typecheck green (Finding 2) |
| shadcn leftovers | `pnpm --filter @creator-analytics/web exec shadcn view calendar` (writes nothing), compared with `calendar.tsx` | weekday `text-[0.8rem]` and caption `[&>svg]:size-3.5` are shadcn's (Finding 7) |
| Tautology audit | base oracle: the branch's six vitest files copied over a scratch worktree at `40288fb` | see Test quality |
| Pure logic under DST and three locales | finder-run probe of `rangePickedOf`, `calendarMonthOf`, `dateOfDay`/`dayOfDate`, `compactRangeTextOf`/`NameOf` in America/New_York, en-GB, en-US, de-DE | all match the spec |
| Real pointer and real screen reader | not run | the walk's CDP presses stand in for the pointer; VoiceOver is Nick's hand step |

**Overall:** The branch does what #643, #687 and #690 ask: the bar keeps one row, the Popover holds a range Calendar with the bounds disabled, Apply and its error, the compact button text and name follow the approved rule, #182 and #183 hold in the pure logic, and every full check is green. One MEDIUM: the copied Calendar builds two of its components inside its render, so every pick, page or dropdown change rebuilds the whole grid, and a keyboard user's focus falls to the page body after a month button or a caption dropdown. Six LOWs are test gaps and leftovers, plus one comment-hygiene batch. Fix Finding 1 before opening the PR.

## Approach decisions

- Calendar subcomponents: every component handed to react-day-picker's `components` is a module-level function, never an inline arrow, as `CalendarDayButton` already is in `calendar.tsx`.
- Outside-press tests for a Base UI popup: dispatch on `document.body` as the account menu's tests do (`apps/web/src/app.test.ts:3961` "closes on a press on nothing outside it...").

## Confirmed Issues

### 1. The Calendar rebuilds its whole grid on every re-render, so focus on a month button or a caption dropdown falls to the page body — MEDIUM
- **Location:** `apps/web/src/components/ui/calendar.tsx:90-102`
- **Attribution:** introduced by `1f7bb3b` ("creator-analytics#690 Custom range: the Calendar in place of the date fields"); `calendar.tsx` does not exist at `40288fb`. The inline pattern is shadcn's own (`shadcn view calendar` writes `Root` and `Chevron` inline too), copied in with it.
- **Real-world trigger:** a keyboard user opens "Custom range", tabs to "Previous month" and presses Enter to reach an older month (stories 7, 25, 26), or picks a month in the caption's Month dropdown and then wants the Year dropdown. After the press, focus is on `<body>`; the Popover is portalled to the end of the document, so getting back means tabbing through the page. The walk shows the Popover stays open in Chrome after a pointer press on "Previous month" (its 375px picks still land), so this is lost focus, not a closed Popover. A pointer user meets nothing visible.

**Evidence**
```tsx
components={{
  Root: ({ className, rootRef, ...props }) => (
    <div data-slot="calendar" ref={rootRef} className={className} {...props} />
  ),
  Chevron: ({ className, orientation }) => {
```
These are new function identities on each render of `Calendar`, and react-day-picker renders `React.createElement(components.Root, ...)` (`DayPicker.js:257`), so React sees a new element type, unmounts the old subtree and mounts a new one: every day button, the nav and the caption selects.

**Failure mode:** any re-render of `CustomRangeCalendar` replaces the subtree: a pick (`setDraft` at `ControlsBar.tsx:255`), a page or dropdown change (`setPaged` at `ControlsBar.tsx:140` and `:145`), the bounds landing, the error appearing, a viewport change. Day buttons get focus back only through `CalendarDayButton`'s `modifiers.focused` effect (`calendar.tsx:124-126`); nothing restores focus on the nav buttons or the caption selects. Executed: the repro is red 3 of 3 at HEAD (grid node disconnected after a re-render; `document.activeElement` null after a "Previous month" press and after a Month change), green 3 of 3 with the fix below.

**Recommended fix**
```diff
-import { type DayButton, DayPicker } from 'react-day-picker'
+import { type CustomComponents, type DayButton, DayPicker } from 'react-day-picker'
@@
       components={{
-        Root: ({ className, rootRef, ...props }) => (
-          <div data-slot="calendar" ref={rootRef} className={className} {...props} />
-        ),
-        Chevron: ({ className, orientation }) => {
-          const Icon =
-            orientation === 'left'
-              ? ChevronLeftIcon
-              : orientation === 'right'
-                ? ChevronRightIcon
-                : ChevronDownIcon
-          return <Icon className={cn('size-4', className)} aria-hidden="true" />
-        },
+        Root: CalendarRoot,
+        Chevron: CalendarChevron,
         DayButton: CalendarDayButton,
         ...components,
       }}
@@
+function CalendarRoot({
+  className,
+  rootRef,
+  ...props
+}: React.ComponentProps<CustomComponents['Root']>) {
+  return <div data-slot="calendar" ref={rootRef} className={className} {...props} />
+}
+
+function CalendarChevron({
+  className,
+  orientation,
+}: React.ComponentProps<CustomComponents['Chevron']>) {
+  const Icon =
+    orientation === 'left'
+      ? ChevronLeftIcon
+      : orientation === 'right'
+        ? ChevronRightIcon
+        : ChevronDownIcon
+  return <Icon className={cn('size-4', className)} aria-hidden="true" />
+}
```
Then move the repro's three tests into `apps/web/src/app.test.ts` or a new `apps/web/src/calendar.test.ts` (happy-dom, as the repro is), so the rule stays held.

**Remediation brief**
- **Design intent:** `calendar.tsx` is the restyled shadcn Calendar: react-day-picker supplies behaviour, this file supplies classes and three component overrides. `CustomRangeCalendar` (`ControlsBar.tsx:107`) re-renders it on every draft change and every page, and react-day-picker keeps its focused day across renders only when the subtree survives them. A stable component identity is the whole fix; nothing else changes.
- **Full surface:** `apps/web/src/components/ui/calendar.tsx:3` (import), `:90-102` (the two inline components), and the new module-level `CalendarRoot` and `CalendarChevron` beside `CalendarDayButton` (`:117`). No call site changes: `ControlsBar.tsx` passes no `components` prop.
- **Must preserve:** `CalendarDayButton`'s focus effect (`calendar.tsx:124-126`), which still moves focus as the arrow keys move the focused day (the Calendar keyboard tests in `app.test.ts` that use `pressToActivate`, `:3643`); `data-slot="calendar"` on the root and `aria-hidden="true"` on the chevron; the `cn('size-4', className)` literal, which `apps/web/test/web.test.ts:320`'s rule 3 test reads through `classNamesIn`; the walk's custom range steps (`apps/site/test/screenshot/browser-walk.ts:1267-1450`).
- **Do not touch:** the `components` merge order (`...components` last), and the comment's Tailwind note at `calendar.tsx:27-28`: Tailwind scans this file's comments, so a recommended fix adds no comment.
- **Proof:** in a scratch worktree, `cp docs/reviews/creator-analytics-643/repro/calendar-remount.test.ts apps/web/src/ && pnpm exec vitest run apps/web/src/calendar-remount.test.ts` is red 3 of 3 before and green 3 of 3 after. Then `pnpm typecheck`, `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/test/web.test.ts`, and `pnpm test:browser` green.

### 2. Two Popover rules have no guard at the component: no event on opening from the select, and an outside press closing it — LOW
- **Location:** `apps/web/src/app.test.ts:4375-4391` ("Escape closes it without applying..."); no outside-press test for the custom range anywhere in `app.test.ts`, `components.test.ts` or the walk
- **Attribution:** introduced; the tests came in `fe9e21b` and `1f7bb3b`.
- **Real-world trigger:** no user-facing failure today. A later change that sends an event when the Popover opens (spec: "Opening or closing the Popover sends nothing", R11) or that stops an outside press dismissing it (spec R5, story 12) passes the whole suite.

**Evidence**
```ts
const select = await pickedFromTheSelect(container)
await pickDay('2026-09-01')
vi.mocked(track).mockClear()
await press('Escape')
```
The mock is cleared after the open, so an event sent on opening is wiped before `not.toHaveBeenCalled()`.

**Failure mode:** executed by mutation. With `track` called in the select's `onChange` when `picked === 'custom'`, `app.test.ts` stays 343 of 343 green and `controls-bar.test.ts` plus `components.test.ts` 170 of 170. With `onOpenChange` returning early on `details.reason === 'outside-press'`, `app.test.ts` and `components.test.ts` stay 475 of 475 green. The compact-button path is held (its `mockClear` at `app.test.ts:4418` comes before the click); the pure `windowPickedOf` returning no move is held by `controls-bar.test.ts`, but not the component around it.

**Recommended fix:** in the Escape test, move `vi.mocked(track).mockClear()` to straight after `render()`, before `pickedFromTheSelect`. Add one test beside it: open from the select, pick a day, dispatch `pointerdown`, `mousedown` and `click` on `document.body` inside `act`, as the account menu's "closes on a press on nothing outside it" does (`app.test.ts:3961`), then assert `rangePopover()` is null, the select is back on `last28`, the address has no `window=custom`, and `track` was not called.

**Remediation brief**
- **Design intent:** the Popover is Base UI's, non-modal, so an outside mouse press dismisses on the click that follows a `pointerdown` seen while open ("intentional" mode). Every close without Apply goes through `onOpenChange(false)` to `dismissedOf` (`ControlsBar.tsx:216-218`), and nothing in opening or closing sends an event; only Apply does.
- **Full surface:** `apps/web/src/app.test.ts:4375-4391` and a new test beside it in the same describe.
- **Must preserve:** the Escape test's other assertions (select value, focus on the select, no compact button).
- **Do not touch:** `dismissedOf` and `onOpenChange` themselves (Reviewed and Dismissed: the outside press is correct in Base UI's source).
- **Proof:** re-apply each mutation above in a scratch worktree; each must turn one `app.test.ts` test red. Then `pnpm exec vitest run apps/web/src/app.test.ts` green on the real code.

### 3. The app's channel-switch test stays green with the #183 drop removed, and carries a dead creation-day stub — LOW
- **Location:** `apps/web/src/app.test.ts:4230-4262`
- **Attribution:** introduced in `1f7bb3b`, which rewrote the base test of the same rule.
- **Real-world trigger:** none; the rule is held by `controls-bar.test.ts:401`. The app-level test claims coverage it does not give.

**Evidence**
```ts
await pickInSidebar(container, 'Second channel')
expect(shown.address()).toContain(`channel=${secondChannel.id}`)
expect(rangeErrorIn()).toBeNull()
expect(rangePopover()).toBeNull()
```
`rangeErrorIn()` reads inside the Popover, so it is null whenever the Popover is closed, and the press in the sidebar closes it whatever `draftOnViewOf` does. The comment "with an earlier creation day of its own" and the `creationDay: '2018-01-01'` override served the deleted typed-From test; nothing reads them now.

**Failure mode:** executed by mutation: with `draftOnViewOf` returning the draft unchanged, this test stays green while four `controls-bar.test.ts` tests go red.

**Recommended fix:** after the switch, reopen with `await choose(container, 'Date range', 'custom')` and assert `rangeDaysIn()` is the second channel's prefill (not `2026-09-15` as a start) and `rangeErrorIn()` is null; or delete the app test, since `controls-bar.test.ts:401` states the rule. Drop the creation-day override and its comment either way.

**Remediation brief**
- **Design intent:** the draft is keyed to the view (`viewOf`: channel, window, range), and `draftOnViewOf` drops it on any change of view (#183). The Popover's own dismiss also drops it, so an app test only sees #183 by reopening on the new view.
- **Full surface:** `apps/web/src/app.test.ts:4230-4262`.
- **Must preserve:** `controls-bar.test.ts:401` "a channel switch drops the day picked and the error Apply answered on the other channel".
- **Do not touch:** `draftOnViewOf`.
- **Proof:** with the mutation above in a scratch worktree, the rewritten test goes red; on the real code `pnpm exec vitest run apps/web/src/app.test.ts` is green.

### 4. The controls-bar tests still drive one-ended day edits the Calendar cannot make, and one states the opposite of the Calendar's rule — LOW
- **Location:** `apps/web/src/controls-bar.test.ts:148` (describe "the custom range fields in the bar"), `:212`, `:225`, `:234`, and the To-only or From-only `dayTypedOf` calls at `:156`, `:173`, `:214`, `:227`, `:237`, `:298`, `:334`; `apps/web/src/controls-bar.ts:205` (`_bounds`, unused)
- **Attribution:** pre-existing, exposed. These tests are the base's typed-field tests, kept by `fe9e21b` and `1f7bb3b`; the Calendar made their inputs unreachable. `dayPickedOf` always passes a whole `{ from, to }` from `rangePickedOf`.
- **Real-world trigger:** none for users. A maintainer reading `:225` "a From typed before the bounds land stays, and the To fills with the window's day once they land" learns a rule the product no longer has: a pick before the bounds land keeps `to: ''` (`:386`). `:234` (From cleared, then Apply) is a state no control produces. #182's "an end past the late bound, then Apply, names the last processed day" is held only through the unreachable To-only shape at `:212`.

**Evidence**
```ts
test("a From typed before the bounds land stays, and the To fills with the window's day once they land", () => {
```

**Failure mode:** standard 2: tests that state no rule from the spec. The real path (two picks before the bounds, the end past them, Apply after they land) has no test at any level.

**Recommended fix:** rewrite `:212` through `windowPickedOf(..., 'custom', null)`, `dayPickedOf(..., null, '2026-09-20')`, `dayPickedOf(..., null, '2026-10-09')`, then `appliedOf(..., bounds, 'en-GB')`, expecting no move and the error `customRangeErrorOf('2026-09-20', '2026-10-09', bounds, 'en-GB')` returns. Delete `:225` and `:234`, and move the other one-ended calls to `dayPickedOf` or delete each one whose rule the "a day picked..." describe already states. Rename the describe to the Popover's draft. Drop `dayTypedOf`'s unused `_bounds` parameter and its callers' argument (`controls-bar.ts:243` inside `dayPickedOf`, and the tests).

**Remediation brief**
- **Design intent:** `dayTypedOf` is now only the merge step under `dayPickedOf`; the creator sets both ends of the range at each tap (`rangePickedOf`), and the prefill only shows through when nothing is set.
- **Full surface:** `apps/web/src/controls-bar.test.ts:148-340`, `apps/web/src/controls-bar.ts:198-208` and `:242-243`.
- **Must preserve:** every rule in the describe "a day picked..." near `controls-bar.test.ts:380-410`; `customApplyOf`'s bound errors.
- **Do not touch:** `customRangeErrorOf`'s four rules: the address can still carry an inverted or out-of-bounds range (spec).
- **Proof:** the rewritten `:212` test goes red with the bound check removed from `customRangeErrorOf` in a scratch worktree; `pnpm exec vitest run apps/web/src/controls-bar.test.ts` and `pnpm typecheck` green on the real code.

### 5. Three markup tests depend on attribute order — LOW
- **Location:** `apps/web/src/components.test.ts:1658`, `:1792`, `:1804`
- **Attribution:** introduced in `fe9e21b` (`:1658`) and `1f7bb3b` (`:1792`, `:1804`).
- **Real-world trigger:** none for users; a Base UI or React upgrade that orders attributes differently turns these red with nothing broken.

**Evidence**
```ts
expect(markup).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-label="Custom range, /)
```

**Failure mode:** standard 2 bans asserting attribute or key order. `:1792` and `:1804` assume `type` before the text and `role` first.

**Recommended fix:** take the tag out first and check each attribute on its own, as the file's `dayButtonIn` helper does.

**Remediation brief**
- **Design intent:** the components tests read server markup; each states one rendered fact.
- **Full surface:** `apps/web/src/components.test.ts:1658`, `:1792`, `:1804`.
- **Must preserve:** what each asserts: a compact button with popup state and its name, a submit Apply, an alert holding the error.
- **Do not touch:** `dayButtonIn`.
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts` green.

### 6. An app test reopens a custom range by choosing "Custom range" again, which a native select never fires — LOW
- **Location:** `apps/web/src/app.test.ts:4211-4212`
- **Attribution:** introduced in `fe9e21b`.
- **Real-world trigger:** none; the test reaches the Popover by a path the product does not have. On `?window=custom&...` the select already shows "Custom range", so a real pick of it fires no `change`; `choose` sets the value and fires `change` regardless. The product's way back in is the compact button.

**Evidence**
```ts
const { container } = await render('?window=custom&from=2026-09-01&to=2026-09-30')
await choose(container, 'Date range', 'custom')
```

**Recommended fix:** `await click(compactRangeButtonIn(container)!)` in its place, so the late-bounds rule is held on the path a creator takes.

**Remediation brief**
- **Design intent:** on a custom route the compact button (a Base UI `PopoverTrigger`) reopens the Popover on the applied range.
- **Full surface:** `apps/web/src/app.test.ts:4208-4220`.
- **Must preserve:** the test's rule, a pick made while the list reads stays once it answers (#182).
- **Do not touch:** `choose` (`app.test.ts:221`), which other tests use on real changes.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 7. Two of shadcn's own sizes are left in the Calendar's classes — LOW
- **Location:** `apps/web/src/components/ui/calendar.tsx:81` (`text-[0.8rem]` on the weekday names), `:76-78` (`[&>svg]:size-3.5` on the caption's chevron)
- **Attribution:** introduced in `1f7bb3b`. `shadcn view calendar` (shadcn 4.23.0, style `base-nova`) writes `weekday: "... text-[0.8rem] font-normal text-muted-foreground select-none"` and `caption_label: "... [&>svg]:size-3.5 [&>svg]:text-muted-foreground"`.
- **Real-world trigger:** visible on every open: the weekday row's type is shadcn's 12.8px, not one of the visual system's sizes (the app's small text is `0.8125rem`, e.g. `app.css:519`, `:610`). ADR 0014: "shadcn supplies behaviour and structure only, and the visual system keeps every visible value", type among them. Rule 3's test checks theme values, not this, so it passes.

**Recommended fix:** `text-[0.8125rem]` on `weekday`; on `caption_label`, a chevron size the visual system already uses in the account menu or the select (`dropdown-menu.tsx`, `ListSelect.tsx`), or `size-4` to match the Calendar's own nav chevrons.

**Remediation brief**
- **Design intent:** ADR 0014 rules 1 to 3: tokens and visible values come from the visual system; shadcn's class strings are structure only.
- **Full surface:** `apps/web/src/components/ui/calendar.tsx:76-81`.
- **Must preserve:** `apps/web/test/web.test.ts:320`'s rule 3 test for `calendar.tsx` (each class emits a rule, no colour outside the tokens); the 2.25rem cell, which the 375px fit depends on.
- **Do not touch:** the `[background:...]` shorthands (`calendar.tsx:18-19` says why: the minifier's `#0000`).
- **Proof:** `pnpm build && pnpm exec vitest run apps/web/test/web.test.ts` green, then `pnpm test:browser` green.

### 8. Comment hygiene — LOW (aggregated)
- `apps/web/src/bar-height.ts:21-22` — "The custom range's fields open in a Popover, so they no longer grow it." → delete the sentence (narrates the change; "wraps on a narrower window" already says it).
- `apps/web/src/custom-range.ts:37-38` — "Flagged for Nick's approval at code complete." → "Not yet approved by Nick; change them only with him." or, once approved, the approval line in the `customRangeText` form.
- `apps/web/src/custom-range.ts:48-49` — "`CustomRangeCalendar` reads it through matchMedia." → "`ControlsBar`'s `useCalendarMonths` reads it through matchMedia."
- `apps/web/src/components/ui/calendar.tsx:10-11` — "Gone are shadcn's popover, primary and muted colours" → "shadcn's popover colours are gone; its primary and muted names stay, set by the visual system's tokens (ADR 0014 rule 1)".
- `apps/web/src/components/ui/calendar.tsx:25` — "as the app's other dates do, not date-fns's en-US" → add "except the day numbers, the year dropdown and each gridcell's name, which react-day-picker still formats in en-US".
- `apps/web/src/components/ui/calendar.tsx:25-27` and `apps/web/src/components/ui/popover.tsx:9-10` — the CLI history ("copied by hand from `shadcn view calendar`... no `cn` or `date-fns` package was added", "its dependency was reverted") → delete; `date-fns` does ship, as react-day-picker's own dependency (`pnpm-lock.yaml`).
- `apps/web/src/ControlsBar.tsx:104-105` — "The browser's own checks are off, so Apply's approved texts show." → delete, with `noValidate` at `:130`: the form holds no constrained input.
- `apps/web/src/controls-bar.ts:63`, `:121-122`, `:129-131`, `:151-153`, `:171`, `:181-184`; `apps/web/src/custom-range.ts:153`, `:180-184`; `apps/web/src/Audience.tsx:131` — "fields", "typed", "a field the creator has not typed in" → "the shown range", "set", "a range the creator has not picked".
- `apps/web/src/app.test.ts:4233` — "with an earlier creation day of its own" → delete with the override (Finding 3).

## Needs Further Investigation

### A. Tab out of the Popover when the select opened it — confirm with a real Tab from Apply in the walk
The select is no `PopoverTrigger`, so Base UI has no trigger to return Tab order to, and the popup is portalled to the end of `<body>`. Tab from Apply may leave the page for the browser's chrome instead of moving to the control after the select. Base UI closes a non-modal popup on focus out and `finalFocus` returns focus to the select, which may make it harmless. A walk step: open from the select, focus Apply, real Tab, then read `document.activeElement`.

## Reviewed and Dismissed
- A real pointer pick of "Custom range" in the native select counting as an outside press — Base UI's non-modal Popover dismisses a mouse press only on a click after a `pointerdown` seen while open, and the pick's `pointerdown` comes before the Popover opens (dismissed in the #687 lane from Base UI source).
- The "Pick a start day and an end day." error staying after the creator picks the end day — the base rule, "The error stays until the next Apply", which the typed fields had too; a choice, not a defect.
- The compact button's accessible name not containing its visible text — the name and text are both approved by Nick on #643; a requirement, not code.
- The Calendar root's `lang="en-US"` — the document is `lang="en"` and the app's other browser-locale dates sit under it the same way; recorded as an assumption on #690.
- Each day's name drops react-day-picker's "Today" and "selected" words — R10 asks for the full date and the disabled state; the gridcell's `aria-selected` carries selection, and new words would be unapproved copy.
- `dateOfDay`/`dayOfDate` and the disabled matchers across DST — local midnight both ways, as react-day-picker's local date library reads them; both bound days stay pickable.
- Day and nav buttons submitting the form — react-day-picker gives them `type="button"`; Apply sends one event.
- Inline style under the meta-tag policy — react-day-picker's only style is a React `style` prop, applied through the CSSOM; the walk records no violation in 91 steps.
- The walk's height check (0.5px tolerance), its CSP listener timing (`Page.addScriptToEvaluateOnNewDocument` before every navigation) and its fixed fixture days — none vacuous, none date-dependent.
- `components.test.ts:1663` green at base — a negative guard: it goes red if a compact button shows on a calendar window.
- Test expectations read from `customRangeText.emptyField` and `longDateOf` — sibling tests pin the literal and the name's parts independently.

## Minor / nits
- `dismissedOf(_draft, _route)` (`controls-bar.ts:175`) ignores both parameters.
- `twoMonthsQuery` `(min-width: 40rem)` overlaps app.css's `(max-width: 40rem)` at exactly 640px; two months still fit there by arithmetic (about 570px in 589px).
- The walk checks the compact button's name only for its year (`browser-walk.ts:1431`), and `placed.smaller` accepts a popup as wide as the screen (`:1349`).
- The walk's reset after the custom range loop runs outside any `walk()` step, so a violation there is filed under the last mode's name.
- Nothing ties the compact text's year rule to the clock at the component (`ControlsBar.tsx:239`); the pure function's three cases hold the rule.
- `apps/web/test/web.test.ts:315-316` runs past the file's 100-column wrap.

## Test quality
Tests added or modified: 76 across six vitest files (app 16, components 15, controls-bar 15, custom-range 23, bar-height 1, web 6 cases). Red against `$BASE`: 70. Green at base: 6, none vacuous: `components.test.ts:1663` is a negative guard (Dismissed), `bar-height.test.ts:52` and four `web.test.ts:320` cases only changed their titles. Tautology shapes: none strict; expectations read from production constants are anchored by sibling literal tests. Mutation found three app-level tests weaker than their names (Findings 2 and 3). The walk is a script, not a vitest suite, and was run at HEAD only.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, test green (one known API flake on the first run); the walk green at HEAD.
- **Commit hygiene:** commit this doc and `repro/calendar-remount.test.ts`. The repro sits outside vitest's `include` (`{apps,packages}/*/{src,test}/**/*.test.ts`), so it never runs in CI while red.
- **Likely reviewer asks:** the content security policy record and the copy for Nick from the #690 report ("Previous month", "Next month", "Month", "Year"); a hand pick of "Custom range" in Safari and Firefox; VoiceOver on a day and the compact button.

## Verdict
Not ready as-is. Fix Finding 1 (one file, its proof preserved) before the PR opens. Findings 2 to 8 are LOW, can ride the same remediation, and none blocks the PR.

## Remediation — 2026-11-12
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `35a4c43` creator-analytics#643 pre-PR review 1 finding 1: the Calendar rebuilds its whole grid on every re-render, so focus on a month button or a caption dropdown falls to the page body | red→green: `pnpm exec vitest run apps/web/src/calendar.test.ts` (red 3 of 3 before the fix, green 3 of 3 after); preserve: `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts apps/web/test/web.test.ts apps/web/src/calendar.test.ts` 594 of 594, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (165 files, 4,201 passed, 1 expected fail), `pnpm test:browser` (no CSP violation in 91 steps) all green | 1 (the `// @vitest-environment happy-dom` directive, a pragma the runner needs) | fixed, proved by execution (MEDIUM, executed proof, no shared core or symmetric surface, so no verify agent) |
| 2 (LOW) | — deferred | — | — | LOW tail, deferred by default scope (eng-pipeline#34) |
| 3 (LOW) | — deferred | — | — | LOW tail, deferred |
| 4 (LOW) | — deferred | — | — | LOW tail, deferred |
| 5 (LOW) | — deferred | — | — | LOW tail, deferred |
| 6 (LOW) | — deferred | — | — | LOW tail, deferred |
| 7 (LOW) | — deferred | — | — | LOW tail, deferred |
| 8 (LOW, comment hygiene) | — deferred | — | — | LOW tail, deferred |

The repro `repro/calendar-remount.test.ts` now lives in the suite as `apps/web/src/calendar.test.ts`, minus its copy-and-run header; the `repro/` copy stays for the next round.

### Known regressions, deferred
- None.

### Rework briefs
- None: no verify pass ran, so no rework.

### Approach decisions (remediation 1)
- Calendar subcomponents: applied the recorded decision. `CalendarRoot` and `CalendarChevron` are module-level functions typed `React.ComponentProps<CustomComponents['Root' | 'Chevron']>`, beside `CalendarDayButton`, which is the precedent.
- Remount guard: held by a happy-dom test that renders `CustomRangeCalendar` directly through `createRoot` and `act`, as `toast-shown.test.ts` and `cursor-plot.test.ts` do, not through the whole App.
