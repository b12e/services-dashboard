# Services Dashboard - Management Tool

A web-based management interface for your Services Dashboard that runs on port 3001.

## Features

- **Service Management**
  - Add, edit, and delete services
  - Configure service names, URLs, icons, and categories
  - Hide/unhide services
  - Control `appendBaseDomain` setting per service

- **Configuration Management**
  - Set base domain for services
  - Enable/disable NPM (Nginx Proxy Manager) integration
  - Manage multiple NPM connections
  - Configure NPM API tokens

- **Security**
  - Optional authentication via environment variables
  - Password-based login
  - Passkey/WebAuthn support (biometrics, security keys)
  - Session management

## Getting Started

### 1. Build the Admin UI

First, build the admin interface:

```bash
npm run admin:build
```

This creates the `admin-dist` folder with the compiled UI.

### 2. Start the Management Server

**Without Authentication (open access):**
```bash
npm run admin:server
```

**With Authentication (recommended for production):**
```bash
ADMIN_USERNAME=myuser ADMIN_PASSWORD=mypass npm run admin:server
```

**For production (with all security options):**
```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD=secure-password \
SESSION_SECRET=your-random-secret \
RP_ID=yourdomain.com \
ORIGIN=https://yourdomain.com:3001 \
npm run admin:server
```

### 3. Access the Management Tool

Open your browser to:
```
http://localhost:3001
```

**If authentication is enabled:**
- Login with your username and password
- Optionally register a passkey for easier future logins

**If authentication is disabled:**
- Access is immediate, no login required

## Development Mode

To develop the admin UI with hot-reload:

1. Start the admin server in one terminal:
   ```bash
   npm run admin:server
   ```

2. Start the Vite dev server in another terminal:
   ```bash
   npm run admin:dev
   ```

3. Access the dev UI at: `http://localhost:5174`

## Usage

### Managing Services

1. Click the **Services** tab
2. Click **Add Service** to create a new service
3. Fill in the form:
   - **Name**: Display name (e.g., "Plex")
   - **URL**: Service URL (e.g., "plex" or "https://plex.example.com")
   - **Icon**: Icon name (optional, auto-detected if blank)
   - **Category**: Category name (optional, auto-categorized if blank)
   - **Append base domain**: If checked, appends the base domain to the URL
   - **Hide this service**: If checked, service won't appear in the dashboard

4. Click **Edit** on any service to modify it
5. Click **Delete** to remove a service

### Configuring Settings

1. Click the **Configuration** tab
2. **Base Domain**: Set your base domain (e.g., "example.com")
   - Services with "Append base domain" enabled will use this
3. **NPM Integration**:
   - Enable NPM auto-discovery
   - Add NPM connections with URL and API token
   - Multiple NPM instances supported

4. Click **Save Configuration** when done
5. Restart both servers for changes to take effect

### Managing Passkeys (if authentication is enabled)

Passkeys provide a more secure and convenient way to login using biometrics, security keys, or device authentication.

1. Click the **Configuration** tab
2. Scroll to the **Passkey Management** section
3. Enter a name for your passkey (e.g., "My Laptop", "iPhone", "YubiKey")
4. Click **Add Passkey**
5. Follow your browser/device prompts to complete registration
6. Use the passkey to login in the future instead of your password

**Benefits:**
- No password needed after initial setup
- More secure than passwords
- Works with Face ID, Touch ID, Windows Hello, security keys
- Each device can have its own passkey

## Files Modified

The management tool modifies:

- `public/services.json` - Manual services configuration
- `config.json` - Base URL and NPM settings (created automatically)
- `auth.json` - Passkey credentials (created automatically if authentication is enabled)

## Security Recommendations

1. **Enable authentication** for any production deployment:
   ```bash
   export ADMIN_USERNAME=your_username
   export ADMIN_PASSWORD=your_secure_password
   export SESSION_SECRET=random-secret-value
   ```

2. **Use passkeys** instead of passwords when possible for better security

3. **Use HTTPS** - Configure RP_ID and ORIGIN for production:
   ```bash
   export RP_ID=yourdomain.com
   export ORIGIN=https://yourdomain.com:3001
   ```

4. **Use a reverse proxy** with HTTPS if exposing to network

5. **Firewall the port** - Only allow trusted IPs to access port 3001

6. **Don't commit credentials** - Keep `auth.json` and environment variables secure

7. **Disable authentication only for local development** - Never run without auth in production

## Troubleshooting

### Server won't start
- Make sure port 3001 is not already in use
- Check that you have write permissions to the project directory

### Changes not appearing
- Make sure to restart the main dashboard server after config changes
- Clear browser cache if UI changes aren't visible

### Authentication not working
- Check that you're using the correct credentials
- Browser may cache credentials - try incognito/private mode

## Architecture

```
admin-server.js          # Express server on port 3001
admin-src/               # Admin UI source code
  ├── index.html         # HTML entry point
  ├── main.jsx          # React entry point
  ├── AdminApp.jsx      # Main app component
  ├── admin.css         # Styles
  └── components/
      ├── ServicesManager.jsx   # Services CRUD UI
      └── ConfigManager.jsx     # Configuration UI
admin-dist/              # Built admin UI (generated)
vite.admin.config.js     # Vite config for admin UI
```

## API Endpoints

The management server exposes these endpoints:

- `GET /api/admin/services` - List all services
- `POST /api/admin/services` - Add a service
- `PUT /api/admin/services/:index` - Update a service
- `DELETE /api/admin/services/:index` - Delete a service
- `GET /api/admin/config` - Get configuration
- `PUT /api/admin/config` - Update configuration

All endpoints require HTTP Basic Authentication.
