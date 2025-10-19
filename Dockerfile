# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

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

# Copy server files
COPY server ./server

# Download dashboard-icons metadata and store in container
RUN curl -fsSL https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json \
    -H "Accept: application/json" \
    -o ./dist/dashboard-icons-metadata.json && \
    # Verify it's valid JSON, fallback to empty array if not
    cat ./dist/dashboard-icons-metadata.json | head -c 1 | grep -q '\[' || \
    echo '[]' > ./dist/dashboard-icons-metadata.json

# Expose port 3000
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000

# Start the Node.js server
CMD ["node", "server/index.js"]
