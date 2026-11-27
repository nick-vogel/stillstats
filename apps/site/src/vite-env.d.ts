/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The self-hosted OpenPanel API. The image build refuses to run without it (ADR 0007). */
  readonly VITE_OPENPANEL_API_URL?: string
}
