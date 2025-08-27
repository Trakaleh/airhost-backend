# Use Node.js 18
FROM node:18-alpine

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl

# Set Prisma environment
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl

# Set working directory for our backend
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Expose port (Railway uses PORT env variable)
EXPOSE 8080

# Health check with longer startup period
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]