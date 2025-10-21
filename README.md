# Services Dashboard

A dark-themed dashboard for self-hosted services with NPM auto-discovery and PWA support.

## Quick Start

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
      # NPM auto-discovery (optional)
      - NPM_API_URL=http://nginx-proxy-manager:81/api
      - NPM_USERNAME=admin@example.com
      - NPM_PASSWORD=your-password

      # Base domain (optional)
      - BASE_URL=example.com

      # Admin auth (optional, disabled by default)
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=your-password
    volumes:
      - ./services.json:/app/public/services.json  # Optional manual services
      - ./config.json:/app/config.json  # Persists admin settings
    restart: unless-stopped
```

Access:
- **Dashboard**: http://localhost:3000
- **Admin Panel**: http://localhost:3001

## Features

- Auto-discover services from Nginx Proxy Manager
- Manual service configuration via JSON or admin UI
- Service categories with auto-detection
- Icon matching from 2000+ dashboard icons
- Dark theme with responsive design
- PWA with offline support
- Optional authentication with passkey support

## Admin Panel

Use the web UI on port 3001 to:
- Add/edit/delete services
- Configure NPM connections
- Manage categories and visibility
- Set up passkey authentication

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NPM_API_URL` | NPM API endpoint (e.g., `http://npm:81/api`) |
| `NPM_USERNAME` | NPM admin email |
| `NPM_PASSWORD` | NPM password |
| `BASE_URL` | Base domain for services (e.g., `example.com`) |
| `ADMIN_USERNAME` | Admin panel username (empty = no auth) |
| `ADMIN_PASSWORD` | Admin panel password |

## Manual Services

Create `services.json`:

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

Fields:
- `name` - Display name
- `url` - Service URL or subdomain
- `appendBaseDomain` - Add BASE_URL to URL (default: true)
- `icon` - Icon name (optional, auto-detected)
- `category` - Category (optional, auto-detected)
- `hidden` - Hide from dashboard (default: false)
