#!/bin/sh
# creator-analytics#237 pre-PR review 3, finding 1: reads the computed frame colour of a single
# upload's marker (an <a>) and of a tile (a <button>), both with the marker classes the app renders,
# against the web app's built stylesheet in headless Chrome. Run from the repo root after
# `pnpm build`, with a scratch directory outside the repo:
#   sh docs/reviews/creator-analytics-237/repro/frame-ink.sh /path/to/scratch
# Red at 95de9319: the single's frame is the body's --ink, the tile's the muted --ink-soft, because
# the visual system's unlayered `a { color: inherit }` outranks the layered utility on the <a>.
# Green (exit 0) once the two frames draw in the same colour. CHROME_PATH as for the browser walk.
set -u
scratch=$1
chrome=${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
page="$scratch/frame-ink"
mkdir -p "$page"
css=$(ls apps/web/dist/assets/*.css | head -1)
[ -n "$css" ] || { echo "no built stylesheet: run pnpm build"; exit 2; }
cp "$css" "$page/app.css"
cat > "$page/page.html" <<'HTML'
<!doctype html><html><head><link rel="stylesheet" href="app.css"></head><body>
<section class="video-detail-section metric-charts"><fieldset class="upload-markers">
<div class="upload-markers-track">
<a id="single" class="upload-marker text-muted-foreground" href="#"></a>
<button id="tile" type="button" class="upload-marker upload-marker-tile text-muted-foreground">2</button>
</div></fieldset></section><pre id="out"></pre>
<script>
const frame = (id) => getComputedStyle(document.getElementById(id)).borderTopColor
const single = frame('single')
const tile = frame('tile')
document.getElementById('out').textContent =
  `single=${single} tile=${tile} ${single === tile ? 'same' : 'differ'}`
</script></body></html>
HTML
line=$("$chrome" --headless=new --disable-gpu --allow-file-access-from-files --dump-dom \
  "file://$page/page.html" 2>/dev/null | sed -n 's/.*<pre id="out">\(.*\)<\/pre>.*/\1/p')
echo "$line"
case "$line" in *same) exit 0 ;; *) exit 1 ;; esac
