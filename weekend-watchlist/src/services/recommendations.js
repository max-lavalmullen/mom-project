import { getNewOnPlatform, getNewOnPlatformWeek, getTrending, getSimilar, getMovieDetails, getTVDetails, normalizeMedia, PLATFORMS, discoverMovies, discoverTV } from './tmdb'
import { getPreferenceProfile } from './preferenceEngine'

// Score weights
const WEIGHTS = {
  GENRE_MATCH: 3,
  POPULARITY_MAX: 5,
  SIMILAR_TO_LIKED: 2,
  NOT_INTERESTED_PENALTY: -5,
  TRENDING_BONUS: 2,
  RECENT_RELEASE_BONUS: 1,
}

// Calculate popularity score (1-5 based on TMDb popularity)
const getPopularityScore = (popularity) => {
  // TMDb popularity typically ranges from 0 to 1000+
  if (popularity >= 500) return 5
  if (popularity >= 200) return 4
  if (popularity >= 100) return 3
  if (popularity >= 50) return 2
  return 1
}

// Build a user profile based on watchlist history
const buildUserProfile = async (watchlist) => {
  const profile = {
    likedGenres: new Map(),
    dislikedGenres: new Set(),
    likedIds: new Set(),
    dislikedIds: new Set(),
  }

  // Get recent interactions
  const watched = watchlist
    .filter(w => w.status === 'watched')
    .slice(0, 5) // Analyze last 5 watched items

  const notInterested = watchlist
    .filter(w => w.status === 'not_interested')
    .slice(0, 5) // Analyze last 5 disliked items

  // Helper to process items
  const processItems = async (items, isLike) => {
    for (const item of items) {
      if (isLike) profile.likedIds.add(item.tmdb_id)
      else profile.dislikedIds.add(item.tmdb_id)

      try {
        // Fetch details to get genres since they aren't in the watchlist table
        const details = item.media_type === 'movie'
          ? await getMovieDetails(item.tmdb_id)
          : await getTVDetails(item.tmdb_id)

        if (details.genres) {
          details.genres.forEach(g => {
            if (isLike) {
              const current = profile.likedGenres.get(g.id) || 0
              profile.likedGenres.set(g.id, current + 1)
            } else {
              profile.dislikedGenres.add(g.id)
            }
          })
        }
      } catch (e) {
        console.error(`Error analyzing ${item.tmdb_id}:`, e)
      }
    }
  }

  await Promise.all([
    processItems(watched, true),
    processItems(notInterested, false)
  ])

  return profile
}

// Calculate how recent a release is (0-2 bonus)
const getRecencyScore = (releaseDate) => {
  if (!releaseDate) return 0
  const release = new Date(releaseDate)
  const now = new Date()
  const daysDiff = (now - release) / (1000 * 60 * 60 * 24)

  if (daysDiff <= 7) return 2 // Released in last week
  if (daysDiff <= 30) return 1 // Released in last month
  return 0
}

// Calculate genre match score
const calculateGenreScore = (itemGenres, userGenres) => {
  if (!userGenres || userGenres.length === 0) return 0

  let score = 0
  const userGenreMap = new Map(userGenres.map(g => [g.genre_id, g.weight || 1]))

  for (const genreId of itemGenres) {
    if (userGenreMap.has(genreId)) {
      score += WEIGHTS.GENRE_MATCH * userGenreMap.get(genreId)
    }
  }

  return score
}

// Check if item is similar to items user has liked
const getSimilarityScore = (item, userProfile) => {
  if (!userProfile || !userProfile.likedGenres) return 0

  let score = 0
  
  // Check for genre overlap with liked content
  if (item.genreIds) {
    item.genreIds.forEach(genreId => {
      if (userProfile.likedGenres.has(genreId)) {
        // Add 1 point for every time this genre appeared in watched history
        score += (userProfile.likedGenres.get(genreId) * 0.5)
      }
    })
  }

  return Math.min(score, 5) // Cap at 5 points
}

