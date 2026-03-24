import { GENRES } from '../../services/tmdb'
import './GenreSelect.css'

const GenreSelect = ({ selected = [], onChange, canSkip = false }) => {
  const genres = GENRES.movie // Use movie genres as base

  const toggleGenre = (genreId) => {
    if (selected.includes(genreId)) {
      onChange(selected.filter(g => g !== genreId))
    } else {
      onChange([...selected, genreId])
    }
  }

  return (
    <div className="genre-select">
      <h3>What genres do you enjoy?</h3>
      <p className="step-description">
        Select your favorite genres to help us personalize your recommendations.
        {canSkip && " You can skip this if you've imported enough watch history."}
      </p>

      <div className="genre-grid">
        {genres.map((genre) => (
          <button
            key={genre.id}
            type="button"
            className={`genre-option ${selected.includes(genre.id) ? 'selected' : ''}`}
            onClick={() => toggleGenre(genre.id)}
          >
            {genre.name}
            {selected.includes(genre.id) && (
              <span className="check-icon">&#10003;</span>
            )}
          </button>
        ))}
      </div>

      <p className="selection-count">
        {selected.length === 0
          ? canSkip ? 'Select genres or skip to finish' : 'Select at least one genre to continue'
          : `${selected.length} genre${selected.length !== 1 ? 's' : ''} selected`}
      </p>
    </div>
  )
}

export default GenreSelect
