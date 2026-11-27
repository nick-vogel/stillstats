# ID-free traces of API requests leave the process for GlitchTip

Until now only errors left the API and the worker for GlitchTip. The reporter said so in its own comment: no `tracesSampleRate`, so only errors leave the process, never a trace of a creator's request. That reverses here. A performance trace of each API request now leaves too, and leaves ID-free.

The reason is the baseline of creator-analytics#1037, which makes Stillstats faster. It needs each API route's p50 and p95 over a week of real traffic, and GlitchTip shows exactly that, per transaction group. GlitchTip is self-hosted, so a trace goes to no third party and ADR 0007 holds.

A trace may carry: the request's method and the matched route's pattern as its name (`GET /api/channels/:channelId/videos`, never the address), the window when it is one the API offers, the names of the known query parameters the request sent (`format,sort`) and never their values, the cache result (`hit` when every read came from the cache, `miss` when none did, `mixed` otherwise), the answer's status, its timings, and its child spans with their descriptions masked and only the SDK's structural keys, such as the method, the status and the host. A trace may not carry any channel ID (internal or YouTube's), video ID, user ID, email, token, query value or analytics value. Each one is stripped before the trace leaves the process, by the trace scrubbing hook in `packages/reporter/src/scrub.ts`, which keeps a key only when it is on its list. So a key the SDK adds later stays in the process until someone adds it on purpose. A request answered 401 to 404, or with a redirect other than 300 and 304, sends no trace: the SDK's default filter drops it (`DEFAULT_IGNORE_STATUS_CODES` in `@sentry/core` 11.4.0, run by `httpIntegration` whatever `disableIncomingRequestSpans` says). So a signed-out request and the `not_connected`, `video_not_found`, `consent_missing`, `not_monetized` and `not_owner` refusals are not in GlitchTip's p50 and p95.

No trace header goes to Google. On the server the SDK adds `sentry-trace` and `baggage` to every request the process sends, and they would tell Google the trace's name, release and environment, so the API and the worker turn them off whatever the rate.

The web app stays errors only. Its timing goes to OpenPanel as events (creator-analytics#1053).

The worker reads the same setting and gets the same scrubbing, but opens no span of its own. A trace per job waits until the baseline shows a screen waiting on the worker.

A trace goes as one transaction (`traceLifecycle: 'static'`), scrubbed in `beforeSendTransaction`. GlitchTip documents transactions and their p50 and p95 per group, and documents nothing about the span streaming that Sentry's SDK uses by default since version 11. The SDK marks `beforeSendTransaction` deprecated and removes it in version 12, so the scrub moves to `beforeSendSpan` before that upgrade. An upgrade that skips the move would send traces unscrubbed.

The rate is a setting, `GLITCHTIP_TRACES_SAMPLE_RATE`, a number from 0 to 1. Unset, it is 0, and no trace leaves, as before this ADR. Production sets 1.0 when the baseline starts and 0.1 after it.