// Check if user marked similar content as not interested
const getNotInterestedPenalty = (item, userProfile) => {
  if (!userProfile) return 0

  let penalty = 0

  // Direct match is filtered out elsewhere, but good to be safe
  if (userProfile.dislikedIds.has(item.id)) {
    return WEIGHTS.NOT_INTERESTED_PENALTY * 2
  }

  // Check for genre overlap with disliked content
  if (item.genreIds && userProfile.dislikedGenres.size > 0) {
    let matches = 0
    item.genreIds.forEach(genreId => {
      if (userProfile.dislikedGenres.has(genreId)) {
        matches++
      }
    })
    
    // If the item shares multiple genres with disliked content, penalize it
    if (matches >= 2) {
      penalty += WEIGHTS.NOT_INTERESTED_PENALTY
    }
  }

  return penalty
}

// Main recommendation scoring function
export const scoreItem = (item, userGenres, userProfile, isTrending = false) => {
  let score = 0

  // Genre matching (Explicit Preferences)
  score += calculateGenreScore(item.genreIds || [], userGenres)

  // Similarity to history (Implicit Preferences)
  score += getSimilarityScore(item, userProfile)

  // Popularity
  score += getPopularityScore(item.popularity)

  // Recency
  score += getRecencyScore(item.releaseDate) * WEIGHTS.RECENT_RELEASE_BONUS

  // Trending bonus
  if (isTrending) {
    score += WEIGHTS.TRENDING_BONUS
  }

  // Penalties
  score += getNotInterestedPenalty(item, userProfile)

  return score
}

// Get personalized recommendations
export const getPersonalizedRecommendations = async ({
  userPlatforms = [],
  userGenres = [],
  watchlist = [],
  mediaType = 'all', // 'movie', 'tv', or 'all'
  limit = 20,
}) => {
  const allContent = []
  const seenIds = new Set()

  // Fetch content from each platform
  const fetchPromises = []

  for (const platformKey of userPlatforms) {
    const platformId = PLATFORMS[platformKey]?.id
    if (!platformId) continue

    if (mediaType === 'all' || mediaType === 'movie') {
      fetchPromises.push(
        getNewOnPlatform(platformId, 'movie').then(res => ({
          results: res.results,
          mediaType: 'movie',
          platformId,
          platformKey,
        }))
      )
    }
    if (mediaType === 'all' || mediaType === 'tv') {
      fetchPromises.push(
        getNewOnPlatform(platformId, 'tv').then(res => ({
          results: res.results,
          mediaType: 'tv',
          platformId,
          platformKey,
        }))
      )
    }
  }

  // Also get trending content
  if (mediaType === 'all' || mediaType === 'movie') {
    fetchPromises.push(
      getTrending('movie', 'week').then(res => ({
        results: res.results,
        mediaType: 'movie',
        isTrending: true,
      }))
    )
  }
  if (mediaType === 'all' || mediaType === 'tv') {
    fetchPromises.push(
      getTrending('tv', 'week').then(res => ({
        results: res.results,
        mediaType: 'tv',
        isTrending: true,
      }))
    )
  }

  const [results, userProfile] = await Promise.all([
    Promise.all(fetchPromises),
    buildUserProfile(watchlist)
  ])

  // Combine and normalize all content
  for (const { results: items, mediaType: type, isTrending, platformId, platformKey } of results) {
    for (const item of items || []) {
      const key = `${type}-${item.id}`
      if (seenIds.has(key)) continue
      seenIds.add(key)

      const normalized = normalizeMedia(item, type)
      normalized.isTrending = isTrending
      normalized.platformId = platformId
      if (platformKey) normalized.platform = platformKey

      allContent.push(normalized)
    }
  }

  // Score and sort content
  const scoredContent = allContent.map(item => ({
    ...item,
    score: scoreItem(item, userGenres, userProfile, item.isTrending),
  }))

  scoredContent.sort((a, b) => b.score - a.score)

  // Filter out content user has already interacted with
  const watchlistIds = new Set(watchlist.map(w => w.tmdb_id))
  const filtered = scoredContent.filter(item => !watchlistIds.has(item.id))

  return filtered.slice(0, limit)
}

