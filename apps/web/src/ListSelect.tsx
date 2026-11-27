import { type Ref, useId } from 'react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

export interface Option<T extends string> {
  value: T
  label: string
}

/**
 * The web app's one select: a label over the copied Native Select, whose lucide chevron has room
 * of its own, so every select looks the same in the visual system. Inline sets the label beside the
 * select, as the header does, rather than above it, as a form field does. `className` places the
 * label in its screen's layout. The label both holds the select and names it with `htmlFor`, so
 * the name holds and lint sees the control a component renders. `ref` reaches the select.
 */
export function ListSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  inline = false,
  className,
  ref,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  inline?: boolean
  className?: string
  ref?: Ref<HTMLSelectElement> | undefined
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        inline ? 'flex items-center gap-[0.5rem]' : 'grid gap-[0.35rem]',
        'text-[0.875rem] text-muted-foreground',
        className,
      )}
    >
      {label}
      <NativeSelect
        id={id}
        ref={ref}
        className={inline ? 'w-auto font-medium' : undefined}
        value={value}
        onChange={({ target }) => {
          const chosen = options.find((option) => option.value === target.value)
          if (chosen) onChange(chosen.value)
        }}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  )
}
