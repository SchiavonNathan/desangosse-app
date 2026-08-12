# ==============================================================================
# Multi-stage Dockerfile for React + Vite Frontend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React App
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config
COPY tsconfig*.json vite.config.ts index.html eslint.config.js ./
COPY public ./public
COPY src ./src

# Build argument for API URL (can be overridden at build time)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build static production bundle
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Nginx Web Server
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
