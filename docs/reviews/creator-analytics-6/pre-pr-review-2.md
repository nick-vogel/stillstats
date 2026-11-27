# Pre-PR review: creator-analytics#6 Compliance audit application

**Branch:** `creator-analytics-6-compliance-audit` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `73135fe4` (creator-analytics#6 pre-PR review 1 remediation closure table) + 0 files with uncommitted changes, 0 untracked files, 12 files total, +1380 / −2 (the full `$BASE` surface, review doc 1 included)
**Delta under review:** since `a04aba72` (creator-analytics#970 The privacy policy names Cloudflare Email Service), the HEAD that `pre-pr-review-1.md` reviewed: 4 files, +248 / −7, of which `docs/audit-application.md` (+3 / −3), `docs/audit-application/stillstats-architecture-diagram.svg` (+4 / −4) and its PNG are remediation, and `docs/reviews/creator-analytics-6/pre-pr-review-1.md` is the prior doc.
**Reviewed against:** prior review `pre-pr-review-1.md` (its findings 1 to 3 and their briefs, its Approach decisions, its closure table), the code the delta's claims describe (`apps/site/privacy.html`, `apps/site/index.html`, `packages/visual-system/src/content-security-policy.ts`, `apps/web/src/youtube-player.ts`, `apps/extension/`), production `https://stillstats.com/`, `/privacy`, `/terms` and `/app/` fetched with `curl` on 2026-11-24, and Cloudflare's "Email Address Obfuscation" page (developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/, "Last updated Aug 3, 2026", read through the Cloudflare docs MCP). Epic #6's spec and sub-issues were read in round 1 and are unchanged in scope.
**Date:** 2026-11-24
**Reviewer:** 1 code-review agent + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Round 1 proofs, re-run | `grep -n "share data\|tracking script\|stays paused" docs/audit-application.md`; `grep -n "Firefox\|youtube.com" docs/audit-application/stillstats-architecture-diagram.svg` | first prints nothing; second prints lines 55 and 56 |
| Section 3 length | `awk '/^\`\`\`$/{n++; next} n==1' docs/audit-application.md \| node -e '...replace(/\n$/,"")...length'` | 2126, matching line 60's "2,126" |
| PNGs regenerated from source | Scratch worktree at HEAD: `node docs/audit-application/build-diagrams.ts`, then `cmp` on each PNG against the branch | both byte-identical |
| Extension box notes fit the box | Agent viewed a crop of the architecture PNG (3840 by 2160, 2x the viewBox) | all three notes inside the 220-pixel box, text matching the SVG |
| `data-code` paths | Agent checked every path in the architecture SVG exists | all exist, the two new entrypoints included |
| Shot 30 against the player | Agent read `apps/web/src/youtube-player.ts:164-175` and `apps/web/src/VideoPlayer.tsx:40` | a click on an unstarted or cued player calls `cueVideoById` at the time; row 30, shots 31 and 32 and question 5's "Now" agree |
| Section 3's script claim against the code | Agent read the CSP (`packages/visual-system/src/content-security-policy.ts:23`, `"script-src 'self' https://www.youtube.com"`) and grepped `apps/web`, `apps/site`, `apps/extension` for third-party script hosts | the code loads only its own bundle and YouTube's IFrame API |
| Section 3's script claim against production | `curl` of `https://stillstats.com/`, `/privacy`, `/terms`, `/app/`, then `grep -o '<script[^>]*>'` | `/privacy` and `/terms` carry `<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">` and two `__cf_email__` links; `/` and `/app/` do not (finding 1) |
| HTML comments survive the site build | the same `/privacy` fetch, `grep -c "<!--"` | 7, the "Approved word for word" comments among them, so an `email_off` marker reaches Cloudflare |
| Section 3's sharing claim against the other published surfaces | `git grep -n -i "shares your data\|never shares"` over the repo | three published copies still say "never sells or shares" (finding 2) |
| AI-service claim | Agent grepped `apps/api`, `apps/worker`, `packages` for AI vendor hosts and SDKs | none |
| Em-dashes | `git diff 20a6c7c2 -- . ':!*.png' ':!*.pdf' ':!docs/reviews' \| grep -c $'—'` | 0 |
| Deferred round 1 LOW findings 4 to 7 and items A and B | Re-ran each one's proof grep | all still stand as written; re-emitted below as 3 to 6 and A to B |
| Lint | `pnpm lint` | see Before opening the PR |
| Typecheck, build, `pnpm test`, browser walk | Not run: the delta changes no code, only two docs files and a diagram, and the load average was 18 to 23 on 14 cores | not run |
| Tautology audit (Phase 4.5) | The delta adds and changes no test | not run: no tests in the delta |
| Cloudflare zone settings | Not readable from the repo; production HTML was read instead | not run |

**Overall:** all three round 1 MEDIUM fixes landed and hold against the code: Section 3 no longer denies sharing or a tracking script, shot 30 says the cued player stays cued, and the extension box names Firefox and youtube.com, with the PNG exactly what the SVG renders. Two new MEDIUMs come out of finding 1's fix. Its new sentence says Stillstats loads no script from another company but YouTube's player, and production's privacy policy and terms pages load Cloudflare's email-decode script, because Cloudflare's Email Address Obfuscation is on for the zone. And the narrower sharing claim now sits beside three approved surfaces Google sees on camera (the homepage twice, and the extension's first-run page) that still say "never sells or shares your data". The rest is round 1's deferred LOW tail, unchanged.

## Approach decisions
- A statement about the product to Google mirrors the published page that already makes it, word for word where it can, so the application and the privacy policy can't disagree (finding 1 of review 1 mirrors `apps/site/privacy.html:236-241`). Carried forward; finding 2 extends it the other way: a published surface makes no claim stronger than the privacy policy's.
- What the screencast says the retention player does mirrors question 5's "Now" in `docs/audit-application/policy-questions.md:76`, which matches `apps/web/src/youtube-player.ts:164-174`. Carried forward.
- A diagram change is made in the SVG and the PNG is regenerated with `node docs/audit-application/build-diagrams.ts`, never edited by hand. Carried forward.
- Section 3's stated length is the `node` count of the text between the fences without its trailing line break. Carried forward.
- A diagram box keeps its 220-pixel width while its notes fit inside it in the regenerated PNG. Carried forward.
- When production behaviour falsifies a true-in-code claim, the product is fixed in the repo rather than the claim softened, and the narrowest in-repo control wins: Cloudflare's `<!--email_off-->` markers around each address, not a site-wide `Cache-Control: no-transform` (which turns off every Cloudflare HTML rewrite) and not a dashboard toggle (an outward action outside the repo) (finding 1).
- A change to approved copy is proposed in the repo with the pending-approval comment `<!-- Pending Nick's word-for-word approval, creator-analytics#<n>. -->`, as `apps/site/privacy.html:256` does for #970, and Nick approves it before it reaches production (finding 2).

## Confirmed Issues
### 1. Section 3 now tells Google Stillstats loads no script from another company but YouTube's player, and production's privacy policy and terms pages load Cloudflare's email-decode script — MEDIUM
- **Location:** `docs/audit-application.md:55` (the claim); the cause is outside the repo, in the zone's Email Address Obfuscation, acting on the `mailto:` anchors at `apps/site/privacy.html:452`, `apps/site/privacy.html:475`, `apps/site/terms.html:94` and `apps/site/terms.html:149`
- **Attribution:** the Section 3 sentence is introduced by the round 1 remediation, `310ea484` (creator-analytics#6 pre-PR review 1 finding 1: Section 3 told Google Stillstats shares no data and loads no tracking script, against its own privacy policy): `git log --oneline -S"no script from another company" 20a6c7c2..HEAD -- docs/audit-application.md` names only that commit. The injection is pre-existing and untouched: Cloudflare turns the setting on at sign-up, and it equally falsifies the pre-existing `apps/site/privacy.html:240` ("no third-party script except YouTube's video player") and `apps/site/index.html:85` ("no script from another company"). The branch widens its reach by putting the claim in the application, whose Section 7 attests it "true, complete, and accurate".
- **Real-world trigger:** the reviewer opens `https://stillstats.com/privacy` (shot 45 shows it, and the form links it) with the browser's developer tools open, and sees `/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js`, a Cloudflare script, beside Stillstats's own bundle. MEDIUM, capped: it is a statement to Google that production contradicts, but the script is a same-origin helper from the infrastructure the policy names, not a tracker. With JavaScript off, the policy's contact address also reads "[email protected]".
**Evidence** — production `/privacy`, 2026-11-24:
```
<script type="module" crossorigin src="/assets/main-Ct2M0sxB.js">
<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">
__cf_email__" data-cfemail="92e2e0fbe4f3f1ebd2e1e6fbfefee1e6f3e6e1bcf1fdff">[email&#160;protected]
```
Section 3, `docs/audit-application.md:55`: "It loads no ad pixel and no script from another company except YouTube's own player". Cloudflare's docs: "Cloudflare injects a small decode script (`email-decode.min.js`) into the page", and "To prevent Cloudflare from obfuscating specific email addresses, you can: Add the following comment in the page HTML code: `<!--email_off-->contact@example.com<!--/email_off-->`".
**Failure mode** — a page with a visible email address + Email Address Obfuscation on (the default) → Cloudflare rewrites the address and injects its decode script → `script-src 'self'` lets it run, because it is same-origin → the page loads a script Stillstats didn't write. `/` and `/app/` carry no address and no injected script, so only `/privacy` and `/terms` are affected.
**Recommended fix** — wrap each of the four anchors in Cloudflare's markers, leaving the text and the period outside:
```diff
--- apps/site/privacy.html:452
-        <a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a>
+        <!--email_off--><a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a><!--/email_off-->
--- apps/site/privacy.html:475
-        <a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a>.
+        <!--email_off--><a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a><!--/email_off-->.
--- apps/site/terms.html:94
-        <a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a>
+        <!--email_off--><a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a><!--/email_off-->
--- apps/site/terms.html:149
-        <a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a>.
+        <!--email_off--><a href="mailto:privacy@stillstats.com">privacy@stillstats.com</a><!--/email_off-->.
```
Add a rule test in `apps/site/test/site.test.ts`'s `describe('seam 1: the API serves the site', ...)`, beside "no site page contains an em-dash" (`:339`):
```ts
  test("every email address on a site page sits inside Cloudflare's email_off markers", async ({ web }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const outside = html.replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, '')
      expect({ path, address: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(outside) }).toEqual({ path, address: false })
    }
  })
```
Then add one item to "Before recording" in `docs/audit-application.md` (after item 1 at `:225`): "`curl -s https://stillstats.com/privacy https://stillstats.com/terms | grep -c cdn-cgi` prints 0, so the pages load no script of Cloudflare's."
**Remediation brief**
- **Design intent:** the site and the app load only Stillstats's own bundle and YouTube's player; the CSP (`packages/visual-system/src/content-security-policy.ts:23`) enforces the host list but cannot tell a same-origin Cloudflare path from Stillstats's own. Cloudflare sits in front of every page and rewrites HTML unless told not to; an HTML comment survives the site build (production `/privacy` carries the "Approved word for word" comments), and `vite.config.ts:33`'s include directive matches only `<!-- include <path> -->`, so the markers pass through untouched.
- **Full surface:** `apps/site/privacy.html:452`, `apps/site/privacy.html:475`, `apps/site/terms.html:94`, `apps/site/terms.html:149` (`git grep -n -e "@stillstats\.com" -e "mailto:" -- apps/site ':!apps/site/test'` lists exactly these); the new test in `apps/site/test/site.test.ts`; the new "Before recording" item in `docs/audit-application.md` after `:225`. No address is in `apps/site/index.html`, `principles.html`, `404.html` or the tool pages.
- **Must preserve:** each paragraph's visible words and its link, so the "Approved word for word" comments stay true; the `mailto:` hrefs; the sentence-ending periods after the anchors at `privacy.html:475` and `terms.html:149`; the existing site suite (`pnpm exec vitest run apps/site/test/site.test.ts`), in particular the privacy-section tests that read `textOf(...)` of those sections, which see no comment text. If the address regex in the new test matches anything that isn't an address (an `@` in a URL, a `srcset` such as `@2x`), narrow it to the address shape rather than drop pages from the loop.
- **Do not touch:** `docs/audit-application.md:55` and `apps/site/privacy.html:240`, whose claim becomes true once the script is gone (softening them is the approach this doc's Approach decisions rejects); the CSP's `script-src`, which is right.
- **Failure of the fix:** if Cloudflare still injects the script after deploy (a page added later with a bare address, or a markup change that drops the markers), the test catches the source side, and the "Before recording" `curl` catches production before the take. If the `curl` still finds `cdn-cgi` with every address wrapped, the remaining remedy is Nick turning Email Address Obfuscation off in the dashboard (Security, Settings, Client-side abuse), an outward action for Nick, not the remediator.
- **Proof:** the new test is red at HEAD, naming `/privacy` and `/terms` (`pnpm exec vitest run apps/site/test/site.test.ts -t "email_off"`), and green after the four wraps; `git grep -n "mailto:" -- apps/site ':!apps/site/test' | grep -vc "email_off"` prints 0. Production is confirmed by the "Before recording" `curl` after deploy.

### 2. Section 3 now says Stillstats shares data only with the services its privacy policy names, while the homepage and the extension's first-run page, both on camera, still say it never shares data — MEDIUM
- **Location:** `apps/site/index.html:15` (the hero lede), `apps/site/index.html:220` (the refusals list), `packages/api-types/src/disclosure.ts:7` (the web app's connection screen and the extension's first-run page)
- **Attribution:** pre-existing, exposed. `apps/site/index.html:15` and `:220` come from `3e681a5a` (creator-analytics#31: write the homepage content and the footer FAQ) and are on `$BASE` (`git show 20a6c7c2:apps/site/index.html | grep -n "sells or shares"` prints line 15); `disclosure.ts:7` is on `$BASE`, approved in #56. This branch exposes them: shot 1 (`docs/audit-application.md:252`) opens the homepage, shot 36 (`:287`) shows the first-run page's "each line", and round 1's finding 1 fix (`310ea484`) made Section 3 state the narrower, true form beside them. Round 1's surface grep covered `docs/` only, so it missed these.
- **Real-world trigger:** the reviewer reads Section 3's "shares it only with the services its privacy policy names", then sees "it never sells or shares your data" in shot 1's hero and shot 36's first-run page, and "How Stillstats shares your data" in the privacy policy (shot 45). MEDIUM, capped: the same claim class round 1 rated MEDIUM in Section 3, now in published, approved copy Google sees; it is text, not product behaviour, and "share" read as a processor disclosure is defensible.
**Evidence** —
```
apps/site/index.html:15:          stores only what a feature needs, and it never sells or shares your data.
apps/site/index.html:220:          <li>Sell or share your data.</li>
packages/api-types/src/disclosure.ts:7:  'It never sells or shares your data, and never shows it to anyone but you.',
apps/site/privacy.html:236:        We do not sell your data. We share it with no one beyond the infrastructure that delivers
```
**Failure mode** — four published surfaces state two different sharing claims; the privacy policy and Section 3 say Stillstats shares with Cloudflare, Cloudflare Email Service and Stripe, and the homepage and first-run page say it never shares.
**Recommended fix** — proposed wording, each pending Nick's word-for-word approval:
```diff
--- apps/site/index.html:14-15
-          Stillstats shows you the numbers about your own channel that still mean something. It
-          stores only what a feature needs, and it never sells or shares your data.
+          <!-- Pending Nick's word-for-word approval, creator-analytics#6. -->
+          Stillstats shows you the numbers about your own channel that still mean something. It
+          stores only what a feature needs, never sells your data, and shares it only with the
+          services its privacy policy names.
--- apps/site/index.html:220
-          <li>Sell or share your data.</li>
+          <li>Sell your data, or share it beyond the services the privacy policy names.</li>
--- packages/api-types/src/disclosure.ts:7
-  'It never sells or shares your data, and never shows it to anyone but you.',
+  'It never sells your data, shares it only with the services the privacy policy names, and never shows it to anyone but you.',
```
with the `index.html:220` item carrying its own pending-approval comment on the line above it, and the comment above `retentionAndSharingLines` (`disclosure.ts:1-2`) gaining "Line 3 pending Nick's word-for-word approval, creator-analytics#6." Also align `CONTEXT.md:3`'s "never sells or shares that data".
**Remediation brief**
- **Design intent:** the privacy policy is the source of truth for what Stillstats shares (`privacy.html:234-295`), and every other surface says no more than it. `retentionAndSharingLines` is one constant so the web app's connection screen (`apps/web/src/consent.ts:32`) and the extension's first-run page (`apps/extension/src/first-run.ts:92`) never disagree; change it once.
- **Full surface:** `apps/site/index.html:14-15`, `apps/site/index.html:220`, `packages/api-types/src/disclosure.ts:7` (and its comment at `:1-2`), `CONTEXT.md:3`. `git grep -n -i "sells or shares\|or share your data" -- . ':!docs/reviews'` lists every site.
- **Must preserve:** `apps/web/src/consent.test.ts:27` and `apps/extension/src/first-run.test.ts:254-267`, which build their expectations from the constant and so follow the change (run both with `pnpm exec vitest run <file>`); the site suite (`apps/site/test/site.test.ts`), including "no site page contains an em-dash"; the rest of the hero, the other refusals, and the other two disclosure lines word for word.
- **Do not touch:** `docs/audit-application.md:55`, which already states the right claim; `apps/site/privacy.html:236-241`, the policy itself.
- **Escalation:** this is approved copy (#31, #56). If the run cannot propose copy for Nick, file it as a follow-up ticket and gate the take (#975) on it instead, since shots 1 and 36 put it on camera.
- **Proof:** `git grep -n -i "sells or shares\|<li>Sell or share" -- apps packages CONTEXT.md` prints nothing after the fix (it prints the three lines above and `CONTEXT.md:3` now); the two constant-driven tests and the site suite stay green.

### 3. The architecture diagram leaves out three outward data flows the privacy policy names: product analytics, error reports, and YouTube's player and thumbnails — LOW
- **Location:** `docs/audit-application/stillstats-architecture-diagram.svg` (no box for OpenPanel or GlitchTip; `embedded-player` has no edge to YouTube)
- **Attribution:** introduced, by `78deb989` (creator-analytics#973 Draw the architecture and user-flow diagrams for the audit form). Round 1's finding 4, deferred as LOW tail and untouched by the delta (`grep -c "OpenPanel\|GlitchTip"` on the SVG prints 0). Section 3 now names self-hosted product analytics, which makes the gap a little more visible.
- **Real-world trigger:** a reviewer comparing the diagram with the privacy policy's "Product analytics and error reports" (`apps/site/privacy.html:297-317`) finds flows the drawing lacks. LOW: the intro scopes its claim to YouTube API calls, so nothing drawn is false.
**Evidence** — `apps/api/src/modules.ts:95` (`eventRelay: createEventRelay(openPanel, { reporter })`), `packages/reporter/src/index.ts:19` (GlitchTip through the Sentry SDK), `apps/site/src/analytics.ts:3` (the browser's OpenPanel client), `apps/web/src/youtube-player.ts:84` (`https://www.youtube.com/iframe_api`).
**Failure mode** — the diagram reads as the whole system and omits where usage events, error reports and the player's requests go.
**Recommended fix** — add a box "Product analytics (OpenPanel, self-hosted)" with arrows from the web app and the API, a box "Error reports (GlitchTip, self-hosted)" with arrows from the API and the worker, and an arrow from `embedded-player` to a "YouTube (player and thumbnails)" box outside the gateway's boundary, each `<g>` with a `data-code` naming the files above. Regenerate the PNG.
**Remediation brief**
- **Design intent:** the intro scopes the gateway claim to API calls, so these edges sit outside the gateway box and must not be drawn as gateway calls.
- **Full surface:** the architecture SVG and its PNG.
- **Must preserve:** the gateway boundary and its claim; the extension box as finding 3 of review 1 left it; readability at 1920 by 1080; the build script's em-dash and `data-code` checks.
- **Do not touch:** the extension's single arrow "requests to the Stillstats API only".
- **Proof:** `node docs/audit-application/build-diagrams.ts` exits 0, and `grep -c "OpenPanel\|GlitchTip" docs/audit-application/stillstats-architecture-diagram.svg` is at least 2.

### 4. The screencast's link goes in "Special Instructions for Access", while the form asks for it in Section 6's "Other Supporting Materials" — LOW
- **Location:** `docs/audit-application.md:95` and `:178`
- **Attribution:** introduced, by `0bbd2270` (creator-analytics#971 Draft the audit application). Round 1's finding 5, deferred and untouched (`grep -n "GAP #975" docs/audit-application/policy-questions.md` prints nothing).
- **Real-world trigger:** "Other Supporting Materials" takes one file, the PDF fills it, and the reviewer looks for the screencast where the form said it would be. LOW: the draft explains the choice and carries a `[GAP #976]` to check the live form.
**Evidence** — `:178`: "The questions PDF takes that field's one upload, so the screencast link goes in "Special Instructions for Access" instead."
**Failure mode** — Section 6's one upload does not hold the screencast link.
**Recommended fix** — put the link in the PDF's opening paragraph (`docs/audit-application/policy-questions.md:3`) as `[GAP #975] the screencast's unlisted YouTube link`; widen line 13's grep to `grep -rn 'GAP #97' docs/audit-application.md docs/audit-application/`; say at `:178` that the PDF carries the link as well; rebuild the PDF with `node docs/audit-application/build-policy-questions-pdf.ts`.
**Remediation brief**
- **Design intent:** the PDF's text lives once in `policy-questions.md` and is printed from it; #975 fills every screencast gap, and the PDF is rebuilt after.
- **Full surface:** `docs/audit-application/policy-questions.md:3`, `docs/audit-application.md:13`, `:178`, `:322`, and `docs/audit-application/policy-questions.pdf`.
- **Must preserve:** the Special Instructions text at `:95`; the PDF's title; the nine questions unchanged.
- **Do not touch:** the `[GAP #976]` at `:178`.
- **Proof:** `grep -rn 'GAP #975' docs/audit-application/policy-questions.md` prints the new line, and `pdftotext docs/audit-application/policy-questions.pdf - | grep -c 'GAP #975'` prints 1.

### 5. Two diagram labels say more than the code does: every Pro video's retention curve downloaded every day, and row-level security "on every table, job queue" — LOW
- **Location:** `docs/audit-application/stillstats-user-flow-diagram.svg:112`; `docs/audit-application/stillstats-architecture-diagram.svg:209-210`
- **Attribution:** introduced, by `78deb989`. Round 1's finding 6, deferred and untouched (both lines unchanged).
- **Real-world trigger:** a reviewer reads the user-flow label as a daily refresh of every curve, and the Postgres label as row-level security over the job queue. LOW: both are near-true and neither changes behaviour.
**Evidence** — user flow `:112`: "click-through rate) and its videos' audience retention curves", under "Every day, the worker"; `apps/worker/src/retention-curves.ts:23-26` reads a video under 28 days old each UTC day and an older one monthly. Architecture `:210`: "on every table, job queue"; `packages/database/src/migrate.ts:11-27` forces row-level security on app tables, and pg-boss's tables live in their own `pgboss` schema (`packages/database/src/jobs.ts:103`).
**Failure mode** — two Section 6 labels overstate a cadence and a security boundary.
**Recommended fix** — user flow `:112`: "click-through rate), and its videos' audience retention curves, each day for a video under 28 days old and monthly after" (split across two `note` lines as the box needs). Architecture `:209-210`: "row-level security forced" / "on every app table; job queue". Regenerate both PNGs.
**Remediation brief**
- **Design intent:** the diagrams draw what the code does today, and a timing in a label is a claim Google may check against the storage clauses.
- **Full surface:** the lines above and both PNGs.
- **Must preserve:** "deletes a channel's stored history 30 days after its Pro subscription ends" (user flow `:113-114`); every other line of the daily box.
- **Do not touch:** the cache label (every `cacheWindowMs` is 6 hours, swept hourly).
- **Proof:** `grep -n "monthly" docs/audit-application/stillstats-user-flow-diagram.svg` and `grep -n "every app table" docs/audit-application/stillstats-architecture-diagram.svg` each print one line; `node docs/audit-application/build-diagrams.ts` exits 0.

### 6. Comment hygiene — LOW (aggregated)
Round 1's finding 7, deferred and untouched, less its line 60 entry (moot since `310ea484` set the count).
- `apps/site/test/site.test.ts:1465-1467` — "the facts its two items name, not their sentences, and so does the Cloudflare Email Service test (#970), which holds the facts its paragraph names, and so do the reach report tests (#779)" → "the facts its two items name, not their sentences, and so do the Cloudflare Email Service test (#970), the reach report tests (#779)".
- `apps/site/test/site.test.ts:1594-1597` — the test comment names `feedbackNoticeOf` but not the tests that hold the email's side → add "The email's side is held by `apps/api/src/feedback.test.ts`, 'one email per saved message, holding the type, the time and the admin link' and 'the email holds neither the text, nor the reply address, nor the user ID, nor the message ID'."
- `docs/audit-application.md:156` — "checked ... with `grep -rnoE "api\.[a-zA-Z.]+\(" ...`, which lists `channels.list`, ..." → say the grep finds single-line calls only, and that `identifyGrant`'s chained `.channels.list(` at `packages/youtube-gateway/src/youtube-gateway.ts:553` was read by hand.

## Needs Further Investigation
### A. The upgrade screen's "Deleting your channel still removes all of its data within 6 hours." (`apps/web/src/upgrade.ts:84`, approved in #913), shown in shot 12, against 24 hours in shots 48 and 49, the privacy policy and the diagram. To confirm, read the deletion deadline in the retention engine (`git grep -n "hourMs" -- apps/worker packages | grep -i "delet\|alarm"`) and see whether 6 hours is guaranteed; a round 1 finder read the alarm at 12 hours. Pre-existing and untouched; a follow-up ticket for that copy if 6 hours isn't guaranteed.
### B. The user-flow diagram (`stillstats-user-flow-diagram.svg:51-52`, "two read-only scopes: YouTube, and YouTube Analytics") and shot 5 name two scopes, while the connect consent also asks for `openid` and `email` (`apps/api/src/connect.test.ts:46`). Whether Google's screen lists the email permission at connect shows only on the live consent screen: check it in #975's take, and if it does, say "two read-only YouTube scopes, with your email to match the account" in both places.
### C. Other Cloudflare HTML rewrites on production. Only Email Address Obfuscation showed up (`/` and `/app/` carry no `cdn-cgi` script). Bot Fight Mode, JavaScript detections or Web Analytics would also inject a same-origin `/cdn-cgi/` script, on any page, at any time the zone setting changes. Finding 1's "Before recording" `curl` covers the take; a dashboard check of Security, Settings would settle it for good.

## Reviewed and Dismissed
- "no script from another company" against the OpenPanel and Sentry SDKs in the bundle — both are compiled into Stillstats's own `/assets/` bundle and served as its code; the approved homepage (`index.html:85`) and policy (`privacy.html:240`) use the same reading. Cloudflare's script differs: Cloudflare injects and serves it at the edge (finding 1).
- "shares it only with the services its privacy policy names" against the policy's legal and merger transfers (`privacy.html:243-249`) — the policy calls those transfers, not sharing, and Section 3 mirrors its wording.
- "its product analytics run on a server it operates itself" — matches `privacy.html` ("OpenPanel, which we host on our own servers") and `docs/deploy.md:115`; it is deploy configuration, and nothing in the repo points it at OpenPanel's hosted API.
- "sends no channel data to an AI service" — no AI vendor host or SDK in `apps/api`, `apps/worker` or `packages`.
- Section 3's dependency on #970 — already gated: "Before recording" item 1 (`docs/audit-application.md:225`) waits for #970 on production, and round 1's Before opening the PR carries the approval.
- The regenerated architecture PNG — byte-identical to a fresh build of the SVG at HEAD, and the user-flow PNG unchanged.
- Row 30 against shots 31 and 32 — shot 31 plays from the cued `startSeconds`, shot 32's `seekTo` keeps a playing player playing; all three agree with `youtube-player.ts:164-175`.

## Minor / nits
- Row 30's narration "It loads cued" (`docs/audit-application.md:281`, predates the delta): the iframe loads unstarted (state -1), not cued (5), until the first `cueVideoById`. The screen looks the same and the code treats both alike.
- The extension box's new notes (`stillstats-architecture-diagram.svg:55-57`) dropped the verb: "Chrome and Firefox, on Studio / and, if turned on, youtube.com / beside YouTube's own figures" no longer says what the box shows. "shows engaged views beside YouTube's" would read better if it fits 220 pixels.
- "There's no advertising." (`docs/audit-application.md:57`, predates the delta) sits beside the policy's "The player can set cookies and can show YouTube's ads" (`privacy.html:270`); "Stillstats sells no advertising" says what is meant.
- Round 1's Minor list stands unchanged (the `file://` URLs in both build scripts, the PDF script's "Wrote" on a silent Chrome exit, the four Chrome path defaults, the raw-only em-dash check, the untypechecked `docs/` scripts, the PDF's broken date, the first sign-in arrow, "After recording"'s last step).

## Test quality
The delta adds and changes no test, so the tautology audit did not run. Round 1's audit of the branch's one test (`apps/site/test/site.test.ts`, the Cloudflare Email Service paragraph) stands: red at base and against two mutants. Finding 1 asks for one new rule test over every served page.

## Prior-review closure
Against `pre-pr-review-1.md` (HEAD `a04aba72`):
- **Fully fixed: 3.** Finding 1 (Section 3's sharing and tracking-script claims): the false claims are gone and the replacement mirrors the policy and homepage; its new script sentence is falsified by production, which is a new defect from the fix (finding 1 here), not a half-fix of the old one. Finding 2 (shot 30): fixed against intent. Finding 3 (the extension box): fixed against intent, PNG regenerated and verified.
- **Partially fixed: 0.**
- **Untouched: 4**, all LOW and deferred by the round 1 closure table as "LOW tail, not worked this round": findings 4, 5, 6 and 7, re-emitted here as 3, 4, 5 and 6. Items A and B stay open, re-emitted as A and B.
- **Resolved only by editing a comment or doc:** all three, as expected for a docs branch; each was a docs defect.
- Round 1's finding 1 brief limited its surface grep to `docs/`, which is why finding 2's published copies were missed; finding 2 here lists the repo-wide grep.

## Before opening the PR
- **CI readiness:** the delta changes no code. `pnpm lint` is run on this doc before it is committed; typecheck, build and `pnpm test` were not run by this review (no code in the delta, machine load 18 to 23 on 14 cores); CI runs them. Finding 1's fix adds a site test, so its remediation runs `pnpm exec vitest run apps/site/test/site.test.ts`.
- **Commit hygiene:** the tree was clean at review time. Finding 1 is two HTML files, one test and one docs line; finding 2 is two source files and `CONTEXT.md`, with pending-approval comments.
- **Copy approval:** finding 2 changes approved copy, so Nick approves its wording before it reaches production, as #970's paragraph waits for him; the take (#975) waits on both.
- **Likely reviewer asks:** why the privacy page loads a Cloudflare script (finding 1), and why the homepage says something different from Section 3 (finding 2).

## Verdict
Not ready as-is. Round 1's three MEDIUMs are fully fixed and verified against intent, and the confirmed list shrank to two real items, both raised by finding 1's fix: fix finding 1 (wrap the four addresses so Cloudflare stops injecting its script, with a rule test and a production check before the take) and finding 2 (bring the homepage and the first-run line in line with the policy, pending Nick's approval, or ticket it and gate #975 on it) before the PR opens. Findings 3 to 6 are round 1's LOW tail, unchanged, and can ride along or follow. This round is not the fix-begets-finding pattern in a subsystem: each Section 3 fix narrows a claim, and the new findings are about other surfaces that claim reaches.

## Remediation — 2026-11-24
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `7f0d0787` creator-analytics#6 pre-PR review 2 finding 1: Section 3 said Stillstats loads no script from another company, while Cloudflare injected its email-decode script on the privacy policy and terms | red→green: `pnpm exec vitest run apps/site/test/site.test.ts -t "email_off"` (red at `51bec52e` naming `/privacy` with four addresses, green after the four wraps); `git grep -n "mailto:" -- apps/site ':!apps/site/test' \| grep -vc "email_off"` prints 0; site suite 105/105 | 1 (two lines: Cloudflare's Email Address Obfuscation injects its decode script, observed on production 2026-11-24) | fixed, with two LOW leftovers reworked below |
| 1 rework | `4036792a` creator-analytics#6 pre-PR review 2 finding 1 rework: the address rule matched an @2x asset name, and the Before recording curl passed on a failed fetch | node check of the pattern (`logo@2x.png` no match, `privacy@stillstats.com` match); production today: the mailto count prints 0 and the cdn-cgi count 6, so item 2 fails as it should before deploy; site suite green | 0 | docs half fixed; test half introduced a miss of addresses whose domain label starts with a digit |
| 1 rework follow-up | `477462e5` creator-analytics#6 pre-PR review 2 finding 1 rework follow-up: the address rule missed an address whose domain label starts with a digit | node check (`logo@2x.png`, `logo@1.5x.png` no match; `hello@1password.com`, `abuse@163.com`, `a@mail.example.co.uk` match); site suite 105/105 | 0 | the re-verifier's one-line fix, applied as given |
| 2 (MEDIUM) | `7e8ec722` creator-analytics#6 pre-PR review 2 finding 2: the homepage and the extension's first-run page said Stillstats never shares data, beside a Section 3 and a privacy policy that name who it shares with | red→green: `git grep -n -i "sells or shares\|<li>Sell or share" -- apps packages CONTEXT.md` printed four lines, prints nothing; `consent.test.ts`, `first-run.test.ts` and the site suite 146/146 | 1 (`disclosure.ts`: line 3 pending Nick's approval, #6) | half-fixed: `apps/site/privacy.html:124-125` (wrapped, so the single-line grep missed it) and the store screenshot `apps/extension/store-assets/5-first-run.png` still said "never sells or shares"; introduced "its privacy policy" antecedent in the lede, a stale approval comment in `consent.ts`, and a wording tension in the disclosure line |
| 2 rework | `69c4d4b7` creator-analytics#6 pre-PR review 2 finding 2 rework: the privacy policy's extension section still said it never shares what it reads, and the lede's "its privacy policy" read as the data's | multi-line sweep `perl -0ne 'print "$ARGV\n" if /sells?\s+or\s+shar\|never\s+shar/i'` over `apps/**/*.{html,ts,tsx}`, `packages/**/*.ts`, `CONTEXT.md` lists only unrelated code comments; the three suites 146/146 | 0 added (one approval comment in `consent.ts` reworded to name the pending line) | fixed |
| 3 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 6 (LOW, comment hygiene) | — deferred | — | — | LOW tail, not worked this round |

`pnpm typecheck` and `pnpm lint` exit 0 at `69c4d4b7`; the follow-up changes one regex in a test file and passes `biome check`.

### Known regressions, deferred
- The disclosure line now reads "shares it only with the services the privacy policy names, and never shows it to anyone but you", and a reader can ask who those services are if not "anyone": introduced by `7e8ec722`, verdict "Shares it with [services] next to never shows it to anyone but you invites the question of who those services are", not fixed because it is a copy choice inside the line already pending Nick's word-for-word approval (a candidate: "no other person sees it but you").
- The address rule still reads a letter-led asset name such as `logo@dark.svg` as an address: introduced by `7f0d0787`, verdict "This only fails loudly, so it is never a false pass. No site page has one today", not fixed because it can only fail the suite, never pass a bare address.

### Open, outside the repo
- `apps/extension/store-assets/5-first-run.png`, the Chrome Web Store screenshot of the first-run page, still shows "It never sells or shares your data". It needs a retake with `apps/extension/test/screenshot/take-screenshots.ts` once Nick approves the new line 3, and an upload to the stores, an outward action for Nick; the listings' long descriptions are not in the repo and need the same check. Filed as a proposal in `.epic-loop/stage2/proposals.md`; the take (#975) should wait on it.
- `docs/adr/0007-no-third-party-processors.md:3` still records "never sells or shares data". Left as written (a decision record, not a published surface) and filed as a proposal for Nick to amend or supersede.
- The site suite builds release pages from the fixture notes, so a future real release note with a bare address would not be caught by the rule test. No real note holds one today.

### Rework briefs
- Finding 1 rework: the rule test must not read a srcset density name (`@2x.png`) as an address and must still catch every real address outside the markers; the Before recording check must fail on a failed or empty fetch and still fail on Cloudflare's rewrite. Preserve the test's place and loop over every served page, and item 2's position in the list. Proof: node pattern checks, the site suite, and the item's two counts against production before deploy (mailto 0, cdn-cgi 6).
- Finding 2 rework: every published sentence that denied sharing says the narrower form, wrapped HTML lines included; the lede's antecedent is "the privacy policy"; no approval comment calls the pending line approved. Preserve every other word of the policy's Studio extension section and its tests. Proof: the multi-line perl sweep, the three suites.

## Approach decisions (remediation, 2026-11-24)
- A value Cloudflare would rewrite on a site page (an email address) sits inside `<!--email_off-->` markers, held by one rule test over every served page, whose address pattern excludes only a srcset density descriptor after the `@`.
- A production check in "Before recording" asserts a positive count of what should be there beside the zero count of what should not, with `curl -sf`, so a failed fetch cannot pass.
- A published sharing claim says Stillstats never sells data and shares it only with the services the privacy policy names; the surface check is a multi-line search (`perl -0`), since HTML copy wraps across lines.
- A shared copy constant's pending line carries the pending-approval marker at the constant, and each consumer's approval comment names that exception.
- An ADR is a decision record, not a published surface: a claim there that the policy has outgrown becomes a proposal for Nick, not an in-place edit.
