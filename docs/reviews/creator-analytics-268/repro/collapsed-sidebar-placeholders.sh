#!/bin/sh
# Creator-analytics issues 417, 463, 477, 509, 510 and 512: the placeholders' places against the text they hold, at
# every window width from 320px to 2560px in 1px steps, and at 3000px, beside the open 14rem
# sidebar and the collapsed 3rem one. It lays out the signed-in shell as App renders it with the
# built stylesheet in headless Chrome, Switzer loaded from dist/assets and no scrollbar taking
# width: from 48rem `main.app.app-signed-in > .signed-in-view > .signed-in-shell` with the sidebar's
# `data-slot="sidebar"` panel open (`data-state="expanded"`) or collapsed
# (`data-collapsible="icon"`) and no header, below 48rem the header and the sidebar's row of links.
# The page sits in an iframe whose width the script steps, each width the iframe's own viewport
# for the shell's media queries, so one Chrome launch lays out every width.
# In the screen it puts each place beside its landed text, with the real text and markup: the
# video head's title beside the 10rem thumbnail, sixteen titles of 48 to 58 characters, five of
# the channel's own and eleven in their style (the ones creator-analytics issue 326 measured);
# the countries, US states, cities, every format and gender notes in the Audience grid's eight
# cards, and each of the eight cards' headings, "Countries (engaged views)" to "Subscribers and
# non-subscribers (engaged views)", in Cabinet Grotesk as the h2 in a section sets it, with the
# subscriber split's figures and bar under its heading as SubscriberSplitFigures renders them; the charts' running total note and the delay note of September 30, the longest month's,
# and the revenue sources' other sources note under the numbers table;
# the launch chart's first rows note and running total note; and the paragraph a video Google has
# not processed answers with; and the empty texts of an Audience card and of the publish day top;
# and a video page's section headings, in Cabinet Grotesk as the h2 in a section sets it: the
# charts' "Engaged views and views", "Watch hours", "Estimated revenue" and "RPM", "Since publish"
# and "Audience retention" in the screen, and in the breakdowns' grid "Traffic sources (engaged
# views)" over its bars and "Subscribers and non-subscribers (engaged views)" over its figures and
# bar, as VideoDetailPlaceholder, TrafficSources and SubscriberSplitFigures render them.
# It prints, for each text, the lines it takes against the width of the box it wraps in, the
# container app.css's @container rules query: the screen (.signed-in-screen) for the screen's notes
# and its paragraphs and the video page's section headings outside the breakdowns, the head's text
# column for the title, the card's content box for the Audience notes, headings and empty text, and
# the breakdowns' column (.video-detail-breakdowns > .video-detail-section) for its two headings.
# A note's lines are its 15px text at line height 1.6 inside 16px of
# padding, a heading's the h2's 18px text at line height 1.05 with no padding. Each "N from Wpx (last M at Vpx)" is a step: the text takes N lines from a box W
# wide, and still M lines at V, the widest box measured short of W, so a breakpoint anywhere above
# V and at most W holds every width measured; the script names the roundest one in rem. Then each state and width where a place is not as
# tall as its landed text, marked DIFF; for the title, where the place does not hold the lines
# half of the sixteen titles fit in.
# Red: any DIFF line. Green: "no DIFF" with every width swept, open and collapsed.
# The built sheet names its fonts by the server path /app/assets/, so the script loads a copy of it
# with those urls pointed at dist/assets; the font line says whether Switzer and Cabinet Grotesk
# loaded, since a text measured in a fallback font is not a measurement.
# Run from the repo root: pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh
set -eu
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
assets="$PWD/apps/web/dist/assets"
css_src="$(ls "$assets"/index-*.css | head -1)"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
sed "s#url(/app/assets/#url(file://$assets/#g" "$css_src" > "$dir/index.css"

