/**
 * Utility functions to convert technical error messages into user-friendly messages
 */

/**
 * Convert WhatsApp API errors to user-friendly messages
 */
export function getUserFriendlyWhatsAppError(error: string): string {
  // Handle Facebook Graph API errors
  if (error.includes('401') || error.includes('Unauthorized')) {
    return "WhatsApp service is not properly configured. Please contact your administrator to set up WhatsApp Business API credentials.";
  }

  if (error.includes('403') || error.includes('Forbidden')) {
    return "Access denied to WhatsApp service. Please check your WhatsApp Business API permissions.";
  }

  if (error.includes('404') || error.includes('Not Found')) {
    return "WhatsApp service not found. Please contact your administrator to verify WhatsApp Business API setup.";
  }

  if (error.includes('429') || error.includes('Too Many Requests')) {
    return "Too many WhatsApp messages sent. Please wait a few minutes before trying again.";
  }

  if (error.includes('500') || error.includes('Internal Server Error')) {
    return "WhatsApp service is temporarily unavailable. Please try again later.";
  }

  if (error.includes('Invalid phone number') || error.includes('invalid phone')) {
    return "Invalid phone number format. Please enter a valid phone number with country code (e.g., +1234567890).";
  }

  if (error.includes('Template not found') || error.includes('template')) {
    return "WhatsApp message template not found. Please contact your administrator to set up message templates.";
  }

  if (error.includes('Business account') || error.includes('business')) {
    return "WhatsApp Business account not properly configured. Please contact your administrator.";
  }

  if (error.includes('Access token') || error.includes('token')) {
    return "WhatsApp access token expired or invalid. Please contact your administrator to refresh the token.";
  }

  if (error.includes('Rate limit') || error.includes('rate')) {
    return "WhatsApp message rate limit exceeded. Please wait before sending more messages.";
  }

  // Handle network errors
  if (error.includes('Network error') || error.includes('fetch')) {
    return "Unable to connect to WhatsApp service. Please check your internet connection and try again.";
  }

  if (error.includes('timeout')) {
    return "WhatsApp service request timed out. Please try again.";
  }

  // Default fallback
  return "Failed to send WhatsApp message. Please try again or contact your administrator if the problem persists.";
}

/**
 * Convert Email API errors to user-friendly messages
 */
export function getUserFriendlyEmailError(error: string): string {
  // Handle SMTP and email service errors
  if (error.includes('401') || error.includes('Unauthorized')) {
    return "Email service authentication failed. Please contact your administrator to check email server credentials.";
  }

  if (error.includes('403') || error.includes('Forbidden')) {
    return "Access denied to email service. Please check email server permissions.";
  }

  if (error.includes('404') || error.includes('Not Found')) {
    return "Email service not found. Please contact your administrator to verify email server configuration.";
  }

  if (error.includes('500') || error.includes('Internal Server Error')) {
    return "Email service is temporarily unavailable. Please try again later.";
  }

  if (error.includes('Invalid email') || error.includes('invalid email')) {
    return "Invalid email address format. Please enter a valid email address.";
  }

  if (error.includes('SMTP') || error.includes('smtp')) {
    return "Email server connection failed. Please contact your administrator to check email server settings.";
  }

  if (error.includes('Authentication failed') || error.includes('auth')) {
    return "Email authentication failed. Please contact your administrator to verify email credentials.";
  }

  if (error.includes('Quota exceeded') || error.includes('quota')) {
    return "Email sending quota exceeded. Please contact your administrator or try again later.";
  }

  if (error.includes('Spam') || error.includes('spam')) {
    return "Email was rejected as spam. Please try with a different message or contact your administrator.";
  }

  // Handle network errors
  if (error.includes('Network error') || error.includes('fetch')) {
    return "Unable to connect to email service. Please check your internet connection and try again.";
  }

  if (error.includes('timeout')) {
    return "Email service request timed out. Please try again.";
  }

  // Default fallback
  return "Failed to send email. Please try again or contact your administrator if the problem persists.";
}

/**
 * Convert SMS API errors to user-friendly messages
 */
export function getUserFriendlySMSError(error: string): string {
  // Handle SMS service errors
  if (error.includes('401') || error.includes('Unauthorized')) {
    return "SMS service is not properly configured. Please contact your administrator to set up SMS service credentials.";
  }

  if (error.includes('403') || error.includes('Forbidden')) {
    return "Access denied to SMS service. Please check your SMS service permissions.";
  }

  if (error.includes('404') || error.includes('Not Found')) {
    return "SMS service not found. Please contact your administrator to verify SMS service setup.";
  }

  if (error.includes('429') || error.includes('Too Many Requests')) {
    return "Too many SMS messages sent. Please wait a few minutes before trying again.";
  }

  if (error.includes('500') || error.includes('Internal Server Error')) {
    return "SMS service is temporarily unavailable. Please try again later.";
  }

  if (error.includes('Invalid phone number') || error.includes('invalid phone')) {
    return "Invalid phone number format. Please enter a valid phone number with country code (e.g., +1234567890).";
  }

  if (error.includes('Insufficient balance') || error.includes('balance')) {
    return "SMS service account has insufficient balance. Please contact your administrator to add credits.";
  }

  if (error.includes('Blocked') || error.includes('blocked')) {
    return "Phone number is blocked or invalid. Please check the phone number and try again.";
  }

  if (error.includes('Rate limit') || error.includes('rate')) {
    return "SMS message rate limit exceeded. Please wait before sending more messages.";
  }

  // Handle network errors
  if (error.includes('Network error') || error.includes('fetch')) {
    return "Unable to connect to SMS service. Please check your internet connection and try again.";
  }

  if (error.includes('timeout')) {
    return "SMS service request timed out. Please try again.";
  }

  // Default fallback
  return "Failed to send SMS message. Please try again or contact your administrator if the problem persists.";
}

/**
 * Generic error message converter for any service
 */
export function getUserFriendlyError(error: string, service: 'whatsapp' | 'email' | 'sms' | 'generic' = 'generic'): string {
  switch (service) {
    case 'whatsapp':
      return getUserFriendlyWhatsAppError(error);
    case 'email':
      return getUserFriendlyEmailError(error);
    case 'sms':
      return getUserFriendlySMSError(error);
    default:
      // Generic error handling
      if (error.includes('401') || error.includes('Unauthorized')) {
        return "Access denied. Please contact your administrator.";
      }
      if (error.includes('403') || error.includes('Forbidden')) {
        return "Access denied. Please check your permissions.";
      }
      if (error.includes('404') || error.includes('Not Found')) {
        return "Service not found. Please contact your administrator.";
      }
      if (error.includes('500') || error.includes('Internal Server Error')) {
        return "Service is temporarily unavailable. Please try again later.";
      }
      if (error.includes('Network error') || error.includes('fetch')) {
        return "Unable to connect to the service. Please check your internet connection.";
      }
      if (error.includes('timeout')) {
        return "Request timed out. Please try again.";
      }
      return "An error occurred. Please try again or contact your administrator if the problem persists.";
  }
}
