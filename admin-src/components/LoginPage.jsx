import { useState, useEffect } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { api, clearCsrfToken } from '../utils/csrf'

function LoginPage({ onLogin, customName = 'Services Dashboard', customIcon }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasPasskeys, setHasPasskeys] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  useEffect(() => {
    api('/api/admin/auth/passkeys/available')
      .then(data => setHasPasskeys(!!data.available))
      .catch(() => setHasPasskeys(false))
  }, [])

  function loggedIn() {
    // The server starts a new session on login, the old CSRF token is void
    clearCsrfToken()
    onLogin()
  }

  async function handlePasswordLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api('/api/admin/auth/login', { method: 'POST', body: { username, password } })
      loggedIn()
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true)
    setError('')

    try {
      const options = await api('/api/admin/auth/passkeys/login/options', { method: 'POST' })
      const credential = await startAuthentication({ optionsJSON: options })
      await api('/api/admin/auth/passkeys/login/verify', { method: 'POST', body: { credential } })
      loggedIn()
    } catch (err) {
      console.error('Passkey login error:', err)
      setError(err.message || 'Passkey authentication failed')
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src={customIcon || '/icon.svg'} alt="Logo" className="login-logo" />
          <h1>{customName}</h1>
          <p>Management</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handlePasswordLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {hasPasskeys && (
          <>
            <div className="login-divider">
              <span>OR</span>
            </div>

            <button onClick={handlePasskeyLogin} disabled={passkeyLoading} className="btn-passkey">
              {passkeyLoading ? 'Authenticating...' : 'Login with Passkey'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LoginPage
