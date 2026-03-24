import { useState, useEffect } from 'react'
import { PLATFORMS, GENRES } from '../services/tmdb'
import { useAuth } from '../hooks/useAuth'
import './UserPreferences.css'

const UserPreferences = ({ onComplete }) => {
  const { userPreferences, updatePlatforms, updateGenres } = useAuth()
  const [step, setStep] = useState(1)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGenres, setSelectedGenres] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Initialize with existing preferences
  useEffect(() => {
    if (userPreferences.platforms?.length > 0) {
      setSelectedPlatforms(userPreferences.platforms)
    }
    if (userPreferences.genres?.length > 0) {
      setSelectedGenres(userPreferences.genres.map(g => g.genre_id))
    }
  }, [userPreferences])

  const platforms = Object.entries(PLATFORMS)
  const genres = GENRES.movie // Use movie genres as base

  const togglePlatform = (key) => {
    setSelectedPlatforms(prev =>
      prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev, key]
    )
  }

  const toggleGenre = (genreId) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(g => g !== genreId)
        : [...prev, genreId]
    )
  }

  const handleNext = () => {
    if (step === 1 && selectedPlatforms.length === 0) {
      setError('Please select at least one platform')
      return
    }
    setError(null)
    setStep(2)
  }

  const handleBack = () => {
    setError(null)
    setStep(1)
  }

  const handleSave = async () => {
    if (selectedGenres.length === 0) {
      setError('Please select at least one genre')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updatePlatforms(selectedPlatforms)
      await updateGenres(selectedGenres.map(id => ({ id, weight: 1 })))

      if (onComplete) {
        onComplete()
      }
    } catch (err) {
      setError('Failed to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="preferences-container">
      <div className="preferences-header">
        <h2>Set Up Your Preferences</h2>
        <p>Help us personalize your recommendations</p>
        <div className="step-indicator">
          <span className={`step ${step >= 1 ? 'active' : ''}`}>1</span>
          <span className="step-line"></span>
          <span className={`step ${step >= 2 ? 'active' : ''}`}>2</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="preferences-step">
          <h3>Which streaming platforms do you use?</h3>
          <p className="step-description">
            Select all the platforms you subscribe to
          </p>

          <div className="platform-grid">
            {platforms.map(([key, platform]) => (
              <button
                key={key}
                className={`platform-option ${selectedPlatforms.includes(key) ? 'selected' : ''}`}
                style={{ '--platform-color': platform.color }}
                onClick={() => togglePlatform(key)}
              >
                <span className="platform-name">{platform.name}</span>
                {selectedPlatforms.includes(key) && (
                  <span className="check-icon">&#10003;</span>
                )}
              </button>
            ))}
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="preferences-actions">
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={selectedPlatforms.length === 0}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="preferences-step">
          <h3>What genres do you enjoy?</h3>
          <p className="step-description">
            Select your favorite genres for better recommendations
          </p>

          <div className="genre-grid">
            {genres.map((genre) => (
              <button
                key={genre.id}
                className={`genre-option ${selectedGenres.includes(genre.id) ? 'selected' : ''}`}
                onClick={() => toggleGenre(genre.id)}
              >
                {genre.name}
                {selectedGenres.includes(genre.id) && (
                  <span className="check-icon">&#10003;</span>
                )}
              </button>
            ))}
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="preferences-actions">
            <button
              className="btn btn-secondary"
              onClick={handleBack}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || selectedGenres.length === 0}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserPreferences
