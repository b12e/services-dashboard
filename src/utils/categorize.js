/**
 * Auto-categorization utility for services
 * Analyzes service names to determine the most appropriate category
 */

const categoryKeywords = {
  'Media': [
    // Media servers
    'plex', 'jellyfin', 'emby', 'kodi', 'media server', 'mediaserver',
    'tautulli', 'ombi', 'overseerr',
    // Media management (*arr apps)
    'sonarr', 'radarr', 'lidarr', 'readarr', 'bazarr', 'prowlarr',
    'whisparr', 'mylar', 'lazylibrarian', 'sickchill', 'couchpotato',
    // Downloads
    'qbittorrent', 'transmission', 'deluge', 'rtorrent', 'rutorrent',
    'sabnzbd', 'nzbget', 'nzbhydra', 'torrent', 'usenet',
    // Photos
    'photoprism', 'immich', 'piwigo', 'lychee', 'photo', 'photos', 'gallery',
    // Books/Reading
    'calibre', 'kavita', 'komga', 'ubooquity', 'audiobookshelf'
  ],
  'Productivity': [
    'nextcloud', 'owncloud', 'seafile', 'bitwarden', 'vaultwarden',
    'bookstack', 'wiki', 'dokuwiki', 'notion', 'joplin', 'trilium',
    'standard notes', 'paperless', 'invoice', 'invoiceninja',
    'onlyoffice', 'collabora', 'cryptpad', 'etherpad',
    // Workflow automation
    'n8n', 'make', 'zapier', 'activepieces', 'workflow', 'integration',
    // Finance
    'firefly', 'actual', 'budget', 'finance', 'accounting', 'expenses'
  ],
  'Monitoring': [
    'grafana', 'prometheus', 'uptime', 'kuma', 'netdata', 'glances',
    'monitoring', 'influxdb', 'telegraf', 'zabbix', 'nagios', 'icinga',
    'healthchecks', 'statping', 'status', 'monitor',
    // Analytics
    'matomo', 'plausible', 'umami', 'analytics', 'stats', 'statistics'
  ],
  'Network': [
    'pihole', 'pi-hole', 'adguard', 'nginx', 'proxy', 'traefik', 'caddy',
    'haproxy', 'dns', 'vpn', 'wireguard', 'openvpn', 'tailscale',
    'zerotier', 'cloudflare', 'firewall', 'router', 'gateway',
    // Security/Auth
    'authentik', 'authelia', 'keycloak', 'oauth', 'sso', 'ldap',
    'vault', 'auth', 'authentication', 'fail2ban', 'crowdsec', 'wazuh'
  ],
  'Development': [
    'github', 'gitlab', 'gitea', 'gogs', 'portainer', 'jenkins', 'drone',
    'ci/cd', 'docker', 'kubernetes', 'rancher', 'code-server', 'vscode',
    'git', 'registry', 'harbor', 'nexus', 'artifactory', 'woodpecker'
  ],
  'Home & Automation': [
    // Home Automation
    'home assistant', 'homeassistant', 'openhab', 'domoticz', 'node-red',
    'nodered', 'mqtt', 'zigbee', 'zwave', 'homebridge', 'smart home',
    'iot', 'automation', 'esphome', 'tasmota', 'shelly', 'tuya',
    'deconz', 'zwavejs', 'frigate', 'scrypted', 'homekit', 'hubitat',
    'grocy', 'mealie', 'tandoor', 'recipe',
    // Communication
    'discord', 'slack', 'mattermost', 'rocket.chat', 'rocketchat', 'matrix', 'synapse',
    'element', 'jitsi', 'chat', 'messaging', 'email', 'mail', 'mailcow',
    'mailu', 'postal', 'mumble', 'teamspeak', 'ventrilo',
    // Gaming
    'minecraft', 'steam', 'game', 'gaming', 'pterodactyl', 'amp', 'gameserver',
    'valheim', 'terraria', 'factorio', 'satisfactory', 'palworld',
    // Lifestyle & Personal
    'recipes', 'groceries', 'shopping', 'calendar', 'tasks', 'home',
    'family', 'household'
  ]
}

/**
 * Automatically categorizes a service based on its name
 * Returns ALL matching categories (can be multiple)
 * @param {string} serviceName - The name of the service
 * @returns {Array<string>} - Array of category names
 */
export function autoCategorizeName(serviceName) {
  if (!serviceName) return []

  const lowerName = serviceName.toLowerCase()
  const matchedCategories = []

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        matchedCategories.push(category)
        break // Don't add the same category twice
      }
    }
  }

  return matchedCategories
}

/**
 * Categorizes a service, using the provided categories or auto-detecting
 * @param {Object} service - The service object
 * @returns {Array<string>} - Array of category names
 */
export function categorizeService(service) {
  const categories = []

  // 1. Check for manual category (single string - legacy)
  if (service.category && typeof service.category === 'string' && service.category.trim() !== '') {
    categories.push(service.category)
  }

  // 2. Check for manual categories array
  if (service.categories && Array.isArray(service.categories) && service.categories.length > 0) {
    categories.push(...service.categories)
  }

  // 3. Check for suggested categories from icon metadata
  if (service._suggestedCategories && Array.isArray(service._suggestedCategories)) {
    categories.push(...service._suggestedCategories)
  }

  // 4. Auto-categorize based on name if no categories found
  if (categories.length === 0) {
    const autoCategories = autoCategorizeName(service.name)
    categories.push(...autoCategories)
  }

  // 5. If still no categories, use 'Other'
  if (categories.length === 0) {
    categories.push('Other')
  }

  // Remove duplicates
  return [...new Set(categories)]
}
