# Services Dashboard

A beautiful, dark-themed dashboard for all your self-hosted services with PWA support, offline capabilities, and automatic icon fetching.

![Services Dashboard](https://img.shields.io/badge/PWA-Ready-blue)
![Offline Support](https://img.shields.io/badge/Offline-Supported-green)
![Dark Mode](https://img.shields.io/badge/Dark-Mode-black)

## Screenshots
Desktop:
<img width="1633" height="974" alt="image" src="https://github.com/user-attachments/assets/f4b8ee13-49e5-4301-8c3b-db6952e4e23a" />
<img width="2308" height="1682" alt="image" src="https://github.com/user-attachments/assets/b7f7f283-65e0-4abb-befe-f4bbf29729bf" />


## Features

- 🌙 **Dark Mode**: Sleek dark theme with glassmorphism effects
- 📱 **PWA Support**: Install as an app on mobile or desktop
- 🔌 **Offline Ready**: Works offline with cached icons and data
- 🎨 **Automatic Icons**: Fetches service icons from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- 📱 **Responsive**: Adapts beautifully to any screen size
- 🔗 **Smart URL Display**: Toggle URLs on/off with persistent preferences
- ⚡ **Fast Loading**: Service worker caches all assets for instant loads
- Built with vanilla JavaScript, HTML5, and CSS3

## Quick Start

1. **Download the files** or use Docker. 
   You can use `docker pull b12e/services-dashboard:latest` and then run the container providing the path to `services.json` and `configuration.json`. Example command: 
   ```bash
    docker run -d \
        --name services-dashboard \
        -p 80:80 \
        -v /PATH/TO/services.json:/usr/share/nginx/html/services.json:ro \
        -v /PATH/TO/configuration.json:/usr/share/nginx/html/configuration.json:ro \
        b12e/services-dashboard:latest
   ```

   It's also possible to use docker-compose:
   ```yaml
   version: '3.8'
   services:
    services-dashboard:
        image: b12e/services-dashboard:latest
        container_name: services-dashboard
        ports:
            - "80:80"
        volumes:
            - ./services.json:/usr/share/nginx/html/services.json:ro
            - ./configuration.json:/usr/share/nginx/html/configuration.json:ro
    restart: unless-stopped
    ```

2. Create your `services.json`:
```json
{
    "services": [
        {
            "name": "Nextcloud",
            "url": "cloud"
        },
        {
            "name": "Home Assistant",
            "url": "ha"
        },
        {
            "name": "Homepage",
            "url": ""
        }
    ]
}
```


3. Create `configuration.json`**:
```json
{
    "baseUrl": "home.local",
    "showUrlsByDefault": false
}
```

**Warning**: If you want to use it as a PWA, you'll need to serve the page over HTTPS.

## Configuration

### services.json Structure

The `services.json` file defines all your services. Each service requires:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Display name of the service | `"Nextcloud"` |
| `url` | string | The URL portion for the service (see URL Generation below) | `"cloud"` or `"nextcloud.example.com"` |
| `appendBaseDomain` | boolean | Whether to append the base domain (optional, defaults to `true`) | `false` |

**URL Generation Logic:**

The `url` field behavior depends on your configuration:

1. **With base domain + appendBaseDomain `true` (default)**:
   - `url: "cloud"` + `baseUrl: "home.local"` → `https://cloud.home.local`
   - `url: ""` + `baseUrl: "home.local"` → `https://home.local`

2. **With appendBaseDomain `false`**:
   - `url: "google.com"` → `https://google.com` (https:// added automatically)
   - `url: "https://google.com"` → `https://google.com` (protocol preserved)
   - `url: "http://192.168.1.123:4567"` → `http://192.168.1.123:4567` (protocol preserved)
   - `url: "nextcloud.example.com"` → `https://nextcloud.example.com` (https:// added)

**Example with various configurations:**
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
        }
    ]
}
```

### configuration.json Options

Optional configuration file to customize the dashboard behavior:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `"home.local"` | Your base domain for all services |
| `showUrlsByDefault` | boolean | `true` on desktop, `false` on mobile | Whether to show URLs under service names by default |

**Example configuration.json:**
```json
{
    "baseUrl": "home.local",
    "showUrlsByDefault": false
}
```

**Note:** If `baseUrl` is not set, services must provide complete domains in their `url` field or set `appendBaseDomain: false`.

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
- **Desktop**: Click install icon in address bar (Chrome/Edge) or the share icon -> Add to Dock (Safari)

### Required Icon Files

For full PWA support, create a vector icon (.svg) and place it in the root folder as `icon.svg`. You can also modify manifest.json to your own liking.

## Features in Detail

### URL Toggle

- **Toggle button**: Show/hide URLs under service names
- **Smart defaults**: 
  - Hidden on mobile (screen < 768px)
  - Visible on desktop
  - Configurable via `configuration.json`
- **Persistent**: Choice saved in browser localStorage

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

All modern web browsers are supported.

## License

This dashboard is open source and available for personal and commercial use.

## Credits

- Icons provided by [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)


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

### Version 1.0.1
- Open links in new window when used as PWA
- Fix service name visibility on narrow screens
- Fix service URL visibility on narrow screens
- Move style into style.css and JS into base.js
- Add possibility to not add base URL
- rename `subdomain` to `url` in services.json
- Support full URLs with protocol as well as domain names when `appendBaseDomain` is set to `false`
- Handle invalid URLs properly

### Version 1.0.2
- Update title
- Always show full service name

### Version 1.0.3
- Updated icon and readme
