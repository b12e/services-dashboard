import { useState, useEffect } from 'react'

function ServicesManager() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    loadServices()
  }, [])

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
      const response = await fetch('/api/admin/services', {
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
      const response = await fetch(`/api/admin/services/${serviceId}`, {
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
      const response = await fetch(`/api/admin/services/${serviceId}`, {
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

  if (loading) {
    return <div className="loading">Loading services...</div>
  }

  return (
    <div className="services-manager">
      <div className="manager-header">
        <h2>Manage Services</h2>
        <button
          className="btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showAddForm && (
        <ServiceForm
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="services-list">
        {services.length === 0 ? (
          <p className="empty-state">No services configured. Add one to get started!</p>
        ) : (
          services.map((service) => (
            <div key={service._id} className={`service-item ${service._source === 'npm' ? 'npm-source' : ''}`}>
              {editingIndex === service._id ? (
                <ServiceForm
                  initialData={editForm}
                  onSubmit={(data) => handleUpdate(service._id, data)}
                  onCancel={cancelEdit}
                  isEditing
                  isNpmService={service._source === 'npm'}
                />
              ) : (
                <div className="service-display">
                  <div className="service-info">
                    <h3>
                      {service.name || 'Unnamed Service'}
                      {service._source === 'npm' && <span className="badge-npm">NPM</span>}
                      {service._hasOverrides && <span className="badge-override">Customized</span>}
                    </h3>
                    <div className="service-details">
                      <div><strong>Source:</strong> {service._source === 'npm' ? 'NPM Auto-discovered' : 'Manual'}</div>
                      <div><strong>URL Type:</strong> {service.appendBaseDomain !== false ? 'Subdomain' : 'Full URL'}</div>
                      <div><strong>URL:</strong> {service.url}</div>
                      <div><strong>Icon:</strong> {service.icon || 'Auto'}</div>
                      <div>
                        <strong>Categories:</strong>{' '}
                        {service.categories && service.categories.length > 0
                          ? service.categories.join(', ')
                          : (service.category || 'Auto')}
                      </div>
                      {service.hidden && <div className="badge-hidden">Hidden</div>}
                    </div>
                  </div>
                  <div className="service-actions">
                    <button onClick={() => startEdit(service._id, service)}>
                      {service._source === 'npm' ? 'Customize' : 'Edit'}
                    </button>
                    <button onClick={() => handleDelete(service._id, service._source)} className="btn-danger">
                      {service._source === 'npm' ? 'Reset' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ServiceForm({ initialData = {}, onSubmit, onCancel, isEditing = false, isNpmService = false }) {
  // Determine initial mode based on whether appendBaseDomain is true
  const initialMode = initialData.appendBaseDomain !== false ? 'subdomain' : 'fqdn'

  const [urlMode, setUrlMode] = useState(initialMode)
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    url: initialData.url || '',
    icon: initialData.icon || '',
    categories: Array.isArray(initialData.categories) ? initialData.categories :
                (initialData.category ? [initialData.category] : []),
    hidden: initialData.hidden || false
  })
  const [categoryInput, setCategoryInput] = useState('')

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function handleModeChange(mode) {
    setUrlMode(mode)
    // Clear URL when switching modes to avoid confusion
    setFormData(prev => ({ ...prev, url: '' }))
  }

  function addCategory() {
    if (!categoryInput.trim()) return

    const newCategory = categoryInput.trim()
    if (!formData.categories.includes(newCategory)) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory]
      }))
    }
    setCategoryInput('')
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

      {!isNpmService && (
        <>
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

          <div className="form-group">
            <label>
              {urlMode === 'subdomain' ? 'Subdomain' : 'Full URL (with protocol, port, path)'}
            </label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder={urlMode === 'subdomain'
                ? 'e.g., plex (will become plex.yourdomain.com)'
                : 'e.g., https://example.com:8080/path'}
              required
            />
            {urlMode === 'subdomain' && (
              <p className="help-text">
                This will be combined with the base domain configured in Settings
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
        <input
          type="text"
          value={formData.icon}
          onChange={(e) => handleChange('icon', e.target.value)}
          placeholder="e.g., plex, github (leave empty for auto)"
        />
      </div>

      <div className="form-group">
        <label>Categories (optional)</label>
        <div className="category-input-group">
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
            placeholder="e.g., Media, Development"
          />
          <button type="button" onClick={addCategory} className="btn-small">
            Add
          </button>
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
          Leave empty for auto-detection. Press Enter or click Add to add multiple categories.
        </p>
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
