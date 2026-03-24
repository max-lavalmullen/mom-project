import { PLATFORMS } from '../../services/tmdb'
import './PlatformSelect.css'

const PlatformSelect = ({ selected = [], onChange }) => {
  const platforms = Object.entries(PLATFORMS)

  const togglePlatform = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(p => p !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="platform-select">
      <h3>Which streaming platforms do you use?</h3>
      <p className="step-description">
        Select all the services you subscribe to. We'll show you what's available on your platforms.
      </p>

      <div className="platform-grid">
        {platforms.map(([key, platform]) => (
          <button
            key={key}
            type="button"
            className={`platform-option ${selected.includes(key) ? 'selected' : ''}`}
            style={{ '--platform-color': platform.color }}
            onClick={() => togglePlatform(key)}
          >
            <span className="platform-name">{platform.name}</span>
            {selected.includes(key) && (
              <span className="check-icon">&#10003;</span>
            )}
          </button>
        ))}
      </div>

      <p className="selection-count">
        {selected.length === 0
          ? 'Select at least one platform to continue'
          : `${selected.length} platform${selected.length !== 1 ? 's' : ''} selected`}
      </p>
    </div>
  )
}

export default PlatformSelect
