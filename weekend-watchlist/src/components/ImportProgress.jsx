import './ImportProgress.css'

const ImportProgress = ({
  stage = 'idle',
  progress = 0,
  message = '',
  matched = 0,
  total = 0,
  error = null,
}) => {
  const getStageLabel = () => {
    switch (stage) {
      case 'validating':
        return 'Validating'
      case 'parsing':
        return 'Parsing'
      case 'matching':
        return 'Matching'
      case 'saving':
        return 'Saving'
      case 'computing':
        return 'Computing'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Error'
      default:
        return 'Ready'
    }
  }

  const getStageIcon = () => {
    switch (stage) {
      case 'complete':
        return '&#10003;'
      case 'error':
        return '&#10007;'
      default:
        return null
    }
  }

  const isComplete = stage === 'complete'
  const isError = stage === 'error'
  const isRunning = !['idle', 'complete', 'error'].includes(stage)

  return (
    <div className={`import-progress ${stage}`}>
      <div className="progress-header">
        <span className="progress-stage">
          {getStageIcon() && (
            <span
              className="stage-icon"
              dangerouslySetInnerHTML={{ __html: getStageIcon() }}
            />
          )}
          {getStageLabel()}
        </span>
        <span className="progress-percent">{Math.round(progress)}%</span>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {message && (
        <p className="progress-message">{message}</p>
      )}

      {stage === 'matching' && total > 0 && (
        <p className="progress-detail">
          {matched} of {total} items matched
        </p>
      )}

      {isError && error && (
        <p className="progress-error">{error}</p>
      )}

      {isRunning && (
        <div className="progress-spinner">
          <div className="spinner-ring" />
        </div>
      )}
    </div>
  )
}

export default ImportProgress
