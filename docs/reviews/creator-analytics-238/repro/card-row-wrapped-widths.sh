#!/bin/sh
# Pre-PR review 2, finding 1 (creator-analytics#238): where the three cards do not fit on one row,
# a card on a row of its own is shorter than the card placeholder that held its place, so the
# content under the cards moves up when the answer lands. Run from the repo root after `pnpm build`.
# It lays the built stylesheet's cards row and its row of three placeholders in a box as wide as the
# app's content at a 1280px, a 560px (two and one) and a 380px (one to a row) screen, in the system
# Chrome, and prints one line per width and card set; exit 1 when any row and its placeholders differ.
# The second set adds the recommended fix (a card at least as tall as its placeholder) and is ok.
set -eu
css=$(ls apps/web/dist/assets/index-*.css | head -1)
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
dir=$(mktemp -d)
mkdir -p "$dir/app/assets"
cp apps/web/dist/assets/* "$dir/app/assets/"
cat > "$dir/page.html" <<HTML
<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="app/assets/$(basename "$css")">
<style>.fix .card { min-height: calc(2rem + 2px + 0.875rem * 1.6 + 0.25rem + var(--card-number-place) + 0.25rem + 0.9375rem * 1.4 + 0.25rem + var(--card-ratio-place)); }</style>
</head><body><main id="out"></main>
<script>
const card = (label, number, details) =>
  '<div class="card"><dt>' + label + '</dt><dd class="card-number" style="--chars:' + number.length +
  '">' + number + '</dd>' + details.map((d) => '<dd class="card-detail">' + d + '</dd>').join('') + '</div>'
const ratio = '<span aria-hidden="true">Views are 1.6× engaged views</span><span class="visually-hidden">Views are 1.6 times engaged views</span>'
const cards = [card('Engaged views', '1,234', ['2,000 views', ratio]), card('Watch hours', '12.3', []), card('Estimated revenue', '\$5.00', ['RPM: \$4.05'])]
const sets = { 'the cards as they render today': '', 'with the recommended fix': 'fix' }
async function run() {
  await document.fonts.ready
  const lines = []
  for (const width of [1100, 515, 340]) {
    for (const [name, extra] of Object.entries(sets)) {
      const box = document.createElement('div'); box.style.width = width + 'px'; box.className = extra
      const row = document.createElement('dl'); row.className = 'cards'; row.innerHTML = cards.join('')
      const holder = document.createElement('div'); holder.className = 'cards'
      holder.innerHTML = cards.map(() => '<div class="placeholder placeholder-card"></div>').join('')
      box.append(row, holder); document.body.append(box)
      const r = row.getBoundingClientRect().height, p = holder.getBoundingClientRect().height
      lines.push((Math.abs(r - p) > 0.5 ? 'MISMATCH' : 'ok') + ' content ' + width + 'px, ' + name + ': row ' + r + 'px, placeholders ' + p + 'px')
      box.remove()
    }
  }
  document.getElementById('out').textContent = lines.join(' | ')
}
run()
</script></body></html>
HTML
out=$("$chrome" --headless=new --disable-gpu --allow-file-access-from-files --window-size=1280,900 \
  --virtual-time-budget=3000 --dump-dom "file://$dir/page.html" 2>/dev/null |
  sed -n 's/.*<main id="out">\(.*\)<\/main>.*/\1/p')
rm -rf "$dir"
printf '%s\n' "$out" | tr '|' '\n'
case "$out" in *MISMATCH*) exit 1 ;; esac
