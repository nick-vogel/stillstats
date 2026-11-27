# Pre-PR review: creator-analytics#268 run 6, the toast, the date range bar, the session's sidebar and four placeholder tickets

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `b04d419` "Merge pull request #538 from nick-vogel/creator-analytics-268-channel-audience-screen")
**Reviewed at:** HEAD `07596d0` ("creator-analytics#512 Placeholders: a video page section heading's place holds the lines its heading wraps to"). The tree was clean, with no uncommitted or untracked files at review time. Against the merge-base: 25 files, +1766 / −265, in 15 commits, seven tickets each landed as a lane commit and its merge (#508 `5efee9d`, #461 `f568861`, #507 `3e042ad`, #509 `2c19d51`, #510 `a6b1527` and its review fix `c96b9b3`, #511 `9c8567d`, #512 `6a72799`).
**Delta under review:** none. A `--fresh` review of the whole working surface. Pre-PR reviews 1 to 9 covered work that merged to `main` before the merge-base (PR #538 among it), so none of their findings are in scope here.
**Reviewed against:** creator-analytics#461, #507, #508, #509, #510, #511 and #512 (bodies, acceptance criteria and the recorded decisions on #509 and #510); their parent #268; `CODING_STANDARDS.md` 1 to 3 and the five binding review rules; ADR 0014; review 9's Approach decisions; each ticket's recorded assumptions and its per-ticket review headings under `.epic-loop/tickets/<n>/`, a separate series that is not renumbered here.
**Date:** 2026-11-09
**Reviewer:** 3 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome) | pass, 570 files; pass again with this doc and its repro added |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 132 files, 3,202 passed, 1 expected fail, first run; no flake |
| Browser walk | `pnpm run --if-present test:browser` | passed, "No content security policy violation in 51 steps" |
| Base oracle for the new tests | tautology agent: scratch worktree at `b04d419`, HEAD's six test files copied in (and HEAD's `audience-rows.ts` for the per-test run of `placeholder.test.ts`), run there, worktree removed after | 44 new or changed cases; 42 red at base, 2 green (see Test quality) |
| The publish day top's memo across a sort or page size change | `repro/publish-day-top-resort.sh`: a scratch worktree at HEAD with one test added to `video-list.test.ts` | red: `expected 10 to be 2` (finding 1) |
| Finding 1's recommended diff | own scratch worktree at HEAD, the diff applied to `video-list.ts`, then `pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` | 563 passed, 2 red: exactly the two tests that pin the old key (`video-list.test.ts:1081`, `placeholder.test.ts:386`), which the brief rewrites |
| Where a re-sort under "Publish day" lands | read `listReadOf` (`video-list.ts:691-713`), `readsAnotherPageOf` (`:278`), `summaryPlaceListOf` (`:297`), `ChannelSummaryFigures.tsx:120-121` | `listKey` keeps sort and page size, so a re-sort is not "another page", the summary is `reading`, and `AfterPublishPlaceholder` renders with the memo's count |
| Whether the #507 placeholder sidebar can render collapsed | read `App.tsx:318-330` | no: the preferences are read only once the session is signed in, so the provider is open whenever the placeholder shows (Dismissed) |
| Whether a toast can show beside the #507 placeholder | read `App.tsx:483` | no: the toast is built only for a signed-in session (Dismissed) |
| Comment lines over 100 columns in the diff | awk over the changed files, against the same count at `b04d419` | many lines at 101 to 105 on both sides; four new ones far past it (comment hygiene) |
| Em-dashes in added lines | `git diff b04d419 -- apps/ \| grep '^+.*—'` | none |
| Not run | Safari; a real screen reader; page zoom and sub-pixel window widths for the 23.3rem and 19.72rem steps | Nick's walk; Needs Further Investigation A and B |

**Overall:** the seven tickets do what they ask, and every full check passes, the browser walk's 51 steps included. The toast centres beside the sidebar on the column's own query, the stuck date range bar reads as one piece, the session's wait holds the sidebar from the first render, and the note, bar row, bar name and heading places hold what lands. One MEDIUM stands: under "Publish day", the bar count the placeholder remembers is keyed on the whole list read, so a sort or page size change on a channel whose top is short holds 10 rows and the page jumps up when the answer lands, which the fixed three rows never did. It is a one-function fix with a red repro. Seven LOW findings follow: walk checks narrower than their comments, test shapes that standard 2 rules out, an untested exit path, refactors the change walked past, the walk header's order, and comment hygiene. Fix finding 1 before the PR opens; the LOWs can go with it or follow.

