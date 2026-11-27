import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

// shadcn's Popover, restyled as the account menu's panel (dropdown-menu.tsx): a bordered box on the
// page's background, on the theme's token colours (ADR 0014 rule 2), no wider than the screen
// between its gutters, with shadcn's popover colours, shadow, ring, fixed width, text size and
// motion classes gone. The radius is an arbitrary value because the theme drops Tailwind's radii.
// Only the parts the custom range uses are kept: the header, title and description were shadcn's
// own type scale, and a later use copies them again. The CLI's `cn` import named an npm package,
// not the app's utility, and its dependency was reverted. The positioner sits at z-index 2, not
// shadcn's 50: above the controls bar (z-index 1 in app.css) and below the toast (z-index 3), as
// the account menu's does. The content passes the positioner's `anchor` through, so the Popover
// sits against the control that opened it, and the popup's `initialFocus` and `finalFocus`.
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  anchor,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'anchor'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-2 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'max-w-[calc(100vw-2*var(--gutter))] rounded-[1rem] border border-border bg-background px-5 py-4 text-foreground outline-none',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
