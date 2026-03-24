// Elo Rating System for Movie/TV Rankings

const K_FACTOR = 32
const INITIAL_ELO = 1500

/**
 * Calculate expected score based on Elo ratings
 * @param {number} playerElo - Player's Elo rating
 * @param {number} opponentElo - Opponent's Elo rating
 * @returns {number} Expected score between 0 and 1
 */
export const getExpectedScore = (playerElo, opponentElo) => {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
}

/**
 * Calculate new Elo ratings after a comparison
 * @param {number} winnerElo - Winner's current Elo
 * @param {number} loserElo - Loser's current Elo
 * @returns {{newWinnerElo: number, newLoserElo: number}} New ratings for both
 */
export const calculateNewRatings = (winnerElo, loserElo) => {
  const expectedWinner = getExpectedScore(winnerElo, loserElo)
  const expectedLoser = getExpectedScore(loserElo, winnerElo)

  // Winner gets score of 1, loser gets 0
  const newWinnerElo = Math.round(winnerElo + K_FACTOR * (1 - expectedWinner))
  const newLoserElo = Math.round(loserElo + K_FACTOR * (0 - expectedLoser))

  return {
    newWinnerElo,
    newLoserElo,
  }
}

/**
 * Convert Elo score to star rating (0.5 to 5.0) based on percentile
 * @param {number} elo - Item's Elo score
 * @param {number[]} allUserElos - Array of all user's Elo scores
 * @returns {number} Star rating between 0.5 and 5.0
 */
export const eloToStars = (elo, allUserElos) => {
  if (!allUserElos || allUserElos.length === 0) {
    return 3.0 // Default middle rating
  }

  if (allUserElos.length === 1) {
    return 3.5 // Single item gets slightly above average
  }

  // Sort Elos ascending to calculate percentile
  const sorted = [...allUserElos].sort((a, b) => a - b)
  const index = sorted.findIndex(e => e >= elo)
  const percentile = index === -1 ? 1 : index / sorted.length

  // Convert percentile to stars
  // Top 5%: 5.0 stars
  // 80-95%: 4.5 stars
  // 60-80%: 4.0 stars
  // 40-60%: 3.5 stars
  // 20-40%: 3.0 stars
  // 5-20%: 2.5 stars
  // Bottom 5%: 2.0 stars
  if (percentile >= 0.95) return 5.0
  if (percentile >= 0.80) return 4.5
  if (percentile >= 0.60) return 4.0
  if (percentile >= 0.40) return 3.5
  if (percentile >= 0.20) return 3.0
  if (percentile >= 0.05) return 2.5
  return 2.0
}

/**
 * Select the next pair of items to compare
 * Prioritizes items with similar Elo scores and low comparison counts
 * @param {Array} watchedItems - Array of watched items with elo_score and comparison_count
 * @returns {{item1: object, item2: object} | null} Pair to compare or null if not enough items
 */
export const selectComparisonPair = (watchedItems) => {
  if (!watchedItems || watchedItems.length < 2) {
    return null
  }

  // Sort by comparison count (ascending) to prioritize under-compared items
  const sorted = [...watchedItems].sort((a, b) => {
    // Primary: comparison count (lower first)
    const countDiff = (a.comparison_count || 0) - (b.comparison_count || 0)
    if (countDiff !== 0) return countDiff
    // Secondary: random for variety
    return Math.random() - 0.5
  })

  // Pick the item with lowest comparison count
  const item1 = sorted[0]

  // Find a good opponent:
  // - Similar Elo score (within 300 points) preferred
  // - Low comparison count preferred
  // - Different from item1
  const candidates = sorted.filter(item => item.tmdb_id !== item1.tmdb_id)

  if (candidates.length === 0) {
    return null
  }

  // Score candidates based on Elo similarity and comparison count
  const scoredCandidates = candidates.map(item => {
    const eloDiff = Math.abs((item.elo_score || INITIAL_ELO) - (item1.elo_score || INITIAL_ELO))
    const eloScore = Math.max(0, 300 - eloDiff) / 300 // 1.0 for same Elo, 0 for 300+ diff
    const countScore = 1 / (1 + (item.comparison_count || 0)) // Higher for fewer comparisons

    return {
      item,
      score: eloScore * 0.6 + countScore * 0.4 + Math.random() * 0.2, // Add randomness
    }
  })

  // Sort by score and pick the best
  scoredCandidates.sort((a, b) => b.score - a.score)
  const item2 = scoredCandidates[0].item

  // Randomly swap order so position doesn't bias choices
  return Math.random() > 0.5
    ? { item1, item2 }
    : { item1: item2, item2: item1 }
}

/**
 * Get initial Elo based on existing star rating
 * @param {number|null} rating - Existing 1-5 star rating
 * @returns {number} Initial Elo score
 */
export const ratingToInitialElo = (rating) => {
  if (!rating) return INITIAL_ELO

  switch (rating) {
    case 5: return 1800
    case 4: return 1650
    case 3: return 1500
    case 2: return 1350
    case 1: return 1200
    default: return INITIAL_ELO
  }
}

export { K_FACTOR, INITIAL_ELO }
