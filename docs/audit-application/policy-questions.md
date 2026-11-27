# Policy questions for the API Services team

Stillstats (https://stillstats.com) is a read-only analytics app for YouTube creators, operated by MIDLO WEB DESIGN, LLC, on Google Cloud project creator-analytics-510701. This document goes with its YouTube API Services Audit and Quota Extension Form.

Stillstats follows the Developer Policies as I read them today. Each question below asks whether it may do more than it does now, so a no changes nothing that's live. Each one names the clause, the feature, what Stillstats does now, and what it does on a no. Questions 6 and 7 are about features that are planned and not built, so they're marked "Planned, not built" and you won't find them in the product.

The policy text is quoted from two pages, read on 2026-11-23:

- YouTube API Services Developer Policies, https://developers.google.com/youtube/terms/developer-policies, "Last updated 2026-11-06 UTC."
- Additional policies for derived metrics and data storage, https://developers.google.com/youtube/terms/derived-metrics-policy, "Last updated 2026-09-14 UTC."

## 1. An agency's export workbook

**Clause.** III.E.2.a, Data Aggregation.

> Do not aggregate API Data except that you may only aggregate API Data relating to YouTube channels that are under the same content owner as recognized by YouTube pursuant to content licensing agreement(s) between YouTube and such content owner. Such aggregated API Data must only be viewable by that content owner.

**Feature.** An agency workspace, where an agency's users manage several creators' channels, each connected with its own OAuth grant. On request, the agency exports one workbook file with one tab per channel. Each tab holds one channel's figures, and the workbook has no totals and no cell that adds channels together. Is one file with one tab per channel aggregation under III.E.2.a?

**Now.** Planned. The agency workspace isn't built yet.

**On a no.** The export is one file per channel.

## 2. An agency's channels side by side

**Clause.** III.E.2.a, Data Aggregation.

> Do not aggregate API Data except that you may only aggregate API Data relating to YouTube channels that are under the same content owner as recognized by YouTube pursuant to content licensing agreement(s) between YouTube and such content owner. Such aggregated API Data must only be viewable by that content owner.

**Feature.** In the same agency workspace, may an agency see its channels side by side, each with its own figures, with no totals and no figure that combines them?

**Now.** Planned. The agency workspace isn't built yet.

**On a no.** The agency switches between its channels and sees one at a time.

## 3. Engaged views in place of a number in Studio or on www.youtube.com

**Clause.** III.I.4, Additional Prohibitions.

> You and your API Clients must not, and must not encourage, enable, or require others to:

> modify, interfere with, replace, or otherwise disable any functionality, data, or content made available as part of, or in connection with, YouTube API Services. For example, you must not remove, obscure, alter, or disable any links that appear in YouTube players or in API Data.

**Feature.** The Stillstats extension for Chrome and Firefox shows a creator's own engaged views in two places. It adds them to the latest video card on the YouTube Studio dashboard, and, if the creator turns it on, it adds an engaged views pill beside YouTube's view count on each of the creator's own videos on www.youtube.com. May it replace the card's views figure with engaged views, or replace the card's "x of 10" ranking row with its own row that places the video by engaged views? On www.youtube.com, may the pill replace YouTube's view count on the creator's own videos?

**Now.** Live. In Studio, the extension shows engaged views beside Studio's views figure, and its own row, such as "3 of 10 Shorts by engaged views", beside Studio's ranking row. Studio's figure and Studio's row stay exactly as Studio shows them. On www.youtube.com the pills are off by default. The browser asks the creator for access to www.youtube.com only when they turn the pills on in the extension's popup. Then each of the creator's own videos gets a pill beside YouTube's view count, on channel pages, watch pages, the home feed, search results and Shorts. In the Shorts player, which shows no view count, the pill sits under the channel name. Videos from other channels get no pill, and YouTube's view counts stay exactly as YouTube shows them. Every number the extension shows comes from the YouTube Analytics API under the creator's own OAuth grant, never from a page in Studio or on www.youtube.com.

**On a no.** Nothing changes. In Studio and on www.youtube.com, the extension keeps showing engaged views beside YouTube's own figures, never in place of them.

## 4. Realtime engaged views, a request for express permission

**Clause.** III.D.7, Undocumented Services.

> You must not use undocumented APIs without express permission. You must access data from YouTube API services only according to the means stipulated in the authorized documentation of that YouTube API service.

**Feature.** This is a written request for express permission. May the Stillstats extension read a creator's realtime engaged views for one video, in its first 48 hours after upload, for that creator's own channel only and shown only to that creator? Those are the hours when a creator decides whether to change the title or the thumbnail. The YouTube Analytics API runs 48 to 72 hours behind, and videos.list and videos.batchGetStats return viewCount, likeCount and commentCount but no engaged views, so no documented API gives this figure. If the answer is yes, I'd ask which endpoint and which terms apply.

**Now.** Stillstats shows no realtime engaged views and calls no undocumented endpoint.

**On a no.** Nothing changes.

## 5. Playback from a click on the retention chart

**Clause.** III.C.2, Implementing YouTube Features.

> Any API Client feature that initiates a user action related to a YouTube resource must be:
>
> - clearly and unequivocally identifiable as a YouTube action,
> - distinct and not mixed with your API Client's functionality, and
> - clearly initiated by the user.
>
> Examples of YouTube resources include videos, channels, playlists, playlist items, and subscriptions. Examples of actions include playing a video, liking a video, adding a video to a playlist, and subscribing to a channel.

**Feature.** A video's screen in Stillstats shows YouTube's embedded player beside the video's audience retention chart, and a click on the chart moves the player to that moment. May that click also start playback? With the IFrame Player API, seekTo on a cued player starts playback.

**Now.** Live. A click moves the player to the clicked moment and leaves it playing or paused as it was. A player that hasn't started yet is cued at that moment, so playback starts only from YouTube's own play button.

**On a no.** Nothing changes.

## 6. An opt-in comparison with similar channels. Planned, not built.

**Clause.** III.E.2.a, Data Aggregation, and item 5 of the derived-metrics policy, Gamification and Leaderboards.

> Do not aggregate API Data except that you may only aggregate API Data relating to YouTube channels that are under the same content owner as recognized by YouTube pursuant to content licensing agreement(s) between YouTube and such content owner. Such aggregated API Data must only be viewable by that content owner.

> You may rank channel performance or track views between different channels for the purpose of comparison or historical analysis.

**Feature.** A creator opts in and sees their own figures, such as click-through rate by traffic source, beside a summary of opted-in channels with a similar subscriber count and niche. It shows only when the creator asks for it, and never as a grade, a target or a rank. May an audited API client do this with authorized data, when every channel in the summary has opted in? Item 5 lets an accepted developer rank channel performance or track views between channels, and it doesn't say whether that covers authorized data or only public data.

**Now.** Not built. Stillstats compares a creator only with their own channel's past.

**On a no.** It isn't built.

## 7. Totals across the channels of one Google account. Planned, not built.

**Clause.** III.E.2.a, Data Aggregation.

> Do not aggregate API Data except that you may only aggregate API Data relating to YouTube channels that are under the same content owner as recognized by YouTube pursuant to content licensing agreement(s) between YouTube and such content owner. Such aggregated API Data must only be viewable by that content owner.

**Feature.** May an API client show one user totals across the channels that user owns or manages under their own Google account, when none of those channels is under a content owner recognized by YouTube?

**Now.** Not built. Each channel is viewed on its own. One Pro purchase will soon cover up to 4 of a user's channels, and that's billing only. It combines no figures.

**On a no.** It isn't built.

## 8. A sponsor as an approved agent

**Clause.** III.E.3.b, Authorized Data Usage.

> API Clients must not display or allow access to Authorized Data to anyone other than the authorizing user or agents expressly approved by that user.

**Feature.** May a creator share a link that shows a sponsor the figures the creator picked for one of their videos, with the sponsor counted as one of the "agents expressly approved by that user"? The policies don't define "agent".

**Now.** Live as a sponsor report, one video's page that the creator saves as a PDF and sends to the sponsor themselves. Stillstats gives the sponsor no link and no access.

**On a no.** The PDF stays the only way.

## 9. Keeping the dates of title and thumbnail changes past 30 days

**Clause.** III.E.4.c, Refreshing, Storing, and Displaying API Data.

> API Clients may store all other types of Authorized Data not identified in section (III.E.4.b) for as long as is necessary for the purposes of the specific consent granted by an active user and for no longer than 30 calendar days. After 30 calendar days, the API Client must either delete or refresh the stored data.

**Feature.** A planned history of each video's title and thumbnail changes keeps the old title, the old thumbnail and its hash for 30 days at most. May it keep only the date of each change for longer, as a marker on the video's click-through rate chart?

**Now.** Planned, with everything deleted at 30 days.

**On a no.** Nothing changes.
