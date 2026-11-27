# Pre-PR review: creator-analytics#643 Custom date range in a Popover with a Calendar

**Branch:** `creator-analytics-643-custom-range-picker` vs `origin/main` (merge-base `40288fb` "Merge pull request #710 from nick-vogel/creator-analytics-638-audience-mosaic", which is `origin/main` itself)
**Reviewed at:** HEAD `018af9f` ("creator-analytics#643 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 20 files, +2012 / −239.
**Delta under review:** since `b101faa` ("creator-analytics#690 Custom range: the Calendar in place of the date fields"), the HEAD that `pre-pr-review-1.md` reviewed. 4 files, +445 / −13, of which 2 are code: `apps/web/src/components/ui/calendar.tsx` and the new `apps/web/src/calendar.test.ts`, both from `35a4c43` ("creator-analytics#643 pre-PR review 1 finding 1: the Calendar rebuilds its whole grid on every re-render, so focus on a month button or a caption dropdown falls to the page body"). The other two are review 1's doc and repro.
**Reviewed against:** epic creator-analytics#643, `pre-pr-review-1.md` (its Finding 1 intent, its closure table, its Approach decisions), `CODING_STANDARDS.md` standards 1 to 3, ADR 0014.
**Date:** 2026-11-12
**Reviewer:** 1 code-review agent + verify pass (delta-scoped)

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | green, "Already up to date" |
| Lint | `pnpm lint` | green, 680 files |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Full suite | `pnpm test` (Testcontainers Postgres), `TEST_DATABASE_ADMIN_URL` unset | green first run: 165 files, 4,201 passed, 1 expected fail |
| Browser walk | `pnpm test:browser` at HEAD | green: no content security policy violation in 91 steps |
| Finding 1 guard against the pre-fix code | `apps/web/src/calendar.test.ts` copied into a scratch worktree at `b101faa` | red 3 of 3 (grid disconnected; `activeElement` null after "Previous month"; null after a Month change). Green 3 of 3 at HEAD |
| Mutation: one component inline at a time | finder, scratch worktree at HEAD: `Root`, `Chevron`, `DayButton` each wrapped in an inline arrow | `Root` inline: 3 of 3 red. `Chevron` inline: 3 of 3 green. `DayButton` inline: 3 of 3 green (Dismissed, below) |
| Rendered output unchanged | finder: `renderToStaticMarkup` of HEAD's `Calendar` against `b101faa`'s over 7 prop sets (plain, two months with a range, bounds with `disabled`, `captionLayout: 'label'`, root attributes with `dir=rtl`, `animate`, a caller `components.Chevron`) | byte-identical in all 7 |
| Prop types | finder: react-day-picker 10.0.2 `CustomComponents` in `dist/esm/types/shared.d.ts` | non-Partial map; `ComponentProps<CustomComponents['Root' \| 'Chevron']>` resolves to the real props; typecheck agrees |
| Other fresh identities into DayPicker | finder: read `DayPicker.js:86-125`, `:257`, `getComponents.js`, `Nav.js`, `Dropdown.js` | element types come only from `components`; `formatters`, `labels`, `classNames`, matchers are read as data. No remount |
| Tautology audit | the delta's one new test file against `b101faa` (above), and read for the six shapes | no tautology; one standards gap (Finding 1) |
| Real pointer and real screen reader | not run | the walk's CDP presses stand in for the pointer; VoiceOver is Nick's hand step |

**Overall:** Review 1's MEDIUM is fixed and proved: `Root` and `Chevron` are module-level, the grid survives a re-render, focus stays on "Previous month" and on the Month dropdown, the rendered markup is byte-identical to before, and every full check is green. The delta adds one LOW: the new happy-dom test opens without the `Limits:` header every other happy-dom file in the app carries, and its first test is named for a pick it does not make. Review 1's seven LOWs (Findings 2 to 8 here, same numbers) were deferred by its remediation and are untouched; their briefs in `pre-pr-review-1.md` still hold line for line. The branch is ready to open a PR, with the LOWs as follow-ups.

## Approach decisions
- Calendar subcomponents: every component handed to react-day-picker's `components` is a module-level function, never an inline arrow (`CalendarRoot`, `CalendarChevron`, `CalendarDayButton` in `calendar.tsx`). Carried from review 1, applied in `35a4c43`.
- Outside-press tests for a Base UI popup: dispatch on `document.body` as the account menu's tests do (`apps/web/src/app.test.ts:3961` "closes on a press on nothing outside it..."). Carried from review 1.
- Remount guard: a happy-dom test that renders `CustomRangeCalendar` directly through `createRoot` and `act`, as `toast-shown.test.ts` and `cursor-plot.test.ts` do, not through the whole App. Carried from remediation 1.
- A happy-dom test file opens with `// @vitest-environment happy-dom` and then a `// Limits:` header naming what happy-dom cannot observe (`toast-shown.test.ts:2`, `cursor-plot.test.ts`, `app.test.ts`, `video-player.test.ts`, `youtube-player.test.ts`, `analytics.test.ts`, `error-reporting.test.ts`). Added by this review.

## Prior-review closure
Review 1 had 8 confirmed findings: 1 MEDIUM, 7 LOW.
- **Fully fixed: 1.** Finding 1 (MEDIUM). Fixed in `35a4c43`, verified against its intent: the remount came from `Root`, and `Root` is stable; `Chevron` is stable too; mutation shows the guard goes red when `Root` is inline again; markup byte-identical; Must-preserve items intact (`data-slot="calendar"`, `aria-hidden="true"`, the literal `cn('size-4', className)`, `...components` last, `CalendarDayButton`'s focus effect, no comment near the Tailwind classes).
- **Partially fixed: 0.**
- **Untouched: 7.** Findings 2 to 7 and 8 (comment hygiene), all LOW, each marked "deferred" (LOW tail, eng-pipeline#34 default scope) in review 1's closure table. Not escalated, and review 1's "Known regressions, deferred" list is empty.
- **Resolved only by a comment or doc edit: 0.**

## Confirmed Issues

### 1. The new Calendar test states none of happy-dom's limits, and its first test is named for a pick it does not make — LOW
- **Location:** `apps/web/src/calendar.test.ts:1` (no `Limits:` header), `:30` (the first test's name)
- **Attribution:** introduced by the remediation, `35a4c43`; the file does not exist at `b101faa` or `40288fb`.
- **Real-world trigger:** none for users. A maintainer reading the file cannot tell that each test focuses the control by hand because happy-dom moves no focus on a press, or that a removed focused node reads `activeElement === null` here where a browser falls back to `<body>`; the name "a pick re-renders..." claims a pick, but the test only re-renders with new `fields`, as the parent does after `onPick`.

**Evidence**
```ts
// @vitest-environment happy-dom
import { act, createElement } from 'react'
...
  test('a pick re-renders the Calendar without replacing its grid', () => {
    const { host, rerender } = rendered({ from: '2026-10-01', to: '2026-10-13' })
    const grid = host.querySelector('[role="grid"]')
    rerender({ from: '2026-10-05', to: '' })
```

**Failure mode:** `CODING_STANDARDS.md` standard 2, "A test states its own limits", and "Its name says which rule". Every other happy-dom file under `apps/web/src` opens with a `Limits:` line (checked: `cursor-plot`, `app`, `error-reporting`, `video-player`, `analytics`, `youtube-player`, `toast-shown`); this one is the only one without.

**Recommended fix:** add a `Limits:` header as line 2, after the environment pragma, in the house shape: `// Limits: happy-dom moves no focus on a press, so each test focuses the control first, as a keyboard user's Tab would; it draws nothing, so the controls are found by their names. A real pointer press is the browser walk's step.` Rename the first test to `'a re-render with a new range keeps the grid it rendered'`. This finding is about a missing load-bearing comment, so its fix is a comment; nothing else changes.

**Remediation brief**
- **Design intent:** the file guards Approach decision 1 (stable component identities in `calendar.tsx`) by rendering `CustomRangeCalendar` (`apps/web/src/ControlsBar.tsx:107`) directly and re-rendering it with new `fields`. Its three tests are the guard; the `Root` mutation turns all three red.
- **Full surface:** `apps/web/src/calendar.test.ts:1-2` and `:30`.
- **Must preserve:** the three tests' bodies and assertions, unchanged; the `// @vitest-environment happy-dom` pragma on line 1, which vitest reads.
- **Do not touch:** `calendar.tsx`; `docs/reviews/creator-analytics-643/repro/calendar-remount.test.ts` (review 1's preserved proof).
- **Proof:** `pnpm exec vitest run apps/web/src/calendar.test.ts` green 3 of 3, and `pnpm lint` green. In a scratch worktree, `calendar.tsx` from `b101faa` (`git show b101faa:apps/web/src/components/ui/calendar.tsx`) still turns all three red.

### 2. Two Popover rules have no guard at the component: no event on opening from the select, and an outside press closing it — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 2, deferred by remediation 1. `apps/web/src/app.test.ts` is unchanged since `b101faa`, so its location, evidence, mutations, recommended fix and remediation brief there hold line for line.

### 3. The app's channel-switch test stays green with the #183 drop removed, and carries a dead creation-day stub — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 3 (`apps/web/src/app.test.ts:4230-4262`, unchanged since `b101faa`); its brief there holds.

### 4. The controls-bar tests still drive one-ended day edits the Calendar cannot make, and one states the opposite of the Calendar's rule — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 4 (`apps/web/src/controls-bar.test.ts:148-340`, `apps/web/src/controls-bar.ts:198-208`, `:242-243`, both unchanged since `b101faa`); its brief there holds.

### 5. Three markup tests depend on attribute order — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 5 (`apps/web/src/components.test.ts:1658`, `:1792`, `:1804`, unchanged since `b101faa`); its brief there holds.

### 6. An app test reopens a custom range by choosing "Custom range" again, which a native select never fires — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 6 (`apps/web/src/app.test.ts:4208-4220`, unchanged since `b101faa`); its brief there holds.

### 7. Two of shadcn's own sizes are left in the Calendar's classes — LOW
Carried forward unchanged from `pre-pr-review-1.md` Finding 7. `calendar.tsx` changed in `35a4c43`, but only from line 88 down; `:76-81` (`text-[0.8rem]` on `weekday`, `[&>svg]:size-3.5` on `caption_label`) are the same lines at HEAD, so its brief there holds.

### 8. Comment hygiene — LOW (aggregated)
Carried forward unchanged from `pre-pr-review-1.md` Finding 8: every entry there still applies at the line it names (the `calendar.tsx` entries sit at `:10-11` and `:25-27`, above the delta). No new entry from the delta: `35a4c43` adds one comment line, the vitest environment pragma.

## Needs Further Investigation

### A. Tab out of the Popover when the select opened it — confirm with a real Tab from Apply in the walk
Carried forward from review 1, untouched by the delta. The select is no `PopoverTrigger`, so Base UI has no trigger to return Tab order to, and the popup is portalled to the end of `<body>`. Tab from Apply may leave the page for the browser's chrome instead of moving to the control after the select. A walk step settles it: open from the select, focus Apply, real Tab, then read `document.activeElement`.

## Reviewed and Dismissed
- The guard staying green with only `Chevron` inline — an inline `Chevron` remounts only the `aria-hidden` icon inside the nav button and the caption label (`Nav.js`, `Dropdown.js`); the buttons, the grid and focus survive, so there is nothing a user meets and nothing a test should assert. Approach decision 1 keeps `Chevron` module-level as the convention.
- The guard staying green with only `DayButton` inline — `CalendarDayButton` was module-level at `b101faa` and is unchanged; an inline one would remount the day buttons, whose focus effect (`modifiers.focused`) puts focus back. Not a regression the delta makes possible.
- Fresh `formatters`, `labels`, `classNames` and matcher objects on every render (`calendar.tsx:42-89`, `ControlsBar.tsx:136-155`) — they defeat DayPicker's `useMemo` and rebuild its `DateLib`, but remount nothing; a one-month grid's rebuild is not a measurable cost. Do not wrap them in `useMemo`.
- No comment in `calendar.tsx` saying why `Root` and `Chevron` stay module-level — the guard test holds the rule for the one that matters (`Root`), and Approach decision 1 records the convention; a comment there would also sit among the Tailwind-scanned classes.
- `React.ComponentProps<CustomComponents['Root']>` over react-day-picker's exported `RootProps` and `ChevronProps` — the same types; the remediation followed review 1's recommended diff.
- Every dismissal in `pre-pr-review-1.md` "Reviewed and Dismissed" stands: none of the code it cleared changed since `b101faa`. It remains the do-not-touch list.

## Minor / nits
- `apps/web/src/calendar.test.ts:14-16` empties `document.body` but never unmounts the three roots; harmless at three tests, and the repo's happy-dom files are mixed on this (`toast-shown`, `cursor-plot` unmount; `analytics`, `error-reporting`, `youtube-player` do not).
- `docs/reviews/creator-analytics-643/repro/calendar-remount.test.ts` is now a copy of `apps/web/src/calendar.test.ts` plus a three-line header; it sits outside vitest's `include`, so it never runs. Drop it once the PR lands, or keep it as the audit trail.
- Every nit in `pre-pr-review-1.md` "Minor / nits" stands.

## Test quality
Tests added in the delta: 3, all in `apps/web/src/calendar.test.ts`. Red against the pre-fix code (`b101faa`): 3 of 3. Red against `$BASE` (`40288fb`): 3 of 3 by import (`CustomRangeCalendar` does not exist there). Tautology shapes: none; each test builds only its input (`fields`) and reads the real rendered DOM and `document.activeElement`. Mutation: all three go red with `Root` inline; none can see an inline `Chevron` or `DayButton`, which have no focus effect (Dismissed). Standards gap: the file states no limits, and test 1's name overstates its input (Finding 1). The branch's other test files are unchanged since review 1's audit.

## Before opening the PR
- **CI readiness:** lint, typecheck, build, test green on the first run; the walk green at HEAD.
- **Commit hygiene:** commit this doc. Nothing else is uncommitted.
- **Likely reviewer asks:** the content security policy record and the copy for Nick from the #690 report ("Previous month", "Next month", "Month", "Year"); a hand pick of "Custom range" in Safari and Firefox; VoiceOver on a day and the compact button; the Tab question in Needs Further Investigation A.

## Verdict
Ready to open a PR, with follow-ups. Review 1's one MEDIUM is fixed and proved by execution, so prior MEDIUM-or-higher findings left open: 0, and none was resolved only by a comment. Confirmed this round: 8, all LOW: one new (Finding 1, a standards gap in the remediation's own test), seven carried from review 1 untouched by decision. None blocks the PR; they can ride one remediation pass or follow-up tickets. The Confirmed list held its size only because the deferred LOWs carry forward; the delta itself added one LOW and no behaviour bug.
