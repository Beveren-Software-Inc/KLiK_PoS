interface ERPNextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    name: string;
    email: string;
    full_name: string;
    role?: string;
    [key: string]: any;
  };
  sid?: string;
}

class ERPNextAPI {
  private config: ERPNextConfig;
  private sessionId: string | null = null;

  constructor() {
    // In development, use the proxy. In production, use the full URL
    const isDevelopment = (import.meta as any).env?.DEV;
    this.config = {
      baseUrl: isDevelopment 
        ? '' // Use relative URL for proxy in development
        : ((import.meta as any).env?.VITE_ERPNEXT_BASE_URL || 'https://m-alnakheel-test.frappe.cloud'),
      apiKey: (import.meta as any).env?.VITE_API_KEY || '',
      apiSecret: (import.meta as any).env?.VITE_API_SECRET || ''
    };
    
    console.log('ERPNext API Config:', {
      isDevelopment,
      baseUrl: this.config.baseUrl || '[using proxy]',
      hasApiKey: !!this.config.apiKey,
      hasApiSecret: !!this.config.apiSecret
    });
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

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      console.log('Attempting login to:', this.config.baseUrl);
      
      // Try the standard login endpoint first
      let response = await fetch(`${this.config.baseUrl}/api/method/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          usr: username,
          pwd: password
        }),
        credentials: 'include'
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));

      // If 404, try alternative endpoint
      if (response.status === 404) {
        console.log('Trying alternative login endpoint...');
        response = await fetch(`${this.config.baseUrl}/api/method/frappe.auth.login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            usr: username,
            pwd: password
          }),
          credentials: 'include'
        });
        console.log('Alternative login response status:', response.status);
      }

      if (!response.ok) {
        console.error('Login failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log('Login response data:', data);

      // Check for different response formats
      if (data.message === 'Logged In' || data.message?.name || data.message?.email) {
        // Extract session ID from response headers
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          const sidMatch = setCookieHeader.match(/sid=([^;]+)/);
          if (sidMatch) {
            this.sessionId = sidMatch[1];
            localStorage.setItem('erpnext_sid', this.sessionId);
            console.log('Session ID stored:', this.sessionId);
          }
        }

        // Fetch complete user profile data from ERPNext
        try {
          console.log('Fetching user profile data...');
          const userProfile = await this.getCurrentUserProfile();
          console.log('User profile fetched:', userProfile);
          
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
      
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.config.baseUrl}/api/method/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.sessionId = null;
      localStorage.removeItem('erpnext_sid');
    }
  }

  async getCurrentUser(): Promise<any> {
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

  async getCurrentUserProfile(): Promise<any> {
    try {
      // First get the current logged-in user
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No logged user found');
      }

      console.log('Current user from auth:', currentUser);

      // Then fetch the full User document
      const response = await fetch(`${this.config.baseUrl}/api/resource/User/${currentUser}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }

      const data = await response.json();
      console.log('User profile data:', data);
      return data.data;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  // Test connection to ERPNext server
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Testing connection to:', this.config.baseUrl);
      
      // First try the ping endpoint
      let response = await fetch(`${this.config.baseUrl}/api/method/ping`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      console.log('Ping response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.status === 404) {
        // Try alternative endpoints
        console.log('Ping failed, trying version endpoint...');
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

  async apiCall(method: string, params: any = {}): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/method/${method}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
        credentials: 'include'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API call error (${method}):`, error);
      throw error;
    }
  }

  async getDocList(doctype: string, fields: string[] = ['*'], filters: any = {}): Promise<any> {
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

  async getDoc(doctype: string, name: string): Promise<any> {
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

  async createDoc(doctype: string, doc: any): Promise<any> {
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

  async updateDoc(doctype: string, name: string, doc: any): Promise<any> {
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
