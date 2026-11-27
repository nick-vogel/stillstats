import { readdir, readFile } from 'node:fs/promises'
import { type Colour, declarationsIn } from './colour.ts'

export {
  avoidedColoursNear,
  type Colour,
  coloursIn,
  declarationsIn,
  isWarmTinted,
} from './colour.ts'

/** Every font file a stylesheet's url() names, once each, quoted or not. */
export function fontUrlsIn(css: string): string[] {
  return [
    ...new Set([...css.matchAll(/url\(\s*["']?([^"')]+\.woff2)/g)].map(([, url = '']) => url)),
  ]
}

/** The status and content type each url answers with, resolved against `origin`. */
export async function responsesTo(
  origin: string,
  urls: string[],
): Promise<{ url: string; status: number; type: string | null }[]> {
  return Promise.all(
    urls.map(async (url) => {
      const response = await fetch(new URL(url, origin))
      await response.body?.cancel()
      return { url, status: response.status, type: response.headers.get('content-type') }
    }),
  )
}

const backgroundProperty = /^(?:--bg[\w-]*|background(?:-color|-image)?)$/

/** The colours a stylesheet's --bg* tokens and background declarations write. */
export function backgroundColoursIn(css: string): Colour[] {
  return declarationsIn(css)
    .filter(({ property }) => backgroundProperty.test(property))
    .flatMap(({ colours }) => colours)
}

const comment = /\/\*[\s\S]*?\*\//g

const mediaBlock = /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g

const containerBlock = /@container([^{]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g

/**
 * Each innermost rule of a stylesheet: its selector, the declarations between its braces, the
 * condition of the @media block it sits in, and the name and condition of the @container block it
 * sits in, each null outside one.
 */
export function rulesIn(
  css: string,
): { selector: string; body: string; media: string | null; container: string | null }[] {
  const uncommented = css.replace(comment, '')
  const innermost = (text: string, media: string | null, container: string | null) =>
    [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = '', body = '']) => ({
      selector: selector.trim(),
      body,
      media,
      container,
    }))
  return [
    ...innermost(uncommented.replace(mediaBlock, '').replace(containerBlock, ''), null, null),
    ...[...uncommented.matchAll(mediaBlock)].flatMap(([, media = '', block = '']) =>
      innermost(block, media.trim(), null),
    ),
    ...[...uncommented.matchAll(containerBlock)].flatMap(([, container = '', block = '']) =>
      innermost(block, null, container.trim()),
    ),
  ]
}

/**
 * The value the last rule naming `selector` in its list gives `property`, in the @media block of
 * `media` or, by default, outside any, never inside a @container block, or undefined.
 */
export function valueIn(
  css: string,
  selector: string,
  property: string,
  media: string | null = null,
): string | undefined {
  return rulesIn(css)
    .filter((rule) => rule.media === media && rule.container === null)
    .filter((rule) => rule.selector.split(',').some((listed) => listed.trim() === selector))
    .flatMap(({ body }) => body.split(';'))
    .map((declaration) => declaration.split(':').map((part) => part.trim()))
    .filter(([name]) => name === property)
    .map(([, value]) => value)
    .at(-1)
}

// The build unquotes an attribute value, `[data-theme=dark]`, and drops the spaces in a media
// condition, `(prefers-color-scheme:dark)`, so both forms read as one.
const unquoted = (selector: string) => selector.replace(/=\s*(["'])([^"']*)\1\s*\]/g, '=$2]')
const unspaced = (media: string) => media.replace(/\s+/g, ' ').replace(/\s*([:()])\s*/g, '$1')

// Lightning CSS, the build's minifier, writes these beside every color-scheme; they are no token
// of the visual system.
const isLightningCssVariable = (property: string) => property.startsWith('--lightningcss-')

const systemDark = '(prefers-color-scheme:dark)'

/** Each declaration of a rule body, by property, the later one winning. */
function declarationsOf(bodies: string[]): Record<string, string> {
  const pairs = bodies
    .flatMap((body) => body.split(';'))
    .filter((declaration) => declaration.includes(':'))
    .map((declaration) => {
      const colon = declaration.indexOf(':')
      return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const
    })
  return Object.fromEntries(pairs)
}

/** The bodies of the rules whose selector is `selector`, in the @media block of `media` or none. */
function bodiesOf(css: string, selector: string, media: string | null): string[] {
  return rulesIn(css)
    .filter((rule) => rule.container === null)
    .filter((rule) => (rule.media === null ? null : unspaced(rule.media)) === media)
    .filter((rule) => unquoted(rule.selector) === selector)
    .map(({ body }) => body)
}

function themeDeclarations(bodies: string[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(declarationsOf(bodies)).filter(
      ([property]) => property !== 'color-scheme' && !isLightningCssVariable(property),
    ),
  )
}

/**
 * The declarations of each theme block, by property, without color-scheme: `light` under
 * `data-theme="light"`, `dark` under `data-theme="dark"`, and `systemDark` on a root without
 * `data-theme="light"` under the system's dark mode.
 */
export function themeBlocksIn(css: string): {
  light: Record<string, string>
  dark: Record<string, string>
  systemDark: Record<string, string>
} {
  return {
    light: themeDeclarations(bodiesOf(css, ':root[data-theme=light]', null)),
    dark: themeDeclarations(bodiesOf(css, ':root[data-theme=dark]', null)),
    systemDark: themeDeclarations(bodiesOf(css, ':root:not([data-theme=light])', systemDark)),
  }
}

/** The color-scheme of a root with no data-theme, with `data-theme="light"` and with "dark". */
export function colourSchemesIn(css: string): {
  none: string | undefined
  light: string | undefined
  dark: string | undefined
} {
  const scheme = (selector: string) => declarationsOf(bodiesOf(css, selector, null))['color-scheme']
  return {
    none: scheme(':root'),
    light: scheme(':root[data-theme=light]'),
    dark: scheme(':root[data-theme=dark]'),
  }
}

/**
 * Each rule outside @container that declares one of `properties`: its selector, unquoted, and the
 * condition of the @media block it sits in, unspaced, or null outside one.
 */
export function rulesDeclaringIn(
  css: string,
  properties: string[],
): { selector: string; media: string | null }[] {
  return rulesIn(css)
    .filter((rule) => rule.container === null)
    .filter(({ body }) => Object.keys(declarationsOf([body])).some((p) => properties.includes(p)))
    .map(({ selector, media }) => ({
      selector: unquoted(selector),
      media: media === null ? null : unspaced(media),
    }))
}

const tokenNames = (declarations: Record<string, string>) =>
  Object.keys(declarations).filter((property) => property.startsWith('--'))

/** The custom properties the :root block outside any media query declares. */
export function lightTokensIn(css: string): string[] {
  return tokenNames(declarationsOf(bodiesOf(css, ':root', null))).filter(
    (property) => !isLightningCssVariable(property),
  )
}

/** The custom properties the two dark blocks declare, once each. */
export function darkTokensIn(css: string): string[] {
  const { dark, systemDark } = themeBlocksIn(css)
  return [...new Set([...tokenNames(dark), ...tokenNames(systemDark)])]
}

/**
 * The selector of the web app's print block, which forces the light tokens onto a printed page.
 * Three :root pseudo-classes outrank both dark blocks, each of two, wherever the block sits.
 */
export const printThemeSelector = ':root:root:root'

/** The print block's declarations, by property, color-scheme included. */
export function printThemeBlockIn(css: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(declarationsOf(bodiesOf(css, printThemeSelector, 'print'))).filter(
      ([property]) => !isLightningCssVariable(property),
    ),
  )
}

/** The value the :root block outside any media query gives each of `tokens`. */
export function lightValuesIn(css: string, tokens: string[]): Record<string, string | undefined> {
  const root = declarationsOf(bodiesOf(css, ':root', null))
  return Object.fromEntries(tokens.map((token) => [token, root[token]]))
}

/** A stylesheet without its @import rules, so a rule reads what the sheet itself writes. */
export function withoutImports(css: string): string {
  return css.replace(/@import\b[^;]*;/g, '')
}

/** The visual system's stylesheet as written. */
export async function visualSystemSheet(): Promise<string> {
  return readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
}

const fontsDirectory = new URL('../fonts/', import.meta.url)

/**
 * Every file in a fonts directory, the visual system's by default, that is not a font, with its
 * text. Each one is a licence the fonts ship under. A hidden file, such as the .DS_Store macOS
 * writes, is none.
 */
export async function fontLicenceFiles(
  directory: URL = fontsDirectory,
): Promise<{ name: string; text: string }[]> {
  const names = (await readdir(directory)).filter(
    (name) => !name.endsWith('.woff2') && !name.startsWith('.'),
  )
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: await readFile(new URL(name, directory), 'utf8'),
    })),
  )
}
