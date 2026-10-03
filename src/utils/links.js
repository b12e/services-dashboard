export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function openService(service) {
  if (service?.href) window.open(service.href, '_blank', 'noopener,noreferrer')
}
