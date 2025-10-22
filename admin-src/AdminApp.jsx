import { useState, useEffect } from 'react'
import ServicesManager from './components/ServicesManager'
import ConfigManager from './components/ConfigManager'
import LoginPage from './components/LoginPage'
import PasskeyManager from './components/PasskeyManager'
import CategoryManager from './components/CategoryManager'
import { fetchWithCsrf, clearCsrfToken } from './utils/csrf'

function AdminApp() {
  const [activeTab, setActiveTab] = useState('services')
  const [authStatus, setAuthStatus] = useState({
    authRequired: false,
    authenticated: false,
    loading: true
  })
  const [customName, setCustomName] = useState('Services Dashboard')
  const [customIcon, setCustomIcon] = useState(null)

  useEffect(() => {
    checkAuthStatus()
    loadBranding()
  }, [])

  async function loadBranding() {
    try {
      const response = await fetch('/api/branding')
      if (response.ok) {
        const branding = await response.json()
        setCustomName(branding.customName || 'Services Dashboard')
        setCustomIcon(branding.customIcon)
        // Update page title
        document.title = `${branding.customName || 'Services Dashboard'} - Management`
      }
    } catch (error) {
      // Silently fail - will use defaults
    }
  }

  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/admin/auth/status')
      if (response.ok) {
        const data = await response.json()
        setAuthStatus({
          authRequired: data.authRequired,
          authenticated: data.authenticated,
          loading: false
        })
      }
    } catch (err) {
      console.error('Failed to check auth status:', err)
      setAuthStatus(prev => ({ ...prev, loading: false }))
    }
  }

  function handleLogin() {
    setAuthStatus(prev => ({ ...prev, authenticated: true }))
  }

  async function handleLogout() {
    try {
      await fetchWithCsrf('/api/admin/auth/logout', { method: 'POST' })
      clearCsrfToken() // Clear cached token on logout
      setAuthStatus(prev => ({ ...prev, authenticated: false }))
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  if (authStatus.loading) {
    return (
      <div className="admin-app">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (authStatus.authRequired && !authStatus.authenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div className="header-title">
          <img src={customIcon || "/icon.svg"} alt="Logo" className="header-logo" />
          <h1>{customName} Management</h1>
        </div>
        <nav className="admin-nav">
          <button
            className={activeTab === 'services' ? 'active' : ''}
            onClick={() => setActiveTab('services')}
          >
            Services
          </button>
          <button
            className={activeTab === 'categories' ? 'active' : ''}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
          <button
            className={activeTab === 'config' ? 'active' : ''}
            onClick={() => setActiveTab('config')}
          >
            Settings
          </button>
          {authStatus.authRequired && (
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          )}
        </nav>
      </header>

      <main className="admin-content">
        {activeTab === 'services' && <ServicesManager />}
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'config' && (
          <>
            <ConfigManager />
            {authStatus.authRequired && <PasskeyManager />}
          </>
        )}
      </main>
    </div>
  )
}

export default AdminApp