cat > "$dir/driver.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0}iframe{border:0;display:block;height:900px}</style></head><body><pre id="out"></pre>
<script>
const sheet = 'file://__DIR__/index.css'
const titles = [
  'Deploy Payload with No Cold Starts and No Surprise Bills',
  'Payload Local API: Query Your Data Without Fetch',
  'Payload Collections: Build Your First Collection',
  'maybe the code is the friends we made along the way',
  "the internet keeps breaking and there's nothing you can do",
  'Payload Setup: New or Existing Next.js Project in Minutes',
  'What you should know about Payload fields and hooks',
  'You were training AI while catching Pokemon all along',
  'Why London cab drivers have bigger brains than the rest',
  'Nothing You Paid For Is Permanent, and Here Is Why',
  'TanStack Start in 90 seconds, then the parts it skips',
  'Cloudflare wants to kill WordPress, and it might work',
  'How AI is Flattening Your Mind and What to Do About It',
  "OpenAI's AI escaped. Nobody noticed for three weeks.",
  'Cleaning Up After Claude Code on a Real Payload Project',
  'Should you still learn to code in a world full of AI?',
]
const text = {
  countries: "YouTube leaves out countries with few views, so the countries can add up to less than the channel's total.",
  states: 'YouTube leaves out states with few views, so the states can add up to less than the United States total.',
  cities: "YouTube leaves out cities with few views, so the cities can add up to less than the channel's total.",
  format: 'These numbers count every format.',
  gender: 'These shares count only viewers who are signed in to YouTube.',
  total: 'The running total adds the daily numbers, so its last point can differ from the totals above.',
  firstRows: 'The chart shows the first 10 videos on this page that have data.',
  launchTotal: 'The running total adds the daily numbers, so its last point can differ from the totals in the list.',
  otherSources: 'Other sources include channel memberships and Supers.',
  delay: 'YouTube has processed data up to September 30, 2026. New numbers usually take two to three days to appear.',
  notProcessed: 'YouTube has not processed this video yet. Its numbers usually appear two to three days after it goes live.',
  noNumbers: 'YouTube has no numbers for this window.',
  publishDayEmpty: 'YouTube has not processed a publish day for any video yet.',
}
// Each Audience card's heading, by its place's shape, in the screen's order.
const headings = {
  'countries-heading': 'Countries (engaged views)',
  'us-states-heading': 'US states (engaged views)',
  'cities-heading': 'Cities (engaged views)',
  'age-heading': 'Age (share of signed-in viewers)',
  'gender-heading': 'Gender (share of signed-in viewers)',
  'devices-heading': 'Devices (engaged views)',
  'operating-systems-heading': 'Operating systems (engaged views)',
  'subscribers-heading': 'Subscribers and non-subscribers (engaged views)',
}
// A video page's section headings outside the breakdowns, each in the markup its section renders
// it in: the charts' in a metric chart of the charts' section, the others first in a section.
// Their places are one line of the h2, .placeholder-heading.
const videoHeadings = {
  'engaged-views': 'Engaged views and views',
  'watch-hours': 'Watch hours',
  revenue: 'Estimated revenue',
  rpm: 'RPM',
  'since-publish': 'Since publish',
  retention: 'Audience retention',
}
const chartHeadings = ['engaged-views', 'watch-hours', 'revenue', 'rpm']
// Each pair: its name, the place's and the landed text's ids, the box it wraps in, and whether it
// is a heading, measured by the h2's line box rather than a note's. Two pairs of one name are one
// place's rule in app.css, so their widths make one set of steps.
const pairs = [
  ['countries', 'countries', 'card'], ['US states', 'states', 'card'], ['every format', 'states-format', 'card'],
  ['cities', 'cities', 'card'], ['every format', 'cities-format', 'card'], ['gender', 'gender', 'card'],
  ['running total', 'total', 'screen'], ['delay', 'delay', 'screen'], ['other sources', 'other-sources', 'screen'], ['first rows', 'first-rows', 'screen'],
  ['launch running total', 'launch-total', 'screen'], ['delay', 'launch-delay', 'screen'],
  ['awaiting paragraph', 'not-processed', 'screen', 'paragraph'],
  ['audience empty text', 'audience-empty-text', 'card', 'paragraph'],
  ['publish day empty text', 'publish-day-empty-text', 'screen', 'paragraph'],
  ...Object.keys(headings).map((id) => [id.replace(/-/g, ' '), id, 'card', 'heading']),
  ...Object.keys(videoHeadings).map((id) => ['video ' + videoHeadings[id], 'video-' + id, 'screen', 'heading']),
  ['video traffic sources heading', 'traffic-sources-heading', 'breakdown', 'heading'],
  ['video subscriber split heading', 'video-subscribers-heading', 'breakdown', 'heading'],
]

