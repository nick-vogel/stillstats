import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { CheckIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn's Toast, restyled as the app's one toast: its classes are that toast's whole look, which
// app.css no longer holds, on the theme's token colours (ADR 0014 rule 2), with shadcn's shadow,
// ring, popover, dark, motion, swipe transform and stacking classes gone, as only one toast ever
// shows. The viewport is fixed at the bottom of the screen, so the toast shows wherever the
// creator scrolled. Its classes centre it in the window; beside the sidebar's column, app.css's
// rule centres it in the screen to the sidebar's right instead (creator-analytics#508). It sits at
// z-index 3: above the controls bar (z-index 1 in app.css) and the account menu's popup (z-index
// 2, in dropdown-menu.tsx) (Nick, browser walk, 2026-10-11). The bottom space keeps it clear of a phone's home bar. The box is the notice box's look, its tint
// over the page's background so the page under it does not show through. The radii are important
// because the visual system's `:focus-visible` rule sits outside Tailwind's layers and would
// otherwise round the focused toast, or its ×, to 0.25rem. The backgrounds are the shorthand: the
// minifier writes `background-color: transparent` as the colour literal #0000, which the rule 3
// test refuses. The hover is `[&:hover]:`, not `hover:`, which Tailwind wraps in
// `@media (hover: hover)`, as the rule it replaces was not. The portal sits on the document's
// body, outside `.app`, so the description sets its own margin. Only the parts the app's toast
// uses are kept: the title, the action and shadcn's other icons carried its motion and colours,
// and a later use copies them again.
function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed inset-x-(--gutter) bottom-[max(1rem,env(safe-area-inset-bottom))] z-3 mx-auto w-fit',
        className,
      )}
      {...props}
    />
  )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        'rounded-field! border border-primary py-2 pr-2 pl-4 text-foreground [background:linear-gradient(var(--bg-glow),var(--bg-glow)),var(--bg)]',
        className,
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('m-0', className)}
      {...props}
    />
  )
}

/** The toast's ×: a round 2rem target in the toast's ink. */
function ToastClose({ className, children, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        'grid size-8 flex-none cursor-pointer place-items-center rounded-full! border-0 p-0 text-inherit [background:0_0] [&:hover]:[background:var(--bg-glow)]',
        className,
      )}
      {...props}
    >
      {children ?? <XIcon className="size-4" aria-hidden="true" />}
    </ToastPrimitive.Close>
  )
}

/** A success's check mark, in the accent, before its message. Any other toast has none. */
function ToastIcon({ type }: { type: string | undefined }) {
  if (type !== 'success') return null
  return (
    <CheckIcon
      data-slot="toast-icon"
      className="size-[1em] flex-none text-primary"
      strokeWidth={2.5}
      aria-hidden="true"
    />
  )
}

/**
 * Each toast the manager holds, its description a status a screen reader reads. The close button
 * stays on the accessibility tree, where Base UI hides it until the stack expands: only one toast
 * ever shows, so there is no stack.
 */
function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <ToastDescription role="status" />
        <ToastClose aria-label={closeLabel} aria-hidden={false} />
      </ToastContent>
    </Toast>
  ))
}

/** The provider, and the viewport its toasts show in, with `children` able to add them. */
function Toaster({
  children,
  closeLabel,
  ...props
}: ToastPrimitive.Provider.Props & { closeLabel: string }) {
  return (
    <ToastProvider {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList closeLabel={closeLabel} />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const useToastManager = ToastPrimitive.useToastManager

export {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  Toaster,
  ToastPortal,
  ToastProvider,
  ToastViewport,
  useToastManager,
}
