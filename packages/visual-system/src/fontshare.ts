import { accessSync, copyFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The Fontshare fonts and their licence. The ITF Free Font License allows them on stillstats.com
 * but forbids redistribution through a public repository, so the tree does not hold them
 * (creator-analytics#942). They sit at the root of the private repository below, and a build that
 * has them copies them into this package's fonts folder first. Without them, a build drops their
 * @font-face rules and the page falls back to the next family in its font stack.
 */
export const fontshareFiles = [
  'CabinetGrotesk-Variable.woff2',
  'Switzer-Variable.woff2',
  'LICENSE-ITF-FFL.txt',
] as const

export const fontshareRepository = 'nick-vogel/stillstats-fonts'

export const fontsDirectory = new URL('../fonts/', import.meta.url)

const fontshareFontPaths: ReadonlySet<string> = new Set(
  fontshareFiles
    .filter((file) => file.endsWith('.woff2'))
    .map((file) => join(realpathSync(fileURLToPath(fontsDirectory)), file)),
)

/**
 * Whether `file` is a Fontshare font in the fonts folder, the only font files a build may find
 * absent. Paths compare through the real path of their folder, because Vite names a stylesheet by
 * its real path and a checkout can sit under a symlink, such as macOS's /var. A folder that does
 * not exist holds no Fontshare font.
 */
export function isFontshareFont(file: string): boolean {
  try {
    return fontshareFontPaths.has(join(realpathSync(dirname(file)), basename(file)))
  } catch {
    return false
  }
}

/**
 * Copies the three files from `source` into `destination`, all or none: a font never lands
 * without its licence, because `fonts()` ships only the licences it finds beside the fonts.
 */
export function copyFontshareFiles(source: string, destination: URL = fontsDirectory): void {
  for (const file of fontshareFiles) {
    try {
      accessSync(join(source, file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      throw new Error(
        `${resolve(source)} does not hold ${file}, which ${fontshareRepository} holds at its root`,
        {
          cause: error,
        },
      )
    }
  }
  for (const file of fontshareFiles) copyFileSync(join(source, file), new URL(file, destination))
}
