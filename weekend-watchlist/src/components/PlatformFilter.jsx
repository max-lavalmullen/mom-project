import { PLATFORMS } from '../services/tmdb'
import './PlatformFilter.css'

const PlatformFilter = ({
  selected = [],
  onChange,
  multiSelect = true,
  showAll = true,
  availablePlatforms = null, // Only show these platforms (null = show all)
}) => {
  // If availablePlatforms is provided, filter to only those platforms
  const platforms = availablePlatforms
    ? availablePlatforms
        .filter(key => PLATFORMS[key]) // Make sure platform exists
        .map(key => [key, PLATFORMS[key]])
    : Object.entries(PLATFORMS)

  const handleClick = (key) => {
    if (multiSelect) {
      if (selected.includes(key)) {
        onChange(selected.filter(p => p !== key))
      } else {
        onChange([...selected, key])
      }
    } else {
      onChange(selected.includes(key) ? [] : [key])
    }
  }

  // Don't render if no platforms available
  if (platforms.length === 0) {
    return null
  }

  // Don't show filter if only 1 platform
  if (platforms.length === 1 && !showAll) {
    return null
  }

  return (
    <div className="platform-filter">
      {showAll && (
        <button
          className={`platform-chip all ${selected.length === 0 ? 'active' : ''}`}
          onClick={() => onChange([])}
        >
          All
        </button>
      )}
      {platforms.map(([key, platform]) => (
        <button
          key={key}
          className={`platform-chip ${selected.includes(key) ? 'active' : ''}`}
          style={{
            '--platform-color': platform.color,
          }}
          onClick={() => handleClick(key)}
        >
          {platform.name}
        </button>
      ))}
    </div>
  )
}

export default PlatformFilter
