# A bundled library is first-party code, and the content security policy is the gate

ADR 0007 is about what runs in a creator's browser and where it connects, not about where the source code came from. A library the build bundles into the app and the API serves from our own origin is first-party code under 0007, the same as React, `@sentry/react` and `@openpanel/web` already are. "No third-party scripts" means no script loaded at runtime from another origin, and no code that sends a creator's data to a vendor. It never meant "no library", and no ADR, `CODING_STANDARDS.md` or spec says it does.

A library may go into the web app or the site when all four hold:

1. It ships in the bundle and loads from `'self'`. Nothing loads from a CDN, Google Fonts or any other host at runtime.
2. It opens no connection outside the policy's `connect-src`. A library with a default host of its own is configured off it, and the build refuses to run without that configuration, as the image does today for the OpenPanel SDK, whose default is openpanel.dev's cloud.
3. It works under the content security policy unchanged. The policy is a `<meta>` tag the build writes, so there is no per-request nonce, and a library that needs `'unsafe-inline'`, `'unsafe-eval'` or a nonce is out. A library that injects `<style>` elements is in only if it can turn them off.
4. It is not an AI processor, an ad network or a tracker, and it sends nothing to one. That part of 0007 does not change.

The browser blocks a breach of points 1 to 3 under the policy, and the policy's tests (`packages/visual-system/test/content-security-policy.test.ts`, the "no inline script" and "no inline style" tests in `apps/web/test/web.test.ts` and `apps/site/test/site.test.ts`) hold the policy on every build. Point 4 is checked by reading the library before it is added. A new runtime dependency still needs my approval on its issue, as it does today. A spec does not need a blanket "no new library" line, and #64's is retired by this ADR.

#64 kept shadcn out for two reasons. Radix's Select injected `<style>` elements the policy blocks; that no longer applies, because shadcn's default primitives since July 2026 are Base UI, whose `CSPProvider` takes `disableStyleElements` to stop them. shadcn needs Tailwind, which the visual system does not use; that one is a styling cost, not a privacy rule, and Tailwind compiles to a static stylesheet at build time, so it passes the policy.

The web app takes shadcn, on Base UI primitives and Tailwind v4, so new features share one set of components instead of each screen hand-building its own. Base UI runs inside a `CSPProvider` with `disableStyleElements`. shadcn's defaults are what make an app read as templated: its palette, its radius, its shadows and its type. So shadcn supplies behaviour and structure only, and the visual system keeps every visible value:

1. The visual system's tokens set shadcn's CSS variables and Tailwind's theme. shadcn's own theme never ships.
2. A shadcn component is copied into the repo as source and restyled in the visual system before its first use. shadcn's blocks are not used as page layouts.
3. A visual-system test fails the build when one of shadcn's default theme values is still in the CSS the build emits, the way the colour tests already fail a colour too close to the palette they avoid.

The first screens to move are the ones with hand-built interaction: the account menu (`AccountMenu.tsx`, its own focus, Escape and outside-press handling), the custom date range in the controls bar, the toast, and the restyled native selects and segmented control.

## Charts (amended for #358)

The web app's charts move to TanStack Charts, chosen over Recharts in the #358 spike, which ported the stacked charts to both and walked them in a real browser. TanStack Charts added about 40 kB gzip to the web app against Recharts' 100 kB, kept a labelled, keyboard-stepped chart with Home, End and Escape and read its values aloud, and shares one cursor across charts the way our hover does today. Recharts' keyboard layer gave an unlabelled `application` role with arrows only and read nothing with our own card. shadcn's chart component is Recharts, so the web app does not use it.

Two conditions come with it. TanStack Charts 1.2.1 writes an inline `style` attribute on its `<svg>` through `innerHTML`, which the policy blocks, so the app carries a `pnpm patch` that drops it, with the same declarations in the visual system's stylesheet, until it is fixed upstream; the patch goes when an upgrade no longer needs it. And because the repo's policy tests read the built HTML and run no script, they cannot see a violation a library causes at runtime: the port adds a browser test that loads the built app and fails on any policy violation, the way the #358 walk did. The library sets no class per mark, so a chart's series colours are `var()` strings of the visual system's tokens in its definition, and rule 3's default-value test covers them too.
