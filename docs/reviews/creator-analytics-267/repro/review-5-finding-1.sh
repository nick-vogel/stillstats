#!/bin/sh
# Pre-PR review 5, finding 1: does each note's placeholder hold as many lines as the loaded note,
# with main's sidebar beside the screen? Loads review-5-finding-1-note-places.html in headless
# Chrome at each width and prints "loaded/placeholder" lines per note ("!" marks a mismatch). Exit 1
# while the launch total, the summary total or the delay note ("delay") mismatches at any width. The
# width list carries each two line band's edges beside the sidebar (creator-analytics#375): the
# summary total note 869/870, the launch total note 888/889, the delay note 1031/1032. Headless
# Chrome on macOS renders nothing narrower than 500px, so the phone widths are not covered here.
set -u
ROOT=$(git rev-parse --show-toplevel)
PAGE="file://$ROOT/docs/reviews/creator-analytics-267/repro/review-5-finding-1-note-places.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
status=0
for w in 600 700 767 768 800 832 860 869 870 880 888 889 900 1000 1031 1032 1100 1280; do
  title=$("$CHROME" --headless=new --disable-gpu --allow-file-access-from-files \
    --window-size="$w,900" --virtual-time-budget=3000 --dump-dom "$PAGE" 2>/dev/null |
    grep -o '<title>[^<]*' | sed 's/<title>//')
  echo "$title"
  case "$title" in
    *'"ltotal":"'?/?!*|*'"total":"'?/?!*|*'"delay":"'?/?!*) status=1 ;;
    '') echo "no title at $w"; exit 2 ;;
  esac
done
[ "$status" = 1 ] && echo "MISMATCH: a note's placeholder is off a line" || echo "MATCH"
exit "$status"
