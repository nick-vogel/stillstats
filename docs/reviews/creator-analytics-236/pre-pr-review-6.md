# Pre-PR review: creator-analytics#236 Video list: name the empty list to a screen reader (#339)

**Branch:** `creator-analytics-236-video-list-paging-daily-table` vs `origin/main` (merge-base `9226843`, Merge pull request #453 from nick-vogel/creator-analytics-236-video-list-paging-daily-table)
**Reviewed at:** HEAD `5b777d3` (creator-analytics#339 Video list: name the empty list to a screen reader, the lane's merge of `1e5c4ca`) + 0 files with uncommitted changes, 0 untracked files. 3 files total, +31 / −2.
**Delta under review:** none. `--fresh`, so the whole working surface against the merge-base. PR #453 already brought the epic's earlier children (#239, #240, #241, #340, #341, #351, #447) into `origin/main`, so the surface is #339 alone.
**Reviewed against:** creator-analytics#339 (its Decided section and acceptance criteria), epic creator-analytics#236 (the #239 caption rule), `CODING_STANDARDS.md`, the Approach decisions in `pre-pr-review-5.md`.
**Date:** 2026-11-05
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` at HEAD | green, 552 files |
| Typecheck | `pnpm typecheck` at HEAD | green |
| Web app suite | `pnpm exec vitest run apps/web` at HEAD | 51 files, 1452 tests passed |
| Touched test files | `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/video-list.test.ts` | 440 of 440 passed |
| New tests red at base | scratch worktree at `9226843`, HEAD's `app.test.ts` copied in, `pnpm exec vitest run apps/web/src/app.test.ts -t 'named "Videos"\|carries the same name'` | both red: `expected null to be 'Videos'` |
| Every body state named | read `VideoList.tsx:477`, the component's single `return` | the section wraps controls, refusal, placeholder, empty and rows alike |
| Duplicate "Videos" landmark | `grep` for `aria-label="Videos"` and render sites in `App.tsx` | `VideoStepper`'s `nav` renders only inside `VideoDetail`, which never shares a screen with `VideoList` |
| Selectors and walks on the section | `grep` over `app.css`, `apps/web/test/web.test.ts`, `apps/site/test/screenshot/browser-walk.ts` | class selectors only, nothing reads the section's attributes |
| Full `pnpm test` (Testcontainers Postgres) and `pnpm build` | not run by this review | the lane ran the full checks green at `1e5c4ca` (127 files, 2902 passed, 1 expected fail; browser walk 31 steps, no CSP violation); `5b777d3` is a no-content merge of it |
| VoiceOver in a real browser | not run | no device walk in this review; see Reviewed and Dismissed |

**Overall:** The change does what #339 decided: the list's section carries `aria-label="Videos"` in every state, the caption's text is unchanged and now reads its lead word from the same constant, and both new tests go red at the base. The one confirmed finding is LOW test hygiene: the test with rows repeats a caption assertion the pager tests already pin. The branch can open its PR as-is.

## Approach decisions
- The list's name (#339, `1e5c4ca`): one exported constant `listLabel = 'Videos'` in `apps/web/src/video-list.ts`, read by the section's `aria-label` in `VideoList.tsx` and by `listCaptionOf`, so the name and the caption's lead word have one source. Kept. The #339 issue rejected a second caption for exactly this reason.
- Carried forward from `pre-pr-review-5.md` unchanged: the pager's `land` callback on `RouteLink` (#239), `readsAnotherPageOf` and `summaryPlaceListOf` (#239), the daily numbers table (#241), the `tableRead` ref for refused-read focus (#341, #447), the column lines (#351), a focus test also reading the target's `tabindex`, and the walk step merge order. Kept.

## Confirmed Issues
### 1. The test with rows repeats the caption rule the pager tests already pin — LOW
- **Location:** `apps/web/src/app.test.ts:2117`
- **Attribution:** introduced, by `1e5c4ca` (creator-analytics#339 Video list: name the empty list to a screen reader). `git log --oneline -S"a list with rows carries the same name" 9226843..HEAD` names only that commit.
- **Real-world trigger:** none. Test quality only, no user path, so LOW.

**Evidence**
```ts
  test('a list with rows carries the same name, and its caption still names the page', async () => {
    const api = installFakeApi()
    api.pageCount = 5
    const { container } = await render()

    const list = container.querySelector('section.video-list')
    expect(list?.getAttribute('aria-label')).toBe('Videos')
    expect(listTable(container).querySelector('caption')?.textContent).toBe('Videos, page 1 of 5')
  })
```

**Failure mode** — `CODING_STANDARDS.md` section 2, "One rule, one test". The caption assertion at :2117 states the rule "the caption names the page among the pages", which the `test.each` at `app.test.ts:1995-2017` already pins on a five-page list (its `First page` case asserts `Videos, page 1 of 5` at :2015), which "a single-page list's caption names its one page" (:2092-2097) pins on one page, and which `video-list.test.ts:465` and `:469` pin as units. The test then states two rules, and a caption regression fails four tests instead of the ones that own it. AC 2 of #339 asks that the caption be unchanged; the existing caption tests passing at HEAD already prove that, so the line adds no coverage.

**Recommended fix**
```diff
-  test('a list with rows carries the same name, and its caption still names the page', async () => {
+  test('a list with rows is named "Videos" for a screen reader too', async () => {
     const api = installFakeApi()
     api.pageCount = 5
     const { container } = await render()
 
     const list = container.querySelector('section.video-list')
     expect(list?.getAttribute('aria-label')).toBe('Videos')
-    expect(listTable(container).querySelector('caption')?.textContent).toBe('Videos, page 1 of 5')
   })
```

**Remediation brief**
- **Design intent:** #339 names the list on its `<section className="video-list">`, unconditionally, so a screen reader hears "Videos" on entering the list whether it is empty or has rows. The two new tests pin that rule in its two states (empty, rows). The caption "Videos, page N of M" is #239's rule and has its own tests; #339 changes only where its lead word comes from.
- **Full surface:** `apps/web/src/app.test.ts:2110` (the test name) and `:2117` (the caption line). Nothing else.
- **Must preserve:** the aria-label assertion at :2116, so the rows state stays pinned (it is red at `9226843`). The empty-list test at :2099-2108, word for word, since #339's `## Test` section gives it verbatim. The caption tests at `app.test.ts:2015`, `:2096`, and `video-list.test.ts:465`, `:469`, which carry AC 2 once the line goes.
- **Do not touch:** the `'Videos'` literal in the aria-label assertions (see Reviewed and Dismissed, copy test); the empty-list test's name and body.
- **Proof:** `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/video-list.test.ts` stays 440 of 440 after the edit (one assertion fewer, no test fewer). To show the rows test still guards its rule, drop `aria-label={listLabel}` from `apps/web/src/VideoList.tsx:478` in a scratch worktree and see both #339 tests go red.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The `'Videos'` literal in both aria-label assertions is a copy test under `CODING_STANDARDS.md` section 2 — dismissed: #339's `## Test` section specifies the assertion word for word, and the assertion is red at the base, so it observes the branch (a named section versus none) through its text, which section 2 allows. Keep it.
- A second landmark named "Videos" on the same screen — dismissed: `VideoStepper.tsx:104` and `:115` name a `nav` "Videos", but it renders only inside `VideoDetail`, and `App.tsx` renders `VideoDetail`, `Audience`, or the list screen exclusively. The sidebar's "Videos" is a link, not a landmark.
- VoiceOver reads "Videos" twice after a pager link — dismissed: the pager's `nav` sits inside the section, so focus moving from a pager link to the table never enters the region from outside. Jumping into the table from outside the section (VO-Cmd-T) may read the region's name and then the caption; that is the redundancy #339 accepted when it kept the caption and named the section, and it was not walked on a device.
- The `// Approved word for word in creator-analytics#239` comment on `listCaptionOf` is stale now that the lead word comes from `listLabel` — dismissed: the full caption string it describes is still #239's approved text, and `listLabel`'s own comment says it is the caption's lead word and cites #339. Assumption 1 in the lane's ticket notes records the coupling.
- The section is named "Videos" while the format filter shows Shorts — dismissed: #339 decided a fixed "Videos" with no format, the same property as #239's approved caption.

## Minor / nits
- `app.test.ts:2105` checks the empty sentence on the whole container, not on the named section, so the test would still pass if the sentence moved outside the section. The ticket gives the assertion verbatim; strengthening it to `list?.textContent` is optional.
- Both new tests sit in `describe("the pager's landing on the video list")`, though the section's name does not depend on the pager. The ticket placed them there.
- `VideoStepper.tsx:104` and `:115` repeat `aria-label="Videos"` within one file; a local constant would remove the duplicate. Outside this change's path.

## Test quality
Tests added: 2 · green against `9226843`: 0 (both red, `expected null to be 'Videos'`) · tautology shapes found: 0 (no self-computed expectation, no mocked unit, no call-shaped or snapshot assertion). The test with rows carries one duplicate assertion, finding 1.

## Before opening the PR
- **CI readiness:** lint, typecheck, and the web suite are green at HEAD; the lane's full checks were green at `1e5c4ca`, which `5b777d3` merges without content.
- **Commit hygiene:** two commits, the lane commit and its merge. Nothing to drop.
- **Likely reviewer asks:** none beyond finding 1.

## Verdict
**Ready to open the PR as-is.** 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW. All three acceptance criteria of #339 hold. Finding 1 (a duplicate caption assertion) can ride in the PR or be dropped.
