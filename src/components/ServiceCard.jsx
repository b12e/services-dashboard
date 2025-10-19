import { useState } from 'react'
import PropTypes from 'prop-types'

function validateAndNormalizeUrl(urlString, shouldAppendBase, baseUrl) {
  try {
    let finalUrl

    if (shouldAppendBase && baseUrl) {
      finalUrl = urlString
        ? `https://${urlString}.${baseUrl}`
        : `https://${baseUrl}`
    } else {
      if (!urlString) {
        if (baseUrl) {
          finalUrl = `https://${baseUrl}`
        } else {
          throw new Error('No URL provided')
        }
      } else {
        if (urlString.match(/^https?:\/\//)) {
          finalUrl = urlString
        } else {
          finalUrl = `https://${urlString}`
        }
      }
    }

    const urlObj = new URL(finalUrl)
    return { valid: true, url: finalUrl }
  } catch (error) {
    return { valid: false, error: 'Invalid URL configuration' }
  }
}

function ServiceCard({ service, baseUrl, animationDelay }) {
  const shouldAppendBase = service.appendBaseDomain !== false
  const urlResult = validateAndNormalizeUrl(service.url, shouldAppendBase, baseUrl)

  const iconText = service.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const iconName = service.icon || service.name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const svgUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${iconName}.svg`
  const pngUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${iconName}.png`

  const [imageError, setImageError] = useState(false)
  const [usePng, setUsePng] = useState(false)

  if (!urlResult.valid) {
    return (
      <div className="service-card error-card">
        <div className="service-icon">
          <span className="fallback-text">⚠️</span>
        </div>
        <div className="service-name">{service.name}</div>
        <div className="error-message">{urlResult.error}</div>
      </div>
    )
  }

  let displayUrl = urlResult.url.replace(/^https?:\/\//, '')

  if (shouldAppendBase && baseUrl && service.url) {
    displayUrl = service.url + '\u200B.' + baseUrl
  } else {
    const firstDotIndex = displayUrl.indexOf('.')
    if (firstDotIndex > 0 && firstDotIndex < displayUrl.length - 1) {
      displayUrl = displayUrl.substring(0, firstDotIndex) + '\u200B' + displayUrl.substring(firstDotIndex)
    }
  }

  const handleClick = (e) => {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      e.preventDefault()
      window.open(urlResult.url, '_blank')
    }
  }

  const handleImageError = () => {
    if (!usePng) {
      setUsePng(true)
    } else {
      setImageError(true)
    }
  }

  return (
    <a
      href={urlResult.url}
      className="service-card"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="service-icon">
        {!imageError && (
          <img
            src={usePng ? pngUrl : svgUrl}
            alt={`${service.name} icon`}
            onError={handleImageError}
          />
        )}
        <span
          className="fallback-text"
          style={{ display: imageError ? 'block' : 'none' }}
        >
          {iconText}
        </span>
      </div>
      <div className="service-name">{service.name}</div>
      <div className="service-url">{displayUrl}</div>
    </a>
  )
}

ServiceCard.propTypes = {
  service: PropTypes.shape({
    name: PropTypes.string.isRequired,
    url: PropTypes.string,
    icon: PropTypes.string,
    appendBaseDomain: PropTypes.bool
  }).isRequired,
  baseUrl: PropTypes.string,
  animationDelay: PropTypes.number.isRequired
}

export default ServiceCard
