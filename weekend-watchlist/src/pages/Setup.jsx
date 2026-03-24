import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  PlatformSelect,
  ImportSelect,
  PlatformImporter,
  GenreSelect,
} from '../components/onboarding'
import { importFromPlatform } from '../services/platformImport'
import {
  updateUserOnboarding,
  completeOnboarding,
} from '../services/supabase'
import './Setup.css'

const STEPS = {
  PLATFORMS: 1,
  IMPORT_SELECT: 2,
  IMPORT_DATA: 3,
  GENRES: 4,
}

const Setup = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading, updatePlatforms, updateGenres } = useAuth()

  const [step, setStep] = useState(STEPS.PLATFORMS)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [importPlatforms, setImportPlatforms] = useState([])
  const [selectedGenres, setSelectedGenres] = useState([])
  const [importStatuses, setImportStatuses] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Calculate if user has enough imported data to skip genres
  const hasEnoughData = Object.values(importStatuses)
    .filter(s => s?.stage === 'complete')
    .length > 0

  const canProceed = () => {
    switch (step) {
      case STEPS.PLATFORMS:
        return selectedPlatforms.length > 0
      case STEPS.IMPORT_SELECT:
        return true // Can skip
      case STEPS.IMPORT_DATA:
        return true // Can skip
      case STEPS.GENRES:
        return selectedGenres.length > 0 || hasEnoughData
      default:
        return false
    }
  }

  const handleNext = async () => {
    setError(null)

    if (step === STEPS.PLATFORMS) {
      // Save platforms selection
      await updateUserOnboarding(user.id, {
        selected_platforms: selectedPlatforms,
      })
      setStep(STEPS.IMPORT_SELECT)
    } else if (step === STEPS.IMPORT_SELECT) {
      if (importPlatforms.length === 0) {
        // Skip import, go to genres
        setStep(STEPS.GENRES)
      } else {
        await updateUserOnboarding(user.id, {
          import_platforms: importPlatforms,
        })
        setStep(STEPS.IMPORT_DATA)
      }
    } else if (step === STEPS.IMPORT_DATA) {
      setStep(STEPS.GENRES)
    } else if (step === STEPS.GENRES) {
      await handleComplete()
    }
  }

  const handleBack = () => {
    if (step === STEPS.IMPORT_SELECT) {
      setStep(STEPS.PLATFORMS)
    } else if (step === STEPS.IMPORT_DATA) {
      setStep(STEPS.IMPORT_SELECT)
    } else if (step === STEPS.GENRES) {
      if (importPlatforms.length > 0) {
        setStep(STEPS.IMPORT_DATA)
      } else {
        setStep(STEPS.IMPORT_SELECT)
      }
    }
  }

  const handleSkip = () => {
    if (step === STEPS.IMPORT_SELECT) {
      setImportPlatforms([])
      setStep(STEPS.GENRES)
    } else if (step === STEPS.IMPORT_DATA) {
      setStep(STEPS.GENRES)
    } else if (step === STEPS.GENRES && hasEnoughData) {
      handleComplete()
    }
  }

  const handleImport = async (platform, content, fileType, onProgress) => {
    const result = await importFromPlatform(user.id, platform, content, fileType, onProgress)

    if (result.success) {
      setImportStatuses(prev => ({
        ...prev,
        [platform]: { stage: 'complete', ...result },
      }))
    } else {
      setImportStatuses(prev => ({
        ...prev,
        [platform]: { stage: 'error', error: result.error },
      }))
    }

    return result
  }

  const handleComplete = async () => {
    setSaving(true)
    setError(null)

    try {
      // Save platforms
      await updatePlatforms(selectedPlatforms)

      // Save genres if selected
      if (selectedGenres.length > 0) {
        await updateGenres(selectedGenres.map(id => ({ id, weight: 1 })))
      }

      // Mark onboarding as complete
      const skippedImport = importPlatforms.length === 0
      await completeOnboarding(user.id, skippedImport)

      // Navigate to home
      navigate('/')
    } catch (err) {
      setError('Failed to save preferences. Please try again.')
      console.error('Setup error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!user) return null

  const stepLabels = ['Platforms', 'Import', 'Upload', 'Genres']
  const currentStepIndex = step - 1

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h1>Welcome to Weekend Watchlist</h1>
          <p>Let's personalize your experience</p>

          <div className="step-indicator">
            {stepLabels.map((label, idx) => (
              <div key={idx} className="step-item">
                <span className={`step-number ${idx <= currentStepIndex ? 'active' : ''} ${idx < currentStepIndex ? 'completed' : ''}`}>
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </span>
                <span className={`step-label ${idx === currentStepIndex ? 'active' : ''}`}>
                  {label}
                </span>
                {idx < stepLabels.length - 1 && (
                  <span className={`step-line ${idx < currentStepIndex ? 'active' : ''}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="setup-content">
          {step === STEPS.PLATFORMS && (
            <PlatformSelect
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
            />
          )}

          {step === STEPS.IMPORT_SELECT && (
            <ImportSelect
              platforms={selectedPlatforms}
              selected={importPlatforms}
              onChange={setImportPlatforms}
            />
          )}

          {step === STEPS.IMPORT_DATA && (
            <PlatformImporter
              platforms={importPlatforms}
              onImport={handleImport}
              importStatuses={importStatuses}
            />
          )}

          {step === STEPS.GENRES && (
            <GenreSelect
              selected={selectedGenres}
              onChange={setSelectedGenres}
              canSkip={hasEnoughData}
            />
          )}
        </div>

        {error && (
          <p className="setup-error">{error}</p>
        )}

        <div className="setup-actions">
          {step > STEPS.PLATFORMS && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={saving}
            >
              Back
            </button>
          )}

          <div className="action-spacer" />

          {(step === STEPS.IMPORT_SELECT || step === STEPS.IMPORT_DATA ||
            (step === STEPS.GENRES && hasEnoughData && selectedGenres.length === 0)) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!canProceed() || saving}
          >
            {saving
              ? 'Saving...'
              : step === STEPS.GENRES
              ? 'Finish Setup'
              : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Setup
