// Letterboxd Integration Service

import { supabase, isSupabaseConfigured } from './supabase'
import { matchMovieToTMDb } from './movieMatcher'
import { ratingToInitialElo } from './elo'

const CORS_PROXY = 'https://api.allorigins.win/raw?url='

/**
 * Fetch Letterboxd RSS feed for a user
 * Uses a CORS proxy to fetch the feed from the client
 * @param {string} username - Letterboxd username
 * @returns {Promise<{xml: string, error: Error|null}>}
 */
export const fetchLetterboxdFeed = async (username) => {
  if (!username) {
    return { xml: null, error: new Error('Username is required') }
  }

  const feedUrl = `https://letterboxd.com/${username}/rss/`

  try {
    // Use CORS proxy to fetch the RSS feed
    const response = await fetch(CORS_PROXY + encodeURIComponent(feedUrl))

    if (!response.ok) {
      if (response.status === 404) {
        return { xml: null, error: new Error('Letterboxd user not found') }
      }
      throw new Error(`Failed to fetch feed: ${response.status}`)
    }

    const xml = await response.text()

    // Basic validation that this is a valid RSS feed
    if (!xml.includes('<rss') || !xml.includes('<channel>')) {
      return { xml: null, error: new Error('Invalid RSS feed or user not found') }
    }

    return { xml, error: null }
  } catch (error) {
    console.error('Error fetching Letterboxd feed:', error)
    return { xml: null, error }
  }
}

/**
 * Extract review text from Letterboxd description HTML
 * @param {string} html - Description HTML from RSS feed
 * @returns {string|null} Plain text review or null
 */
const extractReviewFromDescription = (html) => {
  if (!html) return null

  try {
    // Create a temporary element to parse HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Remove the poster image if present
    const img = tempDiv.querySelector('img')
    if (img) img.remove()

    // Remove "Watched on" date paragraph
    const paragraphs = tempDiv.querySelectorAll('p')
    paragraphs.forEach(p => {
      if (p.textContent?.includes('Watched on')) {
        p.remove()
      }
    })

    // Get the remaining text content
    let reviewText = tempDiv.textContent?.trim() || ''

    // Remove star ratings that might be at the start (e.g., "★★★★")
    reviewText = reviewText.replace(/^[★☆]+\s*[-–—]?\s*/, '')

    // Clean up extra whitespace
    reviewText = reviewText.replace(/\s+/g, ' ').trim()

    // Return null if empty or just whitespace
    return reviewText.length > 0 ? reviewText : null
  } catch (error) {
    console.error('Error extracting review:', error)
    return null
  }
}

/**
 * Parse Letterboxd RSS feed XML to extract watched movies
 * @param {string} xml - RSS feed XML
 * @returns {Array<{title: string, year: string, rating: number|null, watchedDate: string, review: string|null}>}
 */
export const parseLetterboxdFeed = (xml) => {
  const movies = []

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    const items = doc.querySelectorAll('item')

    items.forEach(item => {
      // Extract film title (letterboxd:filmTitle)
      const filmTitle = item.querySelector('filmTitle')?.textContent
      if (!filmTitle) return // Skip non-film items

      // Extract film year (letterboxd:filmYear)
      const filmYear = item.querySelector('filmYear')?.textContent

      // Extract member rating (letterboxd:memberRating)
      const memberRating = item.querySelector('memberRating')?.textContent
      const rating = memberRating ? parseFloat(memberRating) : null

      // Extract watched date from pubDate
      const pubDate = item.querySelector('pubDate')?.textContent
      const watchedDate = pubDate ? new Date(pubDate).toISOString() : null

      // Extract review from description
      const description = item.querySelector('description')?.textContent
      const review = extractReviewFromDescription(description)

      movies.push({
        title: filmTitle,
        year: filmYear,
        rating, // Letterboxd uses 0.5-5.0 scale
        watchedDate,
        review,
      })
    })
  } catch (error) {
    console.error('Error parsing Letterboxd feed:', error)
  }

  return movies
}

/**
 * Import movies from Letterboxd to user's watchlist
 * @param {string} userId - User's ID
 * @param {Array<{title: string, year: string, rating: number|null, review: string|null}>} movies - Parsed movies
 * @param {function} onProgress - Progress callback (current, total, status)
 * @returns {Promise<{imported: number, matched: number, skipped: number, reviewsImported: number, error: Error|null}>}
 */
