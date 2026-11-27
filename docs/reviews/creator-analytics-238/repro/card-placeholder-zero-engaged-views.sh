#!/bin/sh
# Pre-PR review 1, finding 1 (creator-analytics#238): with zero engaged views the engaged views card
# has no ratio line, so the cards row is shorter than the card placeholder that held its place.
# Run from the repo root after `pnpm build`. It measures the built stylesheet in the system Chrome
# and prints one line per screen width and card set; exit 1 when any row and its placeholder differ.
# Widths 1280 and 800 only: below about 26rem the cards stack one to a row, where the row of three
# placeholders never matched the cards (pre-existing, outside this finding).
set -eu
css=$(ls apps/web/dist/assets/index-*.css | head -1)
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
dir=$(mktemp -d)
mkdir -p "$dir/app/assets"
cp apps/web/dist/assets/* "$dir/app/assets/"
cat > "$dir/page.html" <<HTML
<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="app/assets/$(basename "$css")"></head><body><main id="out"></main>
<script>
const card = (label, number, details) =>
  '<div class="card"><dt>' + label + '</dt><dd class="card-number" style="--chars:' + number.length +
  '">' + number + '</dd>' + details.map((d) => '<dd class="card-detail">' + d + '</dd>').join('') + '</div>'
const ratio = '<span aria-hidden="true">Views are 1.6× engaged views</span><span class="visually-hidden">Views are 1.6 times engaged views</span>'
const sets = {
  'zero engaged views, no revenue card (video page)': [card('Engaged views', '0', ['0 views']), card('Watch hours', '0.0', [])],
  'zero engaged views, revenue with no RPM line': [card('Engaged views', '0', ['0 views']), card('Watch hours', '0.0', []), card('Estimated revenue', '\$0.00', [])],
  'zero engaged views, an empty ratio place (the recommended fix)': [card('Engaged views', '0', ['0 views']).replace('</div>', '<dd class="card-detail" aria-hidden="true"></dd></div>'), card('Watch hours', '0.0', [])],
  'engaged views, the ratio line (control)': [card('Engaged views', '1,234', ['2,000 views', ratio]), card('Watch hours', '12.3', []), card('Estimated revenue', '\$5.00', ['RPM: \$4.05'])],
}
async function run() {
  await document.fonts.ready
  const lines = []
  for (const [name, cards] of Object.entries(sets)) {
    const row = document.createElement('dl'); row.className = 'cards'; row.innerHTML = cards.join('')
    const holder = document.createElement('div'); holder.className = 'cards'
    holder.innerHTML = cards.map(() => '<div class="placeholder placeholder-card"></div>').join('')
    document.body.append(row, holder)
    const r = row.getBoundingClientRect().height, p = holder.getBoundingClientRect().height
    lines.push((Math.abs(r - p) > 0.5 ? 'MISMATCH' : 'ok') + ' ' + innerWidth + 'px ' + name + ': row ' + r + 'px, placeholder ' + p + 'px')
    row.remove(); holder.remove()
  }
  document.getElementById('out').textContent = lines.join(' | ')
}
run()
</script></body></html>
HTML
status=0
for width in 1280 800; do
  out=$("$chrome" --headless=new --disable-gpu --allow-file-access-from-files --window-size=$width,900 \
    --virtual-time-budget=3000 --dump-dom "file://$dir/page.html" 2>/dev/null |
    sed -n 's/.*<main id="out">\(.*\)<\/main>.*/\1/p')
  printf '%s\n' "$out" | tr '|' '\n'
  case "$out" in *MISMATCH*) status=1 ;; esac
done
rm -rf "$dir"
exit $status
