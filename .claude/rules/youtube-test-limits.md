---
paths:
  - "**/*.test.{ts,tsx}"
  - "packages/fake-google/**/*.ts"
  - "apps/extension/test/**"
---

# What a stand-in for Google cannot show

**A test that stands in for Google, through `packages/fake-google` or a saved youtube.com or Studio page under `apps/extension/test/fixtures`, says in the file what only the real Google can show, and names the human step that shows it.**

The fake server answers the way Google's documentation says Google answers. A saved page is the page as Chrome drew it on the day it was saved. Neither one can show the live quota, Google's consent screen or the scope strings it grants, the numbers and row order of a real report, which reports Google actually serves, or a change on Google's side after the fake was written or the page was saved.

The human step for the APIs is Nick signing in on the deployed product and reading his own channel. For a saved page it is the hand check on the live page in a signed-in browser, recorded on its issue, and a new save of the fixture once the live page has moved. Each fixture folder's `README.md` records what was saved and when.

A review fails a change that:

- adds a test against the fake Google server or a saved page with no statement of what it cannot observe;
- names no human step for what it leaves to the real Google.