const card = 'rounded-[0.75rem] border border-border p-[1rem_1.25rem]'
const bars = '<ul class="bars">' + ['United States', 'India', 'Other'].map((name, at) => `<li><span>${name}</span><span class="bars-number">1,204 (41%)</span><svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none"><rect class="bar" width="${100 - at * 30}" height="1"/></svg></li>`).join('') + '</ul>'
const phBars = '<div class="placeholder-bar-row"><div class="placeholder placeholder-line"></div><div class="placeholder placeholder-bar"></div></div>'.repeat(3)
const place = (id, shape) => `<div id="ph-${id}" class="placeholder placeholder-${shape}" aria-hidden="true"></div>`
const note = (id, words) => `<p id="ln-${id}" class="note">${words}</p>`
const heading = (id) => `<h2 id="ln-${id}">${headings[id]}</h2>`
const phCard = (id, places) => `<div data-slot="card" class="${card}"><div class="video-detail-section">${place(id, id)}${phBars}${places}</div></div>`
const lnCard = (id, notes) => `<div data-slot="card" class="${card}"><section class="video-detail-section">${heading(id)}${bars}${notes}</section></div>`
// The subscriber split's card: its heading, two figures and bar, as AudiencePlaceholder and
// SubscriberSplitFigures render them.
const phSubscribers = `<div data-slot="card" class="${card}"><div class="video-detail-section">${place('subscribers-heading', 'subscribers-heading')}<div class="figures"><div class="placeholder placeholder-figure"></div><div class="placeholder placeholder-figure"></div></div><div class="placeholder placeholder-bar"></div></div></div>`
const lnSubscribers = `<div data-slot="card" class="${card}"><section class="video-detail-section">${heading('subscribers-heading')}<dl class="figures"><div><dt>Subscribers</dt><dd>1,204 (41%)</dd></div><div><dt>Non-subscribers</dt><dd>1,733 (59%)</dd></div></dl><svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none"><rect class="bar-rest" width="100" height="1"/><rect class="bar" width="41" height="1"/></svg></section></div>`
const audiencePlaces = `<div class="audience-grid" aria-busy="true">${phCard('countries-heading', place('countries', 'countries-note'))}${phCard('us-states-heading', place('states', 'us-states-note') + place('states-format', 'every-format-note'))}${phCard('cities-heading', place('cities', 'cities-note') + place('cities-format', 'every-format-note'))}${phCard('age-heading', '')}${phCard('gender-heading', place('gender', 'gender-note'))}${phCard('devices-heading', '')}${phCard('operating-systems-heading', '')}${phSubscribers}<div data-slot="card" class="${card}"><div class="video-detail-section"><div class="placeholder placeholder-countries-heading"></div>${place('audience-empty-text', 'audience-empty-text')}</div></div></div>`
const audienceLanded = `<div class="audience-grid">${lnCard('countries-heading', note('countries', text.countries))}${lnCard('us-states-heading', note('states', text.states) + note('states-format', text.format))}${lnCard('cities-heading', note('cities', text.cities) + note('cities-format', text.format))}${lnCard('age-heading', '')}${lnCard('gender-heading', note('gender', text.gender))}${lnCard('devices-heading', '')}${lnCard('operating-systems-heading', '')}${lnSubscribers}<div data-slot="card" class="${card}"><section class="video-detail-section"><h2>${headings['countries-heading']}</h2><p id="ln-audience-empty-text">${text.noNumbers}</p></section></div></div>`
const chartsPlaces = `<div class="placeholders"><div class="video-detail-section metric-charts"><div class="placeholder placeholder-axis"></div>${place('total', 'total-note')}${place('delay', 'note')}${place('other-sources', 'other-sources-note')}</div><div class="video-detail-section metric-charts"><div class="placeholder placeholder-axis"></div>${place('first-rows', 'first-rows-note')}${place('launch-total', 'launch-total-note')}${place('launch-delay', 'note')}</div>${place('not-processed', 'not-processed')}<div class="video-detail-section"><div class="placeholder placeholder-heading"></div>${place('publish-day-empty-text', 'publish-day-empty-text')}</div></div>`
const chartsLanded = `<section class="video-detail-section metric-charts"><div class="metric-charts-axis"><span>Sep 1</span><span>Sep 30</span></div>${note('total', text.total)}${note('delay', text.delay)}${note('other-sources', text.otherSources)}</section><section class="video-detail-section metric-charts launch-chart"><div class="metric-charts-axis"><span>Day 1</span><span>Day 30</span></div>${note('first-rows', text.firstRows)}${note('launch-total', text.launchTotal)}${note('launch-delay', text.delay)}</section><p id="ln-not-processed">${text.notProcessed}</p><section class="video-detail-section publish-day-top"><h2>Publish day</h2><p id="ln-publish-day-empty-text">${text.publishDayEmpty}</p></section>`
const videoSectionPlaces = `<div class="placeholders" aria-busy="true"><div class="video-detail-section metric-charts">${chartHeadings.map((id) => `<div class="metric-chart">${place('video-' + id, 'heading')}<div class="placeholder placeholder-chart"></div></div>`).join('')}</div>${Object.keys(videoHeadings).filter((id) => !chartHeadings.includes(id)).map((id) => `<div class="video-detail-section">${place('video-' + id, 'heading')}<div class="placeholder placeholder-line"></div></div>`).join('')}<div class="video-detail-breakdowns"><div class="video-detail-section">${place('traffic-sources-heading', 'heading')}${phBars}<div class="placeholder placeholder-line"></div></div><div class="video-detail-section">${place('video-subscribers-heading', 'video-subscribers-heading')}<div class="figures"><div class="placeholder placeholder-figure"></div><div class="placeholder placeholder-figure"></div></div><div class="placeholder placeholder-bar"></div><div class="placeholder placeholder-line"></div></div></div></div>`
const videoSectionsLanded = `<section class="video-detail-section metric-charts">${chartHeadings.map((id) => `<div class="metric-chart"><h2 id="ln-video-${id}">${videoHeadings[id]}</h2><div class="chart"></div></div>`).join('')}</section>${Object.keys(videoHeadings).filter((id) => !chartHeadings.includes(id)).map((id) => `<section class="video-detail-section"><h2 id="ln-video-${id}">${videoHeadings[id]}</h2><p class="note">Note.</p></section>`).join('')}<div class="video-detail-breakdowns"><section class="video-detail-section"><h2 id="ln-traffic-sources-heading">Traffic sources (engaged views)</h2>${bars}</section><section class="video-detail-section"><h2 id="ln-video-subscribers-heading">Subscribers and non-subscribers (engaged views)</h2><dl class="figures"><div><dt>Subscribers</dt><dd>1,204 (41%)</dd></div><div><dt>Non-subscribers</dt><dd>1,733 (59%)</dd></div></dl><svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none"><rect class="bar-rest" width="100" height="1"/><rect class="bar" width="41" height="1"/></svg></section></div>`
const headPlace = '<div class="video-detail-head"><div class="placeholder placeholder-thumbnail"></div><div id="head-column"><div id="ph-title" class="placeholder placeholder-heading"></div><div class="placeholder placeholder-line"></div></div></div>'
const headsLanded = titles.map((title, at) => `<div class="video-detail-head"><span class="thumbnail-frame video-detail-thumbnail"><span class="thumbnail thumbnail-empty" aria-hidden="true"></span></span><div><h1 id="title-${at}">${title}</h1><a href="https://www.youtube.com/watch?v=x">Watch on YouTube</a></div></div>`).join('')

