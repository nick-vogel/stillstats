# Deploy

A merge to `main` deploys staging, and a published GitHub release deploys production. Nothing else deploys production: no job a merge runs references the `production` Environment.

## Staging

`.github/workflows/ci.yml` runs four jobs in a chain, and a failed job stops every job after it:

1. `check` runs `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test`, on the pull request only.
2. `images` builds the API image (`apps/api/Dockerfile`, which also builds `apps/site` and `apps/web`) and the worker image (`apps/worker/Dockerfile`), smoke-runs them, and pushes them to GHCR tagged `sha-<commit>`.
3. `migrate-staging` runs the migrations against the staging database as the migration role, from the image just pushed, in the `staging` Environment.
4. `deploy-staging` moves `staging` to the `sha-<commit>` images, then calls the staging Dokploy deploy webhook of the API, then of the worker, in the `staging` Environment.

On a pull request, `check` and `images` run and nothing is pushed or deployed. On a merge to `main`, `images`, `migrate-staging` and `deploy-staging` run, and `check` is skipped: the pull request already ran the suite on the same code, so the push run does not bill it a second time. Each job after `check` runs when no job before it failed or was cancelled, so a skipped `check` lets the chain run and a failed one stops it.

Skipping the suite on the merge is safe only because of the branch protection on `main`. It requires every change to reach `main` through a pull request, with no approval needed and with admins held to the same rule, so no push to `main` skips the check. It requires the "Lint, type check and test" check to pass on the pull request, and it requires a pull request to be up to date with `main` before it merges (strict), so the merge commit holds exactly the code the check passed on. Without that rule, a pull request could merge while behind `main`, and staging would deploy a merge commit whose code no run had tested.

