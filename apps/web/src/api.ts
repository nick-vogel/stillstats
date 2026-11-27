import type { ErrorAnswer, RefusalAnswer } from '@creator-analytics/api-types'

/** Reads one of the API's answers. A refusal or an error arrives as the answer, not as a throw. */
export async function readAnswer<T>(path: string): Promise<T | RefusalAnswer | ErrorAnswer> {
  try {
    const response = await fetch(path)
    return (await response.json()) as T | RefusalAnswer | ErrorAnswer
  } catch {
    return { error: 'internal' }
  }
}

/**
 * Hands the read's result to `onRead`, or its failure's text to `onFail`, unless the cancel it
 * answers runs first. An effect returns the cancel, so a slow read for an earlier channel or route
 * never lands over the current one.
 */
export function latestOnly<T>(
  read: Promise<T>,
  onRead: (result: T) => void,
  onFail: (message: string) => void,
): () => void {
  let current = true
  read.then(
    (result) => current && onRead(result),
    (reason: unknown) => current && onFail(String(reason)),
  )
  return () => {
    current = false
  }
}
