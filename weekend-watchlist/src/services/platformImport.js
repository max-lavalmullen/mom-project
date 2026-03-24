// Platform Import Service
// Orchestrates parsing, TMDb matching, and storage of imported watch history

import { getParser, PLATFORM_IMPORT_INFO } from './parsers'
import { matchMediaItemsToTMDb } from './movieMatcher'
import {
  supabase,
  addToWatchlist,
  updatePlatformImport,
  createPlatformImport,
  recomputePreferenceProfile,
} from './supabase'

/**
 * Import watch history from a platform
 * @param {string} userId - User ID
 * @param {string} platform - Platform key (e.g., 'netflix')
 * @param {string} fileContent - File content
 * @param {string} fileType - File extension (e.g., '.csv')
 * @param {function} onProgress - Progress callback ({ stage, progress, message })
 * @returns {Promise<{ success: boolean, itemsImported: number, itemsMatched: number, error?: string }>}
 */
export const importFromPlatform = async (userId, platform, fileContent, fileType, onProgress = null) => {
  const parser = getParser(platform)
  if (!parser) {
    return { success: false, itemsImported: 0, itemsMatched: 0, error: `No parser available for ${platform}` }
  }

  try {
    // Report starting
    if (onProgress) {
      onProgress({ stage: 'validating', progress: 0, message: 'Validating file...' })
    }

    // Create/update import record to 'processing'
    await createPlatformImport(userId, platform, 'processing')

    // Step 1: Validate the file
    const validation = parser.validate(fileContent, fileType)
    if (!validation.valid) {
      await updatePlatformImport(userId, platform, { import_status: 'failed' })
      return { success: false, itemsImported: 0, itemsMatched: 0, error: validation.error }
    }

    // Step 2: Parse the file
    if (onProgress) {
      onProgress({ stage: 'parsing', progress: 10, message: 'Parsing watch history...' })
    }

    const parsedItems = parser.parse(fileContent, fileType)
    if (!parsedItems || parsedItems.length === 0) {
      await updatePlatformImport(userId, platform, { import_status: 'failed' })
      return { success: false, itemsImported: 0, itemsMatched: 0, error: 'No items found in file' }
    }

    const itemsImported = parsedItems.length

    if (onProgress) {
      onProgress({
        stage: 'parsing',
        progress: 20,
        message: `Found ${itemsImported} items. Matching with TMDb...`
      })
    }

    // Step 3: Match to TMDb
    const matchedItems = await matchMediaItemsToTMDb(parsedItems, (matched, total, current) => {
      if (onProgress) {
        const progress = 20 + Math.round((matched / total) * 60)
        onProgress({
          stage: 'matching',
          progress,
          message: `Matching: ${matched}/${total} - ${current?.title || ''}`,
          matched,
          total,
        })
      }
    })

    // Filter to only matched items
    const successfulMatches = matchedItems.filter(m => m.match !== null)
    const itemsMatched = successfulMatches.length

    if (onProgress) {
      onProgress({
        stage: 'saving',
        progress: 80,
        message: `Matched ${itemsMatched}/${itemsImported}. Saving to watchlist...`
      })
    }

    // Step 4: Save to watchlist
    let savedCount = 0
    for (const { original, match } of successfulMatches) {
      try {
        await addToWatchlist(userId, {
          tmdb_id: match.id,
          media_type: match.mediaType,
          status: 'watched',
          watch_date: original.watchDate?.toISOString() || null,
          completion_percentage: original.completionPct || null,
          import_source: platform,
        })
        savedCount++
      } catch (error) {
        console.error(`Error saving item ${match.id}:`, error)
      }
    }

    // Step 5: Update import record
    await updatePlatformImport(userId, platform, {
      import_status: 'completed',
      items_imported: itemsImported,
      items_matched: itemsMatched,
      last_import_at: new Date().toISOString(),
    })

    // Step 6: Recompute preference profile
    if (onProgress) {
      onProgress({
        stage: 'computing',
        progress: 95,
        message: 'Updating your preference profile...'
      })
    }

    await recomputePreferenceProfile(userId)

    if (onProgress) {
      onProgress({
        stage: 'complete',
        progress: 100,
        message: `Import complete! Matched ${itemsMatched} of ${itemsImported} items.`
      })
    }

    return {
      success: true,
      itemsImported,
      itemsMatched,
      savedCount,
    }
  } catch (error) {
    console.error('Import error:', error)
    await updatePlatformImport(userId, platform, { import_status: 'failed' })
    return {
      success: false,
      itemsImported: 0,
      itemsMatched: 0,
      error: error.message || 'Import failed'
    }
  }
}

/**
 * Get import status for all platforms
 * @param {string} userId - User ID
 * @returns {Promise<Object<string, { status: string, itemsImported: number, itemsMatched: number, lastImport: Date|null }>>}
 */
export const getImportStatuses = async (userId) => {
  const { data, error } = await supabase
    .from('user_platform_imports')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching import statuses:', error)
    return {}
  }

  const statuses = {}
  for (const record of data || []) {
    statuses[record.platform_name] = {
      status: record.import_status,
      itemsImported: record.items_imported,
      itemsMatched: record.items_matched,
      lastImport: record.last_import_at ? new Date(record.last_import_at) : null,
    }
  }

  return statuses
}

/**
 * Get platform import info with user's import status
 * @param {string} userId - User ID
 * @param {string[]} userPlatforms - User's subscribed platforms
 * @returns {Promise<Array<{ platform: string, info: object, status: object|null }>>}
 */
export const getPlatformImportOptions = async (userId, userPlatforms) => {
  const statuses = await getImportStatuses(userId)

  return userPlatforms.map(platform => ({
    platform,
    info: PLATFORM_IMPORT_INFO[platform] || null,
    status: statuses[platform] || null,
  }))
}

/**
 * Validate a file for a specific platform without importing
 * @param {string} platform - Platform key
 * @param {string} fileContent - File content
 * @param {string} fileType - File extension
 * @returns {{ valid: boolean, error?: string, previewCount?: number }}
 */
export const validateFile = (platform, fileContent, fileType) => {
  const parser = getParser(platform)
  if (!parser) {
    return { valid: false, error: `No parser available for ${platform}` }
  }

  const validation = parser.validate(fileContent, fileType)
  if (!validation.valid) {
    return validation
  }

  // Do a quick parse to get count
  try {
    const items = parser.parse(fileContent, fileType)
    return {
      valid: true,
      previewCount: items.length,
    }
  } catch (error) {
    return { valid: false, error: 'Error parsing file: ' + error.message }
  }
}

/**
 * Get export instructions for a platform
 * @param {string} platform - Platform key
 * @returns {string[]}
 */
export const getExportInstructions = (platform) => {
  const parser = getParser(platform)
  if (parser && parser.getExportInstructions) {
    return parser.getExportInstructions()
  }
  return PLATFORM_IMPORT_INFO[platform]?.instructions || []
}

/**
 * Get accepted file types for a platform
 * @param {string} platform - Platform key
 * @returns {string[]}
 */
export const getAcceptedFileTypes = (platform) => {
  const parser = getParser(platform)
  if (parser && parser.acceptedFileTypes) {
    return parser.acceptedFileTypes
  }
  return PLATFORM_IMPORT_INFO[platform]?.fileTypes || ['.json', '.csv']
}

export default {
  importFromPlatform,
  getImportStatuses,
  getPlatformImportOptions,
  validateFile,
  getExportInstructions,
  getAcceptedFileTypes,
}
