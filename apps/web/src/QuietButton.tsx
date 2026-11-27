import type { ReactNode } from 'react'

export function QuietButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className="button button-quiet" type="button" onClick={onClick}>
      {children}
    </button>
  )
}
