// Limits: these tests build a small page with Vite and read the CSS the build writes. No test here
// draws the page, so none shows which family a browser picks from the stack once a face is gone.
// Nick checks the site and the web app with the fonts in a real browser before a release.
import { realpathSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createLogger } from 'vite'
import { expect, onTestFinished, test } from 'vitest'
import { fonts, withoutAbsentFonts } from '../src/vite.ts'
import { fontUrlsIn } from './testing.ts'

/**
 * A page whose stylesheet imports one with two faces, the way an app imports the visual system's:
 * "Present", whose file is there, and "Absent", whose file is not.
 */
async function pageWithTwoFaces(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'visual-system-fonts-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'sheets'))
  await mkdir(join(root, 'fonts'))
  await copyFile(
    new URL('../fonts/JetBrainsMono-Regular.woff2', import.meta.url),
    join(root, 'fonts', 'present.woff2'),
  )
  await writeFile(
    join(root, 'sheets', 'faces.css'),
    [
      '@font-face { font-family: "Present"; src: url("../fonts/present.woff2") format("woff2"); }',
      '@font-face { font-family: "Absent"; src: url("../fonts/absent.woff2") format("woff2"); }',
      'body { font-family: "Absent", "Present", system-ui, sans-serif; }',
    ].join('\n'),
  )
  await writeFile(join(root, 'style.css'), '@import "./sheets/faces.css";\n')
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" href="/style.css" /></head><body></body></html>\n',
  )
  return root
}

/**
 * The page built with `fonts()`, and with `withoutAbsentFonts` set to treat `absent.woff2` the
 * way `fonts()` treats a Fontshare font, which this page cannot name: the real Fontshare files may
 * be on the machine running the test.
 */
async function builtCssOf(
  root: string,
  plugin: 'fonts' | 'absent may be absent',
): Promise<{ css: string; warnings: string[] }> {
  const warnings: string[] = []
  const logger = createLogger('silent')
  logger.warnOnce = (message) => warnings.push(message)
  const absent = join(realpathSync(root), 'fonts', 'absent.woff2')
  const mayBeAbsent = (file: string) => file === absent
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    customLogger: logger,
    ...(plugin === 'fonts'
      ? { plugins: [fonts()] }
      : {
          css: {
            postcss: { plugins: [withoutAbsentFonts(mayBeAbsent, (file) => warnings.push(file))] },
          },
        }),
  })
  const assets = join(root, 'dist', 'assets')
  const sheets = (await readdir(assets)).filter((file) => file.endsWith('.css'))
  const css = (await Promise.all(sheets.map((file) => readFile(join(assets, file), 'utf8')))).join(
    '',
  )
  return { css, warnings }
}

const familiesIn = (css: string) =>
  [...css.matchAll(/@font-face\{font-family:([^;]+);/g)].map(([, family]) => family)

test('a build leaves out the @font-face of an absent font file that may be absent, keeps the present one, and says which file is absent', async () => {
  const root = await pageWithTwoFaces()
  const { css, warnings } = await builtCssOf(root, 'absent may be absent')

  expect(familiesIn(css)).toEqual(['Present'])
  expect(fontUrlsIn(css)).toEqual([expect.stringMatching(/^\/assets\/present-[\w-]+\.woff2$/)])
  expect(warnings).toEqual([join(realpathSync(root), 'fonts', 'absent.woff2')])
})

test('a build with every font file present keeps every @font-face and warns of none', async () => {
  const root = await pageWithTwoFaces()
  await copyFile(join(root, 'fonts', 'present.woff2'), join(root, 'fonts', 'absent.woff2'))
  const { css, warnings } = await builtCssOf(root, 'absent may be absent')

  expect(familiesIn(css)).toEqual(['Present', 'Absent'])
  expect(warnings).toEqual([])
})

test('fonts() keeps the @font-face of an absent file that is not a Fontshare font, so the page still asks for it', async () => {
  const root = await pageWithTwoFaces()
  const { css, warnings } = await builtCssOf(root, 'fonts')

  expect(familiesIn(css)).toEqual(['Present', 'Absent'])
  expect(fontUrlsIn(css)).toContain('../fonts/absent.woff2')
  expect(warnings.filter((warning) => warning.includes('pnpm fonts'))).toEqual([])
})
