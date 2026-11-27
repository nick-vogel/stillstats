# The video detail screen loads YouTube's player, only after the creator presses its button

The button this ADR describes is gone: ADR 0020 loads the player with the screen.

The video detail screen shows the video itself beside its audience retention, so a click on either retention plot moves the player to that moment (creator-analytics#637). The player is YouTube's own, loaded with YouTube's IFrame Player API. Until the creator presses the player placeholder's button, nothing loads from YouTube: the placeholder is the thumbnail, which already loads from ytimg.com, a button and one line of text.

This amends ADR 0007 and ADR 0014 for one host and one purpose. After the press, the web app loads the IFrame API script, and the player script it injects, from `https://www.youtube.com`, and frames the player from `https://www.youtube-nocookie.com`, YouTube's privacy-enhanced mode. The content security policy adds `https://www.youtube.com` to `script-src` and sets `frame-src` to `https://www.youtube-nocookie.com`, and nothing else changes: no `'unsafe-inline'`, no `'unsafe-eval'` and no nonce. One module is the only code that talks to the player. A creator who never presses the button loads nothing from YouTube, so ADR 0007's claim still holds for them.

Three options were rejected. A frame with no script reloads on every click and cannot read the playback time, so it has no playhead. A link that opens YouTube at the clicked moment keeps the policy as it is, but brings back the tab switching the feature exists to remove. A wrapper library from npm loads the same script from YouTube and adds a dependency.

The player follows Google's rules for embedded players. Playback starts only from YouTube's own play button (Developer Policies III.C.2; the question is open in #6, and a written yes from Google is the only thing that changes this). Nothing is drawn in front of the player, and it is never smaller than 200 by 200 pixels. A video made for kids sends no player events (III.E.4.j). Ads YouTube shows in the player are YouTube's, and the app does not block them (III.I.6).

Google does not say whether privacy-enhanced mode sets cookies, so the privacy policy says the player can, and points to Google's Privacy Policy. If the privacy-enhanced host does not work with the API, the player frames from `https://www.youtube.com`, and this ADR is amended to say so.
