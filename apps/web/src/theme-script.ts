// The head script: the build bundles it on its own, as one classic script, and the page loads it
// in the head before the stylesheet (`theme-script-plugin.ts`), so `data-theme` is set from the
// browser's copy before the first paint. A missing or unknown copy is System, which sets nothing.
// The policy's script-src 'self' carries no nonce, so it is a file, never inline.
import { applyTheme, pageStorage, storedTheme } from './theme.ts'

try {
  applyTheme(storedTheme(pageStorage), document.documentElement, pageStorage)
} catch {
  // No theme: the page draws System until the preferences read lands.
}
