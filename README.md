# Services Dashboard

A beautiful, dark-themed dashboard for all your self-hosted services with PWA support, offline capabilities, and automatic icon fetching.

![Services Dashboard](https://img.shields.io/badge/PWA-Ready-blue)
![Offline Support](https://img.shields.io/badge/Offline-Supported-green)
![Dark Mode](https://img.shields.io/badge/Dark-Mode-black)

## Features

- 🌙 **Dark Mode**: Sleek dark theme with glassmorphism effects
- 📱 **PWA Support**: Install as an app on mobile or desktop
- 🔌 **Offline Ready**: Works offline with cached icons and data
- 🎨 **Automatic Icons**: Fetches service icons from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- 📱 **Responsive**: Adapts beautifully to any screen size
- 🔗 **Smart URL Display**: Toggle URLs on/off with persistent preferences
- ⚡ **Fast Loading**: Service worker caches all assets for instant loads

## Quick Start

1. **Download the files**:
   - `index.html` - Main dashboard page
   - `service-worker.js` - PWA service worker
   - `manifest.json` - PWA manifest

2. **Create your `services.json`**:
```json
{
    "services": [
        {
            "name": "Nextcloud",
            "subdomain": "cloud"
        },
        {
            "name": "Home Assistant",
            "subdomain": "ha"
        },
        {
            "name": "Homepage",
            "subdomain": ""
        }
    ]
}
```

3. **Optional: Create `configuration.json`**:
```json
{
    "baseUrl": "local.b12e.es",
    "showUrlsByDefault": false
}
```

4. **Serve the files** over HTTPS (required for PWA features)

## Configuration

### services.json Structure

The `services.json` file defines all your services. Each service requires:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Display name of the service | `"Nextcloud"` |
| `subdomain` | string | Subdomain for the service (empty for base domain) | `"cloud"` or `""` |

**Example with various services:**
```json
{
    "services": [
        {
            "name": "Authentik",
            "subdomain": "auth"
        },
        {
            "name": "Nextcloud", 
            "subdomain": "cloud"
        },
        {
            "name": "Home Assistant",
            "subdomain": "ha"
        },
        {
            "name": "Plex",
            "subdomain": "plex"
        },
        {
            "name": "Homepage",
            "subdomain": ""
        }
    ]
}
```

**URL Generation:**
- Service with subdomain: `https://{subdomain}.{baseUrl}` → `https://cloud.local.b12e.es`
- Service without subdomain: `https://{baseUrl}` → `https://local.b12e.es`

### configuration.json Options

Optional configuration file to customize the dashboard behavior:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `"local.b12e.es"` | Your base domain for all services |
| `showUrlsByDefault` | boolean | `true` on desktop, `false` on mobile | Whether to show URLs under service names by default |

**Example configuration.json:**
```json
{
    "baseUrl": "home.local",
    "showUrlsByDefault": false
}
```

## Icons

The dashboard automatically fetches icons from the [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) repository.

### Icon Resolution

1. **Automatic naming**: Service names are converted to icon names:
   - Spaces → hyphens: `"Home Assistant"` → `home-assistant`
   - Special characters removed: `"Sabnzbd+"` → `sabnzbd`
   - Lowercase: `"Plex"` → `plex`

2. **Fallback chain**:
   1. Try SVG icon from CDN
   2. Try PNG icon from CDN
   3. Show service initials

### Adding Custom Icons

To use custom icons, you'll need to contribute them to the [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) repository, or modify the code to use your own icon source.

## PWA Features

### Installation

Users can install the dashboard as an app:
- **Mobile**: Tap "Add to Home Screen" in browser menu
- **Desktop**: Click install icon in address bar (Chrome/Edge)

### Offline Support

The service worker provides:
- **Cached icons**: All icons are cached after first load
- **Offline access**: Dashboard works without internet connection
- **Background updates**: Services list updates when back online
- **Smart caching**: Different strategies for different resource types

### Required Icon Files

For full PWA support, create these icon files:
- `icon-32.png` - Browser favicon
- `icon-72.png`, `icon-96.png`, `icon-128.png`, `icon-144.png`, `icon-152.png` - Various mobile devices
- `icon-180.png` - Apple devices
- `icon-192.png`, `icon-384.png`, `icon-512.png` - Android and PWA

## Deployment

### Requirements

- **HTTPS**: Required for service worker and PWA features
- **Web server**: Any static file server (nginx, Apache, Caddy, etc.)
- **Modern browser**: Chrome, Firefox, Safari, Edge (latest versions)

### Example Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.local.b12e.es;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/dashboard;
    index index.html;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|json)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker Deployment

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

```bash
docker build -t services-dashboard .
docker run -d -p 8080:80 services-dashboard
```

## Features in Detail

### URL Toggle

- **Toggle button**: Show/hide URLs under service names
- **Smart defaults**: 
  - Hidden on mobile (screen < 768px)
  - Visible on desktop
  - Configurable via `configuration.json`
- **Persistent**: Choice saved in browser localStorage

### Responsive Design

- **Desktop**: Grid layout with hover effects
- **Mobile**: Compact grid, smaller icons, hidden URLs by default
- **Tablet**: Adaptive layout between mobile and desktop

### Dark Theme

- Dark gradient background
- Glassmorphism effect on cards
- Purple accent colors
- High contrast text for readability

## Troubleshooting

### Services not loading
- Check that `services.json` is in the same directory as `index.html`
- Verify JSON syntax is valid
- Check browser console for errors

### Icons not showing
- Verify service names match icons in [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Check network tab to see if icons are being fetched
- Try the PNG fallback by checking network requests

### PWA not installing
- Ensure site is served over HTTPS
- Check that all required files are present
- Verify manifest.json is valid JSON

### Service worker issues
- Clear browser cache and reload
- Unregister old service workers in browser DevTools
- Check console for service worker errors

## Browser Support

- ✅ Chrome/Chromium 90+
- ✅ Firefox 89+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## License

This dashboard is open source and available for personal and commercial use.

## Credits

- Icons provided by [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Built with vanilla JavaScript, HTML5, and CSS3
- PWA capabilities using Service Workers

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

## Changelog

### Version 1.0.0
- Initial release with dark mode
- PWA support with offline capabilities
- Automatic icon fetching
- Configurable base URL and URL visibility
- Responsive design
- Service worker caching