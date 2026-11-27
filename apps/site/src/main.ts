import { avatarLetterOf } from '@creator-analytics/visual-system/avatar'
import { panel } from './analytics.ts'
import {
  accountBackLinkText,
  avatarLabelOf,
  dashboardLinkText,
  homeBackLinkText,
  type SignedInUser,
  signedInUserOf,
} from './signed-in.ts'
import { siteNavClickedEvent, startSiteNav } from './site-nav.ts'
import { homepageUpgradeLinkClickedEvent, startUpgradeLinks } from './upgrade-link.ts'

/**
 * Starts the web app's sign-in: the API answers with Google's URL, and sign-in lands on /app. It
 * never asks for the hop to the connect consent, because no site page carries consent text. The
 * `source` names the page a button sits on, from its `data-sign-in-source`, and `sign_in_clicked`
 * carries it; a button with none sends the event with no properties, as the homepage's does.
 */
async function signIn(source?: string): Promise<void> {
  // A click before the settings land still sends its event, and the sign-in never waits on it.
  void panel.then((client) =>
    source ? client?.track('sign_in_clicked', { source }) : client?.track('sign_in_clicked'),
  )
  const response = await fetch('/api/auth/sign-in/google', { method: 'POST' })
  if (!response.ok) throw new Error(`The API answered ${response.status}`)
  const { url } = (await response.json()) as { url: string }
  window.location.assign(url)
}

// The header's navigation (creator-analytics#888). A click before the settings land still sends
// its event, and the link never waits on it.
startSiteNav(document, (link) => {
  const { name, properties } = siteNavClickedEvent(link)
  void panel.then((client) => client?.track(name, properties))
})

// The homepage Pro card's "Subscribe" (creator-analytics#907). A click before the settings land
// still sends its event, and the link never waits on it.
startUpgradeLinks(document, () => {
  const { name, properties } = homepageUpgradeLinkClickedEvent()
  void panel.then((client) => client?.track(name, properties))
})

const signInError = document.querySelector<HTMLElement>('[data-sign-in-error]')
for (const button of document.querySelectorAll<HTMLElement>('[data-sign-in]')) {
  button.addEventListener('click', () => {
    signIn(button.dataset.signInSource).catch(() => {
      // Once the button has made way for the dashboard link, there is no sign-in to retry.
      if (signInError && button.isConnected) signInError.hidden = false
    })
  })
}

function linkToApp(className: string): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = className
  link.href = '/app'
  return link
}

/** Each dashboard link on the page, with the sign-in button it stands in for. */
const buttonsSwapped = new Map<HTMLAnchorElement, HTMLElement>()

/**
 * Puts `to` where `from` stands. When `from` held focus, `to` takes it, so a keyboard user stays
 * where they were rather than fall to the top of the page. It never scrolls: `to` stands in the
 * same place at the same size.
 */
function swapKeepingFocus(from: Element, to: HTMLElement): void {
  const focused = document.activeElement === from
  from.replaceWith(to)
  if (focused) to.focus({ preventScroll: true })
}

/**
 * Points each back link at `href` with `text`, in place: the link keeps its node, so focus on it
 * stays, and its arrow stays before the text. It sits alone on its line, so nothing moves. It sends
 * no event (creator-analytics#889).
 */
function pointBackLinks(href: string, text: string): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-back-link]')) {
    link.setAttribute('href', href)
    const label = link.querySelector('[data-back-link-text]')
    if (label) label.textContent = text
  }
}

/**
 * Puts the avatar in the header's held place, swaps each sign-in button for a link to the app at
 * the button's size, so nothing on the page moves, and points the tool page's back link at the
 * account (creator-analytics#889). All three land in the same task. A focused button hands its
 * focus to its link.
 */
function showSignedIn({ email }: SignedInUser): void {
  const place = document.querySelector('[data-avatar-place]')
  // A restored page may already hold an avatar, for this account or for one signed in since.
  const avatar = place?.querySelector<HTMLAnchorElement>('a.avatar') ?? linkToApp('avatar')
  avatar.setAttribute('aria-label', avatarLabelOf(email))
  avatar.textContent = avatarLetterOf(email)
  if (!avatar.isConnected) place?.append(avatar)

  for (const button of document.querySelectorAll<HTMLElement>('[data-sign-in]')) {
    const link = linkToApp('button')
    link.textContent = dashboardLinkText
    // The two labels differ in width in a proportional font. Set through CSSOM, which no
    // content security policy's style-src blocks, unlike a style attribute.
    link.style.inlineSize = `${button.getBoundingClientRect().width}px`
    // The agreement notice keeps its place, so the screenshot does not move up.
    const notice = button.nextElementSibling
    if (notice?.matches('.notice')) notice.classList.add('notice-agreed')
    swapKeepingFocus(button, link)
    buttonsSwapped.set(link, button)
  }
  pointBackLinks('/app', accountBackLinkText)
  // A signed-in visitor has no sign-in to retry, so an error from an earlier click goes.
  if (signInError) signInError.hidden = true
}

/**
 * Takes the avatar away, puts each sign-in button back where its link stands, and points the tool
 * page's back link home again (creator-analytics#889). The button is the node the page loaded
 * with, so it keeps its click listener and its size, and nothing moves. A focused link hands its
 * focus to the button. The avatar's place stays empty, so nothing stands in for it: a focused
 * avatar hands its focus to the header wordmark instead.
 */
function showSignedOut(): void {
  const avatar = document.querySelector('[data-avatar-place] a.avatar')
  // The footer carries a wordmark too, so the header's is named. Focus moves before the avatar
  // goes, so it never falls to the body on the way.
  if (avatar && document.activeElement === avatar) {
    document.querySelector<HTMLElement>('.site-header a.wordmark')?.focus({ preventScroll: true })
  }
  avatar?.remove()
  for (const [link, button] of buttonsSwapped) {
    swapKeepingFocus(link, button)
    button.nextElementSibling?.classList.remove('notice-agreed')
  }
  buttonsSwapped.clear()
  pointBackLinks('/', homeBackLinkText)
}

let latestCheck = 0
/** The number of the newest check whose answer could tell, and so is the one the page shows. */
let latestShown = 0

/**
 * Asks GET /api/me who is signed in and shows the page to the answer. Only an answer that can tell
 * retires older ones; an answer that cannot leaves the newest one that could in place.
 */
async function checkSession(): Promise<void> {
  latestCheck += 1
  const check = latestCheck
  let signedOut = false
  const user = await signedInUserOf(async () => {
    const response = await fetch('/api/me')
    signedOut = response.status === 401
    return response
  })
  // The button's width changes when the web fonts swap in, so it is measured once they have, and
  // the avatar waits with it.
  await document.fonts.ready
  // A restore can ask again while an earlier ask is still out, and the two can answer in either
  // order, so an older answer would put back the session a newer one replaced. Only a user or a
  // 401 can tell: a 5xx or a dropped connection says nothing about who is signed in, so it
  // retires no older answer, and the page keeps the session it shows rather than sign a signed-in
  // visitor out.
  if (check < latestShown || (!user && !signedOut)) return
  latestShown = check
  if (user) showSignedIn(user)
  else showSignedOut()
}

void checkSession()
// A page the back-forward cache restores runs no script again and keeps the session it was left
// with, which a sign-in or a sign-out since may have changed.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) void checkSession()
})
