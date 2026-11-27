// The modes the browser walk visits every route in (creator-analytics#382), apart from the browser
// so a test can read them. A library that injects a style only under a media query, or only on a
// narrow screen, raises its violation only in that mode, so the walk replays every route it visits
// in each one through Chrome DevTools emulation.

/** A colour scheme for `prefers-color-scheme`, and whether the screen is a phone's 375px. */
export interface WalkMode {
  colorScheme: 'light' | 'dark'
  phone: boolean
}

/** Light mode at the desktop width first: the walk's first pass, and every state after it. */
export const walkModes: readonly [WalkMode, ...WalkMode[]] = [
  { colorScheme: 'light', phone: false },
  { colorScheme: 'dark', phone: false },
  { colorScheme: 'light', phone: true },
  { colorScheme: 'dark', phone: true },
]

/** The step name of a visit to `path` in `mode`, which a violation in that visit carries. */
export function routeStep(path: string, { colorScheme, phone }: WalkMode): string {
  return [
    `route: ${path}`,
    colorScheme === 'dark' ? ' in dark mode' : '',
    phone ? ' at a phone width' : '',
  ].join('')
}
