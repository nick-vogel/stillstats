# Pre-PR review: creator-analytics#569 A feedback form in the web app

**Branch:** `creator-analytics-569-feedback-form` vs `origin/main` (merge-base `00f868e31cb7028ae78a8af020aaeaad72ed2346`, "Merge pull request #731 from nick-vogel/release-2026.11.12.2")
**Reviewed at:** HEAD `62f34c776586a17406066ac0a926921e672baa6d` (creator-analytics#583 The feedback admin screen) + 0 files with uncommitted changes, 0 untracked files, 71 files total, +10,918 / −77 (5,950 of the added lines are the three drizzle snapshots)
**Reviewed against:** the epic body of creator-analytics#569 (the spec), its sub-issues #582, #583, #584, #585, #586 (#587 is the human production walk), the epic-loop assumptions recorded for each ticket, `CODING_STANDARDS.md`, `CONTEXT.md`, ADRs 0002, 0007, 0011, 0015. No prior review docs exist for this epic.
**Date:** 2026-11-15
**Reviewer:** 3 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 709 files) | green; this review's repro passes `biome check` |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing 500 kB chunk warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 174 files, 4,498 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 103 steps |
| Tautology audit | scratch worktree at `$BASE`, branch's 18 new or modified test files copied in, run per test | 7 added files red on import (90 tests); 73 new or changed cases in modified files: 63 red, 10 green at base; none of the 10 came from a review-finding commit. See Test quality |
| Finding 1 | `docs/reviews/creator-analytics-569/repro/open-filter-paging.case.ts` appended to `apps/web/src/app.test.ts` in a scratch worktree at `62f34c77` | red: `expected [ 'Message 51', 'Message 52', …(3) ] to deeply equal []` |
| Finding 5 | mutant in a scratch worktree at `62f34c77`: the function's guard in `0025_feedback_messages.sql` cut to `IF sender IS NULL THEN`, then `pnpm exec vitest run packages/database/test/feedback.test.ts` | 16 of 16 green with the scope check removed |
| Finding 6 | `maskSecrets` from `packages/reporter/src/scrub.ts` run under node on the adapter's error message | `status 400, error codes [number], [number]` |
| Finding 4 | the branch's own green seed helpers insert as a user scope with `doneAt` set and `createdAt` in the past (`packages/database/test/feedback.test.ts:44-49`, `apps/worker/test/jobs.test.ts:114-125`); finder A also ran a probe (12 backdated rows, `feedbackCountToday` answered 1), not preserved | the policy admits both |
| RLS read-back (finder A, executed) | `pg_proc`, `information_schema.column_privileges` probes in a Testcontainers database | `feedback_count_today` is SECURITY DEFINER, `search_path` pinned, owner `app_feedback_count`, EXECUTE only for `app_feedback_count` and `app_web`; `app_web` holds UPDATE on `done_at` only; the lock is the two-int4 form |
| Admin gate routing (finder B, executed) | a Hono harness of the gate on the repo's `hono` | every path under `/api/admin` reaches the gate for GET, POST, OPTIONS; signed-out `GET /api/nothing` answers 401, signed-out `GET /api/admin/x` answers 404 |
| Cloudflare REST body shape | Cloudflare docs MCP (rung 2): developers.cloudflare.com/email-service/api/send-emails/rest-api and /examples/email-sending/recipients | `to` as a string and `from` as `{ address, name }` are both documented REST forms |
| Could not run | the real Cloudflare send, the real GlitchTip event, a screen reader | covered by #587's production walk |

**Overall:** The branch meets the epic's spec. The row-level security holds under execution, the email can carry no user text, the admin gate answers 404 to everyone off the allowlist, and every full check is green. The review confirmed nine LOW findings and nothing at MEDIUM or above. The one behavioural defect a user can reach is on Nick's admin screen: with the open filter ticked, marking messages "Done" makes "Older" skip open messages, and that only bites past 50 open messages. The rest is a misleading daily-limit line, comments and docs that overstate the admin 404, a policy left wider than the API needs, and test and comment hygiene. The branch is ready to open a PR, and findings 1 to 3 and 5 to 9 are cheap enough to remediate before it opens.

