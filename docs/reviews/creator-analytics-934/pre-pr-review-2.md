# Pre-PR review: creator-analytics#934 Repackaging view: sort and filter the video list by CTR and traffic source

**Branch:** `creator-analytics-934-repackaging-view` vs `origin/main` (merge-base `50d69539` "Merge pull request #922 from nick-vogel/release-2026.11.20-date")
**Reviewed at:** HEAD `84956411` ("creator-analytics#934 pre-PR review 1 remediation closure table"), clean tree, no uncommitted or untracked files at review time. Whole branch: 33 files, +2293 / −72.
**Delta under review:** since `a5a8a81c` ("creator-analytics#945 Describe the repackaging view on the upgrade screen, pricing section and FAQ"), the commit pre-PR review 1 (`docs/reviews/creator-analytics-934/pre-pr-review-1.md`) reviewed. Delta: 9 files, +629 / −11, of which 4 are code (`apps/web/src/VideoList.tsx`, `apps/web/src/video-list.ts`, `apps/web/src/app.test.ts`, `apps/web/src/video-list.test.ts`) and 5 are review 1's doc and repros. Commits: `b148bef1` (review 1), `97fd33e2` (finding 1), `97811171` (finding 2), `262b75be` (finding 2 rework), `84956411` (closure table).
**Reviewed against:** epic creator-analytics#934 and sub-issue #943 (body and acceptance criteria), pre-PR review 1's findings, briefs, Approach decisions and remediation closure table, the global rules in `~/.claude/rules/` and the repo rules `row-level-security-tests` and `youtube-test-limits`. No plan docs under `docs/specs/` or `docs/plans/`.
**Date:** 2026-11-20
**Reviewer:** 1 code-review agent (the delta's four code files) + 1 tautology-audit agent + verify pass
**Gemini:** skipped, Gemini failed: an HTTP or network error, or the 10-minute timeout (exit 14): "gemini-ask: network error: UND_ERR_INFO"

## What was verified and how

| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | ok, already up to date |
| Lint | `pnpm lint` | green (831 files, the review 1 repros included) |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green |
| Unit and integration suites | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | first run: 1 failure, `apps/api/src/video-list.test.ts:1500` "after first365, the cache answers each later window's first slice" timed out at 5000ms while the tautology audit ran a second suite; the file is untouched by the delta. Re-run after 60s: green, 215 files, 5431 passed, 1 expected fail. A flake |
| Browser walk | `pnpm run --if-present test:browser` (system Chrome) | green; only the expected 401s on the signed-out tool page |
| Review 1 repro, finding 2 | `pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts` | green at `84956411` (2 of 2), red at `a5a8a81c` per review 1 |
| Review 1 repro, finding 1 | `apps/web/src/app.test.ts` "on a Pro channel, a minimum committed with Enter keeps focus in the minimum field" (the repro case, committed) | green at HEAD in `pnpm test`; red at `a5a8a81c` (tautology audit, `<body>` focused) |
| Tautology audit | HEAD's `app.test.ts` and `video-list.test.ts` copied into a scratch worktree at `a5a8a81c`, `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/video-list.test.ts` | 8 added or changed tests: 6 red at `a5a8a81c`, 2 green guards, both red under a mutant (see Test quality) |
| Finding 2 path (b) in the app | scratch copy of the tree (finder): a paid channel with no `listHistory` on `?sort=-ctr&page=1` | address `''`, history length unchanged, only `video_list_viewed` tracked, reads `['-ctr', '-publishedAt']`, the live sort text "Published, newest first". Holds; no committed test pins it (finding 1) |
| Blur after an Enter commit | scratch copy (finder): type 500, Enter, blur | no second navigation, address `?minImpressions=500`. Holds; no committed test pins it (finding 2) |
| Other consumers of an answer without `history` | grep of `historySortKeys`, `sort_without_history`, `'-ctr'` over `apps/` and `packages/`; `readVideoHistory` (`apps/api/src/video-history.ts:206-218`) | the API omits `history` only for a channel whose history is not readable or holds no day at all (channel-wide), never per window or format, so a Pro channel's CTR sort is never rewritten |
| Gemini finder | `~/.claude/bin/gemini-review a5a8a81c` | not run: exit 14, network error |

**Overall:** Both MEDIUM findings of review 1 are fixed against their intent: Enter keeps focus in the minimum field and an address with another minimum still resets it, and a CTR or impressions sort the list cannot show now leaves for newest first by a replace, with no event and no loop, on both the refusal and the answer without history. This round finds two LOW test gaps and one comment, no defect. The branch is ready to open a PR; the LOWs can ride with the deferred LOWs of review 1.

## Approach decisions

- Minimum impressions field resync (review 1, applied in `97fd33e2`): the uncontrolled input keeps its node and takes the minimum in force through a layout effect on that value, not a `key` remount. Kept.
- A history sort the list cannot show (review 1, applied in `97811171`, `262b75be`): newest first by a replace navigation, mirroring `fallBackFromRefusedRange` (`apps/web/src/route.ts:334`) and the source-sort rule in `routeAfterListAnswerOf`. The `sort_without_history` view keeps kind `refused` with an optional `historySort: true` mark; the answer handler navigates only when `routeWithHistorySortOff` changes the route. Kept.
- Reading the minimum from text (review 1, finding 4, not yet applied): one helper capped at 15 digits. Kept for whenever finding 4 is taken up.

## Prior-review closure

Review 1 had 8 confirmed findings.

- **Fully fixed: 2.** Finding 1 (MEDIUM, Enter drops focus): fixed in `97fd33e2`; the committed test is red at `a5a8a81c`, and the address-reset guard goes red with the layout effect removed. Finding 2 (MEDIUM, a history sort with no way back): fixed in `97811171` and `262b75be`, both triggers; the repro and the new tests are red at `a5a8a81c`, and the finder found no loop, no push and no stale-read navigation.
- **Partially fixed: 0.**
- **Untouched: 6, all LOW and deferred by decision** in review 1's closure ("Findings 3, 4, 5, 7 and 8 (LOW) are deliberately deferred to Nick; finding 6 (LOW) waits on his decision on the PR"): 3 (a typo clears the minimum), 4 (16 or more digits), 5 (two traffic source tests compare the list with itself), 6 (copy pins, Nick's call), 7 (the free-channel focus tests answer 200), 8 (comment hygiene). None is re-raised here; this doc's findings repeat none of them.
- Review 1's "Known regressions, deferred": none.

