# Proof for pre-PR review 2, finding 1: the note-places walk step measures the Audience
# placeholder before it repacks for the width the collapsed sidebar gives it.
#
# Run from the repo root, in a scratch worktree so the real walk file is never edited:
#
#   git worktree add --detach "$SCRATCH/wt" HEAD
#   (cd "$SCRATCH/wt" && pnpm install --frozen-lockfile --prefer-offline)
#   python3 docs/reviews/creator-analytics-638/repro/placeholder-packed-diag.py "$SCRATCH/wt"
#   (cd "$SCRATCH/wt" && pnpm test:browser) > "$SCRATCH/walk.log" 2>&1
#   grep 'DIAG places collapsed 768' "$SCRATCH/walk.log"
#   git worktree remove --force "$SCRATCH/wt"
#
# The patch logs, for the Audience screen at every width and sidebar state, the busy grid's width,
# its rendered column count and each card's width at the moment the step reads the places, and the
# same for the landed grid when it reads the notes. On a red run the 768px collapsed line reads
# "cols":1 on a 658.56px grid, where audienceColumnCountOf gives 2. On a green run it reads "cols":2.
# At bd488b5 the walk went red in 3 of 5 runs. After the fix the line must read
# "cols":2 on every run, and the walk must be green three runs in a row.
import sys
from pathlib import Path

walk = Path(sys.argv[1]) / 'apps/site/test/screenshot/browser-walk.ts'
source = walk.read_text()
state = (
    "`(() => { const g = document.querySelector('.audience-grid'); if (!g) return null; "
    "return { busy: g.getAttribute('aria-busy'), "
    "side: document.querySelector('[data-slot=\"sidebar\"]')?.getAttribute('data-state'), "
    "grid: g.getBoundingClientRect().width, "
    "cols: g.querySelectorAll(':scope > .audience-column').length, "
    "cards: [...g.querySelectorAll('[data-slot=\"card\"]')]"
    ".map((c) => Math.round(c.getBoundingClientRect().width * 100) / 100) } })()`"
)
places = "\n      const places = (await evaluate(screen.places)) as number[][]\n"
notes = "\n        const notes = await screen.notes()\n"
if source.count(places) != 1 or source.count(notes) != 1:
    sys.exit('placesHoldWhatLands no longer reads as this patch expects')
source = source.replace(
    places,
    places
    + "      if (screen.path.includes('audience')) console.log('DIAG places', state, width, "
    + f"JSON.stringify(await evaluate({state})))\n",
)
source = source.replace(
    notes,
    notes
    + "        if (screen.path.includes('audience')) console.log('DIAG notes', state, width, "
    + f"JSON.stringify(await evaluate({state})))\n",
)
walk.write_text(source)
print(f'patched {walk}')
