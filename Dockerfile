# The API and the worker (ADR-0023, D-2): one image, two start commands, chosen by fly.api.toml and fly.worker.toml.
# Node runs the TypeScript directly (type stripping), so there's no build step. The web app isn't in this image: it's
# built with Vite and served by Cloudflare.
FROM node:24-slim

ENV NODE_ENV=production \
    CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
# The pnpm version pinned in package.json's packageManager.
RUN corepack enable

# Dependencies first, so a code change doesn't reinstall them. Every workspace project's package.json is copied so the
# lockfile matches, but only the API's and the worker's production dependencies are installed, with the workspace
# packages they use. No install scripts: the only one generates the API client's types, which the API imports as
# types only, so they're stripped before it runs.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@parking/api..." --filter "@parking/worker..."

# The code: the contract the API's routes come from (ADR-0004), the database package and its migrations, and the two
# apps. Not the web app, the tests, or their fixtures.
COPY api/openapi.yaml api/
COPY packages/db/src packages/db/src
COPY packages/db/migrations packages/db/migrations
COPY apps/api/src apps/api/src
COPY apps/worker/src apps/worker/src

USER node
EXPOSE 8180
CMD ["node", "apps/api/src/server.ts"]
