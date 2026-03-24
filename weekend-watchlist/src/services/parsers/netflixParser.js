// Netflix CSV Parser
// Parses Netflix "ViewingActivity.csv" from data export

/**
 * Validate if file content is valid Netflix export
 * @param {string} content - File content
 * @param {string} fileType - File extension (e.g., '.csv')
 * @returns {{ valid: boolean, error?: string }}
 */
const validate = (content, fileType) => {
  if (fileType !== '.csv') {
    return { valid: false, error: 'Netflix export should be a CSV file' }
  }

  // Check for expected headers
  const firstLine = content.split('\n')[0].toLowerCase()
  if (!firstLine.includes('title') || !firstLine.includes('date')) {
    return {
      valid: false,
      error: 'Invalid Netflix export format. Expected columns: Title, Date'
    }
  }

  return { valid: true }
}

/**
 * Parse Netflix viewing history CSV
 * @param {string} content - CSV file content
 * @returns {Array<{ title: string, year: number|null, watchDate: Date, completionPct: number|null, mediaType: 'movie'|'tv' }>}
 */
const parse = (content) => {
  const lines = content.split('\n')
  const results = []
  const seen = new Set()

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line)
    if (fields.length < 2) continue

    const [rawTitle, dateStr] = fields

    // Parse title to extract show name, season info, etc.
    const parsed = parseNetflixTitle(rawTitle)
    if (!parsed) continue

    // Create a unique key to avoid duplicates
    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    // Parse date
    let watchDate = null
    if (dateStr) {
      watchDate = parseNetflixDate(dateStr)
    }

    results.push({
      title: parsed.title,
      year: parsed.year,
      watchDate,
      completionPct: null, // Netflix doesn't provide this in basic export
      mediaType: parsed.mediaType,
      originalTitle: rawTitle,
      season: parsed.season,
      episode: parsed.episode,
    })
  }

  return results
}

/**
 * Parse a single CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} Array of field values
 */
const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      // Escaped quote
      current += '"'
      i++
    } else if (char === '"') {
      // Toggle quote mode
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Don't forget the last field
  result.push(current.trim())

  return result
}

/**
 * Parse Netflix title to extract show name, season, episode, year
 * Netflix titles look like:
 * - "Movie Name" (movie)
 * - "Show Name: Season 1: Episode Title" (TV)
 * - "Show Name: Limited Series: Episode Title" (TV)
 * @param {string} rawTitle - Raw title from Netflix
 * @returns {{ title: string, year: number|null, mediaType: 'movie'|'tv', season?: number, episode?: string }|null}
 */
const parseNetflixTitle = (rawTitle) => {
  if (!rawTitle || rawTitle.trim() === '') return null

  const title = rawTitle.trim()

  // Check if it's a TV show (contains Season or episode patterns)
  const seasonMatch = title.match(/^(.+?):\s*(?:Season\s*(\d+)|Limited Series|Part\s*\d+|Volume\s*\d+)/i)

  if (seasonMatch) {
    // It's a TV show
    const showName = seasonMatch[1].trim()
    const season = seasonMatch[2] ? parseInt(seasonMatch[2], 10) : 1

    // Try to extract episode title
    const episodeMatch = title.match(/:\s*(?:Season\s*\d+|Limited Series|Part\s*\d+|Volume\s*\d+)\s*:\s*(.+)$/i)
    const episode = episodeMatch ? episodeMatch[1].trim() : null

    return {
      title: showName,
      year: null,
      mediaType: 'tv',
      season,
      episode,
    }
  }

  // Check for episode pattern without explicit "Season" (e.g., "Show: Episode Title")
  const simpleEpisodeMatch = title.match(/^(.+?):\s+(.+)$/)
  if (simpleEpisodeMatch) {
    // Could be TV or a movie with subtitle - make educated guess
    // If the second part looks like an episode (short, numbered), treat as TV
    const secondPart = simpleEpisodeMatch[2]
    const looksLikeEpisode = /^(Episode|Ep\.?|E)\s*\d+/i.test(secondPart) ||
                            /^\d+\.\s/.test(secondPart) ||
                            secondPart.length < 30

    if (looksLikeEpisode && !/^\d{4}$/.test(secondPart)) {
      return {
        title: simpleEpisodeMatch[1].trim(),
        year: null,
        mediaType: 'tv',
        episode: secondPart,
      }
    }
  }

  // Try to extract year from title (e.g., "Movie Name (2023)")
  const yearMatch = title.match(/^(.+?)\s*\((\d{4})\)\s*$/)
  if (yearMatch) {
    return {
      title: yearMatch[1].trim(),
      year: parseInt(yearMatch[2], 10),
      mediaType: 'movie',
    }
  }

  // Default to movie if no TV patterns found
  return {
    title: title,
    year: null,
    mediaType: 'movie',
  }
}

/**
 * Parse Netflix date format
 * @param {string} dateStr - Date string from Netflix (typically "MM/DD/YY" or "DD/MM/YYYY")
 * @returns {Date|null}
 */
const parseNetflixDate = (dateStr) => {
  if (!dateStr) return null

  const cleaned = dateStr.trim().replace(/"/g, '')

  // Try different date formats
  const formats = [
    // MM/DD/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD/MM/YYYY (European)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD (ISO)
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ]

  for (const format of formats) {
    const match = cleaned.match(format)
    if (match) {
      let year, month, day

      if (format === formats[3]) {
        // ISO format
        [, year, month, day] = match
      } else {
        [, month, day, year] = match
        // Handle 2-digit year
        if (year.length === 2) {
          year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`
        }
      }

      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  // Fallback: try native Date parsing
  const fallbackDate = new Date(cleaned)
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate
}

/**
 * Get export instructions for Netflix
 * @returns {string[]} Step-by-step instructions
 */
const getExportInstructions = () => [
  'Go to Netflix.com and sign in to your account',
  'Click on your profile icon in the top right corner',
  'Select "Account" from the dropdown menu',
  'Scroll down to the "Security & Privacy" section',
  'Click on "Download your personal information"',
  'Click "Submit Request" (you may need to re-enter your password)',
  'Wait for Netflix to email you (usually within a few hours)',
  'Download the ZIP file from the email link',
  'Extract the ZIP file',
  'Find and upload the "CONTENT_INTERACTION/ViewingActivity.csv" file',
]

export const netflixParser = {
  validate,
  parse,
  getExportInstructions,
  platformKey: 'netflix',
  acceptedFileTypes: ['.csv'],
}

export default netflixParser
