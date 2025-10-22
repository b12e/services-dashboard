import { useState, useEffect } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { fetchWithCsrf } from '../utils/csrf'

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasPasskeys, setHasPasskeys] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  useEffect(() => {
    checkPasskeyAvailability()
  }, [])

  async function checkPasskeyAvailability() {
    try {
      const response = await fetch('/api/admin/auth/passkeys/available')
      if (response.ok) {
        const data = await response.json()
        setHasPasskeys(data.available)
      } else {
        setHasPasskeys(false)
      }
    } catch {
      setHasPasskeys(false)
    }
  }

  async function handlePasswordLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetchWithCsrf('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (response.ok) {
        onLogin()
      } else {
        const data = await response.json()
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true)
    setError('')

    try {
      // Get authentication options
      const optionsResponse = await fetch('/api/admin/auth/passkeys/login/options', {
        method: 'POST'
      })

      if (!optionsResponse.ok) {
        throw new Error('Failed to get authentication options')
      }

      const options = await optionsResponse.json()

      // Start authentication
      const credential = await startAuthentication(options)

      // Verify authentication
      const verifyResponse = await fetch('/api/admin/auth/passkeys/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      })

      if (verifyResponse.ok) {
        onLogin()
      } else {
        const data = await verifyResponse.json()
        setError(data.error || 'Passkey authentication failed')
      }
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
          <img src="/icon.svg" alt="Logo" className="login-logo" />
          <h1>Services Dashboard</h1>
          <p>Management Tool</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handlePasswordLogin} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
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

            <button
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="btn-passkey"
            >
              {passkeyLoading ? 'Authenticating...' : 'Login with Passkey'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LoginPage
