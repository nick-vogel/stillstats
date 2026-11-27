import highlights from 'virtual:highlights'
import { RouteLink } from './RouteLink.tsx'
import type { Navigate, Route } from './route.ts'
import {
  noHighlightsText,
  releaseLinkTextOf,
  screenLinkText,
  screenRouteOf,
  whatsNewHeading,
} from './whats-new.ts'

/**
 * "What's new": every highlight in the build, newest release first (`virtual:highlights`), each
 * with its title, its description, a link to its release page on the site, and a link to its
 * screen, followed in place on the channel on view, when it has one. With no highlight in the
 * build, one line says so. It reads no channel, so it shows for a creator with none. The sidebar
 * link that opened it stays on view and keeps focus.
 */
export function WhatsNew({ route, navigate }: { route: Route; navigate: Navigate }) {
  return (
    <div className="whats-new">
      <h1>{whatsNewHeading}</h1>
      {highlights.length === 0 ? (
        <p>{noHighlightsText}</p>
      ) : (
        <ul className="whats-new-list">
          {highlights.map(({ name, title, html, release, releasePath, screen }) => (
            <li className="whats-new-item" key={name}>
              <article>
                <h2>{title}</h2>
                <div
                  className="whats-new-description"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: the build's own markup, which the release content package wrote at build time from the repository's markdown with no raw HTML (ADR 0018), never anything a visitor sent.
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <p className="whats-new-links">
                  {/* The API serves the site's release pages on the web app's origin. */}
                  <a href={releasePath}>{releaseLinkTextOf(release)}</a>
                  {screen !== undefined && (
                    <RouteLink route={screenRouteOf(screen, route)} navigate={navigate}>
                      {screenLinkText}
                    </RouteLink>
                  )}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
