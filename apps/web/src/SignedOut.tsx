import { signedOutConsent } from './consent.ts'

/**
 * The signed-out screen under its heading: the message after "Delete me", which signs the user out,
 * then the sign-in button, the Terms line and what Stillstats reads.
 */
export function SignedOut({ notice, onSignIn }: { notice: string | null; onSignIn: () => void }) {
  return (
    <>
      {notice && (
        <p role="status" className="status-notice">
          {notice}
        </p>
      )}
      <button className="button" type="button" onClick={onSignIn}>
        Sign in with Google
      </button>
      <p className="notice">
        By signing in, you agree to the <a href="/terms">Terms</a> and the{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>
      <section className="consent" aria-labelledby="signed-out-consent-heading">
        <h2 id="signed-out-consent-heading">{signedOutConsent.heading}</h2>
        {signedOutConsent.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>{signedOutConsent.closing}</p>
      </section>
    </>
  )
}
