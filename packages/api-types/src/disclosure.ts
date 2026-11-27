// Approved word for word in creator-analytics#56. Change them only with Nick: the web app's
// connection screen and the extension's first-run page both say them, so the two never disagree.
/** What Stillstats keeps of a creator's data, for how long, and who sees it. */
export const retentionAndSharingLines = [
  'Numbers refresh every 6 hours.',
  "It stores an encrypted token so it can read on your behalf. Disconnect, and it deletes your channel's data within 24 hours; backups expire within 5 days.",
  'It never sells or shares your data, and never shows it to anyone but you.',
] as const
