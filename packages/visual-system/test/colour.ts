/** A colour in OKLab: perceptual lightness `l`, and the green-red `a` and blue-yellow `b` axes. */
export type Oklab = { l: number; a: number; b: number }

export type Colour = { written: string; oklab: Oklab }

function linearFromSrgb(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** Björn Ottosson's sRGB to OKLab conversion, from https://bottosson.github.io/posts/oklab/. */
function oklabFromSrgb(red: number, green: number, blue: number): Oklab {
  const [r, g, b] = [red, green, blue].map(linearFromSrgb) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function hexToOklab(hex: string): Oklab {
  const digits = hex.slice(1)
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits
  const [red, green, blue] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255)
  return oklabFromSrgb(red ?? 0, green ?? 0, blue ?? 0)
}

// CSS Color 4 §9.4 sets oklch()'s percentage reference ranges: L 100% = 1.0, C 100% = 0.4.
const oklchLightnessAtFullPercent = 1
const oklchChromaAtFullPercent = 0.4

function numberOrPercentOf(token: string, whole: number): number {
  return token.endsWith('%') ? (parseFloat(token) / 100) * whole : parseFloat(token)
}

const colourPattern =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([^)]*\)/gi

function oklabOf(written: string): Oklab {
  if (written.startsWith('#')) return hexToOklab(written)
  const [, name = '', body = ''] = /^([a-z-]+)\((.*)\)$/i.exec(written) ?? []
  if (name.toLowerCase() !== 'oklch') {
    throw new Error(`The colour rules cannot read ${written}. Write it as hex or oklch().`)
  }
  const [lightness = '', chroma = '', hue = ''] = body.split(/[\s,/]+/).filter(Boolean)
  const c = numberOrPercentOf(chroma, oklchChromaAtFullPercent)
  const h = (parseFloat(hue) * Math.PI) / 180
  return {
    l: numberOrPercentOf(lightness, oklchLightnessAtFullPercent),
    a: c * Math.cos(h),
    b: c * Math.sin(h),
  }
}

function readColours(text: string): Colour[] {
  return [...text.matchAll(colourPattern)].map(([written]) => ({
    written,
    oklab: oklabOf(written),
  }))
}

// CSS Color 4 §6.1's named colours and §6.2's system colours, from
// https://www.w3.org/TR/css-color-4/, fetched 2026-10-05. `transparent` and `currentcolor` are
// left out: neither writes a colour of its own.
const colourKeywords = `aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral
  cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey
  darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray
  dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod
  gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
  lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen
  lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
  lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
  mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
  mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive
  olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred
  papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
  saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray
  slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
  whitesmoke yellow yellowgreen
  accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext
  field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem
  selecteditemtext visitedtext`
  .split(/\s+/)
  .filter(Boolean)

const colourKeywordPattern = new RegExp(`(?<![-\\w])(?:${colourKeywords.join('|')})(?![-\\w])`, 'i')

// Comments, quoted strings and url() hold text that is not a colour keyword even where it reads
// as one: an `ivory` in a comment, a data URI, or a quoted font name.
const notValueText = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)/gi

// A declaration opens after `{` or `;` and closes at `;` or `}`. A selector such as `a:hover`
// closes at `{` instead, and a media feature opens after `(`, so neither reads as a declaration.
const declarationPattern = /(?<=[{;]\s*)([-\w]+)\s*:([^;{}]*)(?=[;}])/g

// A family name may be any identifier, `Ivory Sans` included, so it is never a colour keyword.
const fontNameProperties = new Set(['font', 'font-family'])

function declarationsWritten(css: string): { property: string; value: string }[] {
  return [...css.replace(notValueText, ' ').matchAll(declarationPattern)].map(
    ([, property = '', value = '']) => ({ property: property.toLowerCase(), value }),
  )
}

const svgColourAttributePattern =
  /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(["'])(.*?)\2/gi

function rejectColourKeyword(property: string, value: string): void {
  const keyword = fontNameProperties.has(property)
    ? undefined
    : colourKeywordPattern.exec(value)?.[0]
  if (keyword) {
    throw new Error(`The colour rules cannot read ${keyword}. Write it as hex or oklch().`)
  }
}

/**
 * Every declaration in a stylesheet, by property, with the colours its value writes. A colour
 * keyword in a value throws, as an unread colour function does.
 */
export function declarationsIn(css: string): { property: string; colours: Colour[] }[] {
  return declarationsWritten(css).map(({ property, value }) => {
    rejectColourKeyword(property, value)
    return { property, colours: readColours(value) }
  })
}

/**
 * Every colour written in a stylesheet or an SVG, in OKLab. Hex and `oklch()` are read. Any other
 * colour function, and a named or system colour keyword in a declaration value or an SVG colour
 * attribute, throws, so a colour the rules cannot read never passes them unseen.
 */
export function coloursIn(css: string): Colour[] {
  for (const { property, value } of declarationsWritten(css)) rejectColourKeyword(property, value)
  for (const [, attribute = '', , value = ''] of css.matchAll(svgColourAttributePattern)) {
    rejectColourKeyword(attribute, value)
  }
  return readColours(css)
}

/**
 * The Euclidean distance in OKLab, ΔE_OK. CSS Color 4 takes one just noticeable difference as a
 * ΔE_OK of 0.02 (§14.2.1, https://www.w3.org/TR/css-color-4/#GMA-Binary-local-MINDE).
 */
export function distance(one: Oklab, other: Oklab): number {
  return Math.hypot(one.l - other.l, one.a - other.a, one.b - other.b)
}

/**
 * Cream, ivory, beige and sepia all carry a yellow-orange cast: an OKLCH hue between 40° and 120°
 * with any visible chroma. A neutral gray has no chroma and passes, at any lightness.
 */
export function isWarmTinted({ a, b }: Oklab): boolean {
  const chroma = Math.hypot(a, b)
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return chroma >= 0.003 && hue >= 40 && hue <= 120
}

export function isPureWhite({ l, a, b }: Oklab): boolean {
  return l > 0.999 && Math.hypot(a, b) < 0.001
}

// anthropic.com's swatches, fetched 2026-10-05, and Plausible's indigo, fetched the same day.
const avoided = [
  ...['#c6613f', '#bcd1ca', '#d97757', '#87867f', '#d1cfc5', '#b0aea5', '#c5d3e0', '#ebcece'],
  ...['#c46686', '#cbcadb', '#e8e6dc', '#faf9f5', '#f0eee6', '#d4a27f', '#ebdbbc', '#ced6bf'],
  ...['#629987', '#e3dacc', '#788c5d', '#e5cada', '#ebc9b7', '#f0ac54', '#827dbd', '#de6262'],
  ...['#6a9bcc', '#141413', '#5e5d59', '#3d3d3a'],
  '#5850ec',
]

// One and a half just noticeable differences (see `distance`). A light or dark neutral sits close
// to anthropic.com's ivories and slates whatever its hue, so the tint that carries it away has to
// be visible.
const clearDistance = 0.03

/**
 * The anthropic.com and Plausible colours that `colour` sits within a clear distance of. Pure white
 * is exempt: it carries no tint, so it reads as no one's palette, and the background rule
 * (`isWarmTinted`) still fails any warm white.
 */
export function avoidedColoursNear(colour: Oklab): string[] {
  if (isPureWhite(colour)) return []
  return avoided.filter((hex) => distance(colour, hexToOklab(hex)) < clearDistance)
}
