import PropTypes from 'prop-types'
import ServiceCard from './ServiceCard'

function ServicesGrid({ services, baseUrl }) {

  if (services.length === 0) {
    return (
      <div className="no-results">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="no-results-icon"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="11" y1="16" x2="11.01" y2="16"></line>
        </svg>
        <h3>No services found</h3>
        <p>Try adjusting your search terms</p>
      </div>
    )
  }

  return (
    <div className="services-grid hide-urls">
      {services.map((service, index) => (
        <ServiceCard
          key={`${service.name}-${index}`}
          service={service}
          baseUrl={baseUrl}
          animationDelay={Math.min(index * 0.05, 1.5)}
        />
      ))}
    </div>
  )
}

ServicesGrid.propTypes = {
  services: PropTypes.arrayOf(PropTypes.object).isRequired,
  baseUrl: PropTypes.string
}

export default ServicesGrid
