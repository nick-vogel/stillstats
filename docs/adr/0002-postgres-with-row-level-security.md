# Postgres with row-level security and cascading deletes

Channel data lives in one Postgres database. Every channel-owned row carries a channel id, row-level security blocks reads across channels, and `ON DELETE CASCADE` removes a channel's dependent rows. The published promises (channels never mix; deletion within 24 hours) need to be enforced by the database, not only by application code, because a database rule is easier to prove in YouTube's compliance audit and one missing filter cannot leak a channel.

## Considered Options

- **MongoDB.** Access control stops at the collection level, with no per-document policy, and there are no foreign keys, so both isolation and the deletion cascade would live only in application code.
- **One SQLite file per channel, plus a central database.** Makes aggregation impossible by construction and deletion a single file removal, but backups and schema migrations across thousands of files are an operational cost a solo build cannot carry.
