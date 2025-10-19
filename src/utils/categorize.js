/**
 * Auto-categorization utility for services
 * Analyzes service names to determine the most appropriate category
 */

const categoryKeywords = {
  'Media-Servers': [
    'plex', 'jellyfin', 'emby', 'kodi', 'media server', 'mediaserver',
    'navidrome', 'airsonic', 'subsonic', 'funkwhale', 'ampache',
    'streama', 'dim', 'gerbera', 'minidlna'
  ],
  'Media-Management': [
    // *arr stack
    'sonarr', 'radarr', 'lidarr', 'readarr', 'bazarr', 'prowlarr',
    'whisparr', 'jonarr',
    // Request management
    'overseerr', 'ombi', 'petio', 'requestrr',
    // Statistics & tracking
    'tautulli', 'varken', 'organizr',
    // Other media tools
    'mylar', 'lazylibrarian', 'sickchill', 'couchpotato', 'medusa'
  ],
  'Download-Managers': [
    // BitTorrent
    'qbittorrent', 'transmission', 'deluge', 'rtorrent', 'rutorrent',
    'flood', 'torrentbox', 'ktorrent', 'utorrent', 'bittorrent',
    // Usenet
    'sabnzbd', 'nzbget', 'nzbhydra', 'nzbhydra2',
    // General
    'jdownloader', 'pyload', 'aria2', 'youtube-dl', 'yt-dlp', 'tubesync'
  ],
  'Photos': [
    'photoprism', 'immich', 'piwigo', 'lychee', 'photoview', 'photostructure',
    'pigallery', 'chevereto', 'librephotos', 'ownphotos', 'photos',
    'pixelfed', 'memories', 'photoview'
  ],
  'Books-Reading': [
    'calibre', 'calibre-web', 'kavita', 'komga', 'ubooquity', 'audiobookshelf',
    'readarr', 'bookstack', 'lazylibrarian', 'mylar', 'mango', 'tanoshi'
  ],
  'Productivity': [
    // Cloud storage
    'nextcloud', 'owncloud', 'seafile', 'filerun', 'filebrowser', 'syncthing',
    // Password managers
    'bitwarden', 'vaultwarden', 'passbolt', 'psono', 'keepass', 'passit',
    // Note taking & wiki
    'bookstack', 'wiki.js', 'dokuwiki', 'outline', 'hedgedoc', 'notion',
    'joplin', 'trilium', 'standardnotes', 'carnet', 'memos',
    // Documents
    'paperless', 'paperless-ngx', 'papermerge', 'mayan', 'teedy', 'docspell',
    // Office suites
    'onlyoffice', 'collabora', 'cryptpad', 'etherpad', 'hedgedoc',
    // Task management
    'vikunja', 'wekan', 'kanboard', 'planka', 'focalboard', 'tasks', 'todo'
  ],
  'Workflow-Automation': [
    'n8n', 'nodered', 'node-red', 'huginn', 'activepieces', 'automatisch',
    'windmill', 'activepieces', 'trigger', 'workflow', 'automation', 'integration'
  ],
  'Finance': [
    'firefly', 'firefly-iii', 'actual', 'budget', 'budge', 'ghostfolio',
    'maybe', 'lunch money', 'invoice', 'invoiceninja', 'invoice ninja',
    'crater', 'akaunting', 'finance', 'accounting', 'expenses'
  ],
  'Monitoring-Tools': [
    'grafana', 'prometheus', 'uptime-kuma', 'uptime', 'kuma', 'statping',
    'gatus', 'vigil', 'healthchecks', 'cstate', 'cachet',
    'netdata', 'glances', 'scrutiny', 'librespeed', 'speedtest',
    'monitorr', 'logarr', 'dockprom', 'monitor', 'status'
  ],
  'Logging-Metrics': [
    'influxdb', 'telegraf', 'victoria', 'timescale', 'questdb',
    'loki', 'promtail', 'elasticsearch', 'logstash', 'graylog',
    'seq', 'dozzle', 'logs'
  ],
  'Analytics': [
    'matomo', 'plausible', 'umami', 'ackee', 'shynet', 'offen',
    'posthog', 'metabase', 'superset', 'analytics', 'stats', 'statistics'
  ],
  'Networking-Tools': [
    // Reverse proxies
    'nginx', 'nginx proxy manager', 'npm', 'traefik', 'caddy', 'haproxy',
    'swag', 'linuxserver',
    // VPN
    'wireguard', 'openvpn', 'tailscale', 'headscale', 'zerotier', 'netbird',
    'pritunl', 'softether',
    // Network tools
    'speedtest', 'librespeed', 'smokeping', 'netbox', 'phpipam',
    'gateway', 'router'
  ],
  'DNS-Adblock': [
    'pihole', 'pi-hole', 'adguard', 'adguard home', 'blocky', 'technitium',
    'dns', 'adblock', 'ad-block'
  ],
  'Security-Auth': [
    'authentik', 'authelia', 'keycloak', 'lldap', 'openldap', 'glauth',
    'oauth', 'sso', 'ldap', 'saml', 'oidc',
    'vault', 'hashicorp', 'auth', 'authentication',
    // Security monitoring
    'fail2ban', 'crowdsec', 'wazuh', 'ossec', 'security'
  ],
  'Development': [
    // Git
    'github', 'gitlab', 'gitea', 'gogs', 'forgejo', 'radicle',
    // CI/CD
    'jenkins', 'drone', 'woodpecker', 'concourse', 'buildbot', 'ci/cd', 'cicd',
    // Container management
    'portainer', 'yacht', 'docker', 'kubernetes', 'k8s', 'rancher', 'lens',
    // IDEs
    'code-server', 'vscode', 'theia', 'coder', 'gitpod',
    // Package registries
    'registry', 'harbor', 'nexus', 'artifactory', 'verdaccio',
    // Databases
    'postgres', 'mysql', 'mariadb', 'mongodb', 'redis', 'adminer', 'phpmyadmin',
    // Dev tools
    'git', 'swagger', 'api', 'postman', 'hoppscotch'
  ],
  'Home-Automation': [
    'home assistant', 'homeassistant', 'hass', 'openhab', 'domoticz',
    'home-assistant', 'ha', 'homebridge', 'hoobs',
    // IoT protocols
    'mqtt', 'mosquitto', 'zigbee', 'zigbee2mqtt', 'z2m', 'zwave', 'zwavejs',
    'esphome', 'tasmota', 'shelly', 'tuya', 'smartthings',
    // Integrations
    'node-red', 'nodered', 'deconz', 'zwavejs', 'frigate', 'scrypted',
    'homekit', 'hubitat', 'iot', 'automation', 'smart home', 'smarthome'
  ],
  'Food-Recipe': [
    'mealie', 'tandoor', 'grocy', 'recipes', 'nextcloud cookbook',
    'recipe', 'cookbook', 'groceries', 'shopping'
  ],
  'Communication': [
    // Chat
    'discord', 'slack', 'mattermost', 'rocket.chat', 'rocketchat', 'matrix',
    'synapse', 'element', 'revolt', 'zulip', 'mumble', 'teamspeak',
    // Video conference
    'jitsi', 'jitsi meet', 'bigbluebutton', 'bbb',
    // Email
    'mailcow', 'mailu', 'mail-in-a-box', 'postal', 'poste.io', 'iredmail',
    'roundcube', 'rainloop', 'snappymail', 'email', 'mail', 'smtp',
    // General
    'chat', 'messaging', 'forum', 'discourse', 'flarum'
  ],
  'Gaming': [
    'minecraft', 'steam', 'game', 'gaming', 'pterodactyl', 'amp', 'gameserver',
    'valheim', 'terraria', 'factorio', 'satisfactory', 'palworld',
    'craftybytes', 'crafty', 'cubecoders', 'linuxgsm', 'gameservers'
  ],
  'Backup-Sync': [
    'duplicati', 'duplicacy', 'restic', 'borg', 'borgmatic', 'kopia',
    'syncthing', 'rsync', 'rclone', 'backup', 'sync'
  ],
  'Storage': [
    'minio', 's3', 'garage', 'seaweedfs', 'ceph', 'gluster',
    'nfs', 'samba', 'webdav', 'storage', 'files'
  ],
  'System-Management': [
    'cockpit', 'webmin', 'ajenti', 'yunohost', 'cloudron', 'caprover',
    'coolify', 'easypanel', 'portainer', 'unraid', 'truenas', 'openmediavault',
    'omv', 'panel', 'admin', 'dashboard'
  ],
  'Dashboards': [
    'homer', 'heimdall', 'homarr', 'flame', 'organizr', 'dashboard',
    'dashy', 'fenrus', 'jump', 'homepage', 'sui', 'heimdall'
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
 * Priority order:
 * 1. Manual categories from services.json
 * 2. Auto-categorize from name (categorize.js keywords)
 * 3. Homarr-labs icon metadata categories (fallback)
 * 4. "Other" if nothing matches
 *
 * @param {Object} service - The service object
 * @returns {Array<string>} - Array of category names
 */
export function categorizeService(service) {
  const categories = []

  // Priority 1: Check for manual category (single string - legacy)
  if (service.category && typeof service.category === 'string' && service.category.trim() !== '') {
    categories.push(service.category)
  }

  // Priority 1: Check for manual categories array
  if (service.categories && Array.isArray(service.categories) && service.categories.length > 0) {
    categories.push(...service.categories)
  }

  // If manual categories were provided, use only those
  if (categories.length > 0) {
    return [...new Set(categories)]
  }

  // Priority 2: Auto-categorize based on name (categorize.js)
  const autoCategories = autoCategorizeName(service.name)
  if (autoCategories.length > 0) {
    return autoCategories
  }

  // Priority 3: Use suggested categories from icon metadata (homarr-labs) as fallback
  if (service._suggestedCategories && Array.isArray(service._suggestedCategories) && service._suggestedCategories.length > 0) {
    return [...new Set(service._suggestedCategories)]
  }

  // Priority 4: Default to "Other" if nothing matches
  return ['Other']
}
