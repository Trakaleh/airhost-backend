# Multi-stage build for optimal performance
FROM node:18-alpine AS dependencies

# Install system dependencies and cache them
RUN apk add --no-cache openssl python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for better layer caching
COPY backend/package*.json ./
COPY package*.json ./root-package/

# Install all dependencies with npm cache mount
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --only=production --silent --prefer-offline

# Prisma stage
FROM dependencies AS prisma-builder

# Copy schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Production stage
FROM node:18-alpine AS production

# Install only runtime dependencies
RUN apk add --no-cache openssl dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies and generated prisma client
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=prisma-builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=prisma-builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy backend source (do this last for better caching)
COPY --chown=nodejs:nodejs backend/ ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Optimized health check with shorter timeout
HEALTHCHECK --interval=20s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', {timeout: 5000}, (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start with optimized node flags for production
CMD ["dumb-init", "node", "--max-old-space-size=256", "--optimize-for-size", "server.js"]