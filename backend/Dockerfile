# ==============================================================================
# Multi-stage Dockerfile for NestJS Backend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Dependencies
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native C++ modules (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++ openssl

# Copy package manifests and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including devDependencies needed to build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy tsconfig and source code
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# Remove development dependencies to keep production image light
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Add openssl for Prisma runtime compatibility
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/data/dev.db"

# Create directories for persistent SQLite DB and uploads
RUN mkdir -p /app/data /app/uploads/pdfs /app/uploads/icons

# Copy pruned node_modules and compiled output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3001

# Push DB schema if new, then start production server
CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]
