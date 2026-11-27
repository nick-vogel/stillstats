// Proof for pre-PR review 1, finding on the OpenPanel referrer.
// Run from the repo root: node docs/reviews/creator-analytics-2/repro/openpanel-referrer.mjs
// Builds the web app's OpenPanel client the way apps/web/src/analytics.ts does, in a tab whose
// document.referrer is a same-origin detail-screen address (what a new tab opened from the detail
// screen's "Back to videos" link gets), then sends video_list_viewed and prints what leaves.
const referrer =
  'https://stillstats.com/app/videos/dQw4w9WgXcQ?channel=0b6f3c1e-2f1a-4c6e-9d0e-1a2b3c4d5e6f&window=first7'
const sent = []
globalThis.window = { location: { href: 'https://stillstats.com/app/' }, addEventListener() {} }
globalThis.document = {
  referrer,
  title: 'Stillstats',
  addEventListener() {},
  querySelectorAll: () => [],
}
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
globalThis.fetch = async (_url, init) => {
  sent.push(JSON.parse(init.body))
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
}
const { OpenPanel } = await import('../../../../apps/web/node_modules/@openpanel/web/dist/index.js')
const panel = new OpenPanel({ clientId: 'test', apiUrl: 'https://openpanel.example' })
await panel.track('video_list_viewed', {})
await new Promise((resolve) => setTimeout(resolve, 50))
const properties = sent.find((body) => body.type === 'track')?.payload?.properties ?? {}
console.log(JSON.stringify(properties, null, 2))
const leaked = JSON.stringify(properties).includes('dQw4w9WgXcQ')
console.log(leaked ? 'LEAK: the event carries the video id and the channel id' : 'no leak')
process.exit(leaked ? 1 : 0)
