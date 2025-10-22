import { useState, useEffect, useRef } from 'react'

// Simple component to display icon preview
function IconPreview({ iconName, className = "icon-suggestion-preview" }) {
  const [iconUrl, setIconUrl] = useState(null)
  const [source, setSource] = useState(null)

  useEffect(() => {
    if (!iconName) return

    async function loadPreview() {
      try {
        const response = await fetch(`/api/icons/preview/${encodeURIComponent(iconName)}`)
        if (response.ok) {
          const data = await response.json()
          setIconUrl(data.url)
          setSource(data.source)
        }
      } catch (error) {
        console.error('Failed to load icon preview:', error)
      }
    }

    loadPreview()
  }, [iconName])

  if (!iconUrl) return null

  return (
    <img
      src={iconUrl}
      alt={iconName}
      className={className}
      data-source={source}
      onError={(e) => e.target.style.display = 'none'}
    />
  )
}

function IconAutocomplete({ value, onChange, placeholder }) {
  const [icons, setIcons] = useState([])
  const [inputValue, setInputValue] = useState(value || '')
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSource, setSelectedSource] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [categories, setCategories] = useState([])
  const [filteredIcons, setFilteredIcons] = useState([])
  const [iconPreviewUrl, setIconPreviewUrl] = useState(null)
  const [iconPreviewCache, setIconPreviewCache] = useState(new Map())
  const wrapperRef = useRef(null)

  useEffect(() => {
    loadIcons()
  }, [])

  useEffect(() => {
    setInputValue(value || '')
    if (value) {
      loadIconPreview(value)
    }
  }, [value])

  async function loadIconPreview(iconName) {
    if (!iconName) {
      setIconPreviewUrl(null)
      return
    }

    // Check cache first
    if (iconPreviewCache.has(iconName)) {
      setIconPreviewUrl(iconPreviewCache.get(iconName))
      return
    }

    try {
      const response = await fetch(`/api/icons/preview/${encodeURIComponent(iconName)}`)
      if (response.ok) {
        const data = await response.json()
        setIconPreviewUrl(data.url)
        setIconPreviewCache(new Map(iconPreviewCache).set(iconName, data.url))
      } else {
        setIconPreviewUrl(null)
      }
    } catch (error) {
      console.error('Failed to load icon preview:', error)
      setIconPreviewUrl(null)
    }
  }

  useEffect(() => {
    // Close suggestions when clicking outside
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadIcons() {
    try {
      // Use relative URL to avoid hardcoded localhost (prevents SSRF)
      const response = await fetch('/api/icons')
      if (response.ok) {
        const data = await response.json()
        setIcons(data)

        // Extract unique categories
        const allCategories = new Set()
        data.forEach(icon => {
          if (icon.categories && Array.isArray(icon.categories)) {
            icon.categories.forEach(cat => allCategories.add(cat))
          }
        })
        setCategories(Array.from(allCategories).sort())
      }
    } catch (error) {
      console.error('Failed to load icons:', error)
    }
  }

  // Filter icons based on search, category, and source
  useEffect(() => {
    let filtered = icons

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(icon => {
        return icon.name.toLowerCase().includes(search) ||
               (icon.title && icon.title.toLowerCase().includes(search)) ||
               (icon.aliases && icon.aliases.some(alias => alias.toLowerCase().includes(search))) ||
               (icon.categories && icon.categories.some(cat => cat.toLowerCase().includes(search)))
      })
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(icon =>
        icon.categories && icon.categories.includes(selectedCategory)
      )
    }

    // Filter by source
    if (selectedSource !== 'all') {
      filtered = filtered.filter(icon => icon.source === selectedSource)
    }

    setFilteredIcons(filtered.slice(0, 100)) // Limit to 100 for performance
  }, [icons, searchTerm, selectedCategory, selectedSource])

  function handleInputChange(e) {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    loadIconPreview(newValue)
  }

  function handleSelectIcon(iconName) {
    setInputValue(iconName)
    onChange(iconName)
    loadIconPreview(iconName)
    setShowModal(false)
  }

  function openModal() {
    setShowModal(true)
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedSource('all')
  }

  function closeModal() {
    setShowModal(false)
  }

  return (
    <>
      <div className="icon-autocomplete" ref={wrapperRef}>
        <div className="icon-input-group">
          <div className="icon-input-wrapper">
            {iconPreviewUrl && (
              <img
                src={iconPreviewUrl}
                alt=""
                className="icon-preview-input"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className={iconPreviewUrl ? 'has-icon' : ''}
            />
          </div>
          <button
            type="button"
            onClick={openModal}
            className="btn-browse-icons"
            title="Browse icons"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Icon Browser Modal */}
      {showModal && (
        <div className="icon-modal-overlay" onClick={closeModal}>
          <div className="icon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon-modal-header">
              <h3>Choose an Icon</h3>
              <button onClick={closeModal} className="icon-modal-close">×</button>
            </div>

            <div className="icon-modal-controls">
              <div className="icon-search-wrapper">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search icons..."
                  className="icon-search-input"
                  autoFocus
                />
              </div>

              <div className="icon-filter-group">
                <label>Source:</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="icon-source-select"
                >
                  <option value="all">All Sources ({icons.length})</option>
                  <option value="dashboard-icons">Dashboard Icons ({icons.filter(i => i.source === 'dashboard-icons').length})</option>
                  <option value="simple-icons">Simple Icons ({icons.filter(i => i.source === 'simple-icons').length})</option>
                </select>
              </div>

              <div className="icon-filter-group">
                <label>Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="icon-category-select"
                >
                  <option value="all">All ({icons.length})</option>
                  {categories.map(cat => {
                    const count = icons.filter(icon =>
                      icon.categories && icon.categories.includes(cat)
                    ).length
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="icon-view-toggle">
                <button
                  onClick={() => setViewMode('grid')}
                  className={viewMode === 'grid' ? 'active' : ''}
                  title="Grid view"
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'active' : ''}
                  title="List view"
                >
                  ☰
                </button>
              </div>
            </div>

            <div className="icon-modal-body">
              <div className="icon-results-info">
                Showing {filteredIcons.length} icon{filteredIcons.length !== 1 ? 's' : ''}
              </div>

              {filteredIcons.length === 0 ? (
                <div className="no-icons-found">
                  <p>No icons found matching your search.</p>
                </div>
              ) : (
                <div className={`icon-grid ${viewMode}`}>
                  {filteredIcons.map((icon, index) => (
                    <div
                      key={`${icon.source}-${icon.name}-${index}`}
                      className="icon-grid-item"
                      onClick={() => handleSelectIcon(icon.name)}
                      title={icon.name}
                    >
                      <div className="icon-grid-preview">
                        <IconPreview iconName={icon.name} className="icon-grid-img" />
                      </div>
                      {viewMode === 'list' && (
                        <div className="icon-grid-info">
                          <div className="icon-grid-name">
                            {icon.title || icon.name}
                            {icon.source && (
                              <span className="icon-source-badge">{icon.source === 'simple-icons' ? 'SI' : 'DI'}</span>
                            )}
                          </div>
                          <div className="icon-grid-slug">{icon.name}</div>
                          {icon.categories && icon.categories.length > 0 && (
                            <div className="icon-grid-categories">
                              {icon.categories.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default IconAutocomplete
