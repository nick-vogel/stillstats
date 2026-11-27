import { describe, expect, test } from 'vitest'
import { upgradeLinkClickedEvent } from '../../web/src/upgrade-prompt.ts'
import { homepageUpgradeLinkClickedEvent } from './upgrade-link.ts'

// creator-analytics#907: the homepage's "Subscribe" and the web app's sidebar item send one event,
// told apart by where it came from, so one OpenPanel report counts both.
describe("the homepage's Subscribe event", () => {
  test("is the web app's upgrade_link_clicked, from the homepage", () => {
    const { name, source } = upgradeLinkClickedEvent('homepage')

    expect(homepageUpgradeLinkClickedEvent()).toEqual({ name, properties: { source } })
  })
})
