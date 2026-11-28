# Audit application

What Stillstats submits to Google in the YouTube API Services Audit and Quota Extension Form: the text for every field, section by section, in the form's own order and with its own field labels, so I can review it and paste it in. The application asks for quota above the default and opts in to the derived-metrics policy, and it carries the policy questions in a PDF. After submission this document keeps exactly what Google received, so I can quote it when Google answers or asks for more.

`docs/oauth-verification.md` is the same kind of record for OAuth verification, and the two describe one Cloud project. When a scope, an endpoint or the legal name changes, both change.

Google's own pages set every field below. Each was read on 2026-11-23:

- [The YouTube API Services Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form), for every section, field label, option and attestation.
- [The YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies), marked "Last updated 2026-11-06 UTC".
- [Additional policies for derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy), marked "Last updated 2026-09-14 UTC".

A field this document can't answer yet carries a gap marker, `[GAP #<issue>]`, with the issue that fills it: #975 for the screencast and the screenshots, and #976 for the details only I can give at submission. `grep -n 'GAP #97' docs/audit-application.md` lists every one.

## Section 1: Request Type

| Field | Answer |
|---|---|
| Select the reason for your request | Complete a compliance audit to request for additional quota |

## Section 2: Organization and Contact Information

The applicant is the LLC under its legal name, MIDLO WEB DESIGN, LLC, the name the privacy policy (`apps/site/privacy.html`) and the terms (`apps/site/terms.html`) give, so the reviewer sees one applicant everywhere. I'm the primary, the technical and the business contact, so every message from Google reaches me. Google writes to the Cloud Console account's email (Developer Policies III.D.5), so the primary contact email is that one.

