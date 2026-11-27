# Pre-PR review: creator-analytics#268 Channel audience screen

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `b10c8d4` "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `1152969` ("creator-analytics#268 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. 78 files, +4,238 / −462 against the merge-base.
**Delta under review:** since `6c1ccf3` ("creator-analytics#268 pre-PR review 1"), the commit pre-PR review 1 (`pre-pr-review-1.md`) was written at, reviewing HEAD `3bdcf06`. The delta is 3 files, +29 / −4: `262bef5` ("creator-analytics#268 pre-PR review 1 finding 1: Give a signed-in screen with no sidebar the whole width from the tablet width up"), which changes `apps/web/src/app.css` and `apps/web/test/web.test.ts`, and `1152969`, the closure table appended to `pre-pr-review-1.md`.
**Reviewed against:** pre-PR review 1's finding 1 (its intent, brief and Approach decisions line), its remediation closure table, `CODING_STANDARDS.md` 1 to 3. The epic and its seven children were read in full in review 1 and are unchanged.
**Date:** 2026-10-20
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 510 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 115 files, 2,574 passed, 1 expected fail |
| Prior finding 1 by execution | `sh docs/reviews/creator-analytics-268/repro/sidebarless-shell-width.sh` over the build above, headless Chrome at 1280px | `with sidebar: screen=952 shell=1136`, `without sidebar: screen=1136 shell=1136`. Fixed. |
| The sidebar is a direct child of the shell | `Sidebar.tsx:11` (root `<nav className="sidebar">`), `App.tsx:415-417`; `git grep signed-in-shell apps/web/src` | one shell, the nav its direct child, so `:has(> .sidebar)` matches exactly when the sidebar renders |
| Other rules that assume two columns | `app.css` for `grid-column`, `grid-area`, `position` on `.sidebar` or `.signed-in-screen` | none |
| Controls bar without a sidebar | traced `sidebarShown`, `screenShown`, and every `ControlsBar` render site (`App.tsx:464`, `Audience.tsx:77`, `VideoDetail.tsx:492`) | no render path shows a controls bar without the sidebar, so the unconditional `.app .controls-bar` reset at `app.css:1687-1690` only ever applies beside one. Nit. |
| The changed stylesheet test can go red | agent ran `valueIn` (`packages/visual-system/test/testing.ts:94`, exact trimmed match per selector in the list) over the real `app.css` and three in-memory variants | head passes; the bare selector reverted, the `:has` rule deleted, and `:has(.sidebar)` without `>` each go red. At `$BASE` the `:has` assertion reads undefined, so red there too. |
| `:has()` against the build target | `apps/web/vite.config.ts`, no browserslist or `build.target` in the repo | Vite's default target; `:has()` lacks only in Firefox before 121 (December 2023). Nit. |
| Prior findings 2 to 7 | the delta touches none of their files | unchanged and still open, as their closure rows say (deferred LOW) |
| Browser-only behaviour | not run | real widths at 375px and desktop, with and without a channel. Nick's browser walk (#278's acceptance criterion) covers it. |

**Overall:** Prior finding 1, the one MEDIUM, is fixed and proved by execution, and all four CI checks pass. The fix is clean: nothing else in the stylesheet depends on the two columns, and the changed test goes red under every revert. One new LOW: the CSS now depends on the sidebar being a direct child of the shell, and no test pins that markup. The six LOW findings from review 1 stay open as deferred. Nothing blocks the PR.

## Approach decisions
- The sidebar's grid (review 1, finding 1): `.signed-in-shell:has(> .sidebar)` in the 48rem rule, mirroring `.numbers-table table:has(tfoot)` (`app.css:1624`). Applied in `262bef5`; this review keeps it. `App.tsx` and its markup stay as they are.
- The markup half of that selector (finding 1 below) is pinned by a DOM test in the existing `describe('the sidebar')` in `apps/web/src/app.test.ts`, never by a modifier class or other production change.
- Carried from review 1, unchanged: copy with no approval (review 1 findings 2 and 3) is Nick's decision; test gaps close with a test in the existing describe for their rule; duplication inside the branch's new code folds into the helper the branch already made, and duplication outside the diff becomes a follow-up ticket.

## Confirmed Issues

### 1. No test pins the sidebar as a direct child of the shell, which the tablet layout now depends on — LOW
- **Location:** `apps/web/src/app.css:1675` (the selector), with `apps/web/src/App.tsx:415-416` and `apps/web/src/Sidebar.tsx:11` (the markup it depends on); the gap is in `apps/web/src/app.test.ts:1582` (`describe('the sidebar')`)
- **Attribution:** introduced by the remediation, `262bef5`. At `3bdcf06` the two-column rule named only `.signed-in-shell`; `git log -S':has(> .sidebar)' b10c8d4..HEAD` names only `262bef5`.
- **Real-world trigger:** none today, since the markup is right. The gap is that a later change that wraps `<Sidebar>` in an element or moves it a level down (a provider that renders DOM, a wrapper for a sticky sidebar) drops the two-column layout from the tablet width up, and the suite stays green: `web.test.ts` reads only the stylesheet, and the sidebar tests find `nav.sidebar` anywhere in the page (`app.test.ts:1566`). LOW, capped: a coverage gap on correct code, and the failure would be a broken layout, not a wrong number.

**Evidence**
```css
@media (min-width: 48rem) {
  .signed-in-shell:has(> .sidebar) {
    grid-template-columns: 9rem minmax(0, 1fr);
```
```ts
function sidebarIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('nav.sidebar')
}
```
`git grep -n 'signed-in-shell' -- '*.test.ts'` finds only `apps/web/test/web.test.ts:266`, `:269` and `:271`, all stylesheet reads.

