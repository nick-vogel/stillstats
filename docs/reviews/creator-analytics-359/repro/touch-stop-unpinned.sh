#!/bin/sh
# Pre-PR review 3 of creator-analytics#359, finding 1.
#
# Usage, from the repository root:
#   sh docs/reviews/creator-analytics-359/repro/touch-stop-unpinned.sh <scratch-dir>
#
# Builds a detached worktree at HEAD under <scratch-dir>, writes a happy-dom probe beside
# apps/web/src/cursor-plot.test.ts that places the retention card with the keys and then sends the
# library's container a pointer sequence, and runs the probe on three builds: HEAD, HEAD without
# `ref={keepTouchFromLibrary}` (apps/web/src/CursorPlot.tsx), and HEAD without the `pointercancel`
# listener. It prints each case's verdict per build. The live worktree is never touched, and the
# probe never lands in it.
#
# At 0dac71b: on HEAD every case passes. Without the ref, `a touch move then cancel keeps the
# card` fails, which no test in `pnpm test` does (the browser walk is the only red). Without the
# cancel listener, every case still passes.
set -u
scratch=${1:?usage: touch-stop-unpinned.sh <scratch-dir>}
repo=$(git rev-parse --show-toplevel)
tree="$scratch/touch-stop-unpinned"
git -C "$repo" worktree add --detach "$tree" HEAD >/dev/null
cd "$tree" || exit 1
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null
probe=apps/web/src/touch-stop-probe.test.ts
cat > "$probe" <<'TS'
// @vitest-environment happy-dom
import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { AudienceRetention } from './AudienceRetention.tsx'
import { chartLabelOf, sliderTextOf } from './chart-slider.ts'

const points: AudienceRetentionPoint[] = [0.01, 0.02, 0.5, 1].map((x, i) => ({
  elapsedVideoTimeRatio: x,
  audienceWatchRatio: 1 - i / 5,
  relativeRetentionPerformance: 0.5,
}))

function placed() {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(createElement(AudienceRetention, { points, durationSeconds: 600 })))
  const plot = container.querySelector<HTMLElement>(
    `[role="slider"][aria-label="${chartLabelOf('Audience retention')}"]`,
  )
  const svg = plot?.querySelector('.cursor-plot-chart svg')
  if (!plot || !svg) throw new Error('No plot')
  act(() => plot.focus())
  act(() => {
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  })
  const send = (type: string, pointerType: string) =>
    act(() => {
      svg.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true, clientX: 5, clientY: 5 }))
    })
  const text = () => plot.getAttribute('aria-valuetext')
  return { send, text }
}

test('a touch move then cancel keeps the card', () => {
  const { send, text } = placed()
  const before = text()
  expect(before).not.toBe(sliderTextOf(null))
  send('pointerdown', 'touch')
  send('pointermove', 'touch')
  send('pointercancel', 'touch')
  expect(text()).toBe(before)
})

test('a touch down then cancel, with no move, keeps the card', () => {
  const { send, text } = placed()
  const before = text()
  send('pointerdown', 'touch')
  send('pointercancel', 'touch')
  expect(text()).toBe(before)
})

test('control: a mouse move then cancel reaches the library and clears the card', () => {
  const { send, text } = placed()
  send('pointermove', 'mouse')
  send('pointercancel', 'mouse')
  expect(text()).toBe(sliderTextOf(null))
})
TS
file=apps/web/src/CursorPlot.tsx
cp "$file" "$scratch/CursorPlot.tsx.orig"

run() {
  echo "=== $1"
  env -u TEST_DATABASE_ADMIN_URL pnpm exec vitest run "$probe" --reporter=verbose 2>&1 |
    grep -E '^ +(✓|×|✗)' | sed 's/ [0-9]*ms$//'
}

run head
grep -v 'ref={keepTouchFromLibrary}' "$scratch/CursorPlot.tsx.orig" > "$file"
run no-ref
grep -v "'pointercancel', stopTouch" "$scratch/CursorPlot.tsx.orig" > "$file"
run no-cancel-listener

cp "$scratch/CursorPlot.tsx.orig" "$file"
rm -f "$scratch/CursorPlot.tsx.orig" "$probe"
cd "$repo" && git worktree remove --force "$tree"
