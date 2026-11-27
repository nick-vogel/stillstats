# Pre-PR review: creator-analytics#569 Feedback form follow-ups (#750, #751)

**Branch:** `creator-analytics-569-feedback-form` vs `origin/main` (merge-base `a954964c891bf73792d6f19484b14cc6469741be`, "Merge pull request #762 from nick-vogel/creator-analytics-237-upload-markers")
**Reviewed at:** HEAD `aeec27ae22263e9df257574322d39d933eb503c9` (creator-analytics#751 A "Send feedback" link in the extension popup) + 0 files with uncommitted changes, 0 untracked files, 28 files total, +2,392 / −143 (1,999 of the added lines are `packages/database/drizzle/meta/0028_snapshot.json`; without it, 27 files, +393 / −143)
**Delta under review:** since `62f34c776586a17406066ac0a926921e672baa6d` (creator-analytics#583 The feedback admin screen), the HEAD that pre-PR review 1 reviewed. That commit, and review 1 itself (`dd2973ba`), are on `origin/main` through PR #749 (`bb6e3b7b`), so they sit inside `$BASE`. The delta is therefore the whole `$BASE` surface above: the four commits of #750 (`ee5e4156`, merged as `63a603d7`) and #751 (`8cf442a9`, merged as `aeec27ae`).
**Reviewed against:** creator-analytics#569 (the epic body, the spec), #750 and #751 (the two tickets on this branch, both approved by Nick word for word for their strings), the recorded epic-loop assumptions for #750 and #751, `CODING_STANDARDS.md` sections 1 to 3, `CONTEXT.md`, pre-PR review 1's finding headings and Approach decisions.
**Date:** 2026-11-16
**Reviewer:** 2 code-review agents + 1 tautology-audit agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | up to date |
| Lint | `pnpm lint` (biome, 715 files) | green |
| Typecheck | `pnpm typecheck` | green |
| Build | `pnpm build` | green (the existing 500 kB chunk warning only) |
| Tests | `pnpm test` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | 175 files, 4,565 passed, 1 expected fail |
| Browser walk | `pnpm run --if-present test:browser` | passed, no CSP violation in 109 steps |
| Tautology audit | scratch worktree at `$BASE`, the 8 modified test files copied in at HEAD, `vitest run --reporter=json` | 23 new or changed cases: 15 red, 8 green at base; the 15 base failures are exactly the 15 red cases. No new test file. See Test quality |
| Finding 1 | `docs/reviews/creator-analytics-569/repro/policy-event-clauses.mutant.sh` in a scratch worktree at `aeec27ae`: the policy's install, page and YouTube access clauses deleted, then `pnpm exec vitest run apps/site/test/site.test.ts` | 73 of 73 green with the clauses gone. Same mutant with `$BASE`'s `site.test.ts`: 1 failed (the word-for-word test) |
| Finding 1, absence | `git grep -n "was installed" -- '*.test.ts' apps/site/test` | no test outside the removed array names the clause |
| Migration 0028 | finder B: structural JSON diff of `0027_snapshot.json` against `0028_snapshot.json`; the SQL against 0025's constraint | only the `feedback_messages_screen` CHECK gained `'extension'`; `prevId` is 0027's id; journal idx 28 |
| `extension` end to end | finder B: `apps/api/src/feedback.test.ts:89` iterates `feedbackScreens` against Postgres; `apps/api/src/routes/events.ts:23` allowlists from `valuelessExtensionEventNames`; the background's `usage-event` case passes any name | accepted by the database and the API; the event reaches the relay |
| Reset form | finder A: state reset, focus timing, `feedback_opened` re-fire, a reset racing a send; `pnpm exec vitest run apps/web/src/app.test.ts -t "the feedback form"` | 21 passed; no race (Reset form exists only after a send resolved); `feedback_opened` cannot re-fire (no remount, `opened` ref) |
| Popup tests in isolation | finder B: `popup-page.test.ts`, `popup.test.ts`, `route.test.ts`, `admin-feedback.test.ts` | 271 of 271 |
| Repo visibility (deploy guide names Nick's address) | `gh api repos/nick-vogel/creator-analytics --jq .visibility` | private |
| Not run | `drizzle-kit generate` (it writes into the worktree; the snapshot string equals what `oneOf(feedbackScreens)` produces, so no further diff is expected), a real Chrome Web Store build of 0.3.0, the email on staging | covered by #587's production walk and the extension release |

**Overall:** Both tickets meet their specs. The context line is gone while the screen and version still travel with each send, Reset form brings back a complete empty form with focus on the first type, the popup's link opens `/app/feedback?screen=extension` only in the signed-in views, and the database, the API and the admin screen all follow the shared screen list. Every full check is green. The review confirmed five LOW findings and nothing at MEDIUM or above. The most useful one: in moving the privacy policy's usage-events sentence out of its word-for-word test, #751 left the policy's install, page and YouTube access clauses with no test at all, which a mutant proved. The rest is staging-email doc drift, two new form tests that assert nothing of their own, a copied CSS rule, and comment hygiene. The branch is ready to open a PR.

## Approach decisions
- Carried from review 1: copy pending Nick's word-for-word approval stays marked inline with `// pending Nick's word-for-word approval`; a remediation that changes such a string keeps the marker and records the new wording in the ticket's assumptions. Strings Nick approved carry `// approved by Nick on <date> (creator-analytics#<n>)` (the #750 assumption).
- Carried from review 1 (not exercised here): admin list freshness under the open filter, and test-only writes through a `fixture`-scope policy. Their findings are follow-up issues #740 and #748.
- New, privacy policy facts about the extension: a policy claim about what the extension sends is held by a rule over the copy from somewhere other than the copy, keyed on the shared event lists in `packages/api-types/src/events.ts` with a `satisfies Record<…>` so a new event fails the typecheck until the policy test names it. Precedent: the host fact tests in `apps/site/test/site.test.ts:1181-1203`, which key on `hostOriginsOf` and `manifestOf`, and this branch's own click fact test at `:1204-1233`.

## Prior-review closure
Pre-PR review 1 confirmed nine LOW findings at `62f34c77`. None were remediated on that branch, and PR #749 merged them to `main`. Its closure for this round:
- Fully fixed: 0.
- Partially fixed: 0.
- Untouched: 9, all pre-existing on `$BASE` and outside this branch's diff. Four are open follow-up issues: finding 1 as #740, finding 2 as #735, finding 4 as #748, finding 6 as #738. Findings 3, 5, 7, 8 and 9 were not found as issues in a search of `"pre-PR review 1" 569`; whether they were filed under other wording was not checked. None is MEDIUM or higher.
- This branch touches two of their surfaces without changing them: `docs/deploy.md:148` still says every route under `/api/admin/` answers 404 "as an unknown route does" (review 1 finding 3), and the `apps/site/test/site.test.ts` privacy section still holds copy tests (review 1 finding 7, and Minor below).

## Confirmed Issues
### 1. The privacy policy's install, page and YouTube access clauses lost their only test — LOW
- **Location:** `apps/site/test/site.test.ts:1235-1249` (the word-for-word test, its usage-events sentence removed) and `:1204-1233` (the new click fact test, which replaces only the sentence's last clause)
- **Attribution:** introduced, `8cf442a9` creator-analytics#751 A "Send feedback" link in the extension popup (`git log -S'a few usage events to stillstats.com: that it was installed' a954964c..HEAD`). At `$BASE` the sentence sat in the `approved` array.
- **Real-world trigger:** an edit to the policy's extension section (a later wording change, a reflow) drops or garbles "that it was installed", the page clause, or the YouTube access clause, and the suite stays green while the published policy stops naming events the extension still sends. No user path today: the text is unchanged. LOW, capped: the class is consent (what the policy tells a creator is sent), so upgrade to MEDIUM if any later diff edits `apps/site/privacy.html`'s "It sends a few usage events" paragraph, check via `git log -p -- apps/site/privacy.html`.

**Evidence**
```ts
    const approved = [
      'The Stillstats extension for Chrome and Firefox works on studio.youtube.com and stillstats.com, and on www.youtube.com only if you turn that on.',
      'It does not read the numbers, text or anything else on the page.',
-      "It sends a few usage events to stillstats.com: that it was installed, which kind of page showed ...
       `If you turn on "Show engaged views on youtube.com" in the extension's popup, ...`,
    ]
```
The new test checks one clause only: `new RegExp(\`click[^.]*\\blinks?\\b[^.]*${host}\`)`.

**Failure mode** — `repro/policy-event-clauses.mutant.sh` deletes "that it was installed, which kind of page showed a number or could not (…), when you turn on access to www.youtube.com and when you or your browser remove it, and " from `privacy.html` in a scratch checkout at `aeec27ae`. `apps/site/test/site.test.ts` answers 73 of 73 green. With `$BASE`'s `site.test.ts` on the same mutant, the word-for-word test fails. The block comment at `:1137-1139` concedes it: "the rest of the events that sentence names rest on that approval (#751)".

**Recommended fix** — keep the new click test, drop its two-rule line, and add one fact test that keys every extension event to the clause that names it, in the `seam 1: the privacy policy and the terms` describe:
```ts
import {
  productOrigin,
  surfaceExtensionEventNames,
  valuelessExtensionEventNames,
} from '@creator-analytics/api-types'
```
```ts
  test("the privacy policy's Studio extension section names every usage event the extension sends", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'The Studio extension'))
    const click = /\bwhen you click one of its links to stillstats\.com\b/
    const page = /\bwhich kind of page showed a number or could not\b/
    const clauseOf = {
      extension_installed: /\bthat it was installed\b/,
      extension_popup_web_app_opened: click,
      extension_popup_feedback_opened: click,
      extension_popup_sign_in_clicked: click,
      extension_youtube_access_granted: /\bwhen you turn on access to www\.youtube\.com\b/,
      extension_youtube_access_removed: /\bwhen you or your browser remove it\b/,
      extension_surface_shown: page,
      extension_surface_missing: page,
      extension_web_app_opened: click,
      extension_sign_in_clicked: click,
      extension_connect_channel_clicked: click,
    } satisfies Record<
      | (typeof valuelessExtensionEventNames)[number]
      | (typeof surfaceExtensionEventNames)[number],
      RegExp
    >
    const events = [...valuelessExtensionEventNames, ...surfaceExtensionEventNames]

    expect(events.filter((event) => !clauseOf[event].test(text))).toEqual([])
  })
```
In the click test at `:1224`, delete `expect(new Set(clicked.map(({ event }) => event))).toContain('extension_popup_feedback_opened')`. Rewrite the block comment's sentence at `:1136-1140` to say the usage-events sentence is held by the two fact tests (every event named, every clicked link's host named), not by approval.

**Remediation brief**
- **Design intent:** the privacy section's tests hold what the policy claims about the extension. A claim with a source of truth in code (hosts in the manifest, links in the popup, events in `packages/api-types/src/events.ts`) is held by a rule that reads that source, so the test fails when the code and the policy part, never when a word changes. `textOf` collapses whitespace, so a clause matches across the HTML's line breaks. `satisfies Record<…>` makes a new event a type error in this file until it gets a clause.
- **Full surface:** `apps/site/test/site.test.ts:30` (the api-types import), `:1136-1140` (the block comment), `:1204-1233` (the click test, one line out), a new test beside it; `packages/api-types/src/events.ts:20-63` is read only.
- **Must preserve:** the click fact test's host rule (`expect(hosts).toEqual(['stillstats.com'])` and the regex filter); the `approved` array's three remaining sentences and its test name (their copy-test status is Minor below, not this finding); `apps/site/privacy.html` unchanged; all 73 tests of `apps/site/test/site.test.ts` green.
- **Do not touch:** `apps/site/privacy.html`'s wording (the #751 assumption: no new policy sentence without Nick's approval, see Reviewed and Dismissed); the popup's `PopupRead` list in the click test (Minor).
- **Proof:** red now, green after: `git worktree add --detach <scratchpad>/mut <fix sha> && (cd <scratchpad>/mut && pnpm install --frozen-lockfile --prefer-offline) && docs/reviews/creator-analytics-569/repro/policy-event-clauses.mutant.sh <scratchpad>/mut`, run from the repo root. At `aeec27ae` it prints `MUTANT SURVIVED` and exits 1; after the fix it must print `MUTANT KILLED` and exit 0. Then `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/site/test/site.test.ts` green in the worktree, and `pnpm typecheck`. Remove the scratch worktree afterwards.

### 2. The docs disagree on whether staging sends the feedback email — LOW
- **Location:** `docs/deploy.md:155`, `README.md:122`, `apps/api/src/server.ts:75`
- **Attribution:** introduced, `ee5e4156` creator-analytics#750 (`git log -S'staging sets them as well' a954964c..HEAD`). #750 changed the deploy guide's API paragraph (`:148`) to "staging may set them too", wrote `:155` as a fact ("staging sets them as well"), and left two older "as on staging, nothing is sent" lines standing; `README.md:122` was edited by `8cf442a9` in the same paragraph and kept its clause.
- **Real-world trigger:** Nick, or an agent reading the README, debugs a staging email (or its absence) and is told staging sets none, or that it sets all four. Docs drift with no product effect, so LOW.

**Evidence**
```
docs/deploy.md:148  Production sets them, and staging may set them too, so Nick can test the email there, ...
docs/deploy.md:155  Production sets the four settings, and staging sets them as well while Nick tests the email there.
README.md:122       With the four email settings unset, as on staging, nothing is sent (see `docs/deploy.md`).
server.ts:75        // None set, as on staging, the API saves feedback messages and emails no one.
```

**Failure mode** — three statements about one setting: "may set", "sets", "sets none". #750's spec item 4 says "staging may set them".

**Recommended fix**
```diff
-Production sets the four settings, and staging sets them as well while Nick tests the email there. With none set, an environment saves each message and sends no email:
+Production sets the four settings, and staging may set them while Nick tests the email there. With none set, an environment saves each message and sends no email:
```
```diff
-With the four email settings unset, as on staging, nothing is sent (see `docs/deploy.md`).
+With the four email settings unset, nothing is sent (see `docs/deploy.md`).
```
```diff
-  // None set, as on staging, the API saves feedback messages and emails no one.
+  // None set, the API saves feedback messages and emails no one.
```

**Remediation brief**
- **Design intent:** the four email settings are all-or-none in every environment; production sets them, staging may (Nick's choice on #750, reversing the epic's user story 37). The deploy guide is the source of truth and the README and the code comment defer to it.
- **Full surface:** `docs/deploy.md:155`, `README.md:122`, `apps/api/src/server.ts:75`. `docs/deploy.md:148` already reads "may" and stays.
- **Must preserve:** every other clause of the three lines, including the all-or-none rule and the `(see docs/deploy.md)` pointer; no code change in `server.ts` beyond the comment.
- **Do not touch:** the from and to addresses at `docs/deploy.md:159-160` (a recorded #750 assumption Nick confirms at the PR walk); `:148`'s Access clause (Reviewed and Dismissed).
- **Proof:** `git grep -n -i "as on staging\|staging sets them as well\|staging sets none" -- README.md docs/deploy.md apps/api/src` prints nothing after the fix (it prints 3 lines now); `pnpm lint`.

### 3. Two new feedback form tests assert nothing of their own — LOW
- **Location:** `apps/web/src/app.test.ts:6976-6977` (the `test.for` over a version and no version) and `:7138-7154` (`a second send refused for the daily limit shows the daily-limit alert and keeps its text`)
- **Attribution:** introduced, `ee5e4156` creator-analytics#750 (`git log -S'a second send refused for the daily limit' a954964c..HEAD`).
- **Real-world trigger:** none for a user; these are claims of coverage the suite does not have. LOW, per CODING_STANDARDS.md section 2 ("a test that passes whatever the implementation does", "one rule, one test").

**Evidence**
```ts
      const formText = container.querySelector('form')?.textContent ?? ''
      expect(formText).not.toContain('2026.11.9')
```
```ts
  // Each send is its own POST, which the API counts toward the daily limit in its database
  // (apps/api/src/feedback.test.ts holds the count), so the fake refuses the second as the API would.
  test('a second send refused for the daily limit shows the daily-limit alert and keeps its text', async () => {
    ...
    api.failNext('POST /api/feedback', { status: 429, body: { error: 'rate_limited' } })
```

**Failure mode** — in the `['no version', null]` row the client settings answer no version, so nothing could render `2026.11.9`, and the assertion passes whatever the form shows; the literal also ignores the row's own `version`. The daily-limit test drives the same 429 path as the existing `on %s, the text stays and the alert says why` row at `:7189`; `reset()` touches nothing on the alert path (`alert` is already null and `sending` false whenever Reset form shows), so no change to `Feedback.tsx` fails this test while that row passes, and the second-send half is already `a second send from the reset form posts again with the same screen` at `:7121`. Its comment also says "the fake refuses the second as the API would", but `failNext` forces the refusal; the fake counts nothing.

**Recommended fix**
```diff
       const formText = container.querySelector('form')?.textContent ?? ''
-      expect(formText).not.toContain('2026.11.9')
+      if (version !== null) expect(formText).not.toContain(version)
       expect(formText).not.toContain(screenNames.audience)
```
Delete the comment and the test at `app.test.ts:7138-7154`.

**Remediation brief**
- **Design intent:** #750 removes the context line; the screen and version still travel in the POST body. Each form test states one rule from #750 or the epic: the form shows neither (the `test.for`), a second send from a reset form posts (`:7121`), and a 429 shows the daily-limit alert and keeps the text (`:7189`'s row). The count of the daily limit lives in the API, where `apps/api/src/feedback.test.ts:307` and `:325` hold it.
- **Full surface:** `apps/web/src/app.test.ts:6976-6977`, `:7138-7154`.
- **Must preserve:** the `test.for`'s send-payload assertion (`toStrictEqual` with `appVersion` only when the row has one) and its `screenNames.audience` absence check; `:7121`, `:7098`, `:7156`, and the `:7189` table's 429 row; `dailyLimitText` stays imported if another test still reads it.
- **Do not touch:** `apps/web/src/Feedback.tsx`'s `reset()` (Minor: its two defensive resets stay); the `Reset form sends no event` test at `:7156` (Test quality: it states #750's no-event rule).
- **Proof:** `env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run apps/web/src/app.test.ts -t "feedback"` green with one test fewer; `pnpm typecheck`; `pnpm lint` (an unused import fails it). The #750 assumption "Counted in the daily limit at the web app's layer" is reversed by this deletion: record that in `.epic-loop/tickets/750/assumptions.md` or the remediation's closure row.

### 4. The Reset form rule copies the sidebar Hide control's text-button declarations — LOW
- **Location:** `apps/web/src/app.css:340-354` (`.feedback-reset`, `.feedback-reset:hover`) against `:2461-2474` (`.sidebar-support button`, `:hover`)
- **Attribution:** introduced, `ee5e4156` creator-analytics#750 (`git log -S'text-decoration-color: var(--line)' a954964c..HEAD`). The comment above it says the copy is deliberate: "as the sidebar's Hide control does".
- **Real-world trigger:** a later restyle of the sidebar's Hide control (its underline colour, its hover) leaves Reset form on the old look. CODING_STANDARDS.md section 3 (the second copy of a rule, on a line the change wrote). LOW.

**Evidence**
```css
.feedback-reset {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
  cursor: pointer;
}
```
`.sidebar-support button` at `:2461-2470` holds the same eight declarations after `justify-self`, and its `:hover` the same `text-decoration-color: var(--accent)`.

**Failure mode** — two copies of one visual rule, held in step by nothing.

**Recommended fix**
```diff
 .feedback-reset {
   justify-self: start;
-  padding: 0;
-  border: 0;
-  background: transparent;
-  color: inherit;
-  font: inherit;
-  text-decoration: underline;
-  text-decoration-color: var(--line);
-  cursor: pointer;
 }
-
-.feedback-reset:hover {
-  text-decoration-color: var(--accent);
-}
```
```diff
-.sidebar-support button {
+.sidebar-support button,
+.feedback-reset {
   padding: 0;
```
```diff
-.sidebar-support button:hover {
+.sidebar-support button:hover,
+.feedback-reset:hover {
   text-decoration-color: var(--accent);
 }
```
Update the comment above `.feedback-sent` to say Reset form shares the Hide control's text-button rule.

**Remediation brief**
- **Design intent:** a plain text button (no box, inherited colour and font, a soft underline that takes the accent on hover) is one look in the web app, used by the sidebar's Hide control and now Reset form. `.feedback-reset` keeps only its layout (`justify-self: start` in the `.feedback-sent` grid).
- **Full surface:** `apps/web/src/app.css:333-354` and `:2461-2474`.
- **Must preserve:** every declaration either control resolves to today. Moving the declarations later in the file is safe: no rule between `:354` and `:2461` sets them on a `button` with higher specificity (`grep -nE '\.feedback[^{]*button|\.feedback-sent' apps/web/src/app.css` finds only `.feedback-form .button`, which does not match Reset form). The browser's default focus-visible ring stays on both (no rule removes it).
- **Do not touch:** `.feedback-thanks:focus { outline: none; }` (the line is a programmatic focus target with `tabIndex={-1}`, not a control).
- **Proof:** jsdom evaluates no stylesheet, so no unit test can see this. `pnpm lint`, `pnpm build`, and `pnpm run test:browser` green; then a look at the sent state in `pnpm --filter @creator-analytics/web dev` or the staging walk.

### 5. Comment hygiene — LOW (aggregated)
- `apps/web/src/feedback.ts:13-14` — "Every string here is pending Nick's word-for-word approval (creator-analytics#582). Change them only with Nick." → "Each string here is marked on its line as approved by Nick or pending his word-for-word approval. Change them only with Nick." (`feedbackThanksText`, `resetFormText` and `screenNames.extension` are now approved)
- `apps/web/src/route.ts:81-83` — "`extension` arrives only in the address the extension popup's "Send feedback" link opens, and is never a screen the web app shows." → "`extension` names the extension popup's "Send feedback" link; the web app never derives it from a screen it shows." (the sidebar link on a form opened from the popup keeps `extension`, through `feedbackScreenOf` at `:465-466`)
- `apps/web/src/admin-feedback.ts:36` — "/** The screen's name, from `screenNames`. */" → delete the line (it restates the one-line body)
- `apps/web/src/admin-feedback.test.ts:3` — "Every expected text is written out here, never taken from the module." → "Every expected text is written out here, never taken from the module; the screen names test holds a rule over the shared screen list instead."
- `apps/site/privacy.html:83` — "…and #539's youtube.com wording, and #751's feedback link, which the links sentence covers." → "…and #539's youtube.com wording. #751's "Send feedback" link changed no wording: the links sentence already covers it." (Nick approved no policy wording on #751)
- `apps/site/test/site.test.ts:1136-1144` — the block is wrapped at 100 but `:1140` runs to 166 characters and `:1136`, `:1144` past 100 → rewrap at 100 (finding 1 rewrites `:1136-1140`'s sentence; do both in one commit if finding 1 lands first)

## Needs Further Investigation
None.

## Reviewed and Dismissed
- The privacy policy names neither `extension_popup_feedback_opened` nor the `extension` screen, though #751's "Where" lists `privacy.html` — a recorded #751 assumption: the approved sentence "when you click one of its links to stillstats.com" already covers the click, and no new policy sentence goes in without Nick's word-for-word approval. Nick decides at the PR walk; this is a decision, not a defect.
- #751's "the form names the screen 'the extension'" cannot hold, since #750 removed the context line — superseded by #750 by Nick's choice; the name shows on the admin screen.
- `Feedback.tsx:91` reads the current `version` while the first state was built from the mount's — `main.tsx:28` awaits the client settings before App mounts, so the two cannot differ.
- Reset form racing an in-flight send — the control exists only after a send resolved and `sent` turns true only on success.
- `feedback_opened` re-firing on reset — `Feedback` is not remounted and the effect sits behind the `opened` ref; `Reset form sends no event` (`app.test.ts:7156`) would catch a remount.
- Focus after reset landing nowhere — the `[sent]` effect runs after the commit that mounts the form, so `formElement.current` is set; the test at `:7098` asserts `activeElement` is the first radio.
- Migration 0028 on existing rows — DROP then ADD of a wider CHECK; every existing row passes; no RLS policy reads `screen`.
- `docs/deploy.md:148` "since only he reaches staging through Access" while the staging extension build also passes Access with a service token — the token is Nick's own build, so the clause holds for who can send a staging message.
- The deploy guide publishing Nick's address: the repository is private (`gh api … --jq .visibility`); the address is the epic's own verified destination.
- The popup link losing `screen=extension` through a sign-in round trip (`apps/api/src/app.ts:191-194`) — pre-existing for every deep link, and reachable only if the web session ends between the popup's signed-in read and the click, since both use one cookie.
- The click fact test scanning only top-level view properties of each popup view: every `PopupLink` in `PopupView` is top level today, and an empty scan fails `expect(hosts).toEqual(['stillstats.com'])`, so the test cannot pass by finding no link once finding 1 removes its `toContain` line.

## Minor / nits
- `apps/extension/src/popup.ts:106` writes the screen as a bare `'extension'` in the address, untied to `FeedbackScreen`; a rename in `feedbackScreens` would compile and the web app would fall back to `video_list`. `'extension' satisfies FeedbackScreen` would tie it.
- `apps/web/src/Feedback.tsx:92-93`: `setAddressRefused(false)` and `setAlert(null)` in `reset()` are no-ops today (a successful send already cleared both). Harmless and symmetric with the empty form; leave them.
- `apps/site/test/screenshot/browser-walk.ts:644-663` never sends, so the thank-you line and Reset form are never rendered in Chrome under the CSP. A plain button and paragraph carry no CSP risk; the stub already answers `POST /api/feedback` (`stub-api.ts:817`) if the walk should reach them. Its `'Audience'` literal copies `screenNames.audience` by the walk's convention.
- `apps/site/test/site.test.ts:1235-1249` still holds three approved sentences word for word, a copy test under CODING_STANDARDS.md section 2 (pre-existing, review 1 finding 7's kind).
- `apps/site/test/site.test.ts:1210-1216` lists the popup reads by hand; a `satisfies Record<PopupRead['state'], …>` would make a new state fail the typecheck.
- `apps/extension/src/popup-page.test.ts:370-396` adds a third background factory beside `background()` and `signedOutBackground`, and `renderReading`'s `hostAccess` parameter is never passed. `:419-431`'s signed-out and failed tests repeat `popup.test.ts:168-185`'s whole-view `toEqual`s.
- `apps/web/src/route.test.ts:898-900` repeats the generic write-back rule `:913` holds for any non-`video_list` screen.
- `packages/releases/notes/0.3.0.md:13` "Messages sent this way are marked as coming from the extension" describes what only Nick's admin screen shows; the note is pending Nick's approval at release anyway.
- `apps/web/src/feedback.ts:34-42`: `screenNames` is now read only by the admin screen; a move to `admin-feedback.ts` was deferred on purpose (#750 assumption).

## Test quality
Tests added: 0 new files; 23 new or changed cases in 8 modified files. Green against `$BASE`: 8, none from a review-finding commit (`git log -S` on each name finds only `ee5e4156` and `8cf442a9`). Of those, `popup-page.test.ts:419` and `:426` and `popup.test.ts:168` and `:179` are valid negative guards (the link never existed at base; `:419` matches the link by its text, so asserting no `href` holds `/feedback` would be stronger); `app.test.ts:6935` and `:6950` are narrowed or moved coverage of the removed context line; `site.test.ts:1235` is weaker (finding 1); `admin-feedback.test.ts:48` iterates the production `feedbackScreens`, so it could not go red for #751, but `Record<FeedbackScreen, string>` already forces the key and the test holds the distinct-name rule, so it stays. Tautology shapes found: 2 (finding 3). `Reset form sends no event` (`app.test.ts:7156`) is call-shaped (`not.toHaveBeenCalled`) but states #750's explicit no-event rule, and stays.

## Before opening the PR
- **CI readiness:** lint, typecheck, build and the full suite are green at `aeec27ae`; the browser walk is green.
- **Commit hygiene:** the tree is clean; commit this doc and `repro/policy-event-clauses.mutant.sh` together.
- **Likely reviewer asks:** migration 0028 (a widened CHECK, run nowhere yet); the from address `feedback@stillstats.com` in the deploy guide (a #750 assumption); the privacy policy wording for the popup link and the `extension` screen (a #751 assumption); the 0.3.0 version and release note date (set at release); the staging email settings; #587's production walk.

## Verdict
Ready to open a PR, with follow-ups. Nothing gates it: there is no CRITICAL, HIGH or MEDIUM finding. Remediate findings 1 to 5 in this branch, since each is small and carries its proof; finding 1 is the one with a real guard to restore. The count is small and honest for a 393-line delta: one lost test guard, one doc drift, two weak tests, one copied CSS rule and comment hygiene. Review 1's nine LOW findings are on `main` and untouched here, four of them tracked as #735, #738, #740 and #748.
