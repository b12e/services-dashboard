import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import ServicesGrid from './components/ServicesGrid'
import Sidebar from './components/Sidebar'
import { categorizeService } from './utils/categorize'
import { fetchNPMServices, mergeServices } from './services/npmService'
import { preloadIconsMetadata } from './services/iconService'
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

  // Preload icons metadata on app start
  useEffect(() => {
    preloadIconsMetadata().catch(err => {
      console.error('Failed to preload icons metadata:', err)
    })
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
            console.log('Base URL set from config:', config.baseUrl)
          }

          // Check if NPM is enabled (server-side)
          if (config.npmEnabled) {
            setNpmEnabled(true)
            console.log('NPM integration enabled')
          } else {
            console.log('NPM integration not configured or disabled')
          }
        } else {
          console.log('Failed to load configuration from API')
        }
      } catch (error) {
        console.log('Error loading configuration:', error)
      } finally {
        setConfigLoaded(true)
      }
    }

    loadConfiguration()
  }, [])

  // Load services (both manual and NPM auto-detected)
  useEffect(() => {
    // Wait for configuration to be loaded
    if (!configLoaded) return

    async function loadServices() {
      try {
        let manualServices = []
        let npmServices = []

        // Always try to load manual services from services.json
        try {
          const response = await fetch('/services.json')
          if (response.ok) {
            const data = await response.json()
            if (data.services && Array.isArray(data.services)) {
              manualServices = data.services
              console.log(`Loaded ${manualServices.length} manual services from services.json`)
            } else {
              console.warn('services.json has invalid structure, expected { services: [...] }')
            }
          } else {
            console.log('No services.json found (this is OK if using NPM auto-detection)')
          }
        } catch (err) {
          console.log('services.json not available or invalid:', err.message)
        }

        // Fetch NPM services only if NPM is enabled on the server
        if (npmEnabled) {
          console.log('Fetching services from NPM...')
          npmServices = await fetchNPMServices()
          console.log(`Loaded ${npmServices.length} services from NPM`)
        } else {
          console.log('NPM auto-detection disabled')
        }

        // Merge manual and NPM services (manual takes priority on URL conflicts)
        const mergedServices = mergeServices(manualServices, npmServices)
        console.log(`Total services after merge: ${mergedServices.length}`)

        if (mergedServices.length === 0) {
          throw new Error('No services found. Please configure services.json or NPM integration.')
        }

        // Auto-categorize all services
        const categorizedServices = mergedServices.map(service => ({
          ...service,
          category: categorizeService(service)
        }))

        setServices(categorizedServices)
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

  // Calculate category counts
  const categories = useMemo(() => {
    const counts = { all: services.length }
    services.forEach(service => {
      // categorizeService is already applied during loading, so service.category will always exist
      const category = service.category
      counts[category] = (counts[category] || 0) + 1
    })
    return counts
  }, [services])

  // Filter and sort services based on search term and category
  const filteredServices = useMemo(() => {
    let result = [...services]

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(service => service.category === selectedCategory)
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
  }, [services, searchTerm, selectedCategory])

  if (loading) {
    return (
      <div className="container">
        <h1>Quick Access Dashboard</h1>
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
          <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Make sure services.json is in the public directory.
          </p>
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
