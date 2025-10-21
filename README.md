# Services Dashboard

A dark-themed dashboard for self-hosted services with NPM auto-discovery and PWA support.

## Quick Start

### Docker Compose (Recommended)

Create a directory for your configuration:
```bash
mkdir -p ~/services-dashboard
cd ~/services-dashboard
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  services-dashboard:
    image: b12e/services-dashboard:latest
    container_name: services-dashboard
    ports:
      - "3000:3000"  # Dashboard
      - "3001:3001"  # Admin panel
    environment:
      # Admin auth (optional, disabled by default)
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=your-password
    volumes:
      # All configuration stored in ./data directory
      - ./data:/app/data
    restart: unless-stopped
```

Start the container:
```bash
docker-compose up -d
```

### Docker Run

```bash
mkdir -p ~/services-dashboard/data

docker run -d \
  --name services-dashboard \
  -p 3000:3000 \
  -p 3001:3001 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your-password \
  -v ~/services-dashboard/data:/app/data \
  --restart unless-stopped \
  b12e/services-dashboard:latest
```

## Access

- **Dashboard**: http://localhost:3000
- **Admin Panel**: http://localhost:3001

## Configuration

All configuration is stored in the mounted `data` directory:
- `data/services.json` - Manual services
- `data/config.json` - NPM connections, base domain, categories
- `data/auth.json` - Passkey credentials (if auth enabled)

### Using the Admin Panel

1. Access http://localhost:3001
2. **Services tab**: Add/edit/delete services manually
3. **Configuration tab**:
   - Set base domain
   - Add NPM connections (URL, username, password)
   - Manage categories
   - Register passkeys (if auth enabled)

### Manual Configuration

Create `data/services.json`:
```json
{
  "services": [
    {
      "name": "Plex",
      "url": "plex",
      "appendBaseDomain": true
    },
    {
      "name": "GitHub",
      "url": "https://github.com",
      "appendBaseDomain": false
    }
  ]
}
```

Create `data/config.json`:
```json
{
  "baseUrl": "example.com",
  "npmEnabled": true,
  "npmConnections": [
    {
      "name": "Main NPM",
      "url": "http://nginx-proxy-manager:81",
      "username": "admin@example.com",
      "password": "your-password"
    }
  ],
  "categories": []
}
```

## Features

- Auto-discover services from Nginx Proxy Manager
- Manual service configuration via JSON or admin UI
- Service categories with auto-detection
- Icon matching from 2000+ dashboard icons
- Dark theme with responsive design
- PWA with offline support
- Optional authentication with passkey support
- Automatic host detection for reverse proxy setups

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin panel username (empty = no auth) |
| `ADMIN_PASSWORD` | Admin panel password |

## Passkey Authentication

Passkey authentication works automatically with reverse proxies. The application detects the host from request headers (`X-Forwarded-Host`, `X-Forwarded-Proto`) and configures WebAuthn appropriately.

**Requirements:**
- Enable authentication by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Access the admin panel via HTTPS in production (required for passkeys)
- Your reverse proxy must forward the correct headers

**Note:** Passkeys registered on one domain (e.g., `admin.example.com`) will only work on that same domain or subdomains of the registrable domain (`example.com`).

## Service Fields

- `name` - Display name
- `url` - Service URL (subdomain or full URL with protocol/port/path)
- `appendBaseDomain` - If true, URL is treated as subdomain and base domain is appended (default: true)
- `icon` - Icon name (optional, auto-detected)
- `category` - Category (optional, auto-detected)
- `hidden` - Hide from dashboard (default: false)

**URL Examples:**
- Subdomain mode (`appendBaseDomain: true`): `url: "plex"` becomes `plex.example.com`
- Full URL mode (`appendBaseDomain: false`): `url: "https://example.com:8080/path"`
