# Pre-PR review: creator-analytics#338 Pay what you want: a support button for Stillstats

**Branch:** `creator-analytics-338-support-button` vs `origin/main` (merge-base `4c032ab` "Merge pull request #409 from nick-vogel/creator-analytics-359-tanstack-charts")
**Reviewed at:** HEAD `a924742` ("creator-analytics#338 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. 53 files, +5,651 / −92 against the merge-base.
**Delta under review:** since `247541d` ("creator-analytics#415 Support: a tip's amount reaches OpenPanel"), the commit `pre-pr-review-1.md` reviewed. The delta is 5 files, +361 / −3: the finding 1 fix `b320c2e` ("creator-analytics#338 pre-PR review 1 finding 1: pressing "Hide" on the sidebar support item drops keyboard focus to the page body"), which touches `apps/web/src/Sidebar.tsx` and `apps/web/src/app.test.ts`, plus review 1's doc and repro (`dcbddb5`, `a924742`). Code at HEAD is identical to `b320c2e`.
**Reviewed against:** `pre-pr-review-1.md` (its finding 1 brief, Approach decisions and remediation closure table), `CODING_STANDARDS.md` 1 to 3. The epic's spec was reviewed in round 1 and is not re-read for a two-file delta.
**Date:** 2026-11-04
**Reviewer:** 1 code-review agent (delta), and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | already up to date |
| Lint | `pnpm lint` | pass, 551 files |
| Typecheck | `pnpm typecheck` | pass |
| Web suites | `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/components.test.ts` | 268 passed |
| Build, full suite, browser walk | not re-run: the code at HEAD is byte-identical to `b320c2e` (`git diff --stat b320c2e HEAD` touches only `pre-pr-review-1.md`) | green at `b320c2e` per review 1's closure table: `pnpm build`, `pnpm test` (127 files, 2,843 passed, 1 expected fail), `pnpm run --if-present test:browser` (30 steps, no CSP violation) |
| Review 1 repro at HEAD | `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>` | finding 1 test green; finding 2 test still red (deferred LOW, as expected) |
| Mutation: drop `nav.current?.focus()` | scratch worktree at HEAD (agent) | `"Hide" leaves focus on the sidebar` goes red |
| Mutation: drop `tabIndex={-1}` | `sh docs/reviews/creator-analytics-338/repro/sidebar-tabindex-mutation.sh <scratch-dir>` (executed twice, once by the agent and once here) | the test stays green: finding 1 |
| Remount on Hide | read of `App.tsx:282`, `:436-439`, `:513` (agent) | `<Sidebar>` stays mounted: Hide changes only `supportLink`; `sidebarShown` depends on `channels`; the failed-save path does not touch it |
| Clash with other focus code | `grep -rnE "activeElement\|\.focus\(\|tabIndex" apps/web/src` | the other focus calls are mount-once headings (`Profile.tsx:87`, `ConsentScreen.tsx:22`, `VideoDetail.tsx:474`), the consent opener (`App.tsx:371`, `:386`) and `VideoStepper.tsx`; none checks for focus inside the sidebar |
| Prior LOW findings 2 to 7 still present | greps of each indicted line at HEAD | all six still present, unchanged |
| Focus ring in a real browser, VoiceOver | not run | no browser session in this review; Minor / nits |

**Overall:** The finding 1 fix does what its brief asked. Hide now moves focus to the sidebar's `nav` before the item unmounts, the nav stays mounted, Tab order is unchanged, and every behaviour the brief named as must-preserve still holds. The one new finding is LOW: the new test cannot see the `tabIndex={-1}` half of the fix, because happy-dom focuses a plain `<nav>` where a real browser does not. Review 1's LOW findings 2 to 7 were deferred by the remediation scope and are carried forward unchanged. Nothing blocks the PR.

## Approach decisions
- All of review 1's Approach decisions stand unchanged. Finding 1 applied the focus decision (`VideoStepper.tsx`'s `nav` with `tabIndex={-1}`) as written.
- Pinning a programmatic-focus target's focusability in a test: assert its `tabindex` attribute, as `components.test.ts:540` and `:1475` do for `<h1 tabindex="-1">`. Finding 1 follows it.

