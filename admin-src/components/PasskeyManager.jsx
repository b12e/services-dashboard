import { useState, useEffect } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { fetchWithCsrf } from '../utils/csrf'

function PasskeyManager() {
  const [passkeys, setPasskeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadPasskeys()
  }, [])

  async function loadPasskeys() {
    try {
      const response = await fetch('/api/admin/auth/passkeys')
      if (response.ok) {
        const data = await response.json()
        setPasskeys(data)
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterPasskey() {
    if (!passkeyName.trim()) {
      setError('Please enter a name for this passkey')
      return
    }

    setRegistering(true)
    setError('')

    try {
      // Get registration options
      const optionsResponse = await fetchWithCsrf('/api/admin/auth/passkeys/register/options', {
        method: 'POST'
      })

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options')
      }

      const options = await optionsResponse.json()

      // Start registration
      const credential = await startRegistration(options)

      // Verify registration
      const verifyResponse = await fetchWithCsrf('/api/admin/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, name: passkeyName })
      })

      if (verifyResponse.ok) {
        setPasskeyName('')
        await loadPasskeys()
        alert('Passkey registered successfully!')
      } else {
        const data = await verifyResponse.json()
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      console.error('Passkey registration error:', err)
      setError(err.message || 'Failed to register passkey')
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeletePasskey(index) {
    if (!confirm('Are you sure you want to delete this passkey?')) {
      return
    }

    try {
      const response = await fetchWithCsrf(`/api/admin/auth/passkeys/${index}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadPasskeys()
      } else {
        alert('Failed to delete passkey')
      }
    } catch (err) {
      console.error('Failed to delete passkey:', err)
      alert('Failed to delete passkey')
    }
  }

  if (loading) {
    return <div className="loading">Loading passkeys...</div>
  }

  return (
    <div className="passkey-manager">
      <h3>Passkey Management</h3>
      <p className="help-text">
        Passkeys allow you to login securely using biometrics, security keys, or device authentication.
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="passkey-register">
        <div className="form-group">
          <label>Register New Passkey</label>
          <input
            type="text"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            placeholder="e.g., My Laptop, iPhone, YubiKey"
          />
        </div>
        <button
          onClick={handleRegisterPasskey}
          disabled={registering}
          className="btn-primary"
        >
          {registering ? 'Registering...' : 'Add Passkey'}
        </button>
      </div>

      <div className="passkey-list">
        <h4>Registered Passkeys ({passkeys.length})</h4>
        {passkeys.length === 0 ? (
          <p className="empty-state">No passkeys registered yet</p>
        ) : (
          passkeys.map((passkey, index) => (
            <div key={index} className="passkey-item">
              <div className="passkey-info">
                <strong>{passkey.name}</strong>
                <span className="passkey-date">
                  Added: {new Date(passkey.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => handleDeletePasskey(index)}
                className="btn-danger btn-small"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PasskeyManager
