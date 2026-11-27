# Pre-PR review: creator-analytics#237 Channel summary: upload markers

**Branch:** `creator-analytics-237-upload-markers` vs `origin/main` (merge-base `bb6e3b7ba8b80767b0528423238d40c8393b5dbf`, "Merge pull request #749 from nick-vogel/creator-analytics-569-feedback-form")
**Reviewed at:** HEAD `0517c9ce` ("creator-analytics#237 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 30 files, +2,249 / −75.
**Delta under review:** since `c87ee162` ("creator-analytics#283 Upload markers: join markers that overlap"), the HEAD that `pre-pr-review-1.md` reviewed. 4 files, +352 / −0, of which 1 is code: `apps/web/src/app.test.ts`, +11, one new test from `03c09309` ("creator-analytics#237 pre-PR review 1 finding 1: no test fails if the channel summary stops following the visibility switch"). The other three are review 1's doc and its two repro files (`edf3880c`, `0517c9ce`).
**Reviewed against:** epic creator-analytics#237 (open; sub-issues #281 and #283 open, #280 and #282 closed not planned), `pre-pr-review-1.md` (its finding 1 intent, its closure table, its Approach decisions), `CODING_STANDARDS.md` rule 2 (tests that can go red).
**Date:** 2026-11-16
**Reviewer:** 1 code-review agent + verify pass (delta-scoped)

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 715 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing chunk size warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 175 files, 4,560 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 109 steps |
| Prior finding 1 closure | `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir> HEAD` at `0517c9ce` | `F1a ... killed`, `F1b ... killed` (both `survived` at `c87ee162`) |
| The new test is the one that kills | scratch worktree at `0517c9ce`, each mutant applied, `pnpm exec vitest run apps/web/src/app.test.ts -t 'the summary reads the uploads of the visibility switch'` | unmutated: 1 passed; F1a and F1b: 1 failed each, `AssertionError: expected null to be 'all'` |
| Prior finding 3 still open | the same probe run | `F3a ... survived`, `F3b ... survived`, as review 1 recorded; finding 3 was deferred |
| Delta review (finder) | the new test against finding 1's intent: vacuous `.at(-1)`, another path ending in `/summary`, a race after `click`, preference state leaking to later tests, the precedent at `app.test.ts:1608` | no defect; the test passed 5 of 5 repeat runs, and the full file 399 of 399 |
| Carried findings still hold | `git diff --quiet c87ee162 HEAD -- apps/api apps/site CONTEXT.md apps/web/src/upload-markers.ts apps/web/src/UploadMarkers.tsx apps/web/src/channel-summary.ts apps/web/src/components.test.ts` | no change, so every location review 1 cites for findings 2 to 6 is the same line at HEAD |
| Tautology audit | the one new test: the mutation probes above are its oracle, since it is a review-finding proof whose behaviour existed at `c87ee162` | goes red under both mutants it was written for; literal expectations, nothing in the read path mocked |
| Could not run | VoiceOver, a real resize while a marker holds focus | carried as Needs Further Investigation A and B |

**Overall:** The one change since review 1 closes its only MEDIUM, and the closure was proved by execution: the new App test goes red when the summary read drops the visibility from its deps or pins it to public, and is green otherwise. Every full check, the browser walk included, is green at `0517c9ce`. The delta raised no new finding. The five LOW findings review 1's remediation deferred are carried forward unchanged, since none of their files moved. The branch is ready to open a PR.

## Approach decisions
- Join ties: compare neighbour gaps in exact integer units (the sum of a group's first and last day index, which is twice its centre index), not in float places, so "the leftmost on a tie" and "exactly one width does not join" hold for every window. Precedent: the existing integer `index` on `MarkerPlace`, which every marker already carries.
- Visibility wiring proof: an App test over the fake API reading `api.requests` for the `/summary` path after the "Show unlisted and private" switch, as the video list's visibility test reads its list reads (`apps/web/src/app.test.ts:1608`). Landed in `03c09309`.
- The visibility predicate: one exported privacy predicate shared by the list and the summary, as `isOfFormat` already is (`apps/api/src/video-format.ts:24`).

## Prior-review closure
Review 1 had 6 confirmed findings: 1 MEDIUM, 5 LOW.
- **Fully fixed: 1.** Finding 1 (MEDIUM). Fixed in `03c09309`, verified against its intent rather than its diff: the test asserts the first summary read carries no `visibility` (public is omitted) and the read after the switch carries `visibility=all`; both mutation probes it was meant to kill now print `killed`, and a `-t` run of the new test alone fails under each with `expected null to be 'all'`. Must preserve held: `apps/web/src/channel-summary.test.ts` and the video list's visibility tests are green in the full run. No production change.
- **Partially fixed: 0.**
- **Untouched: 5.** Findings 2 to 6, all LOW, each marked "deferred" (LOW tail, not worked this round) in review 1's closure table. None escalated, and review 1's "Known regressions, deferred" list is empty. They are this doc's findings 1 to 5.
- **Resolved only by a comment or doc edit: 0.**

## Confirmed Issues
### 1. Of equally close markers, the right pair can join instead of the leftmost — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 2, deferred by remediation 1. `apps/web/src/upload-markers.ts` and `apps/web/src/upload-markers.test.ts` are unchanged since `c87ee162`, so its location (`upload-markers.ts:104-128`), evidence, recommended diff, remediation brief and proof (`docs/reviews/creator-analytics-237/repro/tie-leftmost.case.ts`) there hold line for line. Attribution: introduced in `f6660234`.

### 2. Two of the API's upload rules have no test that can fail — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 3. Re-proved at `0517c9ce`: `mutation-probes.sh` still prints `F3a scheduled clause dropped: survived` and `F3b content types failure swallowed: survived`. `apps/api/src/channel-summary.ts` and `apps/api/src/channel-summary.test.ts` are unchanged since `c87ee162`, so its locations (`channel-summary.test.ts:488-523`, `:638-653`; the rules at `channel-summary.ts:102` and `:107`) and its brief there hold. Attribution: introduced in `b0ed6a14`.

### 3. The after-publish markup test's own rule cannot go red — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 4 (`apps/web/src/components.test.ts:1049-1054`, unchanged since `c87ee162`); its brief there (delete the test) holds. Attribution: introduced in `b0ed6a14`.

### 4. The summary types the visibility rule again beside the list's — LOW
Carried forward unchanged from `pre-pr-review-1.md` finding 5 (`apps/api/src/channel-summary.ts:110` beside `apps/api/src/video-list.ts:77-79`, both unchanged since `c87ee162`); its brief there holds. Attribution: introduced in `b0ed6a14`.

### 5. Comment hygiene — LOW (aggregated)
Carried forward unchanged from `pre-pr-review-1.md` finding 6: every entry there still applies at the line it names (`apps/site/test/screenshot/stub-api.ts:137-140`, `CONTEXT.md:135`, `apps/api/src/routes/channel-summary.ts:29-31`, `apps/web/src/UploadMarkers.tsx:158-162` and `:48`, `apps/web/src/channel-summary.ts:105-108`, `apps/api/src/video-list.ts:252`, all unchanged since `c87ee162`). No new entry from the delta: `03c09309` adds no comment.

## Needs Further Investigation
### A. The browser walk's comment says no tile shows in its marker step, which may be false at 375px — measure the track width in the walk's last28 step at the phone width
Carried forward unchanged from `pre-pr-review-1.md` Needs Further Investigation A (`apps/site/test/screenshot/browser-walk.ts`, unchanged since `c87ee162`).

### B. Focus falls to the page when a resize joins or splits the focused marker — resize a window with a marker focused, in Chrome
Carried forward unchanged from `pre-pr-review-1.md` Needs Further Investigation B (`apps/web/src/UploadMarkers.tsx:222-224`, unchanged since `c87ee162`).

## Reviewed and Dismissed
- The new test passes vacuously when no summary read is recorded — dismissed: with zero reads, `.at(-1)?.query.get('visibility')` is `undefined`, and `toBeNull()` requires exactly `null`, so the first assertion fails; the second needs `'all'`.
- Another request whose path ends in `/summary` satisfies the filter — dismissed: the web app's only summary path is `/api/channels/${channelId}/summary` (`apps/web/src/ChannelSummaryFigures.tsx:44`), and the fake API has one summary route (`apps/web/src/fake-api.ts:413`).
- The final assertion races the re-read after the click — dismissed: `click` (`app.test.ts:376`) acts and then settles, the mutants fail on the stale `null` rather than passing, and the test passed 5 of 5 repeat runs.
- The switch's saved preference leaks into later tests — dismissed: `installFakeApi` builds fresh preferences on every call (`fake-api.ts:430`), the file's `afterEach` (`app.test.ts:438-445`) unmounts and clears `localStorage`, and the full file passes with the test in place.
- Every item review 1 dismissed stands: none of the code it names changed since `c87ee162`.

## Minor / nits
1. The new test's name, "the summary reads the uploads of the visibility switch", says more than it checks: it asserts the request's `visibility` parameter, not the uploads shown, since the fake summary answers the same uploads whatever the query (`fake-api.ts` `summaryOf`, about `:101`). Checking the request is the right layer; the name is fair read as "requests". An exact name: "the summary read sends the visibility switch's setting, and reads again when it changes".
2. The new test uses `markedApi()`, whose summary days and uploads it never asserts on; `installFakeApi()` would do. Harmless, and it is why the test sits in this describe.
3. Every nit in review 1's Minor / nits list still applies unchanged.

## Test quality
Tests added since review 1: 1 (`apps/web/src/app.test.ts`, "the summary reads the uploads of the visibility switch, and reads again when it changes", from `03c09309`). It is review 1 finding 1's proof, so `$BASE` is not its oracle (the behaviour existed at `c87ee162`); the two mutation probes are, and it goes red under both. Its expectations are literals (`null`, `'all'`), not computed with `summaryQueryOf` or `visibilityOf`; nothing in the read path is mocked; it is not call-shaped, assertion-free or a snapshot. Tautology shapes found: 0. Review 1's audit of the branch's other tests stands, finding 3 above (its finding 4) included.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test green at `0517c9ce`; the browser walk green.
- **Commit hygiene:** the delta is three commits, review 1's doc, its finding 1 fix and its closure table; nothing to drop. This doc is the only addition.
- **Likely reviewer asks:** unchanged from review 1: the extra Data API and Analytics cost of a cold summary, and the sample channel having no day of two uploads, so the walk never shows a one-day tile.

## Verdict
Ready to open a PR with follow-ups. Review 1's gate, finding 1, is closed and proved by execution; the delta added no finding. No CRITICAL, HIGH or MEDIUM findings remain. The five carried LOW findings (1 to 5) can ride in a remediation pass or ship as follow-up tickets; none blocks the PR. The confirmed list shrank from 6 to 5, all carried, which is the expected shape of a re-review after a test-only fix.