## Prior-review closure
Review 1 held 7 confirmed findings: 1 MEDIUM, 6 LOW.
- **Fully fixed: 1.** Finding 1 (MEDIUM), by `b320c2e`. Verified against its intent: after Hide, `document.activeElement` is the sidebar's `nav`, which keeps focus through the item's removal and through a failed save's revert. The fix's test pins the `focus()` call but not the `tabIndex`, which is new finding 1 below (LOW, a test gap, not a behaviour gap).
- **Partially fixed: 0.**
- **Untouched: 6.** Findings 2 to 7, all LOW, deferred by the remediation's scope ("Findings 2 to 7 are LOW and deliberately deferred to Nick (eng-pipeline#34)"). Each is carried forward below as findings 2 to 7, with its review 1 brief still valid.
- Fixes resolved only by editing a comment or doc: 0.

## Confirmed Issues

### 1. The new "Hide" focus test stays green without the nav's `tabIndex={-1}`, half of the fix — LOW
- **Location:** `apps/web/src/app.test.ts:3555-3566`; `apps/web/src/Sidebar.tsx:29`
- **Attribution:** introduced by the remediation, `b320c2e`. The test is new there.
- **Real-world trigger:** none today; the code is correct. The gap is that someone removing `tabIndex={-1}` (for example as "unused", since it is outside the Tab order) brings back review 1's MEDIUM bug with the suite green. In a real browser `focus()` on a `<nav>` with no tabindex does nothing, so focus falls to `<body>` when the item unmounts. Capped at LOW: a test-coverage gap with no user path until a regression lands.

**Evidence**
```tsx
    <nav className="sidebar" ref={nav} tabIndex={-1}>
```
```ts
    await click(hide)

    expect(document.activeElement).toBe(sidebarIn(container))
```

**Failure mode** — Executed: with `tabIndex={-1}` removed from `Sidebar.tsx:29`, `"Hide" leaves focus on the sidebar` still passes (1 passed), because happy-dom moves `activeElement` to an element a browser treats as unfocusable. With `nav.current?.focus()` removed instead, the test goes red, so only that half is pinned.

**Recommended fix**
```diff
     expect(document.activeElement).toBe(sidebarIn(container))
+    expect(sidebarIn(container)?.getAttribute('tabindex')).toBe('-1')
```

