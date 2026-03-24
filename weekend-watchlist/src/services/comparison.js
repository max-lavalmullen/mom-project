// Comparison Service for Pairwise Movie/TV Rankings

import { supabase, isSupabaseConfigured } from './supabase'
import { calculateNewRatings, selectComparisonPair } from './elo'

/**
 * Record a comparison and update Elo scores
 * @param {string} userId - User's ID
 * @param {object} winner - Winner item {tmdb_id, media_type, elo_score}
 * @param {object} loser - Loser item {tmdb_id, media_type, elo_score}
 * @returns {Promise<{data: object, error: Error|null}>}
 */
export const recordComparison = async (userId, winner, loser) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    // Calculate new Elo scores
    const { newWinnerElo, newLoserElo } = calculateNewRatings(
      winner.elo_score || 1500,
      loser.elo_score || 1500
    )

    // Insert comparison record
    const { error: compError } = await supabase
      .from('user_comparisons')
      .insert({
        user_id: userId,
        winner_tmdb_id: winner.tmdb_id,
        winner_media_type: winner.media_type,
        loser_tmdb_id: loser.tmdb_id,
        loser_media_type: loser.media_type,
      })

    if (compError) throw compError

    // Update winner's Elo and comparison count
    const { error: winnerError } = await supabase
      .from('user_watchlist')
      .update({
        elo_score: newWinnerElo,
        comparison_count: (winner.comparison_count || 0) + 1,
      })
      .eq('user_id', userId)
      .eq('tmdb_id', winner.tmdb_id)

    if (winnerError) throw winnerError

    // Update loser's Elo and comparison count
    const { error: loserError } = await supabase
      .from('user_watchlist')
      .update({
        elo_score: newLoserElo,
        comparison_count: (loser.comparison_count || 0) + 1,
      })
      .eq('user_id', userId)
      .eq('tmdb_id', loser.tmdb_id)

    if (loserError) throw loserError

    return {
      data: {
        winnerNewElo: newWinnerElo,
        loserNewElo: newLoserElo,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error recording comparison:', error)
    return { data: null, error }
  }
}

/**
 * Get the next pair of items to compare
 * @param {string} userId - User's ID
 * @param {string|null} mediaTypeFilter - 'movie', 'tv', or null for all
 * @returns {Promise<{data: {item1: object, item2: object}|null, error: Error|null}>}
 */
export const getNextPair = async (userId, mediaTypeFilter = null) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    let query = supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'watched')

    if (mediaTypeFilter) {
      query = query.eq('media_type', mediaTypeFilter)
    }

    const { data, error } = await query

    if (error) throw error

    if (!data || data.length < 2) {
      return {
        data: null,
        error: new Error('Need at least 2 watched items to compare'),
      }
    }

    const pair = selectComparisonPair(data)
    return { data: pair, error: null }
  } catch (error) {
    console.error('Error getting next pair:', error)
    return { data: null, error }
  }
}

/**
 * Get all items ranked by Elo score
 * @param {string} userId - User's ID
 * @param {string|null} mediaTypeFilter - 'movie', 'tv', or null for all
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export const getRankedList = async (userId, mediaTypeFilter = null) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    let query = supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'watched')
      .order('elo_score', { ascending: false })

    if (mediaTypeFilter) {
      query = query.eq('media_type', mediaTypeFilter)
    }

    const { data, error } = await query

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error getting ranked list:', error)
    return { data: null, error }
  }
}

/**
 * Get comparison statistics for a user
 * @param {string} userId - User's ID
 * @returns {Promise<{data: {totalComparisons: number, avgComparisonsPerItem: number}|null, error: Error|null}>}
 */
export const getComparisonStats = async (userId) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    const { data: comparisons, error: compError } = await supabase
      .from('user_comparisons')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)

    if (compError) throw compError

    const { data: watched, error: watchedError } = await supabase
      .from('user_watchlist')
      .select('comparison_count')
      .eq('user_id', userId)
      .eq('status', 'watched')

    if (watchedError) throw watchedError

    const totalComparisons = comparisons?.length || 0
    const watchedCount = watched?.length || 0
    const avgComparisonsPerItem = watchedCount > 0
      ? (watched.reduce((sum, item) => sum + (item.comparison_count || 0), 0) / watchedCount)
      : 0

    return {
      data: {
        totalComparisons,
        watchedCount,
        avgComparisonsPerItem: Math.round(avgComparisonsPerItem * 10) / 10,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error getting comparison stats:', error)
    return { data: null, error }
  }
}

/**
 * Initialize Elo scores for existing watchlist items based on their ratings
 * @param {string} userId - User's ID
 * @returns {Promise<{data: number, error: Error|null}>} Number of items updated
 */
export const initializeEloScores = async (userId) => {
  if (!isSupabaseConfigured()) {
    return { data: 0, error: new Error('Supabase not configured') }
  }

  try {
    // Get all watched items with ratings but no Elo adjustments
    const { data: items, error: fetchError } = await supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'watched')
      .not('rating', 'is', null)

    if (fetchError) throw fetchError

    let updated = 0
    for (const item of items || []) {
      // Only update if Elo is still at default (hasn't been compared)
      if (item.elo_score === 1500 && item.comparison_count === 0) {
        let newElo = 1500
        switch (item.rating) {
          case 5: newElo = 1800; break
          case 4: newElo = 1650; break
          case 3: newElo = 1500; break
          case 2: newElo = 1350; break
          case 1: newElo = 1200; break
        }

        if (newElo !== 1500) {
          const { error } = await supabase
            .from('user_watchlist')
            .update({ elo_score: newElo })
            .eq('id', item.id)

          if (!error) updated++
        }
      }
    }

    return { data: updated, error: null }
  } catch (error) {
    console.error('Error initializing Elo scores:', error)
    return { data: 0, error }
  }
}
