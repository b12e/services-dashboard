# Services Dashboard - Admin Panel

The admin panel runs on port 3001 next to the dashboard. See the [README](README.md) for installation and configuration options.

## Authentication

Authentication is optional. Set both variables to require a login:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=secure-password npm start
```

Once logged in you can register passkeys (Face ID, Touch ID, Windows Hello, security keys) on the Settings tab. Passkeys need HTTPS, except on `localhost`. Behind a reverse proxy, set `RP_ID` and `ORIGIN` when the detected values are wrong:

```bash
RP_ID=example.com ORIGIN=https://admin.example.com npm start
```

API clients can use HTTP basic auth with the same credentials. Requests that change data also need a CSRF token from `GET /api/admin/csrf-token`, sent in the `x-csrf-token` header.

## Security Recommendations

1. Enable authentication for anything reachable from your network
2. Use passkeys where possible
3. Put the admin panel behind HTTPS
4. Only expose port 3001 to trusted networks

## Architecture

```
server/
  start.js           # Starts both servers in one process (Docker entrypoint)
  main-server.js     # Dashboard: UI and read-only API
  admin-server.js    # Admin panel: UI, auth and management API
  services.js        # Merges manual services, NPM services and overrides
  npm.js             # Nginx Proxy Manager client with caching
  categories.js      # Category registry and migrations
  categorize.js      # Automatic categorization
  taxonomy.js        # Built-in categories, known apps and keywords
  icons.js           # Icon index, matching and resolution
src/                 # Dashboard UI
admin-src/           # Admin UI
test/                # node --test
```

## API Endpoints

Dashboard (port 3000, public):

- `GET /api/public/dashboard` - Branding, visible categories and services in one call
- `GET /api/public/services`, `GET /api/public/categories`

Admin (port 3001, authentication required when enabled):

- `GET|POST /api/admin/services`, `PUT|DELETE /api/admin/services/:id`
  (manual services have `svc_` ids, NPM services `npm:<domain>`; deleting an NPM service resets its customizations)
- `GET|POST /api/admin/categories`, `PATCH|DELETE /api/admin/categories/:id`, `POST /api/admin/categories/restore-defaults`
- `GET|PUT /api/admin/config` (NPM passwords are never returned; send an empty password to keep the stored one)
- `POST /api/admin/upload/icon`
- `GET /api/icons`, `GET /api/icons/preview/:name`

## Troubleshooting

- **No NPM services:** the Settings tab shows the result of the last fetch for each connection. Results are cached for `NPM_CACHE_TTL` seconds.
- **Login works but saving fails:** make sure your reverse proxy forwards cookies, and set `TRUST_PROXY` if it is not on a private network.
