# The extension runs on YouTube Studio only and reads from our API

Amended by ADR 0016 (Studio by default, www.youtube.com on request).

The browser extension requests host access to `studio.youtube.com` and the product's own API domain, nothing else. It gets every number from the product API, which gets it from the YouTube gateway with the creator's connection. It never reads the Studio page content as a data source and never uses the browser session against YouTube.

The extension reads the channel id, video ids and the selected analytics period from the Studio page, and never a number.

Competitor extensions are where their privacy fails: vidIQ requests every site plus cookies and runs on ChatGPT, Claude and Gemini, and ViewStats streams playback, seek and scroll events with no consent prompt. Reading the Studio page would be faster to build and would make the extension the same kind of product.
