import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import ServicesGrid from './components/ServicesGrid'
import Sidebar from './components/Sidebar'
import './App.css'

const ALL = 'all'
const UNCATEGORIZED = 'uncategorized'
const DEFAULT_NAME = 'Services Dashboard'

function matchesSearch(service, term) {
  return [service.name, service.description, service.href, ...(service.categories || [])]
    .some(value => value && value.toLowerCase().includes(term))
}

function App() {
  const [data, setData] = useState({ branding: null, categories: [], services: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(ALL)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch('/api/public/dashboard')
        if (!response.ok) throw new Error(`Server returned ${response.status}`)
        const dashboard = await response.json()
        setData(dashboard)
        document.title = dashboard.branding?.customName || DEFAULT_NAME
      } catch (err) {
        console.error('Error loading services:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const { services, categories, branding } = data

  // Sidebar entries: all, every category with services, then uncategorized
  const navigation = useMemo(() => {
    const uncategorized = services.filter(s => s.categoryIds.length === 0).length
    return [
      { id: ALL, name: 'All Services', count: services.length },
      ...categories.map(c => ({ id: c.id, name: c.name, count: c.serviceCount })),
      ...(uncategorized > 0 && categories.length > 0
        ? [{ id: UNCATEGORIZED, name: 'Other', count: uncategorized }]
        : []),
    ]
  }, [services, categories])

  // Fall back to all services if the selected category no longer exists
  const activeCategory = navigation.some(item => item.id === selectedCategory) ? selectedCategory : ALL
  const activeLabel = navigation.find(item => item.id === activeCategory)?.name || 'All Services'

  const filteredServices = useMemo(() => {
    let result = services
    if (activeCategory === UNCATEGORIZED) {
      result = result.filter(s => s.categoryIds.length === 0)
    } else if (activeCategory !== ALL) {
      result = result.filter(s => s.categoryIds.includes(activeCategory))
    }

    const term = searchTerm.trim().toLowerCase()
    if (term) result = result.filter(s => matchesSearch(s, term))

    return [...result].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [services, activeCategory, searchTerm])

  const handleCategorySelect = useCallback((category) => setSelectedCategory(category), [])
  const handleMenuToggle = useCallback(() => setIsMobileMenuOpen(prev => !prev), [])
  const handleMenuClose = useCallback(() => setIsMobileMenuOpen(false), [])

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
        items={navigation}
        selectedCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
        customName={branding?.customName || DEFAULT_NAME}
        customIcon={branding?.customIcon}
      />
      <div className="main-content">
        <div className="container">
          <Header
            title={activeLabel}
            onMenuToggle={handleMenuToggle}
            searchBar={
              services.length > 0 ? (
                <SearchBar
                  onSearch={setSearchTerm}
                  totalServices={services.length}
                  filteredServices={filteredServices}
                />
              ) : null
            }
          />
          {services.length === 0 ? (
            <div className="no-results">
              <h3>No services yet</h3>
              <p>Add services or connect Nginx Proxy Manager in the admin panel (port 3001).</p>
            </div>
          ) : (
            <ServicesGrid services={filteredServices} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
