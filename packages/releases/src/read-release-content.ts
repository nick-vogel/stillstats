import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { htmlOf } from './markdown.ts'
import { compareVersions, isCalendarDate, isVersionOf, type Product } from './version.ts'

export interface Release {
  product: Product
  version: string
  /** The release day, `YYYY-MM-DD`. */
  date: string
  /** One line, the release page's description. */
  summary: string
  /** Whether the release removes something, which no rollback may go back past. */
  removes: boolean
  /** The names of the highlights it includes, as the note lists them. */
  highlights: string[]
  html: string
  /**
   * The note's markdown below the frontmatter, without the blank lines around it: the GitHub
   * release body. It stays out of every bundle, which serializes highlights only.
   */
  body: string
  path: string
}

export interface Highlight {
  name: string
  title: string
  /** The web app screen the highlight links to, a path under /app. */
  screen?: string
  html: string
  /** The version of the release note that lists it. */
  release: string
}

export interface ReleaseContent {
  /** Newest first. */
  releases: Release[]
  /** Newest release first, then by name. */
  highlights: Highlight[]
}

/**
 * The package's own folder, which holds `notes/` and `highlights/`. The content lives in the
 * package, not under `docs/`, because the image build context drops `docs/` and root markdown.
 */
export const packageContentRoot = fileURLToPath(new URL('..', import.meta.url))

class ReleaseContentError extends Error {
  constructor(file: string, problem: string) {
    super(`${file}: ${problem}`)
    this.name = 'ReleaseContentError'
  }
}

export function releasePagePath(version: string): string {
  return `/releases/${version}`
}

/** The newest app release in a list that is newest first, or undefined when there is none. */
export function newestAppRelease(releases: readonly Release[]): Release | undefined {
  return releases.find(({ product }) => product === 'app')
}

interface MarkdownFile {
  /** The path relative to the content root, with `/` between folders, for error messages. */
  file: string
  name: string
  fields: Record<string, unknown>
  body: string
}

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/

function markdownFilesIn(root: string, folder: string, recursive: boolean): MarkdownFile[] {
  const directory = join(root, folder)
  if (!existsSync(directory)) return []
  return readdirSync(directory, { recursive })
    .map(String)
    .filter((path) => path.endsWith('.md'))
    .sort()
    .map((path) => {
      const file = `${folder}/${path.split(sep).join('/')}`
      const text = readFileSync(join(directory, path), 'utf8')
      const parts = frontmatter.exec(text)
      if (!parts) throw new ReleaseContentError(file, 'needs YAML frontmatter between --- lines')
      let fields: unknown
      try {
        // An empty frontmatter parses to null, which reads as no fields.
        fields = parse(parts[1] ?? '') ?? {}
      } catch (error) {
        throw new ReleaseContentError(
          file,
          `its frontmatter is not YAML: ${(error as Error).message}`,
        )
      }
      if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
        throw new ReleaseContentError(file, 'its frontmatter must be a set of fields')
      }
      return {
        file,
        name: basename(path, '.md'),
        fields: fields as Record<string, unknown>,
        body: parts[2] ?? '',
      }
    })
}

function isOneLine(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !/[\r\n]/.test(value)
}

function isDay(value: unknown): value is string {
  const parts = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  return parts !== null && isCalendarDate(Number(parts[1]), Number(parts[2]), Number(parts[3]))
}

// No site page may carry an em-dash. The site test checks its fixture notes only, so the rule is
// held here for every committed note and highlight. Rendered HTML is checked, since markdown-it
// turns `&mdash;` and `&#8212;` into the character.
const emDash = '\u2014'

function refuseEmDash(file: string, field: string, text: string): void {
  if (text.includes(emDash)) {
    throw new ReleaseContentError(
      file,
      `${field} has an em-dash, which no page may carry; use a period, a comma or parentheses`,
    )
  }
}

// The page's content security policy blocks an inline style, which markdown-it writes to align a
// table's columns, and an image the site does not serve. The site test holds both rules over its
// fixture notes only, so they are held here too.
const inlineStyle = /<[^>]*\sstyle\s*=/
const siteOrigin = 'https://site.invalid'

function refuseBlockedMarkup(file: string, html: string): void {
  if (inlineStyle.test(html)) {
    throw new ReleaseContentError(
      file,
      "the body has an inline style, which the page's policy blocks; leave the table's columns unaligned",
    )
  }
  for (const [, src = ''] of html.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/g)) {
    if (!URL.canParse(src, siteOrigin) || new URL(src, siteOrigin).origin !== siteOrigin) {
      throw new ReleaseContentError(
        file,
        `the body has an image the site does not serve, ${src}, which the page's policy blocks`,
      )
    }
  }
}

