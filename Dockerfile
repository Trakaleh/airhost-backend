# Use Node.js 18
FROM node:18-alpine

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl libc6-compat

# Set Prisma environment
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl
ENV PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl.so.node

# Set working directory for our backend
WORKDIR /app

# Copy package files and schema first
COPY backend/package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies for Prisma CLI)
RUN npm install

# Generate Prisma client for Alpine Linux
RUN npx prisma generate

# Copy backend source code
COPY backend/ ./

# Clean up dev dependencies
RUN npm prune --production

# Expose port (Railway uses PORT env variable)
EXPOSE 8080

# Health check with longer startup period
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]