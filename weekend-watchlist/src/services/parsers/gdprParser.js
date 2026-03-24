// Generic GDPR Parser
// Parses watch history from GDPR data exports (Hulu, Disney+, Max, Paramount+, Peacock)
// These platforms typically provide data in similar formats due to GDPR requirements

/**
 * Validate if file content is valid GDPR export
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {{ valid: boolean, error?: string }}
 */
const validate = (content, fileType) => {
  if (fileType === '.json') {
    try {
      const data = JSON.parse(content)
      // GDPR exports typically have watch history in some form
      if (Array.isArray(data) ||
          data.watchHistory ||
          data.viewingHistory ||
          data.playHistory ||
          data.history ||
          data.activities ||
          data.content) {
        return { valid: true }
      }
      // Accept any object with potential viewing data
      if (typeof data === 'object' && Object.keys(data).length > 0) {
        return { valid: true }
      }
      return { valid: false, error: 'JSON structure not recognized as GDPR export' }
    } catch {
      return { valid: false, error: 'Invalid JSON file' }
    }
  }

  if (fileType === '.csv') {
    const firstLine = content.split('\n')[0].toLowerCase()
    // Most GDPR exports have title, date, or similar columns
    if (firstLine.includes('title') ||
        firstLine.includes('name') ||
        firstLine.includes('content') ||
        firstLine.includes('watch')) {
      return { valid: true }
    }
    return { valid: false, error: 'CSV structure not recognized as viewing history' }
  }

  return { valid: false, error: 'GDPR export should be JSON or CSV' }
}

/**
 * Parse GDPR watch history
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
 * Parse GDPR JSON export
 * @param {string} content - JSON content
 * @returns {Array}
 */
const parseJSON = (content) => {
  const data = JSON.parse(content)
  const results = []
  const seen = new Set()

  // Try to find the viewing history array in various locations
  const items = findViewingArray(data)

  for (const item of items) {
    const parsed = parseGDPRItem(item)
    if (!parsed) continue

    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push(parsed)
  }

  return results
}

/**
 * Find the viewing history array in various JSON structures
 * @param {object} data - Parsed JSON data
 * @returns {Array}
 */
const findViewingArray = (data) => {
  // Direct array
  if (Array.isArray(data)) {
    return data
  }

  // Common property names for viewing history
  const historyKeys = [
    'watchHistory',
    'viewingHistory',
    'playHistory',
    'history',
    'activities',
    'content',
    'items',
    'views',
    'plays',
    'watched',
    'ContentInteraction',
    'ViewingActivity',
  ]

  for (const key of historyKeys) {
    if (data[key] && Array.isArray(data[key])) {
      return data[key]
    }
    // Check case-insensitive
    const lowerKey = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase())
    if (lowerKey && Array.isArray(data[lowerKey])) {
      return data[lowerKey]
    }
  }

  // Nested structures - try one level deep
  for (const topKey of Object.keys(data)) {
    if (typeof data[topKey] === 'object' && data[topKey] !== null) {
      for (const key of historyKeys) {
        if (data[topKey][key] && Array.isArray(data[topKey][key])) {
          return data[topKey][key]
        }
      }
    }
  }

  // Last resort: find any array that looks like viewing data
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const first = data[key][0]
      if (first && (first.title || first.name || first.contentTitle || first.showTitle)) {
        return data[key]
      }
    }
  }

  return []
}

/**
 * Parse a single GDPR item
 * @param {object} item - Raw item from export
 * @returns {object|null}
 */
const parseGDPRItem = (item) => {
  // Try various field names for title
  const title = item.title ||
                item.name ||
                item.contentTitle ||
                item.showTitle ||
                item.movieTitle ||
                item.seriesTitle ||
                item.programTitle ||
                item.displayTitle ||
                item.assetTitle

  if (!title) return null

  // Determine media type
  let mediaType = 'movie'

  // Check explicit type fields
  const typeField = item.type ||
                    item.contentType ||
                    item.mediaType ||
                    item.assetType ||
                    item.programType ||
                    ''

  const typeLower = typeField.toLowerCase()
  if (typeLower.includes('episode') ||
      typeLower.includes('tv') ||
      typeLower.includes('series') ||
      typeLower.includes('show')) {
    mediaType = 'tv'
  }

  // Check for season/episode fields
  if (item.seasonNumber !== undefined ||
      item.episodeNumber !== undefined ||
      item.seasonTitle ||
      item.episodeTitle ||
      item.seriesTitle) {
    mediaType = 'tv'
  }

  // For TV, use series title as main title
  let mainTitle = title
  if (mediaType === 'tv' && item.seriesTitle) {
    mainTitle = item.seriesTitle
  }

  // Extract year
  let year = null
  if (item.releaseYear) {
    year = parseInt(item.releaseYear, 10)
  } else if (item.year) {
    year = parseInt(item.year, 10)
  } else if (item.releaseDate) {
    const match = String(item.releaseDate).match(/\d{4}/)
    if (match) year = parseInt(match[0], 10)
  }

  // Extract watch date
  let watchDate = null
  const dateField = item.watchDate ||
                    item.playDate ||
                    item.viewDate ||
                    item.dateWatched ||
                    item.timestamp ||
                    item.dateTime ||
                    item.utcPlayStartDate ||
                    item.playStartTime

  if (dateField) {
    if (typeof dateField === 'number') {
      // Could be Unix timestamp (seconds or milliseconds)
      watchDate = dateField > 1e12
        ? new Date(dateField)
        : new Date(dateField * 1000)
    } else {
      watchDate = new Date(dateField)
    }
    if (isNaN(watchDate.getTime())) watchDate = null
  }

  // Extract completion percentage
  let completionPct = null
  if (item.percentWatched !== undefined) {
    completionPct = Math.round(parseFloat(item.percentWatched))
  } else if (item.percentComplete !== undefined) {
    completionPct = Math.round(parseFloat(item.percentComplete))
  } else if (item.progress !== undefined && item.duration !== undefined) {
    completionPct = Math.round((item.progress / item.duration) * 100)
  } else if (item.watchProgress !== undefined) {
    completionPct = Math.round(parseFloat(item.watchProgress) * 100)
  }

  return {
    title: cleanTitle(mainTitle),
    year,
    watchDate,
    completionPct,
    mediaType,
    originalTitle: title,
    season: item.seasonNumber || null,
    episode: item.episodeNumber || item.episodeTitle || null,
  }
}

