import { surfaceText } from './text.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'

// The S from `apps/site/public/favicon.svg`: its viewBox, and its one path with the same flip. The
// fill is the surrounding text colour, not the favicon's purple, so the icon reads in Studio's light
// and dark themes alike; Studio's dark theme is its own setting, not `prefers-color-scheme`.
const viewBox = '-39 -524.5 560 560'
const pathTransform = 'scale(1 -1)'
const pathData =
  'M268 -10C382 -10 462 44 462 139C462 214 415 256 307 285L252 300C187 318 166 328 166 354C166 378 187 391 222 391C279 391 339 364 387 314L451 410C417 453 340 499 234 499C114 499 36 442 36 346C36 260 100 225 188 202L254 186C306 173 334 163 334 137C334 111 311 99 272 99C198 99 127 142 86 186L20 89C62 30 159 -10 268 -10Z'

/**
 * The extension's icon, drawn inline so the manifest needs no `web_accessible_resources` entry.
 * Its accessible name is "Stillstats", so a screen reader still says whose figure it marks; it has
 * no `<title>`, which would name it twice and put the word back in the surface's text.
 */
export function markOf(document: Document): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, 'svg')
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', surfaceText.markName)
  const path = document.createElementNS(svgNamespace, 'path')
  path.setAttribute('transform', pathTransform)
  path.setAttribute('d', pathData)
  svg.append(path)
  return svg
}
