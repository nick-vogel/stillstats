# Retention windows shorter than YouTube requires

Free tier analytics are cached for 24 hours or less and never stored as history. Paid tier history (CTR and impressions first) is kept while the subscription is active and purged 30 days after cancellation. A channel's live data is deleted within 24 hours of a user deletion or a revocation, and the backups that hold it expire within 5 days. Both stay under YouTube's 7-day requirement for in-app revocation.

The windows are published, and they are a product claim competitors do not make (Social Blade refuses to delete creator data). Paid history has to be stored because the Reporting API keeps its files for 60 days and the Analytics API does not return impressions or CTR, not because the creator would otherwise lose it: YouTube Studio shows a channel's impressions and CTR for its whole lifetime.
