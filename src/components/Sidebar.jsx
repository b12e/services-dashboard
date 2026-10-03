import { useEffect, useRef } from 'react'

function Sidebar({ items, selectedCategory, onCategorySelect, isOpen, onClose, customName, customIcon }) {
  const sidebarRef = useRef(null)

  const handleCategoryClick = (category) => {
    onCategorySelect(category)
    onClose?.()
  }

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isOpen || window.innerWidth > 768) return
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
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
            <img src={customIcon || '/icon.svg'} alt="Logo" className="sidebar-logo" />
            <h1 className="sidebar-brand">{customName}</h1>
          </div>
          <h2 className="sidebar-title">Categories</h2>
          <nav className="sidebar-nav">
            {items.map(item => (
              <button
                key={item.id}
                className={`sidebar-item ${selectedCategory === item.id ? 'active' : ''}`}
                onClick={() => handleCategoryClick(item.id)}
                aria-current={selectedCategory === item.id ? 'page' : undefined}
              >
                <span className="sidebar-item-label">{item.name}</span>
                <span className="sidebar-item-count">{item.count}</span>
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

export default Sidebar
