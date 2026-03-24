import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import WatchlistCard from '../components/WatchlistCard'
import PlatformFilter from '../components/PlatformFilter'
import UserPreferences from '../components/UserPreferences'
import {
  getPersonalizedRecommendations,
  getWeeklyReleases,
  getTieredRecommendations,
  getRecommendationLabel,
} from '../services/recommendations'
import { getTrending, normalizeMedia, getByGenreOnPlatforms, GENRES, PLATFORMS } from '../services/tmdb'
import './Home.css'

const Home = () => {
  const navigate = useNavigate()
  const { user, userPreferences, watchlist, loading: authLoading, needsOnboarding, preferenceProfile } = useAuth()

  const [forYou, setForYou] = useState([])
  const [weeklyReleases, setWeeklyReleases] = useState([])
  const [trending, setTrending] = useState([])
  const [genreRows, setGenreRows] = useState([]) // { genreId, genreName, items }
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState([])
  const [mediaType, setMediaType] = useState('all')
  const [showSetup, setShowSetup] = useState(false)
  const [recommendationInfo, setRecommendationInfo] = useState({ title: 'For You', subtitle: '' })
  const [dataTier, setDataTier] = useState('none') // 'full', 'partial', 'none'

  // Redirect to setup if user needs onboarding
  useEffect(() => {
    if (user && !authLoading && needsOnboarding) {
      navigate('/setup')
    }
  }, [user, authLoading, needsOnboarding, navigate])

  // Check if user needs to set up preferences (legacy fallback)
  useEffect(() => {
    if (user && !authLoading && !needsOnboarding) {
      const needsSetup =
        userPreferences.platforms?.length === 0 ||
        userPreferences.genres?.length === 0
      setShowSetup(needsSetup)
    }
  }, [user, userPreferences, authLoading, needsOnboarding])

  // Fetch content
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      try {
        // Always fetch trending for non-authenticated users
        const trendingData = await getTrending('all', 'week')
        setTrending(
          trendingData.results
            ?.slice(0, 20)
            .map(item => normalizeMedia(item, item.media_type)) || []
        )

        if (user && userPreferences.platforms?.length > 0) {
          // Use tiered recommendations
          const { recommendations, dataTier: tier, recommendationType } = await getTieredRecommendations({
            userId: user.id,
            userPlatforms: userPreferences.platforms,
            userGenres: userPreferences.genres,
            watchlist,
            mediaType,
          })

          setForYou(recommendations)
          setDataTier(tier)
          setRecommendationInfo(getRecommendationLabel(recommendationType))

          // Also fetch weekly releases
          const releases = await getWeeklyReleases(userPreferences.platforms, mediaType)
          setWeeklyReleases(releases.slice(0, 20))

          // Fetch genre-based rows filtered by user's platforms
          const userGenreIds = userPreferences.genres?.map(g => g.genre_id) || []
          const genreList = mediaType === 'tv' ? GENRES.tv : GENRES.movie

          // Get platform IDs as pipe-separated string for TMDb API
          const platformIds = userPreferences.platforms
            .map(p => PLATFORMS[p]?.id)
            .filter(Boolean)
            .join('|')

          // Show user's preferred genres first, then fill with others
          const preferredGenres = genreList.filter(g => userGenreIds.includes(g.id))
          const otherGenres = genreList.filter(g => !userGenreIds.includes(g.id))
          const allGenres = [...preferredGenres, ...otherGenres]

          // Fetch content for each genre (limit to 10 rows to avoid too many API calls)
          const genrePromises = allGenres.slice(0, 10).map(async (genre) => {
            try {
              const type = mediaType === 'all' ? 'movie' : mediaType
              const data = await getByGenreOnPlatforms(genre.id, platformIds, type)

              // Filter to only items that actually have this genre
              const items = (data.results || [])
                .filter(item => item.genre_ids?.includes(genre.id))
                .slice(0, 20)
                .map(item => normalizeMedia(item, type))

              // Only return if we have enough content
              if (items.length < 4) return null

              return {
                genreId: genre.id,
                genreName: genre.name,
                items,
                isPreferred: userGenreIds.includes(genre.id),
              }
            } catch (err) {
              console.error(`Error fetching genre ${genre.name}:`, err)
              return null
            }
          })

          const genreResults = await Promise.all(genrePromises)
          setGenreRows(genreResults.filter(r => r !== null))
        }
      } catch (error) {
        console.error('Error fetching content:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchContent()
    }
  }, [user, userPreferences, watchlist, mediaType, authLoading])

  // Filter content by platform
  const filterByPlatform = (items) => {
    if (activeFilter.length === 0) return items
    return items.filter(item =>
      !item.platform || activeFilter.includes(item.platform)
    )
  }

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  // Show preferences setup for logged in users without preferences
  if (user && showSetup) {
    return (
      <div className="home-page">
        <UserPreferences onComplete={() => setShowSetup(false)} />
      </div>
    )
  }

  const displayForYou = filterByPlatform(forYou)
  const displayWeekly = filterByPlatform(weeklyReleases)
  const displayTrending = trending

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Your Weekend Watchlist</h1>
          <p>
            {user
              ? 'Personalized recommendations based on your preferences'
              : 'Discover what to watch this weekend'}
          </p>

          {!user && (
            <Link to="/login" className="btn btn-primary">
              Sign in for personalized picks
            </Link>
          )}
        </div>
      </section>

      {user && userPreferences.platforms?.length > 0 && (
        <section className="filters-section">
          <div className="container">
            <div className="filters-row">
              <div className="media-toggle">
                <button
                  className={`toggle-btn ${mediaType === 'all' ? 'active' : ''}`}
                  onClick={() => setMediaType('all')}
                >
                  All
                </button>
                <button
                  className={`toggle-btn ${mediaType === 'movie' ? 'active' : ''}`}
                  onClick={() => setMediaType('movie')}
                >
                  Movies
                </button>
                <button
                  className={`toggle-btn ${mediaType === 'tv' ? 'active' : ''}`}
                  onClick={() => setMediaType('tv')}
                >
                  TV Shows
                </button>
              </div>

              <PlatformFilter
                selected={activeFilter}
                onChange={setActiveFilter}
                showAll={true}
                availablePlatforms={userPreferences.platforms}
              />
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div className="page-loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* For You Section - only for logged in users with preferences */}
          {user && displayForYou.length > 0 && (
            <section className="content-section">
              <div className="container">
                <div className="section-header">
                  <h2>{recommendationInfo.title}</h2>
                  <p>{recommendationInfo.subtitle}</p>
                </div>
                <div className="content-grid">
                  {displayForYou.map((item) => (
                    <WatchlistCard key={`${item.mediaType}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Weekly Releases - for logged in users */}
          {user && displayWeekly.length > 0 && (
            <section className="content-section">
              <div className="container">
                <div className="section-header">
                  <h2>New This Week</h2>
                  <p>Latest releases on your platforms</p>
                </div>
                <div className="content-grid">
                  {displayWeekly.map((item) => (
                    <WatchlistCard key={`${item.mediaType}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Genre Rows - Netflix style */}
          {user && genreRows.map((row) => (
            <section key={row.genreId} className={`content-section genre-section ${row.isPreferred ? 'preferred' : ''}`}>
              <div className="container">
                <div className="section-header">
                  <h2>
                    {row.genreName}
                    {row.isPreferred && <span className="preferred-badge">Your Pick</span>}
                  </h2>
                </div>
                <div className="genre-row">
                  <div className="genre-row-scroll">
                    {row.items.map((item) => (
                      <div key={`${item.mediaType}-${item.id}`} className="genre-row-item">
                        <WatchlistCard item={item} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}

          {/* Trending - for everyone */}
          <section className="content-section">
            <div className="container">
              <div className="section-header">
                <h2>Trending Now</h2>
                <p>Popular this week</p>
              </div>
              <div className="content-grid">
                {displayTrending.map((item) => (
                  <WatchlistCard
                    key={`${item.mediaType}-${item.id}`}
                    item={item}
                    showActions={!!user}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Call to action for non-logged in users */}
          {!user && (
            <section className="cta-section">
              <div className="container">
                <div className="cta-card">
                  <h2>Get Personalized Recommendations</h2>
                  <p>
                    Sign up to select your streaming platforms and preferences.
                    We'll show you what's new on the services you actually use.
                  </p>
                  <Link to="/login" className="btn btn-primary">
                    Get Started
                  </Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Home
