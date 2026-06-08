interface ERPNextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  requires_otp?: boolean;
  tmp_id?: string;
  verification?: {
    method?: string;
    prompt?: string;
    setup?: boolean;
    token_delivery?: boolean;
  };
  user?: {
    name: string;
    email: string;
    full_name: string;
    role?: string;
    [key: string]: unknown;
  };
  sid?: string;
}

interface ImportMetaEnv {
  VITE_ERPNEXT_BASE_URL?: string;
  VITE_API_KEY?: string;
  VITE_API_SECRET?: string;
  DEV?: boolean;
  [key: string]: unknown;
}

interface ImportMeta {
  env: ImportMetaEnv;
}

interface UserProfile {
  name?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  role_profile_name?: string;
  user_image?: string;
  [key: string]: unknown;
}

interface DocData {
  [key: string]: unknown;
}

class ERPNextAPI {
  private config: ERPNextConfig;
  private sessionId: string | null = null;

  constructor() {
    // Prefer explicit base URL when provided.
    // Otherwise:
    // - In development, use relative URLs so Vite's proxy forwards to Frappe
    // - In production (served from Frappe), also use relative URLs (same origin)
    const envBaseUrl = (import.meta as ImportMeta).env?.VITE_ERPNEXT_BASE_URL;

    this.config = {
      baseUrl: envBaseUrl || '',
      apiKey: (import.meta as ImportMeta).env?.VITE_API_KEY || '',
      apiSecret: (import.meta as ImportMeta).env?.VITE_API_SECRET || ''
    };
  }

  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth && this.config.apiKey && this.config.apiSecret) {
      const auth = btoa(`${this.config.apiKey}:${this.config.apiSecret}`);
      headers['Authorization'] = `Basic ${auth}`;
    }

    if (this.sessionId) {
      headers['Cookie'] = `sid=${this.sessionId}`;
    }

    return headers;
  }

  async login(username: string, password: string, otp?: string, tmpId?: string): Promise<LoginResponse> {
    try {

      // Try the standard login endpoint first
      const loginPayload: Record<string, string> = {
        usr: username,
        pwd: password
      };
      if (otp) loginPayload.otp = otp;
      if (tmpId) loginPayload.tmp_id = tmpId;

      let response = await fetch(`${this.config.baseUrl}/api/method/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(loginPayload),
        credentials: 'include'
      });


      // If 404, try alternative endpoint
      if (response.status === 404) {
        response = await fetch(`${this.config.baseUrl}/api/method/frappe.auth.login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(loginPayload),
          credentials: 'include'
        });
      }

      if (!response.ok) {
        console.error('Login failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response body:', errorText);

        // Parse error response if it's JSON
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.exc) {
            errorMessage = errorData.exc;
          }
        } catch {
          // If not JSON, use the text as is
          if (errorText && errorText.trim()) {
            errorMessage = errorText;
          }
        }

        return {
          success: false,
          message: errorMessage
        };
      }

      const data = await response.json();

      // Frappe 2FA challenge response
      if (data?.tmp_id && data?.verification) {
        return {
          success: false,
          requires_otp: true,
          tmp_id: data.tmp_id,
          verification: data.verification,
          message: data.verification?.prompt || 'Verification code required'
        };
      }

      // Check for different response formats
      if (data.message === 'Logged In' || data.message?.name || data.message?.email) {
        // Extract session ID from response headers
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          const sidMatch = setCookieHeader.match(/sid=([^;]+)/);
          if (sidMatch && sidMatch[1]) {
            this.sessionId = sidMatch[1];
            localStorage.setItem('erpnext_sid', this.sessionId);
          }
        }

        // Fetch complete user profile data from ERPNext
        try {
          const userProfile = await this.getCurrentUserProfile();

          if (userProfile) {
            return {
              success: true,
              message: 'Login successful',
              user: {
                name: userProfile.name || username, // This is the user ID/email
                email: userProfile.email || userProfile.name || username,
                full_name: userProfile.full_name || userProfile.first_name + ' ' + (userProfile.last_name || '') || username,
                role: userProfile.role_profile_name || userProfile.role || 'User',
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
                user_image: userProfile.user_image
              },
              sid: this.sessionId || undefined
            };
          }
        } catch (profileError) {
          console.warn('Failed to fetch user profile, using basic data:', profileError);
        }

        // Fallback to basic user data if profile fetch fails
        let userData;
        if (typeof data.message === 'string' && data.message === 'Logged In') {
          userData = {
            name: username,
            email: username,
            full_name: username,
            role: 'User'
          };
        } else if (data.message && typeof data.message === 'object') {
          userData = {
            name: data.message.name || username,
            email: data.message.email || data.message.name || username,
            full_name: data.message.full_name || data.message.name || username,
            role: data.message.role || 'User'
          };
        } else {
          userData = {
            name: username,
            email: username,
            full_name: username,
            role: 'User'
          };
        }

        return {
          success: true,
          message: 'Login successful',
          user: userData,
          sid: this.sessionId || undefined
        };
      } else {
        return {
          success: false,
          message: data.message || data.exc || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error details:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'Network error. Please check if the ERPNext server is accessible.'
        };
      }

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          return {
            success: false,
            message: 'Connection timeout. Please try again.'
          };
        }

        if (error.message.includes('Failed to fetch')) {
          return {
            success: false,
            message: 'Unable to connect to the server. Please check your internet connection.'
          };
        }
      }

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      };
    }
  }

