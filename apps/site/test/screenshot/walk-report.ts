// The browser walk's report and verdict (creator-analytics#361), apart from the browser so a test
// can read it. The walk fails on a content security policy violation, a request the stub had no
// answer for, or a step that could not reach its state. It prints the bundle's sizes and the
// console's errors, and fails on neither.

/** The bundle's JS and CSS, in bytes, raw and at gzip level 9. */
export interface BundleSizes {
  js: number
  jsGzip: number
  css: number
  cssGzip: number
}

/** One violation, tagged with the route or state the walk was on when it arrived. */
export interface Violation {
  /** Such as `route: /app/profile` or `state: account menu open`. */
  step: string
  /** The page's `securitypolicyviolation` listener, or the browser's `security` log. */
  source: 'listener' | 'log'
  /** Such as `style-src-attr`. The log names no directive apart from its text. */
  directive: string
  /** `inline`, `eval`, or the URL the policy blocked. */
  blockedUri: string
  /** The first characters of the blocked inline code, when the browser gives them. */
  sample: string
  /** The file, line and column that raised it, when the browser gives them. */
  location: string
}

export interface WalkRun {
  sizes: BundleSizes
  /** Every step the walk ran, in order. */
  steps: string[]
  violations: Violation[]
  /** The steps that could not reach their route or state, and why. */
  failedSteps: { step: string; error: string }[]
  /** Every request the stub had no answer for, as `METHOD /path?query`. */
  unanswered: string[]
  consoleErrors: { step: string; text: string }[]
}

const kilobytes = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`

function sizeLine(name: string, raw: number, gzip: number): string {
  return `${name} ${kilobytes(raw)}, ${kilobytes(gzip)} gzip`
}

function violationLine({ step, source, directive, blockedUri, sample, location }: Violation) {
  return [
    `${step}: ${directive} blocked ${blockedUri}`,
    sample ? ` "${sample}"` : '',
    location ? ` at ${location}` : '',
    ` (${source})`,
  ].join('')
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The printed report, and whether the walk passed. */
export function reportOf(run: WalkRun): { passed: boolean; text: string } {
  const lines = [
    'Bundle:',
    `  ${sizeLine('JS', run.sizes.js, run.sizes.jsGzip)}`,
    `  ${sizeLine('CSS', run.sizes.css, run.sizes.cssGzip)}`,
    '',
  ]
  if (run.violations.length === 0) {
    lines.push(
      `No content security policy violation in ${plural(run.steps.length, 'step', 'steps')}.`,
    )
  } else {
    lines.push(
      `${plural(run.violations.length, 'content security policy violation', 'content security policy violations')}.`,
    )
    for (const step of run.steps) {
      for (const violation of run.violations.filter((each) => each.step === step)) {
        lines.push(`  ${violationLine(violation)}`)
      }
    }
    for (const violation of run.violations.filter((each) => !run.steps.includes(each.step))) {
      lines.push(`  ${violationLine(violation)}`)
    }
  }
  for (const { step, error } of run.failedSteps) lines.push(`${step} did not complete: ${error}`)
  if (run.unanswered.length > 0) {
    lines.push(`The stub had no answer for: ${run.unanswered.join(', ')}`)
  }
  if (run.consoleErrors.length > 0) {
    lines.push('', 'Console errors, which do not fail the walk:')
    for (const { step, text } of run.consoleErrors) lines.push(`  ${step}: ${text}`)
  }
  const passed =
    run.violations.length === 0 && run.failedSteps.length === 0 && run.unanswered.length === 0
  lines.push('', passed ? 'The browser walk passed.' : 'The browser walk failed.')
  return { passed, text: lines.join('\n') }
}
