# Pre-PR review: creator-analytics#6 Compliance audit application

**Branch:** `creator-analytics-6-compliance-audit` vs `origin/main` (merge-base `20a6c7c2`, "Merge pull request #1059 from nick-vogel/creator-analytics-938-drop-copy-pins")
**Reviewed at:** HEAD `a04aba72` (creator-analytics#970 The privacy policy names Cloudflare Email Service) + 0 files with uncommitted changes, 0 untracked files, 11 files total, +1139 / −2
**Reviewed against:** epic #6 and the sub-issues this branch carries, #970, #971, #973 and #974 (bodies read with `gh`; #40, #972, #975 and #976 are open, human-run and not on this branch), the global rules in `~/.claude/rules/`, the repo rules `.claude/rules/row-level-security-tests.md` and `.claude/rules/youtube-test-limits.md` (neither applies: no database or Google stand-in test is touched), Google's Developer Policies page ("Last updated 2026-11-06 UTC"), derived-metrics policy page ("Last updated 2026-09-14 UTC") and the audit form, each fetched on 2026-11-24. The repo has no `AGENTS.md` or `CLAUDE.md` at its root. This folder held no review docs before this one, and no spec or plan under `docs/` names #6.
**Date:** 2026-11-24
**Reviewer:** 2 code-review agents + verify pass

## What was verified and how
| Check | Method | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | green (865 files) |
| Typecheck | `pnpm typecheck` | green. It does not cover `docs/audit-application/*.ts`: `pnpm -r typecheck` runs per package and no tsconfig includes `docs/` (see Minor) |
| Site suite | `pnpm exec vitest run apps/site/test/site.test.ts` (Testcontainers Postgres, `TEST_DATABASE_ADMIN_URL` unset) | green, 104/104 |
| Build, full `pnpm test`, browser walk | Not run by this review: load average 19 to 25 on 14 cores during the review, and the branch's only code change is one paragraph in `apps/site/privacy.html` and one test, both covered by the site suite above | not run; the merge workers ran the full checks at each ticket's landing |
| Tautology audit (Phase 4.5) | Scratch worktree at HEAD with `git show 20a6c7c2:apps/site/privacy.html` in place of the policy, then `pnpm exec vitest run apps/site/test/site.test.ts -t "Cloudflare Email Service"` | red at base: all 7 affirmed facts missing |
| Mutants of the new paragraph | Same scratch worktree: (a) "your channel" moved from the denial into the list of what the email holds; (b) "the time it was sent" deleted | both red: (a) `/\bchannel\b/` fails `denies`, (b) `/\btime\b[^.]*\bsent\b/` fails `affirms` |
| Privacy paragraph against the email | Read `apps/api/src/feedback-notice.ts:34-51` and `apps/api/src/notification-email.ts:86-100` (agent, re-read in part) | matches: type, time, a generic `/app/admin/feedback` link; no text, reply address, user, channel or message ID |
| PNGs and PDF regenerated from source | Scratch worktree at HEAD: `node docs/audit-application/build-diagrams.ts` and `node docs/audit-application/build-policy-questions-pdf.ts`, then `cmp` on each PNG and `pdftotext` on both PDFs | both PNGs byte-identical; the PDF's text identical (its bytes differ only in metadata) |
| Endpoint checklist against the gateway | Agent read `packages/youtube-gateway/src` for every Data, Analytics and Reporting API call | the three ticked methods are the gateway's whole Data API set; `search.list` and `videos.insert` unticked; the Analytics and Reporting lists match |
| Quoted policy text and dates | Agent fetched both Google pages and the form with `curl` and compared every `>` quote after normalising whitespace and quotes | every quote matches; both "Last updated" dates match; the form's field labels, options and attestations match |
| The nine questions against #6's spec | Agent compared `docs/audit-application/policy-questions.md` with the spec | match, but for question 8's "Now" (dismissed below: the code moved after the spec) |
| Section 3 length | `awk` between the fences, `node` `.length` | 1,958 characters (the doc says 1,959; within 100 to 5,000 either way) |
| Em-dashes | `git diff 20a6c7c2 -- . ':!*.png' ':!*.pdf' \| grep $'—'`; agent checked the PDF text | none |
| Shot list UI strings | Agent grepped about 120 labels from the shots in `apps/web`, `apps/extension` and `apps/site` | all present, templated ones checked separately; one behaviour wrong (finding 2) |
| Diagram boxes and arrows | Agent read every `data-code` path and checked each label's claim against the code; both PNGs viewed | every path exists; claims hold but for findings 3, 4 and 6 |
| What only Google or a live recording can show | Not run: the consent screen's listed permissions, a cued embed's on-screen state, whether "Other Supporting Materials" takes a link | not run; these rest on #975's recording and #976's submission |

**Overall:** the code side holds: the privacy paragraph says exactly what the feedback email carries, its test goes red at base and against both mutants, lint and the site suite are green, and the PNGs and the PDF are exactly what their sources render. The documents Google receives mostly match the code and Google's own pages. Three statements to Google don't, and each is cheap to fix before the PR opens: Section 3 says Stillstats shares no data and loads no tracking script, which its own privacy policy contradicts; shot 30 narrates a paused player where the code leaves the player cued; and the architecture diagram's extension box leaves out Firefox and the youtube.com surface. The rest are LOW.

## Approach decisions
- A statement about the product to Google mirrors the published page that already makes it, word for word where it can, so the application and the privacy policy can't disagree (finding 1 mirrors `apps/site/privacy.html:236-241`).
- What the screencast says the retention player does mirrors question 5's "Now" in `docs/audit-application/policy-questions.md:76`, which matches `apps/web/src/youtube-player.ts:164-174` (finding 2).
- A diagram change is made in the SVG and the PNG is regenerated with `node docs/audit-application/build-diagrams.ts`, never edited by hand (findings 3, 4 and 6).
- Section 3's stated length is the `node` count of the text between the fences without its trailing line break, the figure the finding 1 proof command prints (2,126 after remediation 1), which also settles finding 7's line 60 entry.
- A diagram box keeps its 220-pixel width while its notes fit inside it in the regenerated PNG; it is widened, with its outgoing arrow's start moved to the new edge, only when a note overflows (finding 3's notes fit, so the extension box and `arrow-extension-cloudflare` are unchanged).

