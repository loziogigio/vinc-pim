# syntax=docker/dockerfile:1.6

ARG NODE_IMAGE=node:20-alpine
ARG PNPM_VERSION=9.5.0

# Base image with pnpm enabled
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Install dependencies (cached by lockfile)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Use BuildKit cache for the pnpm store for faster repeated builds
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build the app
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Accept build-time args and expose them as env for Next build
ARG VINC_TENANT_ID
ARG VINC_MONGO_URL
ARG SOLR_URL
ARG SOLR_ENABLED
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CUSTOMER_WEB_URL
ARG VINC_ANTHROPIC_API_KEY

ENV VINC_TENANT_ID=$VINC_TENANT_ID
ENV VINC_MONGO_URL=$VINC_MONGO_URL
ENV SOLR_URL=$SOLR_URL
ENV SOLR_ENABLED=$SOLR_ENABLED
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_CUSTOMER_WEB_URL=$NEXT_PUBLIC_CUSTOMER_WEB_URL
ENV VINC_ANTHROPIC_API_KEY=$VINC_ANTHROPIC_API_KEY

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    echo "Building with VINC_TENANT_ID=${VINC_TENANT_ID}" && pnpm build

# BullMQ Worker runtime (separate container for workers)
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Re-declare args for worker environment
ARG VINC_TENANT_ID
ARG VINC_MONGO_URL
ARG SOLR_URL
ARG SOLR_ENABLED
ARG REDIS_HOST
ARG REDIS_PORT

ENV VINC_TENANT_ID=$VINC_TENANT_ID
ENV VINC_MONGO_URL=$VINC_MONGO_URL
ENV SOLR_URL=$SOLR_URL
ENV SOLR_ENABLED=$SOLR_ENABLED
ENV REDIS_HOST=$REDIS_HOST
ENV REDIS_PORT=$REDIS_PORT

# Copy node_modules and source files needed for workers
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/workers ./workers
COPY --from=build /app/src ./src
COPY --from=build /app/config ./config
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/vite.config.ts ./vite.config.ts

# Run as non-root user for security
RUN addgroup -S worker && adduser -S worker -G worker
RUN chown -R worker:worker /app
USER worker

CMD ["pnpm", "worker:all:prod"]

# Production runtime using Next.js standalone output (DEFAULT)
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Re-declare args and set runtime envs for SSR/server usage
ARG VINC_TENANT_ID
ARG VINC_MONGO_URL
ARG SOLR_URL
ARG SOLR_ENABLED
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CUSTOMER_WEB_URL
ARG VINC_ANTHROPIC_API_KEY

ENV VINC_TENANT_ID=$VINC_TENANT_ID
ENV VINC_MONGO_URL=$VINC_MONGO_URL
ENV SOLR_URL=$SOLR_URL
ENV SOLR_ENABLED=$SOLR_ENABLED
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_CUSTOMER_WEB_URL=$NEXT_PUBLIC_CUSTOMER_WEB_URL
ENV VINC_ANTHROPIC_API_KEY=$VINC_ANTHROPIC_API_KEY

# Run as non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Remove wget/curl/shell utilities to prevent RCE exploitation
RUN rm -f /usr/bin/wget /usr/bin/curl 2>/dev/null || true

# Create cache directory with correct permissions BEFORE switching user
RUN mkdir -p /app/.next/cache && chown -R nextjs:nextjs /app/.next

# Copy standalone server and static assets (as root, then fix ownership)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Fix ownership of all copied files
RUN chown -R nextjs:nextjs /app

# Switch to non-root user
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
