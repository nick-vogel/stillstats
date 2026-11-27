import type { MouseEvent, ReactNode } from 'react'
import { hrefOf, type Navigate, type Route } from './route.ts'

/**
 * Follows a click on a link to `route` in place, at the top of the screen unless `land` says
 * otherwise, and returns true. A modified click, or one with a button other than the primary, is
 * left to the browser, which opens the page in a new tab or window, and returns false.
 */
export function followInPlace(
  event: MouseEvent<HTMLAnchorElement>,
  route: Route,
  navigate: Navigate,
  onFollow?: () => void,
  land?: () => void,
): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false
  }
  event.preventDefault()
  onFollow?.()
  navigate(route)
  if (land) land()
  else window.scrollTo(0, 0)
  return true
}

/**
 * A link to another route of the web app, followed in place, at the top of the screen unless `land`
 * says otherwise.
 */
export function RouteLink({
  route,
  navigate,
  className,
  ariaLabel,
  ariaCurrent,
  onFollow,
  land,
  children,
}: {
  route: Route
  navigate: Navigate
  className?: string
  /** The link's accessible name, when its text alone does not say where it goes. */
  ariaLabel?: string
  /** Marks the link to the screen on view. */
  ariaCurrent?: 'page' | undefined
  /** Called when the link is followed in place, before the screen moves. */
  onFollow?: () => void
  /** Where the screen goes once the link is followed in place; unset, the top of the screen. */
  land?: () => void
  children: ReactNode
}) {
  return (
    <a
      className={className}
      href={hrefOf(route)}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={(event) => followInPlace(event, route, navigate, onFollow, land)}
    >
      {children}
    </a>
  )
}
