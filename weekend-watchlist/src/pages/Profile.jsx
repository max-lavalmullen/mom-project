import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import WatchlistCard from '../components/WatchlistCard'
import UserPreferences from '../components/UserPreferences'
import LetterboxdConnect from '../components/LetterboxdConnect'
import EloStars from '../components/EloStars'
import ReviewDisplay from '../components/ReviewDisplay'
import { PlatformImporter } from '../components/onboarding'
import { PLATFORMS, GENRES, getMovieDetails, getTVDetails, normalizeMedia } from '../services/tmdb'
import { PLATFORM_IMPORT_INFO } from '../services/parsers'
import { importFromPlatform, getImportStatuses } from '../services/platformImport'
import { getUserPlatformImports } from '../services/supabase'
import './Profile.css'

const Profile = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading, userPreferences, watchlist, allEloScores, updateWatchlist, removeFromWatchlist } = useAuth()

  const [activeTab, setActiveTab] = useState('watchlist')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showEditPrefs, setShowEditPrefs] = useState(false)
  const [watchlistDetails, setWatchlistDetails] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [savingReviewId, setSavingReviewId] = useState(null)
  const [platformImports, setPlatformImports] = useState({})
  const [loadingImports, setLoadingImports] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Load platform import statuses
  useEffect(() => {
    const loadImportStatuses = async () => {
      if (!user) return
      setLoadingImports(true)
      try {
        const statuses = await getImportStatuses(user.id)
        setPlatformImports(statuses)
      } catch (error) {
        console.error('Error loading import statuses:', error)
      } finally {
        setLoadingImports(false)
      }
    }
    if (activeTab === 'import') {
      loadImportStatuses()
    }
  }, [user, activeTab])

  // Fetch watchlist item details
  useEffect(() => {
    const fetchDetails = async () => {
      if (watchlist.length === 0) {
        setWatchlistDetails([])
        return
      }

      setLoadingDetails(true)
      try {
        const details = await Promise.all(
          watchlist.map(async (item) => {
            try {
              const data = item.media_type === 'movie'
                ? await getMovieDetails(item.tmdb_id)
                : await getTVDetails(item.tmdb_id)

              return {
                ...normalizeMedia(data, item.media_type),
                status: item.status,
                rating: item.rating,
                elo_score: item.elo_score,
                comparison_count: item.comparison_count,
                review: item.review,
                review_updated_at: item.review_updated_at,
              }
            } catch (error) {
              console.error(`Error fetching details for ${item.tmdb_id}:`, error)
              return null
            }
          })
        )

        setWatchlistDetails(details.filter(Boolean))
      } catch (error) {
        console.error('Error fetching watchlist details:', error)
      } finally {
        setLoadingDetails(false)
      }
    }

    fetchDetails()
  }, [watchlist])

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!user) return null

  // Filter watchlist by status
  const filteredWatchlist = statusFilter === 'all'
    ? watchlistDetails
    : watchlistDetails.filter(item => item.status === statusFilter)

  const getGenreName = (genreId) => {
    const genre = [...GENRES.movie, ...GENRES.tv].find(g => g.id === genreId)
    return genre?.name || 'Unknown'
  }

  const handleRating = async (tmdbId, rating) => {
    await updateWatchlist(tmdbId, { rating })
  }

  const handleRemove = async (tmdbId) => {
    await removeFromWatchlist(tmdbId)
  }

  const handleSaveReview = async (tmdbId, review) => {
    setSavingReviewId(tmdbId)
    try {
      await updateWatchlist(tmdbId, {
        review: review || null,
        review_updated_at: review ? new Date().toISOString() : null,
      })
      // Update local state
      setWatchlistDetails(prev =>
        prev.map(item =>
          item.id === tmdbId
            ? { ...item, review, review_updated_at: new Date().toISOString() }
            : item
        )
      )
    } catch (error) {
      console.error('Error saving review:', error)
    } finally {
      setSavingReviewId(null)
    }
  }

  const stats = {
    total: watchlist.length,
    wantToWatch: watchlist.filter(w => w.status === 'want_to_watch').length,
    watched: watchlist.filter(w => w.status === 'watched').length,
    notInterested: watchlist.filter(w => w.status === 'not_interested').length,
  }

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header">
          <div className="profile-info">
            <div className="profile-avatar">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1>My Profile</h1>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('watchlist')}
          >
            My Watchlist
          </button>
          <button
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import
          </button>
          <button
            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
        </div>

        {activeTab === 'watchlist' && (
          <div className="watchlist-section">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.wantToWatch}</span>
                <span className="stat-label">Want to Watch</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.watched}</span>
                <span className="stat-label">Watched</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.notInterested}</span>
                <span className="stat-label">Not Interested</span>
              </div>
            </div>

            <div className="status-filter">
              <button
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${statusFilter === 'want_to_watch' ? 'active' : ''}`}
                onClick={() => setStatusFilter('want_to_watch')}
              >
                Want to Watch
              </button>
              <button
                className={`filter-btn ${statusFilter === 'watched' ? 'active' : ''}`}
                onClick={() => setStatusFilter('watched')}
              >
                Watched
              </button>
              <button
                className={`filter-btn ${statusFilter === 'not_interested' ? 'active' : ''}`}
                onClick={() => setStatusFilter('not_interested')}
              >
                Not Interested
              </button>
            </div>

            {loadingDetails ? (
              <div className="page-loading">
                <div className="spinner"></div>
              </div>
            ) : filteredWatchlist.length === 0 ? (
              <div className="empty-state">
                <p>No items in your watchlist yet.</p>
                <p className="empty-hint">
                  Browse the Discover page to find shows and movies to add!
                </p>
              </div>
            ) : (
              <div className="watchlist-grid">
                {filteredWatchlist.map((item) => (
                  <div key={item.id} className="watchlist-item-card">
                    <WatchlistCard item={item} showActions={false} />
                    <div className="item-actions">
                      {item.status === 'watched' && (
                        <>
                          <div className="rating-section">
                            <span className="rating-label">Your ranking:</span>
                            <EloStars
                              eloScore={item.elo_score || 1500}
                              allElos={allEloScores}
                              showElo={false}
                            />
                          </div>
                          <div className="review-section">
                            <ReviewDisplay
                              review={item.review}
                              reviewUpdatedAt={item.review_updated_at}
                              onSave={(review) => handleSaveReview(item.id, review)}
                              saving={savingReviewId === item.id}
                            />
                          </div>
                        </>
                      )}
                      <button
                        className="remove-btn"
                        onClick={() => handleRemove(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stats.watched >= 2 && (
              <div className="rank-cta-section">
                <Link to="/rank" className="btn btn-primary">
                  Rank Your Watched Items
                </Link>
                <Link to="/rankings" className="btn btn-secondary">
                  View Rankings
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="import-section">
            <h2>Import Watch History</h2>
            <p className="import-description">
              Import your watch history from streaming platforms to get better recommendations.
            </p>

            {/* Platform Import Status Overview */}
            <div className="import-status-grid">
              {userPreferences.platforms?.map(platformKey => {
                const info = PLATFORM_IMPORT_INFO[platformKey]
                const importStatus = platformImports[platformKey]
                if (!info) return null

                return (
                  <div
                    key={platformKey}
                    className={`import-status-card ${importStatus?.status === 'completed' ? 'imported' : ''}`}
                  >
                    <div className="import-status-header">
                      <span
                        className="platform-dot"
                        style={{ backgroundColor: info.color }}
                      />
                      <span className="platform-name">{info.name}</span>
                      {importStatus?.status === 'completed' && (
                        <span className="import-badge success">Imported</span>
                      )}
                    </div>
                    {importStatus?.status === 'completed' ? (
                      <p className="import-status-detail">
                        {importStatus.itemsMatched} of {importStatus.itemsImported} items matched
                        {importStatus.lastImport && (
                          <> &middot; {new Date(importStatus.lastImport).toLocaleDateString()}</>
                        )}
                      </p>
                    ) : (
                      <p className="import-status-detail">
                        {info.dataAvailability === 'quick' ? 'Ready to import' : `Data request required (${info.estimatedTime})`}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Platform Importer Component */}
            {userPreferences.platforms?.length > 0 && (
              <div className="import-uploader">
                <h3>Upload Data</h3>
                <PlatformImporter
                  platforms={userPreferences.platforms}
                  onImport={async (platform, content, fileType, onProgress) => {
                    const result = await importFromPlatform(user.id, platform, content, fileType, onProgress)
                    // Refresh statuses after import
                    const statuses = await getImportStatuses(user.id)
                    setPlatformImports(statuses)
                    return result
                  }}
                  importStatuses={Object.fromEntries(
                    Object.entries(platformImports).map(([k, v]) => [k, {
                      stage: v?.status === 'completed' ? 'complete' : v?.status,
                      ...v
                    }])
                  )}
                />
              </div>
            )}

            {/* Letterboxd Section */}
            <div className="letterboxd-section">
              <h3>Letterboxd</h3>
              <p className="import-description">
                Connect your Letterboxd account to import your watched movies and ratings.
              </p>
              <LetterboxdConnect />
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="preferences-section">
            {showEditPrefs ? (
              <UserPreferences onComplete={() => setShowEditPrefs(false)} />
            ) : (
              <>
                <div className="pref-card">
                  <div className="pref-header">
                    <h3>Streaming Platforms</h3>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowEditPrefs(true)}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="pref-content">
                    {userPreferences.platforms?.length > 0 ? (
                      <div className="platform-tags">
                        {userPreferences.platforms.map((key) => (
                          <span
                            key={key}
                            className="platform-tag"
                            style={{ backgroundColor: PLATFORMS[key]?.color }}
                          >
                            {PLATFORMS[key]?.name || key}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No platforms selected</p>
                    )}
                  </div>
                </div>

                <div className="pref-card">
                  <div className="pref-header">
                    <h3>Favorite Genres</h3>
                  </div>
                  <div className="pref-content">
                    {userPreferences.genres?.length > 0 ? (
                      <div className="genre-tags">
                        {userPreferences.genres.map((g) => (
                          <span key={g.genre_id} className="genre-tag">
                            {getGenreName(g.genre_id)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No genres selected</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
