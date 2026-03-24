const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

// Image sizes
export const posterSize = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original',
}

export const backdropSize = {
  small: 'w300',
  medium: 'w780',
  large: 'w1280',
  original: 'original',
}

export const getImageUrl = (path, size = posterSize.medium) => {
  if (!path) return null
  return `${IMAGE_BASE_URL}/${size}${path}`
}

// API helper
const fetchTMDB = async (endpoint, params = {}) => {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.append('api_key', TMDB_API_KEY)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value)
    }
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status}`)
  }
  return response.json()
}

// Genre mappings
export const GENRES = {
  movie: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
  ],
  tv: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' },
  ],
}

// Streaming platform provider IDs (US region)
export const PLATFORMS = {
  netflix: { id: 8, name: 'Netflix', color: '#e50914' },
  hulu: { id: 15, name: 'Hulu', color: '#1ce783' },
  hbo: { id: 384, name: 'HBO Max', color: '#9b59b6' },
  disney: { id: 337, name: 'Disney+', color: '#113ccf' },
  prime: { id: 9, name: 'Prime Video', color: '#00a8e1' },
  apple: { id: 350, name: 'Apple TV+', color: '#000000' },
  paramount: { id: 531, name: 'Paramount+', color: '#0064ff' },
  peacock: { id: 386, name: 'Peacock', color: '#000000' },
}

export const getPlatformById = (id) => {
  return Object.values(PLATFORMS).find(p => p.id === id)
}

export const getPlatformByKey = (key) => {
  return PLATFORMS[key]
}

// Get trending content
export const getTrending = async (mediaType = 'all', timeWindow = 'week') => {
  return fetchTMDB(`/trending/${mediaType}/${timeWindow}`)
}

// Get popular movies
export const getPopularMovies = async (page = 1) => {
  return fetchTMDB('/movie/popular', { page })
}

// Get popular TV shows
export const getPopularTV = async (page = 1) => {
  return fetchTMDB('/tv/popular', { page })
}

// Get movie details
export const getMovieDetails = async (movieId) => {
  return fetchTMDB(`/movie/${movieId}`, {
    append_to_response: 'watch/providers,credits,similar,videos'
  })
}

// Get TV show details
export const getTVDetails = async (tvId) => {
  return fetchTMDB(`/tv/${tvId}`, {
    append_to_response: 'watch/providers,credits,similar,videos'
  })
}

// Get movie watch providers
export const getMovieProviders = async (movieId) => {
  return fetchTMDB(`/movie/${movieId}/watch/providers`)
}

// Get TV watch providers
export const getTVProviders = async (tvId) => {
  return fetchTMDB(`/tv/${tvId}/watch/providers`)
}

// Discover movies with filters
export const discoverMovies = async (params = {}) => {
  return fetchTMDB('/discover/movie', {
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false,
    watch_region: 'US',
    ...params,
  })
}

// Discover TV shows with filters
export const discoverTV = async (params = {}) => {
  return fetchTMDB('/discover/tv', {
    sort_by: 'popularity.desc',
    include_adult: false,
    watch_region: 'US',
    ...params,
  })
}

// Get upcoming movies
export const getUpcomingMovies = async (page = 1) => {
  return fetchTMDB('/movie/upcoming', { page, region: 'US' })
}

// Get movies/shows airing this week
export const getThisWeekReleases = async (mediaType = 'movie') => {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const formatDate = (date) => date.toISOString().split('T')[0]

  if (mediaType === 'movie') {
    return discoverMovies({
      'primary_release_date.gte': formatDate(weekAgo),
      'primary_release_date.lte': formatDate(weekFromNow),
      sort_by: 'popularity.desc',
    })
  } else {
    return discoverTV({
      'first_air_date.gte': formatDate(weekAgo),
      'first_air_date.lte': formatDate(weekFromNow),
      sort_by: 'popularity.desc',
    })
  }
}

// Get new releases on specific platforms
export const getNewOnPlatform = async (platformId, mediaType = 'movie', page = 1) => {
  const today = new Date()
  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const formatDate = (date) => date.toISOString().split('T')[0]

  const params = {
    with_watch_providers: platformId,
    watch_region: 'US',
    sort_by: 'popularity.desc',
    page,
  }

  if (mediaType === 'movie') {
    params['primary_release_date.gte'] = formatDate(monthAgo)
    return discoverMovies(params)
  } else {
    params['first_air_date.gte'] = formatDate(monthAgo)
    return discoverTV(params)
  }
}

// Get movies/shows airing this week on a specific platform
export const getNewOnPlatformWeek = async (platformId, mediaType = 'movie') => {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const formatDate = (date) => date.toISOString().split('T')[0]

  const params = {
    with_watch_providers: platformId,
    watch_region: 'US',
    sort_by: 'popularity.desc',
  }

  if (mediaType === 'movie') {
    params['primary_release_date.gte'] = formatDate(weekAgo)
    params['primary_release_date.lte'] = formatDate(weekFromNow)
    return discoverMovies(params)
  } else {
    params['first_air_date.gte'] = formatDate(weekAgo)
    params['first_air_date.lte'] = formatDate(weekFromNow)
    return discoverTV(params)
  }
}

// Search for movies and TV shows
export const searchMulti = async (query, page = 1) => {
  return fetchTMDB('/search/multi', { query, page, include_adult: false })
}

export const searchMovies = async (query, page = 1) => {
  return fetchTMDB('/search/movie', { query, page, include_adult: false })
}

export const searchTV = async (query, page = 1) => {
  return fetchTMDB('/search/tv', { query, page, include_adult: false })
}

// Get content by genre
export const getByGenre = async (genreId, mediaType = 'movie', page = 1) => {
  if (mediaType === 'movie') {
    return discoverMovies({ with_genres: genreId, page })
  } else {
    return discoverTV({ with_genres: genreId, page })
  }
}

// Get content by genre filtered by user's streaming platforms
export const getByGenreOnPlatforms = async (genreId, platformIds, mediaType = 'movie', page = 1) => {
  const params = {
    with_genres: genreId,
    with_watch_providers: platformIds,
    watch_region: 'US',
    sort_by: 'popularity.desc',
    page,
  }

  if (mediaType === 'movie') {
    return discoverMovies(params)
  } else {
    return discoverTV(params)
  }
}

// Get similar content
export const getSimilar = async (id, mediaType = 'movie') => {
  return fetchTMDB(`/${mediaType}/${id}/similar`)
}

// Get recommendations
export const getRecommendations = async (id, mediaType = 'movie') => {
  return fetchTMDB(`/${mediaType}/${id}/recommendations`)
}

// Helper to normalize movie/TV data
export const normalizeMedia = (item, mediaType) => {
  const isMovie = mediaType === 'movie' || item.media_type === 'movie' || item.title
  return {
    id: item.id,
    title: isMovie ? item.title : item.name,
    overview: item.overview,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    releaseDate: isMovie ? item.release_date : item.first_air_date,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    genreIds: item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []),
    mediaType: isMovie ? 'movie' : 'tv',
  }
}
