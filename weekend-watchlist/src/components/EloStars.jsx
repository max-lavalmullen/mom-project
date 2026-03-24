import { eloToStars } from '../services/elo'
import './EloStars.css'

const EloStars = ({ eloScore, allElos = [], showElo = false }) => {
  const stars = eloToStars(eloScore, allElos)
  const fullStars = Math.floor(stars)
  const hasHalfStar = stars % 1 >= 0.5

  const renderStars = () => {
    const elements = []

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      elements.push(
        <span key={`full-${i}`} className="elo-star filled">
          &#9733;
        </span>
      )
    }

    // Half star
    if (hasHalfStar) {
      elements.push(
        <span key="half" className="elo-star half">
          <span className="half-fill">&#9733;</span>
          <span className="half-empty">&#9734;</span>
        </span>
      )
    }

    // Empty stars
    const emptyCount = 5 - fullStars - (hasHalfStar ? 1 : 0)
    for (let i = 0; i < emptyCount; i++) {
      elements.push(
        <span key={`empty-${i}`} className="elo-star empty">
          &#9734;
        </span>
      )
    }

    return elements
  }

  return (
    <div className="elo-stars">
      <div className="stars-container">
        {renderStars()}
      </div>
      {showElo && (
        <span className="elo-score">{eloScore}</span>
      )}
    </div>
  )
}

export default EloStars
