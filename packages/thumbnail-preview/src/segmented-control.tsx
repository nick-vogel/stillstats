// Ported from nick-vogel/nlvogel-site's `src/components/tools/SegmentedControl.tsx` at `6d5d921`.
import { useId } from 'react'

/**
 * The toolbar's segmented control: a visible label, then one button per option, the active one
 * pressed. One component for every control in the strip, so they keep one grammar.
 *
 * The group's name comes from the visible label through `aria-labelledby`, never from an
 * `aria-label` repeating it: two copies of a name start to disagree. Each option is a pressed
 * toggle rather than a radio, since its effect is immediate and needs no submit, and a radio group
 * would put the options on one tab stop with arrow keys, which is wrong in a strip of buttons.
 */
export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const labelId = useId()

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend will not sit in the well's flex row beside the options, and the group's name comes from the visible label either way.
    <div className="t-seg" role="group" aria-labelledby={labelId}>
      <span className="t-seg__label" id={labelId}>
        {label}
      </span>
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
