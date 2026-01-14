# ---- Build Stage ----
FROM node:24.12.0-alpine AS builder

# Set working directory
WORKDIR /app

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_DEFAULT_AGENT_ID
ARG NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_NANGO_API_URL
ARG NEXT_PUBLIC_NANGO_SECRET_KEY
ARG NEXT_PUBLIC_NANGO_BASE_URL
ARG COLLABORATION_WS_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN

# Install dependencies first (better caching)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install; fi

# Copy source code (separate layer for better caching)
COPY . .

# Set environment variables for build
ENV NEXT_PUBLIC_DEFAULT_AGENT_ID=$NEXT_PUBLIC_DEFAULT_AGENT_ID
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_NANGO_API_URL=$NEXT_PUBLIC_NANGO_API_URL
ENV NEXT_PUBLIC_NANGO_SECRET_KEY=$NEXT_PUBLIC_NANGO_SECRET_KEY
ENV NEXT_PUBLIC_NANGO_BASE_URL=$NEXT_PUBLIC_NANGO_BASE_URL
ENV COLLABORATION_WS_URL=$COLLABORATION_WS_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# Build the Next.js app
# Ensure we're not in Cloudflare Pages mode for Docker build
ENV CF_PAGES=0
ENV NEXT_ON_PAGES=0
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; else npm run build; fi

# ---- Production Stage ----
FROM node:24.12.0-alpine AS runner

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_DEFAULT_AGENT_ID
ARG NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_NANGO_API_URL
ARG NEXT_PUBLIC_NANGO_SECRET_KEY
ARG NEXT_PUBLIC_NANGO_BASE_URL
ARG COLLABORATION_WS_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Only copy over the necessary files from the build stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Set environment variables (can be customized)
ENV NODE_ENV=production
ENV NEXT_PUBLIC_DEFAULT_AGENT_ID=$NEXT_PUBLIC_DEFAULT_AGENT_ID
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_NANGO_API_URL=$NEXT_PUBLIC_NANGO_API_URL
ENV NEXT_PUBLIC_NANGO_SECRET_KEY=$NEXT_PUBLIC_NANGO_SECRET_KEY
ENV NEXT_PUBLIC_NANGO_BASE_URL=$NEXT_PUBLIC_NANGO_BASE_URL
ENV COLLABORATION_WS_URL=$COLLABORATION_WS_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# Expose the port Next.js runs on
EXPOSE 3000

# Start the Next.js app
CMD ["node", "server.js"]
