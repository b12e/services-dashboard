import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { openService } from '../utils/links'

function SearchBar({ onSearch, totalServices, filteredServices }) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    onSearch(searchTerm)
  }, [searchTerm, onSearch])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filteredServices.length === 1) {
      openService(filteredServices[0])
    } else if (e.key === 'Escape') {
      setSearchTerm('')
    }
  }

  return (
    <div className="search-container">
      <div className="search-wrapper">
        <svg
          className="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search services"
        />
        {searchTerm && (
          <button
            className="search-clear"
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      {searchTerm && (
        <div className="search-results-count">
          Showing {filteredServices.length} of {totalServices} services
        </div>
      )}
    </div>
  )
}

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  totalServices: PropTypes.number.isRequired,
  filteredServices: PropTypes.arrayOf(PropTypes.object).isRequired
}

export default SearchBar
