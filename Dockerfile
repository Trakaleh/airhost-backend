# Use Node.js 18
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies with npm install (not npm ci)
# Remove postinstall to avoid schema errors during install
RUN npm pkg delete scripts.postinstall && npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]