import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn's Checkbox (base-nova), with its ring, dark, invalid, field and hit-area classes gone, as
// Radio Group's are: they compile to colour-mix() and shadcn's default theme values, which the
// visual system's colour rule refuses (ADR 0014 rule 3), and the focus outline is the visual
// system's own `:focus-visible` rule. The box and its fill are on the theme's token colours: an
// unpicked box takes the raised surface the upgrade cards use (`bg-card`, `--bg-end`), white in
// the light theme.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-input bg-card data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