function page(state) {
  const attrs = state === 'open' ? 'data-state="expanded" data-collapsible=""' : 'data-state="collapsed" data-collapsible="icon"'
  const links = '<nav aria-label="Channel screens"><ul data-slot="sidebar-menu" data-sidebar="menu"><li data-slot="sidebar-menu-item" data-sidebar="menu-item"><a data-slot="sidebar-menu-button" href="/app/"><svg width="16" height="16"></svg><span>Videos</span></a></li><li data-slot="sidebar-menu-item" data-sidebar="menu-item"><a data-slot="sidebar-menu-button" href="/app/audience"><svg width="16" height="16"></svg><span>Audience</span></a></li></ul></nav>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="${sheet}"><style>html{scrollbar-width:none}</style></head><body><div id="root"><main class="app app-signed-in"><header class="app-header"><a class="wordmark" href="/app/">stillstats</a></header><div class="signed-in-view"><div data-slot="sidebar-wrapper" class="signed-in-shell"><div data-slot="sidebar" ${attrs} class="sidebar">${links}</div><div class="signed-in-screen">${headPlace}${headsLanded}${audiencePlaces}${audienceLanded}${chartsPlaces}${chartsLanded}${videoSectionPlaces}${videoSectionsLanded}</div></div></div></main></div></body></html>`
}

