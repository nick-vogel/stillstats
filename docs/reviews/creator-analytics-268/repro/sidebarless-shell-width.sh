#!/bin/sh
# Pre-PR review 1, finding 1. Lays out the signed-in shell with the built stylesheet in headless
# Chrome at 1280px, once with the sidebar and once without it (the no-channel screen), and prints
# the screen's width. Red: without the sidebar the screen is 144px (the 9rem sidebar column).
# Green: without the sidebar the screen is as wide as the shell.
# Run from the repo root: pnpm --filter @creator-analytics/web build && sh docs/reviews/creator-analytics-268/repro/sidebarless-shell-width.sh
set -eu
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
css="$(ls "$PWD"/apps/web/dist/assets/index-*.css | head -1)"
dir="$(mktemp -d)"
nav='<nav class="sidebar"><ul><li><a href="/">Videos</a></li><li><a href="/audience">Audience</a></li></ul></nav>'
for shape in with without; do
  if [ "$shape" = with ]; then sidebar="$nav"; else sidebar=''; fi
  cat > "$dir/$shape.html" <<HTML
<!doctype html><html><head><link rel="stylesheet" href="file://$css"></head><body><div id="root"><div class="app"><header>Stillstats</header><div class="signed-in-view"><div class="signed-in-shell">$sidebar<div class="signed-in-screen"><p>No channel is connected.</p><button class="button">Connect a channel</button></div></div></div></div></div>
<script>window.onload=()=>{const s=document.querySelector('.signed-in-screen').getBoundingClientRect();const a=document.querySelector('.signed-in-shell').getBoundingClientRect();document.body.setAttribute('data-result','screen='+Math.round(s.width)+' shell='+Math.round(a.width))}</script></body></html>
HTML
  printf '%s sidebar: ' "$shape"
  "$chrome" --headless=new --disable-gpu --allow-file-access-from-files --window-size=1280,900 \
    --virtual-time-budget=2000 --dump-dom "file://$dir/$shape.html" 2>/dev/null \
    | grep -o 'data-result="[^"]*"'
done
rm -rf "$dir"
