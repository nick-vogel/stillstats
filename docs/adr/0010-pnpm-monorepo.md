# One pnpm monorepo

The web app, the marketing site, the browser extension and the job worker live in `apps/`, and the shared modules (accounts and memberships, token vault, YouTube gateway, retention engine, entitlements) live in `packages/`, in one pnpm workspace. The extension and the web app consume the same private API types, and the YouTube gateway must be the single shared implementation, which separate repositories would make easy to fork. Matches the `wellness` repository's layout.