async logout(): Promise<void> {
  try {
    let headers: Record<string, string> = {
      "X-Frappe-Site-Name": window.location.hostname,
    };

    if ((window as any).csrf_token) {
      headers["X-Frappe-CSRF-Token"] = (window as any).csrf_token;
    }

    await fetch(`${this.config.baseUrl}/api/method/logout`, {
      method: "POST",
      headers,
      credentials: "include",
    });

  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    this.sessionId = null;
    localStorage.removeItem("erpnext_sid");
  }
}

  async getCurrentUser(): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/method/frappe.auth.get_logged_user`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      // Try to get user profile using the frappe.auth.get_logged_user method first
      const response = await fetch(`${this.config.baseUrl}/api/method/frappe.auth.get_logged_user`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logged user: ${response.status}`);
      }

      const data = await response.json();
      const username = data.message;

      if (!username) {
        throw new Error('No logged user found');
      }

      // Now fetch the full User document
      const userResponse = await fetch(`${this.config.baseUrl}/api/resource/User/${username}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user profile: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      // console.log('Full user profile data:', userData.data);
      return userData.data;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  // Test connection to ERPNext server
  async testConnection(): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {

      // First try the ping endpoint
      let response = await fetch(`${this.config.baseUrl}/api/method/ping`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.status === 404) {
        // Try alternative endpoints
        response = await fetch(`${this.config.baseUrl}/api/method/frappe.utils.get_site_info`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include'
        });
      }

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connection successful',
          details: data
        };
      } else {
        return {
          success: false,
          message: `Server responded with status: ${response.status} - ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText }
        };
      }
    } catch (error) {
      console.error('Connection test error details:', error);

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout - server took too long to respond';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS error - server may not allow cross-origin requests';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error - server may be unreachable or blocked';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
        details: error
      };
    }
  }

  // Enhanced API call method with better error handling
  async makeAPICall(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
      ...options
    };

    try {
      const response = await fetch(url, defaultOptions);

      if (!response.ok) {
        console.error('API call failed:', {
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
      }

      return response;
    } catch (error) {
      console.error('API call error:', { url, error });
      throw error;
    }
  }

  async apiCall(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const response = await this.makeAPICall(`${this.config.baseUrl}/api/method/${method}`, {
        method: 'POST',
        body: JSON.stringify(params)
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API call error (${method}):`, error);
      throw error;
    }
  }

  async getDocList(doctype: string, fields: string[] = ['*'], filters: Record<string, unknown> = {}): Promise<DocData[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/resource/${doctype}?${new URLSearchParams({
        fields: JSON.stringify(fields),
        filters: JSON.stringify(filters)
      })}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Get ${doctype} list error:`, error);
      throw error;
    }
  }

  async getDoc(doctype: string, name: string): Promise<DocData> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/resource/${doctype}/${name}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Get ${doctype} document error:`, error);
      throw error;
    }
  }

  async createDoc(doctype: string, doc: DocData): Promise<DocData> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/resource/${doctype}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(doc),
        credentials: 'include'
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Create ${doctype} document error:`, error);
      throw error;
    }
  }

  async updateDoc(doctype: string, name: string, doc: DocData): Promise<DocData> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/resource/${doctype}/${name}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(doc),
        credentials: 'include'
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Update ${doctype} document error:`, error);
      throw error;
    }
  }

  // Validate session by checking if user is still logged in
  async validateSession(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/method/frappe.auth.get_logged_user`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return !!data.message; // Return true if we get a username
      }
      return false;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  // Initialize session from localStorage
  initializeSession(): void {
    const storedSid = localStorage.getItem('erpnext_sid');
    if (storedSid) {
      this.sessionId = storedSid;
    }
  }
}

export const erpnextAPI = new ERPNextAPI();
export default erpnextAPI;
