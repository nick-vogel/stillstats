# Stillstats

Privacy-first YouTube analytics for creators. It shows a creator the numbers that still matter about their own channel, stores only what a feature needs, never sells that data, and shares it only with the services its privacy policy names.

## Language

### People and access

**Creator**:
A person who runs a YouTube channel and uses the product to see that channel's numbers.
_Avoid_: Customer, YouTuber, user (when you mean the creator)

**User**:
A person who signs in to the product. A user reaches channels only through memberships.
_Avoid_: Account

**Channel**:
A YouTube channel connected to the product. The channel is the core unit: every analytics record belongs to exactly one channel.
_Avoid_: Account, property

**Membership**:
The link that gives one user access to one channel, with a role. A creator holds one membership; an agency holds many.
_Avoid_: Seat, access grant

**Agency**:
An organisation whose users hold memberships to several channels they manage for creators.
_Avoid_: MCN, team

**Agency workspace**:
The view where an agency switches between its channels one at a time. It never shows totals across channels.
_Avoid_: Dashboard (for this view), portfolio

**Connection**:
The Google OAuth grant that lets the product read one channel's data on a user's behalf. Revoking it ends the product's right to that channel's data.
_Avoid_: Integration, link

**Revenue consent**:
A separate, opt-in connection step that grants access to a channel's revenue data. A channel without it shows no revenue.
_Avoid_: Monetization scope (in product language)

**Consent screen**:
The product's own screen that says what a connection or a revenue consent reads, before the creator continues to Google. The signed-out screen carries the connection's consent text too, because a first visit goes from Google sign-in straight on to the connect consent.
_Avoid_: Google's consent screen (Google's own page, where the creator grants the scopes), permission dialog

**Preference**:
A choice a user saves outside any channel: a display choice, such as the page size, the chart mode, the currency or the theme (Light, Dark or System), the dismissal of the sidebar's support prompt, the dismissal of the sidebar's "Upgrade" item, or the "What's new" marker, the newest app version whose highlights the user has seen. It holds no YouTube data. A value in the address wins over a display choice for that view, and a preference wins over the default. "Reset preferences" clears them all, the dismissals and the marker included, and they go with the user when the user is deleted.
_Avoid_: User settings

