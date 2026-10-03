/**
 * Start only the admin panel (port 3001).
 * Use server/start.js to run the dashboard and admin panel together.
 */

import { initIcons } from './server/icons.js'
import { migrateData } from './server/services.js'
import { startAdminServer } from './server/admin-server.js'

await migrateData()
await initIcons()
await startAdminServer()
