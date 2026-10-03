import { useState, useEffect } from 'react'
import { api } from '../utils/csrf'

function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      setCategories(await api('/api/admin/categories'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function run(action) {
    setSaving(true)
    setError('')
    try {
      await action()
      await loadCategories()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    const ok = await run(() => api('/api/admin/categories', { method: 'POST', body: { name } }))
    if (ok) setNewCategoryName('')
  }

  function handleToggleVisibility(category) {
    run(() => api(`/api/admin/categories/${category.id}`, { method: 'PATCH', body: { visible: !category.visible } }))
  }

  function handleStartEdit(category) {
    setEditingId(category.id)
    setEditName(category.name)
  }

  async function handleSaveEdit(category) {
    const name = editName.trim()
    if (!name) return
    if (name === category.name) return setEditingId(null)
    const ok = await run(() => api(`/api/admin/categories/${category.id}`, { method: 'PATCH', body: { name } }))
    if (ok) setEditingId(null)
  }

  function handleDeleteCategory(category) {
    const services = category.serviceCount === 1 ? '1 service' : `${category.serviceCount} services`
    const autoNote = category.autoKey
      ? '\n\nServices are no longer auto-assigned to it. You can bring it back with "Restore default categories".'
      : ''
    if (!confirm(`Delete the category "${category.name}"? It is removed from ${services}.${autoNote}`)) return
    run(() => api(`/api/admin/categories/${category.id}`, { method: 'DELETE' }))
  }

  function handleRestoreDefaults() {
    run(async () => {
      const result = await api('/api/admin/categories/restore-defaults', { method: 'POST' })
      if (result.restored === 0) alert('All default categories are already present.')
    })
  }

  if (loading) {
    return <div className="loading">Loading categories...</div>
  }

  const used = categories.filter(c => c.serviceCount > 0)
  const unused = categories.filter(c => c.serviceCount === 0)

  function renderCategory(category) {
    return (
      <div key={category.id} className="category-item">
        {editingId === category.id ? (
          <div className="category-edit">
            <input
              type="text"
              value={editName}
              maxLength={60}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit(category)
                if (e.key === 'Escape') setEditingId(null)
              }}
              autoFocus
            />
            <div className="category-edit-actions">
              <button onClick={() => handleSaveEdit(category)} className="btn-primary btn-small" disabled={saving}>
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="btn-small" disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="category-info">
              <strong>{category.name}</strong>
              <div className="category-meta">
                {category.autoKey ? (
                  <span
                    className="category-badge auto-detected"
                    title={`Services are assigned automatically using the built-in "${category.autoLabel}" rules`}
                  >
                    Auto-assign{category.autoLabel !== category.name ? `: ${category.autoLabel}` : ''}
                  </span>
                ) : (
                  <span className="category-badge configured" title="Only services you assign to it">Manual</span>
                )}
                {!category.visible && <span className="category-status hidden">Hidden</span>}
                <span className="category-count">
                  {category.serviceCount} {category.serviceCount === 1 ? 'service' : 'services'}
                </span>
              </div>
            </div>
            <div className="category-actions">
              <button onClick={() => handleToggleVisibility(category)} className="btn-small" disabled={saving}>
                {category.visible ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => handleStartEdit(category)} className="btn-small" disabled={saving}>
                Rename
              </button>
              <button onClick={() => handleDeleteCategory(category)} className="btn-danger btn-small" disabled={saving}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="category-manager">
      <div className="subsection-header">
        <h3>Categories</h3>
        <button onClick={handleRestoreDefaults} className="btn-small" disabled={saving}>
          Restore default categories
        </button>
      </div>
      <p className="help-text">
        Services are sorted into categories automatically based on their name, address and icon.
        Rename or hide any category, or assign categories yourself when editing a service.
        Hidden categories are left out of the dashboard sidebar. Services without a visible category are listed under "Other".
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="category-add">
        <div className="form-group">
          <label htmlFor="new-category">Add category</label>
          <div className="category-add-row">
            <input
              id="new-category"
              type="text"
              value={newCategoryName}
              maxLength={60}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Kids, Work, Family"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button onClick={handleAddCategory} disabled={saving || !newCategoryName.trim()} className="btn-primary btn-small">
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="category-list">
        <h4>In use ({used.length})</h4>
        {used.length === 0 ? (
          <p className="empty-state">No services are in a category yet.</p>
        ) : (
          <div className="category-items">{used.map(renderCategory)}</div>
        )}
      </div>

      {unused.length > 0 && (
        <div className="category-list">
          <h4>Empty ({unused.length})</h4>
          <p className="help-text">Empty categories are not shown on the dashboard.</p>
          <div className="category-items">{unused.map(renderCategory)}</div>
        </div>
      )}
    </div>
  )
}

export default CategoryManager
