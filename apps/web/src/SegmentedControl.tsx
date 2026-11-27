import { useId } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { Option } from './ListSelect.tsx'

/**
 * One choice of a few, as Base UI's radio group drawn as one row of segments: the group is one tab
 * stop, on the chosen segment, and the arrow keys move the choice. The group is labelled by the
 * label above it.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}) {
  const labelId = useId()
  return (
    <div className="min-w-0 flex-[0_1_auto] text-[0.875rem] text-muted-foreground">
      <span id={labelId} className="mb-[0.35rem] block">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(chosen) => {
          const option = options.find((each) => each.value === chosen)
          if (option) onChange(option.value)
        }}
      >
        {options.map((option) => (
          <RadioGroupItem key={option.value} value={option.value}>
            {option.label}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </div>
  )
}
