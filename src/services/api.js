import { API_URL } from '../config/apiUrl';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('barberpro_token');
    this.customerToken = localStorage.getItem('barberpro_customer_token');
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('barberpro_token', token);
    else localStorage.removeItem('barberpro_token');
  }

  setCustomerToken(token) {
    this.customerToken = token;
    if (token) localStorage.setItem('barberpro_customer_token', token);
    else localStorage.removeItem('barberpro_customer_token');
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Logical token selection
    const isCustomerRoute = endpoint.includes('/customer-auth/') || endpoint.includes('/appointments');
    const activeToken = isCustomerRoute ? (this.customerToken || this.token) : (this.token || this.customerToken);

    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401 && !options.skipLogout) {
        // Handle 401 globally if needed, or pass to context
        this.handleUnauthorized(isCustomerRoute);
      }

      return response;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  handleUnauthorized(isCustomerRoute) {
    // This will be overridden or linked to the logout functions in the contexts
    if (this.onUnauthorized) {
      this.onUnauthorized(isCustomerRoute);
    }
  }

  // Helper methods
  get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); }
  post(endpoint, data, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }); }
  put(endpoint, data, options = {}) { return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }); }
  patch(endpoint, data, options = {}) { return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(data) }); }
  delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); }
}

const api = new ApiService();
export default api;
