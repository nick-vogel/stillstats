// Limits: these tests read the manifest WXT writes for each build. They cannot show Chrome or
// Firefox accepting the build, granting the host access, or Firefox showing its data consent at
// install. creator-analytics#101 loads both builds in both browsers by hand. The icon tests prove
// each icon is a PNG at its size, not that it shows the Stillstats S: the PNGs are rendered from
// apps/site/public/favicon.svg, and the walk-through (#99) and the store listings (#100) see them.
// The first-run test reads the built page and the script it names, not the page rendering in a
// browser, and it fails falsely if WXT moves the page's text into a shared chunk. #99 and #101
// open the page by hand.
import { existsSync, globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest'
import { build } from 'wxt'
import { youtubeContentScriptFile } from '../src/youtube-access.ts'

const root = join(import.meta.dirname, '..')

const quiet = {
  debug() {},
  log() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  success() {},
  level: 0,
}

type Mode = 'production' | 'development' | 'staging'

/** The Access service token a staging build reads from its environment. Fake, never a real one. */
interface AccessToken {
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
}

const fakeToken = {
  CF_ACCESS_CLIENT_ID: 'fake-staging-client-id.access',
  CF_ACCESS_CLIENT_SECRET: 'fake-staging-client-secret-for-tests',
} satisfies AccessToken

afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * Builds the extension into a temporary directory and answers the directory of the build. The
 * build's environment holds `token` and nothing else of the Access token, so the environment the
 * tests run in never reaches a build: a staging build gets the fake token, any other none.
 */
async function built(
  browser: 'chrome' | 'firefox',
  mode: Mode,
  token: AccessToken = mode === 'staging' ? fakeToken : {},
): Promise<string> {
  vi.stubEnv('CF_ACCESS_CLIENT_ID', token.CF_ACCESS_CLIENT_ID)
  vi.stubEnv('CF_ACCESS_CLIENT_SECRET', token.CF_ACCESS_CLIENT_SECRET)
  const outDir = mkdtempSync(join(tmpdir(), 'extension-build-'))
  onTestFinished(() => rmSync(outDir, { recursive: true, force: true }))
  await build({
    root,
    browser,
    manifestVersion: 3,
    mode,
    outDir,
    outDirTemplate: 'build',
    logger: quiet,
  })
  return join(outDir, 'build')
}

/** The keys the icon, popup and content script tests read, beside every other key a build writes. */
type BuiltManifest = Record<string, unknown> & {
  icons?: Record<string, string>
  content_scripts?: Array<{ matches?: string[] }>
  action?: { default_icon?: Record<string, string>; default_popup?: string }
}

function manifestIn(dir: string): BuiltManifest {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
}

async function builtManifest(browser: 'chrome' | 'firefox', mode: Mode): Promise<BuiltManifest> {
  return manifestIn(await built(browser, mode))
}

/** Every script the build ships, by its path in the build. */
async function scriptsOf(browser: 'chrome' | 'firefox', mode: Mode): Promise<Map<string, string>> {
  const dir = await built(browser, mode)
  return new Map(
    globSync('**/*.js', { cwd: dir }).map((file) => [file, readFileSync(join(dir, file), 'utf8')]),
  )
}

/** Every script the build ships, joined, as a store reviewer reads them. */
async function builtScripts(browser: 'chrome' | 'firefox', mode: Mode): Promise<string> {
  return [...(await scriptsOf(browser, mode)).values()].join('\n')
}

const productionHosts = ['https://studio.youtube.com/*', 'https://stillstats.com/*']

/** YouTube access (ADR 0016): asked for from the popup's toggle, never at install. */
const youtubeHosts = ['https://www.youtube.com/*']

describe('the production builds ask for Studio and the product API only', () => {
  test.each(['chrome', 'firefox'] as const)(
    'the %s build is Manifest V3 with the two hosts, scripting, and www.youtube.com only as optional',
    async (browser) => {
      const manifest = await builtManifest(browser, 'production')

      expect(manifest.manifest_version).toBe(3)
      expect(manifest.host_permissions).toEqual(productionHosts)
      expect(manifest.permissions).toEqual(['scripting'])
      expect(manifest.optional_host_permissions).toEqual(youtubeHosts)
    },
    60_000,
  )
})

test.each(['chrome', 'firefox'] as const)(
  'the %s development build adds the local API to the two hosts and nothing else',
  async (browser) => {
    const manifest = await builtManifest(browser, 'development')

    expect(manifest.host_permissions).toEqual([...productionHosts, 'http://localhost:3000/*'])
    expect(manifest.permissions).toEqual(['scripting'])
    expect(manifest.optional_host_permissions).toEqual(youtubeHosts)
  },
  60_000,
)

describe('www.youtube.com is never asked for at install', () => {
  test.each([
    ['chrome', 'production'],
    ['firefox', 'production'],
    ['chrome', 'development'],
    ['firefox', 'development'],
    ['chrome', 'staging'],
    ['firefox', 'staging'],
  ] as const)(
    'the %s %s build names youtube.com in no host permission and no static content script but Studio',
    async (browser, mode) => {
      const manifest = await builtManifest(browser, mode)
      const named = [
        ...((manifest.host_permissions as string[] | undefined) ?? []),
        ...(manifest.content_scripts ?? []).flatMap(({ matches }) => matches ?? []),
      ]

      expect(named.filter((pattern) => pattern.includes('youtube.com'))).toEqual(
        named.filter((pattern) => pattern === 'https://studio.youtube.com/*'),
      )
      expect(named).toContain('https://studio.youtube.com/*')
    },
    60_000,
  )

  test.each(['chrome', 'firefox'] as const)(
    'the %s build ships the youtube.com content script the background registers',
    async (browser) => {
      const dir = await built(browser, 'production')

      expect(existsSync(join(dir, youtubeContentScriptFile))).toBe(true)
    },
    60_000,
  )
})

test('the Firefox build carries the gecko id, Firefox 140 and its data collection', async () => {
  const manifest = await builtManifest('firefox', 'production')

  expect(manifest.browser_specific_settings).toEqual({
    gecko: {
      id: '@stillstats',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: ['authenticationInfo', 'websiteContent'],
        optional: ['technicalAndInteraction'],
      },
    },
  })
}, 60_000)

