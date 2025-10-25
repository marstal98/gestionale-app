import { API_URL } from '../config';

// Helper per gestire le chiamate API
class ApiService {
  constructor() {
    this.baseURL = API_URL;
    this.token = null;
  }

  // Imposta il token di autenticazione
  setToken(token) {
    this.token = token;
  }

  // Helper per le chiamate HTTP
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // AUTH ENDPOINTS
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async logout() {
    this.token = null;
    // Rimuovi token dal storage se necessario
    return Promise.resolve();
  }

  // USER ENDPOINTS
  async getUsers() {
    return this.request('/users');
  }

  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: userData,
    });
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: userData,
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // PRODUCT ENDPOINTS
  async getProducts() {
    return this.request('/products');
  }

  async getProduct(id) {
    return this.request(`/products/${id}`);
  }

  async createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: productData,
    });
  }

  async updateProduct(id, productData) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: productData,
    });
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ORDER ENDPOINTS
  async getOrders() {
    return this.request('/orders');
  }

  async getOrder(id) {
    return this.request(`/orders/${id}`);
  }

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: orderData,
    });
  }

  async updateOrder(id, orderData) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: orderData,
    });
  }

  async deleteOrder(id) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  async cancelOrder(id) {
    return this.request(`/orders/${id}/cancel`, {
      method: 'POST',
    });
  }

  async assignOrder(id, assignedToId) {
    return this.request(`/orders/${id}/assign`, {
      method: 'PUT',
      body: { assignedToId },
    });
  }

  async updateOrderStatus(id, status) {
    return this.request(`/orders/${id}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  // CUSTOMER ENDPOINTS
  async getCustomers() {
    return this.request('/customers');
  }

  async getCustomer(id) {
    return this.request(`/customers/${id}`);
  }

  // INVENTORY ENDPOINTS
  async getInventory() {
    return this.request('/inventory');
  }

  async getInventoryMovements(productId) {
    return this.request(`/inventory/movements${productId ? `?productId=${productId}` : ''}`);
  }

  // DASHBOARD/STATS ENDPOINTS
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Metodi di utilità per testare la connessione
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/admin`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Esempio con il sistema sconti integrato
  async applyDiscount(orderId, discountData) {
    return this.request(`/orders/${orderId}/discount`, {
      method: 'POST',
      body: discountData,
    });
  }
}

// Singleton instance
const apiService = new ApiService();

export default apiService;