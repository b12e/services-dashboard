# Services Dashboard - User Guide

A beautiful, dark-themed dashboard for all your self-hosted services with PWA support and automatic service discovery.

![Services Dashboard](https://img.shields.io/badge/PWA-Ready-blue)
![Offline Support](https://img.shields.io/badge/Offline-Supported-green)
![Dark Mode](https://img.shields.io/badge/Dark-Mode-black)

## Screenshots

Desktop:
<img width="1633" height="974" alt="image" src="https://github.com/user-attachments/assets/f4b8ee13-49e5-4301-8c3b-db6952e4e23a" />
<img width="2308" height="1682" alt="image" src="https://github.com/user-attachments/assets/b7f7f283-65e0-4abb-befe-f4bbf29729bf" />

## Features

- 🌙 **Dark Mode**: Sleek dark theme with clean, modern design
- 📱 **PWA Support**: Install as an app on mobile or desktop
- 🔌 **Offline Ready**: Works offline with cached icons and data
- 🎨 **Automatic Icons**: Fetches service icons from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- 🏷️ **Smart Categories**: Automatic categorization with sidebar filtering (hamburger menu on mobile)
- 🔍 **Real-time Search**: Instantly filter services by name or URL with live results count
- 🤖 **NPM Integration**: Auto-discover services from Nginx Proxy Manager
- 📱 **Responsive**: Adapts beautifully to any screen size
- 🎯 **Clean UI**: Focus on service names and icons
- ⚡ **Fast Loading**: Service worker caches all assets for instant loads

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

The `services.json` file is **optional** if you're using NPM auto-detection. If provided, it defines manual services that will be merged with auto-detected ones.

Each service requires:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Display name of the service | `"Nextcloud"` |
| `url` | string | The URL portion for the service | `"cloud"` or `"nextcloud.example.com"` |
| `appendBaseDomain` | boolean | Whether to append the base domain (optional, defaults to `true`) | `false` |
| `icon` | string | Custom icon from dashboardicons.com (optional) | `"air-trail"` |
| `category` | string | Category for the service (optional, auto-detected if not provided) | `"Media"` |

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

### Supported Categories

- **Media** - Plex, Jellyfin, Sonarr, Radarr, qBittorrent, PhotoPrism, Calibre
- **Productivity** - Nextcloud, Bitwarden, Bookstack, Wiki, Paperless, Firefly III
- **Monitoring** - Grafana, Uptime Kuma, Prometheus, Netdata, Plausible
- **Network** - Pi-hole, Nginx Proxy Manager, Traefik, Authentik, VPN
- **Development** - GitHub, GitLab, Portainer, Jenkins, Docker
- **Home & Automation** - Home Assistant, Node-RED, Discord, Mattermost, Minecraft
- **Other** - Services that don't match any category

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

### Automatic Icon Discovery

**For NPM Auto-Detected Services:**
When services are discovered from Nginx Proxy Manager, the dashboard automatically finds the best matching icon using:
- The dashboard-icons metadata file (cached in Docker container)
- Fuzzy matching algorithm that compares service names with available icons
- Support for icon aliases (e.g., "Home Assistant" matches "homeassistant")
- **Automatically uses light variants** when available for better visibility in dark mode

**Example Auto-Discovery:**
- `plex.example.com` → Finds "plex" icon automatically
- `home-assistant.local` → Finds "home-assistant" icon via fuzzy matching
- `grafana-monitoring.com` → Finds "grafana" icon by partial match
- `ghost.example.com` → Finds "ghost-light" (light variant preferred for dark mode)

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

**3. Automatic Naming (if not specified):**
Service names are converted to icon names:
- Spaces → hyphens: `"Home Assistant"` → `home-assistant`
- Special characters removed: `"Sabnzbd+"` → `sabnzbd`
- Lowercase: `"Plex"` → `plex`

**4. Fallback Chain:**
For dashboard-icons:
1. Try specified icon from CDN (SVG)
2. Try PNG version
3. Show service initials

For custom URLs:
1. Try loading the custom URL
2. Show service initials if it fails

## PWA Features

### Installation

Install the dashboard as an app on any device:

- **Mobile**: Tap "Add to Home Screen" in browser menu
- **Desktop Chrome/Edge**: Click install icon in address bar
- **Desktop Safari**: Click share icon → Add to Dock

**Important:** For PWA installation, you must serve the dashboard over HTTPS.

### Offline Support

Once installed, the dashboard works offline:
- All icons are cached
- Service data is cached
- Search and filtering work without internet

## Search & Navigation

### Search Features

- **Real-time filtering**: Type to instantly filter services by name or URL
- **Results counter**: Shows "Showing X of Y services" when searching
- **Enter key shortcut**: Press Enter when only one result is shown to open it immediately
- **Auto-focus**: Search field is automatically focused when the page loads
- **Clear button**: Quickly reset search with one click

### Categories & Sidebar

- **Sidebar navigation**: Browse services by category with count badges
- **Mobile hamburger menu**: Sidebar slides in from left on mobile devices
- **Click outside to close**: Tap anywhere outside the sidebar to close it on mobile
- **Selected category header**: Current category name displays in the main header
- **One-click filtering**: Click any category to filter services instantly

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

### Merging NPM and services.json

The dashboard intelligently merges services when the same URL exists in both `services.json` and NPM:

**Merge Behavior:**
- **Deduplication is protocol-agnostic**: `http://plex.example.com` and `https://plex.example.com` are considered the same
- If a URL exists in both sources, the service is **merged** (not skipped)
- **Name** from services.json takes priority
- **Icon** from services.json takes priority (if specified)
- **Category** from services.json takes priority (if specified)
- **URL and metadata** from NPM are kept (including correct http/https protocol)

**Example 1 - Protocol-Agnostic Matching:**
```json
// In services.json:
{
  "name": "My Plex Server",
  "url": "http://plex.example.com",  // You specify http://
  "icon": "plex",
  "category": "Media"
}

// NPM has: https://plex.example.com (auto-detected with SSL)

// Result: Recognized as SAME service (deduplication works)
// Uses "My Plex Server" name and "plex" icon,
// but keeps NPM's https:// URL (SSL detected by NPM)
```

**Example 2 - Domain-Only Matching:**
```json
// In services.json:
{
  "name": "Production Grafana",
  "url": "grafana.example.com",  // No protocol specified
  "icon": "grafana"
}

// NPM has: https://grafana.example.com

// Result: Recognized as SAME service
// Uses "Production Grafana" name and "grafana" icon,
// keeps NPM's https:// URL
```

**Why this is useful:**
- Override auto-generated names with friendly names
- Specify custom icons instead of auto-detected ones
- Set custom categories
- Still benefit from NPM's automatic URL and SSL detection

Check the Docker logs to see merge details:
```bash
docker logs services-dashboard
```

Look for messages like:
```
Merged 5 services (using manual name/icon with NPM URL)
Final result: 30 total services (10 manual, 25 NPM, 5 merged)
```

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

- **Issues**: Report bugs at [GitHub Issues](https://github.com/yourusername/services-dashboard/issues)
- **Documentation**: See [DEVELOPER.md](DEVELOPER.md) for development setup
