import { useState } from 'react'
import { getImageUrl, posterSize, PLATFORMS } from '../services/tmdb'
import { useAuth } from '../hooks/useAuth'
import MovieDetailModal from './MovieDetailModal'
import './WatchlistCard.css'

const WatchlistCard = ({ item, showActions = true }) => {
  const { user, addToWatchlist, getWatchlistStatus } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const status = getWatchlistStatus(item.id)
  const posterUrl = getImageUrl(item.posterPath, posterSize.medium)
  const platform = item.platform ? PLATFORMS[item.platform] : null

  const formatDate = (dateString) => {
    if (!dateString) return 'TBA'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleAction = async (newStatus) => {
    if (!user) return
    setIsLoading(true)
    try {
      await addToWatchlist({
        tmdb_id: item.id,
        media_type: item.mediaType,
        status: newStatus,
      })
    } catch (error) {
      console.error('Error updating watchlist:', error)
    } finally {
      setIsLoading(false)
      setShowMenu(false)
    }
  }

  const getStatusBadge = () => {
    if (!status) return null
    const badges = {
      want_to_watch: { label: 'Want to Watch', class: 'badge-want' },
      watched: { label: 'Watched', class: 'badge-watched' },
      not_interested: { label: 'Not Interested', class: 'badge-not' },
    }
    const badge = badges[status]
    return badge ? (
      <span className={`status-badge ${badge.class}`}>{badge.label}</span>
    ) : null
  }

  const handleCardClick = (e) => {
    // Don't open modal if clicking on action buttons
    if (e.target.closest('.card-overlay') || e.target.closest('.action-menu')) {
      return
    }
    setShowModal(true)
  }

  return (
    <>
    <div className="watchlist-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="card-poster">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            loading="lazy"
          />
        ) : (
          <div className="poster-placeholder">
            <span>No Image</span>
          </div>
        )}

        {platform && (
          <span
            className="platform-badge"
            style={{ backgroundColor: platform.color }}
          >
            {platform.name}
          </span>
        )}

        {item.voteAverage > 0 && (
          <span className="rating-badge">
            &#9733; {item.voteAverage.toFixed(1)}
          </span>
        )}

        {showActions && user && (
          <div className="card-overlay">
            <button
              className="overlay-btn"
              onClick={() => setShowMenu(!showMenu)}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="spinner-small"></span>
              ) : (
                '+'
              )}
            </button>

            {showMenu && (
              <div className="action-menu">
                <button
                  className={`action-item ${status === 'want_to_watch' ? 'active' : ''}`}
                  onClick={() => handleAction('want_to_watch')}
                >
                  &#128278; Want to Watch
                </button>
                <button
                  className={`action-item ${status === 'watched' ? 'active' : ''}`}
                  onClick={() => handleAction('watched')}
                >
                  &#9989; Watched
                </button>
                <button
                  className={`action-item ${status === 'not_interested' ? 'active' : ''}`}
                  onClick={() => handleAction('not_interested')}
                >
                  &#128683; Not Interested
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title">{item.title}</h3>
        <div className="card-meta">
          <span className="card-date">{formatDate(item.releaseDate)}</span>
          <span className="card-type">
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
        </div>
        {getStatusBadge()}
      </div>
    </div>

    {showModal && (
      <MovieDetailModal
        item={item}
        onClose={() => setShowModal(false)}
      />
    )}
    </>
  )
}

export default WatchlistCard