const frame = document.createElement('iframe')
document.body.append(frame)
const load = (state) => new Promise((resolve) => { frame.onload = () => frame.contentDocument.fonts.ready.then(resolve); frame.srcdoc = page(state) })
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
const round = (n) => Math.round(n * 100) / 100
const linesOf = (element, line, padding = 0) => Math.round((element.getBoundingClientRect().height - padding) / line)

async function sweep(state, widths, samples, diffs) {
  await load(state)
  const doc = frame.contentDocument
  const q = (s) => doc.querySelector(s)
  const header = q('.app-header')
  for (const width of widths) {
    header.hidden = width >= 768
    frame.style.width = width + 'px'
    void frame.offsetWidth
    if (frame.contentWindow.innerWidth !== width) await nextFrame()
    if (frame.contentWindow.innerWidth !== width) throw new Error('the frame is not ' + width + 'px wide')
    const boxes = {
      screen: q('.signed-in-screen').getBoundingClientRect().width,
      column: q('#head-column').getBoundingClientRect().width,
    }
    // A card's content box, the width its note wraps in; the grid's columns can differ by a
    // fraction of a px, so each note's own card.
    const contentOf = (element) => {
      const style = getComputedStyle(element)
      return element.getBoundingClientRect().width - ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((sum, side) => sum + parseFloat(style[side]), 0)
    }
    for (const [name, id, box, kind] of pairs) {
      const text = q('#ln-' + id)
      const placed = q('#ph-' + id).getBoundingClientRect().height
      const landed = text.getBoundingClientRect().height
      const within = box === 'card' ? contentOf(text.closest('[data-slot="card"]')) : box === 'breakdown' ? text.closest('.video-detail-section').getBoundingClientRect().width : boxes[box]
      const paragraph = kind === 'paragraph'
      const line = kind === 'heading' ? 18 * 1.05 : paragraph ? 17 * 1.6 : 15 * 1.6
      samples.push([name, within, linesOf(text, line, kind === 'heading' || paragraph ? 0 : 16)])
      if (Math.abs(placed - landed) > 0.5) diffs.push(`${state} ${width}px ${box} ${round(within)}px: ${name} ${round(placed)}/${round(landed)} DIFF`)
    }
    const titleLines = titles.map((_, at) => linesOf(q('#title-' + at), 24 * 1.05)).sort((a, b) => a - b)
    const half = titleLines[titles.length / 2 - 1]
    samples.push(['head title, half of the sixteen', boxes.column, half])
    const placedTitle = linesOf(q('#ph-title'), 24 * 1.05)
    if (placedTitle !== half) diffs.push(`${state} ${width}px column ${round(boxes.column)}px: head title ${placedTitle}/${half} lines DIFF`)
    if (width === 2560 || width === 3000) diffs.push(`screen at ${state} ${width}px: ${round(boxes.screen)}px`)
  }
}

