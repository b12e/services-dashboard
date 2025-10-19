# Services Dashboard

A beautiful, dark-themed React dashboard for all your self-hosted services with PWA support, automatic service discovery from Nginx Proxy Manager, and offline capabilities.

![Services Dashboard](https://img.shields.io/badge/PWA-Ready-blue)
![Offline Support](https://img.shields.io/badge/Offline-Supported-green)
![Dark Mode](https://img.shields.io/badge/Dark-Mode-black)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Node.js](https://img.shields.io/badge/Node.js-20-green)

## Screenshots

<img width="1633" height="974" alt="Desktop view" src="https://github.com/user-attachments/assets/f4b8ee13-49e5-4301-8c3b-db6952e4e23a" />
<img width="2308" height="1682" alt="Mobile view" src="https://github.com/user-attachments/assets/b7f7f283-65e0-4abb-befe-f4bbf29729bf" />

## Features

- 🌙 **Dark Mode**: Sleek dark theme with clean, modern design
- 📱 **PWA Support**: Install as an app on mobile or desktop
- 🔌 **Offline Ready**: Works offline with cached icons and data
- 🎨 **Automatic Icons**: Fetches service icons with intelligent fuzzy matching
- 🤖 **NPM Auto-Discovery**: Automatically discover services from Nginx Proxy Manager
- 🔒 **Secure**: NPM credentials stay server-side, never exposed to browser
- 🏷️ **Smart Categories**: Automatic categorization with sidebar filtering
- 🔍 **Real-time Search**: Instantly filter services with live results
- 📱 **Responsive**: Adapts to any screen size with mobile hamburger menu
- 🎯 **Clean UI**: Focus on service names and icons
- ⚡ **Fast Loading**: Service worker caches all assets for instant loads

## Quick Start

### Using Docker (Recommended)

**With NPM Auto-Detection:**
```bash
docker run -d \
  --name services-dashboard \
  -p 3000:3000 \
  -e NPM_API_URL="http://your-npm-host:81/api" \
  -e NPM_USERNAME="admin@example.com" \
  -e NPM_PASSWORD="your-password" \
  b12e/services-dashboard:latest
```

**With Manual Services File:**
```bash
docker run -d \
  --name services-dashboard \
  -p 3000:3000 \
  -e BASE_URL="example.com" \
  -v /path/to/services.json:/app/dist/services.json:ro \
  b12e/services-dashboard:latest
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  services-dashboard:
    image: b12e/services-dashboard:latest
    container_name: services-dashboard
    ports:
      - "3000:3000"
    environment:
      - NPM_API_URL=http://nginx-proxy-manager:81/api
      - NPM_USERNAME=admin@example.com
      - NPM_PASSWORD=your-password
      - BASE_URL=example.com
    volumes:
      - ./services.json:/app/dist/services.json:ro  # Optional
    restart: unless-stopped
```

Access at `http://localhost:3000`

## Documentation

📖 **[User Guide](USER_GUIDE.md)** - Setup, configuration, and usage instructions

🛠️ **[Developer Guide](DEVELOPER.md)** - Development setup, architecture, and contributing

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NPM_API_URL` | No* | Nginx Proxy Manager API URL (e.g., `http://npm:81/api`) |
| `NPM_USERNAME` | No** | NPM admin email |
| `NPM_PASSWORD` | No** | NPM password |
| `BASE_URL` | No | Base domain for manual services (e.g., `example.com`) |

\* At least one of NPM integration OR manual services file is required
\** Required if `NPM_API_URL` is set

### Security

**NPM credentials are secure:**
- Credentials are environment variables on the server (inside Docker container)
- Never exposed to the browser or client-side code
- All NPM API calls happen server-side via Express.js
- Client calls internal `/api/npm/services` endpoint

## What's New

### Version 3.0.0 (Security Update)

**🔒 BREAKING CHANGE: Server-Side NPM Integration**
- NPM API calls moved to server-side for security
- Credentials never exposed to browser
- Port changed from 80 to 3000 (Node.js server instead of nginx)
- Volume path changed from `/usr/share/nginx/html/services.json` to `/app/dist/services.json`

**Migration Guide:**
- Update port mapping: `-p 80:80` → `-p 3000:3000`
- Update volume path: `/usr/share/nginx/html/services.json` → `/app/dist/services.json`
- No configuration file mounting needed (use env vars only)

### Previous Versions

- **2.1.0**: Added NPM auto-discovery, search improvements, mobile enhancements
- **2.0.0**: React migration, Vite build system, GitHub Actions CI/CD
- **1.0.0**: Initial release with PWA support

## How It Works

1. **Configuration**: Set environment variables for NPM and/or BASE_URL
2. **Service Discovery**:
   - Server fetches services from NPM API (if configured)
   - Server loads manual services from `services.json` (if mounted)
3. **Icon Discovery**: Server uses fuzzy matching to find icons automatically
4. **Categorization**: Services auto-categorized by keywords
5. **Deduplication**: Manual services take priority over NPM services
6. **Client Display**: React app displays merged services with search and filtering

## Browser Support

All modern browsers supported:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Contributing

Contributions welcome! See [DEVELOPER.md](DEVELOPER.md) for:
- Development setup
- Architecture overview
- Coding standards
- How to contribute

## License

This project is open source and available for personal and commercial use.

## Credits

- Icons provided by [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Built with React, Vite, and Express.js

## Support

- 📚 **Documentation**: [User Guide](USER_GUIDE.md) | [Developer Guide](DEVELOPER.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/services-dashboard/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/services-dashboard/discussions)
