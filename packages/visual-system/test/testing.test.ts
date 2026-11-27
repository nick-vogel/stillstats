import { describe, expect, test } from 'vitest'
import {
  backgroundColoursIn,
  colourSchemesIn,
  darkTokensIn,
  fontUrlsIn,
  lightTokensIn,
  rulesDeclaringIn,
  rulesIn,
  themeBlocksIn,
  valueIn,
} from './testing.ts'

// A rule that reads a stylesheet through one of these helpers passes vacuously when the helper
// reads too little, or reads the wrong block, so each is pinned to a sheet whose answer is known.
// Each sheet is written twice where it matters: as the source spells it, and as the build minifies
// it. The build unquotes attribute values, and beside every color-scheme it writes Lightning CSS's
// --lightningcss-light and --lightningcss-dark, with a bare :root of its own holding them inside
// the dark media query.
const written = `
/* :root { --commented: #000; } */
:root {
  color-scheme: light dark;
  --bg: oklch(0.96 0.02 292);
  --ink: oklch(0.27 0.03 288);
}

:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: oklch(0.215 0.028 288);
  --dark-only: oklch(0.19 0.032 288);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: oklch(0.215 0.028 288);
    --dark-only: oklch(0.19 0.032 288);
  }
}
`

const minified =
  ':root{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light dark;--bg:oklch(96% .02 292);--ink:oklch(27% .03 288)}' +
  '@media (prefers-color-scheme:dark){:root{--lightningcss-light: ;--lightningcss-dark:initial}}' +
  ':root[data-theme=light]{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light}' +
  ':root[data-theme=dark]{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark;--bg:oklch(21.5% .028 288);--dark-only:oklch(19% .032 288)}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:oklch(21.5% .028 288);--dark-only:oklch(19% .032 288)}}'

