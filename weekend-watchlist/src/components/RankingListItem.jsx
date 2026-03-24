import { getImageUrl, posterSize } from '../services/tmdb'
import EloStars from './EloStars'
import './RankingListItem.css'

const RankingListItem = ({ item, rank, allElos = [] }) => {
  const posterUrl = getImageUrl(item.posterPath, posterSize.small)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.getFullYear()
  }

  const getRankBadgeClass = () => {
    if (rank === 1) return 'gold'
    if (rank === 2) return 'silver'
    if (rank === 3) return 'bronze'
    return ''
  }

  return (
    <div className="ranking-list-item">
      <div className={`rank-badge ${getRankBadgeClass()}`}>
        #{rank}
      </div>

      <div className="ranking-poster">
        {posterUrl ? (
          <img src={posterUrl} alt={item.title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">
            <span>?</span>
          </div>
        )}
      </div>

      <div className="ranking-info">
        <h3 className="ranking-title">{item.title}</h3>
        <div className="ranking-meta">
          <span className="ranking-year">{formatDate(item.releaseDate)}</span>
          <span className="ranking-type">
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
        </div>
      </div>

      <div className="ranking-score">
        <EloStars eloScore={item.elo_score || 1500} allElos={allElos} />
        <span className="elo-display">{item.elo_score || 1500} Elo</span>
      </div>
    </div>
  )
}

export default RankingListItem
