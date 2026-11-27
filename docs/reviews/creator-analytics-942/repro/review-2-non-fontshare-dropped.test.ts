import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fonts } from '../../../../packages/visual-system/src/vite.ts'
import { fontUrlsIn } from '../../../../packages/visual-system/test/testing.ts'

const requireFromVisualSystem = createRequire(
  new URL('../../../../packages/visual-system/package.json', import.meta.url),
)
const { build, createLogger } = (await import(
  requireFromVisualSystem.resolve('vite')
)) as typeof import('vite')

test('Finding 1: fonts() does not silently drop an absent non-Fontshare @font-face or blame pnpm fonts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'review-2-non-fontshare-'))
  try {
    await mkdir(join(root, 'src'))
    await mkdir(join(root, 'fonts'))
    await copyFile(
      new URL(
        '../../../../packages/visual-system/fonts/JetBrainsMono-Regular.woff2',
        import.meta.url,
      ),
      join(root, 'fonts', 'JetBrainsMono-Regular.woff2'),
    )
    await writeFile(
      join(root, 'src', 'site.css'),
      [
        '@font-face { font-family: "JetBrains Mono"; src: url("../fonts/JetBrainsMono-Regular.woff2") format("woff2"); }',
        '@font-face { font-family: "Roboto"; src: url("../fonts/roboto-missing.woff2") format("woff2"); }',
        'body { font-family: "Roboto", sans-serif; }',
      ].join('\n'),
    )
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><html><head><link rel="stylesheet" href="/src/site.css" /></head><body></body></html>\n',
    )

    const warnings: string[] = []
    const logger = createLogger('silent')
    logger.warnOnce = (message) => warnings.push(message)
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      customLogger: logger,
      plugins: [fonts()],
    })

    const assets = join(root, 'dist', 'assets')
    const sheets = (await readdir(assets)).filter((file) => file.endsWith('.css'))
    const css = (
      await Promise.all(sheets.map((file) => readFile(join(assets, file), 'utf8')))
    ).join('')

    assert.deepEqual(
      [...css.matchAll(/@font-face\{font-family:([^;]+);/g)].map(([, family]) => family),
      ['JetBrains Mono', 'Roboto'],
    )
    assert.ok(
      fontUrlsIn(css).some((url) => url.includes('roboto-missing.woff2')),
      'the broken non-Fontshare URL should stay visible to downstream checks',
    )
    assert.deepEqual(warnings, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