## Approach decisions
- Carried from reviews 1 to 9, unchanged: copy with no approval is Nick's decision, recorded and not fixed by remediation; test gaps close with a test in the existing describe for their rule, never with a production change; duplication inside the branch's own new code folds into the rule or helper it copies; the walk's header lists the steps in the order the `walk(...)` calls run; the column shows only where the window holds every row, by `sidebarColumnQuery`; content raised with a z-index inside the scrolled screen is held under the sticky controls bar by its nearest positioned box's `position: relative; z-index: 0`; an approved name is tested as the rule it serves, never as its literal.
- New: a page-load memo of an answer's size is keyed on exactly the parts of the read that the answer depends on. The video list's rows depend on the whole query, so `answeredRows` keeps it whole. The publish day top ranks every upload of the list's format and visibility whatever the sort, page and page size, so its memo drops those three. Precedent: `listReadOf`'s `listKey` (`apps/web/src/video-list.ts:702-712`), which drops `page` because the list's other pages share everything else.
- Remediation, 2026-11-09: a test that needs "another read" of the publish day top uses a read whose top differs, a format change (`{ ...first1, format: 'short' }`), never a sort or page size change, which now finds the same top by design.

## Confirmed Issues
### 1. Under "Publish day", a sort or page size change holds 10 bar rows for a top the same channel just answered shorter, so the page jumps up when it lands — MEDIUM
- **Location:** `apps/web/src/video-list.ts:149` and `:165`
- **Attribution:** introduced by `a6b1527` ("creator-analytics#510 Placeholders: the bar rows a section holds against the bars it lands with"): `git log --oneline -S'rememberPublishDayTopRowsOf' b04d419..HEAD` names only that commit. At `b04d419` the placeholder held three rows for every read.
- **Real-world trigger:** a creator on `?window=first1` whose top answers fewer than 10 videos (a channel with few processed uploads, or the Shorts or Live format filter) changes the list's sort from a column heading, or its page size. The list's own placeholder keeps the last answer's row count (`video-list.ts:212`), but the summary's place above it holds 10 bar rows, then shrinks to the answer's count. For a two-video top that is eight bar rows, about 18rem, moving the delay note, the list and everything under it up once the answer lands. At `b04d419` the same action moved it one row. Display only, no number is wrong, so MEDIUM is the cap.

**Evidence**
```ts
export function rememberPublishDayTopRowsOf(channelId: string, query: string, rows: number): void {
  answeredPublishDayTopRows.set(answeredRowsKeyOf(channelId, query), rows)
}
...
  const { query } = listReadOf(route, channel, saved)
  return answeredPublishDayTopRows.get(answeredRowsKeyOf(channel.id, query)) ?? publishDayTopSize
```
`query` is `videoListQueryOf`'s `page, window, range, sort, format, pageSize, visibility` (`video-list.ts:86-103`), while `publishDayTop` is "across every upload of the list's format, visibility and scheduled filters, not just the page's" (`packages/api-types/src/videos.ts:324-327`), built from the whole listed set (`apps/api/src/video-list.ts:527`).

**Failure mode** — `sh docs/reviews/creator-analytics-268/repro/publish-day-top-resort.sh` remembers a 2-bar top for the default first1 read, then asks for the same channel under `sort: '-engagedViews'` and under `pageSize: 50`: `AssertionError: expected 10 to be 2`. Two existing tests pin the defect as intended behaviour: `video-list.test.ts:1081` (`expect(publishDayTopRowsExpectedFor(one, { ...first1, sort: '-views' }, {})).toBe(10)`) and `placeholder.test.ts:386` (the same through the rendered placeholder). On the path: a re-sort changes `listKey` (it keeps the sort), so `readsAnotherPageOf` is false, `summaryPlaceListOf` returns `reading` for the list's `placeholder-rows`, and `ChannelSummaryFigures.tsx:121` renders `AfterPublishPlaceholder`. A page change alone is safe, since `summaryPlaceListOf` keeps the last answer under first1.

