/**
 * Rating Predictor Service
 * Predicts how much a user will enjoy a movie/show based on their preferences
 */

/**
 * Predict a user's rating for a piece of content
 * @param {object} details - TMDb details object (movie or TV)
 * @param {object} preferenceProfile - User's preference profile from preferenceEngine
 * @param {object} userPreferences - User's explicit preferences (genres, platforms)
 * @returns {{ score: number, confidence: number, reasons: string[] }}
 */
export const predictUserRating = (details, preferenceProfile, userPreferences) => {
  const reasons = []
  let score = 5.0 // Start at neutral (5/10 scale)
  let totalWeight = 0
  let matchWeight = 0

  // 1. Genre matching
  const genres = details.genres || []
  const genrePrefs = preferenceProfile?.genre_preferences || {}
  const explicitGenres = userPreferences?.genres?.map(g => g.genre_id) || []

  let genreScore = 0
  let genreMatches = 0

  for (const genre of genres) {
    // Check preference profile (from imported history)
    if (genrePrefs[genre.id]) {
      const weight = genrePrefs[genre.id]
      genreScore += weight * 2 // Scale: 0-2
      genreMatches++
      if (weight > 0.5) {
        reasons.push(`You've watched a lot of ${genre.name} content`)
      }
    }
    // Check explicit preferences
    if (explicitGenres.includes(genre.id)) {
      genreScore += 1.5
      genreMatches++
      if (!reasons.some(r => r.includes(genre.name))) {
        reasons.push(`${genre.name} is one of your favorite genres`)
      }
    }
  }

  if (genres.length > 0) {
    // Normalize genre score
    const avgGenreScore = genreMatches > 0 ? genreScore / genreMatches : 0
    score += avgGenreScore
    totalWeight += 3
    matchWeight += avgGenreScore > 1 ? 3 : avgGenreScore > 0.5 ? 2 : 1
  }

  // 2. Actor matching (if we have preferred actors)
  const preferredActors = preferenceProfile?.preferred_actors || []
  const cast = details.credits?.cast || []

  for (const actor of cast.slice(0, 5)) {
    const match = preferredActors.find(a => a.id === actor.id)
    if (match) {
      score += 0.5
      matchWeight += 1
      if (reasons.length < 5) {
        reasons.push(`Stars ${actor.name}, who you've enjoyed before`)
      }
    }
  }
  totalWeight += 1

  // 3. Director matching
  const preferredDirectors = preferenceProfile?.preferred_directors || []
  const crew = details.credits?.crew || []
  const director = crew.find(c => c.job === 'Director')

  if (director) {
    const dirMatch = preferredDirectors.find(d => d.id === director.id)
    if (dirMatch) {
      score += 1
      matchWeight += 2
      reasons.push(`Directed by ${director.name}, whose work you've liked`)
    }
  }
  totalWeight += 1

  // 4. Rating quality bonus
  if (details.vote_average && details.vote_count) {
    // High-rated content with many votes
    if (details.vote_average >= 7.5 && details.vote_count > 1000) {
      score += 0.5
      reasons.push(`Highly rated by audiences (${details.vote_average.toFixed(1)}/10)`)
    } else if (details.vote_average >= 8.0 && details.vote_count > 500) {
      score += 0.5
      reasons.push(`Critically acclaimed`)
    }
    // Poorly rated content
    if (details.vote_average < 5.0 && details.vote_count > 100) {
      score -= 0.5
    }
  }
  totalWeight += 0.5

  // 5. Recency for TV shows
  if (details.in_production || details.status === 'Returning Series') {
    score += 0.25
    if (reasons.length < 6) {
      reasons.push('Currently airing with new episodes')
    }
  }

  // 6. Movie vs TV preference
  const movieTVRatio = preferenceProfile?.movie_vs_tv_ratio
  if (movieTVRatio !== null && movieTVRatio !== undefined) {
    const isMovie = details.title !== undefined // Movies have 'title', TV has 'name'
    if (isMovie && movieTVRatio > 0.6) {
      score += 0.25 // User prefers movies
    } else if (!isMovie && movieTVRatio < 0.4) {
      score += 0.25 // User prefers TV
    }
  }

  // Normalize to 1-10 scale
  score = Math.max(1, Math.min(10, score))

  // Calculate confidence based on how much data we have
  let confidence = 0

  // Base confidence on preference profile availability
  if (preferenceProfile?.data_tier === 'full') {
    confidence = 85
  } else if (preferenceProfile?.data_tier === 'partial') {
    confidence = 65
  } else if (Object.keys(genrePrefs).length > 0) {
    confidence = 50
  } else if (explicitGenres.length > 0) {
    confidence = 40
  } else {
    confidence = 25
  }

  // Adjust based on match weight
  confidence = Math.min(95, confidence + (matchWeight * 3))

  // Lower confidence for sparse data
  if (totalWeight > 0 && matchWeight / totalWeight < 0.3) {
    confidence = Math.max(20, confidence - 15)
  }

  // Add a base reason if we don't have specific ones
  if (reasons.length === 0) {
    if (details.vote_average >= 7.0) {
      reasons.push('Popular with audiences')
    }
    if (details.popularity > 100) {
      reasons.push('Currently trending')
    }
  }

  return {
    score: Math.round(score * 10) / 10,
    confidence: Math.round(confidence),
    reasons: reasons.slice(0, 5), // Max 5 reasons
  }
}

/**
 * Calculate genre match score for quick filtering
 * @param {number[]} itemGenres - Genre IDs of the item
 * @param {object} genrePreferences - User's genre preferences
 * @returns {number} Score from 0-1
 */
export const getGenreMatchScore = (itemGenres, genrePreferences) => {
  if (!itemGenres?.length || !genrePreferences) return 0

  let totalScore = 0
  for (const genreId of itemGenres) {
    totalScore += genrePreferences[genreId] || 0
  }

  return Math.min(1, totalScore / itemGenres.length)
}

export default {
  predictUserRating,
  getGenreMatchScore,
}
