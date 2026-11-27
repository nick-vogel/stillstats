# Pre-PR review: creator-analytics#6 Compliance audit application

**Branch:** `creator-analytics-6-compliance-audit` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `01964ec7` (creator-analytics#6 pre-PR review 2 remediation closure table) + 0 files with uncommitted changes, 0 untracked files, 18 files total, +1662 / −13 (the full `$BASE` surface, review docs 1 and 2 included)
**Delta under review:** since `73135fe4` (creator-analytics#6 pre-PR review 1 remediation closure table), the HEAD that `pre-pr-review-2.md` reviewed: 9 files, +291 / −20, of which `docs/reviews/creator-analytics-6/pre-pr-review-2.md` is the prior doc and the other 8 are its remediation (`7f0d0787`, `7e8ec722`, `4036792a`, `69c4d4b7`, `477462e5`).
**Reviewed against:** prior review `pre-pr-review-2.md` (findings 1 to 6 and their briefs, its Approach decisions, its closure table, its Known regressions and Open lists), the code the delta's claims describe (`apps/site/vite.config.ts`, `apps/extension/src/product-api.ts`, `packages/releases/src/read-release-content.ts`, `packages/releases/src/markdown.ts`, `packages/retention-engine/src/retention-engine.ts`), production `https://stillstats.com/`, `/privacy`, `/terms`, `/app/` fetched with `curl` on 2026-11-24, and the run's `.epic-loop/tickets/970/proposals.md` for the policy date. Epic #6's spec and sub-issues were read in round 1 and are unchanged in scope.
**Date:** 2026-11-24
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Finding 1's four wraps | `git diff 73135fe4 -- apps/site/privacy.html apps/site/terms.html`; `git grep -n "mailto:" -- apps/site ':!apps/site/test' \| grep -vc email_off` | all four wrapped, text, hrefs and periods kept; 0 |
| No other address on a site source | Agent: `git grep` for an address shape over `apps/site` (pages, partials, tools), `packages/releases/notes`, `apps/web/index.html`, `apps/api/src` | none outside test files |
| The build keeps the markers and the line layout | Agent read `apps/site/vite.config.ts`: no HTML minify, `expandIncludes` matches only `<!-- include <path> -->` | markers and one anchor per line reach the output |
| "Before recording" item 2's counts | Agent ran both `curl -sf` counts against production | today `cdn-cgi` 6 and mailto 0 (the fix is not deployed), so the item fails as it should; on the wrapped sources each page has 2 mailto lines, so 4 after deploy |
| Renumbered "Before recording" items | `grep -n -i "item [0-9]" docs/audit-application.md docs/audit-application/*.md` | the one cross-reference, item 11's "as item 6 says", points at the currency item; the other "item 5" hits are the derived-metrics policy |
| The new rule test, red at base (Phase 4.5) | Scratch worktree at `20a6c7c2`, HEAD's `apps/site/test/site.test.ts` copied in, `pnpm exec vitest run apps/site/test/site.test.ts -t "email_off"` | red, naming `/privacy` and its addresses; worktree removed |
| The address pattern | `node -e` over `hi@10x.dev`, `a@2x.co.uk`, `logo@2x.png`, `abuse@163.com` | `null`, `null`, `null`, matched (finding 2) |
| Release notes against the rule | Read `apps/site/test/site.test.ts:289` (`builtSite(fixtureContentRoot)`), `packages/releases/src/read-release-content.ts:120-131`, `packages/releases/src/markdown.ts:7` | the rule covers fixture notes only; committed notes can carry an address and cannot carry the markers (finding 1) |
| Finding 2's sharing claim, every published surface | Agent: `git grep` for sell, never/not shar, "shares nothing", "anyone but", across lines, including `apps/extension/src/manifest.ts:55` and `SOURCE_CODE_REVIEW.md` | no remaining denial in the repo; the store screenshot and ADR 0007 are already filed |
| The new privacy sentence against the extension | Agent read `apps/extension/src/product-api.ts:172` and `:284` | the extension fetches only `stillstats.com` paths, behind Cloudflare, which the policy names |
| Approval comments over changed copy | `grep -n "<!--" apps/site/privacy.html apps/site/index.html` | every changed line carries the pending comment; `privacy.html:95`'s section comment still reads as approving the whole section (finding 7) |
| Shot 1, 36 and 45 narration | `sed -n '253p;288p;297p' docs/audit-application.md` | none quotes the old wording |
| The policy's "Last updated" line | `git show 20a6c7c2:apps/site/privacy.html \| grep legal-updated`; `git log -G legal-updated -- apps/site/privacy.html` | unchanged at November 19 on base and branch; #569, #582, #913 moved it (finding 3) |
| Deferred round 2 LOW findings 3 to 6 and items A to C | Re-ran each one's proof grep | all still stand; re-emitted as 4 to 7 and A to C |
| `pnpm lint` | `biome check .` at HEAD | exit 0, 865 files |
| Touched suites | `pnpm exec vitest run apps/site/test/site.test.ts apps/web/src/consent.test.ts apps/extension/src/first-run.test.ts` | 146/146 |
| Em-dashes | `git diff 20a6c7c2 -- . ':!*.png' ':!*.pdf' ':!docs/reviews' \| grep -c $'—'` | 0 |
| Typecheck, build, `pnpm test`, browser walk | Not run: the delta's code is one test and one constant string, both covered by the suites above, and the load average was 15 to 19 on 14 cores | not run |
| Cloudflare zone settings, and production with the markers | Not readable from the repo; the fix is not deployed | not run; item 2 of "Before recording" checks it before the take |

**Overall:** both round 2 MEDIUMs are fixed against their intent. The four addresses sit inside Cloudflare's markers, the rule test is red at base and green now, and the "Before recording" check fails on today's production as it should. Every published sentence that denied sharing now says the narrower form the policy supports, each under a pending-approval comment. What is left is LOW: the address rule doesn't reach committed release notes, its srcset exclusion skips a real `@10x.dev` address, and the policy's "Last updated" date still lags its text (already proposal 1 of the run). Round 2's LOW tail is unchanged.

## Approach decisions
- A statement about the product to Google mirrors the published page that already makes it, and a published surface makes no claim stronger than the privacy policy's. Carried forward.
- What the screencast says the retention player does mirrors question 5's "Now" in `docs/audit-application/policy-questions.md`. Carried forward.
- A diagram change is made in the SVG and the PNG is regenerated with `node docs/audit-application/build-diagrams.ts`, never edited by hand. A diagram box keeps its 220-pixel width. Carried forward.
- Section 3's stated length is the `node` count of the text between the fences without its trailing line break. Carried forward.
- When production behaviour falsifies a true-in-code claim, the product is fixed in the repo rather than the claim softened, with the narrowest in-repo control (`<!--email_off-->` markers). Carried forward.
- A change to approved copy carries `<!-- Pending Nick's word-for-word approval, creator-analytics#<n>. -->`, and Nick approves it before it reaches production. Carried forward. This review adds: a section-level approval comment that covers a pending paragraph names the exception, as `apps/web/src/consent.ts:24-25` does (finding 7).
- A value Cloudflare would rewrite on a site page sits inside `<!--email_off-->` markers, held by one rule test over every served page. This review adds: the srcset exclusion is anchored to an image extension (finding 2), and the rule is held for every committed release note in `packages/releases`, as the em-dash rule is (`read-release-content.ts:120`), because the site test builds fixture notes only and markdown-it's `html: false` cannot carry the markers (finding 1).
- A production check in "Before recording" asserts a positive count beside the zero count, with `curl -sf`. Carried forward.
- A published sharing claim says Stillstats never sells data and shares it only with the services the privacy policy names; the surface check is a multi-line search. Carried forward.
- An ADR is a decision record, not a published surface. Carried forward.
- The privacy policy's "Last updated" date moves to the merge day of the change that alters the policy's text, as `17ade8fc` (creator-analytics#569 Move the privacy policy's last updated date to the merge day) did (finding 3).

## Confirmed Issues
### 1. The new address rule never sees the committed release notes, and a release note cannot carry Cloudflare's markers — LOW
- **Location:** `apps/site/test/site.test.ts:345-361` (the rule, over `servedSite(web)`, built from `fixtureContentRoot` at `:289`); `packages/releases/src/read-release-content.ts:181-184` and `:205-206` (where the em-dash rule is held for every committed note and highlight, and no address rule is)
- **Attribution:** introduced, by `7f0d0787` (creator-analytics#6 pre-PR review 2 finding 1: Section 3 said Stillstats loads no script from another company, while Cloudflare injected its email-decode script on the privacy policy and terms), which scoped the rule to the site suite. Round 2's closure named the gap under "Open, outside the repo" ("a future real release note with a bare address would not be caught by the rule test"), but it is not outside the repo: the em-dash rule's precedent closes the same gap in the package.
- **Real-world trigger:** a future release note says "write to privacy@stillstats.com". markdown-it runs with `html: false` (`packages/releases/src/markdown.ts:7`), so the author can't add `<!--email_off-->`, the address renders as text, Cloudflare rewrites it on `/releases/<version>/` and injects its decode script there, and no test goes red. LOW, capped: no committed note holds an address today (`grep -rln "@" packages/releases/notes` finds none with an address), so there is no user path until one is written.
**Evidence** —
```
apps/site/test/site.test.ts:289:  siteRoot = await builtSite(fixtureContentRoot)
packages/releases/src/read-release-content.ts:120:// No site page may carry an em-dash. The site test checks its fixture notes only, so the rule is
packages/releases/src/read-release-content.ts:121:// held here for every committed note and highlight.
packages/releases/src/markdown.ts:7:const markdown = new MarkdownIt('default', { html: false, linkify: false, typographer: false })
```
**Failure mode** — a committed note or highlight with an address → the release page carries a bare address → Cloudflare's Email Address Obfuscation rewrites it and injects `email-decode.min.js` → Section 3's "no script from another company except YouTube's own player" (`docs/audit-application.md:55`) is false on that page, with the site suite green.
**Recommended fix** — in `packages/releases/src/read-release-content.ts`, beside `refuseEmDash`:
```ts
const emailAddress = /[\w.+-]+@(?!\d+(?:\.\d+)?x\.(?:png|jpe?g|webp|avif|gif|svg)\b)(?:[a-z\d][\w-]*\.)+[a-z]{2,}\b/i

function refuseEmailAddress(file: string, field: string, text: string): void {
  if (emailAddress.test(text)) {
    throw new ReleaseContentError(
      file,
      `${field} has an email address, which Cloudflare would rewrite and a note cannot mark; link the privacy policy instead`,
    )
  }
}
```
and call it beside each `refuseEmDash` call: `refuseEmailAddress(file, 'summary', summary)` and `refuseEmailAddress(file, 'the body', html)` in the note reader (`:182-183`), `refuseEmailAddress(file, 'title', title)` and `refuseEmailAddress(file, 'the body', html)` in `highlightOf` (`:205-206`). Put the reason above `emailAddress` in the shape of the em-dash comment at `:120-122`. In `packages/releases/test/release-content.test.ts`, after the em-dash `test.each` at `:351-363`, add:
```ts
  test.each([
    ['its summary', appNote({ summary: 'Write to privacy@stillstats.com.' })],
    ['its body', appNote({}, 'Write to privacy@stillstats.com.')],
  ])('a note with an email address in %s', async (_, text) => {
    expect(await failureOf({ 'notes/2026.11.9.md': text })).toMatch(
      /^notes\/2026\.11\.9\.md: .*email address/,
    )
  })
```
with a one-line comment above it in the shape of `:351-352`, and the same pair for a highlight after `:405-415`.
**Remediation brief**
- **Design intent:** the release pages are built from `packages/releases/notes` and `highlights` through `readReleaseContent`, which refuses content no page may carry, because the site suite builds only fixture notes. Every site page rule that a committed note could break is held there (em-dash, blocked markup); the site test holds the same rule over the fixture build.
- **Full surface:** `packages/releases/src/read-release-content.ts:120-131` (the new constant and function beside the em-dash ones), `:182-183`, `:205-206`; `packages/releases/test/release-content.test.ts` after `:363` and after `:415`. The site test's pattern at `apps/site/test/site.test.ts:354` is the same pattern and changes with finding 2.
- **Must preserve:** every committed note and highlight still reads (`pnpm exec vitest run packages/releases/test/release-content.test.ts`, and the site suite, which builds the fixture notes); the em-dash and blocked-markup refusals and their messages; `@` in a non-address, such as an `@2x` image name or a package scope in a code span. If a committed note fails the new refusal on something that isn't an address, narrow the pattern rather than skip the field.
- **Do not touch:** `markdown.ts`'s `html: false` and `linkify: false`, which are right; the site test's loop over every served page.
- **Failure of the fix:** a note that needs to give an address can't. The message points the author at the privacy policy's contact section, which carries the marked address.
- **Proof:** the new `test.each` rows are red before the refusal and green after (`pnpm exec vitest run packages/releases/test/release-content.test.ts -t "email address"`); the whole release-content suite and `apps/site/test/site.test.ts` stay green.

### 2. The address rule's srcset exclusion also skips a real address whose domain starts with digits and an x, such as `hi@10x.dev` — LOW
- **Location:** `apps/site/test/site.test.ts:354`
- **Attribution:** introduced, by `4036792a` (creator-analytics#6 pre-PR review 2 finding 1 rework: the address rule matched an @2x asset name, and the Before recording curl passed on a failed fetch); `477462e5` (creator-analytics#6 pre-PR review 2 finding 1 rework follow-up: the address rule missed an address whose domain label starts with a digit) kept the lookahead.
- **Real-world trigger:** a page gains a contact or credit address at a domain like `10x.dev` or `2x.co.uk`, the test stays green, and Cloudflare injects its script. LOW, capped: no site page carries such an address today.
**Evidence** —
```
addresses: outside.match(/[\w.+-]+@(?!\d+(?:\.\d+)?x\.)(?:[a-z\d][\w-]*\.)+[a-z]{2,}\b/gi),
```
`node -e` over the pattern: `hi@10x.dev` → `null`, `a@2x.co.uk` → `null`, `logo@2x.png` → `null`, `abuse@163.com` → `["abuse@163.com"]`.
**Failure mode** — the negative lookahead excludes any domain that opens `<digits>x.`, which is the srcset density shape and also a real domain shape.
**Recommended fix** —
```diff
--- apps/site/test/site.test.ts:354
-        addresses: outside.match(/[\w.+-]+@(?!\d+(?:\.\d+)?x\.)(?:[a-z\d][\w-]*\.)+[a-z]{2,}\b/gi),
+        addresses: outside.match(
+          /[\w.+-]+@(?!\d+(?:\.\d+)?x\.(?:png|jpe?g|webp|avif|gif|svg)\b)(?:[a-z\d][\w-]*\.)+[a-z]{2,}\b/gi,
+        ),
```
**Remediation brief**
- **Design intent:** the rule fails on any address outside the markers and passes only an image density name after the `@`. Round 2's Known regressions keep the letter-led asset name (`logo@dark.svg`) as a loud failure, which this fix leaves as it is.
- **Full surface:** `apps/site/test/site.test.ts:354`, and the same pattern in finding 1's new `emailAddress` constant, so the two copies stay the same.
- **Must preserve:** `logo@2x.png`, `logo@1.5x.webp` and `img@3x.jpg` don't match; `privacy@stillstats.com`, `abuse@163.com`, `hello@1password.com` and `a@mail.example.co.uk` match; the test green on today's pages (`pnpm exec vitest run apps/site/test/site.test.ts -t "email_off"`). Biome formats the line, so run `pnpm lint` after.
- **Do not touch:** the strip of `<!--email_off-->...<!--/email_off-->` and the loop over every served page.
- **Proof:** `node -e 'const r=/[\w.+-]+@(?!\d+(?:\.\d+)?x\.(?:png|jpe?g|webp|avif|gif|svg)\b)(?:[a-z\d][\w-]*\.)+[a-z]{2,}\b/gi; for (const s of ["hi@10x.dev","a@2x.co.uk","logo@2x.png","logo@1.5x.webp","abuse@163.com"]) console.log(s, JSON.stringify(s.match(r)))'` prints matches for the first two and the last and `null` for the two image names; it prints `null` for the first two at HEAD's pattern. The site suite stays green.

### 3. The privacy policy still says "Last updated November 19, 2026", while this branch changes what it says about sharing twice — LOW
- **Location:** `apps/site/privacy.html:12`
- **Attribution:** pre-existing, exposed. The line is on `$BASE` unchanged (`git show 20a6c7c2:apps/site/privacy.html | grep -n legal-updated` prints line 12). `90b0bf09` (creator-analytics#970 The privacy policy names Cloudflare Email Service) left it by a recorded decision (`.epic-loop/tickets/970/assumptions.md`, filed as proposal 1 of the run's end report, "The privacy policy's "Last updated" date lags its changes"), and `69c4d4b7` (creator-analytics#6 pre-PR review 2 finding 2 rework: the privacy policy's extension section still said it never shares what it reads, and the lede's "its privacy policy" read as the data's) changed the extension section's sharing sentence without moving it either.
- **Real-world trigger:** the reviewer opens `/privacy` (shot 45) and reads a date older than the Cloudflare Email Service paragraph and the extension section's sharing sentence. LOW: the text is right and only its date lags; the repo's convention moves the date on the merge day, so the fix belongs to the PR's merge, not to an in-branch date guessed now.
**Evidence** — `<p class="legal-updated">Last updated November 19, 2026</p>`; `git log -G legal-updated -- apps/site/privacy.html` lists `17ade8fc` (#569 "Move the privacy policy's last updated date to the merge day"), `c1e5239e` (#582) and `afe46973` (#913), each a policy change that moved it.
**Failure mode** — the policy's text changes on this branch and its date does not.
**Recommended fix** — on the day the epic's PR merges, set the line to that day, in the form `Last updated <Month> <D>, <YYYY>`, in the PR's last commit before merge, as `17ade8fc` did. `apps/site/terms.html` changes only by comments on this branch, so its date stays.
**Remediation brief**
- **Design intent:** the date tells a reader when the policy's text last changed; it moves with a change to the text, on the day that change ships.
- **Full surface:** `apps/site/privacy.html:12`.
- **Must preserve:** the `legal-updated` class and the sentence shape; the site suite (`pnpm exec vitest run apps/site/test/site.test.ts`).
- **Do not touch:** `apps/site/terms.html:12`.
- **Escalation:** the merge day is not known inside the branch. A remediation round leaves this to the merge owner and records it under "Before opening the PR"; it is not a reason to hold the PR.
- **Proof:** `grep -n legal-updated apps/site/privacy.html` prints the merge day.

### 4. The architecture diagram leaves out three outward data flows the privacy policy names: product analytics, error reports, and YouTube's player and thumbnails — LOW
Round 2's finding 3, deferred as LOW tail and untouched (`grep -c "OpenPanel\|GlitchTip" docs/audit-application/stillstats-architecture-diagram.svg` prints 0). Attribution, trigger, evidence, recommended fix and brief stand as written in `pre-pr-review-2.md` finding 3: add "Product analytics (OpenPanel, self-hosted)" with arrows from the web app and the API, "Error reports (GlitchTip, self-hosted)" with arrows from the API and the worker, and an arrow from `embedded-player` to a "YouTube (player and thumbnails)" box outside the gateway's boundary, each `<g>` with a `data-code` naming `apps/api/src/modules.ts`, `packages/reporter/src/index.ts`, `apps/site/src/analytics.ts`, `apps/web/src/youtube-player.ts`; regenerate the PNG with `node docs/audit-application/build-diagrams.ts`. Must preserve the gateway boundary and claim, the extension box, readability at 1920 by 1080. Proof: the build exits 0 and the `grep -c` is at least 2.

### 5. The screencast's link goes in "Special Instructions for Access", while the form asks for it in Section 6's "Other Supporting Materials" — LOW
Round 2's finding 4, deferred and untouched (`grep -n "GAP #975" docs/audit-application/policy-questions.md` prints nothing). The brief in `pre-pr-review-2.md` finding 4 stands: add `[GAP #975] the screencast's unlisted YouTube link` to the PDF's opening paragraph (`docs/audit-application/policy-questions.md:3`), widen `docs/audit-application.md:13`'s grep to `grep -rn 'GAP #97' docs/audit-application.md docs/audit-application/`, say at `:178` that the PDF carries the link too, rebuild with `node docs/audit-application/build-policy-questions-pdf.ts`. Proof: `pdftotext docs/audit-application/policy-questions.pdf - | grep -c 'GAP #975'` prints 1.

### 6. Two diagram labels say more than the code does: every Pro video's retention curve downloaded every day, and row-level security "on every table, job queue" — LOW
Round 2's finding 5, deferred and untouched. The brief in `pre-pr-review-2.md` finding 5 stands: user flow `docs/audit-application/stillstats-user-flow-diagram.svg:112` says each curve is read daily for a video under 28 days old and monthly after (`apps/worker/src/retention-curves.ts:23-26`); architecture `docs/audit-application/stillstats-architecture-diagram.svg:209-210` says "row-level security forced" / "on every app table; job queue" (`packages/database/src/migrate.ts:11-27`, `packages/database/src/jobs.ts:103`). Regenerate both PNGs. Proof: `grep -n "monthly"` on the user-flow SVG and `grep -n "every app table"` on the architecture SVG each print one line.

### 7. Comment hygiene — LOW (aggregated)
- `apps/site/privacy.html:95` — "Approved word for word in creator-analytics#98, #202 and #120, with #488's usage events and #539's youtube.com wording, and #751's feedback link, which the links sentence covers." → append ", but for the paragraph marked pending, creator-analytics#6." (the section now holds the pending paragraph at `:124-126`; `apps/web/src/consent.ts:24-25` names the same kind of exception).
- `apps/site/test/site.test.ts:345-346` — "Cloudflare's Email Address Obfuscation, on for the zone, rewrites a bare address and injects its own decode script into the page (production /privacy and /terms, 2026-11-24)." → "Cloudflare's Email Address Obfuscation, on for the zone, rewrites a bare address and injects its own decode script, which would make the policy's "no third-party script except YouTube's video player" false. The pattern skips an image density name such as `logo@2x.png`."
- `apps/site/test/site.test.ts:1465-1467` — round 2's entry, unchanged: "...and so does the Cloudflare Email Service test (#970), which holds the facts its paragraph names, and so do the reach report tests (#779)" → "...and so do the Cloudflare Email Service test (#970), the reach report tests (#779)".
- `apps/site/test/site.test.ts:1594-1597` — round 2's entry, unchanged: add "The email's side is held by `apps/api/src/feedback.test.ts`, 'one email per saved message, holding the type, the time and the admin link' and 'the email holds neither the text, nor the reply address, nor the user ID, nor the message ID'."
- `docs/audit-application.md:156` — round 2's entry, unchanged: say the `grep -rnoE "api\.[a-zA-Z.]+\("` finds single-line calls only, and that `identifyGrant`'s chained `.channels.list(` at `packages/youtube-gateway/src/youtube-gateway.ts:553` was read by hand.

## Needs Further Investigation
### A. The upgrade screen's "Deleting your channel still removes all of its data within 6 hours." (`apps/web/src/upgrade.ts:84`, approved in #913), shown in shot 12, against 24 hours in the disclosure line (`packages/api-types/src/disclosure.ts:7`), shots 48 and 49, the privacy policy and the diagram. New this round: the retention engine enqueues the deletion at once, checks it at 1 hour and raises its alarm at 12 hours (`packages/retention-engine/src/retention-engine.ts:25`, `alarmAfterMs = 12 * hourMs`; `retention-engine.test.ts:43`), so no mechanism holds 6 hours, while the code treats 12 hours as late. To confirm, ask whether 6 hours was meant as a promise; if so, the copy is a follow-up ticket for Nick (approved copy), pre-existing and untouched.
### B. The user-flow diagram (`stillstats-user-flow-diagram.svg:51-52`) and shot 5 name two scopes, while the connect consent also asks for `openid` and `email` (`apps/api/src/connect.test.ts:46`). Whether Google's screen lists the email permission at connect shows only on the live consent screen: check it in #975's take.
### C. Other Cloudflare HTML rewrites on production. Only Email Address Obfuscation shows up today. Bot Fight Mode, JavaScript detections or Web Analytics would inject a `/cdn-cgi/` script, or `static.cloudflareinsights.com/beacon.min.js` for Web Analytics, which item 2's `cdn-cgi` count does not catch, though its sentence says the pages "load no script of Cloudflare's". A dashboard check of Security, Settings and Web Analytics settles it; or narrow the sentence, or add `grep -c cloudflareinsights` printing 0.

## Reviewed and Dismissed
- The "Before recording" renumbering — the only numeric cross-reference, item 11's "as item 6 says", points at the currency item; "item 5" at `docs/audit-application.md:214` and `policy-questions.md:82,88` is the derived-metrics policy.
- Item 2's "prints 4" — each page has two anchors, each on its own line, and the build neither minifies nor joins lines; a failed fetch of either page drops the count below 4.
- The new privacy sentence "shares what it reads only with the services this policy names" — the extension fetches only `stillstats.com` (`apps/extension/src/product-api.ts:172`, `:284`), behind Cloudflare, which the policy names.
- The lede, the refusals item and the disclosure line — each changed line carries its pending-approval comment; `index.html` has no section approval comment over them.
- `CONTEXT.md:3`'s "its privacy policy" — the antecedent is Stillstats, which is right in a glossary line.
- The `email_off` wrap in `terms.html` and the "Last updated" line there — a comment-only change, not a change to the terms' text.
- Shot 1, 36 and 45 narration — none quotes the old "never sells or shares".
- Round 2's dismissals stand (the bundled OpenPanel and Sentry SDKs, the legal and merger transfers, the self-hosted analytics, the AI-service claim, the #970 gate, the regenerated PNG, row 30).

## Minor / nits
- Round 2's Minor list stands unchanged (row 30's "It loads cued", the extension box's verbless notes, "There's no advertising.", and round 1's list).

## Test quality
Tests added in the delta: 1 (`apps/site/test/site.test.ts`, "every email address on a site page sits inside Cloudflare's email_off markers"). Green against `$BASE`: 0; it is red at `20a6c7c2` in a scratch worktree, naming `/privacy` and its addresses. Tautology shapes found: 0; it builds the site from current sources and computes no expectation from the code under test. Its reach is short of the rule it states (finding 1) and its pattern has one false negative (finding 2).

## Prior-review closure
Against `pre-pr-review-2.md` (HEAD `73135fe4`):
- **Fully fixed: 2.** Finding 1 (Cloudflare's script on `/privacy` and `/terms`): all four addresses wrapped, the rule test red at base and green, the production check sound; the release-note gap and the pattern's false negative are new LOW findings from the fix (1 and 2 here), not a half of the old one. Finding 2 (the sharing denials): every published surface in the repo says the narrower form, each under a pending comment; the store screenshot and ADR 0007 are filed as proposals, outside the branch.
- **Partially fixed: 0.**
- **Untouched: 4**, all LOW and deferred by the round 2 closure table as "LOW tail, not worked this round": findings 3, 4, 5 and 6, re-emitted here as 4, 5, 6 and 7. Items A to C stay open.
- **Resolved only by editing a comment or doc:** finding 2 in part, as expected (it is copy); finding 1 changed markup and added a test.
- This is not the fix-begets-finding pattern: each round's new findings shrank in severity, and this round has no MEDIUM.

## Before opening the PR
- **CI readiness:** `pnpm lint` exits 0 and the three touched suites pass 146/146 at HEAD. Typecheck, build and the full `pnpm test` were not run by this review (load 15 to 19 on 14 cores; the delta's code is one test and one string constant); CI runs them.
- **Commit hygiene:** the tree was clean at review time.
- **Copy approval:** the lede, the refusals item, the privacy policy's extension sentence and the disclosure line wait for Nick's word-for-word approval, beside #970's paragraph; the take (#975) waits on them and on the store screenshot retake.
- **Merge day:** move the privacy policy's "Last updated" line to the merge day (finding 3, proposal 1 of the run).
- **Likely reviewer asks:** why the release notes don't share the address rule (finding 1); why the policy's date is older than its text (finding 3).

## Verdict
Ready to open the PR with follow-ups. Round 2's two MEDIUMs are fully fixed and verified against intent, and no MEDIUM or higher is open: the confirmed list is 7 LOWs, three of them new (the address rule's reach into release notes, its one false negative, and the policy date, which belongs to the merge day), and four the unchanged LOW tail. The count shrank from 2 MEDIUM and 4 LOW to 0 MEDIUM and 7 LOW, so the review is at the bottom of the barrel. Findings 1 and 2 are small and can ride in this PR; the rest can follow. The gate before the take, not before the PR, is Nick's copy approval and item 2's production check after deploy.