/**
 * Parse GDPR CSV export
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

  // Find relevant columns
  const titleIdx = findColumnIndex(columns, ['title', 'name', 'content', 'program', 'show', 'movie'])
  const dateIdx = findColumnIndex(columns, ['date', 'time', 'watch', 'play', 'view'])
  const typeIdx = findColumnIndex(columns, ['type', 'media', 'content_type', 'asset'])
  const seriesIdx = findColumnIndex(columns, ['series', 'show_name', 'series_title'])
  const yearIdx = findColumnIndex(columns, ['year', 'release'])

  if (titleIdx === -1) return results

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    let title = fields[titleIdx]
    if (!title) continue

    // Use series name if available
    if (seriesIdx !== -1 && fields[seriesIdx]) {
      title = fields[seriesIdx]
    }

    const parsed = parseGDPRTitle(title)
    if (!parsed) continue

    // Override media type if available
    if (typeIdx !== -1) {
      const type = fields[typeIdx]?.toLowerCase() || ''
      if (type.includes('movie') || type.includes('film')) {
        parsed.mediaType = 'movie'
      } else if (type.includes('tv') || type.includes('episode') || type.includes('series')) {
        parsed.mediaType = 'tv'
      }
    }

    // Get year if available
    if (yearIdx !== -1 && fields[yearIdx]) {
      const y = parseInt(fields[yearIdx], 10)
      if (!isNaN(y) && y > 1900 && y < 2100) {
        parsed.year = y
      }
    }

    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

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
 * Find column index from possible names
 * @param {string[]} columns - Column headers
 * @param {string[]} possibleNames - Possible column names
 * @returns {number} Column index or -1
 */
const findColumnIndex = (columns, possibleNames) => {
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i].toLowerCase()
    for (const name of possibleNames) {
      if (col.includes(name)) {
        return i
      }
    }
  }
  return -1
}

/**
 * Parse GDPR title string
 * @param {string} rawTitle - Raw title
 * @returns {object|null}
 */
const parseGDPRTitle = (rawTitle) => {
  if (!rawTitle) return null

  const title = rawTitle.trim()

  // Check for TV patterns
  const seasonMatch = title.match(/^(.+?)\s*[-:,]\s*(?:Season|Series|S)\s*(\d+)/i)
  if (seasonMatch) {
    return {
      title: cleanTitle(seasonMatch[1]),
      year: null,
      mediaType: 'tv',
      season: parseInt(seasonMatch[2], 10),
    }
  }

  const episodeMatch = title.match(/^(.+?)\s*[-:,]\s*(?:Episode|Ep\.?|E)\s*(\d+)/i)
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
 * Parse CSV line
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
 * Clean title string
 * @param {string} title - Raw title
 * @returns {string}
 */
const cleanTitle = (title) => {
  return title
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\((?:HD|4K|UHD)\)\s*/gi, '')
    .trim()
}

/**
 * Get export instructions
 * @returns {string[]}
 */
const getExportInstructions = () => [
  'Under GDPR/CCPA regulations, streaming services must provide your data on request.',
  '',
  'General steps for most platforms:',
  '1. Go to the platform\'s website and sign in',
  '2. Navigate to Account Settings or Profile',
  '3. Look for "Privacy" or "Data" section',
  '4. Find "Download my data" or "Request data"',
  '5. Submit a data access request',
  '6. Wait for the platform to process (up to 30 days)',
  '7. Download the data package when notified',
  '8. Extract and find the viewing history file',
  '9. Upload the JSON or CSV file here',
  '',
  'Platform-specific help pages:',
  '- Hulu: help.hulu.com (search "privacy request")',
  '- Disney+: privacy.thewaltdisneycompany.com',
  '- Max (HBO): max.com/privacy',
  '- Paramount+: paramountplus.com/privacy',
  '- Peacock: peacocktv.com (Account > Privacy)',
]

export const gdprParser = {
  validate,
  parse,
  getExportInstructions,
  platformKey: 'gdpr',
  acceptedFileTypes: ['.json', '.csv'],
}

export default gdprParser
