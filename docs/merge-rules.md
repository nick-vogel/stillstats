# Merge rules

The merge owner (`/km:merge-owner`) reads this file before its first gate. Read from GitHub on
2026-11-27, from the ruleset `main: pull requests with green CI only` on `nick-vogel/stillstats`.
`main` has no classic branch protection.

- **Review rules.** A pull request is required, with 0 approvals. A push to a PR dismisses a stale
  approval, but no approval is required, so a push costs nothing. Every review thread must be
  resolved before the merge. The ruleset has no bypass actor, so nobody pushes to `main`
  directly, and nobody force-pushes or deletes it. A second ruleset, `release tags: no move, no
  delete`, guards the `20*` and `extension-*` tags.
- **Merge method.** A merge commit (`gh pr merge <n> --merge`), the only method the ruleset
  allows. GitHub deletes the head branch after the merge.
- **Together check.** CI on every pull request: `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm build`, `pnpm test` (`Lint, type check and test`), then the image smoke
  run (`Build, smoke-run and push the images`). Both checks are required, and the ruleset requires
  a PR to be up to date with `main` (turned on 2026-11-27). The push to `main` does not run the
  suite again, so this rule is what makes the merge commit's code the code CI tested. When `main`
  moved under a PR, run `gh pr update-branch <n>` and wait for both checks again.
- **Repo gates.**
  - The repository is public (`.claude/rules/public-repository.md`). Before the merge,
    `pnpm check:private --range origin/main..origin/<head>` passes on the PR's commits, and
    `pnpm check:private --stdin` passes on the PR's title and body.
  - The Drizzle migrations in `packages/database/drizzle` (with `meta/_journal.json` and the
    snapshots) stay in order across PRs. Two PRs that each add the next number conflict in the
    journal, and the second one regenerates its migration on top of the first.
  - Every migration keeps the running images working (`docs/deploy.md`), because staging migrates
    before the new images start.
  - The post-merge run on `main` ends green before the next merge.
- **Post-merge run.** CI (`.github/workflows/ci.yml`) on the push to `main`: it builds and
  smoke-runs the images, pushes the `sha-<commit>` tags, migrates the staging database, and
  deploys staging through Dokploy. A newer push to `main` replaces a run that is still pending,
  so a merge during a run can skip the earlier commit's staging deploy. Production deploys only
  from a published release (`release.yml`), never from a merge.
