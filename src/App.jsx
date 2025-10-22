import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import ServicesGrid from './components/ServicesGrid'
import Sidebar from './components/Sidebar'
import './App.css'

function App() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [baseUrl, setBaseUrl] = useState(null)
  const [npmEnabled, setNpmEnabled] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [customName, setCustomName] = useState('Services Dashboard')
  const [customIcon, setCustomIcon] = useState(null)
  const [configuredCategories, setConfiguredCategories] = useState([])

  // Load branding from API
  useEffect(() => {
    async function loadBranding() {
      try {
        const response = await fetch('/api/branding')
        if (response.ok) {
          const branding = await response.json()
          setCustomName(branding.customName || 'Services Dashboard')
          setCustomIcon(branding.customIcon)
          // Update page title
          document.title = branding.customName || 'Services Dashboard'
        }
      } catch (error) {
        // Silently fail - will use defaults
      }
    }
    loadBranding()
  }, [])

  // Load configuration from API
  useEffect(() => {
    async function loadConfiguration() {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()

          if (config.baseUrl) {
            setBaseUrl(config.baseUrl)
          }

          // Check if NPM is enabled (server-side)
          if (config.npmEnabled) {
            setNpmEnabled(true)
          }
        }
      } catch (error) {
        // Silently fail - will use defaults
      } finally {
        setConfigLoaded(true)
      }
    }

    loadConfiguration()
  }, [])

  // Load configured categories from public API
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch('/api/public/categories')
        if (response.ok) {
          const categories = await response.json()
          setConfiguredCategories(categories)
        }
      } catch (error) {
        // Silently fail - will auto-detect from services
      }
    }
    loadCategories()
  }, [])

  // Load services using public API
  useEffect(() => {
    // Wait for configuration to be loaded
    if (!configLoaded) return

    async function loadServices() {
      try {
        // Use the new public API endpoint
        const response = await fetch('/api/public/services')
        if (!response.ok) {
          throw new Error('Failed to load services from API')
        }

        const servicesData = await response.json()

        if (!Array.isArray(servicesData) || servicesData.length === 0) {
          throw new Error('No services configured. Visit the admin panel at port 3001 to add services or configure NPM integration.')
        }

        // Services already come with categories and baseUrl applied from server
        setServices(servicesData)
        setLoading(false)
      } catch (error) {
        console.error('Error loading services:', error)
        setError(error.message)
        setLoading(false)
      }
    }

    loadServices()
  }, [configLoaded, npmEnabled])

  const handleSearch = useCallback((term) => {
    setSearchTerm(term)
  }, [])

  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category)
  }, [])

  const handleMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev)
  }, [])

  const handleMenuClose = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  // Calculate category counts using configured categories with display names
  const categories = useMemo(() => {
    const counts = { all: services.length }
    const displayNames = { all: 'All Services' }

    // Build a map of category name to display name from configured categories
    const categoryDisplayMap = {}
    configuredCategories.forEach(cat => {
      categoryDisplayMap[cat.name] = cat.displayName
    })

    // First pass: Count all categories
    services.forEach(service => {
      if (service.categories && Array.isArray(service.categories) && service.categories.length > 0) {
        service.categories.forEach(category => {
          counts[category] = (counts[category] || 0) + 1
          // Use configured display name if available, otherwise use the category name
          displayNames[category] = categoryDisplayMap[category] || category
        })
      } else {
        // Services with no categories count towards "Other"
        counts.Other = (counts.Other || 0) + 1
        displayNames.Other = 'Other'
      }
    })

    // Second pass: Filter out single-entry categories
    // BUT keep them if they're the only category for at least one service
    const filteredCounts = { all: counts.all }
    const filteredDisplayNames = { all: displayNames.all }

    Object.entries(counts).forEach(([category, count]) => {
      if (category === 'all') return

      // If category has more than 1 service, always include it
      if (count > 1) {
        filteredCounts[category] = count
        filteredDisplayNames[category] = displayNames[category]
        return
      }

      // If category has only 1 service, check if that service has other categories
      const serviceWithThisCategory = services.find(service =>
        service.categories && service.categories.includes(category)
      )

      if (serviceWithThisCategory && serviceWithThisCategory.categories.length === 1) {
        // This is the only category for this service, so keep it
        filteredCounts[category] = count
        filteredDisplayNames[category] = displayNames[category]
      }
      // Otherwise, skip this single-entry category
    })

    // No limit on categories - controlled via admin panel visibility settings
    return { counts: filteredCounts, displayNames: filteredDisplayNames }
  }, [services, configuredCategories])

  // Filter and sort services based on search term and category
  const filteredServices = useMemo(() => {
    let result = [...services]

    // Filter by category (services can be in multiple categories)
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Other') {
        // For "Other", show services that have "Other" as an explicit category
        // OR services that have no categories at all
        result = result.filter(service =>
          (service.categories &&
           Array.isArray(service.categories) &&
           service.categories.includes('Other')) ||
          !service.categories ||
          !Array.isArray(service.categories) ||
          service.categories.length === 0
        )
      } else {
        result = result.filter(service =>
          service.categories &&
          Array.isArray(service.categories) &&
          service.categories.includes(selectedCategory)
        )
      }
    }

    // Sort alphabetically by name
    result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    // Filter if search term exists
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      result = result.filter(service => {
        const nameMatch = service.name.toLowerCase().includes(lowerSearchTerm)
        const urlMatch = service.url?.toLowerCase().includes(lowerSearchTerm)
        return nameMatch || urlMatch
      })
    }

    return result
  }, [services, searchTerm, selectedCategory, categories])

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading services...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <h1>Quick Access Dashboard</h1>
        <div className="error">
          <h2>Failed to load services</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
        customName={customName}
        customIcon={customIcon}
      />
      <div className="main-content">
        <div className="container">
          <Header
            selectedCategory={selectedCategory}
            onMenuToggle={handleMenuToggle}
            searchBar={
              services.length > 0 ? (
                <SearchBar
                  onSearch={handleSearch}
                  totalServices={services.length}
                  filteredCount={filteredServices.length}
                  filteredServices={filteredServices}
                  baseUrl={baseUrl}
                />
              ) : null
            }
          />
          <ServicesGrid
            services={filteredServices}
            baseUrl={baseUrl}
          />
        </div>
      </div>
    </div>
  )
}

export default App
