# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the main application
RUN npm run build

# Build the admin UI
RUN npm run admin:build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for downloading metadata
RUN apk add --no-cache curl

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/admin-dist ./admin-dist

# Copy server files
COPY server ./server
COPY admin-server.js ./admin-server.js

# Copy public directory for services.json
COPY public ./public

# Download dashboard-icons metadata and store in container
RUN curl -fsSL https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json \
    -H "Accept: application/json" \
    -o ./dist/dashboard-icons-metadata.json && \
    # Verify it's valid JSON (should start with { or [), fallback to empty object if not
    (cat ./dist/dashboard-icons-metadata.json | head -c 1 | grep -qE '[\[{]' || \
    echo '{}' > ./dist/dashboard-icons-metadata.json)

# Expose ports 3000 (main app) and 3001 (admin panel)
EXPOSE 3000 3001

# Create data directory for persistent configuration
RUN mkdir -p /app/data

# Set environment variables
ENV PORT=3000
ENV ADMIN_PORT=3001
ENV DATA_DIR=/app/data

# Copy startup script
COPY docker-start.sh ./docker-start.sh
RUN chmod +x ./docker-start.sh

# Start both servers
CMD ["./docker-start.sh"]