export const importFromLetterboxd = async (userId, movies, onProgress = null) => {
  if (!isSupabaseConfigured()) {
    return { imported: 0, matched: 0, skipped: 0, reviewsImported: 0, error: new Error('Supabase not configured') }
  }

  let imported = 0
  let matched = 0
  let skipped = 0
  let reviewsImported = 0

  try {
    // Get existing watchlist to check for duplicates
    const { data: existingList, error: fetchError } = await supabase
      .from('user_watchlist')
      .select('tmdb_id')
      .eq('user_id', userId)

    if (fetchError) throw fetchError

    const existingIds = new Set((existingList || []).map(item => item.tmdb_id))

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i]

      if (onProgress) {
        onProgress(i + 1, movies.length, `Matching: ${movie.title}`)
      }

      // Match to TMDb
      const tmdbMatch = await matchMovieToTMDb(movie.title, movie.year)

      if (!tmdbMatch) {
        skipped++
        continue
      }

      matched++

      // Check if already in watchlist
      if (existingIds.has(tmdbMatch.id)) {
        // Update with Letterboxd data (rating and review if not already set)
        const updates = {
          imported_from: 'letterboxd',
        }

        if (movie.rating) {
          updates.letterboxd_rating = movie.rating
        }

        // Import review if one exists from Letterboxd
        if (movie.review) {
          // Get current item to check if it already has a review
          const { data: currentItem } = await supabase
            .from('user_watchlist')
            .select('review')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbMatch.id)
            .single()

          // Only update review if user doesn't already have one
          if (!currentItem?.review) {
            updates.review = movie.review
            updates.review_updated_at = new Date().toISOString()
            reviewsImported++
          }
        }

        await supabase
          .from('user_watchlist')
          .update(updates)
          .eq('user_id', userId)
          .eq('tmdb_id', tmdbMatch.id)

        skipped++
        continue
      }

      // Convert Letterboxd rating (0.5-5.0) to integer star rating (1-5)
      const starRating = movie.rating ? Math.round(movie.rating) : null

      // Get initial Elo based on rating
      const initialElo = ratingToInitialElo(starRating)

      // Add to watchlist
      const { error: insertError } = await supabase
        .from('user_watchlist')
        .insert({
          user_id: userId,
          tmdb_id: tmdbMatch.id,
          media_type: 'movie',
          status: 'watched',
          rating: starRating,
          elo_score: initialElo,
          comparison_count: 0,
          imported_from: 'letterboxd',
          letterboxd_rating: movie.rating,
          review: movie.review || null,
          review_updated_at: movie.review ? new Date().toISOString() : null,
        })

      if (!insertError) {
        imported++
        if (movie.review) reviewsImported++
        existingIds.add(tmdbMatch.id) // Track to avoid duplicates in same batch
      }

      // Small delay to avoid rate limiting
      if (i < movies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    return { imported, matched, skipped, reviewsImported, error: null }
  } catch (error) {
    console.error('Error importing from Letterboxd:', error)
    return { imported, matched, skipped, reviewsImported, error }
  }
}

/**
 * Get user's Letterboxd connection info
 * @param {string} userId - User's ID
 * @returns {Promise<{data: {username: string, lastSyncAt: string}|null, error: Error|null}>}
 */
export const getLetterboxdConnection = async (userId) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    const { data, error } = await supabase
      .from('user_letterboxd')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    return {
      data: data ? {
        username: data.letterboxd_username,
        lastSyncAt: data.last_sync_at,
      } : null,
      error: null,
    }
  } catch (error) {
    console.error('Error getting Letterboxd connection:', error)
    return { data: null, error }
  }
}

/**
 * Save Letterboxd connection
 * @param {string} userId - User's ID
 * @param {string} username - Letterboxd username
 * @returns {Promise<{error: Error|null}>}
 */
export const saveLetterboxdConnection = async (userId, username) => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') }
  }

  try {
    const { error } = await supabase
      .from('user_letterboxd')
      .upsert({
        user_id: userId,
        letterboxd_username: username,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) throw error

    return { error: null }
  } catch (error) {
    console.error('Error saving Letterboxd connection:', error)
    return { error }
  }
}

/**
 * Remove Letterboxd connection
 * @param {string} userId - User's ID
 * @returns {Promise<{error: Error|null}>}
 */
export const removeLetterboxdConnection = async (userId) => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') }
  }

  try {
    const { error } = await supabase
      .from('user_letterboxd')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    return { error: null }
  } catch (error) {
    console.error('Error removing Letterboxd connection:', error)
    return { error }
  }
}

/**
 * Sync user's Letterboxd watched movies
 * @param {string} userId - User's ID
 * @param {string} username - Letterboxd username
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{imported: number, matched: number, skipped: number, error: Error|null}>}
 */
export const syncLetterboxd = async (userId, username, onProgress = null) => {
  // Fetch feed
  if (onProgress) onProgress(0, 0, 'Fetching Letterboxd feed...')

  const { xml, error: fetchError } = await fetchLetterboxdFeed(username)
  if (fetchError) {
    return { imported: 0, matched: 0, skipped: 0, error: fetchError }
  }

  // Parse feed
  if (onProgress) onProgress(0, 0, 'Parsing movies...')
  const movies = parseLetterboxdFeed(xml)

  if (movies.length === 0) {
    return { imported: 0, matched: 0, skipped: 0, error: new Error('No movies found in feed') }
  }

  // Import movies
  const result = await importFromLetterboxd(userId, movies, onProgress)

  // Update sync time
  if (!result.error) {
    await saveLetterboxdConnection(userId, username)
  }

  return result
}
