# The video detail screen loads YouTube's player with the screen

This replaces the button of ADR 0019 (Nick, 2026-11-12). Stillstats is a tool for YouTube creators, and a creator expects YouTube's player to work inside it, so a press on every video's screen was an extra step that told the creator nothing after the first time. A video's screen now loads YouTube's player as it opens, when the video has a retention curve, and the thumbnail shows only until the player is ready. The rest of ADR 0019 holds: the two hosts, the content security policy, the one module that talks to the player, Google's rules for embedded players, and no player events for a video made for kids. ADR 0007's claim now holds for every screen except a video's screen.

One option was rejected. Remembering the press per browser keeps a choice that a creator makes once and never changes, at the cost of a screen that looks different the first time.
