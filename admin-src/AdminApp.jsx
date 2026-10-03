import { useState, useEffect } from 'react'
import ServicesManager from './components/ServicesManager'
import ConfigManager from './components/ConfigManager'
import LoginPage from './components/LoginPage'
import PasskeyManager from './components/PasskeyManager'
import CategoryManager from './components/CategoryManager'
import { api, clearCsrfToken } from './utils/csrf'

const DEFAULT_NAME = 'Services Dashboard'

function AdminApp() {
  const [activeTab, setActiveTab] = useState('services')
  const [authStatus, setAuthStatus] = useState({
    authRequired: false,
    authenticated: false,
    loading: true
  })
  const [branding, setBranding] = useState({ customName: DEFAULT_NAME, customIcon: null })

  useEffect(() => {
    checkAuthStatus()
    loadBranding()

    // Any API call that comes back 401 means the session expired
    const handleUnauthorized = () => setAuthStatus(prev => ({ ...prev, authenticated: false }))
    window.addEventListener('admin:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized)
  }, [])

  async function loadBranding() {
    try {
      const data = await api('/api/branding')
      setBranding({ customName: data.customName || DEFAULT_NAME, customIcon: data.customIcon })
      document.title = `${data.customName || DEFAULT_NAME} - Management`
    } catch {
      // Keep the defaults
    }
  }

  async function checkAuthStatus() {
    try {
      const data = await api('/api/admin/auth/status')
      setAuthStatus({ authRequired: data.authRequired, authenticated: data.authenticated, loading: false })
    } catch (err) {
      console.error('Failed to check auth status:', err)
      setAuthStatus(prev => ({ ...prev, loading: false }))
    }
  }

  async function handleLogout() {
    try {
      await api('/api/admin/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('Logout failed:', err)
    }
    clearCsrfToken()
    setAuthStatus(prev => ({ ...prev, authenticated: false }))
  }

  if (authStatus.loading) {
    return (
      <div className="admin-app">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (authStatus.authRequired && !authStatus.authenticated) {
    return (
      <LoginPage
        onLogin={() => setAuthStatus(prev => ({ ...prev, authenticated: true }))}
        customName={branding.customName}
        customIcon={branding.customIcon}
      />
    )
  }

  const tabs = [
    ['services', 'Services'],
    ['categories', 'Categories'],
    ['config', 'Settings'],
  ]

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div className="header-title">
          <img src={branding.customIcon || '/icon.svg'} alt="Logo" className="header-logo" />
          <h1>{branding.customName} Management</h1>
        </div>
        <nav className="admin-nav">
          {tabs.map(([id, label]) => (
            <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
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
