// Preference Engine Service
// Computes unified preference profile from all imports with recency weighting

import { supabase } from './supabase'
import { getMovieDetails, getTVDetails } from './tmdb'

/**
 * Compute and save a user's preference profile based on their watch history
 * @param {string} userId - User ID
 * @returns {Promise<{ success: boolean, profile?: object, error?: string }>}
 */
export const computePreferenceProfile = async (userId) => {
  try {
    // Get user's watchlist
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'watched')
      .order('watch_date', { ascending: false, nullsFirst: false })

    if (watchlistError) {
      throw new Error('Failed to fetch watchlist: ' + watchlistError.message)
    }

    // Get user's platforms
    const { data: platforms } = await supabase
      .from('user_platforms')
      .select('platform_name')
      .eq('user_id', userId)

    // Get import statuses
    const { data: imports } = await supabase
      .from('user_platform_imports')
      .select('platform_name, import_status')
      .eq('user_id', userId)

    // Calculate data tier
    const dataTier = calculateDataTier(
      platforms?.map(p => p.platform_name) || [],
      imports || []
    )

    // Compute genre preferences with recency weighting
    const genrePreferences = await computeGenrePreferences(watchlist || [])

    // Compute actor/director preferences
    const { actors, directors } = await computeCrewPreferences(watchlist || [])

    // Compute completion rate
    const completionRate = computeCompletionRate(watchlist || [])

    // Compute movie vs TV ratio
    const movieVsTVRatio = computeMovieVsTVRatio(watchlist || [])

    // Save profile
    const profile = {
      genre_preferences: genrePreferences,
      preferred_actors: actors,
      preferred_directors: directors,
      completion_rate: completionRate,
      movie_vs_tv_ratio: movieVsTVRatio,
      data_tier: dataTier,
      total_imported_items: watchlist?.length || 0,
      last_computed_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('user_preference_profiles')
      .upsert({
        user_id: userId,
        ...profile,
      }, {
        onConflict: 'user_id',
      })

    if (saveError) {
      throw new Error('Failed to save profile: ' + saveError.message)
    }

    return { success: true, profile }
  } catch (error) {
    console.error('Error computing preference profile:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Calculate data tier based on platform coverage
 * @param {string[]} subscribedPlatforms - Platforms user subscribes to
 * @param {Array<{ platform_name: string, import_status: string }>} imports - Import records
 * @returns {'full'|'partial'|'none'}
 */
const calculateDataTier = (subscribedPlatforms, imports) => {
  if (subscribedPlatforms.length === 0) {
    return 'none'
  }

  const completedImports = imports.filter(i => i.import_status === 'completed')
  const importedPlatforms = completedImports.map(i => i.platform_name)

  // Count how many subscribed platforms have imports
  const importedSubscribed = subscribedPlatforms.filter(p => importedPlatforms.includes(p))
  const coverageRate = importedSubscribed.length / subscribedPlatforms.length

  if (coverageRate >= 0.8) {
    return 'full'
  } else if (coverageRate > 0) {
    return 'partial'
  }
  return 'none'
}

/**
 * Compute genre preferences with recency weighting
 * @param {Array} watchlist - User's watched items
 * @returns {Promise<Object<number, number>>} Genre ID to weight mapping
 */
const computeGenrePreferences = async (watchlist) => {
  const genreScores = {}
  const now = Date.now()
  const oneYearMs = 365 * 24 * 60 * 60 * 1000

  // Process items in batches to avoid rate limiting
  const batchSize = 10
  for (let i = 0; i < Math.min(watchlist.length, 50); i += batchSize) {
    const batch = watchlist.slice(i, i + batchSize)

    await Promise.all(batch.map(async (item) => {
      try {
        const details = item.media_type === 'movie'
          ? await getMovieDetails(item.tmdb_id)
          : await getTVDetails(item.tmdb_id)

        if (!details.genres) return

        // Calculate recency weight (1.0 for items watched today, decays over time)
        let recencyWeight = 1.0
        if (item.watch_date) {
          const watchTime = new Date(item.watch_date).getTime()
          const ageMs = now - watchTime
          recencyWeight = Math.max(0.3, 1 - (ageMs / (2 * oneYearMs)))
        }

        // Weight by completion if available
        const completionWeight = item.completion_percentage
          ? item.completion_percentage / 100
          : 0.75 // Assume 75% if unknown

        const totalWeight = recencyWeight * completionWeight

        // Add weighted score for each genre
        for (const genre of details.genres) {
          genreScores[genre.id] = (genreScores[genre.id] || 0) + totalWeight
        }
      } catch (error) {
        // Skip items we can't fetch details for
      }
    }))

    // Small delay between batches
    if (i + batchSize < watchlist.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...Object.values(genreScores), 1)
  const normalized = {}
  for (const [genreId, score] of Object.entries(genreScores)) {
    normalized[genreId] = Math.round((score / maxScore) * 100) / 100
  }

  return normalized
}

/**
 * Compute preferred actors and directors
 * @param {Array} watchlist - User's watched items
 * @returns {Promise<{ actors: Array<{ id: number, name: string, score: number }>, directors: Array<{ id: number, name: string, score: number }> }>}
 */
const computeCrewPreferences = async (watchlist) => {
  const actorScores = new Map() // id -> { name, score }
  const directorScores = new Map()

  // Process a sample of recent items
  const sample = watchlist.slice(0, 30)

  for (const item of sample) {
    try {
      const details = item.media_type === 'movie'
        ? await getMovieDetails(item.tmdb_id)
        : await getTVDetails(item.tmdb_id)

      // Process cast (top 5)
      const cast = details.credits?.cast || []
      for (const actor of cast.slice(0, 5)) {
        const existing = actorScores.get(actor.id) || { name: actor.name, score: 0 }
        existing.score += 1
        actorScores.set(actor.id, existing)
      }

      // Process crew (directors)
      const crew = details.credits?.crew || []
      for (const person of crew) {
        if (person.job === 'Director') {
          const existing = directorScores.get(person.id) || { name: person.name, score: 0 }
          existing.score += 1
          directorScores.set(person.id, existing)
        }
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      // Skip items we can't fetch
    }
  }

  // Convert to sorted arrays
  const actors = Array.from(actorScores.entries())
    .map(([id, { name, score }]) => ({ id, name, score }))
    .filter(a => a.score >= 2) // Only include if appears in 2+ items
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  const directors = Array.from(directorScores.entries())
    .map(([id, { name, score }]) => ({ id, name, score }))
    .filter(d => d.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return { actors, directors }
}

/**
 * Compute average completion rate
 * @param {Array} watchlist - User's watched items
 * @returns {number} Average completion rate (0-1)
 */
const computeCompletionRate = (watchlist) => {
  const itemsWithCompletion = watchlist.filter(w => w.completion_percentage != null)
  if (itemsWithCompletion.length === 0) return null

  const sum = itemsWithCompletion.reduce((acc, w) => acc + w.completion_percentage, 0)
  return Math.round((sum / itemsWithCompletion.length) / 100 * 100) / 100
}

/**
 * Compute movie vs TV ratio
 * @param {Array} watchlist - User's watched items
 * @returns {number} Ratio of movies to total (0-1), 0.5 = equal, >0.5 = more movies
 */
const computeMovieVsTVRatio = (watchlist) => {
  if (watchlist.length === 0) return 0.5

  const movies = watchlist.filter(w => w.media_type === 'movie').length
  return Math.round((movies / watchlist.length) * 100) / 100
}

/**
 * Get a user's preference profile
 * @param {string} userId - User ID
 * @returns {Promise<object|null>}
 */
export const getPreferenceProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_preference_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile exists yet
      return null
    }
    console.error('Error fetching preference profile:', error)
    return null
  }

  return data
}

/**
 * Get the data tier for a user
 * @param {string} userId - User ID
 * @returns {Promise<'full'|'partial'|'none'>}
 */
export const getDataTier = async (userId) => {
  const profile = await getPreferenceProfile(userId)
  return profile?.data_tier || 'none'
}

/**
 * Check if profile needs recomputation
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export const needsRecomputation = async (userId) => {
  const profile = await getPreferenceProfile(userId)
  if (!profile) return true

  // Recompute if last computation was over 24 hours ago
  if (!profile.last_computed_at) return true

  const lastComputed = new Date(profile.last_computed_at)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  return lastComputed < oneDayAgo
}

export default {
  computePreferenceProfile,
  getPreferenceProfile,
  getDataTier,
  needsRecomputation,
}
