import { useState, useEffect } from 'react'

function ConfigManager() {
  const [config, setConfig] = useState({
    baseUrl: '',
    npmEnabled: false,
    npmConnections: []
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const response = await fetch('/api/admin/config')
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.error('Failed to load config:', error)
      alert('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        alert('Configuration saved successfully! Please restart both servers for changes to take effect.')
      } else {
        alert('Failed to save configuration')
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
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
      npmConnections: [
        ...prev.npmConnections,
        {
          url: '',
          token: '',
          name: ''
        }
      ]
    }))
  }

  function updateNpmConnection(index, field, value) {
    setConfig(prev => ({
      ...prev,
      npmConnections: prev.npmConnections.map((conn, i) =>
        i === index ? { ...conn, [field]: value } : conn
      )
    }))
  }

  function removeNpmConnection(index) {
    setConfig(prev => ({
      ...prev,
      npmConnections: prev.npmConnections.filter((_, i) => i !== index)
    }))
  }

  if (loading) {
    return <div className="loading">Loading configuration...</div>
  }

  return (
    <div className="config-manager">
      <div className="manager-header">
        <h2>Configuration</h2>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="config-section">
        <h3>General Settings</h3>
        <div className="form-group">
          <label>Base Domain</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => updateConfig('baseUrl', e.target.value)}
            placeholder="e.g., example.com"
          />
          <p className="help-text">
            Services with appendBaseDomain=true will append this domain to their URL
          </p>
        </div>
      </div>

      <div className="config-section">
        <h3>Nginx Proxy Manager Integration</h3>
        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={config.npmEnabled}
              onChange={(e) => updateConfig('npmEnabled', e.target.checked)}
            />
            Enable NPM auto-discovery
          </label>
          <p className="help-text">
            Automatically discover services from Nginx Proxy Manager instances
          </p>
        </div>

        {config.npmEnabled && (
          <div className="npm-connections">
            <div className="subsection-header">
              <h4>NPM Connections</h4>
              <button onClick={addNpmConnection} className="btn-small">
                Add Connection
              </button>
            </div>

            {config.npmConnections && config.npmConnections.length === 0 ? (
              <p className="empty-state">No NPM connections configured</p>
            ) : (
              config.npmConnections?.map((conn, index) => (
                <div key={index} className="npm-connection-item">
                  <div className="form-group">
                    <label>Connection Name</label>
                    <input
                      type="text"
                      value={conn.name}
                      onChange={(e) => updateNpmConnection(index, 'name', e.target.value)}
                      placeholder="e.g., Main NPM Server"
                    />
                  </div>

                  <div className="form-group">
                    <label>NPM URL</label>
                    <input
                      type="text"
                      value={conn.url}
                      onChange={(e) => updateNpmConnection(index, 'url', e.target.value)}
                      placeholder="https://npm.example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>API Token</label>
                    <input
                      type="password"
                      value={conn.token}
                      onChange={(e) => updateNpmConnection(index, 'token', e.target.value)}
                      placeholder="Your NPM API token"
                    />
                  </div>

                  <button
                    onClick={() => removeNpmConnection(index)}
                    className="btn-danger btn-small"
                  >
                    Remove Connection
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="config-footer">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}

export default ConfigManager
