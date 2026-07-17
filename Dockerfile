# Multi-stage build producing a production image via Next.js "standalone"
# output. The runner keeps the full node_modules and prisma/ so Railway's
# pre-deploy command (migrate + account bootstrap) can run inside this image.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The postinstall hook runs `prisma generate`, so the schema must be present
# before `npm ci` — without it the whole install fails.
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Build-time-only placeholders (not secrets, never used at runtime): every
# page touching the database or auth is force-dynamic, so these only need to
# satisfy module-load-time validation during `next build`. Real values come
# from the deployment environment at container start.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Full node_modules + prisma/ (schema, migrations, bootstrap scripts) so the
# pre-deploy command — prisma migrate deploy + tsx prisma/create-demo-users.ts
# — works inside this image. package.json last: it must override the minimal
# one the standalone output ships.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