## Approach decisions
- Admin list freshness under the open filter: re-read the current page after a successful "Done" change while the filter is ticked, and step back to the last page when a read answers a page past it. The in-place patch stays for the unfiltered list. Precedent: the screen's own `useEffect` read over `latestOnly` (`apps/web/src/AdminFeedback.tsx:101-107`).
- Test-only writes to `feedback_messages` that no product scope may make go through a policy that exists only in the test database and admits the `fixture` scope. Precedent: `feedback_messages_fixture_read` in `packages/database/test/fixtures.ts:13-19`.
- Copy that is pending Nick's word-for-word approval stays marked inline with `// pending Nick's word-for-word approval`. A remediation that changes such a string keeps the marker and records the new wording in the ticket's assumptions.

## Confirmed Issues

### 1. With the open filter ticked, marking messages "Done" makes "Older" skip open messages — LOW
- **Location:** `apps/web/src/AdminFeedback.tsx:109-131` (the in-place patch in `changeDone`) and `:101-107` (the read effect)
- **Attribution:** introduced, `64ff50ce` creator-analytics#583 The feedback admin screen (`git log -S'setView((before) =>'`).
- **Real-world trigger:** Nick has more than 50 open messages, ticks "Only open messages", works through page 1 marking some "Done", and presses "Older". LOW, capped: upgrade to MEDIUM once open messages pass 50 in production, check via `select count(*) from feedback_messages where done_at is null;` as a superuser.

**Evidence**
```tsx
    setAlert(null)
    setView((before) =>
      before?.kind === 'list'
        ? {
            ...before,
            messages: before.messages.map((each) =>
              each.id === message.id ? saved.message : each,
            ),
          }
        : before,
    )
```

**Failure mode** — The server's open set loses each message marked "Done", so every later open message moves up one place, but the screen patches the message in place and never re-reads. Executed: 60 open messages, filter ticked, five marked "Done" on page 1, then "Older". Page 2 shows messages 56 to 60, and messages 51 to 55 appear on neither page. They show again only when Nick goes back to page 1 and the page is read again. The repro is red with `missed` = `['Message 51', …, 'Message 55']`.

**Recommended fix**
```diff
   const [alert, setAlert] = useState<string | null>(null)
+  const [reads, setReads] = useState(0)
   const filterId = useId()
 
   useEffect(
     () =>
-      latestOnly(readAdminFeedback(page, openOnly), setView, () =>
-        setView({ kind: 'failed', alert: listFailedText }),
-      ),
-    [page, openOnly],
+      latestOnly(
+        readAdminFeedback(page, openOnly),
+        (answer) => {
+          setView(answer)
+          if (answer.kind === 'list' && page > Math.max(1, answer.pageCount)) {
+            setPage(Math.max(1, answer.pageCount))
+          }
+        },
+        () => setView({ kind: 'failed', alert: listFailedText }),
+      ),
+    [page, openOnly, reads],
   )
@@
     setAlert(null)
