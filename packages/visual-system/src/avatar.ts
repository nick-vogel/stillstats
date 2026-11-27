/** The avatar's letter: the first character of the email, upper case, whole if outside the BMP. */
export function avatarLetterOf(email: string): string {
  return Array.from(email)[0]?.toUpperCase() ?? ''
}