**Failure mode** — `<div><Sidebar … /></div>` inside the shell: the `:has(> .sidebar)` rule no longer matches, the sidebar and the screen stack at every width, and `pnpm test` passes.

**Recommended fix** — in `describe('the sidebar')` in `apps/web/src/app.test.ts`, a new test:
```ts
  test('sits directly in the signed-in shell, where the tablet layout finds it', async () => {
    installFakeApi()
    const { container } = await render(query)

    expect(container.querySelector('.signed-in-shell > nav.sidebar')).toBe(sidebarIn(container))
    expect(sidebarIn(container)).not.toBeNull()
  })
```

**Remediation brief**
- **Design intent:** from 48rem up the signed-in shell is two columns only when it holds the sidebar, and the stylesheet tells by `.signed-in-shell:has(> .sidebar)`. So the sidebar's place in the markup is part of the layout's contract, as the stylesheet rule is; `web.test.ts` pins the rule, and this test pins the markup.
- **Full surface:** `apps/web/src/app.test.ts:1582` (the describe; `query` and `sidebarIn` are defined there and at `:1565`). No production change.
- **Must preserve:** every test in `describe('the sidebar')`, the stylesheet test at `apps/web/test/web.test.ts:258-275`, and `App.tsx`'s markup.
- **Do not touch:** the `.app .controls-bar` reset at `app.css:1687-1690` (see Minor / nits) and the sidebar's show rule at `App.tsx:227` (review 1, Dismissed).
- **Proof:** the new test goes red with `<Sidebar>` wrapped in a `<div>` at `App.tsx:416`, and green as it is. `pnpm exec vitest run apps/web/src/app.test.ts`.

## Carried forward from review 1, still open
These are unchanged by the delta, so their briefs in `docs/reviews/creator-analytics-268/pre-pr-review-1.md` stand as written, with every `file:line` still accurate. Remediation deferred each of them in that doc's closure table.
- Review 1 finding 2 (LOW): US-ZZ shows as "Unknown state", a label nobody approved. A copy decision for Nick.
- Review 1 finding 3 (LOW): Google's `OTHER` operating system shows as a bar named "Other", beside the "Other operating systems" bar. A copy decision for Nick.
- Review 1 finding 4 (LOW): the Audience API tests pin only the first read's failure and three of the refusals, and nothing pins its caching.
- Review 1 finding 5 (LOW): the branch's new reads, reports and sections copy the helpers it made beside them.
- Review 1 finding 6 (LOW): six new tests cannot go red, or assert copy.
- Review 1 finding 7 (LOW): comment hygiene, six entries.

## Prior-review closure
Review 1 had 7 confirmed findings. Fully fixed: 1 (finding 1, MEDIUM, `262bef5`, proved by the repro above). Partially fixed: 0. Untouched: 6 (findings 2 to 7, all LOW, deferred by the closure table: 2 and 3 wait on Nick's copy answers, 4 to 7 are the LOW tail). No finding was "resolved" by editing a comment or a doc. MEDIUM or higher left open: 0.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The sidebar flashes in while the channels are read, then goes when they come back empty or fail — the show rule is review 1's (`App.tsx:227`, dismissed there as specified), and the jump is now from `1fr` to the whole width rather than into the 9rem track, so the fix makes it smaller, not new.
- The 2.5rem gap now applies only beside the sidebar — intended: with one child the gap has nothing to separate, and the shell keeps the shared 1.5rem gap (`app.css:1644-1649`).
- The mobile stack — unchanged: the bare `.signed-in-shell` still has no `grid-template-columns` outside the media query (`web.test.ts:266`).

## Minor / nits
- `apps/web/src/app.css:1675`: `:has()` is missing in Firefox before 121, where the rule drops and the sidebar stacks above the screen at every width, the mobile layout. The stylesheet already uses `:has()` at `:1624`, and Firefox 121 shipped in December 2023.
- `apps/web/src/app.css:1685-1690`: the `.app .controls-bar` reset's comment says the sidebar sits on the bar's inner side, but the rule does not ask for a sidebar. True today, since no controls bar renders without one (see the table). Review 1's brief for finding 1 named this reset under Must preserve, so it stays.
- `apps/web/test/web.test.ts:259`: the test's name lists the #274 layout facts, and does not name the new one, that a screen with no sidebar takes the whole width from the tablet width up (`:269`). Extending the name or splitting `:269` into its own test would follow `CODING_STANDARDS.md` 2.

## Test quality
Tests changed in the delta: 1 (`apps/web/test/web.test.ts:258-275`, three assertions). It goes red under the reverted selector, the deleted rule, and `:has(.sidebar)` without the child combinator, and red at `$BASE`. No tautology shapes. The markup half of its contract is untested: finding 1. Review 1's test audit of the whole branch stands, and its finding 6 is still open.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `1152969`.
- **Commit hygiene:** this doc is the only new file. Nothing to drop.
- **Likely reviewer asks:** Nick's answers on "Unknown state" and on Google's `OTHER` system (review 1 findings 2 and 3); Nick's browser walk of the sidebar at 375px and desktop width, with a channel and with none, and of the Audience screen for the last 28 days, August and Shorts; follow-up tickets for `traffic-sources.ts` and the OAuth demo shot (review 1, Minor / nits).

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM. Review 1's one MEDIUM is fixed and proved. The open items are seven LOWs: this round's finding 1 and review 1's findings 2 to 7, none of them a gate. Findings 2 and 3 of review 1 wait on Nick's copy answers. The confirmed count fell from one MEDIUM and six LOWs to one new LOW, the expected shape for a clean remediation.
