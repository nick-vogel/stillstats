import { element } from './dom.ts'
import type { AskBackground } from './messages.ts'
import {
  heldSignInClick,
  type PopupLink,
  type PopupView,
  popupViewOf,
  readForPopup,
  type YouTubeToggle,
} from './popup.ts'
import { linkElement } from './popup-link.ts'
import type { YouTubeAccess } from './youtube-access.ts'

/**
 * Reads the channels and renders the popup into `root`, again after an "Allow access" click or a
 * click on the YouTube access toggle.
 */
export async function renderPopup({
  document,
  root,
  hostAccess,
  youtubeAccess,
  ask,
  storage,
  origin,
}: {
  document: Document
  root: HTMLElement
  hostAccess: { granted: () => Promise<boolean>; request: () => Promise<boolean> }
  youtubeAccess: YouTubeAccess
  ask: AskBackground
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  origin: string
}): Promise<void> {
  const signInClick = heldSignInClick({ storage, ask })

  function linkTo(link: PopupLink, onClick?: () => void): HTMLElement {
    return linkElement({ document, link, ask, onClick })
  }

  /**
   * A switch the creator turns on to ask the browser for YouTube access, and off to give it up.
   * The popup does not register the youtube.com script: the background does, from the browser's
   * own grant, which also covers Firefox closing the popup as its permission prompt opens.
   */
  function toggleParts(toggle: YouTubeToggle): HTMLElement[] {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('role', 'switch')
    input.checked = toggle.on
    input.addEventListener('click', () => {
      // The checkbox has already flipped: checked asks for the grant, unchecked gives it up. Like
      // "Allow access", the request is the click's first call, so it stays inside the gesture.
      const turnOn = input.checked
      void showAfter(asPromise(() => (turnOn ? youtubeAccess.request() : youtubeAccess.remove())))
    })
    const label = element(document, 'label', { className: 'toggle' })
    label.append(input, toggle.label)
    return [label, element(document, 'p', { text: toggle.explanation, className: 'explanation' })]
  }

  function partsOf(view: PopupView): HTMLElement[] {
    if (view.kind === 'host-access-missing') return viewParts(view)
    return [...viewParts(view), ...toggleParts(view.youtubeToggle)]
  }

  function viewParts(view: PopupView): HTMLElement[] {
    switch (view.kind) {
      case 'host-access-missing': {
        const button = element(document, 'button', { text: view.button, className: 'button' })
        button.addEventListener('click', () => {
          // Chrome and Firefox both grant a permission request only inside a user gesture, and
          // Firefox loses the gesture across an await, so the request is the click's first call,
          // made at once and not deferred to a microtask. Chrome grants host access the creator
          // withheld through site access the same way.
          void showAfter(asPromise(() => hostAccess.request()))
        })
        return [element(document, 'p', { text: view.message }), button]
      }
      case 'signed-in': {
        const list = document.createElement('ul')
        list.append(...view.channelNames.map((name) => element(document, 'li', { text: name })))
        return [
          element(document, 'p', { text: view.status }),
          element(document, 'h2', { text: view.heading }),
          list,
          linkTo(view.link),
          linkTo(view.feedbackLink),
        ]
      }
      case 'no-channels':
        return [
          element(document, 'p', { text: view.status }),
          element(document, 'p', { text: view.message }),
          linkTo(view.link),
          linkTo(view.feedbackLink),
        ]
      case 'signed-out':
        return [linkTo(view.link, signInClick.hold)]
      case 'failed':
        return [linkTo(view.link)]
    }
  }

  /** A browser call that throws before it returns a promise rejects instead. */
  function asPromise(call: () => Promise<boolean>): Promise<boolean> {
    try {
      return call()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Reads and renders again once the request settles, however it settles: a failed request leaves
   * access withheld, so the read shows the access prompt again and the creator can click once more.
   */
  async function showAfter(request: Promise<boolean>): Promise<void> {
    await request.catch(() => false)
    await show()
  }

  /**
   * Never rejects: `readForPopup` reads a failure as failed, a failed grant check reads as off, and
   * `sendOn` swallows a failed ask. Reads the YouTube access grant afresh each time, so the toggle
   * shows what the browser grants, however the creator changed it.
   */
  async function show(): Promise<void> {
    const [read, youtubeGranted] = await Promise.all([
      readForPopup({
        hostAccess: hostAccess.granted,
        readChannels: () => ask({ type: 'read-channels' }),
      }),
      asPromise(() => youtubeAccess.granted()).catch(() => false),
    ])
    root.replaceChildren(...partsOf(popupViewOf({ read, origin, youtubeAccess: youtubeGranted })))
    await signInClick.sendOn(read)
  }

  await show()
}
