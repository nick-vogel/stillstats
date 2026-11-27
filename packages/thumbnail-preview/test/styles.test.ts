// Limits: these tests read the package's two sheets as written. They evaluate no media query and
// cannot see a colour the component sets through a `style` prop, so they show what the sheets
// write, not what a page in light or dark mode paints. The browser walk reads the tool's computed
// text colour in both modes, and Nick checks both in a real browser.
import { readFile } from 'node:fs/promises'
import { declarationsIn } from '@creator-analytics/visual-system/testing'
import { describe, expect, test } from 'vitest'

/** A custom property declaration in the YouTube block's `--yt-` namespace. */
const youtubeDeclaration = /--yt-[\w-]+\s*:[^;{}]*;?/g

/**
 * The colours the package's sheets write outside the declared YouTube block, each as
 * `<file> <property>: <colour>`. The block is the `--yt-*` declarations in `youtube.css`, the one
 * exception to the visual system's colour rules (creator-analytics#732): it keeps YouTube's own
 * colours, in the `rgb()` the measurement docs publish, which the visual system's reader refuses,
 * so they are taken out before it reads the rest. A `--yt-*` declaration anywhere else breaks the
 * rule by being outside the block, whatever it holds.
 */
function coloursOutsideTheBlock(sheets: { styles: string; youtube: string }): string[] {
  const misplaced = [...sheets.styles.matchAll(youtubeDeclaration)].map(
    ([declaration]) => `styles.css ${declaration.split(':')[0]?.trim()}: outside youtube.css`,
  )
  const written = (file: string, css: string) =>
    declarationsIn(css.replace(youtubeDeclaration, '')).flatMap(({ property, colours }) =>
      colours.map(({ written: colour }) => `${file} ${property}: ${colour}`),
    )
  return [
    ...misplaced,
    ...written('styles.css', sheets.styles),
    ...written('youtube.css', sheets.youtube),
  ]
}

async function packageSheets(): Promise<{ styles: string; youtube: string }> {
  const read = (file: string) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
  return { styles: await read('styles.css'), youtube: await read('youtube.css') }
}

describe("the package's colour rule", () => {
  test('the sheets write no colour outside the declared YouTube block', async () => {
    const sheets = await packageSheets()
    const blockColours = [...sheets.youtube.matchAll(youtubeDeclaration)].filter(([declaration]) =>
      /#[0-9a-f]{3,8}\b|rgba?\(/i.test(declaration),
    )

    expect({
      stylesDeclarations: declarationsIn(sheets.styles).length > 0,
      blockColours: blockColours.length > 0,
      outside: coloursOutsideTheBlock(sheets),
    }).toEqual({ stylesDeclarations: true, blockColours: true, outside: [] })
  })

  test('a hex colour in a chrome rule breaks it', async () => {
    const sheets = await packageSheets()

    expect(
      coloursOutsideTheBlock({ ...sheets, styles: `${sheets.styles}\n.t-chip{color:#123456}` }),
    ).toEqual(['styles.css color: #123456'])
  })

  test('a colour in youtube.css on a declaration outside the --yt- namespace breaks it', async () => {
    const sheets = await packageSheets()

    expect(
      coloursOutsideTheBlock({
        ...sheets,
        youtube: `${sheets.youtube}\n.t-focus--dark{border-color:#123456}`,
      }),
    ).toEqual(['youtube.css border-color: #123456'])
  })

  test('a --yt- declaration in styles.css breaks it, since the block is the one file', async () => {
    const sheets = await packageSheets()

    expect(
      coloursOutsideTheBlock({ ...sheets, styles: `${sheets.styles}\n.t-chip{--yt-chip:#f2f2f2}` }),
    ).toEqual(['styles.css --yt-chip: outside youtube.css'])
  })
})
