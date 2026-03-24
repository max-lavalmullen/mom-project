// Movie Matcher Service - Match movie and TV titles to TMDb

import { searchMovies, searchTV } from './tmdb'

/**
 * Match a movie title and year to a TMDb movie
 * @param {string} title - Movie title
 * @param {string|number|null} year - Release year (optional)
 * @returns {Promise<{id: number, title: string, year: string, posterPath: string}|null>}
 */
export const matchMovieToTMDb = async (title, year = null) => {
  if (!title) return null

  try {
    // Search with year in query for better results
    const searchQuery = year ? `${title} ${year}` : title
    const { results } = await searchMovies(searchQuery)

    if (!results || results.length === 0) {
      // Try without year if no results
      if (year) {
        const { results: retryResults } = await searchMovies(title)
        if (!retryResults || retryResults.length === 0) {
          return null
        }
        return findBestMatch(retryResults, title, year)
      }
      return null
    }

    return findBestMatch(results, title, year)
  } catch (error) {
    console.error('Error matching movie to TMDb:', error)
    return null
  }
}

/**
 * Find the best match from search results
 * @param {Array} results - TMDb search results
 * @param {string} title - Original title
 * @param {string|number|null} year - Original year
 * @returns {{id: number, title: string, year: string, posterPath: string}|null}
 */
