/**
 * Letterboxd Export Parser
 * Parses Letterboxd data export (diary.csv and ratings.csv)
 * Export from: letterboxd.com/settings/data/
 */

/**
 * Validate that the file is a valid Letterboxd export
 * @param {string} content - File content
 * @param {string} fileType - File extension (e.g., '.csv')
 * @returns {{ valid: boolean, error?: string, fileFormat?: string }}
 */
export const validate = (content, fileType) => {
  if (fileType !== '.csv') {
    return { valid: false, error: 'Letterboxd export should be a CSV file' }
  }

  const firstLine = content.split('\n')[0].toLowerCase()

  // Check for diary.csv format
  if (firstLine.includes('date') && firstLine.includes('name') && firstLine.includes('letterboxd uri')) {
    return { valid: true, fileFormat: 'diary' }
  }

  // Check for ratings.csv format
  if (firstLine.includes('rating') && firstLine.includes('name') && firstLine.includes('year')) {
    return { valid: true, fileFormat: 'ratings' }
  }

  // Check for watched.csv format
  if (firstLine.includes('name') && firstLine.includes('year') && firstLine.includes('letterboxd uri')) {
    return { valid: true, fileFormat: 'watched' }
  }

  return {
    valid: false,
    error: 'File does not appear to be a Letterboxd export. Please upload diary.csv, ratings.csv, or watched.csv',
  }
}

/**
 * Parse CSV content into rows
 * @param {string} content - CSV content
 * @returns {Array<object>}
 */
const parseCSV = (content) => {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Parse header
  const header = parseCSVLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === header.length) {
      const row = {}
      header.forEach((key, idx) => {
        row[key.toLowerCase().trim()] = values[idx]
      })
      rows.push(row)
    }
  }

  return rows
}

/**
 * Parse a single CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]}
 */
const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
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
 * Parse Letterboxd export file
 * @param {string} content - File content
 * @param {string} fileFormat - Format detected during validation ('diary', 'ratings', 'watched')
 * @returns {Array<{ title: string, year: number, watchDate: string, rating: number, mediaType: string }>}
 */
export const parse = (content, fileFormat = 'diary') => {
  const rows = parseCSV(content)
  const results = []

  for (const row of rows) {
    const title = row.name || row.title || ''
    if (!title) continue

    const year = parseInt(row.year, 10) || null
    let watchDate = null
    let rating = null

    // Extract watch date (diary format)
    if (row['watched date'] || row.date) {
      const dateStr = row['watched date'] || row.date
      // Letterboxd format: YYYY-MM-DD
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        watchDate = dateStr
      }
    }

    // Extract rating (0-5 stars, convert to 0-10)
    if (row.rating) {
      const stars = parseFloat(row.rating)
      if (!isNaN(stars)) {
        rating = stars * 2 // Convert 5-star to 10-point scale
      }
    }

    // Letterboxd is movies only
    results.push({
      title: cleanTitle(title),
      year,
      watchDate,
      rating,
      mediaType: 'movie',
      rewatch: row.rewatch?.toLowerCase() === 'yes',
      review: row.review || null,
      letterboxdUri: row['letterboxd uri'] || null,
    })
  }

  return results
}

/**
 * Clean up title for better matching
 * @param {string} title
 * @returns {string}
 */
const cleanTitle = (title) => {
  return title
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get export instructions for Letterboxd
 * @returns {string[]}
 */
export const getExportInstructions = () => [
  'Go to letterboxd.com and sign in',
  'Click your profile icon, then "Settings"',
  'Go to the "Data" tab',
  'Click "Export Your Data"',
  'Download the ZIP file',
  'Extract and upload "diary.csv" or "ratings.csv"',
]

export const letterboxdParser = {
  validate,
  parse,
  getExportInstructions,
}

export default letterboxdParser
