# Pre-PR review: creator-analytics#359 Move the web app's charts to TanStack Charts (round 2)

**Branch:** `creator-analytics-359-tanstack-charts` vs `origin/main` (merge-base `73f7952` "Merge pull request #388 from nick-vogel/creator-analytics-360-shadcn-tailwind-migration")
**Reviewed at:** HEAD `3d26f56` ("creator-analytics#359 pre-PR review 1 remediation closure table"). The tree was clean, with no uncommitted or untracked files at review time. 41 files, +3,949 / −1,249 against the merge-base.
**Delta under review:** since `73a1c3f` ("creator-analytics#372 Charts: remove the hand-written hover and path geometry"), the commit pre-PR review 1 (`pre-pr-review-1.md`, committed in `1be1bd4`) reviewed. 3 files, +360 / −26: the review doc itself, its repro `repro/plant-colour-strays.sh`, and the one code change, `apps/web/src/chart-colours.test.ts`, from `a3a7f25` ("creator-analytics#359 pre-PR review 1 finding 1: the series colour test accepts any custom property and none on any key"). `ac925c2` and `3d26f56` touch only the review doc.
**Reviewed against:** pre-PR review 1's finding 1 (its intent, recommended fix and Approach decisions), its Remediation scope note and closure table, `CODING_STANDARDS.md` 1 to 3, and the precedent the fix cites, `packages/visual-system/test/styles.test.ts:40-50`.
**Date:** 2026-11-04
**Reviewer:** 1 code-review agent (with mutation checks) and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` | pass, 537 files |
| Typecheck | `pnpm typecheck` | pass (exit 0) |
| Build | `pnpm build` | pass; `apps/web` JS 746.94 kB / 245.68 kB gzip, unchanged from round 1 |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 122 files, 2,747 passed, 1 expected fail, first run (3 more than round 1: the planted-stroke cases) |
| Browser walk | `pnpm run --if-present test:browser` | pass: 20 steps, no content security policy violation |
| Prior finding 1 against its intent | `sh docs/reviews/creator-analytics-359/repro/plant-colour-strays.sh <scratch-dir>` at `3d26f56` | `control-hex`, `spacing-token`, `font-token` and `stroke-none` all exit 1 (at `73a1c3f` the last three exited 0) |
| Accepted token set | agent: printed `colourTokens` from the test's own derivation | `--bg --bg-end --bg-glow --ink --ink-soft --line --accent --accent-hover --on-accent --launch-line-1..10`. `--grain`, `--font-*`, `--measure`, `--gutter` excluded. Every shipped stroke token is in the set |
| Where `none` is painted | agent: tally of every painted key and value across all 9 shipped scenes | `none` only as `fill` (22 times, the library's fill under a line); no `stroke: none` or `color: none`, so the fill-only exemption causes no false red |
| Planted test can go red | agent, scratch worktree at HEAD: mutation A restores the old rule (all light tokens, `none` exempt on any key); mutation B drops the `none` exemption | A: the 3 planted cases go red, the 9 chart cases stay green. B: all 9 chart cases go red, so the `fill` exemption is load-bearing |
| Anchored regex still holds | agent probes, deleted after: `stroke: '#fff'`, `fill: 'var(--ink, red)'`, `color: 'var(--grain)'`, `fill: 'none'` | the first three count as strays, `fill: 'none'` passes; `include the line the cursor draws` still finds `var(--ink-soft)` |
| Top-level await in a test file | `tsc -p apps/web/tsconfig.json`, `biome check` on the file, precedent `packages/visual-system/test/styles.test.ts:19` | clean; the visual system's own test already does it |
| Tests green at `$BASE` | `git show 73f7952:apps/web/src/chart-colours.test.ts` | the file does not exist at base, so every case is red there by construction; the oracle that matters is mutation A above |
| Prior findings 2 to 4 still present | `git diff --stat 73a1c3f` | none of their files (`app.css`, `retention.test.ts`, `metric-charts.test.ts`, `launch-plot.test.ts`, `components.test.ts`, the commented `.ts` files) changed, so their round 1 evidence and briefs stand as written |
| Real touch, narrow screens, screen reader | not run | needs a phone and VoiceOver; round 1's Needs Further Investigation A to C are untouched by this delta |

**Overall:** Round 1's finding 1 is fixed in full and against its intent: the colour test now accepts only light-scheme tokens whose value is a colour, exempts `none` only on a fill, and carries its own red-capable proof as a committed test. All five full checks are green on the first run. The only new finding is that the file's header comment and one test name still describe the wider rule. The PR can open.

## Approach decisions
Carried forward from pre-PR review 1 unchanged:
- Library live region and second name: the library chart sits inside an `aria-hidden` wrapper in the app's slider (#369 assumption); recommended fixes keep the wrapper.
- Keys: the library's keyboard is off and the app's `useChartSlider` drives the cursor (#369); nothing here moves a key into the library.
- Series colour rule: one unit test walks each definition's rendered scene, not the marks' options, because 1.2.1 keeps options in a closure (#369 implement assumption). It accepts only the `var()` names the visual system's own dark-scheme test treats as colour tokens (`packages/visual-system/test/styles.test.ts:40-50`, `declarationsIn` plus `lightTokensIn`).
- `ChartPoint` keeps only `day` (#372 assumption).
- Series colour rule's own proof (remediation, 2026-11-04): the stray rule is one module-level function, `straysAmong` in `apps/web/src/chart-colours.test.ts`, over a module-level colour token set computed once with top-level await. The shipped definitions and a planted-stroke `test.each` both run through it. A later rule change edits `straysAmong`, never a copy inside a test body.

This round adds none.

## Confirmed Issues

### 1. Comment hygiene — LOW (aggregated)
Attribution: introduced by the remediation `a3a7f25`, which narrowed the rule and left the prose describing the wider one (the header predates it, from `6719a68`, and was accurate then).
- `apps/web/src/chart-colours.test.ts:1-2` — "Every colour a chart definition paints is a `var()` of a token the visual system declares, so a chart follows the light and dark schemes and the colour tests that hold the tokens." (`--gutter` and `--font-body` are tokens the visual system declares, and the test now rejects them by design) → "Every colour a chart definition paints is a `var()` of a colour token the visual system's light scheme declares, so a chart follows the light and dark schemes and the colour tests that hold the tokens."
- `apps/web/src/chart-colours.test.ts:149` — test name `'are visual system tokens on the %s chart'` → `'are visual system colour tokens on the %s chart'`

## Needs Further Investigation
None new. Round 1's A (a touch drag on a plot may clear the card), B (the relative retention card's width at 375px) and C (a retention cursor across a same-length change of x values) are untouched by this delta and still need a phone or a real navigation.

## Reviewed and Dismissed
- The planted-stroke `test.each` (`chart-colours.test.ts:161-169`) tests the file's own helper rather than a production unit — it is the committed proof the Approach decision names, and it runs through the same `coloursUnder` and `straysAmong` path the shipped definitions use. Mutation A turns all 3 cases red, so it is not a tautology.
- A colour token declared only as an alias (`--chart-ink: var(--ink)`), only in the dark block, or with an uppercase name would be rejected — each fails closed (a false red, never a false pass), and no such token is in the sheet today. `color-mix()` makes the whole file fail at collection, which is loud.
- `var(--bg)`, `var(--bg-glow)` and `var(--on-accent)` are accepted as chart colours — by design: they are light-scheme colour tokens the dark scheme also sets, which is the rule's stated intent.
- Top-level await at `chart-colours.test.ts:131` — precedent at `packages/visual-system/test/styles.test.ts:19`; typecheck and lint clean, and an unreadable sheet fails the file at collection.
- `fill: 'none'` is the only `none` exemption — the 9 shipped scenes paint `none` only as a fill, so no shipped definition goes falsely red.

## Minor / nits
- `apps/web/src/chart-colours.test.ts:132-137` copies the colour token derivation in `packages/visual-system/test/styles.test.ts:41-46`. "The same set the parity test uses" holds only while the two copies agree; one `lightColourTokensIn(css)` helper exported from `packages/visual-system/test/testing.ts` and called from both would make it structural.
- `writesAColour` is built over every rule in the sheet while `lightTokensIn` reads only the light `:root`, so a colour written into `--gutter` in some other scope would let `var(--gutter)` pass. The parity test has the same shape, and nothing in the sheet does this today.
- `declarationsIn` lowercases `property` and `lightTokensIn` returns names as written; every custom property in the sheet is lowercase, so the two match.

## Test quality
Tests added this round: 3 cases (`count a line stroked with %s as a stray`, with `var(--gutter)`, `var(--font-body)` and `none`), and the 9 chart cases and the cursor guide test changed to the new rule. The file is absent at `73f7952`, so every case is red at base. Against the old rule (mutation A) the 3 planted cases go red; with no `none` exemption (mutation B) the 9 chart cases go red. Tautology shapes found: 0 self-fulfilling expectations, 0 mocked units, 0 call-shaped assertions, 0 snapshots.

## Prior-review closure
Pre-PR review 1 confirmed 4 findings, all LOW; none was MEDIUM or higher.
- **Fully fixed: 1.** Finding 1 (the series colour test accepts any custom property and `none` on any key), by `a3a7f25`. Re-verified against its intent: the repro exits 1 on all four plants at `3d26f56`, and the committed planted cases hold it.
- **Partially fixed: 0.**
- **Untouched: 3**, each by decision. Findings 2 (dead chart CSS), 3 (test hygiene) and 4 (comment hygiene) read `— deferred … out of this round's scope (Remediation scope note)` in review 1's closure table, per Nick's close-out decision of 2026-11-04 to fix finding 1 only. Their files did not change since `73a1c3f`, so review 1's briefs for them stand as written and are not repeated here.
- **Resolved only by a comment or doc edit: 0.**

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test all green at `3d26f56`; the browser walk green (it is not in CI).
- **Commit hygiene:** nothing to drop. This review adds `docs/reviews/creator-analytics-359/pre-pr-review-2.md`.
- **Likely reviewer asks:** unchanged from round 1: the JS gzip size (202.9 kB before #359, 245.7 kB at HEAD); the upstream issue #373 (not filed yet, ready-for-human); a phone check of tap and scroll (Needs Further Investigation A).

## Verdict
Ready to open the PR with follow-ups. Zero CRITICAL, HIGH or MEDIUM findings; one LOW (comment hygiene: two lines of prose in the colour test). Round 1's one fixed finding is closed against its intent, and its other three LOWs remain deferred by Nick's decision. The Confirmed count shrank from 4 to 1, and the one left is wording, which is the expected shape of a converging branch. Nothing gates the PR.
