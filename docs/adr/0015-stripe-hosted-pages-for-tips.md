# Tips go through Stripe's hosted pages, and no Stripe code reaches the browser

Payment for features, which this ADR left for later, is decided in ADR 0022 (the Paid tier on Stripe's hosted pages, sold through Managed Payments).

A creator can leave Stillstats a one-time Tip of an amount they choose (creator-analytics#338). The payment provider is Stripe, on the LLC's existing Stripe account, with Stillstats as its own product in the catalog. A Tip is taken on a Stripe Payment Link: Stripe's own hosted page, which the web app opens in a new tab, and which sends the creator back to their profile in that tab when the payment completes. The tab the creator left stays on Stillstats, and it reads the support answer again once it is on view again.

Stillstats loads no Stripe code. No Stripe script, no Stripe library and no Stripe host is in the web app or the site, and the content security policy names no Stripe origin. A link to another origin is a navigation, which `connect-src` does not govern, so the policy stays as it is. Stripe's Node library is an API dependency only, for the webhook's signature check. Stripe receives what the creator types on its page and an opaque Stillstats user ID as `client_reference_id`, so the webhook can tell which creator tipped. The link carries no prefilled email.

Embedded checkout was rejected. Stripe's embedded and element-based checkouts run Stripe's script in the page, which ADR 0007 forbids as a third-party script and ADR 0014 keeps out as code loaded at runtime from another origin. A hosted page costs the creator one navigation and keeps every card detail on Stripe's side.

A Tip is a Tip and nothing more. It gives no Entitlement, it does not count toward the Paid tier, and the profile shows no supporter mark. Payment for features is a later decision, and this ADR does not make it.

The word is "tip", never "donation". Stripe's rule is that a donation needs a charitable purpose, and Stillstats has none, so "donation" appears nowhere in the product, the site or the Stripe product. CONTEXT.md holds the term.

The webhook takes only the Stillstats Payment Link's Checkout Sessions, matched on the link's `plink_` ID, because the LLC's account sells other products and Stripe sends `checkout.session.completed` for every one of their sales.

2026-11-18: Stillstats now has its own Stripe account, which holds only Stillstats products. The Payment Link filter stays, and now keeps the Paid tier's Checkout Sessions out of the tip path (creator-analytics#813).

With none of the three Stripe settings (the link's URL, its ID and the webhook's signing secret), the API offers no Tip and the web app shows no support UI. With some but not all, the API refuses to start, so a half-configured deploy fails at once rather than on a creator's click.

2026-11-19: the Paid tier named here is now called Pro, and sold as "Stillstats Pro", at $7 a month or $70 a year for each channel (creator-analytics#913). A Tip still gives no Entitlement and does not count toward it.

2026-11-19: the free tier no longer shows Pro's screens with sample numbers, because they read as the creator's own and put the sales pitch in front of them (creator-analytics#915). A Tip and its support UI are unchanged.