describe('the stylesheet readings', () => {
  test('each woff2 a url() names is read once, quoted or not', () => {
    const css = [
      '@font-face{src:url("../fonts/A.woff2") format("woff2")}',
      '@font-face{src:url(/app/assets/B-7Oa6.woff2)format("woff2")}',
      "@font-face{src:url( 'C.woff2' )}",
      '@font-face{src:url("../fonts/A.woff2")}',
      '.a{background-image:url(grain.png)}',
    ].join('')

    expect(fontUrlsIn(css)).toEqual(['../fonts/A.woff2', '/app/assets/B-7Oa6.woff2', 'C.woff2'])
  })

  test('the background colours are the --bg tokens and every background declaration, and no other colour', () => {
    const css =
      ':root{--bg:#111;--bg-end:#222;--ink:#333}' +
      '.a{background:#444;background-color:#555;background-image:linear-gradient(#666,#777)}' +
      '.b{color:#888;border-color:#999}'

    expect(backgroundColoursIn(css).map(({ written }) => written)).toEqual([
      '#111',
      '#222',
      '#444',
      '#555',
      '#666',
      '#777',
    ])
  })

  test('the light tokens are those the :root block outside any media query declares, and no Lightning CSS variable', () => {
    expect({ written: lightTokensIn(written), minified: lightTokensIn(minified) }).toEqual({
      written: ['--bg', '--ink'],
      minified: ['--bg', '--ink'],
    })
  })

  test('the dark tokens are those the two dark blocks declare, and no Lightning CSS variable', () => {
    expect({ written: darkTokensIn(written), minified: darkTokensIn(minified) }).toEqual({
      written: ['--bg', '--dark-only'],
      minified: ['--bg', '--dark-only'],
    })
  })

  test('a dark block declared only under the attribute, or only under the media query, still names its tokens', () => {
    expect({
      attribute: darkTokensIn(':root[data-theme="dark"]{--bg:#111}'),
      media: darkTokensIn(
        '@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#eee}}',
      ),
    }).toEqual({ attribute: ['--bg'], media: ['--ink'] })
  })

  test('each theme block is its declarations by property, without color-scheme and the Lightning CSS variables', () => {
    expect({ written: themeBlocksIn(written), minified: themeBlocksIn(minified) }).toEqual({
      written: {
        light: {},
        dark: { '--bg': 'oklch(0.215 0.028 288)', '--dark-only': 'oklch(0.19 0.032 288)' },
        systemDark: { '--bg': 'oklch(0.215 0.028 288)', '--dark-only': 'oklch(0.19 0.032 288)' },
      },
      minified: {
        light: {},
        dark: { '--bg': 'oklch(21.5% .028 288)', '--dark-only': 'oklch(19% .032 288)' },
        systemDark: { '--bg': 'oklch(21.5% .028 288)', '--dark-only': 'oklch(19% .032 288)' },
      },
    })
  })

  test('a token the light attribute declares is read in its block', () => {
    expect(themeBlocksIn(':root[data-theme="light"]{color-scheme:light;--bg:#fff}').light).toEqual({
      '--bg': '#fff',
    })
  })

  test('the color-scheme is read for a root with no attribute, with the light attribute and with the dark one', () => {
    expect({ written: colourSchemesIn(written), minified: colourSchemesIn(minified) }).toEqual({
      written: { none: 'light dark', light: 'light', dark: 'dark' },
      minified: { none: 'light dark', light: 'light', dark: 'dark' },
    })
  })

  test('the rules declaring a property are each named by its selector unquoted and its media condition unspaced', () => {
    const where = [
      { selector: ':root', media: null },
      { selector: ':root[data-theme=dark]', media: null },
      { selector: ':root:not([data-theme=light])', media: '(prefers-color-scheme:dark)' },
    ]

    expect({
      written: rulesDeclaringIn(written, ['--dark-only', '--bg']),
      minified: rulesDeclaringIn(minified, ['--dark-only', '--bg']),
    }).toEqual({ written: where, minified: where })
  })

  test("a bare :root inside the dark media query is a rule declaring its property, as the system's dark mode writes it on any root", () => {
    expect(
      rulesDeclaringIn('@media (prefers-color-scheme: dark) { :root { --bg: #111 } }', ['--bg']),
    ).toEqual([{ selector: ':root', media: '(prefers-color-scheme:dark)' }])
  })

  test('the rules are each innermost rule, with the @media condition it sits in, and no comment', () => {
    const css =
      '/* .commented { color: red } */ .a, .b { width: 1rem } ' +
      '@media (min-width: 40rem) { .a { width: 2rem } .c { height: 0 } }'

    expect(rulesIn(css).map(({ selector, media }) => [selector, media])).toEqual([
      ['.a, .b', null],
      ['.a', '(min-width: 40rem)'],
      ['.c', '(min-width: 40rem)'],
    ])
  })

  test('a rule inside @container reports its condition, and the @media rules keep theirs with no container', () => {
    const css =
      '.a { width: 1rem } @media (min-width: 40rem) { .a { width: 2rem } } ' +
      '@container screen (min-width: 20rem) { .a { width: 3rem } .c { height: 0 } }'

    expect(
      rulesIn(css).map(({ selector, media, container }) => [selector, media, container]),
    ).toEqual([
      ['.a', null, null],
      ['.a', '(min-width: 40rem)', null],
      ['.a', null, 'screen (min-width: 20rem)'],
      ['.c', null, 'screen (min-width: 20rem)'],
    ])
  })

  test('a value outside any block reads no rule inside @container', () => {
    const css = '.a { width: 1rem } @container screen (min-width: 20rem) { .a { width: 3rem } }'

    expect(valueIn(css, '.a', 'width')).toBe('1rem')
  })

  test('a value is the last one a rule naming the selector in its list gives, outside @media unless one is named', () => {
    const css =
      '.a { width: 1rem; height: calc(1rem - 2px) } .b, .a { width: 3rem } ' +
      '@media (min-width: 40rem) { .a { width: 2rem } }'

    expect({
      width: valueIn(css, '.a', 'width'),
      height: valueIn(css, '.a', 'height'),
      wide: valueIn(css, '.a', 'width', '(min-width: 40rem)'),
      unnamed: valueIn(css, '.a', 'margin'),
      unlisted: valueIn(css, '.c', 'width'),
    }).toEqual({
      width: '3rem',
      height: 'calc(1rem - 2px)',
      wide: '2rem',
      unnamed: undefined,
      unlisted: undefined,
    })
  })
})
