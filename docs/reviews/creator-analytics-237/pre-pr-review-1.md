# Pre-PR review: creator-analytics#237 Channel summary: upload markers

**Branch:** `creator-analytics-237-upload-markers` vs `origin/main` (merge-base `bb6e3b7ba8b80767b0528423238d40c8393b5dbf`, "Merge pull request #749 from nick-vogel/creator-analytics-569-feedback-form")
**Reviewed at:** HEAD `c87ee1622d79eb200ff8facc072b3d2cb50b12a1` (creator-analytics#283 Upload markers: join markers that overlap, the merge of the #283 lane) + 0 files with uncommitted changes, 0 untracked files, 27 files total, +1,897 / −75
**Reviewed against:** the epic body of creator-analytics#237 (the spec, re-scoped 2026-11-16), its open sub-issues #281 and #283 (#280 and #282 closed not planned), the epic-loop assumptions recorded for both tickets, `CODING_STANDARDS.md`, `CONTEXT.md`. Run with `--fresh`; no prior review docs exist for this epic.
**Date:** 2026-11-16
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 714 files) | green; this review's repro passes `biome check` |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing chunk size warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 175 files, 4,559 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 109 steps |
| Tautology audit | scratch worktree at `$BASE`, the branch's 6 new or modified test files copied in, run per test, and the 3 that fail on import re-run with the import stubbed | every new test red at base except 6 green; none of the 6 came from a review-finding commit (all from `b0ed6a14`). See Test quality |
| Finding 1 | `docs/reviews/creator-analytics-237/repro/mutation-probes.sh`, probes F1a and F1b, at `c87ee162` | both survived: the web suites stay green with the visibility left out of the summary read's deps, and with the read pinned to `public` |
| Finding 2 | `docs/reviews/creator-analytics-237/repro/tie-leftmost.case.ts` appended to `apps/web/src/upload-markers.test.ts` in a scratch worktree at `c87ee162` | red: `expected [ [ 'single', '2026-09-30' ], …(1) ] to deeply equal [ [ 'tile', '2026-09-30' ], …(1) ]`; days 3 and 4 joined, not 2 and 3. Finder B's property run: the right pair's float gap is strictly smaller in 484,683 of 1,997,001 equally spaced triples |
| Finding 3 | `mutation-probes.sh`, probes F3a and F3b | both survived: `apps/api/src/channel-summary.test.ts` (56 tests) stays green with the scheduled clause dropped, and with a failed content types read answered as no uploads |
| Finding 4 | mutant in a scratch worktree: `summaryRequestOf` returning a request in every window | the test goes red, but only on its `toContain('metric-charts-axis')` line; its `not.toContain('upload-markers')` line cannot go red, since the static markup never lands a summary view |
| Join algorithm (finder B, executed) | `placeOf` and `joinedOf` copied verbatim into a node script, 20,000 random cases | 0 cases with two neighbours under one width apart, 0 ordering or contiguity violations, always terminates |
| Marker x against the plots' x (finder B) | `metric-plot.ts:142` domain, `plot-definition.ts:34` margin, `.chart` and `.upload-markers` padding in `app.css` | match: `index / (n - 1)`, 0.5 for one day, the same 3rem start padding and no end padding on either, so the measured track is the plot's width |
| CSP of the `style` prop (finder B) | `apps/web/src/main.tsx` uses `createRoot`, no server render or hydrate in `apps/web/src` | React sets `left` through the CSSOM, which `style-src 'self'` allows; the walk saw no violation |
| Video list filter parity (finder A) | `uploadsPartOf` against `video-list.ts:473-477`, the moved `readEveryUpload` and `isOfFormat` | same lifetime range and cache keys, same format rule; visibility rule equal for unscheduled uploads (see finding 5) |
| Sample channel has no day of two uploads (finder A, executed) | node script over `apps/site/test/screenshot/sample-channel.ts` | 144 uploads, 0 days with two; the stub's comment claiming they meet every 18 days is false (finding 6) |
| Could not run | VoiceOver, a real resize while a marker holds focus | Nick's VoiceOver pass per the spec; see Needs Further Investigation B |

