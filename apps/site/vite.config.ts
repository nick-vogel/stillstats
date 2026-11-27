import { readdirSync, readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { productOrigin } from '@creator-analytics/api-types'
import { packageContentRoot, readReleaseContent } from '@creator-analytics/releases'
import { fontsDirectory as thumbnailPreviewFonts } from '@creator-analytics/thumbnail-preview/fonts'
import { contentSecurityPolicy, fonts } from '@creator-analytics/visual-system/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import { releasePages } from './release-pages.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

// The site test points this at fixture notes. A note that breaks a rule throws here, which fails
// the build.
const { releases } = readReleaseContent(process.env.RELEASE_CONTENT_ROOT || packageContentRoot)
const releasePagesPlugin = releasePages(root, releases)

// The folders that hold pages: the package root, and `tools/` for the tool pages (ADR 0021).
const pageFolders = ['', 'tools/']

// Every .html file in a page folder builds to a page the API serves at its clean path, so a new
// page ships without a change here. The release pages join them from the release notes.
const pages = [
  ...pageFolders.flatMap((folder) =>
    readdirSync(root + folder)
      .filter((file) => file.endsWith('.html'))
      .map((file) => root + folder + file),
  ),
  ...releasePagesPlugin.paths,
]

const includeDirective = /<!-- include (\S+) -->/g

/** Replaces each include directive with the named file, itself expanded. */
function expandIncludes(html: string): string {
  return html.replace(includeDirective, (_, path: string) =>
    // Whitespace between an included file's tags would read as a space in the page's text, so an
    // icon inside a link would open a gap before the punctuation after it.
    expandIncludes(
      readFileSync(root + path, 'utf8')
        .trim()
        .replace(/>\s+</g, '><'),
    ),
  )
}

/**
 * The page shell is one copy of each part: a page writes `<!-- include partials/footer.html -->`,
 * and the build puts the file there. A Lucide icon is included the same way, from `icons/`.
 */
function siteIncludes(): Plugin {
  return {
    name: 'site-includes',
    transformIndexHtml: { order: 'pre', handler: expandIncludes },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(`${root}partials/`) || file.startsWith(`${root}icons/`)) {
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}

const previewImagePath = '/og-image.png'

// The hero's screenshot in index.html.
const appScreenshotPath = '/app-screenshot.webp'

// Approved word for word on creator-analytics#253.
const previewImageAlt =
  'The Stillstats wordmark and the words "Calm analytics for YouTube creators." beside the channel screen, showing a sample channel\'s engaged views, watch hours and estimated revenue.'

/**
 * The path the API serves a page at, the same mapping as its static rewrite, or null for the
 * not-found page, which has no address of its own. A folder's index.html answers at the folder,
 * such as `/releases/`, and any other page at its path without `.html`.
 */
function cleanPathOf(filename: string): string | null {
  const page = relative(root, filename).replace(/\.html$/, '')
  if (page === '404') return null
  if (page === 'index') return '/'
  return page.endsWith('/index') ? `/${page.slice(0, -'index'.length)}` : `/${page}`
}

/** A page's canonical URL, from its clean path, for its canonical link and the sitemap alike. */
function canonicalUrlOf(path: string): string {
  return `${productOrigin}${path}`
}

const characterReferences: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
}

/**
 * Text with its HTML character references decoded, since Vite escapes a tag's attributes itself
 * and would escape an encoded `&` twice.
 */
function decodedOf(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
    (_, decimal?: string, hex?: string, name?: string) => {
      if (decimal !== undefined) return String.fromCodePoint(Number(decimal))
      if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16))
      return characterReferences[(name ?? '').toLowerCase()] ?? ''
    },
  )
}

function descriptionOf(html: string): string | undefined {
  const meta = [...html.matchAll(/<meta\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => /\bname="description"/.test(tag))
  const content = meta && /\bcontent="([^"]*)"/.exec(meta)?.[1]
  return content === undefined ? undefined : decodedOf(content)
}

/**
 * Every page but the not-found page gets its canonical URL and its link preview tags from its own
 * `<title>`, its meta description and its clean path, so a new page needs no change here. X reads
 * the `og:` title, description and image, and Stillstats has no X account to name in
 * `twitter:site`.
 */
