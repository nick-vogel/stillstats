import { adminTabsLabel, feedbackTabText, grantsTabText } from './admin-grants.ts'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToAdminFeedback, routeToAdminGrants } from './route.ts'

/**
 * The tab strip that links the two admin screens, feedback and grants (stillstats#24), each on the
 * list's route, the one on view marked current. Nothing else links to either screen.
 */
export function AdminTabs({ route, navigate }: { route: Route; navigate: Navigate }) {
  const tabs = [
    { text: feedbackTabText, target: routeToAdminFeedback(route), current: !!route.adminFeedback },
    { text: grantsTabText, target: routeToAdminGrants(route), current: !!route.adminGrants },
  ]
  return (
    <nav className="admin-tabs" aria-label={adminTabsLabel}>
      {tabs.map(({ text, target, current }) => (
        <RouteLink
          key={text}
          route={target}
          navigate={navigate}
          ariaCurrent={current ? 'page' : undefined}
        >
          {text}
        </RouteLink>
      ))}
    </nav>
  )
}
