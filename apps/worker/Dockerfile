# syntax=docker/dockerfile:1
# The job worker image. Build it from the repository root:
#   docker build -f apps/worker/Dockerfile .
#
# Nothing compiles to dist: Node 24 strips the types of the workspace's .ts sources at run time.
# Node strips no types under node_modules, so the image keeps the workspace layout, where each
# workspace package is a symlink to its source, and never uses `pnpm deploy`.

FROM node:24.22.1-alpine
# tini forwards a stop signal to the whole process group, so `pnpm start` passes it to Node, and
# pg-boss stops gracefully.
RUN apk add --no-cache tini
# A shared corepack home, so the non-root user runs the pnpm that root prepared, offline.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate && chmod -R a+rX /opt/corepack
WORKDIR /repo
ENV NODE_ENV=production
COPY pnpm-lock.yaml ./
# pnpm fetch reads each patch file the lockfile names.
COPY patches patches
RUN pnpm fetch --prod
COPY . .
RUN pnpm install --offline --frozen-lockfile --prod --filter "@creator-analytics/worker..."
USER node
# Runtime env: STILLSTATS_ENVIRONMENT (production or staging; unset or anything else, the worker
# refuses to start), DATABASE_URL (the worker's own login role, never the migration role),
# DELETION_LOG_KEY, GLITCHTIP_DSN. Optional: OPENPANEL_API_URL, OPENPANEL_CLIENT_ID and
# OPENPANEL_CLIENT_SECRET, the API's own, all three or none, for the daily active user count; with
# none, the count sends nothing and reports that to GlitchTip on every run. STRIPE_SECRET_KEY (sk_ or
# rk_, write on Subscriptions and Refunds, read on Invoices), for the cancellation and refund of a
# deleted paid channel's subscription; with none, the deletion still deletes the channel's rows and
# the cancellation fails until the deletion's alarm reports it. GLITCHTIP_TRACES_SAMPLE_RATE, the
# API's, a number from 0 to 1; unset is 0, errors only, as before; any other value, the worker
# refuses to start.
ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["pnpm", "--filter", "@creator-analytics/worker", "start"]
