import { PLATFORM_IMPORT_INFO } from '../../services/parsers'
import './ImportSelect.css'

const ImportSelect = ({ platforms = [], selected = [], onChange }) => {
  const togglePlatform = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(p => p !== key))
    } else {
      onChange([...selected, key])
    }
  }

  const getAvailabilityBadge = (availability) => {
    switch (availability) {
      case 'quick':
        return { text: 'Quick', className: 'badge-quick' }
      case 'slow':
        return { text: '1-7 days', className: 'badge-slow' }
      case 'gdpr':
        return { text: 'Up to 30 days', className: 'badge-gdpr' }
      default:
        return { text: 'Varies', className: 'badge-slow' }
    }
  }

  return (
    <div className="import-select">
      <h3>Import your watch history</h3>
      <p className="step-description">
        Select platforms to import your watch history from. This helps us give you better recommendations.
      </p>

      <div className="import-options">
        {platforms.map(platformKey => {
          const info = PLATFORM_IMPORT_INFO[platformKey]
          if (!info) return null

          const badge = getAvailabilityBadge(info.dataAvailability)
          const isSelected = selected.includes(platformKey)

          return (
            <div
              key={platformKey}
              className={`import-option ${isSelected ? 'selected' : ''}`}
              onClick={() => togglePlatform(platformKey)}
            >
              <div className="import-option-header">
                <span
                  className="platform-dot"
                  style={{ backgroundColor: info.color }}
                />
                <span className="platform-name">{info.name}</span>
                <span className={`availability-badge ${badge.className}`}>
                  {badge.text}
                </span>
              </div>

              <p className="import-option-description">
                {info.dataAvailability === 'quick'
                  ? 'Data export available immediately or within hours'
                  : info.dataAvailability === 'slow'
                  ? 'Data request required, typically arrives in a few days'
                  : 'GDPR data request required, may take up to 30 days'}
              </p>

              {isSelected && (
                <span className="check-badge">&#10003;</span>
              )}
            </div>
          )
        })}
      </div>

      {selected.length > 0 ? (
        <p className="selection-info">
          You'll upload data from {selected.length} platform{selected.length !== 1 ? 's' : ''} in the next step.
        </p>
      ) : (
        <p className="selection-info muted">
          You can skip this step and import later from your profile.
        </p>
      )}
    </div>
  )
}

export default ImportSelect
