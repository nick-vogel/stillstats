# creator-analytics#1108: the redraw mutants

Pre-PR review 3 finding 2 asked that every redraw branch and every failed-read guard of the extension's surfaces have a test that goes red under its mutant. `mutants.mjs` in this folder holds the mutants, one per branch, and runs them. "Before" is the run at `11797101`, after the fixes and before the tests of `40d4fc53`. "After" is the run after pre-PR review 1 of this ticket (`docs/reviews/creator-analytics-1108/pre-pr-review-1.md`), with its finding 1 fix and its finding 2 tests. Each run is against the mutant's own surface test files.

All 40 mutants are killed.

| Mutant | Before | After |
| --- | --- | --- |
| `CL-after-read-bare` | survived | killed |
| `CL-after-read-guard` | survived | killed |
| `CL-after-read-heading-guard` | survived | killed |
| `CL-after-read-heading-keep` | killed | killed |
| `CL-after-read-heading-bare` | killed | killed |
| `CL-word-line-after-read-bare` | killed | killed |
| `CL-kept-word-line-bare` | killed | killed |
| `CL-kept-word-line-here` | survived | killed |
| `CL-kept-heading-bare` | killed | killed |
| `CL-kept-heading-here` | survived | killed |
| `CL-kept-heading-key` | survived | killed |
| `CL-kept-heading-ahead` | n/a (new) | killed |
| `VR-after-read-bare` | killed | killed |
| `VR-after-read-guard` | survived | killed |
| `VR-after-compare-bare` | survived | killed |
| `VR-after-compare-d5` | survived | killed |
| `VR-after-render-bare` | survived | killed |
| `VR-after-render-d5` | survived | killed |
| `AN-no-views-row-bare` | survived | killed |
| `WP-bare` | survived | killed |
| `WP-guard` | survived | killed |
| `SH-tiles-bare` | survived | killed |
| `SH-tiles-guard` | survived | killed |
| `SH-tiles-every` | survived | killed |
| `SH-player-bare` | survived | killed |
| `SH-player-guard` | survived | killed |
| `FD-bare` | survived | killed |
| `FD-guard` | survived | killed |
| `FD-every` | survived | killed |
| `CP-bare` | killed | killed |
| `CP-guard` | survived | killed |
| `CP-every` | killed | killed |
| `PW-ahead-noted-wins` | survived | killed |
| `PW-ahead-bare-ends` | killed | killed |
| `PW-ahead-redrawn-fold` | survived | killed |
| `PW-ahead-redrawn-notes` | n/a | killed |
| `PW-ahead-since` | survived | killed |
| `PW-ahead-from-cache` | survived | killed |
| `PW-off-url-clears` | killed | killed |
| `PW-ahead-left-clears` | n/a (new) | killed |

`PW-ahead-redrawn-notes` had no match in the before run, as Biome had wrapped its line; its pattern was fixed for the after run. `CL-kept-heading-ahead` is the line `0510ad89` added after the spec review, and `PW-ahead-left-clears` the line pre-PR review 1 finding 1 added.

## The five YouTube failed-read guards

`WP-guard`, `SH-tiles-guard`, `SH-player-guard`, `FD-guard` and `CP-guard` remove the `answered` guard, so a pass whose uploads read failed while YouTube redrew the page answers redrawn instead of bare. A run at `d3d9ca04` had them as equivalent, on the reasoning that a failed read stands `signedInReadKeptMs` (30 s, `public-pages.ts`), so the next pass answers bare at once and ends the redraw's record. Pre-PR review 1 finding 2 disproved that: the keep is per held channel. With two held channels, the first failing at once and the second failing 30 s later with a redraw halfway, the first's failed read no longer stands when the pass answers, and the next pass reads it again and shows the figure. Under each mutant that figure was timed from the failed pass (30,100 ms) instead of from the pass the give-up asks for (25,350 ms). One test per guard, in each surface's own test file, now holds that case.
