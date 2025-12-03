/**
 * Utility functions for formatting dates in user's local timezone
 */

/**
 * Get user's local timezone
 */
export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Format a date string to user's local timezone
 * @param {string | null | undefined} dateString - ISO date string
 * @param {{ format?: 'date' | 'time' | 'datetime' | 'short' | 'long', includeTimezone?: boolean }} options - Formatting options
 */
export function formatLocalDate(
  dateString,
  options = {}
) {
  if (!dateString) return ''

  try {
    // Parse the date - this will convert from UTC to local time
    const date = new Date(dateString)
    
    if (isNaN(date.getTime())) {
      console.error('[formatLocalDate] Invalid date:', dateString)
      return 'Invalid date'
    }

    const { format = 'datetime', includeTimezone = true } = options
    const userTimezone = getUserTimezone()

    const formatOptions = {
      timeZone: userTimezone,
    }

    switch (format) {
      case 'date':
        formatOptions.year = 'numeric'
        formatOptions.month = 'short'
        formatOptions.day = 'numeric'
        break
      case 'time':
        formatOptions.hour = '2-digit'
        formatOptions.minute = '2-digit'
        if (includeTimezone) {
          formatOptions.timeZoneName = 'short'
        }
        break
      case 'datetime':
        formatOptions.year = 'numeric'
        formatOptions.month = 'short'
        formatOptions.day = 'numeric'
        formatOptions.hour = '2-digit'
        formatOptions.minute = '2-digit'
        if (includeTimezone) {
          formatOptions.timeZoneName = 'short'
        }
        break
      case 'short':
        formatOptions.year = 'numeric'
        formatOptions.month = 'numeric'
        formatOptions.day = 'numeric'
        break
      case 'long':
        formatOptions.year = 'numeric'
        formatOptions.month = 'long'
        formatOptions.day = 'numeric'
        formatOptions.hour = '2-digit'
        formatOptions.minute = '2-digit'
        if (includeTimezone) {
          formatOptions.timeZoneName = 'long'
        }
        break
    }

    return new Intl.DateTimeFormat('en-US', formatOptions).format(date)
  } catch (error) {
    console.error('[formatLocalDate] Error formatting date:', error)
    return dateString
  }
}

/**
 * Format date for event display (uses event timezone if available, otherwise user timezone)
 * @param {string | null | undefined} dateString - ISO date string
 * @param {string | null | undefined} _eventTimezone - Event timezone (kept for backwards compatibility but ignored)
 * @param {'short' | 'long' | 'date' | 'time'} format - Format type
 * @returns {string} Formatted date string
 */
export function formatEventDate(
  dateString,
  _eventTimezone = null, // Parameter kept for backwards compatibility but ignored
  format = 'short'
) {
  if (!dateString) return ''

  try {
    // Parse the date - this will convert from UTC to local time
    const date = new Date(dateString)
    
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }

    // Always use user's local timezone for display
    const timezone = getUserTimezone()
    const formatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: format === 'long' ? 'long' : 'short',
      day: 'numeric',
    }

    if (format === 'long') {
      formatOptions.weekday = 'long'
      formatOptions.hour = '2-digit'
      formatOptions.minute = '2-digit'
      formatOptions.timeZoneName = 'short'
    } else if (format === 'time') {
      formatOptions.hour = '2-digit'
      formatOptions.minute = '2-digit'
      formatOptions.timeZoneName = 'short'
    } else if (format !== 'date') {
      formatOptions.hour = '2-digit'
      formatOptions.minute = '2-digit'
      formatOptions.timeZoneName = 'short'
    }

    return new Intl.DateTimeFormat('en-US', formatOptions).format(date)
  } catch (error) {
    console.error('[formatEventDate] Error formatting date:', error)
    return 'Invalid date'
  }
}

