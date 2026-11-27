// The theme's rule, one module for the app and for the head script (`theme-script.ts`), which the
// build bundles on its own and the page loads before the stylesheet. It imports no React and no
// value from another module, so that script stays a few hundred bytes. It names no DOM type, so the
// built web app's test, which runs outside the DOM's types, can import its key.
import type { Theme } from '@creator-analytics/api-types'

/**
 * The `localStorage` key of the browser's copy of the theme, on the app's origin. The head script
 * reads it before the first paint, before the preferences read can land.
 */
export const themeCopyKey = 'theme'

/** The storage that holds the copy: the browser's `localStorage`, or a stand-in for it. */
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The element that carries `data-theme`: the page's root, `document.documentElement`. */
export interface ThemeRoot {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

/** The theme a stored copy gives: Light or Dark, exactly; a missing or any other copy is System. */
export function themeOfCopy(copy: string | null): Theme {
  return copy === 'light' || copy === 'dark' ? copy : 'system'
}

/** The theme the browser's copy gives, System when the browser blocks its storage. */
export function storedTheme(storage: ThemeStorage): Theme {
  try {
    return themeOfCopy(storage.getItem(themeCopyKey))
  } catch {
    return 'system'
  }
}

/**
 * The page's `localStorage`, reached on each call, so a browser that throws on the reach itself,
 * as a blocked site's storage can, throws where `storedTheme` and `applyTheme` catch it.
 */
export const pageStorage: ThemeStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

/**
 * Applies `theme` to the page: Light or Dark sets `data-theme` on `root` and writes the copy, and
 * System removes both, so the tokens follow the system. A storage the browser blocks, as a private
 * window can, keeps no copy, and the attribute is set all the same.
 */
export function applyTheme(theme: Theme, root: ThemeRoot, storage: ThemeStorage): void {
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    if (theme === 'system') storage.removeItem(themeCopyKey)
    else storage.setItem(themeCopyKey, theme)
  } catch {
    // No copy: the next load draws System until the preferences read lands.
  }
}