function pagePreviews(): Plugin {
  return {
    name: 'page-previews',
    transformIndexHtml(html, { filename }) {
      const path = cleanPathOf(filename)
      if (path === null) return html
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]
      const description = descriptionOf(html)
      if (!title?.trim() || !description?.trim()) {
        throw new Error(
          `${basename(filename)} needs a <title> and a <meta name="description">: its canonical URL and preview tags come from them.`,
        )
      }
      const url = canonicalUrlOf(path)
      const tag = (name: string, attrs: Record<string, string>): HtmlTagDescriptor => ({
        tag: name,
        attrs,
        injectTo: 'head',
      })
      const property = (key: string, content: string) => tag('meta', { property: key, content })
      return {
        html,
        tags: [
          tag('link', { rel: 'canonical', href: url }),
          property('og:type', 'website'),
          property('og:site_name', 'Stillstats'),
          property('og:url', url),
          property('og:title', decodedOf(title)),
          property('og:description', description),
          property('og:image', urlOnOrigin(previewImagePath)),
          property('og:image:type', 'image/png'),
          property('og:image:width', '1200'),
          property('og:image:height', '630'),
          property('og:image:alt', previewImageAlt),
          tag('meta', { name: 'twitter:card', content: 'summary_large_image' }),
          tag('meta', { name: 'twitter:image:alt', content: previewImageAlt }),
        ],
      }
    },
  }
}

/**
 * A path as an absolute URL on the product origin. The WHATWG serializer percent-encodes what a
 * URL cannot hold as written, such as a space, and leaves an encoded URL as it is.
 */
function urlOnOrigin(path: string): string {
  return new URL(path, productOrigin).href
}

/**
 * The Studio extension's two store listings, Chrome Web Store first, as creator-analytics#100
 * published them. The homepage graph reads them here, and `index.html` links the same two listings
 * from the page, since markup must describe what a reader can see. The site test holds the page's
 * links equal to the graph's `installUrl`, in order (creator-analytics#478).
 */
const extensionStoreUrls = [
  'https://chromewebstore.google.com/detail/dmfiepibjgpmholeacigjgejjgohdnhm',
  'https://addons.mozilla.org/en-US/firefox/addon/stillstats/',
]

/**
 * The company that runs Stillstats, as every page's graph names it, so the homepage's and a tool
 * page's Organization cannot drift. A crawler reads one page's graph at a time, so each graph that
 * names it as a publisher holds the node itself.
 */
function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': urlOnOrigin('/#organization'),
    name: 'Stillstats',
    legalName: 'MIDLO WEB DESIGN, LLC',
    url: urlOnOrigin('/'),
  }
}

/**
 * The homepage's schema.org graph: Stillstats as a web application, the company that runs it and
 * its site (creator-analytics#271), and the Studio extension with its two store listings
 * (creator-analytics#290), which the homepage also shows and links (creator-analytics#478). It carries no `aggregateRating` and no `review`, though Google's
 * software app rich result needs one of them: a rating may come only from real reviews, so the
 * homepage goes without the rich result for now (creator-analytics#253).
 */
function homepageGraph(description: string) {
  const organization = urlOnOrigin('/#organization')
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      {
        '@type': 'WebSite',
        '@id': urlOnOrigin('/#website'),
        name: 'Stillstats',
        url: urlOnOrigin('/'),
        publisher: { '@id': organization },
      },
      {
        '@type': 'WebApplication',
        '@id': urlOnOrigin('/#application'),
        name: 'Stillstats',
        url: urlOnOrigin('/'),
        description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        image: urlOnOrigin(previewImagePath),
        screenshot: urlOnOrigin(appScreenshotPath),
        publisher: { '@id': organization },
        // The free tier. schema.org writes a price as text.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': urlOnOrigin('/#extension'),
        name: 'Stillstats',
        url: urlOnOrigin('/'),
        applicationCategory: 'BrowserApplication',
        operatingSystem: 'Chrome, Firefox',
        // schema.org's URL the app installs from, where it differs from the item's own URL.
        installUrl: extensionStoreUrls.map((url) => new URL(url).href),
        publisher: { '@id': organization },
        // The extension is free.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ],
  }
}

/** The tool's name, as the sidebar item and the footer link name it (creator-analytics#732). */
const thumbnailPreviewName = 'Thumbnail preview'

const thumbnailPreviewPath = '/tools/thumbnail-preview'

