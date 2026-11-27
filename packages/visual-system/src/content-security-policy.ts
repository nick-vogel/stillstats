/** The hosts a build sends events and errors to, from its VITE_ environment. */
export interface ReportingHosts {
  openPanelApiUrl?: string | undefined
  glitchtipDsn?: string | undefined
}

/**
 * The content security policy every site page but a tool page, and the web app's page, carry
 * (ADR 0007), one policy so they cannot drift. A tool page carries
 * `toolPageContentSecurityPolicyOf`, this policy with one source more. YouTube's image hosts serve the web app's thumbnails. The build writes
 * it into each page, not the API into a header, because only the build knows the OpenPanel and
 * GlitchTip hosts.
 */
export function contentSecurityPolicyOf({ openPanelApiUrl, glitchtipDsn }: ReportingHosts): string {
  const reporting = [openPanelApiUrl, glitchtipDsn].flatMap((url) =>
    url ? [new URL(url).origin] : [],
  )
  return [
    "default-src 'self'",
    // ADR 0019 and ADR 0020: on a video's screen that holds the player, YouTube's IFrame API
    // loader, and the player script it injects, come from www.youtube.com, and the player's frame
    // from the privacy-enhanced host. No other third-party script or frame.
    "script-src 'self' https://www.youtube.com",
    'frame-src https://www.youtube-nocookie.com',
    "style-src 'self'",
    "font-src 'self'",
    // data: holds the visual system's grain texture. A private or unlisted video's thumbnail comes
    // from a numbered host such as i9.ytimg.com, so the policy names every ytimg.com host.
    "img-src 'self' data: https://*.ytimg.com",
    ["connect-src 'self'", ...reporting].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/**
 * The policy a tool page carries (ADR 0021): every page's policy, with `blob:` added to `img-src`.
 * The tool shows a creator's own files through `URL.createObjectURL`, so nothing is uploaded, and
 * `blob:` admits only the object URLs the page itself made. Built from the base, so the two cannot
 * drift.
 */
export function toolPageContentSecurityPolicyOf(hosts: ReportingHosts): string {
  return contentSecurityPolicyOf(hosts)
    .split('; ')
    .map((directive) => (directive.startsWith('img-src ') ? `${directive} blob:` : directive))
    .join('; ')
}