// Get "Because you watched X" recommendations
export const getBecauseYouWatched = async (watchlist, limit = 10) => {
  // Get highly rated items from watchlist
  const liked = watchlist
    .filter(w => w.status === 'watched' && w.rating && w.rating >= 4)
    .slice(0, 3) // Take top 3

  if (liked.length === 0) return []

  const recommendations = []
  const seenIds = new Set(watchlist.map(w => w.tmdb_id))

  for (const item of liked) {
    try {
      const similar = await getSimilar(item.tmdb_id, item.media_type)
      for (const rec of similar.results?.slice(0, 5) || []) {
        if (!seenIds.has(rec.id)) {
          seenIds.add(rec.id)
          recommendations.push({
            ...normalizeMedia(rec, item.media_type),
            becauseOf: item.tmdb_id,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching similar:', error)
    }
  }

  return recommendations.slice(0, limit)
}

// Get content organized by platform
export const getContentByPlatform = async (userPlatforms, mediaType = 'movie') => {
  const byPlatform = {}

  for (const platformKey of userPlatforms) {
    const platform = PLATFORMS[platformKey]
    if (!platform) continue

    try {
      const content = await getNewOnPlatform(platform.id, mediaType)
      byPlatform[platformKey] = {
        platform,
        content: content.results?.map(item => normalizeMedia(item, mediaType)) || [],
      }
    } catch (error) {
      console.error(`Error fetching ${platformKey} content:`, error)
      byPlatform[platformKey] = { platform, content: [] }
    }
  }

  return byPlatform
}

// Get weekly new releases filtered by platforms
export const getWeeklyReleases = async (userPlatforms, mediaType = 'all') => {
  const platformIds = userPlatforms
    .map(p => PLATFORMS[p]?.id)
    .filter(Boolean)
    .join('|')

  const releases = []

  if (!platformIds) {
    // If no platforms selected, just get popular releases
    if (mediaType === 'all' || mediaType === 'movie') {
      const movies = await getTrending('movie', 'week')
      releases.push(...movies.results.map(m => normalizeMedia(m, 'movie')))
    }
    if (mediaType === 'all' || mediaType === 'tv') {
      const tv = await getTrending('tv', 'week')
      releases.push(...tv.results.map(t => normalizeMedia(t, 'tv')))
    }
  } else {
    // Get content from user's platforms
    for (const platformKey of userPlatforms) {
      const platform = PLATFORMS[platformKey]
      if (!platform) continue

      if (mediaType === 'all' || mediaType === 'movie') {
        try {
          const movies = await getNewOnPlatformWeek(platform.id, 'movie')
          releases.push(...movies.results.map(m => ({
            ...normalizeMedia(m, 'movie'),
            platform: platformKey,
          })))
        } catch (e) { /* ignore */ }
      }

      if (mediaType === 'all' || mediaType === 'tv') {
        try {
          const tv = await getNewOnPlatformWeek(platform.id, 'tv')
          releases.push(...tv.results.map(t => ({
            ...normalizeMedia(t, 'tv'),
            platform: platformKey,
          })))
        } catch (e) { /* ignore */ }
      }
    }
  }

  // Dedupe and sort by release date
  const seen = new Set()
  const unique = releases.filter(item => {
    const key = `${item.mediaType}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  unique.sort((a, b) => {
    const dateA = new Date(a.releaseDate || 0)
    const dateB = new Date(b.releaseDate || 0)
    return dateB - dateA
  })

  return unique
}

// ============================================
// TIERED RECOMMENDATIONS
// ============================================

/**
 * Tiered recommendation weights by data tier
 */
const TIERED_WEIGHTS = {
  full: {
    GENRE_MATCH: 5,
    ACTOR_MATCH: 3,
    DIRECTOR_MATCH: 4,
    POPULARITY: 1,
    SIMILAR_TO_LIKED: 4,
    TRENDING_BONUS: 1,
    RECENCY_BONUS: 2,
  },
  partial: {
    GENRE_MATCH: 4,
    ACTOR_MATCH: 2,
    DIRECTOR_MATCH: 3,
    POPULARITY: 2,
    SIMILAR_TO_LIKED: 3,
    TRENDING_BONUS: 2,
    RECENCY_BONUS: 2,
  },
  none: {
    GENRE_MATCH: 3,
    ACTOR_MATCH: 0,
    DIRECTOR_MATCH: 0,
    POPULARITY: 5,
    SIMILAR_TO_LIKED: 1,
    TRENDING_BONUS: 3,
    RECENCY_BONUS: 1,
  },
}

/**
 * Score an item using the full data profile
 * @param {object} item - Normalized media item
 * @param {object} profile - User preference profile
 * @param {object} weights - Scoring weights
 * @returns {number}
 */
const scoreWithProfile = (item, profile, weights) => {
  let score = 0

  // Genre matching (weighted by computed preferences)
  if (item.genreIds && profile.genre_preferences) {
    for (const genreId of item.genreIds) {
      const genreWeight = profile.genre_preferences[genreId] || 0
      score += genreWeight * weights.GENRE_MATCH
    }
  }

  // Popularity (lower weight when we have better data)
  const popScore = getPopularityScore(item.popularity)
  score += popScore * (weights.POPULARITY / 5)

  // Recency
  score += getRecencyScore(item.releaseDate) * weights.RECENCY_BONUS

  return score
}

/**
 * Get recommendations for users with full data (imported from most platforms)
 */
const getFullDataRecommendations = async ({
  userPlatforms,
  preferenceProfile,
  watchlist,
  mediaType,
  limit,
}) => {
  const weights = TIERED_WEIGHTS.full
  const allContent = []
  const seenIds = new Set(watchlist.map(w => w.tmdb_id))

  // Get top genres from profile
  const topGenres = Object.entries(preferenceProfile.genre_preferences || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  // Fetch content by top genres from user's platforms
  for (const platformKey of userPlatforms) {
    const platform = PLATFORMS[platformKey]
    if (!platform) continue

    for (const genreId of topGenres.slice(0, 3)) {
      try {
        if (mediaType === 'all' || mediaType === 'movie') {
          const movies = await discoverMovies({
            with_genres: genreId,
            with_watch_providers: platform.id,
            sort_by: 'vote_average.desc',
            'vote_count.gte': 100,
          })
          for (const m of movies.results || []) {
            if (!seenIds.has(m.id)) {
              allContent.push({
                ...normalizeMedia(m, 'movie'),
                platform: platformKey,
              })
              seenIds.add(m.id)
            }
          }
        }
        if (mediaType === 'all' || mediaType === 'tv') {
          const shows = await discoverTV({
            with_genres: genreId,
            with_watch_providers: platform.id,
            sort_by: 'vote_average.desc',
            'vote_count.gte': 50,
          })
          for (const s of shows.results || []) {
            if (!seenIds.has(s.id)) {
              allContent.push({
                ...normalizeMedia(s, 'tv'),
                platform: platformKey,
              })
              seenIds.add(s.id)
            }
          }
        }
      } catch (e) {
        // Continue on error
      }
    }
  }

  // Score and sort
  const scored = allContent.map(item => ({
    ...item,
    score: scoreWithProfile(item, preferenceProfile, weights),
    recommendationType: 'personalized',
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * Get recommendations for users with partial data (imported from some platforms)
 */
const getPartialDataRecommendations = async ({
  userPlatforms,
  preferenceProfile,
  watchlist,
  userGenres,
  importedPlatforms,
  mediaType,
  limit,
}) => {
  const weights = TIERED_WEIGHTS.partial
  const allContent = []
  const seenIds = new Set(watchlist.map(w => w.tmdb_id))

  // Get non-imported platforms for cross-recommendations
  const nonImportedPlatforms = userPlatforms.filter(p => !importedPlatforms.includes(p))

  // Use profile for genres if available, otherwise fall back to explicit preferences
  const genrePrefs = preferenceProfile?.genre_preferences || {}
  const topGenres = Object.keys(genrePrefs).length > 0
    ? Object.entries(genrePrefs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id)
    : userGenres.map(g => g.genre_id).slice(0, 5)

  // Prioritize non-imported platforms for cross-recommendations
  const platformsToFetch = [
    ...nonImportedPlatforms,
    ...importedPlatforms,
  ]

  for (const platformKey of platformsToFetch) {
    const platform = PLATFORMS[platformKey]
    if (!platform) continue

    const isNonImported = nonImportedPlatforms.includes(platformKey)

    for (const genreId of topGenres.slice(0, 3)) {
      try {
        if (mediaType === 'all' || mediaType === 'movie') {
          const movies = await discoverMovies({
            with_genres: genreId,
            with_watch_providers: platform.id,
          })
          for (const m of movies.results?.slice(0, 10) || []) {
            if (!seenIds.has(m.id)) {
              allContent.push({
                ...normalizeMedia(m, 'movie'),
                platform: platformKey,
                recommendationType: isNonImported ? 'cross_platform' : 'based_on_history',
                sourcePlatform: isNonImported ? importedPlatforms[0] : null,
              })
              seenIds.add(m.id)
            }
          }
        }
        if (mediaType === 'all' || mediaType === 'tv') {
          const shows = await discoverTV({
            with_genres: genreId,
            with_watch_providers: platform.id,
          })
          for (const s of shows.results?.slice(0, 10) || []) {
            if (!seenIds.has(s.id)) {
              allContent.push({
                ...normalizeMedia(s, 'tv'),
                platform: platformKey,
                recommendationType: isNonImported ? 'cross_platform' : 'based_on_history',
                sourcePlatform: isNonImported ? importedPlatforms[0] : null,
              })
              seenIds.add(s.id)
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Score and sort
  const scored = allContent.map(item => ({
    ...item,
    score: scoreWithProfile(item, preferenceProfile || {}, weights),
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * Get recommendations for users with no import data
 */
const getNoDataRecommendations = async ({
  userPlatforms,
  userGenres,
  watchlist,
  mediaType,
  limit,
}) => {
  const weights = TIERED_WEIGHTS.none
  const allContent = []
  const seenIds = new Set(watchlist.map(w => w.tmdb_id))

  // Primarily use trending and explicit preferences
  const trendingPromises = []

  if (mediaType === 'all' || mediaType === 'movie') {
    trendingPromises.push(
      getTrending('movie', 'week').then(res => ({
        results: res.results,
        mediaType: 'movie',
        isTrending: true,
      }))
    )
  }
  if (mediaType === 'all' || mediaType === 'tv') {
    trendingPromises.push(
      getTrending('tv', 'week').then(res => ({
        results: res.results,
        mediaType: 'tv',
        isTrending: true,
      }))
    )
  }

  // Also get content from platforms by genre
  const genreIds = userGenres.map(g => g.genre_id).slice(0, 3)

  for (const platformKey of userPlatforms) {
    const platform = PLATFORMS[platformKey]
    if (!platform) continue

    if (mediaType === 'all' || mediaType === 'movie') {
      trendingPromises.push(
        getNewOnPlatform(platform.id, 'movie').then(res => ({
          results: res.results,
          mediaType: 'movie',
          platform: platformKey,
        }))
      )
    }
    if (mediaType === 'all' || mediaType === 'tv') {
      trendingPromises.push(
        getNewOnPlatform(platform.id, 'tv').then(res => ({
          results: res.results,
          mediaType: 'tv',
          platform: platformKey,
        }))
      )
    }
  }

  const results = await Promise.all(trendingPromises)

  for (const { results: items, mediaType: type, isTrending, platform } of results) {
    for (const item of items || []) {
      if (seenIds.has(item.id)) continue
      seenIds.add(item.id)

      const normalized = normalizeMedia(item, type)
      normalized.isTrending = isTrending
      if (platform) normalized.platform = platform
      normalized.recommendationType = isTrending ? 'trending' : 'new_on_platform'

      allContent.push(normalized)
    }
  }

  // Score with explicit preferences and popularity
  const userGenreMap = new Map(userGenres.map(g => [g.genre_id, g.weight || 1]))

  const scored = allContent.map(item => {
    let score = 0

    // Genre match (explicit preferences)
    for (const genreId of item.genreIds || []) {
      if (userGenreMap.has(genreId)) {
        score += weights.GENRE_MATCH * userGenreMap.get(genreId)
      }
    }

    // Popularity (high weight for no-data users)
    score += getPopularityScore(item.popularity) * (weights.POPULARITY / 5)

    // Trending bonus
    if (item.isTrending) {
      score += weights.TRENDING_BONUS
    }

    return { ...item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * Get tiered recommendations based on user's data availability
 * @param {object} params
 * @param {string} params.userId - User ID
 * @param {string[]} params.userPlatforms - User's subscribed platforms
 * @param {object[]} params.userGenres - User's explicit genre preferences
 * @param {object[]} params.watchlist - User's watchlist
 * @param {string[]} params.importedPlatforms - Platforms with imported data
 * @param {string} params.mediaType - 'movie', 'tv', or 'all'
 * @param {number} params.limit - Max results
 * @returns {Promise<{ recommendations: object[], dataTier: string, recommendationType: string }>}
 */
export const getTieredRecommendations = async ({
  userId,
  userPlatforms = [],
  userGenres = [],
  watchlist = [],
  importedPlatforms = [],
  mediaType = 'all',
  limit = 20,
}) => {
  // Get preference profile if available
  let preferenceProfile = null
  try {
    preferenceProfile = await getPreferenceProfile(userId)
  } catch (e) {
    // Continue without profile
  }

  // Determine data tier
  const dataTier = preferenceProfile?.data_tier || 'none'

  let recommendations = []
  let recommendationType = 'trending'

  try {
    if (dataTier === 'full') {
      recommendations = await getFullDataRecommendations({
        userPlatforms,
        preferenceProfile,
        watchlist,
        mediaType,
        limit,
      })
      recommendationType = 'personalized'
    } else if (dataTier === 'partial') {
      recommendations = await getPartialDataRecommendations({
        userPlatforms,
        preferenceProfile,
        watchlist,
        userGenres,
        importedPlatforms,
        mediaType,
        limit,
      })
      recommendationType = 'cross_platform'
    } else {
      recommendations = await getNoDataRecommendations({
        userPlatforms,
        userGenres,
        watchlist,
        mediaType,
        limit,
      })
      recommendationType = 'trending'
    }
  } catch (error) {
    console.error('Error getting tiered recommendations:', error)
    // Fallback to basic trending
    const trending = await getTrending(mediaType === 'all' ? 'all' : mediaType, 'week')
    recommendations = trending.results?.map(item =>
      normalizeMedia(item, item.media_type || mediaType)
    ).slice(0, limit) || []
  }

  return {
    recommendations,
    dataTier,
    recommendationType,
  }
}

/**
 * Get recommendation section label based on type
 * @param {string} recommendationType
 * @param {string} sourcePlatform
 * @returns {{ title: string, subtitle: string }}
 */
export const getRecommendationLabel = (recommendationType, sourcePlatform = null) => {
  switch (recommendationType) {
    case 'personalized':
      return {
        title: 'Personalized for You',
        subtitle: 'Based on your complete watch history',
      }
    case 'cross_platform':
      return {
        title: sourcePlatform ? `Based on your ${PLATFORMS[sourcePlatform]?.name || sourcePlatform} history` : 'Cross-Platform Picks',
        subtitle: 'Discover similar content on your other platforms',
      }
    case 'based_on_history':
      return {
        title: 'Based on Your History',
        subtitle: 'Content matching your viewing patterns',
      }
    case 'trending':
    default:
      return {
        title: 'Trending Now',
        subtitle: 'Popular this week',
      }
  }
}
