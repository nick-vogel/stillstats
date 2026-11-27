export function isOneOf<T>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value)
}