function releaseOf({ file, name, fields, body }: MarkdownFile): Release {
  const { product, date, summary, highlights, removes } = fields
  if (product !== 'app' && product !== 'extension') {
    throw new ReleaseContentError(file, 'product must be "app" or "extension"')
  }
  if (!isVersionOf(product, name)) {
    const shape = product === 'app' ? 'CalVer YYYY.M.D or YYYY.M.D.N' : 'SemVer MAJOR.MINOR.PATCH'
    throw new ReleaseContentError(
      file,
      `"${name}" is not a valid ${product} version, which is ${shape} with no leading zero`,
    )
  }
  if (!isDay(date)) throw new ReleaseContentError(file, 'date must be a real day, YYYY-MM-DD')
  if (!isOneLine(summary)) throw new ReleaseContentError(file, 'summary must be one line of text')
  if (!Array.isArray(highlights) || !highlights.every(isOneLine)) {
    throw new ReleaseContentError(file, 'highlights must be a list of highlight names, or []')
  }
  // The "What's new" marker is an app version, so it could never mark an extension highlight seen.
  if (product === 'extension' && highlights.length > 0) {
    throw new ReleaseContentError(file, 'highlights must be [] on an extension note')
  }
  if (typeof removes !== 'boolean') {
    throw new ReleaseContentError(file, 'removes must be true or false')
  }
  const html = htmlOf(body)
  refuseEmDash(file, 'summary', summary)
  refuseEmDash(file, 'the body', html)
  refuseBlockedMarkup(file, html)
  return {
    product,
    version: name,
    date,
    summary,
    removes,
    highlights,
    html,
    body: body.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd(),
    path: releasePagePath(name),
  }
}

function highlightOf({ file, name, fields, body }: MarkdownFile): Omit<Highlight, 'release'> {
  const { title, screen } = fields
  if (!isOneLine(title)) throw new ReleaseContentError(file, 'title must be one line of text')
  if (screen !== undefined && (typeof screen !== 'string' || !/^\/app(?:\/|$)/.test(screen))) {
    throw new ReleaseContentError(file, 'screen must be a web app path under /app, or left out')
  }
  const html = htmlOf(body)
  refuseEmDash(file, 'title', title)
  refuseEmDash(file, 'the body', html)
  refuseBlockedMarkup(file, html)
  return { name, title, ...(screen === undefined ? {} : { screen }), html }
}

/** Newest first by day; on one day, the app before the extension, then newest version first. */
function newestFirst(a: Release, b: Release): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.product !== b.product) return a.product === 'app' ? -1 : 1
  return compareVersions(b.version, a.version)
}

/**
 * Reads and validates every release note under `notes/`, its subfolders included, and every
 * highlight in `highlights/`, at build time. A missing folder reads as empty. Any file that breaks
 * a rule throws, naming the file, so the build that called this fails.
 */
export function readReleaseContent(root: string = packageContentRoot): ReleaseContent {
  const notes = markdownFilesIn(root, 'notes', true)
  const releases = notes.map(releaseOf)
  const fileOf = new Map(releases.map((release, i) => [release, notes[i]?.file ?? '']))

  const filesByVersion = Map.groupBy(releases, ({ version }) => version)
  for (const [version, same] of filesByVersion) {
    if (same.length > 1) {
      const files = same.map((release) => fileOf.get(release)).join(' and ')
      throw new ReleaseContentError(files, `two notes for version ${version}`)
    }
  }

  const highlightFiles = new Map(
    markdownFilesIn(root, 'highlights', false).map((file) => [file.name, file]),
  )
  const listers = new Map<string, Release[]>()
  for (const release of releases) {
    for (const name of release.highlights) {
      if (!highlightFiles.has(name)) {
        throw new ReleaseContentError(
          fileOf.get(release) ?? '',
          `highlight "${name}" has no file highlights/${name}.md`,
        )
      }
      listers.set(name, [...(listers.get(name) ?? []), release])
    }
  }

  releases.sort(newestFirst)
  const order = new Map(releases.map((release, i) => [release.version, i]))
  const highlights: Highlight[] = []
  for (const [name, file] of highlightFiles) {
    const [release, ...others] = listers.get(name) ?? []
    if (others.length > 0) {
      const files = [release, ...others].map((each) => each && fileOf.get(each)).join(' and ')
      throw new ReleaseContentError(file.file, `listed by more than one note: ${files}`)
    }
    // A highlight merges with its feature, before any note lists it, and has no release until one
    // does, so it is checked but not returned.
    const checked = highlightOf(file)
    if (release) highlights.push({ ...checked, release: release.version })
  }
  highlights.sort(
    (a, b) =>
      (order.get(a.release) ?? 0) - (order.get(b.release) ?? 0) || (a.name < b.name ? -1 : 1),
  )
  return { releases, highlights }
}
