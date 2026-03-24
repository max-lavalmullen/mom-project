import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import RankingListItem from '../components/RankingListItem'
import { getRankedList, getComparisonStats } from '../services/comparison'
import { getMovieDetails, getTVDetails, normalizeMedia } from '../services/tmdb'
import './Rankings.css'

const Rankings = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [mediaTypeFilter, setMediaTypeFilter] = useState(null)
  const [rankedItems, setRankedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalComparisons: 0 })

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Load rankings
  useEffect(() => {
    const loadRankings = async () => {
      if (!user) return

      setLoading(true)

      try {
        // Get ranked list
        const { data: ranked, error } = await getRankedList(user.id, mediaTypeFilter)

        if (error) {
          console.error('Error loading rankings:', error)
          setRankedItems([])
          return
        }

        if (!ranked || ranked.length === 0) {
          setRankedItems([])
          setLoading(false)
          return
        }

        // Fetch details for all items
        const withDetails = await Promise.all(
          ranked.map(async (item) => {
            try {
              const details = item.media_type === 'movie'
                ? await getMovieDetails(item.tmdb_id)
                : await getTVDetails(item.tmdb_id)

              return {
                ...normalizeMedia(details, item.media_type),
                ...item,
              }
            } catch (err) {
              console.error(`Error fetching details for ${item.tmdb_id}:`, err)
              return {
                id: item.tmdb_id,
                title: `Unknown (${item.tmdb_id})`,
                mediaType: item.media_type,
                ...item,
              }
            }
          })
        )

        setRankedItems(withDetails)

        // Load stats
        const { data: statsData } = await getComparisonStats(user.id)
        if (statsData) {
          setStats(statsData)
        }
      } catch (err) {
        console.error('Error loading rankings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRankings()
  }, [user, mediaTypeFilter])

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!user) return null

  const allElos = rankedItems.map(item => item.elo_score || 1500)

  return (
    <div className="rankings-page">
      <div className="container">
        <div className="rankings-header">
          <div className="rankings-title-section">
            <h1>Your Rankings</h1>
            <p className="rankings-subtitle">
              Based on {stats.totalComparisons} comparisons
            </p>
          </div>

          <Link to="/rank" className="btn btn-primary">
            Continue Ranking
          </Link>
        </div>

        <div className="rankings-filters">
          <button
            className={`filter-btn ${mediaTypeFilter === null ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter(null)}
          >
            All ({rankedItems.length})
          </button>
          <button
            className={`filter-btn ${mediaTypeFilter === 'movie' ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter('movie')}
          >
            Movies
          </button>
          <button
            className={`filter-btn ${mediaTypeFilter === 'tv' ? 'active' : ''}`}
            onClick={() => setMediaTypeFilter('tv')}
          >
            TV Shows
          </button>
        </div>

        {loading ? (
          <div className="rankings-loading">
            <div className="spinner"></div>
            <p>Loading your rankings...</p>
          </div>
        ) : rankedItems.length === 0 ? (
          <div className="rankings-empty">
            <h3>No rankings yet</h3>
            <p>
              Start comparing your watched movies and shows to build your personalized rankings.
            </p>
            <Link to="/rank" className="btn btn-primary">
              Start Ranking
            </Link>
          </div>
        ) : (
          <div className="rankings-list">
            {rankedItems.map((item, index) => (
              <RankingListItem
                key={item.tmdb_id}
                item={item}
                rank={index + 1}
                allElos={allElos}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Rankings
