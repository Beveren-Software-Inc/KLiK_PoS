/**
 * Time utility functions for formatting and timezone handling
 */

interface TimeObject {
  hours?: number;
  minutes?: number;
  seconds?: number;
  [key: string]: unknown;
}

/**
 * Format time string to HH:MM:SS format (removes microseconds)
 * @param timeString - Time value (string, number, object, etc.) that may include microseconds
 * @returns Formatted time string in HH:MM:SS format
 */
export const formatTime = (timeString: unknown): string => {
  if (!timeString) return '00:00:00';

  // Convert to string if it's not already
  const timeStr = String(timeString);


  // If it's already in HH:MM:SS format, return as is
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }

  // If it includes microseconds (e.g., "16:00:42.582466"), extract just HH:MM:SS
  if (timeStr.includes('.')) {
    const result = timeStr.split('.')[0];
    if (result) {
      return result;
    }
  }

  // If it's a full datetime string, extract time part
  if (timeStr.includes('T')) {
    const timePart = timeStr.split('T')[1];
    if (timePart && timePart.includes('.')) {
      const result = timePart.split('.')[0];
      if (result) {
        return result;
      }
    }
    if (timePart) {
      return timePart;
    }
  }

  // Handle cases where seconds might be truncated (e.g., "16:43:3" or "17:52:1")
  // More specific pattern to catch single-digit seconds
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1})$/);
  if (timeMatch && timeMatch[1] && timeMatch[2] && timeMatch[3]) {
    const hours = timeMatch[1];
    const minutes = timeMatch[2];
    const seconds = timeMatch[3];
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    return result;
  }

  // Handle cases where any part might be single digit
  const timeMatchAny = timeStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (timeMatchAny && timeMatchAny[1] && timeMatchAny[2] && timeMatchAny[3]) {
    const hours = timeMatchAny[1];
    const minutes = timeMatchAny[2];
    const seconds = timeMatchAny[3];
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    return result;
  }

  // Handle cases where time might be in HH:MM format (missing seconds)
  const timeMatchNoSeconds = timeStr.match(/^(\d{1,2}):(\d{1,2})$/);
  if (timeMatchNoSeconds && timeMatchNoSeconds[1] && timeMatchNoSeconds[2]) {
    const hours = timeMatchNoSeconds[1];
    const minutes = timeMatchNoSeconds[2];
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
    return result;
  }

  // If it's a time object or number, try to parse it
  if (typeof timeString === 'number' || !isNaN(Number(timeStr))) {
    const date = new Date(timeString as string | number);
    if (!isNaN(date.getTime())) {
      const timeResult = date.toTimeString().split(' ')[0];
      if (timeResult) {
        return timeResult;
      }
    }
  }

  // Try to parse as a Date and extract time
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    const timeResult = date.toTimeString().split(' ')[0];
    if (timeResult) {
      return timeResult;
    }
  }

  // If it's a time object with hours, minutes, seconds properties
  if (typeof timeString === 'object' && timeString !== null) {
    const timeObj = timeString as TimeObject;
    if ('hours' in timeObj && 'minutes' in timeObj && 'seconds' in timeObj) {
      const h = String(timeObj.hours || 0).padStart(2, '0');
      const m = String(timeObj.minutes || 0).padStart(2, '0');
      const s = String(timeObj.seconds || 0).padStart(2, '0');
      const result = `${h}:${m}:${s}`;
      return result;
    }
  }

  // Final fallback: try to split by colon and pad each part
  const parts = timeStr.split(':');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts[2];
    if (/^\d{1,2}$/.test(hours) && /^\d{1,2}$/.test(minutes) && /^\d{1,2}$/.test(seconds)) {
      const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
      return result;
    }
  }

  return timeStr;
};

/**
 * Get system timezone date (for server-side filtering)
 * This ensures "Today" filter works based on server timezone, not user's local timezone
 * @returns Date object in system timezone
 */
export const getSystemDate = (): Date => {
  // For now, we'll use UTC as the system timezone
  // In a real implementation, you might want to get this from the backend
  return new Date();
};

/**
 * Check if a date is today in system timezone
 * @param dateString - Date string to check
 * @returns True if the date is today in system timezone
 */
export const isToday = (dateString: string): boolean => {
  if (!dateString) return false;

  const inputDate = new Date(dateString);
  const today = getSystemDate();

  return (
    inputDate.getUTCFullYear() === today.getUTCFullYear() &&
    inputDate.getUTCMonth() === today.getUTCMonth() &&
    inputDate.getUTCDate() === today.getUTCDate()
  );
};

/**
 * Check if a date is within the current week in system timezone
 * @param dateString - Date string to check
 * @returns True if the date is within the current week
 */
export const isThisWeek = (dateString: string): boolean => {
  if (!dateString) return false;

  const inputDate = new Date(dateString);
  const today = getSystemDate();

  // Get start of week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay());
  startOfWeek.setUTCHours(0, 0, 0, 0);

  // Get end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  return inputDate >= startOfWeek && inputDate <= endOfWeek;
};

/**
 * Check if a date is within the current month in system timezone
 * @param dateString - Date string to check
 * @returns True if the date is within the current month
 */
export const isThisMonth = (dateString: string): boolean => {
  if (!dateString) return false;

  const inputDate = new Date(dateString);
  const today = getSystemDate();

  return (
    inputDate.getUTCFullYear() === today.getUTCFullYear() &&
    inputDate.getUTCMonth() === today.getUTCMonth()
  );
};

/**
 * Check if a date is within the current year in system timezone
 * @param dateString - Date string to check
 * @returns True if the date is within the current year
 */
export const isThisYear = (dateString: string): boolean => {
  if (!dateString) return false;

  const inputDate = new Date(dateString);
  const today = getSystemDate();

  return inputDate.getUTCFullYear() === today.getUTCFullYear();
};

/**
 * Format date and time for display
 * @param dateString - Date string
 * @param timeString - Time string (optional)
 * @returns Formatted date and time string
 */
export const formatDateTime = (dateString: string, timeString?: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  if (timeString) {
    const formattedTime = formatTime(timeString);
    return `${formattedDate} ${formattedTime}`;
  }

  return formattedDate;
};
