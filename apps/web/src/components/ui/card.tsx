import type * as React from 'react'
import { cn } from '@/lib/utils'

// shadcn's Card, restyled as an Audience section's box (ADR 0014 rule 2): the numbers table's box,
// a 1px border in the line token and a 0.75rem radius, with the channel summary card's padding. It
// paints no background, so the page's shows through, and shadcn's ring, card colours, size
// variant, spacing variable and image rounding are gone. Only Card is kept: Tailwind's source scan
// would emit the classes of the unused CardHeader, CardTitle and the rest, whose defaults rule 3
// refuses. Never give it the class `card`, which is the channel summary's figure card in app.css.
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-[0.75rem] border border-border p-[1rem_1.25rem]', className)}
      {...props}
    />
  )
}

export { Card }
