// Platform Parser Registry
// Central hub for all streaming platform data parsers

import { netflixParser } from './netflixParser'
import { primeParser } from './primeParser'
import { appleParser } from './appleParser'
import { youtubeParser } from './youtubeParser'
import { gdprParser } from './gdprParser'
import { letterboxdParser } from './letterboxdParser'

// Registry of all available parsers
export const PARSERS = {
  netflix: netflixParser,
  prime: primeParser,
  apple: appleParser,
  youtube: youtubeParser,
  hulu: gdprParser,
  disney: gdprParser,
  hbo: gdprParser,
  paramount: gdprParser,
  peacock: gdprParser,
  letterboxd: letterboxdParser,
}

// Platform metadata for UI
export const PLATFORM_IMPORT_INFO = {
  netflix: {
    name: 'Netflix',
    color: '#e50914',
    dataAvailability: 'quick',
    estimatedTime: 'Hours',
    fileTypes: ['.csv'],
    instructions: [
      'Go to Netflix.com and sign in',
      'Click your profile icon, then "Account"',
      'Scroll to "Security & Privacy" section',
      'Click "Download your personal information"',
      'Request your data and wait for email',
      'Download and extract the ZIP file',
      'Upload the "ViewingActivity.csv" file',
    ],
  },
  prime: {
    name: 'Prime Video',
    color: '#00a8e1',
    dataAvailability: 'slow',
    estimatedTime: '1-2 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to amazon.com/gp/privacycentral',
      'Click "Request My Data"',
      'Select "Prime Video" data',
      'Submit request and wait for email',
      'Download and extract the files',
      'Upload the watch history file',
    ],
  },
  apple: {
    name: 'Apple TV+',
    color: '#000000',
    dataAvailability: 'slow',
    estimatedTime: '2-7 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to privacy.apple.com',
      'Sign in with your Apple ID',
      'Click "Request a copy of your data"',
      'Select "Apple Media Services information"',
      'Submit request and wait for email',
      'Download and extract the files',
      'Upload the TV viewing activity file',
    ],
  },
  youtube: {
    name: 'YouTube',
    color: '#ff0000',
    dataAvailability: 'quick',
    estimatedTime: 'Minutes',
    fileTypes: ['.json', '.html'],
    instructions: [
      'Go to takeout.google.com',
      'Click "Deselect all"',
      'Scroll down and select only "YouTube"',
      'Under YouTube, select only "history"',
      'Click "Next step" and "Create export"',
      'Download and extract the ZIP file',
      'Upload the "watch-history.json" file',
    ],
  },
  hulu: {
    name: 'Hulu',
    color: '#1ce783',
    dataAvailability: 'gdpr',
    estimatedTime: 'Up to 30 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to help.hulu.com and search "privacy request"',
      'Follow the link to submit a data request',
      'Complete the verification process',
      'Wait for email with your data',
      'Upload the watch history file',
    ],
  },
  disney: {
    name: 'Disney+',
    color: '#113ccf',
    dataAvailability: 'gdpr',
    estimatedTime: 'Up to 30 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to privacy.thewaltdisneycompany.com',
      'Sign in with your Disney account',
      'Submit a data access request',
      'Wait for email with your data',
      'Upload the watch history file',
    ],
  },
  hbo: {
    name: 'Max (HBO)',
    color: '#9b59b6',
    dataAvailability: 'gdpr',
    estimatedTime: 'Up to 30 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to max.com/privacy',
      'Find the "Access Your Data" section',
      'Submit a data access request',
      'Wait for email with your data',
      'Upload the watch history file',
    ],
  },
  paramount: {
    name: 'Paramount+',
    color: '#0064ff',
    dataAvailability: 'gdpr',
    estimatedTime: 'Up to 30 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to paramountplus.com',
      'Navigate to Account Settings > Privacy',
      'Submit a data access request',
      'Wait for email with your data',
      'Upload the watch history file',
    ],
  },
  peacock: {
    name: 'Peacock',
    color: '#000000',
    dataAvailability: 'gdpr',
    estimatedTime: 'Up to 30 days',
    fileTypes: ['.json', '.csv'],
    instructions: [
      'Go to peacocktv.com',
      'Navigate to Account > Privacy Settings',
      'Submit a data access request',
      'Wait for email with your data',
      'Upload the watch history file',
    ],
  },
  letterboxd: {
    name: 'Letterboxd',
    color: '#00d735',
    dataAvailability: 'quick',
    estimatedTime: 'Instant',
    fileTypes: ['.csv'],
    instructions: [
      'Go to letterboxd.com and sign in',
      'Click your profile icon, then "Settings"',
      'Go to the "Data" tab',
      'Click "Export Your Data"',
      'Download the ZIP file',
      'Extract and upload "diary.csv" or "ratings.csv"',
    ],
  },
}

/**
 * Get the appropriate parser for a platform
 * @param {string} platform - Platform key (e.g., 'netflix', 'prime')
 * @returns {object|null} Parser object with validate, parse, getExportInstructions methods
 */
export const getParser = (platform) => {
  return PARSERS[platform] || null
}

/**
 * Get import info for a platform
 * @param {string} platform - Platform key
 * @returns {object|null} Platform import metadata
 */
export const getPlatformImportInfo = (platform) => {
  return PLATFORM_IMPORT_INFO[platform] || null
}

/**
 * Get all platforms that support quick data export
 * @returns {string[]} Array of platform keys
 */
export const getQuickExportPlatforms = () => {
  return Object.entries(PLATFORM_IMPORT_INFO)
    .filter(([_, info]) => info.dataAvailability === 'quick')
    .map(([key]) => key)
}

/**
 * Get all platforms that require GDPR request
 * @returns {string[]} Array of platform keys
 */
export const getGDPRPlatforms = () => {
  return Object.entries(PLATFORM_IMPORT_INFO)
    .filter(([_, info]) => info.dataAvailability === 'gdpr')
    .map(([key]) => key)
}

export default PARSERS
