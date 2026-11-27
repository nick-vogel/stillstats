import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn's Select (base-nova, on Base UI), restyled as the account menu's panel (ADR 0014 rule 2),
// for the sidebar's channel picker (creator-analytics#531). The popup and its items carry their
// whole look here, on the theme's token colours: a bordered grid on the page's background, at
// z-index 2 as the account menu's is, its items at the start, the visual system's `:focus-visible`
// ring, not a fill, on the item that holds focus, and an underline in the accent on a hover. The
// hover is `[&:hover]:`, not `hover:`, which Tailwind wraps in `@media (hover: hover)`. The radii
// are arbitrary values because the theme drops Tailwind's. The trigger's row is app.css's, as the
// sidebar's rows are, so it takes only the caller's class. Taken out: shadcn's input border,
// popover and accent fills, shadow, ring, the `data-open`, `data-closed` and `data-side` fade,
// zoom and slide classes, and every transition and animation. Only the parts the picker uses are
// kept: the value, group, label, separator and scroll arrow parts are not, and a later use copies
// them again, restyled.
const Select = SelectPrimitive.Root

function SelectTrigger({ children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" {...props}>
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-2 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-(--available-height) max-w-[calc(100vw-2*var(--gutter))] min-w-56 overflow-y-auto rounded-[1rem] border border-border bg-background p-2 text-foreground outline-none',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List className="grid gap-1">{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'grid cursor-pointer grid-cols-[1fr_1rem] items-center gap-2 rounded-[0.5rem] px-3 py-2 [&:hover]:underline [&:hover]:decoration-primary',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="col-start-2 grid place-items-center">
        <CheckIcon aria-hidden="true" className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger }
