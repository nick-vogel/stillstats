# Pre-PR review: creator-analytics#268 Channel audience screen, second PR (#326, #327, #328, #330)

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `4f48aaa` "Merge pull request #336 from nick-vogel/creator-analytics-268-channel-audience-screen")
**Reviewed at:** HEAD `7045229` ("creator-analytics#326 The Audience placeholder holds every section's place"). The tree was clean, with no uncommitted or untracked files at review time. 15 files, +500 / −97 against the merge-base.
**Delta under review:** none. A fresh review (`--fresh`) of everything since the merge-base, which is the first PR of this epic (#336) as merged. Pre-PR reviews 1 and 2 in this folder reviewed that first PR, and every file they cite landed on `origin/main` with it.
**Reviewed against:** the epic creator-analytics#268 (its body is the spec), the four children this branch carries, #326 (`48fbb09`, merged as `7045229`), #327 (`afbfb8b`, merged as `2a0a146`), #328 (`77beb2b`, merged as `22d259a`) and #330 (`002af6d`, merged as `5cf72a9`), `CODING_STANDARDS.md` 1 to 3, and the Approach decisions of pre-PR reviews 1 and 2. No `CLAUDE.md` in the repo.
**Date:** 2026-10-24
**Reviewer:** 2 code-review agents + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 508 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | first run: 1 failed, `apps/extension/src/surfaces/content-list.test.ts:795` ("a list visit of 1.4 s ... reads the rows again ...") timed out in 5000ms while a second test run shared the machine. Re-run 60 seconds later: 115 files, 2,600 passed, 1 expected fail. A flake in a file the branch does not touch. |
| Tests the branch adds or changes, against `$BASE` | a detached scratch worktree at `4f48aaa` under the scratchpad, the six changed test files copied in, `pnpm exec vitest run` on them | 20 of the 21 new or changed cases red at base. The one green: `devices.test.ts` "show an operating system with no name as Google's value in title case", rewritten to use only unmapped values as #328 asked; its rule was already on the base. `components.test.ts` changes a comment only. |
| Audience note places against the real notes | agent harness: the built CSS served over local http so Switzer loads (checked through `document.fonts`), the real shell markup (`.signed-in-shell > nav.sidebar + .signed-in-screen > section > p.note`) in an iframe resized at every px from 320 to 1440, each note's line count compared with its place's | zero mismatches for the countries, US states, cities, every format and gender notes; every stated width reproduced |
| Delay, running total and awaiting notes against their places | the same harness | every stated width reproduced, the 48rem step of the total note included. One gap, pre-existing: finding 3. |
| rem thresholds and cascade order | every rem in the diff against px/16; the media blocks' source order | all equal; the blocks run in ascending min-width, so each `--lines: 2` at 48rem overrides the 1 before it and the later steps override it |
| `topBarsOf` scope leak (shared by countries, US states, cities, devices) | agent differential harness: base and HEAD `topBarsOf` with no `foldedKey` over 42 cells (row count 0, 1, 9, 10, 11, 12, 25 × `otherName` 'Rest' or undefined × three engaged-views shapes); `countries.test.ts`, `us-states.test.ts`, `cities.test.ts`, `devices.test.ts` | byte-identical in every cell; the four files pass (11, 4, 2, 9) |
| The fold's edge cases | agent ran `operatingSystemBarsOf` on `OTHER` alone, `OTHER` largest, `OTHER` with 0 engaged views | correct per #328; nits below |
| #327 callers | `routeAfterLostSwitches` callers (`App.tsx:325-329`), `listRouteFor` and `listReadOf` callers (`VideoList.tsx:321`, `VideoDetail.tsx:330`); the base function run on the three Audience cases | only the revert reaches the Audience route; at base each case rewrote `audience?sort=X&page=2` to `audience` |
| Accessible names of every `nav` per screen | agent rendered the real `renderApp` over the fake API on three screens | channel screen `["Channel screens", "Pages"]`; a video's page `["Channel screens", "Videos", "Videos"]`; Audience `["Channel screens"]`. Finding 1. |
| `docs/oauth-verification.md` shot numbers | every "shot" reference in the whole doc; the shot's text against `sidebar.ts` and `Audience.tsx`; `grep -n '—'` | every reference right (shot 20, shots 9 to 20, shots 6 and 15); the section list and link texts match; item 7's quote equals `noNumbersText`; no em-dash anywhere in the doc |
| Browser-only behaviour | not run | the real jump on a throttled network at 375px, 768px and 1280px with every format and with Shorts. Nick's browser walk (#326's own check, and #335) covers it. |

**Overall:** The four children do what their tickets ask, and every measured width in the stylesheet reproduces in Chrome. The fold leaves the other top-bar sections byte-identical, and the four CI checks pass. Six LOW findings, none a gate: the new nav-name test states a rule that is false on a video's page; the head title's remeasure points at a pull request that will not exist; a pre-existing short delay-note place under 333px; one test gap; one duplicated CSS rule; and a comment hygiene batch. The PR can open as it is.

## Approach decisions
- Carried from reviews 1 and 2, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper the branch already has.
- The nav names (finding 1): the test's scope and its stated limit change, not the stepper. Two different names for the video page's steppers are new copy, so they go to Nick as a follow-up.
- The note places' shared rule (findings 3 and 5): one rule holds the width and height of every note place, and each place's base `--lines` lives in its own rule after it, the shape `.placeholder-every-format-note` and `.placeholder-gender-note` already take (`apps/web/src/app.css:1569-1575`).

## Confirmed Issues

### 1. The new nav-name test states a rule that is false on a video's page, where both steppers are named "Videos" — LOW
- **Location:** `apps/web/src/app.test.ts:1687` (the test), with `apps/web/src/VideoStepper.tsx:104` and `:115` (the two `aria-label="Videos"`) and `apps/web/src/VideoDetail.tsx:477-506` (the one stepper element rendered twice, in the head and at the bottom)
- **Attribution:** pre-existing, exposed. `git show 4f48aaa:apps/web/src/VideoStepper.tsx | grep -n aria-label` gives the same two `aria-label="Videos"` at `:104` and `:115`. The test is new in `77beb2b` (#328), and it states the rule "every nav has a name of its own" in general while rendering only the channel screen.
- **Real-world trigger:** a screen reader user on a video's page lists the landmarks and hears "Channel screens", "Videos", "Videos", with nothing telling the head stepper from the bottom one. That is as it was before this branch. The branch's part is a test whose name claims the rule holds and which cannot see the one screen where it does not. LOW, capped: an accessibility legibility gap, not a wrong number.
**Evidence**
```ts
  test('beside another nav, every nav has a name of its own', async () => {
    const api = installFakeApi()
    api.pageCount = 3
    const { container } = await render(query)
```
**Failure mode** — Rendered on `videos/<fakeVideo.id>` (the address the `marks the current link` test.each at `app.test.ts:1699-1708` already uses), `navNamesIn` returns `["Channel screens", "Videos", "Videos"]`, so `new Set(names).size` is 2 against a length of 3 and the test would go red. It passes only because it renders the channel screen, where the names are `["Channel screens", "Pages"]`. #328's criterion reads "on a screen that shows the sidebar and another nav, every nav has an accessible name and no two share one", and a video's page is such a screen.
**Recommended fix** — Name the screen the test covers, and state the limit in the test, so the suite does not claim a rule it does not check:
```diff
-  test('beside another nav, every nav has a name of its own', async () => {
+  test("on the channel screen, beside the pager's nav, every nav has a name of its own", async () => {
```
and, directly above the test, a limit line: the video page's two steppers share the name "Videos" until Nick approves a name for each, so this test covers the channel screen only (it is a test's stated limit, `CODING_STANDARDS.md` 2, not a narrating comment). The follow-up for Nick: approve two names for the head and bottom steppers (or `aria-labelledby`), then turn this test into a `test.each` over `['the channel screen', '']` and `["a video's page", `videos/${fakeVideo.id}`]`.
**Remediation brief**
- **Design intent:** every landmark on a screen carries an accessible name of its own so a screen reader can tell them apart. The sidebar's name is `sidebarLabel` (`apps/web/src/sidebar.ts:5`, approved in #328 on 2026-10-22); the pager's is "Pages" (`VideoList.tsx:256`); the stepper's is "Videos", and one stepper element is placed twice on a video's page.
- **Full surface:** `apps/web/src/app.test.ts:1687` (the test's name) and the line above it (the limit). Nothing in production.
- **Must preserve:** the test's four assertions (`sidebarIn` not null, more than one nav, no empty name, no duplicate) and `api.pageCount = 3`, which makes the pager render; `describe('the sidebar')` in `apps/web/src/app.test.ts` passes (`pnpm exec vitest run apps/web/src/app.test.ts -t "the sidebar"`, 12 passed at `7045229`).
- **Do not touch:** `VideoStepper.tsx`'s `aria-label="Videos"`: any new stepper name is copy, and it needs Nick's approval first (Approach decisions).
- **Proof:** the limit is real: temporarily change the test's `render(query)` to `render(`videos/${fakeVideo.id}${query}`)` in a scratch copy and run `pnpm exec vitest run apps/web/src/app.test.ts -t "every nav has a name"`; it goes red on the duplicate. After the fix, the same command on the real file is green.

### 2. The head title's remeasure points at a pull request that will not exist, so its sixteen titles and the bar count are recorded nowhere in the repo — LOW
- **Location:** `apps/web/src/app.css:1446-1453`
- **Attribution:** introduced, `48fbb09` (#326). `git log --oneline -S"issue 326's pull request" 4f48aaa..HEAD` names only `48fbb09` and its merge.
- **Real-world trigger:** a maintainer who has to move the title rule (`@media (min-width: 61.25rem)`, `app.css:1465`) again looks for "creator-analytics issue 326's pull request". #326 landed into the epic branch with no pull request of its own (`gh pr list --search 326` finds only #336), and the commit message has no body. The list lives only in `.epic-loop/tickets/326/assumptions.md`, which git ignores. The measurement cannot be reproduced, which is the one thing a measurement comment exists for (`CODING_STANDARDS.md` 1, "a measurement or a value someone else has to reproduce"). #326 also asked for the bar count (three) to be recorded in the PR. LOW: a maintenance trap, not a wrong number.
**Evidence**
```css
   2026-10-24, the same way at every width from 320px to 1440px, with sixteen other titles of 48 to
   58 characters (the first sixteen are not kept), the channel's own and others in their style,
   named in creator-analytics issue 326's pull request: all 2 lines at 768px, then 1 for half of
```
**Failure mode** — No pull request for #326 exists or will exist under the epic flow; the PR that carries #326 is the #268 PR this branch opens. The comment points at nothing.
**Recommended fix** — The comment names the PR that carries #326, and that PR's body carries the list and the bar count:
```diff
-   named in creator-analytics issue 326's pull request: all 2 lines at 768px, then 1 for half of
+   named in the creator-analytics#268 pull request that carries issue 326: all 2 lines at 768px, then 1 for half of
```
(re-wrap the paragraph after the edit). The PR body then lists the sixteen titles and "three bar rows per section" from `.epic-loop/tickets/326/assumptions.md` (the head title line and A12). That half is the PR author's, not the remediator's.
**Remediation brief**
- **Design intent:** each measured placeholder rule in `app.css` carries how, when and on what it was measured, so the next maintainer can measure again the same way. The title rule's widths come from sixteen titles beside the sidebar and the thumbnail.
- **Full surface:** `apps/web/src/app.css:1446-1453` (the comment). The PR body for #268 (outside the repo).
- **Must preserve:** the rule `@media (min-width: 61.25rem)` and the rest of the comment; `apps/web/test/web.test.ts` "the video detail head's text placeholder ..." pins `['(min-width: 61.25rem)', '1']` (`pnpm exec vitest run apps/web/test/web.test.ts -t "video detail head"`).
- **Do not touch:** the widths; the agent harness did not measure titles, and nothing here says they are wrong.
- **Proof:** `git grep -n "issue 326's pull request" apps/web/src/app.css` prints a line now and nothing after.

### 3. On a phone narrower than 333px, the delay note's place holds 3 lines for a note that wraps to 4 — LOW
- **Location:** `apps/web/src/app.css:1502-1507` (the shared rule's `--lines: 3`), with the comment at `:1493-1495`
- **Attribution:** pre-existing, untouched. `git show 4f48aaa:apps/web/src/app.css | grep -n -A3 '^.placeholder-note,'` gives the same `--lines: 3` base, and the base comment already said "takes 3 lines from 333px". The branch's comment now states the gap ("4 lines below 333px, where its place holds 3").
- **Real-world trigger:** a creator on a 320px phone (an iPhone SE in its zoomed display mode) opens the list or a video while it loads in the last days of a long month: everything under the note moves down one line (24px) when the September 30 note lands. Executed: at each px from 320 to 332, the real note wrapped to 4 lines and the place held 3. LOW: a layout jump on the narrowest phones.
**Evidence**
```css
.placeholder-note,
.placeholder-total-note {
  --lines: 3;
  width: min(24rem, 100%);
  height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);
}
```
**Failure mode** — Below 333px (20.8125rem) the September 30 note takes 4 lines; `.placeholder-note` holds 3 at every width below 27.4375rem.
**Recommended fix** — Each place takes its own base `--lines`, and the delay note gets a 333px step, placed before `@media (min-width: 23.375rem)`:
```diff
 .placeholder-note,
 .placeholder-total-note {
-  --lines: 3;
   width: min(24rem, 100%);
   height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);
 }
+
+.placeholder-note {
+  --lines: 4;
+}
+
+.placeholder-total-note {
+  --lines: 3;
+}
+
+@media (min-width: 20.8125rem) {
+  .placeholder-note {
+    --lines: 3;
+  }
+}
```
and in `apps/web/test/web.test.ts:690-694`:
```diff
       expect(lineCountsIn(own, '.placeholder-note')).toEqual([
-        [null, '3'],
+        [null, '4'],
+        ['(min-width: 20.8125rem)', '3'],
         ['(min-width: 27.4375rem)', '2'],
         ['(min-width: 64.5rem)', '1'],
       ])
```
with the test's name "three on a phone" made "four on the narrowest phones, then three", and the `app.css:1493-1495` comment made "takes 4 lines below 333px, 3 from 333px (20.8125rem), 2 from 439px ...".
**Remediation brief**
- **Design intent:** a note's place holds as many lines as the longest note it stands in for wraps to at that width, so nothing below it moves when the answer lands. The widths come from the 2026-10-24 Chrome measurement the comment describes; media blocks run in ascending min-width so a later block overrides an earlier one.
- **Full surface:** `apps/web/src/app.css:1493-1495` (comment), `:1502-1507` (the shared rule), the new rules directly after it; `apps/web/test/web.test.ts:677` (test name) and `:690-694` (expectation). `lineCountsIn` (`web.test.ts:94-101`) reads every rule naming the selector, so after the split each place has exactly one `[null, ...]` entry.
- **Must preserve:** `.placeholder-total-note` at 3 lines below 23.375rem and every later step (`web.test.ts` "the running total note's placeholder ...", which expects `[null, '3']` first); the shared width and height; the 20.8125rem block must come before the 23.375rem and 27.4375rem blocks, or it overrides them. If finding 5 lands first, the shared rule's selector list is longer; the `--lines` split here is the same.
- **Do not touch:** the 99 character May 1 note's widths and the other admitted gap, "a shorter month can move what follows up a line": that is a shorter note, which a place sized for the longest cannot avoid.
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "delay note"` red with the new expectation before the CSS change, green after. The browser half is Nick's walk at 320px.

### 4. The every-format placeholder test does not check the countries section — LOW
- **Location:** `apps/web/src/placeholder.test.ts:191`
- **Attribution:** introduced, `48fbb09` (#326).
- **Real-world trigger:** none today; the code is right. A later change that gives the countries section an every-format note place when a format is chosen (the countries read does take the format, so it should not) would leave the test green, since the first section is skipped and the order test runs only with `'all'`. LOW, a coverage gap on correct code.
**Evidence**
```ts
    const [, usStates, cities, ...rest] = audiencePlacesOn(format)
    ...
    expect(rest.flat()).not.toContain('placeholder-every-format-note')
```
**Failure mode** — The countries section's places under `short`, `video` or `live` are never asserted.
**Recommended fix**
```diff
-    const [, usStates, cities, ...rest] = audiencePlacesOn(format)
+    const [countries, usStates, cities, ...rest] = audiencePlacesOn(format)
@@
-    expect(rest.flat()).not.toContain('placeholder-every-format-note')
+    expect([countries, ...rest].flat()).not.toContain('placeholder-every-format-note')
```
**Remediation brief**
- **Design intent:** the every-format note shows under US states and cities only, because those two reads never take the format (the epic: Google answers wrong numbers for them under a format filter); every other section reads the chosen format and shows no such note.
- **Full surface:** `apps/web/src/placeholder.test.ts:191` and `:197`.
- **Must preserve:** the two `slice(-2)` assertions and the closing `'all'` assertion.
- **Do not touch:** `AudiencePlaceholder` (`apps/web/src/Audience.tsx:42-60`), which is right.
- **Proof:** in a scratch copy, change `<BarsSectionPlaceholder notes={['countries-note']} />` to `notes={['countries-note', ...everyFormat]}`; `pnpm exec vitest run apps/web/src/placeholder.test.ts -t "every format note places"` stays green before the test change and goes red after it.

### 5. The Audience note places repeat the note place's width and height rule — LOW
- **Location:** `apps/web/src/app.css:1554-1561`, beside `:1502-1507`
- **Attribution:** introduced, `48fbb09` (#326). A refactor walked past (`CODING_STANDARDS.md` 3): the change wrote a second copy of the rule the file already had for a note's place.
- **Real-world trigger:** a later change to how a note's place is sized (the padding, the line height) edits one rule and not the other, and the Audience screen's places drift from the notes. The web tests pin each copy's height, so a drift would at least go red. LOW.
**Evidence**
```css
.placeholder-countries-note,
.placeholder-us-states-note,
.placeholder-cities-note,
.placeholder-every-format-note,
.placeholder-gender-note {
  width: min(24rem, 100%);
  height: calc(var(--lines) * 0.9375rem * 1.6 + 1rem);
}
```
**Failure mode** — Two rules hold the same width and height for the same kind of place.
**Recommended fix** — Add the five selectors to the shared rule at `:1502` and delete the copy at `:1554-1561`. Keep each Audience place's own `--lines` rules where they are (`:1563-1575` and the media blocks), and move the shared rule's `--lines: 3` into per-place rules as finding 3 does, so the shared rule sets no `--lines` at all. Move the Audience comment's first sentence ("each as a note's place above, measured the same way...") to stay above the Audience `--lines` rules.
**Remediation brief**
- **Design intent:** one rule says what a note's place is (its width, and lines of 0.9375rem text at line height 1.6 plus 1rem of padding); each place says only how many lines it holds at each width.
- **Full surface:** `apps/web/src/app.css:1502-1507`, `:1554-1561`; nothing in the tests, since `valueIn` matches a selector inside a list.
- **Must preserve:** every place's `--lines` at every width (the five Audience tests in `apps/web/test/web.test.ts:722-781`, the delay and total note tests); source order, so each `--lines` rule comes after the shared rule.
- **Do not touch:** the Audience media blocks' order, which the harness verified.
- **Proof:** `pnpm exec vitest run apps/web/test/web.test.ts -t "placeholder"` green before and after; `grep -c 'calc(var(--lines) \* 0.9375rem \* 1.6 + 1rem)' apps/web/src/app.css` prints 2 now and 1 after.

### 6. Comment hygiene — LOW (aggregated)
- `apps/web/src/app.css:1500-1501` — "the 92 character note under the charts" → "the 93 character note under the charts" (`len()` of `metric-charts.ts:26` is 93; the sentence was rewritten in `48fbb09`)
- `apps/web/src/app.css:1495` — the 122-character line ("... and 1 from 1032px (64.5rem); the 99") → re-wrap the paragraph to the file's 100 columns
- `apps/web/src/app.css:1448` — "the same way at every width from 320px to 1440px" → "in headless Chrome with Switzer, at every px from 320px to 1440px" (the first measurement, `:1444`, was in 10px steps, so it was not the same way)

## Needs Further Investigation
None.

## Reviewed and Dismissed
- `topBarsOf`'s new `foldedKey` changes countries, US states, cities or devices — byte-identical over 42 cells against `$BASE`, and their four test files pass.
- The fold with `otherName` undefined keeps `OTHER` as a bar — no caller passes `foldedKey` without `otherName`, and the doc comment says so.
- The rest bar sits last even when it is the longest (`OTHER` 500, Windows 10) — the bars' order is "the top 10, then the rest", as the epic specifies for every top-bars section.
- The Audience placeholder sits in a `.placeholders` wrapper the landed sections lack — its gap is 1.5rem, the same as `.signed-in-screen`'s (`app.css:1694-1697`, `:1762-1766`).
- `aria-busy` moved from the single section to the wrapper — `LoadingStatus` stays a sibling outside it, as in `VideoDetail.tsx` and `ChannelSummaryFigures.tsx`.
- The Audience note places' widths beside the sidebar from 48rem while the channels are read — `App.tsx:257` shows the sidebar in that state, so the beside-the-sidebar widths hold.
- `.placeholder-note` has no 48rem step while the total note has one — measured: the September 30 note does not gain a line at 768px.
- `routeAfterLostSwitches` treats the Audience route as a list anywhere else — `listRouteFor` and `listReadOf` are reached only from `VideoList.tsx:321` and `VideoDetail.tsx:330`, neither on the Audience screen.
- The OAuth doc's shot list after the renumbering — every reference checked against the new numbers; "What was submitted" and the justification are outside the diff.

## Minor / nits
- `apps/web/src/video-list.test.ts:1153`: `expect(shownOn).toBe(addressOf(onAudience))` takes its expectation from `addressOf`, the helper `revertAddressAfterFailedSave` returns through. It went red at base, so it is not vacuous; a literal `'audience?sort=-estimatedMinutesWatched&page=2'` would pin what the creator sees.
- `apps/web/src/top-bars.ts:30-31`: an `OTHER` row with 0 engaged views draws an "Other operating systems" bar of 0 (0%). It matches #328 ("shows whenever Google answers OTHER"); whether Google answers such a row is unknown.
- `apps/web/src/devices.test.ts`: no test for `OTHER` as the only row (it gives one rest bar of 100%, correct).
- `apps/web/src/placeholder.test.ts`: `audiencePlacesOn` always passes `channelId: 'c-1'`, so the placeholder while the channels are read with no channel, which the `Audience` doc comment names, has no test. The path is the same (`landed` is null).
- `apps/web/test/web.test.ts:722-781`: the five Audience note tests each repeat the `.note` padding assertion the delay note test already makes.

## Test quality
Tests added or changed: 21 cases in 5 files (`app.test.ts` 1, `devices.test.ts` 5, `placeholder.test.ts` 3, `video-list.test.ts` 4, `web.test.ts` 8), plus a comment in `components.test.ts`. Green against `$BASE`: 1, the `devices.test.ts` title-case fallback test, rewritten on purpose to use only unmapped values; its rule was on the base, so keep it. Tautology shapes found: none that make a test vacuous; one expectation computed with a production helper (nit above). Scope gaps: finding 1 (the nav test covers one screen) and finding 4 (the every-format test skips countries).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `7045229` (one flake on the first suite run, in `apps/extension`, green on re-run).
- **Commit hygiene:** this doc is the only new file. Nothing to drop.
- **Likely reviewer asks:** the PR body carries the sixteen head titles and the bar count for #326 (finding 2); a name for each video page stepper (finding 1's follow-up, copy for Nick); Nick's browser walk for #326 at 375px, 768px and 1280px with every format and Shorts, and #335.

## Verdict
**Ready to open the PR, with follow-ups.** No CRITICAL, HIGH or MEDIUM. Six LOWs, none a gate: findings 1, 2, 4, 5 and 6 are small test, comment and CSS edits; finding 3 is pre-existing. Finding 1's full fix waits on Nick's copy for the steppers, and finding 2's other half belongs in the PR body.
