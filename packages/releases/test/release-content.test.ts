// Limits: these tests read fixture folders written to a temporary directory, never the package's
// own notes/ and highlights/, so they hold the rules and not the content Nick commits. The site
// test builds the real site from the committed fixture root and holds every page rule over it.
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  newestAppRelease,
  packageContentRoot,
  readReleaseContent,
  releasePagePath,
} from '../src/index.ts'

/** A content root holding each file at its path, relative to the root. */
async function contentRootWith(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'release-content-'))
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  return root
}

const emDash = '\u2014'

/** A table whose columns markdown-it aligns with a style attribute on every cell. */
const alignedTable = '| a | b |\n|:-:|--:|\n| 1 | 2 |'

type Fields = Record<string, string | boolean | string[] | undefined>

/** A markdown file with the fields as YAML frontmatter; a field set to undefined is left out. */
function markdownWith(fields: Fields, body = 'A short body.'): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`
}

function appNote(fields: Fields = {}, body?: string): string {
  return markdownWith(
    {
      product: 'app',
      date: '2026-11-09',
      summary: 'A fix.',
      highlights: [],
      removes: false,
      ...fields,
    },
    body,
  )
}

function extensionNote(fields: Fields = {}, body?: string): string {
  return appNote({ product: 'extension', ...fields }, body)
}

function highlight(fields: Fields = {}, body?: string): string {
  return markdownWith({ title: 'A feature', ...fields }, body)
}

async function failureOf(files: Record<string, string>): Promise<string> {
  const root = await contentRootWith(files)
  try {
    readReleaseContent(root)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('readReleaseContent accepted the content')
}

describe('a valid set of release notes and highlights', () => {
  test('releases come newest first, a same-day .1 release before the release it follows', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ date: '2026-11-09' }),
      'notes/2026.11.9.1.md': appNote({ date: '2026-11-09' }),
      'notes/2026.11.10.md': appNote({ date: '2026-11-10' }),
      'notes/2026.10.30.md': appNote({ date: '2026-10-30' }),
    })

    expect(readReleaseContent(root).releases.map(({ version }) => version)).toEqual([
      '2026.11.10',
      '2026.11.9.1',
      '2026.11.9',
      '2026.10.30',
    ])
  })

  test('app versions compare part by part as numbers, not as text', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.2.md': appNote(),
      'notes/2026.11.9.10.md': appNote(),
      'notes/2026.11.9.md': appNote(),
    })

    expect(readReleaseContent(root).releases.map(({ version }) => version)).toEqual([
      '2026.11.9.10',
      '2026.11.9.2',
      '2026.11.9',
    ])
  })

  test('app and extension notes share one list by date, the app note first on the same day', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ date: '2026-11-09' }),
      'notes/1.1.0.md': extensionNote({ date: '2026-11-09' }),
      'notes/1.2.0.md': extensionNote({ date: '2026-11-10' }),
      'notes/1.0.10.md': extensionNote({ date: '2026-11-01' }),
      'notes/1.0.9.md': extensionNote({ date: '2026-11-01' }),
    })

    expect(
      readReleaseContent(root).releases.map(({ product, version }) => `${product} ${version}`),
    ).toEqual([
      'extension 1.2.0',
      'app 2026.11.9',
      'extension 1.1.0',
      'extension 1.0.10',
      'extension 1.0.9',
    ])
  })

  test('a release carries its frontmatter, its page path, and its body as HTML and as the markdown below the frontmatter', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote(
        { date: '2026-11-09', summary: 'Channel picker.', highlights: ['picker'], removes: true },
        '## What changed\n\nThe **picker** is in.',
      ),
      'highlights/picker.md': highlight(),
    })

    expect(readReleaseContent(root).releases).toEqual([
      {
        product: 'app',
        version: '2026.11.9',
        date: '2026-11-09',
        summary: 'Channel picker.',
        removes: true,
        highlights: ['picker'],
        html: '<h2>What changed</h2>\n<p>The <strong>picker</strong> is in.</p>\n',
        body: '## What changed\n\nThe **picker** is in.',
        path: '/releases/2026.11.9',
      },
    ])
  })

  test('a highlight carries its title, its screen, its body as HTML and the version of the note that lists it', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ highlights: ['picker'] }),
      'highlights/picker.md': highlight(
        { title: 'Pick a channel', screen: '/app/channels' },
        'Pick *one*.',
      ),
    })

    expect(readReleaseContent(root).highlights).toEqual([
      {
        name: 'picker',
        title: 'Pick a channel',
        screen: '/app/channels',
        html: '<p>Pick <em>one</em>.</p>\n',
        release: '2026.11.9',
      },
    ])
  })

  test('highlights come newest release first, then by name within a release', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ highlights: ['older'] }),
      'notes/2026.11.10.md': appNote({ date: '2026-11-10', highlights: ['zebra', 'apple'] }),
      'highlights/older.md': highlight(),
      'highlights/zebra.md': highlight(),
      'highlights/apple.md': highlight(),
    })

    expect(readReleaseContent(root).highlights.map(({ name }) => name)).toEqual([
      'apple',
      'zebra',
      'older',
    ])
  })

  test('a highlight no note lists yet is not returned', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote(),
      'highlights/unreleased.md': highlight(),
    })

    expect(readReleaseContent(root).highlights).toEqual([])
  })

  test('a content root with no notes and no highlights folder reads as empty', async () => {
    const root = await contentRootWith({})

    expect(readReleaseContent(root)).toEqual({ releases: [], highlights: [] })
  })

  test('the newest app release skips a newer extension release', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ date: '2026-11-09' }),
      'notes/2026.11.9.1.md': appNote({ date: '2026-11-09' }),
      'notes/1.0.0.md': extensionNote({ date: '2026-11-10' }),
    })

    expect(newestAppRelease(readReleaseContent(root).releases)?.version).toBe('2026.11.9.1')
    expect(newestAppRelease([])).toBeUndefined()
  })

  // The image build context drops docs/ and root markdown, so the notes must live in the package.
  test("the default content root is the package's own folder", async () => {
    const manifest = JSON.parse(await readFile(join(packageContentRoot, 'package.json'), 'utf8'))

    expect(manifest.name).toBe('@creator-analytics/releases')
  })

  test("a release page's path is /releases/ and the version", () => {
    expect(releasePagePath('2026.11.9.1')).toBe('/releases/2026.11.9.1')
  })
})

describe('the markdown', () => {
  test('raw HTML in a note or a highlight comes out escaped, never as markup', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ highlights: ['picker'] }, '<script>alert(1)</script>'),
      'highlights/picker.md': highlight({}, '<img src=x onerror=alert(1)>'),
    })
    const { releases, highlights } = readReleaseContent(root)
    const html = `${releases[0]?.html}${highlights[0]?.html}`

    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toMatch(/<script|<img/)
  })

  // The site may carry no em-dash, and the typographer would write one for `---`.
  test('three hyphens in a sentence stay three hyphens', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({}, 'Faster --- and calmer.'),
    })

    expect(readReleaseContent(root).releases[0]?.html).toBe('<p>Faster --- and calmer.</p>\n')
  })

  test('a link in a note or a highlight opens in a new tab', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({ highlights: ['picker'] }, 'Read the [policy](/privacy).'),
      'highlights/picker.md': highlight({}, 'See [the guide](https://example.com/guide).'),
    })
    const { releases, highlights } = readReleaseContent(root)

    expect(releases[0]?.html).toBe(
      '<p>Read the <a href="/privacy" target="_blank" rel="noopener">policy</a>.</p>\n',
    )
    expect(highlights[0]?.html).toBe(
      '<p>See <a href="https://example.com/guide" target="_blank" rel="noopener">the guide</a>.</p>\n',
    )
  })

  test('a bare address stays text, not a link', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote({}, 'See https://example.com.'),
    })

    expect(readReleaseContent(root).releases[0]?.html).not.toContain('<a')
  })

  test('a table with no alignment and an image the site serves build', async () => {
    const root = await contentRootWith({
      'notes/2026.11.9.md': appNote(
        {},
        '| a | b |\n|---|---|\n| 1 | 2 |\n\n![A chart](/chart.png)',
      ),
    })
    const { html } = readReleaseContent(root).releases[0] ?? { html: '' }

    expect(html).toContain('<td>1</td>')
    expect(html).toContain('<img src="/chart.png"')
  })
})

describe('a release note that fails the build names its file', () => {
  test.each([
    ['a CalVer name with a leading zero', 'notes/2026.11.09.md', appNote()],
    ['a CalVer name that is no calendar date', 'notes/2026.2.30.md', appNote()],
    ['a CalVer name with a month past 12', 'notes/2026.13.1.md', appNote()],
    ['a same-day release numbered 0', 'notes/2026.11.9.0.md', appNote()],
    ['an app note named as SemVer', 'notes/1.0.0.md', appNote()],
    [
      'an extension note named as CalVer with a fourth part',
      'notes/2026.11.9.1.md',
      extensionNote(),
    ],
    ['an extension note with a leading zero', 'notes/1.01.0.md', extensionNote()],
    ['a name that is no version at all', 'notes/channel-picker.md', appNote()],
  ])('%s', async (_, path, text) => {
    expect(await failureOf({ [path]: text })).toMatch(new RegExp(`^${escaped(path)}: .*version`))
  })

  test.each([
    ['product', { product: undefined }],
    ['product', { product: 'web' }],
    ['date', { date: undefined }],
    ['date', { date: '9 November 2026' }],
    ['date', { date: '2026-02-30' }],
    ['summary', { summary: undefined }],
    ['summary', { summary: '  ' }],
    ['summary', { summary: 'One line.\nTwo lines.' }],
    ['highlights', { highlights: undefined }],
    ['highlights', { highlights: 'picker' }],
    ['removes', { removes: undefined }],
    ['removes', { removes: 'no' }],
  ])('a missing or malformed %s: %j', async (field, fields) => {
    expect(await failureOf({ 'notes/2026.11.9.md': appNote(fields) })).toMatch(
      new RegExp(`^notes/2026\\.11\\.9\\.md: .*\\b${field}\\b`),
    )
  })

  test('a note with no frontmatter', async () => {
    expect(await failureOf({ 'notes/2026.11.9.md': 'Just a body.\n' })).toMatch(
      /^notes\/2026\.11\.9\.md: .*frontmatter/,
    )
  })

  test('a note that lists a highlight with no file', async () => {
    expect(await failureOf({ 'notes/2026.11.9.md': appNote({ highlights: ['picker'] }) })).toMatch(
      /^notes\/2026\.11\.9\.md: .*"picker".*highlights\/picker\.md/,
    )
  })

  test('a highlight listed by two notes names both notes', async () => {
    const message = await failureOf({
      'notes/2026.11.9.md': appNote({ highlights: ['picker'] }),
      'notes/2026.11.10.md': appNote({ date: '2026-11-10', highlights: ['picker'] }),
      'highlights/picker.md': highlight(),
    })

    expect(message).toMatch(/^highlights\/picker\.md: /)
    expect(message).toContain('notes/2026.11.9.md')
    expect(message).toContain('notes/2026.11.10.md')
  })

  test('two notes for one version name both files', async () => {
    const message = await failureOf({
      'notes/2026.11.9.md': appNote(),
      'notes/2026/2026.11.9.md': appNote(),
    })

    expect(message).toContain('notes/2026.11.9.md')
    expect(message).toContain('notes/2026/2026.11.9.md')
  })

  // No page may carry an em-dash, and the site test holds that rule over the fixture notes only, so
  // the package refuses one in every committed note. The entities render to the character.
  test.each([
    ['its summary', appNote({ summary: `Faster${emDash}calmer.` })],
    ['its body', appNote({}, `Faster${emDash}calmer.`)],
    ['its body, as a named entity', appNote({}, 'Faster&mdash;calmer.')],
    ['its body, as a numeric entity', appNote({}, 'Faster&#8212;calmer.')],
  ])('a note with an em-dash in %s', async (_, text) => {
    expect(await failureOf({ 'notes/2026.11.9.md': text })).toMatch(
      /^notes\/2026\.11\.9\.md: .*em-dash/,
    )
  })

  // The page's policy blocks an inline style and an image from another origin, and the site test
  // holds both rules over the fixture notes only.
  test.each([
    ['an aligned table', alignedTable, /inline style/],
    ['an image from another origin', '![A chart](https://example.com/chart.png)', /image/],
    ['an image from a protocol-relative address', '![A chart](//example.com/chart.png)', /image/],
    ['an image as a data URL', '![A dot](data:image/png;base64,iVBORw0KGgo=)', /image/],
  ])('a note whose body holds %s', async (_, body, problem) => {
    const message = await failureOf({ 'notes/2026.11.9.md': appNote({}, body) })

    expect(message).toMatch(/^notes\/2026\.11\.9\.md: /)
    expect(message).toMatch(problem)
  })

  // The "What's new" marker is an app version, so an extension highlight could never be marked seen.
  test('an extension note that lists a highlight', async () => {
    expect(
      await failureOf({
        'notes/1.0.0.md': extensionNote({ highlights: ['picker'] }),
        'highlights/picker.md': highlight(),
      }),
    ).toMatch(/^notes\/1\.0\.0\.md: .*highlights/)
  })
})

describe('a highlight that fails the build names its file', () => {
  test.each([
    ['title', { title: undefined }],
    ['title', { title: ' ' }],
    ['screen', { screen: 'https://stillstats.com/app' }],
    ['screen', { screen: '/releases/2026.11.9' }],
    ['screen', { screen: '/apple' }],
  ])('a missing or malformed %s: %j', async (field, fields) => {
    expect(
      await failureOf({
        'notes/2026.11.9.md': appNote({ highlights: ['picker'] }),
        'highlights/picker.md': highlight(fields),
      }),
    ).toMatch(new RegExp(`^highlights/picker\\.md: .*\\b${field}\\b`))
  })
  test.each([
    ['its title', highlight({ title: `Faster${emDash}calmer` })],
    ['its body', highlight({}, `Faster${emDash}calmer.`)],
    ['its body, as an entity', highlight({}, 'Faster&mdash;calmer.')],
  ])('a highlight with an em-dash in %s', async (_, text) => {
    expect(
      await failureOf({
        'notes/2026.11.9.md': appNote({ highlights: ['picker'] }),
        'highlights/picker.md': text,
      }),
    ).toMatch(/^highlights\/picker\.md: .*em-dash/)
  })
  test.each([
    ['an aligned table', alignedTable, /inline style/],
    ['an image from another origin', '![A chart](https://example.com/chart.png)', /image/],
  ])('a highlight whose body holds %s', async (_, body, problem) => {
    const message = await failureOf({
      'notes/2026.11.9.md': appNote({ highlights: ['picker'] }),
      'highlights/picker.md': highlight({}, body),
    })

    expect(message).toMatch(/^highlights\/picker\.md: /)
    expect(message).toMatch(problem)
  })
})

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
