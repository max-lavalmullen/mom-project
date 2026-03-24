import { GENRES } from '../services/tmdb'
import './GenreFilter.css'

const GenreFilter = ({
  selected = [],
  onChange,
  mediaType = 'movie',
  multiSelect = true,
}) => {
  const genres = GENRES[mediaType] || GENRES.movie

  const handleClick = (genreId) => {
    if (multiSelect) {
      if (selected.includes(genreId)) {
        onChange(selected.filter(g => g !== genreId))
      } else {
        onChange([...selected, genreId])
      }
    } else {
      onChange(selected.includes(genreId) ? [] : [genreId])
    }
  }

  return (
    <div className="genre-filter">
      <button
        className={`genre-chip ${selected.length === 0 ? 'active' : ''}`}
        onClick={() => onChange([])}
      >
        All Genres
      </button>
      {genres.map((genre) => (
        <button
          key={genre.id}
          className={`genre-chip ${selected.includes(genre.id) ? 'active' : ''}`}
          onClick={() => handleClick(genre.id)}
        >
          {genre.name}
        </button>
      ))}
    </div>
  )
}

export default GenreFilter
