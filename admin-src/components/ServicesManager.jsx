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

  async function handleUpdate(index, updatedService) {
    try {
      const response = await fetch(`/api/admin/services/${index}`, {
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

  async function handleDelete(index) {
    if (!confirm('Are you sure you want to delete this service?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/services/${index}`, {
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

  function startEdit(index, service) {
    setEditingIndex(index)
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
          services.map((service, index) => (
            <div key={index} className="service-item">
              {editingIndex === index ? (
                <ServiceForm
                  initialData={editForm}
                  onSubmit={(data) => handleUpdate(index, data)}
                  onCancel={cancelEdit}
                  isEditing
                />
              ) : (
                <div className="service-display">
                  <div className="service-info">
                    <h3>{service.name || 'Unnamed Service'}</h3>
                    <div className="service-details">
                      <div><strong>URL:</strong> {service.url}</div>
                      <div><strong>Icon:</strong> {service.icon || 'Auto'}</div>
                      <div><strong>Category:</strong> {service.category || 'Auto'}</div>
                      <div><strong>Append Base Domain:</strong> {service.appendBaseDomain !== false ? 'Yes' : 'No'}</div>
                      {service.hidden && <div className="badge-hidden">Hidden</div>}
                    </div>
                  </div>
                  <div className="service-actions">
                    <button onClick={() => startEdit(index, service)}>Edit</button>
                    <button onClick={() => handleDelete(index)} className="btn-danger">Delete</button>
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

function ServiceForm({ initialData = {}, onSubmit, onCancel, isEditing = false }) {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    url: initialData.url || '',
    icon: initialData.icon || '',
    category: initialData.category || '',
    appendBaseDomain: initialData.appendBaseDomain !== false,
    hidden: initialData.hidden || false
  })

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()

    // Create clean object without empty strings
    const cleanData = {
      name: formData.name,
      url: formData.url,
      appendBaseDomain: formData.appendBaseDomain
    }

    if (formData.icon) cleanData.icon = formData.icon
    if (formData.category) cleanData.category = formData.category
    if (formData.hidden) cleanData.hidden = true

    onSubmit(cleanData)
  }

  return (
    <form className="service-form" onSubmit={handleSubmit}>
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
        <label>URL</label>
        <input
          type="text"
          value={formData.url}
          onChange={(e) => handleChange('url', e.target.value)}
          placeholder="e.g., plex or https://example.com"
          required
        />
      </div>

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
        <label>Category (optional)</label>
        <input
          type="text"
          value={formData.category}
          onChange={(e) => handleChange('category', e.target.value)}
          placeholder="e.g., Media, Development (leave empty for auto)"
        />
      </div>

      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.appendBaseDomain}
            onChange={(e) => handleChange('appendBaseDomain', e.target.checked)}
          />
          Append base domain to URL
        </label>
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
