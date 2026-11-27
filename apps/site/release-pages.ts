import { readFileSync } from 'node:fs'
import type { Release } from '@creator-analytics/releases'
import type { Plugin } from 'vite'

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Text escaped for HTML, in an element or a quoted attribute alike. */
function escaped(text: string): string {
  return text.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character)
}

/**
 * A template with each `{{key}}` replaced by its value escaped, and each `{{{key}}}` by its value
 * as it is, for markup the build made itself. A key with no value throws, so a typo in a template
 * fails the build instead of shipping the braces.
 */
function filled(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\{?)(\w+)\}?\}\}/g, (_, raw: string, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`A release page template names no value "${key}".`)
    return raw ? value : escaped(value)
  })
}

const productNames: Record<Release['product'], string> = {
  app: 'Stillstats',
  extension: 'Studio extension',
}

function nameOf({ product, version }: Release): string {
  return `${productNames[product]} ${version}`
}

/** A release day, `YYYY-MM-DD`, as the site writes a date: November 9, 2026. */
function dayOf(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// The footer partial holds this directive where the Releases link goes.
const footerLinkDirective = '<!-- releases-link -->'

export interface ReleasePages {
  /** The absolute path of each page the plugin adds, as the build's input and its page list. */
  paths: string[]
  plugin: Plugin
}

/**
 * The release index at `/releases/` and one page per release at `/releases/<version>`, built from
 * the release notes as virtual HTML entries, so the generated pages never sit in the source tree.
 * Each is a template in `templates/` written the way every page is, so the include, preview and
 * policy plugins treat it as one. With no release note, the build gets no release page and the
 * footer no Releases link.
 */
export function releasePages(root: string, releases: readonly Release[]): ReleasePages {
  const template = (name: string) => readFileSync(`${root}templates/${name}`, 'utf8')
  const pages = new Map<string, string>()
  if (releases.length > 0) {
    const items = releases.map(
      (release) =>
        `<li><h2><a href="${escaped(release.path)}">${escaped(nameOf(release))}</a></h2>` +
        `<p class="legal-updated"><time datetime="${escaped(release.date)}">${escaped(dayOf(release.date))}</time></p>` +
        `<p>${escaped(release.summary)}</p></li>`,
    )
    pages.set(
      `${root}releases/index.html`,
      filled(template('releases.html'), { releases: items.join('') }),
    )
    for (const release of releases) {
      pages.set(
        `${root}releases/${release.version}.html`,
        filled(template('release.html'), {
          name: nameOf(release),
          summary: release.summary,
          date: release.date,
          day: dayOf(release.date),
          note: release.html,
        }),
      )
    }
  }
  const footerLink = releases.length > 0 ? '<a href="/releases/">Releases</a>' : ''

  return {
    paths: [...pages.keys()],
    plugin: {
      name: 'release-pages',
      resolveId(id) {
        return pages.has(id) ? id : null
      },
      load(id) {
        return pages.get(id) ?? null
      },
      // After the include plugin has put the footer partial in the page.
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll(footerLinkDirective, footerLink),
      },
    },
  }
}
