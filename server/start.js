/**
 * Start the dashboard and the admin panel in one process (used by Docker).
 * Sharing a process means one icon index, one NPM cache and no two
 * processes writing the same data files.
 */

import { initIcons } from './icons.js'
import { migrateData } from './services.js'
import { DATA_DIR } from './storage.js'
import { startMainServer } from './main-server.js'
import { startAdminServer } from './admin-server.js'

console.log(`Services Dashboard - data directory: ${DATA_DIR}`)

await migrateData()
await initIcons()
await Promise.all([startMainServer(), startAdminServer()])

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down`)
    process.exit(0)
  })
}
