// YouTube Parser
// Parses YouTube watch history from Google Takeout export
// Note: This focuses on YouTube's movie/TV rentals and purchases, not regular videos

/**
 * Validate if file content is valid YouTube export
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {{ valid: boolean, error?: string }}
 */
const validate = (content, fileType) => {
  if (fileType === '.json') {
    try {
      const data = JSON.parse(content)
      // YouTube Takeout uses an array format
      if (Array.isArray(data)) {
        return { valid: true }
      }
      // Or it might be wrapped in an object
      if (data.watchHistory || data.history) {
        return { valid: true }
      }
      return { valid: false, error: 'JSON structure not recognized as YouTube export' }
    } catch {
      return { valid: false, error: 'Invalid JSON file' }
    }
  }

  if (fileType === '.html') {
    // YouTube Takeout can also export as HTML
    if (content.includes('watch-history') || content.includes('YouTube')) {
      return { valid: true }
    }
    return { valid: false, error: 'HTML structure not recognized as YouTube export' }
  }

  return { valid: false, error: 'YouTube export should be JSON or HTML' }
}

/**
 * Parse YouTube watch history
 * @param {string} content - File content
 * @param {string} fileType - File extension
 * @returns {Array<{ title: string, year: number|null, watchDate: Date|null, completionPct: number|null, mediaType: 'movie'|'tv' }>}
 */
const parse = (content, fileType = '.json') => {
  if (fileType === '.json') {
    return parseJSON(content)
  }
  if (fileType === '.html') {
    return parseHTML(content)
  }
  return []
}

/**
 * Parse YouTube JSON export (Google Takeout format)
 * @param {string} content - JSON content
 * @returns {Array}
 */
