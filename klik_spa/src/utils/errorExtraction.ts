// errorExtraction.ts
// Utility functions to extract meaningful error messages from ERPNext API responses

/**
 * Clean HTML formatting from error messages to make them readable
 */
function cleanHtmlFromErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return message;
  }

  // Remove HTML tags but preserve the text content
  let cleanedMessage = message
    // Remove <strong> tags but keep the content
    .replace(/<strong>(.*?)<\/strong>/gi, '$1')
    // Remove <a> tags but keep the content
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
    // Remove other common HTML tags
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Special handling for warehouse/stock error messages
  if (cleanedMessage.includes('units of') && cleanedMessage.includes('needed in') && cleanedMessage.includes('to complete this transaction')) {
    // Extract the key information from the error message
    const match = cleanedMessage.match(/(\d+(?:\.\d+)?)\s+units?\s+of\s+(.+?)\s+needed\s+in\s+(.+?)\s+to\s+complete\s+this\s+transaction/i);
    if (match) {
      const [, quantity, itemName, warehouseName] = match;
      cleanedMessage = `${quantity} units of ${itemName} needed in ${warehouseName} to complete this transaction.`;
    }
  }

  return cleanedMessage;
}

export function extractErrorMessage(result: unknown, defaultMessage: string = 'Operation failed'): string {
  let errorMessage = defaultMessage;

  if (result && typeof result === 'object' && 'message' in result) {
    const messageValue = (result as { message?: unknown }).message;
    if (messageValue && typeof messageValue === 'object') {
      const nestedMessage = (messageValue as { message?: unknown; error?: unknown }).message;
      const nestedError = (messageValue as { message?: unknown; error?: unknown }).error;

      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        errorMessage = nestedMessage;
      } else if (typeof nestedError === 'string' && nestedError.trim()) {
        errorMessage = nestedError;
      }
    } else if (typeof messageValue === 'string' && messageValue.trim()) {
      errorMessage = messageValue;
    }
  }

  // Check if result is an object with _server_messages property
  if (result && typeof result === 'object' && '_server_messages' in result) {
    const serverMessagesValue = (result as { _server_messages?: unknown })._server_messages;

    if (serverMessagesValue && typeof serverMessagesValue === 'string') {
      try {
        const serverMessages = JSON.parse(serverMessagesValue) as unknown[];
        if (Array.isArray(serverMessages) && serverMessages.length > 0) {
          const firstMessageStr = serverMessages[0];
          if (typeof firstMessageStr === 'string') {
            const firstMessage = JSON.parse(firstMessageStr) as { message?: unknown };
            if (firstMessage && typeof firstMessage.message === 'string') {
              errorMessage = firstMessage.message;
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing server messages:', parseError);
        // Fallback to the original logic
        try {
          const serverMsg = JSON.parse(serverMessagesValue)[0];
          if (typeof serverMsg === 'string') {
            errorMessage = serverMsg;
          }
        } catch (fallbackError) {
          console.error('Fallback error parsing failed:', fallbackError);
          errorMessage = defaultMessage;
        }
      }
    }
  }

  // Clean HTML formatting from the error message
  return cleanHtmlFromErrorMessage(errorMessage);
}

export function extractErrorFromException(err: unknown, defaultMessage: string = 'Operation failed'): string {
  let errorMessage = defaultMessage;

  // Check if error has a message property
  if (err && typeof err === 'object' && 'message' in err) {
    const errorMessageObj = (err as { message: unknown }).message;

    // If the error message is a JSON string, parse it
    if (typeof errorMessageObj === 'string' && errorMessageObj.includes('{')) {
      try {
        const parsedError = JSON.parse(errorMessageObj) as { message?: unknown };
        if (parsedError && typeof parsedError.message === 'string') {
          errorMessage = parsedError.message;
        }
      } catch {
        // If parsing fails, use the original message
        errorMessage = errorMessageObj;
      }
    } else if (typeof errorMessageObj === 'string') {
      errorMessage = errorMessageObj;
    }
  }

  // Clean HTML formatting from the error message
  return cleanHtmlFromErrorMessage(errorMessage);
}
