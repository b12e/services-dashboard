import { useState, useEffect } from 'react'
import IconAutocomplete from './IconAutocomplete'
import { fetchWithCsrf } from '../utils/csrf'

function ServicesManager() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('all') // all, manual, npm
  const [filterVisibility, setFilterVisibility] = useState('all') // all, visible, hidden
  const [sortBy, setSortBy] = useState('name') // name, source, categories, url
  const [sortOrder, setSortOrder] = useState('asc') // asc, desc
  const [baseUrl, setBaseUrl] = useState('') // Base domain from config
  const [allCategories, setAllCategories] = useState([]) // All categories from categories API

  // Handle column header click for sorting
  function handleSort(column) {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  useEffect(() => {
    loadServices()
    loadConfig()
    loadCategories()
  }, [])

  async function loadConfig() {
    try {
      const response = await fetch('/api/admin/config')
      if (response.ok) {
        const data = await response.json()
        setBaseUrl(data.baseUrl || '')
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/admin/categories')
      if (response.ok) {
        const categories = await response.json()
        // Filter to only visible categories, sorted by displayName
        const visibleCategories = categories
          .filter(cat => cat.visible !== false)
          .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
        setAllCategories(visibleCategories)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function loadServices() {
    try {
      const response = await fetch('/api/admin/services')
      const data = await response.json()
      setServices(data)
    } catch (error) {
      console.error('Failed to load services:', error)
      alert('Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(newService) {
    try {
      const response = await fetchWithCsrf('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService)
      })

      if (response.ok) {
        await loadServices()
        setShowAddForm(false)
      } else {
        alert('Failed to add service')
      }
    } catch (error) {
      console.error('Failed to add service:', error)
      alert('Failed to add service')
    }
  }

  async function handleUpdate(serviceId, updatedService) {
    try {
      const response = await fetchWithCsrf(`/api/admin/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedService)
      })

      if (response.ok) {
        await loadServices()
        setEditingIndex(null)
        setEditForm({})
      } else {
        alert('Failed to update service')
      }
    } catch (error) {
      console.error('Failed to update service:', error)
      alert('Failed to update service')
    }
  }

  async function handleDelete(serviceId, source) {
    const confirmMsg = source === 'npm'
      ? 'Are you sure you want to remove all customizations for this NPM service?'
      : 'Are you sure you want to delete this service?'

    if (!confirm(confirmMsg)) {
      return
    }

    try {
      const response = await fetchWithCsrf(`/api/admin/services/${serviceId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadServices()
      } else {
        alert('Failed to delete service')
      }
    } catch (error) {
      console.error('Failed to delete service:', error)
      alert('Failed to delete service')
    }
  }

  function startEdit(serviceId, service) {
    setEditingIndex(serviceId)
    setEditForm({ ...service })
  }

  function cancelEdit() {
    setEditingIndex(null)
    setEditForm({})
  }

  // Filter and sort services
  const filteredAndSortedServices = services
    .filter(service => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (!service.name?.toLowerCase().includes(search) &&
            !service.url?.toLowerCase().includes(search) &&
            !service.description?.toLowerCase().includes(search)) {
          return false
        }
      }

      // Source filter
      if (filterSource === 'manual' && service._source !== 'manual') return false
      if (filterSource === 'npm' && service._source !== 'npm') return false

      // Visibility filter
      if (filterVisibility === 'visible' && service.hidden) return false
      if (filterVisibility === 'hidden' && !service.hidden) return false

      return true
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'source':
          comparison = (a._source || '').localeCompare(b._source || '')
          break
        case 'categories':
          const aCat = Array.isArray(a.categories) ? a.categories.join(', ') : (a.category || '')
          const bCat = Array.isArray(b.categories) ? b.categories.join(', ') : (b.category || '')
          comparison = aCat.localeCompare(bCat)
          break
        case 'url':
          comparison = (a.url || '').localeCompare(b.url || '')
          break
        default:
          comparison = 0
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  if (loading) {
    return <div className="loading">Loading services...</div>
  }

  return (
    <div className="services-manager">
      <div className="manager-header">
        <h2>
          {showAddForm ? 'Add Service' :
           editingIndex ? 'Edit Service' :
           `Manage Services (${filteredAndSortedServices.length} of ${services.length})`}
        </h2>
        {!editingIndex && (
          <button
            className="btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Service'}
          </button>
        )}
      </div>

      {showAddForm && (
        <ServiceForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          baseUrl={baseUrl}
          allCategories={allCategories}
        />
      )}

      {/* Filters and search */}
      {!showAddForm && !editingIndex && (
        <div className="services-controls">
          <div className="services-filters">
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <label>
              Source:
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="all">All</option>
                <option value="manual">Manual</option>
                <option value="npm">NPM</option>
              </select>
            </label>

            <label>
              Visibility:
              <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)}>
                <option value="all">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Table View */}
      {!showAddForm && (
        <div className="services-table-wrapper">
        {filteredAndSortedServices.length === 0 ? (
          <p className="empty-state">
            {services.length === 0 ? 'No services configured. Add one to get started!' : 'No services match your filters.'}
          </p>
        ) : editingIndex ? (
          <div className="edit-panel">
            <ServiceForm
              initialData={editForm}
              onSubmit={(data) => handleUpdate(editingIndex, data)}
              onCancel={cancelEdit}
              isEditing
              isNpmService={editForm._source === 'npm'}
              baseUrl={baseUrl}
              allCategories={allCategories}
            />
          </div>
        ) : (
          <table className="services-table">
            <thead>
              <tr>
                <th>Icon</th>
                <th
                  className="sortable-header"
                  onClick={() => handleSort('name')}
                  title="Click to sort by Name"
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>Description</th>
                <th
                  className="sortable-header"
                  onClick={() => handleSort('url')}
                  title="Click to sort by URL"
                >
                  URL {sortBy === 'url' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="sortable-header"
                  onClick={() => handleSort('source')}
                  title="Click to sort by Source"
                >
                  Source {sortBy === 'source' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="sortable-header"
                  onClick={() => handleSort('categories')}
                  title="Click to sort by Categories"
                >
                  Categories {sortBy === 'categories' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedServices.map((service) => {
                return (
                  <tr key={service._id} className={service.hidden ? 'hidden-service' : ''}>
                    <td className="icon-cell">
                      {service.iconUrl ? (
                        <img
                          src={service.iconUrl}
                          alt=""
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      ) : service.fallbackInitials && (
                        <div className="icon-fallback">{service.fallbackInitials}</div>
                      )}
                  </td>
                  <td className="name-cell">{service.name}</td>
                  <td className="description-cell">{service.description || '-'}</td>
                  <td className="url-cell">{service.url}</td>
                  <td className="source-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {service._source === 'npm' ? (
                        <>
                          <span className="badge-npm">NPM</span>
                          {service._hasOverrides && (
                            <span className="badge-override">Customized</span>
                          )}
                        </>
                      ) : (
                        <span className="badge-manual">Manual</span>
                      )}
                    </div>
                  </td>
                  <td className="categories-cell">
                    {service.categories && service.categories.length > 0
                      ? service.categories.join(', ')
                      : (service.category || '-')}
                  </td>
                  <td className="actions-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => startEdit(service._id, service)} className="btn-small btn-edit">
                        {service._source === 'npm' ? 'Customize' : 'Edit'}
                      </button>
                      {service._source === 'npm' && service._hasOverrides && (
                        <button
                          onClick={() => handleDelete(service._id, service._source)}
                          className="btn-small btn-reset"
                          title="Reset to NPM defaults"
                        >
                          Reset
                        </button>
                      )}
                      {service._source === 'manual' && (
                        <button onClick={() => handleDelete(service._id, service._source)} className="btn-small btn-danger">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
        </div>
      )}
    </div>
  )
}

function ServiceForm({ initialData = {}, onSubmit, onCancel, isEditing = false, isNpmService = false, baseUrl = '', allCategories = [] }) {
  // Determine initial mode based on whether appendBaseDomain is true
  // If no base domain is configured, always use FQDN mode
  const initialMode = baseUrl && initialData.appendBaseDomain !== false ? 'subdomain' : 'fqdn'

  const [urlMode, setUrlMode] = useState(initialMode)
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
    url: initialData.url || '',
    icon: initialData.icon || '',
    categories: Array.isArray(initialData.categories) ? initialData.categories :
                (initialData.category ? [initialData.category] : []),
    hidden: initialData.hidden || false
  })
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function handleModeChange(mode) {
    setUrlMode(mode)
    // Clear URL when switching modes to avoid confusion
    setFormData(prev => ({ ...prev, url: '' }))
  }

  function toggleCategory(categoryName) {
    setFormData(prev => {
      if (prev.categories.includes(categoryName)) {
        // Remove category
        return {
          ...prev,
          categories: prev.categories.filter(cat => cat !== categoryName)
        }
      } else {
        // Add category
        return {
          ...prev,
          categories: [...prev.categories, categoryName]
        }
      }
    })
  }

  function removeCategory(index) {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()

    // Create clean object
    const cleanData = {
      name: formData.name,
      description: formData.description || undefined,
      icon: formData.icon,
      categories: formData.categories.length > 0 ? formData.categories : undefined,
      hidden: formData.hidden
    }

    // For manual services, include URL data
    if (!isNpmService) {
      cleanData.url = formData.url
      cleanData.appendBaseDomain = urlMode === 'subdomain'
    }

    onSubmit(cleanData)
  }

  return (
    <form className="service-form" onSubmit={handleSubmit}>
      {isNpmService && (
        <div className="info-banner">
          <strong>NPM Service:</strong> You can customize the display name, icon, category, and visibility.
          The URL is managed by NPM and cannot be changed here.
        </div>
      )}

      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Plex, Sonarr"
          required
        />
      </div>

      <div className="form-group">
        <label>Description (optional)</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="e.g., Media streaming server"
          rows="2"
        />
        <p className="help-text">
          A short description shown under the service name
        </p>
      </div>

      {!isNpmService && (
        <>
          {baseUrl && (
            <div className="form-group">
              <label>URL Type</label>
              <div className="url-mode-toggle">
                <label className={`mode-option ${urlMode === 'subdomain' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="urlMode"
                    value="subdomain"
                    checked={urlMode === 'subdomain'}
                    onChange={() => handleModeChange('subdomain')}
                  />
                  <span>Subdomain (uses base domain)</span>
                </label>
                <label className={`mode-option ${urlMode === 'fqdn' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="urlMode"
                    value="fqdn"
                    checked={urlMode === 'fqdn'}
                    onChange={() => handleModeChange('fqdn')}
                  />
                  <span>Full URL</span>
                </label>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>
              {urlMode === 'subdomain' ? 'Subdomain' : 'URL'}
            </label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder={urlMode === 'subdomain'
                ? `e.g., plex (will become plex.${baseUrl})`
                : 'e.g., https://example.com:8080/path'}
              required
            />
            {urlMode === 'subdomain' && baseUrl && (
              <p className="help-text">
                Will be combined with base domain: <strong>{baseUrl}</strong>
              </p>
            )}
          </div>
        </>
      )}

      {isNpmService && (
        <div className="form-group">
          <label>URL (managed by NPM)</label>
          <input
            type="text"
            value={formData.url}
            disabled
            className="disabled-input"
          />
        </div>
      )}

      <div className="form-group">
        <label>Icon (optional)</label>
        <IconAutocomplete
          value={formData.icon}
          onChange={(value) => handleChange('icon', value)}
          placeholder="e.g., plex, github (leave empty for auto)"
        />
        <p className="help-text">
          Start typing to search from 2000+ icons. Leave empty for auto-detection.
        </p>
      </div>

      <div className="form-group">
        <label>Categories (optional)</label>
        {allCategories.length > 0 ? (
          <>
            <div className="category-browse-group">
              <button
                type="button"
                onClick={() => setShowCategoryBrowser(true)}
                className="btn-browse"
              >
                Browse
              </button>
              <span className="category-count-text">
                {formData.categories.length === 0
                  ? 'No categories selected'
                  : `${formData.categories.length} ${formData.categories.length === 1 ? 'category' : 'categories'} selected`}
              </span>
            </div>

            {formData.categories.length > 0 && (
              <div className="category-tags">
                {formData.categories.map((cat, index) => (
                  <span key={index} className="category-tag">
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(index)}
                      className="remove-tag"
                      aria-label="Remove category"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="help-text">
              Select from existing categories. Leave empty for auto-detection from icon metadata.
            </p>

            {/* Category Browser Modal */}
            {showCategoryBrowser && (
              <div className="icon-modal-overlay" onClick={() => setShowCategoryBrowser(false)}>
                <div className="icon-modal category-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="icon-modal-header">
                    <h3>Browse Categories</h3>
                    <button
                      className="icon-modal-close"
                      onClick={() => setShowCategoryBrowser(false)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  <div className="category-browser-content">
                    <p className="help-text">
                      Select or deselect categories by clicking on them. Selected categories are highlighted.
                    </p>

                    <div className="category-browser-grid">
                      {allCategories.map((cat) => {
                        const categoryName = cat.displayName || cat.name
                        const isSelected = formData.categories.includes(categoryName)

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            className={`category-browser-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleCategory(categoryName)}
                          >
                            <div className="category-browser-name">{categoryName}</div>
                            {cat.serviceCount > 0 && (
                              <div className="category-browser-count">
                                {cat.serviceCount} {cat.serviceCount === 1 ? 'service' : 'services'}
                              </div>
                            )}
                            {isSelected && (
                              <div className="category-browser-check">✓</div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="icon-modal-footer">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowCategoryBrowser(false)}
                    >
                      Done ({formData.categories.length} selected)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="help-text">
            Loading categories... Categories will be auto-detected from icon metadata if not specified.
          </p>
        )}
      </div>

      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.hidden}
            onChange={(e) => handleChange('hidden', e.target.checked)}
          />
          Hide this service
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {isEditing ? 'Update' : 'Add'} Service
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default ServicesManager
