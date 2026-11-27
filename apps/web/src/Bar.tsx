/**
 * A bar filled to `width`, a percentage of its length. With `rest`, it also draws the length past
 * `width`, so the bar reads as a split of a whole.
 */
export function Bar({ width, rest = false }: { width: number; rest?: boolean }) {
  return (
    <svg className="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
      {rest && <rect className="bar-rest" width="100" height="1" />}
      <rect className="bar" width={width} height="1" />
    </svg>
  )
}
