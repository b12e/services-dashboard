let BASE_URL = null; // Changed default to null
let urlsVisible = true;
let defaultUrlsVisible = null; // Will be set from config

// Load configuration
async function loadConfiguration() {
    try {
        const response = await fetch('configuration.json');
        if (response.ok) {
            const config = await response.json();
            
            // Set base URL from config if provided
            if (config.baseUrl) {
                BASE_URL = config.baseUrl;
                console.log('Base URL set from config:', BASE_URL);
            }
            
            // Set default URL visibility from config if provided
            if (typeof config.showUrlsByDefault === 'boolean') {
                defaultUrlsVisible = config.showUrlsByDefault;
                console.log('Default URL visibility set from config:', defaultUrlsVisible);
            }
        } else {
            console.log('No configuration.json found, using defaults');
        }
    } catch (error) {
        console.log('Error loading configuration, using defaults:', error);
    }
}

// Initialize URL visibility based on stored preference, config, or device type
function initializeUrlVisibility() {
    const stored = localStorage.getItem('urlsVisible');
    if (stored !== null) {
        // Use stored preference if it exists
        urlsVisible = stored === 'true';
    } else if (defaultUrlsVisible !== null) {
        // Use config default if no stored preference
        urlsVisible = defaultUrlsVisible;
    } else {
        // Fall back to device-based default
        urlsVisible = window.innerWidth > 768;
    }
    updateUrlVisibility();
}

// Toggle URL visibility
function toggleUrls() {
    urlsVisible = !urlsVisible;
    localStorage.setItem('urlsVisible', urlsVisible);
    updateUrlVisibility();
}

// Update UI based on URL visibility state
function updateUrlVisibility() {
    const container = document.getElementById('services-container');
    const toggleText = document.getElementById('toggle-text');
    
    if (urlsVisible) {
        container.classList.remove('hide-urls');
        toggleText.textContent = 'Hide URLs';
    } else {
        container.classList.add('hide-urls');
        toggleText.textContent = 'Show URLs';
    }
}

async function loadServices() {
    const container = document.getElementById('services-container');
    
    try {
        const response = await fetch('services.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.services || !Array.isArray(data.services)) {
            throw new Error('Invalid services data structure');
        }
        
        displayServices(data.services);
        
    } catch (error) {
        console.error('Error loading services:', error);
        container.className = 'error';
        container.innerHTML = `
            <h2>Failed to load services</h2>
            <p>${error.message}</p>
            <p style="font-size: 0.875rem; margin-top: 1rem;">Make sure services.json is in the same directory as this HTML file.</p>
        `;
    }
}

