# Services Dashboard - Developer Guide

This guide is for developers who want to contribute to the Services Dashboard project or set up a local development environment.

## Tech Stack

- **Frontend**: React 18.3.1 with functional components and hooks
- **Build Tool**: Vite 6.0.3 for fast development and optimized production builds
- **Backend**: Express.js 4.18.2 (Node.js server)
- **PWA**: vite-plugin-pwa for Progressive Web App functionality
- **Styling**: CSS with CSS Grid for responsive layouts
- **Icons**: [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) with fuzzy matching
- **Container**: Docker multi-stage builds (Node.js 20 Alpine)

## Architecture

### Client-Side (React)
- **App.jsx**: Main application component with state management
- **Components**: Header, SearchBar, ServicesGrid, Sidebar, ServiceCard
- **Utils**: categorize.js for auto-categorization logic
- **Services**: npmService.js (API client), iconService.js (icon discovery)

### Server-Side (Express)
- **server/index.js**: Express server that:
  - Serves static files from `/dist`
  - Provides `/api/npm/services` endpoint for NPM integration
  - Provides `/api/config` endpoint for configuration
  - Handles NPM API authentication securely (credentials never exposed to client)
  - Performs icon discovery server-side

### Security Model
- NPM credentials are stored as environment variables on the server
- Client never sees NPM credentials (they stay in Docker container)
- All NPM API calls happen server-side
- Client calls internal `/api/npm/services` endpoint instead

## Development Setup

### Prerequisites
- Node.js 20 or higher
- npm or yarn
- Docker (optional, for testing containerized builds)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/services-dashboard.git
   cd services-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create test data** (optional):

   Create `public/services.json.example` for sample services:
   ```json
   {
     "services": [
       {
         "name": "Plex",
         "url": "plex",
         "category": "Media"
       }
     ]
   }
   ```

   Copy to `public/services.json`:
   ```bash
   cp public/services.json.example public/services.json
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

   This starts Vite dev server on `http://localhost:5173`

   **Note**: The dev server proxies `/services.json` from `https://dashboard.local.b12e.es` by default. To use local files, update `vite.config.js` proxy settings or place files in `public/` directory.

5. **Build for production**:
   ```bash
   npm run build
   ```

   Built files are output to `dist/` directory.

6. **Preview production build**:
   ```bash
   npm run preview
   ```

### Testing Server-Side NPM Integration Locally

To test the full server-side NPM integration locally:

1. **Set environment variables**:
   ```bash
   export NPM_API_URL="http://your-npm:81/api"
   export NPM_USERNAME="admin@example.com"
   export NPM_PASSWORD="your-password"
   export BASE_URL="example.com"
   export PORT=3000
   ```

2. **Build the frontend**:
   ```bash
   npm run build
   ```

3. **Start the Node.js server**:
   ```bash
   node server/index.js
   ```

4. **Open browser**:
   Navigate to `http://localhost:3000`

The server will:
- Serve the React app from `/dist`
- Fetch services from NPM API securely
- Provide merged services at `/api/npm/services`
- Never expose credentials to the browser

## Docker Development

### Building Docker Image Locally

```bash
docker build -t services-dashboard:dev .
```

### Running Docker Container Locally

```bash
docker run -d \
  --name services-dashboard-dev \
  -p 3000:3000 \
  -e NPM_API_URL="http://your-npm:81/api" \
  -e NPM_USERNAME="admin@example.com" \
  -e NPM_PASSWORD="your-password" \
  -e BASE_URL="example.com" \
  -v $(pwd)/public/services.json:/app/dist/services.json:ro \
  services-dashboard:dev
```

### Checking Logs

```bash
docker logs -f services-dashboard-dev
```

### Stopping Container

```bash
docker stop services-dashboard-dev
docker rm services-dashboard-dev
```

## Project Structure