## Confirmed Issues

### 1. No app test drives the history sort fallback on an answer without the history, or that fallback's own failed read — LOW

- **Location:** `apps/web/src/video-list.ts:847-851` (`routeAfterListAnswerOf`), `apps/web/src/VideoList.tsx:531-534` (the answer handler's replace)
- **Found by:** Claude
- **Attribution:** introduced by the remediation, `97811171` ("creator-analytics#934 pre-PR review 1 finding 2: A CTR or impressions sort the list cannot show leaves no way to change the sort"). `grep -n "sort=-ctr" apps/web/src/app.test.ts` finds only `:3581` and `:3599`, both the 403 `sort_without_history` path; review 1's brief asked for one app test, on the refusal, and the rework pinned that path's own failure, not this one's.
- **Real-world trigger:** none for users: the behaviour holds today (a scratch app test, a paid channel with no `listHistory` on `?sort=-ctr&page=1`: address `''`, history length unchanged, only `video_list_viewed` tracked, reads `['-ctr', '-publishedAt']`). The gap is that path (b), a paid channel whose history holds no day, is pinned only by the pure `routeAfterListAnswerOf` tests at `apps/web/src/video-list.test.ts:1745` and `:1760`, and test-every-fallback-path asks for a test where the fallback's read itself fails. No user path, so LOW.

**Evidence** —

```ts
  const sourced = reportsNoRevenue(answer) ? routeWithSourcesOff(route) : route
  const sorted = answer.history ? sourced : routeWithHistorySortOff(sourced)
  return sorted === route ? routeWithin(route, answer.pageCount) : sorted
```

**Failure mode** — none in the product today. A later change to the handler that pushes, tracks, or reads the answer-without-history route twice would leave the suite green, as the only app tests of the fallback stage a 403.

**Recommended fix** — two app tests in the describe "a CTR or impressions sort the list cannot show" (`apps/web/src/app.test.ts:3576`), mirroring its first test:

```ts
  test('on a paid channel whose history holds no day, the list runs newest first in place of the address', async () => {
    const api = installFakeApi()
    api.entitlements = {
      paidTierOffered: true,
      channels: [{ channelId: fakeChannel.id, tier: 'paid', canSubscribe: false, canManage: true }],
    }
    const entries = window.history.length
    const { container, address } = await render('?sort=-ctr')

    expect(address()).toBe('')
    expect(window.history.length).toBe(entries)
    expect(
      api.requests
        .filter(({ path }) => path.endsWith('/videos'))
        .map(({ query }) => query.get('sort')),
    ).toEqual(['-ctr', '-publishedAt'])
    expect(container.querySelector('.video-list tbody tr')).not.toBeNull()
  })

  test('on a paid channel whose history holds no day, a refused newest first read shows its refusal', async () => {
    const api = installFakeApi()
    api.entitlements = {
      paidTierOffered: true,
      channels: [{ channelId: fakeChannel.id, tier: 'paid', canSubscribe: false, canManage: true }],
    }
    const first = api.hold(listRoute)
    api.failNext(listRoute)
    const { container, address } = await render('?sort=-ctr')
    await act(async () => first.release())
    await settle()

    expect(address()).toBe('')
    expect(alertOf(container)).not.toBeNull()
    expect(
      api.requests
        .filter(({ path }) => path.endsWith('/videos'))
        .map(({ query }) => query.get('sort')),
    ).toEqual(['-ctr', '-publishedAt'])
  })
```

The fake queues `hold` and `failNext` per route in call order (`nextFor`, `apps/web/src/fake-api.ts:597-610`), so the held first read answers 200 without `history` (the fake's default with no `listHistory`) once released, and the newest first read after it is refused. If `render` waits on the held read and never returns, release it inside the `render` flow the way the suite's other `api.hold(listRoute)` cases do (`grep -n "hold(listRoute)" apps/web/src/app.test.ts`).

**Remediation brief**
- **Design intent:** the address never names a sort the list cannot say; an answer without `history` (a paid channel whose stored history holds no day; the API omits it only channel-wide, `apps/api/src/video-history.ts:206-218`) cannot show the Impressions and CTR columns, so a CTR or impressions sort is replaced, never pushed, with newest first on page 1, sending no event. The rewrite runs after the source-sort rule and before the page clamp.
- **Full surface:** `apps/web/src/app.test.ts:3576-3610` (the describe), helpers `installFakeApi`, `render`, `alertOf`, `listRoute` already used there; `api.entitlements` as in `renderProWithMinimumField` at `apps/web/src/app.test.ts:3481`; `failNext` and `hold` in `apps/web/src/fake-api.ts`. No production change.
- **Must preserve:** the two existing tests of the describe and the `routeAfterListAnswerOf` tests at `apps/web/src/video-list.test.ts:1745` and `:1760`.
- **Do not touch:** `routeAfterListAnswerOf` and the answer handler (both verified correct this round).
- **Proof:** the new tests green at HEAD; in a scratch worktree, change `navigate(after, { replace: true })` at `apps/web/src/VideoList.tsx:535` to `navigate(after)` and the first new test goes red on the history length; drop the `routeWithHistorySortOff` call in `routeAfterListAnswerOf` and it goes red on the address.

### 2. Nothing pins that a blur after an Enter commit commits nothing, a path the focus fix made reachable — LOW

- **Location:** `apps/web/src/VideoList.tsx:134-138` (`commit`)
- **Found by:** Claude
- **Attribution:** exposed by the remediation, `97fd33e2` ("creator-analytics#934 pre-PR review 1 finding 1: Pressing Enter with a new minimum drops keyboard focus to the page"). Before it, Enter remounted the input, so no blur followed a commit on the same node; now focus stays, and the next blur runs `commit` again. Review 1's brief listed "A blur after an Enter commit commits nothing" under Must preserve; the remediation added no test of it (`grep -n "blur" apps/web/src/app.test.ts` finds none in the describe at `:3452`).
- **Real-world trigger:** none today: a scratch test (type 500, Enter, blur) showed no second navigation, because the re-render lands before the blur and `change.minImpressions !== minImpressions` sees the new minimum. A regression would replace the history entry or read the list twice; no wrong number, no user path today, so LOW.

**Evidence** —

```ts
  function commit(field: HTMLInputElement) {
    const change = minImpressionsChangeOf(field.value)
    if (change === null) field.value = committed
    else if (change.minImpressions !== minImpressions) onCommit(change)
  }
```

**Failure mode** — none today. A change that compares with a stale minimum (for example a memoised `commit`) would commit twice and leave the suite green.

**Recommended fix** — one app test in the describe "the history filters leaving the controls row with focus in one", beside `apps/web/src/app.test.ts:3494`:

```ts
  test('on a Pro channel, leaving the minimum field after an Enter commit commits nothing more', async () => {
    const { api, minimum } = await renderProWithMinimumField()
    act(() => minimum.focus())
    await act(async () => {
      minimum.value = '500'
      minimum.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await settle()
    const entries = window.history.length
    const reads = api.requests.filter(({ path }) => path.endsWith('/videos')).length

    act(() => minimum.blur())
    await settle()

    expect(window.history.length).toBe(entries)
    expect(api.requests.filter(({ path }) => path.endsWith('/videos')).length).toBe(reads)
  })
```

`renderProWithMinimumField` (`apps/web/src/app.test.ts:3481`) does not return `api` today; change its last line to `return { api, container, minimum }`.

**Remediation brief**
- **Design intent:** the minimum field commits on Enter or on leaving it; a value equal to the minimum in force commits nothing, as each commit is a navigation and a list read (#944 assumptions 25 and 32). After `97fd33e2` the input keeps its node and focus across a commit.
- **Full surface:** `apps/web/src/app.test.ts:3481-3492` (`renderProWithMinimumField`, which must also hand back `api`), the new test beside `:3494`. No production change.
- **Must preserve:** the tests at `apps/web/src/app.test.ts:3494`, `:3508`, `:3520`, `:3532` and the rest of that describe.
- **Do not touch:** `commit` and the layout effect at `apps/web/src/VideoList.tsx:131-138`, verified correct this round.
- **Proof:** the new test green at HEAD; in a scratch worktree, change `change.minImpressions !== minImpressions` to `true` at `apps/web/src/VideoList.tsx:137` and it goes red.

### 3. Comment hygiene — LOW (aggregated)

- `apps/web/src/VideoList.tsx:117-118` — "It takes the minimum in force whenever that changes, so a change of the address resets the text." → "It takes the minimum in force whenever that changes, so an address with another minimum resets the text." (an address change that keeps the minimum, such as another page, leaves uncommitted text alone, as it did under the old key) (found by: Claude)

## Needs Further Investigation

### A. The controls row still moves on a slow entitlements read and on an ended channel's first load — a throttled browser session would confirm it
- **Found by:** Claude
- Carried from review 1 (NFI A), untouched by the delta and still unrun. To confirm: on a Pro channel and an ended one, at 375px and 1280px, delay `/api/me/entitlements` in devtools and watch whether the traffic source select and minimum field appear after the list lands. MEDIUM if confirmed.

### B. The live sort text says CTR while the first read of a sort the list cannot show is in flight — a screen reader session would confirm whether it is announced
- **Found by:** Claude
- `sortLabelOf(route.window, route.sort)` in the `aria-live="polite"` paragraph follows the address, so on a paid channel with no stored day it reads the CTR sort until the replace lands, then "Published, newest first". The source-sort rewrite on a channel with no revenue has the same shape today. To confirm: VoiceOver on `?sort=-ctr` for such a channel; if both are announced, hold the live text until the first answer lands, for both rewrites.

## Reviewed and Dismissed

- The answer handler's fallback loops, or navigates on a stale read — it reads `currentRoute.current` inside `latestOnly`; the newest first read is never refused `sort_without_history` (`apps/api/src/video-list.ts:506-509`); a marked refusal with nothing to rewrite shows (found by: Claude)
- A Pro channel's CTR sort is rewritten for a window or format with no rows — `readVideoHistory` reads the history's ends channel-wide and answers them even when no window counts (`apps/api/src/video-history.ts:218-224`), and `listVideos` has no early return before `historyPartOf` (found by: Claude)
- The layout effect clobbers text the creator is typing — its dependencies are the ref and the minimum in force, so an unrelated render or a navigation that keeps the minimum leaves the text alone (found by: Claude)
- Saved preferences bring the history sort back — the sort is not a preference; `listReadOf` takes it from the address (found by: Claude)
- The fallback rewrites a video screen's route — `VideoList` is not mounted while a video, settings, audience or upgrade screen is on view (`apps/web/src/App.tsx:810-870`) (found by: Claude)
- The second fallback test passes with the wrong refusal showing — after the fallback the handler returns before `setRead`, so the only refusal that can show is the second read's; the read-count and address assertions pin the order, and naming the refusal would pin copy (review 1's verifier note, finding 6's open decision) (found by: Claude)

## Minor / nits

- The answer handler builds `withoutHistorySort` as an identity route on every answer (`apps/web/src/VideoList.tsx:503-510`) where `fallBackFromRefusedRange` is a named helper; review 1's closure chose to mirror the `after !== currentRoute.current` branch below it. Style only (found by: Claude)
- `apps/web/src/app.test.ts:3577` asserts the address, the replace, the silence, no alert and the rows in one test; the rework brief asked for these pins as facets of one rule, the fallback (found by: Claude)
- `apps/web/src/app.test.ts:3508` never reads `500` in the field before the popstate; the layout-effect mutant still turns it red (found by: Claude)
- The video screen's stepper on a paid channel with no stored day steps in the API's order for `sort=-ctr` while the list it returns to runs newest first; the lane's LOW F1.2, deliberately out of review 1's fix (found by: Claude)
- Uncommitted text in the minimum field survives an address change that keeps the minimum, and the next blur commits it on the new address; as under the old key, not a regression (found by: Claude)

## Test quality

Tests added or changed by the delta: 8 · red at `a5a8a81c`: 6 · green at `a5a8a81c`: 2 · tautology shapes found: 0.

Red at `a5a8a81c`: `app.test.ts:3494` (focus on `<body>`), `:3577` and `:3595` (address keeps `-ctr`), `video-list.test.ts:479` (no `historySort`), `:1745` both cases (sort and page kept). Green at `a5a8a81c`, both guards of behaviour the fix must keep, both red under a mutant: `app.test.ts:3508` (layout effect deleted: `expected '500' to be '100'`) and `video-list.test.ts:1760` (history rewrite made unconditional). Keep both. No mocked unit, no snapshot, no assertion-free or prose test; the call-shaped `track` and request-sort assertions sit beside state assertions. `video-list.test.ts:482` still pins the refusal copy word for word, which is review 1 finding 6 (Nick's call).

## Before opening the PR

- **CI readiness:** lint, typecheck, build and `pnpm test` green at `84956411` (one flaky timeout on the first run, green on the re-run); the browser walk green. This doc adds no repro.
- **Commit hygiene:** commit this doc. Nothing else is uncommitted.
- **Likely reviewer asks:** the copy approvals the tickets reserve for the PR (#943 assumption 6, #944 assumptions 21, 23 and 24, #945's drafts); the OpenPanel question for the two new controls (#944 assumption 26) and review 1's NFI D; review 1 finding 6's decision; the deferred LOWs 3, 4, 5, 7 and 8 of review 1; NFI A's throttled browser check.

## Verdict

Ready to open a PR. Review 1's two MEDIUM gates are closed, each against its intent and each by a test red at `a5a8a81c`; none was "resolved" by a comment alone. This round confirms 3 LOW findings (two test gaps the fixes left, one comment) and no defect, the expected shrink after a clean remediation. Findings 1 to 3 can ride a remediation pass with review 1's deferred LOWs or ship as follow-ups. NFI A stays the one open check worth running before the PR, as it would be MEDIUM if confirmed.
