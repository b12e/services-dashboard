import { useState } from 'react'
import PropTypes from 'prop-types'
import { isStandalone } from '../utils/links'

/**
 * "https://sonarr.example.com/" -> "sonarr​.example.com", so long hosts
 * wrap after the first label
 */
function displayUrl(href) {
  const text = href.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const firstDot = text.indexOf('.')
  return firstDot > 0 ? `${text.slice(0, firstDot)}​${text.slice(firstDot)}` : text
}

function ServiceCard({ service, animationDelay }) {
  const [imageError, setImageError] = useState(false)
  const showImage = !!service.iconUrl && !imageError

  if (!service.href) {
    return (
      <div className="service-card error-card">
        <div className="service-icon">
          <span className="fallback-text">⚠️</span>
        </div>
        <div className="service-name">{service.name}</div>
        <div className="error-message">Invalid URL configuration</div>
      </div>
    )
  }

  const handleClick = (e) => {
    // Installed PWAs would otherwise open links inside the app window
    if (isStandalone()) {
      e.preventDefault()
      window.open(service.href, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <a
      href={service.href}
      className="service-card"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="service-icon">
        {showImage ? (
          <img
            src={service.iconUrl}
            alt=""
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="fallback-text">{service.fallbackInitials}</span>
        )}
      </div>
      <div className="service-info">
        <div className="service-name">{service.name}</div>
        {service.description && (
          <div className="service-description">{service.description}</div>
        )}
        <div className="service-url">{displayUrl(service.href)}</div>
      </div>
    </a>
  )
}

ServiceCard.propTypes = {
  service: PropTypes.shape({
    name: PropTypes.string.isRequired,
    href: PropTypes.string,
    iconUrl: PropTypes.string,
    fallbackInitials: PropTypes.string,
    description: PropTypes.string
  }).isRequired,
  animationDelay: PropTypes.number.isRequired
}

export default ServiceCard
