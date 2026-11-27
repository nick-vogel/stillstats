import { notFoundHeading, notFoundLinkText } from './admin-feedback.ts'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToList } from './route.ts'

/**
 * The not-found screen: the site's not-found heading and a link back to the video list, on the
 * list's route. The admin screen shows it in its place to anyone the API answers 404.
 */
export function NotFound({ route, navigate }: { route: Route; navigate: Navigate }) {
  return (
    <div className="not-found">
      <h1>{notFoundHeading}</h1>
      <RouteLink route={routeToList(route)} navigate={navigate}>
        {notFoundLinkText}
      </RouteLink>
    </div>
  )
}
