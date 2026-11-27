---
paths:
  - "**/*.test.{ts,tsx}"
  - "packages/database/test/**/*.ts"
---

# Row-level security is tested in Postgres

**A test of which rows a query, a policy or a scope lets through runs on the database harness, as the non-owner `app` login role inside a real scope, against seeded rows, and asserts on the rows that come back.**

Row-level security is how the database keeps channels apart (ADR 0002), and only Postgres can show that it holds. `packages/database/test/harness.ts` connects as `app`, a member of `app_web` and `app_worker` that owns no table, and opens each scope through `web` or `worker` the way the product does. The `admin`, `migrator` and `bypass` connections in `databaseUrls()` are there for setup and for the refusal tests in `open.test.ts`. A row read through one of them says nothing about what a creator can read.

Seed the rows the policy has to refuse beside the rows it has to admit: another channel's row, another user's row. A fixture that holds only admitted rows passes against a policy that admits everything.

A mock or an in-memory stand-in for the database cannot answer a row-level security question, so a test that uses one makes no claim about which rows are visible.

A review fails a change that:

- claims which rows a query, policy or scope admits without running it in Postgres through the harness;
- reads the rows under test through the `admin`, `migrator` or `bypass` connection;
- seeds no row that the policy under test has to refuse.
