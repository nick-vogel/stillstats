import { type Colour, declarationsIn } from '@creator-analytics/visual-system/testing'
import type { ThemeValue } from './shadcn-default-theme.ts'

type Declaration = { property: string; value: string }

const quoted = String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`

// Comments, quoted strings and url() hold text that is no declared value, such as the `%23fff`
// fill of the grain's data URI or a `content` string. A url() is read to its closing quote first:
// the grain's quoted SVG names `url(%23n)`, whose `)` would otherwise end the url() inside the
// quotes and pair every later quote with the wrong one.
const notValueText = new RegExp(
  String.raw`\/\*[\s\S]*?\*\/|url\(\s*(?:${quoted})\s*\)|url\([^)]*\)|${quoted}`,
  'gi',
)

// A declaration opens after `{` or `;` and closes at `;` or `}`, so a selector such as `a:hover`
// and a media feature such as `(min-width:53.625rem)` never read as one.
const declarationPattern = /(?<=[{;]\s*)([-\w]+)\s*:([^;{}]*)(?=[;}])/g

function declarationsWrittenIn(css: string): Declaration[] {
  return [...css.replace(notValueText, ' ').matchAll(declarationPattern)].map(
    ([, property = '', value = '']) => ({ property: property.toLowerCase(), value: value.trim() }),
  )
}

function coloursOf({ property, value }: Declaration): Colour[] {
  return declarationsIn(`{${property}:${value}}`).flatMap(({ colours }) => colours)
}

function outsideTokens(css: string, tokens: readonly string[]): Declaration[] {
  const declaredByTheVisualSystem = new Set(tokens)
  return declarationsWrittenIn(css).filter(
    ({ property }) => !declaredByTheVisualSystem.has(property),
  )
}

/**
 * Every colour a stylesheet writes in a declaration whose property is not one of the visual
 * system's `tokens`. The tokens' own declarations, in either colour scheme, are the only place a
 * colour may be written. A colour keyword or a colour function the visual system's colour reader
 * cannot read, such as `color-mix()`, throws, so it never passes unseen.
 */
export function coloursOutsideTokens(
  css: string,
  tokens: readonly string[],
): { property: string; written: string }[] {
  return outsideTokens(css, tokens).flatMap((declaration) =>
    coloursOf(declaration).map(({ written }) => ({ property: declaration.property, written })),
  )
}

// Far below one just noticeable difference (ΔE_OK 0.02, CSS Color 4 §14.2.1), and above the
// rounding of a minifier that writes `oklch(0.205 0 0)` as `oklch(20.5% 0 0)`.
const sameColour = 1e-4

function isSameColour(one: Colour, other: Colour): boolean {
  const { l, a, b } = one.oklab
  return Math.hypot(l - other.oklab.l, a - other.oklab.a, b - other.oklab.b) < sameColour
}

const length = /^(-?\d*\.?\d+)([a-z%]*)$/i

// A minifier writes `0.625rem` as `.625rem`, so a length is compared by number and unit, and only
// as a declaration's whole value: `53.625rem` and `1.625rem` hold `.625rem` but are not it.
function isSameValue(written: string, expected: string): boolean {
  const [, number = '', unit = ''] = length.exec(written) ?? []
  const [, expectedNumber = '', expectedUnit = ''] = length.exec(expected) ?? []
  if (number && expectedNumber) {
    return Number(number) === Number(expectedNumber) && unit.toLowerCase() === expectedUnit
  }
  return written.replace(/\s+/g, ' ') === expected
}

/**
 * Every declaration outside the visual system's `tokens` that writes one of shadcn's default theme
 * values: a colour by its OKLab, anywhere in the value, and any other value as the whole value.
 * The tokens' own declarations are left to the visual system's colour tests, because its light
 * page ends in pure white, which is also shadcn's light background.
 */
export function shadcnDefaultsIn(
  css: string,
  tokens: readonly string[],
  defaults: readonly ThemeValue[],
): (Declaration & { variable: string })[] {
  const expected = defaults.map((theme) => ({
    ...theme,
    colour: coloursOf({ property: theme.variable, value: theme.value })[0],
  }))
  return outsideTokens(css, tokens).flatMap((declaration) => {
    const colours = coloursOf(declaration)
    const match = expected.find(({ value, colour }) =>
      colour
        ? colours.some((written) => isSameColour(written, colour))
        : isSameValue(declaration.value, value),
    )
    return match ? [{ ...declaration, variable: match.variable }] : []
  })
}

/** The text between the braces of the block that opens at `open`, nested blocks included. */
function blockAt(css: string, open: number): string {
  let depth = 0
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') depth += 1
    if (css[at] === '}') depth -= 1
    if (depth === 0) return css.slice(open + 1, at)
  }
  return css.slice(open + 1)
}

function selectorsIn(css: string): string[] {
  return [...css.matchAll(/([^{};]+)\{[^{}]*\}/g)].map(([, selector = '']) => selector.trim())
}

/**
 * The selector of every Preflight rule in a stylesheet: each rule in a `base` layer, which is the
 * layer Tailwind imports Preflight into, and any rule naming `::file-selector-button`, which only
 * Preflight's box reset does here.
 */
export function preflightRulesIn(css: string): string[] {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const inBase = [...uncommented.matchAll(/@layer\s+base\s*\{/g)].flatMap((opening) =>
    selectorsIn(blockAt(uncommented, (opening.index ?? 0) + opening[0].length - 1)),
  )
  const fileButtonResets = selectorsIn(uncommented).filter((selector) =>
    selector.includes('::file-selector-button'),
  )
  return [...new Set([...inBase, ...fileButtonResets])]
}

/** A class name as a selector writes it: each character outside a name's own escaped. */
function selectorOfClass(className: string): string {
  return `.${className.replace(/[^\w-]/g, (character) => `\\${character}`)}`
}

// What may follow a class's own selector in a rule for that class: the end, or the pseudo-class,
// attribute, compound class or combinator a variant adds, such as `:hover` for `[&:hover]:` or
// ` svg` for `[&_svg]:`. A name character or an escape would continue a longer class.
const afterClass = /^(?:$|[\s:[.>+~])/

/**
 * Every rule of a stylesheet that is the rule of the one class `className`, as the CSS text
 * `selector{body}`, in the sheet's order: the rules Tailwind emits for that utility, a variant's
 * own selector and @media block included, such as `.max-md\:hidden` under `(width<48rem)`. A
 * longer class it starts is another selector, and so is the same utility under a variant, such as
 * `hover:border` for `border`, so both are left out. Empty when the sheet emits nothing for it.
 */
export function utilityRulesOf(css: string, className: string): string {
  const selector = selectorOfClass(className)
  const isTheClass = (listed: string) =>
    listed.startsWith(selector) && afterClass.test(listed.slice(selector.length))
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{([^{}]*)\}/g)]
    .flatMap(([, listed = '', body = '']) =>
      listed
        .split(',')
        .map((each) => each.trim())
        .filter(isTheClass)
        .map((each) => `${each}{${body}}`),
    )
    .join('')
}

// A class string literal: the value of a `className` attribute, or a quoted string inside a `cn()`
// or `cva()` call, which a component's classes, variants included, are written in.
const quotedLiteral = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g

/** The text of the call that opens at `open`, its `(`, up to its matching `)`, quotes skipped. */
function callAt(source: string, open: number): string {
  let depth = 0
  let quote = ''
  for (let at = open; at < source.length; at++) {
    const character = source[at]
    if (quote) {
      if (character === '\\') at += 1
      else if (character === quote) quote = ''
    } else if (character === "'" || character === '"' || character === '`') quote = character
    else if (character === '(') depth += 1
    else if (character === ')' && --depth === 0) return source.slice(open + 1, at)
  }
  return source.slice(open + 1)
}

/**
 * Every class name a component's source writes, once each, in the order written: each `className`
 * attribute's string, and every string in each `cn()` and `cva()` call, not only the first, so a
 * variant's classes are read too.
 */
export function classNamesIn(source: string): string[] {
  const attributes = [...source.matchAll(/\bclassName=(?:"([^"]*)"|'([^']*)')/g)].map(
    ([, double, single]) => double ?? single ?? '',
  )
  const calls = [...source.matchAll(/\b(?:cn|cva)\(/g)].flatMap((call) =>
    [...callAt(source, (call.index ?? 0) + call[0].length - 1).matchAll(quotedLiteral)].map(
      ([, single, double]) => single ?? double ?? '',
    ),
  )
  return [...new Set([...attributes, ...calls].flatMap((text) => text.split(/\s+/)))].filter(
    Boolean,
  )
}
