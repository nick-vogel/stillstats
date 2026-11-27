// One argument, quoted for `/bin/sh -c`, which is how `sops exec-env` runs its
// command string: a quote inside the argument cannot end the quoting
// (eng-pipeline#51, its own module since #53).
export function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}
