# OAuth verification

What the product submits to Google for OAuth verification: the consent screen fields, a justification for each sensitive scope, and the shot list for the demo video. A later re-verification reuses this document, so it changes whenever the scopes the code requests change.

`README.md` holds the same OAuth setup as configured for development: the two redirect URIs to register, and the revenue consent through incremental authorization. When a scope or a redirect URI changes, this document and `README.md` change together.

Google's own pages set every requirement below. Each was fetched on 2026-10-05:

- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [The demo video](https://support.google.com/cloud/answer/13804565)
- [The homepage, the privacy policy and the security assessment](https://support.google.com/cloud/answer/13464321)
- [The restricted scopes](https://support.google.com/cloud/answer/13464325)
- [The verification FAQ](https://support.google.com/cloud/answer/13463817)
- [The scope descriptions](https://developers.google.com/identity/protocols/oauth2/scopes)
- [The YouTube Data API members resource](https://developers.google.com/youtube/v3/docs/members)
- [The YouTube Analytics scopes](https://developers.google.com/youtube/analytics/reference/reports/query)

## The project

- Google Cloud project: `creator-analytics-510701`
- OAuth web client: `canal-web`

## The consent screen

The consent screen fields after the cutover to `stillstats.com`:

| Field | Value |
|---|---|
| App name | Stillstats |
| Homepage | `https://stillstats.com` |
| Privacy policy | `https://stillstats.com/privacy` |
| Terms of service | `https://stillstats.com/terms` |
| Authorized domain | `stillstats.com` |
| Redirect URI, sign-in | `https://stillstats.com/api/auth/callback/google` |
| Redirect URI, connect and revenue consent | `https://stillstats.com/api/channels/connect/callback` |

The `canal.nlvogel.com` redirect URIs are removed. `stillstats.com` is verified in Google Search Console first, because Google requires the homepage on a verified domain the developer owns.

Google also requires the homepage to be publicly accessible, to describe the app, to be more than a login page, and to link the same privacy policy as the consent screen. The privacy policy is hosted on the homepage's domain and discloses how the product accesses, uses, stores and shares Google user data.

After approval, a change to the app name, the logo, the homepage link or the privacy policy link means [brand verification](https://support.google.com/cloud/answer/13464018) again. These values are final for that reason.

## The scopes the product requests

The product asks Google for consent three times. Each consent requests only what its step needs.

| Consent | Scopes | Where the code sets them |
|---|---|---|
| Sign-in | `openid`, `email`, `profile` | `apps/api/src/auth.ts`, the `genericOAuth` config |
| Connect | `openid`, `email`, `youtube.readonly`, `yt-analytics.readonly` | `packages/token-vault/src/token-vault.ts`, `connectionScopes` and `identityScopes` |
| Revenue consent | `openid`, `email`, `yt-analytics-monetary.readonly` | `packages/token-vault/src/token-vault.ts`, `requestedScopes.revenue` and `identityScopes` |

The full scope URLs are in `scopeUrls` in `packages/token-vault/src/token-vault.ts`:

- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`
- `https://www.googleapis.com/auth/yt-analytics-monetary.readonly`

The connect consent and the revenue consent set `include_granted_scopes=true`, `access_type=offline` and `prompt` with `consent`. With incremental authorization, the revenue grant holds the connection's scopes as well. The product refuses a revenue grant that lacks any of the three YouTube scopes.

The first visit's connect consent, which follows sign-in with no click, also sends `login_hint` with the signed-in user's email and `prompt=consent`, so Google skips its account chooser and goes to the channel picker for the account just signed in with. A connect started by a click, from the empty state or the Settings screen, and the revenue consent send no `login_hint` and `prompt=select_account consent`, so Google shows its account chooser and the creator can pick a channel held under another Google account. Google's [web server guide](https://developers.google.com/identity/protocols/oauth2/web-server) describes the hint as prefilling the email field or selecting the matching multi-login session, and `prompt` as a space-delimited list in which `select_account` shows the account chooser. The product does not store the hint. A revenue consent where the creator picks another channel is refused with `channel_mismatch`.

Sign-in and the connection stay two separate grants. The web app's signed-out screen at `/app` carries, under "Sign in with Google" and the Terms line, the heading "What Stillstats reads", the five paragraphs of the connection consent screen word for word, and "After you sign in, Google asks you to pick the channel to connect." After a sign-in from that screen, a user who holds no channel goes straight on to the connect consent, with no screen and no click in between (`GET /api/channels/connect/after-sign-in`, the callback that screen's sign-in asks for). A user who holds a channel lands on the web app. The homepage's "Sign in with Google" carries no consent text, so its sign-in always lands on the web app, and a user with no channel connects from the empty state. So the explanation comes before Google asks for any YouTube scope, whichever page the sign-in starts from. A cancelled or refused connect lands on the web app's empty state, "No channel is connected." with a "Connect a channel" button, and the product does not start the connect consent again on its own. A connect from that button or from the Settings screen opens the product's own connection consent screen first.

The revenue consent screen ends with "Revenue works only for channels in the YouTube Partner Program."

`openid` and `email` are on the connect and revenue consents for Cross-Account Protection. Google sends security event tokens only for users who granted the app access to their profile information or email address. `openid` brings the ID token that names the Google subject.

`openid`, `email` and `profile` are not sensitive. Google classifies `youtube.readonly` and `yt-analytics-monetary.readonly` as sensitive, and `yt-analytics.readonly` as non-sensitive: the Cloud Console Data Access page listed it under "Your non-sensitive scopes" on 2026-10-17. So the submission justifies two scopes, not three.

## Restricted scopes and CASA

None of the three scopes the product requests is on Google's [restricted scope list](https://support.google.com/cloud/answer/13464325). The list names Gmail, Drive, Fit, Chat, Data Portability, Photos Ambient and Health scopes. Its only YouTube entries are three Data Portability API scopes (`dataportability.youtube.channel`, `dataportability.myactivity.youtube`, `dataportability.youtube.private_videos`), which the product does not request.

Google's [homepage and privacy policy requirements](https://support.google.com/cloud/answer/13464321) list the security assessment "(For restricted scopes only)": "Apps requesting access to restricted scopes must meet the additional requirement of secure data handling by submitting to an annual security assessment". The annual security assessment (CASA) applies to restricted scopes only, so it does not apply to this submission.

Before submission, the classification of each scope is confirmed on the Cloud Console Data Access page, in step 3 of After recording.

## Scope justifications

Google asks for "a detailed justification for each requested sensitive scope, as well as an explanation for why a narrower scope isn't sufficient". The product is read-only: it never changes anything on a channel.

The sections below are the full reasoning, with the code that backs each claim. The form does not take them as written: it has one justification field of 1000 characters for all the sensitive scopes together. "What was submitted" below holds the text that fits. The `yt-analytics.readonly` section stays, because the demo video shows that scope and a later review can ask about it, but the form does not ask for it.

### `youtube.readonly`

What it powers: identifying the channel a connection belongs to. After each connect consent and revenue consent, the product calls the YouTube Data API's `channels.list` once, with `part=id` and `mine=true`, and reads the channel ID (`identifyGrant` in `packages/youtube-gateway/src/youtube-gateway.ts`). The product uses that ID to:

- show the user which channel is connected, as a link to the channel on YouTube;
- refuse a channel that another user has already connected;
- refuse a revenue consent given for a different channel than the one it began for.

It also calls `channels.list` with `part=snippet` and `mine=true` to read the channel's creation date, title and handle (`snippet.publishedAt`, `snippet.title` and `snippet.customUrl`, the `channelSnippet` read in `packages/youtube-gateway/src/reads/channel-snippet.ts`). The creation date starts the channel summary's lifetime window, and the title names the channel in the channel picker and on the Settings screen, and the handle names it in the channel picker. The product caches them for at most six hours.

For the video list and each video's detail screen, it reads the channel's uploads (the `uploads` read in `packages/youtube-gateway/src/reads/uploads.ts`) with three Data API methods:

- `channels.list` with `part=snippet,contentDetails` and `mine=true`, for the channel's creation date and the ID of its uploads playlist (`contentDetails.relatedPlaylists.uploads`);
- `playlistItems.list` with `part=snippet,contentDetails` on that playlist, 50 items a call, for each upload's video ID, title, thumbnail and publish date;
- `videos.list` with `part=status,contentDetails` and up to 50 video IDs a call, for each video's privacy status, public, unlisted or private (`status.privacyStatus`), whether it is scheduled (`status.privacyStatus` and `status.publishAt`) and its length (`contentDetails.duration`).

The video list shows each upload by its title, thumbnail and publish date, and leaves scheduled videos out. It shows public videos by default; a switch adds the unlisted and private ones, each marked with its status. The video list and a video's detail screen show each video's length on its thumbnail, and the detail screen labels its audience retention charts with times from it. The product caches the uploads for at most six hours.

It reads no other part of the channel or its videos, and calls no Data API method other than `channels.list`, `playlistItems.list` and `videos.list`.

Why a narrower scope does not suffice: Google's [scope descriptions](https://developers.google.com/identity/protocols/oauth2/scopes) list seven YouTube Data API v3 scopes. `youtube` ("Manage your YouTube account"), `youtube.force-ssl` ("See, edit, and permanently delete your YouTube videos, ratings, comments and captions"), `youtube.upload` ("Manage your YouTube videos") and `youtubepartner` ("View and manage your assets and associated content on YouTube") can change the account or its content, so a read-only product must not ask for them. `youtubepartner-channel-audit` ("View private information of your YouTube channel relevant during the audit process with a YouTube partner") is for a YouTube partner's audit process, and `channels.list` names it only for the `auditDetails` part. `youtube.channel-memberships.creator` authorizes only `members.list` and `membershipsLevels.list`, which read membership data, not the account. Google's [members reference](https://developers.google.com/youtube/v3/docs/members) says access to those endpoints "is limited to YouTube creators who have a dedicated YouTube Partner Manager", and that the scope "does not go through the standard Google Cloud OAuth verification process", so it is not available to the product's users. `youtube.readonly` ("View your YouTube account") is the narrowest scope that lets `channels.list` with `mine=true` read the user's own channel. The YouTube Analytics scopes cannot replace it: a `reports.query` request names the channel only as `channel==MINE`, and the response holds only the metrics the request names, not the channel's ID.

### `yt-analytics.readonly`

What it powers: the channel summary, the Audience screen, the video list and each video's detail screen. The user picks a window, and the product calls the YouTube Analytics API's `reports.query` with `ids=channel==MINE`. Each read is in `packages/youtube-gateway/src/reads/`, listed in `packages/youtube-gateway/src/catalogue.ts` and `packages/youtube-gateway/src/video-detail-catalogue.ts`. The web app shows the results. The product caches a result for at most six hours.

- The channel summary: the channel's engaged views, views and minutes watched over the window (`channelTotals`, `metrics=engagedViews,views,estimatedMinutesWatched`), and the same for each day, for the views chart and its numbers table (`channelDailySeries`, `dimensions=day`). For a summary of one format, both queries add `filters=creatorContentType==` and that format.
- The Audience screen: the channel's engaged views and views by country over the window (`channelCountries`, `dimensions=country`, `metrics=engagedViews,views`), and the age groups and genders of its signed-in viewers, as each one's share of their views (`channelAgeGroups`, `dimensions=ageGroup`, and `channelGenders`, `dimensions=gender`, each `metrics=viewerPercentage`). It also shows the channel's engaged views and views by US state (`channelUsStates`, `dimensions=province`, `filters=country==US`) and by city, the 250 cities with most views (`channelCities`, `dimensions=city`, `sort=-views`, `maxResults=250`), each `metrics=engagedViews,views`. It also shows the channel's engaged views and views by device type (`channelDevices`, `dimensions=deviceType`), by operating system (`channelOperatingSystems`, `dimensions=operatingSystem`) and from subscribers and non-subscribers (`channelSubscriberSplit`, `dimensions=subscribedStatus`), each `metrics=engagedViews,views`. For one format, each query but the US state and city ones adds `filters=creatorContentType==` and that format; those two always read every format.
- The video list: each upload's engaged views, views, average percentage viewed, subscribers gained and minutes watched over the window (`videoMetrics`, `dimensions=video` with up to 500 video IDs in `filters`). For the windows that start on each video's publish date, its engaged views, views, subscribers gained and minutes watched for each day (`videoDailyRows`, `dimensions=video,day`). Each upload's format, from its views by content type over the lifetime window, whatever window the user picks (`videoContentTypes`, `dimensions=video,creatorContentType`).
- A video's detail screen, each with `filters=video==` and the one video's ID: its numbers over the window, minutes watched included (`videoWindowSummary`), its engaged views, views and minutes watched for each day (`videoDailySeries`, `dimensions=day`), its audience retention (`audienceRetention`, `dimensions=elapsedVideoTimeRatio` and `metrics=audienceWatchRatio,relativeRetentionPerformance`), its traffic sources (`trafficSources`, `dimensions=insightTrafficSourceType`), and its engaged views and views by subscription status (`subscriberSplit`, `dimensions=subscribedStatus`). For its Since publish table, its engaged views, views and minutes watched for each day from its publish day to the last processed day (`videoDailySeries`, `dimensions=day`, read only when the user has not given revenue consent or Google refuses the revenue read; otherwise `videoDailySeriesWithRevenue` below reads these days in its place), which the table adds up into each window after publish, and its lifetime numbers (`videoWindowSummary`, over the range the lifetime window reads).
- Every screen: the last day whose numbers Google has processed, from the channel's engaged views, views, average percentage viewed, subscribers gained and minutes watched for each day of the last 90 days (`lastProcessedDay`, `dimensions=day`). The screens show the processed-through day, the later of that day and four days before today, and use it to say when a video's numbers are not in yet.

Why a narrower scope does not suffice: the YouTube Analytics API reads channel metrics only with `yt-analytics.readonly` or `yt-analytics-monetary.readonly`. `yt-analytics.readonly` is the narrower of the two: it gives activity metrics and no revenue metrics. A user who does not give revenue consent never grants more than this.

### `yt-analytics-monetary.readonly`

What it powers: the estimated revenue in the channel summary, its ad and YouTube Premium parts, its revenue by day and its RPM, and the same for each video in the video list and on its detail screen, for a user who chooses to give revenue consent. The product calls `reports.query` with `ids=channel==MINE` and `metrics=estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue`, over the window and by `day` (the `channelRevenue` read in `packages/youtube-gateway/src/reads/channel-revenue.ts` and the `channelDailyRevenue` read in `packages/youtube-gateway/src/reads/channel-daily-revenue.ts`, each with `filters=creatorContentType==` for a summary of one format), and with `dimensions=creatorContentType` and `metrics=estimatedRevenue` for the revenue YouTube ties to no video or format and the channel's revenue in every format, which decides whether a one-format summary shows revenue for the channel (the `channelRevenueByFormat` read in `packages/youtube-gateway/src/reads/channel-revenue-by-format.ts`). It also reads each video's own estimated revenue and its ad and YouTube Premium parts for the video list and a video's detail screen, with `filters=video==` and the video IDs: `dimensions=video` and the three revenue metrics over the window (the `videoRevenue` read in `packages/youtube-gateway/src/reads/video-revenue.ts`), `dimensions=video,day` and the three revenue metrics for a window counted from each video's publish day (the `videoDailyRevenueRows` read in `packages/youtube-gateway/src/reads/video-daily-revenue-rows.ts`), and for one video the three revenue metrics over the window and by `day` (the `videoWindowRevenue` read in `packages/youtube-gateway/src/reads/video-window-revenue.ts` and the `videoDailyRevenue` read in `packages/youtube-gateway/src/reads/video-daily-revenue.ts`). For a video's Since publish table, it reads the one video's engaged views, views, minutes watched and estimated revenue for each day from its publish day to the last processed day, in one query with `dimensions=day` (the `videoDailySeriesWithRevenue` read in `packages/youtube-gateway/src/reads/video-daily-series.ts`, which replaces the `videoDailySeries` read rather than running beside it), and its estimated revenue over the lifetime window (`videoWindowRevenue`). Each of these revenue queries sends `currency` with the code the user chose on the Settings screen, USD by default, so Google answers the amounts in that currency.

Why a narrower scope does not suffice: estimated revenue is a monetary metric, and Google's YouTube Analytics reference gives monetary metrics only to `yt-analytics-monetary.readonly`. `yt-analytics.readonly` gives no revenue metric. The product does not request this scope at connect time: it is a separate consent step that the user starts from a channel, and a user who never starts it never grants it.

### What was submitted

The justification as submitted on 2026-10-17, 958 characters with the line breaks:

```
Stillstats is a read-only YouTube analytics app. It never changes a channel.

youtube.readonly: channels.list (mine=true) reads the channel ID, title and creation date to show which channel is connected and refuse one another user holds. playlistItems.list and videos.list read each upload's title, thumbnail, publish date, privacy and length for the video list. Narrower scopes do not work: youtube, youtube.force-ssl, youtube.upload and youtubepartner can change the account, and the Analytics scopes return no channel ID or video titles.

yt-analytics-monetary.readonly: reports.query (channel==MINE) reads estimatedRevenue, estimatedAdRevenue and estimatedRedPartnerRevenue for the channel and each video, to show estimated revenue. yt-analytics.readonly returns no revenue metric, so no narrower scope works. It is a separate, optional consent the user starts from the Settings screen, never requested at connect.

Reads are cached for at most six hours.
```

The "Additional info" field, as submitted:

```
Stillstats asks for consent in three separate steps: sign-in (openid, email, profile), channel connection (youtube.readonly, yt-analytics.readonly), and an optional revenue consent (yt-analytics-monetary.readonly) that the user starts from the Settings screen. The demo video shows all three in order, with a caption at each step.

Estimated revenue appears only for channels in the YouTube Partner Program. A reviewer who tests with a channel outside the program can complete the revenue consent but sees no revenue figures. The demo video shows revenue for a monetised channel.

No test credentials are needed. Sign-in uses Google only, and any Google account that owns a YouTube channel can connect it at https://stillstats.com/app.
```

## The demo video

The [sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) page requires that:

- the video is uploaded to YouTube Studio with Unlisted visibility;
- the browser address bar shows the OAuth client ID;
- the consent screen shows the App Name;
- the OAuth grant process is in English;
- the video demonstrates the functionality of each sensitive scope.

The [demo video](https://support.google.com/cloud/answer/13804565) page requires that:

- the video shows the end-to-end flow of the app, including the OAuth grant process;
- the video shows the complete consent screen, with the same exact scopes the submission requests;
- the consent screen language is toggled to English;
- the video shows how the app uses each requested scope.

It adds that narration or text callouts help the review. The video uses on-screen text captions.

### The 2026-10-19 rejection

Google's Third-Party Data Safety Team answered the 2026-10-17 submission on 2026-10-19: the video "does not sufficiently demonstrate why the following scope(s) are necessary or why narrower permissions cannot be used", for `youtube.readonly` and `yt-analytics-monetary.readonly`. The reply asks for a new video that shows:

- "the full operational functionality of every requested scope", because "your video must demonstrate the maximum extent of the user facing features using the scope(s)";
- the consent screen "with all requested scopes fully expanded and readable", clicking "Show all services" where the scopes are obscured;
- scopes that "exactly match the scopes configured and submitted for verification in the Google Cloud Console";
- "clear, step-by-step navigation instructions" for the reviewer.

Frames taken from the 2026-10-17 render show three gaps against that list:

1. On the connect consent, the burned-in caption covered the "Select what stillstats.com can access" list, and the video never opened "See access details".
2. On the revenue consent, the video never opened "See the 4 services", the services Stillstats already had from the connect consent.
3. Each sensitive scope had one short shot: `youtube.readonly` showed the channel name and the public uploads, and `yt-analytics-monetary.readonly` showed the revenue in the channel summary only. The video list's revenue, a video's revenue, the revenue sources, the currency and the unlisted and private uploads were never on screen, and no caption said why a narrower scope does not suffice.

The shot list below is rewritten for those gaps. The scopes and the justification text do not change.

### Before recording

1. The site is live on `https://stillstats.com`, with `/privacy` and `/terms` published.
2. The consent screen fields match the table above, and the consent screen is published to production.
3. The web app shows estimated revenue in the channel summary for a channel with revenue consent, and its heading reads Stillstats. The Audience screen is live on the web app at `https://stillstats.com`, with "Audience" in the sidebar.
4. The channel is not connected to any Stillstats user. A user who already holds a channel lands on the web app after sign-in, so the video would skip the connect consent of shot 5. Disconnect it from "Settings" first: the disconnect revokes the grant and the worker deletes the channel at once, and a connect before that deletion is refused with `channel_disconnecting`.
5. A clean browser profile with the Google account language set to English, and no earlier grant to the app. A Chrome Guest window is enough: it starts with no cookies and no Google session. Remove any earlier grant on the [Google Account connections page](https://myaccount.google.com/connections); the disconnect does not always remove the sign-in grant.
6. Nick's monetised channel is the channel the video connects.
7. The channel has data in both metrics over its lifetime, so the channel summary, the video list and a video's detail screen show non-zero values. It also has Audience numbers over the last 28 days, so every section of the Audience screen shows bars rather than "YouTube has no numbers for this window."
8. The channel holds at least one unlisted upload and one private upload, so shot 9 has rows to show. Upload a short private test video if it holds none.
9. The currency on "Settings" is USD before the take, so shot 20 shows a change.

### Recording rules

- No caption is on screen while a Google consent screen shows its scope list. The caption for a consent shot runs before the list is on screen, and the list holds on screen for at least five seconds with nothing over it. The 2026-10-17 caption covered the list.
- On every consent screen, open every expander Google offers before granting: "See access details" under each permission, and "See the N services" or "Show all services" where the screen lists earlier access. Hold each expanded list for at least five seconds.
- Zoom on the address bar in the edit, not in the browser, so the whole URL stays in the source frame. The zoom shows `client_id=` and the `scope` parameter.
- The pace is slow enough to read: hold each screen the caption names for at least three seconds after the caption appears.

### Shot list

The video is one take from shot 1 to shot 8, because the connect consent follows sign-in with no click. Shots 9 to 20 can be separate clips. The caption of each shot from 8 on that shows a scope in use names that scope.

| # | Shot | What the viewer sees | Caption |
|---|---|---|---|
| 1 | The homepage | `https://stillstats.com` in the address bar, the app described, the privacy policy and terms links | Stillstats homepage, with links to the privacy policy and the terms |
| 2 | The privacy policy | `https://stillstats.com/privacy`, scrolled through the Google user data section | How Stillstats uses Google user data |
| 3 | Sign-in starts | The web app at `https://stillstats.com/app`, signed out. Scroll through "What Stillstats reads", the connection's consent text under the "Sign in with Google" button. Click "Sign in with Google" | Stillstats says what it reads before Google asks. Sign-in requests openid, email and profile |
| 4 | The sign-in consent | Google's consent screen in English. Zoom on the address bar to show `client_id=` and the `scope` parameter with `openid`, `email` and `profile`. Zoom on the app name Stillstats | The OAuth client ID and the app name Stillstats |
| 5 | The connect consent starts | With no click after sign-in, Google opens the connect consent at its channel picker. Pick the monetised channel. Zoom on the address bar to show `client_id=`, the `scope` parameter with `youtube.readonly` and `yt-analytics.readonly`, and `login_hint=`. Zoom on the app name | Next, Google asks for the two read-only YouTube scopes. The full list follows |
| 6 | The connect consent, expanded | No caption. Scroll to "Select what stillstats.com can access". Click "See access details" under "View your YouTube account" and hold. Do the same under the YouTube Analytics permission. Every permission and its details are readable on screen. Grant them | None |
| 7 | Signed in and connected | The web app at `https://stillstats.com/app?connected=1`. Click the avatar at the top right: the account menu shows the signed-in email | Signed in, with the channel connected |
| 8 | `youtube.readonly`: the channel | Click "Settings" in the account menu. Under "Your channels", the channel listed by its name, then a click on the name to show it is the same channel on YouTube | youtube.readonly reads the signed-in creator's own channel (channels.list, mine=true). No narrower scope reads it |
| 9 | `youtube.readonly`: the uploads | Back on the web app, scroll to the video list: each upload with its title, thumbnail, publish date and length on the thumbnail. Turn on "Show unlisted and private": the unlisted and private uploads join the list, each marked "Unlisted" or "Private" under its title. Turn it off again | youtube.readonly lists every upload, unlisted and private ones included. Public data access cannot list them |
| 10 | `yt-analytics.readonly`: the channel summary | The channel summary shows the channel's engaged views, views and watch hours over the last 28 days, and the "Engaged views and views" chart. Click "Shorts" under "Format", then "All" again | yt-analytics.readonly reads the channel's engaged views, views and watch hours |
| 11 | `yt-analytics.readonly`: the Audience screen | Click "Audience" in the sidebar. The Audience screen shows the channel's countries, US states and cities, the age and gender of signed-in viewers, devices, operating systems, and subscribers and non-subscribers, over the last 28 days. Scroll through every section. Click "Videos" in the sidebar to go back to the channel screen | yt-analytics.readonly reads who watches the channel: where they watch from, their age and gender, their devices and whether they subscribe |
| 12 | `yt-analytics.readonly`: a video | Pick "First 7 days after publish" in the Date range control at the top. Click a video's title: its detail screen shows its "Engaged views and views" and "Watch hours" charts, audience retention labelled with times from the video's length, traffic sources and subscriber split. Go back | yt-analytics.readonly reads each video's numbers, and youtube.readonly gives its length |
| 13 | Revenue consent starts | Open "Settings" from the account menu and click "Give revenue consent" under the channel. Stillstats's own consent screen, "Show estimated revenue", says what the product reads and ends with "Revenue works only for channels in the YouTube Partner Program." Click "Continue to Google" | Revenue is a separate, optional consent. Stillstats never asks for it at connect |
| 14 | The revenue consent | Pick the Google account that holds the channel in Google's account chooser, then the same channel. Zoom on the address bar to show `client_id=`, the `scope` parameter with `yt-analytics-monetary.readonly`, `include_granted_scopes=true` and `prompt=select_account consent`. Zoom on the app name | Next, Google asks for the revenue scope. The full list follows |
| 15 | The revenue consent, expanded | No caption. Click "See access details" under "View monetary and non-monetary YouTube Analytics reports for your YouTube content" and hold. Click "See the 4 services" in "stillstats.com already has some access" and hold on the full list. Every scope Stillstats holds is readable on screen. Grant it | None |
| 16 | Revenue consent given | The web app at `/app?revenue_consented=1`. Open "Settings" from the account menu: under the channel, "Revenue consent given on" and the date | Revenue consent recorded |
| 17 | `yt-analytics-monetary.readonly`: the channel summary | The channel summary's "Estimated revenue" card with its RPM. Click the card, then "Daily": the "Estimated revenue" chart by day | yt-analytics-monetary.readonly reads estimated revenue. yt-analytics.readonly returns no revenue metric |
| 18 | `yt-analytics-monetary.readonly`: the video list | Scroll to the video list: each upload's "Revenue" column. Click the "Revenue" heading to sort by revenue. Click "Show revenue sources": the ad and YouTube Premium parts of each upload's revenue | yt-analytics-monetary.readonly reads each video's revenue, and its ad and YouTube Premium parts |
| 19 | `yt-analytics-monetary.readonly`: a video | Click the top video's title: its detail screen shows the "Estimated revenue" chart beside the other charts, and the "Since publish" table with revenue for each window after publish | yt-analytics-monetary.readonly reads one video's revenue by day and since publish |
| 20 | `yt-analytics-monetary.readonly`: the currency | Open "Settings" and change "Currency" from USD to EUR. Back on the channel summary, the "Estimated revenue" card and the video list show euros | Google answers revenue in the currency the creator picks |

A refused consent lands on `/app` with `connect_error`, `revenue_error` or `error`. The video does not show a refusal. Every scope is read-only, so no shot shows a change in the creator's Google account.

The 2026-10-17 video carried a caption first, "A clean Chrome Guest window, with no earlier grant to Stillstats", over the seconds before shot 1; the new video keeps it. The captions are a subtitle track in DaVinci Resolve, burned in at render: an SRT built from numbered clip markers, one per shot, with no entry for shots 6 and 15. An SRT whose first caption starts later than zero is shifted when dragged onto the track, because Resolve snaps the first caption to the playhead, so the first caption starts at zero. The track style needs a background for the captions to read over a white page. Check the render by extracting a frame from each consent screen: no caption covers the scope list.

### After recording

1. Upload the video to YouTube Studio with Unlisted visibility.
2. On the Cloud Console Branding page for project `creator-analytics-510701`, click "Verify Branding" and wait until the branding is published. Google requires published branding before data access verification.
3. On the Data Access page, declare the six scopes with "Add or remove scopes". Google classifies each added scope as non-sensitive, sensitive or restricted. Confirm that `youtube.readonly` and `yt-analytics-monetary.readonly` show as sensitive and `yt-analytics.readonly` as non-sensitive. If the classification has changed, the justification changes with it.
4. Paste the text from "What was submitted", or its update, into the one justification field (1000 characters for all scopes), add the video link, and fill "Additional info".
5. Open the Verification Center and submit. The 2026-10-17 submission went in with the unlisted video https://youtu.be/qvO4Txm3ZnI and no logo: a logo change means brand verification again, which would have held the submission behind it.
6. A resubmission after a rejection goes in as a reply to Google's email, not a new submission: the new unlisted video link, and the step-by-step navigation the reviewer follows, which is the shot list's "What the viewer sees" column in order.

Google's review estimates differ between its pages. The [sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) page says review typically takes 3 to 5 business days. The [verification FAQ](https://support.google.com/cloud/answer/13463817) gives 10 business days for sensitive scope verification, and says its estimates are not guaranteed.
