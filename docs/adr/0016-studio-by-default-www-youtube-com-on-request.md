# Studio by default, www.youtube.com on request

This ADR amends ADR 0008, which kept the extension on YouTube Studio only. ADR 0008 stays as written, so the original decision and the reason it changed both stay readable.

Required host access stays `studio.youtube.com` and the product API's domain, as ADR 0008 set it. `www.youtube.com` is an optional host permission, in `optional_host_permissions` in both Chrome and Firefox, and the extension requests it only when the creator turns on YouTube access from the popup. It is never in `host_permissions` and never in a static content script match. No other youtube.com subdomain is requested, `m.youtube.com` included.

On youtube.com the extension reads video ids, channel links and the page URL, and never a number. Only the ids of videos on the creator's connected channels leave the browser: the extension matches each video to a connected channel in the browser, and sends nothing about any other video, so the rest of what the creator browses stays in the browser. Every number still comes from the product API, which gets it from the YouTube gateway with the creator's connection (ADR 0003).

The creator asked for engaged views on the public pages they browse, beside YouTube's own view counts. An optional permission gives them that and keeps the default install as narrow as ADR 0008 made it. That narrow default is the privacy position against vidIQ, which asks for every site and the creator's cookies and reads numbers from YouTube's private endpoints. A creator who never turns on YouTube access has the same extension ADR 0008 describes.

What ADR 0008 decided otherwise holds. The extension never reads a page's content as a data source, on Studio or on youtube.com, and never uses the browser session against YouTube.
