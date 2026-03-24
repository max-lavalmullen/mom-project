import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getImageUrl, posterSize, backdropSize, getMovieDetails, getTVDetails, PLATFORMS } from '../services/tmdb'
import { useAuth } from '../hooks/useAuth'
import { predictUserRating } from '../services/ratingPredictor'
import './MovieDetailModal.css'

const MovieDetailModal = ({ item, onClose }) => {
  const { user, userPreferences, addToWatchlist, getWatchlistStatus, preferenceProfile } = useAuth()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [predictedRating, setPredictedRating] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const status = getWatchlistStatus(item.id)

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true)
      try {
        const data = item.mediaType === 'movie'
          ? await getMovieDetails(item.id)
          : await getTVDetails(item.id)
        setDetails(data)

        // Predict rating if user has preferences
        if (user && preferenceProfile) {
          const prediction = predictUserRating(data, preferenceProfile, userPreferences)
          setPredictedRating(prediction)
        }
      } catch (error) {
        console.error('Error fetching details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [item.id, item.mediaType, user, preferenceProfile, userPreferences])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleAction = async (newStatus) => {
    if (!user) return
    setActionLoading(true)
    try {
      await addToWatchlist({
        tmdb_id: item.id,
        media_type: item.mediaType,
        status: newStatus,
      })
    } catch (error) {
      console.error('Error updating watchlist:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const formatRuntime = (minutes) => {
    if (!minutes) return null
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  }

  const formatYear = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).getFullYear()
  }

  const getUSProviders = () => {
    if (!details?.['watch/providers']?.results?.US) return null
    return details['watch/providers'].results.US
  }

  const getCast = () => {
    return details?.credits?.cast?.slice(0, 8) || []
  }

  const getDirector = () => {
    return details?.credits?.crew?.find(c => c.job === 'Director')
  }

  const getTrailer = () => {
    const videos = details?.videos?.results || []
    return videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
  }

  const backdropUrl = getImageUrl(details?.backdrop_path || item.backdropPath, backdropSize.large)
  const posterUrl = getImageUrl(details?.poster_path || item.posterPath, posterSize.large)
  const providers = getUSProviders()
  const cast = getCast()
  const director = getDirector()
  const trailer = getTrailer()

  const modalContent = (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        {loading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {/* Hero Section with Backdrop */}
            <div className="modal-hero" style={{ backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none' }}>
              <div className="hero-gradient">
                <div className="hero-content">
                  <div className="hero-poster">
                    {posterUrl ? (
                      <img src={posterUrl} alt={item.title} />
                    ) : (
                      <div className="poster-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="hero-info">
                    <h1 className="modal-title">{details?.title || details?.name || item.title}</h1>
                    <div className="modal-meta">
                      <span>{formatYear(details?.release_date || details?.first_air_date)}</span>
                      {details?.runtime && <span>{formatRuntime(details.runtime)}</span>}
                      {details?.number_of_seasons && (
                        <span>{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''}</span>
                      )}
                      <span className="media-type-badge">
                        {item.mediaType === 'movie' ? 'Movie' : 'TV Series'}
                      </span>
                    </div>

                    {/* Ratings Row */}
                    <div className="ratings-row">
                      {details?.vote_average > 0 && (
                        <div className="rating-item">
                          <span className="rating-label">TMDb</span>
                          <span className="rating-value">
                            <span className="star">★</span>
                            {details.vote_average.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {predictedRating && (
                        <div className="rating-item predicted">
                          <span className="rating-label">Predicted for You</span>
                          <span className="rating-value">
                            <span className="star">★</span>
                            {predictedRating.score.toFixed(1)}
                            <span className="confidence">({predictedRating.confidence}% match)</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Genres */}
                    {details?.genres?.length > 0 && (
                      <div className="genre-tags">
                        {details.genres.map(genre => (
                          <span key={genre.id} className="genre-tag">{genre.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="modal-body">
              {/* Actions */}
              {user && (
                <div className="action-buttons">
                  <button
                    className={`action-btn want ${status === 'want_to_watch' ? 'active' : ''}`}
                    onClick={() => handleAction('want_to_watch')}
                    disabled={actionLoading}
                  >
                    <span className="btn-icon">📋</span>
                    {status === 'want_to_watch' ? 'On Watchlist' : 'Add to Watchlist'}
                  </button>
                  <button
                    className={`action-btn watched ${status === 'watched' ? 'active' : ''}`}
                    onClick={() => handleAction('watched')}
                    disabled={actionLoading}
                  >
                    <span className="btn-icon">✓</span>
                    {status === 'watched' ? 'Watched' : 'Mark as Watched'}
                  </button>
                  <button
                    className={`action-btn not-interested ${status === 'not_interested' ? 'active' : ''}`}
                    onClick={() => handleAction('not_interested')}
                    disabled={actionLoading}
                  >
                    <span className="btn-icon">✕</span>
                    Not Interested
                  </button>
                </div>
              )}

              {/* Overview */}
              {details?.overview && (
                <div className="section">
                  <h3>Overview</h3>
                  <p className="overview-text">{details.overview}</p>
                </div>
              )}

              {/* Where to Watch */}
              {providers && (
                <div className="section">
                  <h3>Where to Watch</h3>
                  <div className="providers-grid">
                    {providers.flatrate?.map(p => (
                      <div key={p.provider_id} className="provider-item">
                        <img
                          src={getImageUrl(p.logo_path, 'w92')}
                          alt={p.provider_name}
                          title={p.provider_name}
                        />
                        <span className="provider-type">Stream</span>
                      </div>
                    ))}
                    {providers.rent?.slice(0, 4).map(p => (
                      <div key={`rent-${p.provider_id}`} className="provider-item rent">
                        <img
                          src={getImageUrl(p.logo_path, 'w92')}
                          alt={p.provider_name}
                          title={p.provider_name}
                        />
                        <span className="provider-type">Rent</span>
                      </div>
                    ))}
                    {providers.buy?.slice(0, 4).map(p => (
                      <div key={`buy-${p.provider_id}`} className="provider-item buy">
                        <img
                          src={getImageUrl(p.logo_path, 'w92')}
                          alt={p.provider_name}
                          title={p.provider_name}
                        />
                        <span className="provider-type">Buy</span>
                      </div>
                    ))}
                  </div>
                  {!providers.flatrate && !providers.rent && !providers.buy && (
                    <p className="no-providers">Not currently available for streaming in the US</p>
                  )}
                </div>
              )}

              {/* Cast & Crew */}
              {(cast.length > 0 || director) && (
                <div className="section">
                  <h3>Cast & Crew</h3>
                  {director && (
                    <div className="director-info">
                      <span className="crew-label">Director:</span>
                      <span className="crew-name">{director.name}</span>
                    </div>
                  )}
                  <div className="cast-grid">
                    {cast.map(person => (
                      <div key={person.id} className="cast-item">
                        <div className="cast-photo">
                          {person.profile_path ? (
                            <img
                              src={getImageUrl(person.profile_path, 'w185')}
                              alt={person.name}
                            />
                          ) : (
                            <div className="no-photo">
                              {person.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="cast-info">
                          <span className="cast-name">{person.name}</span>
                          <span className="cast-character">{person.character}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailer && (
                <div className="section">
                  <h3>Trailer</h3>
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="trailer-link"
                  >
                    <span className="play-icon">▶</span>
                    Watch Trailer on YouTube
                  </a>
                </div>
              )}

              {/* Similar Content */}
              {details?.similar?.results?.length > 0 && (
                <div className="section">
                  <h3>Similar {item.mediaType === 'movie' ? 'Movies' : 'Shows'}</h3>
                  <div className="similar-grid">
                    {details.similar.results.slice(0, 6).map(similar => (
                      <div key={similar.id} className="similar-item">
                        {similar.poster_path ? (
                          <img
                            src={getImageUrl(similar.poster_path, posterSize.small)}
                            alt={similar.title || similar.name}
                          />
                        ) : (
                          <div className="similar-placeholder">
                            {(similar.title || similar.name).charAt(0)}
                          </div>
                        )}
                        <span className="similar-title">{similar.title || similar.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why We Recommend */}
              {predictedRating?.reasons?.length > 0 && (
                <div className="section">
                  <h3>Why We Think You'll Like This</h3>
                  <ul className="reasons-list">
                    {predictedRating.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default MovieDetailModal