```
services-dashboard/
├── public/                    # Static assets
│   ├── icon.svg              # PWA app icon
│   ├── services.json.example # Example services file
│   └── manifest.json         # PWA manifest
├── server/                    # Server-side code
│   └── index.js              # Express server with NPM integration
├── src/                       # React source code
│   ├── components/           # React components
│   │   ├── Header.jsx
│   │   ├── SearchBar.jsx
│   │   ├── ServicesGrid.jsx
│   │   ├── ServiceCard.jsx
│   │   └── Sidebar.jsx
│   ├── services/             # API services
│   │   ├── npmService.js     # NPM API client (calls internal API)
│   │   └── iconService.js    # Icon discovery service
│   ├── utils/                # Utility functions
│   │   └── categorize.js     # Auto-categorization logic
│   ├── App.jsx               # Main app component
│   ├── App.css               # Global styles
│   └── main.jsx              # React entry point
├── .github/workflows/        # GitHub Actions CI/CD
│   └── docker-publish.yml    # Auto-build and push to Docker Hub
├── Dockerfile                # Multi-stage Docker build
├── vite.config.js            # Vite configuration
├── package.json              # Dependencies
├── USER_GUIDE.md             # User documentation
├── DEVELOPER.md              # This file
└── README.md                 # Main readme
```

## Key Files

### vite.config.js
Configures Vite build tool:
- PWA plugin for service worker generation
- Proxy settings for development
- Build output configuration

### server/index.js
Express server that:
- Serves static React app
- Provides `/api/npm/services` endpoint
- Provides `/api/config` endpoint
- Handles NPM authentication securely
- Performs server-side icon discovery

### src/App.jsx
Main React component:
- Loads configuration from `/api/config`
- Fetches manual services from `/services.json`
- Fetches NPM services from `/api/npm/services`
- Merges and deduplicates services
- Manages search and category filtering state

### Dockerfile
Multi-stage build:
1. **Build stage**: Builds React app with Vite
2. **Production stage**: Node.js 20 Alpine with Express server

## GitHub Actions Workflow

The project includes automated CI/CD via GitHub Actions (`.github/workflows/docker-publish.yml`).

### Setup

1. **Create Docker Hub account** and generate access token

2. **Add GitHub secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add:
     - `DOCKERHUB_USERNAME`: Your Docker Hub username
     - `DOCKERHUB_TOKEN`: Your Docker Hub access token

3. **Trigger builds**:
   - **On push to main**: Builds and tags as `latest`
   - **On tag** (e.g., `v1.0.0`): Builds and tags with version

### Build Workflow

The workflow:
- Checks out code
- Sets up Docker Buildx for multi-platform builds
- Builds for `linux/amd64` and `linux/arm64`
- Pushes to Docker Hub as `b12e/services-dashboard`

## Contributing

### Code Style

- Use functional React components with hooks
- Use PropTypes for component props
- Follow existing code formatting
- Add comments for complex logic

### Adding New Features

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and test locally

3. **Update documentation** if needed

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "Add feature: description"
   ```

5. **Push to GitHub**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**

### Adding New Categories

Edit `src/utils/categorize.js`:

```javascript
const categoryKeywords = {
  'Your Category': [
    'keyword1', 'keyword2', 'keyword3'
  ],
  // ... other categories
}
```

### Debugging

**Frontend debugging**:
- Open browser DevTools (F12)
- Check Console for React errors
- Check Network tab for API calls

**Server debugging**:
- Check Docker logs: `docker logs services-dashboard`
- Add `console.log()` statements in `server/index.js`
- Restart container to see changes

**NPM integration debugging**:
- Verify NPM API is accessible from container
- Check credentials are correct
- Look for authentication errors in logs
- Test NPM API directly with curl:
  ```bash
  curl -X POST http://npm:81/api/tokens \
    -H "Content-Type: application/json" \
    -d '{"identity":"admin@example.com","secret":"password"}'
  ```

## Release Process

1. **Update version** in `package.json`

2. **Update CHANGELOG** (if exists)

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   ```

4. **Create tag**:
   ```bash
   git tag v1.0.0
   git push origin main
   git push origin v1.0.0
   ```

5. **GitHub Actions** will automatically build and push to Docker Hub

## Troubleshooting

### Build fails in Docker

- Check Node.js version (should be 20+)
- Verify all dependencies are in `package.json`
- Check for syntax errors in code

### NPM integration not working

- Verify environment variables are set correctly
- Check NPM API URL is accessible from container
- Test NPM credentials manually
- Check server logs for authentication errors

### Icons not loading

- Verify `dashboard-icons-metadata.json` was downloaded during build
- Check browser network tab for failed icon requests
- Verify icon CDN is accessible

### Service worker issues

- Clear browser cache
- Unregister old service workers in DevTools
- Rebuild with `npm run build`

## License

This project is open source and available for personal and commercial use.

## Credits

- Icons provided by [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
- Built with React, Vite, and Express
