# Use Node.js 18
FROM node:18-alpine

# Install OpenSSL and other system dependencies
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy all package files
COPY backend/package*.json ./
COPY prisma ./prisma/

# Install dependencies (including dev deps for Prisma CLI)
RUN npm install

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]