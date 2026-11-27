const channelPath = /^\/channel\/(UC[\w-]{22})(?:\/|$)/
const dashboardPath = /^\/channel\/UC[\w-]{22}(?:\/dashboard)?\/?$/
/**
 * The Content list's tabs that list the channel's own uploads: Videos (`upload`), Shorts and Live.
 * Posts, Playlists, Podcasts and Promotions list no video rows, and Collabs lists other channels'
 * uploads, which the API never answers.
 */
const contentListPath = /^\/channel\/UC[\w-]{22}\/videos(?:\/(?:upload|short|live))?\/?$/
/** YouTube's video ids are 11 characters of letters, digits, `-` and `_`. */
const videoPath = /^\/video\/([\w-]{11})(?:\/|$)/
/**
 * A video's analytics page on its Overview tab, where Studio's key metric card shows Views, with the
 * selected period as the last segment when Studio carries one. The period's name is anything up to
 * the next `/`, so a name the extension does not map still finds the page. Not Advanced mode
 * (`/explore`), and not another tab.
 */
const videoAnalyticsPath =
  /^\/video\/[\w-]{11}\/analytics(?:\/tab-overview)?(?:\/period-([^/]+))?\/?$/

/** The YouTube channel id of the Studio page at `url`, or undefined off a channel's pages. */
export function channelIdOf(url: string): string | undefined {
  return channelPath.exec(new URL(url).pathname)?.[1]
}

/** True on the Studio dashboard, the only page with the latest video card. */
export function isDashboard(url: string): boolean {
  return dashboardPath.test(new URL(url).pathname)
}

/** True on the Content list's tabs of the channel's own uploads. */
export function isContentList(url: string): boolean {
  return contentListPath.test(new URL(url).pathname)
}

/** The video id in a Studio link such as `/video/<id>/analytics/...`, or undefined. */
export function videoIdOf(href: string): string | undefined {
  return videoPath.exec(new URL(href, 'https://studio.youtube.com').pathname)?.[1]
}

/** True on a video's analytics page, Overview tab. */
export function isVideoAnalytics(url: string): boolean {
  return videoAnalyticsPath.test(new URL(url).pathname)
}

/**
 * The name of the period a video's analytics page carries, `quarter` in `.../period-quarter`, or
 * undefined when the URL carries none. Read from the URL only, never from the page.
 */
export function analyticsPeriodOf(url: string): string | undefined {
  return videoAnalyticsPath.exec(new URL(url).pathname)?.[1]
}
