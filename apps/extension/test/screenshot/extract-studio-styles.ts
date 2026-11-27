// Writes test/fixtures/studio/studio.css, Studio's own stylesheet for the store screenshots
// (creator-analytics#100), from the three Studio pages as Chrome drew them with their styles:
//
//   node apps/extension/test/screenshot/extract-studio-styles.ts <dashboard> <content list> <video analytics>
//
// The saved fixtures carry no style (their README), and a page without Studio's stylesheet draws
// as unstyled text. The full saves those fixtures were cut from hold Studio's styles, and their
// scripts hold the signed-in session, so they stay out of the repository and this script reads
// them from wherever they are kept. Run it again only after the fixtures are saved again.
//
// It takes each page's style elements in the order they stand in its head, with the linked base
// stylesheet, which Studio serves to anyone, fetched in its place, and leaves out a style another
// extension wrote into the page (`foreignStyleIds`). Studio's stylesheet is about 7 MB, so it keeps
// only what the three fixtures use: every style rule whose selector matches an element of at least
// one fixture, with its pseudo-elements and states set aside, every rule inside an at-rule kept
// that way, and every at-rule that matches no element (@font-face, @keyframes, @property). A
// selector the browser cannot test is kept.
import { readFile, writeFile } from 'node:fs/promises'
import { type Chrome, interceptRequests, isYouTubeStatic, launchChrome, openTab } from './chrome.ts'
import {
  fixtureNames,
  readFixture,
  studioStylesId,
  studioStylesPath,
  withStyles,
} from './studio-fixtures.ts'

/**
 * Style elements in the saves that are not Studio's: `ytsd-style` hides Studio's Likes column and
 * trend arrows, and was written by an extension in the browser the pages were saved from.
 */
const foreignStyleIds = ['ytsd-style']

const decode = (text: string) => text.replaceAll('&amp;', '&')

/** The page's stylesheet in the order of its head, without any foreign style. */
async function stylesOf(page: string): Promise<string[]> {
  const head = page.slice(0, page.indexOf('</head>'))
  const sheets: string[] = []
  for (const [, attributes = '', body = '', link] of head.matchAll(
    /<style\b([^>]*)>([\s\S]*?)<\/style>|<link id="base-css"[^>]*href="([^"]+)"[^>]*>/g,
  )) {
    if (link) {
      const response = await fetch(decode(link))
      if (!response.ok) throw new Error(`Studio's base stylesheet answered ${response.status}`)
      sheets.push(await response.text())
      continue
    }
    const id = /\bid="([^"]+)"/.exec(attributes)?.[1]
    if (id && foreignStyleIds.includes(id)) continue
    if (id) throw new Error(`A style element with id "${id}": is it Studio's?`)
    sheets.push(body)
  }
  return sheets
}

/**
 * The paths of the rules that match the page, such as "12" or "40.3" for the fourth rule inside
 * the 41st, in the stylesheet `withStyles` adds.
 */
const matchedRules = `(() => {
  const dynamic = /:(hover|active|focus|focus-visible|focus-within|visited|target)\\b/g
  const pseudoElement = /::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|-webkit-[\\w-]+|-moz-[\\w-]+|part\\([^)]*\\)|slotted\\([^)]*\\))/g
  function matches(selector) {
    const tested = selector.replace(pseudoElement, '').replace(dynamic, '')
    try {
      return tested.split(',').some((part) => document.querySelector(part.trim() || '*') !== null)
    } catch {
      return true
    }
  }
  const kept = []
  function visit(rules, path) {
    ;[...rules].forEach((rule, index) => {
      const here = path === '' ? String(index) : path + '.' + index
      if (rule instanceof CSSStyleRule) {
        if (matches(rule.selectorText)) kept.push(here)
      } else if (rule.cssRules && !(rule instanceof CSSKeyframesRule)) {
        visit(rule.cssRules, here)
      } else {
        kept.push(here)
      }
    })
  }
  visit(document.getElementById(${JSON.stringify(studioStylesId)}).sheet.cssRules, '')
  return kept
})()`

/** The stylesheet with only the rules at `kept`, and the at-rules that hold them. */
const keptStylesheet = (kept: string[]) => `(() => {
  const kept = new Set(${JSON.stringify(kept)})
  function write(rules, path) {
    return [...rules].map((rule, index) => {
      const here = path === '' ? String(index) : path + '.' + index
      if (rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule || !rule.cssRules) {
        return kept.has(here) ? rule.cssText : ''
      }
      const inner = write(rule.cssRules, here)
      if (inner === '') return ''
      return rule.cssText.slice(0, rule.cssText.indexOf('{')).trim() + '{' + inner + '}'
    }).filter(Boolean).join('\\n')
  }
  return write(document.getElementById(${JSON.stringify(studioStylesId)}).sheet.cssRules, '')
})()`

async function keptRulesOf(chrome: Chrome, css: string): Promise<{ kept: string[]; css: string }> {
  const fixtures = await Promise.all(fixtureNames.map(readFixture))
  await interceptRequests(chrome, ({ url }) => {
    const fixture = fixtures.find((each) => each.url === url)
    if (fixture) {
      return { status: 200, type: 'text/html; charset=utf-8', body: withStyles(fixture.html, css) }
    }
    return isYouTubeStatic(url) ? 'network' : 'fail'
  })
  const kept = new Set<string>()
  let tab: Awaited<ReturnType<typeof openTab>> | undefined
  for (const fixture of fixtures) {
    tab = await openTab(chrome, fixture.url, { width: 1280, height: 800, deviceScaleFactor: 1 })
    for (const path of await tab.evaluate<string[]>(matchedRules)) kept.add(path)
  }
  if (!tab) throw new Error('No fixture')
  const order = [...kept]
  return { kept: order, css: await tab.evaluate<string>(keptStylesheet(order)) }
}

const saves = process.argv.slice(2)
if (saves.length !== fixtureNames.length) {
  throw new Error(`Give the three full saves, in the order ${fixtureNames.join(', ')}`)
}
const sheetsOfEach = await Promise.all(
  saves.map(async (save) => stylesOf(await readFile(save, 'utf8'))),
)
// Each page holds the styles Studio had loaded by then, so the one with the most holds the others.
const sheets = sheetsOfEach.reduce((most, each) => (each.length > most.length ? each : most))
for (const each of sheetsOfEach) {
  if (each.some((sheet) => !sheets.includes(sheet))) {
    throw new Error("The saves' stylesheets differ: save the pages again in one sitting")
  }
}
const chrome = await launchChrome()
try {
  const { kept, css } = await keptRulesOf(chrome, sheets.join('\n'))
  const header = `/* Studio's own stylesheet, cut to the rules the saved pages in this folder use, for the store screenshots (creator-analytics#100). Written by apps/extension/test/screenshot/extract-studio-styles.ts; do not edit. ${kept.length} rules. */\n`
  await writeFile(studioStylesPath, header + css)
  console.log(`Wrote ${studioStylesPath}: ${kept.length} rules, ${css.length} characters`)
} finally {
  await chrome.close()
}
