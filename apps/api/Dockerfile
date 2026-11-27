# syntax=docker/dockerfile:1
# The API image, which also serves the site and the web app. Build it from the repository root:
#   docker build -f apps/api/Dockerfile --build-arg VITE_OPENPANEL_API_URL=... \
#     --build-arg COMMIT_SHA="$(git rev-parse HEAD)" .
#
# Nothing compiles to dist: Node 24 strips the types of the workspace's .ts sources at run time.
# Node strips no types under node_modules, so the image keeps the workspace layout, where each
# workspace package is a symlink to its source, and never uses `pnpm deploy`.

FROM node:24.22.1-alpine AS base
# tini forwards a stop signal to the whole process group, so `pnpm start` passes it to Node.
RUN apk add --no-cache tini
# A shared corepack home, so the non-root user runs the pnpm that root prepared, offline.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate && chmod -R a+rX /opt/corepack
WORKDIR /repo

FROM base AS frontends
COPY pnpm-lock.yaml ./
# pnpm fetch reads each patch file the lockfile names.
COPY patches patches
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@creator-analytics/web..." \
  --filter "@creator-analytics/site..."
ARG VITE_GLITCHTIP_DSN
ARG VITE_OPENPANEL_API_URL
# Without an API URL, the OpenPanel SDK sends to openpanel.dev's cloud (ADR 0007).
RUN test -n "$VITE_OPENPANEL_API_URL" \
  || { echo 'VITE_OPENPANEL_API_URL is not set: the site and the web app are never built without it' >&2; exit 1; }
RUN pnpm --filter @creator-analytics/web --filter @creator-analytics/site build

FROM base AS runtime
ENV NODE_ENV=production
COPY pnpm-lock.yaml ./
# pnpm fetch reads each patch file the lockfile names.
COPY patches patches
RUN pnpm fetch --prod
COPY . .
RUN pnpm install --offline --frozen-lockfile --prod --filter "@creator-analytics/api..."
# The commit the image is built from, which staging's account menu shows. The image holds no .git.
ARG COMMIT_SHA
RUN test -n "$COMMIT_SHA" \
  || { echo 'COMMIT_SHA is not set: pass the commit the image is built from' >&2; exit 1; }
ENV COMMIT_SHA=$COMMIT_SHA
COPY --from=frontends /repo/apps/web/dist apps/web/dist
COPY --from=frontends /repo/apps/site/dist apps/site/dist
USER node
EXPOSE 3000
# Runtime env: STILLSTATS_ENVIRONMENT (production or staging; unset or anything else, the API
# refuses to start), DATABASE_URL (the API's own login role, never the migration role),
# BETTER_AUTH_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# TOKEN_ENCRYPTION_KEYS, GOOGLE_IDENTIFIER_KEY, GLITCHTIP_DSN, and optionally OPENPANEL_CLIENT_ID
# (the OpenPanel project the web app and the site send to, and with OPENPANEL_API_URL and
# OPENPANEL_CLIENT_SECRET the relay) and STRIPE_PAYMENT_LINK_URL, STRIPE_WEBHOOK_SECRET and
# STRIPE_PAYMENT_LINK_ID (all three or none; with some but not all, or an ID that does not start
# with plink_, the API refuses to start) and STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY and
# STRIPE_PRICE_ANNUAL (Pro; all three or none, with STRIPE_WEBHOOK_SECRET and the tip's
# settings, and with some but not all, a price ID not starting price_, or a key starting neither
# sk_ nor rk_, the API refuses to start) and CLOUDFLARE_EMAIL_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN,
# FEEDBACK_EMAIL_FROM and FEEDBACK_EMAIL_TO (the feedback notification email; all four or none,
# with some but not all the API refuses to start) and GLITCHTIP_TRACES_SAMPLE_RATE (a number from 0
# to 1, the share of requests whose ID-free trace goes to GlitchTip; unset is 0, errors only, as
# before; production sets 1.0 for the baseline and 0.1 after; any other value, the API refuses to
# start). On staging only, CLOUDFLARE_ACCESS_TEAM_DOMAIN (the bare team domain) and
# CLOUDFLARE_ACCESS_AUD (the Access application's AUD tag), both required there: with either
# unset, the staging API refuses to start. Production reads neither.
# The release step runs the migrations from this image with MIGRATION_DATABASE_URL:
#   pnpm --filter @creator-analytics/database migrate
ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["pnpm", "--filter", "@creator-analytics/api", "start"]
