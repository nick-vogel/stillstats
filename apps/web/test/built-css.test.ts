// Limits: these tests read CSS texts planted here, not the build. The test on the real build is in
// web.test.ts, and a plant in the real build was proven red once by hand (creator-analytics#362).
import { describe, expect, test } from 'vitest'
import {
  classNamesIn,
  coloursOutsideTokens,
  preflightRulesIn,
  shadcnDefaultsIn,
  utilityRulesOf,
} from './built-css.ts'
import { shadcnDefaultTheme } from './shadcn-default-theme.ts'

const tokens = ['--bg', '--bg-end', '--accent', '--measure']

// The theme blocks as the build writes them, Lightning CSS's color-scheme variables included.
const tokenBlocks =
  ':root{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light dark;--bg:oklch(96% .02 292);--bg-end:oklch(100% 0 0);--accent:oklch(49% .06 308);--measure:68rem}' +
  '@media (prefers-color-scheme:dark){:root{--lightningcss-light: ;--lightningcss-dark:initial}}' +
  ':root[data-theme=light]{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light}' +
  ':root[data-theme=dark]{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark;--bg:oklch(21.5% .028 288);--accent:oklch(77% .055 308)}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:oklch(21.5% .028 288);--accent:oklch(77% .055 308)}}'

describe('a colour outside the visual system tokens (ADR 0014 rule 3)', () => {
  test('a Tailwind palette colour in a utility is one', () => {
    expect(
      coloursOutsideTokens(
        '@layer utilities{.bg-red-500{background-color:oklch(63.7% .237 25.331)}}',
        tokens,
      ),
    ).toEqual([{ property: 'background-color', written: 'oklch(63.7% .237 25.331)' }])
  })

  test("Tailwind's transparent and white internals are colours too", () => {
    expect(
      coloursOutsideTokens(
        '@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}' +
          '.ring-offset{--tw-ring-offset-color:#fff}',
        tokens,
      ),
    ).toEqual([
      { property: 'initial-value', written: '#0000' },
      { property: '--tw-ring-offset-color', written: '#fff' },
    ])
  })

  test('a token declaration of either colour scheme writes its colour freely', () => {
    expect(coloursOutsideTokens(tokenBlocks, tokens)).toEqual([])
  })

  test("a colour after the grain's data URI, whose quoted SVG names a url() of its own, is still read", () => {
    expect(
      coloursOutsideTokens(
        `body:before{background-image:url("data:image/svg+xml,%3Crect filter='url(%23n)'/%3E")}` +
          '.x{color:#f00}.y{font-family:"Switzer"}',
        tokens,
      ),
    ).toEqual([{ property: 'color', written: '#f00' }])
  })

  test('a rule that paints with a token by var() writes no colour', () => {
    expect(coloursOutsideTokens('.border-input{border-color:var(--accent)}', tokens)).toEqual([])
  })

  test('a colour in a url() or a quoted string is no declared colour', () => {
    expect(
      coloursOutsideTokens(
        `.grain{background-image:url("data:image/svg+xml,%3Csvg fill='%23fff'/%3E")}.x{content:"#fff"}`,
        tokens,
      ),
    ).toEqual([])
  })
})

describe("one of shadcn's default theme values in the CSS (ADR 0014 rule 3)", () => {
  test("shadcn's primary colour is one, as written or as the minifier rewrites it", () => {
    for (const written of ['oklch(0.205 0 0)', 'oklch(20.5% 0 0)']) {
      expect(
        shadcnDefaultsIn(`:root{--primary:${written}}`, tokens, shadcnDefaultTheme).map(
          ({ property, value }) => ({ property, value }),
        ),
      ).toEqual([{ property: '--primary', value: written }])
    }
  })

  test("shadcn's radius is one, as a variable or as a declaration's whole value", () => {
    expect(
      shadcnDefaultsIn(
        ':root{--radius:.625rem}.rounded-lg{border-radius:0.625rem}',
        tokens,
        shadcnDefaultTheme,
      ),
    ).toEqual([
      { property: '--radius', value: '.625rem', variable: '--radius' },
      { property: 'border-radius', value: '0.625rem', variable: '--radius' },
    ])
  })

  test('a length that only ends in the radius is not the radius', () => {
    expect(
      shadcnDefaultsIn(
        '@media (min-width:53.625rem){.wide{display:grid}}.wordmark{font-size:1.625rem}' +
          '.chip{padding:.625rem 1rem}',
        tokens,
        shadcnDefaultTheme,
      ),
    ).toEqual([])
  })

  test("a visual system token that happens to equal a shadcn default is the visual system's", () => {
    // The light page's lower end is pure white, as shadcn's light background is.
    expect(shadcnDefaultsIn(tokenBlocks, tokens, shadcnDefaultTheme)).toEqual([])
  })
})