/**
 * The thumbnail preview tool page's schema.org graph: the tool as a free application that runs on
 * the web, and the company that publishes it (creator-analytics#793). `MultimediaApplication` is
 * the category nlvogel.com published the tool under, so search engines see no change of category.
 */
function toolPageGraph(description: string) {
  const organization = organizationNode()
  const url = canonicalUrlOf(thumbnailPreviewPath)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#application`,
        name: thumbnailPreviewName,
        url,
        description,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        // The tool is free. schema.org writes a price as text.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': organization['@id'] },
      },
    ],
  }
}

/** Each page that carries structured data, by its clean path, and the builder of its graph. */
const structuredDataGraphs: Record<string, (description: string) => object> = {
  '/': homepageGraph,
  [thumbnailPreviewPath]: toolPageGraph,
}

/**
 * Writes a page's structured data as one JSON-LD block, its description the page's own, on the
 * homepage and the tool page, and touches no other page. The content security policy does not
 * check the block: the HTML standard treats a script of a non-JavaScript type as a data block and
 * never runs it (creator-analytics#253).
 */
function structuredData(): Plugin {
  return {
    name: 'structured-data',
    transformIndexHtml(html, { filename }) {
      const graphOf = structuredDataGraphs[cleanPathOf(filename) ?? '']
      if (!graphOf) return html
      const description = descriptionOf(html)
      if (!description?.trim()) {
        throw new Error(
          `${basename(filename)} needs a <meta name="description">: its structured data's description comes from it.`,
        )
      }
      // Vite writes a tag's text as it is given, so a `</script>` in the description would end
      // the block. JSON reads `\u003c` back as `<`.
      const json = JSON.stringify(graphOf(description)).replaceAll('<', '\\u003c')
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: json,
            injectTo: 'head',
          },
        ],
      }
    },
  }
}

/**
 * Marks each link in the header's navigation to the page it sits on as the current page, in the
 * built HTML, so no script runs for it (ADR 0012): on the tool page, the navigation's two
 * "Thumbnail preview" links (creator-analytics#888). The wordmark and the footer's links stay as
 * they are. The not-found page has no address, so none of its links is current.
 */
function currentPageLinks(): Plugin {
  return {
    name: 'current-page-links',
    transformIndexHtml(html, { filename }) {
      const path = cleanPathOf(filename)
      if (path === null) return html
      return html.replace(/<header class="site-header">[\s\S]*?<\/header>/, (header) =>
        header.replace(/<nav\b[\s\S]*<\/nav>/, (nav) =>
          nav.replace(/<a\b([^>]*)>/g, (tag, attrs: string) =>
            attrs.includes(` href="${path}"`) ? `<a${attrs} aria-current="page">` : tag,
          ),
        ),
      )
    },
  }
}

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&apos;',
  '"': '&quot;',
}

/** Text escaped for an XML element, as sitemaps.org requires of every URL. */
function xmlEscaped(text: string): string {
  return text.replace(/[&<>'"]/g, (character) => xmlEntities[character] ?? character)
}

/**
 * The build writes `robots.txt` and `sitemap.xml` from the page list and the product origin, so a
 * new page joins the sitemap with no change here. robots.txt allows every crawler, /app and /api
 * included: Google has to crawl a page to see the `X-Robots-Tag: noindex` the API sets on those
 * (creator-analytics#253, #254), so a `Disallow` would keep them in results rather than out of them.
 */
function crawlerFiles(): Plugin {
  return {
    name: 'crawler-files',
    apply: 'build',
    generateBundle() {
      const urls = pages
        .map(cleanPathOf)
        .filter((path) => path !== null)
        .sort()
        .map(canonicalUrlOf)
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${productOrigin}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((url) => `  <url><loc>${xmlEscaped(url)}</loc></url>`),
          '</urlset>',
          '',
        ].join('\n'),
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    siteIncludes(),
    releasePagesPlugin.plugin,
    currentPageLinks(),
    pagePreviews(),
    structuredData(),
    crawlerFiles(),
    // The thumbnail preview tool's Roboto ships with its licence, as the visual system's fonts do.
    fonts({ directories: [thumbnailPreviewFonts] }),
    // A tool page carries the tool page's policy, which adds blob: to img-src (ADR 0021).
    contentSecurityPolicy({
      toolPage: (filename) => cleanPathOf(filename)?.startsWith('/tools/') ?? false,
    }),
  ],
  build: { rolldownOptions: { input: pages } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
