import { useState, useEffect, useMemo } from 'react'

const RESULT_LIMIT = 120

// Shared between all forms, the list only changes when the server restarts
let iconsPromise = null
function loadIcons() {
  if (!iconsPromise) {
    iconsPromise = fetch('/api/icons')
      .then(response => (response.ok ? response.json() : []))
      .catch(() => [])
      .then(icons => {
        if (icons.length === 0) iconsPromise = null
        return icons
      })
  }
  return iconsPromise
}

function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isCustomUrl(value) {
  return /^https?:\/\//i.test(value) || value.startsWith('/uploads/')
}

/**
 * Rank icons for a search term: exact name, then prefix, then contains,
 * then title/alias matches. Dashboard icons first on ties (they are coloured).
 */
function rankIcons(icons, term) {
  const query = normalize(term)
  if (!query) return icons
  const ranked = []
  for (const icon of icons) {
    const name = normalize(icon.name.replace(/^si:/, ''))
    const title = normalize(icon.title)
    let score = 0
    if (name === query || title === query) score = 100
    else if (name.startsWith(query) || title.startsWith(query)) score = 80 - Math.min(name.length - query.length, 30) / 2
    else if (name.includes(query) || title.includes(query)) score = 50
    else if (icon.aliases?.some(alias => normalize(alias).includes(query))) score = 30
    else if (icon.categories?.some(cat => normalize(cat).includes(query))) score = 10
    if (score > 0) ranked.push({ icon, score: score + (icon.source === 'dashboard-icons' ? 1 : 0) })
  }
  return ranked.sort((a, b) => b.score - a.score).map(r => r.icon)
}

function prettyCategory(category) {
  return category.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

function IconAutocomplete({ value, onChange, placeholder, autoIcon }) {
  const [icons, setIcons] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSource, setSelectedSource] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [resolvedPreview, setResolvedPreview] = useState(null)

  useEffect(() => {
    loadIcons().then(setIcons)
  }, [])

  const byName = useMemo(() => new Map(icons.map(icon => [icon.name, icon])), [icons])

  // Preview for the current value: from the list, a custom URL, or the
  // server's fuzzy resolution ("Home Assistant" -> home-assistant)
  const listedPreview = value ? byName.get(value)?.url || (isCustomUrl(value) ? value : null) : null
  useEffect(() => {
    setResolvedPreview(null)
    if (!value || listedPreview) return
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/icons/preview/${encodeURIComponent(value)}`)
        if (response.ok) setResolvedPreview((await response.json()).url)
      } catch {
        // No preview
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [value, listedPreview])
  const previewUrl = value ? listedPreview || resolvedPreview : autoIcon?.url

  // Icon metadata uses inconsistent category spellings ("media", "Media")
  const categories = useMemo(() => {
    const counts = new Map()
    for (const icon of icons) {
      for (const category of icon.categories || []) {
        const key = category.toLowerCase()
        const entry = counts.get(key) || { key, label: prettyCategory(category), count: 0 }
        entry.count++
        counts.set(key, entry)
      }
    }
    return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [icons])

  const filteredIcons = useMemo(() => {
    let filtered = icons
    if (selectedSource !== 'all') filtered = filtered.filter(icon => icon.source === selectedSource)
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(icon => icon.categories?.some(cat => cat.toLowerCase() === selectedCategory))
    }
    return rankIcons(filtered, searchTerm)
  }, [icons, searchTerm, selectedCategory, selectedSource])

  function handleSelectIcon(iconName) {
    onChange(iconName)
    setShowModal(false)
  }

  function openModal() {
    setShowModal(true)
    setSearchTerm(value && !isCustomUrl(value) ? value.replace(/^si:/, '') : '')
    setSelectedCategory('all')
    setSelectedSource('all')
  }

  const sourceCount = source => icons.filter(i => i.source === source).length

  return (
    <>
      <div className="icon-autocomplete">
        <div className="icon-input-group">
          <div className="icon-input-wrapper">
            {previewUrl && (
              <img
                key={previewUrl}
                src={previewUrl}
                alt=""
                className={`icon-preview-input ${value ? '' : 'icon-preview-auto'}`}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={autoIcon?.name ? `Auto: ${autoIcon.name}` : placeholder}
              className={previewUrl ? 'has-icon' : ''}
            />
          </div>
          <button type="button" onClick={openModal} className="btn-browse-icons" title="Browse icons">
            Browse
          </button>
        </div>
      </div>

      {showModal && (
        <div className="icon-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="icon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="icon-modal-header">
              <h3>Choose an Icon</h3>
              <button type="button" onClick={() => setShowModal(false)} className="icon-modal-close" aria-label="Close">×</button>
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
                <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="icon-source-select">
                  <option value="all">All Sources ({icons.length})</option>
                  <option value="dashboard-icons">Dashboard Icons ({sourceCount('dashboard-icons')})</option>
                  <option value="simple-icons">Simple Icons ({sourceCount('simple-icons')})</option>
                </select>
              </div>

              <div className="icon-filter-group">
                <label>Category:</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="icon-category-select">
                  <option value="all">All</option>
                  {categories.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label} ({cat.count})</option>
                  ))}
                </select>
              </div>

              <div className="icon-view-toggle">
                <button type="button" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'active' : ''} title="Grid view">⊞</button>
                <button type="button" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''} title="List view">☰</button>
              </div>
            </div>

            <div className="icon-modal-body">
              <div className="icon-results-info">
                {filteredIcons.length > RESULT_LIMIT
                  ? `Showing ${RESULT_LIMIT} of ${filteredIcons.length} icons, refine your search to see more`
                  : `Showing ${filteredIcons.length} icon${filteredIcons.length !== 1 ? 's' : ''}`}
              </div>

              {icons.length === 0 ? (
                <div className="no-icons-found"><p>Loading icons...</p></div>
              ) : filteredIcons.length === 0 ? (
                <div className="no-icons-found"><p>No icons found matching your search.</p></div>
              ) : (
                <div className={`icon-grid ${viewMode}`}>
                  {filteredIcons.slice(0, RESULT_LIMIT).map(icon => (
                    <button
                      type="button"
                      key={icon.name}
                      className={`icon-grid-item ${icon.name === value ? 'selected' : ''}`}
                      onClick={() => handleSelectIcon(icon.name)}
                      title={icon.title ? `${icon.title} (${icon.name})` : icon.name}
                    >
                      <div className="icon-grid-preview">
                        <img
                          src={icon.url}
                          alt=""
                          loading="lazy"
                          className="icon-grid-img"
                          onError={(e) => { e.target.style.visibility = 'hidden' }}
                        />
                      </div>
                      {viewMode === 'list' && (
                        <div className="icon-grid-info">
                          <div className="icon-grid-name">
                            {icon.title || icon.name}
                            <span className="icon-source-badge">{icon.source === 'simple-icons' ? 'SI' : 'DI'}</span>
                          </div>
                          <div className="icon-grid-slug">{icon.name}</div>
                          {icon.categories?.length > 0 && (
                            <div className="icon-grid-categories">{icon.categories.slice(0, 2).join(', ')}</div>
                          )}
                        </div>
                      )}
                    </button>
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
