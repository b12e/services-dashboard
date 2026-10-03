# Build stage
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run admin:build

# Bundle the dashboard-icons metadata so icon matching works offline.
# The server refreshes it weekly at runtime (ICON_METADATA_REFRESH=false disables that).
RUN mkdir -p server/vendor && node -e " \
  fetch('https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json', { signal: AbortSignal.timeout(60000) }) \
    .then(r => r.json()) \
    .then(d => { if (Object.keys(d).length < 100) throw new Error('unexpected metadata'); \
                 require('fs').writeFileSync('server/vendor/dashboard-icons-metadata.json', JSON.stringify(d)) }) \
    .catch(e => console.warn('WARNING: could not download icon metadata:', e.message))"

# Production stage
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/admin-dist ./admin-dist
COPY --from=build /app/server ./server
COPY public/icon.svg ./public/icon.svg
COPY admin-server.js docker-start.sh ./
RUN chmod +x ./docker-start.sh && mkdir -p /app/data

ENV PORT=3000
ENV ADMIN_PORT=3001
ENV DATA_DIR=/app/data

# Dashboard and admin panel
EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/branding').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["./docker-start.sh"]
