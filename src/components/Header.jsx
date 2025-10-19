import PropTypes from 'prop-types'

function Header({ searchBar, selectedCategory, onMenuToggle }) {
  const categoryDisplay = selectedCategory === 'all' ? 'All Services' : selectedCategory

  return (
    <div className="header">
      <div className="header-content">
        <div className="header-left">
          <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1>{categoryDisplay}</h1>
        </div>
        {searchBar && <div className="header-right">{searchBar}</div>}
      </div>
    </div>
  )
}

Header.propTypes = {
  searchBar: PropTypes.node,
  selectedCategory: PropTypes.string.isRequired,
  onMenuToggle: PropTypes.func.isRequired
}

export default Header