const parseJSON = (content) => {
  const data = JSON.parse(content)
  const results = []
  const seen = new Set()

  let items = []
  if (Array.isArray(data)) {
    items = data
  } else if (data.watchHistory) {
    items = data.watchHistory
  } else if (data.history) {
    items = data.history
  }

  for (const item of items) {
    const parsed = parseYouTubeItem(item)
    if (!parsed) continue

    // Only include movie/TV content, not regular YouTube videos
    if (!parsed.isMediaContent) continue

    const key = `${parsed.title}-${parsed.year || 'unknown'}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push(parsed)
  }

  return results
}

/**
 * Parse a single YouTube watch history item
 * @param {object} item - Raw item from export
 * @returns {object|null}
 */
const parseYouTubeItem = (item) => {
  const title = item.title || item.titleText || item.snippet?.title
  if (!title) return null

  // Check if this looks like movie/TV content
  // YouTube Movies entries typically have specific patterns
  const isMediaContent = isMovieOrTVContent(item, title)

  // Extract watch date
  let watchDate = null
  const timeField = item.time || item.watchedAt || item.timestamp || item.snippet?.publishedAt
  if (timeField) {
    watchDate = new Date(timeField)
    if (isNaN(watchDate.getTime())) watchDate = null
  }

  // Try to determine if it's TV or movie
  const mediaType = detectMediaType(item, title)

  // Extract clean title
  const cleanedTitle = cleanYouTubeTitle(title)

  // Try to extract year
  let year = null
  const yearMatch = cleanedTitle.match(/\((\d{4})\)/)
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10)
  }

  const finalTitle = cleanedTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim()

  return {
    title: finalTitle,
    year,
    watchDate,
    completionPct: null,
    mediaType,
    isMediaContent,
    originalTitle: title,
    channel: item.subtitles?.[0]?.name || item.channel || null,
  }
}

/**
 * Check if a YouTube item appears to be movie/TV content
 * @param {object} item - Raw item
 * @param {string} title - Item title
 * @returns {boolean}
 */
const isMovieOrTVContent = (item, title) => {
  // Check channel/source for movie indicators
  const channel = item.subtitles?.[0]?.name ||
                  item.channel ||
                  item.channelTitle ||
                  ''

  const movieChannels = [
    'YouTube Movies',
    'Movies & TV',
    'Google Play Movies',
    'YouTube Rentals',
  ]

  if (movieChannels.some(c => channel.toLowerCase().includes(c.toLowerCase()))) {
    return true
  }

  // Check for movie/TV product type in item data
  if (item.productType === 'MOVIE' || item.productType === 'TV') {
    return true
  }

  // Check URL for movies/TV patterns
  const url = item.titleUrl || item.url || ''
  if (url.includes('/movie/') || url.includes('/film/') || url.includes('/tv/')) {
    return true
  }

  // Check title for common movie indicators
  const moviePatterns = [
    /\((?:19|20)\d{2}\)/, // Year in parentheses
    /\b(?:full movie|official trailer|film)\b/i,
    /\s[-–]\s(?:Official|Full|HD|4K)/i,
  ]

  for (const pattern of moviePatterns) {
    if (pattern.test(title)) {
      // But exclude if it's clearly a trailer or clip
      if (/\b(?:trailer|teaser|clip|behind the scenes|interview)\b/i.test(title)) {
        return false
      }
      return true
    }
  }

  return false
}

/**
 * Detect if content is TV or movie
 * @param {object} item - Raw item
 * @param {string} title - Title
 * @returns {'movie'|'tv'}
 */
const detectMediaType = (item, title) => {
  // Check explicit type
  if (item.productType === 'TV' || item.mediaType === 'tv') {
    return 'tv'
  }
  if (item.productType === 'MOVIE' || item.mediaType === 'movie') {
    return 'movie'
  }

  // Check title patterns
  const tvPatterns = [
    /\bS\d+\s*E\d+\b/i, // S01E01
    /\bSeason\s+\d+/i,
    /\bEpisode\s+\d+/i,
    /\bSeries\s+\d+/i,
  ]

  for (const pattern of tvPatterns) {
    if (pattern.test(title)) {
      return 'tv'
    }
  }

  // Default to movie for YouTube Movies content
  return 'movie'
}

/**
 * Clean YouTube title
 * @param {string} title - Raw title
 * @returns {string}
 */
const cleanYouTubeTitle = (title) => {
  return title
    .replace(/^Watched\s+/i, '') // Remove "Watched" prefix
    .replace(/\s*\|\s*YouTube Movies$/i, '')
    .replace(/\s*-\s*(?:Official|Full|HD|4K|UHD).*$/i, '')
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\((?:Official|Full|HD|4K|UHD).*?\)\s*/gi, '')
    .trim()
}

/**
 * Parse YouTube HTML export
 * @param {string} content - HTML content
 * @returns {Array}
 */
const parseHTML = (content) => {
  const results = []
  const seen = new Set()

  // YouTube HTML format has entries like:
  // <div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">
  //   Watched <a href="...">Title</a>
  //   <br>Channel Name
  //   <br>Date
  // </div>

  // Simple regex to extract watch entries
  const entryPattern = /Watched\s+<a[^>]*>([^<]+)<\/a>[\s\S]*?<br>([^<]*)<br>([^<]*)/gi

  let match
  while ((match = entryPattern.exec(content)) !== null) {
    const [, title, channel, dateStr] = match

    // Check if it's movie content
    if (!isYouTubeMovieChannel(channel)) continue

    const cleanedTitle = cleanYouTubeTitle(title)
    const key = cleanedTitle.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    let watchDate = null
    if (dateStr) {
      watchDate = new Date(dateStr.trim())
      if (isNaN(watchDate.getTime())) watchDate = null
    }

    results.push({
      title: cleanedTitle,
      year: null,
      watchDate,
      completionPct: null,
      mediaType: 'movie',
      originalTitle: title,
      channel: channel.trim(),
    })
  }

  return results
}

/**
 * Check if channel is a movie/TV channel
 * @param {string} channel - Channel name
 * @returns {boolean}
 */
const isYouTubeMovieChannel = (channel) => {
  const movieChannels = [
    'YouTube Movies',
    'Movies & TV',
    'Google Play Movies',
    'YouTube Rentals',
    'YouTube Premium',
  ]

  const normalizedChannel = channel.toLowerCase().trim()
  return movieChannels.some(c => normalizedChannel.includes(c.toLowerCase()))
}

/**
 * Get export instructions
 * @returns {string[]}
 */
const getExportInstructions = () => [
  'Go to takeout.google.com',
  'Sign in with your Google account',
  'Click "Deselect all" to start fresh',
  'Scroll down and find "YouTube and YouTube Music"',
  'Click the checkbox to select it',
  'Click the arrow to expand options',
  'Make sure "history" is selected',
  'Optionally adjust format to JSON (easier to parse)',
  'Click "Next step"',
  'Choose your delivery method and click "Create export"',
  'Wait for the export to complete (usually minutes)',
  'Download and extract the ZIP file',
  'Navigate to Takeout/YouTube and YouTube Music/history',
  'Upload the "watch-history.json" file',
  '',
  'Note: This will import movies and TV shows rented/purchased',
  'from YouTube Movies, not regular YouTube videos.',
]

export const youtubeParser = {
  validate,
  parse,
  getExportInstructions,
  platformKey: 'youtube',
  acceptedFileTypes: ['.json', '.html'],
}

export default youtubeParser
