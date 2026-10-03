/**
 * Built-in category taxonomy
 *
 * Every built-in category has a stable `key`. Categories stored in
 * categories.json link to a built-in through their `autoKey`, so users can
 * rename them freely without breaking auto-categorization.
 *
 * - `apps`:     known applications. Matched as whole names, never as
 *               substrings, so "chat" no longer lands in Home Automation
 *               because it contains "ha".
 * - `keywords`: generic words, only used when no known app matched.
 */

export const BUILTIN_CATEGORIES = [
  {
    key: 'media',
    label: 'Media',
    apps: [
      // Media servers
      'plex', 'jellyfin', 'emby', 'kodi', 'dim', 'streama', 'gerbera', 'minidlna', 'serviio', 'olaris',
      'navidrome', 'airsonic', 'airsonic-advanced', 'subsonic', 'funkwhale', 'ampache', 'koel', 'gonic',
      'plexamp', 'polaris', 'lyrion', 'mopidy', 'owntone', 'snapcast', 'music-assistant', 'beets',
      'peertube', 'invidious', 'piped', 'owncast', 'stash',
      // Live TV
      'tvheadend', 'channels-dvr', 'threadfin', 'xteve', 'dispatcharr', 'ersatztv', 'dizquetv', 'tunarr',
      // *arr stack and helpers
      'sonarr', 'radarr', 'lidarr', 'readarr', 'bazarr', 'whisparr', 'mylar', 'mylar3', 'kapowarr',
      'lazylibrarian', 'sickchill', 'sickgear', 'sickrage', 'medusa', 'couchpotato', 'headphones',
      'recyclarr', 'unpackerr', 'maintainerr', 'notifiarr', 'kometa', 'posterizarr', 'huntarr', 'cleanuparr',
      'tdarr', 'unmanic', 'fileflows', 'handbrake',
      // Requests and stats
      'overseerr', 'jellyseerr', 'seerr', 'ombi', 'petio', 'requestrr', 'doplarr', 'wizarr',
      'tautulli', 'varken', 'jellystat', 'streamystats', 'mediatracker', 'yamtrack', 'ryot',
      // Books, comics, audiobooks
      'calibre', 'calibre-web', 'calibre-web-automated', 'kavita', 'komga', 'ubooquity', 'audiobookshelf',
      'booklore', 'lanraragi', 'mango', 'tanoshi', 'suwayomi', 'kaizoku', 'storyteller',
      // Streaming services
      'youtube', 'netflix', 'spotify', 'twitch', 'soundcloud', 'deezer', 'tidal', 'crunchyroll',
      'hulu', 'disney-plus', 'prime-video', 'apple-tv', 'apple-music', 'hbo-max',
    ],
    keywords: [
      'media', 'movies', 'movie', 'films', 'film', 'tv', 'shows', 'series', 'music', 'audio', 'books',
      'ebooks', 'audiobooks', 'comics', 'manga', 'anime', 'podcasts', 'streaming', 'videos', 'iptv',
      'jukebox', 'radio', 'library',
    ],
  },
  {
    key: 'downloads',
    label: 'Downloads',
    apps: [
      'qbittorrent', 'transmission', 'deluge', 'rtorrent', 'rutorrent', 'flood', 'vuetorrent', 'ktorrent',
      'utorrent', 'bittorrent', 'tixati', 'qui', 'aria2', 'ariang', 'motrix',
      'sabnzbd', 'nzbget', 'nzbhydra', 'nzbhydra2', 'prowlarr', 'jackett', 'autobrr', 'cross-seed',
      'flaresolverr', 'byparr', 'slskd', 'soulseek', 'nicotine-plus',
      'jdownloader', 'jdownloader2', 'pyload', 'metube', 'yt-dlp', 'youtube-dl', 'tubesync',
      'pinchflat', 'tube-archivist', 'tubearchivist', 'ytdl-sub',
    ],
    keywords: ['downloads', 'download', 'downloader', 'torrent', 'torrents', 'usenet', 'nzb', 'indexer', 'indexers'],
  },
  {
    key: 'photos',
    label: 'Photos',
    apps: [
      'immich', 'photoprism', 'piwigo', 'lychee', 'photoview', 'photostructure', 'pigallery', 'pigallery2',
      'chevereto', 'librephotos', 'ownphotos', 'memories', 'ente', 'ente-photos', 'damselfly',
      'immich-kiosk', 'immich-power-tools', 'google-photos', 'flickr',
    ],
    keywords: ['photos', 'photo', 'gallery', 'pictures', 'pics'],
  },
  {
    key: 'productivity',
    label: 'Productivity',
    apps: [
      // Notes, wikis, knowledge bases
      'bookstack', 'wikijs', 'wiki-js', 'dokuwiki', 'mediawiki', 'outline', 'hedgedoc', 'docmost',
      'affine', 'appflowy', 'siyuan', 'logseq', 'obsidian', 'notion', 'joplin', 'trilium', 'triliumnext',
      'trilium-next', 'standard-notes', 'standardnotes', 'memos', 'blinko', 'flatnotes', 'silverbullet',
      'notesnook', 'anytype', 'otterwiki',
      // Bookmarks and reading
      'karakeep', 'hoarder', 'linkwarden', 'linkding', 'shiori', 'wallabag', 'readeck', 'omnivore',
      'archivebox', 'freshrss', 'miniflux', 'tiny-tiny-rss', 'tt-rss', 'ttrss', 'commafeed', 'rsshub',
      'glance-rss',
      // Documents and office
      'paperless', 'paperless-ngx', 'paperless-ai', 'paperless-gpt', 'papermerge', 'papra', 'mayan',
      'mayan-edms', 'teedy', 'docspell', 'docuseal', 'opensign', 'onlyoffice', 'collabora', 'cryptpad',
      'etherpad', 'excalidraw', 'drawio', 'draw-io', 'tldraw', 'penpot',
      // Tasks, projects, calendars, CRM
      'vikunja', 'wekan', 'kanboard', 'planka', 'focalboard', 'leantime', 'plane', 'taiga', 'openproject',
      'todoist', 'donetick', 'tasks-md', 'super-productivity', 'baikal', 'radicale', 'davical', 'cal-com',
      'calcom', 'rallly', 'monica', 'twenty', 'kimai', 'solidtime', 'traggo', 'zammad', 'osticket',
      // Household inventory
      'homebox', 'snipe-it', 'snipeit', 'inventree', 'part-db',
    ],
    keywords: [
      'notes', 'wiki', 'docs', 'documents', 'tasks', 'todo', 'todos', 'kanban', 'calendar', 'contacts',
      'bookmarks', 'rss', 'reader', 'office', 'kb', 'knowledge', 'crm', 'projects', 'inventory',
      'journal', 'helpdesk', 'tickets',
    ],
  },
  {
    key: 'files',
    label: 'Files & Backup',
    apps: [
      'nextcloud', 'owncloud', 'ocis', 'opencloud', 'seafile', 'filerun', 'filebrowser', 'filebrowser-quantum',
      'filestash', 'pingvin', 'pingvin-share', 'zipline', 'picoshare', 'psitransfer', 'sftpgo', 'copyparty',
      'syncthing', 'resilio-sync', 'minio', 'garage', 'seaweedfs', 'ceph', 'samba', 'webdav',
      'duplicati', 'duplicacy', 'restic', 'backrest', 'borg', 'borgmatic', 'borgwarehouse', 'vorta',
      'kopia', 'rclone', 'urbackup', 'proxmox-backup-server', 'veeam', 'zerobyte',
      'dropbox', 'google-drive', 'onedrive', 'mega', 'icloud', 'box',
    ],
    keywords: ['files', 'file', 'drive', 'cloud', 'storage', 'backup', 'backups', 'sync', 'share', 's3', 'nas'],
  },
  {
    key: 'security',
    label: 'Security',
    apps: [
      'authentik', 'authelia', 'keycloak', 'lldap', 'openldap', 'glauth', 'zitadel', 'kanidm', 'pocket-id',
      'tinyauth', 'oauth2-proxy', 'vouch', 'freeipa',
      'vaultwarden', 'bitwarden', 'passbolt', 'psono', 'keepass', 'keepassxc', 'keeper', '1password', 'passit',
      'hashicorp-vault', 'openbao', 'infisical', '2fauth', 'step-ca',
      'crowdsec', 'fail2ban', 'wazuh', 'ossec', 'suricata', 'security-onion', 'greenbone', 'openvas',
    ],
    keywords: [
      'auth', 'sso', 'login', 'idp', 'ldap', 'oauth', 'oidc', 'passwords', 'password', 'vault',
      'security', '2fa', 'mfa', 'otp', 'secrets', 'certs', 'certificates',
    ],
  },
  {
    key: 'automation',
    label: 'Automation',
    apps: [
      'n8n', 'node-red', 'nodered', 'huginn', 'activepieces', 'automatisch', 'windmill', 'kestra',
      'airflow', 'dagster', 'prefect', 'cronicle', 'cronmaster', 'semaphore', 'ansible', 'awx', 'rundeck',
    ],
    keywords: ['automation', 'automations', 'workflow', 'workflows', 'flows', 'cron', 'scheduler', 'jobs'],
  },
  {
    key: 'home',
    label: 'Home Automation',
    apps: [
      'home-assistant', 'homeassistant', 'hass', 'openhab', 'domoticz', 'homebridge', 'hoobs', 'homey',
      'hubitat', 'smartthings', 'mosquitto', 'emqx', 'zigbee2mqtt', 'zwave-js-ui', 'zwavejs', 'zwavejs2mqtt',
      'esphome', 'tasmota', 'tasmoadmin', 'shelly', 'tuya', 'deconz', 'phoscon', 'matterbridge', 'valetudo',
      'frigate', 'scrypted', 'motioneye', 'shinobi', 'zoneminder', 'agent-dvr', 'viseron', 'blue-iris',
      'go2rtc', 'double-take', 'compreface', 'wyze-bridge', 'philips-hue', 'hue', 'ecobee', 'evcc',
    ],
    keywords: [
      'smarthome', 'iot', 'zigbee', 'zwave', 'mqtt', 'cameras', 'camera', 'cctv', 'nvr', 'lights',
      'thermostat', 'doorbell', 'energy', 'solar',
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    apps: [
      'firefly', 'firefly-iii', 'fireflyiii', 'actual', 'actual-budget', 'actualbudget', 'ezbookkeeping',
      'ghostfolio', 'maybe', 'maybe-finance', 'wealthfolio', 'lunch-money', 'invoice-ninja', 'invoiceninja',
      'crater', 'akaunting', 'solidinvoice', 'invoiceshelf', 'bigcapital', 'paisa', 'beancount', 'fava',
      'hledger', 'gnucash', 'wallos', 'budget-zero',
    ],
    keywords: [
      'finance', 'finances', 'budget', 'budgets', 'money', 'accounting', 'invoice', 'invoices', 'expenses',
      'bank', 'banking', 'stocks', 'portfolio', 'taxes', 'bills', 'subscriptions',
    ],
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    apps: [
      'grafana', 'prometheus', 'alertmanager', 'uptime-kuma', 'uptimekuma', 'statping', 'statping-ng', 'gatus',
      'vigil', 'healthchecks', 'cstate', 'cachet', 'upptime', 'uptimerobot', 'netdata', 'glances', 'scrutiny',
      'beszel', 'dozzle', 'loki', 'promtail', 'influxdb', 'chronograf', 'telegraf', 'victoriametrics',
      'victorialogs', 'graylog', 'elasticsearch', 'kibana', 'logstash', 'opensearch', 'seq', 'signoz',
      'jaeger', 'zabbix', 'nagios', 'icinga', 'checkmk', 'librenms', 'observium', 'cacti', 'prtg',
      'umami', 'plausible', 'matomo', 'ackee', 'shynet', 'offen', 'posthog', 'goatcounter', 'rybbit',
      'metabase', 'superset', 'redash', 'myspeed', 'speedtest-tracker', 'pulse', 'checkmate',
    ],
    keywords: [
      'monitor', 'monitoring', 'status', 'uptime', 'metrics', 'logs', 'logging', 'analytics', 'stats',
      'statistics', 'alerts', 'alerting', 'health', 'observability', 'traces', 'tracing', 'apm',
    ],
  },
  {
    key: 'network',
    label: 'Networking',
    apps: [
      'nginx', 'nginx-proxy-manager', 'npm', 'traefik', 'caddy', 'haproxy', 'swag', 'zoraxy', 'pangolin',
      'cloudflared', 'cloudflare', 'frp', 'ngrok',
      'wireguard', 'wg-easy', 'openvpn', 'tailscale', 'headscale', 'headplane', 'zerotier', 'netbird',
      'netmaker', 'pritunl', 'softether', 'gluetun', 'firezone',
      'pihole', 'pi-hole', 'adguard', 'adguard-home', 'adguardhome', 'blocky', 'technitium', 'unbound',
      'powerdns', 'coredns', 'nextdns', 'ddclient', 'ddns-updater',
      'unifi', 'unifi-network', 'omada', 'opnsense', 'pfsense', 'openwrt', 'mikrotik', 'routeros',
      'ntopng', 'netbox', 'phpipam', 'smokeping', 'librespeed', 'speedtest', 'openspeedtest', 'netalertx',
    ],
    keywords: [
      'proxy', 'dns', 'vpn', 'router', 'gateway', 'firewall', 'network', 'networking', 'wifi', 'adblock',
      'ddns', 'tunnel', 'switch', 'modem',
    ],
  },
  {
    key: 'development',
    label: 'Development',
    apps: [
      'github', 'gitlab', 'gitea', 'gogs', 'forgejo', 'onedev', 'radicale-git', 'radicle', 'bitbucket',
      'jenkins', 'drone', 'woodpecker', 'woodpecker-ci', 'concourse', 'buildbot', 'teamcity', 'argocd',
      'code-server', 'vscode', 'openvscode-server', 'theia', 'coder', 'gitpod', 'jupyter', 'jupyterhub',
      'jupyterlab', 'rstudio',
      'registry', 'docker-registry', 'harbor', 'nexus', 'artifactory', 'verdaccio', 'gitea-registry',
      'postgres', 'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'valkey', 'couchdb', 'cockroachdb',
      'clickhouse', 'neo4j', 'questdb', 'adminer', 'phpmyadmin', 'pgadmin', 'cloudbeaver', 'dbgate',
      'mongo-express', 'redisinsight', 'redis-commander', 'nocodb', 'baserow', 'teable', 'directus',
      'strapi', 'appwrite', 'supabase', 'pocketbase', 'budibase', 'appsmith', 'tooljet',
      'swagger', 'hoppscotch', 'postman', 'bruno', 'sonarqube', 'sentry', 'glitchtip', 'bugsink',
      'renovate', 'mailpit', 'mailhog',
    ],
    keywords: [
      'git', 'code', 'ide', 'ci', 'cicd', 'api', 'db', 'database', 'databases', 'sql', 'registry', 'repo',
      'repos', 'dev', 'devops', 'builds',
    ],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    apps: [
      'portainer', 'dockge', 'yacht', 'komodo', 'arcane', 'dockhand', 'rancher', 'kubernetes',
      'kubernetes-dashboard', 'k3s', 'k8s', 'headlamp', 'lens',
      'proxmox', 'pve', 'proxmox-ve', 'xcp-ng', 'xen-orchestra', 'esxi', 'vmware', 'vcenter', 'ovirt',
      'harvester', 'incus', 'lxd',
      'cockpit', 'webmin', 'ajenti', 'yunohost', 'cloudron', 'caprover', 'coolify', 'dokploy', 'easypanel',
      'unraid', 'truenas', 'truenas-scale', 'truenas-core', 'openmediavault', 'omv', 'synology',
      'synology-dsm', 'dsm', 'qnap', 'casaos', 'umbrel', 'runtipi', 'cosmos', 'cosmos-server',
      'watchtower', 'whats-up-docker', 'wud', 'diun', 'ouroboros',
      'peanut', 'nut', 'apcupsd', 'idrac', 'ilo', 'ipmi', 'pikvm', 'tinypilot', 'jetkvm',
      'guacamole', 'apache-guacamole', 'meshcentral', 'rustdesk', 'termix',
    ],
    keywords: [
      'docker', 'containers', 'container', 'vm', 'vms', 'hypervisor', 'kvm', 'ssh', 'terminal', 'servers',
      'ups', 'bmc', 'cluster', 'k8s', 'remote', 'rdp', 'vnc',
    ],
  },
  {
    key: 'utilities',
    label: 'Utilities',
    apps: [
      'it-tools', 'ittools', 'omni-tools', 'cyberchef', 'stirling-pdf', 'stirlingpdf', 'bentopdf',
      'convertx', 'gotenberg', 'privatebin', 'microbin', 'opengist', 'hastebin', 'pastebin',
      'searxng', 'whoogle', '4get', 'changedetection', 'changedetection-io', 'libretranslate',
      'languagetool', 'linkstack', 'littlelink', 'shlink', 'yourls', 'kutt', 'qr-code',
      'homer', 'heimdall', 'homarr', 'flame', 'dashy', 'fenrus', 'homepage', 'glance', 'organizr', 'mafl',
      'octoprint', 'mainsail', 'fluidd', 'klipper', 'obico', 'spoolman',
    ],
    keywords: [
      'tools', 'utils', 'utilities', 'pdf', 'paste', 'pastebin', 'shortener', 'search', 'convert',
      'converter', 'translate', 'dashboard', 'startpage', 'qr', '3dprint', 'printer',
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    apps: [
      'discord', 'slack', 'mattermost', 'rocket-chat', 'rocketchat', 'matrix', 'synapse', 'dendrite',
      'conduit', 'conduwuit', 'tuwunel', 'element', 'cinny', 'revolt', 'zulip', 'mumble', 'teamspeak',
      'signal', 'telegram', 'whatsapp', 'jitsi', 'jitsi-meet', 'bigbluebutton',
      'mailcow', 'mailu', 'mail-in-a-box', 'postal', 'poste', 'iredmail', 'stalwart', 'docker-mailserver',
      'roundcube', 'rainloop', 'snappymail', 'sogo', 'gmail', 'outlook', 'proton-mail', 'protonmail',
      'ntfy', 'gotify', 'apprise', 'pushover',
      'mastodon', 'gotosocial', 'misskey', 'pleroma', 'akkoma', 'lemmy', 'pixelfed', 'bluesky',
      'discourse', 'flarum', 'nodebb', 'thelounge', 'convos', 'prosody', 'ejabberd',
    ],
    keywords: [
      'mail', 'email', 'webmail', 'chat', 'forum', 'notify', 'notifications', 'push', 'sms', 'social',
      'irc', 'xmpp', 'voice', 'meet', 'messages', 'messaging',
    ],
  },
  {
    key: 'gaming',
    label: 'Gaming',
    apps: [
      'minecraft', 'crafty', 'crafty-controller', 'pterodactyl', 'pelican', 'amp', 'cubecoders-amp',
      'gameserver', 'linuxgsm', 'steam', 'steam-headless', 'valheim', 'terraria', 'factorio', 'satisfactory',
      'palworld', 'enshrouded', 'romm', 'gaseous', 'emulatorjs', 'retroarch', 'lancache', 'sunshine',
      'moonlight', 'gamevault', 'playnite', 'games-on-whales', 'pufferpanel',
    ],
    keywords: ['game', 'games', 'gaming', 'gameservers', 'emulator', 'emulation', 'retro', 'roms'],
  },
  {
    key: 'food',
    label: 'Food & Recipes',
    apps: [
      'mealie', 'tandoor', 'tandoor-recipes', 'grocy', 'kitchenowl', 'recipesage', 'bar-assistant',
      'nextcloud-cookbook', 'chowdown', 'norish',
    ],
    keywords: [
      'recipes', 'recipe', 'cookbook', 'groceries', 'grocery', 'meals', 'mealplan', 'kitchen', 'food',
      'shopping', 'pantry',
    ],
  },
  {
    key: 'ai',
    label: 'AI',
    apps: [
      'ollama', 'open-webui', 'openwebui', 'librechat', 'lobe-chat', 'lobechat', 'anythingllm', 'localai',
      'comfyui', 'comfy-ui', 'automatic1111', 'stable-diffusion', 'fooocus', 'invokeai',
      'text-generation-webui', 'oobabooga', 'koboldcpp', 'sillytavern', 'flowise', 'langflow', 'dify',
      'perplexica', 'khoj', 'privategpt', 'chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'copilot',
      'whisper', 'faster-whisper', 'vllm', 'litellm', 'lm-studio', 'morphic',
    ],
    keywords: ['ai', 'llm', 'llms', 'gpt', 'chatbot', 'llama', 'diffusion', 'genai'],
  },
]

/**
 * Shorthand names people use for hostnames, mapped to the canonical app.
 * Only unambiguous abbreviations belong here.
 */
export const APP_ABBREVIATIONS = {
  ha: 'home-assistant',
  hass: 'home-assistant',
  hassio: 'home-assistant',
  npm: 'nginx-proxy-manager',
  nginxpm: 'nginx-proxy-manager',
  npmplus: 'nginx-proxy-manager',
  qbit: 'qbittorrent',
  qbt: 'qbittorrent',
  jf: 'jellyfin',
  abs: 'audiobookshelf',
  z2m: 'zigbee2mqtt',
  zwavejs: 'zwave-js-ui',
  pve: 'proxmox',
  pbs: 'proxmox-backup-server',
  omv: 'openmediavault',
  kuma: 'uptime-kuma',
  paperless: 'paperless-ngx',
  dsm: 'synology-dsm',
  sab: 'sabnzbd',
  vw: 'vaultwarden',
  bw: 'bitwarden',
  pihole: 'pi-hole',
  adguard: 'adguard-home',
  agh: 'adguard-home',
  wud: 'whats-up-docker',
  tandoor: 'tandoor-recipes',
  actual: 'actual-budget',
  owui: 'open-webui',
  openwebui: 'open-webui',
  nc: 'nextcloud',
  prom: 'prometheus',
  hoarder: 'karakeep',
  ttrss: 'tiny-tiny-rss',
  ittools: 'it-tools',
  stirling: 'stirling-pdf',
  guac: 'guacamole',
  crafty: 'crafty-controller',
  ombi: 'ombi',
  mqtt: 'mosquitto',
}

/**
 * Icon metadata categories (homarr-labs/dashboard-icons) mapped to built-in
 * keys. Used as the weakest signal, and to fold the many inconsistent
 * auto-created categories of older versions into the built-in ones.
 */
export const EXTERNAL_CATEGORY_MAP = {
  'tools': 'utilities',
  'utility': 'utilities',
  'web-browsers': 'utilities',
  'search-engines': 'utilities',
  'search': 'utilities',
  'developer-tools': 'development',
  'development': 'development',
  'version-control-systems': 'development',
  'programming-languages': 'development',
  'database': 'development',
  'databases': 'development',
  'devops': 'development',
  'media': 'media',
  'media-servers': 'media',
  'entertainment': 'media',
  'anime': 'media',
  'music': 'media',
  'music-streaming': 'media',
  'video': 'media',
  'video-streaming': 'media',
  'streaming': 'media',
  'cloud': 'infrastructure',
  'cloud-computing': 'infrastructure',
  'hardware': 'infrastructure',
  'server-panels': 'infrastructure',
  'operating-systems': 'infrastructure',
  'linux-distributions': 'infrastructure',
  'containerization-&-orchestration': 'infrastructure',
  'infrastructure': 'infrastructure',
  'network': 'network',
  'networking': 'network',
  'networking-tools': 'network',
  'vpn': 'network',
  'automation': 'automation',
  'workflow-automation': 'automation',
  'monitoring': 'monitoring',
  'monitoring-tools': 'monitoring',
  'logging-metrics': 'monitoring',
  'analytics': 'monitoring',
  'security': 'security',
  'password-managers': 'security',
  'storage': 'files',
  'file': 'files',
  'file-sharing-&-sync': 'files',
  'backup-and-storage': 'files',
  'communication': 'communication',
  'social': 'communication',
  'social-media': 'communication',
  'email-providers': 'communication',
  'office-suites': 'productivity',
  'note-taking-apps': 'productivity',
  'organization': 'productivity',
  'productivity': 'productivity',
  'collaboration': 'productivity',
  'wiki': 'productivity',
  'design': 'productivity',
  'graphics-editors': 'productivity',
  'education': 'productivity',
  'home-automation': 'home',
  'smart-home': 'home',
  'finance': 'finance',
  'finance-&-banking': 'finance',
  'gaming': 'gaming',
  'gaming-platforms': 'gaming',
  'download-managers': 'downloads',
  'ai-&-llm-platforms': 'ai',
  'ai': 'ai',
  'food-recipe': 'food',
  'photos': 'photos',
  'system-management': 'infrastructure',
  'dashboards': 'utilities',
}

export const BUILTIN_BY_KEY = new Map(BUILTIN_CATEGORIES.map(c => [c.key, c]))

const plain = str => str.toLowerCase().replace(/[^a-z0-9]/g, '')

// App names that are also ordinary words. They only count when they are the
// entire name ("Element"), not one word among several ("Garage Door").
export const AMBIGUOUS_NAMES = new Set([
  'actual', 'amp', 'box', 'coder', 'cosmos', 'dim', 'drone', 'element', 'flame', 'flood', 'garage',
  'glance', 'homepage', 'hue', 'lens', 'mango', 'matrix', 'maybe', 'mega', 'memories', 'nut', 'outline',
  'plane', 'postal', 'poste', 'pulse', 'registry', 'semaphore', 'seq', 'signal', 'swag', 'checkmate',
  'ente', 'jupyter', 'nexus', 'theia', 'vouch', 'qui', 'crafty', 'mqtt', 'nc', 'code', 'vault', 'git',
  'status', 'jan', 'max', 'sure', 'wolf', 'pocket', 'portal', 'bridge', 'door', 'map', 'call',
].map(plain))

// Generic words (category keywords) describe what a service does, not which
// app it is, so they never take part in fuzzy or alias icon matching
export const GENERIC_WORDS = new Set([
  ...BUILTIN_CATEGORIES.flatMap(c => c.keywords),
  'uptime', 'home', 'dashboard', 'server', 'admin', 'portal', 'app',
].map(plain))

/**
 * Map a category name from an older version or from icon metadata to a
 * built-in key, e.g. "Download-Managers" -> "downloads".
 */
export function builtinKeyForName(name) {
  if (typeof name !== 'string') return null
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-')
  if (BUILTIN_BY_KEY.has(slug)) return slug
  if (EXTERNAL_CATEGORY_MAP[slug]) return EXTERNAL_CATEGORY_MAP[slug]
  const plain = slug.replace(/[^a-z0-9]/g, '')
  for (const category of BUILTIN_CATEGORIES) {
    if (category.label.toLowerCase().replace(/[^a-z0-9]/g, '') === plain) return category.key
  }
  return null
}
