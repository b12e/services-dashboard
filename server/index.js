/**
 * Start only the public dashboard (port 3000).
 * Use server/start.js to run the dashboard and admin panel together.
 */

import { initIcons } from './icons.js'
import { migrateData } from './services.js'
import { startMainServer } from './main-server.js'

await migrateData()
await initIcons()
await startMainServer()
