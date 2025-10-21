import { useState, useEffect } from 'react'

function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const response = await fetch('/api/admin/categories')
      if (response.ok) {
        const categories = await response.json()
        setCategories(categories)
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveCategories(updatedCategories) {
    setSaving(true)
    try {
      const configResponse = await fetch('/api/admin/config')
      if (!configResponse.ok) throw new Error('Failed to load config')

      const config = await configResponse.json()

      // Only save categories that are configured (not auto-detected)
      const configuredCategories = updatedCategories.filter(cat => cat.configured !== false)
      config.categories = configuredCategories

      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        // Reload all categories to get the updated merge of configured + auto-detected
        await loadCategories()
      } else {
        alert('Failed to save categories')
      }
    } catch (err) {
      console.error('Failed to save categories:', err)
      alert('Failed to save categories')
    } finally {
      setSaving(false)
    }
  }

  function handleAddCategory() {
    if (!newCategoryName.trim()) {
      alert('Please enter a category name')
      return
    }

    const newCategory = {
      name: newCategoryName.trim(),
      displayName: newCategoryName.trim(),
      visible: true,
      configured: true
    }

    const updatedCategories = [...categories, newCategory]
    saveCategories(updatedCategories)
    setNewCategoryName('')
  }

  function handleToggleVisibility(index) {
    const updatedCategories = [...categories]
    updatedCategories[index].visible = !updatedCategories[index].visible
    // Mark as configured when visibility is toggled
    updatedCategories[index].configured = true
    saveCategories(updatedCategories)
  }

  function handleStartEdit(index) {
    setEditingIndex(index)
    setEditName(categories[index].displayName)
  }

  function handleSaveEdit(index) {
    if (!editName.trim()) {
      alert('Display name cannot be empty')
      return
    }

    const updatedCategories = [...categories]
    updatedCategories[index].displayName = editName.trim()
    // Mark as configured when renamed
    updatedCategories[index].configured = true
    saveCategories(updatedCategories)
    setEditingIndex(null)
    setEditName('')
  }

  function handleCancelEdit() {
    setEditingIndex(null)
    setEditName('')
  }

  function handleDeleteCategory(index) {
    if (!confirm(`Are you sure you want to delete the category "${categories[index].displayName}"?`)) {
      return
    }

    const updatedCategories = categories.filter((_, i) => i !== index)
    saveCategories(updatedCategories)
  }

  if (loading) {
    return <div className="loading">Loading categories...</div>
  }

  return (
    <div className="category-manager">
      <h3>Category Management</h3>
      <p className="help-text">
        Manage how categories appear in the dashboard. You can rename categories and control their visibility.
      </p>

      <div className="category-add">
        <div className="form-group">
          <label>Add New Category</label>
          <div className="category-add-row">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Media, Development, Monitoring"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button
              onClick={handleAddCategory}
              disabled={saving}
              className="btn-primary btn-small"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="category-list">
        <h4>Configured Categories ({categories.length})</h4>
        {categories.length === 0 ? (
          <p className="empty-state">
            No categories configured. Categories from services will be auto-detected.
          </p>
        ) : (
          <div className="category-items">
            {categories.map((category, index) => (
              <div key={index} className="category-item">
                {editingIndex === index ? (
                  <div className="category-edit">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(index)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      autoFocus
                    />
                    <div className="category-edit-actions">
                      <button
                        onClick={() => handleSaveEdit(index)}
                        className="btn-primary btn-small"
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-small"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="category-info">
                      <strong>{category.displayName}</strong>
                      {category.name !== category.displayName && (
                        <span className="category-original">(originally: {category.name})</span>
                      )}
                      <span className={`category-badge ${category.configured ? 'configured' : 'auto-detected'}`}>
                        {category.configured ? 'Configured' : 'Auto-detected'}
                      </span>
                      <span className={`category-status ${category.visible ? 'visible' : 'hidden'}`}>
                        {category.visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <div className="category-actions">
                      <button
                        onClick={() => handleToggleVisibility(index)}
                        className="btn-small"
                        disabled={saving}
                      >
                        {category.visible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="btn-small"
                        disabled={saving}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(index)}
                        className="btn-danger btn-small"
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryManager
