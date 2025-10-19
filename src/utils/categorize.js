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
 * @param {string} serviceName - The name of the service
 * @returns {string} - The determined category or 'Other'
 */
export function autoCategorizeName(serviceName) {
  if (!serviceName) return 'Other'

  const lowerName = serviceName.toLowerCase()

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category
      }
    }
  }

  return 'Other'
}

/**
 * Categorizes a service, using the provided category or auto-detecting
 * @param {Object} service - The service object
 * @returns {string} - The category name
 */
export function categorizeService(service) {
  // If category is already set and not empty, use it
  if (service.category && service.category.trim() !== '') {
    return service.category
  }

  // Otherwise, auto-categorize based on name
  return autoCategorizeName(service.name)
}
