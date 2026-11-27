import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { build, type Plugin } from 'vite'

const webDirectory = fileURLToPath(new URL('.', import.meta.url))
const entry = fileURLToPath(new URL('./src/theme-script.ts', import.meta.url))

/**
 * Loads the theme script (`src/theme-script.ts`) in the page's head, ahead of the stylesheet, so it
 * sets `data-theme` before the first paint. At build it bundles the script on its own, from the
 * same `theme.ts` the app imports, as one classic script (an IIFE, which runs as it is parsed, where
 * a module waits for the parse to end), and emits it under `assets/` with a content hash, so a
 * changed rule is never served stale. In the dev server it loads as a module, which runs after the
 * parse, so a dev load can draw System for a frame.
 */
export function themeScript(): Plugin {
  let base = '/'
  let command: 'build' | 'serve' = 'serve'
  let fileName = ''
  let code = ''
  return {
    name: 'theme-script',
    configResolved(config) {
      base = config.base
      command = config.command
    },
    async buildStart() {
      if (command !== 'build') return
      const output = await build({
        configFile: false,
        root: webDirectory,
        publicDir: false,
        logLevel: 'silent',
        build: {
          write: false,
          lib: { entry, name: 'theme', formats: ['iife'] },
        },
      })
      const [chunk] = (Array.isArray(output) ? output : [output]).flatMap((each) =>
        'output' in each ? each.output : [],
      )
      if (chunk?.type !== 'chunk') throw new Error('The theme script built no chunk.')
      code = chunk.code
      const hash = createHash('sha256').update(code).digest('base64url').slice(0, 8)
      fileName = `assets/theme-${hash}.js`
    },
    generateBundle() {
      if (command === 'build') this.emitFile({ type: 'asset', fileName, source: code })
    },
    // After Vite has written the stylesheet's link and the app's script into the head, so the
    // theme script goes ahead of both.
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (command !== 'build') {
          return [
            {
              tag: 'script',
              attrs: { type: 'module', src: `${base}src/theme-script.ts` },
              injectTo: 'head',
            },
          ]
        }
        const head = html.slice(0, html.indexOf('</head>'))
        const at = head.search(/<script\b|<link\b[^>]*\brel="stylesheet"/)
        if (at === -1) throw new Error('The page has no script and no stylesheet to go before.')
        const tag = `<script src="${base}${fileName}"></script>\n    `
        return `${html.slice(0, at)}${tag}${html.slice(at)}`
      },
    },
  }
}
