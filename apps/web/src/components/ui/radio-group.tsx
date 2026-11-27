import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

// shadcn's Radio Group, restyled as the visual system's segmented row: one bordered row whose
// segments are the radios, the chosen one filled with the accent. Its classes are that row's whole
// look, which app.css no longer holds, on the theme's token colours (ADR 0014 rule 2), with
// shadcn's ring, dark, invalid, disabled and indicator classes gone: a segment shows its choice by
// its fill, not a dot. Each segment is Base UI's `<span role="radio">`, named by its own text, with
// its hidden input after it, so the end segments are the first and last of their type, not the
// first and last child. The radii are important because the visual system's `:focus-visible` rule
// sits outside Tailwind's layers and would otherwise round a focused segment to 0.25rem. The hover
// is `[&:hover:not([data-checked])]`, not `hover:`, which Tailwind wraps in `@media (hover: hover)`,
// as the rule it replaces was not, and it leaves the chosen segment's text as it is. The focus outline
// is the visual system's own; `relative` keeps it above the next segment's line.
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('flex rounded-field border border-input', className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'relative flex-auto cursor-pointer rounded-none! px-[0.9rem] py-[0.6rem] text-center font-sans text-base/[1.2] font-normal whitespace-nowrap text-muted-foreground not-first:border-s not-first:border-input first-of-type:rounded-s-[0.7rem]! last-of-type:rounded-e-[0.7rem]! data-checked:bg-primary data-checked:text-primary-foreground [&:hover:not([data-checked])]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
