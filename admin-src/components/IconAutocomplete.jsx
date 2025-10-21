import { useState, useEffect, useRef } from 'react'

// Simple component to display icon preview
function IconPreview({ iconName }) {
  const [iconUrl, setIconUrl] = useState(null)

  useEffect(() => {
    if (!iconName) return

    async function loadPreview() {
      try {
        const response = await fetch(`/api/icons/preview/${encodeURIComponent(iconName)}`)
        if (response.ok) {
          const data = await response.json()
          setIconUrl(data.url)
        }
      } catch (error) {
        console.error('Failed to load icon preview:', error)
      }
    }

    loadPreview()
  }, [iconName])

  if (!iconUrl) return null

  return (
    <img
      src={iconUrl}
      alt={iconName}
      className="icon-suggestion-preview"
      onError={(e) => e.target.style.display = 'none'}
    />
  )
}

function IconAutocomplete({ value, onChange, placeholder }) {
  const [icons, setIcons] = useState([])
  const [inputValue, setInputValue] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [iconPreviewUrl, setIconPreviewUrl] = useState(null)
  const [iconPreviewCache, setIconPreviewCache] = useState(new Map())
  const wrapperRef = useRef(null)

  useEffect(() => {
    loadIcons()
  }, [])

  useEffect(() => {
    setInputValue(value || '')
    if (value) {
      loadIconPreview(value)
    }
  }, [value])

  async function loadIconPreview(iconName) {
    if (!iconName) {
      setIconPreviewUrl(null)
      return
    }

    // Check cache first
    if (iconPreviewCache.has(iconName)) {
      setIconPreviewUrl(iconPreviewCache.get(iconName))
      return
    }

    try {
      const response = await fetch(`/api/icons/preview/${encodeURIComponent(iconName)}`)
      if (response.ok) {
        const data = await response.json()
        setIconPreviewUrl(data.url)
        setIconPreviewCache(new Map(iconPreviewCache).set(iconName, data.url))
      } else {
        setIconPreviewUrl(null)
      }
    } catch (error) {
      console.error('Failed to load icon preview:', error)
      setIconPreviewUrl(null)
    }
  }

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
    loadIconPreview(newValue)

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

  return (
    <div className="icon-autocomplete" ref={wrapperRef}>
      <div className="icon-input-wrapper">
        {iconPreviewUrl && (
          <img
            src={iconPreviewUrl}
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
          className={iconPreviewUrl ? 'has-icon' : ''}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="icon-suggestions">
          {suggestions.map((icon, index) => {
            return (
              <div
                key={icon.name}
                className={`icon-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelectIcon(icon.name)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <IconPreview iconName={icon.name} />
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
