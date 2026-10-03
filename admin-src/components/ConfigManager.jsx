import { useState, useEffect } from 'react'
import { api, fetchWithCsrf } from '../utils/csrf'

const DEFAULT_NAME = 'Services Dashboard'

function ConfigManager() {
  const [config, setConfig] = useState({
    baseUrl: '',
    npmEnabled: false,
    npmConnections: [],
    customName: DEFAULT_NAME,
    customIcon: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validationResults, setValidationResults] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setConfig(await api('/api/admin/config'))
    } catch (error) {
      alert(`Failed to load configuration: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setValidationResults([])
    try {
      const result = await api('/api/admin/config', { method: 'PUT', body: config })
      setConfig(result.config)
      setValidationResults(result.validationResults || [])

      const failed = (result.validationResults || []).filter(r => !r.valid)
      if (failed.length > 0) {
        alert(`Configuration saved, but ${failed.length} NPM connection(s) failed validation. Check the connection status below.`)
      } else {
        alert('Configuration saved.')
      }
    } catch (error) {
      alert(`Failed to save configuration: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(field, value) {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  function addNpmConnection() {
    setConfig(prev => ({
      ...prev,
      npmConnections: [...prev.npmConnections, { name: '', url: '', username: '', password: '' }]
    }))
  }

  function updateNpmConnection(index, field, value) {
    setConfig(prev => ({
      ...prev,
      npmConnections: prev.npmConnections.map((conn, i) => (i === index ? { ...conn, [field]: value } : conn))
    }))
  }

  function removeNpmConnection(index) {
    setConfig(prev => ({
      ...prev,
      npmConnections: prev.npmConnections.filter((_, i) => i !== index)
    }))
    setValidationResults([])
  }

  async function handleIconUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const response = await fetchWithCsrf('/api/admin/upload/icon', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      setConfig(prev => ({ ...prev, customIcon: result.iconPath }))
    } catch (error) {
      alert(`Failed to upload icon: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading configuration...</div>
  }

  return (
    <div className="config-manager">
      <div className="manager-header">
        <h2>Configuration</h2>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="config-section">
        <h3>Branding</h3>
        <div className="form-group">
          <label>Dashboard Name</label>
          <input
            type="text"
            value={config.customName ?? ''}
            onChange={(e) => updateConfig('customName', e.target.value)}
            placeholder={DEFAULT_NAME}
          />
          <p className="help-text">Shown in the page title and sidebar</p>
        </div>

        <div className="form-group">
          <label>Custom Icon</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {config.customIcon ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img
                  src={config.customIcon}
                  alt="Custom icon"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
                <button onClick={() => updateConfig('customIcon', null)} className="btn-danger btn-small" type="button">
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,image/x-icon"
                  onChange={handleIconUpload}
                  disabled={uploading}
                  id="icon-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="icon-upload" className="btn-small" style={{ cursor: 'pointer', display: 'inline-block' }}>
                  {uploading ? 'Uploading...' : 'Upload Icon'}
                </label>
              </div>
            )}
          </div>
          <p className="help-text">PNG, JPEG, GIF, WebP, AVIF, SVG or ICO, max 2MB. Remember to save.</p>
        </div>
      </div>

      <div className="config-section">
        <h3>General Settings</h3>
        <div className="form-group">
          <label>Base Domain</label>
          <input
            type="text"
            value={config.baseUrl ?? ''}
            onChange={(e) => updateConfig('baseUrl', e.target.value)}
            placeholder="e.g., example.com"
          />
          <p className="help-text">
            Services added as a subdomain open on this domain, e.g. <code>plex</code> becomes <code>https://plex.{config.baseUrl || 'example.com'}</code>
          </p>
        </div>
      </div>

      <div className="config-section">
        <h3>Nginx Proxy Manager Integration</h3>
        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={!!config.npmEnabled}
              onChange={(e) => updateConfig('npmEnabled', e.target.checked)}
            />
            Enable NPM auto-discovery
          </label>
          <p className="help-text">
            Every enabled proxy host becomes a service. Results are cached for a minute.
          </p>
        </div>

        {config.npmEnabled && (
          <div className="npm-connections">
            <div className="subsection-header">
              <h4>NPM Connections</h4>
              <button onClick={addNpmConnection} className="btn-small">Add Connection</button>
            </div>

            {config.npmConnections.length === 0 ? (
              <p className="empty-state">No NPM connections configured</p>
            ) : (
              config.npmConnections.map((conn, index) => {
                const validation = validationResults.find(v => v.index === index)
                const status = !validation && conn.status
                return (
                  <div key={index} className="npm-connection-item">
                    <div className="form-group">
                      <label>Connection Name</label>
                      <input
                        type="text"
                        value={conn.name ?? ''}
                        onChange={(e) => updateNpmConnection(index, 'name', e.target.value)}
                        placeholder="e.g., Main NPM Server"
                      />
                    </div>

                    <div className="form-group">
                      <label>NPM URL</label>
                      <input
                        type="text"
                        value={conn.url ?? ''}
                        onChange={(e) => updateNpmConnection(index, 'url', e.target.value)}
                        placeholder="http://nginx-proxy-manager:81"
                      />
                    </div>

                    <div className="form-group">
                      <label>Username (Email)</label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={conn.username ?? ''}
                        onChange={(e) => updateNpmConnection(index, 'username', e.target.value)}
                        placeholder="admin@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={conn.password ?? ''}
                        onChange={(e) => updateNpmConnection(index, 'password', e.target.value)}
                        placeholder={conn.hasPassword ? 'Saved, leave empty to keep it' : 'Your NPM password'}
                      />
                    </div>

                    {validation && (
                      <div className={`validation-status ${validation.valid ? 'success' : 'error'}`}>
                        {validation.valid ? '✓ Connection validated successfully' : `✗ ${validation.error}`}
                      </div>
                    )}
                    {status && (
                      <div className={`validation-status ${status.error ? 'error' : 'success'}`}>
                        {status.error
                          ? `✗ Last fetch failed: ${status.error}`
                          : `✓ ${status.count} proxy host${status.count === 1 ? '' : 's'} discovered`}
                      </div>
                    )}

                    <button onClick={() => removeNpmConnection(index)} className="btn-danger btn-small">
                      Remove Connection
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      <div className="config-footer">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}

export default ConfigManager
