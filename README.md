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
## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin panel username (empty = no auth) |
| `ADMIN_PASSWORD` | Admin panel password |

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


## Passkey Authentication

**Requirements:**
- Enable authentication by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Access the admin panel via HTTPS in production (required for passkeys)
- Your reverse proxy must forward the correct headers

**Note:** Passkeys registered on one domain (e.g., `admin.example.com`) will only work on that same domain or subdomains of the registrable domain (`example.com`).

