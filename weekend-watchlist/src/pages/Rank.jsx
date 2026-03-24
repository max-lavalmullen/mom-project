import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ComparisonCard from '../components/ComparisonCard'
import { getNextPair, recordComparison, getComparisonStats } from '../services/comparison'
import { getMovieDetails, getTVDetails, normalizeMedia } from '../services/tmdb'
import './Rank.css'

const Rank = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading, watchlist, refreshUserData } = useAuth()

  const [mediaTypeFilter, setMediaTypeFilter] = useState(null) // null = all
  const [currentPair, setCurrentPair] = useState(null)
  const [itemDetails, setItemDetails] = useState({ item1: null, item2: null })
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [stats, setStats] = useState({ totalComparisons: 0, watchedCount: 0 })
  const [error, setError] = useState(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Load comparison stats
  const loadStats = useCallback(async () => {
    if (!user) return
    const { data } = await getComparisonStats(user.id)
    if (data) {
      setStats(data)
    }
  }, [user])

  // Load next pair
  const loadNextPair = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    setSelected(null)

    try {
      const { data: pair, error: pairError } = await getNextPair(user.id, mediaTypeFilter)

      if (pairError) {
        setError(pairError.message)
        setCurrentPair(null)
        setItemDetails({ item1: null, item2: null })
        setLoading(false)
        return
      }

      setCurrentPair(pair)

      // Fetch full details for both items
      if (pair) {
        const [details1, details2] = await Promise.all([
          pair.item1.media_type === 'movie'
            ? getMovieDetails(pair.item1.tmdb_id)
            : getTVDetails(pair.item1.tmdb_id),
          pair.item2.media_type === 'movie'
            ? getMovieDetails(pair.item2.tmdb_id)
            : getTVDetails(pair.item2.tmdb_id),
        ])

        setItemDetails({
          item1: {
            ...normalizeMedia(details1, pair.item1.media_type),
            ...pair.item1,
          },
          item2: {
            ...normalizeMedia(details2, pair.item2.media_type),
            ...pair.item2,
          },
        })
      }
    } catch (err) {
      console.error('Error loading pair:', err)
      setError('Failed to load comparison')
    } finally {
      setLoading(false)
    }
  }, [user, mediaTypeFilter])

  // Initial load
  useEffect(() => {
    if (user) {
      loadNextPair()
      loadStats()
    }
  }, [user, mediaTypeFilter, loadNextPair, loadStats])

  // Handle selection
  const handleSelect = async (winner) => {
    if (comparing || !currentPair) return

    setSelected(winner.tmdb_id)
    setComparing(true)

    try {
      const loser = winner.tmdb_id === currentPair.item1.tmdb_id
        ? currentPair.item2
        : currentPair.item1

      await recordComparison(user.id, winner, loser)

      // Update local watchlist state
      await refreshUserData()

      // Update stats
      setStats(prev => ({
        ...prev,
        totalComparisons: prev.totalComparisons + 1,
      }))

      // Brief delay to show selection, then load next
      setTimeout(() => {
        loadNextPair()
        setComparing(false)
      }, 500)
    } catch (err) {
      console.error('Error recording comparison:', err)
      setError('Failed to save comparison')
      setComparing(false)
    }
  }

  // Handle skip
  const handleSkip = () => {
    loadNextPair()
  }

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!user) return null

  const watchedCount = watchlist.filter(w => w.status === 'watched').length

  return (
    <div className="rank-page">
      <div className="container">
        <div className="rank-header">
          <div className="rank-title-section">
            <h1>Rank Your Favorites</h1>
            <p className="rank-subtitle">
              Which do you prefer? Your choices build a personalized ranking.
            </p>
          </div>

          <div className="rank-stats">
            <div className="stat">
              <span className="stat-value">{stats.totalComparisons}</span>
              <span className="stat-label">Comparisons</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.watchedCount || watchedCount}</span>
              <span className="stat-label">Watched</span>
            </div>
          </div>
        </div>

        <div className="rank-filters">
          <button
            className={`filter-btn ${mediaTypeFilter === null ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter(null)}
          >
            All
          </button>
          <button
            className={`filter-btn ${mediaTypeFilter === 'movie' ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter('movie')}
          >
            Movies
          </button>
          <button
            className={`filter-btn ${mediaTypeFilter === 'tv' ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter('tv')}
          >
            TV Shows
          </button>
        </div>

        {loading ? (
          <div className="rank-loading">
            <div className="spinner"></div>
            <p>Loading comparison...</p>
          </div>
        ) : error ? (
          <div className="rank-error">
            <p>{error}</p>
            {watchedCount < 2 && (
              <p className="error-hint">
                You need at least 2 watched items to start ranking.{' '}
                <Link to="/discover">Discover movies</Link> and mark them as watched!
              </p>
            )}
          </div>
        ) : currentPair && itemDetails.item1 && itemDetails.item2 ? (
          <>
            <div className="comparison-container">
              <ComparisonCard
                item={itemDetails.item1}
                onSelect={() => handleSelect(currentPair.item1)}
                disabled={comparing}
                isSelected={selected === currentPair.item1.tmdb_id}
              />

              <div className="comparison-vs">
                <span>VS</span>
              </div>

              <ComparisonCard
                item={itemDetails.item2}
                onSelect={() => handleSelect(currentPair.item2)}
                disabled={comparing}
                isSelected={selected === currentPair.item2.tmdb_id}
              />
            </div>

            <div className="rank-actions">
              <button
                className="skip-btn"
                onClick={handleSkip}
                disabled={comparing}
              >
                Skip this pair
              </button>
            </div>
          </>
        ) : (
          <div className="rank-empty">
            <p>No items to compare.</p>
            <p className="empty-hint">
              Mark more items as watched to enable ranking!
            </p>
          </div>
        )}

        {stats.totalComparisons >= 10 && (
          <div className="rank-cta">
            <Link to="/rankings" className="btn btn-primary">
              View Your Rankings
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Rank
