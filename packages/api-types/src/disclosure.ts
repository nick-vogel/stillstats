// Approved word for word in creator-analytics#56. Change them only with Nick: the web app's
// connection screen and the extension's first-run page both say them, so the two never disagree.
// Line 3 approved word for word in creator-analytics#6 on 2026-11-27.
/** What Stillstats keeps of a creator's data, for how long, and who sees it. */
export const retentionAndSharingLines = [
  'Numbers refresh every 6 hours.',
  "It stores an encrypted token so it can read on your behalf. Disconnect, and it deletes your channel's data within 24 hours; backups expire within 5 days.",
  'It never sells your data, shares it only with the services the privacy policy names, and never shows it to anyone but you.',
] as const
