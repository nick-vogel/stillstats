import MarkdownIt from 'markdown-it'

// markdown-it's default preset, read from the published 15.0.3 dist on 2026-11-10: `html: false`
// escapes raw HTML instead of passing it through, `linkify: false` leaves a bare address as text,
// and `typographer: false` keeps `---` from becoming an em-dash, which no site page may carry. Each
// is set here as well, so a change to the preset's defaults cannot turn one on.
const markdown = new MarkdownIt('default', { html: false, linkify: false, typographer: false })

// Every link opens in a new tab, so the release page or "What's new" stays open behind it
// (creator-analytics#632). Markdown has no syntax for a target, and raw HTML stays escaped.
const renderToken = markdown.renderer.renderToken.bind(markdown.renderer)
markdown.renderer.rules.link_open = (tokens, index, options) => {
  const token = tokens[index]
  if (token) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener')
  }
  return renderToken(tokens, index, options)
}

/** A note's or a highlight's markdown body as HTML, at build time only. */
export function htmlOf(body: string): string {
  return markdown.render(body)
}
