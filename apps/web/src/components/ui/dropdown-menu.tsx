import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn's Dropdown Menu, restyled as the account menu's panel: its classes are that panel's whole
// look, which app.css no longer holds, on the theme's token colours (ADR 0014 rule 2), with
// shadcn's shadow, ring, popover, highlight, dark and motion classes gone. The popup is a bordered
// grid on the page's background, its items at the start; the visual system's `:focus-visible`
// ring, not a fill, marks the item that holds focus. A link item keeps the visual system's link
// look, and an item is the old Sign out's text button, underlined in the accent on a hover. The
// hover is `[&:hover]:`, not `hover:`, which Tailwind wraps in `@media (hover: hover)`, as the rule
// it replaces was not. The radius is an arbitrary value because the theme drops Tailwind's radii.
// Only the parts the account menu uses are kept: the sub-menu, checkbox and shortcut parts carried
// shadcn's icons and motion, and a later use copies them again. The radio parts are kept for the
// menu's Theme group (creator-analytics#692): the group is the item group's grid, and a radio item
// is an item, its check after its text in the muted ink, with none of shadcn's motion, shadow,
// dark or highlight classes. The separator, between the
// account menu's groups (creator-analytics#590), is a 1px rule in the border token across the
// popup's width, with none of shadcn's margin or colour. An item lays out its icon before its text,
// the icon 1rem square in the muted ink, as shadcn's items do.
// The positioner sits at z-index 2, not shadcn's 50: above the controls bar (z-index 1 in app.css)
// and below the toast (z-index 3), which must show over an open menu (Nick, browser walk,
// 2026-10-11).
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-2 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'grid max-w-[calc(100vw-2*var(--gutter))] min-w-56 justify-items-start gap-3 rounded-[1rem] border border-border bg-background px-5 py-4 text-foreground outline-none',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
  return (
    <MenuPrimitive.Group
      data-slot="dropdown-menu-group"
      className={cn('grid justify-items-start gap-3', className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn('text-[0.875rem] text-muted-foreground', className)}
      {...props}
    />
  )
}

// A `cn()` call, not a bare string, so the built CSS test reads its classes.
const itemIconLayout = cn(
  'inline-flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
)

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        itemIconLayout,
        'cursor-pointer [&:hover]:underline [&:hover]:decoration-primary',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={cn(itemIconLayout, className)}
      {...props}
    />
  )
}

function DropdownMenuRadioGroup({ className, ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      className={cn('grid justify-items-start gap-3', className)}
      {...props}
    />
  )
}

function DropdownMenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        itemIconLayout,
        'cursor-pointer [&:hover]:underline [&:hover]:decoration-primary',
        className,
      )}
      {...props}
    >
      {children}
      {/* Hidden from the item's name by Base UI; the item's `aria-checked` says it is chosen. */}
      <MenuPrimitive.RadioItemIndicator
        data-slot="dropdown-menu-radio-item-indicator"
        className={cn('inline-flex')}
      >
        <CheckIcon aria-hidden="true" />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('h-px justify-self-stretch bg-border', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
