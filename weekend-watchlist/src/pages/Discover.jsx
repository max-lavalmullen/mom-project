import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import WatchlistCard from '../components/WatchlistCard'
import PlatformFilter from '../components/PlatformFilter'
import GenreFilter from '../components/GenreFilter'
import { discoverMovies, discoverTV, searchMulti, normalizeMedia, PLATFORMS } from '../services/tmdb'
import './Discover.css'

const Discover = () => {
  const { user, userPreferences } = useAuth()

  const [mediaType, setMediaType] = useState('movie')
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGenres, setSelectedGenres] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Initialize with user's platforms
  useEffect(() => {
    if (userPreferences.platforms?.length > 0) {
      setSelectedPlatforms(userPreferences.platforms)
    }
  }, [userPreferences.platforms])

  // Fetch content
  const fetchContent = useCallback(async (resetPage = true) => {
    const currentPage = resetPage ? 1 : page

    if (resetPage) {
      setPage(1)
      setContent([])
    }

    setLoading(true)

    try {
      // Build params
      const params = {
        page: currentPage,
      }

      // Add platform filter
      if (selectedPlatforms.length > 0) {
        const platformIds = selectedPlatforms
          .map(p => PLATFORMS[p]?.id)
          .filter(Boolean)
          .join('|')
        if (platformIds) {
          params.with_watch_providers = platformIds
          params.watch_region = 'US'
        }
      }

      // Add genre filter
      if (selectedGenres.length > 0) {
        params.with_genres = selectedGenres.join(',')
      }

      const result = mediaType === 'movie'
        ? await discoverMovies(params)
        : await discoverTV(params)

      const normalized = result.results?.map(item => normalizeMedia(item, mediaType)) || []

      if (resetPage) {
        setContent(normalized)
      } else {
        setContent(prev => [...prev, ...normalized])
      }

      setHasMore(result.page < result.total_pages)
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }, [mediaType, selectedPlatforms, selectedGenres, page])

  // Search content
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false)
      fetchContent(true)
      return
    }

    setIsSearching(true)
    setLoading(true)

    try {
      const result = await searchMulti(searchQuery)
      const normalized = result.results
        ?.filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => normalizeMedia(item, item.media_type)) || []

      setContent(normalized)
      setHasMore(false)
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, fetchContent])

  // Fetch on mount and filter changes
  useEffect(() => {
    if (!isSearching) {
      fetchContent(true)
    }
  }, [mediaType, selectedPlatforms, selectedGenres])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch()
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadMore = () => {
    if (!loading && hasMore && !isSearching) {
      setPage(prev => prev + 1)
      fetchContent(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearching(false)
    fetchContent(true)
  }

  return (
    <div className="discover-page">
      <div className="container">
        <div className="discover-header">
          <h1>Discover</h1>
          <p>Find your next favorite show or movie</p>
        </div>

        <div className="search-section">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search movies and TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={clearSearch}>
                &times;
              </button>
            )}
          </div>
        </div>

        {!isSearching && (
          <div className="filters-section">
            <div className="filter-group">
              <label className="filter-label">Type</label>
              <div className="media-toggle">
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
            </div>

            <div className="filter-group">
              <label className="filter-label">Platforms</label>
              <PlatformFilter
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
                showAll={true}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Genres</label>
              <GenreFilter
                selected={selectedGenres}
                onChange={setSelectedGenres}
                mediaType={mediaType}
              />
            </div>
          </div>
        )}

        {loading && content.length === 0 ? (
          <div className="page-loading">
            <div className="spinner"></div>
          </div>
        ) : content.length === 0 ? (
          <div className="empty-state">
            <p>No results found</p>
            <p className="empty-hint">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <>
            {isSearching && (
              <div className="search-results-header">
                <span>Search results for "{searchQuery}"</span>
                <button className="btn btn-ghost btn-sm" onClick={clearSearch}>
                  Clear search
                </button>
              </div>
            )}

            <div className="content-grid">
              {content.map((item) => (
                <WatchlistCard
                  key={`${item.mediaType}-${item.id}`}
                  item={item}
                  showActions={!!user}
                />
              ))}
            </div>

            {hasMore && !isSearching && (
              <div className="load-more">
                <button
                  className="btn btn-secondary"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Discover
