import { useEffect, useRef, useState } from 'react'
import { type ConsentRequest, consentScreens } from './consent.ts'
import { QuietButton } from './QuietButton.tsx'

/** Takes the place of the main view until the creator continues to Google or cancels. */
export function ConsentScreen({
  request,
  onContinue,
  onError,
  onCancel,
}: {
  request: ConsentRequest
  onContinue: () => Promise<void>
  onError: (reason: unknown) => void
  onCancel: () => void
}) {
  const { heading, paragraphs } = consentScreens[request.consent]
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [continuing, setContinuing] = useState(false)

  // The view changes under the button that opened it, so focus moves to the new heading.
  useEffect(() => headingRef.current?.focus(), [])

  // Back from Google can restore this page from the back/forward cache, button still disabled.
  useEffect(() => {
    const enable = (event: PageTransitionEvent) => event.persisted && setContinuing(false)
    window.addEventListener('pageshow', enable)
    return () => window.removeEventListener('pageshow', enable)
  }, [])

  // Disabled until the browser leaves for Google, so a double-click sends one event and one
  // request. A failure enables it again, so the creator can retry.
  function continueToGoogle() {
    setContinuing(true)
    onContinue().catch((reason: unknown) => {
      setContinuing(false)
      onError(reason)
    })
  }

  return (
    <section className="consent" aria-labelledby="consent-heading">
      <h2 id="consent-heading" ref={headingRef} tabIndex={-1}>
        {heading}
      </h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <a href="/privacy">Read the privacy policy</a>
      <div className="app-actions">
        <button className="button" type="button" disabled={continuing} onClick={continueToGoogle}>
          Continue to Google
        </button>
        <QuietButton onClick={onCancel}>Cancel</QuietButton>
      </div>
    </section>
  )
}