## Confirmed Issues
### 1. Section 3 tells Google that Stillstats doesn't share data and loads no tracking script, which its own privacy policy contradicts — MEDIUM
- **Location:** `docs/audit-application.md:55`
- **Attribution:** introduced, by `0bbd2270` (creator-analytics#971 Draft the audit application): `git log --oneline -S"loads no ad or tracking script" 20a6c7c2..HEAD` names only that commit, and the file is new on this branch.
- **Real-world trigger:** Nick pastes Section 3 as written. The reviewer reads "doesn't sell or share data", then the privacy policy's section "How Stillstats shares your data" (which shot 45 also shows on camera), and sees OpenPanel's script load in the network tab. MEDIUM, capped: it is a wrong statement in a submission whose Section 7 attests the information is "true, complete, and accurate", but it is text, not product behaviour.
**Evidence** — the draft:
```
Stillstats doesn't sell or share data, loads no ad or tracking script, and sends no channel data to an AI service.
```
`apps/site/privacy.html:236-241`:
```
We do not sell your data. We share it with no one beyond the infrastructure that delivers
Stillstats, described below, and Stripe, only when you open the tip link or one of
Stillstats Pro's Stripe pages.
...
Stillstats loads no ad pixels, and no third-party script except YouTube's video player,
```
`apps/site/src/analytics.ts:3` imports `@openpanel/web`, and the privacy policy's "Product analytics and error reports" (`apps/site/privacy.html:297-317`) says the site and the product record page views and clicks with OpenPanel.
**Failure mode** — two claims are false as written. Stillstats shares data with Cloudflare, Cloudflare Email Service and Stripe, which the privacy policy names. It loads a usage-analytics script (first-party, self-hosted, but a tracking script by any reviewer's reading) and YouTube's player, a third-party script.
**Recommended fix** —
```diff
-... Stillstats doesn't sell or share data, loads no ad or tracking script, and sends no channel data to an AI service. Each kind ...
+... Stillstats doesn't sell data, and shares it only with the services its privacy policy names. It loads no ad pixel and no script from another company except YouTube's own player, its product analytics run on a server it operates itself, and it sends no channel data to an AI service. Each kind ...
```
Then recount the text between the fences the way line 60 says, and update line 60's figure.
**Remediation brief**
- **Design intent:** the draft is the exact text Google receives (line 3), and the privacy policy is the published page Google checks it against. A product claim in the draft says no more than the policy does. The policy's wording (`privacy.html:236-241`) and the homepage's (`apps/site/index.html:85-87`, "no ad pixel and no script from another company", "Product analytics run on a server Stillstats operates itself") are the approved forms of this claim.
- **Full surface:** `docs/audit-application.md:55` (the sentence) and `docs/audit-application.md:60` (the character count). `grep -n -i "tracking\|share data\|sell" docs/audit-application.md docs/audit-application/policy-questions.md docs/oauth-verification.md` finds no other copy of the claim.
- **Must preserve:** the rest of paragraph 3 ("plain numbers", "engaged views kept apart", "published time limit", "within 24 hours"); the other three paragraphs; the length within 100 to 5,000; no em-dash; the claim "sends no channel data to an AI service", which `privacy.html:239` backs.
- **Do not touch:** the "Not applicable" answer on line 68 about selling ads in YouTube content, which is a different question (Reviewed and Dismissed is silent on it because nothing indicts it).
- **Proof:** `grep -n "share data\|tracking script" docs/audit-application.md` prints nothing after the fix; `awk '/^\`\`\`$/{n++; next} n==1' docs/audit-application.md | node -e 'let s=require("fs").readFileSync(0,"utf8").replace(/\n$/,""); console.log(s.length)'` prints the figure line 60 then states, between 100 and 5,000.

### 2. Shot 30 says a click on the cued player moves it to that moment and leaves it paused, but the code cues it again and it never shows a paused frame — MEDIUM
- **Location:** `docs/audit-application.md:281`
- **Attribution:** introduced, by `3d8a3348` (creator-analytics#974 Write the audit screencast shot list): `git log --oneline -S"stays paused" 20a6c7c2..HEAD` names only that commit.
- **Real-world trigger:** Nick records the one-take screencast (#975) following shot 30. The zoom asks for "the player's time and its paused state after the click", and the narration says the player "stays paused", while the embed still shows YouTube's cued thumbnail and play button. These three shots are the evidence for policy question 5, so the reviewer hears one behaviour and sees another, about the exact clause the question asks about. MEDIUM, capped: docs, not product behaviour; the product does what question 5 says.
**Evidence** — the shot:
```
Click the "Audience retention" chart at a moment about halfway through: the player moves to that moment and stays paused | The player's time and its paused state after the click | ... When I click the chart, the player moves to that moment and stays paused.
```
`apps/web/src/youtube-player.ts:168-174`:
```
// etc.), the player will play the video." A seek must never start a stopped player
// (Developer Policies III.C.2, creator-analytics#6), so a stopped one is cued at the time.
else if (seekKeepsPlaybackAsItIs(player.getPlayerState(), settledState)) {
  player.seekTo(seconds, true)
} else player.cueVideoById(cue)
```
`seekKeepsPlaybackAsItIs` (`youtube-player.ts:107-109`) is true only for playing (1), paused (2) and buffering not settled paused (3). A player loaded cued is in state 5, so the click calls `cueVideoById`.
**Failure mode** — cued player (state 5) + a chart click → `cueVideoById({ startSeconds })` → the embed is cued at that time and shows the cued thumbnail and play button, not a paused frame at the clicked moment. The question 5 text in the PDF says this correctly: "A player that hasn't started yet is cued at that moment" (`policy-questions.md:76`). Shot 31 then plays from that moment, which is right. Whether a cued embed shows any time at all was not run (it needs a real embed), so the zoom on "the player's time" likely has nothing to show.
**Recommended fix** — in row 30 of the shot table:
```diff
-... Click the "Audience retention" chart at a moment about halfway through: the player moves to that moment and stays paused | The player's time and its paused state after the click | Beside the audience retention charts is YouTube's own embedded player. It loads cued. It doesn't play. When I click the chart, the player moves to that moment and stays paused. |
+... Click the "Audience retention" chart at a moment about halfway through: the player is cued at that moment and doesn't start, with YouTube's play button still showing | YouTube's play button on the cued player after the click | Beside the audience retention charts is YouTube's own embedded player. It loads cued. It doesn't play. When I click the chart, the player is cued at that moment, and it still doesn't play. |
```
**Remediation brief**
- **Design intent:** under III.C.2 a click on Stillstats's chart must never start playback. `seekTo` from a cued state plays the video, so `youtube-player.ts` sends a stopped player `cueVideoById` at the clicked time, and a playing or paused one `seekTo`, which keeps its state. The shot list's job is to show exactly that, so it says what the viewer sees in each state.
- **Full surface:** `docs/audit-application.md:281` (shot 30: action, zoom and narration). Shot 31 (`:282`, "the video plays from that moment") and shot 32 (`:283`, a click while playing keeps playing) already match the code. Row 5 of "What each policy question shows" (`:313`) keeps "30, 31 and 32".
- **Must preserve:** shots 31 and 32 as they are; the recording rule that holds each screen three seconds; question 5's "Now" in `policy-questions.md:76`, which is already right and is the wording to mirror.
- **Do not touch:** `apps/web/src/youtube-player.ts`, whose behaviour is the reference here and is held by `apps/web/src/youtube-player.test.ts` and `apps/web/src/video-player.test.ts`.
- **Proof:** `grep -n "stays paused" docs/audit-application.md` prints nothing after the fix, and `sed -n 281p docs/audit-application.md` says the player is cued at the clicked moment. The on-screen state is confirmed in #975's take.

### 3. The architecture diagram's extension box says it runs in Chrome on YouTube Studio only, leaving out Firefox and the youtube.com surface — MEDIUM
- **Location:** `docs/audit-application/stillstats-architecture-diagram.svg:52-58` (and its PNG)
- **Attribution:** introduced, by `78deb989` (creator-analytics#973 Draw the architecture and user-flow diagrams for the audit form): `git log --oneline -S"in Chrome, on YouTube Studio" 20a6c7c2..HEAD` names only that commit.
- **Real-world trigger:** the reviewer reads Section 3 ("The free Stillstats extension for Chrome and Firefox ... and, if the creator turns it on, beside the view counts of their own videos on www.youtube.com"), watches shots 40 to 44 on youtube.com, and then opens the uploaded architecture diagram, which draws an extension that runs only in Chrome and only in Studio. MEDIUM, capped: an inconsistency between documents Google receives, the same gap #971's review pass 1 fixed in the written draft (`1dac8b96`).
**Evidence** —
```
<g id="extension" data-code="apps/extension/src/product-api.ts apps/extension/src/manifest.ts">
  <rect class="box" x="50" y="480" width="220" height="130" rx="10"/>
  <text class="name" x="160" y="513" text-anchor="middle">Studio extension</text>
  <text class="note" x="160" y="538" text-anchor="middle">in Chrome, on YouTube Studio</text>
  <text class="note" x="160" y="560" text-anchor="middle">shows the channel's figures</text>
  <text class="note" x="160" y="582" text-anchor="middle">beside Studio's own</text>
</g>
```
`apps/extension/package.json:7` builds for Chrome and Firefox (`wxt build -b chrome --mv3 && wxt build -b firefox --mv3`); `apps/extension/src/entrypoints/youtube.content.ts` is the youtube.com surface, behind the popup's "Show engaged views on youtube.com" and an optional host permission in `apps/extension/src/manifest.ts`; `apps/site/index.html:76` links the Firefox listing.
**Failure mode** — the diagram, uploaded as Section 6's architecture evidence, describes a smaller extension than the one the application text, the privacy policy and the screencast describe.
**Recommended fix** —
```diff
-  <g id="extension" data-code="apps/extension/src/product-api.ts apps/extension/src/manifest.ts">
+  <g id="extension" data-code="apps/extension/src/product-api.ts apps/extension/src/manifest.ts apps/extension/src/entrypoints/studio.content.ts apps/extension/src/entrypoints/youtube.content.ts">
     <rect class="box" x="50" y="480" width="220" height="130" rx="10"/>
     <text class="name" x="160" y="513" text-anchor="middle">Studio extension</text>
-    <text class="note" x="160" y="538" text-anchor="middle">in Chrome, on YouTube Studio</text>
-    <text class="note" x="160" y="560" text-anchor="middle">shows the channel's figures</text>
-    <text class="note" x="160" y="582" text-anchor="middle">beside Studio's own</text>
+    <text class="note" x="160" y="538" text-anchor="middle">Chrome and Firefox, on Studio</text>
+    <text class="note" x="160" y="560" text-anchor="middle">and, if turned on, youtube.com</text>
+    <text class="note" x="160" y="582" text-anchor="middle">beside YouTube's own figures</text>
   </g>
```
Then run `node docs/audit-application/build-diagrams.ts` and view the PNG: if a note overflows the 220-pixel box, widen the box (and move the arrow `arrow-extension-cloudflare`'s start at `M270 545` to the box's new right edge) rather than shrink the text.
**Remediation brief**
- **Design intent:** each box names the code it stands for in `data-code`, and the build script fails on a path that no longer exists. The extension reads every number from the Stillstats API (`apps/extension/src/product-api.ts`), never from YouTube, on both of its surfaces; that is why its one arrow says "requests to the Stillstats API only".
- **Full surface:** `docs/audit-application/stillstats-architecture-diagram.svg:52-58`, then the regenerated `docs/audit-application/stillstats-architecture-diagram.png`. The user-flow diagram (`stillstats-user-flow-diagram.svg:78-81`) names "the Studio extension" without a browser or surface, which is not wrong and needs no change.
- **Must preserve:** the arrow `arrow-extension-cloudflare` and its label "requests to the Stillstats API only" (true: no YouTube API host appears in `apps/extension/src`); the box title, which is the product's name for the extension; the canvas size 1920 by 1080 the build script reads.
- **Do not touch:** the boundary box and the gateway's edges, which were checked against `lint/youtube-hosts.grit` and the gateway and hold.
- **Proof:** `grep -n "Firefox\|youtube.com" docs/audit-application/stillstats-architecture-diagram.svg` shows both new notes; `node docs/audit-application/build-diagrams.ts` exits 0; `git status --porcelain` then shows the PNG changed beside the SVG.

### 4. The architecture diagram leaves out three outward data flows the privacy policy names: product analytics, error reports, and YouTube's player and thumbnails — LOW
- **Location:** `docs/audit-application/stillstats-architecture-diagram.svg` (no box for OpenPanel or GlitchTip; `embedded-player` at `:46-51` has no edge to YouTube)
- **Attribution:** introduced, by `78deb989` (the file is new on this branch).
- **Real-world trigger:** a reviewer comparing the diagram with the privacy policy's "Product analytics and error reports" (`apps/site/privacy.html:297-317`) and its ytimg.com paragraph finds flows the drawing does not have. LOW: the intro's claim is limited to "Every call to YouTube's Data, Analytics and Reporting APIs goes through the YouTube gateway", so nothing drawn is false, and #973's acceptance criteria list the boxes it must have, which it does.
**Evidence** — `apps/api/src/modules.ts:95` (`eventRelay: createEventRelay(openPanel, { reporter })`), `packages/reporter/src/index.ts:19` (GlitchTip through the Sentry SDK in production), `apps/site/src/analytics.ts:3` (the browser's OpenPanel client), `apps/web/src/youtube-player.ts` (loads `https://www.youtube.com/iframe_api`; the frame is `youtube-nocookie.com`).
**Failure mode** — the diagram reads as the whole system ("Arrows say what passes along them") and omits where usage events, error reports and the player's requests go.
**Recommended fix** — add one box "Product analytics (OpenPanel, self-hosted)" with arrows from the web app and the API, one box "Error reports (GlitchTip, self-hosted)" with arrows from the API and the worker, and an arrow from `embedded-player` to a "YouTube (player and thumbnails)" box outside the gateway's boundary, each `<g>` with a `data-code` naming the files above. Regenerate the PNG.
**Remediation brief**
- **Design intent:** the intro scopes the gateway claim to API calls, so these edges sit outside the gateway box and must not be drawn as gateway calls.
- **Full surface:** `docs/audit-application/stillstats-architecture-diagram.svg` and its PNG. Self-hosting of GlitchTip is stated in `privacy.html:317` ("which we also host on").
- **Must preserve:** the gateway boundary and its claim; the layout's readability at 1920 by 1080; the em-dash and `data-code` checks the build script runs.
- **Do not touch:** finding 3's box, apart from the space this needs.
- **Proof:** `node docs/audit-application/build-diagrams.ts` exits 0, and `grep -c "OpenPanel\|GlitchTip" docs/audit-application/stillstats-architecture-diagram.svg` is at least 2.

### 5. The screencast's link goes in "Special Instructions for Access", while the form asks for it in Section 6's "Other Supporting Materials" — LOW
- **Location:** `docs/audit-application.md:95` and `:178`
- **Attribution:** introduced, by `0bbd2270`.
- **Real-world trigger:** "Other Supporting Materials" takes one file and no link, the PDF fills it, and the reviewer looks for the screencast where the form told them it would be. LOW: the draft knows this, explains the choice and carries a `[GAP #976]` to check the live form, and the link is still in the application.
**Evidence** — `:178`: "The form takes one file a field, and the note under Section 4 asks for the screencast link in Other Supporting Materials. The questions PDF takes that field's one upload, so the screencast link goes in "Special Instructions for Access" instead."
**Failure mode** — whatever the field turns out to accept, the one upload Section 6 carries does not hold the screencast link.
**Recommended fix** — also put the link in the PDF's opening paragraph (`docs/audit-application/policy-questions.md:3`) as `[GAP #975] the screencast's unlisted YouTube link`, so Section 6's one upload carries it; widen line 13's grep to `grep -rn 'GAP #97' docs/audit-application.md docs/audit-application/` so the new marker is listed; and change `:178` to say the PDF carries the link as well.
**Remediation brief**
- **Design intent:** the PDF's text lives once in `policy-questions.md` and the PDF is printed from it (`:203`); #975 fills every screencast gap, and the PDF is rebuilt after it does.
- **Full surface:** `docs/audit-application/policy-questions.md:3`, `docs/audit-application.md:13`, `:178`, and `docs/audit-application/policy-questions.pdf` (rebuilt with `node docs/audit-application/build-policy-questions-pdf.ts`). `docs/audit-application.md:322` (After recording, step 2) then names both places.
- **Must preserve:** the Special Instructions text at `:95`; the PDF's title; the nine questions unchanged.
- **Do not touch:** the `[GAP #976]` at `:178`, which stays as the live-form check.
- **Proof:** `grep -rn 'GAP #975' docs/audit-application/policy-questions.md` prints the new line, and `pdftotext docs/audit-application/policy-questions.pdf - | grep -c 'GAP #975'` prints 1.

### 6. Two diagram labels say more than the code does: every Pro video's retention curve downloaded every day, and row-level security "on every table, job queue" — LOW
- **Location:** `docs/audit-application/stillstats-user-flow-diagram.svg:106` and `:111-112`; `docs/audit-application/stillstats-architecture-diagram.svg:209-210`
- **Attribution:** introduced, by `78deb989`.
- **Real-world trigger:** a reviewer reading the storage claims against III.E.4's refresh rules takes the user-flow label as a daily refresh of every curve, and the Postgres label as row-level security over the job queue. LOW: neither changes what the product does, and both are near-true.
**Evidence** — user flow, under "Every day, the worker": "for a Pro channel: downloads its reach history (impressions and / click-through rate) and its videos' audience retention curves". `apps/worker/src/retention-curves.ts:23-26`: "A video younger than this is read again each UTC day, an older one monthly" (28 and 30 days). Architecture: "row-level security forced / on every table, job queue". `packages/database/src/migrate.ts:11-27` forces it on tables that already enable it, and pg-boss's tables live in their own `pgboss` schema (`packages/database/src/jobs.ts:103`) with no row-level security code.
**Failure mode** — two labels in Section 6 evidence overstate a cadence and a security boundary.
**Recommended fix** — user flow `:112`: "click-through rate), and its videos' audience retention curves, each day for a video under 28 days old and monthly after" (split across two `note` lines as the box needs). Architecture `:209-210`: "row-level security forced" / "on every app table; job queue". Regenerate both PNGs.
**Remediation brief**
- **Design intent:** the diagrams draw what the code does today (#973), and a timing in a label is a claim Google may check against the storage clauses.
- **Full surface:** the three SVG lines above and both PNGs.
- **Must preserve:** "deletes a channel's stored history 30 days after its Pro subscription ends" (`:113-114` of the user flow), which holds; every other line of the daily box, each checked against the daily rosters in `apps/worker/src/jobs.ts`.
- **Do not touch:** the cache label (every `cacheWindowMs` is 6 hours, swept hourly), which holds.
- **Proof:** `grep -n "monthly" docs/audit-application/stillstats-user-flow-diagram.svg` and `grep -n "every app table" docs/audit-application/stillstats-architecture-diagram.svg` each print one line; `node docs/audit-application/build-diagrams.ts` exits 0.

### 7. Comment hygiene — LOW (aggregated)
- `apps/site/test/site.test.ts:1465-1467` — "the facts its two items name, not their sentences, and so does the Cloudflare Email Service test (#970), which holds the facts its paragraph names, and so do the reach report tests (#779)" → "the facts its two items name, not their sentences, and so do the Cloudflare Email Service test (#970), the reach report tests (#779)" (the "which holds the facts" clause repeats the clause that ends the sentence).
- `apps/site/test/site.test.ts:1594-1597` — the test comment names `feedbackNoticeOf` but not the tests that hold the email's side → add "The email's side is held by `apps/api/src/feedback.test.ts`, 'one email per saved message, holding the type, the time and the admin link' and 'the email holds neither the text, nor the reply address, nor the user ID, nor the message ID'." so a change to the email points at this paragraph.
- `docs/audit-application.md:156` — "checked ... with `grep -rnoE "api\.[a-zA-Z.]+\(" ...`, which lists `channels.list`, ..." → say the grep finds single-line calls only, and that `identifyGrant`'s chained `.channels.list(` at `packages/youtube-gateway/src/youtube-gateway.ts:553` was read by hand (the set is still right, because `channels.list` appears elsewhere).
- `docs/audit-application.md:60` — "1,959 characters" → "1,958 characters" (the count without the trailing line break, which a paste does not carry), or whatever the count is after finding 1.

## Needs Further Investigation
### A. Shot 12 shows the upgrade screen's "Deleting your channel still removes all of its data within 6 hours.", while shots 48 and 49, the privacy policy and the diagram say 24 hours. To confirm a problem, read the deletion deadline in the retention engine (`git grep -n "hourMs" -- apps/worker packages | grep -i "delet\|alarm"`) and see whether 6 hours is guaranteed; a finder read the alarm at 12 hours. Pre-existing and untouched (`apps/web/src/upgrade.ts:84`, approved in #913). If 6 hours isn't guaranteed, it is a follow-up ticket for that copy, not this branch.
### B. The user-flow diagram (`stillstats-user-flow-diagram.svg:51-52`, "two read-only scopes: YouTube, and YouTube Analytics") and shot 5's narration name two scopes, while the connect consent also asks for `openid` and `email` (`apps/api/src/connect.test.ts:46`). Whether Google's screen lists the email permission at connect, after sign-in already granted it, shows only on the live consent screen: check it in #975's take, and if it lists email, say "two read-only YouTube scopes, with your email to match the account" in both places.

## Reviewed and Dismissed
- Question 8's "Now" says the sponsor report is live, where #6's spec says "planned as a PDF" — the code moved after the spec: the sponsor report (#938) is on main with "Save as PDF", and shot 34 shows it. The draft follows the rule that the code wins.
- Question 7 says Pro "will soon cover up to 4 of a user's channels" — the site says the same (`apps/site/index.html:211`, `apps/web/src/upgrade.ts:26`).
- The `<!-- Pending Nick's word-for-word approval, creator-analytics#970. -->` comment in `apps/site/privacy.html` — the repo's pattern for copy awaiting approval (`privacy.html:171` holds one for #582), removed in the approval commit as `27cff35c` (creator-analytics#936 Mark the copy approved) did. See Before opening the PR.
- The new site test as a copy test under `tests-state-a-rule` — it is a rule over the copy that comes from the code (what `feedbackNoticeOf` sends), the shape the rule keeps; #970's criteria ask for it; it is red at base and against both mutants.
- The endpoint checklist — the ticked and unticked methods match the gateway's calls exactly, and "the form offers no Others item there" holds on the live form.
- Every quoted policy sentence and both "Last updated" dates — match Google's pages as fetched on 2026-11-24.
- Stale PNGs or PDF — regenerated in a scratch worktree: PNGs byte-identical, PDF text identical.
- `build-diagrams.ts` checking `data-code` on boxes only — every arrow is a `<g data-code>` too, so arrows are checked.
- "Arrows say what passes along them" against the RISC, Stripe and Google edges — directions and labels match `auth.ts`, `risc.ts`, `token-vault.ts` and the Stripe webhook.
- Retention comparison "up to five" and the extension's `period-4_weeks` mapping in shot 39 — match the code.

## Minor / nits
- Both build scripts build `file://${path}` by hand (`build-diagrams.ts:69`, `build-policy-questions-pdf.ts:58`); `pathToFileURL(path).href` from `node:url` survives a path with a space or `#`.
- `build-policy-questions-pdf.ts` logs "Wrote" when Chrome exits 0 without writing, leaving the old PDF; a signal kill reports "Chrome exited with null".
- The Chrome path default is now in four places (both scripts, `apps/extension/test/screenshot/chrome.ts:15`, `apps/site/test/screenshot/browser-walk.ts:227`); the two test copies are test-local, so sharing is awkward.
- `build-diagrams.ts:29` checks the raw em-dash only, not `&mdash;` or `&#8212;`; none is in either SVG today.
- The two `docs/` scripts are linted but never type-checked, and were run here under node 26.3.0 while `package.json` pins `>=24.22.1 <25`.
- The PDF breaks "2026-09-14" across two lines in the sources list (`policy-questions.md:10`); a non-breaking hyphen keeps it whole. `linkify: false` in `htmlOf` also leaves the PDF's URLs as plain text.
- The user-flow arrow "right after the first sign-in" (`stillstats-user-flow-diagram.svg:46`) holds for a sign-in from the web app's signed-out screen with no channel, not from the homepage.
- "After recording" ends with signing back in, not with the upload #974 asked the list to end on; the upload and the link are steps 1 and 2.

## Test quality
Tests added: 1 (`apps/site/test/site.test.ts`, "the privacy policy's sharing section names Cloudflare Email Service, the feedback notice it carries, and what it receives"). Green against `$BASE`: 0 (red at base, all 7 affirmed facts missing). Tautology shapes found: 0: it reads the served page through `startApi`, filters to the one paragraph that names the service (the Stripe paragraphs also say "account" and "link"), and `denies` requires a match, so an empty paragraph cannot pass. Two mutants of the paragraph went red. One edited comment (finding 7).

## Before opening the PR
- **CI readiness:** `pnpm lint` and `pnpm typecheck` green, the site suite 104/104. `pnpm build` and the full `pnpm test` were not run by this review (machine load); CI runs both.
- **Commit hygiene:** the tree was clean at review time. Each fix above is a docs or SVG change, and findings 3, 4 and 6 also commit the regenerated PNGs.
- **Copy approval:** the new privacy paragraph carries the pending-approval comment. Nick approves its wording on #970 and the comment comes out before the paragraph reaches production, since the screencast (#975) waits on it being live (`docs/audit-application.md:225`).
- **Likely reviewer asks:** whether the draft's product claims were checked against the code (this doc's table), and why the screencast link sits outside Section 6 (finding 5).

## Verdict
Not ready as-is. Fix findings 1, 2 and 3 before the PR opens: each is a statement Google receives that the code or the privacy policy contradicts, and each is a few lines. Findings 4 to 7 are LOW and can ride in the same pass or follow. The two Needs Further Investigation items are for #975's recording and a possible follow-up ticket on the upgrade screen's copy, not gates on this branch.

## Remediation — 2026-11-24
| Finding | Commit | Proof | Comments added | Verify verdict |
| --- | --- | --- | --- | --- |
| 1 (MEDIUM) | `310ea484` creator-analytics#6 pre-PR review 1 finding 1: Section 3 told Google Stillstats shares no data and loads no tracking script, against its own privacy policy | red→green: `grep -n "share data\|tracking script" docs/audit-application.md` printed line 55 before and nothing after; the `awk ... \| node` count prints 2126, and line 60 now states 2,126 | 0 | proved by execution |
| 2 (MEDIUM) | `14a0edc4` creator-analytics#6 pre-PR review 1 finding 2: shot 30 narrated a paused player after the chart click, where the code cues a stopped player at that moment | red→green: `grep -n "stays paused" docs/audit-application.md` printed line 281 before and nothing after; `sed -n 281p` says the player is cued at the clicked moment; shots 31 and 32 unchanged | 0 | proved by execution (the on-screen state is confirmed in #975's take) |
| 3 (MEDIUM) | `611491ae` creator-analytics#6 pre-PR review 1 finding 3: the architecture diagram drew a Chrome-only extension on Studio alone, leaving out Firefox and the youtube.com surface | red→green: `grep -n "Firefox\|youtube.com" docs/audit-application/stillstats-architecture-diagram.svg` printed nothing before and lines 55 and 56 after; `node docs/audit-application/build-diagrams.ts` exits 0, the architecture PNG changed beside the SVG, the user-flow PNG came out byte-identical; the PNG viewed, every note inside the 220-pixel box | 0 | proved by execution |
| 4 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 5 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 6 (LOW) | — deferred | — | — | LOW tail, not worked this round |
| 7 (LOW) | — deferred | — | — | LOW tail, not worked this round; its line 60 entry is now moot, since finding 1 set that line to the current count |

After the round: `pnpm typecheck` exit 0, `pnpm lint` green (865 files). No test file reads `docs/audit-application*`, so no suite covers these three docs changes beyond the proofs above. Phase 2: every fix is MEDIUM, its proof was executed and none touched a shared computation core, so no verify agent was dispatched. No rework pass.

### Known regressions, deferred
- None.

### Rework briefs
- None.
