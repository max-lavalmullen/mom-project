// Apple TV+ Parser
// Parses Apple TV+ viewing history from privacy.apple.com export

/**
 * Validate if file content is valid Apple TV+ export
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {{ valid: boolean, error?: string }}
 */
const validate = (content, fileType) => {
  if (fileType === '.json') {
    try {
      const data = JSON.parse(content)
      // Apple exports might have various structures
      if (data.watchHistory ||
          data.tvApp ||
          data.mediaPlayback ||
          Array.isArray(data)) {
        return { valid: true }
      }
      // Check if it looks like Apple's format
      if (typeof data === 'object' && Object.keys(data).length > 0) {
        return { valid: true }
      }
      return { valid: false, error: 'JSON structure not recognized as Apple TV+ export' }
    } catch {
      return { valid: false, error: 'Invalid JSON file' }
    }
  }

  if (fileType === '.csv') {
    const firstLine = content.split('\n')[0].toLowerCase()
    if (firstLine.includes('title') || firstLine.includes('content')) {
      return { valid: true }
    }
    return { valid: false, error: 'CSV structure not recognized as Apple TV+ export' }
  }

  return { valid: false, error: 'Apple TV+ export should be JSON or CSV' }
}

/**
 * Parse Apple TV+ watch history
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
 * Parse Apple TV+ JSON export
 * @param {string} content - JSON content
 * @returns {Array}
 */
const parseJSON = (content) => {
  const data = JSON.parse(content)
  const results = []
  const seen = new Set()

  // Try to find the viewing history array
  let items = []

  if (Array.isArray(data)) {
    items = data
  } else if (data.watchHistory) {
    items = data.watchHistory
  } else if (data.tvApp?.watchHistory) {
    items = data.tvApp.watchHistory
  } else if (data.mediaPlayback) {
    items = data.mediaPlayback
  } else if (data['Apple Media Services']) {
    // Nested structure from privacy export
    const mediaServices = data['Apple Media Services']
    if (mediaServices['Apple TV App Activity']) {
      items = mediaServices['Apple TV App Activity'].playActivity || []
    }
  } else {
    // Try to find any array that looks like watch history
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        const first = data[key][0]
        if (first.title || first.contentName || first.showName) {
          items = data[key]
          break
        }
      }
    }
  }

  for (const item of items) {
    const parsed = parseAppleItem(item)
    if (!parsed) continue

    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push(parsed)
  }

  return results
}

/**
 * Parse a single Apple TV+ item
 * @param {object} item - Raw item from export
 * @returns {object|null}
 */
const parseAppleItem = (item) => {
  // Try various field names Apple might use
  const title = item.title ||
                item.contentName ||
                item.showName ||
                item.seriesName ||
                item.name ||
                item.movieTitle

  if (!title) return null

  // Determine media type
  const isTV = item.episodeNumber !== undefined ||
               item.seasonNumber !== undefined ||
               item.episodeName ||
               item.seriesName ||
               (item.contentType && item.contentType.toLowerCase().includes('episode')) ||
               (item.mediaType && item.mediaType.toLowerCase() === 'tvshow')

  // Extract the main title for TV shows
  let mainTitle = title
  if (isTV && item.seriesName) {
    mainTitle = item.seriesName
  }

  // Extract year
  let year = null
  if (item.releaseYear) {
    year = parseInt(item.releaseYear, 10)
  } else if (item.releaseDate) {
    const match = String(item.releaseDate).match(/\d{4}/)
    if (match) year = parseInt(match[0], 10)
  }

  // Extract watch date
  let watchDate = null
  const dateField = item.playDate ||
                    item.watchDate ||
                    item.dateWatched ||
                    item.timestamp ||
                    item.playStartDate

  if (dateField) {
    // Apple often uses ISO format or timestamps
    if (typeof dateField === 'number') {
      watchDate = new Date(dateField * 1000) // Unix timestamp
    } else {
      watchDate = new Date(dateField)
    }
    if (isNaN(watchDate.getTime())) watchDate = null
  }

  // Extract completion
  let completionPct = null
  if (item.percentComplete !== undefined) {
    completionPct = Math.round(item.percentComplete)
  } else if (item.playProgress !== undefined && item.duration) {
    completionPct = Math.round((item.playProgress / item.duration) * 100)
  }

  return {
    title: cleanTitle(mainTitle),
    year,
    watchDate,
    completionPct,
    mediaType: isTV ? 'tv' : 'movie',
    originalTitle: title,
    season: item.seasonNumber || null,
    episode: item.episodeNumber || item.episodeName || null,
  }
}

/**
 * Parse Apple TV+ CSV export
 * @param {string} content - CSV content
 * @returns {Array}
 */
const parseCSV = (content) => {
  const lines = content.split('\n')
  const results = []
  const seen = new Set()

  const header = lines[0].toLowerCase()
  const columns = parseCSVLine(header)

  const titleIdx = columns.findIndex(c =>
    c.includes('title') || c.includes('name') || c.includes('content'))
  const dateIdx = columns.findIndex(c =>
    c.includes('date') || c.includes('time') || c.includes('play'))
  const typeIdx = columns.findIndex(c =>
    c.includes('type') || c.includes('media'))
  const seriesIdx = columns.findIndex(c =>
    c.includes('series') || c.includes('show'))

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

    const parsed = parseAppleTitle(title)
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
 * Parse Apple TV+ title string
 * @param {string} rawTitle - Raw title
 * @returns {object|null}
 */
const parseAppleTitle = (rawTitle) => {
  if (!rawTitle) return null

  const title = rawTitle.trim()

  // Check for season patterns
  const seasonMatch = title.match(/^(.+?)\s*[-:,]\s*(?:Season|Series|S)\s*(\d+)/i)
  if (seasonMatch) {
    return {
      title: cleanTitle(seasonMatch[1]),
      year: null,
      mediaType: 'tv',
      season: parseInt(seasonMatch[2], 10),
    }
  }

  // Check for episode patterns
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
    .replace(/\s*\(Apple TV\+?\)\s*/gi, '')
    .replace(/\s*\(Apple Original\)\s*/gi, '')
    .trim()
}

/**
 * Get export instructions
 * @returns {string[]}
 */
const getExportInstructions = () => [
  'Go to privacy.apple.com',
  'Sign in with your Apple ID',
  'Click "Request a copy of your data"',
  'Select "Apple Media Services information"',
  'Optionally, select a date range or leave as "All"',
  'Click "Continue" and confirm your request',
  'Wait for Apple to email you (can take 2-7 days)',
  'Download the ZIP file(s) from the email link',
  'Extract the files',
  'Look for TV viewing activity in the extracted files',
  'Upload the relevant JSON or CSV file',
]

export const appleParser = {
  validate,
  parse,
  getExportInstructions,
  platformKey: 'apple',
  acceptedFileTypes: ['.json', '.csv'],
}

export default appleParser