test('the Chrome build carries no Firefox settings', async () => {
  const manifest = await builtManifest('chrome', 'production')

  expect(manifest.browser_specific_settings).toBeUndefined()
}, 60_000)

test('Chrome runs the background as a service worker and Firefox as a background script', async () => {
  const chrome = await builtManifest('chrome', 'production')
  const firefox = await builtManifest('firefox', 'production')

  expect(chrome.background).toEqual({ service_worker: 'background.js' })
  expect(firefox.background).toEqual({ scripts: ['background.js'] })
}, 120_000)

describe('a build ships only the API origin it calls', () => {
  test.each(['chrome', 'firefox'] as const)(
    'the %s production build names no local API origin in its scripts',
    async (browser) => {
      const scripts = await builtScripts(browser, 'production')

      expect(scripts).toContain('https://stillstats.com')
      expect(scripts).not.toContain('localhost')
    },
    60_000,
  )

  test('the development build calls the local API', async () => {
    expect(await builtScripts('chrome', 'development')).toContain('http://localhost:3000')
  }, 60_000)

  test.each(['chrome', 'firefox'] as const)(
    'the %s staging build calls staging and names no local API origin',
    async (browser) => {
      const scripts = await builtScripts(browser, 'staging')

      expect(scripts).toContain('https://staging.stillstats.com')
      expect(scripts).not.toContain('localhost')
    },
    60_000,
  )
})

describe('the staging builds ask for Studio and staging only', () => {
  test.each(['chrome', 'firefox'] as const)(
    'the %s staging build asks for Studio and staging.stillstats.com, scripting, and www.youtube.com only as optional',
    async (browser) => {
      const manifest = await builtManifest(browser, 'staging')

      expect(manifest.host_permissions).toEqual([
        'https://studio.youtube.com/*',
        'https://staging.stillstats.com/*',
      ])
      expect(manifest.permissions).toEqual(['scripting'])
      expect(manifest.optional_host_permissions).toEqual(youtubeHosts)
    },
    60_000,
  )
})