**Recommended fix** — in `apps/web/src/video-list.ts`, key the top's memo on the read without its page, sort and page size:
```ts
export function rememberPublishDayTopRowsOf(channelId: string, query: string, rows: number): void {
  answeredPublishDayTopRows.set(publishDayTopKeyOf(channelId, query), rows)
}

function publishDayTopKeyOf(channelId: string, query: string): string {
  const top = new URLSearchParams(query)
  for (const key of ['page', 'sort', 'pageSize']) top.delete(key)
  return answeredRowsKeyOf(channelId, top.toString())
}
```
and in `publishDayTopRowsExpectedFor`, `return answeredPublishDayTopRows.get(publishDayTopKeyOf(channel.id, query)) ?? publishDayTopSize`. Update the comment above `answeredPublishDayTopRows` (`:140-141`) to say it is keyed on the read without its page, sort and page size, as the top ranks every upload of the list's format and visibility (and see comment hygiene for its "first day" clause). Tests: in `video-list.test.ts`, add the repro's test (`'a top answered under one sort is expected under another sort and page size'`) to the describe at line 1043, and in the test at 1078 replace `{ ...first1, sort: '-views' }` with `{ ...first1, format: 'short' }`, a read whose top differs; in `placeholder.test.ts:386` make the same swap. Both test names stay true.

