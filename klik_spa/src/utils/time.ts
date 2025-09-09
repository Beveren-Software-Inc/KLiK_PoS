/**
 * Time utility functions for formatting and timezone handling
 */

/**
 * Format time string to HH:MM:SS format (removes microseconds)
 * @param timeString - Time string that may include microseconds
 * @returns Formatted time string in HH:MM:SS format
 */
export const formatTime = (timeString: any): string => {
  if (!timeString) return '00:00:00';

  // Convert to string if it's not already
  const timeStr = String(timeString);

  console.log('formatTime input:', timeString, 'converted to string:', timeStr);

  // If it's already in HH:MM:SS format, return as is
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    console.log('Already in HH:MM:SS format');
    return timeStr;
  }

  // If it includes microseconds (e.g., "16:00:42.582466"), extract just HH:MM:SS
  if (timeStr.includes('.')) {
    const result = timeStr.split('.')[0];
    console.log('Removed microseconds:', result);
    return result;
  }

  // If it's a full datetime string, extract time part
  if (timeStr.includes('T')) {
    const timePart = timeStr.split('T')[1];
    if (timePart.includes('.')) {
      const result = timePart.split('.')[0];
      console.log('Extracted time from datetime:', result);
      return result;
    }
    console.log('Extracted time from datetime (no microseconds):', timePart);
    return timePart;
  }

  // Handle cases where seconds might be truncated (e.g., "16:43:3" or "17:52:1")
  // More specific pattern to catch single-digit seconds
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1})$/);
  if (timeMatch) {
    const [, hours, minutes, seconds] = timeMatch;
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    console.log('Fixed single-digit seconds:', timeStr, '->', result);
    return result;
  }

  // Handle cases where any part might be single digit
  const timeMatchAny = timeStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (timeMatchAny) {
    const [, hours, minutes, seconds] = timeMatchAny;
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    console.log('Fixed any single-digit parts:', timeStr, '->', result);
    return result;
  }

  // Handle cases where time might be in HH:MM format (missing seconds)
  const timeMatchNoSeconds = timeStr.match(/^(\d{1,2}):(\d{1,2})$/);
  if (timeMatchNoSeconds) {
    const [, hours, minutes] = timeMatchNoSeconds;
    const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
    console.log('Added missing seconds:', timeStr, '->', result);
    return result;
  }

  // If it's a time object or number, try to parse it
  if (typeof timeString === 'number' || !isNaN(Number(timeStr))) {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      const result = date.toTimeString().split(' ')[0];
      console.log('Parsed as number/Date:', result);
      return result;
    }
  }

  // Try to parse as a Date and extract time
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    const result = date.toTimeString().split(' ')[0];
    console.log('Parsed as Date string:', result);
    return result;
  }

  // If it's a time object with hours, minutes, seconds properties
  if (typeof timeString === 'object' && timeString !== null) {
    if ('hours' in timeString && 'minutes' in timeString && 'seconds' in timeString) {
      const h = String(timeString.hours || 0).padStart(2, '0');
      const m = String(timeString.minutes || 0).padStart(2, '0');
      const s = String(timeString.seconds || 0).padStart(2, '0');
      const result = `${h}:${m}:${s}`;
      console.log('Parsed as time object:', result);
      return result;
    }
  }

  // Final fallback: try to split by colon and pad each part
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (/^\d{1,2}$/.test(hours) && /^\d{1,2}$/.test(minutes) && /^\d{1,2}$/.test(seconds)) {
      const result = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
      console.log('Fallback padding:', timeStr, '->', result);
      return result;
    }
  }

  console.log('No pattern matched, returning original:', timeStr);
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
