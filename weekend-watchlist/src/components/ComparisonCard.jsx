import { getImageUrl, posterSize } from '../services/tmdb'
import './ComparisonCard.css'

const ComparisonCard = ({ item, onSelect, disabled = false, isSelected = false }) => {
  const posterUrl = getImageUrl(item.posterPath, posterSize.large)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.getFullYear()
  }

  return (
    <div className={`comparison-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="comparison-poster">
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
      </div>

      <div className="comparison-info">
        <h3 className="comparison-title">{item.title}</h3>
        <div className="comparison-meta">
          <span className="comparison-year">{formatDate(item.releaseDate)}</span>
          <span className="comparison-type">
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
        </div>
      </div>

      <button
        className={`comparison-select-btn ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(item)}
        disabled={disabled}
      >
        {isSelected ? 'Selected!' : 'Choose This'}
      </button>
    </div>
  )
}

export default ComparisonCard