// Validate and normalize URL
function validateAndNormalizeUrl(urlString, shouldAppendBase, baseUrl) {
    try {
        let finalUrl;
        
        if (shouldAppendBase && baseUrl) {
            // Traditional behavior with base domain
            finalUrl = urlString 
                ? `https://${urlString}.${baseUrl}`
                : `https://${baseUrl}`;
        } else {
            // Standalone URL mode
            if (!urlString) {
                // No URL provided
                if (baseUrl) {
                    finalUrl = `https://${baseUrl}`;
                } else {
                    throw new Error('No URL provided');
                }
            } else {
                // Check if URL already has a protocol
                if (urlString.match(/^https?:\/\//)) {
                    finalUrl = urlString;
                } else {
                    finalUrl = `https://${urlString}`;
                }
            }
        }
        
        // Validate the URL by trying to construct a URL object
        const urlObj = new URL(finalUrl);
        return { valid: true, url: finalUrl };
    } catch (error) {
        return { valid: false, error: 'Invalid URL configuration' };
    }
}

function displayServices(services) {
    const container = document.getElementById('services-container');
    const headerControls = document.querySelector('.header-controls');
    container.className = 'services-grid';
    
    // Reapply hide-urls class if URLs should be hidden
    if (!urlsVisible) {
        container.classList.add('hide-urls');
    }
    
    if (services.length === 0) {
        container.innerHTML = '<div class="error">No services found in services.json</div>';
        return;
    }
    
    // Show the toggle button only when services are successfully loaded
    headerControls.classList.add('visible');
    
    container.innerHTML = services.map(service => {
        // Determine if we should append the base domain
        const shouldAppendBase = service.appendBaseDomain !== false; // Default to true if not specified
        
        // Validate and normalize the URL
        const urlResult = validateAndNormalizeUrl(service.url, shouldAppendBase, BASE_URL);
        
        // Get first letter(s) for fallback icon
        const iconText = service.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        // Use custom icon name if provided, otherwise generate from service name
        const iconName = service.icon || service.name.toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, ''); // Keep only letters, numbers, and hyphens

        const svgUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${iconName}.svg`;
        const pngUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${iconName}.png`;
        
        if (!urlResult.valid) {
            // Return error tile
            return `
                <div class="service-card error-card">
                    <div class="service-icon">
                        <span class="fallback-text">⚠️</span>
                    </div>
                    <div class="service-name">${service.name}</div>
                    <div class="error-message">${urlResult.error}</div>
                </div>
            `;
        }
        
        // Format display URL
        let displayUrl = urlResult.url.replace(/^https?:\/\//, '');
        
        // Add zero-width space for better wrapping
        if (shouldAppendBase && BASE_URL && service.url) {
            // Insert zero-width space before the dot after subdomain
            displayUrl = service.url + '\u200B.' + BASE_URL;
        } else {
            // Add zero-width space before the first dot for better wrapping
            const firstDotIndex = displayUrl.indexOf('.');
            if (firstDotIndex > 0 && firstDotIndex < displayUrl.length - 1) {
                displayUrl = displayUrl.substring(0, firstDotIndex) + '\u200B' + displayUrl.substring(firstDotIndex);
            }
        }
        
        return `
            <a href="${urlResult.url}" class="service-card" target="_blank" rel="noopener noreferrer">
                <div class="service-icon">
                    <img src="${svgUrl}" 
                         alt="${service.name} icon" 
                         onerror="this.onerror=null; this.src='${pngUrl}'; this.addEventListener('error', function() { this.style.display='none'; this.nextElementSibling.style.display='block'; });">
                    <span class="fallback-text" style="display: none;">${iconText}</span>
                </div>
                <div class="service-name">${service.name}</div>
                <div class="service-url">${displayUrl}</div>
            </a>
        `;
    }).join('');
    
    // Apply staggered animation delays to all cards
    const cards = container.querySelectorAll('.service-card');
    cards.forEach((card, index) => {
        // Cap the delay at a reasonable maximum to avoid too long animations
        const delay = Math.min(index * 0.05, 1.5); // 50ms per card, max 1.5s
        card.style.animationDelay = `${delay}s`;
        
        // Ensure links open in external browser when in PWA mode
        card.addEventListener('click', function(e) {
            // Check if running as PWA (standalone mode)
            if (window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone === true) {
                e.preventDefault();
                // Force open in Safari/external browser
                window.open(this.href, '_blank');
            }
        });
    });
    
    // Check for URL overflow and hide if cut off
    checkUrlOverflow();
}

// Check if URLs are being cut off and hide them if so
function checkUrlOverflow() {
    if (!urlsVisible) return; // Skip if URLs are already hidden
    
    const cards = document.querySelectorAll('.service-card');
    cards.forEach(card => {
        const urlElement = card.querySelector('.service-url');
        if (!urlElement) return;
        
        // Get the positions
        const cardRect = card.getBoundingClientRect();
        const urlRect = urlElement.getBoundingClientRect();
        
        // Check if URL is being cut off at the bottom of the card
        // Add 5px tolerance for padding/rounding
        if (urlRect.bottom > cardRect.bottom - 5) {
            urlElement.classList.add('hidden-overflow');
        } else {
            urlElement.classList.remove('hidden-overflow');
        }
    });
}

// Load services when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Load configuration first
    await loadConfiguration();
    
    // Then initialize UI and load services
    initializeUrlVisibility();
    loadServices();
    
    // Set up toggle button
    document.getElementById('url-toggle').addEventListener('click', toggleUrls);
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker registration failed', err));
    }
    
    // Check URL overflow on resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkUrlOverflow, 100);
    });
});