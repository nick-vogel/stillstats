/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The self-hosted OpenPanel API, provisioned in #21. Unset, the web app sends no event. */
  readonly VITE_OPENPANEL_API_URL?: string
  /** The GlitchTip project's DSN for the web app, read at build time (#18). Unset, the web app reports no error. */
  readonly VITE_GLITCHTIP_DSN?: string
  /**
   * The IFrame Player API script's URL. Only the browser walk's build sets it, to its fake player
   * served from 'self'; unset, it is YouTube's https://www.youtube.com/iframe_api.
   */
  readonly VITE_YOUTUBE_IFRAME_API_URL?: string
}

/** Every highlight in the build, newest release first, from apps/web/highlights-plugin.ts. */
declare module 'virtual:highlights' {
  const highlights: readonly import('./whats-new.ts').BuiltHighlight[]
  export default highlights
}
