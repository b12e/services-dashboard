import { useState, useEffect } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { api } from '../utils/csrf'

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
      setPasskeys(await api('/api/admin/auth/passkeys'))
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
      const options = await api('/api/admin/auth/passkeys/register/options', { method: 'POST' })
      const credential = await startRegistration({ optionsJSON: options })
      await api('/api/admin/auth/passkeys/register/verify', {
        method: 'POST',
        body: { credential, name: passkeyName }
      })
      setPasskeyName('')
      await loadPasskeys()
      alert('Passkey registered successfully!')
    } catch (err) {
      console.error('Passkey registration error:', err)
      setError(err.message || 'Failed to register passkey')
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeletePasskey(passkey) {
    if (!confirm(`Delete the passkey "${passkey.name}"?`)) {
      return
    }

    try {
      await api(`/api/admin/auth/passkeys/${encodeURIComponent(passkey.id)}`, { method: 'DELETE' })
      await loadPasskeys()
    } catch (err) {
      alert(`Failed to delete passkey: ${err.message}`)
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
          passkeys.map((passkey) => (
            <div key={passkey.id} className="passkey-item">
              <div className="passkey-info">
                <strong>{passkey.name}</strong>
                <span className="passkey-date">
                  Added: {new Date(passkey.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => handleDeletePasskey(passkey)}
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