**Overall:** The branch meets the epic's spec. The API answers each window's uploads with the video list's own filters, refuses on a failed read, the marker row draws at the plots' x in every window, joins overlapping markers without ever leaving an overlap, and every full check including the browser walk is green. The review confirmed one MEDIUM and five LOW findings, none of them a defect a creator meets today except finding 2, which only changes which of two equally close markers joins. The MEDIUM is a coverage gap the spec asks for by name: nothing fails if the channel summary stops following the visibility switch. The branch is ready to open a PR once finding 1 has its test; findings 2 to 6 are cheap and can land in the same pass.

## Approach decisions
- Join ties: compare neighbour gaps in exact integer units (the sum of a group's first and last day index, which is twice its centre index), not in float places, so "the leftmost on a tie" and "exactly one width does not join" hold for every window. Precedent: the existing integer `index` on `MarkerPlace`, which every marker already carries.
- Visibility wiring proof: an App test over the fake API reading `api.requests` for the `/summary` path after the "Show unlisted and private" switch, as the video list's visibility test reads its list reads (`apps/web/src/app.test.ts:1608`).
- The visibility predicate: one exported privacy predicate shared by the list and the summary, as `isOfFormat` already is (`apps/api/src/video-format.ts:24`).

## Confirmed Issues
### 1. No test fails if the channel summary stops following the visibility switch — MEDIUM
- **Location:** `apps/web/src/ChannelSummaryFigures.tsx:192-201`
- **Attribution:** introduced in `b0ed6a14` (creator-analytics#281 Channel summary: upload markers): `git log -S'format, visibility, adsAndPremiumOnly' bb6e3b7b..HEAD` names only it.
- **Real-world trigger:** any later edit to this hand-kept deps array or to the `visibilityOf` call. A creator who turns "Show unlisted and private" on would then see markers for public uploads only, or stale markers from before the switch, with no error. MEDIUM, capped: wrong results silently delivered, but only after a regression; the code is correct today. The spec's user story 13 asks for exactly this test.

**Evidence**
```tsx
  const { saved } = usePreferences()
  // The uploads follow the video list's visibility switch, so a change of it reads again.
  const visibility = visibilityOf(route, saved)
  const summary = summaryRequestOf(route, visibility)
  ...
    [channelId, window, range?.from, range?.to, format, visibility, adsAndPremiumOnly],
```

**Failure mode** — Executed with `mutation-probes.sh`: removing `visibility` from the deps array (F1a), or replacing `visibilityOf(route, saved)` with `'public'` (F1b), leaves `app.test.ts`, `components.test.ts` and `channel-summary.test.ts` green (576 tests). `summaryRequestOf` and `summaryQueryOf` are unit-tested, but nothing drives the switch and observes the summary request. The fake API's `summaryOf` (`apps/web/src/fake-api.ts:101`) ignores the query, though `api.requests` records it.

**Recommended fix** — Add an App test inside `describe("the channel summary's upload markers")` in `apps/web/src/app.test.ts`:
```ts
  test('the summary reads the uploads of the visibility switch, and reads again when it changes', async () => {
    const api = markedApi()
    const { container } = await render()
    const summaryReads = () => api.requests.filter(({ path }) => path.endsWith('/summary'))

    expect(summaryReads().at(-1)?.query.get('visibility')).toBeNull()
    await click(switchNamed(container, 'Show unlisted and private'))

    expect(summaryReads().at(-1)?.query.get('visibility')).toBe('all')
  })
```
**Remediation brief**
- **Design intent:** The summary's numbers are the whole channel's whatever the visibility; only its `uploads` follow the video list's visibility switch. The web app sends `visibility=all` and omits `public` (the API reads absent as `public`). The switch's value comes from the route, then the saved preference (`visibilityOf`), and a change re-runs the summary read through `useViewInSavedCurrency`'s deps.
- **Full surface:** `apps/web/src/app.test.ts` (new test in the describe at `:2640`, using its `markedApi()` and the `switchNamed` helper used at `:1750`); no production change. Check that the summary path the app requests ends in `/summary` by reading `apps/web/src/channel-summary.ts` `readSummary` before relying on the filter.
- **Must preserve:** `apps/web/src/channel-summary.test.ts` "every format and public uploads leave the format and the visibility out" (public stays omitted); the video list's own visibility tests near `app.test.ts:1608`.
- **Do not touch:** the full-summary re-read on a switch change (Minor, item 1): it matches the RPM switch's precedent.
- **Proof:** `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir>` prints `F1a ... survived` and `F1b ... survived` at `c87ee162`, and `killed` for both after the test lands. Then `pnpm exec vitest run apps/web/src/app.test.ts` green.

### 2. Of equally close markers, the right pair can join instead of the leftmost — LOW
- **Location:** `apps/web/src/upload-markers.ts:104-128`
- **Attribution:** introduced in `f6660234` (creator-analytics#283 Upload markers: join markers that overlap): `git log -S'function joinedOf' bb6e3b7b..HEAD`.
- **Real-world trigger:** a 7-day window on a phone with uploads on three days in a row in mid-week: days 3 and 4 share a tile and day 2 stays single, where the recorded rule and the code's own comment say days 2 and 3 join. Every upload stays reachable, so no user path leads to a wrong number; LOW.

**Evidence**
```ts
      const apart = (b.place - a.place) * span
      if (apart < gap) {
        gap = apart
        closest = left
      }
  ...
      place: (a.first.place + b.last.place) / 2,
```

**Failure mode** — Places are `index / (n - 1)` floats, so two equal gaps differ by an ulp and the strict `<` prefers whichever rounds smaller. Executed: uploads on days 2, 3 and 4 of a 7-day week at span 5 (gaps of five sixths of a width, and a joined pair one and a quarter widths from the third) give `[single 09-30, tile 10-01]` instead of `[tile 09-30, single 10-02]`. The existing tie test (`upload-markers.test.ts:229`, days 0 to 2) passes because those floats happen to round in its favour, and the "exactly one width does not join" boundary it also asserts is exact only by the same luck.

**Recommended fix**
```diff
-function joinedOf(groups: MarkerGroup[], span: number): MarkerGroup[] {
+function joinedOf(groups: MarkerGroup[], span: number, count: number): MarkerGroup[] {
   const joined = [...groups]
+  const width = (2 * (count - 1)) / span
   for (;;) {
     let closest = -1
-    let gap = 1
+    let gap = width
     for (let left = 0; left + 1 < joined.length; left++) {
       const a = joined[left]
       const b = joined[left + 1]
       if (!a || !b) continue
-      const apart = (b.place - a.place) * span
+      const apart = b.first.index + b.last.index - (a.first.index + a.last.index)
       if (apart < gap) {
         gap = apart
         closest = left
       }
     }
     const a = joined[closest]
     const b = joined[closest + 1]
     if (!a || !b) return joined
     joined.splice(closest, 2, {
       first: a.first,
       last: b.last,
-      place: (a.first.place + b.last.place) / 2,
+      place: placeOf((a.first.index + b.last.index) / 2, count),
     })
   }
 }
```
and at the call site `(span ? joinedOf(groups, span, days.length) : groups)`. Update the JSDoc of `joinedOf` to say the gaps compare in day indexes, and of `MarkerGroup.place` if its wording changes.
**Remediation brief**
- **Design intent:** Day groups sit in place order. Repeatedly, the closest neighbouring pair whose centres sit less than one marker width apart joins, the leftmost on a tie, until none is that close; exactly one width apart does not join. A group's centre is the middle of its first and last day, so twice the centre index is the integer `first.index + last.index`, and one marker width in those units is `2 * (n - 1) / span`. Comparing integers makes equal gaps exactly equal.
- **Full surface:** `apps/web/src/upload-markers.ts:98-128` (`joinedOf` and its JSDoc), `:163` (the call), `:90-96` (`MarkerGroup`, unchanged shape); `apps/web/src/upload-markers.test.ts` (add the repro case, without its `repro:` prefix, beside the tie test at `:229`).
- **Must preserve:** a joined tile's place is the middle of its first and last day's places (`upload-markers.test.ts` asserts `place: 1 / 6` for days 0 to 2 of 7); the single-day window places its marker at 0.5 (`placeOf`, count 1: `joinedOf` sees one group and returns at once, since `width` is 0); the null or 0 span path that joins by day only (`span ?` at `:163`); every other test in `upload-markers.test.ts` and the joined-tile App test in `app.test.ts`.
- **Do not touch:** the join's termination and the re-centred tile's re-check (Reviewed and Dismissed, item 4).
- **Proof:** in a scratch worktree, `cat docs/reviews/creator-analytics-237/repro/tie-leftmost.case.ts >> apps/web/src/upload-markers.test.ts && pnpm exec vitest run apps/web/src/upload-markers.test.ts -t 'repro:'` is red at `c87ee162` and green after the fix. Then `pnpm exec vitest run apps/web/src/upload-markers.test.ts apps/web/src/app.test.ts` and `pnpm typecheck` green.

### 3. Two of the API's upload rules have no test that can fail — LOW
- **Location:** `apps/api/src/channel-summary.test.ts:488-523` and `:638-653`; the rules at `apps/api/src/channel-summary.ts:102` and `:107`
- **Attribution:** introduced in `b0ed6a14`.
- **Real-world trigger:** none today; the code is correct. A later edit dropping either rule would ship green: a scheduled upload whose day lands in the daily series would show as a marker under "all", or a failed content types read would answer a summary with no markers instead of refusing it. LOW.

**Evidence**
```ts
        {
          videoId: 'scheduled',
          title: 'A scheduled upload',
          scheduledFor: '2026-10-09T19:00:00Z',
        },
```
The test named "...and leaves out a scheduled upload..." reads `last7` (2026-09-28 to 10-04) at the default `public`, so this upload is excluded three ways: its day is after the window, the fake makes a scheduled upload `private` (`channel-data.ts:37`), and the visibility is public. The only failed-read test drops `/youtube/v3/playlistItems`, the uploads read; nothing fails the `videoContentTypes` read alone.

**Failure mode** — Executed with `mutation-probes.sh`: F3a (the `upload.scheduledFor === null &&` clause replaced by `true &&`) and F3b (`if (!contentTypes.ok) return { ok: true, uploads: [] }`) both leave the 56 tests of `channel-summary.test.ts` green.

**Recommended fix** — Two tests in `describe("seam 1: the channel summary's uploads")`: (a) with `visibility: 'all'` and an upload whose `scheduledFor` falls on a day inside the window, the summary's `uploads` leaves it out; rename the existing test to drop "a scheduled upload". (b) A summary whose content types read fails is refused: warm the totals, series and revenue entries with a first read, then make the content types query fail while the uploads read still answers, and expect the refusal the uploads read's failure gives.
**Remediation brief**
- **Design intent:** `uploadsPartOf` reads the uploads, then the content types of every upload over lifetime in the video list's batches (sharing its cache), and keeps each unscheduled upload whose publish day is a day of the daily series, of the format and visibility asked. Either read refused refuses the whole summary, as the summary's other reads do.
- **Full surface:** `apps/api/src/channel-summary.test.ts:488` (rename), a new test after `:523`, a new test after `:653`; the fake Google's failure helpers (`api.google.dropDataApi`, and `failAnalytics` used at `:1169` and `:1475`; read how they select a query before choosing one that fails only the content types call). No production change.
- **Must preserve:** every test in `channel-summary.test.ts`, the cold-cache and cache-window quota tests at `:1374` and `:1399` included.
- **Do not touch:** `readEveryUpload`, moved verbatim from `video-list.ts` and shared by the list.
- **Proof:** `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir>` prints `F3a ... survived` and `F3b ... survived` at `c87ee162`, and `killed` after the tests land. Then `pnpm exec vitest run apps/api/src/channel-summary.test.ts` green.

### 4. The after-publish markup test's own rule cannot go red — LOW
- **Location:** `apps/web/src/components.test.ts:1049-1054`
- **Attribution:** introduced in `b0ed6a14`.
- **Real-world trigger:** none for a user. It is a claim of coverage the suite does not have (CODING_STANDARDS.md rule 2: a test that passes whatever the code does, and a duplicate). LOW, since the real guard is covered elsewhere.

**Evidence**
```ts
  test("draws no upload marker row, as the launch chart takes the summary charts' place", () => {
    const markup = placeOf(first28, { kind: 'list', channelId: 'c-1', answer: launchList })

    expect(markup).toContain('metric-charts-axis')
    expect(markup).not.toContain('upload-markers')
  })
```

**Failure mode** — `placeOf` renders `ChannelSummaryFigures` as static markup, where the summary view starts null and only lands in an effect, and its input carries no uploads, so `upload-markers` can never appear. Executed: with `summaryRequestOf` returning a request in every window, this test goes red only on `toContain('metric-charts-axis')`, which the launch chart tests just above it already assert. The rule "no markers after publish" is held by `channel-summary.test.ts` "a window after publish reads no summary" and by `MetricCharts` drawing the row only when given `uploads`.

**Recommended fix** — Delete the test.
**Remediation brief**
- **Design intent:** In a window after publish, `summaryRequestOf` returns null, so no summary is read and the launch chart or the publish day top 10 takes the summary's place; the launch chart passes no `uploads` to `MetricCharts`, which then draws no row.
- **Full surface:** `apps/web/src/components.test.ts:1049-1054` only.
- **Must preserve:** the launch chart tests in the same describe (`under %s, shows the launch chart...`), and `components.test.ts` "no uploads in the window, or a screen that passes none, such as the video detail, draws no row", which observes `MetricCharts` without `uploads`.
- **Do not touch:** `channel-summary.test.ts` "a window after publish reads no summary" (green at base, but the rule's real guard).
- **Proof:** `pnpm exec vitest run apps/web/src/components.test.ts` green after the deletion.

### 5. The summary types the visibility rule again beside the list's — LOW
- **Location:** `apps/api/src/channel-summary.ts:110`, beside `apps/api/src/video-list.ts:77-79`
- **Attribution:** introduced in `b0ed6a14`: `git log -S"upload.privacy === 'public'" bb6e3b7b..HEAD`.
- **Real-world trigger:** a later change to what "public" admits (say, a new privacy status) made in one copy only would make the markers and the list disagree. No user path today; LOW. CODING_STANDARDS.md rule 3: the change already moved `isOfFormat` out for sharing and walked past its twin.

**Evidence**
```ts
      (visibility === 'all' || upload.privacy === 'public') &&
```
```ts
function isOfVisibility(video: VideoRow, visibility: Visibility): boolean {
  return video.scheduled || visibility === 'all' || video.privacy === 'public'
}
```

**Failure mode** — Two copies of one rule; equal today for every unscheduled upload.

**Recommended fix** — In `apps/api/src/video-format.ts` beside `isOfFormat`, or in `apps/api/src/uploads.ts`:
```ts
export function isOfPrivacy(privacy: VideoRow['privacy'], visibility: Visibility): boolean {
  return visibility === 'all' || privacy === 'public'
}
```
then `video.scheduled || isOfPrivacy(video.privacy, visibility)` in `isOfVisibility`, and `isOfPrivacy(upload.privacy, visibility)` in `uploadsPartOf`. Check that `Upload['privacy']` and `VideoRow['privacy']` are the same type before choosing the parameter type.
**Remediation brief**
- **Design intent:** The list and the summary admit the same uploads by privacy: public only, or every privacy under `all`. The list alone lets a scheduled video through whatever the visibility (its own scheduled setting decides); the summary never shows a scheduled upload.
- **Full surface:** `apps/api/src/video-list.ts:77-79`, `apps/api/src/channel-summary.ts:110` and its imports, the new export.
- **Must preserve:** the list's `video.scheduled ||` prefix and its call at `video-list.ts:476`; the summary's `upload.scheduledFor === null &&` clause. Pinned by `apps/api/src/video-list.test.ts` visibility tests and `channel-summary.test.ts:606`.
- **Do not touch:** `isOfFormat`, already shared.
- **Proof:** `pnpm exec vitest run apps/api/src/video-list.test.ts apps/api/src/channel-summary.test.ts` and `pnpm typecheck` green.

### 6. Comment hygiene — LOW (aggregated)
- `apps/site/test/screenshot/stub-api.ts:137-140` — "A video every 9 days and a Short every 6 meet every 18 days, so a window of 28 days or more holds a day of two uploads, which shows as a tile." → "Every sample upload publishes on a day of its own, so no day holds two uploads; a tile shows only where markers join by width." (finder A's script: 144 uploads, 0 shared days; `browser-walk.ts` already says so)
- `CONTEXT.md:135` (Visibility) — "It applies to the full list only." → "It applies to the full list and to the channel summary's uploads." and the closing sentence → "The channel summary's uploads, which the upload markers show, follow it too, never a scheduled upload, while the summary's numbers stay the whole channel's whatever it says."
- `apps/api/src/routes/channel-summary.ts:29-31` — "so a query with a repeat or a bad value of two is refused for the first the checks read" → "so of two repeats, or of two bad values, the first the checks read is refused; any repeat is refused before any bad value"
- `apps/web/src/UploadMarkers.tsx:158-162` — the JSDoc's second line runs past 100 columns ("...one tile, which a resize joins or splits again. The row is one Tab stop: the arrows move focus between markers, Home") → rewrap the block at 100 columns.
- `apps/web/src/channel-summary.ts:105-108` — the JSDoc wraps raggedly at "...which the upload markers show. Or a" → rewrap the paragraph.
- `apps/api/src/video-list.ts:252` — "What a publish time order reads of a video: its id and its publish time." repeats the `Pick` → delete the line.
- `apps/web/src/UploadMarkers.tsx:48` — "What each marker takes: its place in the row's Tab order and the row's key handling." restates the props → delete the line.

## Needs Further Investigation
### A. The browser walk's comment says no tile shows in its marker step, which may be false at 375px — measure the track width in the walk's last28 step at the phone width
`apps/site/test/screenshot/browser-walk.ts` (the marker row step, about `:5223-5229`): "Every sample upload publishes on a day of its own, so no tile shows here". Finder A estimated the 375px track at about 330px over 27 intervals, which puts the sample's uploads on 2026-09-28 and 09-29 about 12px apart, under the 20px marker width, so they would join. Unmeasured. The step's assertions still pass, since its `a, button` selector matches a tile too; only the comment is at stake. Confirm with a `getBoundingClientRect` of `.upload-markers-track` in that step, and if a tile shows, scope the comment to 1280px.

### B. Focus falls to the page when a resize joins or splits the focused marker — resize a window with a marker focused, in Chrome
`apps/web/src/UploadMarkers.tsx:222-224` keys a marker by its first day, and a resize that turns a single into a tile (or back) swaps the element type, so the focused element unmounts. Nothing restores focus. Needs a keyboard user to resize while focused; confirm in Chrome by focusing a marker, narrowing the window until it joins, and reading `document.activeElement`.

## Reviewed and Dismissed
- The summary's `uploads` filters differently from the video list — dismissed: same lifetime range and cache keys (`rangeOf('lifetime', reportingDayOf(tx.now), createdAt, processedThrough)`), same `formatOf` and shared `isOfFormat`, list filter at `video-list.ts:473-477` unchanged.
- Marker x misaligned with the plots — dismissed: domain `[0, max(1, n - 1)]` or `[-1, 1]` for one day (`metric-plot.ts:142`), plot margin 0, and the same 3rem start padding on `.chart` and `.upload-markers`; the walk checks the place.
- The `style` `left` breaks the content security policy — dismissed: the app is client-rendered (`createRoot`), React sets it through the CSSOM, the charts already do the same, and the walk saw no violation in 109 steps.
- The join leaves an overlap after re-centring a tile, or fails to terminate — dismissed: each pass removes one group and the loop re-checks every pair; 20,000 random cases, 0 overlaps or ordering faults.
- A marker at the right edge spills past the page on a phone — dismissed: the walk asserts every marker inside the window at 375px and passed.
- Green at base: the cache-window quota test, "a bad format and a bad visibility together", "every format and public uploads leave the format and the visibility out", "a window after publish reads no summary" — dismissed as tautologies: each states a rule that a wrong branch implementation would break (a summary missing the cache, visibility checked before format, `public` sent, a summary read after publish).
- `channel-summary.ts` imports `newestFirst` from `video-list.ts` — dismissed: no cycle (`video-list.ts` does not import `channel-summary.ts`).
- The roving Tab stop after the markers change — dismissed as a defect: `Math.min(focused, markers.length - 1)` keeps the Tab stop on a marker that exists.

## Minor / nits
1. Turning the visibility switch now blanks the whole summary to its placeholder and reads it again (`useViewInSavedCurrency` sets the view to null on each deps change, `preferences.ts:306`), though only `uploads` depends on it. The RPM switch already does the same, so this follows precedent.
2. The roving Tab stop remembers a position, not a marker: after a window change or a resize join, Tab can land on a different marker from the last one focused.
3. A tile (1.125rem) sits at `top: 0` in a 1.25rem row, about 1px above the single shapes' centre.
4. `components.test.ts` "each marker sits at its day ... and draws in the one token class" asserts the class string `text-muted-foreground`. The spec names the token class as the mechanism, so the rule is real, but the assertion is on a class string.
5. Home, End and Escape are covered only by the pure `markerKeyStepOf` tests and Base UI's defaults; the App tests cover the arrows, a click and Enter on a tile, which is what #281's criteria ask.
6. The Analytics cost tests named "costs one Analytics unit for each of its three queries" and its siblings (`channel-summary.test.ts` about `:1337`) hold only because their channel has no uploads; a cold summary of a channel with uploads now costs one more unit per batch of uploads.
7. In the visibility test, `all.body.engagedViews === unset.body.engagedViews` compares a cached read with the first, so it would pass even if the totals read took the visibility.

## Test quality
Tests added or modified: 6 files. Every new test is red at `$BASE`, except 6 green: the cache-window quota test, "a bad format and a bad visibility together", "every format and public uploads leave the format and the visibility out", "a window after publish reads no summary" (all four state a rule the branch could break; see Reviewed and Dismissed), "no uploads in the window, or a screen that passes none" (a real negative case on the branch, since its siblings draw the row through the same `chartsWith`), and "draws no upload marker row, as the launch chart takes the summary charts' place" (finding 4, delete). None of the 6 came from a review-finding commit; the two review-pass commits (`4cdfde78`, `700350d7`) left tests that are red at base. Tautology shapes: none mocks the unit under test, none is call-shaped only, assertion-free, or a copy test. The expectation built with `uploadTextOf` (`upload-markers.test.ts:102`) is backed by that function's own literal table at `:38-46`. Mutation probes found three rules no test holds (findings 1 and 3).

## Before opening the PR
- **CI readiness:** lint, typecheck, build and test green at `c87ee162`; the browser walk green.
- **Commit hygiene:** the branch has two commits with the subject "creator-analytics#283 Upload markers: join markers that overlap", the lane's commit `f6660234` and its merge `c87ee162`; that is the epic-loop's local-merge shape, nothing to drop. This doc and `repro/` are the only additions.
- **Likely reviewer asks:** the extra Data API and Analytics cost of a cold summary (the uploads read, now four Data API calls cold, and one Analytics unit per batch of uploads); the sample channel having no day of two uploads, so the walk never shows a one-day tile (the #281 assumptions record a proposal for it).

## Verdict
Ready to open a PR with follow-ups. The gate is finding 1, a test the spec asks for by name; findings 2 to 6 are small and can ride in the same remediation pass, or ship as follow-ups. No CRITICAL or HIGH findings.

## Remediation — 2026-11-16
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `03c09309` creator-analytics#237 pre-PR review 1 finding 1: no test fails if the channel summary stops following the visibility switch | mutants red→killed: `sh docs/reviews/creator-analytics-237/repro/mutation-probes.sh <scratch dir> HEAD` prints `F1a ... killed` and `F1b ... killed` at `03c09309` (both `survived` at `c87ee162`); `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/channel-summary.test.ts` green (437 tests); `pnpm typecheck` and `pnpm lint` green | 0 | proved by execution (test-only, no production change) |
| 2 (LOW) | — deferred | — | — | LOW tail, not worked this round (eng-pipeline#34) |
| 3 (LOW) | — deferred | the same probe run at `03c09309` still prints `F3a ... survived` and `F3b ... survived` | — | LOW tail, not worked this round |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 6 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked this round |

The new test follows the recorded Approach decision "Visibility wiring proof" (an App test over the fake API reading `api.requests` for the `/summary` path after the "Show unlisted and private" switch); no new approach decisions this round.

### Known regressions, deferred
- None.

### Rework briefs
- None: no verify agent ran, since the one fix is MEDIUM, test-only, and proved by execution.
