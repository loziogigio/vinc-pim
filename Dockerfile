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
# Skip Puppeteer's bundled Chrome download — system Chromium is used at runtime
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Use BuildKit cache for the pnpm store for faster repeated builds
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build the app
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Skip DB connections during build — pages are marked dynamic and rendered at request time
ENV NEXT_BUILD_PHASE=1
# Skip Puppeteer's bundled Chrome download — system Chromium is used at runtime
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Accept build-time args needed by Next.js at compile time
# NEXT_PUBLIC_* vars are inlined into client bundles, so they MUST be build args
# Server-only secrets (MONGO_URL, API keys) are passed at runtime via docker-compose
ARG SOLR_URL
ARG SOLR_ENABLED
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CUSTOMER_WEB_URL
ARG NEXT_PUBLIC_APP_VERSION=0.0.0

ENV SOLR_URL=$SOLR_URL
ENV SOLR_ENABLED=$SOLR_ENABLED
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_CUSTOMER_WEB_URL=$NEXT_PUBLIC_CUSTOMER_WEB_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm build

# BullMQ Worker runtime (separate container for workers)
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Copy node_modules and source files needed for workers
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/workers ./workers
COPY --from=build /app/src ./src
COPY --from=build /app/config ./config
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/vite.config.ts ./vite.config.ts

# Run as non-root user for security
RUN addgroup -S worker && adduser -S worker -G worker \
    && chown -R worker:worker /app
USER worker

# All secrets (VINC_MONGO_URL, REDIS_HOST, etc.) injected at runtime via docker-compose
CMD ["pnpm", "worker:all:prod"]

# Production runtime using Next.js standalone output (DEFAULT)
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install Chromium for Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Carry forward NEXT_PUBLIC_* from build (inlined in client JS, but also needed for SSR)
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CUSTOMER_WEB_URL
ARG NEXT_PUBLIC_APP_VERSION=0.0.0
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_CUSTOMER_WEB_URL=$NEXT_PUBLIC_CUSTOMER_WEB_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

# Create non-root user, cache dir, remove shell utilities in one layer
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs \
    && mkdir -p /app/.next/cache \
    && rm -f /usr/bin/wget /usr/bin/curl 2>/dev/null || true

# Copy standalone server and static assets with correct ownership
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public

USER nextjs

# All secrets (VINC_MONGO_URL, VINC_ANTHROPIC_API_KEY, etc.) injected at runtime via docker-compose
EXPOSE 3000

# Auto-restart container when MongoDB connection is dead
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