+    if (openOnly) {
+      setReads((before) => before + 1)
+      return
+    }
     setView((before) =>
```

**Remediation brief**
- **Design intent:** The admin screen holds the page and the filter in component state (not the address) and reads `GET /api/admin/feedback?page=N[&open=true]`, 50 to a page, newest first, paged by offset on the server (`apps/api/src/admin-feedback.ts:100-108`). Offset paging over a filtered set is only correct while the set does not change under it, so a change that removes a message from the filtered set must be followed by a fresh read. Correct behaviour: every open message is reachable by paging, whatever Nick marked "Done" before he pressed "Older".
- **Full surface:** `apps/web/src/AdminFeedback.tsx:94-131` (state, effect, `changeDone`); `apps/web/src/fake-api.ts:349-363` (`adminAnswerOf` already slices the filtered set the server's way, so no change); a new test in `apps/web/src/app.test.ts` inside `describe('the admin feedback screen (creator-analytics#583)')` (from `:7118`), built from the repro.
- **Must preserve:** the unfiltered list keeps the in-place patch, so a ticked message stays on screen and can be unticked at once (pinned by `app.test.ts` "a tick of "Done" sends PUT and a clear sends DELETE, and each box shows the state the API answers"); a failed save keeps the old state and alerts (`test.for` "on %s, a "Done" change keeps the old state and alerts"); the read counts the existing tests pin with `adminReadsOf` (`['page=1', 'page=1', …]`), which hold because `reads` changes only after a filtered save; `latestOnly`'s cancel on a newer read. Dropped on purpose: under the filter, a message marked "Done" leaves the list on the re-read, so undoing it means unticking the filter. The step back to the last page is new behaviour: without it, ticking the only message on the last page leaves an empty page whose paging buttons are hidden (`view.pageCount > 1` gate at `:169`).
- **Do not touch:** the non-404 failure rendering the admin heading (Dismissed); the per-line approval markers (Dismissed).
- **Proof:** in a scratch worktree, `cat docs/reviews/creator-analytics-569/repro/open-filter-paging.case.ts >> apps/web/src/app.test.ts && pnpm exec vitest run apps/web/src/app.test.ts -t 'repro:'` is red at `62f34c77` and green after the fix. Then move the case into the describe block without the `repro:` prefix, and add a second case: with the filter ticked and 51 open messages, on page 2, ticking its one message lands on page 1 with paging hidden. Then `pnpm exec vitest run apps/web/src/app.test.ts` and `pnpm typecheck` green.

### 2. The daily-limit alert says "today" and "tomorrow", but the limit is a rolling 24 hours — LOW
- **Location:** `apps/web/src/feedback.ts:30`
- **Attribution:** introduced, `c1e5239e` creator-analytics#582 Send a feedback message (`git log -S'Try again tomorrow'`).
- **Real-world trigger:** a creator sends ten messages in an evening, the eleventh after midnight is refused with "Try again tomorrow", and a send the next morning is still refused if it falls within 24 hours of the first. Rare: ten messages a day is the script-stopping limit, not a normal pace.

**Evidence**
```ts
export const dailyLimitText = 'You have sent 10 messages today. Try again tomorrow.' // pending Nick's word-for-word approval
```
and the count it describes, `packages/database/drizzle/0025_feedback_messages.sql`:
```sql
      AND f.created_at > nullif(current_setting('app.now', true), '')::timestamptz - interval '24 hours'
```

**Failure mode** — The refusal tells the creator a calendar-day rule the server does not apply. The epic (user story 15) asks for "a clear message when I have sent too many messages today", and the epic's limit is "10 per account per day" counted as "more than 10 messages from the account in the last 24 hours", so the rule is the rolling window and the line is the mismatch.

**Recommended fix**
```diff
-export const dailyLimitText = 'You have sent 10 messages today. Try again tomorrow.' // pending Nick's word-for-word approval
+export const dailyLimitText = 'You have sent 10 messages in the last 24 hours. Try again later.' // pending Nick's word-for-word approval
```

**Remediation brief**
- **Design intent:** The limit is counted in the database over the 24 hours before the scope's pinned time (`feedback_count_today`), so it never resets at midnight. The form maps a 429 to this one line (`feedbackAlertOf`, `apps/web/src/feedback.ts:110`). Every string in that module waits on Nick's word-for-word approval, so the remediator records the new wording as an assumption in `.epic-loop` (or the ticket) for Nick, keeps the marker, and does not treat it as final.
- **Full surface:** `apps/web/src/feedback.ts:30`. The string reaches the screen only through `feedbackAlertOf`; `grep -rn dailyLimitText apps` lists the tests that read it by name, which stay as they are.
- **Must preserve:** the 429 branch shows this line and every other failure shows `failedSendText` (pinned by the `app.test.ts` daily-limit and failed-send tests, which import the constant); the text stays kept on a refusal.
- **Do not touch:** the 24-hour window itself; it is the epic's rule.
- **Proof:** a copy fix has no red test by the repo's standard (no test asserts fixed copy). Proof is `pnpm exec vitest run apps/web/src/app.test.ts apps/web/src/feedback.test.ts` green and `pnpm lint` green (no em-dash in the new line).

### 3. Comments and docs say the admin 404 matches an unknown route for everyone, but an unknown route answers a signed-out visitor 401 — LOW
- **Location:** `apps/api/src/app.ts:219-220`, `apps/api/src/routes/admin-feedback.ts:32-38`, `apps/api/src/sign-in.test.ts:312-313`, `README.md:126`, `docs/deploy.md:148`
- **Attribution:** introduced, `64ff50ce` creator-analytics#583 (`git log -S'as an unknown route does'`).
- **Real-world trigger:** a maintainer reads that "a signed-out visitor cannot tell them from one" and relies on the prefix being hidden, for example when adding a second admin screen or reasoning about what a scanner sees. No user meets a wrong answer; the claim is about what is hidden.

**Evidence** — `apps/api/src/app.ts:219-220`:
```ts
  // Before the signed-in routes too, as their check would answer a signed-out visitor 401: every
  // path under /api/admin answers 404 to anyone not on the allowlist, as an unknown route does.
```
`apps/api/src/sign-in.test.ts:312-313`:
```ts
    // The admin routes answer 404, as an unknown route does, to anyone not on the allowlist
    // (creator-analytics#583), so a signed-out visitor cannot tell them from one.
```
The signed-in router runs its session check (`app.ts:224-229`) before its catch-all `signedIn.all('*', … 404)` (`app.ts:339`), so a signed-out `GET /api/nothing` answers 401 while a signed-out `GET /api/admin/x` answers 404 (finder B's harness, executed).

**Failure mode** — For a signed-in user off the allowlist the claim holds: both answer 404 `not_found`. For a signed-out visitor it is false: `/api/admin/*` is the one `/api` prefix that answers 404 rather than 401, so the prefix is distinguishable. The behaviour itself is the epic's (it asks for 404 to a signed-out visitor) and #583's assumptions flagged the tension to Nick; only the statements are wrong.

**Recommended fix** — reword, no behaviour change:
- `apps/api/src/app.ts:219-220` → `// Before the signed-in routes too, as their check would answer a signed-out visitor 401: every` / `// path under /api/admin answers 404 to anyone not on the allowlist. A signed-in user gets the same` / `// 404 from an unknown route; a signed-out visitor gets 401 there, so to them the prefix stands out.`
- `apps/api/src/routes/admin-feedback.ts:32-38`: replace "gets the 404 of an unknown route from every path under the prefix" with "gets 404 from every path under the prefix, the answer a signed-in user gets from an unknown route".
- `apps/api/src/sign-in.test.ts:312-313` → `// The admin routes answer 404 to anyone not on the allowlist (creator-analytics#583), signed out` / `// included, so they leave the signed-out inventory below.`
- `README.md:126` and `docs/deploy.md:148`: replace "answers 404 `not_found`, as an unknown route does" with "answers 404 `not_found`, as an unknown route does for a signed-in user".

**Remediation brief**
- **Design intent:** `adminFeedbackRoute` is mounted on the app before the signed-in router so its gate, not the session check, answers every `/api/admin` path. The gate answers 404 `not_found` to a signed-out visitor, a signed-in user off `ADMIN_USER_IDS`, and the admin on an unknown subpath. An unknown path elsewhere under `/api` answers 401 signed out and 404 signed in.
- **Full surface:** the five sites in Location; `grep -rn "unknown route" apps/api/src README.md docs/deploy.md` finds them all.
- **Must preserve:** every behaviour; `sign-in.test.ts` "the API refuses every route… and every admin route with 404" and `apps/api/src/admin-feedback.test.ts` stay green unchanged.
- **Do not touch:** the 404 for a signed-out visitor (Dismissed, the spec asks for it).
- **Proof:** comment and doc only: `pnpm lint` and `pnpm exec vitest run apps/api/src/sign-in.test.ts` green, and the grep above shows no "as an unknown route does" without the signed-in qualifier.

### 4. The user-scope insert policy lets a message be saved already "Done" or backdated — LOW
- **Location:** `packages/database/src/feedback.ts:71` (SQL: policy `feedback_messages_web_insert` in `packages/database/drizzle/0025_feedback_messages.sql`)
- **Attribution:** introduced, `c1e5239e` creator-analytics#582 (`git log -S'feedback_messages_web_insert'`).
- **Real-world trigger:** none today. The API's one insert, `saveFeedback` (`apps/api/src/feedback.ts:76-84`), sets `createdAt: tx.now` and never a `doneAt`, so no request reaches it. LOW, capped: upgrade to MEDIUM if any later code inserts into `feedback_messages` from request data, check via `grep -rn "insert(feedbackMessages)" apps/api/src apps/worker/src`.

**Evidence**
```ts
    webPolicy('feedback_messages', 'insert', isScopeUser(t.userId), 'feedback_messages_web_insert'),
```
```sql
CREATE POLICY "feedback_messages_web_insert" ON "feedback_messages" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "feedback_messages"."user_id" = nullif(current_setting('app.user_id', true), '')));
```

**Failure mode** — The check pins the scope and the user only. A user-scope insert with `created_at` in the past is not counted by `feedback_count_today` (finder A: 12 backdated rows, count answered 1), so the daily limit is dodged; a preset `done_at` hides the message from the open filter, and a `done_at` over a year old gets it deleted on the next nightly run. The branch's own test seeds rely on this (`sendHandledMessage`, `packages/database/test/feedback.test.ts:44-49`). ADR 0002 makes row-level security the boundary, so the policy should state what the API already guarantees.

**Recommended fix**
```diff
-    webPolicy('feedback_messages', 'insert', isScopeUser(t.userId), 'feedback_messages_web_insert'),
+    webPolicy(
+      'feedback_messages',
+      'insert',
+      sql`${isScopeUser(t.userId)} and ${t.doneAt} is null and ${t.createdAt} = ${scopeNow()}`,
+      'feedback_messages_web_insert',
+    ),
```
then `pnpm --filter @creator-analytics/database generate` for a new migration `0028_…` that drops and recreates the policy (never edit 0025, which may already have run on staging), and add to `packages/database/test/fixtures.ts`, beside `fixtureFeedbackRead`:
```ts
export const fixtureFeedbackInsert = pgPolicy('feedback_messages_fixture_insert', {
  for: 'insert',
  to: webRole,
  withCheck: sql`${setting('app.scope')} = 'fixture'`,
}).link(feedbackMessages)
```
with a `seedFeedbackMessages(transaction, rows)` helper in `packages/database/test/feedback-rows.ts` that enters the fixture scope the way `readFeedbackMessages` does.

**Remediation brief**
- **Design intent:** The user scope sends a message and reads none; the admin scope alone sets the "Done" time (column grant in 0027); the system scope deletes a message one year after its "Done" time. The insert policy should admit only what a send is: the scope user's row, open, stamped at the scope's pinned time (`app.now`, set by `enter()` in `packages/database/src/scopes.ts:74-78`).
- **Full surface:** `packages/database/src/feedback.ts:71` and its imports (`scopeNow` from `./access.ts`); a new migration and snapshot under `packages/database/drizzle/` and `meta/_journal.json`; `packages/database/test/fixtures.ts:13-19`; `packages/database/test/feedback-rows.ts`. Test seeds that insert a handled or backdated row through the user scope and must move to the fixture helper: `packages/database/test/feedback.test.ts:44-49` (`sendHandledMessage`) and `:82-85` (fixed `createdAt` of `2026-11-15T12:00:00Z`, which passes only if it equals the scope's clock), `packages/retention-engine/src/retention-engine.test.ts:394-405`, `apps/worker/test/jobs.test.ts:114-125`, and `apps/api/src/admin-feedback.test.ts:262` (check its `createdAt`). The full list: `grep -rn "insert(feedbackMessages)" apps packages --include='*.ts'`.
- **Must preserve:** `saveFeedback`'s insert passes unchanged (`apps/api/src/feedback.test.ts` all green); the user scope still cannot insert for another user (`packages/database/test/feedback.test.ts` "a user scope inserts a message of its own" and the other-user refusal); the retention tests keep proving a year and a day deleted, 364 days kept, open kept.
- **Do not touch:** the count function and its lock (Dismissed: race-free under execution).
- **Escalation:** this is a schema migration, which the epic-loop rules park for Nick. It is defence in depth with no user path, so a follow-up ticket is a sound alternative to fixing it in this branch.
- **Proof:** add `test('a user scope cannot send a message already "Done" or dated before its scope's time', …)` to `packages/database/test/feedback.test.ts` asserting `toMatchObject(policyRefusal)` for `{ ...messageOf(user, scope.now), doneAt: scope.now }` and for `messageOf(user, new Date(scope.now.getTime() - dayMs))`. Red before, green after. Then `pnpm exec vitest run packages/database/test packages/retention-engine apps/worker apps/api/src/admin-feedback.test.ts apps/api/src/feedback.test.ts` green.

### 5. The count function's "runs only in a user scope" test stays green with the scope check removed — LOW
- **Location:** `packages/database/test/feedback.test.ts:491-501`
- **Attribution:** introduced, `c1e5239e` creator-analytics#582.
- **Real-world trigger:** a later edit drops or weakens `IS DISTINCT FROM 'user'` in the function. The admin scope sets `app.user_id` and holds EXECUTE, so the count would then answer 0 there instead of refusing, and no test would notice.

**Evidence**
```ts
    expect(await web.asAnonymous(count)).toMatchObject(refused)
    expect(await worker.forChannel(randomUUID(), count)).toMatchObject(denied)
    expect(await worker.asSystem(count)).toMatchObject(denied)
```

**Failure mode** — The anonymous scope sets `app.user_id` to `''`, so `sender IS NULL` raises on its own, and both worker cases fail on the missing grant. Executed mutant: with the guard cut to `IF sender IS NULL THEN`, the file is 16 of 16 green. The one scope that reaches the scope check alone, admin, is not asserted.

**Recommended fix**
```diff
     expect(await web.asAnonymous(count)).toMatchObject(refused)
+    expect(await web.asAdmin('feedback-user-a', count)).toMatchObject(refused)
     expect(await worker.forChannel(randomUUID(), count)).toMatchObject(denied)
```

**Remediation brief**
- **Design intent:** `feedback_count_today` runs as `app_feedback_count` and must refuse any scope but `user`, since its policy would otherwise filter silently. The admin scope (`asAdmin`, `packages/database/src/scopes.ts`) enters as `app_web` with the admin's `app.user_id`, so it is the case that separates the scope check from the null check.
- **Full surface:** `packages/database/test/feedback.test.ts:491-501`.
- **Must preserve:** the three existing assertions.
- **Do not touch:** the migration (the function is correct).
- **Proof:** in a scratch worktree with the mutant (`sed -i '' "s/IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'user' OR sender IS NULL THEN/IF sender IS NULL THEN/" packages/database/drizzle/0025_feedback_messages.sql`), `pnpm exec vitest run packages/database/test/feedback.test.ts -t 'runs only in a user scope'` is red with the new line and green without the mutant.

### 6. The adapter's Cloudflare error codes never reach the log or GlitchTip, and its error's status field is never read — LOW
- **Location:** `apps/api/src/notification-email.ts:115-133`
- **Attribution:** introduced, `e950b350` creator-analytics#584 The feedback notification email (`git log -S'function errorCodesOf'`).
- **Real-world trigger:** a send fails in production (Email Sending is in beta), and Nick opens the GlitchTip event to learn why: he sees `error codes [number]`.

**Evidence**
```ts
/** Cloudflare's numeric error codes only: its messages are left out, whatever they hold. */
function errorCodesOf(answer: SendAnswer | undefined): number[] {
```
Executed: `maskSecrets('Cloudflare did not send the email: status 400, error codes 10001, 10002')` returns `'… status 400, error codes [number], [number]'`. `maskSecrets` keeps a uuid and a three-digit HTTP status and masks every other number; both the logger (`packages/reporter/src/logger.ts:23`) and the Sentry scrub (`packages/reporter/src/scrub.ts:125-129`) apply it to an error's message. `git grep -n '\.status' apps/api/src` finds no read of `UnsentEmailError.status`.

**Failure mode** — Code written to carry a diagnostic carries none, and its comment reads as if it does.

**Recommended fix**
```diff
-      if (!response.ok || answer?.success !== true) {
-        throw new UnsentEmailError(response.status, errorCodesOf(answer))
-      }
+      if (!response.ok || answer?.success !== true) throw new UnsentEmailError(response.status)
@@
 interface SendAnswer {
   success?: unknown
-  errors?: unknown
   result?: { permanent_bounces?: unknown[] } | null
 }
-
-/** Cloudflare's numeric error codes only: its messages are left out, whatever they hold. */
-function errorCodesOf(answer: SendAnswer | undefined): number[] {
-  …
-}
 
 class UnsentEmailError extends Error {
-  readonly status: number
-  constructor(status: number, codes: number[]) {
-    super(
-      `Cloudflare did not send the email: status ${status}, error codes ${codes.length > 0 ? codes.join(', ') : 'none'}`,
-    )
-    this.status = status
+  constructor(status: number) {
+    super(`Cloudflare did not send the email: status ${status}`)
   }
 }
```

**Remediation brief**
- **Design intent:** The adapter rejects on a non-2xx status, a body whose `success` is not `true`, or a permanent bounce; the notifier reports the rejection once with the message ID. Error messages pass through the reporter's scrub, which keeps a three-digit status and no other number, so the status is the one diagnostic that survives. Keeping the codes would need an allowlisted context key in `packages/reporter/src/scrub.ts`, which is outside this branch's path.
- **Full surface:** `apps/api/src/notification-email.ts:85-133`; `apps/api/src/notification-email.test.ts` (any assertion on the message text, `grep -n "error codes" apps/api/src/notification-email.test.ts`); `apps/api/src/feedback.test.ts:451` (a fake failure whose message names "error codes none", which can stay or drop the phrase).
- **Must preserve:** every rejection case in `notification-email.test.ts` (non-2xx, `success: false`, unparseable body, permanent bounce, timeout); the bounce error; no Cloudflare message text in the error.
- **Do not touch:** the scrubber.
- **Proof:** `pnpm exec vitest run apps/api/src/notification-email.test.ts apps/api/src/feedback.test.ts` and `pnpm typecheck` green; `grep -n errorCodesOf apps/api/src` empty.

### 7. Two new privacy page tests are copy tests — LOW
- **Location:** `apps/site/test/site.test.ts:1274-1301`
- **Attribution:** introduced, `c1e5239e` creator-analytics#582 (`git log -S'reply address only when you choose'`).
- **Real-world trigger:** Nick rewords the feedback items of the privacy policy, and the suite goes red with no code broken; or the retention changes to two years in the database and the tests stay green.

**Evidence**
```ts
    const facts = [/delete your account/, /one year after it is handled/]

    expect(facts.filter((fact) => !fact.test(item))).toEqual([])
```

**Failure mode** — `CODING_STANDARDS.md` standard 2: "No test asserts that fixed copy is present", with "the privacy policy contains the Limited Use statement" as its own example. The phrases are written by hand in the test, not derived from the schema or the retention interval, so the tests restate the copy. The comment block at `:1129-1134` already says the policy's claims "rest on Nick's copy approval on … #582".

**Recommended fix** — delete both tests and the `feedbackItemsOf` helper (`:1267-1272`), and drop "The feedback message tests hold the facts its two items name, not their sentences." from the comment at `:1133-1134`, keeping #582 in its approval list.

**Remediation brief**
- **Design intent:** Copy on the privacy page is held by Nick's approval on its issue, not by the suite. A test over copy stays only when its rule comes from somewhere else (a host list from the manifest, no em-dash anywhere).
- **Full surface:** `apps/site/test/site.test.ts:1129-1134`, `:1267-1301`.
- **Must preserve:** every other test in `describe('seam 1: the privacy policy and the terms')`; the site's em-dash and link rules.
- **Do not touch:** the pre-existing copy tests in that file at base (out of this branch's scope).
- **Proof:** `pnpm exec vitest run apps/site/test/site.test.ts` and `pnpm lint` green; `grep -n "one year after it is handled" apps/site/test/site.test.ts` empty.

### 8. Three of the spec's rules have no test, and one new test cannot fail — LOW
- **Location:** `apps/api/src/feedback.test.ts` (no unknown-key case), `apps/web/src/app.test.ts:6956-6973` (no focus assertion), `apps/web/src/app.test.ts:7230-7237`, `apps/web/src/route.test.ts:960-964`
- **Attribution:** introduced, `c1e5239e` (#582) and `64ff50ce` (#583).
- **Real-world trigger:** a change that refuses an unknown body key (breaking an older web app tab during a deploy), drops the focus move after a send, or stops rendering the admin screen, and the suite stays green.

**Evidence**
```ts
  test('with one page, shows no paging', async () => {
    const api = installFakeApi()
    api.adminFeedback = adminMessages()
    const { container } = await render('admin/feedback')

    expect(buttonsNamed(container, olderText)).toEqual([])
    expect(buttonsNamed(container, newerText)).toEqual([])
  })
```

**Failure mode**
- R3 "a body key the API does not know is ignored" (#582's assumption, kept so #586 could add `appVersion` without a coordinated release): `grep -n "ignore\|extra" apps/api/src/feedback.test.ts` finds nothing; #586 replaced the one test that sent `version`.
- R8 "after a send, focus moves to the thank-you line" (`apps/web/src/Feedback.tsx:76-78`): no test reads `document.activeElement` after a send.
- "with one page, shows no paging" asserts absence only, so it passes when the screen renders nothing (green at `$BASE`).
- route.test.ts "the link back to the list keeps the list's route and leaves the admin screen" never asserts it started on the admin screen (green at `$BASE`).

**Recommended fix**
- `apps/api/src/feedback.test.ts`: `test('a body key the API does not know is ignored', …)` sending `{ ...message, colour: 'red' }` and expecting 201 and one saved row.
- `apps/web/src/app.test.ts`: in the send test at `:6956`, `expect(container.ownerDocument.activeElement).toBe(container.querySelector('.feedback-thanks'))`.
- `:7230`: first `expect(topHeadingIn(container)).toBe(adminFeedbackHeading)` and `expect(adminMessagesIn(container)).toHaveLength(2)`.
- `route.test.ts:960`: first `expect(route.adminFeedback).toBe(true)`.

**Remediation brief**
- **Design intent:** Each test states one rule from the epic as a fact about what the unit returns or renders (`CODING_STANDARDS.md` standard 2); a test that passes when the screen is absent states no rule.
- **Full surface:** the four sites above.
- **Must preserve:** every existing assertion in those tests.
- **Do not touch:** `apps/api/src/server.test.ts:116` and `:127` (Dismissed: both go red if the settings check misfires).
- **Proof:** each new assertion is red against a one-line mutant (accept only known keys in `feedbackOf`; drop the focus effect; render `null` from `AdminFeedback`) and green at HEAD; `pnpm exec vitest run apps/api/src/feedback.test.ts apps/web/src/app.test.ts apps/web/src/route.test.ts` green.

### 9. Comment hygiene — LOW (aggregated)
- `docs/deploy.md:159` — "An address on any other domain is refused." → "Cloudflare refuses an address on any other domain when it sends, so every notification then fails and is reported to GlitchTip; the API checks only that it is an email address."
- `apps/api/Dockerfile:58` — "(the feedback notification email; all four or none, with some but not all the API refuses to start)" → "(the feedback notification email; all four or none, and with some but not all, or a from or to address that is not an email address, the API refuses to start)", rewrapped at 100 columns.
- `packages/database/src/feedback.ts:24-25` — "The API's test of every value those types allow keeps the two in step." → "The API's test of every value those types allow keeps this set covering the API's; a value dropped from the API stays allowed here until it is dropped here too."
- `packages/database/src/feedback.ts`, the JSDoc of `feedbackCountToday` — add "The lock serialises two sends only under READ COMMITTED, the isolation every scope runs in: a transaction snapshot taken before the lock would miss the first send." (on the TypeScript side, not in 0025, whose file must not change once applied).
- `apps/web/src/Sidebar.tsx:52-53` — "and no place for the support item or the picker" → "and no place for the "Send feedback" item, the support item or the picker"; rewrap `:45`, which runs past 100 columns.
- `apps/api/src/feedback.ts:39-41`, `apps/web/src/route.ts:30-34`, `:196`, `:276`, `:330`, `apps/web/src/sidebar-column.ts:7`, `apps/web/src/Sidebar.tsx:226` — reflowed comment lines over 100 columns with ragged neighbours → rewrap to 100 columns, no wording change.

## Needs Further Investigation

### A. A list read in flight when a "Done" save lands can overwrite the saved state — confirm with a test whose fake API holds a `GET /api/admin/feedback` answer until after a `PUT …/done` resolves (toggle the filter, tick a box, then release the read): if the box shows unticked after the read lands, it is real. `AdminFeedback.tsx:101-107` and `:122` (finder C, not run). Finding 1's fix narrows it under the filter but not unfiltered.

### B. Whether `reporter.report` can throw inside `createFeedbackNotifier` — if it can, a saved message answers 500 and the form keeps the text and invites a duplicate. Read `packages/reporter/src/index.ts`'s `report` for any throwing path; `apps/api/src/feedback-notice.ts:66-78`.

## Reviewed and Dismissed
- The admin routes answer a signed-out visitor 404 rather than 401 — the epic asks for it ("404 for a non-admin and for everyone with an empty allowlist"), and #583's assumptions flagged the trade to Nick. Only the comments are wrong (finding 3).
- The daily-limit race — the advisory lock is the two-int4 form, held to transaction end, and the count and the insert share one READ COMMITTED transaction; the function's inner SELECT snapshots after the lock (finder A, executed).
- `feedback_count_today` grants and search path — SECURITY DEFINER, `search_path = pg_catalog, public`, EXECUTE revoked from PUBLIC (finder A, read back from `pg_proc`).
- The admin scope's column reach — `app_web` holds UPDATE on `done_at` only (0027); the update policy admits rows only in the admin scope.
- "Delete me" and RLS — the cascade bypasses row security, as referential actions do; tested in `packages/database/test/feedback.test.ts`.
- The count failing open on an unset `app.now` — `enter()` always sets it (`packages/database/src/scopes.ts:78`); unreachable.
- The Cloudflare request body — `to` as a string and `from: { address, name }` match the REST docs.
- No request body size limit on `POST /api/feedback` — pre-existing, untouched: `/api/events` reads its body the same way at base. Follow-up ticket material, not this branch.
- `page=01` accepted, a page past `Number.MAX_SAFE_INTEGER` answered 400 — #583's recorded assumption.
- `pageCount` and `messages` read in two statements — one transaction, cosmetic at worst.
- Zero-width and bidi characters surviving the clean — the epic strips control characters (Cc) only.
- The retention rule tested in both the policy test and the engine test — the house pattern: the deletion log and deletion request retention do the same (`packages/retention-engine/src/retention-engine.test.ts:304`, `:346`).
- `asAdmin` setting `app.user_id` that nothing reads — #583's recorded assumption, and every policy reading it also checks the user scope (finder A, grep of every policy).
- The `// pending Nick's word-for-word approval` markers — load-bearing until Nick approves; the epic requires word-for-word approval of every string.
- A non-404 failure shows the admin heading — R9 reads only a 404 as "not an admin".
- `apps/api/src/server.test.ts:116` and `:127` green at `$BASE` — each goes red if the email settings check misfires on none or on all four.
- Untrusted text rendering — no `dangerouslySetInnerHTML`, no `href` or `mailto` from the address; the browser walk finds both payloads as text.
- The screen sent in every entry path — sidebar, narrow row, reload, Back and a typed URL all carry the screen the creator came from (finder C).
- The form's screen and version held in state at mount while the line reads props — no path changes the props without a remount today.

## Minor / nits
- `packages/database/src/feedback.ts`, `feedbackCountToday`'s `?? 0` is dead (the select always returns one row or raises) and would fail open.
- `apps/web/src/Feedback.tsx`: pressing Send twice with the same gap sets the same alert text, which a screen reader does not announce again; the radio group and text box get no `aria-invalid` for an incomplete form.
- After a send, "Send feedback" in the sidebar does not reopen the form until the creator visits another screen.
- Leaving the form while a send is in flight loses the text if that send then fails.
- The admin screen shows no busy state while a later page loads; a failed later-page read hides the paging buttons.
- `typeWords` in `apps/api/src/feedback-notice.ts:20-24` copies the form's type labels; nothing ties them together.
- `c.json({ error: 'not_found' }, 404)` now exists three times in `apps/api`; `emailSettingsOf` hard-codes the four names its map already holds; `isReplyAddress` also checks the from and to settings under a reply-address name.
- `readFeedbackMessages` leaves the outer test transaction as `app_web` in the fixture scope.
- `notification-email.test.ts`'s timeout case uses `rejects.toThrow()`, which any rejection passes; `name: 'TimeoutError'` would pin it.
- `app.test.ts:7025`'s `user-` pattern is redundant: the `toEqual` above it pins the events exactly.
- No index on `done_at` for the nightly delete; fine at current volume.

## Test quality
Tests added: 90 in 7 new files, plus 73 new or changed cases in 11 modified files. Green against `$BASE`: 10 cases, none from a review-finding commit. Of those, `route.test.ts:953` (4 cases), `scopes.test.ts:510`, `app.test.ts:5097` and `server.test.ts:116` and `:127` are valid negative or boundary guards and stay; `app.test.ts:7230` and `route.test.ts:960` need a precondition (finding 8). Tautology shapes found: 2 copy tests (finding 7); a mutant-proof gap in the count scope test (finding 5); expectations computed with the production helper `contextLineOf` at `app.test.ts:6821`, `:6833`, `:6843` (they catch a wrong argument but not a wrong line; the helper's own tests in `feedback.test.ts:44-61` hold the line), left as is; copy-leaning literals in `apps/web/src/admin-feedback.test.ts:40-56`, `:111`, `:122`, `:157` and `apps/api/src/feedback.test.ts:374-386`, `:462`, which observe a branch through its text and stay.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `62f34c77`; the browser walk is green.
- **Commit hygiene:** the tree is clean; commit this doc and `repro/` together.
- **Likely reviewer asks:** the three migrations (0025 to 0027) and the new role `app_feedback_count`; the `ADMIN_USER_IDS` and four email settings in Dokploy; the strings pending Nick's word-for-word approval (form, admin screen, email, privacy policy "Last updated" date); OpenPanel's two new events; #587's production walk.

## Verdict
Ready to open a PR, with follow-ups. Nothing gates it: there is no CRITICAL, HIGH or MEDIUM finding. Remediate findings 1, 2, 3, 5, 6, 7, 8 and 9 in this branch, since each is a small change with its proof named. Finding 4 is a schema migration with no user path, so either remediate it with Nick's go-ahead or file it as a follow-up ticket.
