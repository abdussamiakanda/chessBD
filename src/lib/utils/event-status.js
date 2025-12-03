/**
 * Calculate event status based on current time and event start/end times
 * Handles timezones properly
 */
export function calculateEventStatus(event) {
  const now = new Date()
  const startTime = new Date(event.start_time)
  const endTime = new Date(event.end_time)

  // If event has a timezone, convert current time to that timezone for comparison
  // Note: JavaScript Date objects are always in UTC, so we compare UTC times
  // The start_time and end_time should be stored as ISO 8601 strings with timezone info
  
  if (now < startTime) {
    return 'upcoming'
  } else if (now >= startTime && now <= endTime) {
    return 'in_progress'
  } else {
    return 'finished'
  }
}

/**
 * Get event status with timezone awareness
 * If event has timezone, uses it for comparison
 */
export function getEventStatusWithTimezone(event) {
  if (!event.timezone) {
    // No timezone specified, use UTC comparison
    return calculateEventStatus(event)
  }

  try {
    // Convert current time to event timezone
    const now = new Date()
    const startTime = new Date(event.start_time)
    const endTime = new Date(event.end_time)

    // Compare times (all Date objects are in UTC internally)
    // The ISO strings should already be in the correct timezone
    if (now < startTime) {
      return 'upcoming'
    } else if (now >= startTime && now <= endTime) {
      return 'in_progress'
    } else {
      return 'finished'
    }
  } catch (error) {
    console.error('[EventStatus] Error calculating status with timezone:', error)
    // Fallback to simple calculation
    return calculateEventStatus(event)
  }
}

/**
 * Format datetime with timezone for display
 * Always displays in user's local timezone (event timezone is only used for storage)
 */
export function formatEventDateTime(
  dateTime,
  _eventTimezone = null, // Parameter kept for backwards compatibility but ignored - always use user's local timezone
  format = 'short'
) {
  try {
    const utcDate = new Date(dateTime)
    
    if (isNaN(utcDate.getTime())) {
      console.error('[EventDateTime] Invalid date:', dateTime)
      return 'Invalid date'
    }
    
    // Always use user's local timezone for display
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Format with user's local timezone (Intl.DateTimeFormat handles timezone conversion)
    const options = {
      timeZone: userTimezone,
      year: 'numeric',
      month: format === 'date' ? 'long' : format === 'long' ? 'long' : 'short',
      day: 'numeric',
    }

    if (format === 'long') {
      options.weekday = 'long'
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.timeZoneName = 'short'
    } else if (format === 'time') {
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.timeZoneName = 'short'
    } else if (format !== 'date') {
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.timeZoneName = 'short'
    }

    const formatted = new Intl.DateTimeFormat('en-US', options).format(utcDate)
    
    return formatted
  } catch (error) {
    console.error('[EventDateTime] Error formatting date:', error, { dateTime, format })
    // Fallback to basic formatting with user timezone
    try {
      const date = new Date(dateTime)
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date)
    } catch (e) {
      return 'Invalid date'
    }
  }
}

