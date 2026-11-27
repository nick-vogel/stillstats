import { productOrigin } from '@creator-analytics/api-types'
import type { UserManifest } from 'wxt'
import { youtubeOrigins } from './youtube-access.ts'

/** The API's default port in `apps/api/src/server.ts`. */
export const localApiOrigin = 'http://localhost:3000'

/** The staging deployment, which the staging build calls (creator-analytics#574). */
export const stagingOrigin = 'https://staging.stillstats.com'

const studioOrigin = 'https://studio.youtube.com'

export function apiOriginOf(mode: string): string {
  if (mode === 'development') return localApiOrigin
  if (mode === 'staging') return stagingOrigin
  return productOrigin
}

/**
 * Studio and stillstats.com in a production build, and in a development build too, so it asks for
 * what a production one does, plus the local API it calls. A staging build asks for Studio and
 * staging only.
 */
export function hostOriginsOf(mode: string): string[] {
  const apiOrigin = apiOriginOf(mode)
  const origins =
    apiOrigin === stagingOrigin ? [studioOrigin, stagingOrigin] : [studioOrigin, productOrigin]
  if (!origins.includes(apiOrigin)) origins.push(apiOrigin)
  return origins.map((origin) => `${origin}/*`)
}

/**
 * Chrome asks for 16, 48 and 128 (32 is the toolbar's double), Firefox for 32 and 64, and its
 * add-ons manager shows 48 and 96. The PNGs in `public/icon` are the S from
 * `apps/site/public/favicon.svg` in its light-scheme fill, rendered once and committed.
 */
const iconSizes = [16, 32, 48, 64, 96, 128] as const

function iconsOf(sizes: readonly (typeof iconSizes)[number][]): Record<number, string> {
  return Object.fromEntries(sizes.map((size) => [size, `icon/${size}.png`]))
}

/**
 * Host access to Studio and stillstats.com is the one thing asked for at install. `scripting`
 * lets the background register the youtube.com content script at runtime, and it raises no
 * install warning in either browser. www.youtube.com is only an optional host permission, asked
 * for from the popup's YouTube access toggle (ADR 0016), so the install warning still names Studio
 * and stillstats.com only.
 */
export function manifestOf({ browser, mode }: { browser: string; mode: string }): UserManifest {
  const manifest: UserManifest = {
    name: 'Stillstats',
    // The Chrome Web Store requires it, and Firefox reads it for the AMO summary: #100's short
    // description, word for word.
    description:
      "See your engaged views beside the numbers YouTube Studio shows, from YouTube's official API.",
    host_permissions: hostOriginsOf(mode),
    permissions: ['scripting'],
    optional_host_permissions: youtubeOrigins,
    icons: iconsOf(iconSizes),
    // Neither browser promises the toolbar button falls back to `icons`.
    action: { default_icon: iconsOf([16, 32]) },
  }
  if (browser !== 'firefox') return manifest
  return {
    ...manifest,
    browser_specific_settings: {
      gecko: {
        // AMO fixes the id when it first signs the add-on (creator-analytics#100).
        id: '@stillstats',
        // Firefox's built-in data consent, which `data_collection_permissions` drives, starts at 140.
        strict_min_version: '140.0',
        data_collection_permissions: {
          // Every API request carries the creator's stillstats.com session cookie, and the video ids
          // it sends come from Studio's links: Mozilla's `websiteContent` names links and cookies
          // (creator-analytics#100, the definition re-read 2026-10-17).
          required: ['authenticationInfo', 'websiteContent'],
          // The usage events. Mozilla allows this category only as optional.
          optional: ['technicalAndInteraction'],
        },
      },
    },
  }
}
