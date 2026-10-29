# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Copy Prisma schema before install so the postinstall `prisma generate` can run
COPY prisma ./prisma
COPY prisma.config.js ./

# Install dependencies (dev deps needed for the prisma CLI), then drop them
RUN npm ci && npm prune --omit=dev

# Copy rest of the code
COPY . .

# Environment defaults (secrets must be passed at runtime, not here)
ENV NODE_ENV=production
ENV PORT=5001

# Expose port
EXPOSE 5001

# Run app
CMD ["npm", "start"]