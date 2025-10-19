# Services Dashboard - User Guide

A beautiful, dark-themed dashboard for all your self-hosted services with PWA support and automatic service discovery.

![Services Dashboard](https://img.shields.io/badge/PWA-Ready-blue)
![Offline Support](https://img.shields.io/badge/Offline-Supported-green)
![Dark Mode](https://img.shields.io/badge/Dark-Mode-black)

## Quick Start

### Option 1: NPM Auto-Detection Only

If you have Nginx Proxy Manager, the dashboard can automatically discover all your services:

```bash
docker run -d \
    --name services-dashboard \
    -p 3000:3000 \
    -e NPM_API_URL="http://your-npm-host:81/api" \
    -e NPM_USERNAME="admin@example.com" \
    -e NPM_PASSWORD="your-password" \
    -e BASE_URL="example.com" \
    b12e/services-dashboard:latest
```

### Option 2: Manual Services Only

If you prefer to define services manually using a JSON file:

```bash
docker run -d \
    --name services-dashboard \
    -p 3000:3000 \
    -e BASE_URL="example.com" \
    -v /path/to/services.json:/app/dist/services.json:ro \
    b12e/services-dashboard:latest
```

### Option 3: Both NPM + Manual Services

Combine auto-detection with manual services (manual services take priority for duplicates):

```bash
docker run -d \
    --name services-dashboard \
    -p 3000:3000 \
    -e NPM_API_URL="http://your-npm-host:81/api" \
    -e NPM_USERNAME="admin@example.com" \
    -e NPM_PASSWORD="your-password" \
    -e BASE_URL="example.com" \
    -v /path/to/services.json:/app/dist/services.json:ro \
    b12e/services-dashboard:latest
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  services-dashboard:
    image: b12e/services-dashboard:latest
    container_name: services-dashboard
    ports:
      - "3000:3000"
    environment:
      # Optional: NPM auto-detection
      - NPM_API_URL=http://nginx-proxy-manager:81/api
      - NPM_USERNAME=admin@example.com
      - NPM_PASSWORD=your-password
      # Optional: Base domain for services
      - BASE_URL=example.com
    volumes:
      # Optional: Manual services file
      - ./services.json:/app/dist/services.json:ro
    restart: unless-stopped
```

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NPM_API_URL` | No | Nginx Proxy Manager API URL | `http://npm:81/api` |
| `NPM_USERNAME` | No* | NPM admin email | `admin@example.com` |
| `NPM_PASSWORD` | No* | NPM password | `your-password` |
| `BASE_URL` | No | Base domain for services | `example.com` |

*Required if `NPM_API_URL` is set

**Note:** At least one of the following must be configured:
- NPM integration (via `NPM_API_URL` + credentials), OR
- Manual services file (`services.json`)

Both can be used together for maximum flexibility.

### services.json Structure

The `services.json` file is **optional** if you're using NPM auto-detection. If provided, it defines manual services that will be merged with auto-detected ones. This provides you with the option to change the display of detected applications or add applications that are not running behind your reverse proxy.

Each service supports:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Display name of the service | `"Nextcloud"` |
| `url` | string | The URL portion for the service | `"cloud"` or `"nextcloud.example.com"` |
| `appendBaseDomain` | boolean | Whether to append the base domain (optional, defaults to `true`) | `false` |
| `icon` | string | Custom icon from dashboardicons.com (optional) | `"air-trail"` |
| `category` | string | Category for the service (optional, auto-detected if not provided) | `"Media"` |
| `hidden` | boolean | Whether or not to hide the service (optional, useful if using NPM loading) | `true` |

#### URL Generation Logic

The `url` field behavior depends on your configuration:

**1. With base domain + appendBaseDomain `true` (default)**:
- `url: "cloud"` + `BASE_URL: "home.local"` → `https://cloud.home.local`
- `url: ""` + `BASE_URL: "home.local"` → `https://home.local`

**2. With appendBaseDomain `false`**:
- `url: "google.com"` → `https://google.com` (https:// added automatically)
- `url: "https://google.com"` → `https://google.com` (protocol preserved)
- `url: "http://192.168.1.123:4567"` → `http://192.168.1.123:4567` (protocol preserved)
- `url: "nextcloud.example.com"` → `https://nextcloud.example.com` (https:// added)

#### Example services.json

```json
{
    "services": [
        {
            "name": "Authentik",
            "url": "auth"
        },
        {
            "name": "Nextcloud",
            "url": "cloud"
        },
        {
            "name": "Google",
            "url": "google.com",
            "appendBaseDomain": false
        },
        {
            "name": "External Service",
            "url": "https://app.external-domain.com",
            "appendBaseDomain": false
        },
        {
            "name": "Local HTTP Service",
            "url": "http://192.168.1.100:8080",
            "appendBaseDomain": false
        },
        {
            "name": "Homepage",
            "url": ""
        },
        {
            "name": "Airtrail",
            "url": "flights",
            "icon": "air-trail",
            "category": "Productivity"
        }
    ]
}
```

## Nginx Proxy Manager Integration

The dashboard can automatically discover services from your Nginx Proxy Manager installation. **This means you don't need to create a `services.json` file at all!**

### Features

- Auto-discovers all enabled proxy hosts from NPM
- Generates service entries with proper URLs (http/https based on SSL certificate)
- Converts domain names to friendly service names
- Automatically finds matching icons using fuzzy matching
- Auto-categorizes services based on their names
- Manual services in `services.json` take priority over auto-detected ones

### How It Works

1. Dashboard authenticates with NPM API using provided credentials
2. Fetches all enabled proxy hosts from NPM
3. Converts each proxy host to a service:
   - **Name**: Generated from first domain name (e.g., `plex.example.com` → `Plex`)
   - **URL**: Full URL with protocol (https if SSL certificate is present)
   - **Icon**: Auto-discovered using fuzzy matching against dashboard-icons
   - **Category**: Auto-categorized based on service name
4. Merges with manual services (manual services take priority for duplicates)

### Example Auto-Detected Services

- `plex.home.local` → Service: "Plex", URL: "https://plex.home.local", Category: "Media"
- `grafana.monitoring.local` → Service: "Grafana", URL: "https://grafana.monitoring.local", Category: "Monitoring"
- `portainer.home.local` → Service: "Portainer", URL: "https://portainer.home.local", Category: "Development"

### Network Configuration

**If NPM is on the same Docker network:**
```yaml
environment:
  - NPM_API_URL=http://nginx-proxy-manager:81/api
```

**If NPM is on a different host:**
```yaml
environment:
  - NPM_API_URL=http://192.168.1.100:81/api
```

## Categories

Services are automatically organized into categories for easy navigation via the sidebar (hamburger menu on mobile).

### Automatic Categorization

If you don't specify a `category` field, the dashboard will automatically categorize your service based on its name. The auto-categorization recognizes popular self-hosted services and assigns them to the most appropriate category.

### Manual Categorization

You can override auto-categorization by explicitly setting the `category` field in `services.json`:

```json
{
    "name": "Custom Service",
    "url": "custom",
    "category": "Productivity"
}
```

## Icons

The dashboard automatically fetches icons from the [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) repository.

### Manual Icon Configuration

For manual services in `services.json`, you can specify icons in four ways:

**1. Custom Icon URL:**
Provide a full URL to any image (supports http://, https://):
```json
{
  "name": "My Custom Service",
  "url": "service",
  "icon": "https://example.com/path/to/icon.png"
}
```

**2. Explicit Icon Name:**
Use an icon from dashboard-icons by name:
```json
{
  "name": "My Service",
  "url": "service",
  "icon": "plex"
}
```

## PWA Features

### Installation

Install the dashboard as an app on any device:

- **Mobile**: Tap "Add to Home Screen" in browser menu
- **Desktop Chrome/Edge**: Click install icon in address bar
- **Desktop Safari**: Click share icon → Add to Dock

**Important:** For PWA installation, you must serve the dashboard over HTTPS.

## Troubleshooting

### No services showing

**Check 1: Is NPM configured?**
```bash
docker logs services-dashboard
```
Look for:
- `✓ NPM integration enabled` - NPM is configured
- `✓ NPM integration disabled` - NPM not configured, need services.json

**Check 2: Is services.json mounted?**
```bash
docker exec services-dashboard ls -la /usr/share/nginx/html/services.json
```

**Check 3: NPM connection issues**
- Verify NPM_API_URL is reachable from the container
- Check NPM username and password are correct
- Ensure NPM is accessible on the specified port

### Services not loading

- Verify JSON syntax in `services.json` is valid
- Check browser console for errors (F12)
- Check Docker logs: `docker logs services-dashboard`

### Icons not showing

- Icons are automatically discovered for NPM services
- For manual services, verify service names match icons in [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Check network tab in browser DevTools to see if icons are being fetched
- Fallback will show service initials if icon not found

### PWA not installing

- Ensure site is served over HTTPS
- Verify manifest.json is accessible
- Check browser console for PWA-related errors

## Browser Support

All modern web browsers are supported:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Credits

- Icons provided by [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Built with React and Vite

## Getting Help

- **Issues**: Report bugs at [GitHub Issues](https://github.com/b12e/selfhosted-shortcuts/issues)