// The roundest rem above `last` and at most `from`: a whole px, else the fewest decimals. Chrome
// lays out in 64ths of a px and compares a container query's width at that grain, so a width
// written between two 64ths can act as the lower one: 16.49rem, 263.84px, matched a card's
// content box of 263.828125px on 2026-11-06. So the width must land above `last` and at most
// `from` whether it is taken down or to the nearest 64th.
function breakpoint(last, from) {
  for (const step of [1 / 16, 0.01, 0.001, 0.0001]) {
    for (let rem = Math.ceil((last / 16 + 1e-9) / step) * step; rem * 16 <= from + 1 / 64; rem += step) {
      const px = rem * 16 * 64
      if (Math.floor(px + 1e-6) / 64 > last && Math.round(px) / 64 <= from) return Number(rem.toFixed(4)) + 'rem'
    }
  }
  return 'none'
}

function steps(samples) {
  const byName = new Map()
  for (const [name, box, lines] of samples) {
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push([box, lines])
  }
  const out = []
  for (const [name, list] of byName) {
    list.sort((a, b) => a[0] - b[0] || b[1] - a[1])
    const runs = []
    for (const [box, lines] of list) {
      const last = runs.at(-1)
      if (last && last.lines === lines) last.to = box
      else runs.push({ lines, from: box, to: box, before: last ? last.to : null, beforeLines: last ? last.lines : null })
    }
    out.push(name + ': ' + runs.map((run) => run.before === null ? `${run.lines} from ${round(run.from)}px` : `${run.lines} from ${round(run.from)}px (last ${run.beforeLines} at ${round(run.before)}px): ${breakpoint(run.before, run.from)}`).join(', ') + ` (to ${round(runs.at(-1).to)}px)`)
  }
  return out
}

window.addEventListener('load', async () => {
  const out = document.getElementById('out')
  try {
    const widths = Array.from({ length: 2560 - 320 + 1 }, (_, at) => 320 + at).concat([3000])
    const samples = []
    const diffs = []
    await sweep('open', widths, samples, diffs)
    const statusOf = (family) => [...frame.contentDocument.fonts].filter((f) => f.family.replace(/["']/g, '') === family).map((f) => f.status).join(',')
    const fonts = statusOf('Switzer') + ' cabinet-grotesk=' + statusOf('Cabinet Grotesk')
    await sweep('collapsed', widths, samples, diffs)
    const bad = diffs.filter((line) => line.endsWith('DIFF'))
    out.textContent = ['font: switzer=' + fonts, 'swept ' + widths.length + ' widths, open and collapsed', ...steps(samples), ...diffs, bad.length ? bad.length + ' DIFF' : 'no DIFF', 'done'].join('\n')
  } catch (error) {
    out.textContent = 'error: ' + error.message + '\ndone'
  }
})
</script></body></html>
HTML
sed "s#__DIR__#$dir#g" "$dir/driver.html" > "$dir/run.html"

"$chrome" --headless=new --disable-gpu --allow-file-access-from-files --hide-scrollbars \
  --window-size=3100,1000 --virtual-time-budget=600000 --dump-dom "file://$dir/run.html" 2>/dev/null \
  | sed -n '/<pre id="out">/,/^done/p' | sed 's/.*<pre id="out">//; s#</pre>.*##; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g'
