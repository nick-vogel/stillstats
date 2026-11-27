import { useEffect, useRef } from 'react'
import { track } from './analytics.ts'
import { QuietButton } from './QuietButton.tsx'
import { RouteLink } from './RouteLink.tsx'
import type { Navigate, Route } from './route.ts'
import {
  type Neighbour,
  type RefusedPlace,
  refusedPageText,
  retryText,
  type StepDirection,
  type StepPlace,
  type Stepper,
  type StepperPosition,
  stepLabelOf,
  stepperNames,
  stepRouteOf,
  stepTextOf,
  videoSteppedEvent,
} from './video-step.ts'

const directions: StepDirection[] = ['previous', 'next']

/**
 * The videos either side of this one in the list the detail screen was opened from, as two links in
 * two fixed places, the list's previous then its next. Their words follow the list's sort
 * (`stepTextOf`): which way in publish date in a date sort, which way in the list in any other. A
 * place with no link, at an end of the list or while the page it needs is read, stays empty, so the
 * other link does not move; a place whose page was refused says so, with a button that reads the
 * page again. When the list's own page was refused, both places hang off it, so the whole stepper
 * is one such failure across its width. No key opens either link: they are reached with Tab. With
 * no stepper, for a video not on the list's page, nothing shows. The stepper is named for its
 * `position` on the screen, in every state, so a screen reader tells the two apart.
 *
 * "Try again" leaves with the refused place, so focus moves to the stepper while the page is read,
 * and then to what lands in the place: the step, or "Try again" when the page is refused again. For
 * the whole stepper, what lands is its first link or button, once neither place is still read. When
 * the list's own page lands without the video, so no stepper shows, the stepper and the focus in it
 * are gone, and the screen is told (`onGone`) to give focus to its title.
 */
export function VideoStepper({
  stepper,
  position,
  listRoute,
  navigate,
  onStep,
  onRetry,
  onGone,
}: {
  stepper: Stepper | RefusedPlace | null
  /** Where this stepper stands on the screen, which names it. */
  position: StepperPosition
  /** The route the list reads, whose page and controls a step keeps. */
  listRoute: Route
  navigate: Navigate
  /** Told the video a step opens in place, before the screen moves to it. */
  onStep: (neighbour: Neighbour) => void
  /** Reads the refused list `page` again. It sends no product event: the API logs each failed read. */
  onRetry: (page: number) => void
  /**
   * Told when a "Try again" this stepper pressed brings back no stepper, so the screen can give
   * focus to its title.
   */
  onGone: () => void
}) {
  const nav = useRef<HTMLElement>(null)
  // The place whose "Try again" this stepper pressed, a direction or the whole stepper, until it
  // stops reading.
  const retried = useRef<StepDirection | 'whole' | null>(null)
  useEffect(() => {
    const pressed = retried.current
    if (pressed === null) return
    if (stepper === null) {
      retried.current = null
      // The focused stepper unmounted, so focus fell to the page; focus the creator has since moved
      // elsewhere stays where it is.
      if (document.activeElement === document.body || document.activeElement === null) onGone()
      return
    }
    const whole = 'refused' in stepper
    if (!whole) {
      const reading =
        pressed === 'whole'
          ? stepper.previous === 'reading' || stepper.next === 'reading'
          : stepper[pressed] === 'reading'
      if (reading) return
    }
    retried.current = null
    // Focus the creator has since moved elsewhere stays where it is.
    if (document.activeElement !== nav.current) return
    nav.current
      ?.querySelector<HTMLElement>(
        pressed === 'whole' || whole
          ? 'a, button'
          : `a.video-stepper-${pressed}, .video-stepper-${pressed} button`,
      )
      ?.focus()
  })

  function retry(pressed: StepDirection | 'whole', page: number) {
    retried.current = pressed
    nav.current?.focus()
    onRetry(page)
  }

  if (stepper === null) return null
  if ('refused' in stepper) {
    const { refused } = stepper
    return (
      <nav className="video-stepper" aria-label={stepperNames[position]} ref={nav} tabIndex={-1}>
        <span className="video-stepper-failed video-stepper-whole">
          {refusedPageText}{' '}
          <QuietButton onClick={() => retry('whole', refused)}>{retryText}</QuietButton>
        </span>
      </nav>
    )
  }
  return (
    // Two of these are on the screen, in the head and at the bottom, so each is named for where it
    // stands. It takes focus only from "Try again", so it is not in the Tab order.
    <nav className="video-stepper" aria-label={stepperNames[position]} ref={nav} tabIndex={-1}>
      {directions.map((direction) => (
        <StepLink
          key={direction}
          direction={direction}
          place={stepper[direction]}
          listRoute={listRoute}
          navigate={navigate}
          onStep={onStep}
          onRetry={(page) => retry(direction, page)}
        />
      ))}
    </nav>
  )
}

function StepLink({
  direction,
  place,
  listRoute,
  navigate,
  onStep,
  onRetry,
}: {
  direction: StepDirection
  place: StepPlace
  listRoute: Route
  navigate: Navigate
  onStep: (neighbour: Neighbour) => void
  onRetry: (page: number) => void
}) {
  const className = `video-stepper-${direction}`
  if (place === null || place === 'reading') return <span className={className} />
  if ('refused' in place) {
    const { refused } = place
    return (
      <span className={`${className} video-stepper-failed`}>
        {refusedPageText} <QuietButton onClick={() => onRetry(refused)}>{retryText}</QuietButton>
      </span>
    )
  }
  return (
    <RouteLink
      route={stepRouteOf(listRoute, place)}
      navigate={navigate}
      className={className}
      ariaLabel={stepLabelOf(direction, listRoute.sort, place.title)}
      onFollow={() => {
        onStep(place)
        track(videoSteppedEvent(direction))
      }}
    >
      {stepTextOf(listRoute.sort)[direction]}
    </RouteLink>
  )
}