The staging Dokploy applications pull `:staging`. Nothing checks which image the staging containers run after a merge, because Cloudflare Access keeps CI out of staging; read the version in the account menu on staging instead. The staging box, its database and its Dokploy applications are set up by hand (creator-analytics#573).

Cloudflare Access does not cover every path to the staging API. A request sent straight to main-box's IP with the `staging.stillstats.com` host header skips Cloudflare, and Traefik routes it to the staging API all the same. So on staging the API checks the Access token itself, as Cloudflare's guide to [validating the Access token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) advises: every request needs a `Cf-Access-Jwt-Assertion` header that the team signed for the `staging.stillstats.com` application, unexpired, or it gets 403 with no body and reaches no route, `/health` and Google's RISC webhook included. The API reads the header, never the `CF_Authorization` cookie, and fetches the team's public keys from `https://<team domain>/cdn-cgi/access/certs`, so Cloudflare's key rotation needs no change here. When it cannot reach those keys, it still answers 403 and reports the failure to GlitchTip. Production checks no token (creator-analytics#593).

One request is exempt: a `POST` to exactly `/api/stripe/events`, Stripe's webhook for the tips and Pro, reaches its route with no token. Stripe cannot send the Access token, so without the exemption no Stripe sandbox delivery would reach staging. The route's own check of the `Stripe-Signature` header protects it instead: a delivery Stripe did not sign for `STRIPE_WEBHOOK_SECRET` gets 400 before its event is read or anything is written. The exemption is the exact method and path, so a `GET`, a trailing slash or any other path under, around or like it still needs the token. Cloudflare Access has the matching Bypass policy for `staging.stillstats.com/api/stripe/events`, which Nick adds by hand, so that Stripe's delivery gets past Cloudflare to the API at all.

The staging build of the extension (`pnpm build:extension:staging`, in the README) gets through Access with a service token, which it sends as the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers. The token is `stillstats-staging-extension` in Zero Trust, under Access controls, Service credentials, with a one-year duration, and the `staging.stillstats.com` application has a Service Auth policy that includes it. Walked on 2026-11-11 (creator-analytics#581 step 4): the headers got through as they are, and Access needed no change to answer the extension's preflight. The build reads the token's two values from the local env, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in `creator-analytics/local.env` in the private secrets repo (the README, Development). When the token nears its expiry, Refresh in the dashboard extends it by a year and keeps the same secret.

## Release

Production deploys from a published GitHub release, by `.github/workflows/release.yml`. Publish it from the release note's merge commit on `main`, after that commit's CI run has pushed its images, tagged with the bare version (`2026.11.9`, no `v`). [release-notes.md](release-notes.md) covers the note and the check before publishing.

The workflow runs these steps in order, and a failed step stops every step after it:

1. The release content package's tag check (`pnpm --filter @creator-analytics/releases release-tag-check`), in a checkout of the tagged commit. The tag must equal the newest app release note in that commit. A refused tag fails the run here, before any migration.
2. A check that the tagged commit's `sha-<commit>` API and worker images are on the registry.
3. The GitHub release body is replaced with the release note's text, the markdown below its frontmatter.
4. The production migrations, from the `sha-<commit>` API image, in the `production` Environment.
5. The version tag (`2026.11.9`) is added to both `sha-<commit>` images and `latest` moves to them, on the registry, so the three tags share one digest.
6. The production Dokploy deploy webhook of the API, then of the worker.
7. A check that the running API is the new image: it polls `https://stillstats.com/api/client-settings` for about 5 minutes until the answer's `version` is the tag and its `commit` is the tagged commit's first 7 characters (Dokploy #5496, below). The worker answers nothing over HTTP, so nothing checks it.

An extension tag (`extension-1.0.0`) passes the tag check and deploys nothing; the release body is left as written. A pre-release deploys nothing. The first three steps reference no Environment, so production's secrets reach only the migration and the deploy. Two releases never run at once: the workflow's concurrency group is `production`, and a running release is never cancelled.

When a step fails:

- The tag check: the tag is not the newest app release note in the commit, or is no valid version. Delete the release. The tag ruleset `release tags: no move, no delete` refuses a move or a delete of a `20*` or `extension-*` tag, from anyone: set it to Disabled in the repository's Settings, Rules, delete the tag, and set it back to Active. Then publish again with the right tag, or from the commit that holds the note.
- The image check: the merge commit's CI run has not pushed its images yet, or failed. Wait for the run to go green, or fix it, then re-run the failed jobs of the release run.
- The migration: production's schema is as the failed migration left it, and the old images still run, since `latest` did not move. Fix the migration in a new release.
- The deploy or the running-image check: redeploy the application in Dokploy by hand, then read `https://stillstats.com/api/client-settings` until it answers the new version and commit. Re-running the deploy job retags and redeploys again, which is safe.

## Rollback

Roll back when a release breaks production and the fix will take longer than going back. `.github/workflows/rollback.yml` puts an earlier release's images back on production, by its version. Run it from the newest release tag, with the version to go back to:

```sh
gh workflow run rollback.yml --ref <newest release tag> -f version=<version>
```

Or open the workflow in the Actions tab, pick the newest release tag under "Use workflow from", and type the version. The run must be from the newest release tag for two reasons: the release content is read there, so it holds every release note production may have run, and the `production` Environment admits deployment tags only.

The workflow runs these steps in order, and a failed step stops every step after it:

1. A check that the run is from the newest release tag on the repository.
2. The release content package's rollback check (`pnpm --filter @creator-analytics/releases rollback-check --version <version>`): the version must have an app release note, and no newer app release may set `removes: true`. A refused rollback names each remove release in the way, and nothing moves.
3. A check that the version's API and worker images (`<version>`) are on the registry. A release adds that tag only after its migration succeeds, so a version with no image never ran on production.
4. `latest` moves to the version's images, on the registry, in the `production` Environment.
5. The production Dokploy deploy webhook of the API, then of the worker.
6. A check that the running API is the version's image: it polls `https://stillstats.com/api/client-settings` for about 5 minutes until the answer's `version` is the version and its `commit` is the first 7 characters of the commit its tag names (Dokploy #5496, below). The worker answers nothing over HTTP, so nothing checks it.

No migration runs, so the schema stays at the newest release's. That is safe because every migration keeps the previous images working ([the release step](#the-release-step)), and the rule that a remove release comes after an expand release means only a remove release can leave a schema older code does not fit. The first three steps reference no Environment, so production's secrets reach only the rollback itself. A rollback shares the release workflow's concurrency group, `production`, so it never runs beside a release or another rollback, and a running one is never cancelled. A rollback to the newest release itself passes and puts the same images back, which also clears a container Dokploy #5496 left running.

The next release goes forward from the newest release, not from the version rolled back to: its migrations, tag check and note follow the release steps above, and it moves `latest` again.

When a step fails:

- The ref check: the run is from a branch or an older tag. Run it again from the newest release tag, which the error names.
- The rollback check: the version has no app release note, or is no valid version, or a newer release removed something. Past a remove release there is no going back, since the old code may not fit the schema after it: fix forward in a new release instead, or roll back to the remove release or a version after it.
- The image check: the version's release never reached production. Pick a version that did.
- The retag, the deploy or the running-image check: redeploy the application in Dokploy by hand, then read `https://stillstats.com/api/client-settings` until it answers the version and its commit. Re-running the rollback job retags and redeploys again, which is safe.

## Images

- `ghcr.io/nick-vogel/creator-analytics-api`
- `ghcr.io/nick-vogel/creator-analytics-worker`

`images` pushes `sha-<commit>` on every merge, and only that tag. `deploy-staging` moves `staging` to it after the staging migration succeeds, so a failed staging migration leaves `staging` on the last staged image. A release adds the version tag (`<version>`, such as `2026.11.9`) and moves `latest` to the tagged commit's `sha-<commit>`, after the production migration succeeds, so a failed production migration leaves `latest` on the last release. Every retag happens on the registry, so `sha-<commit>`, `staging`, `<version>` and `latest` on one commit share one digest. `latest` moves only in the release workflow and in [the rollback workflow](#rollback), which moves it back to an earlier version's images. Each image runs its package's `start` script under `tini`, which passes a stop signal on to Node. The images carry the workspace's TypeScript sources, which Node 24 runs directly; nothing compiles to `dist`.

The API image builds the site and the web app with two build arguments, `VITE_GLITCHTIP_DSN` and `VITE_OPENPANEL_API_URL`, which name hosts staging and production share, so the pages' content security policy is the same on both. The site reads `VITE_OPENPANEL_API_URL`, and reads `VITE_GLITCHTIP_DSN` only to name its host in the policy. A third build argument, `COMMIT_SHA`, is the commit the image is built from, which CI sets to `$GITHUB_SHA`; the image holds no `.git`, so it cannot read the commit itself. The build fails when `VITE_OPENPANEL_API_URL` or `COMMIT_SHA` is empty, because without the URL the OpenPanel SDK sends to openpanel.dev's cloud (ADR 0007). The OpenPanel client ID, the environment and the version are not built in: the web app and the site read them at load from `GET /api/client-settings`, so one image serves staging and production. The version is the newest app release note in the image. The API serves the site at `/` and the web app under `/app`; `SITE_ROOT` and `WEB_ROOT` override where it finds each build.

## The smoke run

The `images` job runs both images against a fresh Postgres, in the same sequence as production:

1. It creates `app_migrator` and the database, as production does by hand.
2. It runs the migrations from the API image as `app_migrator`.
3. It creates `smoke_web` in role `app_web` and `smoke_worker` in role `app_worker`.
4. It starts both images, each as its own login role, with `STILLSTATS_ENVIRONMENT=production`.
5. `apps/worker/test/smoke-run.ts` commits a channel and its deletion request, and waits for the running worker to delete the channel. This is the one check of pg-boss fetching a committed job as a non-owner login role, which the test suite cannot make.
6. It checks that the API answers `/health`, serves the homepage at `/`, serves the web app at `/app`, and answers `/api/client-settings` as production, which shows the image's install holds the release content the answer reads.

To run it by hand, see the steps of the `images` job; `smoke-run.ts` reads `DATABASE_URL` and an optional `SMOKE_TIMEOUT_MS`.

## The release step

`migrate-staging` on a merge and `migrate` on a release each join the tailnet as an ephemeral node tagged `tag:ci`, then runs `pnpm --filter @creator-analytics/database migrate` in the new API image. That is `packages/database/src/migrate-cli.ts`, never bare `drizzle-kit migrate`: it also forces row-level security, installs pg-boss and creates its queues.

The migrations run before the new images start, so the old images run against the new schema for the length of a deploy, and for longer if the deploy fails. Every migration has to keep the running images working.

The rule spans a release, because production runs the last release's images against the new release's schema. A change that removes a column, a table or a route ships as two releases: an expand release first, which adds what replaces it and stops using the old one, and a remove release later, which removes it. The remove release's note sets `removes: true` and says what went, so [a rollback](#rollback) never goes back past it.

An agent drafts each app release note from the pull requests merged since the last release, by the procedure in [release-notes.md](release-notes.md).

## Environments

Repository variables (public values, baked into the site and the web app), shared by both paths:

- `VITE_OPENPANEL_API_URL`, required: the self-hosted OpenPanel API.
- `VITE_GLITCHTIP_DSN`: the web app's GlitchTip DSN. Unset, the web app reports no error. The site sends no error, but its pages' content security policy names the DSN's host, as the web app's does.

Repository secrets, shared by both paths:

- `STILLSTATS_FONTS_TOKEN`: a fine-grained personal access token with read-only Contents access to `nick-vogel/stillstats-fonts` and nothing else. The test job and the image job check that repository out, so the build draws in Switzer and Cabinet Grotesk (`packages/visual-system/src/fontshare.ts`). GitHub gives a pull request from a fork no secret, and its run builds with the fallback fonts. A push to `main` with the secret unset fails before it builds the images, so staging and production never run images without the fonts. Renew the token before it expires: an expired one fails the checkout, and with it every deploy.

Two GitHub Environments, each holding the same five secret names with its own values:

- `staging`, with the deployment branch rule `main` only.
- `production`, with deployment tags only, so only a release's run reaches it.

The secrets in each:

- `MIGRATION_DATABASE_URL`: the Environment's Postgres as `app_migrator`, by its tailnet address.
- `DOKPLOY_WEBHOOK_API` and `DOKPLOY_WEBHOOK_WORKER`: the deploy webhook URL of the Environment's Dokploy API and worker applications.
- `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET`: a Tailscale OAuth client that may create nodes tagged `tag:ci`, which the migration job joins the tailnet with. The tailnet policy has to let `tag:ci` reach Postgres on the Environment's database. Both Environments may hold the same client.

Delete the repository-level copies of these five secrets once both Environments hold them. An Environment's secret overrides a repository secret of the same name, but a job with no Environment reads the repository's, so a repository copy of production's values would let a job reach production without the `production` Environment. Until the copies are gone, the staging jobs read whichever values an Environment does not override.

`GITHUB_TOKEN` pushes and pulls the images and writes the release body; it needs no setup.

## Production database roles

Provision these once, as a superuser, before the first deploy:

1. Create `app_migrator` with `LOGIN CREATEROLE`, and the database owned by it.
2. Let the first `migrate` job run. It creates `app_web`, `app_worker`, `app_claim` and `app_roster`.
3. Create one login role for the API in role `app_web`, and one for the worker in role `app_worker`.

The API and the worker refuse to start as a superuser, a `BYPASSRLS` role or a table owner, so neither can run as `app_migrator`. Give `MIGRATION_DATABASE_URL` to CI only, never to a Dokploy application.

## Dokploy

Two applications in each environment, each with the Docker image source on a floating tag: `latest` in production, `staging` on staging.

- The API: `ghcr.io/nick-vogel/creator-analytics-api:latest` (staging: `:staging`), port 3000. Env: `STILLSTATS_ENVIRONMENT` (`production` or `staging`, required: unset or any other value, the API refuses to start; production's application needs it before the first release), `DATABASE_URL` (the API's login role), `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEYS`, `GOOGLE_IDENTIFIER_KEY`, `GLITCHTIP_DSN`, `OPENPANEL_WEB_CLIENT_ID` (the OpenPanel project's website client, which the API answers to the web app and the site at load; unset, neither sends an event), and for the event relay and the `revenue` event `OPENPANEL_API_URL`, `OPENPANEL_CLIENT_ID` and `OPENPANEL_CLIENT_SECRET`, the same project's write client and its secret (all three or none; with any unset the relay sends nothing). The two client IDs differ: the browser sends with the website client and no secret, and the API sends with the write client and its secret, and for a Tip `STRIPE_PAYMENT_LINK_URL` (the Stripe Payment Link's URL), `STRIPE_WEBHOOK_SECRET` (its webhook's signing secret) and `STRIPE_PAYMENT_LINK_ID` (the same Payment Link's ID, `plink_...`, from its page in the Stripe dashboard). All three or none: with none the product offers no tip, and with some but not all, or an ID that does not start with `plink_`, the API refuses to start. For Pro, `STRIPE_SECRET_KEY` (the API's secret key, `sk_...`, or a restricted key, `rk_...`, with write on Checkout Sessions, Customer Portal sessions, Customer Portal configurations (the API makes Stillstats' own), Subscriptions (an added Block raises the quantity) and Invoices (the Block's preview, `POST /v1/invoices/create_preview`), and read on Prices, since the upgrade screen's amounts come from `GET /v1/prices/:id`), `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` (the Stillstats Pro product's two prices, `price_...`, which Checkout sells; the webhook reads a subscription's plan from its billing interval and never from these), with `STRIPE_WEBHOOK_SECRET`. All three or none: with none no channel may subscribe, and with some but not all, a price ID that does not start with `price_`, a key that starts with neither `sk_` nor `rk_`, or no `STRIPE_WEBHOOK_SECRET`, the API refuses to start. Set the tip's three with them: a `STRIPE_WEBHOOK_SECRET` with no Payment Link reads as a half-set tip, and the API refuses to start. For [the feedback notification email](#the-feedback-notification-email), `CLOUDFLARE_EMAIL_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, `FEEDBACK_EMAIL_FROM` and `FEEDBACK_EMAIL_TO`. All four or none: with none the API saves feedback messages and sends no email, and with some but not all, or a from or to address that is not an email address, the API refuses to start and names the missing ones. Production sets them, and staging may set them too, so Nick can test the email there, since only he reaches staging through Access. On staging only, for [the Access check](#staging), `CLOUDFLARE_ACCESS_TEAM_DOMAIN` (the bare team domain, `nlvogel.cloudflareaccess.com`, with no `https://`) and `CLOUDFLARE_ACCESS_AUD` (the Application Audience (AUD) Tag of the `staging.stillstats.com` Access application, in Zero Trust > Access controls > Applications > Edit > Additional settings). Both are required on staging: with either unset, or a team domain that holds a scheme, a port or a path, the staging API refuses to start. Production does not read them. `ADMIN_USER_IDS` (optional, in both environments) is the admin allowlist: the user IDs, comma-separated, of the accounts that may open the admin feedback screen at `/app/admin/feedback` (creator-analytics#583). Each is the `id` of the account's row in `users`, Better Auth's user ID, not a Google account ID or an email. Spaces around an ID are ignored. Unset or empty, no one is an admin: the screen shows its not-found page and every route under `/api/admin/` answers 404, as an unknown route does. To find Nick's ID, sign in once in that environment, then as a superuser (row-level security is forced on the table owner too, so `app_migrator` reads no row) run `select id from users where email = '<Nick's email>';`, set the value in the API application, and redeploy it. `GLITCHTIP_TRACES_SAMPLE_RATE` (optional) is the share of API requests whose performance trace goes to GlitchTip, ID-free (ADR 0023): a number from 0 to 1. Unset or empty, it is 0, and only errors go, as before. Production sets 1.0 when the baseline of creator-analytics#1037 starts and 0.1 after it. Any other value, such as `1.5` or `abc`, stops the API at start.
- The worker: `ghcr.io/nick-vogel/creator-analytics-worker:latest` (staging: `:staging`), no port. Env: `STILLSTATS_ENVIRONMENT` (`production` or `staging`, required as on the API; production's application needs it before the first release), `DATABASE_URL` (the worker's login role), `DELETION_LOG_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEYS`, `GLITCHTIP_DSN`, and for the daily active user count `OPENPANEL_API_URL`, `OPENPANEL_CLIENT_ID` and `OPENPANEL_CLIENT_SECRET` (all three or none; with none the count sends nothing and reports that to GlitchTip every day). The three Google and token values are the API's own: the worker's daily probe refreshes the tokens the API stored, and with them the worker creates each connected channel's YouTube reporting job. The three OpenPanel values are the API's own too: the same project's write client and its secret. For the cancellation and refund of a deleted paid channel's subscription, `STRIPE_SECRET_KEY`: a secret key, `sk_...`, or better a restricted key, `rk_...`, with write on Subscriptions and Refunds and read on Invoices. A key that starts with neither `sk_` nor `rk_` stops the worker at start. Unset, a paid channel's deletion still deletes the channel's rows on time, and its `cancelSubscription` job fails on every retry, so the subscription keeps charging until someone acts. That shows in GlitchTip as "A cancelSubscription job failed" on each run, and at 12 hours as "A subscription cancellation is still pending 12 hours after its deletion request", with the deletion request's and the channel's internal ids. The same alarm fires when Stripe is down for the 12 hours; the pending row in `subscription_cancellations` keeps the Stripe subscription ID until the cancellation succeeds. `GLITCHTIP_TRACES_SAMPLE_RATE` (optional) is the API's setting, set to the same value: a number from 0 to 1, unset or empty 0, so only errors go, as before, and any other value stops the worker at start. The worker opens no trace of its own, and under the static lifecycle the SDK opens no root span of its own (its pg, http and fetch spans need a parent), so the worker sends no trace; one the SDK did open would be scrubbed as the API's (ADR 0023).

The packages inherit the repository's visibility, so Dokploy pulls them with a registry credential for `ghcr.io`: a GitHub token with `read:packages`.

## The feedback notification email

The API emails Nick once for each saved feedback message, through Cloudflare Email Service's REST API. The email holds the type, the time and a link to the admin screen, never the text, the reply address or the account. The send runs after the save, and the form answers 201 whether it succeeds or fails; a failed send is reported to GlitchTip with the message's ID. A send to a verified destination address is free on every plan, also when the domain has only Email Routing, and it may only come from a routing domain. Production sets the four settings, and staging sets them as well while Nick tests the email there. With none set, an environment saves each message and sends no email:

- `CLOUDFLARE_EMAIL_ACCOUNT_ID`: the account ID of Nick's Cloudflare account, on the account's overview page in the dashboard.
- `CLOUDFLARE_EMAIL_API_TOKEN`: an API token that can send. In the dashboard, open My Profile, then API Tokens, then Create Token, and choose a custom token. Give it the account permission "Email Sending: Edit", limit its account resources to Nick's account alone, and copy the token once it is created: Cloudflare shows it only then.
- `FEEDBACK_EMAIL_FROM`: the from address, on `stillstats.com`, which has had Email Routing since #26. An address on any other domain is refused. Nick uses `feedback@stillstats.com`.
- `FEEDBACK_EMAIL_TO`: Nick's address, which must be a verified destination address under Email Routing, so the send stays free.

## The domain

The product answers on `https://stillstats.com`. Every setting below names that origin, so a domain change touches each of them:

- Cloudflare: the `A` record for `stillstats.com` points at the main box, proxied, with SSL mode Full. `www.stillstats.com` and `stillstats.app` redirect to `https://stillstats.com` with a 301 that keeps the path and query. No Worker route sits on `stillstats.com`, because a Worker route answers before the origin.
- Dokploy: the API application has the domain `stillstats.com`, port 3000, HTTPS on and certificate None. The worker has no domain.
- `BETTER_AUTH_URL` on the API is `https://stillstats.com`. The API builds every Google redirect URI from it, so a change needs a redeploy.
- Google: the OAuth web client's redirect URIs are `https://stillstats.com/api/auth/callback/google` and `https://stillstats.com/api/channels/connect/callback`, and `stillstats.com` is an authorized domain, verified in Search Console.
- Google Cross-Account Protection: the RISC stream delivers to `https://stillstats.com/api/risc/events`. A `stream:update` signed by the `risc-config` service account key changes it.
- Stripe: the webhook endpoint is `https://stillstats.com/api/stripe/events`, listening for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. Its signing secret is the API's `STRIPE_WEBHOOK_SECRET`. Stripe sends those events for every Checkout Session and subscription on the account, so the API takes a tip only from a session whose Payment Link is `STRIPE_PAYMENT_LINK_ID`, and a subscription only from a session or subscription whose metadata names a Stillstats channel, at whatever price, and answers any other with 200 and does nothing. A subscription's plan is its item's billing interval (`month` is monthly, `year` is annual), not a match against `STRIPE_PRICE_MONTHLY` or `STRIPE_PRICE_ANNUAL`, so a subscription that keeps an old price after a price change keeps its events recorded, and a price change needs no step beyond pointing the two settings at the new prices (ADR 0022). A Stillstats subscription whose item bills neither monthly nor annually still records its status, the end of its paid period and its purge date, keeps the plan the row holds for the same subscription (a new or replacing one records no plan until its Checkout lands), and reports to GlitchTip with its subscription ID unless its channel no longer exists; its paid invoices count as any other.
- Cloudflare Email Routing: `stillstats.com` is the routing domain the feedback notification comes from, so `FEEDBACK_EMAIL_FROM` is an address on it.
- OpenPanel: the website project allows the domain `https://stillstats.com`. Events from any other origin are refused.
- The release and rollback workflows (`.github/workflows/release.yml` and `.github/workflows/rollback.yml`): their running-image checks read `https://stillstats.com/api/client-settings`.

Dokploy issue [#5496](https://github.com/Dokploy/dokploy/issues/5496) reports that a redeploy of an application on a floating tag such as `latest` can pull the new image and still leave the old one running. The release workflow checks the API: its last step waits until `/api/client-settings` answers the new version and commit, and fails if it does not within about 5 minutes. Nothing checks the worker, or staging; after a release, check by hand that the worker container's image is the new `sha-<commit>` digest.
