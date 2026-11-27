#!/bin/sh
# Pre-PR review 3, finding 1 (creator-analytics#238): a revenue card that shows a sentence in place
# of its number can be taller than one card's place (--card-place), so its row is taller than the
# placeholders that held it, and the content under the cards moves down when the answer lands.
# Run from the repo root after `pnpm build`. It lays the built stylesheet's cards row (engaged views
# with its views and ratio lines, watch hours, and the revenue card in each of its three message
# states) and a row of three placeholders in a box as wide as the app's content at a 1280px, a 560px
# (two and one) and a 380px (one to a row) screen, in the system Chrome at that window width so the
# stylesheet's media queries apply, and prints one line per width and state; exit 1 when any row and
# its placeholders differ by more than 0.5px.
set -eu
css=$(ls apps/web/dist/assets/index-*.css | head -1)
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
dir=$(mktemp -d)
mkdir -p "$dir/app/assets"
cp apps/web/dist/assets/* "$dir/app/assets/"
cat > "$dir/page.html" <<HTML
<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="app/assets/$(basename "$css")">
</head><body><main id="out"></main>
<script>
const card = (label, number, details) =>
  '<div class="card"><dt>' + label + '</dt><dd class="card-number" style="--chars:' + number.length +
  '">' + number + '</dd>' + details.map((d) => '<dd class="card-detail">' + d + '</dd>').join('') + '</div>'
const message = (text, button) =>
  '<div class="card"><dt>Estimated revenue</dt><dd class="card-message">' + text + '</dd>' +
  (button ? '<dd class="card-message"><button class="button button-quiet" type="button">' + button + '</button></dd>' : '') + '</div>'
const ratio = '<span aria-hidden="true">Views are 1.6× engaged views</span><span class="visually-hidden">Views are 1.6 times engaged views</span>'
const others = [card('Engaged views', '1,234', ['2,000 views', ratio]), card('Watch hours', '12.3', [])]
const states = {
  'no revenue for the date range': message('YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.'),
  'not in the Partner Program': message('This channel is not in the YouTube Partner Program, so YouTube reports no revenue for it.'),
  'consent missing, with its button': message('Revenue needs your consent.', 'Give revenue consent'),
}
async function run() {
  await document.fonts.ready
  const lines = []
  const width = Number(location.hash.slice(1))
  {
    for (const [name, revenue] of Object.entries(states)) {
      const box = document.createElement('div'); box.style.width = width + 'px'
      const row = document.createElement('dl'); row.className = 'cards'; row.innerHTML = [...others, revenue].join('')
      const holder = document.createElement('div'); holder.className = 'cards'
      holder.innerHTML = '<div class="placeholder placeholder-card"></div>'.repeat(3)
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
out=""
for screen in 1280:1100 560:515 380:340; do
  line=$("$chrome" --headless=new --disable-gpu --allow-file-access-from-files \
    --window-size="${screen%%:*},900" --virtual-time-budget=3000 \
    --dump-dom "file://$dir/page.html#${screen##*:}" 2>/dev/null |
    sed -n 's/.*<main id="out">\(.*\)<\/main>.*/\1/p')
  out="$out${out:+ | }$line"
done
rm -rf "$dir"
printf '%s\n' "$out" | tr '|' '\n'
case "$out" in *MISMATCH*) exit 1 ;; esac
