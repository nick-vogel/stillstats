import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// shadcn's Button, restyled to the visual system (ADR 0014 rule 2). The look is the visual system's
// own `.button` and app.css's `.button-quiet`, which sit outside Tailwind's layers and so outrank
// any utility: shadcn's sizes, colours, ring, dark and motion classes are gone.
const buttonVariants = cva('button [&_svg]:pointer-events-none [&_svg]:shrink-0', {
  variants: {
    variant: {
      default: '',
      quiet: 'button-quiet',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

function Button({
  className,
  variant = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