describe('only a staging build carries the Access service token', () => {
  test.each(['chrome', 'firefox'] as const)(
    "the %s staging build's background carries both Access headers, and no other script the token",
    async (browser) => {
      const scripts = await scriptsOf(browser, 'staging')
      const background = scripts.get('background.js') ?? ''

      expect(background).toContain('CF-Access-Client-Id')
      expect(background).toContain(fakeToken.CF_ACCESS_CLIENT_ID)
      expect(background).toContain('CF-Access-Client-Secret')
      expect(background).toContain(fakeToken.CF_ACCESS_CLIENT_SECRET)
      const others = [...scripts].filter(([file]) => file !== 'background.js')
      expect(others.length).toBeGreaterThan(0)
      expect(
        others
          .filter(
            ([, script]) =>
              script.includes(fakeToken.CF_ACCESS_CLIENT_ID) ||
              script.includes(fakeToken.CF_ACCESS_CLIENT_SECRET),
          )
          .map(([file]) => file),
      ).toEqual([])
    },
    60_000,
  )

  test.each([
    ['chrome', 'production'],
    ['firefox', 'production'],
    ['chrome', 'development'],
    ['firefox', 'development'],
  ] as const)(
    'the %s %s build sends neither Access header, even with the token in its environment',
    async (browser, mode) => {
      const dir = await built(browser, mode, fakeToken)
      const scripts = globSync('**/*.js', { cwd: dir })
        .map((file) => readFileSync(join(dir, file), 'utf8'))
        .join('\n')

      expect(scripts).not.toContain('CF-Access-Client-Id')
      expect(scripts).not.toContain('CF-Access-Client-Secret')
      expect(scripts).not.toContain(fakeToken.CF_ACCESS_CLIENT_SECRET)
    },
    60_000,
  )

  test.each([
    ['neither value', {}],
    ['only the id', { CF_ACCESS_CLIENT_ID: fakeToken.CF_ACCESS_CLIENT_ID }],
    ['only the secret', { CF_ACCESS_CLIENT_SECRET: fakeToken.CF_ACCESS_CLIENT_SECRET }],
  ])(
    'a staging build with %s fails, naming both values',
    async (_, token) => {
      await expect(built('chrome', 'staging', token)).rejects.toThrow(
        /CF_ACCESS_CLIENT_ID.*CF_ACCESS_CLIENT_SECRET/s,
      )
    },
    60_000,
  )
})

/** The width and height a PNG declares in its IHDR chunk, or undefined when it is not a PNG. */
function pngSize(file: string): { width: number; height: number } | undefined {
  const bytes = readFileSync(file)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!bytes.subarray(0, 8).equals(signature)) return undefined
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('every build carries the icons both browsers and both stores ask for', () => {
  test.each([
    ['chrome', 'production'],
    ['firefox', 'production'],
    ['chrome', 'development'],
    ['firefox', 'development'],
  ] as const)(
    'the %s %s build names a PNG at each icon size',
    async (browser, mode) => {
      const dir = await built(browser, mode)
      const manifest = manifestIn(dir)

      expect(manifest.icons).toEqual({
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        64: 'icon/64.png',
        96: 'icon/96.png',
        128: 'icon/128.png',
      })
      expect(manifest.action?.default_icon).toEqual({ 16: 'icon/16.png', 32: 'icon/32.png' })

      const declared = { ...manifest.icons, ...manifest.action?.default_icon }
      for (const [size, path] of Object.entries(declared)) {
        const file = join(dir, path)
        expect(existsSync(file), `${path} is in the build`).toBe(true)
        expect(pngSize(file), `${path} is a ${size}x${size} PNG`).toEqual({
          width: Number(size),
          height: Number(size),
        })
      }
    },
    60_000,
  )
})

test.each([
  ['chrome', 'production'],
  ['firefox', 'production'],
  ['chrome', 'development'],
  ['firefox', 'development'],
] as const)(
  'the %s %s build opens the popup from the toolbar button',
  async (browser, mode) => {
    const manifest = await builtManifest(browser, mode)

    expect(manifest.action?.default_popup).toBe('popup.html')
  },
  60_000,
)

test.each(['chrome', 'firefox'] as const)(
  'the %s build runs one content script, on Studio only',
  async (browser) => {
    const manifest = await builtManifest(browser, 'production')

    expect(manifest.content_scripts?.map(({ matches }) => matches)).toEqual([
      ['https://studio.youtube.com/*'],
    ])
  },
  60_000,
)

/** The path of the page's module script, whatever order its tag's attributes come in. */
function moduleScriptIn(page: string): string | undefined {
  const tags = page.match(/<script\b[^>]*>/g) ?? []
  return tags.find((tag) => /\btype="module"/.test(tag))?.match(/\bsrc="\/([^"]+)"/)?.[1]
}

test('the module script is found with its attributes in either order', () => {
  expect(moduleScriptIn('<script type="module" crossorigin src="/a.js"></script>')).toBe('a.js')
  expect(moduleScriptIn('<script src="/b.js" type="module"></script>')).toBe('b.js')
})

test.each(['chrome', 'firefox'] as const)(
  'the %s build ships the first-run page, with the script that renders it',
  async (browser) => {
    const dir = await built(browser, 'production')
    const page = readFileSync(join(dir, 'first-run.html'), 'utf8')
    const script = moduleScriptIn(page)

    expect(script && readFileSync(join(dir, script), 'utf8')).toContain('Read the privacy policy')
  },
  60_000,
)