**Feedback message**:
A message a signed-in creator sends to Nick from the web app's "Send feedback" item, which sits beside "Support Stillstats" in the sidebar, or from the popup's "Send feedback" link, which opens the same form: its type (something wrong, an idea, or other), its text, the name of the screen it was sent from (the video list, a video's detail, Audience, Settings, "What's new" or the extension, for a message from the popup's link, never a path, a channel or a video), the app version, a reply address only when the creator chooses to give one, and the time it was handled. The creator's own scope sends it and reads none, its own included. Nick reads every message on the admin feedback screen and marks each one "Done", which sets the time it was handled; he does so through the admin scope, which reads every message and changes only that time, and which the API enters only for a user on the admin allowlist. An account sends 10 in 24 hours at most. Nick is told of each one by an email that holds its type, its time and a link to the admin screen, never its text. It cascades from its user, so "Delete me" removes it, and it is deleted one year after it is handled.
_Avoid_: Ticket, support request, report (the error reports GlitchTip holds)

### Plans

**Free tier**:
Access to a channel's current analytics, including engaged views, with no stored history beyond a short cache.

**Pro**:
The paid tier, sold as "Stillstats Pro" at $7 a month or $70 a year for each channel: access that adds stored history (CTR and impressions first) for as long as the subscription is active. It was called the Paid tier until 2026-11-19 (creator-analytics#913). Code, database values, API fields and analytics events keep the word `paid`, as the paid Entitlement does.
_Avoid_: Paid tier, premium

**Entitlement**:
What a channel may use under its current plan.

**Subscription**:
A channel's purchase of Pro, monthly or annual, which gives the channel the paid Entitlement. It belongs to the channel, and only the channel's owner starts, changes or cancels it. It keeps its price while it stays active. Monthly or annual is how often it bills, whatever its price, so one on a price Stillstats no longer sells is still monthly or annual.
_Avoid_: Plan (the tier it buys), membership (a different thing), Pro (the tier, not the purchase)

**Purge date**:
The day a channel's stored history is deleted: 30 days after its subscription ends. Until then the history stays readable and shows the purge date, and a new subscription before it keeps the history and clears the date.
_Avoid_: Expiry, deletion date

**Tip**:
A one-time payment of an amount the creator chooses, to support Stillstats. It gives no Entitlement and does not count toward Pro.
_Avoid_: Donation, contribution, supporter

### Data

**Engaged view**:
YouTube's `engagedViews` metric: a view counted under YouTube's previous, stricter methodology. Kept distinct from a view because YouTube aligned public view counting across all formats in August 2026.
_Avoid_: Real view, quality view

**Watch hours**:
YouTube's `estimatedMinutesWatched` metric divided by 60, shown with one decimal in the browser's locale, such as 12.3. The API carries the minutes and the screens show hours. Simple arithmetic on the channel's own numbers, not a derived metric (ADR 0013).
_Avoid_: Watch time hours, viewing hours

**Revenue sources**:
The parts of YouTube's estimated revenue (`estimatedRevenue`, in the creator's currency): ads (`estimatedAdRevenue`), YouTube Premium (`estimatedRedPartnerRevenue`), and other sources, the estimated revenue less ads and YouTube Premium, such as channel memberships and Supers. Other sources is simple arithmetic, not a derived metric (ADR 0013). YouTube also ties some revenue to no video or format: the `creatorContentTypeUnspecified` row, with zero views, of a revenue report by `creatorContentType`, which the channel summary carries as the no-format amount. A video's revenue is its own, read with a `video==` filter: the video list carries each video's estimated revenue, and a video's detail its revenue sources and its revenue by day. The videos' revenue does not add up to the channel's, as YouTube ties some revenue to no video.
_Avoid_: Revenue streams, income

**Currency**:
The creator's preferred currency for revenue, a preference: one of the codes Google's Analytics API documents for its `currency` parameter, USD by default. Every revenue read asks Google for it, and Google converts at its daily exchange rate. The payout currency is in AdSense, which no API exposes, so the app never guesses it.
_Avoid_: Payout currency, local currency

**RPM**:
Estimated revenue per 1,000 engaged views: estimated revenue divided by engaged views, times 1,000, for every format. None when engaged views are zero. With the RPM preference on, RPM is the estimated revenue less other sources (ads and YouTube Premium) per 1,000 engaged views, and the label stays RPM. Simple arithmetic on the channel's own numbers, not a derived metric (ADR 0013).
_Avoid_: CPM, revenue per view

**Authorized data**:
Data about a channel that has a connection to the product. YouTube's term.

**Non-authorized data**:
Public data about a channel that has no connection to the product. YouTube's term. Held for no more than 30 days unless the product is accepted under YouTube's derived-metrics policy.
_Avoid_: Competitor data, public data (as a category name)

**Derived metric**:
A number the product calculates from YouTube data that goes beyond simple arithmetic on one channel's or one video's own numbers, such as a score, a rank or a comparison with other channels. Allowed only after acceptance under YouTube's derived-metrics policy. A sum, a share, a running total or a division such as RPM is not one. Nor is a sort: sorting the channel's own videos by one of their own numbers, or placing one video among the channel's own uploads by such a number, such as the latest video card's "3 of 10 Shorts", is a sort, not a rank or a score (ADR 0013).
_Avoid_: Custom metric, score (unqualified)

**Outlier score**:
A derived metric comparing one video's views to the median of its own channel's recent long-form uploads. Compared only against channels of a similar size.
_Avoid_: Viral score, breakout score

**Retired metric**:
A metric the product deliberately does not offer because it measures something other than how a channel's own viewers respond to its videos, such as tags or SEO scores. Each one is listed in the principles with its reason.
_Avoid_: Unsupported metric

**Export workbook**:
One file with one tab per channel, produced on request for an agency. Channel data is never combined inside the product.
_Avoid_: Report, combined export

**Retention window**:
How long a category of data may exist before the product deletes it.
_Avoid_: Retention (unqualified), audience retention (a different thing)

**Reporting job**:
The YouTube Reporting API job each connected channel has, free or paid, for which YouTube produces the channel's daily reach reports. The product downloads them only for a channel with the paid Entitlement, so the free tier stores nothing from it.
_Avoid_: Report job, export

**Calendar window**:
A window of days that ends at the last day Google has processed and starts its length before it: the last 7, 28, 90 or 365 days, so each holds its full count of days with numbers. The last day Google has processed is the latest day Google answers a row for, or four days before today when that is later: today is the reporting day in Pacific Time, and four days back is the last day surely past Google's 72-hour delay. A calendar window never starts before the channel's creation day. A custom range is a calendar window too: any start day and end day the creator picks, from the channel's creation day to the last day Google has processed, one day at least (the start equal to the end). It lives in the address only (`window=custom&from=…&to=…`) and is never a preference.
_Avoid_: Rolling window

**Window after publish**:
A window that runs from each video's own publish day: the publish day, or the first 7, 28, 90 or 365 days, with the publish day as day 1. Only a video has a publish day, so the channel summary has no window after publish. A video whose window Google has not processed to its end is partial and carries the days it has, for example 10 of 28. It follows every complete video in a metric sort, so it is never ranked as if complete.
_Avoid_: Launch window, first week

**Last processed day**:
The latest day whose numbers Google has processed for a channel: `lastProcessedDay` in the channel summary, video list and video detail answers. It is the latest day Google answers a row for, or four days before today when that is later, as the calendar window counts it, so every answer names a day. The latest video card shows it as "Through 7 Oct", in the browser's locale, the Content list and a video's analytics page as "Data from Stillstats as of 7 Oct.", and the web app as its delay note: "YouTube has processed data up to {date}. New numbers usually take two to three days to appear." A video Google has processed no day of since it was published shows "Not processed yet" on a surface instead of zeros.
_Avoid_: Freshness (when the API read the numbers from Google, a different thing)

**History start**:
The first day a channel's stored history holds. A calendar window, lifetime or a window after publish that starts before it is partial: it carries the "N of M days" label and a note that gives this day.
_Avoid_: Backfill, first day (unqualified)

**Since publish**:
One video's six stages side by side: each window after publish, each the sum of the video's own daily rows from one query, partial as a window after publish is, then its lifetime, YouTube's own total and never a sum. It does not depend on the window the screen shows.
_Avoid_: Launch stats, milestones

**Sponsor report**:
One video's page made to print for a sponsor, and the read behind it: the video's views, engaged views, watch time, average view duration, average view percentage, likes, comments, shares and subscribers gained over its first 7, 14 and 30 days, the publish day as day 1, each Google's own total up to the last processed day and partial as a window after publish is. Its 14 and 30 days are windows of this read only, never a window after publish. It carries no revenue figure, and the read refuses one. Free for every channel. For a channel whose history is readable it can also show the video's impressions and CTR from the stored history, and only in a window the history holds every day of. Which figures it shows is the channel's figure choice: a per-channel record any member of the channel writes, read by every sponsor report of the channel. It is not a **Preference**, which belongs to one user and is outside any channel.
_Avoid_: Media kit, export (the export workbook is a different thing)

**Visibility**:
Which of a channel's videos the full video list shows: the public ones only, by default, or the unlisted and private ones too, by each video's privacy status on YouTube. It applies to the full list only. A set of ids answers its listed uploads in any visibility, whatever the visibility setting says. A scheduled video, private until it publishes, is shown or left out of the full list by the scheduled setting alone, and a set of ids answers it whatever that setting says. The channel summary's uploads, which the upload markers show, follow it too, while the summary's numbers stay the whole channel's whatever it says.
_Avoid_: Privacy (that word means a single video's status)

**Embeddable**:
Whether a video plays in an embedded player, Google's `status.embeddable` beside its privacy status, true when Google leaves it out. A video that is not embeddable shows no video player.

**Made for kids**:
Whether a video is made for kids, Google's `status.madeForKids` beside its privacy status, false when Google leaves it out. A video made for kids sends no player event (Developer Policies III.E.4.j).

**Latest upload**:
The channel's newest upload whose privacy status is public. An unlisted, private or scheduled video does not count, whatever the visibility setting says (Nick, 2026-10-19). The same rule picks the uploads the video list's average engaged views counts (#243). For a paid channel it also picks the uploads the newest average impressions and CTR counts, among those whose whole window after publish the stored history holds (#785).
_Avoid_: Latest video card (Studio's card for the newest upload, a different thing)

**Upload marker**:
One mark under the channel summary's charts, on a publish day of the window, at that day's x on every plot, as YouTube Studio marks uploads under its own chart. Each marker is a framed square. A single upload's marker holds its format's shape (a play triangle for a video, a tall rectangle for a Short, a dot in a ring for a live stream, a small square for an upload with no format), reads as its format's word and its title, such as "Short: My title", and opens the video's page. Uploads on one day share one tile with their count, read as "2 uploads", whose card lists them newest first, each a link to its video's page. A tile's card opens on hover, and a click, a tap or Enter opens it and keeps it open until Escape or a press outside it. Markers whose boxes would overlap at the chart's drawn width join into one tile with their count too, which can cover nearby days, and a resize joins or splits them again; a tile's card dates each upload by its own publish day. Every plot draws a faint dashed line at each upload day, one for each day a tile covers. The markers follow the visibility and the format filter, and the row under the axis is one Tab stop that the arrow keys move along. With the charts stacked, a second row of the same markers sits under the first plot, for the pointer only, so a screen reader hears each upload once.
_Avoid_: Pin, upload dot, timeline

**Audience retention**:
YouTube's curve of how many of a video's viewers are still watching at each point in the video. It describes viewers inside one video, and has nothing to do with how long the product keeps data.
_Avoid_: Retention (unqualified), retention window (a different thing)

**Retention comparison**:
The web app's page at `/app/retention` that draws up to 5 of a Pro channel's stored audience retention curves on one chart, each labelled with its video and the date its curve was read, and its read, `GET /api/channels/:channelId/retention-curves`. The curves are the ones the daily refresh stores, never a live Google read, so a video the refresh has not read yet has none, and a note shows while the backfill fills. Each curve is the creator's own video's absolute share still watching: Google's relative retention performance stays off it (ADR 0004). A channel whose history is not readable is refused, as the Pro sorts are. The sidebar link that opens it reads "Retention", the one place the bare word stands, because the page's heading "Compare retention curves" qualifies it at once (Nick, 2026-11-21).
_Avoid_: Retention window (a different thing), benchmark, ranking

**Video player**:
YouTube's player on the video detail screen, loaded from YouTube as the screen opens, when the video has a duration and a retention curve and Google has processed it (ADR 0020). The video's thumbnail shows in its box until the player is ready. A click, tap, Enter or Space on either audience retention plot moves it to the start of the picked point's slice: the time of the point before it, or 0:00 for the first point. A move before the player is ready waits, and the player takes it once ready.
_Avoid_: Embed, facade

**Player placeholder**:
What the video player's box shows in the player's place: the thumbnail, drawn over the player's frame until the player is ready, or the thumbnail with the "does not allow embedding" text and the "Watch on YouTube" link for a video that is not embeddable, and no player. A player error replaces the player with the same text and link for errors 100, 101 and 150, and with the "could not load this video" text and the link for any other.

**Format**:
What kind of upload a video is, read from Google's content type for it: a video, a Short or a live stream (`video`, `short` or `live`). A video Google gives no format, such as one with no lifetime views or one of a content type outside these, has none: it lists under "All" only, and the web app shows "No data" for it. The video list's format filter offers "All", "Videos", "Shorts" and "Live", and its Format column says "Video", "Short" or "Live". The comparison row places an upload among uploads of its own format only. The video detail answer carries the video's format too, read as the video list reads it, over the video's lifetime, and none for a video awaiting processing. On the video detail screen a Short's video player frame is 9:16, and every other video's is 16:9.
_Avoid_: Content type (Google's dimension the format is read from)

**Activity day**:
The row that says a user read a channel's numbers on a UTC day: one per user and day, however many reads. It holds the user and the day and nothing else, no channel, no route and no time of day. A signed-in read of the video list, a video's detail, the channel summary or the audience records it, whatever the route answers, and no other route does. It cascades from its user, so "Delete me" removes it.
_Avoid_: Visit, session (the sign-in session, a different thing)

**Active user**:
A user with an activity day on the counted day, the UTC day that just ended: `dau` counts them. `wau` counts the users with an activity day in the 7 days ending on the counted day, and `mau` in the 30 days ending on it. Each user counts once however many activity days they hold.
_Avoid_: Account, visitor, rolling window

### API

**Answer**:
The JSON body the API returns for a request it serves, typed in `packages/api-types` as a `...Answer` type.

**Channel summary**:
YouTube's own totals for one channel over a calendar window or lifetime, of every format or of one (videos, Shorts or live): engaged views, views, watch time, and with revenue consent the estimated revenue, its revenue sources, each day's revenue, and the no-format amount, which no format filter narrows. Without revenue consent, or for a channel outside the YouTube Partner Program, the summary still answers, and says why it carries no revenue. One format's totals are Google's own for that format, read with its `creatorContentType` filter. Never a sum the product computes, and never across channels (ADR 0005). It carries the window's uploads too: each upload published on a day of its daily series, of the format and the visibility asked for, newest first, which the upload markers show; a scheduled upload is never among them. It has no window after publish, since a channel has no publish date. In a window after publish its place on the channel screen shows the launch chart, each listed video's engaged views by day from its publish day, or under "Publish day" the top 10 videos by engaged views on their publish day, both drawn from the video list's answer; neither is a summary.
_Avoid_: Readout (the retired one-number answer it replaced)

**Video list**:
The product API's list of one channel's uploads, `GET /api/channels/:channelId/videos`, each with its format and its numbers over a calendar window, lifetime or a window after publish. It sorts by publish date, one of five metrics, revenue or one of its sources, or RPM, and filters by format and visibility, and with `ids` to only the listed uploads. A request with `ids` answers only those of the channel's uploads it lists, in any visibility and scheduled ones included, whatever the visibility and scheduled settings say: visibility is still checked, so a bad value is still refused, and has no effect. An id not among the uploads is left out, not refused, and window, format and sort still apply. Videos that tie on the sort run newest first, then by id: the tie order the comparison row reuses. An RPM sort puts a video with zero engaged views, which has no RPM, last in either direction. It also sorts by impressions or CTR for a channel whose stored history is readable (paid, or ended before its purge date), and refuses those sorts with the error code `sort_without_history` for any other; in them a video whose counted days the history does not hold whole follows every complete one, and a video with no impressions, which has no CTR, follows the others in a CTR sort in either direction. For the same channels it also counts one traffic source alone in each video's impressions and CTR, which the CTR and impressions sorts then follow, and hides videos under a minimum of impressions before the sort and paging, so the page count counts only the videos that stay; it refuses either with the error code `filter_without_history` for any other channel. The web app's screen that shows it is also the video list. The Studio extension reads every figure it shows from the video list.
_Avoid_: Content list (Studio's own list of uploads), uploads list (YouTube's playlist the API reads the uploads from)

**Refusal**:
An answer that says why the API cannot answer a valid request for this channel: the channel's connection, its consent, the quota, a Google failure, a video the channel does not hold, or a channel outside the YouTube Partner Program. Such as `not_connected`, `consent_missing`, `quota_reserved`, `google_failed`, `video_not_found` or `not_monetized`, each with its own HTTP status. `not_monetized` is Google's 403 to a revenue read for a channel outside the program, cached for 6 hours like an answer; the channel summary, the video list and a video's detail carry it in place of revenue, and carry `consent_missing` the same way for a channel without revenue consent. A video list sorted by revenue or by RPM is refused whole with `consent_missing` for a channel without revenue consent. Kept distinct from an error code, which names a request the API turns away by its own rules, malformed or not allowed (such as `invalid_window`, `invalid_range`, `window_after_publish`, `sort_after_publish`, `invalid_visibility` or `invalid_preference`), or a failure of the API itself (`unauthenticated`, `not_found`, `internal`).
_Avoid_: Error (for a refusal)

**Freshness**:
When the API read an answer's numbers from Google (`fetchedAt`), and whether every read came from the cache (`fromCache`). An answer built from several reads carries the freshness of the oldest.

### Studio extension

**Studio extension**:
The product's one browser extension for Chrome and Firefox, which shows a creator's own engaged views on the surfaces of YouTube Studio and, with YouTube access, on public page surfaces. It reads every number from the product API with the creator's stillstats.com session, never from the page, and its required host access is to `studio.youtube.com` and the product API's domain only (ADR 0008, as amended by ADR 0016). It is free and shows free tier numbers only.
_Avoid_: Plugin, add-on, Chrome extension

**Public page**:
A page on www.youtube.com that anyone can open, as distinct from Studio.
_Avoid_: Front end, the main site

**Surface**:
One of the places where the extension shows a figure: three in YouTube Studio, the latest video card (`card`), the Content list (`content_list`) and a video's analytics page (`analytics`), and four on public pages, the channel's Videos, Live and Home tabs (`channel_page`), the view count under a watch page's title (`watch_page`), the home feed, search results and the watch page's sidebar (`feed`), and the channel's Shorts tab and the Shorts player (`shorts`). A surface's elements belong to its own page: a move within Studio to any other page takes them down, even where Studio keeps the elements they stood beside, such as the Content list's Collabs tab. The extension's surface events name each one by its value. The popup is not a surface: it shows no figure and sits outside Studio and the public pages.
_Avoid_: Widget, panel (for a surface), injection, overlay

**Engaged views pill**:
The extension's element on a public page: the Stillstats icon, the video's lifetime engaged views in compact form and "engaged views", with the full figure and its day in its hover.
_Avoid_: Badge, chip, tag

**Stillstats mark**:
The extension icon, the S from stillstats.com's favicon, that opens the engaged views pill on the latest video card, the Content list and every public page surface, before the figure when there is one and the words "engaged views". In each Content list row's views cell, the pill shows the mark and the figure only, or the mark and "Not processed yet", since the Content list's own pill in Studio's Views column heading carries the words, and the row's spoken text is still the whole figure, such as "96 engaged views". On a video's analytics page, the mark opens the figure inside Studio's Views tile, under the words "engaged views" and before the number or "Not processed yet", and the line above Studio's key metric card. On the Content list, it also opens the line under Studio's page title. It says the figure comes from Stillstats and not from YouTube. It takes the text colour around it, and its accessible name is "Stillstats".

**Latest video card**:
The card on the Studio dashboard for the channel's newest upload. The extension adds the video's lifetime engaged views and the comparison row beside Studio's own views and ranking, which it leaves as they are.
_Avoid_: Dashboard card, latest upload card, Latest upload (the newest public upload itself, a different thing)

**Comparison row**:
The row the extension adds to the latest video card that places the newest upload among the channel's last 10 public uploads of the same format by each upload's engaged views over its own first N days, N being the days Google has processed for the newest upload, from its publish day as day 1 through the last processed day, as a window after publish counts them. It is written "n of m Format by engaged views", such as "3 of 10 Shorts by engaged views", with the days it counts under it: "Publish day" when N is 1, and "First N days" otherwise, such as "First 3 days". When N is 0, Google has processed no day of the newest upload, and the card shows no comparison row. Uploads that tie place newest first, as the video list orders them. When m is 1, the format word is in the singular, such as "1 of 1 Video by engaged views", and "Live" is the same word either way. It is a place in a sort of the channel's own uploads, the same as sorting the video list, and compares no other channel.
_Avoid_: Rank, ranking (Studio's own row is "Ranking by views", and the comparison row's text never contains it), score

**Content list**:
Studio's list of the channel's uploads, on every page and tab, where each row gains the video's lifetime engaged views under Studio's views, in the row's Views cell. A line directly under Studio's page title, "Channel content", says the day the figures run through: the Stillstats mark, then "Data from Stillstats as of 7 Oct.", the words the analytics page's line opens with, and no link. Studio's Views column heading gains a small engaged views pill, the Stillstats mark and "engaged views", under Studio's word "Views" and ending where the word ends, inside the heading. The pill sits beside the line that holds Studio's word, never in it, so the word "Views" and the column's width stay as Studio draws them, and a click on it sorts the column as Studio's heading does. The heading carries no day. A sign-in line, connect prompt, refusal line, failed read or access line shows its line in the line under the title instead, with its link if it has one, with no pill in the heading and no figure in any row. A page without Studio's title shows nothing of the extension's. A page without the Views heading's line that holds the word shows nothing of an answer with figures, no line, pill or figure, and a line state still shows its line under the title. A tab of Studio's Content section that shows no video list, such as Playlists, shows nothing of the extension's.
_Avoid_: Video list (the product API's and the web app's list), videos page

**Video's analytics page**:
Studio's analytics page for one video. The extension adds the video's engaged views inside Studio's Views tile, centred under Studio's number: the visible words "engaged views", in the font of Studio's own label (Roboto, normal weight), a little smaller than the tile's type and muted, then the Stillstats mark and the figure under them. A screen reader hears the words first too, as Studio's tile reads "Views" before its number. A video YouTube has not processed shows "engaged views", then the mark and "Not processed yet" in the figure's place. The figure covers the period Studio has selected when it matches a calendar window or lifetime, and shows no period then. For any other period it is lifetime engaged views, with "Lifetime" under the figure, in the same font as "engaged views" and smaller still. A line directly above Studio's whole key metric card, the tiles and the chart, and outside it, says "Data from Stillstats as of" the figure's last processed day, then "View this video in Stillstats", which opens the video's detail screen in the web app. A sign-in line, connect prompt, refusal line or access line shows in that line's place, and the Views tile then shows nothing of the extension's.
_Avoid_: Video detail screen (the web app's own screen for a video), analytics panel

**Sign-in line**:
The one line a surface shows instead of figures when the creator has no stillstats.com session in that browser, or it has expired: "Sign in at stillstats.com", linking the web app in a new tab. The popup shows the same link. The extension has no sign-in of its own; it reuses the web app's session.
_Avoid_: Login prompt

**Refusal line**:
The one line a surface shows instead of figures when the API answers a refusal: "Reconnect in Stillstats" for `connection_revoked` or `not_connected`, and "Try again later" for any other, such as `quota_reserved` or `google_failed`. A read that fails with no answer shows "Try again later" too. Each links the web app in a new tab and never covers Studio. Kept distinct from the sign-in line and the connect prompt.
_Avoid_: Refusal message (the web app's sentence for a refusal, `refusalMessageOf`)

**Access line**:
The one line a surface shows instead of figures when the creator has let the extension run on Studio but withheld its host access to stillstats.com, in Chrome's or Firefox's site access setting, or by granting Chrome's request beside the extensions icon on a Studio tab, which grants only that tab's origin: "Allow access to stillstats.com". The background checks host access before it reads, as the popup does, and answers this state without asking the API, so a surface in this state never shows the sign-in line or "Try again later". The line links nothing: no surface can make the grant itself, since a click in Studio is not a user action the browser lets the extension ask for host access in, so the creator makes it with the popup's "Allow access" or in the browser's site access setting. It differs from the sign-in line, whose creator has no stillstats.com session: the access line's creator may be signed in, and the fix is in the browser, not at stillstats.com. It differs from the refusal line, which answers a refusal from the API or a read that failed: the fix here is a browser grant, not a reconnect or a retry. It is also distinct from the popup's prompt to grant site access, which asks for the same grant inside the popup.
_Avoid_: Access prompt (the popup's prompt with "Allow access", as `apps/extension/src/popup.test.ts` names it)

**Connect prompt**:
What a surface shows instead of figures when Studio has a channel open that matches, by YouTube channel id, none of the channels the user reaches through memberships: "This channel is not in Stillstats." with a "Connect it" link that opens the web app in a new tab, where the creator makes the connection. Kept distinct from "Reconnect in Stillstats", the refusal line for a channel whose connection was revoked or is missing, and from the popup's prompt to grant site access.
_Avoid_: Connect button, reconnect prompt

**YouTube access**:
The optional host permission for www.youtube.com, which the creator grants or removes with the popup's toggle.
_Avoid_: youtube.com permission, opt-in

**Popup**:
The extension's toolbar popup: whether the creator is signed in, the connected channels, a prompt to grant site access when the creator has withheld it in Chrome or Firefox, the YouTube access toggle, a link to the web app, and, for a signed-in creator, a "Send feedback" link to the web app's feedback form. The extension has no options page.
_Avoid_: Options page, toolbar menu

**First-run page**:
The extension page that opens once, on install and never on update, saying what the extension reads on Studio, and on www.youtube.com once YouTube access is on, what it sends to stillstats.com and what Stillstats keeps, with a link to the privacy policy. It repeats the consent screen's lines on refresh, storage, deletion and sharing word for word, so the two never disagree. It is the in-product disclosure the Chrome Web Store requires.
_Avoid_: First-run screen, welcome page, onboarding, consent screen (the web app's own screen before Google)

### Compliance

**Principles**:
The published commitments the product is held to: what it never does with data, and which metrics it refuses to show.
_Avoid_: Policy (that word means the privacy policy), values

**Compliance audit**:
YouTube's review of an API client, required for quota above the default and for acceptance under the derived-metrics policy.
_Avoid_: Verification (that word means Google OAuth verification)

**Homepage**:
The public page Google's OAuth verification requires.
_Avoid_: Landing page (the web app uses "landing" for its post-redirect state)

**Attention trick**:
Any interface device that rewards checking rather than informs a decision, such as a streak, a red or green delta, or a growth alert. The product offers none.

**OAuth verification**:
Google's review of the product's Google consent screen, homepage, and privacy policy before more than 100 users can connect.
_Avoid_: Audit

### Tools

**Thumbnail preview tool**:
The free tool at `stillstats.com/tools/thumbnail-preview` that shows up to three candidate thumbnails at YouTube's measured sizes. It works in the browser only, and nothing is uploaded. Its logic and its component are the `thumbnail-preview` package. Its `surface`, the light or dark YouTube stage in focus mode, is not the Studio extension's **Surface**.
_Avoid_: Thumbnail tester, thumbnail checker

**Tool page**:
A page on the site that hosts a free tool as its one React island, with its own content security policy.
_Avoid_: Public page (that word means a www.youtube.com page), landing page

### Releases

**Release**:
One published version of the app, which is the API, the worker, the web app and the site together, or of the Studio extension, with its release note. Publishing an app release on GitHub is the production deploy; an extension release deploys nothing.
_Avoid_: Deploy (a merge to `main` deploys staging, and that is no release), build

**Release note**:
The markdown file for one release in `packages/releases/notes/`, named by its version. Its frontmatter gives the product (`app` or `extension`), the date, a one-line summary, the highlights it includes and whether it removes something, and its body says what changed in plain words for creators. The GitHub release body is a copy of it.
_Avoid_: Changelog, release notes (for one file)

**Release page**:
The page on stillstats.com at `/releases/<version>` that the site build writes from one release note, with the summary as its description. The release index at `/releases/` lists every release, newest first, app and extension together.
_Avoid_: Changelog page, blog post

**Highlight**:
One feature a release note picks for the "What's new" screen: a markdown file in `packages/releases/highlights/` with a title, an optional web app screen it links to and a short body. It merges with its feature and never names a version; its release is the note that lists it, and only an app release note lists one.
_Avoid_: Announcement, news

**Staging**:
The environment at `staging.stillstats.com`, behind Cloudflare Access for Nick alone (its API refuses any request without a valid Access token, since a request to the box's IP skips Cloudflare), with its own database, Google client and OpenPanel project, which every merge to `main` deploys. Production changes only on a release.
_Avoid_: Dev environment, preview, test database (the suite's own database, a different thing)

**Version**:
The name of one release. The app's is CalVer, `2026.11.9`, then `2026.11.9.1` for a second release that day, shared by the API, the worker, the web app and the site, and a build's version is the newest app release note in it. The Studio extension keeps its own SemVer, such as `1.0.0`. An app release's tag is the bare version, and an extension release's is `extension-` and its version, such as `extension-1.0.0`.
_Avoid_: Build number, `v2026.11.9` (a tag with a prefix)
