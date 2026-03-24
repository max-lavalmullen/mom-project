import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  getLetterboxdConnection,
  syncLetterboxd,
  removeLetterboxdConnection,
} from '../services/letterboxd'
import './LetterboxdConnect.css'

const LetterboxdConnect = () => {
  const { user, refreshUserData } = useAuth()

  const [username, setUsername] = useState('')
  const [connection, setConnection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Load existing connection
  useEffect(() => {
    const loadConnection = async () => {
      if (!user) return

      const { data, error } = await getLetterboxdConnection(user.id)
      if (!error && data) {
        setConnection(data)
        setUsername(data.username)
      }
      setLoading(false)
    }

    loadConnection()
  }, [user])

  const handleSync = async () => {
    if (!username.trim()) {
      setError('Please enter a Letterboxd username')
      return
    }

    setSyncing(true)
    setError(null)
    setResult(null)
    setProgress({ current: 0, total: 0, status: 'Starting...' })

    const syncResult = await syncLetterboxd(
      user.id,
      username.trim(),
      (current, total, status) => {
        setProgress({ current, total, status })
      }
    )

    if (syncResult.error) {
      setError(syncResult.error.message)
    } else {
      setResult(syncResult)
      setConnection({ username: username.trim(), lastSyncAt: new Date().toISOString() })
      await refreshUserData()
    }

    setSyncing(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Letterboxd account?')) {
      return
    }

    setLoading(true)
    const { error } = await removeLetterboxdConnection(user.id)

    if (error) {
      setError(error.message)
    } else {
      setConnection(null)
      setUsername('')
      setResult(null)
    }
    setLoading(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="letterboxd-connect">
        <div className="letterboxd-loading">
          <div className="spinner-small"></div>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="letterboxd-connect">
      <div className="letterboxd-header">
        <div className="letterboxd-logo">
          <span className="logo-icon">L</span>
          <span>Letterboxd</span>
        </div>
        {connection && (
          <span className="connected-badge">Connected</span>
        )}
      </div>

      {connection ? (
        <div className="letterboxd-connected">
          <div className="connection-info">
            <p className="connection-username">@{connection.username}</p>
            <p className="connection-sync">Last synced: {formatDate(connection.lastSyncAt)}</p>
          </div>

          {syncing ? (
            <div className="sync-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: progress.total > 0
                      ? `${(progress.current / progress.total) * 100}%`
                      : '0%'
                  }}
                />
              </div>
              <p className="progress-status">{progress.status}</p>
              {progress.total > 0 && (
                <p className="progress-count">
                  {progress.current} / {progress.total}
                </p>
              )}
            </div>
          ) : (
            <div className="connection-actions">
              <button
                className="btn btn-primary"
                onClick={handleSync}
              >
                Sync Now
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="letterboxd-form">
          <p className="form-description">
            Import your watched movies from Letterboxd to build your rankings.
          </p>

          <div className="input-group">
            <span className="input-prefix">letterboxd.com/</span>
            <input
              type="text"
              className="form-input"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={syncing}
            />
          </div>

          {syncing ? (
            <div className="sync-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: progress.total > 0
                      ? `${(progress.current / progress.total) * 100}%`
                      : '0%'
                  }}
                />
              </div>
              <p className="progress-status">{progress.status}</p>
              {progress.total > 0 && (
                <p className="progress-count">
                  {progress.current} / {progress.total}
                </p>
              )}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={handleSync}
              disabled={!username.trim()}
            >
              Connect & Import
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="letterboxd-error">
          {error}
        </div>
      )}

      {result && (
        <div className="letterboxd-result">
          <p>
            <strong>{result.imported}</strong> movies imported
            {result.reviewsImported > 0 && (
              <span> with <strong>{result.reviewsImported}</strong> reviews</span>
            )}
          </p>
          <p className="result-detail">
            {result.matched} matched, {result.skipped} skipped
          </p>
        </div>
      )}
    </div>
  )
}

export default LetterboxdConnect
