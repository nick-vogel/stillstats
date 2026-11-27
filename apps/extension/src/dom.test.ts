// @vitest-environment jsdom
// Limits: jsdom opens no tab, so these tests cannot show the browser honouring `rel` or opening the
// tab on a click or a middle-click; creator-analytics#99 and #101 check that by hand in Chrome and
// Firefox.
import { expect, test } from 'vitest'
import { newTabLink, whenOpened } from './dom.ts'

const stillstats = { text: 'Open Stillstats', href: 'https://stillstats.example/' }

test('a new-tab link opens in a new tab, with no opener and no referrer', () => {
  const link = newTabLink(document, stillstats)

  expect({
    text: link.textContent,
    href: link.href,
    target: link.target,
    rel: [...link.relList].sort(),
  }).toEqual({
    text: 'Open Stillstats',
    href: 'https://stillstats.example/',
    target: '_blank',
    rel: ['noopener', 'noreferrer'],
  })
})

function auxClick(element: HTMLElement, button: number): void {
  element.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button }))
}

test.for([
  ['a click opens the link', (link: HTMLAnchorElement) => link.click(), 1],
  [
    'a middle-click, which opens the link in a new tab, opens it',
    (link: HTMLAnchorElement) => auxClick(link, 1),
    1,
  ],
  [
    'a right-click, which opens only the context menu, does not',
    (link: HTMLAnchorElement) => auxClick(link, 2),
    0,
  ],
] as const)('%s', ([, press, opens]) => {
  let opened = 0
  const link = whenOpened(newTabLink(document, stillstats), () => opened++)

  press(link)

  expect(opened).toBe(opens)
})
