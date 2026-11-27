import { useId } from 'react'

/**
 * An on and off switch: a native checkbox with the switch role, named by its label alone. With
 * `hint`, a line under the label that the switch is described by, kept outside the label so the
 * name stays the label's. The video list's column switches and the RPM switch on Settings share it.
 */
export function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  /** A line under the label that says more, which the switch is described by. */
  hint?: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const hintId = useId()
  const control = (
    <label className="list-switch">
      <input
        type="checkbox"
        // biome-ignore lint/a11y/useAriaPropsForRole: ARIA in HTML forbids aria-checked on a checkbox, whose checked state the browser exposes.
        role="switch"
        checked={checked}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={({ target }) => onChange(target.checked)}
      />
      {label}
    </label>
  )
  if (hint === undefined) return control
  return (
    <div className="hinted-switch">
      {control}
      <p className="switch-hint" id={hintId}>
        {hint}
      </p>
    </div>
  )
}