**Remediation brief**
- **Design intent:** when Hide removes the support item, focus belongs on the sidebar's `nav`, which stays on screen across routes, so the next Tab continues from there. That needs two things: the nav is focusable (`tabIndex={-1}`, which keeps it out of the Tab order) and Hide's handler focuses it before the item unmounts. The test states one rule, focus lands on a sidebar that can hold it, and so must observe both.
- **Full surface:** `apps/web/src/app.test.ts:3565` (one added line after the existing `expect`). No production code changes.
- **Must preserve:** the existing assertion `expect(document.activeElement).toBe(sidebarIn(container))`, which pins the `focus()` call. The test's name. The other tests in `describe("the sidebar's support item")`, including `"Hide" sends the dismissal, removes the item at once and tracks support_prompt_dismissed` and `a failed save of "Hide" brings the item back with the failed save's notice`.
- **Do not touch:** `Sidebar.tsx`. The focus ring and the unnamed landmark (Minor / nits) are separate design calls.
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/sidebar-tabindex-mutation.sh <scratch-dir>` passes the test on the mutant now and must fail it after the fix. Then `pnpm exec vitest run apps/web/src/app.test.ts -t 'leaves focus on the sidebar'` is green at the fix.

### 2. Stripe's return can show the sidebar's support item right beside the thanks line — LOW
- **Location:** `apps/web/src/App.tsx:283`
- **Attribution:** introduced by #411 (`8134e1f`) and #413 (`b63402a`). Carried forward unchanged from review 1 finding 2, deferred by its remediation scope.
- **Real-world trigger:** a creator tips and Stripe's redirect wins the race with the webhook, so `GET /api/me/support` still answers `prompt: true` beside "Thank you for supporting Stillstats." for one page load.

**Evidence** — still at HEAD: `const sidebarSupportLink = sidebarSupportLinkOf(support, saved ?? {})`.

**Failure mode** — Executed at HEAD: the review 1 repro's finding 2 test is still red.

**Recommended fix** — review 1 finding 2's diff, unchanged: `const sidebarSupportLink = supportThanks ? null : sidebarSupportLinkOf(support, saved ?? {})`.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch:** as in `docs/reviews/creator-analytics-338/pre-pr-review-1.md` finding 2. Its line numbers still hold at HEAD (`App.tsx:268`, `:283`).
- **Proof:** `sh docs/reviews/creator-analytics-338/repro/support-ui-repro.sh <scratch-dir>`: "finding 2: Stripe's return shows no sidebar prompt beside the thanks line, before the webhook lands" is red at HEAD and must go green.

### 3. Four fallback paths have no test — LOW
- **Location:** `apps/web/src/App.tsx:312`, `:425`, `apps/api/src/routes/support.ts:26-29`, `apps/api/src/routes/stripe-events.ts:44-47`
- **Attribution:** introduced by #411, #413 and #414. Carried forward unchanged from review 1 finding 3.
- **Real-world trigger:** none today; a regression in any of the four ships silently.

**Evidence** — still at HEAD: `readSupport().then(setSupport, () => setSupport(null))` (`App.tsx:312`) and `readSupport().then(setSupport, () => {})` (`App.tsx:425`), with no test failing the support read.

**Failure mode** — as review 1 finding 3.

**Recommended fix** — review 1 finding 3's four tests, unchanged.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 3. One line moved: the ordering assertion it cites at `app.test.ts:3610` is now at `:3623` (the finding 1 test added 13 lines above it).

### 4. The privacy policy's analytics test is a whole-sentence copy test, against its own Limits comment — LOW
- **Location:** `apps/site/test/site.test.ts:1041-1045`; the Limits comment at `:964-972`
- **Attribution:** introduced by #412 (`018f3c7`). Carried forward unchanged from review 1 finding 4.
- **Real-world trigger:** none for a creator; `CODING_STANDARDS.md` 2.

**Evidence** — still at HEAD, `site.test.ts:1044`: `expect(text).toContain('A tip event carries the amount and currency, and no account ID.')`.

**Failure mode** — as review 1 finding 4.

**Recommended fix** — as review 1 finding 4: delete the test and drop its clause from the Limits comment.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 4; its line numbers still hold.

### 5. Duplicate and overclaiming tests — LOW
- **Location:** `apps/api/src/stripe-events.test.ts:261-262`, `:72`; `apps/api/src/support.test.ts:87-96`; `apps/web/src/app.test.ts:3524-3532`; `packages/database/test/tips.test.ts:39`
- **Attribution:** introduced by #411, #413 and #414. Carried forward unchanged from review 1 finding 5.
- **Real-world trigger:** none; `CODING_STANDARDS.md` 2.

**Evidence** — all five sites still at HEAD at the same lines (checked by grep).

**Failure mode** — as review 1 finding 5.

**Recommended fix** — review 1 finding 5's five one-line fixes, unchanged.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 5; its line numbers still hold (`app.test.ts:3524-3532` sits above the finding 1 test).

### 6. deploy.md's origin list misses the Payment Link's return address — LOW
- **Location:** `docs/deploy.md:77`, `:84`
- **Attribution:** introduced by #414 (`461525d`). Carried forward unchanged from review 1 finding 6.
- **Real-world trigger:** a domain change or a recreated Payment Link loses the thanks line with no error.

**Evidence** — `grep -n "support=thanks" docs/deploy.md` still prints nothing at HEAD.

**Failure mode** — as review 1 finding 6.

**Recommended fix** — review 1 finding 6's sentence, unchanged.

**Remediation brief**
- **Design intent, Full surface, Must preserve, Do not touch, Proof:** as in `pre-pr-review-1.md` finding 6.

### 7. Comment hygiene — LOW (aggregated)
Carried forward unchanged from review 1 finding 7; all four entries are still present at HEAD at the same lines.
- `apps/web/src/Profile.tsx:32-36` — see `pre-pr-review-1.md` finding 7 for the current and corrected text.
- `apps/web/src/App.tsx:201-202` — "Null until the API answers, and after a failed read, which shows no alert" → "Null until the API answers, and after a failed first read, which shows no alert; a failed read after a reset keeps the answer on view."
- `apps/web/test/web.test.ts:940-941` — see `pre-pr-review-1.md` finding 7.
- `README.md:81` — see `pre-pr-review-1.md` finding 7.

## Needs Further Investigation
Review 1's A to F stand unchanged; the delta touches none of them. See `pre-pr-review-1.md` for each one's confirm-or-kill step. A (whether the LLC's Stripe account sells anything else) still needs one look at the Stripe dashboard before #416 goes live.

## Reviewed and Dismissed
- Calling `nav.current?.focus()` before `onHideSupport()` — the button is still mounted, it has no blur handler, and the state update renders after the handler. The order is right.
- `nav.current?.` as an untested fallback — the ref cannot be null while the button inside it is mounted. Not a fallback path.
- The sidebar remounting on Hide or on a failed save — `<Sidebar>` sits at a fixed position under `{sidebarShown && ...}` (`App.tsx:513`), and neither path changes `sidebarShown`. The finding 1 test passing in the real tree confirms the nav keeps focus.
- Clicking blank sidebar space now focuses the nav — a browser focuses a `tabIndex={-1}` element on mousedown. With pointer focus, Chrome draws no ring. The one observable effect is that `VideoStepper.tsx:71` no longer refocuses the video title after a lost video if the creator clicked the sidebar meanwhile, which matches the stepper's own rule that focus the creator moved elsewhere stays. The `VideoStepper` precedent nav has the same property.
- Review 1's dismissals all stand; the delta touches none of them.

## Minor / nits
- After a keyboard Hide, the focused `nav` likely draws the browser's default focus ring. From 48rem up the nav is stretched to the grid row's height (`.signed-in-shell:has(> .sidebar)`, `app.css:1563-1566`), so the ring may be a tall 9rem box. This is consistent with `app.css:155-160`, which drops rings only where "no key put it there", and with `VideoStepper`, whose nav keeps its ring. Not checked in a browser. If Nick finds it heavy, `align-self: start` on `.sidebar` makes the ring hug the links.
- The sidebar is the only unnamed `<nav>` in the app (`git grep '<nav'`: `VideoStepper` uses `aria-label="Videos"`, `VideoList` uses `"Pages"`). Now that focus can land on it, a screen reader announces a bare "navigation". The missing name predates the branch (`<nav className="sidebar">` at `4c032ab`). A label is UI copy, so it is Nick's wording.
- The precedent explains its `tabIndex={-1}` in place (`VideoStepper.tsx:113-114`); the sidebar's reason is in the component's doc comment instead. Fine either way.

## Test quality
Tests added in the delta: 1 (`"Hide" leaves focus on the sidebar`). Red at `247541d` (focus on `<body>`), so it asserts something new. Mutation results: red when the `focus()` call is removed, green when `tabIndex={-1}` is removed (finding 1). It asserts no fixed copy, its name states its rule, and it is one test for one rule. Tautology shapes found: none. Review 1's test-quality findings (3, 4 and 5) are carried forward.

## Before opening the PR
- **CI readiness:** lint, typecheck and the web suites green at `a924742`; build, the full suite and the browser walk green at the code-identical `b320c2e`.
- **Commit hygiene:** nothing to drop. This doc and `repro/sidebar-tabindex-mutation.sh` are committed as `creator-analytics#338 pre-PR review 2`.
- **Likely reviewer asks:** the same as review 1: the Stripe account question (Needs Further Investigation A), the copy-test question (D), and #416's deployed check.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM finding is open. Review 1's one MEDIUM is fixed and verified against its intent. The confirmed list is 7 LOWs: one new (the test's missing `tabindex` assertion, a one-line fix that is worth taking before the PR since it guards the MEDIUM that was just fixed) and six carried forward from review 1, deferred by its remediation scope. The count did not grow beyond the one test gap the fix created, which is what a converging branch looks like. The LOWs can be remediated in one pass or carried as follow-up tickets.
