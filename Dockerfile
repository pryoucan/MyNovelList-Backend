# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy rest of the code
COPY . .

# Environment defaults (secrets must be passed at runtime, not here)
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run app
CMD ["npm", "start"]