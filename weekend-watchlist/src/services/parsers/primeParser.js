// Amazon Prime Video Parser
// Parses Prime Video watch history from Amazon data export

/**
 * Validate if file content is valid Prime Video export
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {{ valid: boolean, error?: string }}
 */
const validate = (content, fileType) => {
  if (fileType === '.json') {
    try {
      const data = JSON.parse(content)
      // Check for expected structure
      if (Array.isArray(data) || data.watchHistory || data.ViewingHistory) {
        return { valid: true }
      }
      return { valid: false, error: 'JSON structure not recognized as Prime Video export' }
    } catch {
      return { valid: false, error: 'Invalid JSON file' }
    }
  }

  if (fileType === '.csv') {
    const firstLine = content.split('\n')[0].toLowerCase()
    if (firstLine.includes('title') || firstLine.includes('asin')) {
      return { valid: true }
    }
    return { valid: false, error: 'CSV structure not recognized as Prime Video export' }
  }

  return { valid: false, error: 'Prime Video export should be JSON or CSV' }
}

/**
 * Parse Prime Video watch history
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {Array<{ title: string, year: number|null, watchDate: Date|null, completionPct: number|null, mediaType: 'movie'|'tv' }>}
 */
const parse = (content, fileType = '.json') => {
  if (fileType === '.json') {
    return parseJSON(content)
  }
  return parseCSV(content)
}

/**
 * Parse Prime Video JSON export
 * @param {string} content - JSON content
 * @returns {Array}
 */
const parseJSON = (content) => {
  const data = JSON.parse(content)
  const results = []
  const seen = new Set()

  // Handle different JSON structures Amazon might use
  let items = []
  if (Array.isArray(data)) {
    items = data
  } else if (data.watchHistory) {
    items = data.watchHistory
  } else if (data.ViewingHistory) {
    items = data.ViewingHistory
  } else if (data.items) {
    items = data.items
  }

  for (const item of items) {
    const parsed = parsePrimeItem(item)
    if (!parsed) continue

    // Dedup by title
    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push(parsed)
  }

  return results
}

/**
 * Parse a single Prime Video item from JSON
 * @param {object} item - Raw item from export
 * @returns {object|null}
 */
const parsePrimeItem = (item) => {
  // Extract title - try various field names
  const title = item.title ||
                item.Title ||
                item.itemTitle ||
                item.displayTitle ||
                item.name ||
                item.movieTitle ||
                item.seriesTitle

  if (!title) return null

  // Check if it's TV or movie
  const isTV = item.episodeTitle ||
               item.seasonNumber ||
               item.seriesTitle ||
               item.tvShow ||
               (item.contentType && item.contentType.toLowerCase().includes('episode'))

  // Extract year
  let year = null
  if (item.releaseYear) {
    year = parseInt(item.releaseYear, 10)
  } else if (item.releaseDate) {
    const match = item.releaseDate.match(/\d{4}/)
    if (match) year = parseInt(match[0], 10)
  }

  // Extract watch date
  let watchDate = null
  const dateField = item.watchDate || item.playbackDate || item.dateWatched || item.lastWatchedDate
  if (dateField) {
    watchDate = new Date(dateField)
    if (isNaN(watchDate.getTime())) watchDate = null
  }

  // Extract completion percentage
  let completionPct = null
  if (item.percentageWatched !== undefined) {
    completionPct = parseInt(item.percentageWatched, 10)
  } else if (item.watchProgress !== undefined) {
    completionPct = Math.round(item.watchProgress * 100)
  }

  // For TV shows, use series title as main title
  const mainTitle = isTV ? (item.seriesTitle || title.split(':')[0].trim()) : title

  return {
    title: cleanTitle(mainTitle),
    year,
    watchDate,
    completionPct,
    mediaType: isTV ? 'tv' : 'movie',
    originalTitle: title,
    season: item.seasonNumber || null,
    episode: item.episodeTitle || item.episodeNumber || null,
  }
}

