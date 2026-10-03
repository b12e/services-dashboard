import { useState, useEffect, useMemo } from 'react'
import IconAutocomplete from './IconAutocomplete'
import { api } from '../utils/csrf'

const MATCH_SOURCES = {
  app: 'recognised app',
  keyword: 'keyword',
  'icon-metadata': 'icon category',
}

function ServicesManager() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('all') // all, manual, npm
  const [filterVisibility, setFilterVisibility] = useState('all') // all, visible, hidden
  const [sortBy, setSortBy] = useState('name') // name, source, categories, url
  const [sortOrder, setSortOrder] = useState('asc')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [servicesData, categoriesData, config] = await Promise.all([
        api('/api/admin/services'),
        api('/api/admin/categories'),
        api('/api/admin/config'),
      ])
      setServices(servicesData)
      setCategories(categoriesData)
      setBaseUrl(config.baseUrl || '')
    } catch (error) {
      console.error('Failed to load services:', error)
      alert(`Failed to load services: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  async function handleAdd(newService) {
    try {
      await api('/api/admin/services', { method: 'POST', body: newService })
      setShowAddForm(false)
      await loadAll()
    } catch (error) {
      alert(`Failed to add service: ${error.message}`)
    }
  }

  async function handleUpdate(serviceId, updatedService) {
    try {
      await api(`/api/admin/services/${encodeURIComponent(serviceId)}`, { method: 'PUT', body: updatedService })
      setEditingId(null)
      await loadAll()
    } catch (error) {
      alert(`Failed to update service: ${error.message}`)
    }
  }

  async function handleDelete(service) {
    const confirmMsg = service.source === 'npm'
      ? `Remove all customizations of "${service.name}"? It goes back to what Nginx Proxy Manager reports.`
      : `Delete "${service.name}"?`
    if (!confirm(confirmMsg)) return

    try {
      await api(`/api/admin/services/${encodeURIComponent(service.id)}`, { method: 'DELETE' })
      await loadAll()
    } catch (error) {
      alert(`Failed to delete service: ${error.message}`)
    }
  }

  const filteredAndSortedServices = useMemo(() => {
    const search = searchTerm.toLowerCase()
    const sortValue = (service) => {
      switch (sortBy) {
        case 'source': return service.source
        case 'categories': return service.categories.join(', ')
        case 'url': return service.href || service.url || ''
        default: return service.name || ''
      }
    }

    return services
      .filter(service => {
        if (search && ![service.name, service.href, service.url, service.description, ...service.categories]
          .some(value => value?.toLowerCase().includes(search))) {
          return false
        }
        if (filterSource !== 'all' && service.source !== filterSource) return false
        if (filterVisibility === 'visible' && service.hidden) return false
        if (filterVisibility === 'hidden' && !service.hidden) return false
        return true
      })
      .sort((a, b) => {
        const comparison = sortValue(a).localeCompare(sortValue(b), undefined, { sensitivity: 'base' })
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [services, searchTerm, filterSource, filterVisibility, sortBy, sortOrder])

  const editingService = editingId ? services.find(s => s.id === editingId) : null

  if (loading) {
    return <div className="loading">Loading services...</div>
  }

  const sortIndicator = column => sortBy === column && (sortOrder === 'asc' ? ' ↑' : ' ↓')

  return (
    <div className="services-manager">
      <div className="manager-header">
        <h2>
          {showAddForm ? 'Add Service' :
           editingService ? `Edit ${editingService.name}` :
           `Manage Services (${filteredAndSortedServices.length} of ${services.length})`}
        </h2>
        {!editingService && (
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add Service'}
          </button>
        )}
      </div>

      {showAddForm && (
        <ServiceForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          baseUrl={baseUrl}
          categories={categories}
        />
      )}

      {editingService && (
        <div className="edit-panel">
          <ServiceForm
            key={editingService.id}
            service={editingService}
            onSubmit={(data) => handleUpdate(editingService.id, data)}
            onCancel={() => setEditingId(null)}
            baseUrl={baseUrl}
            categories={categories}
          />
        </div>
      )}

      {!showAddForm && !editingService && (
        <>
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

          <div className="services-table-wrapper">
            {filteredAndSortedServices.length === 0 ? (
              <p className="empty-state">
                {services.length === 0 ? 'No services configured. Add one to get started!' : 'No services match your filters.'}
              </p>
            ) : (
              <table className="services-table">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th className="sortable-header" onClick={() => handleSort('name')}>Name{sortIndicator('name')}</th>
                    <th>Description</th>
                    <th className="sortable-header" onClick={() => handleSort('url')}>URL{sortIndicator('url')}</th>
                    <th className="sortable-header" onClick={() => handleSort('source')}>Source{sortIndicator('source')}</th>
                    <th className="sortable-header" onClick={() => handleSort('categories')}>Categories{sortIndicator('categories')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedServices.map((service) => (
                    <tr key={service.id} className={service.hidden ? 'hidden-service' : ''}>
                      <td className="icon-cell">
                        {service.iconUrl ? (
                          <img
                            src={service.iconUrl}
                            alt=""
                            title={service.iconAuto ? `Auto-detected: ${service.iconName}` : service.iconName}
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="icon-fallback">{service.fallbackInitials}</div>
                        )}
                      </td>
                      <td className="name-cell">
                        {service.name}
                        {service.hidden && <> <span className="badge-hidden-sm">Hidden</span></>}
                      </td>
                      <td className="description-cell">{service.description || '-'}</td>
                      <td className="url-cell">{service.href || <span className="error-text">Invalid URL</span>}</td>
                      <td className="source-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {service.source === 'npm' ? (
                            <>
                              <span className="badge-npm" title={service.npm?.connection}>NPM</span>
                              {service.npm?.hasOverrides && <span className="badge-override">Customized</span>}
                            </>
                          ) : (
                            <span className="badge-manual">Manual</span>
                          )}
                        </div>
                      </td>
                      <td className="categories-cell">
                        {service.categories.length > 0 ? service.categories.join(', ') : 'Other'}
                        {service.categoriesAuto && <span className="auto-hint"> (auto)</span>}
                      </td>
                      <td className="actions-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button onClick={() => setEditingId(service.id)} className="btn-small btn-edit">
                            {service.source === 'npm' ? 'Customize' : 'Edit'}
                          </button>
                          {service.source === 'npm' && service.npm?.hasOverrides && (
                            <button onClick={() => handleDelete(service)} className="btn-small btn-reset" title="Reset to NPM defaults">
                              Reset
                            </button>
                          )}
                          {service.source === 'manual' && (
                            <button onClick={() => handleDelete(service)} className="btn-small btn-danger">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ServiceForm({ service, onSubmit, onCancel, baseUrl = '', categories = [] }) {
  const isEditing = !!service
  const isNpmService = service?.source === 'npm'
  const initialMode = baseUrl && service?.appendBaseDomain !== false ? 'subdomain' : 'fqdn'

  const [urlMode, setUrlMode] = useState(initialMode)
  const [formData, setFormData] = useState({
    name: service?.name || '',
    description: service?.description || '',
    url: (isNpmService ? service.href : service?.url) || '',
    icon: service?.icon || '',
    hidden: service?.hidden || false,
  })
  // Automatic categories unless the service has its own selection
  const [categoriesManual, setCategoriesManual] = useState(isEditing ? !service.categoriesAuto : false)
  const [categoryIds, setCategoryIds] = useState(service?.categoryIds || [])
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false)

  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [categories]
  )

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function toggleCategory(id) {
    setCategoryIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]))
  }

  function chooseCategories() {
    setCategoriesManual(true)
    setCategoryIds(service?.categoriesAuto ? (service.categoryIds || []) : categoryIds)
    setShowCategoryBrowser(true)
  }

  function useAutomaticCategories() {
    setCategoriesManual(false)
    setCategoryIds(service?.categoriesAuto ? service.categoryIds : [])
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      hidden: formData.hidden,
      categoryIds: categoriesManual ? categoryIds : null,
    }
    if (!isNpmService) {
      data.url = formData.url
      data.appendBaseDomain = urlMode === 'subdomain'
    }
    onSubmit(data)
  }

  const auto = service?.autoCategory
  const autoDescription = !isEditing
    ? 'Chosen automatically from the name, address and icon after saving.'
    : auto?.id
      ? `${categoryById.get(auto.id)?.name || auto.key} (${MATCH_SOURCES[auto.source] || auto.source} “${auto.match}”)`
      : 'No match, the service is listed under "Other".'

  return (
    <form className="service-form" onSubmit={handleSubmit}>
      {isNpmService && (
        <div className="info-banner">
          <strong>Discovered through Nginx Proxy Manager</strong> ({service.npm?.connection}) as “{service.npm?.name}”.
          You can customize the name, description, icon, categories and visibility. The address is managed by NPM.
        </div>
      )}

      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder={isNpmService ? service.npm?.name : 'e.g., Plex, Sonarr'}
          required={!isNpmService}
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
        <p className="help-text">A short description shown under the service name</p>
      </div>

      {!isNpmService ? (
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
                    onChange={() => setUrlMode('subdomain')}
                  />
                  <span>Subdomain of {baseUrl}</span>
                </label>
                <label className={`mode-option ${urlMode === 'fqdn' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="urlMode"
                    value="fqdn"
                    checked={urlMode === 'fqdn'}
                    onChange={() => setUrlMode('fqdn')}
                  />
                  <span>Full URL</span>
                </label>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>{urlMode === 'subdomain' ? 'Subdomain' : 'URL'}</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder={urlMode === 'subdomain'
                ? `e.g., plex (becomes plex.${baseUrl})`
                : 'e.g., https://example.com:8080/path'}
              required
            />
            {urlMode === 'subdomain' && baseUrl && formData.url && (
              <p className="help-text">
                Opens <strong>https://{formData.url.replace(/^\/+/, '').split('/')[0]}.{baseUrl}</strong>
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="form-group">
          <label>URL (managed by NPM)</label>
          <input type="text" value={formData.url} disabled className="disabled-input" />
        </div>
      )}

      <div className="form-group">
        <label>Icon (optional)</label>
        <IconAutocomplete
          value={formData.icon}
          onChange={(value) => handleChange('icon', value)}
          placeholder="Name, si:slug or https:// URL (empty = automatic)"
          autoIcon={service?.iconAuto ? { name: service.iconName, url: service.iconUrl } : null}
        />
        <p className="help-text">
          Leave empty to pick an icon automatically from the name and address.
          Use <code>si:</code> for Simple Icons, e.g. <code>si:github</code>.
        </p>
      </div>

      <div className="form-group">
        <label>Categories</label>
        {categoriesManual ? (
          <>
            <div className="category-browse-group">
              <button type="button" onClick={() => setShowCategoryBrowser(true)} className="btn-browse">
                Browse
              </button>
              <span className="category-count-text">
                {categoryIds.length === 0
                  ? 'No categories, listed under "Other"'
                  : `${categoryIds.length} ${categoryIds.length === 1 ? 'category' : 'categories'} selected`}
              </span>
              <button type="button" className="link-button" onClick={useAutomaticCategories}>
                Use automatic categories
              </button>
            </div>
            {categoryIds.length > 0 && (
              <div className="category-tags">
                {categoryIds.map(id => (
                  <span key={id} className="category-tag">
                    {categoryById.get(id)?.name || 'Deleted category'}
                    <button type="button" onClick={() => toggleCategory(id)} className="remove-tag" aria-label="Remove category">×</button>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="category-browse-group">
            <span className="category-count-text">Automatic: {autoDescription}</span>
            <button type="button" className="link-button" onClick={chooseCategories}>
              Choose categories
            </button>
          </div>
        )}

        {showCategoryBrowser && (
          <div className="icon-modal-overlay" onClick={() => setShowCategoryBrowser(false)}>
            <div className="icon-modal category-modal" onClick={(e) => e.stopPropagation()}>
              <div className="icon-modal-header">
                <h3>Choose Categories</h3>
                <button type="button" className="icon-modal-close" onClick={() => setShowCategoryBrowser(false)} aria-label="Close">×</button>
              </div>

              <div className="category-browser-content">
                <p className="help-text">
                  Click to select or deselect. Manage the list itself on the Categories tab.
                </p>
                <div className="category-browser-grid">
                  {sortedCategories.map(category => {
                    const isSelected = categoryIds.includes(category.id)
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`category-browser-item ${isSelected ? 'selected' : ''} ${category.visible ? '' : 'hidden-category'}`}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <div className="category-browser-name">{category.name}</div>
                        <div className="category-browser-count">
                          {category.serviceCount} {category.serviceCount === 1 ? 'service' : 'services'}
                          {!category.visible && ' · hidden'}
                        </div>
                        {isSelected && <div className="category-browser-check">✓</div>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="icon-modal-footer">
                <button type="button" className="btn-primary" onClick={() => setShowCategoryBrowser(false)}>
                  Done ({categoryIds.length} selected)
                </button>
              </div>
            </div>
          </div>
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
          {isEditing ? 'Save' : 'Add Service'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default ServicesManager
