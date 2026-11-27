import { ChevronDownIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// shadcn's Native Select, restyled as the web app's select: its classes are that select's whole
// look, on the theme's token colours (ADR 0014 rule 2), with shadcn's sizes, ring, dark, selection,
// disabled and motion classes gone. It stays a native <select>, so a phone opens its own picker.
// The wrapper is a span, not a div, because it sits inside a <label>, and `className` reaches the
// select, not the wrapper. The inline-end padding is the chevron's room, so no option text runs
// under it. The radius is important because the visual system's `:focus-visible` rule sits outside
// Tailwind's layers and would otherwise round a focused select to 0.25rem. The background is the
// shorthand: the minifier writes `background-color: transparent` as the colour literal #0000, which
// the rule 3 test refuses. The hover is `[&:hover]`, not `hover:`, which Tailwind wraps in
// `@media (hover: hover)`, as the rule it replaces was not. The options carry no class: shadcn's
// Canvas colours are system colours outside the tokens.
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <span className="relative grid min-w-0" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none rounded-field! border border-input [background:transparent] py-[0.6rem] ps-[0.8rem] pe-[2.25rem] font-sans text-base/[1.2] font-normal text-foreground text-ellipsis [&:hover]:border-primary',
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute inset-e-[0.8rem] top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </span>
  )
}

function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option data-slot="native-select-option" {...props} />
}

function NativeSelectOptGroup(props: React.ComponentProps<'optgroup'>) {
  return <optgroup data-slot="native-select-optgroup" {...props} />
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