**Remediation brief**
- **Design intent:** each placeholder holds the rows the same answer last had on this page load (#510's decision, "the way the video list does"), else the full size. The video list's rows depend on every part of its query, so its memo keys on all of it. The publish day top depends on the channel, the window (and a custom range), the format and the visibility, never on the sort, page or page size, so a read that differs only in those has the same top and must find its count. `VideoList.tsx:393-394` writes the memo on every answer that carries a top, with the list's own `query`.
- **Full surface:** `apps/web/src/video-list.ts:140-166` (the comment, `rememberPublishDayTopRowsOf`, a new `publishDayTopKeyOf`, `publishDayTopRowsExpectedFor`); `apps/web/src/video-list.test.ts:1043-1090` (new test; line 1081 swapped); `apps/web/src/placeholder.test.ts:382-389` (line 386 swapped). `VideoList.tsx:393-394` and `Placeholder.tsx:186` need no change.
- **Must preserve:** `answeredRows` and `listRowsExpectedFor` keep the whole query (`video-list.test.ts` `"the list's own rows memo leaves the top's alone"` at :1086 and the list rows describe above it); a saved page size the address leaves out is still the same read (`:1072`); an empty top remembers 0 and renders the empty text's place before the delay note's (`placeholder.test.ts:391-400`); no channel and another channel expect 10 (`video-list.test.ts:1082-1083`); the app round trip in `app.test.ts`'s describe at 3263; the walk's publish day step.
- **Do not touch:** the Audience memo in `audience-rows.ts`, whose key is the Audience read's own query (window or range and format, no sort or page), which is right as it stands (Dismissed); `summaryPlaceListOf`'s first1 page rule.
- **Proof:** `sh docs/reviews/creator-analytics-268/repro/publish-day-top-resort.sh` is red now (`expected 10 to be 2`); once its test is in the describe, `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` is green. With the diff above and the two swaps, the reviewer's own run had only those two pinned tests red before the swap.

### 2. The #507 walk step starts recording a header only after the busy sidebar shows, and compares only the end state, though its comments claim "from the first paint" and "no header at any point" — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:913-919`; the claims at `:62` and `:882-885`
- **Attribution:** introduced by `3e042ad`.
- **Real-world trigger:** none today. The app test `app.test.ts:4287` asserts the first render holds the busy sidebar and no header, and `useSidebarColumn` reads `matchMedia` synchronously (`components/ui/sidebar.tsx:41-47`). The gap is a regression that paints the header for a few frames first, which only the walk could see.

**Evidence**
```ts
      // Records a header from here on, so one that shows and goes between two reads still fails.
      await evaluate(`(() => {
        window.__headerShown = !!document.querySelector('main header')
        new MutationObserver(() => { ... }).observe(document.body, { childList: true, subtree: true })
```
**Failure mode** — the observer is installed after `waitFor(... busy sidebar ...)` succeeds, so a header that showed and went before the busy sidebar is never recorded, and `avatarAfter` and `wordmarkAfter` are read after `ready()`, so a move during the landing that settles back stays green.
**Recommended fix** — install the recorder before `Page.navigate` with `Page.addScriptToEvaluateOnNewDocument` (as the CSP listener is, `browser-walk.ts:437`), and read `window.__headerShown` after landing; or narrow the two comments to "from the busy sidebar's first read on" and "where they were once it lands".
**Remediation brief**
- **Design intent:** #507's AC is a sidebar from the first paint and a wordmark and avatar that do not move. The app test holds the first render's tree; the walk holds layout. The walk's claims must match what it observes.
- **Full surface:** `browser-walk.ts:62`, `:882-885`, `:913-919`, and `:930-952` if the end-state limit is stated.
- **Must preserve:** the step's existing checks (busy sidebar with footer places, wordmark and avatar boxes within 0.5px, the finally that releases the read and disables Fetch).
- **Do not touch:** `app.test.ts:4287`.
- **Proof:** with the recorder moved, a mutant that renders `Header` for the first frame (`headerShown` true until a `useEffect` clears it) turns the step red; today it stays green.

### 3. Four walk checks cannot go red on the whole of what they claim — LOW
- **Location:** `browser-walk.ts:3116`, `:2799-2811`, `:2828-2831`, `:1116`
- **Attribution:** introduced: `f568861` (3116), `6a72799` (2799-2811), `2c19d51` (2828-2831), `5efee9d` (1116).
- **Real-world trigger:** none; each is a check that a later regression would pass.

**Evidence and failure mode**
- `:3116` `radius: parseFloat(getComputedStyle(bar, '::before').borderTopLeftRadius)`: Chrome returns the pseudo's computed style from the matching rule even when no box is generated, so dropping `content: ""` from `.controls-bar::before` (app.css:473-481) leaves the radius check green while the line and rounded corners vanish. Fix: also return `before.content !== 'none'` and `before.borderTopWidth === '1px'` and require both.
- `:2799-2811` holds every breakdowns heading within 0.1px of its place, but nothing requires that a paired heading took two lines at some width, so a sample or font change that stops the wrap leaves #512's wrapped case unwalked. Fix: have `pairedLanded` return line counts as `landed` does and fail when none is 2 at 320px, as `longNameAt320` does for #511.
- `:2828-2831` the `PUT /api/me/preferences` never checks `ok`, so a refused save surfaces as a misleading "places are not their texts' height". Fix: `if (!response.ok) throw new Error(...)`, with a JSON content type.
- `:1116` `await showToast(currencies.shift() ?? 'EUR')`: three calls shift at most three times from three entries, so the fallback cannot run, and if it ever did EUR could already be saved, no toast would show, and the step would throw "No toast showed". Fix: drop the fallback and throw when `currencies` is empty (binding rule: a test for every fallback path, or no fallback).

**Remediation brief**
- **Design intent:** each walk step's assertion must fail when the behaviour its comment names breaks; a check that reads declared style or tolerates a missing case is weaker than its claim.
- **Full surface:** the four sites above.
- **Must preserve:** the steps' current passes; the #509 step leaves `revenueSources: false` saved for later steps (ticket assumption).
- **Do not touch:** the #461 corner hit-test step (`:3425-3460`), which can go red (Dismissed).
- **Proof:** for 3116, delete `content: ""` in a scratch build and run the walk: red after, green before the fix only on the radius read.

### 4. New tests in shapes that standard 2 rules out — LOW
- **Location:** `apps/web/test/web.test.ts:562-600`; `apps/web/src/app.test.ts:4297`; `apps/web/src/audience-rows.test.ts:34` and `:117`; `apps/web/src/components.test.ts` (no TrafficSources case); `apps/web/src/app.test.ts:3263` and `:4286`, `apps/web/test/web.test.ts:1584`
- **Attribution:** introduced (`5efee9d`, `3e042ad`, `a6b1527`, `9c8567d`, `6a72799`).
- **Real-world trigger:** none; each is coverage the branch claims and does not have.

**Evidence and failure mode**
- `web.test.ts` #508 test: it checks the toast.tsx source still holds `['fixed', 'inset-x-(--gutter)', 'mx-auto', 'w-fit']`, exact class strings; and it compares `valueIn(own, viewportSlot, property)` with `valueIn(own, '.app-signed-in', property)` from one shared rule (`app.css:1921`), so removing the properties from that rule compares `undefined` with `undefined` and passes. Fix: delete the class-string loop (the walk's toast step holds the centre), and pin each property's value or add `toBeDefined()`.
- `app.test.ts:4297` `expect(wordmark?.textContent).toBe('stillstats')` is a copy assertion; the rule, the same wordmark element, is held at the end of the test. Delete the line.
- `audience-rows.test.ts:34` asserts `fullAudienceRows` against literals (11, 11, 11, 7, 3, 8, 11), so it restates the constant and cannot catch a builder drawing a different maximum. Fix: build a maximal view (20 rows per cut list, OS rows plus `OTHER`, every age and gender key, the 8 device types of `packages/api-types/src/audience.ts:44-49`) and assert `audienceRowsOf(view)` equals `fullAudienceRows`; else delete it, as `placeholder.test.ts`'s first-read test renders the same counts.
- `audience-rows.test.ts:117` replaces a first answer with `fullAudienceRows`, which is also what an unremembered read returns, so a memo that ignored the second write after deleting the first would pass. Fix: a distinct second answer, `{ ...fullAudienceRows, countries: 5 }`.
- `TrafficSources.tsx:18` renders `bars-name`, but no test renders TrafficSources' rows, so reverting it to a plain `<span>` stays green (also #511 review F1.1). Fix: a TrafficSources case beside the other bar lists' in `components.test.ts`, with its `barRowsOf` regex.
- The #507 and #510 app describes (`app.test.ts:3263`, `:4286`) and the #512 rule test (`web.test.ts:1584`) do not say that happy-dom lays nothing out, so position and height are the walk's; standard 2's "a test states its own limits". Fix: one line in each naming the walk step that holds it.

**Remediation brief**
- **Design intent:** a test builds only its input and observes real output, states one rule, and states its limits (`CODING_STANDARDS.md` 2).
- **Full surface:** the sites above.
- **Must preserve:** the rest of each test; `app.test.ts:4339`'s two below-column cases, green at base and kept as guards of the split condition (Test quality).
- **Do not touch:** the stylesheet tests that already state their limits (`placeholder.test.ts:737` and the empty-text `test.each`).
- **Proof:** for the TrafficSources case, red with `className="bars-name"` dropped from `TrafficSources.tsx:18`, green with it.

### 5. No app test for the session's sidebar place ending in a failed session read — LOW
- **Location:** `apps/web/src/App.tsx:291` and `:531`
- **Attribution:** introduced by `3e042ad` (the placeholder path is new; the end state matches `b04d419`, where the header also went on a failed read).
- **Real-world trigger:** `GET /api/me` fails beside the column: the placeholder sidebar unmounts and the alert shows. The behaviour is right; it has no test, against the binding rule "a test for every fallback path".
**Recommended fix** — in the describe at `app.test.ts:4286`, a test that holds then fails `GET /api/me` (`api.failNext`, as `app.test.ts:402` does for the preferences) and asserts no sidebar, no header and the alert.
**Remediation brief**
- **Design intent:** while the session is read beside the column, the placeholder shows for every visitor (ticket assumption A1); a failed read ends on the alert.
- **Full surface:** `apps/web/src/app.test.ts:4286` describe. No production change.
- **Must preserve:** the describe's three tests.
- **Do not touch:** `Sidebar.tsx:109` (Minor).
- **Proof:** the new test is green at HEAD and red with `sessionReadBesideColumn` left true on a failed read (change `session.state === 'loading'` to `session.state !== 'signed-in' && session.state !== 'signed-out'` in a scratch copy).

### 6. Refactors the change walked past, inside its own new code — LOW
- **Location:** `apps/web/src/audience-rows.ts:57-59`; `apps/web/src/placeholder.test.ts:726` and `:776`; `apps/web/src/app.css:1770-1777`; `apps/site/test/screenshot/browser-walk.ts:888`, `:2537`, `:2881`, `:2990` and their older copies `:2484`, `:2675`
- **Attribution:** introduced (`a6b1527`, `c96b9b3`, `9c8567d`, `3e042ad`).

**Evidence**
- `audience-rows.ts:57` `answeredRowsKeyOf` is a byte-for-byte copy of `video-list.ts:111`; with the two remember and expected pairs it is the third copy of the page-load memo. Fold into one exported key helper (finding 1's `publishDayTopKeyOf` builds on the same helper).
- `placeholder.test.ts:776` `placeLinesAt(shape, container, width)` generalises `notProcessedPlaceLinesAt` (`:726`), left as a copy; replace the old one with `placeLinesAt('not-processed', 'signed-in-screen', w)`.
- `app.css:1770-1777` two one-declaration `--lines: 2` rules under a shared rule, split so the test's regex finds one rule per shape; fold `--lines: 2` into the shared rule and read it with `web.test.ts`'s selector-list-aware `rulesIn`.
- The walk's "hold a read, wait, release" loop is now in six copies (`pausedAudienceRead` 2484, `heldAudienceReads` 2537, `pausedRead` 2675, `heldPublishDayReads` 2881, `heldBarsReads` 2990, `pausedSessionRead` 888), the single-id ones releasing only the last paused request; the row height reader in three (`:2678`, `:2884`, `:2994`); the one-line long text check in two (`:2903`, `:3004`), which #511's shared `.bars-name` now lets one helper serve; and the #507 step reads boxes three ways though it defines `boxOf`.
**Recommended fix** — a shared `holdReads(pattern, act)` that releases every paused id; one `heightOf`; one `.bars-name` long-name check; and the two app-side folds above. Per the Approach decision, duplication in the branch's own code folds into the helper it copies.
**Remediation brief**
- **Design intent:** `CODING_STANDARDS.md` 3; one rule, one place.
- **Full surface:** the sites above.
- **Must preserve:** each walk step's waits and finally blocks (Fetch disabled, viewport and sidebar restored); every placeholder test's widths.
- **Do not touch:** the Audience memo's key contents (Dismissed).
- **Proof:** `pnpm test` and `pnpm run test:browser` green before and after; behaviour unchanged.

### 7. The walk's header lists #507 and #510's publish day check out of the order the steps run — LOW
- **Location:** `apps/site/test/screenshot/browser-walk.ts:21` and `:62`
- **Attribution:** introduced (`3e042ad`, `a6b1527`); the sidebar group's late place in the header predates the branch.
**Evidence** — `:62` lists #507 near the end, before #351, while its step runs at `:890`, between "sidebar column at its minimum height" and "account menu open". `:21` puts the publish day clause in the Audience part, before the 3000px and #477 notes steps, while the publish day step runs at `:2883`, after them; #469, the step's own ticket, is not named.
**Recommended fix** — move the #507 sentence to just after the #531 sentence, and the sidebar block with it to where it runs, before the account menu; move the publish day clause between the #512 and #511 clauses and name #469.
**Remediation brief**
- **Design intent:** the header lists the steps in the order the `walk(...)` calls run (Approach decision).
- **Full surface:** `browser-walk.ts:15-66`.
- **Must preserve:** every sentence's content.
- **Do not touch:** the steps themselves.
- **Proof:** read each header sentence against `grep -n "await walk(" apps/site/test/screenshot/browser-walk.ts`.

### 8. Comment hygiene — LOW (aggregated)
- `apps/web/src/VideoList.tsx:391` — "Only a read of the first day after publish carries the top" → "Only a read of a window after publish carries the top, and only the publish day placeholder reads it back" (`apps/api/src/video-list.ts:527` adds it under every after-publish window)
- `apps/web/src/video-list.ts:141` — "only a read of the first day after publish carries the top" → the same correction, with finding 1's key wording
- `apps/web/src/components/ui/toast.tsx:12` — a 159-column line where the edit appended a sentence → rewrap the block at 100 columns
- `apps/site/test/screenshot/browser-walk.ts:21` and `:62`, `apps/web/src/Audience.tsx:134` — new comment lines at 115, 126 and 111 columns → rewrap
- `apps/web/src/app.css:1901-1907` — "...portaled to the body, so the screen holds none of them, and the toast's own rule below centres it on the screen's place, the fixed sidebar is the screen's sibling, and ..." → end the list at "holds none of them", and make "The toast's own rule below centres it on the screen's place (creator-analytics#508)." its own sentence after it
- `apps/web/src/app.css:1712-1713` — "so the step is 23.3rem (372.8px), which holds both" → "so the step is 23.3rem (372.8px), inside the measured bracket of 372.67px (2 lines) to 372.91px (1 line)"
- `apps/site/test/screenshot/browser-walk.ts:3425` — "after a real press on "Next page"" → "after a click on "Next page"" (the step calls `click`, not `pressAt`)
- `apps/site/test/screenshot/browser-walk.ts:2926` and `:3046` — "The sidebar opens until the preferences read lands, so the places wait for its state." → delete with the `expanded` clause it explains, which since #507 holds from the first paint; the held screen read already follows the preferences (`App.tsx:277-280`)
- `docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh:128` — `<li><span>${name}</span>` → `<li><span class="bars-name">${name}</span>`, as the header says the markup is the components'

## Needs Further Investigation
### A. The #512 step at 23.3rem sits inside the measurement's bracket — confirm with a column between 372.67px and 372.91px
`app.css:1722` steps `video-subscribers-heading` to one line at 372.8px; the repro measured two lines at 372.67px (Audience card) and one at 372.91px (video column). Either side of the true threshold, a column in a 0.2px band gets a place one line off. Integer window widths give columns near 372.44px and 372.9px (finder B's model), so the band is reachable only through page zoom or a fractional device pixel ratio. To settle: run `collapsed-sidebar-placeholders.sh` with `--force-device-scale-factor=1.25` or a column swept in 0.01px steps across 372.6 to 372.95px. If the threshold falls below 372.8px, move the step to it.

### B. The Audience empty text's step at 19.72rem (315.52px) sits under the text's measured width — confirm in that band
`placeholder.test.ts` holds `oneLineFrom: 315.63` while `app.css` steps at 315.52px, and the sweep samples every 0.25px so it never lands between them (also #510 review F2.5). A card content box of 315.52 to 315.63px would hold one line for a text that takes two. Same check as A, on the Audience card.

### C. The toast's centre is read right after the sidebar folds — confirm no horizontal transition
`browser-walk.ts:1122-1127` reads the centre straight after the collapse. app.css moves the toast and the screen with no transition, but the toast viewport's classes and Base UI's enter animation were not read for a horizontal transform. A flake here would be a false red, not a false pass.

## Reviewed and Dismissed
- The #507 account place has no collapsed rule (`app.css` ~2190) — unreachable: the preferences are read only once signed in (`App.tsx:318-330`), so the provider is open whenever the placeholder shows; the collapsed case is the deferred #507 proposal.
- The #508 toast beside the #507 placeholder sidebar — no toast can show then: `toastNotice` is built only for a signed-in session (`App.tsx:483`); the `:has(.sidebar)` rule and the screen's offset match together.
- The #510 Audience memo key — `audienceQueryOf(audienceRequestOf(route))` covers window, range and format; the write runs inside `latestOnly` with the effect's own channel and query, so a stale or another channel's answer cannot be written. Do not change it in finding 1.
- The #510 counts — taken from the builders the sections draw with (`countryBarsOf`, `operatingSystemBarsOf` with the `OTHER` fold), so they match what renders; an empty section renders the empty text's place and no notes, as the landed sections drop their notes.
- The #510 publish day empty top — `[]` is truthy, so 0 is remembered; the empty text's place comes before the delay note's.
- #461's `::before` stacking — the sticky bar at z-index 1 is a stacking context, the `::before` at -1 paints over its fill and under the in-flow controls, and an absolute child is not a flex item; `heading-hold.ts` reads `offsetHeight`, unchanged by the padding swap.
- #512's `video-breakdown` container — the breakdowns' tracks have a fixed minimum, so inline-size containment changes no size; no unnamed `@container` or `cqi` user sits inside; both placeholder and landed sections are direct children of `.video-detail-breakdowns`.
- #510 and #511 row heights — a landed bar row (`0.9375rem * 1.6` line, 0.25rem gap, 0.5rem track) equals its place, and `.bars-name` is each `li`'s direct grid item, PublishDayTop's `<a>` included; no `.publish-day-title` reference remains.
- #509's place before the preferences land — the screen read waits on `preferencesRead` (`App.tsx:277-280`), so the place always follows the saved choice.
- The walk's loops over zero elements — each new step guards its count (#510 eight children, #512 two paired places, #511 `rows.length > 0`, the publish day equal counts).
- The walk's waits — every new poll is bounded and every Fetch hold is disabled in a finally.
- The stub's long sample names — no other test or step reads the replaced names, and every new code has a label (`us-states.ts:68-70`, `traffic-sources.ts:15`).
- `app.test.ts:4339`, green at base — a guard of the below-column half of #507's split condition; it goes red if `!sidebarColumn` is dropped. Keep.

## Minor / nits
- `Sidebar.tsx:109` `if (email === null) return null` is reachable only if App's `useSidebarColumn()` and the provider's `column` disagree in one render; both read the same `useSyncExternalStore` on `sidebarColumnQuery`, so it is a type narrowing guard. Harmless.
- `Placeholder.tsx:142` holds the note on a saved sources choice; a channel with revenue whose creator never saved one still moves by the note's height, as the sources button's place does. Inside #509's decision.

## Test quality
Tests added or changed: 44 · green against `b04d419`: 2 (`app.test.ts:4339`'s two cases, kept as guards of pre-existing behaviour the branch split, see Dismissed) · tautology shapes found: 6, all in finding 4 (exact class strings and an undefined-against-undefined comparison in the #508 stylesheet test, a copy assertion on the wordmark, a literal restatement of `fullAudienceRows`, a replacement test whose second value equals the fallback, and TrafficSources' `bars-name` with no test). `audience-rows.test.ts` and `placeholder.test.ts` fail to import at base, counted red; per test, with HEAD's `audience-rows.ts` added, all 11 changed placeholder tests are still red.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the suite pass at `07596d0`; the browser walk passes locally. This doc and its repro pass lint.
- **Commit hygiene:** commit this doc and `repro/publish-day-top-resort.sh`. Nothing to drop.
- **Likely reviewer asks:** whether a re-sort under "Publish day" keeps the page still (finding 1); a screenshot pass of the stuck date range bar on the light theme (the deferred #461 proposal).

## Verdict
Not ready as-is: fix finding 1 (MEDIUM, introduced, one function and two test swaps) before the PR opens. Findings 2 to 8 are LOW and can be remediated with it or follow as tickets. Pre-PR reviews 1 to 9 named no finding on this working surface, so none was claimed resolved.

## Remediation — 2026-11-09
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `1fa9111` creator-analytics#268 pre-PR review 10 finding 1: under Publish day, a sort or page size change holds 10 bar rows for a top the same channel just answered shorter | red→green: `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts -t 'expected under another sort'` (red `expected 10 to be 2` with the repro's test in the describe, green after the fix); preserve suites `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/video-list.test.ts apps/web/src/placeholder.test.ts apps/web/src/app.test.ts` 566 passed; `pnpm typecheck` and `pnpm lint` pass; `pnpm run --if-present test:browser` passed, 51 steps, no CSP violation | 0 new; 6 rewritten (the memo's comment, now naming its key, and the expected-count docblock's "same read" wording) | proved by execution |
| 2 to 7 (LOW) | — deferred | — | — | LOW tail, deferred by default scope (eng-pipeline#34) |
| 8 (LOW, comment hygiene) | — deferred, except the `apps/web/src/video-list.ts:141` entry, closed in `1fa9111` because finding 1 rewrote that comment and standard 1 keeps a rewritten comment true | — | — | LOW tail, deferred; the `VideoList.tsx:391` twin of the closed entry is still open |

The brief's diff went in as written: `publishDayTopKeyOf` drops `page`, `sort` and `pageSize` from the list query and keys through `answeredRowsKeyOf`, and both the write and the read use it. `answeredRows`, `listRowsExpectedFor`, the Audience memo and `summaryPlaceListOf` are untouched. The new test is the repro's, in the describe at `video-list.test.ts:1043`; the two pinned tests (`video-list.test.ts`, the "another read" case, and `placeholder.test.ts:386`) now use a format change, and both test names stay true. No verify agent ran: the one in-scope fix is MEDIUM, its proof was executed red then green, its preserve suites and the walk pass, and it touched no shared computation core or symmetric surface.

### Known regressions, deferred
- None.

### Rework briefs
- None; no rework pass ran.
