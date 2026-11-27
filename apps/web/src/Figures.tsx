export interface Figure {
  label: string
  text: string
}

/** Numbers under their labels. Smaller ones sit under the cards, as the detail screen's do. */
export function Figures({ figures, smaller = false }: { figures: Figure[]; smaller?: boolean }) {
  return (
    <dl className={smaller ? 'figures figures-smaller' : 'figures'}>
      {figures.map(({ label, text }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  )
}
