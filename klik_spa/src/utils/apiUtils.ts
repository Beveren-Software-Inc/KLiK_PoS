/**
 * Utility functions for API calls with enhanced error handling
 */

export interface APICallOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export async function makeAPICall(url: string, options: APICallOptions = {}): Promise<Response> {
  const { timeout = 30000, retries = 3, retryDelay = 1000, ...fetchOptions } = options;

  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    ...fetchOptions
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`Making API call (attempt ${attempt + 1}/${retries + 1}):`, { url, options: defaultOptions });

      const response = await fetch(url, {
        ...defaultOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('API call failed:', {
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          attempt: attempt + 1
        });

        // If it's a server error (5xx) or network error, retry
        if (response.status >= 500 || response.status === 0) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('API call timeout:', { url, timeout, attempt: attempt + 1 });
        lastError = new Error(`Request timeout after ${timeout}ms`);
      } else {
        console.error('API call error:', { url, error, attempt: attempt + 1 });
      }

      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw lastError;
      }

      // Wait before retrying
      if (retryDelay > 0) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw lastError;
}

export async function apiCall(method: string, params: any = {}, options: APICallOptions = {}): Promise<any> {
  try {
    const url = `/api/method/${method}`;
    const response = await makeAPICall(url, {
      method: 'POST',
      body: JSON.stringify(params),
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API call error (${method}):`, error);
    throw error;
  }
}

export async function getAPICall(url: string, options: APICallOptions = {}): Promise<any> {
  try {
    const response = await makeAPICall(url, {
      method: 'GET',
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`GET API call error (${url}):`, error);
    throw error;
  }
}

// Global error handler for unhandled promise rejections
export function setupGlobalErrorHandling() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // Check if it's a fetch/API related error
    if (event.reason && typeof event.reason === 'object') {
      if (event.reason.message && event.reason.message.includes('fetch')) {
        console.error('Network/API error detected:', event.reason);
        // You could show a toast notification here
      }
    }

    // Prevent the default browser behavior
    event.preventDefault();
  });
}
