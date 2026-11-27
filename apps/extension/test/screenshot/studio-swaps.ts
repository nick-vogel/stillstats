/// <reference lib="dom" />
// The swap of the creator's data on a saved Studio page for the sample channel's
// (creator-analytics#100). It runs in the page, from a script at the end of the page's body, so it
// is done before DOMContentLoaded, and the extension's content script, which runs once the page is
// idle, finds only the sample channel. It writes data into Studio's elements and leaves their
// layout as Studio drew it.
//
// The function is sent to the page as its source text, so it holds every helper it uses. It keeps
// what it found on the page before the swap in `window.__savedStudioData`, for the capture's check
// that none of it is left where a screenshot shows it.
import type { PageData } from './sample-studio.ts'

export interface SavedStudioData {
  /** The video ids and titles, and the channel's name, the saved page held. */
  ids: string[]
  titles: string[]
}

export function swapStudioPage(data: PageData): void {
  const ids = new Set<string>()
  const titles = new Set<string>()
  const videoIdsIn = (text: string) =>
    [...text.matchAll(/\/(?:video|vi|vi_webp)\/([\w-]{11})(?:[/?]|$)/g)].flatMap(([, id]) =>
      id ? [id] : [],
    )
  for (const element of document.querySelectorAll('[href], img[src]')) {
    for (const id of videoIdsIn(
      element.getAttribute('href') ?? element.getAttribute('src') ?? '',
    )) {
      ids.add(id)
    }
  }
  for (const element of document.querySelectorAll(
    'a#video-title, ytcd-entity-snapshot-item #title, #ranking-tooltip .link, #entity-name',
  )) {
    const text = element.textContent?.trim()
    if (text) titles.add(text)
  }
  for (const image of document.querySelectorAll('img[alt^="Video thumbnail: "]')) {
    titles.add((image.getAttribute('alt') ?? '').slice('Video thumbnail: '.length))
  }
  ;(window as unknown as { __savedStudioData: SavedStudioData }).__savedStudioData = {
    ids: [...ids],
    titles: [...titles],
  }

  const { channel } = data
  const text = (element: Element | null | undefined, value: string) => {
    if (element) element.textContent = value
  }
  /** Sets the element's own text and keeps its children, such as the icon beside a number. */
  const ownText = (element: Element | null | undefined, value: string) => {
    const node = [...(element?.childNodes ?? [])].find(
      (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
    )
    if (node) node.textContent = value
  }
  /** Every attribute in `root` naming `from` names `to` instead. */
  const renameIn = (root: ParentNode, from: string, to: string) => {
    for (const element of root.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (attribute.value.includes(from)) attribute.value = attribute.value.replaceAll(from, to)
      }
    }
  }
  const thumbnail = (image: Element | null, url: string, title: string) => {
    image?.setAttribute('src', url)
    image?.removeAttribute('srcset')
    image?.setAttribute('alt', `Video thumbnail: ${title}`)
  }

  // The channel, on every page: its id in Studio's links, its name in the navigation drawer, and
  // its avatar.
  renameIn(document, channel.savedChannelId, channel.channelId)
  for (const label of document.querySelectorAll('#entity-type')) {
    if (label.textContent?.trim() === 'Your channel') {
      const name = label.parentElement?.querySelector('#entity-name')
      if (name?.textContent) titles.add(name.textContent.trim())
      text(name, channel.channelName)
    }
  }
  for (const image of document.querySelectorAll('img')) {
    if (/^https:\/\/yt3\.(ggpht|googleusercontent)\.com\//.test(image.getAttribute('src') ?? '')) {
      image.setAttribute('src', channel.avatarUrl)
      image.removeAttribute('srcset')
      image.setAttribute('alt', channel.channelName)
    }
  }
  // A guard: a player's playback address carries the IP address the page was saved from. The
  // saved fixtures hold none now; a page saved again could.
  for (const video of document.querySelectorAll('video[src]')) video.removeAttribute('src')
  // The label tooltip of the drawer's channel link, "View channel on YouTube", which was open where
  // the pointer rested when the page was saved.
  for (const tooltip of document.querySelectorAll(
    'ytcp-paper-tooltip-placeholder[type="label"][style*="inset"]',
  )) {
    tooltip.setAttribute('hidden', '')
  }

  if (data.page === 'dashboard') {
    const card = document.querySelector('ytcd-entity-snapshot-item')
    if (!card) throw new Error('No latest video card')
    const { card: video } = data
    const savedId = videoIdsIn(
      card.querySelector('#go-to-video-analytics-button')?.closest('a')?.getAttribute('href') ?? '',
    )[0]
    if (savedId) renameIn(card, savedId, video.id)
    const image = card.querySelector('img[test-id="thumbnail"]')
    thumbnail(image, video.largeThumbnailUrl, video.title)
    text(card.querySelector('#title'), video.title)
    const metrics = card.querySelectorAll('.video-metrics .metric')
    for (const [index, value] of [video.views, video.comments, video.likes].entries()) {
      ownText(metrics[index], value)
    }
    text(card.querySelector('#metrics-table-title-collapsable'), video.since)
    text(card.querySelector('#table-ranking .table-value'), video.ranking)
    text(card.querySelector('#time-since-upload'), `${video.since}:`)
    for (const [index, row] of card.querySelectorAll('#ranking-tooltip .table .row').entries()) {
      const top = video.top[index]
      if (!top) {
        row.remove()
        continue
      }
      text(row.querySelector('.rank'), String(index + 1))
      const link = row.querySelector('a')
      link?.setAttribute('href', `/video/${top.id}/analytics/tab-overview/period-default`)
      link?.querySelector('img')?.setAttribute('src', top.thumbnailUrl)
      text(row.querySelector('.link'), top.title)
      text(row.querySelector('.video-value > div'), top.views)
      row.classList.toggle('highlighted', top.latest)
    }
    const values = card.querySelectorAll('#metrics-table > .table-row .metrics-value')
    for (const [index, value] of [
      video.views,
      video.clickThroughRate,
      video.averageViewDuration,
    ].entries()) {
      text(values[index], value)
    }
    card
      .querySelector('#view-comments-button button')
      ?.setAttribute('aria-label', `See comments (${video.comments})`)
  }

  if (data.page === 'content-list') {
    const rows = [...document.querySelectorAll('ytcp-video-row')]
    // One public, published row is the pattern for every row, so a row Studio drew as scheduled,
    // unlisted or under test is drawn as the public upload the sample has in its place.
    const pattern = rows.find(
      (row) =>
        row.querySelector('.tablecell-visibility .label-span')?.textContent?.trim() === 'Public' &&
        row.querySelector('.tablecell-date .cell-description')?.textContent?.trim() ===
          'Published' &&
        // Studio's dash for a row with no notices, an em-dash.
        row
          .querySelector('.tablecell-restrictions')
          ?.textContent?.includes(String.fromCodePoint(0x2014)),
    )
    if (!pattern) throw new Error('No public, published row to draw the sample rows from')
    const patternId = videoIdsIn(
      pattern.querySelector('a#video-title')?.getAttribute('href') ?? '',
    )[0]
    rows.forEach((row, index) => {
      const video = data.rows[index]
      if (!video || !patternId) throw new Error(`No sample video for row ${index + 1}`)
      const sample = pattern.cloneNode(true) as Element
      renameIn(sample, patternId, video.id)
      for (const labelled of sample.querySelectorAll('[aria-label^="Select "]')) {
        labelled.setAttribute('aria-label', `Select ${video.title}`)
      }
      thumbnail(sample.querySelector('img#img-with-fallback'), video.thumbnailUrl, video.title)
      text(sample.querySelector('ytcp-badge .label'), video.duration)
      const title = sample.querySelector('a#video-title')
      title?.setAttribute('aria-label', video.title)
      text(title?.querySelector('span'), video.title)
      text(sample.querySelector('.description'), video.description)
      const date = sample.querySelector('.tablecell-date')
      ownText(date, `${video.published} `)
      text(sample.querySelector('.tablecell-views'), video.views)
      text(sample.querySelector('.tablecell-revenue .revenue-container'), video.revenue)
      const comments = sample.querySelector('.tablecell-comments a')
      comments?.setAttribute(
        'aria-label',
        `Video has ${video.comments} comments. Video comments page`,
      )
      text(comments, video.comments)
      row.replaceWith(sample)
    })
  }

  if (data.page === 'video-analytics') {
    const { video } = data
    renameIn(document, data.savedVideoId, video.id)
    const drawer = document.querySelector('ytcp-navigation-drawer')
    thumbnail(
      drawer?.querySelector('img#img-with-fallback') ?? null,
      video.thumbnailUrl,
      video.title,
    )
    text(drawer?.querySelector('ytcp-badge .label'), video.duration)
    text(drawer?.querySelector('#entity-name'), video.title)
    text(document.querySelector('#picker-trigger .label-text'), data.period)
    text(document.querySelector('yta-personalized-overview-header h2#title'), data.headline)
    const tiles: [string, string][] = [
      ['EXTERNAL_VIEWS', data.views],
      ['EXTERNAL_WATCH_TIME', data.watchHours],
      ['SUBSCRIBERS_NET_CHANGE', data.subscribers],
      ['TOTAL_ESTIMATED_EARNINGS', data.revenue],
    ]
    for (const [tab, value] of tiles)
      text(document.querySelector(`#${tab}-tab #metric-total`), value)

    // The chart: Studio draws the period's days across 516 by 114 pixels, under four ticks.
    const chart = document.querySelector('yta-key-metric-card svg.aplos-chart')
    if (!chart) throw new Error('No key metric chart')
    const width = 516
    const height = 114
    const days = data.dailyViews
    const step = width / (days.length - 1)
    const most = Math.max(1, ...days) / 3
    const magnitude = 10 ** Math.floor(Math.log10(most))
    const tick =
      [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
        .map((each) => each * magnitude)
        .find((each) => each >= most) ?? most
    const y = (value: number) => height - (value * height) / (tick * 3)
    const forward = days.map((value, index) => `${index * step},${y(value)}`)
    const back = days.map((_, index) => `${index * step},${height}`).toReversed()
    const area = chart.querySelector('[series-id="MAIN_METRIC_SERIES_NAME_area"] path')
    area?.setAttribute('d', `M${forward.join('L')}L${back.join('L')}Z`)
    const line = `M${days.map((value, index) => `${Math.round(index * step)},${Math.round(y(value))}`).join('L')}`
    for (const path of chart.querySelectorAll('[series-id="MAIN_METRIC_SERIES_NAME"] path')) {
      path.setAttribute('d', line)
    }
    const numbers = new Intl.NumberFormat('en-US')
    const ticks = chart.querySelectorAll('g[transform="translate(516, 0)"] > g tspan')
    ticks.forEach((tspan, index) => {
      tspan.textContent = numbers.format(tick * (ticks.length - 1 - index))
    })
    for (const label of chart.querySelectorAll('g[transform="translate(0, 114)"] > g[transform]')) {
      const x = Number(/translate\(([\d.]+)/.exec(label.getAttribute('transform') ?? '')?.[1])
      const day = data.axisDays[Math.round(x / step)] ?? ''
      const full = label.querySelector('title')
      // Studio cuts the first and last day short, and gives the whole day as the title.
      if (full) full.textContent = day
      text(label.querySelector('tspan'), full ? `${day.slice(0, 5)}...` : day)
    }
  }
}

/** A script that runs `swapStudioPage` with `data`, for the end of the page's body. */
export function swapScriptOf(data: PageData): string {
  const json = JSON.stringify(data).replaceAll('<', '\\u003c')
  return `<script>(${swapStudioPage.toString()})(${json})</script>`
}
