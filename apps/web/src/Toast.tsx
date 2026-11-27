import { useEffect, useRef } from 'react'
import { useToastManager } from '@/components/ui/toast'
import { toastSeconds } from './toast.ts'

/** What the toast shows: one notice at a time, and a new `key` for each new one. */
export interface ToastNotice {
  /** Changes for each new notice, which shows anew and starts the wait over. */
  key: string
  text: string
  /** A success's message, which starts with a check mark. */
  success: boolean
  /** Closes itself after `toastSeconds`; one that asks the creator to act waits for its close. */
  timed: boolean
  /** The creator closed it, at its close button or by its wait. */
  onClose: () => void
}

/** The one toast's id in the toaster: only one notice ever shows. */
const toastId = 'notice'

/**
 * Keeps the toaster's one toast in step with the notice on view: shows each new one, fixed at the
 * bottom of the screen wherever the creator scrolled, and closes it once the notice ends, as when
 * the route changes or a consent screen opens. Base UI holds the wait, which a pointer on the toast
 * or a keyboard focus in it holds. Only the creator's own close, the close button or the wait,
 * reaches `onClose`: a close the app makes leaves the notice, which a closing consent screen shows
 * again. An old toast's close never reaches a newer notice, as when its wait ends after a new
 * notice renders and before the effect closes the old toast (creator-analytics#387). Nor does an old
 * toast's exit remove a newer notice, though every notice shares the one id: Base UI reads the
 * toast an exit ends for through a latest ref, and a notice shown again during the exit cancels
 * that exit's end (creator-analytics#389). Renders inside the `Toaster`, and draws nothing itself.
 */
export function ToastShown({ notice }: { notice: ToastNotice | null }) {
  const { add, close } = useToastManager()
  // The latest notice, so a new render of the app neither shows the toast again nor closes a stale
  // one. A render moves it to a new notice before the effect closes the old toast, so a toast's
  // close checks the key it was shown for before it reaches the notice's `onClose`.
  const latest = useRef(notice)
  latest.current = notice
  const closingFromTheApp = useRef(false)
  const key = notice?.key ?? null
  useEffect(() => {
    const shown = latest.current
    if (key === null || shown === null) return
    add({
      id: toastId,
      description: shown.text,
      type: shown.success ? 'success' : undefined,
      timeout: shown.timed ? toastSeconds * 1000 : 0,
      onClose: () => {
        if (closingFromTheApp.current || latest.current?.key !== key) return
        latest.current.onClose()
      },
    })
    return () => {
      closingFromTheApp.current = true
      close(toastId)
      closingFromTheApp.current = false
    }
  }, [key, add, close])
  return null
}
