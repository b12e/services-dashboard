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
docker compose up -d
```

### Docker Run

```bash
mkdir ./data

docker run -d \
  --name services-dashboard \
  -p 3000:3000 \
  -p 3001:3001 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your-password \
  -v ./data:/app/data \
  --restart unless-stopped \
  b12e/services-dashboard:latest
```

## Access

- **Dashboard**: http://localhost:3000
- **Admin Panel**: http://localhost:3001

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USERNAME` | | Admin panel username (empty = no auth) |
| `ADMIN_PASSWORD` | | Admin panel password |
| `SESSION_SECRET` | random per start | Secret for signing admin sessions. Sessions are kept in memory, so a random secret only means logging in again after a restart |
| `PORT` | `3000` | Dashboard port |
| `ADMIN_PORT` | `3001` | Admin panel port |
| `DATA_DIR` | `/app/data` | Where configuration is stored |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Which reverse proxies may set `X-Forwarded-*` headers ([Express syntax](https://expressjs.com/en/guide/behind-proxies.html)). Used for rate limiting and secure cookies |
| `RP_ID` | registrable domain of the request | Passkey relying party ID. Set it for multi-part TLDs such as `example.co.uk` |
| `ORIGIN` | from the request | Passkey origin, e.g. `https://admin.example.com` |
| `NPM_CACHE_TTL` | `60` | Seconds to cache the proxy hosts fetched from Nginx Proxy Manager |
| `ICON_METADATA_REFRESH` | `true` | Download fresh dashboard-icons metadata weekly. Set to `false` for offline setups |

## Configuration

All configuration is stored in the mounted `data` directory:
- `data/services.json` - Manual services and customizations of NPM services
- `data/categories.json` - Categories
- `data/config.json` - NPM connections, base domain, branding
- `data/auth.json` - Passkey credentials (if auth enabled)
- `data/uploads/` - Uploaded custom icon
- `data/cache/` - Downloaded icon metadata

### Using the Admin Panel

1. Access http://localhost:3001
2. **Services tab**: Add, edit and hide services, or customize the ones discovered through NPM
3. **Categories tab**: Rename, hide, add or delete categories
4. **Settings tab**:
   - Set base domain
   - Add NPM connections (URL, username, password)
   - Branding (name and icon)
   - Register passkeys (if auth enabled)

### Categories

Services are sorted into categories automatically, from their name, address (including the NPM forward host) and icon. `sonarr-4k.example.com` lands in Media, `qbit.example.com` in Downloads and `ha.example.com` in Home Automation. Services that match nothing are listed under "Other".

The built-in categories are AI, Automation, Communication, Development, Downloads, Files & Backup, Finance, Food & Recipes, Gaming, Home Automation, Infrastructure, Media, Monitoring, Networking, Photos, Productivity, Security and Utilities.

- Rename or hide any category. Renamed categories keep their automatic rules.
- Choose categories per service to override the automatic choice.
- Deleted categories stay deleted. "Restore default categories" brings back the built-in ones.

Older installs are migrated automatically on first start. Backups of the original files are written next to them (`*.pre-v2-<date>`).

### Icons

Icons come from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) and [Simple Icons](https://simpleicons.org). When no icon is set, one is picked from the service name and address, so `pve` gets the Proxmox icon and `npm` the Nginx Proxy Manager one. You can also set:

- a dashboard-icons name, e.g. `jellyfin` (the light variant is used automatically on the dark theme)
- a Simple Icons slug with the `si:` prefix, e.g. `si:github`
- any image URL, e.g. `https://example.com/icon.png`

## Passkey Authentication

**Requirements:**
- Enable authentication by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Access the admin panel via HTTPS in production (required for passkeys)
- Your reverse proxy must forward the correct headers

**Note:** Passkeys registered on one domain (e.g., `admin.example.com`) will only work on that same domain or subdomains of the registrable domain (`example.com`).

## Development

```bash
npm install
npm start            # dashboard on :3000 and admin panel on :3001
npm run dev          # dashboard UI with hot reload, proxies /api to :3000
npm run admin:dev    # admin UI with hot reload on :5174, proxies /api to :3001
npm test
```

Build the UIs with `npm run build` and `npm run admin:build` before `npm start`.
