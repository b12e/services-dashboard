import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

function Sidebar({ categories, selectedCategory, onCategorySelect, isOpen, onClose }) {
  const sidebarRef = useRef(null)

  const handleCategoryClick = (category) => {
    onCategorySelect(category)
    if (onClose) {
      onClose()
    }
  }

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle on mobile when sidebar is open
      if (!isOpen || window.innerWidth > 768) return

      // Check if click is outside sidebar
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose?.()
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose])

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside ref={sidebarRef} className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
        <div className="sidebar-header">
          <img src="/icon.svg" alt="Logo" className="sidebar-logo" />
          <h1 className="sidebar-brand">Quick Access</h1>
        </div>
        <h2 className="sidebar-title">Categories</h2>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryClick('all')}
          >
            <span className="sidebar-item-label">All Services</span>
            <span className="sidebar-item-count">{categories.all || 0}</span>
          </button>
          {Object.entries(categories)
            .filter(([key]) => key !== 'all')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, count]) => (
              <button
                key={category}
                className={`sidebar-item ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryClick(category)}
              >
                <span className="sidebar-item-label">{category}</span>
                <span className="sidebar-item-count">{count}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <p>&copy; {new Date().getFullYear()} b12e</p>
        </div>
      </div>
    </aside>
    </>
  )
}

Sidebar.propTypes = {
  categories: PropTypes.object.isRequired,
  selectedCategory: PropTypes.string.isRequired,
  onCategorySelect: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func
}

export default Sidebar
