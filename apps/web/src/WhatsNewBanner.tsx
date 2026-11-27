import { X } from 'lucide-react'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToWhatsNew } from './route.ts'
import { bannerCloseLabel, bannerLabel, bannerLinkText, bannerText } from './whats-new.ts'

/**
 * The "What's new" banner: one plain line with a link to "What's new", followed in place, and a
 * close button. It holds no count, no badge, no colour alarm and no animation, and one press of
 * either takes it away (ADR 0011, ADR 0018).
 */
export function WhatsNewBanner({
  route,
  navigate,
  onOpened,
  onClose,
}: {
  route: Route
  navigate: Navigate
  /** Called when the link is followed in place. */
  onOpened: () => void
  onClose: () => void
}) {
  return (
    <section className="whats-new-banner" aria-label={bannerLabel}>
      <p>
        {bannerText}{' '}
        <RouteLink route={routeToWhatsNew(route)} navigate={navigate} onFollow={onOpened}>
          {bannerLinkText}
        </RouteLink>
      </p>
      <button type="button" aria-label={bannerCloseLabel} onClick={onClose}>
        <X aria-hidden="true" />
      </button>
    </section>
  )
}
