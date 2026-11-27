# Pre-PR review: creator-analytics#934 Repackaging view: sort and filter the video list by CTR and traffic source

**Branch:** `creator-analytics-934-repackaging-view` vs `origin/main` (merge-base `50d69539` "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `a5a8a81c` ("creator-analytics#945 Describe the repackaging view on the upgrade screen, pricing section and FAQ"), clean tree, no uncommitted or untracked files at review time. Whole branch: 28 files, +1670 / −67, 9 commits, carrying three landed children: #943 (`e8e22238`, merge `9f8ffad3`), #944 (`e01cfbf7`, `427f6ebb`, `59752ecc`, `a4a99fd8`, merge `7380f4a2`) and #945 (`4692e0c0`, merge `a5a8a81c`).
**Delta under review:** none. This is the first review of the branch (`--fresh`), so the whole `$BASE` surface is under review.
**Reviewed against:** epic creator-analytics#934 and sub-issues #943, #944 and #945 (bodies and acceptance criteria), the three tickets' recorded assumptions and lane review outcomes (the lanes' open LOW findings are not re-raised unless this review found new evidence; they are listed under Minor), the global rules in `~/.claude/rules/` and the repo rules `row-level-security-tests` and `youtube-test-limits`. The repo has no `CLAUDE.md` and no plan docs under `docs/specs/` or `docs/plans/`.
**Date:** 2026-11-20
**Reviewer:** 3 code-review agents (API and types, web logic, web UI and site copy) + 1 tautology-audit agent + verify pass
**Gemini:** skipped, Gemini failed: an HTTP or network error, or the 10-minute timeout (exit 14): "gemini-ask: network error: UND_ERR_INFO"

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` in the integration worktree | ok, already up to date |
| Lint | `pnpm lint` | green (828 files) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green: 215 files, 5424 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` (system Chrome) | green: 126 steps, no content security policy violation; the expected 401s on the signed-out tool page |
| Tautology audit | the 8 changed test files copied into a scratch worktree at `50d69539`, run with `pnpm exec vitest run <files> --reporter=json` twice | 79 added or changed tests: 67 red at base, 12 green (see Test quality) |
| Finding 1 (focus after Enter) | `docs/reviews/creator-analytics-934/repro/min-field-enter-focus.sh`, which inserts a case into `apps/web/src/app.test.ts` in a scratch worktree at HEAD | red at `a5a8a81c`: focus is on `<body>` after the commit |
| Finding 1 fix | the recommended diff applied in a scratch worktree, then the repro plus `apps/web/src/app.test.ts` and `apps/web/src/video-list.test.ts` | repro green, 780 of 780 green, web typecheck green |
| Finding 2 (history sort with no way back) | `pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts` | red at `a5a8a81c` on both tests |
| Extension answer unchanged with no new parameters | read `listVideos`, `videoReachOf(…, null)`, `isPartialFor`, `hasNoValue` against base; the extension sends no `trafficSource`, `minImpressions` or history sort (`apps/extension/src/product-api.test.ts:515`, `:586`) | holds (by reading; no differential harness, as every changed branch is gated on a new parameter or key) |
| Refusal order and quota | read `apps/api/src/routes/videos.ts` and `apps/api/src/video-list.ts:495-510` | route 400s, then the uploads read (`not_connected`), then `consent_missing`, then the two 403s, then the first Analytics read |
| Em-dashes in shipped copy | grep for `—` and `–` over every added line of `upgrade.ts`, `index.html`, `footer.html`, `VideoList.tsx`, `video-list.ts`, `traffic-sources.ts` | none |
| Gemini finder | `~/.claude/bin/gemini-review` | not run: exit 14, network error |
| Controls row on a slow entitlements read, ended channel's first load, select width at 375px | not run: needs a throttled browser session on a signed-in Pro and ended channel | recorded under Needs Further Investigation |

**Overall:** The API side holds: the sorts, the per-source reach, the minimum and the refusals do what the epic asks, a request without the new parameters answers as before, and the new API tests state rules and go red at base. Two MEDIUM web findings stop the PR: pressing Enter in the minimum impressions field drops keyboard focus to the page, and a CTR or impressions sort the list cannot show (after a switch to a free channel, or on a paid channel with no stored day yet) leaves the creator with no control that changes the sort. Six LOW findings follow, among them the copy tests that #945's acceptance criteria ask for and the global rule forbids, which is Nick's call. Run one remediation pass over findings 1 and 2, then open the PR; the LOWs can ride the same pass or become tickets.

## Approach decisions

- Minimum impressions field resync: the uncontrolled input keeps its node and takes the minimum in force through a layout effect on that value, not a `key` remount, so a commit never replaces the focused element. No in-repo text-input precedent exists (the web app's only other inputs are checkboxes); the layout effect mirrors the list's own focus rescue, which also runs in a layout effect (`apps/web/src/VideoList.tsx:598-606`).
- A history sort the list cannot show: the list leaves it for newest first with a replace navigation, never a pushed one, mirroring two precedents: a custom range the API refuses for its bounds falls back to the last 28 days (`fallBackFromRefusedRange`, `apps/web/src/route.ts:334`), and a revenue source sort on a channel YouTube reports no revenue for runs newest first (`routeAfterListAnswerOf`, `apps/web/src/video-list.ts:840`). The refusal `sort_without_history` and an answer without `history` both take this path, as one class of defect gets one approach.
- Reading the minimum from text: one helper, capped at 15 digits so `Number` is exact and `String` never writes exponent form, used by the address reader and the field.

## Prior-review closure

Not applicable: this is the branch's first review doc. The #944 lane's deferred MEDIUMs are taken up here: F4.1 (Enter remounts the minimum field) is Confirmed finding 1; F4.2 and F4.3 (the controls row on a slow entitlements read, and on an ended channel's first load) are Needs Further Investigation A. #943's proposals 1 and 2 (fall back from a refused history sort; rewrite a history sort when the list carries no history) are Confirmed finding 2, raised to MEDIUM on a new in-app path.

## Confirmed Issues

### 1. Pressing Enter with a new minimum drops keyboard focus to the page — MEDIUM

- **Location:** `apps/web/src/VideoList.tsx:199` (the `key`), `apps/web/src/VideoList.tsx:120-155` (`MinImpressionsField`)
- **Found by:** Claude
- **Attribution:** introduced. `git log -S'key={route.minImpressions' 50d69539..HEAD` names `e01cfbf7` ("creator-analytics#944 Filter the video list's impressions and CTR by traffic source, with a minimum impressions filter"). The rescue `a4a99fd8` added covers only the case where the whole `HistoryFilters` unmounts.
- **Real-world trigger:** a Pro creator types 500 in "Minimum impressions" and presses Enter. The same happens on a paid channel that empties a minimum and presses Enter, on a free channel that adds a minimum with Enter, and when Back or Forward changes the minimum while the field has focus. A keyboard or screen reader user lands on the page body and must tab from the top. No number is wrong, so MEDIUM.

**Evidence** — the field is keyed on the minimum in force, so a commit mounts a new `<input>`:

```tsx
      <MinImpressionsField
        key={route.minImpressions ?? ''}
        minImpressions={route.minImpressions}
        ref={minimum}
        onCommit={changeControl}
      />
```

`HistoryFilters` stays mounted (the address now carries a filter), so its layout-effect cleanup never sets `filtersLeftFocused`, and the rescue at `VideoList.tsx:598-606` returns early.

**Failure mode** — Enter calls `commit`, `changeControl` navigates, `route.minImpressions` goes from undefined to 500, the key changes from `''` to `"500"`, React removes the focused input, and `document.activeElement` becomes `<body>`. Executed: `sh docs/reviews/creator-analytics-934/repro/min-field-enter-focus.sh <scratch>` is red at `a5a8a81c`. The address does gain `minImpressions=500` and the new field exists; only the focus assertion fails, with `<body>` as the active element.

**Recommended fix** — drop the key and resync the input's text with a layout effect on the minimum in force (applied and run in a scratch worktree: the repro and 780 tests in `app.test.ts` and `video-list.test.ts` green, web typecheck green):

```diff
@@ apps/web/src/VideoList.tsx
 import {
   type MouseEvent,
-  type Ref,
   type RefObject,
@@ function MinImpressionsField
   minImpressions: number | undefined
   onCommit: (change: { minImpressions: number | undefined }) => void
-  ref?: Ref<HTMLInputElement>
+  ref: RefObject<HTMLInputElement | null>
 }) {
   const id = useId()
   const committed = minImpressions === undefined ? '' : String(minImpressions)
+  useLayoutEffect(() => {
+    if (ref.current) ref.current.value = committed
+  }, [ref, committed])
   function commit(field: HTMLInputElement) {
@@ function HistoryFilters
       <MinImpressionsField
-        key={route.minImpressions ?? ''}
         minImpressions={route.minImpressions}
```

The JSDoc above `MinImpressionsField` (`VideoList.tsx:114-119`) says "Keyed on that minimum by its parent, so a change of the address resets the text"; change that sentence to say the field takes the minimum in force whenever it changes.

**Remediation brief**
- **Design intent:** the minimum field is uncontrolled: its text is the creator's until Enter or blur commits it, a bad value puts back the minimum in force, and a commit equal to the minimum in force does nothing (assumptions 25 and 32 of #944). Each commit is a navigation and a list read. The traffic source select and the field leave the controls row together, and when they leave holding focus, focus goes to "Videos per page" (`a4a99fd8`).
- **Full surface:** `apps/web/src/VideoList.tsx:8-17` (the `Ref` import), `:114-119` (JSDoc), `:120-155` (`MinImpressionsField`), `:199` (the key); the parent passes `ref={minimum}` at `:200`, a `useRef<HTMLInputElement>(null)` at `:173`, which already fits `RefObject<HTMLInputElement | null>`. Add app tests in the describe "the history filters leaving the controls row with focus in one" of `apps/web/src/app.test.ts:3452`: the repro case below as a real test, and one that changes the address's minimum while the field is mounted (for example `window.history.pushState` to `?minImpressions=100` plus a `popstate`, as `app.test.ts:4046` does) and reads `100` in the field.
- **Must preserve:** the address change still resets the field's text (Back, Forward, a channel switch, a link to a list address); nothing pins it today, so the new test above must. The free-channel Enter-on-empty path still unmounts the filters and gives focus to "Videos per page" (`app.test.ts:3493`). The other three tests at `app.test.ts:3481`, `:3510` and `:3522`. A blur after an Enter commit commits nothing (the value then equals the minimum in force). `minImpressionsChangeOf` and its tests at `apps/web/src/video-list.test.ts:919` and `:924`.
- **Do not touch:** the layout-effect cleanup in `HistoryFilters` (`VideoList.tsx:176-184`) and the rescue at `:598-606`: checked and correct for the unmount case (Reviewed and Dismissed, "HistoryFilters cleanup sets the flag spuriously").
- **Proof:** `sh docs/reviews/creator-analytics-934/repro/min-field-enter-focus.sh "$(mktemp -d)"` from the repo root: red now, green after. It removes its own scratch worktree.

### 2. A CTR or impressions sort the list cannot show leaves no way to change the sort — MEDIUM

- **Location:** `apps/web/src/video-list.ts:66-79` (`videoListViewOf`), `apps/web/src/video-list.ts:840-843` (`routeAfterListAnswerOf`), `apps/web/src/channel-picker.ts:22-25` (`routeToChannel`)
- **Found by:** Claude
- **Attribution:** introduced. `git log -S"sortKey: 'ctr'" 50d69539..HEAD` names `e8e22238` ("creator-analytics#943 Sort the video list by CTR and by impressions for a Pro channel"), which added the history sort keys, the `sort_without_history` refusal and its text, and no fallback. `routeToChannel` is base code that keeps every list control; it becomes the path once a sort exists that one channel accepts and another refuses. #943's lane recorded both triggers as LOW proposals 1 and 2; the channel picker path below is new evidence and raises it.
- **Real-world trigger:** a creator with a Pro channel and a free one sorts the Pro channel's list by CTR, then picks the free channel in the sidebar picker. `routeToChannel` keeps `sort=-ctr`, the API answers 403 `sort_without_history`, and the list region shows "Sorting by impressions or CTR needs Stillstats Pro." in place of the table: no heading to click, the window and format controls keep the sort (`sortAllowedIn` allows a history sort in every window), and with no filter in the address the source select and minimum field do not show. Only an address edit, or going back to the Pro channel to change its sort, brings the list back. Second trigger: a paid channel whose history holds no day yet (just subscribed) accepts `sort=-ctr`, answers with no `history`, hides the Impressions and CTR columns, and runs the list newest first while the sort announcement (`sortLabelOf`, `video-list.ts:669`) says it is sorted by CTR. A confusing display with a dead end, no wrong number, so MEDIUM.

**Evidence** — the refusal is a plain refusal, unlike a refused custom range, and an answer without the history keeps the sort:

```ts
  if ('videos' in body) return { kind: 'list', answer: body }
  if (isRangeRefusal(body)) return { kind: 'invalid-range' }
  return {
    kind: 'refused',
    message: refusalMessageOf(body, 'the videos', { sort_without_history: …, filter_without_history: … }),
  }
…
export function routeAfterListAnswerOf(route: Route, answer: VideoListAnswer): Route {
  const sorted = reportsNoRevenue(answer) ? routeWithSourcesOff(route) : route
  return sorted === route ? routeWithin(route, answer.pageCount) : sorted
}
```

**Failure mode** — executed: `pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts` is red at `a5a8a81c` on both tests: `routeToChannel` keeps `-ctr` for the free channel, a window or format change keeps it, the view of `sort_without_history` is kind `refused` (no fallback), and `routeAfterListAnswerOf` keeps `-ctr` for an answer without `history` (received `-ctr`, expected `-publishedAt`).

**Recommended fix** — leave a history sort the list cannot show for newest first, by a replace navigation, in both places:

```diff
@@ apps/web/src/video-list.ts
 export type VideoListView =
   | { kind: 'list'; answer: VideoListAnswer }
-  | { kind: 'refused'; message: string }
+  | { kind: 'refused'; message: string; historySort?: true }
   | RefusedRangeView
@@ export function videoListViewOf
   if (isRangeRefusal(body)) return { kind: 'invalid-range' }
   return {
     kind: 'refused',
     message: refusalMessageOf(body, 'the videos', {
       sort_without_history: 'Sorting by impressions or CTR needs Stillstats Pro.',
       filter_without_history: 'Filtering by traffic source or impressions needs Stillstats Pro.',
     }),
+    ...('error' in body && body.error === 'sort_without_history' ? { historySort: true } : {}),
   }
@@ beside routeWithSourcesOff (video-list.ts:729)
+export function routeWithHistorySortOff(route: Route): Route {
+  return historySortKeys.reduce(routeWithColumnOff, route)
+}
@@ export function routeAfterListAnswerOf
-  const sorted = reportsNoRevenue(answer) ? routeWithSourcesOff(route) : route
+  const sourced = reportsNoRevenue(answer) ? routeWithSourcesOff(route) : route
+  const sorted = answer.history ? sourced : routeWithHistorySortOff(sourced)
   return sorted === route ? routeWithin(route, answer.pageCount) : sorted
@@ apps/web/src/VideoList.tsx, the read's answer handler (about :497)
         if (next.kind === 'invalid-range') {
           fallBackFromRefusedRange(currentRoute.current, navigate)
           return
         }
+        if (next.kind === 'refused' && next.historySort) {
+          navigate(routeWithHistorySortOff(currentRoute.current), { replace: true })
+          return
+        }
```

Update the JSDoc of `routeAfterListAnswerOf` (`video-list.ts:834-839`) to name the new rule, and the JSDoc of `videoListViewOf` (`:62-65`).

**Remediation brief**
- **Design intent:** the address never names a sort the list cannot say: the list replaces, never pushes, any route the answer shows it cannot sort by (a page past the last, a source sort without revenue, a refused custom range), so Back does not return to it. A history sort needs the stored history; a free channel, an ended one past its purge date, and a paid one with no stored day cannot show the columns, so the sort goes to newest first on page 1 (`routeWithColumnOff` sets the default sort and page 1). The traffic source and minimum stay in the address: a free channel then meets `filter_without_history`, whose controls show to clear (`historyFiltersShownOf`, `59752ecc`).
- **Full surface:** `apps/web/src/video-list.ts:57-60` (`VideoListView`), `:66-79` (`videoListViewOf`), `:729-731` (beside `routeWithSourcesOff`, add `routeWithHistorySortOff`), `:834-843` (`routeAfterListAnswerOf` and its JSDoc); `apps/web/src/VideoList.tsx:495-500` (the answer handler); `apps/web/src/VideoDetail.tsx:476` lands a `refused` view as the stepper's failure and needs no change, since the `historySort` flag is optional; `historySortKeys` is already imported in `video-list.ts:4`. Tests: `apps/web/src/video-list.test.ts` beside the `routeAfterListAnswerOf` cases (a `-ctr` route and an answer without `history` give `-publishedAt` on page 1; an answer with `history` keeps `-ctr`), beside the refusal cases at `:479-491` (the sort refusal carries the flag, the filter refusal does not), and one app test in `apps/web/src/app.test.ts` that answers the list with `api.failNext('GET <list route>', { status: 403, body: { error: 'sort_without_history' } })` (helper at `apps/web/src/fake-api.ts:402`) on `?sort=-ctr` and reads the list newest first with `-ctr` gone from the address.
- **Must preserve:** `routeAfterListAnswerOf`'s source-sort rule and its page clamp, which runs only when no sort was rewritten (the existing `routeAfterListAnswerOf` tests in `video-list.test.ts`); the `sort_without_history` text and its test (it still reaches the detail screen's stepper through `VideoDetail.tsx:476`); the `filter_without_history` refusal and its clearable controls (`app.test.ts:3481`, `:3493`); a Pro channel's CTR sort, untouched since its answer carries `history`. The fallback navigates directly, never through `changeControl`, so it sends no `video_sort_changed` and no `repackaging_view_opened`.
- **Failure of the fix:** the fallback route can itself be refused (a free channel with `trafficSource` in the address answers `filter_without_history`); that refusal carries no `historySort`, so it shows, with its controls, and the list does not loop.
- **Do not touch:** `routeToChannel` keeping every list control (Reviewed and Dismissed, "route transitions keep both filters"): the fallback, not the channel switch, is the fix, so a switch between two Pro channels keeps the CTR sort.
- **Proof:** `pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts` from the repo root: red now on both tests, green after.

### 3. A typo in the minimum field clears the minimum instead of putting it back — LOW

- **Location:** `apps/web/src/VideoList.tsx:131-135` (`commit`)
- **Found by:** Claude
- **Attribution:** introduced in `e01cfbf7`; the #944 lane recorded it as LOW (F3.20, F4.23), unchanged.
- **Real-world trigger:** with 500 in force, the creator types `500-` or `1e` and tabs away. A `type="number"` input answers `value` as `''` for text it cannot parse (HTML's value sanitization), so `minImpressionsChangeOf('')` reads an empty field and clears the minimum. Assumption 32 of #944 says a bad value puts the minimum in force back. The list shows more videos; no number is wrong, so LOW.

**Evidence** —

```ts
  function commit(field: HTMLInputElement) {
    const change = minImpressionsChangeOf(field.value)
    if (change === null) field.value = committed
```

**Failure mode** — unparseable text → `field.value === ''` → `{ minImpressions: undefined }` → the minimum is cleared and the list reads again.

**Recommended fix** —

```diff
-    const change = minImpressionsChangeOf(field.value)
+    const change = field.validity.badInput ? null : minImpressionsChangeOf(field.value)
```

**Remediation brief**
- **Design intent:** as finding 1: only a whole number from 1 or an empty field commits; anything else puts back the minimum in force.
- **Full surface:** `apps/web/src/VideoList.tsx:131-135`. Apply after finding 1, which changes the same component.
- **Must preserve:** an empty field still clears (`app.test.ts:3493`); `minImpressionsChangeOf` unchanged.
- **Do not touch:** `minImpressionsChangeOf` itself, which is correct for the text it is given.
- **Proof:** an app test in the describe at `apps/web/src/app.test.ts:3452` that sets the field's value to text it cannot parse and blurs. happy-dom may not model `badInput`; if it does not, the test file says so and names the human step (type `500-` in the field in Chrome and tab away; the minimum stays).

### 4. A minimum of 16 or more digits changes value on its way to the address — LOW

- **Location:** `apps/web/src/route.ts:166-167` (`minImpressionsOfText`), `apps/web/src/video-list.ts:692-698` (`minImpressionsChangeOf`), `apps/web/src/route.ts:258` (`searchOf`)
- **Found by:** Claude
- **Attribution:** introduced in `e01cfbf7`. The lane recorded the 22-digit exponent case as LOW (F4.14); this review adds the 16 to 21 digit case: `Number('9007199254740993')` is `9007199254740992` and `Number('12345678901234567890')` is `12345678901234567000`, so the address is rewritten to a number the creator did not type rather than refused.
- **Real-world trigger:** none plausible: nobody's channel has a video near 10^15 impressions. LOW, capped.

**Evidence** — `return text !== null && /^[1-9]\d*$/.test(text) ? Number(text) : undefined` (and the same regex in `minImpressionsChangeOf` and at `route.ts:189`).

**Failure mode** — 16 to 21 digits round silently; 22 or more serialise as `1e+21`, which the API refuses with `invalid_min_impressions`.

**Recommended fix** — one exported helper in `route.ts`, `wholeMinimumOf(text: string): number | undefined` returning `/^[1-9]\d{0,14}$/.test(text) ? Number(text) : undefined`, used by `minImpressionsOfText` and `minImpressionsChangeOf`.

**Remediation brief**
- **Design intent:** the minimum the address carries is exactly the number the creator typed, and the API accepts it.
- **Full surface:** `apps/web/src/route.ts:166-167`, `apps/web/src/video-list.ts:692-698`. Leave `route.ts:189` (the page) alone unless the same commit names it as a refactor.
- **Must preserve:** the bad-value table at `apps/web/src/route.test.ts:285` and the round-trip at `:263`; `minImpressionsChangeOf`'s tests at `video-list.test.ts:919`, `:924`.
- **Do not touch:** the API's `wholeNumberOf` (called at `apps/api/src/routes/videos.ts:86-87`), which accepts any length and is shared with the page.
- **Proof:** a `route.test.ts` case: `listRouteOf('?minImpressions=9007199254740993')` has no `minImpressions`, red now.

### 5. Two tests compare the traffic source list with itself — LOW

- **Location:** `apps/api/src/video-history.test.ts:114-122`, `apps/web/src/traffic-sources.test.ts:106-128`, `:136`
- **Found by:** Claude
- **Attribution:** introduced in `e01cfbf7`. The lane recorded the web half as LOW (F4.19, F4.20); the API half is new.
- **Real-world trigger:** a later change adds a code to `analyticsTypeOfCode` (`apps/api/src/video-history.ts:27`) without adding its type to `reachTrafficSourceTypes`: the API test stays green, because it maps a hard-coded copy of the codes, and that type counts in "All sources" but cannot be chosen. No user meets it until then, so LOW.

**Evidence** —

```ts
    const mapped = [0, 1, 3, 4, 5, 7, 8, 9, 11, 14, 17, 19, 20, 24, 25, 26, 27, 28, 30]
    const named = [18, 23, 29, 31, 32]
    expect([...mapped, ...named].map(trafficSourceTypeOf).toSorted()).toEqual(
```

and in `traffic-sources.test.ts`, `expect(labelOf(type)).toBe(bar?.name)` and `expect(trafficSourceNameOf(type)).toBe(bar?.name)` (`:115-116`), where both sides are `trafficSourceNameOf(type)`; `:123-124` compares the options' values with `reachTrafficSourceTypes`, the list they are mapped from; `:127` sorts with the production comparator.

**Failure mode** — tests-can-go-red, "the expectation comes from the code under test": the identity assertions cannot fail; only the literals at `:110-112` and `:129-133` can. `:136` repeats the rule the test at `:29` already covers (tests-state-a-rule, one rule one test).

**Recommended fix** — API: export the map's codes from `video-history.ts` (`export const storedTrafficSourceCodes = [...analyticsTypeOfCode.keys()]`) and map those plus `named` in the test. Web: drop the two identity assertions in the loop and the sorted-values comparison, keep the literal labels, assert the count of options (25) and that values are unique, and delete the test at `:136`.

**Remediation brief**
- **Design intent:** `reachTrafficSourceTypes` is the list the filter offers and the API accepts; it must equal every type a stored code maps onto plus the five named `REPORTING_<code>` types (assumption 12 of #944).
- **Full surface:** `apps/api/src/video-history.ts:27-51`, `apps/api/src/video-history.test.ts:114-122`, `apps/web/src/traffic-sources.test.ts:106-136`.
- **Must preserve:** the literal name checks at `traffic-sources.test.ts:110-112` and the first-three order check at `:129-133`; the test at `:29`.
- **Do not touch:** `trafficSourceOptions` itself.
- **Proof:** in a scratch worktree, add `[21, 'NO_LINK_EMBEDDED']` to `analyticsTypeOfCode`: the rewritten API test goes red, the current one stays green.

### 6. New tests pin drafted copy word for word, which #945 asks for and the global rule forbids — LOW

- **Location:** `apps/web/src/upgrade.test.ts:150-165`, `apps/site/test/site.test.ts:1342-1359`, `:1398-1417` (asked for by #945); `apps/web/src/app.test.ts:9030-9072`, `apps/web/src/video-list.test.ts:482`, `:489`, `:1005`, `:1423`, `apps/web/src/traffic-sources.test.ts:103`, `:110-112` (not asked for)
- **Found by:** Claude
- **Attribution:** introduced in `e8e22238`, `e01cfbf7` and `4692e0c0`; the #945 lane recorded the first group as LOW F1.1.
- **Real-world trigger:** none for users. When Nick edits the drafts on the PR, every pin fails though no code broke. No user path, so LOW.

**Evidence** — `upgrade.test.ts:160`: `title: 'Repackaging view', lines: ['Sort your video list by click-through rate or impressions, …']`; `video-list.test.ts:482`: `message: 'Sorting by impressions or CTR needs Stillstats Pro.'`.

**Failure mode** — tests-state-a-rule: "No test asserts that fixed copy is present … Write no new one." #945's acceptance criterion 3 says "`upgrade.test.ts` and `site.test.ts` pin the new copy." The two disagree; the rule is Nick's own, and so is the AC.

**Recommended fix** — Nick decides at the PR. If the rule wins: keep the placement rules inside these tests (the card key order `['reach', 'comparisons', 'repackaging', 'history', 'next']`, the item and sentence positions beside their neighbours) and drop the word-for-word strings. For the tests outside the AC: the refusal tests observe the branch by asserting the message differs from the generic `Reading the videos failed: <code>`; the empty-list tests keep the locale rule (`1,500`) and drop the sentence; the traffic source label literals at `:110-112` stay as the only non-identity check of finding 5 unless replaced.

**Remediation brief**
- **Design intent:** copy is held by Nick's word-for-word approval on the epic's PR, not by the suite; tests keep the rules over copy (order, placement, no em-dash, a branch observed through its text).
- **Full surface:** the locations above.
- **Must preserve:** `upgrade.test.ts:167` (no feature card holds an em-dash) and `site.test.ts:339` (no site page contains an em-dash); the order assertions.
- **Do not touch:** the copy itself until Nick approves it.
- **Proof:** none; a decision.
- **Remediation scope note:** skip in an unattended remediation pass; this waits on Nick's decision on the PR.

### 7. The free-channel focus tests answer a request the real API refuses — LOW

- **Location:** `apps/web/src/app.test.ts:3481-3507`
- **Found by:** Claude
- **Attribution:** introduced in `a4a99fd8` ("creator-analytics#944 review pass 3 finding 1: …").
- **Real-world trigger:** the tests open `?trafficSource=YT_SEARCH` and `?minImpressions=500` on a free channel, and the fake API answers 200 without the history; the real API answers 403 `filter_without_history`, so the cold-load bookmark path these tests name is never run. By reading, the refused path hides the filters the same way (`historyFiltersShownOf` with no answer, no memo, `paid` false), so no user failure is known. LOW.

**Evidence** — `installFakeApi()` then `render('?trafficSource=YT_SEARCH')`, with no `api.failNext`.

**Failure mode** — a regression in how a refused read shows the filters would leave these tests green.

**Recommended fix** — in each test, `api.failNext('<the list route>', { status: 403, body: { error: 'filter_without_history' } })` before `render`, and keep the assertions.

**Remediation brief**
- **Design intent:** a free channel whose address carries a filter sees the refusal and the controls to clear it; clearing the last one moves focus to "Videos per page".
- **Full surface:** `apps/web/src/app.test.ts:3481-3507`; `failNext` at `apps/web/src/fake-api.ts:402`.
- **Must preserve:** both tests' assertions; they are review pass 3 finding 1's proof.
- **Do not touch:** the production code.
- **Proof:** the two tests stay green with the 403 staged; remove the rescue at `VideoList.tsx:598-606` in a scratch worktree and both go red.

### 8. Comment hygiene — LOW (aggregated)

- `apps/web/src/route.ts:459-460` — "the same channel, window, sort, format, page, chart mode, chart card, page size and visibility" → add "traffic source and minimum impressions" (found by: Claude)
- `packages/api-types/src/videos.ts:243-247` and `:252-257`, and `apps/api/src/video-list.ts:457-458` — "the API refuses it with `filter_without_history` for any other channel" → add "or with `sort_without_history` when the request also sorts by impressions or CTR" (found by: Claude)
- `packages/api-types/src/videos.ts:244` — "every other number is untouched" → "every other number is untouched, the newest history average included, which counts every source" (found by: Claude)
- `CONTEXT.md:201` and the `ids` JSDoc in `packages/api-types/src/videos.ts` (the `ids?: string` member) and `apps/api/src/video-list.ts:86-91` — "window, format and sort still apply" → "window, format, sort and a minimum of impressions still apply" (found by: Claude)
- `apps/web/src/video-list.ts:874-880` — "so the controls row holds still while the read lands and a refused filter can be undone" → "so the controls row holds still while the read lands, except for a paid channel whose history holds no day, whose first answer takes them away" (the "refused filter can be undone" clause is the paid fallback's no longer: the address rule above it does that; lane F4.12) (found by: Claude)
- `apps/web/src/VideoList.tsx:621` — `{/* For a channel whose history is readable, and wherever the address sets one to clear. */}` → delete; it restates `historyFiltersShownOf`'s JSDoc (found by: Claude)
- `apps/web/src/upgrade.ts:45-47` — "Approved word for word in creator-analytics#913, but the Repackaging view card, drafted for creator-analytics#945." → "Approved word for word in creator-analytics#913, except the Repackaging view card, drafted for creator-analytics#945." (found by: Claude)

## Needs Further Investigation

### A. The controls row still moves on a slow entitlements read and on an ended channel's first load — a throttled browser session would confirm it
- **Found by:** Claude
- The #944 lane's deferred F4.2 and F4.3. `paid={channelPaidOf(entitlements, shownChannelId)}` (`apps/web/src/App.tsx:868`) is false until `/api/me/entitlements` lands, and `EntitlementsAnswer` carries no purge date, so an ended channel before its purge date reads as not paid. To confirm: on a Pro channel and an ended one, at 375px and 1280px, delay `/api/me/entitlements` in devtools and watch whether the traffic source select and minimum field appear between "Videos per page" and the visibility switch after the list lands. MEDIUM if confirmed (layout shift, no wrong number).

### B. A blur fired as the focused input is removed may commit twice — moot once finding 1 lands
- **Found by:** Claude
- happy-dom fires no blur on removal; whether Chrome delivers one to the old fiber is unverified. The worst case is a redundant `replaceState` (`historyMoveOf`, `apps/web/src/route.ts:552-558`, replaces when the route is on view). Finding 1's fix removes the removal.

### C. The minimum hides a partial video by its partial impressions — Nick's call
- **Found by:** Claude
- In `lifetime`, or any window that starts before the stored history, a video's impressions cover only the held days, and `apps/api/src/video-list.ts:595-601` compares them with the minimum as if whole, though the sort puts the same partial videos last for covering fewer days. The recorded assumptions (16 to 19 of #944) do not cover partial rows. Either state it in the `minImpressions` JSDoc or keep partial rows in, as rows with no `history` are kept.

### D. An address that already carries a history sort sends no `repackaging_view_opened` — Nick's call
- **Found by:** Claude
- A bookmarked `?sort=-ctr` page sends nothing; a later click on that heading sends the event as the first step. Assumption 9 of #943 chose clicks only. Whether a loaded address counts as "applies" is a product question for the OpenPanel review on the PR.

### E. The traffic source select's width with long names at 375px
- **Found by:** Claude
- `.controls` wraps (`apps/web/src/app.css:830`); happy-dom cannot measure the select with "Direct or unknown sources". Check in the browser at 375px.

## Reviewed and Dismissed

- The Studio extension's answer changes — every changed branch in `listVideos` is gated on `trafficSource`, `minImpressions` or a history sort key, none of which the extension sends (found by: Claude)
- The history refusal could answer 403 to a non-member — it sits after the uploads read, which answers `not_connected` first; `entitlementOf` answers `free` for a non-member under RLS, so the order matters and is right (found by: Claude)
- The per-source CTR is unweighted — `reachOfSources` sums clicks (`impressions * ctr` in SQL) over impressions after the filter, and answers null at zero impressions (found by: Claude)
- Route transitions drop the filters — `routeWithControl`, `routeWithDetailWindow`, `routeToList`, `routeToVideo`, `routeToChannel`, `routeWithFallbackWindow` all keep both; the detail stepper reads `videoListQueryOf({...listRoute})`, so stepping follows the filtered order (found by: Claude)
- A free channel sees a sortable CTR heading — the two columns are `history: true` and drop when the answer carries no history; a refused read renders no table (found by: Claude)
- Sort resets fire `repackaging_view_opened` — `toggleColumn`, `hideSourcesOn` and `routeAfterListAnswerOf` navigate directly, never through `changeControl` (found by: Claude)
- `HistoryFilters`' layout-effect cleanup sets the flag spuriously — its dependencies are `[leftFocused]`, a stable ref, so it runs only on unmount (and StrictMode's simulated one, with nothing focused) (found by: Claude)
- `answeredHistory` leaks across channels — it is keyed on the channel id (found by: Claude)
- A traffic source option shows a raw code — all 24 types have a name in `trafficSourceNames` (found by: Claude)
- Shipped copy holds an em-dash — none in any added line (found by: Claude)
- `video-history.test.ts:1086` ("a paid channel whose history holds no day yet hides no video for the minimum") passes at base and is vacuous — it is green at base only because base ignores the parameter; on the branch it guards assumption 19 and goes red for a mutant that reads a missing `impressions` as 0. Keep (found by: Claude)
- `route.test.ts:285` and `:315`, green at base — base drops unknown keys and spreads the route, so they pass trivially there; on the branch they pin the rejection rules and the destructuring in `routeWithControl`. Keep (found by: Claude)

## Minor / nits

- `apps/site/test/site.test.ts:1358` and `:1416` assert no em-dash over a subset that `site.test.ts:339` already covers; one rule, one test (#945 lane F1.2) (found by: Claude)
- `apps/web/src/upgrade.test.ts:167` passes at base; it is the web's only em-dash rule over `upgradeFeatures`, so keep it (found by: Claude)
- The upgrade card's line is an imperative ("Sort your video list …") beside two noun-phrase cards; a matching draft for Nick: "Your video list sorted by click-through rate or impressions, for all traffic sources or just one, without videos under a minimum number of impressions." (found by: Claude)
- `apps/web/src/video-list.test.ts` around `:860` and `:891`: `Object.keys(event ?? {}).sort()` after a `toEqual` that already fails on any defined extra key; it matches the custom-range precedent at `:949` (found by: Claude)
- Nothing pins `not_connected` ahead of the two new 403s; a case with a non-member sending `sort=ctr&trafficSource=YT_SEARCH` would (found by: Claude)
- "Suggested videos" (`RELATED_VIDEO`) and "Related video" (`REPORTING_32`), and "Playlists" and "Playlist pages", now sit side by side in one select; approved names, so Nick's call (found by: Claude)
- The lanes' open LOWs, not re-raised: a free channel's source pick sends `repackaging_view_opened`; `repackaging_view_opened` also goes for an ended channel; a history sort reads the entitlement twice; the whole-number regex three times (finding 4 removes one); `trafficSource` and `minImpressions` travel together through about nine places; the new `ListControl` members break the `Pick<Route>` shape; `can-upgrade.ts` answers a layout question; `channelPaidOf` repeats `canUpgradeOf`'s lookup; the module-level memo no test resets; the Impressions and CTR columns mount on the answer; the focus-fell-to-page check written three times; `HistoryFilters` writes the parent's ref where `VideoStepper` takes an `onGone` callback; the screenshot stub API's sort; no API test sorts by impressions with a source; five cards lay out 2, 2 and 1; the drafted copy does not name the columns' change (found by: Claude)

## Test quality

Tests added or changed: 79 · red at `$BASE`: 67 · green at `$BASE`: 12 · tautology shapes found: 4 of "expectation from the code under test" (finding 5, and `route.test.ts:295`, which builds `{ ...route, ...change, page: 1 }` as production does but is red at base, so borderline) and about 12 copy pins (finding 6). No mocked unit, no call-shaped assertion, no snapshot, no assertion-free test, no markup-instead-of-effect.

Green at base, per test: `video-history.test.ts:1086` and `video-list.test.ts:1430` (negative guards of assumptions 19 and 33: keep); `route.test.ts:285` (7 cases) and `:315` (pin the parse rules and the destructuring: keep); `upgrade.test.ts:167` (the em-dash rule: keep); `video-list.test.ts:943` (changed only for the nullable type: unchanged behaviour). None was added by a review fix's commit. Red only for a missing export but asserting unchanged behaviour: `traffic-sources.test.ts:136` (stubbed at base, passes; it duplicates `:29`, delete per finding 5).

## Before opening the PR

- **CI readiness:** lint, typecheck, build and `pnpm test` green at `a5a8a81c`; the browser walk green. The repro files under `docs/reviews/creator-analytics-934/repro/` pass `pnpm exec biome check`.
- **Commit hygiene:** commit this doc and its `repro/` folder. Nothing else is uncommitted.
- **Likely reviewer asks:** the copy approvals the tickets reserve for the PR (#943 assumption 6, #944 assumptions 21, 23 and 24, #945's three drafts); the OpenPanel question for the two new controls (#944 assumption 26) and D above; finding 6's decision; the lanes' proposals in `.epic-loop/tickets/*/proposals.md`.

## Verdict

Not ready as-is. Gate: findings 1 and 2 (MEDIUM, both introduced) are fixed before the PR opens. Findings 3, 4, 5, 7 and 8 can ride the same remediation pass or ship as follow-ups; finding 6 waits on Nick's decision on the PR. Needs Further Investigation A wants a throttled browser check before the PR, since it would be MEDIUM if confirmed.

## Remediation — 2026-11-20

Scope: CRITICAL, HIGH and MEDIUM (findings 1 and 2). Findings 3, 4, 5, 7 and 8 (LOW) are deliberately deferred to Nick; finding 6 (LOW) waits on his decision on the PR, per its scope note.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `97fd33e2` creator-analytics#934 pre-PR review 1 finding 1: Pressing Enter with a new minimum drops keyboard focus to the page | red→green: `pnpm exec vitest run apps/web/src/app.test.ts -t 'keeps focus in the minimum field'` (red before the fix, `<body>` focused); `sh docs/reviews/creator-analytics-934/repro/min-field-enter-focus.sh <scratch>` green at `97fd33e2`. The address-reset pin ("a change of the minimum in the address puts the new minimum in the field") goes red with the layout effect removed (mutant in a scratch worktree) | 0 (the existing JSDoc corrected, as the brief asked) | fixed (disprove agent) |
| 2 (MEDIUM) | `97811171` creator-analytics#934 pre-PR review 1 finding 2: A CTR or impressions sort the list cannot show leaves no way to change the sort | red→green: `pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts` (both tests; see the repro note below) and the new tests in `apps/web/src/video-list.test.ts` (the sort refusal's mark, the two answer-without-history cases) and `apps/web/src/app.test.ts` describe "a CTR or impressions sort the list cannot show" (goes red with the answer handler's fallback removed, mutant in a scratch worktree) | 0 (two existing JSDocs corrected, as the brief asked) | fixed (disprove agent), with two gaps: rework below |
| 2 rework | `262b75be` creator-analytics#934 pre-PR review 1 finding 2 rework: Pin the history sort fallback's own failure, its replace and its silence | the new fallback-refused test goes red when the fallback drops the traffic source (mutant in a scratch worktree); the verifier's mutants also turned the history-length, track and read-count assertions red | 0 (one existing comment corrected) | fixed (scoped re-verify) |

Full checks at `262b75be` (production code as at `97811171`, plus one comment): `pnpm lint`, `pnpm typecheck` green; at `97811171`: `pnpm build` green, `pnpm test` green (215 files, 5430 passed, 1 expected fail), `pnpm run --if-present test:browser` green. After the rework, lint, typecheck and `app.test.ts` with `video-list.test.ts` (786 tests) green.

Repro note: `repro/history-sort-dead-end.test.ts`'s last line asserted the `sort_without_history` view is no longer kind `refused`. The brief's recommended fix and Full surface keep the kind (so `VideoDetail.tsx:476` lands it unchanged) and add an optional `historySort` mark, so that line now asserts the mark (`toMatchObject({ historySort: true })`), red at `a5a8a81c` and green at `97811171`. The rest of the repro is unchanged.

Verifier notes not acted on: the scoped re-verify suggested asserting the filter refusal's exact text in the fallback-refused test; that is a copy pin (tests-state-a-rule, and finding 6's open decision), and the read-count assertion already tells the two refusals apart. It also could not name a mutant that the traffic source select assertion alone catches; the alert and read-count assertions carry the goal.

### Known regressions, deferred
- None.

### Rework briefs
- Finding 2 rework. Achieve: the comment over the list's replace navigation (`apps/web/src/VideoList.tsx:533-534`) names the CTR or impressions sort the answer rule now rewrites; a committed test covers the fallback route itself refused (`?sort=-ctr&trafficSource=YT_SEARCH`, `sort_without_history` then `filter_without_history`: the address keeps the filter, the refusal shows with the select to clear, two reads, no loop); the refusal test pins the replace (history length unchanged) and that only `video_list_viewed` is tracked. Preserve: every production line of `97811171`. Proof: the describe "a CTR or impressions sort the list cannot show" green, and its new assertions red under mutants that push, track, drop the filter or loop.

### Approach decisions (remediation round 1)
- Minimum impressions field resync: applied as recorded above (the key dropped, a layout effect on the minimum in force writes the uncontrolled input's text; the ref prop narrowed to `RefObject<HTMLInputElement | null>`).
- A history sort the list cannot show: applied as recorded above. The `sort_without_history` view keeps kind `refused` and carries an optional `historySort: true` mark, so the video screen's stepper needs no change. The answer handler navigates only when `routeWithHistorySortOff` changes the route, mirroring the `routeAfterListAnswerOf` branch below it (`after !== currentRoute.current`), so a marked refusal with nothing to rewrite still shows rather than leaving the list loading. In `routeAfterListAnswerOf` the history rule runs after the source-sort rule and before the page clamp, which still runs only when no sort was rewritten.
