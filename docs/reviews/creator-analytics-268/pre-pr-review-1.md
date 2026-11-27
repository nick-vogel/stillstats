# Pre-PR review: creator-analytics#268 Channel audience screen

**Branch:** `creator-analytics-268-channel-audience-screen` vs `origin/main` (merge-base `b10c8d4` "Merge pull request #309 from nick-vogel/creator-analytics-253-marketing-site-seo")
**Reviewed at:** HEAD `3bdcf06` ("creator-analytics#278 Audience: devices, operating systems, and subscribers"). The tree was clean, with no uncommitted or untracked files at review time. 76 files, +3,944 / −462 against the merge-base. The branch carries all seven children: #192 (`4d4ae4c`, `c20702b`), #275 (`c9c2be4`), #274 (`96d0c48`, `686830c`), #179 (`1f45940`, `2a27ab4`), #277 (`a5e427b`), #276 (`ae905b7`, `f51da4f`, `7e9c2e5`) and #278 (`61678e9`), each with its lane merge.
**Reviewed against:** the epic body of creator-analytics#268 (End state, Implementation Decisions and Testing Decisions are the spec), the bodies of #192, #274, #179, #275, #276, #277 and #278, `CODING_STANDARDS.md` 1 to 3, `CONTEXT.md`, the assumptions the loop recorded for each ticket. No prior review doc for this epic. A full review (`--fresh`).
**Date:** 2026-10-20
**Reviewer:** 3 code-review agents, 1 test-oracle agent, and a verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 510 files) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Build | `pnpm build` | pass |
| Full suite | `pnpm test` (Docker up, Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 115 files, 2,574 passed, 1 expected fail |
| Google queries against the spec | each gateway read in `packages/youtube-gateway/src/reads/channel-*.ts` read against the epic's query list | all eight match: dimensions, metrics, `country==US`, `sort=-views`, `maxResults=250`; the format filter goes to every read but US states and cities (`apps/api/src/audience.ts:45-61` passes `range`, not `request`, to those two) |
| Cache keys | `channelRangeKeyOf` (`packages/youtube-gateway/src/reads/channel-metrics.ts:42-48`) and the eight read names | the format is in the key, the names are distinct, US states and cities carry no format. No collision. |
| Refusal parity with the channel summary | traced `channelQueryOf`, `channelRangeOf`, `answerFailedRead` and `gateway.read` | shared code, so quota, consent, a failed read, a window after publish and a custom range out of bounds refuse as the summary does. Only three of them are tested: finding 4. |
| Per-video countries (#192) | `git grep` for the old read, report, catalogue entry and answer field | gone from the gateway, the fake, the API, the types and the web app |
| Approved copy | every heading, Other label, note, empty state, age, gender, device and OS name compared with the epic; the consent paragraph and the Privacy Policy clause compared with #275 character for character | all match. Two strings ship with no approval: finding 2 (`Unknown state`) and finding 3 (Google's `OTHER` shown as "Other"). |
| Em-dashes in shipped strings | grep of added lines | none |
| OpenPanel | grep for `track(` in the added lines | no new event |
| Google's Dimensions page (rung 3, developers.google.com/youtube/analytics/dimensions, fetched 2026-10-20) | `deviceType` and `operatingSystem` lists | `AUTOMOTIVE` and `WEARABLE` are listed, so the comment naming them is right; `OTHER` is a listed OS value (finding 3) |
| Sidebar-less signed-in screen at desktop width | executed repro in headless Chrome over the built stylesheet | the screen is 144px wide, the 9rem sidebar column. Finding 1. The `:has(> .sidebar)` fix measured green in the same harness. |
| Tests green at `$BASE` | scratch worktree at `b10c8d4`, the 16 changed test files copied in, stubs for the new modules where a file failed to import, verbose run | about 125 new or changed cases; 17 green at base. 13 are legitimate (boundary negatives, preserved behaviour after a move). 4 are vacuous or cannot go red: finding 6. |
| Audience screen with a channel going back to null | traced `App.tsx:215-228`: `setChannels` only ever sets a list, preferences are never unread again | unreachable. Dismissed. |
| Browser-only behaviour | not run | real widths at 375px and desktop, focus, a screen reader on the bars. Nick's browser walk (#278's acceptance criterion) covers it. |

**Overall:** Every End state item is implemented, all four CI checks pass, and the eight Google queries, the refusals and the cache keys hold. One MEDIUM: from the tablet width up, a signed-in screen with no sidebar (the no-channel screen a creator sees before connecting, and the profile without a channel) is squeezed into the 9rem sidebar column. Two LOW findings are copy decisions for Nick. The rest are test and duplication cleanups. Fix finding 1 before the PR opens; the rest can follow in this branch or as tickets.

## Approach decisions
- The sidebar's grid (finding 1): the two-column template applies only when the shell holds a sidebar, with the `:has()` selector the stylesheet already uses (`apps/web/src/app.css:1624`, `.numbers-table table:has(tfoot)`). No modifier class in `App.tsx`, so the markup and its tests stay as they are.
- Copy with no approval (findings 2 and 3) is Nick's decision, recorded in the doc and not fixed by remediation. Remediation changes only the comment once Nick has answered.
- Test gaps are closed with a test in the existing describe for their rule, never with a production change, and each new test must go red under the mutation its finding names.
- Duplication inside the branch's own new code (finding 5) folds into the helper the branch already made (`channelBreakdownRead`, `channelBreakdownReport`, `TopBarsSection`, `byMostEngagedViews`). Duplication in modules the branch does not touch (`apps/web/src/traffic-sources.ts`) becomes a follow-up ticket.

## Confirmed Issues

### 1. From the tablet width up, a signed-in screen without the sidebar is squeezed into the 9rem sidebar column — MEDIUM
- **Location:** `apps/web/src/app.css:1674-1678` (the `@media (min-width: 48rem)` rule for `.signed-in-shell`), with `apps/web/src/App.tsx:227` and `:415-416`
- **Attribution:** introduced. `git log -S'grid-template-columns: 9rem' b10c8d4..HEAD` names only `96d0c48` ("creator-analytics#274 Sidebar: Videos and Audience"). At `$BASE` there is no shell grid.
- **Real-world trigger:** a creator signs in and has no channel connected yet, or cancels the consent screen (`App.tsx:430-431`: "After a cancelled or refused connect too"). On a laptop they get "No channel is connected." and the "Connect a channel" button in a 144px strip on the left, with the rest of the page empty. The same happens on the profile of a creator with no channel, and on any signed-in screen when the channel list fails to load. This is the first screen a new creator sees. MEDIUM: a broken layout on a common path, nothing wrong or lost.

**Evidence**
```css
@media (min-width: 48rem) {
  .signed-in-shell {
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 2.5rem;
  }
```
```tsx
const sidebarShown = channels === null ? !channelsFailed : channels.length > 0
...
<div className="signed-in-shell">
  {sidebarShown && <Sidebar route={route} navigate={navigate} />}
  <div className="signed-in-screen">
```
**Failure mode** — With no sidebar, `.signed-in-screen` is the shell's only child, and grid auto-placement puts it in the first track, 9rem wide. Executed: `sh docs/reviews/creator-analytics-268/repro/sidebarless-shell-width.sh` at 1280px prints `with sidebar: screen=952 shell=1136` and `without sidebar: screen=144 shell=1136`. happy-dom applies no stylesheet, so `app.test.ts`'s "does not show for a creator with no channel" passes while the layout breaks.

**Recommended fix**
```diff
 @media (min-width: 48rem) {
-  .signed-in-shell {
+  .signed-in-shell:has(> .sidebar) {
     grid-template-columns: 9rem minmax(0, 1fr);
     gap: 2.5rem;
   }
```
and in `apps/web/test/web.test.ts:269`:
```diff
-      expect(valueIn(own, '.signed-in-shell', 'grid-template-columns', tablet)).toMatch(
+      expect(valueIn(own, '.signed-in-shell', 'grid-template-columns', tablet)).toBeUndefined()
+      expect(valueIn(own, '.signed-in-shell:has(> .sidebar)', 'grid-template-columns', tablet)).toMatch(
```
Measured: the same repro over the built CSS with `.signed-in-shell:has(>.sidebar)` in the media rule prints `without sidebar: screen=1136 shell=1136`, and the with-sidebar case is unchanged at 952.

**Remediation brief**
- **Design intent:** the signed-in view is one shell: the sidebar (two links) and the screen beside it from 48rem up, stacked below it. The sidebar shows for a creator with a channel and while the channels are read (`App.tsx:225-227`), so the layout holds still for the usual case. A screen with no sidebar must take the whole width at every size.
- **Full surface:** `apps/web/src/app.css:1674-1678` (the selector); `apps/web/test/web.test.ts:258-275` (the stylesheet rule test, which names `.signed-in-shell` in the tablet query and must follow the selector). Check that `valueIn` matches a selector string exactly; if it normalises whitespace, use the selector as written in the CSS. No change to `App.tsx`.
- **Must preserve:** the mobile stack (no `grid-template-columns` outside the media query, `web.test.ts:266`); the 2.5rem gap beside the sidebar; `.app .controls-bar` losing its inline-start margin and padding from 48rem (`app.css:1684-1689`, `web.test.ts:272-273`); the sidebar test describe in `apps/web/src/app.test.ts` (around `:1600-1650`).
- **Do not touch:** the sidebar's show rule (`App.tsx:227`), which is right as specified; see Dismissed, "Audience with a channel going back to null".
- **Proof:** `pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/sidebarless-shell-width.sh` prints `without sidebar: screen=144` now, and must print a screen width equal to the shell's after. Then `pnpm exec vitest run apps/web/test/web.test.ts`. The stylesheet test states its limit: it reads rules, not layout, and Nick's browser walk at 375px and desktop width covers the layout.

### 2. US-ZZ shows as "Unknown state", a label nobody approved, and its comment is a to-do with no issue — LOW
- **Location:** `apps/web/src/us-states.ts:4-6` and `:72`; pinned by `apps/web/src/us-states.test.ts:24-27`
- **Attribution:** introduced, `ae905b7` ("creator-analytics#276 Audience: US states and cities"), `git log -S'awaits Nick' b10c8d4..HEAD`. The loop recorded it as an assumption for Nick to confirm.
- **Real-world trigger:** Google answers `US-ZZ` for views it cannot place in a state (its Dimensions page says so), so any channel with US viewers can show it. The screen then shows "Unknown state", which mirrors the approved "Unknown country" but was never approved. LOW: the label is plausible and the numbers are right, but the epic holds every screen string to word-for-word approval.

**Evidence**
```ts
// "Other states" and the state names are approved in creator-analytics#268 on 2026-10-19, each
// state by its English name, with Washington, D.C. and any territory Google answers. "Unknown
// state" for US-ZZ awaits Nick's approval: no approved text names it.
...
  'US-ZZ': 'Unknown state',
```
**Failure mode** — unapproved copy ships, and the comment is a pending action with no owner or issue (`CODING_STANDARDS.md` 1, "A `TODO` with no owner and no issue").

**Recommended fix** — Nick approves "Unknown state" or rewords it. Then the comment cites the approval like the others: `// "Other states", "Unknown state" and the state names are approved in creator-analytics#268 on <date>, each state by its English name, with Washington, D.C. and any territory Google answers.`, and the label changes to Nick's wording if he rewords it.

**Remediation brief**
- **Design intent:** every string on the Audience screen is approved word for word on its issue, and the comment above each table names the approval.
- **Full surface:** `apps/web/src/us-states.ts:4-6`, `:72`; `apps/web/src/us-states.test.ts:24-27` (the test that names US-ZZ by its label; it observes the code-to-name branch, so it stays, with the label it asserts following Nick's wording).
- **Must preserve:** US-ZZ placed by its number, like `ZZ` among the countries (`us-states.test.ts:24`).
- **Do not touch:** the territory names, which the epic approves as "any territory Google answers".
- **Proof:** `pnpm exec vitest run apps/web/src/us-states.test.ts`.
- **Escalation:** a copy decision for Nick. Remediation cannot close it until he answers.

### 3. Google's `OTHER` operating system shows as a bar named "Other", beside the "Other operating systems" bar — LOW
- **Location:** `apps/web/src/devices.ts:38-44` (`titleCaseOf`) and `:66-76` (`operatingSystemBarsOf`); pinned by `apps/web/src/devices.test.ts:84-87`
- **Attribution:** introduced, `61678e9` ("creator-analytics#278 Audience: devices, operating systems, and subscribers").
- **Real-world trigger:** `OTHER` is one of the values Google's Dimensions page lists for `operatingSystem` (fetched 2026-10-20). A channel with more than 10 systems shows both a bar "Other" (Google's own row) and a bar "Other operating systems" (the rest the screen adds up). A creator cannot tell which is which. LOW: a confusing display, with the numbers right.

**Evidence**
```ts
name: operatingSystemNames[operatingSystem] ?? titleCaseOf(operatingSystem),
...
expect(bars.map(({ name }) => name)).toEqual(['Playstation Vita', 'Other', 'Kaios'])
```
**Failure mode** — `OTHER` has no mapped name, so the title-case fallback the epic asks for turns it into "Other", a name that collides with the rest bar's meaning.

**Recommended fix** — Nick picks one: (a) an approved name for `OTHER` in `operatingSystemNames`, such as "Other system"; or (b) fold Google's `OTHER` row into the "Other operating systems" bar. (a) is one table entry. (b) changes `topBarsOf`'s contract and needs its own brief.

**Remediation brief**
- **Design intent:** each OS shows by its usual name; a value with no name shows Google's value in title case; the rest past the top 10 add up to one "Other operating systems" bar.
- **Full surface:** for (a), `apps/web/src/devices.ts:17-36` (the table) and `:4` (the approval comment), with `apps/web/src/devices.test.ts:84-87` changed to a fallback value that is not `OTHER` (for example `PLAYSTATION_VITA` and `KAIOS` only) and the new name asserted in `devices.test.ts:54` ("name each operating system by its usual name").
- **Must preserve:** the title-case fallback for every other unmapped value, and `topBarsOf` unchanged (`apps/web/src/countries.test.ts` pins its top 10 and rest rules).
- **Do not touch:** the five guessed keys at `devices.ts:30-35`; their comment states they are guesses that fall back safely.
- **Proof:** `pnpm exec vitest run apps/web/src/devices.test.ts`.
- **Escalation:** a copy decision for Nick.

### 4. The Audience API tests pin only the first read's failure and three of the refusals, and nothing pins its caching — LOW
- **Location:** `apps/api/src/audience.test.ts:618-653` (the "refuses as the channel summary does" describe), `:638-652` (the failed-read test)
- **Attribution:** introduced with the Audience answer, `1f45940` ("creator-analytics#179 Audience: the API answer and the countries section"); the later children added reads without extending the describe.
- **Real-world trigger:** none today: the code refuses correctly (see the parity row above). The gap is that a later change could break the spec's rule "a failed read of any breakdown refuses the whole answer" and stay green, for example a read of the subscriber split that answers `null` on failure. That is exactly the "reads as no numbers" failure the epic forbids. LOW, capped: a coverage gap on correct code.

**Evidence**
```ts
// The channel's snippet and last processed day are now cached, so only the countries fail.
await readAudience(browser, channelId, { window: 'last28' })
api.google.failAnalytics(500)
const failed = await readAudience(browser, channelId, { window: 'last90' })
expect(failed).toEqual({ status: 502, body: { refusal: 'google_failed' } })
```
**Failure mode** — `failAnalytics` (`packages/fake-google/src/index.ts:147`) fails every later Analytics request, and the reads run in order, so the countries read is the only one that ever fails in a test. A mutation `subscriberSplitOf(subscribedStatuses.ok ? subscribedStatuses.value : {})` at `apps/api/src/audience.ts:61-62` (dropping the early return) stays green. No Audience test covers quota (`quotaExceeded`), a revoked connection, `invalid_format`, a repeated parameter or a custom range out of bounds, and no test reads two formats on one API to see that the format reaches the cache key.

**Recommended fix** — Add to the fake a way to fail one dimension (`failAnalyticsFor(dimension: string, status: number, error?)`, consulted in the same place `failAnalytics` is), then in the describe: a `test.each` over the eight dimensions in which only that read fails and the answer is `{ status: 502, body: { refusal: 'google_failed' } }`; a quota refusal and a revoked connection, copied from the channel summary's tests (`apps/api/src/channel-summary.test.ts:936`, the quota test, and `:661`, the revoked connection); and a read of `format=all` then `format=short` on one API, asserting the countries differ and the `province` and `city` queries ran once each. Rename the existing test to say what it shows ("a failed read refuses the whole answer").

**Remediation brief**
- **Design intent:** the Audience answer is all or nothing: one refused read refuses the whole answer, so a section never shows "YouTube has no numbers for this window." for a failure. The reads run one after another (`audience.ts:46`), and each read is cached for six hours by channel, range and format, with US states and cities shared across formats.
- **Full surface:** `packages/fake-google/src/index.ts:147` (beside `failAnalytics`), `apps/api/src/audience.test.ts:618-653`.
- **Must preserve:** `failAnalytics`'s behaviour for every existing caller (`git grep failAnalytics` in `apps/api/src`); the three refusals already tested.
- **Do not touch:** the sequential reads in `audience.ts:45-61`; see Dismissed, "sequential reads".
- **Proof:** the per-dimension `test.each` goes red for the subscriber split row under the mutation above, and green without it. `pnpm exec vitest run apps/api/src/audience.test.ts`.

### 5. The branch's new reads, reports and sections copy the helpers it made beside them — LOW
- **Location:**
  - `packages/youtube-gateway/src/reads/channel-us-states.ts:21-43` and `channel-cities.ts:28-47` repeat `channelBreakdownRead`'s body (`channel-breakdowns.ts:17-46`): same `needs`, cache window, query shape and zero-row drop.
  - `packages/fake-google/src/reports/channel-us-states.ts:15-34` repeats `channelBreakdownReport` in `channel-breakdowns.ts` of the fake.
  - `apps/web/src/ViewerShares.tsx:9-37` repeats `TopBarsSection.tsx:10-43`'s section, list, empty state and notes, with only the number column different.
  - `apps/api/src/video-detail.ts:95` sorts traffic sources inline with the rule `audience.ts` names `byMostEngagedViews`.
- **Attribution:** introduced. US states and cities landed in `ae905b7` (#276) before `channelBreakdownRead` existed; `61678e9` (#278) made the factory from countries and did not fold them in. `ViewerSharesSection` came in `a5e427b` (#277) beside #276's `TopBarsSection`. `video-detail.ts` is in this diff (#192).
- **Real-world trigger:** none for a user. `CODING_STANDARDS.md` 3: a change carries the refactoring its own path exposes, and the third copy of a list is the named example. A fix to the zero-row rule or the cache window now has to land in three places.

**Recommended fix** — Give `channelBreakdownRead` an options argument, `{ filters?: string; sort?: string; maxResults?: number; everyFormat?: true }`, and make `channelUsStates` `channelBreakdownRead('channelUsStates', 'province', { filters: 'country==US', everyFormat: true })`. Cities answer a list, not a record, so keep its own `fetch` but share one `engagedViewsAndViewsOf(record)` for the zero-row drop. Do the same for the fake's US states report. Let `TopBarsSection` take a number label per bar, or pull one `BarList` used by both sections. Move `byMostEngagedViews` to a module both API files import and use it at `video-detail.ts:95`.

**Remediation brief**
- **Design intent:** each channel breakdown is one Google query, its rows read into engaged views and views with 0-and-0 rows dropped, cached six hours by channel, range and format. US states and cities never take the format. Every bar section is a heading, a list or the empty state, then its notes.
- **Full surface:** the six files above, plus `packages/youtube-gateway/src/catalogue.ts` (where the reads register) and `apps/web/src/top-bars.ts` if the bar type changes.
- **Must preserve:** the cache key names (`channelUsStates`, `channelCities`, `channelCountries`), so cached rows survive a deploy; `ChannelRangeRequest` vs `DateRange` typing, which is what stops a format reaching US states and cities; the fake's 400 to a format filter on a province or city query; every test in `audience.test.ts`, `fake-google.test.ts`, `components.test.ts`, `viewer-shares.test.ts` and `video-detail.test.ts`.
- **Do not touch:** `apps/web/src/traffic-sources.ts` and `TrafficSources.tsx`, which repeat `topBarsOf` but sit outside this diff: a follow-up ticket.
- **Proof:** behaviour-preserving, so `pnpm typecheck` and `pnpm test` stay green and `git diff` shows no test change.

### 6. Six new tests cannot go red, or assert copy — LOW
- **Location and shape:**
  - `apps/web/src/components.test.ts:394`: `expect(markup).toContain(`<p class="note">${signedInNote}</p>`)` restates the approved signed-in note (literal at `:340`). The note is unconditional under the bars, so this is a copy assertion (`CODING_STANDARDS.md` 2). The order check on `:395` is a real rule and stays.
  - `apps/web/src/app.test.ts:1605`, the `['the profile', 'profile', []]` row: green at base, where no sidebar exists, so `currentSidebarLinks` is `[]` whatever renders.
  - `apps/web/src/route.test.ts:665`: green at base, because `routeOf('audience', …)` at base is already a list route, so the fixture never holds `audience: true`.
  - `apps/web/src/components.test.ts:509`: the answer carries no countries, so a screen that still rendered countries would pass.
  - `apps/web/src/app.test.ts:1717-1725`: asserts only that `track` was not called, so a dead link also passes.
  - `packages/fake-google/src/fake-google.test.ts:1124-1160`: the fixture ranks the same by views and by engaged views, so a fake sorting by engaged views passes (`7e9c2e5` fixed the same problem in the API fixture, not here).
- **Attribution:** introduced. All come from `96d0c48`, `1f45940`, `4d4ae4c`, `a5e427b` or `ae905b7` (oracle run: about 125 new or changed cases, 17 green at base, 13 of those legitimate; none of the four vacuous ones is a review-finding proof).
- **Real-world trigger:** none for a user; each is a claim of coverage the branch does not have.

**Recommended fix**
- `components.test.ts:394`: delete the line and keep `:395`.
- `app.test.ts:1605`: in the test body, `expect(sidebarLink(container, videosLinkText)).toBeTruthy()` before the `currentSidebarLinks` assertion.
- `route.test.ts:665`: `expect(audience.audience).toBe(true)` before the address assertion.
- `components.test.ts:509`: render `{ ...detailAnswer, countries: <the twelve-country fixture> } as VideoDetailAnswer`.
- `app.test.ts:1717`: `expect(shown.address()).toBe('audience?window=last90')` after the choice, with `render()`'s returned `address`.
- `fake-google.test.ts:1124`: give Berlin the most engaged views and the fewest views (for example `{ engagedViews: 80, views: 30 }`), and keep the expected rows by views.

**Remediation brief**
- **Design intent:** every test states one rule and can go red when the code breaks (`CODING_STANDARDS.md` 2).
- **Full surface:** the six sites above.
- **Must preserve:** each test's name and rule; the legitimate green-at-base tests (`route.test.ts:616`'s boundary negatives, `channel-picker.test.ts:80`, `controls-bar.test.ts:55`, `components.test.ts:208`, `:224`, `:481`, `web.test.ts:300`, `video-detail.test.ts:465`, `:499`).
- **Do not touch:** heading literals in the `with no …` tests, which observe the empty branch.
- **Proof:** each strengthened test goes red under its mutation: `components.test.ts:509` with `VideoDetail.tsx` rendering `<Countries>` again; `route.test.ts:665` with `routeOf` ignoring the `audience` path; `app.test.ts:1717` with the sidebar link's `href` set to `#`; `fake-google.test.ts` with the fake city report sorting by `engagedViews`. `pnpm exec vitest run <file>` for each.

### 7. Comment hygiene — LOW (aggregated)
- `apps/web/src/ViewerShares.tsx:8` — "With no bar, the empty state alone." → "With no bar, the heading and the empty state alone."
- `apps/web/src/consent.ts:19` — "Approved word for word in creator-analytics#275 (epic #268), replacing the #158 paragraph." → "Approved word for word in creator-analytics#275 (epic #268)."
- `apps/web/src/App.tsx:225-226` — "Beside every screen of a creator with a channel, and while the channels are read, so the layout does not jump once they land." → "Beside every screen of a creator with a channel, and while the channels are read, so the layout does not jump once a creator's channels land."
- `packages/fake-google/src/channel-data.ts:218-220` — "A report answers every row held, a row of 0 engaged views and 0 views included, by most views." → add "cut to the query's `maxResults`".
- `packages/api-types/src/video-detail.ts:46-49` — "a traffic source, one side of the subscriber split, or a country." → "Engaged views and views under one value of a breakdown."
- `docs/research/youtube-analytics-metrics-and-dimensions.md:83-84` — `country` and `province` "not read" → read by the Audience answer (`channelCountries`, `channelUsStates`); `:138` — the reads list gains the `channel-*.ts` breakdown reads. Pre-existing for `country` (the per-video read at `$BASE`), widened by this branch.

## Needs Further Investigation
None.

## Reviewed and Dismissed
- Audience with a channel going back to null leaves the last channel's sections on screen (`Audience.tsx:60-62`) — unreachable: `setChannels` only ever sets a list (`App.tsx:336`, `:346`) and preferences are never unread again, so `shownChannelId` cannot go from a channel to null while the screen is mounted.
- Age labels lack the colon of "18 to 24: 31%" — the epic's "such as" describes the bar, and the countries bars approved in #158 render name and number in two spans the same way (`git show b10c8d4:apps/web/src/Countries.tsx`).
- Devices never get a top 10 and "Other" bar — a recorded assumption: Google lists eight device types and no "Other devices" text is approved (`devices.ts:47-58`).
- `AUTOMOTIVE` and `WEARABLE` in the `deviceType` comments — both are on Google's Dimensions page (fetched 2026-10-20).
- The countries comment cites #179 instead of #268 (`Countries.tsx:11-12`) — #179's body carries the note's approval of 2026-10-19.
- Following "Videos" from Audience sends `video_list_viewed` — the list screen's own event on mount, as from the profile; the epic's "no OpenPanel event" covers the sidebar and the Audience screen, which send none (`app.test.ts:1717`).
- An address such as `/audience?window=first7` keeps its query in the address bar — the route reads it as the last 28 days, every link is written from the normalised route, and the list treats a malformed query the same way.
- The 48rem breakpoint is new — #274 asks for "the tablet width", and the CSS comment names 768px.
- The reads run one after another (`audience.ts:46`) — a stated decision, so a failure stops the next query; ten calls on a cold cache.
- Age order by `localeCompare` (`audience.ts:98-100`) — gives age order for all seven values Google documents.
- Rounded shares can add up to 99% or 101% — the #69 rounding rule; no requirement says they sum.
- `ChannelQueryParameter` written as a list (`window-query.ts:38`) — `repeatedChannelQueryRefusals` is `satisfies Record<ChannelQueryParameter, ErrorCode>`, and both routes take exactly these four.
- `channelBreakdownRead(name: string, …)` takes a free string — every caller is in one file and the names are distinct; finding 5 touches the signature anyway.

## Minor / nits
- `apps/web/src/Sidebar.tsx:11`: `<nav className="sidebar">` has no accessible name, unlike the app's other two navs. A label is new copy for Nick.
- `apps/web/src/App.tsx:232`: `takeListBounds` now also takes the Audience answer's bounds; `takeChannelBounds` would fit.
- `apps/web/src/devices.ts:38-44`: the title case gives "Nintendo 3ds" and "Kaios" for Google's `NINTENDO_3DS` and `KAIOS`.
- Duplicated tests across layers: `controls-bar.test.ts` "on the Audience screen, offers the calendar windows…" and `app.test.ts` "shows its heading and a controls bar…"; `route.test.ts` "from the window %o, takes the last 28 days" and `app.test.ts:1612`; the generic top 10 rules retested through each wrapper (`cities.test.ts:13-35`, `us-states.test.ts:36-58`, `devices.test.ts:89-104`).
- `packages/fake-google/src/channel-data.ts:222`: the fake holds cities as a record, so it cannot send two cities of one name, which the gateway's list exists for.
- `docs/oauth-verification.md`: the demo shot list has no shot of the Audience screen, which the scope justification now names.
- `apps/web/src/traffic-sources.ts:50-61`: a copy of `topBarsOf`'s arithmetic, outside this diff (follow-up).

## Test quality
Tests added or changed: about 125 cases (about 98 declarations) in 16 files. Green against `$BASE`: 17; 13 are legitimate (boundary negatives for the exact `audience` path, behaviour kept across a move, a loosened `toMatchObject`), 4 are vacuous or cannot go red (finding 6). Tautology shapes: no self-computed expectations, no mocked units, no snapshots; one copy assertion (`components.test.ts:394`) and one call-shaped-only test (`app.test.ts:1717`), both in finding 6. Two "given order" tests feed already-sorted input (`cities.test.ts:13`, the devices order test in `components.test.ts`), a nit.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite pass at `3bdcf06`.
- **Commit hygiene:** this doc and `repro/sidebarless-shell-width.sh` are the only new files. Nothing to drop.
- **Likely reviewer asks:** Nick's answers on "Unknown state" and on Google's `OTHER` system; Nick's browser walk of the sidebar at 375px and desktop width (with a channel and with none) and of the Audience screen for the last 28 days, August and Shorts; follow-up tickets for `traffic-sources.ts` and the OAuth demo shot.

## Verdict
**Not ready as-is; ready once finding 1 is fixed.** Gate: finding 1 (the sidebar-less screen at desktop width). Findings 2 and 3 wait on Nick's copy answers and can land in this branch when he gives them. Findings 4 to 7 are cleanups that can land here or as follow-ups. No CRITICAL or HIGH.

## Remediation, 2026-10-20
Scope: CRITICAL, HIGH and MEDIUM, the default. The round had one MEDIUM (finding 1) and no CRITICAL or HIGH. Findings 2 to 7 are LOW and deferred to Nick unworked, findings 2 and 3 also waiting on his copy answers.

| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `262bef5` creator-analytics#268 pre-PR review 1 finding 1: Give a signed-in screen with no sidebar the whole width from the tablet width up | red→green: `pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/sidebarless-shell-width.sh` printed `without sidebar: screen=144 shell=1136` before and `screen=1136 shell=1136` after, with `with sidebar: screen=952` unchanged; `pnpm exec vitest run apps/web/test/web.test.ts` red on the changed stylesheet test before the CSS change, 47/47 green after | 0 | proved by execution (MEDIUM, executed proof, not a shared core), no verify agent |
| 2 (LOW) | deferred | | | copy decision for Nick ("Unknown state") |
| 3 (LOW) | deferred | | | copy decision for Nick (Google's `OTHER` system) |
| 4 (LOW) | deferred | | | LOW tail, not worked |
| 5 (LOW) | deferred | | | LOW tail, not worked |
| 6 (LOW) | deferred | | | LOW tail, not worked |
| 7 (LOW, comment hygiene) | deferred | | | LOW tail, not worked |

Preserve suites after the fix: `pnpm exec vitest run apps/web/src/app.test.ts` (99 passed, the sidebar describe included); full checks at `262bef5`: `pnpm lint` pass, `pnpm typecheck` pass, `pnpm build` pass, `pnpm test` 115 files, 2,574 passed, 1 expected fail.

### Known regressions, deferred
None.

### Rework briefs
None. No verify pass ran, so no rework.

### Approach decisions, this round
- The sidebar's grid (finding 1): applied as recorded above, `.signed-in-shell:has(> .sidebar)` in the 48rem rule, mirroring `.numbers-table table:has(tfoot)`. `App.tsx` and its tests unchanged. The stylesheet test asserts the bare `.signed-in-shell` has no `grid-template-columns` at the tablet width and the `:has(> .sidebar)` rule keeps its two columns; `valueIn` matches the selector exactly as written in the CSS.
