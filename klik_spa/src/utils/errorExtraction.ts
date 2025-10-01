// errorExtraction.ts
// Utility functions to extract meaningful error messages from ERPNext API responses

export function extractErrorMessage(result: any, defaultMessage: string = 'Operation failed'): string {
  let errorMessage = defaultMessage;

  // Try to extract the actual error message from _server_messages
  if (result._server_messages) {
    try {
      const serverMessages = JSON.parse(result._server_messages);
      if (serverMessages && serverMessages.length > 0) {
        const firstMessage = JSON.parse(serverMessages[0]);
        if (firstMessage.message) {
          errorMessage = firstMessage.message;
        }
      }
    } catch (parseError) {
      console.error('Error parsing server messages:', parseError);
      // Fallback to the original logic
      try {
        const serverMsg = JSON.parse(result._server_messages)[0];
        errorMessage = serverMsg;
      } catch (fallbackError) {
        console.error('Fallback error parsing failed:', fallbackError);
        errorMessage = defaultMessage;
      }
    }
  }

  return errorMessage;
}

export function extractErrorFromException(err: any, defaultMessage: string = 'Operation failed'): string {
  let errorMessage = defaultMessage;

  // Try to get the actual error message from the error object
  if (err?.message) {
    // If the error message is a JSON string, parse it
    if (typeof err.message === 'string' && err.message.includes('{')) {
      try {
        const parsedError = JSON.parse(err.message);
        if (parsedError.message) {
          errorMessage = parsedError.message;
        }
      } catch (parseError) {
        // If parsing fails, use the original message
        errorMessage = err.message;
      }
    } else {
      errorMessage = err.message;
    }
  }

  return errorMessage;
}
