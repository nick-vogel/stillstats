/**
 * The store images a retake writes, in the capture's order: every one of `files` when `names` is
 * empty, and otherwise only the named ones (creator-analytics#487). A name that is none of `files`
 * throws, so a typo fails the retake instead of writing no image.
 */
export function chosenImagesOf(names: readonly string[], files: readonly string[]): string[] {
  const unknown = names.filter((name) => !files.includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `No store image is named ${unknown.join(', ')}. The images: ${files.join(', ')}`,
    )
  }
  return names.length === 0 ? [...files] : files.filter((file) => names.includes(file))
}
