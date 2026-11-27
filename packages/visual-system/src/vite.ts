import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import {
  contentSecurityPolicyOf,
  toolPageContentSecurityPolicyOf,
} from './content-security-policy.ts'
import { fontsDirectory, isFontshareFont } from './fontshare.ts'

/** Each `LICENSE-*.txt` in a folder of fonts, by the file name it ships under. */
function licencesIn(directory: URL): Map<string, URL> {
  return new Map(
    readdirSync(directory)
      .filter((file) => /^LICENSE-.+\.txt$/.test(file))
      .map((file) => [file, new URL(file, directory)]),
  )
}

// The package's source imports no Vite and no PostCSS (Vite is a dev dependency, for its tests),
// so each plugin states only the parts of their APIs it uses.
type FontRule = {
  source?: { input: { file?: string } }
  remove(): void
  walkDecls(property: string, visit: (declaration: FontDeclaration) => void): void
}
type FontDeclaration = { value: string; source?: { input: { file?: string } } }
type PostcssPlugin = {
  postcssPlugin: string
  OnceExit(root: { walkAtRules(name: string, visit: (rule: FontRule) => void): void }): void
}

type FontsPlugin = {
  name: string
  config(): { css: { postcss: { plugins: PostcssPlugin[] } } }
  configResolved(config: { base: string; logger: { warnOnce(message: string): void } }): void
  configureServer(server: {
    middlewares: {
      use(handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): unknown
    }
  }): void
  generateBundle(this: {
    emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array }): string
  }): void
}

/** Each file a declaration's url() names by a relative path, resolved against its stylesheet. */
function relativeFilesOf(declaration: FontDeclaration): string[] {
  const stylesheet = declaration.source?.input.file
  if (!stylesheet) return []
  return [...declaration.value.matchAll(/url\(\s*["']?(\.{1,2}\/[^"')?#]+)/g)].map(([, url = '']) =>
    resolve(dirname(stylesheet), url),
  )
}

/**
 * A PostCSS plugin that drops each @font-face with a font file that is absent and that
 * `mayBeAbsent` allows to be, so the page falls back to the next family in its font stack and asks
 * for no file that is not there. Cabinet Grotesk and Switzer are licensed for stillstats.com but
 * not for a public repository (creator-analytics#942), so a clone has no copy of them, while
 * Stillstats' own builds fetch them first (`pnpm fonts`). Any other absent file keeps its rule,
 * so the page asks for it and a missing committed font fails the tests that fetch every font.
 * It runs after Vite inlines each @import and before Vite resolves each url(), which leaves an
 * unresolved one in place for the browser to ask for at run time.
 */
export function withoutAbsentFonts(
  mayBeAbsent: (file: string) => boolean,
  onAbsent: (file: string) => void,
): PostcssPlugin {
  return {
    postcssPlugin: 'without-absent-fonts',
    OnceExit(root) {
      root.walkAtRules('font-face', (rule) => {
        const absent: string[] = []
        rule.walkDecls('src', (declaration) => {
          absent.push(
            ...relativeFilesOf(declaration).filter(
              (file) => mayBeAbsent(file) && !existsSync(file),
            ),
          )
        })
        if (absent.length === 0) return
        for (const file of absent) onAbsent(file)
        rule.remove()
      })
    },
  }
}

/**
 * The visual system's fonts in an app's build. It leaves out each @font-face of a Fontshare font
 * that is absent (`withoutAbsentFonts`), and it ships each font licence beside the app, at
 * <base>fonts/LICENSE-*.txt: the visual system's, and those in each of `directories`, for a
 * package that ships fonts of its own. The SIL OFL and the ITF FFL both want the licence to travel
 * with the fonts, and Vite emits only the hashed fonts the stylesheet names. Two licences of one
 * name would ship one over the other, so that throws.
 */
export function fonts(options: { directories?: URL[] } = {}): FontsPlugin {
  const licences = new Map<string, URL>()
  for (const directory of [fontsDirectory, ...(options.directories ?? [])]) {
    for (const [file, url] of licencesIn(directory)) {
      if (licences.has(file)) throw new Error(`Two font licences are named ${file}`)
      licences.set(file, url)
    }
  }
  let base = '/'
  let warnOnce = (message: string) => console.warn(message)
  return {
    name: 'fonts',
    config: () => ({
      css: {
        postcss: {
          plugins: [
            withoutAbsentFonts(isFontshareFont, (file) =>
              warnOnce(
                `${file} is absent, so the build leaves out its @font-face and the page uses the next font in the stack. Stillstats' own builds fetch it first with \`pnpm fonts\`.`,
              ),
            ),
          ],
        },
      },
    }),
    configResolved(config) {
      base = config.base
      warnOnce = (message) => config.logger.warnOnce(message)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const licence = [...licences].find(([file]) => req.url === `${base}fonts/${file}`)
        if (!licence) return next()
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end(readFileSync(licence[1]))
      })
    },
    generateBundle() {
      for (const [file, url] of licences) {
        this.emitFile({ type: 'asset', fileName: `fonts/${file}`, source: readFileSync(url) })
      }
    },
  }
}

type ContentSecurityPolicyPlugin = {
  name: string
  apply: 'build'
  configResolved(config: { env: Record<string, string | undefined> }): void
  transformIndexHtml(
    html: string,
    ctx: { filename: string },
  ): {
    tag: 'meta'
    attrs: Record<string, string>
    injectTo: 'head-prepend'
  }[]
}

/**
 * Writes the content security policy into every page the build writes. The build knows the
 * OpenPanel and GlitchTip hosts, where the API serving the page does not. Vite's resolved `env`
 * holds the same VITE_ values, the process's included, that `loadEnv` would return. The dev
 * server's injected styles, and in the web app React's inline preamble, break the policy, so the
 * dev server goes without it. A page `toolPage` picks out by its source file carries the tool
 * page's policy (ADR 0021); every other page carries the base.
 */
export function contentSecurityPolicy(
  options: { toolPage?: (filename: string) => boolean } = {},
): ContentSecurityPolicyPlugin {
  const { toolPage = () => false } = options
  let policy = ''
  let toolPagePolicy = ''
  return {
    name: 'content-security-policy',
    apply: 'build',
    configResolved({ env }) {
      const hosts = {
        openPanelApiUrl: env.VITE_OPENPANEL_API_URL,
        glitchtipDsn: env.VITE_GLITCHTIP_DSN,
      }
      policy = contentSecurityPolicyOf(hosts)
      toolPagePolicy = toolPageContentSecurityPolicyOf(hosts)
    },
    transformIndexHtml: (_html, { filename }) => [
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: toolPage(filename) ? toolPagePolicy : policy,
        },
        injectTo: 'head-prepend',
      },
    ],
  }
}
