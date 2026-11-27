# One YouTube gateway, official API only

A single module is the only code that calls Google. It holds the quota count, the short cache, and every YouTube policy rule, so one review covers all of them. It uses the official Data, Analytics and Reporting APIs and nothing else: no YouTube private (InnerTube or Studio) endpoints, no creator browser session, no scraping, and no transcripts of other channels' videos.

This is a deliberate deviation from the market. vidIQ, TubeBuddy and 1of10 call YouTube's private endpoints with the creator's session, and several tools scrape. Doing the same would give features faster and break both YouTube Developer Policies III.E.6 and the privacy position the product exists for.
