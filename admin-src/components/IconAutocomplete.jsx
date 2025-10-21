import { useState, useEffect, useRef } from 'react'

// Helper function to validate and sanitize icon names
// Only allows alphanumeric characters, hyphens, underscores, and dots
function sanitizeIconName(iconName) {
  if (!iconName || typeof iconName !== 'string') {
    return ''
  }

  // Remove any characters that are not alphanumeric, dash, underscore, or dot
  const sanitized = iconName.replace(/[^a-zA-Z0-9\-_.]/g, '')

  // Prevent path traversal attacks
  if (sanitized.includes('..') || sanitized.includes('./') || sanitized.includes('/.')) {
    return ''
  }

  return sanitized
}

// Helper function to check if icon name is valid against the loaded icons list
function isValidIconName(iconName, iconsList) {
  if (!iconName || !iconsList || iconsList.length === 0) {
    return false
  }

  const sanitized = sanitizeIconName(iconName)
  return iconsList.some(icon => icon.name === sanitized)
}

function IconAutocomplete({ value, onChange, placeholder }) {
  const [icons, setIcons] = useState([])
  const [inputValue, setInputValue] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef(null)

  useEffect(() => {
    loadIcons()
  }, [])

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  useEffect(() => {
    // Close suggestions when clicking outside
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadIcons() {
    try {
      // Use relative URL to avoid hardcoded localhost (prevents SSRF)
      const response = await fetch('/api/icons')
      if (response.ok) {
        const data = await response.json()
        setIcons(data)
      }
    } catch (error) {
      console.error('Failed to load icons:', error)
    }
  }

  function handleInputChange(e) {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)

    if (newValue.length >= 1) {
      const filtered = icons.filter(icon => {
        const searchTerm = newValue.toLowerCase()
        return icon.name.toLowerCase().includes(searchTerm) ||
               (icon.aliases && icon.aliases.some(alias => alias.toLowerCase().includes(searchTerm)))
      }).slice(0, 10) // Limit to 10 suggestions

      setSuggestions(filtered)
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } else {
      setShowSuggestions(false)
    }
  }

  function handleSelectIcon(iconName) {
    setInputValue(iconName)
    onChange(iconName)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  function handleKeyDown(e) {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectIcon(suggestions[selectedIndex].name)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Sanitize and validate the icon name before rendering
  const sanitizedInputValue = sanitizeIconName(inputValue)
  const isInputValueValid = isValidIconName(inputValue, icons)

  return (
    <div className="icon-autocomplete" ref={wrapperRef}>
      <div className="icon-input-wrapper">
        {sanitizedInputValue && isInputValueValid && (
          <img
            src={`https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/${sanitizedInputValue}.svg`}
            alt=""
            className="icon-preview-input"
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 1 && setSuggestions(
            icons.filter(icon => {
              const searchTerm = inputValue.toLowerCase()
              return icon.name.toLowerCase().includes(searchTerm) ||
                     (icon.aliases && icon.aliases.some(alias => alias.toLowerCase().includes(searchTerm)))
            }).slice(0, 10)
          ) && setShowSuggestions(true)}
          placeholder={placeholder}
          className={inputValue ? 'has-icon' : ''}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="icon-suggestions">
          {suggestions.map((icon, index) => {
            // Sanitize each icon name from the suggestions list
            const sanitizedIconName = sanitizeIconName(icon.name)
            return (
              <div
                key={icon.name}
                className={`icon-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelectIcon(icon.name)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <img
                  src={`https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/${sanitizedIconName}.svg`}
                  alt={icon.name}
                  className="icon-suggestion-preview"
                  onError={(e) => e.target.style.display = 'none'}
                />
                <div className="icon-suggestion-info">
                  <div className="icon-suggestion-name">{icon.name}</div>
                  {icon.categories && icon.categories.length > 0 && (
                    <div className="icon-suggestion-categories">
                      {icon.categories.slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default IconAutocomplete
