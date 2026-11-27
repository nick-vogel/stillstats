// Each extension event is one creator action or one surface render after a debounced Studio
// navigation, so one creator moving through Studio sends a few a minute. 60 a minute stays far above
// that and caps a flooding account at 3,600 an hour against the self-hosted OpenPanel.
export const eventLimitPerWindow = 60
export const eventWindowMs = 60_000

export interface EventLimit {
  /** Counts the user's event, and is false once the user has already sent the limit this window. */
  admit(userId: string): boolean
}

/**
 * Fixed windows aligned to the epoch, counted in the API process. The counts hold only the current
 * window's users and are dropped when the window changes.
 */
export function createEventLimit({
  clock = () => new Date(),
}: {
  clock?: () => Date
} = {}): EventLimit {
  const counts = new Map<string, number>()
  let window: number | undefined
  return {
    admit(userId) {
      const current = Math.floor(clock().getTime() / eventWindowMs)
      if (current !== window) {
        counts.clear()
        window = current
      }
      const count = counts.get(userId) ?? 0
      if (count >= eventLimitPerWindow) return false
      counts.set(userId, count + 1)
      return true
    },
  }
}
