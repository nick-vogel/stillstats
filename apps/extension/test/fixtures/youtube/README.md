# youtube.com page fixtures

Eight youtube.com pages from Nick's own signed-in Chrome (creator-analytics#136 for seven, #521 for the Live tab), for the public page surfaces' "youtube.com page in, pill out" tests (#120). Each file is the page as Chrome drew it (`document.documentElement.outerHTML`), not the HTML YouTube first sends, which holds none of the tiles. The first line of each file records its URL and save time.

| File | Page | Saved |
|---|---|---|
| `channel-videos.html` | The channel's Videos tab | 2026-11-06 |
| `channel-home.html` | The channel's Home tab | 2026-11-06 |
| `channel-shorts.html` | The channel's Shorts tab | 2026-11-06 |
| `channel-streams.html` | The channel's Live tab, 30 past streams, three of them members-only | 2026-11-08 |
| `watch.html` | The watch page of `9SvyFna2XGM`, with the sidebar drawn | 2026-11-06 |
| `home-feed.html` | The home feed, first rows | 2026-11-06 |
| `search.html` | Search results for "payload local api query your data without fetch", which hold `NDha0z6zDA8` | 2026-11-06 |
| `shorts-player.html` | The Shorts player on `h1jr1K82xuQ` | 2026-11-06 |

The channel is `UC8mOjhMBTyPPScCF9vYtwFg` (`@nick_vogel`), the same channel as the Studio fixtures.

**The home feed holds none of Nick's videos.** YouTube does not serve a creator their own uploads in the home feed, so the save holds other channels' tiles only. The feed surface (#140) matches a tile's video id against the creator's uploads in the browser, so a feed test answers some of the feed's ids as the creator's uploads. The same file covers a feed with none of the creator's videos, which is `placed` and sends no missing event.

**What was removed.** Every `script`, `noscript`, `style`, `iframe`, `link` and `meta` element except the charset, so no session token or YouTube configuration is in the repo, and every inline event handler. The comments section on the watch page and the Shorts player, which names other people. Every playback address (`googlevideo.com` and `blob:`), which carried the IP address and a signed session for the video stream. The signatures on thumbnail addresses (`sqp` and `rs` on `i.ytimg.com`). The ad conversion pixel (`/pagead/`). The `redir_token` on every description link through `youtube.com/redirect`, and the affiliate id (`id`, `data1`) in the sponsored video's Cloudways link. Without styles, a fixture opens in a browser as unstyled text, which still shows each surface.

Biome skips this folder, as it skips the Studio fixtures.
