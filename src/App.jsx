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
    preloadIconsMetadata().catch(() => {
      // Silently fail - icons will fall back to initials
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
            }
          }
        } catch (err) {
          // Silently fail - services.json is optional
        }

        // Fetch NPM services only if NPM is enabled on the server
        if (npmEnabled) {
          npmServices = await fetchNPMServices()
        }

        // Merge manual and NPM services (manual takes priority on URL conflicts)
        const mergedServices = await mergeServices(manualServices, npmServices, baseUrl)

        if (mergedServices.length === 0) {
          throw new Error('No services configured. Visit the admin panel at port 3001 to add services or configure NPM integration.')
        }

        // Auto-categorize all services (now returns array of categories)
        const categorizedServices = mergedServices.map(service => ({
          ...service,
          categories: categorizeService(service)
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

  // Calculate category counts (services can be in multiple categories)
  const categories = useMemo(() => {
    const counts = { all: services.length }

    // First pass: Count all categories
    services.forEach(service => {
      if (service.categories && Array.isArray(service.categories)) {
        service.categories.forEach(category => {
          counts[category] = (counts[category] || 0) + 1
        })
      }
    })

    // Second pass: Filter out single-entry categories
    // BUT keep them if they're the only category for at least one service
    const filteredCounts = { all: counts.all }

    Object.entries(counts).forEach(([category, count]) => {
      if (category === 'all') return

      // If category has more than 1 service, always include it
      if (count > 1) {
        filteredCounts[category] = count
        return
      }

      // If category has only 1 service, check if that service has other categories
      const serviceWithThisCategory = services.find(service =>
        service.categories && service.categories.includes(category)
      )

      if (serviceWithThisCategory && serviceWithThisCategory.categories.length === 1) {
        // This is the only category for this service, so keep it
        filteredCounts[category] = count
      }
      // Otherwise, skip this single-entry category
    })

    // Third pass: Limit to 10 categories max (excluding "all")
    // Show 9 regular categories + "Other" = 10 total displayed categories
    const MAX_DISPLAYED_CATEGORIES = 10
    const MAX_REGULAR_CATEGORIES = MAX_DISPLAYED_CATEGORIES - 1 // Reserve 1 slot for "Other"
    const categoriesWithoutAll = Object.entries(filteredCounts)
      .filter(([key]) => key !== 'all' && key !== 'Other')
      .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending

    if (categoriesWithoutAll.length > MAX_REGULAR_CATEGORIES) {
      // Keep top 9 categories, move rest to "Other"
      const topCategories = categoriesWithoutAll.slice(0, MAX_REGULAR_CATEGORIES)
      const otherCategories = categoriesWithoutAll.slice(MAX_REGULAR_CATEGORIES)

      const finalCounts = { all: filteredCounts.all }

      // Add top categories
      topCategories.forEach(([category, count]) => {
        finalCounts[category] = count
      })

      // Combine remaining categories into "Other"
      const otherCount = otherCategories.reduce((sum, [, count]) => sum + count, 0)
      if (otherCount > 0 || filteredCounts.Other) {
        finalCounts.Other = (filteredCounts.Other || 0) + otherCount
      }

      return finalCounts
    }

    return filteredCounts
  }, [services])

  // Filter and sort services based on search term and category
  const filteredServices = useMemo(() => {
    let result = [...services]

    // Filter by category (services can be in multiple categories)
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Other') {
        // For "Other", only show services that have NO categories in the displayed categories
        // (i.e., all their categories are hidden)
        const displayedCategories = Object.keys(categories).filter(cat => cat !== 'all' && cat !== 'Other')
        result = result.filter(service => {
          if (!service.categories || !Array.isArray(service.categories)) return false

          // Only include if service has "Other" as explicit category
          // OR if NONE of its categories are in the displayed list
          return service.categories.includes('Other') ||
                 !service.categories.some(cat => displayedCategories.includes(cat))
        })
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