const findBestMatch = (results, title, year) => {
  const normalizedTitle = normalizeTitle(title)
  const targetYear = year ? parseInt(year, 10) : null

  // Score each result
  const scored = results.map(movie => {
    let score = 0

    // Title similarity
    const movieTitle = normalizeTitle(movie.title || '')
    if (movieTitle === normalizedTitle) {
      score += 100
    } else if (movieTitle.includes(normalizedTitle) || normalizedTitle.includes(movieTitle)) {
      score += 50
    }

    // Year matching
    const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : null
    if (targetYear && movieYear) {
      if (movieYear === targetYear) {
        score += 50
      } else if (Math.abs(movieYear - targetYear) === 1) {
        score += 25 // Off by one year is acceptable
      }
    }

    // Popularity boost for ambiguous matches
    score += Math.min(movie.popularity || 0, 20) / 2

    return { movie, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < 30) {
    return null // No good match found
  }

  return {
    id: best.movie.id,
    title: best.movie.title,
    year: best.movie.release_date ? best.movie.release_date.substring(0, 4) : null,
    posterPath: best.movie.poster_path,
  }
}

/**
 * Normalize a title for comparison
 * @param {string} title - Original title
 * @returns {string} Normalized title
 */
const normalizeTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Match multiple movies to TMDb
 * @param {Array<{title: string, year: string|number}>} movies - Array of movies to match
 * @param {function} onProgress - Progress callback (matched, total)
 * @returns {Promise<Array<{original: object, match: object|null}>>}
 */
export const matchMoviesToTMDb = async (movies, onProgress = null) => {
  const results = []

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i]
    const match = await matchMovieToTMDb(movie.title, movie.year)

    results.push({
      original: movie,
      match,
    })

    if (onProgress) {
      onProgress(i + 1, movies.length)
    }

    // Small delay to avoid rate limiting
    if (i < movies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Match a TV show title and year to a TMDb TV show
 * @param {string} title - TV show title
 * @param {string|number|null} year - First air year (optional)
 * @returns {Promise<{id: number, title: string, year: string, posterPath: string}|null>}
 */
export const matchTVToTMDb = async (title, year = null) => {
  if (!title) return null

  try {
    // Search with year in query for better results
    const searchQuery = year ? `${title} ${year}` : title
    const { results } = await searchTV(searchQuery)

    if (!results || results.length === 0) {
      // Try without year if no results
      if (year) {
        const { results: retryResults } = await searchTV(title)
        if (!retryResults || retryResults.length === 0) {
          return null
        }
        return findBestTVMatch(retryResults, title, year)
      }
      return null
    }

    return findBestTVMatch(results, title, year)
  } catch (error) {
    console.error('Error matching TV show to TMDb:', error)
    return null
  }
}

/**
 * Find the best TV show match from search results
 * @param {Array} results - TMDb search results
 * @param {string} title - Original title
 * @param {string|number|null} year - Original year
 * @returns {{id: number, title: string, year: string, posterPath: string}|null}
 */
const findBestTVMatch = (results, title, year) => {
  const normalizedTitle = normalizeTitle(title)
  const targetYear = year ? parseInt(year, 10) : null

  // Score each result
  const scored = results.map(show => {
    let score = 0

    // Title similarity
    const showTitle = normalizeTitle(show.name || '')
    if (showTitle === normalizedTitle) {
      score += 100
    } else if (showTitle.includes(normalizedTitle) || normalizedTitle.includes(showTitle)) {
      score += 50
    }

    // Year matching
    const showYear = show.first_air_date ? parseInt(show.first_air_date.substring(0, 4), 10) : null
    if (targetYear && showYear) {
      if (showYear === targetYear) {
        score += 50
      } else if (Math.abs(showYear - targetYear) === 1) {
        score += 25 // Off by one year is acceptable
      } else if (Math.abs(showYear - targetYear) <= 3) {
        score += 10 // TV shows can have longer runs
      }
    }

    // Popularity boost for ambiguous matches
    score += Math.min(show.popularity || 0, 20) / 2

    return { show, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < 30) {
    return null // No good match found
  }

  return {
    id: best.show.id,
    title: best.show.name,
    year: best.show.first_air_date ? best.show.first_air_date.substring(0, 4) : null,
    posterPath: best.show.poster_path,
  }
}

/**
 * Match multiple TV shows to TMDb
 * @param {Array<{title: string, year: string|number}>} shows - Array of TV shows to match
 * @param {function} onProgress - Progress callback (matched, total)
 * @returns {Promise<Array<{original: object, match: object|null}>>}
 */
export const matchTVShowsToTMDb = async (shows, onProgress = null) => {
  const results = []

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i]
    const match = await matchTVToTMDb(show.title, show.year)

    results.push({
      original: show,
      match,
    })

    if (onProgress) {
      onProgress(i + 1, shows.length)
    }

    // Small delay to avoid rate limiting
    if (i < shows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Match a media item (movie or TV) to TMDb based on mediaType
 * @param {string} title - Title
 * @param {string|number|null} year - Year (optional)
 * @param {'movie'|'tv'} mediaType - Media type
 * @returns {Promise<{id: number, title: string, year: string, posterPath: string, mediaType: string}|null>}
 */
export const matchMediaToTMDb = async (title, year = null, mediaType = 'movie') => {
  const match = mediaType === 'tv'
    ? await matchTVToTMDb(title, year)
    : await matchMovieToTMDb(title, year)

  if (match) {
    return { ...match, mediaType }
  }

  // If no match found and mediaType was guessed, try the other type
  const fallbackMatch = mediaType === 'tv'
    ? await matchMovieToTMDb(title, year)
    : await matchTVToTMDb(title, year)

  if (fallbackMatch) {
    return { ...fallbackMatch, mediaType: mediaType === 'tv' ? 'movie' : 'tv' }
  }

  return null
}

/**
 * Match multiple media items to TMDb
 * @param {Array<{title: string, year: string|number, mediaType: 'movie'|'tv'}>} items - Array of items to match
 * @param {function} onProgress - Progress callback (matched, total, current)
 * @returns {Promise<Array<{original: object, match: object|null}>>}
 */
export const matchMediaItemsToTMDb = async (items, onProgress = null) => {
  const results = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const match = await matchMediaToTMDb(item.title, item.year, item.mediaType || 'movie')

    results.push({
      original: item,
      match,
    })

    if (onProgress) {
      onProgress(i + 1, items.length, item)
    }

    // Small delay to avoid rate limiting
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}
