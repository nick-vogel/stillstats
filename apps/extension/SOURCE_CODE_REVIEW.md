# Building Stillstats for Firefox from this source

The extension lives in `apps/extension` of a pnpm workspace, and builds from two workspace packages, `packages/api-types` and `packages/visual-system`. This archive holds the workspace root's files and those three folders.

You need Node.js 24 (`.node-version`) and pnpm 10.13.1 (`packageManager` in `package.json`, for example through `corepack enable`).

From the root of the extracted archive:

```sh
pnpm install --frozen-lockfile
pnpm --filter @creator-analytics/extension exec wxt build -b firefox --mv3
```

The build is `apps/extension/.output/firefox-mv3`, the same files as the submitted add-on.