/**
 * Parse Prime Video CSV export
 * @param {string} content - CSV content
 * @returns {Array}
 */
const parseCSV = (content) => {
  const lines = content.split('\n')
  const results = []
  const seen = new Set()

  // Parse header to find column indices
  const header = lines[0].toLowerCase()
  const columns = parseCSVLine(header)

  const titleIdx = columns.findIndex(c => c.includes('title'))
  const dateIdx = columns.findIndex(c => c.includes('date') || c.includes('watch'))
  const typeIdx = columns.findIndex(c => c.includes('type') || c.includes('content'))

  if (titleIdx === -1) return results

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    const rawTitle = fields[titleIdx]
    if (!rawTitle) continue

    const parsed = parsePrimeTitle(rawTitle)
    if (!parsed) continue

    // Override media type if we have it
    if (typeIdx !== -1) {
      const type = fields[typeIdx]?.toLowerCase() || ''
      if (type.includes('movie') || type.includes('film')) {
        parsed.mediaType = 'movie'
      } else if (type.includes('tv') || type.includes('episode') || type.includes('series')) {
        parsed.mediaType = 'tv'
      }
    }

    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    // Parse date
    let watchDate = null
    if (dateIdx !== -1 && fields[dateIdx]) {
      watchDate = new Date(fields[dateIdx])
      if (isNaN(watchDate.getTime())) watchDate = null
    }

    results.push({
      ...parsed,
      watchDate,
      completionPct: null,
    })
  }

  return results
}

/**
 * Parse Prime Video title string
 * @param {string} rawTitle - Raw title
 * @returns {object|null}
 */
const parsePrimeTitle = (rawTitle) => {
  if (!rawTitle) return null

  const title = rawTitle.trim()

  // Check for TV patterns
  const seasonMatch = title.match(/^(.+?)\s*[-:]\s*(?:Season|Series|S)\s*(\d+)/i)
  if (seasonMatch) {
    return {
      title: cleanTitle(seasonMatch[1]),
      year: null,
      mediaType: 'tv',
      season: parseInt(seasonMatch[2], 10),
    }
  }

  // Check for episode patterns
  const episodeMatch = title.match(/^(.+?)\s*[-:]\s*(?:Episode|Ep\.?|E)\s*(\d+)/i)
  if (episodeMatch) {
    return {
      title: cleanTitle(episodeMatch[1]),
      year: null,
      mediaType: 'tv',
    }
  }

  // Try to extract year
  const yearMatch = title.match(/^(.+?)\s*\((\d{4})\)\s*$/)
  if (yearMatch) {
    return {
      title: cleanTitle(yearMatch[1]),
      year: parseInt(yearMatch[2], 10),
      mediaType: 'movie',
    }
  }

  return {
    title: cleanTitle(title),
    year: null,
    mediaType: 'movie',
  }
}

/**
 * Parse CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]}
 */
const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Clean up title string
 * @param {string} title - Raw title
 * @returns {string}
 */
const cleanTitle = (title) => {
  return title
    .replace(/\s*\[.*?\]\s*/g, '') // Remove brackets
    .replace(/\s*\((?:Prime Video|Amazon Original)\)\s*/gi, '') // Remove Prime branding
    .trim()
}

/**
 * Get export instructions
 * @returns {string[]}
 */
const getExportInstructions = () => [
  'Go to amazon.com/gp/privacycentral/dsar/preview.html',
  'Sign in to your Amazon account',
  'Click "Request My Data"',
  'In the dropdown, select "Your Prime Video"',
  'Click "Submit Request"',
  'Wait for Amazon to email you (usually 1-2 days)',
  'Download the ZIP file from the email link',
  'Extract the ZIP file',
  'Find the watch history file (usually in Digital.PrimeVideo folder)',
  'Upload the ViewingHistory.json or similar file',
]

export const primeParser = {
  validate,
  parse,
  getExportInstructions,
  platformKey: 'prime',
  acceptedFileTypes: ['.json', '.csv'],
}

export default primeParser