describe('a Preflight rule in the CSS', () => {
  test("Preflight's box reset and anything in the base layer are Preflight", () => {
    expect(
      preflightRulesIn(
        '@layer theme,base,components,utilities;' +
          '@layer base{*,:after,:before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0}' +
          'html,:host{line-height:1.5}}',
      ),
    ).toEqual(['*,:after,:before,::backdrop,::file-selector-button', 'html,:host'])
  })

  test("Preflight's box reset is Preflight outside a layer too, as a plain `@import` of it writes it", () => {
    expect(
      preflightRulesIn(
        '*,:after,:before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0}',
      ),
    ).toEqual(['*,:after,:before,::backdrop,::file-selector-button'])
  })

  test("the visual system's own box-sizing reset and the layer order statement are not", () => {
    expect(
      preflightRulesIn(
        '@layer theme,base,components,utilities;*,:before,:after{box-sizing:border-box}' +
          '@layer utilities{.p-2{padding:calc(var(--spacing) * 2)}}',
      ),
    ).toEqual([])
  })
})

describe('the rules a stylesheet emits for one utility class', () => {
  const sheet =
    '@layer utilities{.border{border-style:var(--tw-border-style);border-width:1px}' +
    '.border-border{border-color:var(--line)}' +
    String.raw`.rounded-\[0\.75rem\]{border-radius:.75rem}` +
    String.raw`.hover\:border-border:hover{border-color:var(--accent)}}`

  test('an arbitrary value class is found by its escaped selector', () => {
    expect(utilityRulesOf(sheet, 'rounded-[0.75rem]')).toBe(
      String.raw`.rounded-\[0\.75rem\]{border-radius:.75rem}`,
    )
  })

  test('a class is not a longer class it starts, nor the same class under a variant', () => {
    expect(utilityRulesOf(sheet, 'border')).toBe(
      '.border{border-style:var(--tw-border-style);border-width:1px}',
    )
    expect(utilityRulesOf(sheet, 'border-border')).toBe('.border-border{border-color:var(--line)}')
  })

  test('a class the stylesheet emits nothing for has no rule', () => {
    expect(utilityRulesOf(sheet, 'bg-card')).toBe('')
  })

  test("a variant's class is found with what its variant adds to the selector, inside its @media block too", () => {
    const variants =
      '@layer utilities{' +
      String.raw`.\[\&_svg\]\:size-4 svg{width:calc(var(--spacing) * 4)}` +
      String.raw`.\[\&\:hover\]\:text-foreground:hover{color:var(--ink)}` +
      String.raw`@media not all and (width>=48rem){.max-md\:hidden{display:none}}` +
      String.raw`.max-md\:hidden-x{display:none}}`

    expect(utilityRulesOf(variants, '[&_svg]:size-4')).toBe(
      String.raw`.\[\&_svg\]\:size-4 svg{width:calc(var(--spacing) * 4)}`,
    )
    expect(utilityRulesOf(variants, '[&:hover]:text-foreground')).toBe(
      String.raw`.\[\&\:hover\]\:text-foreground:hover{color:var(--ink)}`,
    )
    expect(utilityRulesOf(variants, 'max-md:hidden')).toBe(
      String.raw`.max-md\:hidden{display:none}`,
    )
  })
})

describe('the class names a component writes', () => {
  test('are every class of each className attribute and of every string in each cn() and cva() call', () => {
    const source = `
      const variants = cva('flex gap-2', { variants: { size: { sm: 'h-7', lg: "h-12 p-0" } } })
      <div className="isolate z-2" />
      <span className={cn('size-4', open && 'hidden', className)} />
      <p className={cn(
        'border',
        'size-4 [&_svg]:size-4',
      )} />
    `

    expect(classNamesIn(source)).toEqual([
      'isolate',
      'z-2',
      'flex',
      'gap-2',
      'h-7',
      'h-12',
      'p-0',
      'size-4',
      'hidden',
      'border',
      '[&_svg]:size-4',
    ])
  })
})
