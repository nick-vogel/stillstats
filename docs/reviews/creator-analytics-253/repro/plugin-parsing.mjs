// Pre-PR review 1 of creator-analytics#253, findings 3 and 4. Runs the site build plugin's
// transformIndexHtml on edge-case heads and prints what each derives. Run from the repo root:
// node docs/reviews/creator-analytics-253/repro/plugin-parsing.mjs
const site = new URL('../../../../apps/site/', import.meta.url).pathname
const config = (await import(`${site}vite.config.ts`)).default
const plugins = Object.fromEntries(config.plugins.flat().map((plugin) => [plugin.name, plugin]))
const previews = plugins['page-previews']
const page = (head) => `<!doctype html><html><head>${head}</head><body></body></html>`
function run(label, head) {
  try {
    const result = previews.transformIndexHtml(page(head), { filename: `${site}index.html` })
    const derived = result.tags
      .filter((tag) => ['og:title', 'og:description'].includes(tag.attrs.property))
      .map((tag) => `${tag.attrs.property}=${JSON.stringify(tag.attrs.content)}`)
    console.log(label, '=>', derived.join(' | '))
  } catch (error) {
    console.log(label, '=> throws', error.constructor.name, error.message)
  }
}
run(
  'finding 3, named references',
  '<title>A&nbsp;B</title><meta name="description" content="It&rsquo;s fine &hellip; ok">',
)
run(
  'finding 4, data-name before the description',
  '<title>T</title><meta data-name="description" content="WRONG"><meta name="description" content="right">',
)
run(
  'finding 4, a title across lines',
  '<title>\n  Two\n  lines\n</title><meta name="description" content="x">',
)
run(
  'finding 4, a > in the description',
  '<title>T</title><meta name="description" content="a > b">',
)
run(
  'finding 4, a second description',
  '<title>T</title><meta name="description" content="first"><meta name="description" content="second">',
)
