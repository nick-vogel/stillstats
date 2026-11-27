import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

// shadcn's Tooltip, restyled as the collapsed sidebar's names: a bordered box on the page's
// background in the body's ink, at the support item's 0.875rem, on the theme's token colours (ADR
// 0014 rule 2), with shadcn's inverted fill, radius, kbd, slide, fade, zoom and motion classes gone,
// and its arrow, whose fill was shadcn's ink, dropped. The positioner sits at z-index 2, as the
// account menu's does: above the controls bar (z-index 1 in app.css) and below the toast (z-index
// 3). Base UI opens it on a hover and on a focus of its trigger, and not on a touch device.
function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-2"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'w-fit max-w-xs rounded-[0.5rem] border border-border bg-background px-2 py-1 text-[0.875rem] text-foreground',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