| Field | Answer |
|---|---|
| Are you applying | As an organization or on behalf of an organization or registered entity such as a business, enterprise, non-profit etc. |
| Your Full Legal Name | [GAP #976] My full legal name |
| Your Organization's Legal Name | MIDLO WEB DESIGN, LLC |
| Parent Company Name (if applicable) | Left empty |
| Your Organization's Primary Website | `https://stillstats.com` |
| Country | United States |
| Street Address | [GAP #976] The LLC's legal address |
| City | [GAP #976] The LLC's legal address |
| State/Province | [GAP #976] The LLC's legal address |
| Postal Code | [GAP #976] The LLC's legal address |
| Category | Creator Tools and Services |
| Organization Size / Type | Startup (fewer than 10 employees) |
| Primary Contact Information, Name | [GAP #976] My full legal name |
| Primary Contact Information, Email | [GAP #976] The email of the Cloud Console account that owns `creator-analytics-510701` |
| Primary Technical Contact | Same as Primary Contact (Name and Email) |
| Primary Business Contact | Same as Primary Contact (Name and Email) |

## Section 3: Business Model and Google Contacts

### Describe your organization's work as it relates to YouTube

The form takes 100 to 5,000 characters. The text to paste:

```
Stillstats (https://stillstats.com) is a read-only analytics app for YouTube creators. A creator signs in with Google, connects their own channel through OAuth, and sees that channel's engaged views and views, watch hours, audience, traffic sources and audience retention, and its estimated revenue after a separate, optional consent. A creator sees only the channels they connected themselves, never another creator's data.

Every YouTube call goes through one server-side module, which uses only the official YouTube Data API, YouTube Analytics API and YouTube Reporting API with the creator's own OAuth grant. Stillstats calls no private or undocumented endpoint, scrapes nothing, and never writes to a channel. The free Stillstats extension for Chrome and Firefox shows a creator's own engaged views in YouTube Studio, beside Studio's own figures, and, if the creator turns it on, beside the view counts of their own videos on www.youtube.com. It reads every number from Stillstats, never from the page.

The value is plain numbers about a creator's own channel, with no grades, streaks or growth promises, and with engaged views kept apart, since YouTube changed how it counts a view in August 2026. Stillstats doesn't sell data, and shares it only with the services its privacy policy names. It loads no ad pixel and no script from another company except YouTube's own player, its product analytics run on a server it operates itself, and it sends no channel data to an AI service. Each kind of data has a published time limit, and disconnecting a channel or deleting the account deletes its data within 24 hours.

Stillstats makes money two ways. Pro is a subscription, $7 a month or $70 a year, that adds stored history to a channel, such as impressions and click-through rate from the creator's own YouTube Reporting API reports. Stillstats keeps that history while the subscription is active and for 30 days after it ends, then deletes it. A creator can also leave a one-time tip, which unlocks nothing. Both are paid on Stripe's hosted pages. There's no advertising. Stillstats is operated by MIDLO WEB DESIGN, LLC.
```

2,126 characters, the line breaks included, counted with `node -e` on the text between the fences.

### The other fields

| Field | Answer |
|---|---|
| Who is your target audience? | Individual Content Creators (YouTubers, influencers) |
| How does your API Client monetize or generate revenue? | Recurring Subscriptions (users pay monthly/yearly); Freemium (free version with paid upgrades); Other (please specify): "One-time tips on a Stripe hosted page, which unlock no features" |
| Do you sell advertisements or sponsorships ON or WITHIN YouTube video content or the embedded YouTube player itself? | Not applicable |
| If you answered yes, have you obtained prior written approval from YouTube for this commercial use? | Left empty |
| Do you currently have a designated Google Partner Manager or YouTube Partner Manager? | No, I do not have a Google representative |
| How did you first learn about the YouTube Data API? | [GAP #976] My answer |
| Content Owner ID(s) | None. No channel Stillstats reads is managed through the Content Manager system. |
| Google Ads Customer ID(s) | None. Stillstats manages no ad campaigns. |

## Section 4: API Client Overview and Access Information

| Field | Answer |
|---|---|
| API Client Name | Stillstats |
| Does this API Client name contain the word "YouTube"? | No, the name does not contain "YouTube" |
| Primary Access URL | `https://stillstats.com` |
| Privacy Policy URL | `https://stillstats.com/privacy` |
| Terms of Service URL (Optional) | `https://stillstats.com/terms` |
| Is your API Client publicly accessible? | Yes |
| Demo Account Username or Email | Left empty |
| Demo Account Password | Left empty |
| Login URL (if different from primary URL) | `https://stillstats.com/app` |
| Acknowledgment Required | Ticked |

Stillstats signs in with Google only, so there's no username and password to give. The form asks for an end-to-end screencast link when there's no demo account, and the screencast replaces the credentials.

"Special Instructions for Access (if any)", the text to paste:

```
Stillstats signs in with Google only, so there are no demo credentials. An end-to-end screencast of the web app and the Studio extension on my own channel, with Pro on, replaces them. It's at [GAP #975] the screencast's unlisted YouTube link. A test account is available on request. My policy questions for the API Services team are in the attached PDF, "Policy questions for the API Services team".
```

## Section 5: Use Cases and Quota Extension Details

One Cloud project, `creator-analytics-510701`, the project OAuth verification approved on 2026-10-26. The form asks for the project number, not the project ID. The number sits beside the ID on the Cloud Console dashboard's "Welcome" card.

| Field | Answer |
|---|---|
| How many project numbers are you adding? | 1 |
| Google Cloud Project Number | [GAP #976] The number of `creator-analytics-510701`, from the Cloud Console "Welcome" card |
| Use Case Category (or Categories) | Analytics & Reporting, and nothing else |
| Does this API Client require users to sign in with their Google Account (OAuth 2.0)? | Yes |
| Expected API Usage Volume | 10,000 to 100,000 requests per day (the measurement is in creator-analytics#972) |

### The derived-metrics opt-in

Chosen. The form's "Required agreement and acknowledgement" reads, and I tick it:

> I acknowledge that the following terms modify the Developer Policies with respect to my access to, and use of, YouTube Data API service:
>
> 1. Sections III E.2.a and E.4.h are amended to allow you to create derived metrics for limited purposes on the condition that you clearly and prominently label these metrics as generated independently by you and not sourced directly from YouTube’s API. Google reserves the right to update and/or modify its developer policies, including prohibited behaviors, at any time and without notice to developers.
> 2. Section III E.4.b, E.4.c, and E.4.d are amended by allowing you to store publicly available stats (e.g., views, likes, comment counts) for up to 36 calendar months. Derived metrics (e.g., custom scores using views, likes, etc.) that are based on retrieved data may also be stored for up to 36 calendar months. Other data (e.g., video titles, creator names, comment text) still must follow the 30-day refresh and deletion policy in Section III(4).
>
> I have read and agree to abide by the additional policies for derived metrics and data storage. I acknowledge that all other Data API policies will continue to apply to my access to, and use of, YouTube API Service(s)

Accepting it amends III.E.2.a and III.E.4.h for Stillstats. III.E.4.h reads:

> Your API Clients must not (i) replace API Data with similar, independently calculated data, or (ii) access or use API Data to create new or derived data or metrics. To the extent your API Clients display any information, data or metrics not based on API Data alongside API Data, your API Clients must include a clear and prominent disclosure there that such information, data and metrics are not from YouTube and are part of your own product.

Two decisions rest on the clauses as they stand. ADR 0004 holds the outlier engine until acceptance, and ADR 0013 draws the line between simple arithmetic on a channel's own numbers and a derived metric. Neither changes before Google answers. Google decides whether the use case qualifies: "Based on the information provided by you we will make a determination if your use case qualifies for these additional policies for derived metrics and data storage."

### Required evidence for Project #1

| Field | Answer |
|---|---|
| Privacy Policy Screenshots (Showing YouTube sections, Google Privacy Policy link, deletion policies, etc.) | [GAP #975] Screenshots of `https://stillstats.com/privacy` |
| Homepage Screenshot | [GAP #975] Screenshot of `https://stillstats.com` with the privacy policy link |
| Terms of Service Documentation | [GAP #975] Screenshot or PDF of `https://stillstats.com/terms` |
| a) OAuth Flow Screenshots (consent screen, scopes, revocation) | [GAP #975] The sign-in, connect and revenue consents, and a disconnect |
| d) Dashboard / Feature Screenshots | [GAP #975] The web app's screens and the Studio extension |

b) and c) don't apply: Stillstats uploads nothing and isn't one of the use cases that need player screenshots.

### Quota Details for Project #1

The checklist comes from the YouTube gateway, `packages/youtube-gateway`, the one module that calls YouTube (ADR 0003). Lint keeps every other package from calling a YouTube host (`lint/youtube-hosts.grit` and the `noRestrictedImports` rule in `biome.json`, proved by `packages/youtube-gateway/test/boundary.test.ts`), so the gateway's calls are the product's whole set. The form's checklist lists YouTube Data API methods only. These three are ticked:

| Ticked | The gateway code that calls it |
|---|---|
| `youtube.channels.list` | `packages/youtube-gateway/src/youtube-gateway.ts` (`identifyGrant`, `part=id`, `mine=true`), `packages/youtube-gateway/src/reads/channel-snippet.ts`, `packages/youtube-gateway/src/reads/uploads.ts` |
| `youtube.playlistItems.list` | `packages/youtube-gateway/src/reads/uploads.ts` |
| `youtube.videos.list` | `packages/youtube-gateway/src/reads/uploads.ts`, `packages/youtube-gateway/src/youtube-gateway.ts` (`existingVideos`) |

Every other item is unticked, `youtube.search.list` and `youtube.videos.insert` among them. Stillstats searches nothing and uploads nothing.

The gateway also calls the YouTube Analytics API and the YouTube Reporting API, which the checklist has no item for, and the form offers no "Others" item there:

- YouTube Analytics API v2, `reports.query`, for every analytics read under `packages/youtube-gateway/src/reads/`. The call itself is in `channel-metrics.ts`, `channel-breakdowns.ts`, `channel-cities.ts`, `channel-us-states.ts`, `channel-viewer-shares.ts`, `channel-revenue-by-format.ts`, `last-processed-day.ts`, `one-video.ts` and `video-metrics.ts`, which the other reads build on.
- YouTube Reporting API v1, `jobs.list`, `jobs.create` and `jobs.reports.list` in `packages/youtube-gateway/src/reporting-job.ts`, and `media.download` in `packages/youtube-gateway/src/youtube-gateway.ts` (`downloadReachReport`), for Pro's daily reach reports.

The set was checked on 2026-11-23 with `grep -rnoE "api\.[a-zA-Z.]+\(" packages/youtube-gateway/src --include='*.ts' | grep -v test`, which lists `channels.list`, `playlistItems.list`, `videos.list`, `reports.query`, `jobs.list`, `jobs.create`, `jobs.reports.list` and `media.download`, and nothing else. A change to the gateway's calls changes this checklist.

| Field | Answer |
|---|---|
| What is the total quota you are requesting for Project #1? | Above Default quota |
| Total Per Day Quota | 15000 |
| Detailed Justification | The text below |
| youtube.search.list, Total Per Day Quota and Detailed Justification | Left empty |
| youtube.videos.insert, Total Per Day Quota and Detailed Justification | Left empty |

Detailed Justification:

```
Stillstats reads a creator's own channel through the YouTube Data API, the YouTube Analytics API and the YouTube Reporting API, after the creator connects the channel with OAuth. It never calls search.list or videos.insert.

Cost per channel per day: 54 Data API units. That's the busiest day per channel from November 14 to 27, 2026 (12.85 units), plus the daily read of a channel's uploads for Stillstats Pro, for a channel with 1,000 videos (41 units).
Target: 250 connected channels over the next 12 months.
Total: 54 units x 250 channels = 13,500 units a day, which is 90% of 15,000.

Stillstats' gateway counts every call against the daily quota and keeps the last 10% of it back for data deletion and urgent reads, so routine reads stop before the project reaches Google's limit. 15,000 units leaves the 13,500 for routine reads and 1,500 in reserve.
```

## Section 6: Additional Evidence and Documentation Requirements

The form's evidence standards apply to every upload, here and in Section 5: at least 1280x720 pixels, readable text, the browser address bar in each web screenshot, a descriptive filename, and one file under 10MB a field.

| Field | Answer |
|---|---|
| Architecture Diagram | [`docs/audit-application/stillstats-architecture-diagram.png`](audit-application/stillstats-architecture-diagram.png) |
| User Flow Diagrams | [`docs/audit-application/stillstats-user-flow-diagram.png`](audit-application/stillstats-user-flow-diagram.png) |
| Other Supporting Materials | [`docs/audit-application/policy-questions.pdf`](audit-application/policy-questions.pdf), "Policy questions for the API Services team" |

Each diagram's source is the SVG beside its PNG, and each box and arrow in the SVG names the files it stands for in a `data-code` attribute. After an SVG changes, rerun `node docs/audit-application/build-diagrams.ts`, which fails on a cited file that no longer exists and renders both PNGs again.

The form takes one file a field, and the note under Section 4 asks for the screencast link in Other Supporting Materials. The questions PDF takes that field's one upload, so the screencast link goes in "Special Instructions for Access" instead. [GAP #976] Check on the live form whether Other Supporting Materials also takes a link, and if it does, add the screencast's link there too.

## Section 7: Attestations and Submission

Every checkbox in this section is required, and each is ticked.

Policy Acknowledgment:

- YouTube API Services Terms of Service: I have read and agree to the Terms of Service.
- Google Privacy Policy: I have read and understand Google's Privacy Policy.
- Developer Policies: I acknowledge that it is my responsibility to stay up to date on changes to the Developer Policies that may impact my use of the Data API, and that I will notify YouTube in writing of any changes to my stated use case and seek approval for such changes prior to continued use.
- Termination Understanding: I understand that Google may suspend or terminate access if my API Client is non-compliant.
- Demo Account Terms Waiver (if applicable): If provided, I agree to the waiver terms for Google's review access.

Truthfulness Attestation:

- Accuracy of Information: The information provided in this form is true, complete, and accurate to the best of my knowledge.

Data Usage Consent:

- Use of Submission Data: I consent to Google processing this information (including via automated/LLM-based systems) to evaluate compliance and process requests.
- Support Recording Consent: I understand that support calls/chats related to this submission may be recorded.

## Policy questions

Google gives no field for policy questions and no process for "express permission" under III.D.7, so the questions ride in the application, in one PDF uploaded in Section 6. The text lives once, in [`docs/audit-application/policy-questions.md`](audit-application/policy-questions.md), and [`policy-questions.pdf`](audit-application/policy-questions.pdf) is printed from it, so the two can't drift. After the source changes, rerun `node docs/audit-application/build-policy-questions-pdf.ts`.

The PDF is written for the reviewer, so it names no ADR or issue. The nine, in order, with what each waits on here:

| # | Clause | Question | Waits on it here |
|---|---|---|---|
| 1 | III.E.2.a | An agency's export workbook | ADR 0005, #7 |
| 2 | III.E.2.a | An agency's channels side by side | #7 |
| 3 | III.I.4 | Engaged views in place of a number in Studio or on www.youtube.com | ADR 0013, ADR 0016, #4 |
| 4 | III.D.7 | Realtime engaged views, a request for express permission | ADR 0003, ADR 0008, ADR 0017 |
| 5 | III.C.2 | Playback from a click on the retention chart | ADR 0019, ADR 0020, #637 |
| 6 | III.E.2.a, derived-metrics item 5 | An opt-in comparison with similar channels. Planned, not built. | ADR 0011, #912 |
| 7 | III.E.2.a | Totals across the channels of one Google account. Planned, not built. | #912, #924 |
| 8 | III.E.3.b | A sponsor as an approved agent | #912, #938 |
| 9 | III.E.4.c | Keeping the dates of title and thumbnail changes past 30 days | #935 |

## Screencast shot list

The form asks for an end-to-end screencast when there are no demo credentials, and Section 4 says this screencast replaces them. It's one take in Chrome on my own channels, with Pro on for the main one, uploaded to my channel as Unlisted. The consents, the disconnect and the deletion use a second Google account of mine in a Chrome Guest window, and the tour of the web app and the extension uses my main account and its Pro channel in my own Chrome profile. Google shows the sign-in consent only to an account with no grant to Stillstats, and a disconnect or a deletion of a paid channel cancels Pro at once and deletes its history (ADR 0022), so those shots can't run on the Pro channel. The format is the shot list in `docs/oauth-verification.md`, with the narration I say over each shot in place of its captions.

### Before recording

1. The site is live on `https://stillstats.com`, with `/privacy` and `/terms` published, and `/privacy` names every service in "How Stillstats shares your data". Cloudflare Email Service is one of them once #970 is on production, and the take waits for it.
2. `curl -sf https://stillstats.com/privacy https://stillstats.com/terms | grep -c cdn-cgi` prints 0, and the same command with `grep -c 'mailto:privacy@stillstats.com'` in place of `grep -c cdn-cgi` prints 4, so both pages came back with their addresses as written and load no script of Cloudflare's.
3. Every screen and feature this list shows is live on production, the retention comparison and the Pro video list's sort and filters among them. Check the release notes at `https://stillstats.com/releases/` for any feature released after this list was written, and add a shot for each before the take.
4. My main Google account, in my own Chrome profile, holds at least two connected channels, so the channel picker has a second channel to switch to. One of them is the Pro channel the tour uses: Pro on, in the YouTube Partner Program, revenue consent given, and data in every metric over the last 28 days.
5. The Pro channel holds at least one unlisted and one private upload, at least two uploads with a retention curve Stillstats has read, so the retention comparison draws two curves, and at least one Short. Its newest upload has at least one day Google has processed, so the latest video card shows the comparison row.
6. The currency in Settings is USD and the theme is System on the main account before the take, so the Settings shot shows a change.
7. The Stillstats extension is installed from the Chrome Web Store in my own Chrome profile, with site access to `studio.youtube.com` and `stillstats.com`, and "Show engaged views on youtube.com" off. The same profile is signed in to YouTube Studio with the main account.
8. A second Google account of mine owns a channel that isn't connected to Stillstats, and the account isn't a Stillstats user and holds no grant to it. Remove any earlier grant on the [Google Account connections page](https://myaccount.google.com/connections). Its account language is English, so every Google screen in the take is in English.
9. A Chrome Guest window is open and signed in to the second account at `https://accounts.google.com`, so no password is typed on camera. A Guest window starts with no cookies, so Stillstats there has no session.
10. The Chrome window is at least 1280 by 720 pixels, the size the form's evidence standards ask for, with the address bar on screen in every shot and no other tab open.
11. The main account has never tipped and hasn't hidden the sidebar's "Support Stillstats" item, so the item shows in the sidebar's footer and in the header's Menu (shots 13, 24 and 28). Stillstats shows it only until the account tips or hides it. If it was hidden, "Reset preferences" in Settings shows it again, and the currency and theme are then set as item 6 says. If the account has tipped, the item never shows again: shot 24 opens "Leave a tip" in Settings' "Support Stillstats" section instead, and shots 13 and 28 leave the item out.

### Recording rules

- Nothing is drawn over a Google consent screen's scope list. No caption, overlay or zoom covers it while it holds, and it holds on screen for at least five seconds. The narration is audio only, so it can run while the list shows. The 2026-10-17 OAuth video's caption covered the list.
- On every consent screen, open every expander Google offers before granting: "See access details" under each permission, and "See the N services" or "Show all services" where the screen lists earlier access. Hold each expanded list for at least five seconds.
- Zoom on the address bar in the edit, not in the browser, so the whole URL stays in the source frame. The zoom shows `client_id=` and the `scope` parameter.
- The pace is slow enough to read. Hold each screen the narration names for at least three seconds after the narration names it.
- Hold every Studio surface long enough to read Studio's own figure and the extension's figure beside it in one frame.
- No other person's data from Stillstats is on screen. The admin feedback screen never appears.
- No payment is made in the take. The tip link and "Manage subscription" open Stripe's hosted pages, and each is closed without paying or changing anything.

### Shot list

The take runs from shot 1 to shot 50 without a cut. Shots 1 to 12 and 47 to 50 are in the Guest window with the second account, and shots 13 to 46 are in my own Chrome profile with the main account.

| # | Shot | Action | Zoom | Narration |
|---|---|---|---|---|
| 1 | The homepage | `https://stillstats.com` in the Guest window. Scroll through "Honest numbers, and nothing else.", "See your engaged views inside YouTube Studio", "Privacy is the proof.", "Pricing" with the Free card and the Pro card's "Subscribe", and the footer's "Privacy Policy" and "Terms" links | None | This is Stillstats, a read-only analytics app for YouTube creators. The homepage says what it shows and what it costs, and its footer links the privacy policy and the terms. |
| 2 | The terms | Click "Terms" in the footer: `https://stillstats.com/terms`, scrolled through the opening paragraph naming MIDLO WEB DESIGN, LLC, "YouTube Terms of Service", "Price" and "Ending your use" | None | The terms are an agreement with MIDLO WEB DESIGN, LLC, the company that operates Stillstats. They point to YouTube's Terms of Service, give the price of Pro, and say how a creator stops using Stillstats. |
| 3 | Sign-in starts | `https://stillstats.com/app`, signed out. Scroll through "What Stillstats reads" and its closing line, "After you sign in, Google asks you to pick the channel to connect." Click "Sign in with Google" | None | I'm in a Chrome Guest window. I'm signed in to Google with a second account of mine. The account owns a channel and has never used Stillstats. Before Google asks for anything, the sign-in screen says what Stillstats reads. |
| 4 | The sign-in consent | Google's consent screen in English, for the second account. Hold the full screen, then grant it | The address bar's `client_id=` and the `scope` parameter with `openid`, `email` and `profile`, then the app name Stillstats | Sign-in asks Google for openid, email and profile, and nothing else. The address bar shows the OAuth client ID, and the consent screen shows the app name, Stillstats. |
| 5 | The connect consent starts | With no click after sign-in, Google opens the connect consent at its channel picker. Pick the second account's channel | The address bar's `client_id=`, the `scope` parameter with `youtube.readonly` and `yt-analytics.readonly`, and `login_hint=`, then the app name | Right after sign-in, with no click from me, Google asks which channel to connect. I pick my channel. This step asks for youtube.readonly and yt-analytics.readonly, and both are read-only. |
| 6 | The connect consent, expanded | Scroll to "Select what stillstats.com can access". Click "See access details" under "View your YouTube account" and hold for five seconds. Do the same under the YouTube Analytics permission. Every permission and its details are readable on screen. Grant them | After the expanded list has held five seconds with nothing over it, the address bar's `client_id=` and `scope` once more, then each expanded permission's text | I open the access details under each permission, so every scope Stillstats asks for is readable in full. Then I grant them. |
| 7 | Connected | `https://stillstats.com/app?connected=1`, the channel screen for the second account's channel. The account row at the bottom of the sidebar shows "Settings" over the email, and the sidebar shows "Upgrade" | None | The channel is connected, and the web app opens on it. The account row at the bottom of the sidebar shows the email I signed in with. |
| 8 | Revenue consent starts, in Stillstats | Click the account row, then "Settings". Under "Your channels", the channel, "Give revenue consent", and "Subscribe monthly" and "Subscribe yearly". Click "Give revenue consent": Stillstats's own screen, "Show estimated revenue", ending with "Revenue works only for channels in the YouTube Partner Program." Click "Continue to Google" | None. The address bar shows `stillstats.com`, with no `client_id=` yet | Revenue is a separate, optional consent, and Stillstats never asks for it at connect. I start it from Settings, and Stillstats's own screen says what it reads before Google asks. |
| 9 | The revenue consent | Google's account chooser: pick the second account, then its channel. Google's consent screen in English | The address bar's `client_id=`, the `scope` parameter with `yt-analytics-monetary.readonly`, `include_granted_scopes=true` and `prompt=select_account consent`, then the app name | Google asks for one more scope, yt-analytics-monetary.readonly, and adds it to the access Stillstats already has. The address bar shows the client ID and the scope. |
| 10 | The revenue consent, expanded | Click "See access details" under "View monetary and non-monetary YouTube Analytics reports for your YouTube content" and hold for five seconds. Click "See the 4 services" in "stillstats.com already has some access" and hold on the full list for five seconds. Grant it | After the lists have held five seconds with nothing over them, the address bar's `client_id=` and `scope` once more, then the expanded permission and the four services | I open the access details for the revenue scope, and the list of the four services Stillstats already has. Then I grant it. |
| 11 | Revenue consent given | `https://stillstats.com/app?revenue_consented=1`. Open "Settings" from the account row: under the channel, "Revenue consent given on" and the date | None | Settings now shows the day I gave revenue consent. |
| 12 | The upgrade screen | Click "Upgrade" in the sidebar: "Upgrade to Pro", the cards Reach, Upload comparisons, Repackaging view, Retention comparison, Your history and More on the way, then the Monthly and Yearly cards and the line under them. Click neither subscribe button | None | This channel is free, so the sidebar shows Upgrade. The upgrade screen lists what Pro adds and its two prices, and Checkout opens on Stripe's hosted page. I don't subscribe this channel. |
| 13 | My own profile, and the channel picker | Switch to my own Chrome profile, on `https://stillstats.com/app`, signed in with the main account. The Pro channel's screen, the sidebar's "Videos", "Audience", "Retention", "What's new" and "Thumbnail preview", and in its footer "Send feedback" and "Support Stillstats", with no "Upgrade". Open the sidebar's channel picker, pick my other channel, then the Pro channel again | The channel picker, open, with each channel's name | Now I'm in my own Chrome profile with my main account, and its channel has Pro. The channel picker switches between my channels, and each channel's screens show that channel alone. Stillstats never adds channels together. |
| 14 | The channel summary | Date range "Last 28 days", Format "All". The cards Engaged views, Views, Watch hours, Estimated revenue with its RPM, Impressions and click-through rate. Click each card in turn to show its chart, hover a day on "Engaged views and views", and switch "Show numbers as" from "Daily" to "Running total" and back. Scroll to the Impressions and Impressions click-through rate charts and their "History starts" marker, then to the note "YouTube has processed data up to" and the date | The note "YouTube has processed data up to" and its date | The channel summary shows YouTube's totals for the window, engaged views and views, watch hours, and estimated revenue with its RPM. With Pro it adds impressions and click-through rate from my own YouTube Reporting API reports. The note under the charts gives the last day YouTube has processed, a few days back. Stillstats has no realtime numbers. |
| 15 | Upload markers | The markers under the "Engaged views and views" chart. Hover a marker: the video's title and publish day. Click a tile that joins uploads on one day: each video with its date. The faint dashed line on each upload day | None | Each upload in the window has a marker under the chart and a faint line on its day. Uploads on the same day join into one tile that lists them all. |
| 16 | The date range and the format | Open "Date range": the calendar windows, "Lifetime", "Custom range" and the windows after publish. Pick "Custom range", pick a start and an end day on the calendar, and press "Apply". Pick "Last 28 days" again. Click "Shorts", "Live" and "Videos" under "Format", then "All" | None | The date range covers calendar windows, lifetime, a custom range on a calendar, and windows counted from each video's publish day. The format filter splits videos, Shorts and live streams. |
| 17 | The video list | Scroll to the video list: each upload's thumbnail, title, publish date and numbers. Click a column heading to sort, and again to reverse it. Turn the "Views", "Watch hours" and "Revenue" column switches off and on. Click "Show revenue sources", then "Hide revenue sources". Change "Videos per page" and go to page 2. Turn on "Show unlisted and private": the uploads marked "Unlisted" and "Private" join the list. Turn it off | None | The video list shows every upload with its numbers for the window, and I can sort it by any column, turn columns off, and choose how many videos a page shows. Unlisted and private uploads show only when I turn them on, and each one is marked. Revenue sources split each video's revenue into ads and YouTube Premium. |
| 18 | Pro in the video list | The "Impressions" and "CTR" columns. Click "CTR" to sort by click-through rate, then "Impressions". Pick one source in "Traffic source", then "All sources". Set "Minimum impressions" and clear it | None | With Pro, the list adds impressions and click-through rate. I can sort by either one, count a single traffic source, and hide videos under a minimum number of impressions. |
| 19 | Windows after publish | Pick "First 7 days after publish": the chart "Engaged views in each video's first days", hover a day, and switch "Daily" and "Running total". Under the list, the lines "Your N newest public videos averaged" engaged views and, with Pro, impressions. Pick "Publish day": "Most engaged views on the publish day". Pick "Last 28 days" again | None | In a window after publish, each video counts its own first days, so a new upload sits beside older ones at the same age. The line under the list gives the average of my newest uploads, and Pro adds their impressions. Publish day shows the uploads with the most engaged views on the day they came out. |
| 20 | The Audience screen | Click "Audience" in the sidebar. Scroll through "Countries (engaged views)", "US states (engaged views)", "Cities (engaged views)", "Age (share of signed-in viewers)", "Gender (share of signed-in viewers)", "Devices (engaged views)", "Operating systems (engaged views)" and "Subscribers and non-subscribers (engaged views)" | None | The Audience screen shows where the channel's viewers watch from, the age and gender of signed-in viewers, their devices and operating systems, and whether they subscribe. These numbers are for the whole channel, not each video. |
| 21 | The retention comparison | Click "Retention" in the sidebar: "Compare retention curves". Pick two videos under "Videos to compare": their curves on one chart. Change "Sort", then click "Clear all picks" | None | With Pro, the retention comparison puts up to five of my videos' audience retention curves on one chart. Each curve is that video's own, read from YouTube. |
| 22 | What's new | Click "What's new" in the sidebar: each highlight with its title and "Open the screen". If the banner "Stillstats has something new." showed above a screen earlier in the take, its link opens this same screen | None | What's new lists the features I've shipped. Each one links to its screen. |
| 23 | The feedback form | Click "Send feedback" in the sidebar's footer: "What is it about?", "Your message" and "Reply address". Send nothing, and go back with "Videos" | None | Send feedback opens a short form, and a message comes to me. It carries a reply address only if the creator adds one. |
| 24 | Support Stillstats | Click "Support Stillstats" in the sidebar's footer: Stripe's hosted tip page opens in a new tab. Close the tab without paying | The address bar of the Stripe tab | Support Stillstats opens a one-time tip on Stripe's hosted page. A tip unlocks nothing. I close the page without paying. |
| 25 | Settings, the channels | Open "Settings" from the account row. Under "Your channels", each channel by name with "Revenue consent given on" and the date, and "Disconnect". Click "Manage subscription" under the Pro channel: Stripe's Customer Portal opens. Close it without changing anything | The address bar of Stripe's page | Settings lists my channels, each with its revenue consent date. For the channel with Pro, Manage subscription opens Stripe's hosted portal, where I can change or cancel the plan. I close it without changing anything. |
| 26 | Settings, the account | Under "Account", change "Currency" from USD to EUR: the notice "Your currency is saved.", and the channel summary and the video list show euros. Change it back to USD. Click "Light", "Dark" and "System" under "Theme". Turn "Count only ads and YouTube Premium in RPM" on and off. Click "Connect a channel": Stillstats's screen "Connect your channel". Click "Cancel" | None | The account section holds the currency revenue shows in, the theme, and whether RPM counts only ads and YouTube Premium. Connect a channel opens the same Stillstats screen that comes before Google. I cancel it here. |
| 27 | The account menu and the sidebar | Click the account row: "Settings", "Free tools from the maker of Stillstats" with Mid-Roll Manager, the theme, "Sign out" and the version line. Close the menu. Click "Collapse sidebar": the column of icons. Click "Expand sidebar" | None | The account menu opens Settings, my free tools, the theme and sign out, and shows the version of Stillstats I'm on. The sidebar folds into a column of icons and opens again. |
| 28 | The header's Menu | Narrow the window to a phone's width: the header shows "Menu". Click it: the screens, "Send feedback" and "Support Stillstats". Close it and widen the window again | None | On a narrow window the sidebar folds into one Menu button, with the same screens and links. |
| 29 | A video's detail screen | Click a long-form video's title in the list: the thumbnail, the title, "Watch on YouTube", "Sponsor report", and the cards and charts for the window. Scroll through "Since publish", "Traffic sources (engaged views)" with the Pro table "Impressions and click-through rate", "Subscribers and non-subscribers (engaged views)", and the note "YouTube has processed data up to" and its date | The note "YouTube has processed data up to" and its date | A video's detail screen shows its numbers over the window, its charts, its numbers since publish, its traffic sources, and its split between subscribers and non-subscribers. With Pro, each traffic source shows its impressions and click-through rate. The note gives the last processed day here too. |
| 30 | The player, cued | Scroll to "Audience retention" and "Relative retention", with YouTube's embedded player beside them, cued and not started. Click the "Audience retention" chart at a moment about halfway through: the player is cued at that moment and doesn't start, with YouTube's play button still showing | YouTube's play button on the cued player after the click | Beside the audience retention charts is YouTube's own embedded player. It loads cued. It doesn't play. When I click the chart, the player is cued at that moment, and it still doesn't play. |
| 31 | Playback from YouTube's button | Press the play button inside YouTube's player: the video plays from that moment, and a line on both retention charts follows it | YouTube's play button, then the line on the charts | Playback starts only when I press YouTube's own play button. A line on both charts follows the video as it plays. |
| 32 | A click while it plays | While the video plays, click the "Relative retention" chart at another moment: the player moves there and keeps playing. Pause it with YouTube's own button | The player's time and its playing state after the click | A click on the chart while the video plays moves it to that moment, and it keeps playing. A click never starts or stops playback. |
| 33 | The stepper and a Short | Click "Older video", then "Newer video", at the top of the screen. Go back to the list, pick "Shorts" under "Format", and open a Short: its player in a tall 9:16 frame. Pick "All" again | None | Older video and Newer video step through the list in its own order. A Short plays in a tall frame. |
| 34 | The sponsor report | Open the long-form video's detail screen again and click "Sponsor report": the channel's name, the thumbnail, the figures, and "Figures from YouTube, through Stillstats." Untick one figure under "Figures to include", with Impressions and CTR among the choices. Click "Save as PDF": the browser's print dialog, with no sidebar, no checklist and no link. Save the PDF. Click "Back to video" | The print dialog's preview | The sponsor report is one video's page, made to print. I pick the figures to include, and Save as PDF opens the browser's print dialog. I send the PDF to a sponsor myself, and Stillstats gives the sponsor no link and no access. |
| 35 | The extension's popup | Click the Stillstats icon in Chrome's toolbar: "Signed in to Stillstats", "Your channels", "Open Stillstats", "Send feedback", and "Show engaged views on youtube.com", off, with the line under it | The popup | This is the Stillstats extension for Chrome. I installed it from the Chrome Web Store. The popup shows I'm signed in, lists my channels, and has a switch for engaged views on youtube.com, which is off. |
| 36 | The first-run page | Open `chrome-extension://dmfiepibjgpmholeacigjgejjgohdnhm/first-run.html` in a new tab: "Stillstats in YouTube Studio", each line, and "Read the privacy policy" | None | The first-run page opens once, at install. It says what the extension reads on Studio and on youtube.com, what it sends to stillstats.com, and links the privacy policy. |
| 37 | The latest video card | Open `https://studio.youtube.com` for the Pro channel. On the dashboard's latest video card, Studio's views figure with the extension's engaged views beside it, and Studio's "Ranking by views" row with the extension's comparison row beside it, such as "3 of 10 Videos by engaged views" over "First 3 days" | Each pair in one frame: Studio's views and the engaged views, then Studio's "Ranking by views" row and the comparison row | On the Studio dashboard, the latest video card keeps Studio's views and Studio's ranking row exactly as Studio shows them. The extension adds engaged views beside the views, and its own row beside the ranking, which places this upload among my last ten uploads of its format by engaged views. Every number comes from Stillstats, through the YouTube Analytics API, never from the page. |
| 38 | The Content list | Click "Content" in Studio's menu. The line under "Channel content", the Stillstats mark and "Data from Stillstats as of" the day. The pill under "Views" in the column heading, and each row's engaged views under Studio's views. Click the pill: the column sorts as Studio's heading does. Open the "Shorts" tab, then "Videos" | The line under the title, then one row's views cell with Studio's views and the engaged views | In the Content list, the line under the title gives the day the figures run through. Each row shows its engaged views under Studio's views, and the pill in the Views heading sorts the column the same way Studio's heading does. |
| 39 | A video's analytics page | Click a video's analytics icon in the Content list: the page opens at Studio's default period, `period-default` in the address, which Stillstats has no window for, so the figure under Studio's number shows lifetime engaged views with "Lifetime" under it. Pick "Last 28 days" in Studio's period menu: the address ends in `period-4_weeks`, and Studio's Views tile shows "engaged views" and the figure under Studio's number, with no "Lifetime". Pick a single month in Studio's period menu: "Lifetime" under the figure again. The line above the key metric card, "Data from Stillstats as of" the day and "View this video in Stillstats". Click it: the video's detail screen opens in Stillstats in a new tab. Close the tab | The Views tile with Studio's number and the engaged views in one frame once "Last 28 days" is picked, then the line above the card | On a video's analytics page, engaged views sit inside Studio's Views tile, for the period Studio has selected. For a period Stillstats has no window for, it shows lifetime engaged views and says so. The line above the card gives the last processed day and opens the video in Stillstats. |
| 40 | YouTube access on | Click the Stillstats icon and turn on "Show engaged views on youtube.com": Chrome asks for access to www.youtube.com. Allow it | Chrome's request and the site it names | Engaged views on youtube.com are off by default. When I turn them on, Chrome asks me for access to www.youtube.com. |
| 41 | My channel's tabs | Open my channel on `https://www.youtube.com`: the "Home" and "Videos" tabs, and "Live" when the channel has a live stream, with an engaged views pill next to YouTube's view count on each of my videos. Hover a pill: the full figure and the day it runs through | One video's view count and its pill, then the hover | On my channel's Home, Videos and Live tabs, each of my videos shows an engaged views pill next to YouTube's view count. The hover shows the full figure and the day it runs through. |
| 42 | A watch page | Open one of my videos: the pill next to the view count under the title, and pills on my own videos in the sidebar. A video from another channel in the sidebar shows none | The view count under the title and its pill | On a watch page, the pill sits next to the view count under the title and beside my own videos in the sidebar. Videos from other channels show no number. |
| 43 | The home feed and search | Click YouTube's logo: my videos in the home feed with their pills. Search for my channel's name: my videos in the results with their pills | One of my videos in the results and its pill | In my home feed and in search results, only my own videos get a pill. The extension matches them against my own videos in my browser, so no video id from the page leaves it. |
| 44 | Shorts | Open my channel's "Shorts" tab: the pills. Open a Short: the pill under my channel name in the Shorts player. Click the Stillstats icon and turn "Show engaged views on youtube.com" off | The pill under my channel name in the Shorts player | My Shorts tab and the Shorts player show the pill too, under my channel name in the player, and when I'm done I turn engaged views on youtube.com off again in the popup. |
| 45 | The privacy policy | Open `https://stillstats.com/privacy`. Scroll through "YouTube API Services and Google" with its links to YouTube's Terms of Service and Google's Privacy Policy, "What Stillstats accesses", "The Studio extension", "How Stillstats shares your data" with each service named, "How long Stillstats keeps your data" and "Deleting your data and revoking access" | The list of services in "How Stillstats shares your data" | The privacy policy covers the YouTube API Services and Google's Privacy Policy, what Stillstats reads and keeps, every service it shares data with, how long it keeps each kind of data, and how a creator deletes it and revokes access. |
| 46 | Sign out | Open `https://stillstats.com/app`, click the account row, then "Sign out": the signed-out screen | None | Sign out ends my session in this browser. The web app goes back to the signed-out screen. |
| 47 | Reset preferences | Back in the Guest window, open "Settings" from the account row. Click "Reset preferences", confirm, and the notice "Your preferences are reset." | None | Back in the Guest window with my second account. Reset preferences puts every display preference back to its default after I confirm it. |
| 48 | Disconnect | Click "Disconnect" under the channel. The confirmation, "Disconnect this channel? The product revokes its access and deletes all of its data within 24 hours." Confirm it: "The channel is disconnected. Its data is deleted within 24 hours.", then "No channel is connected." and "Connect a channel" | The confirmation's text | Disconnecting a channel revokes Stillstats's access at Google and deletes all of the channel's data within 24 hours. Once I confirm it, the web app says the channel is disconnected and shows that no channel is connected. |
| 49 | Delete me | Click "Delete me" under "Account". The confirmation, "Delete yourself from the product? It signs you out, revokes its access to each of your channels and deletes all of their data within 24 hours." Confirm it: the signed-out screen and its notice | The confirmation's text | Delete me removes me from Stillstats. Once I confirm it, it signs me out, revokes its access to each of my channels at Google, and deletes all of their data within 24 hours, the same as a disconnect of every channel at once. |
| 50 | Google's connections page | Open `https://myaccount.google.com/connections` in the Guest window. If Stillstats is still listed, open it and remove its access | The list of connections | My Google Account's connections page is the other place a creator can remove Stillstats's access, without signing in to Stillstats at all. |

The take shows no refusal and no line state. A refused consent, an expired session, and the extension's sign-in line, connect prompt, refusal line and access line are error and setup states, and staging each one on production means breaking a session or a grant. Every scope is read-only, so no shot shows a change in the creator's YouTube channel.

### What each policy question shows

| # | Question | Shots |
|---|---|---|
| 1 | An agency's export workbook | None. Planned, and the agency workspace isn't built yet |
| 2 | An agency's channels side by side | None. Planned, and the agency workspace isn't built yet |
| 3 | Engaged views in place of a number in Studio or on www.youtube.com | 37, with Studio's views figure and ranking row unchanged beside the extension's, then 40 to 44, where the pills on www.youtube.com stay off until I turn them on, and show only on my own videos, with YouTube's view counts unchanged beside them |
| 4 | Realtime engaged views | 14, 29, 38 and 39, each giving the last day YouTube has processed, with no realtime figure anywhere |
| 5 | Playback from a click on the retention chart | 30, 31 and 32 |
| 6 | An opt-in comparison with similar channels | None. Not built |
| 7 | Totals across the channels of one Google account | 13, where each channel is viewed on its own |
| 8 | A sponsor as an approved agent | 34, saved as a PDF, with no share link |
| 9 | Keeping the dates of title and thumbnail changes past 30 days | None. Planned |

### After recording

1. Upload the video to my channel in YouTube Studio with Unlisted visibility.
2. Paste its link into Section 4's "Special Instructions for Access", in place of the #975 gap marker there.
3. Sign back in to `https://stillstats.com/app` in my own Chrome profile, since shot 46 signed out.

## Submission

[GAP #976] The submission date, Google's "case created" confirmation, and any change made to this text while pasting it in.
